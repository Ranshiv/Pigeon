// routes/consumerContracts.js
// Consumer-Driven Contract Testing: CRUD, execution and run history.
// Access control: a user may touch a contract only if they can access both the
// owning workspace and the provider collection.
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { ensureAuthenticated } = require('../middleware/auth');

const ConsumerContract = require('../models/ConsumerContract');
const ConsumerContractRun = require('../models/ConsumerContractRun');
const Collection = require('../models/Collection');
const Workspace = require('../models/Workspace');
const Environment = require('../models/Environment');
const { runContract } = require('../services/ConsumerContractRunner');
const { deriveExpectedFields } = require('../services/ConsumerContractVerifier');

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

/** Load a contract the caller is allowed to see, or null. */
async function loadAccessibleContract(req, contractId) {
    const oid = toObjectId(contractId);
    if (!oid) return null;
    const contract = await ConsumerContract.findById(oid);
    if (!contract) return null;
    if (!(await canAccessWorkspace(req, contract.workspaceId))) return null;
    if (!(await loadAccessibleCollection(req, contract.providerCollectionId))) return null;
    return contract;
}

/**
 * Reject payload fields the client must never set directly.
 * lastRun is derived from actual runs; owner is taken from the session.
 */
function sanitizeContractPayload(body = {}) {
    const {
        name, description, consumerName, providerCollectionId,
        environmentId, version, status, interactions
    } = body;

    const payload = {};
    if (name !== undefined) payload.name = String(name).trim();
    if (description !== undefined) payload.description = String(description);
    if (consumerName !== undefined) payload.consumerName = String(consumerName).trim();
    if (providerCollectionId !== undefined) payload.providerCollectionId = toObjectId(providerCollectionId);
    if (environmentId !== undefined) payload.environmentId = toObjectId(environmentId);
    if (version !== undefined) payload.version = String(version).trim() || '1.0.0';
    if (status !== undefined && ['draft', 'active', 'deprecated'].includes(status)) payload.status = status;
    if (Array.isArray(interactions)) payload.interactions = interactions;
    return payload;
}

// ---------------------------------------------------------------- contracts

// List contracts in a workspace (with lightweight filter support).
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const { workspaceId } = req.query;
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });
        if (!(await canAccessWorkspace(req, workspaceId))) {
            return res.status(403).json({ message: 'You do not have access to this workspace' });
        }

        const query = { workspaceId: toObjectId(workspaceId) };
        if (req.query.providerCollectionId && req.query.providerCollectionId !== 'all') {
            query.providerCollectionId = toObjectId(req.query.providerCollectionId);
        }
        if (req.query.status && req.query.status !== 'all') query.status = req.query.status;
        if (req.query.consumerName && req.query.consumerName !== 'all') query.consumerName = req.query.consumerName;
        if (req.query.environmentId && req.query.environmentId !== 'all') {
            query.environmentId = toObjectId(req.query.environmentId);
        }

        const contracts = await ConsumerContract.find(query).sort({ updatedAt: -1 }).lean();

        // Only surface contracts whose provider collection the user can read.
        const collectionIds = [...new Set(contracts.map((c) => String(c.providerCollectionId)))];
        const ids = userIds(req);
        const readable = await Collection.find({
            _id: { $in: collectionIds.map(toObjectId).filter(Boolean) },
            $or: [{ owner: { $in: ids } }, { userId: { $in: ids } }, { 'collaborators.userId': { $in: ids } }]
        }).select('name').lean();
        const nameById = new Map(readable.map((c) => [String(c._id), c.name]));

        const visible = contracts
            .filter((c) => nameById.has(String(c.providerCollectionId)))
            .map((c) => ({ ...c, providerCollectionName: nameById.get(String(c.providerCollectionId)) }));

        res.json({ contracts: visible });
    } catch (err) {
        console.error('Error listing consumer contracts:', err);
        res.status(500).json({ message: 'Error listing consumer contracts' });
    }
});

