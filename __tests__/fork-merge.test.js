const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../server');

let mongoServer;
let sourceCollectionId;
let forkedCollectionId;
let mergeRequestId;

// Mock user for authentication
const mockUser = {
    id: 'test-user-id',
    name: 'Test User',
    email: 'test@example.com'
};

beforeAll(async () => {
    // Set up in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

describe('Fork and Merge Functionality', () => {
    // Test creating a source collection
    test('Should create a source collection', async () => {
        const sourceCollection = {
            name: 'Source Collection',
            description: 'Test source collection',
            workspaceId: 'workspace-123',
            requests: [
                {
                    name: 'Test Request',
                    method: 'GET',
                    url: 'https://api.example.com/test'
                }
            ]
        };

        const response = await request(app)
            .post('/api/collections')
            .send(sourceCollection);

        expect(response.status).toBe(201);
        expect(response.body._id).toBeDefined();
        sourceCollectionId = response.body._id;
    });

    // Test forking the collection
    test('Should fork a collection', async () => {
        const forkData = {
            name: 'Forked Collection',
            description: 'Test forked collection',
            workspaceId: 'workspace-456'
        };

        const response = await request(app)
            .post(`/api/collections/${sourceCollectionId}/fork`)
            .send(forkData);

        expect(response.status).toBe(201);
        expect(response.body.forkedFrom).toBe(sourceCollectionId);
        expect(response.body.name).toBe(forkData.name);
        forkedCollectionId = response.body._id;
    });

    // Test modifying the forked collection
    test('Should modify forked collection', async () => {
        const modifications = {
            requests: [
                {
                    name: 'Modified Request',
                    method: 'POST',
                    url: 'https://api.example.com/modified'
                }
            ]
        };

        const response = await request(app)
            .put(`/api/collections/${forkedCollectionId}`)
            .send(modifications);

        expect(response.status).toBe(200);
        expect(response.body.requests[0].name).toBe('Modified Request');
    });

    // Test creating a merge request
    test('Should create a merge request', async () => {
        const mergeRequestData = {
            targetCollectionId: sourceCollectionId,
            title: 'Test Merge Request',
            description: 'Testing merge functionality'
        };

        const response = await request(app)
            .post(`/api/collections/${forkedCollectionId}/merge-request`)
            .send(mergeRequestData);

        expect(response.status).toBe(201);
        expect(response.body.sourceCollectionId).toBe(forkedCollectionId);
        expect(response.body.targetCollectionId).toBe(sourceCollectionId);
        mergeRequestId = response.body._id;
    });

    // Test approving a merge request
    test('Should approve merge request', async () => {
        const response = await request(app)
            .post(`/api/merge-requests/${mergeRequestId}/approve`);

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('approved');

        // Verify the changes were merged to source collection
        const sourceCollection = await request(app)
            .get(`/api/collections/${sourceCollectionId}`);

        expect(sourceCollection.body.requests[0].name).toBe('Modified Request');
    });

    // Test rejecting a merge request
    test('Should reject merge request', async () => {
        // Create another merge request first
        const newMergeRequest = await request(app)
            .post(`/api/collections/${forkedCollectionId}/merge-request`)
            .send({
                targetCollectionId: sourceCollectionId,
                title: 'Test Merge Request 2',
                description: 'Testing reject functionality'
            });

        const response = await request(app)
            .post(`/api/merge-requests/${newMergeRequest.body._id}/reject`);

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('rejected');
    });

    // Test getting fork information
    test('Should get fork information', async () => {
        const response = await request(app)
            .get(`/api/collections/${forkedCollectionId}`);

        expect(response.status).toBe(200);
        expect(response.body.forkedFrom).toBe(sourceCollectionId);
    });
});