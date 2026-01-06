// features/compliance/AuditLogger.js
const mongoose = require('mongoose');
const AuditEvent = require('../../models/AuditEvent');
const DataRetentionManager = require('./DataRetentionManager');

function toObjectIdOrNull(value) {
    if (!value) return null;
    if (value instanceof mongoose.Types.ObjectId) return value;
    if (mongoose.Types.ObjectId.isValid(value)) return new mongoose.Types.ObjectId(value);
    return null;
}

/**
 * AuditLogger
 *
 * Single entry point for writing audit events.
 *
 * NOTE: Audit events are distinct from request history (History.js):
 * - History: request/response tracing (what was called, what returned)
 * - AuditEvent: governance trail (who changed what, when, and why)
 */
class AuditLogger {
    constructor() {
        this.enabled = true;
    }

    /**
     * Create an audit event.
     * @param {object} params
     * @param {object} [params.req] Express request (for ip/user-agent)
     * @param {string|ObjectId} params.actorId
     * @param {string|ObjectId} params.workspaceId
     * @param {string} params.action
     * @param {string} params.targetType
     * @param {string|ObjectId|any} [params.targetId]
     * @param {object} [params.metadata]
     */
    async log(params) {
        if (!this.enabled) return null;

        const { req, actorId, workspaceId, action, targetType, targetId, metadata } = params || {};

        const actorObjectId = toObjectIdOrNull(actorId);
        if (!actorObjectId) {
            // We require a real actor for compliance-grade logging.
            // In dev, some routes may still call this without a verified actor.
            throw new Error('AuditLogger.log requires a valid actorId');
        }

        const workspaceObjectId = toObjectIdOrNull(workspaceId);

        const ip = req ? (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || null) : null;
        const userAgent = req ? (req.headers['user-agent'] || null) : null;

        const expiresAt = workspaceObjectId
            ? await DataRetentionManager.computeAuditEventExpiry({ workspaceId: workspaceObjectId.toString(), action })
            : null;

        const event = new AuditEvent({
            actorId: actorObjectId,
            workspaceId: workspaceObjectId || undefined,
            action,
            targetType,
            targetId,
            metadata: metadata || {},
            ip,
            userAgent,
            expiresAt
        });

        await event.save();
        return event;
    }
}

module.exports = new AuditLogger();
module.exports.AuditLogger = AuditLogger;
