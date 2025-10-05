// routes/statusPages.js
const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const StatusPageConfig = require('../models/StatusPageConfig');
const StatusPageSubscription = require('../models/StatusPageSubscription');
const Monitor = require('../models/Monitor');
const Incident = require('../models/Incident');
const EmailService = require('../services/EmailService');
const crypto = require('crypto');

// Get status page configuration
router.get('/config/:workspaceId', ensureAuthenticated, async (req, res) => {
    try {
        const config = await StatusPageConfig.findOne({
            workspaceId: req.params.workspaceId,
            userId: req.user.id
        });

        if (!config) {
            // Return default configuration
            return res.json({
                branding: {
                    companyName: 'Your Company',
                    primaryColor: '#014C75',
                    secondaryColor: '#6c757d',
                    backgroundColor: '#ffffff',
                    textColor: '#333333'
                },
                content: {
                    headline: 'System Status',
                    description: 'Current status and uptime monitoring for our services',
                    enableHistory: true,
                    showMetrics: true,
                    showIncidents: true,
                    autoRefresh: true,
                    refreshInterval: 30
                },
                notifications: {
                    enableSubscriptions: true,
                    allowEmailSubscriptions: true,
                    allowSmsSubscriptions: false
                }
            });
        }

        res.json(config);
    } catch (error) {
        console.error('Error fetching status page config:', error);
        res.status(500).json({ message: 'Error fetching status page configuration', error: error.message });
    }
});

// Update status page configuration
router.put('/config/:workspaceId', ensureAuthenticated, async (req, res) => {
    try {
        const config = await StatusPageConfig.findOneAndUpdate(
            {
                workspaceId: req.params.workspaceId,
                userId: req.user.id
            },
            {
                ...req.body,
                workspaceId: req.params.workspaceId,
                userId: req.user.id
            },
            {
                new: true,
                upsert: true,
                runValidators: true
            }
        );

        res.json(config);
    } catch (error) {
        console.error('Error updating status page config:', error);
        res.status(400).json({ message: 'Error updating status page configuration', error: error.message });
    }
});

// Get public status page data (enhanced)
router.get('/public/:workspaceId', async (req, res) => {
    try {
        const { workspaceId } = req.params;

        // Get status page configuration
        const config = await StatusPageConfig.findOne({ workspaceId, isActive: true });

        // Get public monitors
        const publicMonitors = await Monitor.find({
            workspaceId,
            isPublic: true,
            isActive: true
        })
            .select('name url currentStatus lastChecked averageResponseTime totalChecks totalFailures description tags')
            .lean();

        // Calculate uptime and format for public display
        const monitors = publicMonitors.map(monitor => ({
            id: monitor._id,
            name: monitor.name,
            description: monitor.description || monitor.url,
            url: monitor.url,
            status: mapToPublicStatus(monitor.currentStatus),
            lastChecked: monitor.lastChecked,
            averageResponseTime: monitor.averageResponseTime || 0,
            uptimePercentage: monitor.totalChecks === 0 ? '100.00' :
                ((monitor.totalChecks - monitor.totalFailures) / monitor.totalChecks * 100).toFixed(2),
            tags: monitor.tags
        }));

        // Get recent incidents
        const recentIncidents = await Incident.find({
            workspaceId,
            isPublic: true,
            createdAt: { $gte: new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)) } // Last 30 days
        })
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('affectedServices.monitorId', 'name')
            .lean();

        // Format incidents
        const incidents = recentIncidents.map(incident => ({
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

        // Calculate overall status
        const overallStatus = calculateOverallStatus(monitors);

        res.json({
            config: config ? {
                branding: config.branding,
                content: config.content
            } : null,
            overallStatus,
            monitors,
            incidents,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error fetching public status page:', error);
        res.status(500).json({ message: 'Error fetching status page data', error: error.message });
    }
});

// Subscribe to status page updates
router.post('/subscribe/:workspaceId', async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const { email, subscriptionTypes = ['incident_updates'] } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Email address is required' });
        }

        // Check if already subscribed
        const existing = await StatusPageSubscription.findOne({
            workspaceId,
            email
        });

        if (existing) {
            return res.status(400).json({ message: 'Email already subscribed' });
        }

        // Generate verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const unsubscribeToken = crypto.randomBytes(32).toString('hex');

        // Create subscription
        const subscription = await StatusPageSubscription.create({
            workspaceId,
            email,
            subscriptionTypes,
            verificationToken,
            unsubscribeToken
        });

        // Get workspace configuration for branding
        const config = await StatusPageConfig.findOne({ workspaceId });
        const companyName = config?.branding?.companyName || 'Status Page';

        // Send verification email
        const emailService = new EmailService();
        await emailService.sendStatusPageSubscriptionConfirmation({
            email,
            verificationToken,
            companyName
        });

        res.json({
            message: 'Subscription created. Please check your email to confirm.',
            subscriptionId: subscription._id
        });

    } catch (error) {
        console.error('Error creating subscription:', error);
        res.status(500).json({ message: 'Error creating subscription', error: error.message });
    }
});

