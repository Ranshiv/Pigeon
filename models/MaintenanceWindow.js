// models/MaintenanceWindow.js
const mongoose = require('mongoose');

const maintenanceWindowSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    affectedServices: [{
        monitorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Monitor',
            required: true
        },
        serviceName: String
    }],
    scheduledStartTime: {
        type: Date,
        required: true
    },
    scheduledEndTime: {
        type: Date,
        required: true
    },
    actualStartTime: Date,
    actualEndTime: Date,
    status: {
        type: String,
        enum: ['scheduled', 'in_progress', 'completed', 'cancelled'],
        default: 'scheduled'
    },
    isRecurring: {
        type: Boolean,
        default: false
    },
    recurrencePattern: {
        frequency: {
            type: String,
            enum: ['daily', 'weekly', 'monthly'],
        },
        interval: Number, // every N days/weeks/months
        daysOfWeek: [Number], // 0-6 for Sunday-Saturday
        dayOfMonth: Number
    },
    notificationSettings: {
        notifySubscribers: {
            type: Boolean,
            default: true
        },
        reminderMinutes: {
            type: [Number],
            default: [1440, 60] // 24 hours and 1 hour before
        }
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
    updates: [{
        message: String,
        timestamp: {
            type: Date,
            default: Date.now
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }]
}, {
    timestamps: true
});

maintenanceWindowSchema.index({ workspaceId: 1, scheduledStartTime: 1 });
maintenanceWindowSchema.index({ status: 1, scheduledStartTime: 1 });
maintenanceWindowSchema.index({ 'affectedServices.monitorId': 1 });

module.exports = mongoose.model('MaintenanceWindow', maintenanceWindowSchema);
