process.env.NODE_ENV = 'test';
delete process.env.SENTRY_DSN;

const { enabled, scrubEvent } = require('../config/sentry');

describe('Sentry configuration', () => {
    test('does not enable reporting outside production', () => {
        expect(enabled).toBe(false);
    });

    test('scrubs credentials and request payloads without removing safe context', () => {
        const event = scrubEvent({
            request: {
                headers: {
                    authorization: 'Bearer secret',
                    cookie: 'connect.sid=secret',
                    'x-request-id': 'request-123'
                },
                query: { apiKey: 'secret', page: '2' },
                data: { password: 'secret' }
            },
            extra: { workspaceId: 'workspace-123', accessToken: 'secret' }
        });

        expect(event.request.headers.authorization).toBe('[Filtered]');
        expect(event.request.headers.cookie).toBe('[Filtered]');
        expect(event.request.headers['x-request-id']).toBe('request-123');
        expect(event.request.query.apiKey).toBe('[Filtered]');
        expect(event.request.query.page).toBe('2');
        expect(event.request.data).toBe('[Filtered]');
        expect(event.extra.workspaceId).toBe('workspace-123');
        expect(event.extra.accessToken).toBe('[Filtered]');
    });
});
