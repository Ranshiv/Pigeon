// routes/evaluation.js
// Collection-scoped AI-agent evaluation suites: suite + scenario CRUD and
// transcript scoring runs. Mounted at /evaluation.
//
// Collection access mirrors routes/mcp.js getManagedCollection (workspace
// membership via userId/owner/collaborators). Allowed tool names come from
// CollectionMcpServerService.buildToolCatalog over the raw collection doc.
const express = require('express');
const { ObjectId } = require('mongodb');
const { ensureAuthenticated } = require('../middleware/auth');
const { getDb } = require('../config/db');
const collectionMcpServer = require('../services/CollectionMcpServerService');
const {
    validateTranscript,
    scoreScenario,
    scoreSuite,
    redactTranscript
} = require('../services/EvaluationScorer');

const EvaluationSuite = require('../models/EvaluationSuite');
const EvaluationScenario = require('../models/EvaluationScenario');
const EvaluationRun = require('../models/EvaluationRun');

const router = express.Router();

const toObjectId = (value) => (ObjectId.isValid(String(value)) ? new ObjectId(String(value)) : null);

const userIdVariants = (user) => {
    const id = String(user?.id || user?._id || '');
    if (!id) return [];
    return ObjectId.isValid(id) ? [id, new ObjectId(id)] : [id];
};

// Reuses routes/mcp.js's membership rule: owner, userId, or editor/admin collaborator.
const loadManagedCollection = async (collectionId, user) => {
    if (!ObjectId.isValid(collectionId)) return null;
    const db = getDb();
    if (!db) throw new Error('Database not initialized');
    const userIds = userIdVariants(user);
    if (!userIds.length) return null;
    return db.collection('collections').findOne({
        _id: new ObjectId(collectionId),
        $or: [
            { userId: { $in: userIds } },
            { owner: { $in: userIds } },
            { collaborators: { $elemMatch: { userId: { $in: userIds }, role: { $in: ['editor', 'admin'] } } } }
        ]
    });
};

const catalogToolNames = (collection) => {
    const catalog = collectionMcpServer.buildToolCatalog(collection);
    return catalog.map((entry) => entry.name).filter(Boolean);
};

const serializeSuite = (suite, scenarios = []) => ({
    id: String(suite._id),
    collectionId: String(suite.collectionId),
    workspaceId: String(suite.workspaceId),
    name: suite.name,
    description: suite.description || '',
    enabled: suite.enabled !== false,
    scenarios: scenarios.sort((a, b) => (a.order || 0) - (b.order || 0)).map(serializeScenario),
    createdAt: suite.createdAt,
    updatedAt: suite.updatedAt
});

const serializeScenario = (scenario) => ({
    id: String(scenario._id),
    suiteId: String(scenario.suiteId),
    order: scenario.order || 0,
    name: scenario.name,
    objective: scenario.objective || '',
    requiredToolCalls: scenario.requiredToolCalls || [],
    forbiddenToolCalls: scenario.forbiddenToolCalls || [],
    argumentAssertions: (scenario.argumentAssertions || []).map((a) => ({
        toolName: a.toolName,
        path: a.path || '',
        operator: a.operator || 'equals',
        expected: a.expected || ''
    })),
    maxToolCalls: scenario.maxToolCalls == null ? null : scenario.maxToolCalls,
    createdAt: scenario.createdAt,
    updatedAt: scenario.updatedAt
});

const serializeRun = (run) => ({
    id: String(run._id),
    suiteId: String(run.suiteId),
    scenarioId: run.scenarioId ? String(run.scenarioId) : null,
    collectionId: String(run.collectionId),
    agentName: run.agentName || '',
    transcript: run.transcript || '',
    status: run.status,
    score: run.score,
    violations: run.violations || [],
    perRuleResults: run.perRuleResults || [],
    scenarioResults: run.scenarioResults || [],
    error: run.error || null,
    createdAt: run.createdAt
});

const sanitizeSuitePayload = (body = {}) => {
    const p = {};
    if (body.name !== undefined) p.name = String(body.name).trim().slice(0, 120);
    if (body.description !== undefined) p.description = String(body.description).slice(0, 1000);
    if (body.enabled !== undefined) p.enabled = Boolean(body.enabled);
    return p;
};

