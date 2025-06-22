// models/Incident.js
const mongoose = require('mongoose');

const incidentUpdateSchema = new mongoose.Schema({
    message: {
        type: String,
        required: true,
        trim: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['investigating', 'identified', 'monitoring', 'resolved'],
        required: true
    }
});

const incidentSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: String,
        enum: ['investigating', 'identified', 'monitoring', 'resolved'],
        default: 'investigating'
    },
    severity: {
        type: String,
        enum: ['minor', 'major', 'critical'],
        default: 'minor'
    },
    affectedServices: [{
        monitorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Monitor'
        },
        serviceName: String
    }],
    updates: [incidentUpdateSchema],
    resolvedAt: {
        type: Date
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isPublic: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Index for efficient querying
incidentSchema.index({ status: 1, createdAt: -1 });
incidentSchema.index({ isPublic: 1, createdAt: -1 });
incidentSchema.index({ 'affectedServices.monitorId': 1 });

module.exports = mongoose.model('Incident', incidentSchema);
