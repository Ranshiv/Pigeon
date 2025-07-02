// routes/integrations.js
const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const Integration = require('../models/Integration');
const IntegrationService = require('../services/IntegrationService');

// Get all integrations for workspace
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const { workspaceId } = req.query;
        const query = { userId: req.user.id };

        if (workspaceId) {
            query.workspaceId = workspaceId;
        }

        const integrations = await Integration.find(query)
            .select('-configuration.apiToken -configuration.webhookUrl') // Hide sensitive data
            .sort({ createdAt: -1 });

        res.json(integrations);
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
        }).select('-configuration.apiToken'); // Hide API token but show other config

        if (!integration) {
            return res.status(404).json({ message: 'Integration not found' });
        }

        res.json(integration);
    } catch (error) {
        console.error('Error fetching integration:', error);
        res.status(500).json({ message: 'Error fetching integration', error: error.message });
    }
});

// Create new integration
router.post('/', ensureAuthenticated, async (req, res) => {
    try {
        // Get or create default workspace for user
        const { getDb } = require('../config/db');
        const db = getDb();

        let workspace = await db.collection('workspaces').findOne({
            owner: req.user.id,
            isPersonal: true
        });

        // If no personal workspace exists, create one
        if (!workspace) {
            const newWorkspace = {
                name: 'Personal Workspace',
                description: 'Your personal workspace',
                owner: req.user.id,
                isPersonal: true,
                collaborators: [],
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = await db.collection('workspaces').insertOne(newWorkspace);
            workspace = { ...newWorkspace, _id: result.insertedId };
        }

        const integrationData = {
            ...req.body,
            userId: req.user.id,
            workspaceId: workspace._id.toString()
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

        // Remove sensitive data from response
        const response = integration.toObject();
        if (response.configuration.apiToken) {
            response.configuration.apiToken = '***';
        }

        res.status(201).json(response);
    } catch (error) {
        console.error('Error creating integration:', error);
        res.status(400).json({ message: 'Error creating integration', error: error.message });
    }
});

// Update integration
router.put('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const integration = await Integration.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            req.body,
            { new: true, runValidators: true }
        );

        if (!integration) {
            return res.status(404).json({ message: 'Integration not found' });
        }

        // Remove sensitive data from response
        const response = integration.toObject();
        if (response.configuration.apiToken) {
            response.configuration.apiToken = '***';
        }

        res.json(response);
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
