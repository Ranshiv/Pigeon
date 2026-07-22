// routes/alerts.js
const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const Alert = require('../models/Alert');
const Monitor = require('../models/Monitor');

// List alerts (ungrouped) with optional filters.
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const { status, severity, workspaceId, timeRange, limit = 100, skip = 0 } = req.query;
        const query = {};

        if (status) query.status = status;
        if (severity) query.severity = severity;

        if (workspaceId) {
            const monitors = await Monitor.find({ workspaceId }).select('_id').lean();
            query.monitorId = { $in: monitors.map(m => m._id) };
        }

        if (timeRange) {
            const now = new Date();
            let start = now;
            switch (timeRange) {
                case '1h': start = new Date(now - 60 * 60 * 1000); break;
                case '24h': start = new Date(now - 24 * 60 * 60 * 1000); break;
                case '7d': start = new Date(now - 7 * 24 * 60 * 60 * 1000); break;
                case '30d': start = new Date(now - 30 * 24 * 60 * 60 * 1000); break;
                default: start = new Date(now - 24 * 60 * 60 * 1000);
            }
            query.triggeredAt = { $gte: start };
        }

        const alerts = await Alert.find(query)
            .populate('monitorId', 'name url')
            .populate('policyId', 'name')
            .sort({ triggeredAt: -1 })
            .limit(Math.min(1000, Math.max(1, parseInt(limit) || 100)))
            .skip(Math.max(0, parseInt(skip) || 0))
            .lean();

        res.json(alerts);
    } catch (error) {
        console.error('Error fetching alerts:', error);
        res.status(500).json({ message: 'Error fetching alerts', error: error.message });
    }
});

// Acknowledge an alert.
router.post('/:id/acknowledge', ensureAuthenticated, async (req, res) => {
    try {
        const alert = await Alert.findById(req.params.id);
        if (!alert) return res.status(404).json({ message: 'Alert not found' });

        alert.status = 'acknowledged';
        alert.acknowledgedAt = new Date();
        alert.acknowledgedBy = req.user._id;
        await alert.save();

        res.json(alert);
    } catch (error) {
        console.error('Error acknowledging alert:', error);
        res.status(500).json({ message: 'Error acknowledging alert', error: error.message });
    }
});

// Snooze an alert.
router.post('/:id/snooze', ensureAuthenticated, async (req, res) => {
    try {
        const { duration } = req.body;
        const ms = parseInt(duration) || 3600000;

        const alert = await Alert.findById(req.params.id);
        if (!alert) return res.status(404).json({ message: 'Alert not found' });

        alert.status = 'snoozed';
        alert.snoozedUntil = new Date(Date.now() + ms);
        await alert.save();

        res.json(alert);
    } catch (error) {
        console.error('Error snoozing alert:', error);
        res.status(500).json({ message: 'Error snoozing alert', error: error.message });
    }
});

// Resolve an alert.
router.post('/:id/resolve', ensureAuthenticated, async (req, res) => {
    try {
        const alert = await Alert.findById(req.params.id);
        if (!alert) return res.status(404).json({ message: 'Alert not found' });

        alert.status = 'resolved';
        alert.resolvedAt = new Date();
        alert.resolvedBy = req.user._id;
        await alert.save();

        res.json(alert);
    } catch (error) {
        console.error('Error resolving alert:', error);
        res.status(500).json({ message: 'Error resolving alert', error: error.message });
    }
});

module.exports = router;
