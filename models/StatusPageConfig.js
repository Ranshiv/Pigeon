// models/StatusPageConfig.js
const mongoose = require('mongoose');

const statusPageConfigSchema = new mongoose.Schema({
    workspaceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workspace',
        required: true,
        unique: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    branding: {
        companyName: {
            type: String,
            default: 'Your Company'
        },
        logoUrl: String,
        faviconUrl: String,
        primaryColor: {
            type: String,
            default: '#014C75'
        },
        secondaryColor: {
            type: String,
            default: '#6c757d'
        },
        backgroundColor: {
            type: String,
            default: '#ffffff'
        },
        textColor: {
            type: String,
            default: '#333333'
        },
        customCss: String,
        customDomain: String
    },
    content: {
        headline: {
            type: String,
            default: 'System Status'
        },
        description: {
            type: String,
            default: 'Current status and uptime monitoring for our services'
        },
        footerText: String,
        enableHistory: {
            type: Boolean,
            default: true
        },
        showMetrics: {
            type: Boolean,
            default: true
        },
        showIncidents: {
            type: Boolean,
            default: true
        },
        autoRefresh: {
            type: Boolean,
            default: true
        },
        refreshInterval: {
            type: Number,
            default: 30 // seconds
        }
    },
    notifications: {
        enableSubscriptions: {
            type: Boolean,
            default: true
        },
        allowEmailSubscriptions: {
            type: Boolean,
            default: true
        },
        allowSmsSubscriptions: {
            type: Boolean,
            default: false
        },
        webhookNotifications: [{
            url: String,
            events: [String] // ['incident_created', 'incident_resolved', 'monitor_down', 'monitor_up']
        }]
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

statusPageConfigSchema.index({ workspaceId: 1 });
statusPageConfigSchema.index({ customDomain: 1 });

module.exports = mongoose.model('StatusPageConfig', statusPageConfigSchema);
