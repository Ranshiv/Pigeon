const path = require('path');
const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { ObjectId } = require('mongodb');
const ApiVersion = require('../models/ApiVersion');
const IntegrationService = require('../services/IntegrationService');
const { ensureAuthenticated } = require('../middleware/auth');
const { getDb } = require('../config/db');
const { findCollectionForUser, isCollectionOwnerOrAdmin, userIdOf } = require('../services/CollectionAccessService');
const {
    DocumentationInputError,
    parseOpenApi,
    normalizeOpenApi,
    mergeGeneratedSections,
    scanSecrets,
    sourceHash
} = require('../services/OpenApiDocumentationService');
const { queueGeneration, startDocumentationGenerationWorker } = require('../services/DocumentationGenerationService');

const router = express.Router();
startDocumentationGenerationWorker();
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const generationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { code: 'GENERATION_RATE_LIMIT', message: 'Too many documentation generations. Try again later.' }
});
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { files: 1, fileSize: MAX_IMPORT_BYTES },
    fileFilter: (req, file, callback) => {
        const extension = path.extname(file.originalname || '').toLowerCase();
        return ['.json', '.yaml', '.yml'].includes(extension) ? callback(null, true) : callback(new DocumentationInputError('Choose a .json, .yaml, or .yml OpenAPI file.', 'INVALID_FILE_TYPE'));
    }
});

let indexPromise;
function ensureIndexes(db) {
    if (!indexPromise) indexPromise = Promise.all([
        db.collection('documentation').createIndex({ collectionId: 1 }, { unique: true, name: 'documentation_collection_unique' }),
        db.collection('documentationVersions').createIndex({ collectionId: 1, createdAt: -1 }),
        db.collection('documentationGenerationRuns').createIndex({ collectionId: 1, createdAt: -1 }),
        db.collection('documentationGenerationRuns').createIndex({ status: 1, leaseUntil: 1 })
    ]).catch((error) => console.warn('[Documentation indexes]', error.message));
    return indexPromise;
}

const objectIdForUser = (user) => ObjectId.isValid(userIdOf(user)) ? new ObjectId(userIdOf(user)) : userIdOf(user);
const documentResponse = (document, collectionId) => document ? { ...document, _id: document._id?.toString?.() || document._id, collectionId, revision: Number(document.revision || 0), isNew: false } : { title: '', content: '', collectionId, settings: {}, revision: 0, isNew: true };

async function canonicalDocument(db, collection) {
    const collectionId = String(collection._id);
    const stored = await db.collection('documentation').findOne({ collectionId });
    if (stored) return stored;
    if (collection.documentation && (collection.documentation.content || Object.keys(collection.documentation.settings || {}).length)) {
        return {
            title: collection.documentation.title || `${collection.name} Documentation`,
            content: collection.documentation.content || '',
            collectionId,
            settings: collection.documentation.settings || {},
            revision: 0,
            createdAt: collection.createdAt || new Date(),
            updatedAt: collection.documentation.lastModifiedAt || collection.updatedAt || new Date(),
            legacyFallback: true
        };
    }
    return null;
}

async function recordVersion(db, document, user, source = 'manual', message = 'Documentation updated') {
    if (!document) return;
    await db.collection('documentationVersions').insertOne({
        collectionId: String(document.collectionId),
        title: document.title || '', content: document.content || '', settings: document.settings || {}, revision: Number(document.revision || 0),
        source, message, sourceVersionId: document.sourceVersionId || null, provenance: document.provenance || null,
        createdBy: objectIdForUser(user), createdAt: new Date()
    });
}

