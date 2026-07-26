// models/Integration.js
const mongoose = require('mongoose');

const integrationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['email', 'pagerduty', 'slack', 'teams', 'discord', 'jira', 'webhook', 'telegram', 'googlechat'],
        required: true
    },
    workspaceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workspace',
        // Integrations are owned by a user. A workspace is optional because an
        // account-level alert channel can be used by any of that user's monitors.
        default: null
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    configuration: {
        // Email
        smtpHost: String,
        smtpPort: Number,
        smtpUser: String,
        smtpPass: String,
        fromEmail: String,
        useTls: Boolean,

        // PagerDuty
        integrationKey: String,
        routingKey: String,

        // Slack/Teams/Discord/Google Chat
        webhookUrl: String,
        channel: String,

        // Telegram
        botToken: String,
        chatId: String,

        // Jira
        serverUrl: String,
        username: String,
        apiToken: String,
        projectKey: String,
        issueType: String,

        // Custom Webhook
        headers: [{
            key: String,
            value: String
        }],
        payloadTemplate: String,

        // Common settings
        enabledEvents: [{
            type: String,
            enum: [
                'monitor_down',
                'monitor_up',
                'monitor_degraded',
                'incident_created',
                'incident_updated',
                'incident_resolved',
                'maintenance_started',
                'maintenance_completed'
            ]
        }]
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastUsed: Date,
    errorCount: {
        type: Number,
        default: 0
    },
    lastError: {
        message: String,
        timestamp: Date
    }
}, {
    timestamps: true
});

integrationSchema.index({ workspaceId: 1, type: 1 });
integrationSchema.index({ isActive: 1 });

// Validation methods
integrationSchema.methods.validateConfiguration = function () {
    const errors = [];

    switch (this.type) {
        case 'email':
            if (!this.configuration.smtpHost) {
                errors.push('SMTP host is required');
            }
            // Set default SMTP port if not provided
            if (!this.configuration.smtpPort) {
                this.configuration.smtpPort = 587;
            }
            if (!this.configuration.smtpUser) {
                errors.push('SMTP username is required');
            }
            if (!this.configuration.smtpPass) {
                errors.push('SMTP password is required');
            }
            if (!this.configuration.fromEmail) {
                errors.push('From email is required');
            } else if (!this.isValidEmail(this.configuration.fromEmail)) {
                errors.push('From email is invalid');
            }
            break;

        case 'pagerduty':
            if (!this.configuration.routingKey) {
                errors.push('PagerDuty routing key is required');
            }
            break;

        case 'telegram':
            if (!this.configuration.botToken || !this.configuration.chatId) {
                errors.push('Telegram requires botToken and chatId');
            }
            break;

        case 'slack':
        case 'teams':
        case 'discord':
        case 'googlechat':
            if (!this.configuration.webhookUrl) {
                errors.push(`${this.type} webhook URL is required`);
            } else if (!this.isValidUrl(this.configuration.webhookUrl)) {
                errors.push(`${this.type} webhook URL is invalid`);
            }
            break;

        case 'jira':
            if (!this.configuration.serverUrl || !this.configuration.username ||
                !this.configuration.apiToken || !this.configuration.projectKey) {
                errors.push('Jira requires serverUrl, username, apiToken, and projectKey');
            }
            break;

        case 'webhook':
            if (!this.configuration.webhookUrl) {
                errors.push('Webhook URL is required');
            } else if (!this.isValidUrl(this.configuration.webhookUrl)) {
                errors.push('Webhook URL is invalid');
            }
            break;
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    };
};

integrationSchema.methods.isValidUrl = function (url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

integrationSchema.methods.isValidEmail = function (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// Test connection method
integrationSchema.methods.testConnection = async function () {
    const IntegrationService = require('../services/IntegrationService');
    const service = new IntegrationService();

    try {
        // Create test alert data
        const testData = {
            monitor: {
                _id: 'test-monitor',
                name: 'Test Monitor',
                url: 'https://example.com'
            },
            healthCheck: {
                status: 'success',
                responseTime: 100,
                checkedAt: new Date()
            },
            alertType: 'test'
        };

        if (service.isTestMode()) {
            // In test mode, just validate configuration
            return this.validateConfiguration();
        } else {
            // In production, attempt actual connection
            await service.sendAlert(this, testData);
            return { isValid: true, message: 'Connection test successful' };
        }
    } catch (error) {
        return {
            isValid: false,
            errors: [`Connection test failed: ${error.message}`]
        };
    }
};

// Pre-save validation
integrationSchema.pre('save', function (next) {
    const validation = this.validateConfiguration();
    if (!validation.isValid) {
        const error = new Error(`Integration validation failed: ${validation.errors.join(', ')}`);
        return next(error);
    }
    next();
});

module.exports = mongoose.model('Integration', integrationSchema);
