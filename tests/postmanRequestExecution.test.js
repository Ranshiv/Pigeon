const express = require('express');
const http = require('http');
const request = require('supertest');

jest.mock('../models/Request', () => ({
    findById: jest.fn().mockResolvedValue(null)
}));

jest.mock('../models/History', () => jest.fn().mockImplementation(() => ({
    save: jest.fn().mockResolvedValue(undefined)
})));

jest.mock('../models/ActivityLog', () => ({
    create: jest.fn().mockResolvedValue({ _id: 'activity-id' }),
    findById: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue({ _id: 'activity-id' })
    })
}));

jest.mock('../utils/socket/socket-server', () => ({
    broadcastActivity: jest.fn()
}));

const requestsRouter = require('../routes/requests');

describe('imported request execution fallback', () => {
    let app;
    let targetServer;
    let targetUrl;
    let received;

    beforeAll(async () => {
        targetServer = http.createServer((req, res) => {
            const chunks = [];
            req.on('data', (chunk) => chunks.push(chunk));
            req.on('end', () => {
                received.push({
                    method: req.method,
                    headers: req.headers,
                    body: Buffer.concat(chunks).toString('utf8')
                });
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
            });
        });
        await new Promise((resolve) => targetServer.listen(0, '127.0.0.1', resolve));
        const { port } = targetServer.address();
        targetUrl = `http://127.0.0.1:${port}/capture`;

        app = express();
        app.use(express.json());
        app.use('/api/requests', requestsRouter);
    });

    afterAll(async () => {
        await new Promise((resolve) => targetServer.close(resolve));
    });

    beforeEach(() => {
        received = [];
    });

    test('sends an imported request body, headers, and bearer authentication from collection data', async () => {
        const response = await request(app)
            .post('/api/requests/507f1f77bcf86cd799439011/send')
            .send({
                method: 'POST',
                url: targetUrl,
                headers: [{ name: 'X-Imported', value: 'true' }],
                body: '{"source":"postman"}',
                bodyType: 'json',
                authConfig: { type: 'Bearer Token', bearer: { token: 'test-token' } }
            });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ status: 200, body: { ok: true }, isJson: true });
        expect(received).toHaveLength(1);
        expect(received[0]).toMatchObject({
            method: 'POST',
            body: '{"source":"postman"}'
        });
        expect(received[0].headers).toMatchObject({
            'x-imported': 'true',
            authorization: 'Bearer test-token',
            'content-type': 'application/json'
        });
    });

    test('uses imported URL-encoded and multipart fields, excluding disabled and file placeholders', async () => {
        const encoded = await request(app)
            .post('/api/requests/507f1f77bcf86cd799439011/send')
            .send({
                method: 'POST',
                url: targetUrl,
                body: '{"fallback":"ignored"}',
                bodyType: 'x-www-form-urlencoded',
                bodyFormData: [
                    { key: 'email', value: 'ada@example.com', enabled: true },
                    { key: 'disabled', value: 'hidden', enabled: false }
                ]
            });
        expect(encoded.status).toBe(200);
        expect(received[0].body).toBe('email=ada%40example.com');
        expect(received[0].headers['content-type']).toContain('application/x-www-form-urlencoded');

        const multipart = await request(app)
            .post('/api/requests/507f1f77bcf86cd799439011/send')
            .send({
                method: 'POST',
                url: targetUrl,
                body: '{"fallback":"ignored"}',
                bodyType: 'form-data',
                bodyFormData: [
                    { key: 'label', value: 'avatar', enabled: true, type: 'text' },
                    { key: 'file', value: '', enabled: true, type: 'file', src: '/tmp/avatar.png' }
                ]
            });
        expect(multipart.status).toBe(200);
        expect(received[1].headers['content-type']).toContain('multipart/form-data; boundary=');
        expect(received[1].body).toContain('name="label"');
        expect(received[1].body).toContain('avatar');
        expect(received[1].body).not.toContain('name="file"');
    });
});