async function saveCanonicalDocument(db, collection, user, input, expectedRevision, metadata = {}) {
    const collectionId = String(collection._id);
    const existing = await canonicalDocument(db, collection);
    const currentRevision = Number(existing?.revision || 0);
    if (Number(expectedRevision) !== currentRevision) {
        const error = new Error('Documentation changed after this editor loaded it. Refresh and review the latest version.');
        error.statusCode = 409;
        error.current = documentResponse(existing, collectionId);
        throw error;
    }
    const now = new Date();
    const next = {
        title: String(input.title || existing?.title || `${collection.name} Documentation`).slice(0, 300),
        content: typeof input.content === 'string' ? input.content : (existing?.content || ''),
        // Every content/settings revision returns to private review. Publishing
        // is the only path that can set isPublic=true after secret validation.
        settings: { ...(input.settings && typeof input.settings === 'object' ? input.settings : (existing?.settings || {})), isPublic: false },
        collectionId,
        revision: currentRevision + 1,
        updatedAt: now,
        updatedBy: objectIdForUser(user),
        ...metadata
    };
    if (!existing || existing.legacyFallback) next.createdAt = existing?.createdAt || now;
    const filter = existing && !existing.legacyFallback ? { _id: existing._id, revision: existing.revision || { $exists: false } } : { collectionId };
    // Upsert paths already include createdAt in `next`. Writing the same field
    // through $setOnInsert causes MongoDB to reject the update as conflicting.
    const result = await db.collection('documentation').updateOne(filter, { $set: next }, { upsert: !existing || existing.legacyFallback });
    if (!result.matchedCount && !result.upsertedCount) {
        const error = new Error('Documentation changed while it was being saved.');
        error.statusCode = 409;
        error.current = documentResponse(await db.collection('documentation').findOne({ collectionId }), collectionId);
        throw error;
    }
    await db.collection('collections').updateOne({ _id: collection._id }, { $set: {
        'documentation.title': next.title, 'documentation.content': next.content, 'documentation.settings': next.settings,
        'documentation.lastModifiedAt': now, 'documentation.lastModifiedBy': objectIdForUser(user), updatedAt: now
    } });
    await recordVersion(db, next, user, metadata.source || 'manual', metadata.message || 'Documentation updated');
    return next;
}

async function audit(db, req, collection, action, metadata = {}) {
    try {
        await db.collection('auditevents').insertOne({
            actorId: objectIdForUser(req.user), workspaceId: collection.workspaceId || null, action,
            targetType: 'documentation', targetId: collection._id, metadata,
            ip: req.ip || null, userAgent: req.get('user-agent') || null, createdAt: new Date(), expiresAt: null
        });
    } catch (error) {
        console.warn('[Documentation audit]', error.message);
    }
}

function multipartImport(req, res, next) {
    if (!req.is('multipart/form-data')) return next();
    return upload.single('file')(req, res, next);
}

router.use((req, res, next) => {
    // This router is mounted before the large legacy collections router. Skip
    // it entirely for unrelated collection endpoints and the public docs page.
    const managed = /^\/[0-9a-f]{24}\/(?:openapi-imports|documentation(?:$|\/(?:generations|versions|publish)))/i.test(req.path);
    if (!managed || /\/documentation\/public\/?$/i.test(req.path)) return next('router');
    return ensureAuthenticated(req, res, next);
});
router.use((req, res, next) => {
    const db = getDb();
    if (!db) return res.status(503).json({ code: 'DATABASE_UNAVAILABLE', message: 'Database is not ready.' });
    ensureIndexes(db);
    startDocumentationGenerationWorker();
    return next();
});

