// tests/metrics.test.js
// Tier 4: Prometheus /metrics endpoint exposes counters that increment with activity.
const request = require('supertest');
const express = require('express');
const { metricsHandler, incProxyCall, incReviewSubmission } = require('../middleware/metrics');

describe('Prometheus /metrics', () => {
    test('metricsHandler exposes prometheus exposition format with our counters', async () => {
        incProxyCall();
        incProxyCall();
        incReviewSubmission();
        const app = express();
        app.get('/metrics', metricsHandler);
        const res = await request(app).get('/metrics');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/text\/plain/);
        expect(res.text).toContain('marketplace_proxy_calls_total');
        expect(res.text).toContain('marketplace_review_submissions_total');
    });
});