const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();
const ActivityLog = require('../models/ActivityLog');
const { getDb } = require('../config/db');
const { ensureAuthenticated } = require('../middleware/auth');

// Get activity logs
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        res.set('Cache-Control', 'no-store, private');
        const { limit = 20 } = req.query;
        const scope = req.query.scope === 'me' ? 'me' : 'team';
        const currentUser = req.user._id || req.user.id;
        const currentUserId = String(currentUser);
        const currentUserObjectId = ObjectId.isValid(currentUserId)
            ? new ObjectId(currentUserId)
            : null;

        // This feed is global (mounted app-wide, not per-workspace page), so scope
        // it to every workspace the user belongs to rather than a single id —
        // req.session.workspaceId is never set anywhere, which made this always
        // fall back to the literal string 'default' and miss real activity.
        const memberConditions = [
            { owner: currentUserId },
            { 'collaborators.userId': currentUserId }
        ];
        if (currentUserObjectId) {
            memberConditions.push(
                { owner: currentUserObjectId },
                { 'collaborators.userId': currentUserObjectId }
            );
        }
        const workspaces = await getDb().collection('workspaces')
            .find(
                { $or: memberConditions },
                { projection: { _id: 1, name: 1, owner: 1, userId: 1, collaborators: 1, isPersonal: 1 } }
            )
            .toArray();
        const workspaceIds = workspaces.map((workspace) => String(workspace._id));
        const isTeamWorkspace = (workspace) => {
            const ownerId = String(workspace.owner || workspace.userId || '');
            const hasAnotherMember = (workspace.collaborators || []).some(
                (collaborator) => String(collaborator.userId || '') !== currentUserId
            );

            // A personal workspace becomes collaborative once another member is
            // invited. Its activity belongs in the Team timeline too.
            return ownerId !== currentUserId || hasAnotherMember;
        };
        const teamWorkspaceIds = workspaces
            .filter((workspace) => String(workspace._id) !== 'default' && isTeamWorkspace(workspace))
            .map((workspace) => String(workspace._id));

        // "My Activity" is strictly activity performed by the signed-in user.
        // "Team" is the shared-workspace timeline, including the current user's
        // changes. Excluding the actor made a user's own shared edits appear to
        // disappear when they were the only recent contributor.
        const query = scope === 'me'
            ? { user: currentUser, workspaceId: { $in: [...workspaceIds, 'default'] } }
            : {
                workspaceId: { $in: teamWorkspaceIds }
            };

        const logs = await ActivityLog.find(query)
            .populate('user', 'displayName')
            .sort({ createdAt: -1 })
            .limit(Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100));

        // Enforce the Team workspace boundary after population too. This excludes
        // personal/default activity while retaining all shared-workspace members.
        const scopedLogs = scope === 'team'
            ? logs.filter((log) => (
                String(log.workspaceId) !== 'default'
            ))
            : logs;

        const workspaceById = new Map(workspaces.map((workspace) => [
            String(workspace._id),
            {
                id: String(workspace._id),
                name: workspace.name || 'Untitled workspace',
                category: isTeamWorkspace(workspace) ? 'team' : 'personal'
            }
        ]));

        res.json(scopedLogs.map((log) => {
            const activity = log.toObject();
            return {
                ...activity,
                workspace: workspaceById.get(String(activity.workspaceId)) || {
                    id: String(activity.workspaceId || 'default'),
                    name: 'Personal workspace',
                    category: 'personal'
                }
            };
        }));
    } catch (err) {
        console.error('Fetch Activity Error:', err);
        res.status(500).json({ error: 'Failed to fetch activity logs' });
    }
});

module.exports = router;
