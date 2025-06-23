// models/Report.js
const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['uptime', 'performance', 'sla', 'custom'],
        required: true
    },
    schedule: {
        frequency: {
            type: String,
            enum: ['daily', 'weekly', 'monthly'],
            required: true
        },
        dayOfWeek: Number, // 0-6 for weekly reports
        dayOfMonth: Number, // 1-31 for monthly reports
        time: String, // HH:MM format
        timezone: {
            type: String,
            default: 'UTC'
        }
    },
    filters: {
        monitorIds: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Monitor'
        }],
        tags: [String],
        dateRange: {
            type: String,
            enum: ['7d', '30d', '90d'],
            default: '30d'
        }
    },
    recipients: [{
        email: {
            type: String,
            required: true
        },
        format: {
            type: String,
            enum: ['pdf', 'html', 'csv'],
            default: 'pdf'
        }
    }],
    template: {
        includeExecutiveSummary: {
            type: Boolean,
            default: true
        },
        includeUptimeCharts: {
            type: Boolean,
            default: true
        },
        includePerformanceMetrics: {
            type: Boolean,
            default: true
        },
        includeIncidentSummary: {
            type: Boolean,
            default: true
        },
        includeSLACompliance: {
            type: Boolean,
            default: false
        },
        customSections: [{
            title: String,
            content: String,
            order: Number
        }]
    },
    lastGenerated: Date,
    nextScheduled: Date,
    isActive: {
        type: Boolean,
        default: true
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
    }
}, {
    timestamps: true
});

reportSchema.index({ workspaceId: 1 });
reportSchema.index({ nextScheduled: 1, isActive: 1 });

module.exports = mongoose.model('Report', reportSchema);
