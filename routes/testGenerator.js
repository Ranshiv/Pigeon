const express = require('express');
const mongoose = require('mongoose');
const { ensureAuthenticated } = require('../middleware/auth');
const Workspace = require('../models/Workspace');
const Collection = require('../models/Collection');
const ApiVersion = require('../models/ApiVersion');
const AsyncApiDocument = require('../models/AsyncApiDocument');
const AsyncApiScenario = require('../models/AsyncApiScenario');
const Trace = require('../models/Trace');
const History = require('../models/History');
const MockServer = require('../models/MockServer');
const MockRecording = require('../models/MockRecording');
const Environment = require('../models/Environment');
const ConsumerContract = require('../models/ConsumerContract');
const AuthenticationService = require('../services/AuthenticationService');
const GeneratedTestSuite = require('../models/GeneratedTestSuite');
const GeneratedTestCase = require('../models/GeneratedTestCase');
const { findRequestForTestCase, buildRuntimeVariables, unresolvedVariableKeys } = require('../services/TestMaterializationService');
const TestAuthProfile = require('../models/TestAuthProfile');
const { runRequest } = require('../cli/runner');
const {
    GENERATOR_VERSION, CATEGORIES, hash, redact, normalizeOpenApi, normalizeAsyncApi, normalizeSavedRequest,
    normalizeHistory, normalizeTrace, normalizeRecording, mergeOperations, deterministicCases, enrichWithAi, dedupeAndLimit
} = require('../services/TestGenerationService');

const router = express.Router();
const authService = new AuthenticationService();
const toId = (value) => mongoose.Types.ObjectId.isValid(String(value || '')) ? new mongoose.Types.ObjectId(String(value)) : null;
const idsFor = (user) => { const oid = toId(user.id); return oid ? [user.id, oid] : [user.id]; };
const canEdit = (role) => ['owner', 'admin', 'editor'].includes(role);

async function workspaceAccess(req, workspaceId) {
    const id = toId(workspaceId);
    if (!id) return null;
    const ids = idsFor(req.user);
    const workspace = await Workspace.findOne({ _id: id, $or: [{ owner: { $in: ids } }, { userId: { $in: ids } }, { 'collaborators.userId': { $in: ids } }] });
    if (!workspace) return null;
    const userId = String(req.user.id);
    const role = ids.some((value) => String(workspace.owner) === String(value) || String(workspace.userId) === String(value))
        ? 'owner' : workspace.collaborators.find((item) => String(item.userId) === userId)?.role || 'viewer';
    return { workspace, role };
}

async function suiteAccess(req, suiteId) {
    const suite = await GeneratedTestSuite.findById(toId(suiteId));
    if (!suite) return null;
    const access = await workspaceAccess(req, suite.workspaceId);
    return access ? { ...access, suite } : null;
}

const accessibleCollections = async (req, workspaceId) => {
    const ids = idsFor(req.user);
    return Collection.find({ workspaceId: toId(workspaceId), $or: [{ owner: { $in: ids } }, { userId: { $in: ids } }, { 'collaborators.userId': { $in: ids } }] });
};

const sourceSummary = (type, id, label, extra = {}) => ({ type, id: String(id), label, ...extra });

