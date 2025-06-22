// routes/monitoring.js
const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const Monitor = require('../models/Monitor');
const HealthCheck = require('../models/HealthCheck');
const Incident = require('../models/Incident');
const MonitoringService = require('../services/monitoring/MonitoringService');
const EmailService = require('../services/EmailService');

// Get all monitors for the authenticated user
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const { workspaceId, status, tags } = req.query;
        const query = { userId: req.user.id };

        if (workspaceId) {
            query.workspaceId = workspaceId;
        }

        if (status) {
            query.currentStatus = status;
        }

        if (tags) {
            query.tags = { $in: tags.split(',') };
        }

        const monitors = await Monitor.find(query)
            .sort({ createdAt: -1 })
            .lean();

        // Add uptime percentage to each monitor
        const monitorsWithStats = monitors.map(monitor => ({
            ...monitor,
            uptimePercentage: monitor.totalChecks === 0 ? 100 :
                ((monitor.totalChecks - monitor.totalFailures) / monitor.totalChecks * 100).toFixed(2)
        }));

        res.json(monitorsWithStats);
    } catch (error) {
        console.error('Error fetching monitors:', error);
        res.status(500).json({ message: 'Error fetching monitors', error: error.message });
    }
});

// Get a specific monitor
router.get('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const monitor = await Monitor.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!monitor) {
            return res.status(404).json({ message: 'Monitor not found' });
        }

        // Add uptime percentage
        const uptimePercentage = monitor.totalChecks === 0 ? 100 :
            ((monitor.totalChecks - monitor.totalFailures) / monitor.totalChecks * 100).toFixed(2);

        res.json({
            ...monitor.toObject(),
            uptimePercentage
        });
    } catch (error) {
        console.error('Error fetching monitor:', error);
        res.status(500).json({ message: 'Error fetching monitor', error: error.message });
    }
});

// Create a new monitor
router.post('/', ensureAuthenticated, async (req, res) => {
    try {
        const monitorData = {
            ...req.body,
            userId: req.user.id
        };

        const monitor = new Monitor(monitorData);
        await monitor.save();

        res.status(201).json(monitor);
    } catch (error) {
        console.error('Error creating monitor:', error);
        res.status(400).json({ message: 'Error creating monitor', error: error.message });
    }
});

// Update a monitor
router.put('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const monitor = await Monitor.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            req.body,
            { new: true, runValidators: true }
        );

        if (!monitor) {
            return res.status(404).json({ message: 'Monitor not found' });
        }

        res.json(monitor);
    } catch (error) {
        console.error('Error updating monitor:', error);
        res.status(400).json({ message: 'Error updating monitor', error: error.message });
    }
});

// Delete a monitor
router.delete('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const monitor = await Monitor.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!monitor) {
            return res.status(404).json({ message: 'Monitor not found' });
        }

        // Delete associated health checks
        await HealthCheck.deleteMany({ monitorId: monitor._id });

        res.json({ message: 'Monitor deleted successfully' });
    } catch (error) {
        console.error('Error deleting monitor:', error);
        res.status(500).json({ message: 'Error deleting monitor', error: error.message });
    }
});

// Get health check history for a monitor
router.get('/:id/history', ensureAuthenticated, async (req, res) => {
    try {
        const { limit = 100, page = 1, timeRange } = req.query;
        const skip = (page - 1) * limit;

        // Verify monitor ownership
        const monitor = await Monitor.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!monitor) {
            return res.status(404).json({ message: 'Monitor not found' });
        }

        // Build time range filter
        let timeFilter = {};
        if (timeRange) {
            const now = new Date();
            let startDate;

            switch (timeRange) {
                case '1h':
                    startDate = new Date(now.getTime() - (60 * 60 * 1000));
                    break;
                case '24h':
                    startDate = new Date(now.getTime() - (24 * 60 * 60 * 1000));
                    break;
                case '7d':
                    startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
                    break;
                case '30d':
                    startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
                    break;
                default:
                    startDate = new Date(now.getTime() - (24 * 60 * 60 * 1000)); // Default 24h
            }

            timeFilter.checkedAt = { $gte: startDate };
        }

        const healthChecks = await HealthCheck.find({
            monitorId: req.params.id,
            ...timeFilter
        })
            .sort({ checkedAt: -1 })
            .limit(parseInt(limit))
            .skip(skip)
            .lean();

        const total = await HealthCheck.countDocuments({
            monitorId: req.params.id,
            ...timeFilter
        });

        res.json({
            healthChecks,
            pagination: {
                current: parseInt(page),
                total: Math.ceil(total / limit),
                count: healthChecks.length,
                totalRecords: total
            }
        });
    } catch (error) {
        console.error('Error fetching health check history:', error);
        res.status(500).json({ message: 'Error fetching health check history', error: error.message });
    }
});