const sanitizeScenarioPayload = (body = {}) => {
    const p = {};
    if (body.name !== undefined) p.name = String(body.name).trim().slice(0, 120);
    if (body.objective !== undefined) p.objective = String(body.objective).slice(0, 1000);
    if (Array.isArray(body.requiredToolCalls)) {
        p.requiredToolCalls = body.requiredToolCalls.map((v) => String(v).trim()).filter(Boolean);
    }
    if (Array.isArray(body.forbiddenToolCalls)) {
        p.forbiddenToolCalls = body.forbiddenToolCalls.map((v) => String(v).trim()).filter(Boolean);
    }
    if (Array.isArray(body.argumentAssertions)) {
        p.argumentAssertions = body.argumentAssertions
            .filter((a) => a && a.toolName)
            .map((a) => ({
                toolName: String(a.toolName).trim(),
                path: String(a.path || '').trim(),
                operator: ['equals', 'contains', 'exists', 'notExists'].includes(a.operator) ? a.operator : 'equals',
                expected: a.expected === undefined ? '' : String(a.expected)
            }));
    }
    if (body.maxToolCalls !== undefined && body.maxToolCalls !== null) {
        const n = Number(body.maxToolCalls);
        p.maxToolCalls = Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
    } else if (body.maxToolCalls === null) {
        p.maxToolCalls = null;
    }
    return p;
};

const persistRun = async ({ collection, suite, scenarioId, normalized, result }) => {
    const scenarioResults = result.scenarioResults || [];
    return EvaluationRun.create({
        suiteId: suite._id,
        scenarioId: scenarioId ? toObjectId(scenarioId) : null,
        collectionId: collection._id,
        workspaceId: suite.workspaceId,
        owner: suite.owner,
        agentName: normalized.agentName || '',
        transcript: redactTranscript(normalized),
        status: result.status,
        score: result.score,
        violations: result.violations || [],
        perRuleResults: result.perRuleResults || [],
        scenarioResults,
        error: null
    });
};

// --------------------------------------------------------------- suites list

router.get('/collections/:collectionId/suites', ensureAuthenticated, async (req, res) => {
    try {
        const collection = await loadManagedCollection(req.params.collectionId, req.user);
        if (!collection) return res.status(404).json({ message: 'Collection not found or you do not have permission to view it.' });
        const suites = await EvaluationSuite.find({ collectionId: collection._id }).sort({ updatedAt: -1 }).lean();
        const out = [];
        for (const suite of suites) {
            const scenarios = await EvaluationScenario.find({ suiteId: suite._id }).lean();
            out.push(serializeSuite(suite, scenarios));
        }
        res.json({ suites: out, toolNames: catalogToolNames(collection) });
    } catch (error) {
        res.status(500).json({ message: error.message || 'Unable to load evaluation suites.' });
    }
});

router.post('/collections/:collectionId/suites', ensureAuthenticated, async (req, res) => {
    try {
        const collection = await loadManagedCollection(req.params.collectionId, req.user);
        if (!collection) return res.status(404).json({ message: 'Collection not found or you do not have permission to create suites for it.' });
        const payload = sanitizeSuitePayload(req.body);
        if (!payload.name) return res.status(400).json({ message: 'A suite name is required.' });

        const suite = await EvaluationSuite.create({
            collectionId: collection._id,
            workspaceId: toObjectId(collection.workspaceId) || collection._id,
            owner: toObjectId(req.user.id) || req.user.id,
            name: payload.name,
            description: payload.description || '',
            enabled: payload.enabled !== false
        });
        res.status(201).json(serializeSuite(suite, []));
    } catch (error) {
        res.status(500).json({ message: error.message || 'Unable to create the evaluation suite.' });
    }
});

router.get('/suites/:id', ensureAuthenticated, async (req, res) => {
    try {
        const suite = await EvaluationSuite.findById(req.params.id).lean();
        if (!suite) return res.status(404).json({ message: 'Suite not found.' });
        const collection = await loadManagedCollection(suite.collectionId, req.user);
        if (!collection) return res.status(404).json({ message: 'Suite not found.' });
        const scenarios = await EvaluationScenario.find({ suiteId: suite._id }).lean();
        res.json({ suite: serializeSuite(suite, scenarios), toolNames: catalogToolNames(collection) });
    } catch (error) {
        res.status(500).json({ message: error.message || 'Unable to load the suite.' });
    }
});

