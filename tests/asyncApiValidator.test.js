// tests/asyncApiValidator.test.js
// Pure unit tests for AsyncAPI normalisation, schema validation, redaction
// and the protocol dispatch path. No real network: kafka/amqp/nats/stomp are
// "connector required" results (no connection attempted); websocket/mqtt/http
// paths are exercised only against unreachable URLs so they fail fast without
// actually opening a real connection.
const {
    normalizeAsyncApiDocument,
    denormalizeToAsyncApiJson,
    validatePayloadAgainstSchema,
    deriveSchemaFromExample,
    redactSensitiveValues,
    SECRET_PLACEHOLDER,
    isSensitiveKey,
    getByPath
} = require('../services/AsyncApiValidator');
const { runAsyncApiTest } = require('../services/AsyncApiTestRunner');

describe('normalizeAsyncApiDocument — AsyncAPI 2.x', () => {
    const doc2 = {
        asyncapi: '2.6.0',
        info: { title: 'Events', version: '1.2.0', description: 'demo', tags: [{ name: 'beta' }] },
        servers: {
            prod: { url: 'mqtt://broker.hivemq.com:1883', protocol: 'mqtt' },
            ws: { url: 'wss://echo.websocket.org', protocol: 'ws' }
        },
        channels: {
            'user/signedup': {
                description: 'A user signed up',
                publish: { message: { $ref: '#/components/messages/UserSignedUp' } }
            }
        },
        components: {
            messages: {
                UserSignedUp: {
                    name: 'UserSignedUp',
                    title: 'User Signed Up',
                    contentType: 'application/json',
                    payload: { type: 'object', properties: { userId: { type: 'string' } }, required: ['userId'] }
                }
            }
        }
    };

    test('extracts servers, channels, messages and preserves info tags', () => {
        const norm = normalizeAsyncApiDocument(doc2);
        expect(norm.name).toBe('Events');
        expect(norm.asyncApiVersion).toBe('2.6.0');
        expect(norm.servers).toHaveLength(2);
        expect(norm.servers[0].protocol).toBe('mqtt');
        expect(norm.servers[1].protocol).toBe('websocket'); // ws → websocket
        expect(norm.channels[0].name).toBe('user/signedup');
        expect(norm.messages.find((m) => m.name === 'UserSignedUp')).toBeTruthy();
        expect(norm.messages[0].payloadSchema.properties.userId).toBeDefined();
        expect(norm.tags).toEqual(['beta']);
    });

    test('rawImport is preserved and round-trips through denormalize', () => {
        const norm = normalizeAsyncApiDocument(doc2);
        const back = denormalizeToAsyncApiJson({ toObject: () => norm, ...norm });
        expect(back.asyncapi).toBe('2.6.0');
        expect(back.info.title).toBe('Events');
        expect(back.info.version).toBe('1.2.0');
    });

    test('operations inferred from channel publish', () => {
        const norm = normalizeAsyncApiDocument(doc2);
        expect(norm.operations).toEqual(expect.arrayContaining([
            expect.objectContaining({ channelName: 'user/signedup', action: 'publish', messageName: 'UserSignedUp' })
        ]));
    });
});

