// routes/traces.js
// OpenTelemetry Trace-to-Test: import traces, browse them, and turn an
// observed HTTP span into a Pigeon request or regression test.
//
// Access control: a user may touch a trace only if they can access the owning
// workspace, and may only write into a collection they can access.
const path = require('path');
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const { ensureAuthenticated } = require('../middleware/auth');

const Trace = require('../models/Trace');
const Collection = require('../models/Collection');
const Workspace = require('../models/Workspace');
const Environment = require('../models/Environment');
const ActivityLog = require('../models/ActivityLog');
const { normalizeOtlpPayload, LIMITS } = require('../services/OtlpTraceNormalizer');
const {
    buildRequestFromSpan,
    buildAssertionsFromSpan,
    buildTestScript
} = require('../services/TraceRequestGenerator');

const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const COLLECTOR_TIMEOUT_MS = 15000;

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { files: 1, fileSize: MAX_UPLOAD_BYTES },
    fileFilter: (req, file, callback) => {
        const extension = path.extname(file.originalname || '').toLowerCase();
        if (extension !== '.json') {
            return callback(new Error('Only .json OTLP trace exports can be imported.'));
        }
        return callback(null, true);
    }
});

function toObjectId(value) {
    if (!value) return null;
    if (value instanceof mongoose.Types.ObjectId) return value;
    return mongoose.Types.ObjectId.isValid(String(value))
        ? new mongoose.Types.ObjectId(String(value))
        : null;
}

function userIds(req) {
    const id = req.user.id;
    const oid = toObjectId(id);
    return oid ? [id, oid] : [id];
}

async function canAccessWorkspace(req, workspaceId) {
    const oid = toObjectId(workspaceId);
    if (!oid) return false;
    const ids = userIds(req);
    const workspace = await Workspace.findOne({
        _id: oid,
        $or: [{ owner: { $in: ids } }, { userId: { $in: ids } }, { 'collaborators.userId': { $in: ids } }]
    }).select('_id');
    return Boolean(workspace);
}

async function loadAccessibleCollection(req, collectionId) {
    const oid = toObjectId(collectionId);
    if (!oid) return null;
    const ids = userIds(req);
    return Collection.findOne({
        _id: oid,
        $or: [{ owner: { $in: ids } }, { userId: { $in: ids } }, { 'collaborators.userId': { $in: ids } }]
    });
}

/** Load a trace the caller is allowed to see, or null. */
async function loadAccessibleTrace(req, traceId) {
    const oid = toObjectId(req.query.workspaceId);
    const query = { traceId: String(traceId) };
    if (oid) query.workspaceId = oid;

    const trace = await Trace.findOne(query).sort({ createdAt: -1 });
    if (!trace) return null;
    if (!(await canAccessWorkspace(req, trace.workspaceId))) return null;
    return trace;
}

function logActivity(req, workspaceId, payload) {
    // Activity is a side-effect: never fail the caller's request over it.
    ActivityLog.create({
        workspaceId: String(workspaceId || 'default'),
        user: req.user.id,
        ...payload
    }).catch((err) => console.error('Failed to record trace activity:', err.message));
}

