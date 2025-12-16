// models/OnCallSchedule.js
const mongoose = require('mongoose');

const rotationSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['daily', 'weekly', 'custom'],
        required: true,
        default: 'weekly'
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date // null for indefinite
    },
    rotationLengthDays: {
        type: Number,
        required: true,
        min: 1,
        default: 7
    },
    handoffTime: {
        type: String, // HH:MM format
        default: '09:00'
    },
    participants: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        order: {
            type: Number,
            required: true,
            min: 0
        },
        restrictions: {
            excludeDates: [Date],
            maxConsecutiveRotations: Number
        }
    }]
}, { _id: false });

const overrideSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    reason: {
        type: String,
        maxlength: 500
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

const onCallScheduleSchema = new mongoose.Schema({
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
        required: true,
        index: true
    },
    enabled: {
        type: Boolean,
        default: true,
        index: true
    },
    timezone: {
        type: String,
        required: true,
        default: 'UTC'
    },
    rotation: {
        type: rotationSchema,
        required: true
    },
    overrides: [overrideSchema],
    coverage: {
        type: {
            type: String,
            enum: ['24/7', 'business_hours', 'custom'],
            default: '24/7'
        },
        businessHours: {
            start: { type: String, default: '09:00' },
            end: { type: String, default: '17:00' }
        },
        activeDays: {
            type: [Number], // 0-6 (Sunday-Saturday)
            default: [1, 2, 3, 4, 5] // Monday to Friday
        }
    },
    escalation: {
        enabled: {
            type: Boolean,
            default: false
        },
        escalateAfterMinutes: {
            type: Number,
            default: 15,
            min: 1
        },
        fallbackUsers: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }]
    },
    notifications: {
        notifyOnRotation: {
            type: Boolean,
            default: true
        },
        reminderBeforeMinutes: {
            type: Number,
            default: 60
        },
        channels: [{
            type: String,
            enum: ['email', 'slack', 'sms', 'push'],
            default: 'email'
        }]
    },
    statistics: {
        totalRotations: {
            type: Number,
            default: 0
        },
        totalOverrides: {
            type: Number,
            default: 0
        },
        lastRotation: {
            type: Date
        }
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
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
onCallScheduleSchema.index({ workspaceId: 1, enabled: 1 });
onCallScheduleSchema.index({ teamId: 1, enabled: 1 });
onCallScheduleSchema.index({ 'rotation.startDate': 1, 'rotation.endDate': 1 });
onCallScheduleSchema.index({ 'overrides.startDate': 1, 'overrides.endDate': 1 });

// Method to get current on-call user
onCallScheduleSchema.methods.getCurrentOnCallUser = function (atTime = new Date()) {
    if (!this.enabled) {
        return null;
    }

    // Check for active overrides first
    const activeOverride = this.overrides.find(override =>
        atTime >= override.startDate && atTime <= override.endDate
    );

    if (activeOverride) {
        return activeOverride.userId;
    }

    // Check coverage hours
    if (!this.isCoveredTime(atTime)) {
        return null;
    }

    // Calculate current rotation
    const rotation = this.rotation;
    const participants = rotation.participants.sort((a, b) => a.order - b.order);

    if (participants.length === 0) {
        return null;
    }

    const daysSinceStart = Math.floor((atTime - rotation.startDate) / (1000 * 60 * 60 * 24));
    const rotationIndex = Math.floor(daysSinceStart / rotation.rotationLengthDays) % participants.length;

    return participants[rotationIndex].userId;
};

// Method to check if time is within coverage
onCallScheduleSchema.methods.isCoveredTime = function (atTime = new Date()) {
    if (this.coverage.type === '24/7') {
        return true;
    }

    const day = atTime.getDay();
    if (!this.coverage.activeDays.includes(day)) {
        return false;
    }

    if (this.coverage.type === 'business_hours') {
        const timeStr = atTime.toTimeString().slice(0, 5); // HH:MM
        return timeStr >= this.coverage.businessHours.start &&
            timeStr <= this.coverage.businessHours.end;
    }

    return true;
};

// Method to get upcoming rotations
onCallScheduleSchema.methods.getUpcomingRotations = function (days = 30) {
    const rotations = [];
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);

    let currentDate = new Date(startDate);
    const participants = this.rotation.participants.sort((a, b) => a.order - b.order);

    while (currentDate < endDate) {
        const onCallUser = this.getCurrentOnCallUser(currentDate);

        if (onCallUser) {
            const rotationEnd = new Date(currentDate.getTime() + this.rotation.rotationLengthDays * 24 * 60 * 60 * 1000);

            rotations.push({
                userId: onCallUser,
                startDate: new Date(currentDate),
                endDate: rotationEnd < endDate ? rotationEnd : endDate
            });
        }

        currentDate = new Date(currentDate.getTime() + this.rotation.rotationLengthDays * 24 * 60 * 60 * 1000);
    }

    return rotations;
};

// Method to add override
onCallScheduleSchema.methods.addOverride = function (overrideData) {
    // Validate no overlapping overrides
    const hasOverlap = this.overrides.some(existing => {
        return (overrideData.startDate >= existing.startDate && overrideData.startDate <= existing.endDate) ||
            (overrideData.endDate >= existing.startDate && overrideData.endDate <= existing.endDate);
    });

    if (hasOverlap) {
        throw new Error('Override overlaps with existing override');
    }

    this.overrides.push(overrideData);
    this.statistics.totalOverrides++;
    return this.save();
};

// Method to remove expired overrides
onCallScheduleSchema.methods.cleanExpiredOverrides = function () {
    const now = new Date();
    this.overrides = this.overrides.filter(override => override.endDate > now);
    return this.save();
};

// Static method to find schedules for a team
onCallScheduleSchema.statics.findByTeam = function (teamId) {
    return this.find({ teamId, enabled: true });
};

// Static method to find who is on-call for multiple schedules
onCallScheduleSchema.statics.getCurrentOnCallUsers = async function (teamIds, atTime = new Date()) {
    const schedules = await this.find({
        teamId: { $in: teamIds },
        enabled: true
    }).populate('rotation.participants.userId');

    const onCallUsers = [];

    for (const schedule of schedules) {
        const userId = schedule.getCurrentOnCallUser(atTime);
        if (userId) {
            onCallUsers.push({
                scheduleId: schedule._id,
                scheduleName: schedule.name,
                teamId: schedule.teamId,
                userId
            });
        }
    }

    return onCallUsers;
};

module.exports = mongoose.model('OnCallSchedule', onCallScheduleSchema);