router.get('/sources', ensureAuthenticated, async (req, res) => {
    try {
        const access = await workspaceAccess(req, req.query.workspaceId);
        if (!access) return res.status(403).json({ message: 'You do not have access to this workspace.' });
        const collections = await accessibleCollections(req, access.workspace._id);
        const collectionIds = collections.map((item) => item._id);
        const [versions, asyncDocs, traces, histories, mockServers] = await Promise.all([
            ApiVersion.find({ collectionId: { $in: collectionIds }, openApiSpec: { $ne: null } }).sort({ updatedAt: -1 }).limit(50).lean(),
            AsyncApiDocument.find({ workspaceId: access.workspace._id }).sort({ updatedAt: -1 }).limit(50).lean(),
            Trace.find({ workspaceId: access.workspace._id }).sort({ startTime: -1 }).limit(50).lean(),
            History.find({ userId: { $in: idsFor(req.user) }, collectionId: { $in: collectionIds.map(String) } }).sort({ timestamp: -1 }).limit(50).lean(),
            MockServer.find({ collectionId: { $in: collectionIds } }).select('_id collectionId name').lean()
        ]);
        const recordings = await MockRecording.find({ mockServerId: { $in: mockServers.map((item) => item._id) }, status: 'completed' }).sort({ createdAt: -1 }).limit(50).lean();
        const collectionById = new Map(collections.map((item) => [String(item._id), item]));
        const serverById = new Map(mockServers.map((item) => [String(item._id), item]));
        const operationsOf = (items) => [...new Map(items.map((item) => [item.id, { id: item.id, label: item.label }])).values()];
        const sources = [
            ...versions.map((item) => { const base = sourceSummary('openapi', item._id, `${collectionById.get(String(item.collectionId))?.name || 'Collection'} · OpenAPI ${item.version}`, { collectionId: String(item.collectionId) }); return { ...base, operations: operationsOf(normalizeOpenApi(item.openApiSpec, base)) }; }),
            ...collections.flatMap((collection) => (collection.requests || []).map((request) => { const base = sourceSummary('saved-request', request._id, `${collection.name} · ${request.name}`, { collectionId: String(collection._id) }); return { ...base, operations: operationsOf(normalizeSavedRequest(request.toObject ? request.toObject() : request, base)) }; })),
            ...asyncDocs.map((item) => { const base = sourceSummary('asyncapi', item._id, `${item.name} · AsyncAPI ${item.asyncApiVersion}`); return { ...base, operations: operationsOf(normalizeAsyncApi(item, base)) }; }),
            ...traces.map((item) => { const base = sourceSummary('trace', item._id, `${item.rootServiceName} · ${item.route || item.traceId}`); return { ...base, operations: operationsOf(normalizeTrace(item, base)) }; }),
            ...histories.map((item) => { const base = sourceSummary('history', item._id, `${item.method} ${item.url}`, { collectionId: item.collectionId }); return { ...base, operations: operationsOf(normalizeHistory(item, base)) }; }),
            ...recordings.map((item) => { const base = sourceSummary('recording', item._id, `${serverById.get(String(item.mockServerId))?.name || 'Mock'} · ${item.name}`, { collectionId: String(serverById.get(String(item.mockServerId))?.collectionId || '') }); return { ...base, operations: operationsOf(normalizeRecording(item, base)) }; })
        ];
        res.json({ sources, collections: collections.map((item) => ({ id: String(item._id), name: item.name, editable: item.hasAccess(String(req.user.id), 'editor') })), limits: { operations: 50, cases: 250, aiCases: 25, payloadBytes: 262144 } });
    } catch (error) { res.status(500).json({ message: error.message || 'Unable to list test sources.' }); }
});

async function loadSource(req, workspaceId, descriptor, collections) {
    const collectionById = new Map(collections.map((item) => [String(item._id), item]));
    const source = { type: descriptor.type, id: String(descriptor.id), label: String(descriptor.label || '') };
    if (descriptor.type === 'openapi') {
        const version = await ApiVersion.findById(toId(descriptor.id)).lean();
        if (!version || !collectionById.has(String(version.collectionId))) throw new Error('OpenAPI source was not found.');
        source.label ||= `OpenAPI ${version.version}`;
        return normalizeOpenApi(version.openApiSpec, source);
    }
    if (descriptor.type === 'saved-request') {
        const collection = collectionById.get(String(descriptor.collectionId));
        const request = collection?.requests?.id?.(descriptor.id) || collection?.requests?.find((item) => String(item._id) === String(descriptor.id));
        if (!request) throw new Error('Saved request source was not found.');
        source.label ||= request.name;
        return normalizeSavedRequest(request.toObject ? request.toObject() : request, source);
    }
    if (descriptor.type === 'asyncapi') {
        const document = await AsyncApiDocument.findOne({ _id: toId(descriptor.id), workspaceId }).lean();
        if (!document) throw new Error('AsyncAPI source was not found.');
        source.label ||= document.name;
        return normalizeAsyncApi(document, source);
    }
    if (descriptor.type === 'trace') {
        const trace = await Trace.findOne({ _id: toId(descriptor.id), workspaceId }).lean();
        if (!trace) throw new Error('Trace source was not found.');
        source.label ||= trace.rootServiceName;
        return normalizeTrace(trace, source);
    }
    if (descriptor.type === 'history') {
        const history = await History.findOne({ _id: toId(descriptor.id), userId: { $in: idsFor(req.user) }, collectionId: { $in: [...collectionById.keys()] } }).lean();
        if (!history) throw new Error('History source was not found.');
        return normalizeHistory(history, source);
    }
    if (descriptor.type === 'recording') {
        const recording = await MockRecording.findById(toId(descriptor.id)).lean();
        const server = recording ? await MockServer.findById(recording.mockServerId).lean() : null;
        if (!recording || !server || !collectionById.has(String(server.collectionId))) throw new Error('Recording source was not found.');
        source.label ||= recording.name;
        return normalizeRecording(recording, source);
    }
    throw new Error(`Unsupported source type: ${descriptor.type}`);
}