router.post('/:id/openapi-imports', multipartImport, async (req, res, next) => {
    try {
        const db = getDb();
        const collection = await findCollectionForUser(db, req.params.id, req.user, 'editor');
        if (!collection) return res.status(404).json({ code: 'COLLECTION_NOT_FOUND', message: 'Collection not found or editor access is required.' });
        const content = req.file?.buffer?.toString('utf8') || req.body?.content;
        const format = req.file ? path.extname(req.file.originalname).slice(1) : req.body?.format;
        const spec = parseOpenApi(content, format);
        const normalized = normalizeOpenApi(spec);
        if (normalized.diagnostics.some((item) => item.severity === 'error')) return res.status(422).json({ code: 'OPENAPI_INVALID', message: 'The OpenAPI contract has blocking validation errors.', diagnostics: normalized.diagnostics });
        if (normalized.operations.length > 2500) return res.status(413).json({ code: 'TOO_MANY_OPERATIONS', message: 'Contracts may contain at most 2,500 operations.' });
        let lintResult = { findings: [], score: null, lintedAt: null, rulesetInfo: null };
        try {
            lintResult = await new IntegrationService().lintOpenApi(spec, { timeoutMs: 10000, maxSizeMB: 5 });
        } catch (lintError) {
            normalized.diagnostics.push({ severity: 'warning', code: 'spectral-unavailable', message: `Spectral validation could not complete: ${lintError.message}` });
        }
        const diagnostics = [...normalized.diagnostics, ...(lintResult.findings || []).slice(0, 200).map((finding) => ({ severity: finding.severity || 'warning', code: finding.id || 'spectral', message: finding.message, path: finding.path }))];

        const requestedVersion = String(req.body?.version || normalized.version || '1.0.0').replace(/^v/i, '');
        const semverMatch = requestedVersion.match(/\d+(?:\.\d+){0,2}/)?.[0] || '1.0.0';
        const parts = semverMatch.split('.');
        while (parts.length < 3) parts.push('0');
        const version = `v${parts.slice(0, 3).join('.')}`;
        if (await ApiVersion.exists({ collectionId: collection._id, version })) return res.status(409).json({ code: 'VERSION_EXISTS', message: `API version ${version} already exists. Supply a different version label.` });
        const apiVersion = await ApiVersion.create({
            collectionId: collection._id, version, name: normalized.title, description: normalized.description,
            openApiSpec: spec, changelog: 'Imported OpenAPI contract.', backwardCompatible: true,
            lintFindings: lintResult.findings || [], lintScore: lintResult.score, lintedAt: lintResult.lintedAt ? new Date(lintResult.lintedAt) : null, rulesetInfo: lintResult.rulesetInfo || undefined,
            createdBy: objectIdForUser(req.user)
        });
        const staleResult = await db.collection('documentation').updateOne(
            { collectionId: String(collection._id), sourceHash: { $ne: normalized.sourceHash } },
            { $set: { staleAt: new Date(), staleReason: `OpenAPI ${version} was imported after this documentation was generated.` } }
        );
        await audit(db, req, collection, 'documentation.openapi.import', { apiVersionId: String(apiVersion._id), version, operations: normalized.operations.length, specificationVersion: normalized.specificationVersion });
        return res.status(201).json({
            importId: String(apiVersion._id), sourceVersionId: String(apiVersion._id), version,
            summary: { title: normalized.title, specificationVersion: normalized.specificationVersion, operations: normalized.operations.length, authenticationSchemes: Array.from(new Set(normalized.operations.flatMap((item) => item.security.map((security) => security.name)))) },
            operations: normalized.operations.slice(0, 500).map((item) => ({ operationId: item.operationId, method: item.method, path: item.path, summary: item.summary || `${item.method} ${item.path}` })),
            operationsTruncated: normalized.operations.length > 500,
            documentationMarkedStale: Boolean(staleResult.modifiedCount),
            diagnostics
        });
    } catch (error) { return next(error); }
});

router.post('/:id/documentation/generations', generationLimiter, async (req, res, next) => {
    try {
        const db = getDb();
        const collection = await findCollectionForUser(db, req.params.id, req.user, 'editor');
        if (!collection) return res.status(404).json({ code: 'COLLECTION_NOT_FOUND', message: 'Collection not found or editor access is required.' });
        const operationIds = Array.isArray(req.body?.operationIds) ? req.body.operationIds.map(String) : [];
        if (operationIds.length > 250) return res.status(400).json({ code: 'GENERATION_LIMIT', message: 'Select at most 250 operations per generation.' });
        let sourceVersionId = null;
        if (req.body?.sourceVersionId) {
            if (!ObjectId.isValid(req.body.sourceVersionId)) return res.status(400).json({ code: 'INVALID_SOURCE_VERSION', message: 'Source version ID is invalid.' });
            const version = await ApiVersion.findOne({ _id: req.body.sourceVersionId, collectionId: collection._id }).select('_id');
            if (!version) return res.status(404).json({ code: 'SOURCE_VERSION_NOT_FOUND', message: 'The selected API version was not found.' });
            sourceVersionId = version._id;
        }
        const generationOptions = { operationIds, audience: String(req.body?.audience || 'API developers').slice(0, 120), tone: ['concise', 'tutorial', 'reference'].includes(req.body?.tone) ? req.body.tone : 'concise', sections: Array.isArray(req.body?.sections) ? req.body.sections.slice(0, 20) : [], exampleLanguages: Array.isArray(req.body?.exampleLanguages) ? req.body.exampleLanguages.slice(0, 5) : ['curl', 'javascript', 'python'] };
        const run = {
            collectionId: String(collection._id), sourceVersionId, status: 'queued', progress: 0, attempts: 0,
            options: generationOptions, optionsHash: sourceHash(generationOptions),
            createdBy: objectIdForUser(req.user), createdAt: new Date(), warnings: []
        };
        const result = await db.collection('documentationGenerationRuns').insertOne(run);
        queueGeneration(result.insertedId);
        await audit(db, req, collection, 'documentation.generation.create', { runId: String(result.insertedId), sourceVersionId: sourceVersionId ? String(sourceVersionId) : null });
        return res.status(202).json({ runId: String(result.insertedId), status: 'queued', progress: 0 });
    } catch (error) { return next(error); }
});

