// models/AlertPolicy.js
const mongoose = require('mongoose');

const conditionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['threshold', 'formula', 'anomaly', 'composite'],
        required: true
    },
    metric: {
        type: String,
        required: true
    },
    operator: {
        type: String,
        enum: ['gt', 'gte', 'lt', 'lte', 'eq', 'neq', 'contains', 'regex'],
        required: function () { return this.type === 'threshold'; }
    },
    threshold: {
        type: mongoose.Schema.Types.Mixed // Can be number or string
    },
    formula: {
        type: String // Custom formula for evaluation
    },
    sensitivityThreshold: {
        type: Number,
        default: 3 // For anomaly detection (standard deviations)
    },
    minDataPoints: {
        type: Number,
        default: 10 // Minimum data points for anomaly detection
    },
    conditions: [{
        type: mongoose.Schema.Types.Mixed // For composite conditions
    }],
    logicalOperator: {
        type: String,
        enum: ['AND', 'OR', 'NOT'],
        default: 'AND'
    }
}, { _id: false });

const severityRoutingSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['user', 'team', 'channel', 'webhook', 'email', 'sms', 'schedule'],
        required: true
    },
    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'severityRouting.type'
    },
    channel: {
        type: String // For channel/webhook/email types
    },
    priority: {
        type: Number,
        default: 1
    },
    notificationTemplate: {
        type: String
    }
}, { _id: false });

const alertPolicySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    description: {
        type: String,
        trim: true,
        maxlength: 1000
    },
    workspaceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workspace',
        required: true,
        index: true
    },
    teamId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team',
        index: true
    },
    monitorIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Monitor'
    }],
    enabled: {
        type: Boolean,
        default: true,
        index: true
    },
    conditions: {
        type: [conditionSchema],
        required: true,
        validate: {
            validator: function (v) {
                return v && v.length > 0;
            },
            message: 'At least one condition is required'
        }
    },
    conditionOperator: {
        type: String,
        enum: ['AND', 'OR'],
        default: 'AND'
    },
    severity: {
        type: String,
        enum: ['critical', 'high', 'medium', 'low', 'info'],
        required: true,
        default: 'medium'
    },
    severityRouting: {
        critical: [severityRoutingSchema],
        high: [severityRoutingSchema],
        medium: [severityRoutingSchema],
        low: [severityRoutingSchema],
        info: [severityRoutingSchema]
    },
    escalationPolicyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EscalationPolicy'
    },
    notificationChannels: [{
        type: {
            type: String,
            enum: ['email', 'slack', 'webhook', 'sms', 'pagerduty', 'msteams'],
            required: true
        },
        enabled: {
            type: Boolean,
            default: true
        },
        config: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }
    }],
    grouping: {
        enabled: {
            type: Boolean,
            default: true
        },
        windowMinutes: {
            type: Number,
            default: 5,
            min: 1,
            max: 60
        },
        groupBy: {
            type: [String],
            default: ['monitorId', 'severity']
        }
    },
    snoozeRules: {
        allowSnooze: {
            type: Boolean,
            default: true
        },
        maxSnoozeDuration: {
            type: Number,
            default: 24 * 60 * 60 * 1000 // 24 hours in ms
        },
        autoReactivate: {
            type: Boolean,
            default: true
        }
    },
    rateLimit: {
        enabled: {
            type: Boolean,
            default: false
        },
        maxAlerts: {
            type: Number,
            default: 10
        },
        windowMinutes: {
            type: Number,
            default: 60
        }
    },
    schedule: {
        enabled: {
            type: Boolean,
            default: false
        },
        activeHours: {
            start: { type: String, default: '00:00' },
            end: { type: String, default: '23:59' }
        },
        activeDays: {
            type: [Number], // 0-6 (Sunday-Saturday)
            default: [0, 1, 2, 3, 4, 5, 6]
        },
        timezone: {
            type: String,
            default: 'UTC'
        }
    },
    predictive: {
        enabled: {
            type: Boolean,
            default: false
        },
        lookAheadMinutes: {
            type: Number,
            default: 30
        },
        confidenceThreshold: {
            type: Number,
            default: 0.8,
            min: 0,
            max: 1
        }
    },
    maintenance: {
        respectMaintenanceWindows: {
            type: Boolean,
            default: true
        },
        maintenanceWindowIds: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'MaintenanceWindow'
        }]
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    tags: [{
        type: String,
        trim: true
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    statistics: {
        totalAlerts: {
            type: Number,
            default: 0
        },
        lastTriggered: {
            type: Date
        },
        avgResolutionTime: {
            type: Number,
            default: 0
        }
    }
}, {
    timestamps: true
});

// Indexes for efficient querying
alertPolicySchema.index({ workspaceId: 1, enabled: 1 });
alertPolicySchema.index({ teamId: 1, enabled: 1 });
alertPolicySchema.index({ monitorIds: 1 });
alertPolicySchema.index({ 'schedule.enabled': 1, 'schedule.activeHours': 1 });
alertPolicySchema.index({ tags: 1 });

// Method to check if policy is active now
alertPolicySchema.methods.isActiveNow = function () {
    if (!this.enabled) {
        return false;
    }

    if (!this.schedule.enabled) {
        return true;
    }

    const now = new Date();
    const currentDay = now.getDay();

    // Check if today is an active day
    if (!this.schedule.activeDays.includes(currentDay)) {
        return false;
    }

    // Check time range
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
    return currentTime >= this.schedule.activeHours.start &&
        currentTime <= this.schedule.activeHours.end;
};

// Method to check if within rate limit
alertPolicySchema.methods.isWithinRateLimit = async function () {
    if (!this.rateLimit.enabled) {
        return true;
    }

    const Alert = mongoose.model('Alert');
    const windowStart = new Date(Date.now() - this.rateLimit.windowMinutes * 60 * 1000);

    const count = await Alert.countDocuments({
        policyId: this._id,
        triggeredAt: { $gte: windowStart }
    });

    return count < this.rateLimit.maxAlerts;
};

// Static method to find applicable policies for a monitor
alertPolicySchema.statics.findApplicablePolicies = async function (monitorId, workspaceId) {
    return this.find({
        $or: [
            { monitorIds: monitorId },
            { monitorIds: { $size: 0 } } // Policies with no specific monitors apply to all
        ],
        workspaceId,
        enabled: true
    });
};

// Pre-save middleware to update statistics
alertPolicySchema.pre('save', function (next) {
    if (this.isModified()) {
        this.updatedBy = this.updatedBy || this.createdBy;
    }
    next();
});

module.exports = mongoose.model('AlertPolicy', alertPolicySchema);
