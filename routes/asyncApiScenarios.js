// routes/asyncApiScenarios.js
// AsyncAPI scenarios CRUD + run endpoints. Mounted at /asyncapi/scenarios.
// Access control inherited from the parent AsyncApiDocument's workspace.
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { ensureAuthenticated } = require('../middleware/auth');

const AsyncApiScenario = require('../models/AsyncApiScenario');
const AsyncApiTestRun = require('../models/AsyncApiTestRun');
const AsyncApiDocument = require('../models/AsyncApiDocument');
const Environment = require('../models/Environment');

const { runAsyncApiTest, withResolvedVariables } = require('../services/AsyncApiTestRunner');
const { deriveSchemaFromExample } = require('../services/AsyncApiValidator');

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

async function loadDocument(req, id) {
    const oid = toObjectId(id);
    if (!oid) return null;
    const doc = await AsyncApiDocument.findById(oid);
    if (!doc) return null;
    const Workspace = require('../models/Workspace');
    const woid = toObjectId(doc.workspaceId);
    const ids = userIds(req);
    const ws = await Workspace.findOne({
        _id: woid,
        $or: [{ owner: { $in: ids } }, { userId: { $in: ids } }, { 'collaborators.userId': { $in: ids } }]
    }).select('_id');
    return ws ? doc : null;
}

async function loadScenario(req, scenarioId) {
    const oid = toObjectId(scenarioId);
    if (!oid) return null;
    const s = await AsyncApiScenario.findById(oid);
    if (!s) return null;
    const doc = await loadDocument(req, s.documentId);
    if (!doc) return null;
    return s;
}

function sanitizeScenarioPayload(body = {}) {
    const { name, description, channelName, operation, messageName, payload, headers,
        expectedSchemaValidation, expectedFields, timeoutMs, environmentId } = body;
    const p = {};
    if (name !== undefined) p.name = String(name).trim();
    if (description !== undefined) p.description = String(description);
    if (channelName !== undefined) p.channelName = String(channelName);
    if (operation !== undefined && ['publish', 'subscribe'].includes(operation)) p.operation = operation;
    if (messageName !== undefined) p.messageName = String(messageName);
    if (payload !== undefined) p.payload = typeof payload === 'string' ? payload : JSON.stringify(payload);
    if (Array.isArray(headers)) p.headers = headers.map((h) => ({ key: String(h.key || ''), value: String(h.value || '') }));
    if (expectedSchemaValidation !== undefined) p.expectedSchemaValidation = Boolean(expectedSchemaValidation);
    if (Array.isArray(expectedFields)) p.expectedFields = expectedFields;
    if (timeoutMs !== undefined) p.timeoutMs = Number(timeoutMs) || 5000;
    if (environmentId !== undefined) p.environmentId = environmentId ? toObjectId(environmentId) : null;
    return p;
}

// --------------------------------------------------------------------- list

router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const doc = await loadDocument(req, req.query.documentId);
        if (!doc) return res.status(404).json({ message: 'Document not found' });
        const scenarios = await AsyncApiScenario.find({ documentId: doc._id }).sort({ updatedAt: -1 }).lean();
        res.json({ scenarios });
    } catch (err) {
        console.error('Error listing AsyncAPI scenarios:', err);
        res.status(500).json({ message: 'Error listing AsyncAPI scenarios' });
    }
});

router.post('/', ensureAuthenticated, async (req, res) => {
    try {
        const doc = await loadDocument(req, req.body.documentId);
        if (!doc) return res.status(404).json({ message: 'Document not found' });
        const payload = sanitizeScenarioPayload(req.body);
        if (!payload.name) return res.status(400).json({ message: 'Scenario name is required' });
        if (!payload.channelName) return res.status(400).json({ message: 'A channelName is required' });
        const scenario = await AsyncApiScenario.create({
            ...payload,
            documentId: doc._id,
            workspaceId: doc.workspaceId,
            owner: toObjectId(req.user.id) || req.user.id
        });
        res.status(201).json(scenario);
    } catch (err) {
        console.error('Error creating AsyncAPI scenario:', err);
        res.status(400).json({ message: err.message });
    }
});

router.get('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const s = await loadScenario(req, req.params.id);
        if (!s) return res.status(404).json({ message: 'Scenario not found' });
        res.json(s);
    } catch (err) {
        console.error('Error loading AsyncAPI scenario:', err);
        res.status(500).json({ message: 'Error loading AsyncAPI scenario' });
    }
});

