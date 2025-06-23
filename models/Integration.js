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
        enum: ['pagerduty', 'slack', 'teams', 'discord', 'jira', 'webhook'],
        required: true
    },
    workspaceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workspace',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    configuration: {
        // PagerDuty
        integrationKey: String,
        routingKey: String,

        // Slack/Teams/Discord
        webhookUrl: String,
        channel: String,

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

module.exports = mongoose.model('Integration', integrationSchema);
