const {
    CATEGORIES,
    redact,
    normalizeOpenApi,
    normalizeGraphQlRequest,
    normalizeAsyncApi,
    normalizeHistory,
    mergeOperations,
    deterministicCases,
    dedupeAndLimit,
    parseModelJson
} = require('../services/TestGenerationService');

describe('TestGenerationService', () => {
    test('normalizes OpenAPI operations and generates every requested category', () => {
        const spec = {
            openapi: '3.2.0',
            paths: {
                '/users/{id}': {
                    get: {
                        operationId: 'getUser',
                        security: [{ bearerAuth: [] }],
                        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }],
                        responses: { 200: { content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } }, example: { id: 'volatile', name: 'Ada' } } } } }
                    }
                }
            }
        };
        const [operation] = normalizeOpenApi(spec, { type: 'openapi', id: 'v1', label: 'Users' });
        const cases = deterministicCases(operation, CATEGORIES, []);
        expect(operation.id).toBe('http:GET:/users/{id}');
        expect(operation.declaredOperationId).toBe('getUser');
        CATEGORIES.forEach((category) => expect(cases.some((item) => item.category === category)).toBe(true));
        expect(cases.find((item) => item.name.startsWith('Cross-actor'))?.blocked).toBe(true);
        expect(cases.find((item) => item.category === 'regression').assertions.some((item) => item.expected === 'name')).toBe(true);
        expect(cases.find((item) => item.category === 'regression').assertions.some((item) => item.expected === 'id')).toBe(false);
    });

    test('normalizes GraphQL and produces variable validation cases', () => {
        const request = {
            name: 'Create user', method: 'GRAPHQL', protocol: 'graphql', url: '/graphql',
            graphql: {
                operationType: 'mutation', operationName: 'CreateUser',
                query: 'mutation CreateUser($email: String!) { createUser(email: $email) { id } }',
                variables: { email: 'user@example.com' },
                schema: 'type Query { ok: Boolean } type Mutation { createUser(email: String!): User! } type User { id: ID! }'
            }
        };
        const [operation] = normalizeGraphQlRequest(request, { type: 'saved-request', id: 'r1', label: request.name });
        const cases = deterministicCases(operation, ['positive', 'negative', 'schema'], []);
        expect(operation.method).toBe('MUTATION');
        expect(cases.some((item) => /Missing \$email/.test(item.name))).toBe(true);
        expect(cases.some((item) => item.assertions.some((assertion) => assertion.kind === 'graphql-errors'))).toBe(true);
    });

    test('normalizes AsyncAPI messages into message-schema cases', () => {
        const document = {
            operations: [{ channelName: 'orders', action: 'publish', messageName: 'OrderCreated' }],
            channels: [{ name: 'orders', address: 'orders.created' }],
            messages: [{ name: 'OrderCreated', payloadSchema: { type: 'object', required: ['orderId'] }, payloadExample: '{"orderId":"42"}' }]
        };
        const [operation] = normalizeAsyncApi(document, { type: 'asyncapi', id: 'a1', label: 'Orders' });
        const cases = deterministicCases(operation, ['positive', 'schema', 'regression'], []);
        expect(operation.address).toBe('orders.created');
        expect(cases.find((item) => item.category === 'schema').assertions[0].kind).toBe('message-schema');
    });

    test('merges saved observations and derives a conservative latency ceiling', () => {
        const source = { type: 'history', id: 'h1', label: 'GET /health' };
        const first = normalizeHistory({ method: 'GET', url: '/health', responseStatus: 200, responseBody: '{"status":"ok"}', duration: 50 }, source);
        const second = normalizeHistory({ method: 'GET', url: '/health', responseStatus: 200, responseBody: '{"status":"ok"}', duration: 100 }, { ...source, id: 'h2' });
        const [operation] = mergeOperations([...first, ...second]);
        const regression = deterministicCases(operation, ['regression'], [])[0];
        expect(operation.observed).toHaveLength(2);
        expect(regression.assertions.find((item) => item.kind === 'latency').expected).toBe(250);
    });

    test('redacts secrets and deduplicates stable cases', () => {
        expect(redact({ Authorization: 'Bearer abc', nested: { apiKey: 'secret', safe: 'value' } })).toEqual({ Authorization: '[REDACTED]', nested: { apiKey: '[REDACTED]', safe: 'value' } });
        const item = { fingerprint: 'same' };
        expect(dedupeAndLimit([item, { ...item }, { fingerprint: 'other' }])).toHaveLength(2);
    });

    test('parses valid structured model output wrapped in a JSON fence', () => {
        expect(parseModelJson('```json\n{"cases":[]}\n```')).toEqual({ cases: [] });
        expect(parseModelJson('Model output:\n{"cases":[]}\nDone.')).toEqual({ cases: [] });
        expect(parseModelJson('{"cases":[')).toBeNull();
    });
});
