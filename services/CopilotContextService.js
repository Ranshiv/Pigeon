const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');
const { redactSensitiveValues, redactBody, truncate } = require('./AsyncApiRedact');
const { scoreCollection } = require('./GovernanceScoringService');

const MAX_SOURCES = 8;
const MAX_SOURCE_CHARS = 6500;
const MAX_TOTAL_CONTEXT_CHARS = Math.max(12000, Number(process.env.PIGEON_COPILOT_MAX_CONTEXT_CHARS) || 24000);
const MAX_EVIDENCE = 24;
const SOURCE_TYPES = new Set(['workspace', 'collection', 'request', 'history', 'governance', 'trace', 'test_run', 'incident']);

const asId = (value) => (ObjectId.isValid(String(value || '')) ? new ObjectId(String(value)) : null);
const idOf = (value) => String(value?._id || value?.id || value || '');
const userValues = (user) => {
    const value = String(user?.id || user?._id || '');
    const oid = asId(value);
    return [value, ...(oid ? [oid] : [])];
};
const safeDate = (value) => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
};
const redactText = (value, limit = MAX_SOURCE_CHARS) => truncate(String(value || '')
    .replace(/(authorization\s*[:=]\s*)(?:Bearer\s+)?([^\s,;]+)/gi, '$1[REDACTED]')
    .replace(/((?:api[-_ ]?key|access[-_ ]?token|refresh[-_ ]?token|password|secret|credential)\s*[:=]\s*)([^\s,;]+)/gi, '$1[REDACTED]'), limit);
const safeJson = (value, limit = MAX_SOURCE_CHARS) => redactText(JSON.stringify(redactSensitiveValues(value)), limit);
const fingerprint = (text) => crypto.createHash('sha256').update(String(text || '')).digest('hex').slice(0, 20);
const normalizedUrl = (value) => {
    try {
        const parsed = new URL(String(value || ''));
        return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/$/, '');
    } catch (_) {
        return String(value || '').split('?')[0].replace(/\/$/, '');
    }
};
const routeOf = (value) => {
    try { return new URL(String(value || '')).pathname || '/'; }
    catch (_) { return String(value || '').split('?')[0] || '/'; }
};

function collectionAccessFilter(user) {
    const values = userValues(user);
    return {
        $or: [
            { owner: { $in: values } },
            { userId: { $in: values } },
            { collaborators: { $elemMatch: { userId: { $in: values }, role: { $in: ['viewer', 'editor', 'admin'] } } } }
        ]
    };
}

function workspaceAccessFilter(user) {
    const values = userValues(user);
    return {
        $or: [
            { owner: { $in: values } },
            { userId: { $in: values } },
            { 'collaborators.userId': { $in: values } }
        ]
    };
}

async function loadWorkspace(workspaceId, user) {
    const id = asId(workspaceId);
    if (!id) return null;
    return getDb().collection('workspaces').findOne({ _id: id, ...workspaceAccessFilter(user) }, {
        projection: { name: 1, description: 1, stats: 1, updatedAt: 1 }
    });
}

async function loadCollection(collectionId, user) {
    const id = asId(collectionId);
    if (!id) return null;
    return getDb().collection('collections').findOne({ _id: id, ...collectionAccessFilter(user) });
}

function fact(kind, status, summary, detail = '', extra = {}) {
    return {
        id: extra.id || `ev-${crypto.randomUUID()}`,
        kind,
        status,
        summary: truncate(summary || '', 240),
        detail: truncate(detail || '', 700),
        ...extra
    };
}

