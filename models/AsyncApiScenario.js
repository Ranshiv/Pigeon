// models/AsyncApiScenario.js
// A saved test scenario against one channel/operation of an AsyncApiDocument.
// Mirrors models/ConsumerContract.js — lastRun denormalised pointer, field
// expectations reuse the fieldExpectationSchema shape.
const mongoose = require('mongoose');

const kvSchema = new mongoose.Schema({
    key: { type: String, default: '' },
    value: { type: String, default: '' }
}, { _id: false });

// Same shape as models/ConsumerContract.js fieldExpectationSchema (no _id).
const fieldExpectationSchema = new mongoose.Schema({
    path: { type: String, required: true },
    required: { type: Boolean, default: true },
    type: {
        type: String,
        enum: ['any', 'string', 'number', 'boolean', 'object', 'array', 'null'],
        default: 'any'
    },
    expectedValue: { type: String, default: '' },
    matchValue: { type: Boolean, default: false }
}, { _id: false });

const asyncApiScenarioSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: '' },

    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'AsyncApiDocument', required: true, index: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    channelName: { type: String, required: true },
    operation: { type: String, enum: ['publish', 'subscribe'], required: true },
    messageName: { type: String, default: '' },

    // Raw request payload (string). Redacted by AsyncApiTestRunner before save.
    payload: { type: String, default: '' },
    headers: [kvSchema],

    // When true, the runner validates the response against payloadSchema (if any).
    expectedSchemaValidation: { type: Boolean, default: true },
    expectedFields: [fieldExpectationSchema],

    timeoutMs: { type: Number, default: 5000 },
    environmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Environment', default: null },

    lastRun: {
        runId: { type: mongoose.Schema.Types.ObjectId, ref: 'AsyncApiTestRun', default: null },
        result: { type: String, enum: ['passed', 'failed', 'error', null], default: null },
        ranAt: { type: Date, default: null }
    },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

asyncApiScenarioSchema.index({ documentId: 1, updatedAt: -1 });

asyncApiScenarioSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('AsyncApiScenario', asyncApiScenarioSchema);
