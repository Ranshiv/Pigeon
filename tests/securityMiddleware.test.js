// tests/securityMiddleware.test.js
// Tier 1: helmet security headers + compression + global error handler.
// RED: app exports middleware wiring; verify observable behavior via a mounted probe.

// Production auth/error semantics: the error handler must not leak messages in prod.
process.env.NODE_ENV = 'production';

const request = require('supertest');
const express = require('express');

// The wiring lives in middleware/securityMiddleware.js: a function that mounts
// helmet/compression/morgan/global-error-handler onto a given app.
const { mountSecurityMiddleware, globalErrorHandler } = require('../middleware/securityMiddleware');

function buildApp() {
    const app = express();
    mountSecurityMiddleware(app, { skipMorgan: true }); // silence morgan in test
    app.get('/boom', () => { throw new Error('kaboom'); });
    app.get('/ok', (req, res) => res.json({ ok: true }));
    app.use(globalErrorHandler); // must be registered AFTER routes
    return app;
}

describe('security middleware', () => {
    test('helmet sets security headers (Content-Security-Policy / X-Content-Type-Options)', async () => {
        const app = buildApp();
        const res = await request(app).get('/ok');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['content-security-policy']).toBeTruthy();
    });

    test('global error handler returns 500 JSON without leaking the stack trace', async () => {
        const app = buildApp();
        const res = await request(app).get('/boom');
        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
        // The thrown message must NOT be echoed back in production.
        expect(JSON.stringify(res.body)).not.toContain('kaboom');
    });
});