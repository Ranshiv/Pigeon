const express = require('express');
const { ObjectId } = require('mongodb');
const { ensureAuthenticated } = require('../middleware/auth');
const { getDb } = require('../config/db');
const { buildOpenApiCases, buildGraphQlCases } = require('../services/SchemaFuzzingService');

const router = express.Router();
const asId = (value) => ObjectId.isValid(value) ? new ObjectId(value) : null;
// Saved Pigeon requests commonly use {{baseUrl}} templates. Strip the origin
// template before comparing against OpenAPI's canonical path.
const pathOf = (url = '') => {
    const normalized = String(url).replace(/\{\{[^}]+\}\}/g, '').split('?')[0] || '/';
    try { return new URL(normalized).pathname || '/'; } catch { return normalized.startsWith('/') ? normalized : `/${normalized}`; }
};
const graphQlConfig = (request) => {
    const graphql = request?.graphql || {};
    if (graphql.query) return graphql;
    try {
        const parsed = typeof request?.body === 'string' ? JSON.parse(request.body) : request?.body;
        return parsed?.query ? { ...graphql, query: parsed.query, variables: parsed.variables || graphql.variables || {} } : graphql;
    } catch { return graphql; }
};
const collectionForUser = async (db, collectionId, userId) => {
    const id = asId(collectionId); if (!id) return null;
    const userObjectId = asId(userId);
    return db.collection('collections').findOne({ _id: id, $or: [{ owner: userId }, { userId }, ...(userObjectId ? [{ owner: userObjectId }, { userId: userObjectId }] : []), { collaborators: { $elemMatch: { userId } } }, ...(userObjectId ? [{ collaborators: { $elemMatch: { userId: userObjectId } } }] : [])] });
};
const redact = (value, key = '') => {
    if (/password|secret|token|authorization|api[-_]?key/i.test(key)) return '[REDACTED]';
    if (Array.isArray(value)) return value.map((item) => redact(item));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, redact(item, name)]));
    return value;
};

router.get('/collections/:collectionId/sources', ensureAuthenticated, async (req, res) => {
    try {
        const db = getDb(); const collection = await collectionForUser(db, req.params.collectionId, req.user.id);
        if (!collection) return res.status(404).json({ message: 'Collection not found.' });
        const versions = await db.collection('apiversions').find({ collectionId: collection._id, openApiSpec: { $ne: null } }).toArray();
        const openapi = versions.flatMap((version) => Object.entries(version.openApiSpec?.paths || {}).flatMap(([path, methods]) => Object.entries(methods || {}).filter(([method, operation]) => ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(method) && operation && typeof operation === 'object').map(([method, operation]) => {
            const request = (collection.requests || []).find((item) => String(item.method || '').toLowerCase() === method && pathOf(item.url) === path);
            return { versionId: String(version._id), version: version.version, path, method: method.toUpperCase(), operationId: operation.operationId || '', requestId: request ? String(request._id || request.id) : null, executable: Boolean(request) };
        })));
        // List GraphQL requests even before an SDL is attached so the UI can
        // explain the missing prerequisite instead of appearing empty.
        const graphql = (collection.requests || []).filter((item) => {
            const config = graphQlConfig(item);
            return item.protocol === 'graphql' || item.method === 'GRAPHQL' || Boolean(config.query);
        }).map((item) => {
            const config = graphQlConfig(item);
            return { requestId: String(item._id || item.id), name: item.name, operationName: config.operationName || '', executable: Boolean(config.schema && config.query), setupMessage: config.schema ? '' : 'Add an SDL schema to this saved GraphQL request to generate schema-driven cases.' };
        });
        res.json({ openapi, graphql });
    } catch (error) { res.status(500).json({ message: error.message || 'Could not load fuzzing sources.' }); }
});

