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
// Support both /api/monitoring and /api/monitoring/monitors
router.get(['/', '/monitors'], ensureAuthenticated, async (req, res) => {
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
// Constrain :id so it doesn't catch routes like /alert-policies
router.get('/:id([0-9a-fA-F]{24})', ensureAuthenticated, async (req, res) => {
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
// Support both /api/monitoring and /api/monitoring/monitors
router.post(['/', '/monitors'], ensureAuthenticated, async (req, res) => {
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
router.put('/:id([0-9a-fA-F]{24})', ensureAuthenticated, async (req, res) => {
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
router.delete('/:id([0-9a-fA-F]{24})', ensureAuthenticated, async (req, res) => {
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
router.get('/:id([0-9a-fA-F]{24})/history', ensureAuthenticated, async (req, res) => {
    try {
        const { limit = 100, page = 1, timeRange } = req.query;
        const limitNum = Math.max(1, Math.min(1000, Math.trunc(Number(limit) || 100)));
        const pageNum = Math.max(1, Math.trunc(Number(page) || 1));
        const skip = (pageNum - 1) * limitNum;

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
            .limit(limitNum)
            .skip(skip)
            .lean();

        const total = await HealthCheck.countDocuments({
            monitorId: req.params.id,
            ...timeFilter
        });

        res.json({
            healthChecks,
            pagination: {
                current: pageNum,
                total: Math.ceil(total / limitNum),
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
router.get('/:id([0-9a-fA-F]{24})/stats', ensureAuthenticated, async (req, res) => {
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
router.post('/:id([0-9a-fA-F]{24})/check', ensureAuthenticated, async (req, res) => {
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
        const limitNum = Math.max(1, Math.min(100, Math.trunc(Number(limit) || 10)));

        // Get recent public incidents (last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));

        const incidents = await Incident.find({
            isPublic: true,
            createdAt: { $gte: thirtyDaysAgo }
        })
            .sort({ createdAt: -1 })
            .limit(limitNum)
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

// =====================
// ALERT POLICY ROUTES
// =====================

const AlertPolicy = require('../models/AlertPolicy');
const OnCallSchedule = require('../models/OnCallSchedule');
const EscalationPolicy = require('../models/EscalationPolicy');
const Alert = require('../models/Alert');
const AlertingService = require('../services/AlertingService');
const Workspace = require('../models/Workspace');

const normalizeAlertPolicyPayload = (body) => {
    const payload = { ...body };

    // Older clients used `monitors`; schema uses `monitorIds`
    if (!payload.monitorIds && Array.isArray(payload.monitors)) {
        payload.monitorIds = payload.monitors;
    }

    // When clients send populated monitor objects, normalize to ids
    if (Array.isArray(payload.monitorIds)) {
        payload.monitorIds = payload.monitorIds
            .map((m) => {
                if (!m) return null;
                if (typeof m === 'string') return m;
                if (typeof m === 'object') return m._id || m.id || null;
                return String(m);
            })
            .filter(Boolean);
    }

    // Normalize conditions
    if (Array.isArray(payload.conditions)) {
        payload.conditions = payload.conditions.map((c) => {
            const next = { ...c };

            // Older clients used `value`; schema uses `threshold`
            if (next.threshold === undefined && next.value !== undefined) {
                next.threshold = next.value;
            }

            // Map human-readable operator strings to schema enum
            const operatorMap = {
                greater: 'gt',
                greaterThan: 'gt',
                greater_or_equal: 'gte',
                greaterOrEqual: 'gte',
                less: 'lt',
                lessThan: 'lt',
                less_or_equal: 'lte',
                lessOrEqual: 'lte',
                equals: 'eq',
                equal: 'eq',
                notEquals: 'neq',
                notEqual: 'neq'
            };
            if (typeof next.operator === 'string' && operatorMap[next.operator]) {
                next.operator = operatorMap[next.operator];
            }

            return next;
        });
    }

    return payload;
};

const getDefaultWorkspaceId = async (userObjectId) => {
    const existing = await Workspace.findOne({
        $or: [{ owner: userObjectId }, { userId: userObjectId }]
    }).select('_id');

    return existing ? existing._id : null;
};

// Get all alert policies
router.get('/alert-policies', ensureAuthenticated, async (req, res) => {
    try {
        const { workspaceId, enabled, tags } = req.query;
        const query = { createdBy: req.user.id };

        if (workspaceId) query.workspaceId = workspaceId;
        if (enabled !== undefined) query.enabled = enabled === 'true';
        if (tags) query.tags = { $in: tags.split(',') };

        const policies = await AlertPolicy.find(query)
            .populate('escalationPolicyId')
            .populate('monitorIds')
            .sort({ createdAt: -1 });

        res.json(policies);
    } catch (error) {
        console.error('Error fetching alert policies:', error);
        res.status(500).json({ message: 'Error fetching alert policies', error: error.message });
    }
});

// Get single alert policy
router.get('/alert-policies/:id', ensureAuthenticated, async (req, res) => {
    try {
        const policy = await AlertPolicy.findById(req.params.id)
            .populate('escalationPolicyId')
            .populate('monitorIds')
            .populate('createdBy', 'username email');

        if (!policy) {
            return res.status(404).json({ message: 'Alert policy not found' });
        }

        res.json(policy);
    } catch (error) {
        console.error('Error fetching alert policy:', error);
        res.status(500).json({ message: 'Error fetching alert policy', error: error.message });
    }
});

// Create alert policy
router.post('/alert-policies', ensureAuthenticated, async (req, res) => {
    try {
        const normalized = normalizeAlertPolicyPayload(req.body);

        // If workspaceId isn't provided, default to the user's first workspace.
        if (!normalized.workspaceId) {
            normalized.workspaceId = await getDefaultWorkspaceId(req.user._id);
            if (!normalized.workspaceId) {
                return res.status(400).json({ message: 'Create a workspace first' });
            }
        }

        const policyData = {
            ...normalized,
            createdBy: req.user.id
        };

        const policy = new AlertPolicy(policyData);
        await policy.save();

        res.status(201).json(policy);
    } catch (error) {
        console.error('Error creating alert policy:', error);
        res.status(500).json({ message: 'Error creating alert policy', error: error.message });
    }
});

// Update alert policy
router.put('/alert-policies/:id', ensureAuthenticated, async (req, res) => {
    try {
        const policy = await AlertPolicy.findById(req.params.id);

        if (!policy) {
            return res.status(404).json({ message: 'Alert policy not found' });
        }

        const normalized = normalizeAlertPolicyPayload(req.body);
        Object.assign(policy, normalized);
        policy.updatedBy = req.user.id;
        await policy.save();

        res.json(policy);
    } catch (error) {
        console.error('Error updating alert policy:', error);
        res.status(500).json({ message: 'Error updating alert policy', error: error.message });
    }
});

// Delete alert policy
router.delete('/alert-policies/:id', ensureAuthenticated, async (req, res) => {
    try {
        const policy = await AlertPolicy.findByIdAndDelete(req.params.id);

        if (!policy) {
            return res.status(404).json({ message: 'Alert policy not found' });
        }

        res.json({ message: 'Alert policy deleted successfully' });
    } catch (error) {
        console.error('Error deleting alert policy:', error);
        res.status(500).json({ message: 'Error deleting alert policy', error: error.message });
    }
});

// =====================
// ON-CALL SCHEDULE ROUTES
// =====================

// Get all on-call schedules
router.get('/on-call-schedules', ensureAuthenticated, async (req, res) => {
    try {
        const { workspaceId, teamId, enabled } = req.query;
        const query = {};

        if (workspaceId) query.workspaceId = workspaceId;
        if (teamId) query.teamId = teamId;
        if (enabled !== undefined) query.enabled = enabled === 'true';

        const schedules = await OnCallSchedule.find(query)
            .populate('teamId')
            .populate('rotation.participants.userId', 'username email')
            .populate('overrides.userId', 'username email')
            .sort({ createdAt: -1 });

        res.json(schedules);
    } catch (error) {
        console.error('Error fetching on-call schedules:', error);
        res.status(500).json({ message: 'Error fetching on-call schedules', error: error.message });
    }
});

// Get single on-call schedule
router.get('/on-call-schedules/:id', ensureAuthenticated, async (req, res) => {
    try {
        const schedule = await OnCallSchedule.findById(req.params.id)
            .populate('teamId')
            .populate('rotation.participants.userId', 'username email')
            .populate('overrides.userId', 'username email');

        if (!schedule) {
            return res.status(404).json({ message: 'On-call schedule not found' });
        }

        res.json(schedule);
    } catch (error) {
        console.error('Error fetching on-call schedule:', error);
        res.status(500).json({ message: 'Error fetching on-call schedule', error: error.message });
    }
});

// Create on-call schedule
router.post('/on-call-schedules', ensureAuthenticated, async (req, res) => {
    try {
        const scheduleData = {
            ...req.body,
            createdBy: req.user.id
        };

        const schedule = new OnCallSchedule(scheduleData);
        await schedule.save();

        res.status(201).json(schedule);
    } catch (error) {
        console.error('Error creating on-call schedule:', error);
        res.status(500).json({ message: 'Error creating on-call schedule', error: error.message });
    }
});

// Update on-call schedule
router.put('/on-call-schedules/:id', ensureAuthenticated, async (req, res) => {
    try {
        const schedule = await OnCallSchedule.findById(req.params.id);

        if (!schedule) {
            return res.status(404).json({ message: 'On-call schedule not found' });
        }

        Object.assign(schedule, req.body);
        schedule.updatedBy = req.user.id;
        await schedule.save();

        res.json(schedule);
    } catch (error) {
        console.error('Error updating on-call schedule:', error);
        res.status(500).json({ message: 'Error updating on-call schedule', error: error.message });
    }
});

// Delete on-call schedule
router.delete('/on-call-schedules/:id', ensureAuthenticated, async (req, res) => {
    try {
        const schedule = await OnCallSchedule.findByIdAndDelete(req.params.id);

        if (!schedule) {
            return res.status(404).json({ message: 'On-call schedule not found' });
        }

        res.json({ message: 'On-call schedule deleted successfully' });
    } catch (error) {
        console.error('Error deleting on-call schedule:', error);
        res.status(500).json({ message: 'Error deleting on-call schedule', error: error.message });
    }
});

// Get current on-call user
router.get('/on-call-schedules/:id/current', ensureAuthenticated, async (req, res) => {
    try {
        const schedule = await OnCallSchedule.findById(req.params.id);

        if (!schedule) {
            return res.status(404).json({ message: 'On-call schedule not found' });
        }

        const userId = schedule.getCurrentOnCallUser();

        if (!userId) {
            return res.json({ onCall: null, message: 'No one currently on-call' });
        }

        const User = require('../models/User');
        const user = await User.findById(userId).select('username email');

        res.json({ onCall: user, schedule: schedule.name });
    } catch (error) {
        console.error('Error getting current on-call user:', error);
        res.status(500).json({ message: 'Error getting current on-call user', error: error.message });
    }
});

// Add override to schedule
router.post('/on-call-schedules/:id/overrides', ensureAuthenticated, async (req, res) => {
    try {
        const schedule = await OnCallSchedule.findById(req.params.id);

        if (!schedule) {
            return res.status(404).json({ message: 'On-call schedule not found' });
        }

        const overrideData = {
            ...req.body,
            createdBy: req.user.id
        };

        await schedule.addOverride(overrideData);

        res.status(201).json(schedule);
    } catch (error) {
        console.error('Error adding override:', error);
        res.status(400).json({ message: error.message });
    }
});

// =====================
// ESCALATION POLICY ROUTES
// =====================

// Get all escalation policies
router.get('/escalation-policies', ensureAuthenticated, async (req, res) => {
    try {
        const { workspaceId, teamId, enabled } = req.query;
        const query = {};

        if (workspaceId) query.workspaceId = workspaceId;
        if (teamId) query.teamId = teamId;
        if (enabled !== undefined) query.enabled = enabled === 'true';

        const policies = await EscalationPolicy.find(query)
            .populate('teamId')
            .populate('fallbackPolicy.policyId')
            .sort({ createdAt: -1 });

        res.json(policies);
    } catch (error) {
        console.error('Error fetching escalation policies:', error);
        res.status(500).json({ message: 'Error fetching escalation policies', error: error.message });
    }
});

// Get single escalation policy
router.get('/escalation-policies/:id', ensureAuthenticated, async (req, res) => {
    try {
        const policy = await EscalationPolicy.findById(req.params.id)
            .populate('teamId')
            .populate('fallbackPolicy.policyId');

        if (!policy) {
            return res.status(404).json({ message: 'Escalation policy not found' });
        }

        res.json(policy);
    } catch (error) {
        console.error('Error fetching escalation policy:', error);
        res.status(500).json({ message: 'Error fetching escalation policy', error: error.message });
    }
});

// Create escalation policy
router.post('/escalation-policies', ensureAuthenticated, async (req, res) => {
    try {
        const policyData = {
            ...req.body,
            createdBy: req.user.id
        };

        const policy = new EscalationPolicy(policyData);
        await policy.save();

        res.status(201).json(policy);
    } catch (error) {
        console.error('Error creating escalation policy:', error);
        res.status(500).json({ message: 'Error creating escalation policy', error: error.message });
    }
});

// Update escalation policy
router.put('/escalation-policies/:id', ensureAuthenticated, async (req, res) => {
    try {
        const policy = await EscalationPolicy.findById(req.params.id);

        if (!policy) {
            return res.status(404).json({ message: 'Escalation policy not found' });
        }

        Object.assign(policy, req.body);
        policy.updatedBy = req.user.id;
        await policy.save();

        res.json(policy);
    } catch (error) {
        console.error('Error updating escalation policy:', error);
        res.status(500).json({ message: 'Error updating escalation policy', error: error.message });
    }
});

// Delete escalation policy
router.delete('/escalation-policies/:id', ensureAuthenticated, async (req, res) => {
    try {
        const policy = await EscalationPolicy.findByIdAndDelete(req.params.id);

        if (!policy) {
            return res.status(404).json({ message: 'Escalation policy not found' });
        }

        res.json({ message: 'Escalation policy deleted successfully' });
    } catch (error) {
        console.error('Error deleting escalation policy:', error);
        res.status(500).json({ message: 'Error deleting escalation policy', error: error.message });
    }
});

// Get escalation timeline for policy
router.get('/escalation-policies/:id/timeline', ensureAuthenticated, async (req, res) => {
    try {
        const policy = await EscalationPolicy.findById(req.params.id);

        if (!policy) {
            return res.status(404).json({ message: 'Escalation policy not found' });
        }

        const timeline = policy.getEscalationTimeline();
        res.json(timeline);
    } catch (error) {
        console.error('Error getting escalation timeline:', error);
        res.status(500).json({ message: 'Error getting escalation timeline', error: error.message });
    }
});

// =====================
// ALERT ANALYTICS ROUTES
// =====================

// Get alert statistics
router.get('/alerts/statistics', ensureAuthenticated, async (req, res) => {
    try {
        const { workspaceId, startDate, endDate } = req.query;
        const filters = {};

        if (workspaceId) {
            const monitors = await Monitor.find({ workspaceId }).select('_id');
            filters.monitorId = { $in: monitors.map(m => m._id) };
        }

        if (startDate) {
            filters.triggeredAt = { $gte: new Date(startDate) };
        }

        if (endDate) {
            filters.triggeredAt = { ...filters.triggeredAt, $lte: new Date(endDate) };
        }

        const statistics = await AlertingService.getAlertStatistics(filters);
        res.json(statistics);
    } catch (error) {
        console.error('Error fetching alert statistics:', error);
        res.status(500).json({ message: 'Error fetching alert statistics', error: error.message });
    }
});

// Get alert frequency (for heatmap)
router.get('/alerts/frequency', ensureAuthenticated, async (req, res) => {
    try {
        const { startDate, endDate, groupBy = 'hour' } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ message: 'startDate and endDate are required' });
        }

        const frequency = await AlertingService.getAlertFrequency(
            new Date(startDate),
            new Date(endDate),
            groupBy
        );

        res.json(frequency);
    } catch (error) {
        console.error('Error fetching alert frequency:', error);
        res.status(500).json({ message: 'Error fetching alert frequency', error: error.message });
    }
});

// Get grouped alerts
router.get('/alerts/grouped', ensureAuthenticated, async (req, res) => {
    try {
        const { workspaceId } = req.query;
        const filters = { status: { $in: ['triggered', 'acknowledged'] } };

        if (workspaceId) {
            const monitors = await Monitor.find({ workspaceId }).select('_id');
            filters.monitorId = { $in: monitors.map(m => m._id) };
        }

        const groupedAlerts = await Alert.getGroupedAlerts(filters);
        res.json(groupedAlerts);
    } catch (error) {
        console.error('Error fetching grouped alerts:', error);
        res.status(500).json({ message: 'Error fetching grouped alerts', error: error.message });
    }
});

module.exports = router;
