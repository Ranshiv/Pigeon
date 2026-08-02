const { ObjectId } = require('mongodb');

const state = {};
const collectionsApi = {
    findOne: jest.fn(async () => state.collection),
    updateOne: jest.fn(async (_filter, update) => {
        Object.entries(update.$set || {}).forEach(([key, value]) => {
            const parts = key.split('.');
            let target = state.collection;
            while (parts.length > 1) target = target[parts.shift()] ||= {};
            target[parts[0]] = value;
        });
        return { matchedCount: 1, modifiedCount: 1 };
    })
};
const documentationApi = {
    findOne: jest.fn(async () => state.documentation),
    updateOne: jest.fn(async (_filter, update) => {
        state.documentation ||= { ...update.$setOnInsert };
        Object.assign(state.documentation, update.$set);
        return { matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
    })
};
const versionsApi = { insertOne: jest.fn(async (document) => ({ insertedId: new ObjectId(), document })) };
const workspacesApi = { findOne: jest.fn(async () => ({ globalVariables: state.globalVariables || [] })) };
const mockDb = { collection: jest.fn((name) => ({ collections: collectionsApi, documentation: documentationApi, documentationContentVersions: versionsApi, workspaces: workspacesApi }[name])) };

jest.mock('../config/db', () => ({ getDb: () => mockDb }));
jest.mock('../services/CollectionMcpServerService', () => ({ executeTool: jest.fn() }));

const { buildContext, executeAction } = require('../services/CopilotService');
const collectionMcpServer = require('../services/CollectionMcpServerService');

const userId = new ObjectId();
const collectionId = new ObjectId();
const requestId = new ObjectId();
const user = { id: String(userId) };

function action(kind, payload) {
    return { kind, payload };
}

beforeEach(() => {
    jest.clearAllMocks();
    state.collection = {
        _id: collectionId,
        owner: String(userId),
        name: 'Test collection',
        workspaceId: new ObjectId(),
        requests: [{ _id: requestId, name: 'Health Check', method: 'GET', url: 'https://example.com/health' }],
        documentation: { content: '# API reference\n\n## Authentication\nDescribe required credentials.' }
    };
    state.documentation = {
        collectionId: String(collectionId),
        title: 'Test documentation',
        content: state.collection.documentation.content
    };
    state.globalVariables = [];
});

describe('Copilot approved action execution', () => {
    test('documentation merge updates both stores and creates history', async () => {
        const result = await executeAction(action('update_documentation', {
            collectionId: String(collectionId), mode: 'merge', content: '## Authentication\nUse a bearer token.'
        }), user);

        expect(result.message).toBe('Documentation updated.');
        expect(state.collection.documentation.content).toContain('Use a bearer token.');
        expect(state.documentation.content).toBe(state.collection.documentation.content);
        expect(collectionsApi.updateOne).toHaveBeenCalledTimes(1);
        expect(documentationApi.updateOne).toHaveBeenCalledTimes(1);
        expect(versionsApi.insertOne).toHaveBeenCalledTimes(1);
    });

    test('repeating the same documentation merge changes nothing and reports it', async () => {
        const payload = { collectionId: String(collectionId), mode: 'merge', content: '## Authentication\nUse a bearer token.' };
        await executeAction(action('update_documentation', payload), user);
        const merged = state.documentation.content;
        versionsApi.insertOne.mockClear();
        await expect(executeAction(action('update_documentation', payload), user))
            .rejects.toThrow('matches the current documentation');
        expect((merged.match(/^## Authentication$/gm) || [])).toHaveLength(1);
        expect(state.documentation.content).toBe(merged);
        expect(versionsApi.insertOne).not.toHaveBeenCalled();
    });

    test('create request requires name, URL, and method', async () => {
        await expect(executeAction(action('create_request', {
            collectionId: String(collectionId), request: { name: 'Incomplete' }
        }), user)).rejects.toThrow('A new request needs a name, URL, and method.');
        expect(collectionsApi.updateOne).not.toHaveBeenCalled();
    });

    test('update request fails safely when its target does not exist', async () => {
        await expect(executeAction(action('update_request', {
            collectionId: String(collectionId), requestId: String(new ObjectId()), request: { name: 'Renamed' }
        }), user)).rejects.toThrow('The request to update was not found.');
    });

    test('updates a legacy request by its unambiguous name and assigns a stable ID', async () => {
        delete state.collection.requests[0]._id;
        await expect(executeAction(action('update_request', {
            collectionId: String(collectionId), targetRequestName: 'Health Check', request: { name: 'Public Health Check' }
        }), user)).resolves.toMatchObject({ message: 'Request updated.' });
        expect(state.collection.requests[0].name).toBe('Public Health Check');
        expect(state.collection.requests[0]._id).toMatch(/^req-/);
    });

    test('creates requests with a stable executor-assigned ID', async () => {
        const result = await executeAction(action('create_request', {
            collectionId: String(collectionId), request: { name: 'Status', method: 'GET', url: 'https://example.com/status' }
        }), user);
        expect(result.requestId).toMatch(/^req-/);
        expect(state.collection.requests.at(-1)._id).toBe(result.requestId);
    });

    test('summarizes HTML MCP responses instead of persisting a web page source', async () => {
        collectionMcpServer.executeTool.mockResolvedValueOnce({
            status: 200,
            statusText: 'OK',
            body: '<!doctype html><html><head><title>Postman</title></head><body><script>very-long-page-source</script></body></html>'
        });
        const result = await executeAction(action('mcp_call', {
            collectionId: String(collectionId), toolName: 'env_1', arguments: {}
        }), user);
        expect(result.result.body).toContain('HTML document titled “Postman”');
        expect(result.result.body).not.toContain('very-long-page-source');
    });

    test('delete request requires the exact request name', async () => {
        const payload = { collectionId: String(collectionId), requestId: String(requestId) };
        await expect(executeAction(action('delete_request', payload), user, 'Wrong name'))
            .rejects.toThrow('Type the exact request name to confirm deletion.');
        await expect(executeAction(action('delete_request', payload), user, 'Health Check'))
            .resolves.toEqual({ message: 'Request deleted.' });
        expect(state.collection.requests).toHaveLength(0);
    });
});

describe('Copilot private context construction', () => {
    test('uses the documentation store and redacts secret-like global, collection, and header values', async () => {
        state.globalVariables = [
            { key: 'region', value: 'ca-central-1' },
            { key: 'password', value: 'global-secret' }
        ];
        state.collection.variables = [
            { key: 'baseUrl', value: 'https://example.com' },
            { key: 'apiKey', value: 'collection-secret' }
        ];
        state.collection.requests[0].headers = [
            { name: 'Accept', value: 'application/json' },
            { name: 'Authorization', value: 'Bearer header-secret' }
        ];
        state.documentation.content = '## Stored documentation\nThis is the current canonical copy.';

        const context = await buildContext([{ type: 'collection', id: String(collectionId) }], user, 'Summarize this collection.');
        const serialized = context[0].text;
        const parsed = JSON.parse(serialized);
        expect(parsed.documentation.content).toContain('current canonical copy');
        expect(parsed.globalVariables.find(({ key }) => key === 'password').value).toBe('[REDACTED]');
        expect(parsed.variables.find(({ key }) => key === 'apiKey').value).toBe('[REDACTED]');
        expect(parsed.requests[0].headers.find(({ name }) => name === 'Authorization').value).toBe('[REDACTED]');
        expect(serialized).not.toContain('global-secret');
        expect(serialized).not.toContain('collection-secret');
        expect(serialized).not.toContain('header-secret');
        expect(serialized.length).toBeLessThanOrEqual(10000);
    });
});
