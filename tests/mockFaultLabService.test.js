const MockServerService = require('../services/MockServerService');

describe('Fault Lab legacy migration', () => {
    test('converts a legacy random failure and delay into ordered Fault Lab profiles', () => {
        const server = {
            globalConfig: {
                chaos: {
                    enabled: true,
                    globalEnabled: false,
                    randomFailureRate: 35,
                    randomDelayRange: { min: 40, max: 80 },
                    profiles: []
                }
            }
        };

        expect(MockServerService.migrateLegacyChaos(server)).toBe(true);
        const chaos = server.globalConfig.chaos;
        expect(chaos.globalEnabled).toBe(true);
        expect(chaos.enabled).toBe(false);
        expect(chaos.randomFailureRate).toBe(0);
        expect(chaos.profiles).toHaveLength(2);

        const failure = chaos.profiles.find((profile) => profile.fault.type === 'status');
        const delay = chaos.profiles.find((profile) => profile.fault.type === 'latency');
        expect(failure.probability).toBe(35);
        expect(failure.fault.delayMinMs).toBe(40);
        expect(failure.fault.delayMaxMs).toBe(80);
        expect(delay.probability).toBe(100);
        expect(failure.priority).toBeGreaterThan(delay.priority);
        expect(MockServerService.migrateLegacyChaos(server)).toBe(false);
    });

    test('does not create profiles for a disabled legacy configuration', () => {
        const server = { globalConfig: { chaos: { enabled: false, profiles: [] } } };
        expect(MockServerService.migrateLegacyChaos(server)).toBe(false);
        expect(server.globalConfig.chaos.profiles).toHaveLength(0);
    });
});

describe('Fault Lab fault effects', () => {
    const baseResponse = { status: 200, headers: {}, body: { ok: true, id: 'abc' } };

    test.each([
        ['latency', {}, null],
        ['status', { statusCode: 503 }, null],
        ['abort', { abortPhase: 'after_headers' }, 'abort'],
        ['throttle', { bytesPerSecond: 64, chunkSize: 16 }, 'throttle'],
        ['malformed_json', {}, 'raw'],
        ['truncate', { truncateMode: 'percent', truncateValue: 50 }, 'raw']
    ])('builds a %s effect', (type, settings, transportType) => {
        const effect = MockServerService.buildFaultEffect({
            fault: { type, delayMinMs: 0, delayMaxMs: 0, ...settings }
        }, baseResponse);
        expect(effect.response.headers['X-Pigeon-Fault']).toBe(type);
        expect(effect.transport?.type || null).toBe(transportType);
    });
});
