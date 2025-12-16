// models/EscalationPolicy.js
const mongoose = require('mongoose');

const escalationTargetSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['user', 'team', 'schedule', 'webhook'],
        required: true
    },
    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'escalationLevels.targets.type',
        required: function () {
            return ['user', 'team', 'schedule'].includes(this.type);
        }
    },
    webhookUrl: {
        type: String,
        required: function () {
            return this.type === 'webhook';
        }
    },
    notificationChannels: [{
        type: String,
        enum: ['email', 'slack', 'sms', 'push', 'phone'],
        default: 'email'
    }]
}, { _id: false });

const escalationLevelSchema = new mongoose.Schema({
    level: {
        type: Number,
        required: true,
        min: 0
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    escalateAfterMinutes: {
        type: Number,
        required: true,
        min: 1,
        default: 15
    },
    targets: {
        type: [escalationTargetSchema],
        validate: {
            validator: function (v) {
                return v && v.length > 0;
            },
            message: 'At least one target is required per escalation level'
        }
    },
    notifyAll: {
        type: Boolean,
        default: false // If true, notify all targets simultaneously; otherwise, try in order
    },
    repeatNotifications: {
        enabled: {
            type: Boolean,
            default: false
        },
        intervalMinutes: {
            type: Number,
            default: 10,
            min: 1
        },
        maxRepeats: {
            type: Number,
            default: 3,
            min: 1
        }
    }
}, { _id: false });

const escalationPolicySchema = new mongoose.Schema({
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
    enabled: {
        type: Boolean,
        default: true,
        index: true
    },
    escalationLevels: {
        type: [escalationLevelSchema],
        required: true,
        validate: {
            validator: function (v) {
                if (!v || v.length === 0) return false;

                // Check that levels are sequential starting from 0
                const levels = v.map(l => l.level).sort((a, b) => a - b);
                for (let i = 0; i < levels.length; i++) {
                    if (levels[i] !== i) return false;
                }
                return true;
            },
            message: 'Escalation levels must be sequential starting from 0'
        }
    },
    severityFilters: {
        type: [String],
        enum: ['critical', 'high', 'medium', 'low', 'info'],
        default: ['critical', 'high', 'medium', 'low', 'info']
    },
    timeRestrictions: {
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
    fallbackPolicy: {
        enabled: {
            type: Boolean,
            default: false
        },
        policyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'EscalationPolicy'
        }
    },
    autoResolve: {
        enabled: {
            type: Boolean,
            default: false
        },
        afterHours: {
            type: Number,
            default: 24,
            min: 1
        }
    },
    acknowledgementRequired: {
        type: Boolean,
        default: true
    },
    statistics: {
        totalEscalations: {
            type: Number,
            default: 0
        },
        avgEscalationLevel: {
            type: Number,
            default: 0
        },
        lastUsed: {
            type: Date
        }
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
    }
}, {
    timestamps: true
});

// Indexes
escalationPolicySchema.index({ workspaceId: 1, enabled: 1 });
escalationPolicySchema.index({ teamId: 1, enabled: 1 });
escalationPolicySchema.index({ tags: 1 });
escalationPolicySchema.index({ 'statistics.lastUsed': 1 });

// Method to get escalation level by number
escalationPolicySchema.methods.getLevel = function (levelNumber) {
    return this.escalationLevels.find(level => level.level === levelNumber);
};

// Method to get next escalation level
escalationPolicySchema.methods.getNextLevel = function (currentLevel) {
    const levels = this.escalationLevels.sort((a, b) => a.level - b.level);
    const currentIndex = levels.findIndex(l => l.level === currentLevel);

    if (currentIndex === -1 || currentIndex === levels.length - 1) {
        return null; // No next level
    }

    return levels[currentIndex + 1];
};

// Method to check if policy applies to incident
escalationPolicySchema.methods.appliesTo = function (incident) {
    if (!this.enabled) {
        return false;
    }

    // Check severity filter
    if (!this.severityFilters.includes(incident.severity)) {
        return false;
    }

    // Check time restrictions
    if (this.timeRestrictions.enabled) {
        const now = new Date();
        const currentDay = now.getDay();

        if (!this.timeRestrictions.activeDays.includes(currentDay)) {
            return false;
        }

        const currentTime = now.toTimeString().slice(0, 5);
        if (currentTime < this.timeRestrictions.activeHours.start ||
            currentTime > this.timeRestrictions.activeHours.end) {
            return false;
        }
    }

    return true;
};

// Method to get escalation timeline
escalationPolicySchema.methods.getEscalationTimeline = function () {
    const timeline = [];
    let cumulativeMinutes = 0;

    const levels = this.escalationLevels.sort((a, b) => a.level - b.level);

    for (const level of levels) {
        cumulativeMinutes += level.escalateAfterMinutes;

        timeline.push({
            level: level.level,
            name: level.name,
            escalateAfterMinutes: level.escalateAfterMinutes,
            cumulativeMinutes,
            estimatedTime: new Date(Date.now() + cumulativeMinutes * 60 * 1000),
            targets: level.targets.map(t => ({
                type: t.type,
                targetId: t.targetId,
                channels: t.notificationChannels
            }))
        });
    }

    return timeline;
};

// Method to calculate when next escalation should occur
escalationPolicySchema.methods.calculateNextEscalationTime = function (currentLevel, startTime = new Date()) {
    const nextLevel = this.getNextLevel(currentLevel);

    if (!nextLevel) {
        return null;
    }

    const minutesToAdd = nextLevel.escalateAfterMinutes;
    return new Date(startTime.getTime() + minutesToAdd * 60 * 1000);
};

// Static method to find applicable policies
escalationPolicySchema.statics.findApplicablePolicies = async function (incident) {
    const policies = await this.find({
        workspaceId: incident.workspaceId,
        enabled: true,
        severityFilters: incident.severity
    });

    return policies.filter(policy => policy.appliesTo(incident));
};

// Static method to get policy usage statistics
escalationPolicySchema.statics.getUsageStatistics = async function (policyId, days = 30) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const Incident = mongoose.model('Incident');

    const incidents = await Incident.find({
        'timeline.type': 'escalation',
        'timeline.data.policyId': policyId,
        createdAt: { $gte: startDate }
    });

    const statistics = {
        totalIncidents: incidents.length,
        avgEscalationLevel: 0,
        levelBreakdown: {},
        avgTimeToResolve: 0
    };

    if (incidents.length === 0) {
        return statistics;
    }

    let totalLevels = 0;
    let totalResolutionTime = 0;

    incidents.forEach(incident => {
        const maxLevel = Math.max(...incident.timeline
            .filter(e => e.type === 'escalation')
            .map(e => e.data.level || 0));

        totalLevels += maxLevel;
        statistics.levelBreakdown[maxLevel] = (statistics.levelBreakdown[maxLevel] || 0) + 1;

        if (incident.resolvedAt) {
            totalResolutionTime += incident.resolvedAt - incident.createdAt;
        }
    });

    statistics.avgEscalationLevel = totalLevels / incidents.length;
    statistics.avgTimeToResolve = totalResolutionTime / incidents.length;

    return statistics;
};

// Pre-save middleware
escalationPolicySchema.pre('save', function (next) {
    // Sort escalation levels
    this.escalationLevels.sort((a, b) => a.level - b.level);

    if (this.isModified()) {
        this.updatedBy = this.updatedBy || this.createdBy;
    }

    next();
});

module.exports = mongoose.model('EscalationPolicy', escalationPolicySchema);
