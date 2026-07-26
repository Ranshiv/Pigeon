// models/AsyncApiDocument.js
// AsyncAPI design & testing: an event-driven API spec stored per workspace.
// Mirrors models/ConsumerContract.js — kvSchema-style subdocuments, index on
// { workspaceId, updatedAt: -1 }, pre('save') bumps updatedAt.
const mongoose = require('mongoose');

// Free-form bindings object per channel (asyncapi over ws/mqtt/kafka etc.).
// Stored as Mixed so importers can round-trip vendor bindings untouched.
const channelBindingsSchema = new mongoose.Schema({}, { _id: false });

const serverSchema = new mongoose.Schema({
    name: { type: String, required: true },
    url: { type: String, default: '' },
    protocol: {
        type: String,
        enum: ['websocket', 'socketio', 'mqtt', 'http', 'kafka', 'amqp', 'amqps', 'nats', 'stomp', 'other'],
        default: 'websocket'
    },
    description: { type: String, default: '' },
    // Sensible credential values are never stored here. The field holds an
    // env-var placeholder string (e.g. {{ASYNCAPI_SECRET}}) produced by the
    // validator's redaction step, or an empty string.
    security: { type: String, default: '' }
}, { _id: false });

const messageSchema = new mongoose.Schema({
    name: { type: String, required: true },
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    contentType: { type: String, default: 'application/json' },
    // JSON-Schema-like shape — kept as Mixed to tolerate loose specs.
    payloadSchema: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Raw example (JSON string), redacted before persistence.
    payloadExample: { type: String, default: '' },
    headersSchema: { type: mongoose.Schema.Types.Mixed, default: {} },
    headersExample: { type: String, default: '' }
}, { _id: false });

const operationSchema = new mongoose.Schema({
    channelName: { type: String, required: true },
    // 'publish' = app emits to channel; 'subscribe' = app consumes from channel.
    action: { type: String, enum: ['publish', 'subscribe'], required: true },
    messageName: { type: String, default: '' },
    summary: { type: String, default: '' }
}, { _id: false });

const channelSchema = new mongoose.Schema({
    name: { type: String, required: true },
    address: { type: String, default: '' },
    description: { type: String, default: '' },
    bindings: { type: channelBindingsSchema, default: {} }
}, { _id: false });

const asyncApiDocumentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: '' },

    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    version: { type: String, default: '1.0.0' },
    asyncApiVersion: { type: String, default: '2.6.0' },

    servers: [serverSchema],
    channels: [channelSchema],
    messages: [messageSchema],
    operations: [operationSchema],

    tags: [{ type: String }],

    // Original parsed JSON kept for round-trip export and unsupported-field
    // preservation. Never persisted with plaintext secrets — the validator
    // redacts sensitive-looking values to {{ASYNCAPI_SECRET}} before save.
    rawImport: { type: mongoose.Schema.Types.Mixed, default: null },
    importWarnings: [{ type: String }],

    status: { type: String, enum: ['draft', 'active', 'deprecated'], default: 'draft' },

    // Denormalised pointer to the newest run so lists can filter without a
    // second query per document.
    lastRun: {
        runId: { type: mongoose.Schema.Types.ObjectId, ref: 'AsyncApiTestRun', default: null },
        result: { type: String, enum: ['passed', 'failed', 'error', null], default: null },
        ranAt: { type: Date, default: null }
    },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

asyncApiDocumentSchema.index({ workspaceId: 1, updatedAt: -1 });

asyncApiDocumentSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('AsyncApiDocument', asyncApiDocumentSchema);
