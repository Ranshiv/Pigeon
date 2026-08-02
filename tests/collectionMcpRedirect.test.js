jest.mock('dns', () => ({ promises: { lookup: jest.fn(async (hostname) => [{ address: hostname === 'internal.test' ? '169.254.169.254' : '93.184.216.34' }]) } }));

const { executeTool } = require('../services/CollectionMcpServerService');

const mockFetch = jest.fn();
const run = (col, args = {}) => executeTool(col, 'health_check', args, mockFetch);

const collection = (url = 'https://example.com/health') => ({
    _id: 'collection-1',
    name: 'End-to-End Tests',
    requests: [{ _id: 'request-1', name: 'Health Check', method: 'GET', url, protocol: 'http', headers: [{ name: 'Authorization', value: 'Bearer secret-token', enabled: true }] }],
    metadata: { mcpServer: { enabled: true, requestIds: ['request-1'] } }
});

const reply = (status, headers = {}, body = 'ok') => ({
    status,
    statusText: 'OK',
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    body: (async function* () { yield Buffer.from(body); })()
});

beforeEach(() => mockFetch.mockReset());

describe('collection MCP redirect handling', () => {
    test('follows a same-origin redirect and returns the final response', async () => {
        mockFetch
            .mockResolvedValueOnce(reply(302, { location: '/health/v2' }))
            .mockResolvedValueOnce(reply(200, {}, 'healthy'));
        const result = await run(collection());
        expect(result.status).toBe(200);
        expect(result.body).toBe('healthy');
        expect(mockFetch.mock.calls[1][0]).toBe('https://example.com/health/v2');
        // Same origin keeps the stored credential.
        expect(mockFetch.mock.calls[1][1].headers.Authorization).toBe('Bearer secret-token');
    });

    test('drops credentials on a cross-origin redirect', async () => {
        mockFetch
            .mockResolvedValueOnce(reply(301, { location: 'https://other.example/health' }))
            .mockResolvedValueOnce(reply(200));
        await run(collection());
        expect(mockFetch.mock.calls[1][1].headers.Authorization).toBeUndefined();
    });

    test('re-applies the SSRF check to each redirect hop', async () => {
        mockFetch.mockResolvedValueOnce(reply(302, { location: 'https://internal.test/latest/meta-data' }));
        await expect(run(collection()))
            .rejects.toThrow(/private or local network addresses/);
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test('caps the redirect chain', async () => {
        mockFetch.mockResolvedValue(reply(302, { location: '/loop' }));
        await expect(run(collection())).rejects.toThrow(/redirected more than 5 times/);
    });

    test('follows a same-origin 307 redirect for a request body', async () => {
        const withBody = collection();
        withBody.requests[0].method = 'POST';
        withBody.requests[0].bodyType = 'json';
        withBody.requests[0].body = '{"ping":true}';
        mockFetch
            .mockResolvedValueOnce(reply(307, { location: '/health/v2' }))
            .mockResolvedValueOnce(reply(200, {}, 'updated'));
        await expect(run(withBody)).resolves.toMatchObject({ status: 200, body: 'updated' });
        expect(mockFetch.mock.calls[1][0]).toBe('https://example.com/health/v2');
        expect(mockFetch.mock.calls[1][1].method).toBe('POST');
        expect(mockFetch.mock.calls[1][1].body).toBe('{"ping":true}');
    });

    test('refuses a cross-origin redirect for a request body', async () => {
        const withBody = collection();
        withBody.requests[0].method = 'POST';
        withBody.requests[0].bodyType = 'json';
        withBody.requests[0].body = '{"ping":true}';
        mockFetch.mockResolvedValueOnce(reply(307, { location: 'https://other.example/health/v2' }));
        await expect(run(withBody)).rejects.toThrow(/different origin/);
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test('refuses a method-changing redirect for a request body', async () => {
        const withBody = collection();
        withBody.requests[0].method = 'POST';
        withBody.requests[0].bodyType = 'json';
        withBody.requests[0].body = '{"ping":true}';
        mockFetch.mockResolvedValueOnce(reply(302, { location: '/health/v2' }));
        await expect(run(withBody)).rejects.toThrow(/method-changing status/);
    });
});