function compactFacts(values) {
    const seen = new Set();
    return values.filter(Boolean).filter((item) => {
        const key = `${item.kind}:${item.status}:${item.summary}:${item.detail}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).slice(0, MAX_EVIDENCE);
}

// The page's own label names the open tab or sub-view ("Payments sample data"),
// which the stored resource name cannot. Prefer it over the resource name.
function envelope({ descriptor, label, workspaceId = null, deepLink = '', data = {}, evidence = [] }) {
    label = redactText(String(descriptor.label || '').trim(), 160) || label;
    const cleanEvidence = compactFacts(evidence);
    const capturedAt = new Date().toISOString();
    const text = safeJson({ resource: data, evidence: cleanEvidence });
    return {
        type: descriptor.type,
        id: String(descriptor.id || workspaceId || ''),
        label: label || descriptor.label || descriptor.type,
        workspaceId: workspaceId ? String(workspaceId) : null,
        origin: descriptor.origin === 'pinned' ? 'pinned' : 'active',
        deepLink,
        capturedAt,
        fingerprint: fingerprint(text),
        evidence: cleanEvidence,
        text
    };
}

function fitItemToBudget(item, budget) {
    if (item.text.length <= budget) return item;
    try {
        const parsed = JSON.parse(item.text);
        const resource = parsed.resource || {};
        if (resource.documentation?.content) resource.documentation.content = truncate(resource.documentation.content, 800);
        ['responseBody', 'requestPayload', 'responsePayload', 'transcript', 'body', 'content'].forEach((key) => {
            if (typeof resource[key] === 'string') resource[key] = truncate(resource[key], 700);
        });
        if (Array.isArray(resource.requests)) {
            resource.requests = resource.requests.map(({ id, name, method, url, description, protocol }) => ({ id, name, method, url, description, protocol }));
            while (JSON.stringify(parsed).length > budget && resource.requests.length > 2) resource.requests.pop();
        }
        ['results', 'scenarioResults', 'cases', 'services'].forEach((key) => {
            while (JSON.stringify(parsed).length > budget && Array.isArray(resource[key]) && resource[key].length > 3) resource[key].pop();
        });
        let text = JSON.stringify(parsed);
        if (text.length > budget) {
            const summary = Object.fromEntries(Object.entries(resource).filter(([, value]) => value === null || ['string', 'number', 'boolean'].includes(typeof value)).slice(0, 24));
            text = JSON.stringify({ resource: summary, evidence: (parsed.evidence || []).slice(0, 10) });
        }
        item.text = text;
        item.fingerprint = fingerprint(text);
        return item;
    } catch (_) {
        item.text = truncate(item.text, budget);
        item.fingerprint = fingerprint(item.text);
        return item;
    }
}

function requestIdOf(request) {
    return String(request?._id || request?.id || request?.requestId || '');
}

function requestEvidence(request) {
    const values = [fact('endpoint', 'info', `${String(request.method || 'GET').toUpperCase()} ${request.name || routeOf(request.url)}`, request.url || '')];
    if (!request.url) values.push(fact('configuration', 'warning', 'Request has no URL', 'Add a URL before executing this request.'));
    if (!request.description) values.push(fact('documentation', 'warning', 'Request has no description', 'This endpoint is harder to discover and govern.'));
    if (!request.testScript && !request.tests) values.push(fact('testing', 'warning', 'Request has no saved assertions', 'No request-level regression checks are configured.'));
    return values;
}

function parseTestResults(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'object') return Object.values(value);
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : Object.values(parsed || {});
    } catch (_) { return []; }
}

function historyEvidence(history) {
    const evidence = [];
    const status = Number(history.responseStatus);
    evidence.push(fact('http', status >= 400 || !status ? 'error' : 'success', `${history.method || 'GET'} ${history.url || 'request'} returned ${status || 'no status'}`, history.responseStatusText || ''));
    parseTestResults(history.testResults).forEach((result, index) => {
        const passed = result?.passed === true || result?.success === true || result?.status === 'passed';
        evidence.push(fact('assertion', passed ? 'success' : 'error', result?.name || result?.test || `Assertion ${index + 1}`, result?.error || result?.message || result?.actual || '', { path: result?.path || '' }));
    });
    if (Number(history.duration) > 1000) evidence.push(fact('latency', 'warning', `Slow response: ${history.duration} ms`, 'The request exceeded one second.'));
    return evidence;
}

async function recentHistoryForRequest(collection, request, user) {
    const requestId = requestIdOf(request);
    const collectionId = String(collection._id);
    const values = userValues(user);
    const candidates = await getDb().collection('histories').find({
        userId: { $in: values },
        $or: [
            { collectionRequestId: requestId },
            { originalRequestId: requestId },
            { collectionId }
        ]
    }).sort({ timestamp: -1 }).limit(40).toArray();
    const url = normalizedUrl(request.url);
    const method = String(request.method || '').toUpperCase();
    return candidates.filter((entry) => {
        const exact = [entry.collectionRequestId, entry.originalRequestId].some((value) => String(value || '') === requestId);
        return exact || (String(entry.collectionId || '') === collectionId && String(entry.method || '').toUpperCase() === method && normalizedUrl(entry.url) === url);
    }).slice(0, 5);
}

function traceEvidence(trace) {
    const values = [];
    if (trace.hasError) values.push(fact('trace', 'error', trace.errorMessage || `${trace.errorCount || 1} error span(s)`, `${trace.rootServiceName || 'service'} · ${trace.route || trace.rootSpanName || trace.traceId}`));
    (trace.spans || []).filter((span) => span.status === 'error' || Number(span.httpStatusCode) >= 400).slice(0, 12).forEach((span) => {
        values.push(fact('span', 'error', `${span.serviceName || 'service'}: ${span.name || span.route || 'failed span'}`, span.statusMessage || `${span.httpMethod || ''} ${span.route || span.url || ''} · ${span.httpStatusCode || 'error'}`, { spanId: span.spanId }));
    });
    const durations = (trace.spans || []).filter((span) => Number.isFinite(Number(span.durationMs))).sort((a, b) => Number(b.durationMs) - Number(a.durationMs));
    durations.slice(0, 3).forEach((span) => values.push(fact('latency', Number(span.durationMs) > 1000 ? 'warning' : 'info', `${span.name || span.serviceName} took ${Math.round(span.durationMs)} ms`, span.route || span.url || '', { spanId: span.spanId })));
    return values;
}

function violationsFromRun(run) {
    const values = [];
    const status = String(run.status || 'unknown');
    if (status === 'failed' || status === 'error') values.push(fact('test_run', 'error', `Run ${status}`, run.error || 'One or more checks failed.'));
    const violations = [
        ...(run.violations || []),
        ...((run.results || []).flatMap((result) => result.violations || [])),
        ...(run.perRuleResults || []).filter((result) => result.passed === false).map((result) => ({ ...result, message: result.detail || result.rule }))
    ];
    violations.slice(0, 18).forEach((violation) => values.push(fact(
        violation.kind || violation.rule || 'violation',
        violation.breaking ? 'error' : 'warning',
        violation.message || violation.detail || 'Test violation',
        [violation.path, violation.expected ? `expected ${violation.expected}` : '', violation.actual ? `actual ${violation.actual}` : ''].filter(Boolean).join(' · ')
    )));
    (run.cases || []).filter((testCase) => testCase.error || testCase.status === 'failed' || Number(testCase.responseStatus) >= 500).slice(0, 12).forEach((testCase) => values.push(fact(
        'fuzz_case',
        'error',
        testCase.name || testCase.mutation || 'Fuzz case failed',
        testCase.error || `Response status ${testCase.responseStatus || 'unknown'}`
    )));
    if (run.analysis?.insights) (run.analysis.insights || []).slice(0, 8).forEach((insight) => values.push(fact('performance', insight.severity === 'critical' ? 'error' : 'warning', insight.title || insight.type || 'Performance finding', insight.message || insight.description || '')));
    return values;
}

async function usageEvidence(collection, request, user) {
    if (!collection || !request) return [];
    const db = getDb();
    const values = userValues(user);
    const workspaceId = asId(collection.workspaceId);
    const requestId = requestIdOf(request);
    const url = normalizedUrl(request.url);
    const route = routeOf(request.url);
    const method = String(request.method || '').toUpperCase();
    const [collections, histories, traces, monitors, documentation] = await Promise.all([
        db.collection('collections').find({ ...collectionAccessFilter(user), ...(workspaceId ? { workspaceId } : {}) }).project({ name: 1, requests: 1 }).limit(100).toArray(),
        db.collection('histories').find({ userId: { $in: values } }).sort({ timestamp: -1 }).limit(150).toArray(),
        workspaceId ? db.collection('traces').find({ workspaceId }).sort({ startTime: -1 }).limit(60).toArray() : [],
        db.collection('monitors').find({ userId: { $in: values }, ...(workspaceId ? { workspaceId } : {}) }).project({ name: 1, url: 1, method: 1, collectionId: 1, currentStatus: 1 }).limit(100).toArray(),
        db.collection('documentation').findOne({ collectionId: String(collection._id) }, { projection: { content: 1, title: 1 } })
    ]);
    const evidence = [];
    histories.forEach((entry) => {
        const exact = String(entry.collectionRequestId || entry.originalRequestId || '') === requestId;
        const inferred = !exact && method === String(entry.method || '').toUpperCase() && normalizedUrl(entry.url) === url;
        if (exact || inferred) evidence.push(fact('usage', 'info', `Request history: ${entry.method} ${entry.url}`, safeDate(entry.timestamp) || '', { relation: exact ? 'confirmed' : 'inferred', confidenceReason: exact ? 'Stored request ID matches.' : 'Method and normalized URL match.', deepLink: `/workspace/history/${entry._id}` }));
    });
    traces.forEach((trace) => {
        const generated = (trace.generated || []).some((item) => String(item.requestId) === requestId && String(item.collectionId) === String(collection._id));
        const matchedSpan = (trace.spans || []).find((span) => method === String(span.httpMethod || '').toUpperCase() && (normalizedUrl(span.url) === url || routeOf(span.route || span.url) === route));
        if (generated || matchedSpan) evidence.push(fact('usage', 'info', `Trace ${trace.traceId} · ${trace.rootServiceName || 'service'}`, matchedSpan?.name || trace.route || '', { relation: generated ? 'confirmed' : 'inferred', confidenceReason: generated ? 'Trace stores the generated collection and request IDs.' : 'HTTP method and normalized URL or route match.', deepLink: `/workspace/trace-to-test?workspaceId=${collection.workspaceId}&traceId=${encodeURIComponent(trace.traceId)}` }));
    });
    monitors.forEach((monitor) => {
        const exact = String(monitor.collectionId || '') === String(collection._id);
        const inferred = !exact && method === String(monitor.method || '').toUpperCase() && normalizedUrl(monitor.url) === url;
        if (exact || inferred) evidence.push(fact('usage', monitor.currentStatus === 'down' ? 'warning' : 'info', `Monitor: ${monitor.name}`, `${monitor.method || 'GET'} ${monitor.url}`, { relation: exact ? 'confirmed' : 'inferred', confidenceReason: exact ? 'Monitor stores the collection ID.' : 'Method and normalized URL match.', deepLink: `/workspace/monitoring/${monitor._id}/history` }));
    });
    collections.forEach((candidate) => (candidate.requests || []).forEach((candidateRequest) => {
        if (String(candidate._id) === String(collection._id) && requestIdOf(candidateRequest) === requestId) return;
        if (method === String(candidateRequest.method || '').toUpperCase() && routeOf(candidateRequest.url) === route) evidence.push(fact('usage', 'info', `${candidate.name}: ${candidateRequest.name || route}`, candidateRequest.url || '', { relation: 'inferred', confidenceReason: 'HTTP method and route match another saved request.', deepLink: `/workspace/collections/${candidate._id}?request=${encodeURIComponent(requestIdOf(candidateRequest))}` }));
    }));
    if (documentation?.content && (documentation.content.includes(request.url) || documentation.content.includes(route))) evidence.push(fact('usage', 'info', documentation.title || 'Collection documentation', `Documentation mentions ${documentation.content.includes(request.url) ? request.url : route}.`, { relation: 'inferred', confidenceReason: 'Canonical documentation contains the endpoint URL or route.', deepLink: `/workspace/collections/${collection._id}/documentation` }));
    return compactFacts(evidence);
}

async function resolveWorkspace(descriptor, user) {
    const workspace = await loadWorkspace(descriptor.id || descriptor.workspaceId, user);
    if (!workspace) return null;
    const db = getDb();
    const [collections, traces, incidents] = await Promise.all([
        db.collection('collections').countDocuments({ workspaceId: workspace._id, ...collectionAccessFilter(user) }),
        db.collection('traces').countDocuments({ workspaceId: workspace._id }),
        db.collection('incidents').countDocuments({ workspaceId: workspace._id })
    ]);
    return envelope({ descriptor, label: workspace.name, workspaceId: workspace._id, deepLink: `/workspace/workspaces/${workspace._id}`, data: { name: workspace.name, description: workspace.description, collections, traces, incidents, updatedAt: safeDate(workspace.updatedAt) }, evidence: [fact('workspace', 'info', `${collections} collections · ${traces} traces · ${incidents} incidents`, workspace.description || '')] });
}

async function resolveCollection(descriptor, user, prompt, legacyCollectionResolver) {
    const legacy = legacyCollectionResolver ? (await legacyCollectionResolver({ type: 'collection', id: String(descriptor.id) }))[0] : null;
    if (legacy?.text) {
        const data = JSON.parse(legacy.text);
        const evidence = [fact('collection', 'info', `${data.requestCount || (data.requests || []).length} saved requests`, data.description || '')];
        if (!data.documentation?.content) evidence.push(fact('documentation', 'warning', 'Collection documentation is empty', 'Add an overview and endpoint guidance.'));
        if (/where\s+.*used|usage|consumer|depend/i.test(prompt || '')) {
            const collection = await loadCollection(descriptor.id, user);
            if (!collection) return null;
            const selectedRequest = (collection.requests || []).find((item) => requestIdOf(item) === String(descriptor.requestId || '')) || (collection.requests || [])[0];
            evidence.push(...await usageEvidence(collection, selectedRequest, user));
        }
        return envelope({ descriptor, label: legacy.label, workspaceId: legacy.workspaceId, deepLink: `/workspace/collections/${descriptor.id}`, data, evidence });
    }
    const collection = await loadCollection(descriptor.id, user);
    if (!collection) return null;
    const evidence = [fact('collection', 'info', `${(collection.requests || []).length} saved requests`, collection.description || '')];
    if (!collection.documentation?.content) evidence.push(fact('documentation', 'warning', 'Collection documentation is empty', 'Add an overview and endpoint guidance.'));
    if (/where\s+.*used|usage|consumer|depend/i.test(prompt || '')) {
        const selectedRequest = (collection.requests || []).find((item) => requestIdOf(item) === String(descriptor.requestId || '')) || (collection.requests || [])[0];
        evidence.push(...await usageEvidence(collection, selectedRequest, user));
    }
    return envelope({ descriptor, label: collection.name, workspaceId: collection.workspaceId, deepLink: `/workspace/collections/${collection._id}`, data: { name: collection.name, description: collection.description, requestCount: (collection.requests || []).length }, evidence });
}

async function resolveRequest(descriptor, user, prompt) {
    const collection = await loadCollection(descriptor.parentId || descriptor.collectionId || descriptor.workspaceResourceId, user);
    if (!collection) return null;
    const request = (collection.requests || []).find((item) => requestIdOf(item) === String(descriptor.id));
    if (!request) return null;
    const evidence = requestEvidence(request);
    const recentHistory = await recentHistoryForRequest(collection, request, user);
    recentHistory.forEach((entry, index) => historyEvidence(entry).forEach((entryFact) => evidence.push({
        ...entryFact,
        id: `${entryFact.id}-history-${index}`,
        deepLink: `/workspace/history/${entry._id}`
    })));
    if (/where\s+.*used|usage|consumer|depend/i.test(prompt || '')) evidence.push(...await usageEvidence(collection, request, user));
    return envelope({
        descriptor,
        label: `${request.method} ${request.name}`,
        workspaceId: collection.workspaceId,
        deepLink: `/workspace/collections/${collection._id}?request=${encodeURIComponent(requestIdOf(request))}`,
        data: {
            collectionId: String(collection._id), collectionName: collection.name, id: requestIdOf(request), name: request.name,
            method: request.method, url: request.url, description: request.description, protocol: request.protocol,
            recentExecutions: recentHistory.map((entry) => ({ id: String(entry._id), status: entry.responseStatus, statusText: entry.responseStatusText, durationMs: entry.duration, timestamp: safeDate(entry.timestamp), testResults: parseTestResults(entry.testResults).slice(0, 12) })),
            headers: (request.headers || []).map((header) => ({ name: header.name || header.key, value: /authorization|token|secret|key/i.test(header.name || header.key || '') ? '[REDACTED]' : truncate(header.value || '', 160), enabled: header.enabled }))
        },
        evidence
    });
}

async function resolveHistory(descriptor, user) {
    const id = asId(descriptor.id);
    if (!id) return null;
    const history = await getDb().collection('histories').findOne({ _id: id, userId: { $in: userValues(user) } });
    if (!history) return null;
    let workspaceId = null;
    if (history.collectionId) workspaceId = (await loadCollection(history.collectionId, user))?.workspaceId || null;
    return envelope({ descriptor, label: `${history.method || 'GET'} ${routeOf(history.url)}`, workspaceId, deepLink: `/workspace/history/${history._id}`, data: { method: history.method, url: history.url, status: history.responseStatus, statusText: history.responseStatusText, durationMs: history.duration, responseBody: redactBody(history.responseBody || '', 1600), timestamp: safeDate(history.timestamp), collectionId: history.collectionId || null, requestId: history.collectionRequestId || history.originalRequestId || null }, evidence: historyEvidence(history) });
}

async function governanceContext(collection, user) {
    const db = getDb();
    const values = userValues(user);
    const workspaceId = asId(collection.workspaceId);
    const [monitors, environments, versions, auditEventCount] = await Promise.all([
        db.collection('monitors').find({ userId: { $in: values }, ...(workspaceId ? { workspaceId } : {}) }).project({ url: 1, tags: 1, isActive: 1, currentStatus: 1, collectionId: 1 }).toArray(),
        db.collection('environments').find({ userId: { $in: values }, ...(workspaceId ? { workspaceId } : {}) }).project({ name: 1, type: 1 }).toArray(),
        db.collection('apiversions').find({ collectionId: collection._id }).project({ isDeprecated: 1, version: 1 }).toArray(),
        db.collection('auditevents').countDocuments({ targetId: { $in: [collection._id, String(collection._id)] } })
    ]);
    return scoreCollection(collection, { monitors, environments, versions, auditEventCount, workspaceId: collection.workspaceId });
}

async function resolveGovernance(descriptor, user) {
    const collection = await loadCollection(descriptor.id, user);
    if (!collection) return null;
    const score = await governanceContext(collection, user);
    const evidence = [fact('governance', score.score < 50 ? 'error' : score.score < 80 ? 'warning' : 'success', `Governance score ${score.score}/100`, `Documentation ${score.categories.documentation}, security ${score.categories.security}, request quality ${score.categories.requestQuality}`)];
    (score.recommendations || []).slice(0, 12).forEach((recommendation) => evidence.push(fact('governance', recommendation.severity === 'high' ? 'error' : 'warning', recommendation.title || recommendation.message || 'Governance recommendation', recommendation.detail || recommendation.description || '')));
    return envelope({ descriptor, label: `${collection.name} governance`, workspaceId: collection.workspaceId, deepLink: `/workspace/governance?workspaceId=${collection.workspaceId}&collectionId=${collection._id}`, data: score, evidence });
}

async function resolveTrace(descriptor, user) {
    const query = descriptor.id && asId(descriptor.id) ? { _id: asId(descriptor.id) } : { traceId: String(descriptor.id || '') };
    if (descriptor.workspaceId && asId(descriptor.workspaceId)) query.workspaceId = asId(descriptor.workspaceId);
    const trace = await getDb().collection('traces').findOne(query);
    if (!trace || !(await loadWorkspace(trace.workspaceId, user))) return null;
    return envelope({ descriptor, label: `${trace.rootServiceName || 'Trace'} · ${trace.route || trace.rootSpanName || trace.traceId}`, workspaceId: trace.workspaceId, deepLink: `/workspace/trace-to-test?workspaceId=${trace.workspaceId}&traceId=${encodeURIComponent(trace.traceId)}`, data: { traceId: trace.traceId, rootServiceName: trace.rootServiceName, route: trace.route, method: trace.httpMethod, status: trace.httpStatusCode, durationMs: trace.durationMs, services: trace.services, spanCount: trace.spanCount, errorCount: trace.errorCount, startTime: safeDate(trace.startTime), deploymentVersion: trace.deploymentVersion, environment: trace.environment }, evidence: traceEvidence(trace) });
}

async function loadRun(descriptor, user) {
    const id = asId(descriptor.id);
    if (!id) return null;
    const kind = String(descriptor.kind || descriptor.runType || '');
    const ownerIds = userValues(user);
    const ownerObjectIds = ownerIds.map(asId).filter(Boolean);
    if (!ownerObjectIds.length) return null;
    if (kind === 'load') {
        const LoadTestRun = require('../models/LoadTestRun');
        const LoadTest = require('../models/LoadTest');
        const run = await LoadTestRun.findOne({ _id: id, owner: { $in: ownerObjectIds } }).lean();
        if (!run) return null;
        const test = await LoadTest.findOne({ _id: run.loadTestId, owner: { $in: ownerObjectIds } }).lean();
        return { run, label: test?.name || 'Load test run', workspaceId: null, deepLink: `/workspace/performance-tests?test=${run.loadTestId}&run=${run._id}` };
    }
    const mappings = {
        asyncapi: ['../models/AsyncApiTestRun', '../models/AsyncApiDocument', 'documentId'],
        evaluation: ['../models/EvaluationRun', '../models/EvaluationSuite', 'suiteId'],
        consumer_contract: ['../models/ConsumerContractRun', '../models/ConsumerContract', 'contractId']
    };
    if (kind === 'fuzz') {
        const FuzzRun = require('../models/FuzzRun');
        const run = await FuzzRun.findById(id).lean();
        const collection = run ? await loadCollection(run.collectionId, user) : null;
        if (!run || !collection || !ownerIds.some((owner) => String(owner) === String(run.userId))) return null;
        return { run, label: `${collection.name} fuzz run`, workspaceId: collection.workspaceId, deepLink: `/workspace/collections/${collection._id}?tab=fuzz-testing&run=${run._id}` };
    }
    const mapping = mappings[kind];
    if (!mapping) return null;
    const RunModel = require(mapping[0]);
    const ParentModel = require(mapping[1]);
    const run = await RunModel.findById(id).lean();
    if (!run) return null;
    if (run.owner && !ownerIds.some((owner) => String(owner) === String(run.owner))) return null;
    if (run.workspaceId && !(await loadWorkspace(run.workspaceId, user))) return null;
    const parent = await ParentModel.findById(run[mapping[2]]).lean();
    const resolvedWorkspaceId = run.workspaceId || parent?.workspaceId || null;
    return {
        run,
        label: parent?.name || `${kind.replace('_', ' ')} run`,
        workspaceId: resolvedWorkspaceId,
        deepLink: kind === 'asyncapi'
            ? `/workspace/asyncapi?workspaceId=${resolvedWorkspaceId}&document=${run.documentId}&run=${run._id}`
            : kind === 'evaluation'
                ? `/workspace/collections/${run.collectionId}?tab=evaluation&suite=${run.suiteId}&run=${run._id}`
                : `/workspace/consumer-contracts?workspaceId=${resolvedWorkspaceId}&contract=${run.contractId}&run=${run._id}`
    };
}

async function resolveRun(descriptor, user) {
    const loaded = await loadRun(descriptor, user);
    if (!loaded) return null;
    return envelope({ descriptor, label: loaded.label, workspaceId: loaded.workspaceId, deepLink: loaded.deepLink, data: { ...loaded.run, transcript: loaded.run.transcript ? truncate(loaded.run.transcript, 2200) : undefined, requestPayload: loaded.run.requestPayload ? redactBody(loaded.run.requestPayload, 1200) : undefined, responsePayload: loaded.run.responsePayload ? redactBody(loaded.run.responsePayload, 1200) : undefined }, evidence: violationsFromRun(loaded.run) });
}

async function resolveIncident(descriptor, user) {
    const id = asId(descriptor.id);
    if (!id) return null;
    const incident = await getDb().collection('incidents').findOne({ _id: id });
    if (!incident || !incident.workspaceId || !(await loadWorkspace(incident.workspaceId, user))) return null;
    const evidence = [fact('incident', ['critical', 'high'].includes(incident.severity) ? 'error' : 'warning', `${incident.severity || 'medium'} · ${incident.status || 'open'}`, incident.description || '')];
    (incident.affectedServices || []).slice(0, 8).forEach((service) => evidence.push(fact('service', service.status === 'outage' ? 'error' : service.status === 'degraded' ? 'warning' : 'info', service.serviceName || service.component || 'Affected service', service.status || '')));
    [...(incident.timeline || []), ...(incident.updates || [])].slice(-10).forEach((entry) => evidence.push(fact('timeline', 'info', entry.message || entry.type || 'Incident update', safeDate(entry.at || entry.timestamp) || '')));
    return envelope({ descriptor, label: incident.title, workspaceId: incident.workspaceId, deepLink: `/workspace/monitoring/incidents?incident=${incident._id}`, data: { title: incident.title, description: incident.description, status: incident.status, severity: incident.severity, priority: incident.priority, tags: incident.tags, detection: incident.detection, createdAt: safeDate(incident.createdAt), acknowledgedAt: safeDate(incident.acknowledgedAt), resolvedAt: safeDate(incident.resolvedAt), metrics: incident.metrics }, evidence });
}

async function resolveDescriptor(descriptor, user, prompt, legacyCollectionResolver) {
    switch (descriptor.type) {
        case 'workspace': return resolveWorkspace(descriptor, user);
        case 'collection': return resolveCollection(descriptor, user, prompt, legacyCollectionResolver);
        case 'request': return resolveRequest(descriptor, user, prompt);
        case 'history': return resolveHistory(descriptor, user);
        case 'governance': return resolveGovernance(descriptor, user);
        case 'trace': return resolveTrace(descriptor, user);
        case 'test_run': return resolveRun(descriptor, user);
        case 'incident': return resolveIncident(descriptor, user);
        default: return null;
    }
}

function normalizeDescriptors({ activeContext, pinnedSources, sources }) {
    const values = [];
    if (activeContext?.type) values.push({ ...activeContext, origin: 'active' });
    (Array.isArray(pinnedSources) ? pinnedSources : []).forEach((source) => values.push({ ...source, origin: 'pinned' }));
    if (!values.length) (Array.isArray(sources) ? sources : []).forEach((source) => values.push({ ...source, origin: 'pinned' }));
    const seen = new Set();
    return values.filter((source) => SOURCE_TYPES.has(source?.type) && source.id).filter((source) => {
        const key = `${source.type}:${source.id}:${source.parentId || source.kind || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).slice(0, MAX_SOURCES);
}

async function resolveContext(input, user, prompt, legacyCollectionResolver) {
    const descriptors = normalizeDescriptors(input || {});
    if (!descriptors.length) return { items: [], snapshot: [], resolvedContext: [], findings: [], workspaceId: null };
    const resolved = (await Promise.all(descriptors.map((descriptor) => resolveDescriptor(descriptor, user, prompt, legacyCollectionResolver)))).filter(Boolean);
    if (resolved.length !== descriptors.length) throw new Error('One or more selected context sources are unavailable.');
    const perSourceBudget = Math.max(1800, Math.floor(MAX_TOTAL_CONTEXT_CHARS / Math.max(1, resolved.length)));
    resolved.forEach((item) => fitItemToBudget(item, perSourceBudget));
    const workspaceIds = [...new Set(resolved.map((item) => item.workspaceId).filter(Boolean))];
    const activeWorkspaceId = resolved.find((item) => item.origin === 'active')?.workspaceId || null;
    if (workspaceIds.length > 1 && activeWorkspaceId) throw new Error('Pinned sources must belong to the active workspace.');
    const findings = compactFacts(resolved.flatMap((item) => item.evidence.filter((entry) => ['error', 'warning'].includes(entry.status) || entry.kind === 'usage').map((entry) => ({ ...entry, sourceType: item.type, sourceId: item.id, sourceLabel: item.label, deepLink: entry.deepLink || item.deepLink }))));
    const snapshot = resolved.map(({ type, id, label, workspaceId, origin, deepLink, capturedAt, fingerprint: sourceFingerprint, evidence, text }) => ({ type, id, label, workspaceId, origin, deepLink, capturedAt, fingerprint: sourceFingerprint, evidence, content: text }));
    return { items: resolved, snapshot, resolvedContext: snapshot.map(({ evidence, content, ...source }) => ({ ...source, evidenceCount: evidence.length })), findings, workspaceId: workspaceIds[0] || null };
}

async function listSources({ workspaceId, query = '', types = [] }, user) {
    const db = getDb();
    const wsId = asId(workspaceId);
    if (wsId && !(await loadWorkspace(wsId, user))) return [];
    const allowedTypes = new Set((Array.isArray(types) ? types : String(types || '').split(',')).filter((type) => SOURCE_TYPES.has(type)));
    const include = (type) => !allowedTypes.size || allowedTypes.has(type);
    const values = userValues(user);
    const regex = query ? new RegExp(String(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;
    const runSourcesPromise = include('test_run') ? listRunSources(wsId, user) : Promise.resolve([]);
    const [collections, histories, traces, incidents, workspaces, runSources] = await Promise.all([
        include('collection') || include('request') || include('governance') ? db.collection('collections').find({ ...collectionAccessFilter(user), ...(wsId ? { workspaceId: wsId } : {}) }).project({ name: 1, workspaceId: 1, requests: 1 }).limit(60).toArray() : [],
        include('history') ? db.collection('histories').find({ userId: { $in: values }, ...(regex ? { $or: [{ url: regex }, { method: regex }] } : {}) }).sort({ timestamp: -1 }).limit(30).toArray() : [],
        include('trace') && wsId ? db.collection('traces').find({ workspaceId: wsId, ...(regex ? { $or: [{ traceId: regex }, { route: regex }, { rootServiceName: regex }] } : {}) }).sort({ startTime: -1 }).limit(30).toArray() : [],
        include('incident') && wsId ? db.collection('incidents').find({ workspaceId: wsId, ...(regex ? { title: regex } : {}) }).sort({ createdAt: -1 }).limit(30).toArray() : [],
        include('workspace') ? db.collection('workspaces').find({ ...workspaceAccessFilter(user), ...(wsId ? { _id: wsId } : {}), ...(regex ? { name: regex } : {}) }).project({ name: 1 }).limit(30).toArray() : [],
        runSourcesPromise
    ]);
    const sources = [];
    workspaces.forEach((workspace) => sources.push({ type: 'workspace', id: String(workspace._id), workspaceId: String(workspace._id), label: workspace.name, detail: 'Workspace overview' }));
    collections.forEach((collection) => {
        if (include('collection') && (!regex || regex.test(collection.name || ''))) sources.push({ type: 'collection', id: String(collection._id), workspaceId: idOf(collection.workspaceId), label: collection.name, detail: `${(collection.requests || []).length} requests` });
        if (include('governance') && (!regex || regex.test(collection.name || ''))) sources.push({ type: 'governance', id: String(collection._id), workspaceId: idOf(collection.workspaceId), label: `${collection.name} governance`, detail: 'Score and recommendations' });
        if (include('request')) (collection.requests || []).forEach((request) => {
            const requestId = requestIdOf(request);
            if (!requestId) return;
            const label = `${request.method || 'GET'} ${request.name || routeOf(request.url)}`;
            if (!regex || regex.test(label) || regex.test(request.url || '')) sources.push({ type: 'request', id: requestId, parentId: String(collection._id), workspaceId: idOf(collection.workspaceId), label, detail: collection.name });
        });
    });
    histories.forEach((history) => sources.push({ type: 'history', id: String(history._id), workspaceId: '', label: `${history.method || 'GET'} ${routeOf(history.url)}`, detail: `${history.responseStatus || 'No status'} · ${safeDate(history.timestamp) || ''}` }));
    traces.forEach((trace) => sources.push({ type: 'trace', id: trace.traceId, workspaceId: idOf(trace.workspaceId), label: `${trace.rootServiceName || 'Trace'} · ${trace.route || trace.traceId}`, detail: trace.hasError ? 'Contains errors' : `${trace.durationMs || 0} ms` }));
    incidents.forEach((incident) => sources.push({ type: 'incident', id: String(incident._id), workspaceId: idOf(incident.workspaceId), label: incident.title, detail: `${incident.severity || 'medium'} · ${incident.status || 'open'}` }));
    runSources.filter((source) => !regex || regex.test(source.label) || regex.test(source.detail || '')).forEach((source) => sources.push(source));
    return sources.slice(0, 120);
}

async function listRunSources(workspaceId, user) {
    const ownerIds = userValues(user).map(asId).filter(Boolean);
    if (!ownerIds.length) return [];
    const EvaluationRun = require('../models/EvaluationRun');
    const AsyncApiTestRun = require('../models/AsyncApiTestRun');
    const LoadTestRun = require('../models/LoadTestRun');
    const FuzzRun = require('../models/FuzzRun');
    const ConsumerContractRun = require('../models/ConsumerContractRun');
    const workspaceFilter = workspaceId ? { workspaceId } : {};
    const [evaluation, asyncapi, load, fuzz, contracts] = await Promise.all([
        EvaluationRun.find({ owner: { $in: ownerIds }, ...workspaceFilter }).sort({ createdAt: -1 }).limit(15).lean(),
        AsyncApiTestRun.find({ owner: { $in: ownerIds }, ...workspaceFilter }).sort({ createdAt: -1 }).limit(15).lean(),
        workspaceId ? [] : LoadTestRun.find({ owner: { $in: ownerIds } }).sort({ createdAt: -1 }).limit(15).lean(),
        FuzzRun.find({ userId: { $in: ownerIds }, ...workspaceFilter }).sort({ createdAt: -1 }).limit(15).lean(),
        ConsumerContractRun.find({ owner: { $in: ownerIds }, ...workspaceFilter }).sort({ createdAt: -1 }).limit(15).lean()
    ]);
    const describe = (run) => `${run.status || 'unknown'} · ${safeDate(run.createdAt) || ''}`;
    return [
        ...evaluation.map((run) => ({ type: 'test_run', kind: 'evaluation', id: String(run._id), workspaceId: idOf(run.workspaceId), label: `Agent evaluation · ${run.score || run.status}`, detail: describe(run) })),
        ...asyncapi.map((run) => ({ type: 'test_run', kind: 'asyncapi', id: String(run._id), workspaceId: idOf(run.workspaceId), label: `AsyncAPI ${run.protocol || ''} ${run.channel || ''}`.trim(), detail: describe(run) })),
        ...load.map((run) => ({ type: 'test_run', kind: 'load', id: String(run._id), workspaceId: '', label: `Load test · ${run.status}`, detail: describe(run) })),
        ...fuzz.map((run) => ({ type: 'test_run', kind: 'fuzz', id: String(run._id), workspaceId: idOf(run.workspaceId), label: `Fuzz run · ${run.operation || run.sourceType}`, detail: `${run.failed || 0} failed · ${safeDate(run.createdAt) || ''}` })),
        ...contracts.map((run) => ({ type: 'test_run', kind: 'consumer_contract', id: String(run._id), workspaceId: idOf(run.workspaceId), label: `Consumer contract · ${run.status}`, detail: `${run.failedCount || 0} failed · ${safeDate(run.createdAt) || ''}` }))
    ];
}

module.exports = { resolveContext, listSources, normalizeDescriptors, compactFacts, historyEvidence, traceEvidence, violationsFromRun, usageEvidence };
