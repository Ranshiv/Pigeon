// features/compliance/ComplianceReporter.js
const AuditEvent = require('../../models/AuditEvent');
const AccessControlAuditor = require('./AccessControlAuditor');
const mongoose = require('mongoose');

function escapeRegExp(str) {
    return String(str).replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toObjectIdOrNull(value) {
    if (!value) return null;
    if (value instanceof mongoose.Types.ObjectId) return value;
    if (mongoose.Types.ObjectId.isValid(value)) return new mongoose.Types.ObjectId(value);
    return null;
}

function escapeCsv(value) {
    if (value === null || value === undefined) return '';
    const s = typeof value === 'string' ? value : JSON.stringify(value);
    if (/[",\n]/.test(s)) return `"${s.replaceAll(/"/g, '""')}"`;
    return s;
}

class ComplianceReporter {
    async generateAuditLogReport({ workspaceId, filters = {} }) {
        const baseMatch = { workspaceId };

        // Partial action match (case-insensitive)
        if (filters.action) baseMatch.action = new RegExp(escapeRegExp(filters.action), 'i');

        // Exact matches
        if (filters.targetType) baseMatch.targetType = filters.targetType;
        if (filters.targetId !== undefined) baseMatch.targetId = filters.targetId;

        if (filters.startDate || filters.endDate) {
            baseMatch.createdAt = {};
            if (filters.startDate) baseMatch.createdAt.$gte = new Date(filters.startDate);
            if (filters.endDate) baseMatch.createdAt.$lte = new Date(filters.endDate);
        }

        const limit = filters.limit || 5000;
        const actorObjectId = toObjectIdOrNull(filters.actorId);

        let items;
        if (filters.actorId && !actorObjectId) {
            // actorId supplied but not a full ObjectId => partial match
            const actorRegex = new RegExp(escapeRegExp(filters.actorId), 'i');
            items = await AuditEvent.aggregate([
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
                },
                { $sort: { createdAt: -1 } },
                { $limit: limit }
            ]);
        } else {
            const query = { ...baseMatch };
            if (actorObjectId) query.actorId = actorObjectId;

            items = await AuditEvent.find(query)
                .sort({ createdAt: -1 })
                .limit(limit);
        }

        return {
            generatedAt: new Date(),
            workspaceId,
            filters,
            total: items.length,
            items
        };
    }

    toAuditCsv(report) {
        const headers = [
            'createdAt',
            'actorId',
            'workspaceId',
            'action',
            'targetType',
            'targetId',
            'ip',
            'userAgent',
            'metadata'
        ];

        const rows = [headers.join(',')];
        for (const e of report.items || []) {
            rows.push([
                escapeCsv(e.createdAt?.toISOString?.() || e.createdAt),
                escapeCsv(e.actorId?.toString?.() || e.actorId),
                escapeCsv(e.workspaceId?.toString?.() || e.workspaceId),
                escapeCsv(e.action),
                escapeCsv(e.targetType),
                escapeCsv(e.targetId),
                escapeCsv(e.ip),
                escapeCsv(e.userAgent),
                escapeCsv(e.metadata)
            ].join(','));
        }

        return rows.join('\n');
    }

    toAuditHtml(report) {
        const title = 'Audit Log Report';
        const rows = (report.items || []).map(e => `
            <tr>
              <td>${escapeHtml(e.createdAt?.toISOString?.() || '')}</td>
              <td>${escapeHtml(e.actorId?.toString?.() || '')}</td>
              <td>${escapeHtml(e.action || '')}</td>
              <td>${escapeHtml(e.targetType || '')}</td>
              <td>${escapeHtml(String(e.targetId ?? ''))}</td>
            </tr>
        `).join('');

        return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
    h1 { margin: 0 0 8px; }
    .meta { color: #555; margin-bottom: 16px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
    th { background: #f5f5f5; text-align: left; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="meta">Generated: ${new Date(report.generatedAt).toISOString()} · Workspace: ${escapeHtml(report.workspaceId?.toString?.() || '')}</div>
  <table>
    <thead>
      <tr>
        <th>Time</th>
        <th>Actor</th>
        <th>Action</th>
        <th>Target Type</th>
        <th>Target Id</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
    }

    async generateAccessReviewReport({ workspaceId }) {
        const snapshot = await AccessControlAuditor.snapshotWorkspaceAccess(workspaceId);
        return {
            generatedAt: new Date(),
            workspaceId,
            snapshot
        };
    }

    async generateEvidenceBundle({ workspaceId, policy }) {
        const accessReview = await this.generateAccessReviewReport({ workspaceId });
        return {
            generatedAt: new Date(),
            workspaceId,
            controls: {
                auditLogging: {
                    description: 'Audit trail exists for state-changing events and compliance access',
                    evidence: {
                        model: 'AuditEvent',
                        retention: policy?.retention || null
                    }
                },
                accessReview: {
                    description: 'Workspace and team access snapshot generated',
                    evidence: accessReview
                },
                retentionPolicy: {
                    description: 'Workspace retention policy configured',
                    evidence: policy?.retention || null
                }
            }
        };
    }
}

function escapeHtml(str) {
    const s = String(str ?? '');
    return s
        .replaceAll(/&/g, '&amp;')
        .replaceAll(/</g, '&lt;')
        .replaceAll(/>/g, '&gt;')
        .replaceAll(/"/g, '&quot;')
        .replaceAll(/'/g, '&#039;');
}

module.exports = new ComplianceReporter();
module.exports.ComplianceReporter = ComplianceReporter;