router.put('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const s = await loadScenario(req, req.params.id);
        if (!s) return res.status(404).json({ message: 'Scenario not found' });
        const payload = sanitizeScenarioPayload(req.body);
        Object.assign(s, payload);
        await s.save();
        res.json(s);
    } catch (err) {
        console.error('Error updating AsyncAPI scenario:', err);
        res.status(400).json({ message: err.message });
    }
});

router.delete('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const s = await loadScenario(req, req.params.id);
        if (!s) return res.status(404).json({ message: 'Scenario not found' });
        await AsyncApiTestRun.deleteMany({ scenarioId: s._id });
        await AsyncApiScenario.deleteOne({ _id: s._id });
        res.json({ message: 'Scenario deleted' });
    } catch (err) {
        console.error('Error deleting AsyncAPI scenario:', err);
        res.status(500).json({ message: 'Error deleting AsyncAPI scenario' });
    }
});

// ----------------------------------------------------- generate from example
// Mirrors POST /consumer-contracts/interactions/from-request: returns a draft
// scenario seeded from a channel's message example, without persisting.
router.post('/from-example', ensureAuthenticated, async (req, res) => {
    try {
        const doc = await loadDocument(req, req.body.documentId);
        if (!doc) return res.status(404).json({ message: 'Document not found' });
        const channelName = String(req.body.channelName || '');
        const channel = (doc.channels || []).find((c) => c.name === channelName || c.address === channelName);
        if (!channel) return res.status(404).json({ message: 'Channel not found' });
        const op = (doc.operations || []).find((o) => o.channelName === channel.name) || null;
        const messageName = String(req.body.messageName || op?.messageName || '');
        const message = (doc.messages || []).find((m) => m.name === messageName) || null;

        // Derive field expectations from the payload example (mirrors deriveExpectedFields).
        const exampleJson = message?.payloadExample || '';
        let expectedFields = [];
        if (exampleJson) {
            try {
                const parsed = JSON.parse(exampleJson);
                expectedFields = flattenSchema(parsed);
            } catch { /* empty */ }
        }

        res.json({
            scenario: {
                name: `Test ${channel.name}`,
                description: `Generated from ${message?.name || 'message'} on ${channel.name}`,
                documentId: String(doc._id),
                channelName: channel.name,
                operation: op?.action || 'publish',
                messageName: message?.name || '',
                payload: exampleJson,
                headers: [],
                expectedSchemaValidation: Boolean(message?.payloadSchema && Object.keys(message.payloadSchema).length),
                expectedFields,
                timeoutMs: 5000,
                environmentId: null
            },
            seededFromMessage: Boolean(message)
        });
    } catch (err) {
        console.error('Error generating AsyncAPI scenario from example:', err);
        res.status(500).json({ message: 'Error generating AsyncAPI scenario from example' });
    }
});

// Flatten a JSON example into fieldExpectationSchema entries (path/type only).
// Mirrors ConsumerContractVerifier.deriveExpectedFields's walk pattern, but
// kept local here to avoid coupling to the verifier module's exports.
function flattenSchema(json, prefix = '', out = [], max = 200) {
    if (out.length >= max) return out;
    if (Array.isArray(json)) {
        out.push({ path: prefix || '(root)', required: true, type: 'array', matchValue: false, expectedValue: '' });
        if (json.length > 0) flattenSchema(json[0], `${prefix}[0]`, out, max);
        return out;
    }
    if (json !== null && typeof json === 'object') {
        if (prefix) out.push({ path: prefix, required: true, type: 'object', matchValue: false, expectedValue: '' });
        for (const [k, v] of Object.entries(json)) {
            const path = prefix ? `${prefix}.${k}` : k;
            const t = v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
            if (t === 'object' || t === 'array') {
                flattenSchema(v, path, out, max);
            } else {
                out.push({ path, required: true, type: t, matchValue: false, expectedValue: '' });
            }
        }
        return out;
    }
    return out;
}

// ------------------------------------------------------------------------- run