/** Persist normalized traces, replacing any earlier copy of the same traceId. */
async function persistTraces(traces, { workspaceId, ownerId, source, sourceLabel }) {
    const saved = [];
    for (const trace of traces) {
        const doc = await Trace.findOneAndUpdate(
            { workspaceId, traceId: trace.traceId },
            {
                $set: {
                    ...trace,
                    workspaceId,
                    owner: ownerId,
                    source,
                    sourceLabel,
                    createdAt: new Date()
                }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        saved.push(doc);
    }
    return saved;
}

// ------------------------------------------------------------------- import

/**
 * POST /api/traces/import
 * Accepts an OTLP JSON body ({ payload }), an uploaded .json file, or a
 * collector endpoint to pull from ({ collectorUrl }).
 */
router.post(
    '/import',
    ensureAuthenticated,
    (req, res, next) => {
        // Only multipart requests carry a file; JSON bodies skip multer.
        if (!String(req.headers['content-type'] || '').includes('multipart/form-data')) return next();
        upload.single('file')(req, res, (error) => (error ? next(error) : next()));
    },
    async (req, res) => {
        try {
            const workspaceId = toObjectId(req.body.workspaceId);
            if (!workspaceId) return res.status(400).json({ message: 'A valid workspaceId is required' });
            if (!(await canAccessWorkspace(req, workspaceId))) {
                return res.status(403).json({ message: 'You do not have access to this workspace' });
            }

            let payload = null;
            let source = 'manual';
            let sourceLabel = 'Pasted OTLP JSON';

            if (req.file) {
                source = 'upload';
                sourceLabel = req.file.originalname || 'Uploaded OTLP export';
                try {
                    payload = JSON.parse(req.file.buffer.toString('utf8'));
                } catch (e) {
                    return res.status(400).json({ message: `Uploaded file is not valid JSON: ${e.message}` });
                }
            } else if (req.body.collectorUrl) {
                const collectorUrl = String(req.body.collectorUrl).trim();
                if (!/^https?:\/\//i.test(collectorUrl)) {
                    return res.status(400).json({ message: 'Collector endpoint must be an http(s) URL' });
                }
                source = 'collector';
                sourceLabel = collectorUrl;

                const headers = { Accept: 'application/json' };
                // Collector credentials come from the caller and are used for
                // this fetch only — they are never stored on the trace.
                if (req.body.collectorToken) headers.Authorization = `Bearer ${String(req.body.collectorToken)}`;

                let response;
                try {
                    response = await fetch(collectorUrl, { headers, timeout: COLLECTOR_TIMEOUT_MS });
                } catch (e) {
                    return res.status(502).json({ message: `Could not reach the collector: ${e.message}` });
                }
                if (!response.ok) {
                    return res.status(502).json({ message: `Collector responded with ${response.status} ${response.statusText}` });
                }
                const text = await response.text();
                try {
                    payload = JSON.parse(text);
                } catch (e) {
                    return res.status(502).json({ message: `Collector did not return JSON: ${e.message}` });
                }
            } else if (req.body.payload !== undefined) {
                payload = req.body.payload;
                if (typeof payload === 'string') {
                    if (payload.length > MAX_UPLOAD_BYTES) {
                        return res.status(413).json({ message: 'That OTLP payload is larger than the 5 MB import limit' });
                    }
                    try {
                        payload = JSON.parse(payload);
                    } catch (e) {
                        return res.status(400).json({ message: `Could not parse that OTLP JSON: ${e.message}` });
                    }
                }
            } else {
                return res.status(400).json({ message: 'Provide OTLP JSON, upload a file, or configure a collector endpoint' });
            }

            let traces;
            try {
                traces = normalizeOtlpPayload(payload);
            } catch (e) {
                return res.status(400).json({ message: e.message });
            }

            const saved = await persistTraces(traces, {
                workspaceId,
                ownerId: toObjectId(req.user.id) || req.user.id,
                source,
                sourceLabel
            });

            logActivity(req, workspaceId, {
                actionType: 'create',
                resourceType: 'trace-import',
                resourceId: String(workspaceId),
                resourceName: `${saved.length} trace${saved.length === 1 ? '' : 's'} from ${sourceLabel}`,
                details: { source, traceIds: saved.map((t) => t.traceId).slice(0, 20) }
            });

            res.status(201).json({
                imported: saved.length,
                truncated: saved.reduce((sum, t) => sum + (t.truncatedSpans || 0), 0),
                limits: LIMITS,
                traces: saved.map((t) => ({ traceId: t.traceId, spanCount: t.spanCount, hasError: t.hasError }))
            });
        } catch (err) {
            console.error('Error importing traces:', err);
            res.status(500).json({ message: 'Error importing traces' });
        }
    }
);

// --------------------------------------------------------------------- list

router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const { workspaceId } = req.query;
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });
        if (!(await canAccessWorkspace(req, workspaceId))) {
            return res.status(403).json({ message: 'You do not have access to this workspace' });
        }

        const query = { workspaceId: toObjectId(workspaceId) };
        if (req.query.service && req.query.service !== 'all') query.services = req.query.service;
        if (req.query.environment && req.query.environment !== 'all') query.environment = req.query.environment;
        if (req.query.errorsOnly === 'true') query.hasError = true;

        const minDuration = Number(req.query.minDurationMs);
        if (Number.isFinite(minDuration) && minDuration > 0) query.durationMs = { $gte: minDuration };

        if (req.query.status && req.query.status !== 'all') {
            const status = Number(req.query.status);
            if (Number.isFinite(status)) query.httpStatusCode = status;
            // Class filters like "4xx" narrow to a status range.
            else if (/^[1-5]xx$/i.test(req.query.status)) {
                const base = Number(req.query.status[0]) * 100;
                query.httpStatusCode = { $gte: base, $lt: base + 100 };
            }
        }
        if (req.query.route) query.route = { $regex: String(req.query.route).slice(0, 200), $options: 'i' };

        const limit = Math.min(Number(req.query.limit) || 50, 200);
        const traces = await Trace.find(query)
            .sort({ startTime: -1, createdAt: -1 })
            .limit(limit)
            // Spans are large; the list only needs the roll-up.
            .select('-spans')
            .lean();

        res.json({ traces });
    } catch (err) {
        console.error('Error listing traces:', err);
        res.status(500).json({ message: 'Error listing traces' });
    }
});

