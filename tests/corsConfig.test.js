const { createOriginChecker } = require('../config/cors');

describe('CORS origin checker', () => {
    test('allows configured origins and local development aliases', () => {
        const allowed = createOriginChecker({
            configuredOrigins: ['http://localhost:3000'],
            nodeEnv: 'development',
            frontendUrl: 'http://localhost:3000',
            apiPort: 5001
        });

        expect(allowed('http://localhost:3000')).toBe(true);
        expect(allowed('http://127.0.0.1:3000')).toBe(true);
        expect(allowed('http://192.168.1.25:3000')).toBe(true);
        expect(allowed('http://localhost:5001')).toBe(true);
        expect(allowed(undefined)).toBe(true);
    });

    test('keeps production restricted to explicitly configured origins', () => {
        const allowed = createOriginChecker({
            configuredOrigins: ['https://pigeon.example.com'],
            nodeEnv: 'production',
            frontendUrl: 'https://pigeon.example.com',
            apiPort: 5001
        });

        expect(allowed('https://pigeon.example.com')).toBe(true);
        expect(allowed('http://localhost:3000')).toBe(false);
        expect(allowed('https://evil.example.com')).toBe(false);
    });

    test('rejects unrelated hosts and unexpected local ports in development', () => {
        const allowed = createOriginChecker({
            configuredOrigins: ['http://localhost:3000'],
            nodeEnv: 'development',
            frontendUrl: 'http://localhost:3000',
            apiPort: 5001
        });

        expect(allowed('https://evil.example.com')).toBe(false);
        expect(allowed('http://127.0.0.1:8080')).toBe(false);
    });
});
