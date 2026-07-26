// routes/integrations.js
const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const Integration = require('../models/Integration');
const IntegrationService = require('../services/IntegrationService');

// UI sends `enabled`; the model stores `isActive`. Keep both sides in sync.
const ALL_EVENTS = [
    'monitor_down', 'monitor_up', 'monitor_degraded',
    'incident_created', 'incident_updated', 'incident_resolved',
    'maintenance_started', 'maintenance_completed'
];

const withEnabled = (doc) => {
    const o = doc.toObject ? doc.toObject() : { ...doc };
    o.enabled = o.isActive;
    if (o.configuration?.apiToken) o.configuration.apiToken = '***';
    if (o.configuration?.smtpPass) o.configuration.smtpPass = '***';
    if (o.configuration?.botToken) o.configuration.botToken = '***';
    return o;
};

// Get integrations for the account. A workspace filter includes reusable,
// account-level integrations as well as integrations scoped to that workspace.
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const { workspaceId } = req.query;
        const query = { userId: req.user.id };

        if (workspaceId) {
            query.$or = [{ workspaceId }, { workspaceId: null }];
        }

        const integrations = await Integration.find(query).sort({ createdAt: -1 });

        res.json(integrations.map(withEnabled));
    } catch (error) {
        console.error('Error fetching integrations:', error);
        res.status(500).json({ message: 'Error fetching integrations', error: error.message });
    }
});

// Get specific integration
router.get('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const integration = await Integration.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!integration) {
            return res.status(404).json({ message: 'Integration not found' });
        }

        res.json(withEnabled(integration));
    } catch (error) {
        console.error('Error fetching integration:', error);
        res.status(500).json({ message: 'Error fetching integration', error: error.message });
    }
});

// Create new integration
router.post('/', ensureAuthenticated, async (req, res) => {
    try {
        const { enabled, ...body } = req.body;
        const integrationData = {
            ...body,
            userId: req.user.id,
            // Integrations can be created before a workspace exists. The
            // delivery service applies account-level integrations to monitors
            // owned by the same user.
            workspaceId: null,
            isActive: enabled !== false
        };

        // Apply smart defaults for email integration
        if (integrationData.type === 'email') {
            const config = integrationData.configuration || {};

            // Auto-fill missing email fields with user's email
            if (!config.fromEmail && req.user.email) {
                config.fromEmail = req.user.email;
                console.log('Auto-filled fromEmail with user email:', req.user.email);
            }

            if (!config.smtpUser && req.user.email) {
                config.smtpUser = req.user.email;
                console.log('Auto-filled smtpUser with user email:', req.user.email);
            }

            // Auto-detect SMTP settings based on email provider
            if (!config.smtpHost && req.user.email) {
                if (req.user.email.includes('@gmail.com')) {
                    config.smtpHost = 'smtp.gmail.com';
                    console.log('Auto-detected Gmail, setting SMTP host to smtp.gmail.com');
                } else if (req.user.email.includes('@outlook.com') || req.user.email.includes('@hotmail.com') || req.user.email.includes('@live.com')) {
                    config.smtpHost = 'smtp-mail.outlook.com';
                    console.log('Auto-detected Outlook, setting SMTP host to smtp-mail.outlook.com');
                } else if (req.user.email.includes('@yahoo.com')) {
                    config.smtpHost = 'smtp.mail.yahoo.com';
                    console.log('Auto-detected Yahoo, setting SMTP host to smtp.mail.yahoo.com');
                } else {
                    // Default to Gmail for unknown providers
                    config.smtpHost = 'smtp.gmail.com';
                    console.log('Unknown provider, defaulting to Gmail SMTP settings');
                }
            }

            // Set default SMTP port
            if (!config.smtpPort) {
                config.smtpPort = 587;
            }

            // Set default TLS
            if (config.useTls === undefined) {
                config.useTls = true;
            }

            integrationData.configuration = config;
        }

        // Without enabledEvents the monitoring query never matches this integration.
        if (!integrationData.configuration) integrationData.configuration = {};
        if (!integrationData.configuration.enabledEvents?.length) {
            integrationData.configuration.enabledEvents = ALL_EVENTS;
        }

        // Log integration data for debugging
        console.log('Creating integration:', {
            type: integrationData.type,
            name: integrationData.name,
            userId: integrationData.userId,
            configKeys: integrationData.configuration ? Object.keys(integrationData.configuration) : 'none',
            autoFilled: integrationData.type === 'email' ? 'email fields auto-detected' : 'none'
        });

        const integration = new Integration(integrationData);
        await integration.save();

        res.status(201).json(withEnabled(integration));
    } catch (error) {
        console.error('Error creating integration:', error);
        res.status(400).json({ message: 'Error creating integration', error: error.message });
    }
});

