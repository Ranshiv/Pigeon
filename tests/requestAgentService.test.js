const agent = require('../services/RequestAgentService');

describe('RequestAgentService', () => {
    test('redacts credentials from request context', () => {
        const result = agent.redactRequest({
            url: 'https://api.example.test/users',
            headers: [{ key: 'Authorization', value: 'Bearer top-secret' }, { key: 'Accept', value: 'application/json' }],
            authConfig: { type: 'Bearer', bearer: { token: 'top-secret' } },
            body: '{"password":"top-secret","name":"Ada"}'
        });
        expect(result.headers[0].value).toBe('[REDACTED]');
        expect(result.authConfig.bearer.token).toBe('{{ASYNCAPI_SECRET}}');
        expect(result.body).toContain('{{ASYNCAPI_SECRET}}');
        expect(result.body).not.toContain('top-secret');
    });

    test('accepts only supported patch fields and methods', () => {
        expect(agent.normalizePatch({ field: 'method', value: 'post', reason: 'Uses a JSON body.' }).value).toBe('POST');
        expect(agent.normalizePatch({ field: 'unknown', value: 'x' })).toBeNull();
        expect(agent.normalizePatch({ field: 'method', value: 'TRACE' })).toBeNull();
        expect(agent.normalizePatch({ field: 'headers', value: 'not an array' })).toBeNull();
    });

    test('does not allow a model to apply a redacted secret placeholder', () => {
        expect(agent.normalizePatch({ field: 'headers', value: [{ key: 'Authorization', value: '[REDACTED]' }] })).toBeNull();
    });

    test('does not automatically apply raw credentials from cURL headers', () => {
        expect(agent.normalizePatch({ field: 'headers', value: [{ key: 'Authorization', value: 'Bearer live-secret' }] })).toBeNull();
        expect(agent.normalizePatch({ field: 'headers', value: [{ key: 'Authorization', value: 'Bearer {{TOKEN}}' }] })).not.toBeNull();
    });

    test('normalizes malformed request rows before they reach the editor', () => {
        const result = agent.normalizePatch({ field: 'params', value: [undefined, { name: 'page', value: 1 }] });
        expect(result.value).toEqual([expect.objectContaining({ key: 'page', value: '1', enabled: true })]);
    });

    test('parses structured model output and drops malformed patches', () => {
        const result = agent.parseResult(JSON.stringify({
            answer: 'The endpoint is ready.',
            warnings: ['Use a test environment.'],
            patches: [
                { field: 'url', value: 'https://api.example.test/users', reason: 'Complete the endpoint.' },
                { field: 'nope', value: 'bad' },
                { field: 'headers', value: [] }
            ]
        }));
        expect(result.patches.map((item) => item.field)).toEqual(['url', 'headers']);
        expect(result.warnings).toHaveLength(1);
    });

    test('accepts common provider response envelopes', () => {
        expect(agent.parseResult(JSON.stringify({ result: { response: 'Use the current endpoint.' } })).answer)
            .toBe('Use the current endpoint.');
        expect(agent.parseResult(JSON.stringify({ message: { content: 'Inspect the response status.' } })).answer)
            .toBe('Inspect the response status.');
    });

    test('preserves a plain-text provider response', () => {
        expect(agent.parseResult('Add the missing URL before sending this request.').answer)
            .toBe('Add the missing URL before sending this request.');
    });

    test('turns an explicit Google URL request into a URL patch, not params', () => {
        const result = agent.enforceUrlIntent({ answer: 'Suggestion', patches: [{ field: 'params', value: [{ key: 'hl', value: 'en' }] }] }, 'Change this to a Google URL');
        expect(result.patches).toEqual([expect.objectContaining({ field: 'url', value: 'https://www.google.com' })]);
    });

    test('uses the exact URL supplied by the user', () => {
        const result = agent.enforceUrlIntent({ answer: 'Suggestion', patches: [] }, 'Use https://example.test/users as the request URL');
        expect(result.patches[0]).toMatchObject({ field: 'url', value: 'https://example.test/users' });
    });

    test('parses a cURL request into editor patches', () => {
        const result = agent.parseCurl(`curl -X POST https://example.test/users -H 'Content-Type: application/json' -d '{"name":"Ada"}'`);
        expect(result).toEqual(expect.arrayContaining([
            expect.objectContaining({ field: 'method', value: 'POST' }),
            expect.objectContaining({ field: 'url', value: 'https://example.test/users' }),
            expect.objectContaining({ field: 'body', value: '{"name":"Ada"}' })
        ]));
    });

    test('builds natural-language URL, method, name, and params patches', () => {
        const result = agent.parseNaturalLanguage('Create a GET request for https://example.test/users with page=1 and limit=20');
        expect(result).toEqual(expect.arrayContaining([
            expect.objectContaining({ field: 'method', value: 'GET' }),
            expect.objectContaining({ field: 'url', value: 'https://example.test/users' }),
            expect.objectContaining({ field: 'params' })
        ]));
        expect(result.find((patch) => patch.field === 'name').value).toContain('Users');
    });

    test('keeps deterministic request patches when the model returns no patches', async () => {
        const nim = { complete: jest.fn().mockResolvedValue('{"answer":"I can help with that.","patches":[]}') };
        const result = await agent.assist({ profile: { id: 'test' }, nim, request: {}, prompt: 'Create a GET request for https://example.test/users', activeTab: 'params' });
        expect(result.patches).toEqual(expect.arrayContaining([
            expect.objectContaining({ field: 'method', value: 'GET' }),
            expect.objectContaining({ field: 'url', value: 'https://example.test/users' })
        ]));
        expect(nim.complete).toHaveBeenCalledTimes(1);
        expect(result.confidence).toBe('high');
    });
});
