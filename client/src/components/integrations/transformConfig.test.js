// Regression tests for the UI→API config key mapping.
// The backend reads camelCase keys; the form uses snake_case. Any key that
// fails to map is silently dropped and the integration never works.
import transformConfigForBackend from './transformConfig';

describe('transformConfigForBackend', () => {
    // BUG: the form field was `integration_key` but the backend reads
    // `configuration.routingKey`. Nothing mapped it, so every PagerDuty
    // integration failed validation on save.
    test('maps the PagerDuty integration key to routingKey', () => {
        const out = transformConfigForBackend('pagerduty', { integration_key: 'k'.repeat(32) });

        expect(out.routingKey).toBe('k'.repeat(32));
        expect(out.integration_key).toBeUndefined();
    });

    // BUG: the custom-webhook form used `url`, the backend reads `webhookUrl`.
    test('maps the custom webhook url to webhookUrl', () => {
        const out = transformConfigForBackend('webhook', { url: 'https://example.com/hook' });

        expect(out.webhookUrl).toBe('https://example.com/hook');
        expect(out.url).toBeUndefined();
    });

    // BUG: headers came out of a textarea as a JSON *string* and were sent
    // straight into a schema field expecting structured data.
    test('parses the headers textarea into an object', () => {
        const out = transformConfigForBackend('webhook', {
            url: 'https://example.com/hook',
            headers: '{"Authorization": "Bearer t"}'
        });

        expect(out.headers).toEqual({ Authorization: 'Bearer t' });
    });

    test('throws a readable error on malformed headers JSON', () => {
        expect(() =>
            transformConfigForBackend('webhook', { url: 'https://x.com', headers: '{oops' })
        ).toThrow(/valid JSON/);
    });

    test('drops an empty headers field rather than sending an empty string', () => {
        const out = transformConfigForBackend('webhook', { url: 'https://x.com', headers: '   ' });

        expect(out).not.toHaveProperty('headers');
    });

    test('maps every email field and defaults port and TLS', () => {
        const out = transformConfigForBackend('email', {
            smtp_host: 'smtp.gmail.com',
            smtp_user: 'a@b.com',
            smtp_password: 'pw',
            from_email: 'a@b.com'
        });

        expect(out).toMatchObject({
            smtpHost: 'smtp.gmail.com',
            smtpUser: 'a@b.com',
            smtpPass: 'pw',
            fromEmail: 'a@b.com',
            smtpPort: 587,
            useTls: true
        });
        expect(out.smtp_password).toBeUndefined();
    });

    test('maps webhook_url for every channel that uses one', () => {
        for (const type of ['slack', 'teams', 'discord', 'googlechat']) {
            const out = transformConfigForBackend(type, { webhook_url: 'https://example.com/h' });
            expect(out.webhookUrl).toBe('https://example.com/h');
            expect(out.webhook_url).toBeUndefined();
        }
    });

    test('maps telegram credentials', () => {
        const out = transformConfigForBackend('telegram', { bot_token: '123:ABC', chat_id: '-100' });

        expect(out).toMatchObject({ botToken: '123:ABC', chatId: '-100' });
    });

    // Round-trip guard: an edited integration must not lose its secret.
    test('leaves an already-camelCase Jira config untouched', () => {
        const out = transformConfigForBackend('jira', {
            serverUrl: 'https://x.atlassian.net', username: 'a@b.com', apiToken: 't', projectKey: 'OPS'
        });

        expect(out).toMatchObject({ serverUrl: 'https://x.atlassian.net', apiToken: 't', projectKey: 'OPS' });
    });
});