router.get('/:id/documentation/generations/:runId', async (req, res, next) => {
    try {
        const db = getDb();
        const collection = await findCollectionForUser(db, req.params.id, req.user, 'viewer');
        if (!collection) return res.status(404).json({ code: 'COLLECTION_NOT_FOUND', message: 'Collection not found.' });
        if (!ObjectId.isValid(req.params.runId)) return res.status(400).json({ code: 'INVALID_RUN_ID', message: 'Generation run ID is invalid.' });
        const run = await db.collection('documentationGenerationRuns').findOne({ _id: new ObjectId(req.params.runId), collectionId: String(collection._id) });
        if (!run) return res.status(404).json({ code: 'RUN_NOT_FOUND', message: 'Generation run not found.' });
        return res.json({ ...run, _id: String(run._id), sourceVersionId: run.sourceVersionId?.toString?.() || run.sourceVersionId });
    } catch (error) { return next(error); }
});

router.post('/:id/documentation/generations/:runId/apply', async (req, res, next) => {
    try {
        const db = getDb();
        const collection = await findCollectionForUser(db, req.params.id, req.user, 'editor');
        if (!collection) return res.status(404).json({ code: 'COLLECTION_NOT_FOUND', message: 'Collection not found or editor access is required.' });
        if (!ObjectId.isValid(req.params.runId)) return res.status(400).json({ code: 'INVALID_RUN_ID', message: 'Generation run ID is invalid.' });
        const run = await db.collection('documentationGenerationRuns').findOne({ _id: new ObjectId(req.params.runId), collectionId: String(collection._id), status: { $in: ['completed', 'partial'] } });
        if (!run?.draft) return res.status(409).json({ code: 'DRAFT_NOT_READY', message: 'The generation draft is not ready to apply.' });
        const selectedIds = new Set(Array.isArray(req.body?.sectionIds) && req.body.sectionIds.length ? req.body.sectionIds.map(String) : run.draft.sections.map((item) => item.id));
        const sections = run.draft.sections.filter((item) => selectedIds.has(String(item.id)));
        if (!sections.length) return res.status(400).json({ code: 'SECTIONS_REQUIRED', message: 'Select at least one generated section.' });
        const generatedText = sections.map((item) => item.markdown).join('\n\n');
        const secretFindings = scanSecrets(generatedText);
        if (secretFindings.length) return res.status(422).json({ code: 'SECRET_REVIEW_REQUIRED', message: 'Possible secrets must be replaced before applying this draft.', findings: secretFindings });
        const existing = await canonicalDocument(db, collection);
        const content = mergeGeneratedSections(existing?.content || '', sections, req.body?.mode === 'replace' ? 'replace' : 'merge');
        const next = await saveCanonicalDocument(db, collection, req.user, { title: run.draft.title, content, settings: existing?.settings || {} }, req.body?.revision, {
            source: 'ai', message: 'Applied reviewed AI documentation draft', sourceVersionId: run.sourceVersionId || null,
            sourceHash: run.sourceHash, staleAt: null, staleReason: null,
            provenance: { ...(run.provenance || {}), runId: String(run._id), model: run.model || null, warnings: run.warnings || [] }, coverage: run.draft.coverage
        });
        await db.collection('documentationGenerationRuns').updateOne({ _id: run._id }, { $set: { appliedAt: new Date(), appliedBy: objectIdForUser(req.user), appliedRevision: next.revision } });
        await audit(db, req, collection, 'documentation.generation.apply', { runId: String(run._id), revision: next.revision, sectionIds: sections.map((item) => item.id) });
        return res.json({ documentation: documentResponse(next, String(collection._id)) });
    } catch (error) { return next(error); }
});

router.get('/:id/documentation/versions', async (req, res, next) => {
    try {
        const db = getDb();
        const collection = await findCollectionForUser(db, req.params.id, req.user, 'viewer');
        if (!collection) return res.status(404).json({ code: 'COLLECTION_NOT_FOUND', message: 'Collection not found.' });
        const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
        const page = Math.max(1, Number(req.query.page) || 1);
        const query = { collectionId: String(collection._id) };
        const [versions, total] = await Promise.all([
            db.collection('documentationVersions').find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
            db.collection('documentationVersions').countDocuments(query)
        ]);
        return res.json({ versions: versions.map((item) => ({ ...item, _id: String(item._id), createdBy: item.createdBy?.toString?.() || item.createdBy })), page, limit, total });
    } catch (error) { return next(error); }
});