router.post('/suites', ensureAuthenticated, async (req, res) => {
    let stage = 'workspace-access';
    try {
        const body = req.body || {};
        const access = await workspaceAccess(req, body.workspaceId);
        if (!access || !canEdit(access.role)) return res.status(403).json({ message: 'Editor access is required to generate tests.' });
        const descriptors = Array.isArray(body.sources) ? body.sources.slice(0, 50) : [];
        if (!descriptors.length) return res.status(400).json({ message: 'Select at least one source.' });
        const categories = [...new Set((body.categories || CATEGORIES).filter((item) => CATEGORIES.includes(item)))];
        if (!categories.length) return res.status(400).json({ message: 'Select at least one test category.' });
        stage = 'source-loading';
        const collections = await accessibleCollections(req, access.workspace._id);
        const operationGroups = await Promise.all(descriptors.map((item) => loadSource(req, access.workspace._id, item, collections)));
        let operations = mergeOperations(operationGroups.flat()).slice(0, 50);
        const hasOperationSelection = descriptors.some((item) => Array.isArray(item.operationIds));
        const requestedOperationIds = new Set(descriptors.flatMap((item) => item.operationIds || []));
        if (hasOperationSelection) operations = operations.filter((item) => requestedOperationIds.has(item.id));
        if (!operations.length) return res.status(400).json({ message: 'The selected sources contain no supported operations.' });
        stage = 'deterministic-generation';
        const authProfiles = await TestAuthProfile.find({ workspaceId: access.workspace._id, _id: { $in: (body.authProfileIds || []).map(toId).filter(Boolean) } }).lean();
        let cases = operations.flatMap((operation) => deterministicCases(operation, categories, authProfiles));
        stage = 'ai-enrichment';
        const ai = body.includeAi === false ? { cases: [], used: false, warning: '' } : await enrichWithAi(operations, categories, cases, body.aiProfileId);
        cases = dedupeAndLimit([...cases, ...ai.cases]);
        const sourceSnapshotHash = hash(operations.map((operation) => redact(operation)));
        const collectionIds = [...new Set(descriptors.map((item) => item.collectionId).filter(Boolean))];
        stage = 'suite-persistence';
        const suite = await GeneratedTestSuite.create({
            workspaceId: access.workspace._id, collectionId: collectionIds.length === 1 ? toId(collectionIds[0]) : null,
            owner: toId(req.user.id) || req.user.id, name: String(body.name || `Generated tests · ${new Date().toLocaleDateString()}`).trim().slice(0, 160),
            description: String(body.description || '').slice(0, 2000), status: 'draft', sources: descriptors.map((item) => ({ type: item.type, id: String(item.id), label: String(item.label || ''), collectionId: String(item.collectionId || ''), operationIds: item.operationIds || [] })),
            categories, authProfileIds: authProfiles.map((item) => item._id), sourceSnapshotHash, generatorVersion: GENERATOR_VERSION,
            ai: { requested: body.includeAi !== false, used: ai.used, provider: ai.provider || '', model: ai.model || '', warning: ai.warning || '' },
            warnings: [...(operations.length === 50 ? ['Operation limit reached; narrow the source selection to generate more.'] : []), ...(cases.length === 250 ? ['Case limit reached; some cases were omitted.'] : []), ...(ai.warning ? [ai.warning] : [])]
        });
        stage = 'case-persistence';
        const docs = cases.map((item, order) => ({ ...item, suiteId: suite._id, workspaceId: suite.workspaceId, order }));
        if (docs.length) await GeneratedTestCase.insertMany(docs);
        suite.caseCount = docs.length;
        suite.categoryCounts = docs.reduce((counts, item) => ({ ...counts, [item.category]: (counts[item.category] || 0) + 1 }), {});
        await suite.save();
        res.status(201).json({ suite: suite.toObject(), cases: docs });
    } catch (error) {
        console.error('[AI Test Generator] generation failed', { stage, message: error.message });
        res.status(400).json({ message: error.message || 'Unable to generate the test suite.', stage });
    }
});

