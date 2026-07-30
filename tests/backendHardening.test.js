const express = require('express');
const request = require('supertest');
const { requestContext } = require('../middleware/requestContext');
const { metricsAuth } = require('../middleware/metricsAuth');
const { parseRuntimeConfig, validateProductionConfig } = require('../config/runtime');

describe('backend hardening primitives', () => {
    afterEach(() => {
        delete process.env.METRICS_TOKEN;
        delete process.env.NODE_ENV;
    });

    test('request context preserves safe incoming IDs and replaces unsafe IDs', async () => {
        const app = express();
        app.use(requestContext);
        app.get('/context', (req, res) => res.json({ requestId: req.requestId }));

        const accepted = await request(app).get('/context').set('X-Request-Id', 'trace-2026-01');
        expect(accepted.status).toBe(200);
        expect(accepted.body.requestId).toBe('trace-2026-01');
        expect(accepted.headers['x-request-id']).toBe('trace-2026-01');

        const unsafeId = 'a'.repeat(129);
        const replaced = await request(app).get('/context').set('X-Request-Id', unsafeId);
        expect(replaced.status).toBe(200);
        expect(replaced.body.requestId).not.toBe(unsafeId);
        expect(replaced.body.requestId).toMatch(/^[0-9a-f-]{36}$/);
    });

    test('metrics authentication uses bearer tokens and fails closed in production', async () => {
        process.env.NODE_ENV = 'production';
        process.env.METRICS_TOKEN = 'a'.repeat(32);
        const app = express();
        app.get('/metrics', metricsAuth, (_req, res) => res.send('ok'));

        expect((await request(app).get('/metrics')).status).toBe(401);
        expect((await request(app).get('/metrics').set('Authorization', `Bearer ${'a'.repeat(32)}`)).status).toBe(200);

        delete process.env.METRICS_TOKEN;
        expect((await request(app).get('/metrics')).status).toBe(503);
    });

    test('production runtime validation requires secure operational settings', () => {
        const config = parseRuntimeConfig({
            NODE_ENV: 'production',
            PORT: '5001',
            FRONTEND_URL: 'https://app.example.com',
            COOKIE_SECURE: 'true',
            SESSION_SECRET: 's'.repeat(32),
            JWT_SECRET: 'j'.repeat(32),
            METRICS_TOKEN: 'm'.repeat(24)
        });
        expect(validateProductionConfig(config)).toBe(config);
        expect(() => validateProductionConfig({ ...config, COOKIE_SECURE: 'false' })).toThrow(/COOKIE_SECURE/);
    });

    test('global errors use problem details for malformed JSON and oversized payloads', async () => {
        const { globalErrorHandler } = require('../middleware/securityMiddleware');
        const app = express();
        app.use(require('../middleware/requestContext').requestContext);
        app.use(express.json({ limit: '32b' }));
        app.post('/payload', (_req, res) => res.json({ ok: true }));
        app.use(globalErrorHandler);

        const malformed = await request(app).post('/payload').set('Content-Type', 'application/json').send('{bad');
        expect(malformed.status).toBe(400);
        expect(malformed.headers['content-type']).toMatch(/application\/problem\+json/);
        expect(malformed.body.title).toBe('Malformed JSON');
        expect(malformed.body.requestId).toBeTruthy();

        const oversized = await request(app).post('/payload').send({ value: 'x'.repeat(200) });
        expect(oversized.status).toBe(413);
        expect(oversized.body.title).toBe('Payload Too Large');
    });

    test('telemetry parses OTLP headers without exposing values in status', () => {
        const { parseHeaders, getTelemetryStatus } = require('../config/telemetry');
        expect(parseHeaders('Authorization=Bearer%20test, x-tenant=local')).toEqual({
            Authorization: 'Bearer%20test',
            'x-tenant': 'local'
        });
        expect(parseHeaders('')).toBeUndefined();
        expect(getTelemetryStatus()).toEqual(expect.objectContaining({
            enabled: false,
            traces: false,
            endpointConfigured: false
        }));
    });
});