router.post('/', ensureAuthenticated, async (req, res) => {
    try {
        const payload = sanitizeContractPayload(req.body);
        const workspaceId = toObjectId(req.body.workspaceId);

        if (!workspaceId) return res.status(400).json({ message: 'A valid workspaceId is required' });
        if (!payload.name) return res.status(400).json({ message: 'Contract name is required' });
        if (!payload.consumerName) return res.status(400).json({ message: 'Consumer name is required' });
        if (!payload.providerCollectionId) return res.status(400).json({ message: 'A provider collection is required' });

        if (!(await canAccessWorkspace(req, workspaceId))) {
            return res.status(403).json({ message: 'You do not have access to this workspace' });
        }
        if (!(await loadAccessibleCollection(req, payload.providerCollectionId))) {
            return res.status(403).json({ message: 'You do not have access to this collection' });
        }

        const contract = new ConsumerContract({
            ...payload,
            workspaceId,
            owner: toObjectId(req.user.id) || req.user.id
        });
        await contract.save();
        res.status(201).json(contract);
    } catch (err) {
        console.error('Error creating consumer contract:', err);
        res.status(400).json({ message: err.message });
    }
});

router.get('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const contract = await loadAccessibleContract(req, req.params.id);
        if (!contract) return res.status(404).json({ message: 'Contract not found' });
        res.json(contract);
    } catch (err) {
        console.error('Error loading consumer contract:', err);
        res.status(500).json({ message: 'Error loading consumer contract' });
    }
});

router.put('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const contract = await loadAccessibleContract(req, req.params.id);
        if (!contract) return res.status(404).json({ message: 'Contract not found' });

        const payload = sanitizeContractPayload(req.body);
        if (payload.providerCollectionId && !(await loadAccessibleCollection(req, payload.providerCollectionId))) {
            return res.status(403).json({ message: 'You do not have access to this collection' });
        }

        Object.assign(contract, payload);
        await contract.save();
        res.json(contract);
    } catch (err) {
        console.error('Error updating consumer contract:', err);
        res.status(400).json({ message: err.message });
    }
});

router.delete('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const contract = await loadAccessibleContract(req, req.params.id);
        if (!contract) return res.status(404).json({ message: 'Contract not found' });

        await ConsumerContractRun.deleteMany({ contractId: contract._id });
        await ConsumerContract.deleteOne({ _id: contract._id });
        res.json({ message: 'Contract deleted' });
    } catch (err) {
        console.error('Error deleting consumer contract:', err);
        res.status(500).json({ message: 'Error deleting consumer contract' });
    }
});

// ------------------------------------------------------- interaction seeding

/**
 * Build a draft interaction from a saved collection request and, when
 * available, that request's most recent response in history.
 */
router.post('/interactions/from-request', ensureAuthenticated, async (req, res) => {
    try {
        const { collectionId, requestId } = req.body || {};
        const collection = await loadAccessibleCollection(req, collectionId);
        if (!collection) return res.status(404).json({ message: 'Collection not found' });

        const request = (collection.requests || []).find((r) => String(r._id) === String(requestId));
        if (!request) return res.status(404).json({ message: 'Request not found in this collection' });

        const History = require('../models/History');
        const latest = await History.findOne({
            userId: toObjectId(req.user.id) || req.user.id,
            $or: [{ collectionRequestId: String(request._id) }, { originalRequestId: String(request._id) }]
        }).sort({ timestamp: -1 }).lean();

        let expectedHeaders = [];
        let expectedBody = '';
        let expectedStatus = 200;

        if (latest) {
            expectedStatus = latest.responseStatus || 200;
            expectedBody = latest.responseBody || '';
            try {
                const headers = JSON.parse(latest.responseHeaders || '{}');
                const contentType = Object.keys(headers).find((h) => h.toLowerCase() === 'content-type');
                if (contentType) {
                    // Drop charset etc. — consumers depend on the media type.
                    expectedHeaders = [{
                        key: 'content-type',
                        value: String(headers[contentType]).split(';')[0].trim(),
                        enabled: true
                    }];
                }
            } catch { /* headers were not stored as JSON */ }
        }

        res.json({
            interaction: {
                name: request.name,
                description: request.description || '',
                method: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].includes(request.method)
                    ? request.method
                    : 'GET',
                url: request.url,
                headers: (request.headers || [])
                    .filter((h) => h.enabled !== false)
                    .map((h) => ({ key: h.key || h.name || '', value: h.value || '', enabled: true })),
                queryParams: (request.params || [])
                    .filter((p) => p.enabled !== false)
                    .map((p) => ({ key: p.key || p.name || '', value: p.value || '', enabled: true })),
                body: request.body || '',
                bodyType: ['none', 'json', 'raw', 'x-www-form-urlencoded'].includes(request.bodyType)
                    ? request.bodyType
                    : 'none',
                expectedStatus,
                expectedHeaders,
                expectedBody,
                expectedFields: deriveExpectedFields(expectedBody),
                maxResponseTimeMs: null,
                tags: [],
                sourceRequestId: String(request._id)
            },
            seededFromHistory: Boolean(latest)
        });
    } catch (err) {
        console.error('Error generating interaction from request:', err);
        res.status(500).json({ message: 'Error generating interaction from request' });
    }
});

