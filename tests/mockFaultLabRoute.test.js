const express = require('express');
const request = require('supertest');

jest.mock('../services/MockServerService', () => ({
    handleMockRequest: jest.fn()
}));
jest.mock('../middleware/auth', () => ({ authenticateJWT: (req, res, next) => next() }));

const MockServerService = require('../services/MockServerService');
const mockRoutes = require('../routes/mockServers');

const app = express();
app.use(express.json());
app.use('/api/mock-servers', mockRoutes);

const rawParser = (response, done) => {
    let body = '';
    response.setEncoding('utf8');
    response.on('data', (chunk) => { body += chunk; });
    response.on('end', () => done(null, body));
};

describe('public mock Fault Lab transports', () => {
    beforeEach(() => jest.clearAllMocks());

    test('returns a malformed raw response without JSON serialization', async () => {
        MockServerService.handleMockRequest.mockResolvedValue({
            status: 200,
            headers: { 'X-Pigeon-Fault': 'malformed_json' },
            body: { ignored: true },
            transport: { type: 'raw', rawBody: '{"ok":true' }
        });
        const response = await request(app)
            .get('/api/mock-servers/server-1/simulate/orders')
            .buffer(true)
            .parse(rawParser);
        expect(response.status).toBe(200);
        expect(response.headers['x-pigeon-fault']).toBe('malformed_json');
        expect(response.body).toBe('{"ok":true');
    });

    test('streams a throttled response as the configured raw body', async () => {
        MockServerService.handleMockRequest.mockResolvedValue({
            status: 200,
            headers: { 'Content-Type': 'application/json', 'X-Pigeon-Fault': 'throttle' },
            body: { ignored: true },
            transport: { type: 'throttle', rawBody: '{"slow":true}', bytesPerSecond: 100000, chunkSize: 16 }
        });
        const response = await request(app).get('/api/mock-servers/server-1/simulate/orders');
        expect(response.status).toBe(200);
        expect(response.text).toBe('{"slow":true}');
    });

    test('closes the response for an injected connection abort', async () => {
        MockServerService.handleMockRequest.mockResolvedValue({
            status: 200,
            headers: {},
            body: {},
            transport: { type: 'abort', phase: 'before_headers' }
        });
        await expect(request(app).get('/api/mock-servers/server-1/simulate/orders')).rejects.toBeTruthy();
    });
});