router.get('/suites', ensureAuthenticated, async (req, res) => {
    const access = await workspaceAccess(req, req.query.workspaceId);
    if (!access) return res.status(403).json({ message: 'You do not have access to this workspace.' });
    const suites = await GeneratedTestSuite.find({ workspaceId: access.workspace._id }).sort({ updatedAt: -1 }).limit(50).lean();
    res.json({ suites });
});

router.get('/suites/:id', ensureAuthenticated, async (req, res) => {
    const access = await suiteAccess(req, req.params.id);
    if (!access) return res.status(404).json({ message: 'Suite not found.' });
    const cases = await GeneratedTestCase.find({ suiteId: access.suite._id }).sort({ order: 1 }).lean();
    res.json({ suite: access.suite, cases });
});

router.patch('/suites/:id/cases/:caseId', ensureAuthenticated, async (req, res) => {
    const access = await suiteAccess(req, req.params.id);
    if (!access || !canEdit(access.role)) return res.status(403).json({ message: 'Editor access is required.' });
    if (access.suite.status !== 'draft') return res.status(409).json({ message: 'Only draft suites can be edited.' });
    const updates = {};
    if (req.body.enabled !== undefined) updates.enabled = Boolean(req.body.enabled);
    if (req.body.name !== undefined) updates.name = String(req.body.name).trim().slice(0, 240);
    if (Array.isArray(req.body.assertions)) {
        const allowed = new Set(['status', 'response-schema', 'field-presence', 'field-value', 'header', 'latency', 'graphql-errors', 'message-schema', 'authorization-outcome']);
        if (req.body.assertions.some((item) => !allowed.has(item?.kind))) return res.status(400).json({ message: 'One or more assertion kinds are not supported.' });
        updates.assertions = req.body.assertions.slice(0, 20).map(redact);
    }
    const testCase = await GeneratedTestCase.findOneAndUpdate({ _id: toId(req.params.caseId), suiteId: access.suite._id }, { $set: updates }, { new: true, runValidators: true });
    if (!testCase) return res.status(404).json({ message: 'Test case not found.' });
    res.json({ case: testCase });
});

router.post('/suites/:id/approve', ensureAuthenticated, async (req, res) => {
    const access = await suiteAccess(req, req.params.id);
    if (!access || !canEdit(access.role)) return res.status(403).json({ message: 'Editor access is required.' });
    if (access.suite.status !== 'draft') return res.status(409).json({ message: 'Only draft suites can be approved.' });
    const enabled = await GeneratedTestCase.countDocuments({ suiteId: access.suite._id, enabled: true });
    if (!enabled) return res.status(400).json({ message: 'Enable at least one test case before approval.' });
    access.suite.status = 'approved'; access.suite.approvedAt = new Date(); access.suite.approvedBy = toId(req.user.id) || req.user.id;
    await access.suite.save();
    res.json({ suite: access.suite });
});