// Verify subscription
router.get('/verify', async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({ message: 'Verification token is required' });
        }

        const subscription = await StatusPageSubscription.findOne({
            verificationToken: token
        });

        if (!subscription) {
            return res.status(404).json({ message: 'Invalid verification token' });
        }

        if (subscription.isVerified) {
            return res.json({ message: 'Subscription already verified' });
        }

        // Verify subscription
        await StatusPageSubscription.findByIdAndUpdate(subscription._id, {
            isVerified: true,
            verifiedAt: new Date(),
            verificationToken: undefined // Remove token after verification
        });

        res.json({ message: 'Subscription verified successfully' });

    } catch (error) {
        console.error('Error verifying subscription:', error);
        res.status(500).json({ message: 'Error verifying subscription', error: error.message });
    }
});

// Unsubscribe
router.get('/unsubscribe', async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({ message: 'Unsubscribe token is required' });
        }

        const subscription = await StatusPageSubscription.findOneAndUpdate(
            { unsubscribeToken: token },
            { isActive: false },
            { new: true }
        );

        if (!subscription) {
            return res.status(404).json({ message: 'Invalid unsubscribe token' });
        }

        res.json({ message: 'Successfully unsubscribed from status updates' });

    } catch (error) {
        console.error('Error unsubscribing:', error);
        res.status(500).json({ message: 'Error processing unsubscribe request', error: error.message });
    }
});

// Get subscription status (for admin)
router.get('/subscriptions/:workspaceId', ensureAuthenticated, async (req, res) => {
    try {
        const subscriptions = await StatusPageSubscription.find({
            workspaceId: req.params.workspaceId
        })
            .select('email subscriptionTypes isVerified isActive createdAt')
            .sort({ createdAt: -1 });

        const stats = {
            total: subscriptions.length,
            verified: subscriptions.filter(s => s.isVerified).length,
            active: subscriptions.filter(s => s.isActive).length
        };

        res.json({
            subscriptions,
            stats
        });

    } catch (error) {
        console.error('Error fetching subscriptions:', error);
        res.status(500).json({ message: 'Error fetching subscriptions', error: error.message });
    }
});

// Helper functions
function mapToPublicStatus(internalStatus) {
    switch (internalStatus) {
        case 'up':
            return 'operational';
        case 'down':
            return 'major_outage';
        case 'degraded':
            return 'degraded_performance';
        default:
            return 'unknown';
    }
}

function calculateOverallStatus(monitors) {
    if (monitors.length === 0) return 'operational';

    const downCount = monitors.filter(m => m.status === 'major_outage').length;
    const degradedCount = monitors.filter(m => m.status === 'degraded_performance').length;

    if (downCount > 0) {
        return downCount >= monitors.length * 0.5 ? 'major_outage' : 'partial_outage';
    }

    if (degradedCount > 0) {
        return 'degraded_performance';
    }

    return 'operational';
}

module.exports = router;