router.get('/:traceId', ensureAuthenticated, async (req, res) => {
    try {
        const trace = await loadAccessibleTrace(req, req.params.traceId);
        if (!trace) return res.status(404).json({ message: 'Trace not found' });
        res.json(trace);
    } catch (err) {
        console.error('Error loading trace:', err);
        res.status(500).json({ message: 'Error loading trace' });
    }
});

router.delete('/:traceId', ensureAuthenticated, async (req, res) => {
    try {
        const trace = await loadAccessibleTrace(req, req.params.traceId);
        if (!trace) return res.status(404).json({ message: 'Trace not found' });
        await Trace.deleteOne({ _id: trace._id });
        res.json({ message: 'Trace deleted' });
    } catch (err) {
        console.error('Error deleting trace:', err);
        res.status(500).json({ message: 'Error deleting trace' });
    }
});

// ------------------------------------------------------------- generation

/** Shared setup for the two generation endpoints. */
async function resolveGenerationTargets(req, res) {
    const trace = await loadAccessibleTrace(req, req.params.traceId);
    if (!trace) {
        res.status(404).json({ message: 'Trace not found' });
        return null;
    }

    const span = (trace.spans || []).find((s) => String(s.spanId) === String(req.body.spanId));
    if (!span) {
        res.status(404).json({ message: 'That span is not part of this trace' });
        return null;
    }

    const collection = await loadAccessibleCollection(req, req.body.collectionId);
    if (!collection) {
        res.status(403).json({ message: 'You do not have access to that collection' });
        return null;
    }

    if (req.body.environmentId) {
        const env = await Environment.findOne({
            _id: toObjectId(req.body.environmentId),
            userId: { $in: userIds(req) }
        }).select('_id');
        if (!env) {
            res.status(403).json({ message: 'You do not have access to that environment' });
            return null;
        }
    }

    return { trace, span, collection };
}

// POST /api/traces/:traceId/create-request
router.post('/:traceId/create-request', ensureAuthenticated, async (req, res) => {
    try {
        const targets = await resolveGenerationTargets(req, res);
        if (!targets) return;
        const { trace, span, collection } = targets;

        let request;
        try {
            request = buildRequestFromSpan(span, trace, { name: req.body.name });
        } catch (e) {
            return res.status(400).json({ message: e.message });
        }
        if (req.body.environmentId) request.metadata.environmentId = String(req.body.environmentId);
        if (Array.isArray(req.body.folderPath)) request.folderPath = req.body.folderPath.map(String);

        // Some older collections contain temporary `req-*` request IDs that
        // cannot be cast by the current ObjectId schema. An atomic push
        // validates only the new request instead of re-validating every legacy
        // array entry and makes this endpoint safe for those collections.
        request._id = new mongoose.Types.ObjectId();
        await Collection.updateOne(
            { _id: collection._id },
            { $push: { requests: request } },
            { runValidators: true }
        );
        const created = request;

        trace.generated.push({
            requestId: String(created._id),
            collectionId: collection._id,
            spanId: span.spanId,
            kind: 'request'
        });
        await trace.save();

        logActivity(req, trace.workspaceId, {
            actionType: 'create',
            resourceType: 'request',
            resourceId: String(created._id),
            resourceName: `${created.method} ${created.name}`,
            details: { fromTraceId: trace.traceId, spanId: span.spanId, collectionId: String(collection._id) }
        });

        res.status(201).json({ request: created, collectionId: String(collection._id) });
    } catch (err) {
        console.error('Error creating request from trace:', err);
        res.status(500).json({ message: 'Error creating request from trace' });
    }
});

