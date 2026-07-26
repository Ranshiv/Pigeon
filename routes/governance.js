// routes/governance.js
// API Inventory & Governance Scorecard aggregation.
// Aggregation lives on the server because it spans collections, monitors,
// environments, api versions and audit events — pulling all of those to the
// browser would be several round trips and would leak documents the user
// cannot access.
const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { ensureAuthenticated } = require('../middleware/auth');
const { getDb } = require('../config/db');
const { scoreCollection, CATEGORY_WEIGHTS, CATEGORY_LABELS } = require('../services/GovernanceScoringService');

function toObjectId(value) {
    if (!value) return null;
    if (value instanceof ObjectId) return value;
    return ObjectId.isValid(value) ? new ObjectId(String(value)) : null;
}

function idKey(value) {
    if (value === null || value === undefined) return '';
    return String(value?._id || value);
}

/**
 * Collections the user may see: owned, or where they are a collaborator.
 * Public collections are intentionally excluded — governance data is internal.
 */
function collectionAccessFilter(userId, userObjectId) {
    const ids = [userId, ...(userObjectId ? [userObjectId] : [])];
    return {
        $or: [
            { owner: { $in: ids } },
            { userId: { $in: ids } },
            { 'collaborators.userId': { $in: ids } }
        ]
    };
}

router.get('/scorecard', ensureAuthenticated, async (req, res) => {
    try {
        const db = getDb();
        if (!db) return res.status(500).json({ message: 'Database not initialized' });

        const userId = req.user.id;
        const userObjectId = toObjectId(userId);
        const requestedWorkspaceId = req.query.workspaceId;

        const collectionFilter = collectionAccessFilter(userId, userObjectId);
        if (requestedWorkspaceId && requestedWorkspaceId !== 'all') {
            const wsOid = toObjectId(requestedWorkspaceId);
            collectionFilter.workspaceId = { $in: [requestedWorkspaceId, ...(wsOid ? [wsOid] : [])] };
        }

        const collections = await db.collection('collections').find(collectionFilter).toArray();

        if (collections.length === 0) {
            return res.json({
                items: [],
                summary: emptySummary(),
                weights: CATEGORY_WEIGHTS,
                categoryLabels: CATEGORY_LABELS
            });
        }

        const workspaceIds = [...new Set(collections.map((c) => idKey(c.workspaceId)).filter(Boolean))];
        const ownerIds = [...new Set(collections.map((c) => idKey(c.owner || c.userId)).filter(Boolean))];
        const collectionIds = collections.map((c) => c._id);

        const [workspaces, owners, monitors, environments, versions, auditEvents] = await Promise.all([
            db.collection('workspaces')
                .find({ _id: { $in: workspaceIds.map(toObjectId).filter(Boolean) } })
                .project({ name: 1, isPersonal: 1 })
                .toArray(),
            db.collection('users')
                .find({ _id: { $in: ownerIds.map(toObjectId).filter(Boolean) } })
                .project({ displayName: 1, email: 1 })
                .toArray(),
            // Monitors are per-user; the scorecard reflects what this user can see.
            db.collection('monitors')
                .find({ userId: { $in: [userId, ...(userObjectId ? [userObjectId] : [])] } })
                .project({ url: 1, tags: 1, isActive: 1, currentStatus: 1, workspaceId: 1, collectionId: 1 })
                .toArray(),
            db.collection('environments')
                .find({ userId: { $in: [userId, ...(userObjectId ? [userObjectId] : [])] } })
                .project({ name: 1, workspaceId: 1, type: 1 })
                .toArray(),
            db.collection('apiversions')
                .find({ collectionId: { $in: collectionIds } })
                .project({ collectionId: 1, isDeprecated: 1, version: 1 })
                .toArray(),
            db.collection('auditevents')
                .aggregate([
                    { $match: { targetId: { $in: [...collectionIds, ...collectionIds.map(String)] } } },
                    { $group: { _id: '$targetId', count: { $sum: 1 } } }
                ])
                .toArray()
        ]);

        const workspaceById = new Map(workspaces.map((w) => [idKey(w._id), w]));
        const ownerById = new Map(owners.map((u) => [idKey(u._id), u]));

        const monitorsByWorkspace = groupBy(monitors, (m) => idKey(m.workspaceId));
        const envsByWorkspace = groupBy(environments, (e) => idKey(e.workspaceId));
        const versionsByCollection = groupBy(versions, (v) => idKey(v.collectionId));
        const auditCountByCollection = new Map(auditEvents.map((a) => [idKey(a._id), a.count]));

        const items = collections.map((collection) => {
            const wsKey = idKey(collection.workspaceId);
            const ownerKey = idKey(collection.owner || collection.userId);
            const workspace = workspaceById.get(wsKey);
            const owner = ownerById.get(ownerKey);
            const cKey = idKey(collection._id);

            return scoreCollection(collection, {
                // Unassigned collections still see the user's global/unscoped resources.
                monitors: monitorsByWorkspace.get(wsKey) || monitorsByWorkspace.get('') || [],
                environments: envsByWorkspace.get(wsKey) || envsByWorkspace.get('') || [],
                versions: versionsByCollection.get(cKey) || [],
                auditEventCount: auditCountByCollection.get(cKey) || 0,
                workspaceId: wsKey || null,
                workspaceName: workspace?.name || 'Unassigned',
                ownerId: ownerKey || null,
                ownerName: owner?.displayName || owner?.email || 'Unknown'
            });
        });

        items.sort((a, b) => a.score - b.score);

        res.json({
            items,
            summary: summarize(items),
            weights: CATEGORY_WEIGHTS,
            categoryLabels: CATEGORY_LABELS
        });
    } catch (error) {
        console.error('Error building governance scorecard:', error);
        res.status(500).json({ message: 'Error building governance scorecard' });
    }
});

function groupBy(list, keyFn) {
    const map = new Map();
    list.forEach((item) => {
        const key = keyFn(item);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(item);
    });
    return map;
}

function emptySummary() {
    return {
        totalApis: 0,
        averageScore: 0,
        totalRequests: 0,
        monitoredApis: 0,
        documentedPercent: 0,
        atRisk: 0
    };
}

function summarize(items) {
    if (items.length === 0) return emptySummary();

    const totalRequests = items.reduce((s, i) => s + i.metrics.requestCount, 0);
    const documented = items.reduce((s, i) => s + i.metrics.documentedCount, 0);

    return {
        totalApis: items.length,
        averageScore: Math.round(items.reduce((s, i) => s + i.score, 0) / items.length),
        totalRequests,
        monitoredApis: items.filter((i) => i.metrics.monitorCount > 0).length,
        documentedPercent: totalRequests === 0 ? 0 : Math.round((documented / totalRequests) * 100),
        atRisk: items.filter((i) => i.score < 50).length
    };
}

module.exports = router;
