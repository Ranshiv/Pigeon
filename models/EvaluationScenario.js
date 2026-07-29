// models/EvaluationScenario.js
// One ordered scenario inside an EvaluationSuite: required/forbidden tool
// calls, optional argument assertions, optional max tool-call count.
const mongoose = require('mongoose');

const argumentAssertionSchema = new mongoose.Schema({
    toolName: { type: String, required: true },
    path: { type: String, default: '' },
    operator: {
        type: String,
        enum: ['equals', 'contains', 'exists', 'notExists'],
        default: 'equals'
    },
    expected: { type: String, default: '' }
}, { _id: false });

const evaluationScenarioSchema = new mongoose.Schema({
    suiteId: { type: mongoose.Schema.Types.ObjectId, ref: 'EvaluationSuite', required: true, index: true },

    order: { type: Number, default: 0 },
    name: { type: String, required: true, trim: true },
    objective: { type: String, default: '' },

    requiredToolCalls: { type: [String], default: [] },
    forbiddenToolCalls: { type: [String], default: [] },
    argumentAssertions: { type: [argumentAssertionSchema], default: [] },
    maxToolCalls: { type: Number, default: null },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

evaluationScenarioSchema.index({ suiteId: 1, order: 1 });

evaluationScenarioSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('EvaluationScenario', evaluationScenarioSchema);