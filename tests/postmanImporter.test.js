const {
    MAX_REQUESTS,
    MAX_VARIABLES,
    PostmanImportError,
    detectPostmanDocument,
    convertPostmanCollection,
    convertPostmanEnvironment,
    convertPostmanDocument
} = require('../services/importers/PostmanImporter');

const collectionDocument = (overrides = {}) => ({
    info: {
        name: 'Migration fixture',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    },
    item: [],
    ...overrides
});

const scriptEvent = (listen, ...lines) => ({
    listen,
    script: { type: 'text/javascript', exec: lines }
});

describe('PostmanImporter', () => {
    test('flattens nested folders and inherits auth and scripts without losing disabled pairs or examples', () => {
        const source = collectionDocument({
            auth: {
                type: 'bearer',
                bearer: [{ key: 'token', value: '{{token}}', type: 'string' }]
            },
            event: [scriptEvent('prerequest', 'collectionSetup();')],
            variable: [{ key: 'baseUrl', value: 'https://api.example.com' }],
            item: [{
                name: 'Users',
                event: [scriptEvent('prerequest', 'folderSetup();')],
                item: [{
                    name: 'Admin',
                    item: [{
                        id: 'request-1',
                        name: 'Create user',
                        event: [scriptEvent('test', 'pm.test("created", () => true);')],
                        request: {
                            method: 'POST',
                            url: {
                                raw: '{{baseUrl}}/users?visible=yes',
                                query: [
                                    { key: 'visible', value: 'yes' },
                                    { key: 'internal', value: 'no', disabled: true }
                                ]
                            },
                            header: [
                                { key: 'Content-Type', value: 'application/json' },
                                { key: 'X-Debug', value: '1', disabled: true }
                            ],
                            body: {
                                mode: 'raw',
                                raw: '{"name":"Ada"}',
                                options: { raw: { language: 'json' } }
                            }
                        },
                        response: [{
                            id: 'example-1',
                            name: 'Created',
                            status: 'Created',
                            code: 201,
                            header: [{ key: 'Content-Type', value: 'application/json' }],
                            body: '{"id":1}'
                        }]
                    }]
                }]
            }]
        });

        const converted = convertPostmanCollection(source);
        const request = converted.requests[0];

        expect(converted.kind).toBe('collection');
        expect(converted.metadata.folderTree).toEqual([
            expect.objectContaining({ path: ['Users'], description: '' }),
            expect.objectContaining({ path: ['Users', 'Admin'], description: '' })
        ]);
        expect(request.folderPath).toEqual(['Users', 'Admin']);
        expect(request.authConfig).toEqual({ type: 'Bearer Token', bearer: { token: '{{token}}' } });
        expect(request.preRequestScript).toBe('collectionSetup();\n\nfolderSetup();');
        expect(request.testScript).toContain('pm.test');
        expect(request.bodyType).toBe('json');
        expect(request.headers.find((header) => header.key === 'X-Debug').enabled).toBe(false);
        expect(request.params.find((param) => param.key === 'internal').enabled).toBe(false);
        expect(request.metadata.disabledHeaders).toHaveLength(1);
        expect(request.metadata.disabledParams).toHaveLength(1);
        expect(request.metadata.savedExamples[0]).toMatchObject({ name: 'Created', code: 201, body: '{"id":1}' });
        expect(converted.documentation.content).toContain('# Migration fixture');
        expect(converted.documentation.content).toContain('## Folders');
        expect(converted.documentation.content).toContain('### Users / Admin');
        expect(converted.documentation.content).toContain('Collection pre-request script');
        expect(converted.warnings).toEqual(expect.arrayContaining([
            expect.stringContaining('pm.* APIs')
        ]));
    });

    test('converts GraphQL and form bodies while warning about file fields', () => {
        const source = collectionDocument({
            item: [
                {
                    name: 'GraphQL request',
                    request: {
                        method: 'POST',
                        url: 'https://api.example.com/graphql',
                        body: {
                            mode: 'graphql',
                            graphql: {
                                query: 'query Viewer { viewer { id } }',
                                variables: '{"limit":10}'
                            }
                        }
                    }
                },
                {
                    name: 'Upload request',
                    request: {
                        method: 'POST',
                        url: 'https://api.example.com/upload',
                        body: {
                            mode: 'formdata',
                            formdata: [
                                { key: 'label', value: 'avatar', type: 'text' },
                                { key: 'file', src: '/tmp/avatar.png', type: 'file' },
                                { key: 'disabled', value: 'hidden', disabled: true, type: 'text' }
                            ]
                        }
                    }
                }
            ]
        });

        const converted = convertPostmanCollection(source);
        const graphql = converted.requests[0];
        const form = converted.requests[1];

        expect(graphql.protocol).toBe('graphql');
        expect(graphql.bodyType).toBe('json');
        expect(graphql.graphql).toMatchObject({
            query: 'query Viewer { viewer { id } }',
            variables: { limit: 10 }
        });
        expect(JSON.parse(graphql.body)).toEqual({
            query: 'query Viewer { viewer { id } }',
            variables: { limit: 10 }
        });
        expect(form.bodyType).toBe('form-data');
        expect(form.bodyFormData).toHaveLength(3);
        expect(form.bodyFormData.find((field) => field.key === 'disabled').enabled).toBe(false);
        expect(form.bodyFormData.find((field) => field.key === 'file')).toMatchObject({
            type: 'file',
            src: '/tmp/avatar.png'
        });
        expect(converted.warnings).toContain('Postman file form fields require reselecting local files after import.');
    });

    test('preserves secret markers and disabled environment variables as migration metadata', () => {
        const converted = convertPostmanEnvironment({
            id: 'environment-1',
            name: 'Production',
            _postman_variable_scope: 'environment',
            values: [
                { key: 'host', value: 'https://api.example.com', enabled: true },
                { key: 'token', value: 'secret-value', type: 'secret', enabled: true },
                { key: 'oldHost', value: 'https://old.example.com', enabled: false }
            ]
        });

        expect(converted.kind).toBe('environment');
        expect(converted.variables).toHaveLength(2);
        expect(converted.variables.find((variable) => variable.key === 'token').isSecret).toBe(true);
        expect(converted.metadata.disabledVariables).toEqual([
            expect.objectContaining({ key: 'oldHost', enabled: false })
        ]);
        expect(converted.warnings).toContain('Secret values were imported. Review and rotate credentials if this export file was shared.');
    });

    test('detects supported documents and rejects invalid shapes and schemas', () => {
        expect(detectPostmanDocument(collectionDocument())).toBe('collection');
        expect(detectPostmanDocument({ name: 'Local', values: [] })).toBe('environment');
        expect(convertPostmanDocument({ name: 'Local', values: [] }).kind).toBe('environment');
        expect(() => detectPostmanDocument([])).toThrow(PostmanImportError);
        expect(() => detectPostmanDocument({ swagger: '2.0' })).toThrow('neither a Postman collection nor a Postman environment');
        expect(() => convertPostmanCollection(collectionDocument({
            info: { name: 'Wrong schema', schema: 'https://example.com/schema.json' }
        }))).toThrow('Unsupported Postman collection schema');
    });

    test('enforces request and variable limits without rejecting exactly 1,000 requests', () => {
        const requestItem = (index) => ({
            name: `Request ${index}`,
            request: { method: 'GET', url: `https://api.example.com/${index}` }
        });
        const atRequestLimit = collectionDocument({
            item: [
                ...Array.from({ length: MAX_REQUESTS }, (_, index) => requestItem(index)),
                { name: 'Empty trailing folder', item: [] }
            ]
        });
        expect(convertPostmanCollection(atRequestLimit).requests).toHaveLength(MAX_REQUESTS);

        const overRequestLimit = collectionDocument({
            item: Array.from({ length: MAX_REQUESTS + 1 }, (_, index) => requestItem(index))
        });
        expect(() => convertPostmanCollection(overRequestLimit)).toThrow('more than 1000 requests');

        const overVariableLimit = {
            name: 'Too many variables',
            values: Array.from({ length: MAX_VARIABLES + 1 }, (_, index) => ({ key: `key-${index}`, value: '' }))
        };
        expect(() => convertPostmanEnvironment(overVariableLimit)).toThrow('more than 2000 variables');
    });
});
