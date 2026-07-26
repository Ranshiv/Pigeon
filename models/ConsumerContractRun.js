// models/ConsumerContractRun.js
// One execution of a consumer contract against a provider environment.
const mongoose = require('mongoose');

const violationSchema = new mongoose.Schema({
    // status | header | field-missing | field-type | field-value | response-time | transport
    kind: { type: String, required: true },
    path: { type: String, default: '' },
    message: { type: String, required: true },
    expected: { type: String, default: '' },
    actual: { type: String, default: '' },
    // Breaking = the provider changed something the consumer depends on.
    breaking: { type: Boolean, default: false }
}, { _id: false });

const interactionResultSchema = new mongoose.Schema({
    interactionName: { type: String, default: '' },
    method: { type: String, default: '' },
    url: { type: String, default: '' },
    tags: [{ type: String }],

    passed: { type: Boolean, default: false },
    breaking: { type: Boolean, default: false },
    durationMs: { type: Number, default: 0 },

    expectedStatus: { type: Number, default: null },
    actualStatus: { type: Number, default: null },

    // Truncated for storage; enough for an expected-vs-actual view.
    actualHeaders: { type: mongoose.Schema.Types.Mixed, default: {} },
    actualBody: { type: String, default: '' },
    expectedBody: { type: String, default: '' },

    violations: [violationSchema],
    error: { type: String, default: null }
}, { _id: false });

const consumerContractRunSchema = new mongoose.Schema({
    contractId: { type: mongoose.Schema.Types.ObjectId, ref: 'ConsumerContract', required: true, index: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    environmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Environment', default: null },
    environmentName: { type: String, default: 'No environment' },
    contractVersion: { type: String, default: '' },

    status: { type: String, enum: ['passed', 'failed', 'error'], default: 'passed' },
    breaking: { type: Boolean, default: false },

    total: { type: Number, default: 0 },
    passedCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    durationMs: { type: Number, default: 0 },

    results: [interactionResultSchema],
    error: { type: String, default: null },

    createdAt: { type: Date, default: Date.now }
});

consumerContractRunSchema.index({ contractId: 1, createdAt: -1 });

module.exports = mongoose.model('ConsumerContractRun', consumerContractRunSchema);