const js = (value) => JSON.stringify(value);
function pathAccessor(path) { return String(path || '').split('.').filter(Boolean).map((part) => `[${js(part)}]`).join(''); }
function renderScript(testCase) {
    const lines = ['// Generated by Pigeon AI Test Generator.', 'const body = typeof response.body === "string" ? (() => { try { return JSON.parse(response.body); } catch { return {}; } })() : (response.body || {});'];
    for (const item of testCase.assertions || []) {
        if (item.kind === 'status' && Number.isFinite(Number(item.expected))) lines.push(`assert.equal(response.status, ${Number(item.expected)}, ${js(`Status is ${item.expected}`)});`);
        else if (item.kind === 'status' && item.expected === '4xx') lines.push('assert.true(response.status >= 400 && response.status < 500, "Status is a 4xx client error");');
        else if (item.kind === 'status' && item.expected === 'not-5xx') lines.push('assert.true(response.status < 500, "Response is not a server error");');
        else if (item.kind === 'latency') lines.push(`assert.lessThan(response.duration, ${Number(item.expected) || 30000}, ${js(`Response time is under ${Number(item.expected) || 30000} ms`)});`);
        else if (item.kind === 'field-presence') lines.push(`assert.isDefined(body${pathAccessor(item.expected)}, ${js(`Response body has ${item.expected}`)});`);
        else if (item.kind === 'field-value') lines.push(`assert.equal(body${pathAccessor(item.path)}, ${js(item.expected)}, ${js(`Response field ${item.path} matches`)});`);
        else if (item.kind === 'response-schema' && item.expected && typeof item.expected === 'object') lines.push(`assert.true(jsonSchema.validate(body, ${js(item.expected)}), "Response matches schema");`);
        else if (item.kind === 'response-schema') lines.push('assert.true(response.status < 500, "Schema check does not return a server error");');
        else if (item.kind === 'authorization-outcome' && item.expected === 'denied') lines.push('assert.true(response.status === 401 || response.status === 403 || response.status === 404, "Unauthorized access is denied");');
        else if (item.kind === 'authorization-outcome' && item.expected === 'allowed') lines.push('assert.true(response.status !== 401 && response.status !== 403, "Authorized actor is not rejected");');
        else if (item.kind === 'graphql-errors' && item.expected) lines.push('assert.true(Array.isArray(body.errors) && body.errors.length > 0, "GraphQL returns errors");');
    }
    return `${lines.join('\n')}\n`;
}

const executableUrl = (value) => {
    const url = String(value || '/');
    return /^(https?:\/\/|\{\{)/i.test(url) ? url : `{{baseUrl}}${url.startsWith('/') ? url : `/${url}`}`;
};

const resolveRuntimeRefs = (value, variables) => {
    if (Array.isArray(value)) return value.map((item) => resolveRuntimeRefs(item, variables));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveRuntimeRefs(item, variables)]));
    if (typeof value !== 'string') return value;
    return value.replace(/\{\{([^}]+)\}\}/g, (match, key) => variables[String(key).trim()] ?? match);
};