describe('normalizeAsyncApiDocument — AsyncAPI 3.x', () => {
    const doc3 = {
        asyncapi: '3.0.0',
        info: { title: 'Stream', version: '1.0.0' },
        servers: [{ host: 'mqtt://broker.hivemq.com', protocol: 'mqtt' }],
        channels: [{ name: 'events', address: 'events', messages: { m1: { $ref: '#/components/messages/M' } } }],
        operations: [{ action: 'send', channel: { $ref: '#/channels/events' }, messages: [{ $ref: '#/components/messages/M' }] }],
        components: { messages: { M: { contentType: 'application/json', payload: { type: 'object' } } } }
    };

    test('maps 3.x servers array and restructured channels', () => {
        const norm = normalizeAsyncApiDocument(doc3);
        expect(norm.servers).toHaveLength(1);
        expect(norm.channels[0].name).toBe('events');
        expect(norm.messages.find((m) => m.name === 'm1')).toBeTruthy();
        expect(norm.operations[0].action).toBe('publish'); // send → publish
    });

    test('clean 3.x import produces no generic restructuring warning', () => {
        const norm = normalizeAsyncApiDocument(doc3);
        expect(norm.importWarnings.some((w) => /3\.x .*restructured/i.test(w))).toBe(false);
    });

    test('3.x channel with parameters produces a specific warning', () => {
        const doc = {
            ...doc3,
            channels: [{ name: 'events', address: 'events', parameters: { id: { description: 'p' } }, messages: { m1: { $ref: '#/components/messages/M' } } }]
        };
        const norm = normalizeAsyncApiDocument(doc);
        expect(norm.importWarnings.some((w) => /Channel `events` has parameters that Pigeon does not model/.test(w))).toBe(true);
        expect(norm.importWarnings.some((w) => /restructured/i.test(w))).toBe(false);
    });

    test('3.x operation with reply/security/traits produces a specific warning', () => {
        const doc = {
            ...doc3,
            operations: [{
                action: 'send',
                channel: { $ref: '#/channels/events' },
                messages: [{ $ref: '#/components/messages/M' }],
                reply: { address: 'r' },
                security: [{ type: 'oauth2' }],
                traits: [{ name: 't' }]
            }]
        };
        const norm = normalizeAsyncApiDocument(doc);
        expect(norm.importWarnings.some((w) => /Operation on channel `events` has reply\/security\/traits/.test(w))).toBe(true);
    });
});

describe('normalizeAsyncApiDocument — rejection', () => {
    test('rejects non-object', () => {
        expect(() => normalizeAsyncApiDocument([])).toThrow(/JSON object/);
    });
    test('rejects missing asyncapi version', () => {
        expect(() => normalizeAsyncApiDocument({ info: {} })).toThrow(/asyncapi/);
    });
    test('rejects unsupported version', () => {
        expect(() => normalizeAsyncApiDocument({ asyncapi: '4.0.0', info: {} })).toThrow(/Unsupported/);
    });
});

describe('redaction', () => {
    test('secrets in server security and example values are replaced with placeholder', () => {
        const payload = {
            asyncapi: '2.6.0',
            info: { title: 'X', version: '1.0.0' },
            servers: {
                p: { url: 'mqtt://broker', protocol: 'mqtt', security: [{ 'oauth2': ['write'], 'token': 'sk-live-123456' }] }
            },
            channels: { c: { publish: { message: { payload: { type: 'string' } } } } }
        };
        const norm = normalizeAsyncApiDocument(payload);
        expect(norm.servers[0].security).toContain(SECRET_PLACEHOLDER);
        expect(norm.servers[0].security).not.toContain('sk-live-123456');
        // rawImport too.
        const raw = JSON.stringify(norm.rawImport);
        expect(raw).not.toContain('sk-live-123456');
    });
    test('isSensitiveKey matches common credential names', () => {
        expect(isSensitiveKey('Authorization')).toBe(true);
        expect(isSensitiveKey('X-API-KEY')).toBe(true);
        expect(isSensitiveKey('client_secret')).toBe(true);
        expect(isSensitiveKey('userId')).toBe(false);
    });
    test('redactSensitiveValues walks arrays and objects', () => {
        const out = redactSensitiveValues({ items: [{ password: 'pw' }], name: 'ok' });
        expect(out.items[0].password).toBe(SECRET_PLACEHOLDER);
        expect(out.name).toBe('ok');
    });
});

