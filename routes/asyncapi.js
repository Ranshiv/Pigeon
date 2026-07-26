// routes/asyncapi.js
// AsyncAPI document CRUD, import/export, and ad-hoc test execution.
// Access control: workspace owner/collaborator only — helper pattern copied
// verbatim from routes/consumerContracts.js. Scenario CRUD + run history lives
// in ./asyncApiScenarios and is mounted at /asyncapi/scenarios.
const path = require('path');
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const { ensureAuthenticated } = require('../middleware/auth');

const AsyncApiDocument = require('../models/AsyncApiDocument');
const AsyncApiTestRun = require('../models/AsyncApiTestRun');
const AsyncApiScenario = require('../models/AsyncApiScenario');
const Workspace = require('../models/Workspace');
const Environment = require('../models/Environment');
const ActivityLog = require('../models/ActivityLog');
const { normalizeAsyncApiDocument, denormalizeToAsyncApiJson, LIMITS } = require('../services/AsyncApiValidator');
const { runAsyncApiTest, withResolvedVariables } = require('../services/AsyncApiTestRunner');

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { files: 1, fileSize: MAX_UPLOAD_BYTES },
    fileFilter: (req, file, callback) => {
        const extension = path.extname(file.originalname || '').toLowerCase();
        if (extension !== '.json') {
            return callback(new Error('Only .json AsyncAPI documents can be imported.'));
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

async function loadAccessibleDocument(req, documentId) {
    const oid = toObjectId(documentId);
    if (!oid) return null;
    const doc = await AsyncApiDocument.findById(oid);
    if (!doc) return null;
    if (!(await canAccessWorkspace(req, doc.workspaceId))) return null;
    return doc;
}

// Reused by the granular per-entity router (routes/asyncApiEntities.js).
// Attached to `router` and assigned to module.exports early so the sub-router
// can require them back without tripping a circular-require partial-export.
router.helpers = { toObjectId, userIds, canAccessWorkspace, loadAccessibleDocument };
module.exports = router;

function logActivity(req, workspaceId, payload) {
    ActivityLog.create({
        workspaceId: String(workspaceId || 'default'),
        user: req.user.id,
        ...payload
    }).catch((err) => console.error('Failed to record asyncapi activity:', err.message));
}

/**
 * Reject payload fields the client must never set directly. lastRun is derived
 * from runs; owner is taken from the session; rawImport is set by the import
 * path only. Follows sanitizeContractPayload() from consumerContracts.js.
 */
function sanitizeDocumentPayload(body = {}) {
    const {
        name, description, version, asyncApiVersion,
        servers, channels, messages, operations, tags, status
    } = body;
    const payload = {};
    if (name !== undefined) payload.name = String(name).trim();
    if (description !== undefined) payload.description = String(description);
    if (version !== undefined) payload.version = String(version).trim() || '1.0.0';
    if (asyncApiVersion !== undefined) payload.asyncApiVersion = String(asyncApiVersion).trim();
    if (Array.isArray(servers)) payload.servers = servers;
    if (Array.isArray(channels)) payload.channels = channels;
    if (Array.isArray(messages)) payload.messages = messages;
    if (Array.isArray(operations)) payload.operations = operations;
    if (Array.isArray(tags)) payload.tags = tags.map(String);
    if (status && ['draft', 'active', 'deprecated'].includes(status)) payload.status = status;
    return payload;
}

// ---------------------------------------------------------------- list/create

router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const { workspaceId } = req.query;
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });
        if (!(await canAccessWorkspace(req, workspaceId))) {
            return res.status(403).json({ message: 'You do not have access to this workspace' });
        }
        const query = { workspaceId: toObjectId(workspaceId) };
        if (req.query.protocol && req.query.protocol !== 'all') query['servers.protocol'] = req.query.protocol;
        if (req.query.status && req.query.status !== 'all') query.status = req.query.status;
        if (req.query.tag && req.query.tag !== 'all') query.tags = req.query.tag;

        const docs = await AsyncApiDocument.find(query).sort({ updatedAt: -1 }).lean();
        res.json({ documents: docs });
    } catch (err) {
        console.error('Error listing AsyncAPI documents:', err);
        res.status(500).json({ message: 'Error listing AsyncAPI documents' });
    }
});