router.post('/suites/:id/materialize', ensureAuthenticated, async (req, res) => {
    try {
        const access = await suiteAccess(req, req.params.id);
        if (!access || !canEdit(access.role)) return res.status(403).json({ message: 'Editor access is required.' });
        if (!['approved', 'materialized'].includes(access.suite.status)) return res.status(409).json({ message: 'Approve the suite before materializing it.' });
        // Load every enabled case so a retry can repair artifact references left
        // behind by an interrupted or previously failed collection save.
        const cases = await GeneratedTestCase.find({ suiteId: access.suite._id, enabled: true, blocked: false }).sort({ order: 1 });
        const targetCollectionId = toId(req.body.collectionId) || access.suite.collectionId;
        const collections = await accessibleCollections(req, access.suite.workspaceId);
        const collection = collections.find((item) => String(item._id) === String(targetCollectionId) && item.hasAccess(String(req.user.id), 'editor'));
        if (cases.some((item) => item.protocol !== 'asyncapi') && !collection) return res.status(403).json({ message: 'Choose a collection where you have editor access.' });
        const authProfiles = await TestAuthProfile.find({ workspaceId: access.suite.workspaceId }).lean();
        const authById = new Map(authProfiles.map((item) => [String(item._id), item]));
        const created = [];
        const pendingRequestCases = [];
        let repaired = 0;
        for (const testCase of cases) {
            if (testCase.protocol === 'asyncapi' && testCase.source?.type === 'asyncapi') {
                if (testCase.materialization?.artifactId) continue;
                const document = await AsyncApiDocument.findOne({ _id: toId(testCase.source.id), workspaceId: access.suite.workspaceId });
                if (!document) continue;
                const operationParts = testCase.operationId.split(':');
                const operationName = operationParts[1];
                const address = operationParts.slice(2).join(':');
                const operation = (document.operations || []).find((item) => String(item.action).toUpperCase() === operationName && ((document.channels || []).find((channel) => channel.name === item.channelName)?.address || item.channelName) === address);
                if (!operation) continue;
                const scenario = await AsyncApiScenario.create({ name: testCase.name, description: testCase.rationale, documentId: document._id, workspaceId: access.suite.workspaceId, owner: toId(req.user.id) || req.user.id, channelName: operation.channelName, operation: operation.action, messageName: operation.messageName, payload: JSON.stringify(testCase.request.payload ?? {}), expectedSchemaValidation: true });
                testCase.materialization = { kind: 'asyncapi-scenario', artifactId: String(scenario._id), materializedAt: new Date() };
                await testCase.save(); created.push({ caseId: testCase._id, kind: 'asyncapi-scenario', artifactId: scenario._id }); continue;
            }
            if (!collection) continue;
            const existingRequest = findRequestForTestCase(collection, testCase);
            if (existingRequest) {
                const existingId = String(existingRequest._id);
                if (testCase.materialization?.kind !== 'request-script' || String(testCase.materialization?.artifactId || '') !== existingId) {
                    testCase.materialization = { kind: 'request-script', artifactId: existingId, materializedAt: new Date() };
                    pendingRequestCases.push({ testCase, request: existingRequest, created: false });
                }
                continue;
            }
            const body = testCase.request.body ?? testCase.request.variables ?? '';
            const authProfile = authById.get(String(testCase.request.authProfileId || ''));
            collection.requests.push({ name: testCase.name, description: testCase.rationale, url: executableUrl(testCase.request.address), method: testCase.protocol === 'graphql' ? 'GRAPHQL' : String(testCase.request.method || 'GET').toUpperCase(), protocol: testCase.protocol === 'graphql' ? 'graphql' : 'http', headers: testCase.request.headers || [], params: testCase.request.params || [], body: typeof body === 'string' ? body : JSON.stringify(body), bodyType: body === '' ? 'none' : testCase.protocol === 'graphql' ? 'graphql' : 'json', graphql: testCase.protocol === 'graphql' ? { query: testCase.request.query || '', variables: testCase.request.variables || {}, operationType: String(testCase.request.method || 'query').toLowerCase() } : undefined, authConfig: authProfile?.authConfigTemplate || {}, testScript: renderScript(testCase), tests: renderScript(testCase), metadata: { generatedTestSuiteId: String(access.suite._id), generatedTestCaseId: String(testCase._id), authProfileId: authProfile ? String(authProfile._id) : '', provenance: testCase.provenance } });
            const request = collection.requests[collection.requests.length - 1];
            testCase.materialization = { kind: 'request-script', artifactId: String(request._id), materializedAt: new Date() };
            pendingRequestCases.push({ testCase, request, created: true });
        }
        // Persist collection requests first. If this fails, case records remain
        // retryable instead of pointing at artifacts that were never stored.
        if (collection?.isModified()) await collection.save();
        for (const pending of pendingRequestCases) {
            await pending.testCase.save();
            if (pending.created) created.push({ caseId: pending.testCase._id, kind: 'request-script', artifactId: pending.request._id });
            else repaired += 1;
        }
        if (collection && req.body.createConsumerContract !== false && !(access.suite.artifacts || []).some((item) => item.kind === 'consumer-contract')) {
            const contractCases = cases.filter((item) => ['schema', 'regression'].includes(item.category) && item.protocol === 'http');
            const interactions = contractCases.map((item) => ({
                name: item.name, description: item.rationale, method: String(item.request.method || 'GET').toUpperCase(), url: executableUrl(item.request.address),
                body: item.request.body === undefined ? '' : typeof item.request.body === 'string' ? item.request.body : JSON.stringify(item.request.body), bodyType: item.request.body === undefined ? 'none' : 'json',
                expectedStatus: Number((item.assertions || []).find((assertion) => assertion.kind === 'status' && Number.isFinite(Number(assertion.expected)))?.expected) || 200,
                expectedFields: (item.assertions || []).filter((assertion) => assertion.kind === 'field-presence').map((assertion) => ({ path: String(assertion.expected), required: true, type: 'any' })),
                maxResponseTimeMs: Number((item.assertions || []).find((assertion) => assertion.kind === 'latency')?.expected) || null,
                tags: ['generated', item.category]
            }));
            if (interactions.length) {
                const contract = await ConsumerContract.create({ name: `${access.suite.name} · consumer contract`, description: `Generated from suite ${access.suite.name}.`, workspaceId: access.suite.workspaceId, owner: toId(req.user.id) || req.user.id, consumerName: 'Generated test suite', providerCollectionId: collection._id, status: 'draft', interactions });
                access.suite.artifacts.push({ kind: 'consumer-contract', artifactId: String(contract._id), createdAt: new Date() });
                created.push({ kind: 'consumer-contract', artifactId: contract._id });
            }
        }
        if (collection) access.suite.collectionId = collection._id;
        access.suite.status = 'materialized'; access.suite.materializedAt = new Date(); await access.suite.save();
        res.json({ suite: access.suite, created, repaired, skipped: Math.max(0, cases.length - created.filter((item) => item.caseId).length - repaired) });
    } catch (error) { res.status(400).json({ message: error.message || 'Unable to materialize the suite.' }); }
});

