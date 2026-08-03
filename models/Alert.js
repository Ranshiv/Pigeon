// models/Alert.js
const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
    monitorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Monitor',
        required: true,
        index: true
    },
    policyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AlertPolicy',
        index: true
    },
    groupKey: {
        type: String,
        index: true,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    severity: {
        type: String,
        enum: ['critical', 'high', 'medium', 'low', 'info'],
        default: 'medium',
        required: true
    },
    status: {
        type: String,
        enum: ['triggered', 'acknowledged', 'resolved', 'snoozed', 'muted'],
        default: 'triggered',
        required: true,
        index: true
    },
    triggeredAt: {
        type: Date,
        default: Date.now,
        required: true,
        index: true
    },
    acknowledgedAt: {
        type: Date
    },
    acknowledgedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    resolvedAt: {
        type: Date
    },
    resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    snoozedUntil: {
        type: Date
    },
    lastNotifiedAt: {
        type: Date
    },
    notificationChannels: [{
        type: {
            type: String,
            enum: ['email', 'slack', 'webhook', 'sms', 'pagerduty'],
            required: true
        },
        target: String,
        sentAt: Date,
        success: Boolean,
        error: String
    }],
    checkResult: {
        statusCode: Number,
        responseTime: Number,
        errorMessage: String,
        location: String,
        timestamp: Date
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    escalationLevel: {
        type: Number,
        default: 0
    },
    escalatedAt: {
        type: Date
    },
    incidentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Incident'
    },
    isPredictive: {
        type: Boolean,
        default: false
    },
    predictionData: {
        projectedValue: Number,
        currentTrend: Number,
        confidence: Number,
        forecastedAt: Date
    },
    count: {
        type: Number,
        default: 1
    },
    firstTriggeredAt: {
        type: Date,
        default: Date.now
    },
    lastUpdatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Compound indexes for efficient querying
alertSchema.index({ monitorId: 1, status: 1, triggeredAt: -1 });
alertSchema.index({ groupKey: 1, status: 1 });
alertSchema.index({ policyId: 1, triggeredAt: -1 });
alertSchema.index({ severity: 1, status: 1, triggeredAt: -1 });
alertSchema.index({ snoozedUntil: 1 }, { sparse: true });

// Virtual for duration
alertSchema.virtual('duration').get(function() {
    if (this.resolvedAt && this.triggeredAt) {
        return this.resolvedAt - this.triggeredAt;
    }
    return Date.now() - this.triggeredAt;
});

// Method to check if alert is active
alertSchema.methods.isActive = function() {
    return ['triggered', 'acknowledged'].includes(this.status);
};

// Method to check if alert is snoozed
alertSchema.methods.isSnoozed = function() {
    return this.status === 'snoozed' && this.snoozedUntil && this.snoozedUntil > new Date();
};

// Static method to get grouped alerts
alertSchema.statics.getGroupedAlerts = async function(filters = {}) {
    const pipeline = [
        { $match: { status: { $in: ['triggered', 'acknowledged'] }, ...filters } },
        {
            $group: {
                _id: '$groupKey',
                count: { $sum: 1 },
                severity: { $max: '$severity' },
                firstTriggered: { $min: '$triggeredAt' },
                lastTriggered: { $max: '$triggeredAt' },
                alerts: { $push: '$$ROOT' }
            }
        },
        { $sort: { lastTriggered: -1 } }
    ];
    
    return this.aggregate(pipeline);
};

// Pre-save middleware to update lastUpdatedAt
alertSchema.pre('save', function(next) {
    this.lastUpdatedAt = new Date();
    next();
});

module.exports = mongoose.model('Alert', alertSchema);
