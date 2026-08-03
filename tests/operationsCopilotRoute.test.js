const express = require('express');
const request = require('supertest');
const { ObjectId } = require('mongodb');

const mockSavedConversations = [];
const mockGenerateInvestigation = jest.fn();
const mockListTargets = jest.fn();

jest.mock('../middleware/auth', () => ({ ensureAuthenticated: (_req, _res, next) => next() }));
jest.mock('../services/OperationsCopilotService', () => ({
    listTargets: (...args) => mockListTargets(...args),
    generateInvestigation: (...args) => mockGenerateInvestigation(...args),
    investigationMarkdown: (investigation) => investigation.summary
}));
jest.mock('../services/CopilotNimClient', () => ({
    publicProfiles: () => [{ id: 'hosted', label: 'Hosted' }],
    getProfile: (id) => id === 'hosted' ? { id: 'hosted' } : null,
    complete: jest.fn()
}));
jest.mock('../services/CopilotContextService', () => ({ listSources: jest.fn(), resolveContext: jest.fn() }));
jest.mock('../services/CopilotService', () => ({ redactText: (value) => String(value || '') }));
jest.mock('../models/CopilotAction', () => ({}));
jest.mock('../models/CopilotConversation', () => class MockConversation {
    constructor(value) {
        Object.assign(this, value);
        const { ObjectId: MockObjectId } = require('mongodb');
        this._id = new MockObjectId();
        this.messages = [];
        this.createdAt = new Date();
        this.updatedAt = new Date();
    }
    async save() { mockSavedConversations.push(this); return this; }
    static findOne() { return null; }
});

const router = require('../routes/copilot');

const app = express();
app.use(express.json());
app.use((req, _res, next) => { req.user = { id: String(new ObjectId()) }; next(); });
app.use('/api/copilot', router);

beforeEach(() => {
    mockSavedConversations.length = 0;
    jest.clearAllMocks();
});

test('persists a structured operations artifact in the Copilot conversation', async () => {
    mockGenerateInvestigation.mockResolvedValue({
        generatedAt: '2026-08-03T12:00:00.000Z',
        target: { type: 'incident', id: String(new ObjectId()), workspaceId: String(new ObjectId()), label: 'Checkout outage', deepLink: '/workspace/monitoring/incidents' },
        summary: 'Checkout is degraded.', evidence: [], rootCauses: [], steps: [], warnings: [], drafts: {}, impact: {}, window: {}
    });
    const response = await request(app).post('/api/copilot/operations/investigations').send({ profileId: 'hosted', target: { type: 'incident', id: String(new ObjectId()) } });
    expect(response.status).toBe(200);
    expect(response.body.investigation.summary).toBe('Checkout is degraded.');
    expect(mockSavedConversations).toHaveLength(1);
    expect(mockSavedConversations[0].messages.at(-1).artifact).toMatchObject({ type: 'operations_investigation' });
});

test('propagates workspace authorization failures from target listing', async () => {
    const error = new Error('You do not have access to this workspace.');
    error.status = 403;
    mockListTargets.mockRejectedValue(error);
    const response = await request(app).get(`/api/copilot/operations/targets?workspaceId=${new ObjectId()}`);
    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/do not have access/i);
});
