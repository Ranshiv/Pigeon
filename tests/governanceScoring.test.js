// tests/governanceScoring.test.js
const { scoreCollection } = require('../services/GovernanceScoringService');

const baseCollection = {
    _id: 'c1',
    name: 'Payments API',
    description: 'Payment endpoints',
    version: '1.2.0',
    variables: [{ key: 'API_TOKEN', value: 'x', isSecret: true }],
    documentation: { content: '# Payments' },
    updatedAt: new Date('2026-01-01'),
    requests: [
        {
            name: 'List payments',
            method: 'GET',
            url: '{{baseUrl}}/payments',
            description: 'Lists payments',
            authConfig: { type: 'bearer', token: '{{API_TOKEN}}' },
            testScript: 'pm.test("ok", () => {});'
        },
        {
            name: 'Create payment',
            method: 'POST',
            url: '{{baseUrl}}/payments',
            description: 'Creates a payment',
            authConfig: { type: 'bearer', token: '{{API_TOKEN}}' },
            testScript: 'pm.test("ok", () => {});'
        }
    ]
};

const richContext = {
    monitors: [{ url: 'https://api.example.com/health', tags: ['Payments API'], isActive: true, currentStatus: 'up' }],
    environments: [{ name: 'Staging' }, { name: 'Production' }],
    versions: [{ version: 'v1' }, { version: 'v2' }],
    auditEventCount: 12,
    workspaceName: 'Core',
    ownerName: 'Ada'
};

describe('GovernanceScoringService', () => {
    test('a well-governed collection scores high', () => {
        const result = scoreCollection(baseCollection, richContext);

        expect(result.metrics.requestCount).toBe(2);
        expect(result.metrics.documentedPercent).toBe(100);
        expect(result.metrics.authCoveragePercent).toBe(100);
        expect(result.metrics.unauthenticatedWriteCount).toBe(0);
        expect(result.metrics.variableUsagePercent).toBe(100);
        expect(result.score).toBeGreaterThanOrEqual(80);
        expect(result.grade).toBe('good');
        expect(result.recommendations).toHaveLength(0);
    });

    test('missing docs, auth, monitoring and envs produce actionable recommendations', () => {
        const bare = {
            _id: 'c2',
            name: 'Legacy API',
            requests: [
                { name: 'Get user', method: 'GET', url: 'https://api.example.com/users' },
                { name: 'Delete user', method: 'DELETE', url: 'https://api.example.com/users/1' }
            ],
            variables: [{ key: 'API_SECRET', value: 'plain' }]
        };

        const result = scoreCollection(bare, {});
        const messages = result.recommendations.map((r) => r.message);

        expect(result.score).toBeLessThan(50);
        expect(result.grade).toBe('poor');
        expect(result.metrics.monitoringStatus).toBe('none');
        expect(messages).toContain('Add documentation for 2 endpoints');
        expect(messages).toContain('Configure authentication for 1 write request');
        expect(messages).toContain('Add a test environment');
        expect(messages).toContain('Enable monitoring');
        expect(messages).toContain('Mark 1 credential-like variable as secret');
    });

    test('an imported collection with no requests degrades gracefully', () => {
        const result = scoreCollection({ _id: 'c3', name: 'Imported' }, {});

        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
        expect(result.metrics.requestCount).toBe(0);
        expect(result.metrics.documentedPercent).toBe(0);
        expect(result.workspaceName).toBe('Unassigned');
        expect(result.ownerName).toBe('Unknown');
    });

    test('monitors are linked by matching host and by collection id tag', () => {
        const byHost = scoreCollection(
            { _id: 'c4', name: 'Host match', requests: [{ name: 'r', method: 'GET', url: 'https://api.example.com/v1/x' }] },
            { monitors: [{ url: 'https://API.example.com/health', isActive: true, currentStatus: 'down' }] }
        );
        expect(byHost.metrics.monitorCount).toBe(1);
        expect(byHost.metrics.monitoringStatus).toBe('down');

        const byTag = scoreCollection(
            { _id: 'c5', name: 'Tag match', requests: [] },
            { monitors: [{ url: 'https://other.test/health', tags: ['c5'], isActive: false }] }
        );
        expect(byTag.metrics.monitorCount).toBe(1);
        expect(byTag.metrics.monitoringStatus).toBe('paused');
    });

    test('all category scores stay within 0-100', () => {
        [baseCollection, { _id: 'x', name: 'x' }].forEach((c) => {
            const { categories } = scoreCollection(c, richContext);
            Object.values(categories).forEach((v) => {
                expect(v).toBeGreaterThanOrEqual(0);
                expect(v).toBeLessThanOrEqual(100);
            });
        });
    });
});