router.post('/:id/run', ensureAuthenticated, async (req, res) => {
    try {
        const s = await loadScenario(req, req.params.id);
        if (!s) return res.status(404).json({ message: 'Scenario not found' });
        const doc = await AsyncApiDocument.findById(s.documentId).lean();
        const server = (doc.servers || [])[Number(req.body?.serverIndex) || 0] || (doc.servers || [])[0];
        if (!server) return res.status(400).json({ message: 'No server is configured on this document' });
        const channel = (doc.channels || []).find((c) => c.name === s.channelName || c.address === s.channelName) || (doc.channels || [])[0];
        const operation = (doc.operations || []).find((o) => o.channelName === channel?.name && o.action === s.operation)
            || (doc.operations || []).find((o) => o.channelName === channel?.name) || null;
        const message = (doc.messages || []).find((m) => m.name === s.messageName) || (doc.messages || [])[0] || null;

        let environmentId = req.body?.environmentId ? toObjectId(req.body.environmentId) : s.environmentId;
        let environmentName = 'No environment';
        if (environmentId) {
            const env = await Environment.findOne({ _id: environmentId, userId: { $in: userIds(req) } }).select('name');
            if (!env) return res.status(403).json({ message: 'You do not have access to this environment' });
            environmentName = env.name;
        }

        const { url, headersObj, payload: payloadResolved } = await withResolvedVariables({
            userId: req.user.id,
            workspaceId: s.workspaceId,
            environmentId,
            requestLocalVariables: {}
        }, (resolve) => {
            const headersObj = {};
            for (const h of (s.headers || [])) headersObj[h.key || ''] = resolve(String(h.value || ''));
            return { url: resolve(String(server.url || '')), headersObj, payload: resolve(String(s.payload || '')) };
        });

        const result = await runAsyncApiTest({
            document: doc,
            server: { ...server, url },
            channel,
            operation,
            message,
            payload: payloadResolved,
            headers: headersObj,
            timeoutMs: Number(s.timeoutMs) || 5000,
            expectedSchemaValidation: s.expectedSchemaValidation,
            expectedFields: s.expectedFields || []
        });

        const run = await AsyncApiTestRun.create({
            scenarioId: s._id,
            documentId: s.documentId,
            workspaceId: s.workspaceId,
            owner: toObjectId(req.user.id) || req.user.id,
            environmentId: environmentId || null,
            environmentName,
            protocol: result.protocol,
            channel: result.channel,
            operation: result.operation,
            status: result.status,
            durationMs: result.durationMs,
            requestPayload: result.requestPayload,
            responsePayload: result.responsePayload,
            violations: result.violations || [],
            error: result.error
        });

        await AsyncApiDocument.updateOne(
            { _id: s.documentId },
            { $set: { lastRun: { runId: run._id, result: run.status, ranAt: run.createdAt } } }
        ).exec();
        // Atomic lastRun bump on the scenario too.
        await AsyncApiScenario.updateOne(
            { _id: s._id },
            { $set: { lastRun: { runId: run._id, result: run.status, ranAt: run.createdAt } } }
        ).exec();

        res.status(201).json(run);
    } catch (err) {
        console.error('Error running AsyncAPI scenario:', err);
        res.status(500).json({ message: err.message || 'Error running AsyncAPI scenario' });
    }
});

// ------------------------------------------------------- scenario run history

router.get('/:id/runs', ensureAuthenticated, async (req, res) => {
    try {
        const s = await loadScenario(req, req.params.id);
        if (!s) return res.status(404).json({ message: 'Scenario not found' });
        const limit = Math.min(Number(req.query.limit) || 20, 100);
        const runs = await AsyncApiTestRun.find({ scenarioId: s._id })
            .sort({ createdAt: -1 }).limit(limit)
            .select('-requestPayload -responsePayload')
            .lean();
        res.json({ runs });
    } catch (err) {
        console.error('Error listing AsyncAPI scenario runs:', err);
        res.status(500).json({ message: 'Error listing AsyncAPI scenario runs' });
    }
});

router.get('/runs/:runId', ensureAuthenticated, async (req, res) => {
    try {
        const runId = toObjectId(req.params.runId);
        if (!runId) return res.status(404).json({ message: 'Run not found' });
        const run = await AsyncApiTestRun.findById(runId).lean();
        if (!run) return res.status(404).json({ message: 'Run not found' });
        const s = run.scenarioId ? await AsyncApiScenario.findById(run.scenarioId).select('documentId') : null;
        const docId = s ? s.documentId : run.documentId;
        const doc = await loadDocument(req, docId);
        if (!doc) return res.status(404).json({ message: 'Run not found' });
        res.json(run);
    } catch (err) {
        console.error('Error loading AsyncAPI scenario run:', err);
        res.status(500).json({ message: 'Error loading AsyncAPI scenario run' });
    }
});

// Light derive endpoint so the editor can fill expectedFields from a pasted body.
router.post('/derive-fields', ensureAuthenticated, (req, res) => {
    try {
        const body = req.body?.body || '';
        if (!body || (typeof body === 'string' && !body.trim())) return res.json({ fields: [] });
        let parsed = body;
        if (typeof body === 'string') {
            try { parsed = JSON.parse(body); } catch { return res.json({ fields: [] }); }
        }
        res.json({ fields: flattenSchema(parsed), schema: deriveSchemaFromExample(parsed) });
    } catch (err) {
        res.status(400).json({ message: 'Could not derive fields from that body' });
    }
});

module.exports = router;