// Update integration
router.put('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const integration = await Integration.findOne({ _id: req.params.id, userId: req.user.id });

        if (!integration) {
            return res.status(404).json({ message: 'Integration not found' });
        }

        const { enabled, configuration, name, type } = req.body;

        if (name !== undefined) integration.name = name;
        if (type !== undefined) integration.type = type;
        if (enabled !== undefined) integration.isActive = enabled;

        if (configuration) {
            // '***' is the masked placeholder we sent out; never persist it over a real secret.
            const clean = Object.fromEntries(
                Object.entries(configuration).filter(([, v]) => v !== '***')
            );
            integration.configuration = { ...integration.configuration.toObject?.() ?? integration.configuration, ...clean };
            if (!integration.configuration.enabledEvents?.length) {
                integration.configuration.enabledEvents = ALL_EVENTS;
            }
        }

        await integration.save(); // runs pre-save config validation

        res.json(withEnabled(integration));
    } catch (error) {
        console.error('Error updating integration:', error);
        res.status(400).json({ message: 'Error updating integration', error: error.message });
    }
});

// Delete integration
router.delete('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const integration = await Integration.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!integration) {
            return res.status(404).json({ message: 'Integration not found' });
        }

        res.json({ message: 'Integration deleted successfully' });
    } catch (error) {
        console.error('Error deleting integration:', error);
        res.status(500).json({ message: 'Error deleting integration', error: error.message });
    }
});

// Test integration
router.post('/:id/test', ensureAuthenticated, async (req, res) => {
    try {
        const integration = await Integration.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!integration) {
            return res.status(404).json({ message: 'Integration not found' });
        }

        // Create test alert data
        const testAlertData = {
            monitor: {
                _id: 'test',
                name: 'Test Monitor',
                url: 'https://example.com',
                userId: req.user.id // Add the real user ID for email testing
            },
            healthCheck: {
                status: 'failure',
                responseTime: 5000,
                errorMessage: 'This is a test alert',
                checkedAt: new Date()
            },
            alertType: 'failure'
        };

        // Send test alert
        const integrationService = new IntegrationService();
        await integrationService.sendAlert(integration, testAlertData);

        res.json({ message: 'Test alert sent successfully' });
    } catch (error) {
        console.error('Error testing integration:', error);
        res.status(500).json({ message: 'Error testing integration', error: error.message });
    }
});

