// models/LoadTest.js
const mongoose = require('mongoose');

const loadTestPhaseSchema = new mongoose.Schema({
    durationSeconds: { type: Number, required: true },
    connections: { type: Number, required: true },
    pipelining: { type: Number, default: 1 }
}, { _id: false });

const loadTestSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: '' },

    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Scenario definition
    targetUrl: { type: String, required: true },
    method: { type: String, default: 'GET' },
    headers: { type: mongoose.Schema.Types.Mixed, default: {} },
    body: { type: String, default: undefined },
    timeoutSeconds: { type: Number, default: 30 },
    phases: { type: [loadTestPhaseSchema], default: [] },

    // Thresholds for alerts (future use)
    thresholds: {
        p95LatencyMs: { type: Number, default: null },
        p99LatencyMs: { type: Number, default: null },
        errorRate: { type: Number, default: null },
        minRps: { type: Number, default: null }
    },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

loadTestSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

loadTestSchema.index({ owner: 1, createdAt: -1 });

module.exports = mongoose.model('LoadTest', loadTestSchema);
