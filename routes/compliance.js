// routes/compliance.js
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const { ensureAuthenticated } = require('../middleware/auth');
const { getDb } = require('../config/db');

const AuditEvent = require('../models/AuditEvent');
const AuditLogger = require('../features/compliance/AuditLogger');
const DataRetentionManager = require('../features/compliance/DataRetentionManager');
const AccessControlAuditor = require('../features/compliance/AccessControlAuditor');
const ComplianceReporter = require('../features/compliance/ComplianceReporter');
const GDPRService = require('../features/compliance/GDPRService');

function toObjectIdOrUndefined(value) {
    if (!value) return undefined;
    if (value instanceof mongoose.Types.ObjectId) return value;
    if (mongoose.Types.ObjectId.isValid(value)) return new mongoose.Types.ObjectId(value);
    return undefined;
}

function escapeRegExp(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function resolveWorkspaceIdForUser(db, userId, workspaceId) {
    if (workspaceId !== 'my-workspace') return workspaceId;

    const personal = await db.collection('workspaces').findOne({
        isPersonal: true,
        $or: [{ owner: userId }, { owner: toObjectIdOrUndefined(userId) }]
    });

    if (!personal?._id) return null;
    return personal._id.toString();
}

async function requireWorkspaceAdmin(req, res, next) {
    try {
        const db = getDb();
        if (!db) return res.status(500).json({ message: 'Database not initialized' });

        const workspaceIdRaw = req.query.workspaceId || req.params.workspaceId || req.body?.workspaceId;
        if (!workspaceIdRaw) {
            return res.status(400).json({ message: 'workspaceId is required' });
        }

        const resolved = await resolveWorkspaceIdForUser(db, req.user.id, workspaceIdRaw);
        if (!resolved) return res.status(404).json({ message: 'Workspace not found' });

        req._resolvedWorkspaceId = resolved;

        const workspaceId = toObjectIdOrUndefined(resolved) || resolved;

        const workspace = await db.collection('workspaces').findOne({ _id: workspaceId });
        if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

        const userId = req.user.id;
        const userObjectId = toObjectIdOrUndefined(userId);

        const isOwner = (workspace.owner?.toString?.() || workspace.owner) === userId ||
            (userObjectId && workspace.owner?.toString?.() === userObjectId.toString());

        const collabs = Array.isArray(workspace.collaborators) ? workspace.collaborators : [];
        const collaborator = collabs.find(c => {
            const cid = c?.userId?.toString?.() || c?.userId;
            return cid === userId || (userObjectId && cid === userObjectId.toString());
        });

        const role = collaborator?.role;
        const isAdmin = isOwner || role === 'admin';

        if (!isAdmin) {
            return res.status(403).json({ message: 'Admin/owner role required for compliance access' });
        }

        return next();
    } catch (err) {
        console.error('Compliance RBAC error:', err);
        return res.status(500).json({ message: 'Compliance RBAC error', error: err.message });
    }
}

// --- Audit Log Query ---
router.get('/audit-events', ensureAuthenticated, requireWorkspaceAdmin, async (req, res) => {
    try {
        const workspaceId = req._resolvedWorkspaceId;

        // Log access-to-logs
        await AuditLogger.log({
            req,
            actorId: req.user.id,
            workspaceId,
            action: 'compliance.audit-log.view',
            targetType: 'audit_log',
            targetId: workspaceId,
            metadata: {
                query: { ...req.query }
            }
        });

        const {
            actorId,
            action,
            targetType,
            targetId,
            startDate,
            endDate,
            page = '1',
            limit = '50'
        } = req.query;

        const workspaceObjectId = toObjectIdOrUndefined(workspaceId);
        const actorObjectId = actorId ? toObjectIdOrUndefined(actorId) : undefined;

        const baseMatch = { workspaceId: workspaceObjectId };

        // Partial matches
        if (action) {
            // Case-insensitive contains match so partial typing works.
            baseMatch.action = new RegExp(escapeRegExp(action), 'i');
        }

        // Exact matches
        if (targetType) baseMatch.targetType = targetType;
        if (targetId) baseMatch.targetId = targetId;

        if (startDate || endDate) {
            baseMatch.createdAt = {};
            if (startDate) baseMatch.createdAt.$gte = new Date(startDate);
            if (endDate) baseMatch.createdAt.$lte = new Date(endDate);
        }

        const pageNum = Math.max(parseInt(page, 10) || 1, 1);
        const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);

        // ActorId handling:
        // - If actorId is a valid ObjectId => exact match (indexed)
        // - If actorId is partial => match against stringified actorId via aggregation
        let items;
        let total;

        if (actorId && !actorObjectId) {
            const actorRegex = new RegExp(escapeRegExp(actorId), 'i');

            const pipelineBase = [
                { $match: baseMatch },
                {
                    $match: {
                        $expr: {
                            $regexMatch: {
                                input: { $toString: '$actorId' },
                                regex: actorRegex
                            }
                        }
                    }
                }
            ];

            const [paged, counted] = await Promise.all([
                AuditEvent.aggregate([
                    ...pipelineBase,
                    { $sort: { createdAt: -1 } },
                    { $skip: (pageNum - 1) * limitNum },
                    { $limit: limitNum }
                ]),
                AuditEvent.aggregate([
                    ...pipelineBase,
                    { $count: 'total' }
                ])
            ]);

            items = paged;
            total = counted?.[0]?.total || 0;
        } else {
            const query = { ...baseMatch };
            if (actorObjectId) query.actorId = actorObjectId;

            const [found, count] = await Promise.all([
                AuditEvent.find(query)
                    .sort({ createdAt: -1 })
                    .skip((pageNum - 1) * limitNum)
                    .limit(limitNum),
                AuditEvent.countDocuments(query)
            ]);

            items = found;
            total = count;
        }

        res.json({
            items,
            total,
            page: pageNum,
            limit: limitNum
        });
    } catch (error) {
        console.error('Error querying audit events:', error);
        res.status(500).json({ message: 'Error querying audit events', error: error.message });
    }
});

