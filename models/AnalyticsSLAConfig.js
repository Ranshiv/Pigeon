// models/AnalyticsSLAConfig.js
const mongoose = require('mongoose');

const analyticsSLAConfigSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
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
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // SLA Targets
    targets: {
        // Uptime target (percentage)
        uptime: {
            percentage: {
                type: Number,
                required: true,
                min: 0,
                max: 100,
                default: 99.9
            },
            measurementPeriod: {
                type: String,
                enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
                default: 'monthly'
            }
        },

        // Response time target
        responseTime: {
            threshold: {
                type: Number,
                required: true,
                default: 1000 // milliseconds
            },
            percentile: {
                type: Number,
                enum: [50, 75, 90, 95, 99],
                default: 95
            }
        },

        // Error rate target
        errorRate: {
            maxPercentage: {
                type: Number,
                required: true,
                min: 0,
                max: 100,
                default: 1 // 1% error rate maximum
            }
        },

        // Availability target
        availability: {
            maxDowntimeMinutes: {
                type: Number,
                default: 43 // ~99.9% uptime monthly
            },
            measurementPeriod: {
                type: String,
                enum: ['daily', 'weekly', 'monthly'],
                default: 'monthly'
            }
        }
    },

    // Breach Penalties
    penalties: {
        minorBreach: {
            description: String,
            threshold: Number, // How far from target constitutes minor breach
            action: String
        },
        majorBreach: {
            description: String,
            threshold: Number,
            action: String
        },
        criticalBreach: {
            description: String,
            threshold: Number,
            action: String
        }
    },

    // Notification Settings
    notifications: {
        onBreach: {
            type: Boolean,
            default: true
        },
        onWarning: {
            type: Boolean,
            default: true
        },
        warningThreshold: {
            type: Number,
            default: 90 // Warn at 90% of target
        },
        recipients: [{
            email: String,
            name: String
        }],
        integrations: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Integration'
        }]
    },

    // Measurement Period
    measurementPeriod: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
        default: 'monthly'
    },

    // Current Compliance Status
    currentStatus: {
        compliance: {
            type: Number,
            min: 0,
            max: 100,
            default: 100
        },
        lastCalculated: {
            type: Date,
            default: Date.now
        },
        inCompliance: {
            type: Boolean,
            default: true
        },
        breachCount: {
            type: Number,
            default: 0
        },
        consecutiveBreach: {
            type: Boolean,
            default: false
        }
    },

    // Historical Compliance
    complianceHistory: [{
        period: {
            start: Date,
            end: Date
        },
        compliance: {
            type: Number,
            min: 0,
            max: 100
        },
        breaches: [{
            type: {
                type: String,
                enum: ['uptime', 'response_time', 'error_rate', 'availability']
            },
            severity: {
                type: String,
                enum: ['minor', 'major', 'critical']
            },
            actualValue: Number,
            targetValue: Number,
            timestamp: Date,
            duration: Number, // Duration of breach in minutes
            resolved: Boolean,
            resolvedAt: Date
        }],
        metrics: {
            avgUptime: Number,
            avgResponseTime: Number,
            avgErrorRate: Number,
            totalDowntime: Number
        }
    }],

    // Active Status
    isActive: {
        type: Boolean,
        default: true
    },

    // Start and End Dates
    startDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    endDate: {
        type: Date
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
analyticsSLAConfigSchema.index({ monitorId: 1, isActive: 1 });
analyticsSLAConfigSchema.index({ workspaceId: 1, isActive: 1 });
analyticsSLAConfigSchema.index({ 'currentStatus.lastCalculated': 1 });

// Calculate overall compliance score
analyticsSLAConfigSchema.methods.calculateComplianceScore = function (metrics) {
    let totalScore = 0;
    let weights = 0;

    // Uptime compliance (weight: 40%)
    if (this.targets.uptime) {
        const uptimeScore = (metrics.uptime / this.targets.uptime.percentage) * 100;
        totalScore += Math.min(uptimeScore, 100) * 0.4;
        weights += 0.4;
    }

    // Response time compliance (weight: 30%)
    if (this.targets.responseTime) {
        const responseScore = (this.targets.responseTime.threshold / metrics.avgResponseTime) * 100;
        totalScore += Math.min(responseScore, 100) * 0.3;
        weights += 0.3;
    }

    // Error rate compliance (weight: 20%)
    if (this.targets.errorRate) {
        const errorScore = ((this.targets.errorRate.maxPercentage - metrics.errorRate) / this.targets.errorRate.maxPercentage) * 100;
        totalScore += Math.max(0, Math.min(errorScore, 100)) * 0.2;
        weights += 0.2;
    }

    // Availability compliance (weight: 10%)
    if (this.targets.availability) {
        const availScore = ((this.targets.availability.maxDowntimeMinutes - metrics.downtimeMinutes) / this.targets.availability.maxDowntimeMinutes) * 100;
        totalScore += Math.max(0, Math.min(availScore, 100)) * 0.1;
        weights += 0.1;
    }

    return weights > 0 ? totalScore / weights : 100;
};

// Check if currently in compliance
analyticsSLAConfigSchema.methods.checkCompliance = function (metrics) {
    const score = this.calculateComplianceScore(metrics);

    return {
        inCompliance: score >= 100,
        score,
        breaches: this.identifyBreaches(metrics)
    };
};

// Identify specific SLA breaches
analyticsSLAConfigSchema.methods.identifyBreaches = function (metrics) {
    const breaches = [];

    // Check uptime breach
    if (this.targets.uptime && metrics.uptime < this.targets.uptime.percentage) {
        const severity = this.calculateBreachSeverity('uptime', metrics.uptime, this.targets.uptime.percentage);
        breaches.push({
            type: 'uptime',
            severity,
            actualValue: metrics.uptime,
            targetValue: this.targets.uptime.percentage,
            timestamp: new Date()
        });
    }

    // Check response time breach
    if (this.targets.responseTime && metrics.avgResponseTime > this.targets.responseTime.threshold) {
        const severity = this.calculateBreachSeverity('response_time', metrics.avgResponseTime, this.targets.responseTime.threshold);
        breaches.push({
            type: 'response_time',
            severity,
            actualValue: metrics.avgResponseTime,
            targetValue: this.targets.responseTime.threshold,
            timestamp: new Date()
        });
    }

    // Check error rate breach
    if (this.targets.errorRate && metrics.errorRate > this.targets.errorRate.maxPercentage) {
        const severity = this.calculateBreachSeverity('error_rate', metrics.errorRate, this.targets.errorRate.maxPercentage);
        breaches.push({
            type: 'error_rate',
            severity,
            actualValue: metrics.errorRate,
            targetValue: this.targets.errorRate.maxPercentage,
            timestamp: new Date()
        });
    }

    return breaches;
};

// Calculate breach severity
analyticsSLAConfigSchema.methods.calculateBreachSeverity = function (type, actual, target) {
    const deviation = Math.abs(actual - target) / target;

    if (this.penalties.criticalBreach && deviation >= this.penalties.criticalBreach.threshold) {
        return 'critical';
    } else if (this.penalties.majorBreach && deviation >= this.penalties.majorBreach.threshold) {
        return 'major';
    } else if (this.penalties.minorBreach && deviation >= this.penalties.minorBreach.threshold) {
        return 'minor';
    }

    // Default severity based on deviation
    if (deviation > 0.2) return 'critical';
    if (deviation > 0.1) return 'major';
    return 'minor';
};

module.exports = mongoose.model('AnalyticsSLAConfig', analyticsSLAConfigSchema);
