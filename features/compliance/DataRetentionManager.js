// features/compliance/DataRetentionManager.js
const { getDb } = require('../../config/db');

/**
 * DataRetentionManager
 *
 * Provides policy-driven retention for compliance-related data.
 *
 * Design:
 * - We use an absolute-expiry TTL strategy via AuditEvent.expiresAt.
 * - Retention windows are workspace-scoped (workspace.settings.compliance.retention).
 */
class DataRetentionManager {
    constructor() {
        this.defaultPolicy = {
            retention: {
                // Audit logs typically require long retention (SOC2 / enterprise). Default: 7 years.
                auditLogDays: 365 * 7,

                // Policy violations may be reviewed more frequently.
                policyViolationDays: 365,

                // Access review snapshots/bundles retention.
                accessReviewDays: 365
            },
            gdpr: {
                enabled: true,
                processingBasisDefault: 'contract' // contract | consent | legal_obligation | legitimate_interest | vital_interest | public_task
            }
        };
    }

    async getWorkspacePolicy(workspaceId) {
        const db = getDb();
        if (!db) throw new Error('Database not initialized');

        const workspace = await db.collection('workspaces').findOne({
            _id: this._maybeObjectId(workspaceId)
        });

        const compliance = workspace?.settings?.compliance;
        return this._mergeDeep(this.defaultPolicy, compliance || {});
    }

    async updateWorkspacePolicy(workspaceId, patch) {
        const db = getDb();
        if (!db) throw new Error('Database not initialized');

        const id = this._maybeObjectId(workspaceId);

        // We store compliance settings under workspace.settings.compliance.
        // Note: Many workspace docs are not strict-schema enforced (native driver usage).
        const update = {};

        for (const [k, v] of Object.entries(patch || {})) {
            update[`settings.compliance.${k}`] = v;
        }

        await db.collection('workspaces').updateOne(
            { _id: id },
            { $set: update, $currentDate: { updatedAt: true } },
            { upsert: false }
        );

        return this.getWorkspacePolicy(workspaceId);
    }

    async computeAuditEventExpiry({ workspaceId, action }) {
        const policy = await this.getWorkspacePolicy(workspaceId);

        const retention = policy?.retention || {};

        let days = retention.auditLogDays;
        if (typeof action === 'string' && action.startsWith('policy.violation')) {
            days = retention.policyViolationDays;
        }
        if (typeof action === 'string' && action.startsWith('compliance.access-review')) {
            days = retention.accessReviewDays;
        }

        if (!days || days <= 0) return null;

        const ms = days * 24 * 60 * 60 * 1000;
        return new Date(Date.now() + ms);
    }

    _maybeObjectId(id) {
        const mongoose = require('mongoose');
        if (id && mongoose.Types.ObjectId.isValid(id)) return new mongoose.Types.ObjectId(id);
        return id;
    }

    _mergeDeep(base, override) {
        if (!override || typeof override !== 'object') return base;

        const output = Array.isArray(base) ? [...base] : { ...base };
        for (const [key, value] of Object.entries(override)) {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                output[key] = this._mergeDeep(base?.[key] || {}, value);
            } else {
                output[key] = value;
            }
        }
        return output;
    }
}

module.exports = new DataRetentionManager();
module.exports.DataRetentionManager = DataRetentionManager;