router.post('/collections/:collectionId/preview', ensureAuthenticated, async (req, res) => {
    try {
        const db = getDb(); const collection = await collectionForUser(db, req.params.collectionId, req.user.id);
        if (!collection) return res.status(404).json({ message: 'Collection not found.' });
        const { sourceType, versionId, path, method, requestId } = req.body || {}; let cases;
        if (sourceType === 'openapi') {
            const version = await db.collection('apiversions').findOne({ _id: asId(versionId), collectionId: collection._id });
            if (!version?.openApiSpec) return res.status(400).json({ message: 'OpenAPI version not found.' });
            const request = (collection.requests || []).find((item) => String(item.method || '').toUpperCase() === String(method || '').toUpperCase() && pathOf(item.url) === path);
            if (!request) return res.status(400).json({ message: 'This OpenAPI operation needs a matching saved collection request before it can run.' });
            cases = buildOpenApiCases(version.openApiSpec, path, method);
        } else if (sourceType === 'graphql') {
            const request = (collection.requests || []).find((item) => String(item._id || item.id) === String(requestId)); const config = graphQlConfig(request);
            if (!config?.schema || !config.query) return res.status(400).json({ message: 'Add both an SDL schema and query to this saved GraphQL request before generating schema-driven cases.' });
            cases = buildGraphQlCases(config.schema, config.query, config.variables || {});
        } else return res.status(400).json({ message: 'sourceType must be openapi or graphql.' });
        res.json({ cases: cases.map((item) => ({ ...item, overrides: redact(item.overrides) })) });
    } catch (error) { res.status(400).json({ message: error.message || 'Could not generate fuzz cases.' }); }
});

router.post('/collections/:collectionId/runs', ensureAuthenticated, async (req, res) => {
    try {
        const db = getDb(); const collection = await collectionForUser(db, req.params.collectionId, req.user.id);
        if (!collection) return res.status(404).json({ message: 'Collection not found.' });
        const body = req.body || {}; if (!body.acknowledgedTestEnvironment) return res.status(400).json({ message: 'Confirm that the target is a non-production test environment before running fuzz tests.' });
        if (!['openapi', 'graphql', 'request-body'].includes(body.sourceType) || !Array.isArray(body.cases) || !body.cases.length) return res.status(400).json({ message: 'A source type and at least one completed test case are required.' });
        const safeCases = body.cases.slice(0, 100).map((item) => ({ id: String(item.id || ''), category: String(item.category || ''), name: String(item.name || ''), mutation: String(item.mutation || ''), overrides: redact(item.overrides || {}), status: String(item.status || ''), responseStatus: Number(item.responseStatus || 0), duration: Number(item.duration || 0), error: String(item.error || '') }));
        const completed = safeCases.filter((item) => item.status === 'completed').length;
        const run = { collectionId: collection._id, workspaceId: collection.workspaceId || null, sourceType: body.sourceType, sourceId: String(body.sourceId || ''), operation: String(body.operation || ''), environmentName: String(body.environmentName || ''), userId: asId(req.user.id), status: completed === safeCases.length ? 'completed' : 'failed', total: safeCases.length, passed: safeCases.filter((item) => item.responseStatus > 0 && item.responseStatus < 500).length, failed: safeCases.filter((item) => item.responseStatus === 0 || item.responseStatus >= 500).length, cases: safeCases, createdAt: new Date() };
        const result = await db.collection('fuzzruns').insertOne(run); res.status(201).json({ run: { ...run, _id: String(result.insertedId) } });
    } catch (error) { res.status(500).json({ message: error.message || 'Could not save fuzz run.' }); }
});

router.get('/collections/:collectionId/runs', ensureAuthenticated, async (req, res) => {
    try { const db = getDb(); const collection = await collectionForUser(db, req.params.collectionId, req.user.id); if (!collection) return res.status(404).json({ message: 'Collection not found.' }); const runs = await db.collection('fuzzruns').find({ collectionId: collection._id }).sort({ createdAt: -1 }).limit(30).toArray(); res.json({ runs }); } catch (error) { res.status(500).json({ message: error.message || 'Could not load fuzz history.' }); }
});

module.exports = router;