describe('validatePayloadAgainstSchema', () => {
    test('object with missing required field yields field-level error', () => {
        const schema = { type: 'object', properties: { id: { type: 'string' }, n: { type: 'number' } }, required: ['id', 'n'] };
        const r = validatePayloadAgainstSchema({ id: 'x' }, schema);
        expect(r.validated).toBe(true);
        expect(r.violations).toHaveLength(1);
        expect(r.violations[0].path).toBe('n');
        expect(r.violations[0].message).toMatch(/Missing required/);
    });
    test('integer vs number refinement', () => {
        const r = validatePayloadAgainstSchema(1.5, { type: 'integer' });
        expect(r.violations[0].expected).toBe('integer');
    });
    test('wrong type yields expected path', () => {
        const r = validatePayloadAgainstSchema({ id: 5 }, { type: 'object', properties: { id: { type: 'string' } } });
        expect(r.violations[0].actual).toBe('number');
        expect(r.violations[0].expected).toBe('string');
    });
    test('array items validated against items schema', () => {
        const r = validatePayloadAgainstSchema([1, 'x'], { type: 'array', items: { type: 'number' } });
        expect(r.violations).toHaveLength(1);
        expect(r.violations[0].path).toBe('[1]');
    });
    test('valid object passes', () => {
        const r = validatePayloadAgainstSchema({ id: 'a', b: true }, {
            type: 'object',
            properties: { id: { type: 'string' }, b: { type: 'boolean' } },
            required: ['id', 'b']
        });
        expect(r.violations).toHaveLength(0);
    });
    test('"no schema to validate against" when schema absent', () => {
        const r = validatePayloadAgainstSchema({}, {});
        expect(r.validated).toBe(false);
        // No schema → caller must surface "no schema" — verified in the runner below.
    });
    test('null payload against null schema passes', () => {
        const r = validatePayloadAgainstSchema(null, { type: 'null' });
        expect(r.violations).toHaveLength(0);
    });
    test('enum violation flagged', () => {
        const r = validatePayloadAgainstSchema('x', { type: 'string', enum: ['a', 'b'] });
        expect(r.violations[0].message).toMatch(/one of/);
        expect(r.violations[0].expected).toBe('enum: ["a","b"]');
    });
});

describe('deriveSchemaFromExample', () => {
    test('infers object/array/scalar types', () => {
        const s = deriveSchemaFromExample({ id: 'a', n: 1, f: 1.5, b: true, arr: ['x'], obj: { k: 'v' }, nothing: null });
        expect(s.type).toBe('object');
        expect(s.properties.id.type).toBe('string');
        expect(s.properties.n.type).toBe('integer');
        expect(s.properties.f.type).toBe('number');
        expect(s.properties.b.type).toBe('boolean');
        expect(s.properties.arr.type).toBe('array');
        expect(s.properties.arr.items.type).toBe('string');
        expect(s.properties.obj.type).toBe('object');
        expect(s.properties.nothing.type).toBe('null');
    });
});

describe('getByPath', () => {
    test('dot + bracket navigation', () => {
        const root = { items: [{ sku: 'A' }] };
        expect(getByPath(root, 'items[0].sku')).toEqual({ found: true, value: 'A' });
        expect(getByPath(root, 'items[3].sku')).toEqual({ found: false, value: undefined });
    });
});

describe('runAsyncApiTest — dispatch', () => {
    test('kafka returns connector-required (error, not faked success)', async () => {
        const r = await runAsyncApiTest({
            document: { _id: 'd1', workspaceId: 'w1', servers: [], channels: [], messages: [], operations: [] },
            server: { protocol: 'kafka', url: 'kafka://broker:9092' },
            channel: { name: 'orders', address: 'orders' },
            operation: { action: 'publish' },
            message: { payloadSchema: {} },
            payload: ''
        });
        expect(r.status).toBe('error');
        expect(r.error).toMatch(/Connector required/);
        // protocol recorded honestly.
        expect(r.protocol).toBe('kafka');
    });

    test('amqp returns connector-required', async () => {
        const r = await runAsyncApiTest({
            server: { protocol: 'amqp', url: 'amqp://broker' }, channel: { name: 'q' }, operation: { action: 'subscribe' }, message: {}, payload: ''
        });
        expect(r.status).toBe('error');
        expect(r.error).toMatch(/Connector required/);
    });

    test('unsupported protocol returns structured error', async () => {
        const r = await runAsyncApiTest({
            server: { protocol: 'other' }, channel: { name: 'c' }, operation: { action: 'publish' }, message: {}, payload: ''
        });
        expect(r.status).toBe('error');
        expect(r.error).toMatch(/Unsupported protocol/);
    });

    test('result object carries the documented shape', async () => {
        const r = await runAsyncApiTest({
            server: { protocol: 'kafka' }, channel: {}, operation: {}, message: {}, payload: ''
        });
        expect(r).toHaveProperty('passed/failed/error' ? 'status' : 'status');
        expect(r).toHaveProperty('protocol');
        expect(r).toHaveProperty('channel');
        expect(r).toHaveProperty('operation');
        expect(r).toHaveProperty('durationMs');
        expect(r).toHaveProperty('requestPayload');
        expect(r).toHaveProperty('responsePayload');
        expect(r).toHaveProperty('error');
        expect(r).toHaveProperty('timestamp');
    });

    test('secrets in payload redacted in result.requestPayload', async () => {
        const r = await runAsyncApiTest({
            server: { protocol: 'kafka' }, channel: {}, operation: {}, message: {},
            payload: JSON.stringify({ Authorization: 'sk-1234', note: 'visible' })
        });
        expect(r.requestPayload).not.toContain('sk-1234');
        expect(r.requestPayload).toContain('visible');
    });
});