router.put('/suites/:id', ensureAuthenticated, async (req, res) => {
    try {
        const suite = await EvaluationSuite.findById(req.params.id);
        if (!suite) return res.status(404).json({ message: 'Suite not found.' });
        const collection = await loadManagedCollection(suite.collectionId, req.user);
        if (!collection) return res.status(404).json({ message: 'Suite not found.' });
        const payload = sanitizeSuitePayload(req.body);
        Object.assign(suite, payload);
        await suite.save();
        const scenarios = await EvaluationScenario.find({ suiteId: suite._id }).lean();
        res.json(serializeSuite(suite, scenarios));
    } catch (error) {
        res.status(500).json({ message: error.message || 'Unable to update the suite.' });
    }
});

router.delete('/suites/:id', ensureAuthenticated, async (req, res) => {
    try {
        const suite = await EvaluationSuite.findById(req.params.id);
        if (!suite) return res.status(404).json({ message: 'Suite not found.' });
        const collection = await loadManagedCollection(suite.collectionId, req.user);
        if (!collection) return res.status(404).json({ message: 'Suite not found.' });
        await Promise.all([
            EvaluationScenario.deleteMany({ suiteId: suite._id }),
            EvaluationRun.deleteMany({ suiteId: suite._id }),
            suite.deleteOne()
        ]);
        res.json({ message: 'Suite, its scenarios, and run history were deleted.' });
    } catch (error) {
        res.status(500).json({ message: error.message || 'Unable to delete the suite.' });
    }
});

// --------------------------------------------------------------- scenarios

router.post('/suites/:id/scenarios', ensureAuthenticated, async (req, res) => {
    try {
        const suite = await EvaluationSuite.findById(req.params.id);
        if (!suite) return res.status(404).json({ message: 'Suite not found.' });
        const collection = await loadManagedCollection(suite.collectionId, req.user);
        if (!collection) return res.status(404).json({ message: 'Suite not found.' });
        const payload = sanitizeScenarioPayload(req.body);
        if (!payload.name) return res.status(400).json({ message: 'A scenario name is required.' });
        const count = await EvaluationScenario.countDocuments({ suiteId: suite._id });
        const scenario = await EvaluationScenario.create({
            suiteId: suite._id,
            order: count,
            name: payload.name,
            objective: payload.objective || '',
            requiredToolCalls: payload.requiredToolCalls || [],
            forbiddenToolCalls: payload.forbiddenToolCalls || [],
            argumentAssertions: payload.argumentAssertions || [],
            maxToolCalls: payload.maxToolCalls == null ? null : payload.maxToolCalls
        });
        res.status(201).json(serializeScenario(scenario));
    } catch (error) {
        res.status(500).json({ message: error.message || 'Unable to create the scenario.' });
    }
});

router.put('/scenarios/:id', ensureAuthenticated, async (req, res) => {
    try {
        const scenario = await EvaluationScenario.findById(req.params.id);
        if (!scenario) return res.status(404).json({ message: 'Scenario not found.' });
        const suite = await EvaluationSuite.findById(scenario.suiteId);
        if (!suite) return res.status(404).json({ message: 'Scenario not found.' });
        const collection = await loadManagedCollection(suite.collectionId, req.user);
        if (!collection) return res.status(404).json({ message: 'Scenario not found.' });
        const payload = sanitizeScenarioPayload(req.body);
        Object.assign(scenario, payload);
        await scenario.save();
        res.json(serializeScenario(scenario));
    } catch (error) {
        res.status(500).json({ message: error.message || 'Unable to update the scenario.' });
    }
});

router.delete('/scenarios/:id', ensureAuthenticated, async (req, res) => {
    try {
        const scenario = await EvaluationScenario.findById(req.params.id);
        if (!scenario) return res.status(404).json({ message: 'Scenario not found.' });
        const suite = await EvaluationSuite.findById(scenario.suiteId);
        if (!suite) return res.status(404).json({ message: 'Scenario not found.' });
        const collection = await loadManagedCollection(suite.collectionId, req.user);
        if (!collection) return res.status(404).json({ message: 'Scenario not found.' });
        await Promise.all([
            EvaluationRun.deleteMany({ suiteId: suite._id, scenarioId: scenario._id }),
            scenario.deleteOne()
        ]);
        res.json({ message: 'Scenario and its runs were deleted.' });
    } catch (error) {
        res.status(500).json({ message: error.message || 'Unable to delete the scenario.' });
    }
});

