// models/ConsumerContract.js
// Consumer-Driven Contract: a consumer's recorded expectations of a provider API.
const mongoose = require('mongoose');

const kvSchema = new mongoose.Schema({
    key: { type: String, default: '' },
    value: { type: String, default: '' },
    enabled: { type: Boolean, default: true }
}, { _id: false });

// A single expected field assertion inside the response body.
// path uses dot/bracket notation ("user.id", "items[0].sku").
const fieldExpectationSchema = new mongoose.Schema({
    path: { type: String, required: true },
    required: { type: Boolean, default: true },
    // '' / 'any' means "do not assert a type"
    type: {
        type: String,
        enum: ['any', 'string', 'number', 'boolean', 'object', 'array', 'null'],
        default: 'any'
    },
    // Optional exact value the consumer depends on. Stored as string; compared
    // after JSON-parsing when the actual value is not a string.
    expectedValue: { type: String, default: '' },
    matchValue: { type: Boolean, default: false }
}, { _id: false });

const interactionSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: '' },

    // --- Request the consumer will make ---
    method: {
        type: String,
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
        default: 'GET'
    },
    url: { type: String, required: true },
    headers: [kvSchema],
    queryParams: [kvSchema],
    body: { type: String, default: '' },
    bodyType: {
        type: String,
        enum: ['none', 'json', 'raw', 'x-www-form-urlencoded'],
        default: 'none'
    },

    // --- Consumer expectations ---
    expectedStatus: { type: Number, default: 200 },
    expectedHeaders: [kvSchema],
    // Example response the consumer relies on; used to seed field expectations.
    expectedBody: { type: String, default: '' },
    expectedFields: [fieldExpectationSchema],
    maxResponseTimeMs: { type: Number, default: null },

    tags: [{ type: String }],

    // Provenance when generated from a saved Pigeon request.
    sourceRequestId: { type: String, default: null },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const consumerContractSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: '' },

    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Who depends on the API.
    consumerName: { type: String, required: true },

    // Provider API under contract.
    providerCollectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Collection', required: true },

    // Environment the contract runs against by default.
    environmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Environment', default: null },

    version: { type: String, default: '1.0.0' },
    status: { type: String, enum: ['draft', 'active', 'deprecated'], default: 'draft' },

    interactions: [interactionSchema],

    // Denormalised pointer to the newest run so lists can filter on result
    // without a second query per contract.
    lastRun: {
        runId: { type: mongoose.Schema.Types.ObjectId, ref: 'ConsumerContractRun', default: null },
        result: { type: String, enum: ['passed', 'failed', 'error', null], default: null },
        breaking: { type: Boolean, default: false },
        ranAt: { type: Date, default: null }
    },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

consumerContractSchema.index({ workspaceId: 1, updatedAt: -1 });
consumerContractSchema.index({ providerCollectionId: 1 });

consumerContractSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('ConsumerContract', consumerContractSchema);
