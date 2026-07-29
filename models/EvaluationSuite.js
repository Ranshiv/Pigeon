// models/EvaluationSuite.js
// A collection-scoped AI-agent evaluation suite: ordered scenarios that a
// submitted tool-call transcript is scored against. Mirrors the
// AsyncApiDocument/AsyncApiScenario split — scenarios live in their own model
// keyed by suiteId + order. Run history lives in EvaluationRun.
const mongoose = require('mongoose');

const evaluationSuiteSchema = new mongoose.Schema({
    collectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Collection', required: true, index: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    enabled: { type: Boolean, default: true },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

evaluationSuiteSchema.index({ collectionId: 1, updatedAt: -1 });

evaluationSuiteSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('EvaluationSuite', evaluationSuiteSchema);