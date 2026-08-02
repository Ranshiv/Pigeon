const { complete } = require('../services/CopilotNimClient');

describe('Copilot NVIDIA failover', () => {
    test('retries a 529 in the same user request with the next model and key', async () => {
        const calls = [];
        const transport = async (_url, options) => {
            const request = JSON.parse(options.body);
            calls.push({ model: request.model, authorization: options.headers.Authorization });
            if (calls.length === 1) return { status: 529, ok: false };
            return {
                status: 200,
                ok: true,
                json: async () => ({ choices: [{ message: { content: '{"answer":"Ready","citations":[],"actions":[]}' } }] })
            };
        };
        const result = await complete({
            id: `test-${Date.now()}`,
            baseUrl: 'https://example.invalid/v1',
            apiKeys: ['key-one', 'key-two'],
            models: ['fast-model', 'fallback-model']
        }, [{ role: 'user', content: 'Hello' }], transport);
        expect(result).toContain('Ready');
        expect(calls).toHaveLength(2);
        expect(calls[0].model).toBe('fast-model');
        expect(calls[1].model).toBe('fallback-model');
        expect(calls[0].authorization).not.toBe(calls[1].authorization);
    });

    test('retries an aborted request and succeeds with another candidate', async () => {
        const calls = [];
        const transport = async (_url, options) => {
            calls.push(JSON.parse(options.body));
            if (calls.length === 1) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
            return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'ok' } }] }) };
        };
        await expect(complete({ id: `abort-${Date.now()}`, baseUrl: 'https://example.invalid/v1', apiKeys: ['a', 'b'], models: ['one', 'two'] }, [{ role: 'user', content: 'Hello' }], transport)).resolves.toBe('ok');
        expect(calls.map(({ model }) => model)).toEqual(['one', 'two']);
    });

    test('returns one generic message after all transient attempts fail', async () => {
        const transport = async () => ({ ok: false, status: 529 });
        await expect(complete({ id: `busy-${Date.now()}`, baseUrl: 'https://example.invalid/v1', apiKeys: ['a'], models: ['one', 'two', 'three'] }, [{ role: 'user', content: 'Hello' }], transport))
            .rejects.toThrow('Copilot is temporarily busy. Please try again.');
    });

    test.each([401, 403])('stops immediately on authentication status %s', async (status) => {
        const transport = jest.fn(async () => ({ ok: false, status }));
        await expect(complete({ id: `auth-${status}-${Date.now()}`, baseUrl: 'https://example.invalid/v1', apiKeys: ['a', 'b'], models: ['one', 'two'] }, [{ role: 'user', content: 'Hello' }], transport))
            .rejects.toThrow('Copilot is not configured correctly.');
        expect(transport).toHaveBeenCalledTimes(1);
    });

    test('uses a larger response budget for documentation requests', async () => {
        const budgets = [];
        const transport = async (_url, options) => {
            budgets.push(JSON.parse(options.body).max_tokens);
            return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'ok' } }] }) };
        };
        const profile = { id: `budget-${Date.now()}`, baseUrl: 'https://example.invalid/v1', apiKeys: ['a'], models: ['one'] };
        await complete(profile, [{ role: 'user', content: 'Where are variables?' }], transport);
        await complete(profile, [{ role: 'user', content: 'Update documentation with an Authentication section.' }], transport);
        expect(budgets).toEqual([800, 1400]);
    });

    test('retries when a provider returns an empty assistant message', async () => {
        const transport = jest.fn()
            .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '' } }] }) })
            .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'fallback' } }] }) });
        await expect(complete({ id: `empty-${Date.now()}`, baseUrl: 'https://example.invalid/v1', apiKeys: ['a', 'b'], models: ['one', 'two'] }, [{ role: 'user', content: 'Hello' }], transport)).resolves.toBe('fallback');
        expect(transport).toHaveBeenCalledTimes(2);
    });
});
