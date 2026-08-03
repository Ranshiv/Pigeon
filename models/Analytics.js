// models/Analytics.js
const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
    monitorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Monitor',
        required: true,
        index: true
    },
    workspaceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workspace',
        required: true,
        index: true
    },
    timestamp: {
        type: Date,
        required: true
    },
    aggregationPeriod: {
        type: String,
        enum: ['5m', '15m', '1h', '1d'],
        required: true
    },

    // Performance Metrics
    metrics: {
        totalRequests: {
            type: Number,
            default: 0
        },
        successfulRequests: {
            type: Number,
            default: 0
        },
        failedRequests: {
            type: Number,
            default: 0
        },
        avgResponseTime: {
            type: Number,
            default: 0
        },
        minResponseTime: {
            type: Number,
            default: 0
        },
        maxResponseTime: {
            type: Number,
            default: 0
        },
        p50ResponseTime: {
            type: Number,
            default: 0
        },
        p95ResponseTime: {
            type: Number,
            default: 0
        },
        p99ResponseTime: {
            type: Number,
            default: 0
        },
        uptimePercentage: {
            type: Number,
            default: 100
        },
        errorRate: {
            type: Number,
            default: 0
        },

        // Cost Metrics
        costEstimate: {
            type: Number,
            default: 0
        },
        costPerRequest: {
            type: Number,
            default: 0
        },
        bandwidthUsed: {
            type: Number,
            default: 0 // in bytes
        },

        // SLA Metrics
        slaCompliance: {
            type: Number,
            default: 100
        },
        slaBreaches: {
            type: Number,
            default: 0
        }
    },

    // Trend Analysis
    trends: {
        responseTimeTrend: {
            type: String,
            enum: ['improving', 'degrading', 'stable'],
            default: 'stable'
        },
        errorRateTrend: {
            type: String,
            enum: ['improving', 'degrading', 'stable'],
            default: 'stable'
        },
        throughputTrend: {
            type: String,
            enum: ['increasing', 'decreasing', 'stable'],
            default: 'stable'
        },
        trendConfidence: {
            type: Number,
            min: 0,
            max: 100,
            default: 0
        }
    },

    // Anomaly Detection
    anomalies: [{
        type: {
            type: String,
            enum: ['response_time', 'error_rate', 'throughput', 'downtime'],
            required: true
        },
        severity: {
            type: String,
            enum: ['critical', 'high', 'medium', 'low'],
            required: true
        },
        value: {
            type: Number,
            required: true
        },
        expectedValue: {
            type: Number,
            required: true
        },
        zScore: {
            type: Number,
            required: true
        },
        description: {
            type: String,
            required: true
        },
        detectedAt: {
            type: Date,
            default: Date.now
        },
        resolved: {
            type: Boolean,
            default: false
        },
        resolvedAt: {
            type: Date
        }
    }],

    // Predictions
    predictions: {
        nextHourResponseTime: {
            type: Number
        },
        nextHourErrorRate: {
            type: Number
        },
        nextDayUptime: {
            type: Number
        },
        trendDirection: {
            type: String,
            enum: ['up', 'down', 'stable']
        },
        confidence: {
            type: Number,
            min: 0,
            max: 100
        },
        calculatedAt: {
            type: Date,
            default: Date.now
        }
    },

    // Health Score (0-100)
    healthScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 100
    },

    // Critical Anomalies Count
    criticalAnomaliesCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Compound indexes for efficient queries
analyticsSchema.index({ monitorId: 1, timestamp: -1 });
analyticsSchema.index({ monitorId: 1, aggregationPeriod: 1, timestamp: -1 });
analyticsSchema.index({ workspaceId: 1, timestamp: -1 });
analyticsSchema.index({ timestamp: -1 });

// TTL index to automatically delete old analytics after 180 days
analyticsSchema.index({ timestamp: 1 }, { expireAfterSeconds: 15552000 }); // 180 days

// Static method to get latest analytics for a monitor
analyticsSchema.statics.getLatest = async function (monitorId, period = 'hourly') {
    return this.findOne({
        monitorId,
        aggregationPeriod: period
    }).sort({ timestamp: -1 });
};

// Static method to get analytics for a time range
analyticsSchema.statics.getTimeRange = async function (monitorId, startDate, endDate, period = 'hourly') {
    return this.find({
        monitorId,
        aggregationPeriod: period,
        timestamp: { $gte: startDate, $lte: endDate }
    }).sort({ timestamp: 1 });
};

// Calculate health score before saving
analyticsSchema.pre('save', function (next) {
    const metrics = this.metrics;
    const anomaliesCount = this.anomalies.filter(a => !a.resolved).length;
    const criticalCount = this.anomalies.filter(a => a.severity === 'critical' && !a.resolved).length;

    this.criticalAnomaliesCount = criticalCount;

    // Health score calculation
    let score = 100;

    // Deduct for uptime
    score -= (100 - metrics.uptimePercentage) * 2;

    // Deduct for error rate
    score -= metrics.errorRate * 10;

    // Deduct for SLA breaches
    score -= metrics.slaBreaches * 5;

    // Deduct for unresolved anomalies
    score -= anomaliesCount * 3;
    score -= criticalCount * 10;

    this.healthScore = Math.max(0, Math.min(100, score));

    next();
});

module.exports = mongoose.model('Analytics', analyticsSchema);