router.post('/:id/documentation/versions/:versionId/restore', async (req, res, next) => {
    try {
        const db = getDb();
        const collection = await findCollectionForUser(db, req.params.id, req.user, 'editor');
        if (!collection) return res.status(404).json({ code: 'COLLECTION_NOT_FOUND', message: 'Collection not found or editor access is required.' });
        if (!ObjectId.isValid(req.params.versionId)) return res.status(400).json({ code: 'INVALID_VERSION_ID', message: 'Documentation version ID is invalid.' });
        const version = await db.collection('documentationVersions').findOne({ _id: new ObjectId(req.params.versionId), collectionId: String(collection._id) });
        if (!version) return res.status(404).json({ code: 'VERSION_NOT_FOUND', message: 'Documentation version not found.' });
        const next = await saveCanonicalDocument(db, collection, req.user, version, req.body?.revision, { source: 'restore', message: `Restored documentation revision ${version.revision}` });
        await audit(db, req, collection, 'documentation.version.restore', { versionId: String(version._id), revision: next.revision });
        return res.json({ documentation: documentResponse(next, String(collection._id)) });
    } catch (error) { return next(error); }
});

router.post('/:id/documentation/publish', async (req, res, next) => {
    try {
        const db = getDb();
        const collection = await findCollectionForUser(db, req.params.id, req.user, 'viewer');
        if (!collection || !isCollectionOwnerOrAdmin(collection, req.user)) return res.status(404).json({ code: 'COLLECTION_NOT_FOUND', message: 'Collection not found or owner/admin access is required.' });
        const document = await canonicalDocument(db, collection);
        if (!document?.content?.trim()) return res.status(409).json({ code: 'DOCUMENTATION_EMPTY', message: 'Create and review documentation before publishing.' });
        if (Number(req.body?.revision ?? document.revision) !== Number(document.revision || 0)) return res.status(409).json({ code: 'REVISION_CONFLICT', message: 'Publish the latest documentation revision.' });
        const findings = scanSecrets(document.content);
        if (findings.length) return res.status(422).json({ code: 'SECRET_REVIEW_REQUIRED', message: 'Possible secrets must be replaced before publishing.', findings });
        const settings = { ...(document.settings || {}), isPublic: true };
        await db.collection('documentation').updateOne({ _id: document._id }, { $set: { settings, publishedRevision: document.revision, publishedAt: new Date(), publishedBy: objectIdForUser(req.user) } });
        await db.collection('collections').updateOne({ _id: collection._id }, { $set: { 'documentation.settings': settings, isPublic: true } });
        await audit(db, req, collection, 'documentation.publish', { revision: document.revision });
        return res.json({ message: 'Documentation published successfully.', revision: document.revision, publicUrl: `/docs/${collection._id}` });
    } catch (error) { return next(error); }
});

router.get('/:id/documentation', async (req, res, next) => {
    try {
        const db = getDb();
        const collection = await findCollectionForUser(db, req.params.id, req.user, 'viewer');
        if (!collection) return res.status(404).json({ code: 'COLLECTION_NOT_FOUND', message: 'Collection not found.' });
        return res.json(documentResponse(await canonicalDocument(db, collection), String(collection._id)));
    } catch (error) { return next(error); }
});

router.put('/:id/documentation', async (req, res, next) => {
    try {
        const db = getDb();
        const collection = await findCollectionForUser(db, req.params.id, req.user, 'editor');
        if (!collection) return res.status(404).json({ code: 'COLLECTION_NOT_FOUND', message: 'Collection not found or editor access is required.' });
        if (typeof req.body?.content !== 'string') return res.status(400).json({ code: 'CONTENT_REQUIRED', message: 'Documentation content must be text.' });
        if (!Number.isInteger(Number(req.body?.revision)) || Number(req.body.revision) < 0) return res.status(400).json({ code: 'REVISION_REQUIRED', message: 'A valid documentation revision is required.' });
        const nextDocument = await saveCanonicalDocument(db, collection, req.user, req.body, Number(req.body.revision));
        await audit(db, req, collection, 'documentation.update', { revision: nextDocument.revision });
        return res.json({ documentation: documentResponse(nextDocument, String(collection._id)) });
    } catch (error) { return next(error); }
});

router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof multer.MulterError) return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ code: error.code, message: error.code === 'LIMIT_FILE_SIZE' ? 'OpenAPI files may be at most 5 MB.' : error.message });
    const status = error.statusCode || (error instanceof DocumentationInputError ? 400 : 500);
    if (status >= 500) console.error('[Documentation API]', error);
    return res.status(status).json({ code: error.code || (status === 409 ? 'REVISION_CONFLICT' : 'DOCUMENTATION_ERROR'), message: error.message || 'Documentation request failed.', diagnostics: error.diagnostics, current: error.current });
});

module.exports = router;
