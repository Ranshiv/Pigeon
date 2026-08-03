const mongoose = require('mongoose');

const generatedTestCaseSchema = new mongoose.Schema({
    suiteId: { type: mongoose.Schema.Types.ObjectId, ref: 'GeneratedTestSuite', required: true, index: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    order: { type: Number, default: 0 },
    fingerprint: { type: String, required: true },
    name: { type: String, required: true, maxlength: 240 },
    category: { type: String, enum: ['positive', 'negative', 'boundary', 'authorization', 'schema', 'regression'], required: true },
    protocol: { type: String, default: 'http' },
    operationId: { type: String, required: true },
    source: { type: mongoose.Schema.Types.Mixed, required: true },
    request: { type: mongoose.Schema.Types.Mixed, default: {} },
    assertions: { type: [mongoose.Schema.Types.Mixed], default: [] },
    rationale: { type: String, default: '', maxlength: 1200 },
    provenance: { type: String, enum: ['deterministic', 'ai'], default: 'deterministic' },
    confidence: { type: Number, min: 0, max: 1, default: 1 },
    safety: { type: String, enum: ['read-only', 'active', 'destructive'], default: 'active' },
    enabled: { type: Boolean, default: true },
    blocked: { type: Boolean, default: false },
    blockedReason: { type: String, default: '' },
    materialization: {
        kind: { type: String, enum: ['', 'request-script', 'fuzz-case', 'consumer-contract', 'asyncapi-scenario'], default: '' },
        artifactId: { type: String, default: '' },
        materializedAt: { type: Date, default: null }
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

generatedTestCaseSchema.index({ suiteId: 1, fingerprint: 1 }, { unique: true });
generatedTestCaseSchema.index({ suiteId: 1, order: 1 });
generatedTestCaseSchema.pre('save', function (next) { this.updatedAt = new Date(); next(); });

module.exports = mongoose.model('GeneratedTestCase', generatedTestCaseSchema);