router.post('/suites/:id/run', ensureAuthenticated, async (req, res) => {
    try {
        const access = await suiteAccess(req, req.params.id);
        if (!access || !canEdit(access.role)) return res.status(403).json({ message: 'Editor access is required.' });
        if (access.suite.status !== 'materialized') return res.status(409).json({ message: 'Materialize the approved suite before running it.' });
        if (!req.body.acknowledgedTestEnvironment) return res.status(400).json({ message: 'Confirm that the target is a non-production test environment.' });
        const collection = await Collection.findById(access.suite.collectionId);
        if (!collection || !collection.hasAccess(String(req.user.id), 'editor')) return res.status(400).json({ message: 'This suite does not have an editable materialized target collection.' });
        const environment = req.body.environmentId ? await Environment.findOne({
            _id: toId(req.body.environmentId), workspaceId: access.suite.workspaceId,
            $or: [{ userId: { $in: idsFor(req.user) } }, { isShared: true }, { 'collaborators.userId': { $in: idsFor(req.user) } }]
        }).lean() : null;
        if (req.body.environmentId && !environment) return res.status(403).json({ message: 'The selected environment is not available to you.' });
        // Collection variables provide the default runtime context; a selected
        // environment intentionally overrides values with the same key.
        const variables = buildRuntimeVariables(collection, environment);
        const cases = await GeneratedTestCase.find({ suiteId: access.suite._id, enabled: true, blocked: false, 'materialization.kind': 'request-script' }).limit(100).lean();
        const runnableCases = cases.map((testCase) => ({ testCase, request: findRequestForTestCase(collection, testCase) }));
        const missingVariables = [...new Set(runnableCases.flatMap(({ request }) => request ? unresolvedVariableKeys(request.url, variables) : []))];
        if (missingVariables.length) return res.status(400).json({ message: `Define ${missingVariables.map((key) => `{{${key}}}`).join(', ')} in the target collection or selected environment before running this suite.` });
        const results = [];
        let missingArtifacts = 0;
        for (const { testCase, request } of runnableCases) {
            if (!request) { missingArtifacts += 1; continue; }
            const requestObject = request.toObject();
            const resolvedAuth = resolveRuntimeRefs(requestObject.authConfig || {}, variables);
            if (resolvedAuth.type && resolvedAuth.type !== 'No Auth') {
                const headerObject = Object.fromEntries((requestObject.headers || []).filter((item) => item.enabled !== false).map((item) => [item.name || item.key, resolveRuntimeRefs(item.value, variables)]));
                const authenticated = await authService.applyAuthentication({ url: resolveRuntimeRefs(requestObject.url, variables), headers: headerObject }, resolvedAuth);
                requestObject.url = authenticated.url;
                requestObject.headers = Object.entries(authenticated.headers || {}).map(([name, value]) => ({ name, value, enabled: true }));
            }
            const result = await runRequest(requestObject, { environment: variables, timeout: Math.min(60000, Math.max(1000, Number(req.body.timeout) || 30000)), userId: req.user.id, workspaceId: String(access.suite.workspaceId), collectionId: String(collection._id), environmentId: environment?._id });
            results.push({ caseId: testCase._id, status: result.error ? 'error' : result.tests.every((item) => item.passed) ? 'passed' : 'failed', responseStatus: result.response?.status, duration: result.duration, tests: result.tests, error: result.error?.message || '' });
        }
        if (!results.length && missingArtifacts) return res.status(409).json({ message: 'Materialized request artifacts are missing. Repair the suite artifacts, then run it again.' });
        res.json({ suiteId: access.suite._id, total: results.length, passed: results.filter((item) => item.status === 'passed').length, failed: results.filter((item) => item.status !== 'passed').length, missingArtifacts, results });
    } catch (error) { res.status(400).json({ message: error.message || 'Unable to run the suite.' }); }
});

