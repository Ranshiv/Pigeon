// models/AuditEvent.js
const mongoose = require('mongoose');

const auditEventSchema = new mongoose.Schema({
    actorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    workspaceId: {
        type: mongoose.Schema.Types.ObjectId,
        index: true,
        required: false
    },

    // e.g. workspace.create | team.member.role.update | compliance.audit-log.view
    action: { type: String, required: true, index: true },

    // e.g. workspace | team | environment | policy | audit_log
    targetType: { type: String, required: true, index: true },

    // target identifier can be ObjectId-like, string ids, etc.
    targetId: { type: mongoose.Schema.Types.Mixed, required: false, index: true },

    // Extra context (diffs, old/new values, policy ids, etc.)
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

    ip: { type: String, default: null },
    userAgent: { type: String, default: null },

    // For flexible retention windows per event type
    expiresAt: { type: Date, default: null, index: true },

    createdAt: { type: Date, default: Date.now, index: true }
});

// TTL index: documents expire when expiresAt <= now
// NOTE: MongoDB requires expireAfterSeconds=0 for an absolute expiry timestamp.
auditEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Query helpers
auditEventSchema.index({ workspaceId: 1, createdAt: -1 });
auditEventSchema.index({ actorId: 1, createdAt: -1 });
auditEventSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('AuditEvent', auditEventSchema);
