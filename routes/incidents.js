// routes/incidents.js
const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const Incident = require('../models/Incident');
const Alert = require('../models/Alert');
const IncidentManagementService = require('../services/IncidentManagementService');
const EscalationEngine = require('../features/api-monitoring/alerting/EscalationEngine');

const escalationEngine = new EscalationEngine();

// Get all incidents
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const { workspaceId, status, severity, teamId, limit = 50, skip = 0 } = req.query;
        const query = {};

        if (workspaceId) query.workspaceId = workspaceId;
        if (status) query.status = status;
        if (severity) query.severity = severity;
        if (teamId) query.teamId = teamId;

        const incidents = await Incident.find(query)
            .populate('alerts')
            .populate('teamId', 'name')
            .populate('acknowledgedBy', 'username email')
            .populate('resolvedBy', 'username email')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip))
            .lean();

        const total = await Incident.countDocuments(query);

        res.json({
            incidents,
            pagination: {
                total,
                limit: parseInt(limit),
                skip: parseInt(skip),
                hasMore: total > parseInt(skip) + parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching incidents:', error);
        res.status(500).json({ message: 'Error fetching incidents', error: error.message });
    }
});

// Get single incident
router.get('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const incident = await Incident.findById(req.params.id)
            .populate('alerts')
            .populate('teamId')
            .populate('acknowledgedBy', 'username email')
            .populate('resolvedBy', 'username email')
            .populate('timeline.actor', 'username email')
            .populate('affectedServices.monitorId', 'name url');

        if (!incident) {
            return res.status(404).json({ message: 'Incident not found' });
        }

        res.json(incident);
    } catch (error) {
        console.error('Error fetching incident:', error);
        res.status(500).json({ message: 'Error fetching incident', error: error.message });
    }
});

// Create incident
router.post('/', ensureAuthenticated, async (req, res) => {
    try {
        const incidentData = {
            ...req.body,
            workspaceId: req.body.workspaceId || req.user.workspaceId
        };

        const incident = await IncidentManagementService.createIncident(
            incidentData,
            req.user.id
        );

        res.status(201).json(incident);
    } catch (error) {
        console.error('Error creating incident:', error);
        res.status(500).json({ message: 'Error creating incident', error: error.message });
    }
});

// Update incident
router.put('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const incident = await Incident.findById(req.params.id);

        if (!incident) {
            return res.status(404).json({ message: 'Incident not found' });
        }

        const allowedUpdates = ['title', 'description', 'severity', 'priority', 'tags'];
        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                incident[field] = req.body[field];
            }
        });

        await incident.save();
        res.json(incident);
    } catch (error) {
        console.error('Error updating incident:', error);
        res.status(500).json({ message: 'Error updating incident', error: error.message });
    }
});

// Acknowledge incident
router.post('/:id/acknowledge', ensureAuthenticated, async (req, res) => {
    try {
        const { notes } = req.body;

        const incident = await IncidentManagementService.acknowledgeIncident(
            req.params.id,
            req.user.id,
            notes
        );

        res.json(incident);
    } catch (error) {
        console.error('Error acknowledging incident:', error);
        res.status(400).json({ message: error.message });
    }
});

// Resolve incident
router.post('/:id/resolve', ensureAuthenticated, async (req, res) => {
    try {
        const resolutionData = {
            notes: req.body.notes,
            rootCause: req.body.rootCause,
            solution: req.body.solution
        };

        const incident = await IncidentManagementService.resolveIncident(
            req.params.id,
            req.user.id,
            resolutionData
        );

        res.json(incident);
    } catch (error) {
        console.error('Error resolving incident:', error);
        res.status(400).json({ message: error.message });
    }
});

// Snooze incident
router.post('/:id/snooze', ensureAuthenticated, async (req, res) => {
    try {
        const { duration } = req.body; // duration in milliseconds

        if (!duration || duration <= 0) {
            return res.status(400).json({ message: 'Valid snooze duration is required' });
        }

        const incident = await IncidentManagementService.snoozeIncident(
            req.params.id,
            req.user.id,
            duration
        );

        res.json(incident);
    } catch (error) {
        console.error('Error snoozing incident:', error);
        res.status(400).json({ message: error.message });
    }
});

