// models/Incident.js
const mongoose = require('mongoose');

const incidentUpdateSchema = new mongoose.Schema({
    message: { type: String, required: true },
    status: {
        type: String,
        enum: ['open', 'acknowledged', 'monitoring', 'snoozed', 'resolved', 'closed'],
        default: 'open'
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, { _id: false });

const incidentTimelineSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['status_change', 'note', 'escalation', 'routing', 'acknowledged', 'resolved', 'snoozed', 'prediction'],
        default: 'note'
    },
    message: String,
    actor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    at: {
        type: Date,
        default: Date.now
    },
    data: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, { _id: false });

const incidentSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['open', 'acknowledged', 'monitoring', 'snoozed', 'resolved', 'closed'],
        default: 'open',
        index: true
    },
    severity: {
        type: String,
        enum: ['critical', 'high', 'medium', 'low', 'info'],
        default: 'medium'
    },
    priority: {
        type: String,
        enum: ['P1', 'P2', 'P3', 'P4'],
        default: 'P3'
    },
    workspaceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workspace',
        index: true
    },
    teamId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team'
    },
    alerts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Alert'
    }],
    affectedServices: [{
        monitorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Monitor' },
        serviceName: String,
        component: String,
        status: {
            type: String,
            enum: ['operational', 'degraded', 'outage', 'recovering'],
            default: 'outage'
        }
    }],
    updates: [incidentUpdateSchema],
    timeline: [incidentTimelineSchema],
    tags: [{ type: String, trim: true }],
    isPublic: {
        type: Boolean,
        default: false,
        index: true
    },
    acknowledgedAt: Date,
    acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date,
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    snoozedUntil: Date,
    groupKey: { type: String },
    dedupKey: { type: String },
    nextEscalationAt: Date,
    escalationLevel: { type: Number, default: 0 },
    routingTargets: [{
        type: { type: String, enum: ['user', 'team', 'schedule', 'channel'] },
        targetId: mongoose.Schema.Types.ObjectId,
        channel: String,
        priority: { type: Number, default: 0 },
        metadata: mongoose.Schema.Types.Mixed
    }],
    metrics: {
        mtta: { type: Number, default: 0 },
        mttr: { type: Number, default: 0 },
        firstAlertAt: Date
    },
    detection: {
        type: String,
        enum: ['monitoring', 'manual', 'predictive'],
        default: 'monitoring'
    }
}, {
    timestamps: true
});

incidentSchema.index({ workspaceId: 1, status: 1, createdAt: -1 });
incidentSchema.index({ severity: 1, status: 1 });
incidentSchema.index({ dedupKey: 1 }, { sparse: true });
incidentSchema.index({ groupKey: 1 }, { sparse: true });

incidentSchema.virtual('duration').get(function () {
    const end = this.resolvedAt || new Date();
    return end - this.createdAt;
});

incidentSchema.methods.addUpdate = function (message, status, author, metadata = {}) {
    this.updates.push({ message, status, author, metadata, timestamp: new Date() });
    this.timeline.push({ type: 'note', message, actor: author, at: new Date(), data: metadata });
};

incidentSchema.methods.addTimeline = function (entry) {
    this.timeline.push({ ...entry, at: entry.at || new Date() });
};

module.exports = mongoose.model('Incident', incidentSchema);
