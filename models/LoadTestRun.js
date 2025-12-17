// models/LoadTestRun.js
const mongoose = require('mongoose');

const loadTestRunSchema = new mongoose.Schema({
    loadTestId: { type: mongoose.Schema.Types.ObjectId, ref: 'LoadTest', required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    status: { type: String, enum: ['queued', 'running', 'completed', 'failed'], default: 'queued' },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },

    // Snapshot of the scenario used for this run
    scenario: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Results
    metrics: { type: mongoose.Schema.Types.Mixed, default: null },
    analysis: { type: mongoose.Schema.Types.Mixed, default: null },
    error: { type: String, default: null },

    createdAt: { type: Date, default: Date.now }
});

loadTestRunSchema.index({ owner: 1, createdAt: -1 });
loadTestRunSchema.index({ loadTestId: 1, createdAt: -1 });

module.exports = mongoose.model('LoadTestRun', loadTestRunSchema);
