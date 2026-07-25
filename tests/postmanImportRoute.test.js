const express = require('express');
const request = require('supertest');
const { ObjectId } = require('mongodb');

const mockSavedEnvironments = [];

jest.mock('../config/db', () => ({
    getDb: jest.fn()
}));

jest.mock('../models/Environment', () => {
    const { ObjectId: MockObjectId } = require('mongodb');
    const Environment = jest.fn().mockImplementation((data) => {
        const environment = {
            ...data,
            _id: new MockObjectId(),
            save: jest.fn().mockImplementation(async () => {
                mockSavedEnvironments.push(environment);
                return environment;
            })
        };
        return environment;
    });
    Environment.exists = jest.fn();
    return Environment;
});

const { getDb } = require('../config/db');
const Environment = require('../models/Environment');
const importsRouter = require('../routes/imports');

const ownerId = '507f1f77bcf86cd799439011';
const personalWorkspaceId = '507f191e810c19729de860ea';
const collectionExport = {
    info: {
        name: 'Route import fixture',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    },
    variable: [{ key: 'baseUrl', value: 'https://api.example.com' }],
    item: [{
        name: 'Health check',
        request: {
            method: 'GET',
            url: 'https://api.example.com/health',
            header: [{ key: 'Accept', value: 'application/json' }]
        }
    }]
};

describe('POST /api/imports/postman', () => {
    let app;
    let insertedCollections;
    let insertedDocumentation;
    let activities;
    let workspaceFinder;

    beforeEach(() => {
        insertedCollections = [];
        insertedDocumentation = [];
        activities = [];
        mockSavedEnvironments.length = 0;
        Environment.mockClear();
        Environment.exists.mockReset();
        Environment.exists.mockResolvedValue(null);
        workspaceFinder = jest.fn().mockResolvedValue({
            _id: new ObjectId(personalWorkspaceId),
            isPersonal: true,
            owner: new ObjectId(ownerId),
            collaborators: []
        });

        const db = {
            collection: (name) => {
                if (name === 'workspaces') return { findOne: workspaceFinder };
                if (name === 'collections') {
                    return {
                        insertOne: async (document) => {
                            insertedCollections.push(document);
                            return { insertedId: new ObjectId() };
                        }
                    };
                }
                if (name === 'workspaceActivity') {
                    return {
                        insertOne: async (document) => {
                            activities.push(document);
                            return { insertedId: new ObjectId() };
                        }
                    };
                }
                if (name === 'documentation') {
                    return {
                        insertOne: async (document) => {
                            insertedDocumentation.push(document);
                            return { insertedId: new ObjectId() };
                        }
                    };
                }
                throw new Error(`Unexpected collection: ${name}`);
            }
        };
        getDb.mockReturnValue(db);
        app = express();
        app.use('/api/imports', importsRouter);
    });

    test('imports a collection into the caller personal workspace with stable embedded request IDs', async () => {
        const response = await request(app)
            .post('/api/imports/postman')
            .attach('file', Buffer.from(JSON.stringify(collectionExport)), 'collection.json');

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
            kind: 'collection',
            resource: {
                name: 'Route import fixture',
                requestCount: 1,
                variableCount: 1,
                workspaceId: personalWorkspaceId
            }
        });
        expect(insertedCollections).toHaveLength(1);
        expect(insertedCollections[0].workspaceId.toString()).toBe(personalWorkspaceId);
        expect(insertedCollections[0].requests[0]).toMatchObject({
            name: 'Health check',
            url: 'https://api.example.com/health',
            method: 'GET'
        });
        expect(ObjectId.isValid(insertedCollections[0].requests[0]._id)).toBe(true);
        expect(insertedDocumentation).toHaveLength(1);
        expect(insertedDocumentation[0]).toMatchObject({
            collectionId: response.body.resource._id,
            importedFrom: 'postman'
        });
        expect(insertedDocumentation[0].content).toContain('# Route import fixture');
        expect(activities[0]).toMatchObject({ type: 'collection_imported' });
    });

    test('imports environments and resolves name conflicts without overwriting the existing environment', async () => {
        Environment.exists
            .mockResolvedValueOnce({ _id: new ObjectId() })
            .mockResolvedValueOnce(null);
        const environmentExport = {
            name: 'Local',
            values: [{ key: 'token', value: 'top-secret', type: 'secret', enabled: true }]
        };

        const response = await request(app)
            .post('/api/imports/postman')
            .attach('file', Buffer.from(JSON.stringify(environmentExport)), 'environment.json');

        expect(response.status).toBe(201);
        expect(response.body.resource.name).toBe('Local (Imported)');
        expect(response.body.warnings).toEqual(expect.arrayContaining([
            expect.stringContaining('already existed')
        ]));
        expect(mockSavedEnvironments).toHaveLength(1);
        expect(mockSavedEnvironments[0].variables[0]).toMatchObject({ key: 'token', isSecret: true });
    });

    test('rejects non-Postman files and invalid workspace permissions before saving anything', async () => {
        const invalidFile = await request(app)
            .post('/api/imports/postman')
            .attach('file', Buffer.from('not postman'), 'notes.txt');
        expect(invalidFile.status).toBe(400);
        expect(invalidFile.body.code).toBe('INVALID_FILE_TYPE');

        workspaceFinder.mockResolvedValueOnce({
            _id: new ObjectId(personalWorkspaceId),
            owner: new ObjectId('507f191e810c19729de860eb'),
            collaborators: [{ userId: new ObjectId(ownerId), role: 'viewer' }]
        });
        const deniedWorkspace = await request(app)
            .post('/api/imports/postman')
            .field('workspaceId', personalWorkspaceId)
            .attach('file', Buffer.from(JSON.stringify(collectionExport)), 'collection.json');

        expect(deniedWorkspace.status).toBe(403);
        expect(deniedWorkspace.body.code).toBe('WORKSPACE_ACCESS_DENIED');
        expect(insertedCollections).toHaveLength(0);
    });
});