// --- Policy (retention + GDPR) ---
router.get('/policy', ensureAuthenticated, requireWorkspaceAdmin, async (req, res) => {
    try {
        const workspaceId = req._resolvedWorkspaceId;

        await AuditLogger.log({
            req,
            actorId: req.user.id,
            workspaceId,
            action: 'compliance.policy.view',
            targetType: 'compliance_policy',
            targetId: workspaceId
        });

        const policy = await DataRetentionManager.getWorkspacePolicy(workspaceId);
        res.json(policy);
    } catch (error) {
        console.error('Error fetching compliance policy:', error);
        res.status(500).json({ message: 'Error fetching compliance policy', error: error.message });
    }
});

router.put('/policy', ensureAuthenticated, requireWorkspaceAdmin, async (req, res) => {
    try {
        const workspaceId = req._resolvedWorkspaceId;
        const patch = req.body || {};

        await AuditLogger.log({
            req,
            actorId: req.user.id,
            workspaceId,
            action: 'compliance.policy.update',
            targetType: 'compliance_policy',
            targetId: workspaceId,
            metadata: { patch }
        });

        const updated = await DataRetentionManager.updateWorkspacePolicy(workspaceId, patch);
        res.json(updated);
    } catch (error) {
        console.error('Error updating compliance policy:', error);
        res.status(500).json({ message: 'Error updating compliance policy', error: error.message });
    }
});

// --- Access Review ---
router.get('/access-review', ensureAuthenticated, requireWorkspaceAdmin, async (req, res) => {
    try {
        const workspaceId = req._resolvedWorkspaceId;

        await AuditLogger.log({
            req,
            actorId: req.user.id,
            workspaceId,
            action: 'compliance.access-review.view',
            targetType: 'access_review',
            targetId: workspaceId
        });

        const snapshot = await AccessControlAuditor.snapshotWorkspaceAccess(workspaceId);
        res.json(snapshot);
    } catch (error) {
        console.error('Error generating access review:', error);
        res.status(500).json({ message: 'Error generating access review', error: error.message });
    }
});