/**
 * POST /api/traces/:traceId/create-test
 * With `preview: true` returns the assertions and script for review without
 * writing anything.
 */
router.post('/:traceId/create-test', ensureAuthenticated, async (req, res) => {
    try {
        // Preview needs the span only — no collection write, so no collection check.
        if (req.body.preview) {
            const trace = await loadAccessibleTrace(req, req.params.traceId);
            if (!trace) return res.status(404).json({ message: 'Trace not found' });
            const span = (trace.spans || []).find((s) => String(s.spanId) === String(req.body.spanId));
            if (!span) return res.status(404).json({ message: 'That span is not part of this trace' });

            const assertions = buildAssertionsFromSpan(span, req.body.options || {});
            return res.json({
                assertions,
                testScript: buildTestScript(assertions, { traceId: trace.traceId, spanId: span.spanId })
            });
        }

        const targets = await resolveGenerationTargets(req, res);
        if (!targets) return;
        const { trace, span, collection } = targets;

        const assertions = buildAssertionsFromSpan(span, req.body.options || {});
        const testScript = buildTestScript(assertions, { traceId: trace.traceId, spanId: span.spanId });

        // Attach to an existing request when given one, otherwise generate it.
        const targetIndex = req.body.requestId
            ? collection.requests.findIndex((r) => String(r._id) === String(req.body.requestId))
            : -1;
        let target = targetIndex >= 0 ? collection.requests[targetIndex] : null;

        if (req.body.requestId && !target) {
            return res.status(404).json({ message: 'That request is not in this collection' });
        }

        if (!target) {
            let generated;
            try {
                generated = buildRequestFromSpan(span, trace, { name: req.body.name });
            } catch (e) {
                return res.status(400).json({ message: e.message });
            }
            generated._id = new mongoose.Types.ObjectId();
            generated.testScript = testScript;
            generated.tests = testScript;
            generated.updatedAt = new Date();
            await Collection.updateOne(
                { _id: collection._id },
                { $push: { requests: generated } },
                { runValidators: true }
            );
            target = generated;
        } else {
            const updatedAt = new Date();
            await Collection.updateOne(
                { _id: collection._id },
                {
                    $set: {
                        [`requests.${targetIndex}.testScript`]: testScript,
                        [`requests.${targetIndex}.tests`]: testScript,
                        [`requests.${targetIndex}.updatedAt`]: updatedAt
                    }
                },
                { runValidators: true }
            );
            target.testScript = testScript;
            target.tests = testScript;
            target.updatedAt = updatedAt;
        }

        trace.generated.push({
            requestId: String(target._id),
            collectionId: collection._id,
            spanId: span.spanId,
            kind: 'test'
        });
        await trace.save();

        logActivity(req, trace.workspaceId, {
            actionType: 'update',
            resourceType: 'request',
            resourceId: String(target._id),
            resourceName: `Regression test for ${target.method} ${target.name}`,
            details: {
                fromTraceId: trace.traceId,
                spanId: span.spanId,
                assertionCount: assertions.length,
                collectionId: String(collection._id)
            }
        });

        res.status(201).json({
            request: target,
            collectionId: String(collection._id),
            assertions,
            testScript
        });
    } catch (err) {
        console.error('Error creating test from trace:', err);
        res.status(500).json({ message: 'Error creating test from trace' });
    }
});

// Upload errors (size/type) arrive here rather than as a generic 500.
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        const message = error.code === 'LIMIT_FILE_SIZE'
            ? 'That OTLP export is larger than the 5 MB import limit'
            : `Upload failed: ${error.message}`;
        return res.status(400).json({ message });
    }
    if (error && /\.json/i.test(error.message || '')) {
        return res.status(400).json({ message: error.message });
    }
    return next(error);
});

module.exports = router;
