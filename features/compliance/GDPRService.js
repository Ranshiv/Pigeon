// features/compliance/GDPRService.js
const AuditEvent = require('../../models/AuditEvent');
const User = require('../../models/User');

/**
 * GDPRService
 *
 * Minimal GDPR tooling starter:
 * - Data export (user/workspace) for compliance-related datasets (AuditEvents)
 * - Anonymization workflow for user profile data while preserving audit integrity
 */
class GDPRService {
    async exportUserComplianceData({ userId, workspaceId }) {
        const query = { actorId: userId };
        if (workspaceId) query.workspaceId = workspaceId;

        const events = await AuditEvent.find(query).sort({ createdAt: -1 }).limit(10000);

        return {
            generatedAt: new Date(),
            scope: 'user',
            userId,
            workspaceId: workspaceId || null,
            auditEvents: events
        };
    }

    async exportWorkspaceComplianceData({ workspaceId }) {
        const events = await AuditEvent.find({ workspaceId }).sort({ createdAt: -1 }).limit(20000);

        return {
            generatedAt: new Date(),
            scope: 'workspace',
            workspaceId,
            auditEvents: events
        };
    }

    /**
     * Anonymize user profile while preserving referential integrity.
     *
     * IMPORTANT: we do NOT modify existing AuditEvent records (append-only).
     * Instead, we redact user PII stored in the User document.
     */
    async anonymizeUser({ userId }) {
        const user = await User.findById(userId);
        if (!user) throw new Error('User not found');

        const redactedEmail = `redacted+${user._id.toString()}@pigeon.local`;

        user.displayName = 'Redacted User';
        user.email = redactedEmail;
        user.profileIcon = null;
        user.googleId = `redacted-${user._id.toString()}`;

        await user.save();
        return user;
    }

    toCsv(payload) {
        // For exports, we provide a CSV of the auditEvents array.
        const events = payload.auditEvents || [];
        const headers = ['createdAt', 'actorId', 'workspaceId', 'action', 'targetType', 'targetId'];
        const lines = [headers.join(',')];
        for (const e of events) {
            lines.push([
                this._csv(e.createdAt?.toISOString?.() || ''),
                this._csv(e.actorId?.toString?.() || ''),
                this._csv(e.workspaceId?.toString?.() || ''),
                this._csv(e.action || ''),
                this._csv(e.targetType || ''),
                this._csv(String(e.targetId ?? ''))
            ].join(','));
        }
        return lines.join('\n');
    }

    _csv(v) {
        const s = String(v ?? '');
        if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
    }
}

module.exports = new GDPRService();
module.exports.GDPRService = GDPRService;
