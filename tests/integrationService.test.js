// Regression tests for IntegrationService alert delivery.
// Each test names the bug it catches and was verified failing pre-fix.
process.env.INTEGRATION_TEST_MODE = 'true';

jest.mock('../models/Integration', () => ({
    findByIdAndUpdate: jest.fn().mockResolvedValue({})
}));

const IntegrationService = require('../services/IntegrationService');

// Mongo hands `checkedAt` back as a string after a round-trip, not a Date.
const alertData = () => ({
    monitor: { _id: 'm1', name: 'Test Monitor', url: 'https://example.com' },
    healthCheck: {
        status: 'failure',
        responseTime: 1234,
        errorMessage: 'boom',
        checkedAt: '2026-07-25T10:00:00.000Z'
    },
    alertType: 'failure'
});

let svc;
let sent;

beforeEach(() => {
    svc = new IntegrationService();
    sent = [];
    svc.sendWebhookPayload = jest.fn(async (url, payload) => { sent.push({ url, payload }); return { ok: true }; });
});

describe('date handling', () => {
    // BUG: sendSlackAlert called healthCheck.checkedAt.getTime() and
    // sendDiscordAlert called .toISOString() — both throw on a string.
    test.each(['slack', 'discord', 'teams'])('%s survives a string checkedAt', async (type) => {
        await svc.sendAlert(
            { _id: 'i1', type, configuration: { webhookUrl: 'https://example.com/hook' } },
            alertData()
        );

        expect(sent).toHaveLength(1);
        expect(JSON.stringify(sent[0].payload)).not.toContain('Invalid Date');
    });

    test('slack timestamp is the real epoch second, not NaN', async () => {
        await svc.sendAlert(
            { _id: 'i1', type: 'slack', configuration: { webhookUrl: 'https://example.com/hook' } },
            alertData()
        );

        expect(sent[0].payload.attachments[0].ts).toBe(Date.parse('2026-07-25T10:00:00.000Z') / 1000);
    });
});

describe('custom webhook', () => {
    // BUG: config.headers.forEach threw when headers arrived as a plain object
    // (the shape the UI's JSON textarea produces).
    test('accepts headers as a plain object', async () => {
        await svc.sendAlert(
            {
                _id: 'i1', type: 'webhook',
                configuration: { webhookUrl: 'https://example.com/hook', headers: { Authorization: 'Bearer t' } }
            },
            alertData()
        );

        expect(svc.sendWebhookPayload).toHaveBeenCalledWith(
            'https://example.com/hook',
            expect.anything(),
            expect.objectContaining({ Authorization: 'Bearer t' })
        );
    });

    test('still accepts headers as a key/value array', async () => {
        await svc.sendAlert(
            {
                _id: 'i1', type: 'webhook',
                configuration: { webhookUrl: 'https://example.com/hook', headers: [{ key: 'X-Token', value: 'abc' }] }
            },
            alertData()
        );

        expect(svc.sendWebhookPayload.mock.calls[0][2]).toMatchObject({ 'X-Token': 'abc' });
    });
});

describe('test mode', () => {
    // BUG: sendPagerDutyAlert used fetch() directly, so it fired a real HTTP
    // request even under INTEGRATION_TEST_MODE, and had no timeout.
    test('pagerduty routes through the shared transport', async () => {
        await svc.sendAlert(
            { _id: 'i1', type: 'pagerduty', configuration: { routingKey: 'k'.repeat(32) } },
            alertData()
        );

        expect(sent).toHaveLength(1);
        expect(sent[0].url).toBe('https://events.pagerduty.com/v2/enqueue');
        expect(sent[0].payload.routing_key).toBe('k'.repeat(32));
    });
});

describe('secret redaction', () => {
    // BUG risk: Telegram carries its bot token in the URL path, which lands in
    // error messages and logs verbatim unless redacted.
    test('bot token never appears in a redacted url', () => {
        const redacted = svc.redactUrl('https://api.telegram.org/bot123456:AAEsecret/sendMessage');

        expect(redacted).not.toContain('123456:AAEsecret');
        expect(redacted).toContain('api.telegram.org');
    });
});

describe('new channels', () => {
    test('telegram posts to the sendMessage endpoint with the chat id', async () => {
        await svc.sendAlert(
            { _id: 'i1', type: 'telegram', configuration: { botToken: '123:ABC', chatId: '-100999' } },
            alertData()
        );

        expect(sent[0].url).toBe('https://api.telegram.org/bot123:ABC/sendMessage');
        expect(sent[0].payload.chat_id).toBe('-100999');
        expect(sent[0].payload.text).toContain('Test Monitor');
    });

    test('google chat sends a cardsV2 payload', async () => {
        await svc.sendAlert(
            { _id: 'i1', type: 'googlechat', configuration: { webhookUrl: 'https://chat.googleapis.com/v1/spaces/A/messages' } },
            alertData()
        );

        expect(sent[0].payload.cardsV2[0].card.header.title).toBe('Test Monitor');
    });

    test('an unknown type is rejected rather than silently dropped', async () => {
        await expect(
            svc.sendAlert({ _id: 'i1', type: 'carrier-pigeon', configuration: {} }, alertData())
        ).rejects.toThrow(/Unsupported integration type/);
    });
});