router.post('/', ensureAuthenticated, async (req, res) => {
    try {
        const workspaceId = toObjectId(req.body.workspaceId);
        if (!workspaceId) return res.status(400).json({ message: 'A valid workspaceId is required' });
        if (!(await canAccessWorkspace(req, workspaceId))) {
            return res.status(403).json({ message: 'You do not have access to this workspace' });
        }
        const payload = sanitizeDocumentPayload(req.body);
        if (!payload.name) return res.status(400).json({ message: 'Document name is required' });
        const doc = new AsyncApiDocument({
            ...payload,
            workspaceId,
            owner: toObjectId(req.user.id) || req.user.id
        });
        await doc.save();
        logActivity(req, workspaceId, {
            actionType: 'create', resourceType: 'asyncapi-document',
            resourceId: String(doc._id), resourceName: doc.name
        });
        res.status(201).json(doc);
    } catch (err) {
        console.error('Error creating AsyncAPI document:', err);
        res.status(400).json({ message: err.message });
    }
});

// Scenario routes must be mounted before the generic `/:id` document route;
// otherwise GET /scenarios is interpreted as a request for a document whose
// id is literally "scenarios".
router.use('/scenarios', require('./asyncApiScenarios'));

// -------------------------------------------------------- get/update/delete

router.get('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const doc = await loadAccessibleDocument(req, req.params.id);
        if (!doc) return res.status(404).json({ message: 'Document not found' });
        res.json(doc);
    } catch (err) {
        console.error('Error loading AsyncAPI document:', err);
        res.status(500).json({ message: 'Error loading AsyncAPI document' });
    }
});

router.put('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const doc = await loadAccessibleDocument(req, req.params.id);
        if (!doc) return res.status(404).json({ message: 'Document not found' });
        // ponytail: whole-document PUT is still the bulk path (bulk import /
        // reorder of servers/channels/messages/operations). Per-entity granular
        // endpoints live in routes/asyncApiEntities.js (POST/PUT/DELETE
        // /:id/channels|messages|operations) — prefer those for concurrent
        // multi-field edits from the designer's per-item modals; they use atomic
        // updateOne so they never trip full-document validation races.
        const payload = sanitizeDocumentPayload(req.body);
        Object.assign(doc, payload);
        await doc.save();
        res.json(doc);
    } catch (err) {
        console.error('Error updating AsyncAPI document:', err);
        res.status(400).json({ message: err.message });
    }
});

router.delete('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const doc = await loadAccessibleDocument(req, req.params.id);
        if (!doc) return res.status(404).json({ message: 'Document not found' });
        const workspaceId = String(doc.workspaceId);
        await AsyncApiTestRun.deleteMany({ documentId: doc._id });
        await AsyncApiScenario.deleteMany({ documentId: doc._id });
        await AsyncApiDocument.deleteOne({ _id: doc._id });
        logActivity(req, workspaceId, {
            actionType: 'delete', resourceType: 'asyncapi-document',
            resourceId: String(doc._id), resourceName: doc.name
        });
        res.json({ message: 'Document deleted' });
    } catch (err) {
        console.error('Error deleting AsyncAPI document:', err);
        res.status(500).json({ message: 'Error deleting AsyncAPI document' });
    }
});

