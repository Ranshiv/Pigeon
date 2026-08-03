const express = require('express');
const request = require('supertest');
const { ObjectId } = require('mongodb');

jest.mock('../config/db', () => ({ getDb: jest.fn() }));
jest.mock('../services/DocumentationGenerationService', () => ({ queueGeneration: jest.fn(), startDocumentationGenerationWorker: jest.fn() }));
jest.mock('../services/IntegrationService', () => jest.fn().mockImplementation(() => ({ lintOpenApi: jest.fn().mockResolvedValue({ findings: [], score: 100, lintedAt: '2026-08-03T00:00:00.000Z', rulesetInfo: { name: 'OpenAPI' } }) })));
jest.mock('../models/ApiVersion', () => ({
    exists: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn()
}));

const { getDb } = require('../config/db');
const ApiVersion = require('../models/ApiVersion');
const router = require('../routes/documentationGenerator');

const collectionId = '507f191e810c19729de860ea';
const userId = '507f1f77bcf86cd799439011';

describe('canonical documentation routes', () => {
    let app;
    let canonical;
    let versions;
    let audits;

    beforeEach(() => {
        canonical = null;
        versions = [];
        audits = [];
        ApiVersion.exists.mockReset().mockResolvedValue(null);
        ApiVersion.create.mockReset().mockImplementation(async (value) => ({ ...value, _id: new ObjectId() }));
        const collection = { _id: new ObjectId(collectionId), name: 'Payments', owner: new ObjectId(userId), userId: new ObjectId(userId), collaborators: [], requests: [] };
        const db = {
            collection: (name) => {
                if (name === 'collections') return {
                    findOne: jest.fn().mockResolvedValue(collection),
                    updateOne: jest.fn().mockResolvedValue({ matchedCount: 1 })
                };
                if (name === 'documentation') return {
                    createIndex: jest.fn().mockResolvedValue('ok'),
                    findOne: jest.fn().mockImplementation(async () => canonical),
                    updateOne: jest.fn().mockImplementation(async (filter, update) => {
                        const conflictingPaths = Object.keys(update.$set || {}).filter((key) => Object.prototype.hasOwnProperty.call(update.$setOnInsert || {}, key));
                        if (conflictingPaths.length) throw new Error(`Conflicting update paths: ${conflictingPaths.join(', ')}`);
                        if (canonical && filter._id && String(filter._id) !== String(canonical._id)) return { matchedCount: 0, upsertedCount: 0 };
                        canonical = { ...(canonical || { _id: new ObjectId() }), ...update.$set, ...(update.$setOnInsert || {}) };
                        return { matchedCount: filter._id ? 1 : 0, upsertedCount: filter._id ? 0 : 1 };
                    })
                };
                if (name === 'documentationVersions') return {
                    createIndex: jest.fn().mockResolvedValue('ok'),
                    insertOne: jest.fn().mockImplementation(async (value) => { versions.push(value); return { insertedId: new ObjectId() }; })
                };
                if (name === 'documentationGenerationRuns') return { createIndex: jest.fn().mockResolvedValue('ok') };
                if (name === 'auditevents') return { insertOne: jest.fn().mockImplementation(async (value) => { audits.push(value); }) };
                throw new Error(`Unexpected collection ${name}`);
            }
        };
        getDb.mockReturnValue(db);
        app = express();
        app.use(express.json());
        app.use((req, res, next) => { req.user = { id: userId, _id: new ObjectId(userId), displayName: 'Owner' }; next(); });
        app.use('/api/collections', router);
    });

    test('imports OpenAPI YAML on the server and creates an immutable API version', async () => {
        const response = await request(app).post(`/api/collections/${collectionId}/openapi-imports`).send({
            format: 'yaml',
            content: 'openapi: 3.2.0\ninfo: { title: Payments, version: 2.0.0 }\npaths:\n  /payments:\n    get:\n      responses:\n        "200": { description: OK }'
        });
        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({ version: 'v2.0.0', summary: { title: 'Payments', specificationVersion: '3.2.0', operations: 1 } });
        expect(ApiVersion.create).toHaveBeenCalledWith(expect.objectContaining({ collectionId: new ObjectId(collectionId), version: 'v2.0.0' }));
        expect(audits[0].action).toBe('documentation.openapi.import');
    });

    test('rejects external OpenAPI references', async () => {
        const response = await request(app).post(`/api/collections/${collectionId}/openapi-imports`).send({
            format: 'json',
            content: JSON.stringify({ openapi: '3.2.0', info: { title: 'Unsafe', version: '1.0.0' }, paths: {}, components: { schemas: { Item: { $ref: 'https://example.com/item.json' } } } })
        });
        expect(response.status).toBe(400);
        expect(response.body.code).toBe('EXTERNAL_REF_BLOCKED');
    });

    test('increments canonical revisions and rejects stale writes', async () => {
        const first = await request(app).put(`/api/collections/${collectionId}/documentation`).send({ title: 'Payments', content: '# Payments', settings: {}, revision: 0 });
        expect(first.status).toBe(200);
        expect(first.body.documentation.revision).toBe(1);
        expect(versions).toHaveLength(1);

        const stale = await request(app).put(`/api/collections/${collectionId}/documentation`).send({ title: 'Payments', content: '# Stale', settings: {}, revision: 0 });
        expect(stale.status).toBe(409);
        expect(stale.body.code).toBe('REVISION_CONFLICT');
        expect(stale.body.current.revision).toBe(1);
    });

    test('blocks publication when reviewed content still contains a possible secret', async () => {
        await request(app).put(`/api/collections/${collectionId}/documentation`).send({ title: 'Payments', content: 'api_key=live_1234567890abcdef', settings: {}, revision: 0 });
        const response = await request(app).post(`/api/collections/${collectionId}/documentation/publish`).send({ revision: 1 });
        expect(response.status).toBe(422);
        expect(response.body.code).toBe('SECRET_REVIEW_REQUIRED');
    });

    test('does not intercept the legacy unauthenticated public documentation path', async () => {
        const publicApp = express();
        publicApp.use('/api/collections', router);
        publicApp.use((req, res) => res.sendStatus(204));
        const response = await request(publicApp).get(`/api/collections/${collectionId}/documentation/public`);
        expect(response.status).toBe(204);
    });
});
