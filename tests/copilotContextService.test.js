const { ObjectId } = require('mongodb');

const state = { workspaces: [], collections: [], histories: [] };
const collectionApi = (name) => ({
    findOne: jest.fn(async (query) => {
        const values = state[name] || [];
        if (query._id) return values.find((item) => String(item._id) === String(query._id)) || null;
        if (query.traceId) return values.find((item) => item.traceId === query.traceId) || null;
        return null;
    }),
    find: jest.fn(() => {
        const cursor = {
            sort: jest.fn(() => cursor),
            limit: jest.fn(() => cursor),
            project: jest.fn(() => cursor),
            toArray: jest.fn(async () => state[name] || [])
        };
        return cursor;
    }),
    countDocuments: jest.fn(async (query) => (state[name] || []).filter((item) => !query.workspaceId || String(item.workspaceId) === String(query.workspaceId)).length)
});
const apis = new Map();
const mockDb = { collection: jest.fn((name) => {
    if (!apis.has(name)) apis.set(name, collectionApi(name));
    return apis.get(name);
}) };

jest.mock('../config/db', () => ({ getDb: () => mockDb }));

const { resolveContext, normalizeDescriptors, historyEvidence, traceEvidence, violationsFromRun } = require('../services/CopilotContextService');

const userId = new ObjectId();
const user = { id: String(userId) };

beforeEach(() => {
    jest.clearAllMocks();
    apis.clear();
    state.workspaces = [];
    state.collections = [];
    state.histories = [];
    state.traces = [];
    state.incidents = [];
});

test('deduplicates active and pinned descriptors while preserving active origin', () => {
    expect(normalizeDescriptors({
        activeContext: { type: 'collection', id: 'one' },
        pinnedSources: [{ type: 'collection', id: 'one' }, { type: 'trace', id: 'two' }]
    })).toEqual([
        expect.objectContaining({ type: 'collection', id: 'one', origin: 'active' }),
        expect.objectContaining({ type: 'trace', id: 'two', origin: 'pinned' })
    ]);
});

test('resolves request context into a redacted evidence snapshot', async () => {
    const workspaceId = new ObjectId();
    const collectionId = new ObjectId();
    state.collections = [{
        _id: collectionId,
        owner: userId,
        userId,
        workspaceId,
        name: 'Payments',
        requests: [{ _id: 'req-1', name: 'Charge', method: 'POST', url: 'https://api.example.com/charges', headers: [{ name: 'Authorization', value: 'Bearer top-secret' }] }]
    }];
    state.histories = [{ _id: new ObjectId(), userId, collectionId: String(collectionId), collectionRequestId: 'req-1', method: 'POST', url: 'https://api.example.com/charges', responseStatus: 502, responseStatusText: 'Bad Gateway', timestamp: new Date() }];

    const result = await resolveContext({ activeContext: { type: 'request', id: 'req-1', parentId: String(collectionId) } }, user, 'What failed?');
    expect(result.workspaceId).toBe(String(workspaceId));
    expect(result.snapshot).toHaveLength(1);
    expect(result.snapshot[0].evidence.some((entry) => entry.kind === 'testing')).toBe(true);
    expect(result.findings.some((entry) => entry.summary.includes('502'))).toBe(true);
    expect(result.items[0].text).toContain('[REDACTED]');
    expect(result.items[0].text).not.toContain('top-secret');
});

test('keeps the page label that names the open tab instead of the bare resource name', async () => {
    const workspaceId = new ObjectId();
    const collectionId = new ObjectId();
    state.collections = [{ _id: collectionId, owner: userId, userId, workspaceId, name: 'Payments', requests: [] }];

    const result = await resolveContext({
        activeContext: { type: 'collection', id: String(collectionId), label: 'Payments sample data' }
    }, user, 'What page?');
    expect(result.snapshot[0].label).toBe('Payments sample data');
});

test('rejects mixed-workspace context outside the overview thread', async () => {
    const first = new ObjectId();
    const second = new ObjectId();
    state.workspaces = [
        { _id: first, owner: userId, userId, name: 'One' },
        { _id: second, owner: userId, userId, name: 'Two' }
    ];
    await expect(resolveContext({
        activeContext: { type: 'workspace', id: String(first) },
        pinnedSources: [{ type: 'workspace', id: String(second) }]
    }, user, 'Summarize')).rejects.toThrow('Pinned sources must belong to the active workspace.');
});

test('extracts deterministic failures from history, traces, and test runs', () => {
    expect(historyEvidence({ method: 'GET', url: '/health', responseStatus: 500, testResults: JSON.stringify([{ name: 'status is 200', passed: false, actual: 500 }]) }).filter((entry) => entry.status === 'error')).toHaveLength(2);
    expect(traceEvidence({ hasError: true, errorMessage: 'database timeout', spans: [{ spanId: '1', serviceName: 'api', name: 'query', status: 'error', durationMs: 1400 }] }).some((entry) => entry.kind === 'span')).toBe(true);
    expect(violationsFromRun({ status: 'failed', violations: [{ kind: 'schema', message: 'Missing id', breaking: true }] }).some((entry) => entry.summary === 'Missing id')).toBe(true);
});
