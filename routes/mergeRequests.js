const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { ensureAuthenticated } = require('../middleware/auth');
const { getDb } = require('../config/db');
const { emitWorkspaceNotification } = require('../utils/socket/socket-server');

const MERGE_FIELDS = ['description', 'requests', 'variables', 'documentation', 'tags', 'category', 'metadata'];
const toId = (value) => String(value?._id || value || '');
const clone = (value) => JSON.parse(JSON.stringify(value));
const sameValue = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const snapshotCollection = (collection) => MERGE_FIELDS.reduce((snapshot, field) => {
    snapshot[field] = collection[field] ?? (Array.isArray(field === 'requests' || field === 'variables' || field === 'tags' ? [] : null) ? [] : {});
    return snapshot;
}, {});

const getWorkspaceAccess = async (db, workspaceId, user) => {
    if (!ObjectId.isValid(workspaceId)) return null;
    const workspace = await db.collection('workspaces').findOne({ _id: new ObjectId(workspaceId) });
    if (!workspace) return null;
    const userId = String(user.id || user._id);
    if (String(workspace.owner) === userId) return { workspace, role: 'admin' };
    const collaborator = (workspace.collaborators || []).find((member) => String(member.userId) === userId);
    return collaborator ? { workspace, role: collaborator.role || 'viewer' } : null;
};

const canReview = (role) => ['admin', 'editor'].includes(role);
const actor = (user) => ({ userId: String(user.id || user._id), displayName: user.displayName || user.name || 'User', email: user.email });
const serialize = (mergeRequest) => ({
    ...mergeRequest,
    _id: toId(mergeRequest._id),
    workspaceId: toId(mergeRequest.workspaceId),
    sourceCollectionId: toId(mergeRequest.sourceCollectionId),
    targetCollectionId: toId(mergeRequest.targetCollectionId)
});

const writeActivity = (db, user, type, mergeRequest) => db.collection('workspaceActivity').insertOne({
    workspaceId: toId(mergeRequest.workspaceId),
    type,
    message: `${type.replace(/_/g, ' ')}: ${mergeRequest.title}`,
    user: actor(user),
    timestamp: new Date(),
    details: { mergeRequestId: toId(mergeRequest._id) }
});

router.post('/:id/approve', ensureAuthenticated, async (req, res) => {
    try {
        const mergeRequestId = req.params.id;
        if (!ObjectId.isValid(mergeRequestId)) return res.status(400).json({ message: 'Invalid merge request ID' });

        const db = getDb();
        const mergeRequest = await db.collection('mergeRequests').findOne({ _id: new ObjectId(mergeRequestId) });
        if (!mergeRequest) return res.status(404).json({ message: 'Merge request not found' });
        if (mergeRequest.status !== 'pending') return res.status(409).json({ message: 'Only pending merge requests can be merged' });

        const access = await getWorkspaceAccess(db, mergeRequest.workspaceId, req.user);
        if (!access || !canReview(access.role)) return res.status(403).json({ message: 'Only workspace admins and editors can merge requests' });
        if (!mergeRequest.targetSnapshot) {
            return res.status(409).json({ message: 'This merge request predates safe merging. Create a new request to merge it.' });
        }

        const targetId = toId(mergeRequest.targetCollectionId);
        if (!ObjectId.isValid(targetId)) return res.status(400).json({ message: 'Invalid target collection ID' });
        const target = await db.collection('collections').findOne({ _id: new ObjectId(targetId) });
        if (!target) return res.status(404).json({ message: 'Target collection not found' });

        const source = mergeRequest.proposedSnapshot;
        const base = mergeRequest.targetSnapshot;
        const current = snapshotCollection(target);
        const resolutions = req.body?.resolutions || {};
        const conflicts = [];
        const update = { updatedAt: new Date() };

        MERGE_FIELDS.forEach((field) => {
            if (sameValue(source[field], base[field])) {
                update[field] = current[field];
            } else if (sameValue(current[field], base[field]) || sameValue(current[field], source[field])) {
                update[field] = source[field];
            } else {
                const resolution = resolutions[field];
                if (!['source', 'target'].includes(resolution)) {
                    conflicts.push({ field, resolutionRequired: true });
                } else {
                    update[field] = resolution === 'source' ? source[field] : current[field];
                }
            }
        });

        if (conflicts.length > 0) {
            return res.status(409).json({
                code: 'MERGE_CONFLICT',
                message: 'The target changed after this merge request was created. Choose how to resolve each conflict.',
                mergeRequest: serialize(mergeRequest),
                conflicts
            });
        }

        const actionBy = actor(req.user);
        const now = new Date();
        const mergedSnapshot = MERGE_FIELDS.reduce((snapshot, field) => {
            snapshot[field] = clone(update[field]);
            return snapshot;
        }, {});
        const backup = { snapshot: current, mergedSnapshot, backedUpAt: now, backedUpBy: actionBy };
        const targetFilter = { _id: target._id };
        if (target.updatedAt) targetFilter.updatedAt = target.updatedAt;
        const mergeResult = await db.collection('collections').updateOne(targetFilter, { $set: update });
        if (mergeResult.matchedCount !== 1) {
            return res.status(409).json({
                code: 'TARGET_CHANGED',
                message: 'The target collection changed while this merge was being reviewed. Refresh and resolve it again.'
            });
        }
        await db.collection('mergeRequests').updateOne(
            { _id: new ObjectId(mergeRequestId) },
            { $set: { status: 'merged', actionBy, mergeBackup: backup, mergedAt: now, updatedAt: now, resolutions } }
        );

        const updated = { ...mergeRequest, status: 'merged', actionBy, mergeBackup: backup, mergedAt: now, updatedAt: now, resolutions };
        await writeActivity(db, req.user, 'merge_merged', updated);
        emitWorkspaceNotification(mergeRequest.workspaceId, {
            actorId: actionBy.userId,
            message: `${actionBy.displayName} merged: ${mergeRequest.title}`
        });
        return res.json(serialize(updated));
    } catch (error) {
        console.error('Error merging merge request:', error);
        return res.status(500).json({ message: 'Error merging merge request' });
    }
});

