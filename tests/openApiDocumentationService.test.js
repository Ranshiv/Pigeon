const {
    DocumentationInputError,
    parseOpenApi,
    normalizeOpenApi,
    normalizeCollection,
    buildDeterministicDraft,
    mergeGeneratedSections,
    scanSecrets
} = require('../services/OpenApiDocumentationService');

const YAML_SPEC = `
openapi: 3.2.0
info:
  title: Payments API
  version: 2.1.0
servers:
  - url: https://api.example.com
components:
  securitySchemes:
    oauth:
      type: oauth2
      flows:
        authorizationCode:
          authorizationUrl: https://identity.example.com/authorize
          tokenUrl: https://identity.example.com/token
          scopes: { payments:read: Read payments }
paths:
  /payments/{id}:
    get:
      operationId: getPayment
      summary: Get a payment
      security:
        - oauth: [payments:read]
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: uuid }
      responses:
        '200':
          description: Payment returned
          content:
            application/json:
              schema:
                type: object
                properties:
                  id: { type: string, format: uuid }
                  status: { type: string, enum: [settled, pending] }
        '404':
          description: Payment not found
          content:
            application/problem+json:
              schema:
                type: object
                properties:
                  type: { type: string }
                  title: { type: string }
                  status: { type: integer }
`;

describe('OpenApiDocumentationService', () => {
    test('parses OpenAPI 3.2 YAML and normalizes grounded operation facts', () => {
        const source = normalizeOpenApi(parseOpenApi(YAML_SPEC, 'yaml'));
        expect(source.specificationVersion).toBe('3.2.0');
        expect(source.operations).toHaveLength(1);
        expect(source.operations[0]).toMatchObject({ operationId: 'getPayment', method: 'GET', path: '/payments/{id}' });
        expect(source.operations[0].security[0]).toMatchObject({ name: 'oauth', type: 'oauth2' });
        expect(source.operations[0].responses.map((item) => item.status)).toEqual(['200', '404']);
    });

    test('repairs list indentation retained after the first pasted YAML line', () => {
        const pasted = `openapi: 3.2.0
      info:
        title: Documentation Test API
        version: 1.0.0
      paths: {}`;

        expect(parseOpenApi(pasted, 'yaml')).toMatchObject({
            openapi: '3.2.0',
            info: { title: 'Documentation Test API', version: '1.0.0' },
            paths: {}
        });
    });

    test('blocks external references instead of performing network resolution', () => {
        const unsafe = JSON.stringify({ openapi: '3.2.0', info: { title: 'Unsafe', version: '1.0.0' }, paths: {}, components: { schemas: { User: { $ref: 'https://example.com/user.json' } } } });
        expect(() => parseOpenApi(unsafe, 'json')).toThrow(DocumentationInputError);
        try { parseOpenApi(unsafe, 'json'); } catch (error) { expect(error.code).toBe('EXTERNAL_REF_BLOCKED'); }
    });

    test('preserves collection path-parameter braces in generated documentation facts', () => {
        const source = normalizeCollection({
            _id: 'collection-1',
            name: 'Users API',
            requests: [{ _id: 'request-1', name: 'Get user', method: 'GET', url: 'https://api.example.com/users/%7Bid%7D' }]
        });

        expect(source.operations[0].path).toBe('https://api.example.com/users/{id}');
    });

    test('renders authentication, code examples, errors, tutorials, and coverage', () => {
        const source = normalizeOpenApi(parseOpenApi(YAML_SPEC, 'yaml'));
        const draft = buildDeterministicDraft(source);
        expect(draft.markdown).toContain('## Authentication');
        expect(draft.markdown).toContain('authorization-code flow with PKCE');
        expect(draft.markdown).toContain('**cURL**');
        expect(draft.markdown).toContain('**JavaScript**');
        expect(draft.markdown).toContain('**Python**');
        expect(draft.markdown).toContain('| 404 | Payment not found |');
        expect(draft.markdown).toContain('RFC 9457 problem responses');
        expect(draft.markdown).toContain('## Tutorials');
        expect(draft.coverage).toMatchObject({ selected: 1, total: 1, missingErrors: 0 });
    });

    test('merges marked sections without duplicating them', () => {
        const first = [{ id: 'overview', markdown: '# First' }];
        const second = [{ id: 'overview', markdown: '# Second' }];
        const merged = mergeGeneratedSections(mergeGeneratedSections('', first), second);
        expect(merged).toContain('# Second');
        expect(merged).not.toContain('# First');
        expect((merged.match(/pigeon:section:overview/g) || [])).toHaveLength(1);
    });

    test('detects credential-like values while allowing placeholders', () => {
        expect(scanSecrets('Authorization: Bearer <access-token>')).toHaveLength(0);
        expect(scanSecrets('api_key=live_1234567890abcdef')).toHaveLength(1);
    });
});