function hasLiteralSecret(value, key = '') {
    if (Array.isArray(value)) return value.some((item) => hasLiteralSecret(item, key));
    if (value && typeof value === 'object') return Object.entries(value).some(([name, item]) => hasLiteralSecret(item, name));
    if (typeof value !== 'string') return false;
    return /password|secret|token|authorization|api[-_]?key/i.test(key) && value !== '' && !/^\{\{[A-Za-z_][A-Za-z0-9_]*\}\}$/.test(value);
}

router.get('/auth-profiles', ensureAuthenticated, async (req, res) => {
    const access = await workspaceAccess(req, req.query.workspaceId);
    if (!access) return res.status(403).json({ message: 'You do not have access to this workspace.' });
    const profiles = await TestAuthProfile.find({ workspaceId: access.workspace._id }).sort({ name: 1 }).lean();
    res.json({ profiles: [{ _id: 'anonymous', name: 'Anonymous', roleKey: 'anonymous', isAnonymous: true, expectedAccess: [] }, ...profiles] });
});

router.post('/auth-profiles', ensureAuthenticated, async (req, res) => {
    try {
        const access = await workspaceAccess(req, req.body.workspaceId);
        if (!access || !canEdit(access.role)) return res.status(403).json({ message: 'Editor access is required.' });
        if (hasLiteralSecret(req.body.authConfigTemplate || {})) return res.status(400).json({ message: 'Credentials must use {{ENV_VARIABLE}} references; literal secrets are not allowed.' });
        const profile = await TestAuthProfile.create({ workspaceId: access.workspace._id, owner: toId(req.user.id) || req.user.id, name: String(req.body.name || '').trim(), roleKey: String(req.body.roleKey || '').trim(), environmentId: toId(req.body.environmentId), authConfigTemplate: req.body.authConfigTemplate || {}, expectedAccess: (req.body.expectedAccess || []).map(String), description: String(req.body.description || '') });
        res.status(201).json({ profile });
    } catch (error) { res.status(400).json({ message: error.message || 'Unable to create authorization profile.' }); }
});

router.put('/auth-profiles/:id', ensureAuthenticated, async (req, res) => {
    const profile = await TestAuthProfile.findById(toId(req.params.id));
    const access = profile && await workspaceAccess(req, profile.workspaceId);
    if (!access || !canEdit(access.role)) return res.status(404).json({ message: 'Authorization profile not found.' });
    if (hasLiteralSecret(req.body.authConfigTemplate || {})) return res.status(400).json({ message: 'Credentials must use {{ENV_VARIABLE}} references; literal secrets are not allowed.' });
    for (const key of ['name', 'roleKey', 'description']) if (req.body[key] !== undefined) profile[key] = String(req.body[key]).trim();
    if (req.body.environmentId !== undefined) profile.environmentId = toId(req.body.environmentId);
    if (req.body.authConfigTemplate !== undefined) profile.authConfigTemplate = req.body.authConfigTemplate;
    if (Array.isArray(req.body.expectedAccess)) profile.expectedAccess = req.body.expectedAccess.map(String);
    await profile.save(); res.json({ profile });
});

router.delete('/auth-profiles/:id', ensureAuthenticated, async (req, res) => {
    const profile = await TestAuthProfile.findById(toId(req.params.id));
    const access = profile && await workspaceAccess(req, profile.workspaceId);
    if (!access || !canEdit(access.role)) return res.status(404).json({ message: 'Authorization profile not found.' });
    await profile.deleteOne(); res.json({ message: 'Authorization profile deleted.' });
});

module.exports = router;