router.post('/:id/reject', ensureAuthenticated, async (req, res) => {
    try {
        const mergeRequestId = req.params.id;
        if (!ObjectId.isValid(mergeRequestId)) return res.status(400).json({ message: 'Invalid merge request ID' });
        const db = getDb();
        const mergeRequest = await db.collection('mergeRequests').findOne({ _id: new ObjectId(mergeRequestId) });
        if (!mergeRequest) return res.status(404).json({ message: 'Merge request not found' });
        if (mergeRequest.status !== 'pending') return res.status(409).json({ message: 'Only pending merge requests can be rejected' });
        const access = await getWorkspaceAccess(db, mergeRequest.workspaceId, req.user);
        if (!access || !canReview(access.role)) return res.status(403).json({ message: 'Only workspace admins and editors can reject merge requests' });

        const actionBy = actor(req.user);
        const now = new Date();
        await db.collection('mergeRequests').updateOne({ _id: new ObjectId(mergeRequestId) }, { $set: { status: 'rejected', actionBy, updatedAt: now } });
        const updated = { ...mergeRequest, status: 'rejected', actionBy, updatedAt: now };
        await writeActivity(db, req.user, 'merge_rejected', updated);
        emitWorkspaceNotification(mergeRequest.workspaceId, {
            actorId: actionBy.userId,
            severity: 'warning',
            message: `${actionBy.displayName} rejected merge request: ${mergeRequest.title}`
        });
        return res.json(serialize(updated));
    } catch (error) {
        console.error('Error rejecting merge request:', error);
        return res.status(500).json({ message: 'Error rejecting merge request' });
    }
});

router.post('/:id/rollback', ensureAuthenticated, async (req, res) => {
    try {
        const mergeRequestId = req.params.id;
        if (!ObjectId.isValid(mergeRequestId)) return res.status(400).json({ message: 'Invalid merge request ID' });
        const db = getDb();
        const mergeRequest = await db.collection('mergeRequests').findOne({ _id: new ObjectId(mergeRequestId) });
        if (!mergeRequest) return res.status(404).json({ message: 'Merge request not found' });
        if (mergeRequest.status !== 'merged' || !mergeRequest.mergeBackup?.snapshot) {
            return res.status(409).json({ message: 'This merge request does not have a rollback snapshot' });
        }
        const access = await getWorkspaceAccess(db, mergeRequest.workspaceId, req.user);
        if (!access || !canReview(access.role)) return res.status(403).json({ message: 'Only workspace admins and editors can roll back merges' });

        const targetId = toId(mergeRequest.targetCollectionId);
        if (!ObjectId.isValid(targetId)) return res.status(400).json({ message: 'Invalid target collection ID' });
        const now = new Date();
        const target = await db.collection('collections').findOne({ _id: new ObjectId(targetId) });
        if (!target) return res.status(404).json({ message: 'Target collection not found' });

        const current = snapshotCollection(target);
        const mergedSnapshot = mergeRequest.mergeBackup.mergedSnapshot;
        const changedAfterMerge = !mergedSnapshot || MERGE_FIELDS.some(
            (field) => !sameValue(current[field], mergedSnapshot[field])
        );
        if (changedAfterMerge) {
            return res.status(409).json({
                message: 'The target collection changed after this merge. Rollback was stopped to prevent data loss.'
            });
        }

        const rollbackFilter = { _id: target._id };
        if (target.updatedAt) rollbackFilter.updatedAt = target.updatedAt;
        const rollbackResult = await db.collection('collections').updateOne(
            rollbackFilter,
            { $set: { ...clone(mergeRequest.mergeBackup.snapshot), updatedAt: now } }
        );
        if (rollbackResult.matchedCount !== 1) {
            return res.status(409).json({ message: 'The target collection changed during rollback. No changes were applied.' });
        }
        const actionBy = actor(req.user);
        await db.collection('mergeRequests').updateOne({ _id: new ObjectId(mergeRequestId) }, { $set: { status: 'rolled_back', rolledBackAt: now, rolledBackBy: actionBy, updatedAt: now } });
        const updated = { ...mergeRequest, status: 'rolled_back', rolledBackAt: now, rolledBackBy: actionBy, updatedAt: now };
        await writeActivity(db, req.user, 'merge_rolled_back', updated);
        emitWorkspaceNotification(mergeRequest.workspaceId, {
            actorId: actionBy.userId,
            severity: 'warning',
            message: `${actionBy.displayName} rolled back merge: ${mergeRequest.title}`
        });
        return res.json(serialize(updated));
    } catch (error) {
        console.error('Error rolling back merge request:', error);
        return res.status(500).json({ message: 'Error rolling back merge request' });
    }
});

module.exports = router;