// Escalate incident
router.post('/:id/escalate', ensureAuthenticated, async (req, res) => {
    try {
        const escalationData = {
            reason: req.body.reason,
            targetTeam: req.body.targetTeam,
            targetUser: req.body.targetUser
        };

        const incident = await IncidentManagementService.escalateIncident(
            req.params.id,
            req.user.id,
            escalationData
        );

        res.json(incident);
    } catch (error) {
        console.error('Error escalating incident:', error);
        res.status(400).json({ message: error.message });
    }
});

// Add update to incident
router.post('/:id/updates', ensureAuthenticated, async (req, res) => {
    try {
        const { message, status, metadata } = req.body;

        if (!message) {
            return res.status(400).json({ message: 'Update message is required' });
        }

        const incident = await Incident.findById(req.params.id);

        if (!incident) {
            return res.status(404).json({ message: 'Incident not found' });
        }

        incident.addUpdate(message, status, req.user.id, metadata);
        await incident.save();

        res.json(incident);
    } catch (error) {
        console.error('Error adding incident update:', error);
        res.status(500).json({ message: 'Error adding incident update', error: error.message });
    }
});

// Add timeline entry
router.post('/:id/timeline', ensureAuthenticated, async (req, res) => {
    try {
        const timelineEntry = {
            ...req.body,
            actor: req.user.id
        };

        const incident = await Incident.findById(req.params.id);

        if (!incident) {
            return res.status(404).json({ message: 'Incident not found' });
        }

        incident.addTimeline(timelineEntry);
        await incident.save();

        res.json(incident);
    } catch (error) {
        console.error('Error adding timeline entry:', error);
        res.status(500).json({ message: 'Error adding timeline entry', error: error.message });
    }
});

// Get incident timeline
router.get('/:id/timeline', ensureAuthenticated, async (req, res) => {
    try {
        const incident = await Incident.findById(req.params.id)
            .select('timeline')
            .populate('timeline.actor', 'username email');

        if (!incident) {
            return res.status(404).json({ message: 'Incident not found' });
        }

        res.json(incident.timeline);
    } catch (error) {
        console.error('Error fetching incident timeline:', error);
        res.status(500).json({ message: 'Error fetching incident timeline', error: error.message });
    }
});

// Get incident metrics
router.get('/:id/metrics', ensureAuthenticated, async (req, res) => {
    try {
        const incident = await Incident.findById(req.params.id);

        if (!incident) {
            return res.status(404).json({ message: 'Incident not found' });
        }

        const metrics = {
            mtta: incident.metrics.mtta,
            mttr: incident.metrics.mttr,
            duration: incident.duration,
            escalationLevel: incident.escalationLevel,
            totalAlerts: incident.alerts.length,
            affectedServices: incident.affectedServices.length
        };

        res.json(metrics);
    } catch (error) {
        console.error('Error fetching incident metrics:', error);
        res.status(500).json({ message: 'Error fetching incident metrics', error: error.message });
    }
});

// Get post-mortem
router.get('/:id/post-mortem', ensureAuthenticated, async (req, res) => {
    try {
        const incident = await Incident.findById(req.params.id);

        if (!incident) {
            return res.status(404).json({ message: 'Incident not found' });
        }

        if (incident.status !== 'resolved' && incident.status !== 'closed') {
            return res.status(400).json({ message: 'Post-mortem only available for resolved incidents' });
        }

        // Generate post-mortem if not exists
        let postMortem = incident.metadata?.postMortem;

        if (!postMortem) {
            postMortem = await IncidentManagementService.generatePostMortem(incident);
        }

        res.json(postMortem);
    } catch (error) {
        console.error('Error fetching post-mortem:', error);
        res.status(500).json({ message: 'Error fetching post-mortem', error: error.message });
    }
});

// Link alerts to incident
router.post('/:id/alerts', ensureAuthenticated, async (req, res) => {
    try {
        const { alertIds } = req.body;

        if (!alertIds || !Array.isArray(alertIds)) {
            return res.status(400).json({ message: 'alertIds array is required' });
        }

        const incident = await Incident.findById(req.params.id);

        if (!incident) {
            return res.status(404).json({ message: 'Incident not found' });
        }

        // Add alerts to incident
        incident.alerts.push(...alertIds);
        await incident.save();

        // Update alerts with incident reference
        await Alert.updateMany(
            { _id: { $in: alertIds } },
            { $set: { incidentId: incident._id } }
        );

        res.json(incident);
    } catch (error) {
        console.error('Error linking alerts to incident:', error);
        res.status(500).json({ message: 'Error linking alerts', error: error.message });
    }
});