router.post('/:id/duplicate', ensureAuthenticated, async (req, res) => {
    try {
        const doc = await loadAccessibleDocument(req, req.params.id);
        if (!doc) return res.status(404).json({ message: 'Document not found' });
        const copy = doc.toObject();
        delete copy._id;
        delete copy.createdAt;
        delete copy.updatedAt;
        delete copy.lastRun;
        copy.name = `${copy.name} (copy)`;
        copy.workspaceId = req.body.workspaceId ? toObjectId(req.body.workspaceId) : doc.workspaceId;
        if (!(await canAccessWorkspace(req, copy.workspaceId))) {
            return res.status(403).json({ message: 'You do not have access to the target workspace' });
        }
        copy.owner = toObjectId(req.user.id) || req.user.id;
        const dup = await AsyncApiDocument.create(copy);
        res.status(201).json(dup);
    } catch (err) {
        console.error('Error duplicating AsyncAPI document:', err);
        res.status(400).json({ message: err.message });
    }
});

// ----------------------------------------------------------------- import

router.post(
    '/import',
    ensureAuthenticated,
    (req, res, next) => {
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
            let name = req.body.name ? String(req.body.name).trim() : '';
            if (req.file) {
                try { payload = JSON.parse(req.file.buffer.toString('utf8')); }
                catch (e) { return res.status(400).json({ message: `Uploaded file is not valid JSON: ${e.message}` }); }
            } else if (req.body.payload !== undefined) {
                payload = req.body.payload;
                if (typeof payload === 'string') {
                    try { payload = JSON.parse(payload); }
                    catch (e) { return res.status(400).json({ message: `Could not parse AsyncAPI JSON: ${e.message}` }); }
                }
            } else {
                return res.status(400).json({ message: 'Provide AsyncAPI JSON, upload a file, or use the editor' });
            }

            let normalized;
            try { normalized = normalizeAsyncApiDocument(payload); }
            catch (e) { return res.status(400).json({ message: e.message }); }

            if (name) normalized.name = name;
            const doc = await AsyncApiDocument.create({
                ...normalized,
                workspaceId,
                owner: toObjectId(req.user.id) || req.user.id
            });
            logActivity(req, workspaceId, {
                actionType: 'create', resourceType: 'asyncapi-document',
                resourceId: String(doc._id), resourceName: doc.name,
                details: { importWarnings: (normalized.importWarnings || []).length }
            });
            res.status(201).json({ document: doc, warnings: normalized.importWarnings });
        } catch (err) {
            console.error('Error importing AsyncAPI document:', err);
            res.status(500).json({ message: 'Error importing AsyncAPI document' });
        }
    }
);

// ----------------------------------------------------------------- export

router.get('/:id/export', ensureAuthenticated, async (req, res) => {
    try {
        const doc = await loadAccessibleDocument(req, req.params.id);
        if (!doc) return res.status(404).json({ message: 'Document not found' });
        const json = denormalizeToAsyncApiJson(doc);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.name)}.asyncapi.json"`);
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(json, null, 2));
    } catch (err) {
        console.error('Error exporting AsyncAPI document:', err);
        res.status(500).json({ message: 'Error exporting AsyncAPI document' });
    }
});

// ----------------------------------------------------------------- test run