router.put('/suites/:id/scenarios/order', ensureAuthenticated, async (req, res) => {
    try {
        const suite = await EvaluationSuite.findById(req.params.id);
        if (!suite) return res.status(404).json({ message: 'Suite not found.' });
        const collection = await loadManagedCollection(suite.collectionId, req.user);
        if (!collection) return res.status(404).json({ message: 'Suite not found.' });
        const order = Array.isArray(req.body?.order) ? req.body.order : null;
        if (!order) return res.status(400).json({ message: 'Expected { order: [scenarioId, ...] }.' });
        const ops = order.map((scenarioId, index) => ({
            updateOne: {
                filter: { _id: toObjectId(scenarioId), suiteId: suite._id },
                update: { $set: { order: index } }
            }
        })).filter((op) => op.updateOne.filter._id);
        if (ops.length) await EvaluationScenario.bulkWrite(ops);
        const scenarios = await EvaluationScenario.find({ suiteId: suite._id }).lean();
        res.json({ scenarios: scenarios.map(serializeScenario) });
    } catch (error) {
        res.status(500).json({ message: error.message || 'Unable to reorder scenarios.' });
    }
});

// --------------------------------------------------------------- runs

router.post('/suites/:id/runs', ensureAuthenticated, async (req, res) => {
    try {
        const suite = await EvaluationSuite.findById(req.params.id);
        if (!suite) return res.status(404).json({ message: 'Suite not found.' });
        const collection = await loadManagedCollection(suite.collectionId, req.user);
        if (!collection) return res.status(404).json({ message: 'Suite not found.' });

        const validation = validateTranscript(req.body);
        if (!validation.ok) return res.status(400).json({ message: validation.message });
        const normalized = validation.normalized;

        const scenarios = await EvaluationScenario.find({ suiteId: suite._id }).lean();
        const allowed = catalogToolNames(collection);
        const result = scoreSuite(scenarios, normalized, allowed);
        const run = await persistRun({ collection, suite, scenarioId: null, normalized, result });
        res.status(201).json(serializeRun(run));
    } catch (error) {
        res.status(500).json({ message: error.message || 'Unable to score the transcript.' });
    }
});

router.post('/scenarios/:id/runs', ensureAuthenticated, async (req, res) => {
    try {
        const scenario = await EvaluationScenario.findById(req.params.id);
        if (!scenario) return res.status(404).json({ message: 'Scenario not found.' });
        const suite = await EvaluationSuite.findById(scenario.suiteId);
        if (!suite) return res.status(404).json({ message: 'Scenario not found.' });
        const collection = await loadManagedCollection(suite.collectionId, req.user);
        if (!collection) return res.status(404).json({ message: 'Scenario not found.' });

        const validation = validateTranscript(req.body);
        if (!validation.ok) return res.status(400).json({ message: validation.message });
        const normalized = validation.normalized;

        const allowed = catalogToolNames(collection);
        const scenarioResult = scoreScenario(scenario, normalized, allowed);
        const run = await persistRun({
            collection,
            suite,
            scenarioId: scenario._id,
            normalized,
            result: scenarioResult
        });
        res.status(201).json(serializeRun(run));
    } catch (error) {
        res.status(500).json({ message: error.message || 'Unable to score the transcript.' });
    }
});

router.get('/suites/:id/runs', ensureAuthenticated, async (req, res) => {
    try {
        const suite = await EvaluationSuite.findById(req.params.id);
        if (!suite) return res.status(404).json({ message: 'Suite not found.' });
        const collection = await loadManagedCollection(suite.collectionId, req.user);
        if (!collection) return res.status(404).json({ message: 'Suite not found.' });
        const limit = Math.min(Number(req.query.limit) || 50, 200);
        const runs = await EvaluationRun.find({ suiteId: suite._id }).sort({ createdAt: -1 }).limit(limit).lean();
        res.json({ runs: runs.map(serializeRun) });
    } catch (error) {
        res.status(500).json({ message: error.message || 'Unable to load run history.' });
    }
});

router.get('/runs/:id', ensureAuthenticated, async (req, res) => {
    try {
        const run = await EvaluationRun.findById(req.params.id).lean();
        if (!run) return res.status(404).json({ message: 'Run not found.' });
        const suite = await EvaluationSuite.findById(run.suiteId);
        if (!suite) return res.status(404).json({ message: 'Run not found.' });
        const collection = await loadManagedCollection(suite.collectionId, req.user);
        if (!collection) return res.status(404).json({ message: 'Run not found.' });
        res.json({ run: serializeRun(run) });
    } catch (error) {
        res.status(500).json({ message: error.message || 'Unable to load the run.' });
    }
});

module.exports = router;