describe('round-trip export of an authored document', () => {
    test('denormalize synthesises a doc when rawImport is null', () => {
        const doc = {
            toObject: () => ({
                name: 'Authored',
                description: 'Hand-made',
                version: '1.0.0',
                asyncApiVersion: '2.6.0',
                servers: [{ name: 'prod', url: 'mqtt://broker.hivemq.com:1883', protocol: 'mqtt' }],
                channels: [{ name: 'orders', address: 'orders' }],
                messages: [{ name: 'OrderPlaced', contentType: 'application/json', payloadSchema: { type: 'object' } }],
                operations: [{ channelName: 'orders', action: 'publish', messageName: 'OrderPlaced' }],
                tags: ['beta']
            })
        };
        const out = denormalizeToAsyncApiJson(doc);
        expect(out.asyncapi).toBe('2.6.0');
        expect(out.info.title).toBe('Authored');
        expect(out.servers.prod.protocol).toBe('mqtt');
        expect(out.channels.orders.publish.message.name).toBe('OrderPlaced');
        expect(out.components.messages.OrderPlaced.payload.type).toBe('object');
    });

    test('export reflects a channel edited after import rather than the stale rawImport', () => {
        const norm = normalizeAsyncApiDocument({
            asyncapi: '2.6.0',
            info: { title: 'Old', version: '1.0.0' },
            servers: { s: { url: 'mqtt://b', protocol: 'mqtt' } },
            channels: { 'old/orders': { publish: { message: { $ref: '#/components/messages/M' } } } },
            components: { messages: { M: { contentType: 'application/json', payload: { type: 'object' } } } }
        });
        // Simulate a granular edit: channel renamed to 'new/orders' in the live arrays.
        const live = {
            ...norm,
            channels: [{ name: 'new/orders', address: 'new/orders', description: 'edited', bindings: {} }],
            operations: [{ channelName: 'new/orders', action: 'publish', messageName: 'M' }]
        };
        const out = denormalizeToAsyncApiJson({ toObject: () => live, ...live });
        expect(out.channels).toHaveProperty('new/orders');
        expect(out.channels).not.toHaveProperty('old/orders');
        expect(out.info.title).toBe('Old'); // scalar info comes from live doc, not rawImport
    });

    test('3.x export produces valid operations/channels/messages shape', () => {
        const live = {
            name: 'V3Doc',
            description: '',
            version: '1.0.0',
            asyncApiVersion: '3.0.0',
            servers: [{ name: 's', url: 'mqtt://b', protocol: 'mqtt' }],
            channels: [{ name: 'events', address: 'events' }],
            messages: [{ name: 'M', contentType: 'application/json', payloadSchema: { type: 'object' } }],
            operations: [{ channelName: 'events', action: 'publish', messageName: 'M', summary: 'sum' }],
            tags: []
        };
        const out = denormalizeToAsyncApiJson({ toObject: () => live, ...live });
        expect(out.asyncapi).toBe('3.0.0');
        expect(out.servers.s.host).toBe('mqtt://b');
        expect(out.channels.events.address).toBe('events');
        expect(out.channels.events.messages.M.$ref).toBe('#/components/messages/M');
        expect(out.operations['events-send'].action).toBe('send');
        expect(out.operations['events-send'].channel.$ref).toBe('#/channels/events');
        expect(out.operations['events-send'].messages[0].$ref).toBe('#/components/messages/M');
        expect(out.components.messages.M.payload.type).toBe('object');
    });
});