// --- Reports / Exports ---
router.get('/reports/audit-log', ensureAuthenticated, requireWorkspaceAdmin, async (req, res) => {
    try {
        const workspaceId = req._resolvedWorkspaceId;
        const format = (req.query.format || 'json').toLowerCase();

        await AuditLogger.log({
            req,
            actorId: req.user.id,
            workspaceId,
            action: 'compliance.audit-log.export',
            targetType: 'audit_log_report',
            targetId: workspaceId,
            metadata: { format, filters: { ...req.query } }
        });

        const report = await ComplianceReporter.generateAuditLogReport({
            workspaceId: toObjectIdOrUndefined(workspaceId),
            filters: {
                actorId: req.query.actorId || undefined,
                action: req.query.action,
                targetType: req.query.targetType,
                targetId: req.query.targetId,
                startDate: req.query.startDate,
                endDate: req.query.endDate,
                limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined
            }
        });

        if (format === 'csv') {
            const csv = ComplianceReporter.toAuditCsv(report);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="audit_log_${Date.now()}.csv"`);
            return res.send(csv);
        }

        if (format === 'html') {
            const html = ComplianceReporter.toAuditHtml(report);
            res.setHeader('Content-Type', 'text/html');
            res.setHeader('Content-Disposition', `attachment; filename="audit_log_${Date.now()}.html"`);
            return res.send(html);
        }

        res.json(report);
    } catch (error) {
        console.error('Error generating audit log report:', error);
        res.status(500).json({ message: 'Error generating audit log report', error: error.message });
    }
});

router.get('/reports/access-review', ensureAuthenticated, requireWorkspaceAdmin, async (req, res) => {
    try {
        const workspaceId = req._resolvedWorkspaceId;
        const format = (req.query.format || 'json').toLowerCase();

        await AuditLogger.log({
            req,
            actorId: req.user.id,
            workspaceId,
            action: 'compliance.access-review.export',
            targetType: 'access_review_report',
            targetId: workspaceId,
            metadata: { format }
        });

        const report = await ComplianceReporter.generateAccessReviewReport({ workspaceId });

        if (format === 'json') {
            res.setHeader('Content-Disposition', `attachment; filename="access_review_${Date.now()}.json"`);
            return res.json(report);
        }

        res.status(400).json({ message: 'Unsupported format (supported: json)' });
    } catch (error) {
        console.error('Error generating access review report:', error);
        res.status(500).json({ message: 'Error generating access review report', error: error.message });
    }
});

router.get('/reports/evidence-bundle', ensureAuthenticated, requireWorkspaceAdmin, async (req, res) => {
    try {
        const workspaceId = req._resolvedWorkspaceId;
        const policy = await DataRetentionManager.getWorkspacePolicy(workspaceId);

        await AuditLogger.log({
            req,
            actorId: req.user.id,
            workspaceId,
            action: 'compliance.evidence-bundle.export',
            targetType: 'evidence_bundle',
            targetId: workspaceId
        });

        const bundle = await ComplianceReporter.generateEvidenceBundle({ workspaceId, policy });
        res.setHeader('Content-Disposition', `attachment; filename="evidence_bundle_${Date.now()}.json"`);
        res.json(bundle);
    } catch (error) {
        console.error('Error generating evidence bundle:', error);
        res.status(500).json({ message: 'Error generating evidence bundle', error: error.message });
    }
});

// --- GDPR exports ---
router.get('/gdpr/export/user/:userId', ensureAuthenticated, requireWorkspaceAdmin, async (req, res) => {
    try {
        const workspaceId = req._resolvedWorkspaceId;
        const format = (req.query.format || 'json').toLowerCase();
        const userId = req.params.userId;

        await AuditLogger.log({
            req,
            actorId: req.user.id,
            workspaceId,
            action: 'compliance.gdpr.export.user',
            targetType: 'gdpr_export',
            targetId: userId,
            metadata: { format }
        });

        const payload = await GDPRService.exportUserComplianceData({
            userId: toObjectIdOrUndefined(userId),
            workspaceId: toObjectIdOrUndefined(workspaceId)
        });

        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="gdpr_user_${Date.now()}.csv"`);
            return res.send(GDPRService.toCsv(payload));
        }

        res.setHeader('Content-Disposition', `attachment; filename="gdpr_user_${Date.now()}.json"`);
        res.json(payload);
    } catch (error) {
        console.error('Error generating GDPR user export:', error);
        res.status(500).json({ message: 'Error generating GDPR user export', error: error.message });
    }
});

router.get('/gdpr/export/workspace/:workspaceId', ensureAuthenticated, requireWorkspaceAdmin, async (req, res) => {
    try {
        // requireWorkspaceAdmin resolves workspaceId already, so ignore the param for access.
        const workspaceId = req._resolvedWorkspaceId;
        const format = (req.query.format || 'json').toLowerCase();

        await AuditLogger.log({
            req,
            actorId: req.user.id,
            workspaceId,
            action: 'compliance.gdpr.export.workspace',
            targetType: 'gdpr_export',
            targetId: workspaceId,
            metadata: { format }
        });

        const payload = await GDPRService.exportWorkspaceComplianceData({
            workspaceId: toObjectIdOrUndefined(workspaceId)
        });

        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="gdpr_workspace_${Date.now()}.csv"`);
            return res.send(GDPRService.toCsv(payload));
        }

        res.setHeader('Content-Disposition', `attachment; filename="gdpr_workspace_${Date.now()}.json"`);
        res.json(payload);
    } catch (error) {
        console.error('Error generating GDPR workspace export:', error);
        res.status(500).json({ message: 'Error generating GDPR workspace export', error: error.message });
    }
});

router.post('/gdpr/users/:userId/anonymize', ensureAuthenticated, requireWorkspaceAdmin, async (req, res) => {
    try {
        const workspaceId = req._resolvedWorkspaceId;
        const userId = req.params.userId;

        await AuditLogger.log({
            req,
            actorId: req.user.id,
            workspaceId,
            action: 'compliance.gdpr.user.anonymize',
            targetType: 'user',
            targetId: userId
        });

        const user = await GDPRService.anonymizeUser({ userId });
        res.json({ message: 'User anonymized', userId: user._id });
    } catch (error) {
        console.error('Error anonymizing user:', error);
        res.status(500).json({ message: 'Error anonymizing user', error: error.message });
    }
});

module.exports = router;
