// tests/rateLimiter.test.js
// Tier 1: rate limiting on the marketplace /proxy (Try It) endpoint.
// RED: a request past the configured window threshold returns 429.

const request = require('supertest');
const express = require('express');
const { proxyLimiter } = require('../middleware/rateLimiter');

function buildApp() {
    const app = express();
    app.use(express.json());
    app.post('/api/marketplace/proxy', proxyLimiter, (req, res) => res.json({ ok: true }));
    return app;
}

describe('rate limiting on /proxy', () => {
    test('returns 200 under the window limit, then 429 once breached', async () => {
        const app = buildApp();
        // express-rate-limit default window is 1 minute with max: N.
        // proxyLimiter uses a low test-friendly max (see middleware); exhaust it.
        const max = require('../middleware/rateLimiter').__maxForTest;
        for (let i = 0; i < max; i++) {
            const r = await request(app).post('/api/marketplace/proxy').send({});
            expect(r.status).toBe(200);
        }
        const over = await request(app).post('/api/marketplace/proxy').send({});
        expect(over.status).toBe(429);
        expect(over.headers['retry-after']).toBeTruthy();
    });
});