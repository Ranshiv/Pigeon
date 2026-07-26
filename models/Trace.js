// models/Trace.js
// An imported OpenTelemetry trace, already normalised and redacted by
// services/OtlpTraceNormalizer.js. Traces are diagnostic data, so they expire.
const mongoose = require('mongoose');

const headerSchema = new mongoose.Schema({
    key: { type: String, default: '' },
    value: { type: String, default: '' },
    // True when the value was redacted — the UI shows a lock instead of text.
    sensitive: { type: Boolean, default: false }
}, { _id: false });

const spanSchema = new mongoose.Schema({
    spanId: { type: String, required: true },
    parentSpanId: { type: String, default: null },
    name: { type: String, default: '' },
    kind: { type: String, enum: ['internal', 'server', 'client', 'producer', 'consumer'], default: 'internal' },
    serviceName: { type: String, default: 'unknown-service' },
    scopeName: { type: String, default: '' },

    httpMethod: { type: String, default: null },
    url: { type: String, default: '' },
    route: { type: String, default: null },
    httpStatusCode: { type: Number, default: null },

    startTime: { type: Date, default: null },
    durationMs: { type: Number, default: null },

    status: { type: String, enum: ['ok', 'error', 'unset'], default: 'unset' },
    statusMessage: { type: String, default: '' },

    requestHeaders: [headerSchema],
    responseHeaders: [headerSchema],
    requestBody: { type: String, default: '' },
    responseBody: { type: String, default: '' },

    environment: { type: String, default: null },
    deploymentVersion: { type: String, default: null },

    attributes: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { _id: false });

const traceSchema = new mongoose.Schema({
    traceId: { type: String, required: true },

    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Where the trace came from.
    source: { type: String, enum: ['manual', 'upload', 'collector'], default: 'manual' },
    sourceLabel: { type: String, default: '' },

    // Trace-level roll-up so the list view can filter without touching spans.
    rootServiceName: { type: String, default: 'unknown-service' },
    rootSpanName: { type: String, default: '' },
    route: { type: String, default: '' },
    httpMethod: { type: String, default: null },
    httpStatusCode: { type: Number, default: null },
    environment: { type: String, default: null },
    deploymentVersion: { type: String, default: null },
    services: [{ type: String }],

    startTime: { type: Date, default: null },
    durationMs: { type: Number, default: null },

    hasError: { type: Boolean, default: false },
    errorCount: { type: Number, default: 0 },
    errorMessage: { type: String, default: '' },

    spanCount: { type: Number, default: 0 },
    // Spans dropped by the per-trace ceiling, surfaced so nothing is silently lost.
    truncatedSpans: { type: Number, default: 0 },
    spans: [spanSchema],

    // Requests generated from this trace, for the "open source trace" link.
    generated: [{
        requestId: { type: String, default: '' },
        collectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Collection', default: null },
        spanId: { type: String, default: '' },
        kind: { type: String, enum: ['request', 'test'], default: 'request' },
        createdAt: { type: Date, default: Date.now }
    }],

    createdAt: { type: Date, default: Date.now }
});

traceSchema.index({ workspaceId: 1, startTime: -1 });
traceSchema.index({ workspaceId: 1, traceId: 1 }, { unique: true });
// Traces are short-lived diagnostic data, matching ActivityLog's 30-day window.
traceSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('Trace', traceSchema);
