// models/AsyncApiTestRun.js
// One execution of an AsyncAPI test (scenario or ad-hoc). Mirrors
// models/ConsumerContractRun.js: violations[], redacted request/response text,
// index on { documentId, createdAt: -1 } and { scenarioId, createdAt: -1 }.
const mongoose = require('mongoose');

const violationSchema = new mongoose.Schema({
    // 'schema' | 'transport' | 'timeout' | 'field'
    kind: { type: String, required: true },
    path: { type: String, default: '' },
    message: { type: String, required: true },
    expected: { type: String, default: '' },
    actual: { type: String, default: '' },
    breaking: { type: Boolean, default: false }
}, { _id: false });

const asyncApiTestRunSchema = new mongoose.Schema({
    scenarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'AsyncApiScenario', default: null },
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'AsyncApiDocument', required: true, index: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    environmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Environment', default: null },
    environmentName: { type: String, default: 'No environment' },

    protocol: { type: String, default: '' },
    channel: { type: String, default: '' },
    operation: { type: String, enum: ['publish', 'subscribe', ''], default: '' },

    // status enum mirrors ConsumerContractRun.
    status: { type: String, enum: ['passed', 'failed', 'error'], default: 'passed' },
    durationMs: { type: Number, default: 0 },

    // Truncated & redacted strings — never raw secrets.
    requestPayload: { type: String, default: '' },
    responsePayload: { type: String, default: '' },

    violations: [violationSchema],
    error: { type: String, default: null },

    createdAt: { type: Date, default: Date.now }
});

asyncApiTestRunSchema.index({ documentId: 1, createdAt: -1 });
asyncApiTestRunSchema.index({ scenarioId: 1, createdAt: -1 });

module.exports = mongoose.model('AsyncApiTestRun', asyncApiTestRunSchema);