// Get integration types and their configuration schemas
router.get('/types/list', ensureAuthenticated, async (req, res) => {
    try {
        const integrationTypes = [
            {
                type: 'email',
                name: 'Email',
                description: 'Send alerts via SMTP email',
                icon: '📧',
                configSchema: [
                    { key: 'smtpHost', label: 'SMTP Host', type: 'text', required: true, placeholder: 'smtp.gmail.com' },
                    { key: 'smtpPort', label: 'SMTP Port', type: 'number', required: true, default: 587 },
                    { key: 'smtpUser', label: 'SMTP Username', type: 'email', required: true },
                    { key: 'smtpPass', label: 'SMTP Password', type: 'password', required: true },
                    { key: 'fromEmail', label: 'From Email Address', type: 'email', required: true },
                    { key: 'useTls', label: 'Use TLS Encryption', type: 'checkbox', default: true }
                ],
                supportedEvents: ['monitor_down', 'monitor_up', 'monitor_degraded', 'incident_created', 'incident_resolved']
            },
            {
                type: 'pagerduty',
                name: 'PagerDuty',
                description: 'Send alerts to PagerDuty for incident management',
                icon: '📟',
                configSchema: [
                    {
                        key: 'routingKey',
                        label: 'Integration Key',
                        type: 'password',
                        required: true,
                        placeholder: 'Enter your PagerDuty integration key'
                    }
                ],
                supportedEvents: ['monitor_down', 'monitor_up', 'monitor_degraded']
            },
            {
                type: 'slack',
                name: 'Slack',
                description: 'Send notifications to Slack channels',
                icon: '💬',
                configSchema: [
                    {
                        key: 'webhookUrl',
                        label: 'Webhook URL',
                        type: 'url',
                        required: true,
                        placeholder: 'https://hooks.slack.com/services/...'
                    },
                    {
                        key: 'channel',
                        label: 'Channel',
                        type: 'text',
                        required: false,
                        placeholder: '#monitoring'
                    }
                ],
                supportedEvents: ['monitor_down', 'monitor_up', 'monitor_degraded', 'incident_created', 'incident_resolved']
            },
            {
                type: 'teams',
                name: 'Microsoft Teams',
                description: 'Send notifications to Microsoft Teams channels',
                icon: '👥',
                configSchema: [
                    {
                        key: 'webhookUrl',
                        label: 'Webhook URL',
                        type: 'url',
                        required: true,
                        placeholder: 'https://outlook.office.com/webhook/...'
                    }
                ],
                supportedEvents: ['monitor_down', 'monitor_up', 'monitor_degraded', 'incident_created', 'incident_resolved']
            },
            {
                type: 'discord',
                name: 'Discord',
                description: 'Send notifications to Discord channels',
                icon: '🎮',
                configSchema: [
                    {
                        key: 'webhookUrl',
                        label: 'Webhook URL',
                        type: 'url',
                        required: true,
                        placeholder: 'https://discord.com/api/webhooks/...'
                    }
                ],
                supportedEvents: ['monitor_down', 'monitor_up', 'monitor_degraded', 'incident_created', 'incident_resolved']
            },
            {
                type: 'jira',
                name: 'Jira',
                description: 'Create Jira tickets for incidents',
                icon: '🎫',
                configSchema: [
                    {
                        key: 'serverUrl',
                        label: 'Jira Server URL',
                        type: 'url',
                        required: true,
                        placeholder: 'https://yourcompany.atlassian.net'
                    },
                    {
                        key: 'username',
                        label: 'Username/Email',
                        type: 'email',
                        required: true,
                        placeholder: 'your-email@company.com'
                    },
                    {
                        key: 'apiToken',
                        label: 'API Token',
                        type: 'password',
                        required: true,
                        placeholder: 'Your Jira API token'
                    },
                    {
                        key: 'projectKey',
                        label: 'Project Key',
                        type: 'text',
                        required: true,
                        placeholder: 'PROJ'
                    },
                    {
                        key: 'issueType',
                        label: 'Issue Type',
                        type: 'text',
                        required: false,
                        placeholder: 'Bug',
                        default: 'Bug'
                    }
                ],
                supportedEvents: ['monitor_down', 'incident_created']
            },
            {
                type: 'telegram',
                name: 'Telegram',
                description: 'Send alerts to a Telegram chat',
                icon: '✈️',
                configSchema: [
                    { key: 'botToken', label: 'Bot Token', type: 'password', required: true, placeholder: 'From @BotFather' },
                    { key: 'chatId', label: 'Chat ID', type: 'text', required: true, placeholder: '-1001234567890' }
                ],
                supportedEvents: ['monitor_down', 'monitor_up', 'monitor_degraded', 'incident_created', 'incident_resolved']
            },
            {
                type: 'googlechat',
                name: 'Google Chat',
                description: 'Send alerts to a Google Chat space',
                icon: '💠',
                configSchema: [
                    { key: 'webhookUrl', label: 'Webhook URL', type: 'url', required: true, placeholder: 'https://chat.googleapis.com/v1/spaces/...' }
                ],
                supportedEvents: ['monitor_down', 'monitor_up', 'monitor_degraded', 'incident_created', 'incident_resolved']
            },
            {
                type: 'webhook',
                name: 'Custom Webhook',
                description: 'Send custom webhook notifications',
                icon: '🔗',
                configSchema: [
                    {
                        key: 'webhookUrl',
                        label: 'Webhook URL',
                        type: 'url',
                        required: true,
                        placeholder: 'https://api.yourservice.com/webhook'
                    },
                    {
                        key: 'payloadTemplate',
                        label: 'Payload Template (JSON)',
                        type: 'textarea',
                        required: false,
                        placeholder: '{"alert": "{{alertType}}", "monitor": "{{monitor.name}}"}'
                    }
                ],
                supportedEvents: ['monitor_down', 'monitor_up', 'monitor_degraded', 'incident_created', 'incident_resolved', 'maintenance_started', 'maintenance_completed']
            }
        ];

        res.json(integrationTypes);
    } catch (error) {
        console.error('Error fetching integration types:', error);
        res.status(500).json({ message: 'Error fetching integration types', error: error.message });
    }
});

module.exports = router;