router.post('/:id/test', ensureAuthenticated, async (req, res) => {
    try {
        const doc = await loadAccessibleDocument(req, req.params.id);
        if (!doc) return res.status(404).json({ message: 'Document not found' });

        const serverIndex = Number(req.body?.serverIndex || 0);
        const server = (doc.servers || [])[serverIndex] || (doc.servers || [])[0];
        if (!server) return res.status(400).json({ message: 'No server is configured on this document' });

        const channelName = req.body?.channelName ? String(req.body.channelName) : '';
        const channel = (doc.channels || []).find((c) => c.name === channelName || c.address === channelName) || (doc.channels || [])[0];
        if (!channel) return res.status(400).json({ message: 'No channel is configured on this document' });

        const operationName = req.body?.operation ? String(req.body.operation) : '';
        const operation = (doc.operations || []).find((o) => o.channelName === channel.name && o.action === operationName)
            || (doc.operations || []).find((o) => o.channelName === channel.name) || (doc.operations || [])[0];

        const messageName = req.body?.messageName ? String(req.body.messageName) : (operation?.messageName || '');
        const message = (doc.messages || []).find((m) => m.name === messageName) || (doc.messages || [])[0];

        const payloadInput = req.body?.payload || message?.payloadExample || '';
        const headers = req.body?.headers || {};

        let environmentId = req.body?.environmentId ? toObjectId(req.body.environmentId) : null;
        let environmentName = 'No environment';
        if (environmentId) {
            const env = await Environment.findOne({ _id: environmentId, userId: { $in: userIds(req) } }).select('name');
            if (!env) return res.status(403).json({ message: 'You do not have access to this environment' });
            environmentName = env.name;
        }

        const { url, payload: payloadResolved } = await withResolvedVariables({
            userId: req.user.id,
            workspaceId: doc.workspaceId,
            environmentId,
            requestLocalVariables: (req.body?.variables && typeof req.body.variables === 'object') ? req.body.variables : {}
        }, (resolve) => ({
            url: resolve(server.url || ''),
            payload: resolve(payloadInput || '')
        }));

        // Avoid full-document .save() on the parent; build a run with a targeted
        // updateOne for lastRun. Mirrors routes/traces.js atomic-update pattern.
        const result = await runAsyncApiTest({
            document: doc,
            server: { ...server.toObject ? server.toObject() : server, url },
            channel,
            operation,
            message,
            payload: payloadResolved,
            headers,
            timeoutMs: Number(req.body?.timeoutMs) || 5000,
            expectedSchemaValidation: req.body?.expectedSchemaValidation !== false,
            expectedFields: []
        });

        const run = await AsyncApiTestRun.create({
            documentId: doc._id,
            workspaceId: doc.workspaceId,
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
            { _id: doc._id },
            { $set: { lastRun: { runId: run._id, result: run.status, ranAt: run.createdAt } } }
        );

        res.status(201).json(run);
    } catch (err) {
        console.error('Error running AsyncAPI test:', err);
        res.status(500).json({ message: err.message || 'Error running AsyncAPI test' });
    }
});

// --------------------------------------------------------------- run history

router.get('/:id/runs', ensureAuthenticated, async (req, res) => {
    try {
        const doc = await loadAccessibleDocument(req, req.params.id);
        if (!doc) return res.status(404).json({ message: 'Document not found' });
        const limit = Math.min(Number(req.query.limit) || 20, 100);
        const runs = await AsyncApiTestRun.find({ documentId: doc._id })
            .sort({ createdAt: -1 })
            .limit(limit)
            // Keep the list light — payloads are large; mirror .select('-results').
            .select('-requestPayload -responsePayload')
            .lean();
        res.json({ runs });
    } catch (err) {
        console.error('Error listing AsyncAPI runs:', err);
        res.status(500).json({ message: 'Error listing AsyncAPI runs' });
    }
});

router.get('/runs/:runId', ensureAuthenticated, async (req, res) => {
    try {
        const runId = toObjectId(req.params.runId);
        if (!runId) return res.status(404).json({ message: 'Run not found' });
        const run = await AsyncApiTestRun.findById(runId).lean();
        if (!run) return res.status(404).json({ message: 'Run not found' });
        const doc = await loadAccessibleDocument(req, run.documentId);
        if (!doc) return res.status(404).json({ message: 'Run not found' });
        res.json(run);
    } catch (err) {
        console.error('Error loading AsyncAPI run:', err);
        res.status(500).json({ message: 'Error loading AsyncAPI run' });
    }
});

// ------------------------------------------- granular per-entity CRUD router
// Mounted at the root so the sub-router declares /:id/channels|messages|
// operations paths itself (simpler than a /:id param mount and avoids any
// shadowing ambiguity with /:id/test, /:id/export etc.).
router.use('/', require('./asyncApiEntities'));

// ------------------------------------------------------------ upload errors

router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        const message = error.code === 'LIMIT_FILE_SIZE'
            ? 'That AsyncAPI document is larger than the 5 MB import limit'
            : `Upload failed: ${error.message}`;
        return res.status(400).json({ message });
    }
    if (error && /\.json/i.test(error.message || '')) {
        return res.status(400).json({ message: error.message });
    }
    return next(error);
});