// Get monitor statistics
router.get('/:id/stats', ensureAuthenticated, async (req, res) => {
    try {
        const { timeRange = '24h' } = req.query;

        // Verify monitor ownership
        const monitor = await Monitor.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!monitor) {
            return res.status(404).json({ message: 'Monitor not found' });
        }

        // Calculate time range
        const now = new Date();
        let startDate;

        switch (timeRange) {
            case '1h':
                startDate = new Date(now.getTime() - (60 * 60 * 1000));
                break;
            case '24h':
                startDate = new Date(now.getTime() - (24 * 60 * 60 * 1000));
                break;
            case '7d':
                startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
                break;
            case '30d':
                startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
                break;
            default:
                startDate = new Date(now.getTime() - (24 * 60 * 60 * 1000));
        }

        // Aggregate statistics
        const stats = await HealthCheck.aggregate([
            {
                $match: {
                    monitorId: monitor._id,
                    checkedAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: null,
                    totalChecks: { $sum: 1 },
                    successfulChecks: {
                        $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] }
                    },
                    failures: {
                        $sum: { $cond: [{ $eq: ['$status', 'failure'] }, 1, 0] }
                    },
                    timeouts: {
                        $sum: { $cond: [{ $eq: ['$status', 'timeout'] }, 1, 0] }
                    },
                    avgResponseTime: { $avg: '$responseTime' },
                    minResponseTime: { $min: '$responseTime' },
                    maxResponseTime: { $max: '$responseTime' }
                }
            }
        ]);

        const result = stats[0] || {
            totalChecks: 0,
            successfulChecks: 0,
            failures: 0,
            timeouts: 0,
            avgResponseTime: 0,
            minResponseTime: 0,
            maxResponseTime: 0
        };

        // Calculate uptime percentage
        result.uptimePercentage = result.totalChecks === 0 ? 100 :
            ((result.successfulChecks / result.totalChecks) * 100).toFixed(2);

        res.json(result);
    } catch (error) {
        console.error('Error fetching monitor stats:', error);
        res.status(500).json({ message: 'Error fetching monitor stats', error: error.message });
    }
});

// Run manual health check
router.post('/:id/check', ensureAuthenticated, async (req, res) => {
    try {
        // Verify monitor ownership
        const monitor = await Monitor.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!monitor) {
            return res.status(404).json({ message: 'Monitor not found' });
        }

        const healthCheck = await MonitoringService.runManualCheck(req.params.id);
        res.json(healthCheck);
    } catch (error) {
        console.error('Error running manual check:', error);
        res.status(500).json({ message: 'Error running manual check', error: error.message });
    }
});

// Get public status page data (updated version)
router.get('/public', async (req, res) => {
    try {
        const publicMonitors = await Monitor.find({
            isPublic: true,
            isActive: true
        })
            .select('name url currentStatus lastChecked averageResponseTime totalChecks totalFailures description')
            .lean();

        // Add uptime percentage and map status for public display
        const monitorsWithUptime = publicMonitors.map(monitor => ({
            id: monitor._id,
            name: monitor.name,
            description: monitor.description || monitor.url,
            url: monitor.url,
            currentStatus: mapToPublicStatus(monitor.currentStatus),
            lastChecked: monitor.lastChecked,
            averageResponseTime: monitor.averageResponseTime || 0,
            uptimePercentage: monitor.totalChecks === 0 ? '100.00' :
                ((monitor.totalChecks - monitor.totalFailures) / monitor.totalChecks * 100).toFixed(2)
        }));

        res.json(monitorsWithUptime);
    } catch (error) {
        console.error('Error fetching public monitors:', error);
        res.status(500).json({ message: 'Error fetching public monitors', error: error.message });
    }
});

// Get recent incidents for public status page
router.get('/incidents/recent', async (req, res) => {
    try {
        const { limit = 10 } = req.query;

        // Get recent public incidents (last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));

        const incidents = await Incident.find({
            isPublic: true,
            createdAt: { $gte: thirtyDaysAgo }
        })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .populate('affectedServices.monitorId', 'name url')
            .lean();

        // Format incidents for public display
        const formattedIncidents = incidents.map(incident => ({
            id: incident._id,
            title: incident.title,
            description: incident.description,
            status: incident.status,
            severity: incident.severity,
            createdAt: incident.createdAt,
            resolvedAt: incident.resolvedAt,
            affectedServices: incident.affectedServices.map(service => ({
                name: service.serviceName || (service.monitorId ? service.monitorId.name : 'Unknown Service')
            })),
            updates: incident.updates.map(update => ({
                message: update.message,
                timestamp: update.timestamp,
                status: update.status
            }))
        }));

        res.json(formattedIncidents);
    } catch (error) {
        console.error('Error fetching recent incidents:', error);
        res.status(500).json({ message: 'Error fetching recent incidents', error: error.message });
    }
});

// Helper function to map internal status to public-friendly status
function mapToPublicStatus(internalStatus) {
    switch (internalStatus) {
        case 'up':
            return 'operational';
        case 'down':
            return 'down';
        case 'degraded':
            return 'degraded';
        default:
            return 'unknown';
    }
}

// Test email configuration
router.post('/test-email', ensureAuthenticated, async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Email address is required' });
        }

        const emailService = new EmailService();
        await emailService.sendTestEmail(email);

        res.json({ message: 'Test email sent successfully' });
    } catch (error) {
        console.error('Error sending test email:', error);
        res.status(500).json({ message: 'Error sending test email', error: error.message });
    }
});

// Get monitoring service status
router.get('/service/status', ensureAuthenticated, async (req, res) => {
    try {
        const status = MonitoringService.getStatus();
        res.json(status);
    } catch (error) {
        console.error('Error getting service status:', error);
        res.status(500).json({ message: 'Error getting service status', error: error.message });
    }
});

module.exports = router;