// Correlate alerts and suggest incidents
router.post('/correlate-alerts', ensureAuthenticated, async (req, res) => {
    try {
        const { workspaceId, startDate, endDate } = req.body;

        const query = {
            status: { $in: ['triggered', 'acknowledged'] },
            incidentId: { $exists: false }
        };

        if (workspaceId) {
            const Monitor = require('../models/Monitor');
            const monitors = await Monitor.find({ workspaceId }).select('_id');
            query.monitorId = { $in: monitors.map(m => m._id) };
        }

        if (startDate) {
            query.triggeredAt = { $gte: new Date(startDate) };
        }

        if (endDate) {
            query.triggeredAt = { ...query.triggeredAt, $lte: new Date(endDate) };
        }

        const alerts = await Alert.find(query).populate('monitorId');
        const correlatedGroups = await IncidentManagementService.correlateAlerts(alerts);

        res.json(correlatedGroups);
    } catch (error) {
        console.error('Error correlating alerts:', error);
        res.status(500).json({ message: 'Error correlating alerts', error: error.message });
    }
});

// Get incident statistics
router.get('/statistics/summary', ensureAuthenticated, async (req, res) => {
    try {
        const { workspaceId, startDate, endDate } = req.query;
        const query = {};

        if (workspaceId) query.workspaceId = workspaceId;

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        const [
            totalIncidents,
            openIncidents,
            criticalIncidents,
            avgMTTR,
            avgMTTA
        ] = await Promise.all([
            Incident.countDocuments(query),
            Incident.countDocuments({ ...query, status: { $in: ['open', 'acknowledged'] } }),
            Incident.countDocuments({ ...query, severity: 'critical' }),
            Incident.aggregate([
                { $match: { ...query, 'metrics.mttr': { $exists: true, $gt: 0 } } },
                { $group: { _id: null, avg: { $avg: '$metrics.mttr' } } }
            ]),
            Incident.aggregate([
                { $match: { ...query, 'metrics.mtta': { $exists: true, $gt: 0 } } },
                { $group: { _id: null, avg: { $avg: '$metrics.mtta' } } }
            ])
        ]);

        res.json({
            totalIncidents,
            openIncidents,
            criticalIncidents,
            avgMTTR: avgMTTR[0]?.avg || 0,
            avgMTTA: avgMTTA[0]?.avg || 0
        });
    } catch (error) {
        console.error('Error fetching incident statistics:', error);
        res.status(500).json({ message: 'Error fetching statistics', error: error.message });
    }
});

// Get resolution patterns
router.get('/statistics/resolution-patterns', ensureAuthenticated, async (req, res) => {
    try {
        const { workspaceId } = req.query;
        const filters = {};

        if (workspaceId) filters.workspaceId = workspaceId;

        const patterns = await IncidentManagementService.getResolutionPatterns(filters);
        res.json(patterns);
    } catch (error) {
        console.error('Error fetching resolution patterns:', error);
        res.status(500).json({ message: 'Error fetching resolution patterns', error: error.message });
    }
});

// Get MTTR/MTTA metrics over time
router.get('/statistics/metrics-over-time', ensureAuthenticated, async (req, res) => {
    try {
        const { workspaceId, startDate, endDate, interval = 'day' } = req.query;
        const match = {};

        if (workspaceId) match.workspaceId = workspaceId;
        if (startDate || endDate) {
            match.createdAt = {};
            if (startDate) match.createdAt.$gte = new Date(startDate);
            if (endDate) match.createdAt.$lte = new Date(endDate);
        }

        const groupBy = interval === 'hour' ? {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
            hour: { $hour: '$createdAt' }
        } : {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
        };

        const pipeline = [
            { $match: match },
            {
                $group: {
                    _id: groupBy,
                    avgMTTR: { $avg: '$metrics.mttr' },
                    avgMTTA: { $avg: '$metrics.mtta' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } }
        ];

        const metrics = await Incident.aggregate(pipeline);
        res.json(metrics);
    } catch (error) {
        console.error('Error fetching metrics over time:', error);
        res.status(500).json({ message: 'Error fetching metrics', error: error.message });
    }
});

// Get cached MTTR/MTTA metrics
router.get('/statistics/cached-metrics', ensureAuthenticated, async (req, res) => {
    try {
        const { range = '24h' } = req.query;
        const metrics = IncidentManagementService.getMetrics(range);
        res.json(metrics);
    } catch (error) {
        console.error('Error fetching cached metrics:', error);
        res.status(500).json({ message: 'Error fetching cached metrics', error: error.message });
    }
});

module.exports = router;
