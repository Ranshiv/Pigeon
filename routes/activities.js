const express = require('express');
const router = express.Router();
const ActivityLog = require('../models/ActivityLog');
const Workspace = require('../models/Workspace');
const { ensureAuthenticated } = require('../middleware/auth');

// Get activity logs
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const { limit = 20, scope = 'team' } = req.query;

        // This feed is global (mounted app-wide, not per-workspace page), so scope
        // it to every workspace the user belongs to rather than a single id —
        // req.session.workspaceId is never set anywhere, which made this always
        // fall back to the literal string 'default' and miss real activity.
        const workspaces = await Workspace.find(
            { $or: [{ owner: req.user._id }, { 'collaborators.userId': req.user._id }] },
            '_id'
        ).lean();
        const workspaceIds = workspaces.map(w => String(w._id));
        workspaceIds.push('default');

        const query = { workspaceId: { $in: workspaceIds } };

        if (scope === 'me') {
            query.user = req.user._id;
        }

        const logs = await ActivityLog.find(query)
            .populate('user', 'displayName')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        res.json(logs);
    } catch (err) {
        console.error('Fetch Activity Error:', err);
        res.status(500).json({ error: 'Failed to fetch activity logs' });
    }
});

module.exports = router;
