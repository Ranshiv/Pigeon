const { buildOpenApiCases, buildGraphQlCases } = require('../services/SchemaFuzzingService');

describe('SchemaFuzzingService', () => {
    test('generates deterministic OpenAPI validation cases including local refs', () => {
        const spec = { openapi: '3.0.0', components: { schemas: { User: { type: 'object', additionalProperties: false, required: ['email', 'role'], properties: { email: { type: 'string', format: 'email', minLength: 3 }, role: { type: 'string', enum: ['admin', 'viewer'] }, age: { type: 'integer', minimum: 18 } } } } }, paths: { '/users': { post: { requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } } } } } };
        const cases = buildOpenApiCases(spec, '/users', 'POST');
        expect(cases.map((item) => item.name)).toEqual(expect.arrayContaining(['Baseline', 'Missing email', 'Invalid role', 'Too short email', 'Below minimum age', 'Unexpected property']));
        expect(cases.find((item) => item.name === 'Baseline').overrides.body.role).toBe('admin');
    });

    test('generates required, type, and nested-input GraphQL cases', () => {
        const schema = 'type Query { user(input: UserInput!): String } input UserInput { email: String!, tags: [String!] }';
        const cases = buildGraphQlCases(schema, 'query Find($input: UserInput!, $limit: Int) { user(input: $input) }', { input: { email: 'person@example.test', tags: ['one'] }, limit: 10 });
        expect(cases.map((item) => item.name)).toEqual(expect.arrayContaining(['Baseline', 'Missing $input', 'Wrong type $input', 'Missing $input.email']));
    });

    test('does not mutate source variable values', () => {
        const variables = { input: { name: 'Ada' } };
        buildGraphQlCases('type Query { hello(input: Input): String } input Input { name: String }', 'query ($input: Input) { hello(input: $input) }', variables);
        expect(variables).toEqual({ input: { name: 'Ada' } });
    });
});
