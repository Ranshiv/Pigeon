// models/EvaluationRun.js
// One scoring execution against a suite (scenarioId null) or a single scenario.
// transcript is a redacted JSON string (never raw secrets). Mirrors the
// AsyncApiTestRun shape: violations[] + per-rule results + status enum.
const mongoose = require('mongoose');

const violationSchema = new mongoose.Schema({
    kind: { type: String, required: true },
    toolName: { type: String, default: '' },
    message: { type: String, required: true },
    expected: { type: String, default: '' },
    actual: { type: String, default: '' },
    path: { type: String, default: '' },
    operator: { type: String, default: '' }
}, { _id: false });

const ruleResultSchema = new mongoose.Schema({
    rule: { type: String, required: true },
    passed: { type: Boolean, default: false },
    detail: { type: String, default: '' },
    toolName: { type: String, default: '' },
    path: { type: String, default: '' },
    expected: { type: String, default: '' },
    actual: { type: String, default: '' }
}, { _id: false });

const evaluationRunSchema = new mongoose.Schema({
    suiteId: { type: mongoose.Schema.Types.ObjectId, ref: 'EvaluationSuite', required: true, index: true },
    scenarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'EvaluationScenario', default: null },
    collectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Collection', required: true, index: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    agentName: { type: String, default: '' },
    // Redacted JSON string — never raw secrets.
    transcript: { type: String, default: '' },

    status: { type: String, enum: ['passed', 'failed', 'error'], default: 'passed' },
    score: { type: String, default: '0/0' },

    violations: { type: [violationSchema], default: [] },
    perRuleResults: { type: [ruleResultSchema], default: [] },
    // Present only for whole-suite runs.
    scenarioResults: { type: [mongoose.Schema.Types.Mixed], default: [] },

    error: { type: String, default: null },

    createdAt: { type: Date, default: Date.now }
});

evaluationRunSchema.index({ suiteId: 1, createdAt: -1 });
evaluationRunSchema.index({ scenarioId: 1, createdAt: -1 });

module.exports = mongoose.model('EvaluationRun', evaluationRunSchema);