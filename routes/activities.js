const express = require('express');
const router = express.Router();
const ActivityLog = require('../models/ActivityLog');

const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated && req.isAuthenticated()) {
        return next();
    }
    return res.status(401).json({ error: 'Unauthorized' });
};

// Get activity logs
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const { limit = 20 } = req.query;
        // Fetch logs for user's workspace(s)
        // For now, getting all logs where user is involved or default view

        const logs = await ActivityLog.find()
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