// Derive field expectations from a pasted example body (no persistence).
router.post('/interactions/derive-fields', ensureAuthenticated, (req, res) => {
    try {
        res.json({ fields: deriveExpectedFields(req.body?.body || '') });
    } catch (err) {
        res.status(400).json({ message: 'Could not derive fields from that body' });
    }
});

// ---------------------------------------------------------------- execution

router.post('/:id/run', ensureAuthenticated, async (req, res) => {
    try {
        const contract = await loadAccessibleContract(req, req.params.id);
        if (!contract) return res.status(404).json({ message: 'Contract not found' });
        if (!contract.interactions || contract.interactions.length === 0) {
            return res.status(400).json({ message: 'Add at least one interaction before running this contract' });
        }

        const environmentId = req.body?.environmentId
            ? toObjectId(req.body.environmentId)
            : contract.environmentId;

        let environmentName = 'No environment';
        if (environmentId) {
            const env = await Environment.findOne({
                _id: environmentId,
                userId: { $in: userIds(req) }
            }).select('name');
            if (!env) return res.status(403).json({ message: 'You do not have access to this environment' });
            environmentName = env.name;
        }

        const summary = await runContract(contract, {
            userId: req.user.id,
            workspaceId: String(contract.workspaceId),
            environmentId: environmentId ? String(environmentId) : null,
            authConfig: req.body?.authConfig || null
        });

        const run = await ConsumerContractRun.create({
            contractId: contract._id,
            workspaceId: contract.workspaceId,
            owner: toObjectId(req.user.id) || req.user.id,
            environmentId: environmentId || null,
            environmentName,
            contractVersion: contract.version,
            ...summary
        });

        contract.lastRun = {
            runId: run._id,
            result: run.status,
            breaking: run.breaking,
            ranAt: run.createdAt
        };
        await contract.save();

        res.status(201).json(run);
    } catch (err) {
        console.error('Error running consumer contract:', err);
        res.status(500).json({ message: err.message || 'Error running consumer contract' });
    }
});

// ------------------------------------------------------------- run history

router.get('/:id/runs', ensureAuthenticated, async (req, res) => {
    try {
        const contract = await loadAccessibleContract(req, req.params.id);
        if (!contract) return res.status(404).json({ message: 'Contract not found' });

        const limit = Math.min(Number(req.query.limit) || 20, 100);
        const runs = await ConsumerContractRun.find({ contractId: contract._id })
            .sort({ createdAt: -1 })
            .limit(limit)
            // Result bodies are large; the list only needs the summary.
            .select('-results')
            .lean();

        res.json({ runs });
    } catch (err) {
        console.error('Error loading contract runs:', err);
        res.status(500).json({ message: 'Error loading contract runs' });
    }
});

router.get('/runs/:runId', ensureAuthenticated, async (req, res) => {
    try {
        const runId = toObjectId(req.params.runId);
        if (!runId) return res.status(404).json({ message: 'Run not found' });

        const run = await ConsumerContractRun.findById(runId).lean();
        if (!run) return res.status(404).json({ message: 'Run not found' });

        const contract = await loadAccessibleContract(req, run.contractId);
        if (!contract) return res.status(404).json({ message: 'Run not found' });

        res.json(run);
    } catch (err) {
        console.error('Error loading contract run:', err);
        res.status(500).json({ message: 'Error loading contract run' });
    }
});

module.exports = router;
