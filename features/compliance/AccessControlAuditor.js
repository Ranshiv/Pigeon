// features/compliance/AccessControlAuditor.js
const { getDb } = require('../../config/db');
const mongoose = require('mongoose');

function maybeObjectId(id) {
    if (id && mongoose.Types.ObjectId.isValid(id)) return new mongoose.Types.ObjectId(id);
    return id;
}

/**
 * AccessControlAuditor
 *
 * Produces auditor-friendly snapshots:
 * - Workspace membership & roles
 * - Team membership & roles
 * - Basic anomalies (duplicates, missing ids)
 */
class AccessControlAuditor {
    async snapshotWorkspaceAccess(workspaceId) {
        const db = getDb();
        if (!db) throw new Error('Database not initialized');

        const wsId = maybeObjectId(workspaceId);

        const workspace = await db.collection('workspaces').findOne({ _id: wsId });
        if (!workspace) {
            return {
                workspaceId,
                found: false,
                issues: [{ type: 'workspace_not_found', message: 'Workspace not found' }]
            };
        }

        const collaborators = Array.isArray(workspace.collaborators) ? workspace.collaborators : [];
        const owner = workspace.owner;

        // Identify duplicates by userId/email
        const seen = new Set();
        const issues = [];
        for (const c of collaborators) {
            const key = c?.userId?.toString?.() || c?.userId || c?.email || '(unknown)';
            if (seen.has(key)) {
                issues.push({
                    type: 'duplicate_collaborator',
                    message: `Duplicate collaborator entry: ${key}`,
                    collaborator: c
                });
            }
            seen.add(key);

            if (!c?.userId && !c?.email) {
                issues.push({
                    type: 'collaborator_missing_identifier',
                    message: 'Collaborator entry missing userId/email',
                    collaborator: c
                });
            }
        }

        // Teams associated with this workspace
        const teams = await db.collection('teams').find({
            $or: [
                { workspaceId: workspaceId },
                { workspaceId: wsId?.toString?.() }
            ]
        }).toArray();

        return {
            workspaceId: wsId?.toString?.() || workspaceId,
            found: true,
            workspace: {
                name: workspace.name,
                isPersonal: workspace.isPersonal || false,
                isPublic: workspace.isPublic || false,
                owner,
                collaborators: collaborators.map(c => ({
                    userId: c.userId,
                    email: c.email,
                    displayName: c.displayName,
                    role: c.role,
                    permissions: c.permissions
                }))
            },
            teams: teams.map(t => ({
                teamId: t._id?.toString?.() || t._id,
                name: t.name,
                ownerId: t.ownerId,
                members: (t.members || []).map(m => ({
                    userId: m.userId,
                    role: m.role,
                    permissions: m.permissions
                }))
            })),
            issues
        };
    }
}

module.exports = new AccessControlAuditor();
module.exports.AccessControlAuditor = AccessControlAuditor;
