// tests/otlpTraceNormalizer.test.js
const {
    normalizeOtlpPayload,
    redactBody,
    redactUrl,
    redactAttributes,
    isSensitiveKey,
    LIMITS,
    REDACTED
} = require('../services/OtlpTraceNormalizer');

const NANOS = 1_700_000_000_000_000_000n;

const span = (overrides = {}) => ({
    traceId: 'trace-1',
    spanId: 'span-1',
    name: 'GET /api/orders',
    kind: 3,
    startTimeUnixNano: String(NANOS),
    endTimeUnixNano: String(NANOS + 120_000_000n), // +120 ms
    status: { code: 1 },
    attributes: [
        { key: 'http.request.method', value: { stringValue: 'GET' } },
        { key: 'url.full', value: { stringValue: 'https://api.example.com/api/orders?limit=10' } },
        { key: 'http.route', value: { stringValue: '/api/orders' } },
        { key: 'http.response.status_code', value: { intValue: '200' } }
    ],
    ...overrides
});

const payload = (spans, resourceAttrs = []) => ({
    resourceSpans: [{
        resource: {
            attributes: [
                { key: 'service.name', value: { stringValue: 'orders-api' } },
                { key: 'deployment.environment.name', value: { stringValue: 'staging' } },
                ...resourceAttrs
            ]
        },
        scopeSpans: [{ scope: { name: 'instr' }, spans }]
    }]
});

describe('OTLP span normalization', () => {
    it('normalizes a plain HTTP span', () => {
        const [trace] = normalizeOtlpPayload(payload([span()]));

        expect(trace.traceId).toBe('trace-1');
        expect(trace.rootServiceName).toBe('orders-api');
        expect(trace.environment).toBe('staging');
        expect(trace.httpMethod).toBe('GET');
        expect(trace.route).toBe('/api/orders');
        expect(trace.httpStatusCode).toBe(200);
        expect(trace.hasError).toBe(false);
        expect(trace.spanCount).toBe(1);

        const [s] = trace.spans;
        expect(s.kind).toBe('client');
        expect(s.durationMs).toBeCloseTo(120, 0);
        expect(s.startTime.toISOString()).toBe(new Date(1_700_000_000_000).toISOString());
    });

    it('reads legacy semantic-convention attribute names', () => {
        const [trace] = normalizeOtlpPayload(payload([span({
            attributes: [
                { key: 'http.method', value: { stringValue: 'POST' } },
                { key: 'http.url', value: { stringValue: 'https://api.example.com/legacy' } },
                { key: 'http.status_code', value: { intValue: '201' } }
            ]
        })]));

        expect(trace.spans[0].httpMethod).toBe('POST');
        expect(trace.spans[0].httpStatusCode).toBe(201);
    });

    it('flags error spans and rolls the failure up to the trace', () => {
        const [trace] = normalizeOtlpPayload(payload([span({
            status: { code: 2, message: 'upstream timeout' }
        })]));

        expect(trace.hasError).toBe(true);
        expect(trace.errorCount).toBe(1);
        expect(trace.errorMessage).toBe('upstream timeout');
        expect(trace.spans[0].status).toBe('error');
    });

    it('groups spans by trace id and keeps parent links', () => {
        const traces = normalizeOtlpPayload(payload([
            span(),
            span({ spanId: 'span-2', parentSpanId: 'span-1', name: 'db query' }),
            span({ traceId: 'trace-2', spanId: 'span-3' })
        ]));

        expect(traces).toHaveLength(2);
        const first = traces.find((t) => t.traceId === 'trace-1');
        expect(first.spanCount).toBe(2);
        expect(first.spans[1].parentSpanId).toBe('span-1');
    });

    it('caps spans per trace and reports what was dropped', () => {
        const many = Array.from({ length: LIMITS.maxSpansPerTrace + 5 }, (_, i) =>
            span({ spanId: `span-${i}` }));
        const [trace] = normalizeOtlpPayload(payload(many));

        expect(trace.spans).toHaveLength(LIMITS.maxSpansPerTrace);
        expect(trace.truncatedSpans).toBe(5);
    });

    it('rejects a payload that is not OTLP', () => {
        expect(() => normalizeOtlpPayload({ nope: true })).toThrow();
    });
});

describe('sensitive-data redaction', () => {
    it('recognises secret-bearing key names', () => {
        ['Authorization', 'Cookie', 'x-api-key', 'refresh_token', 'password', 'clientSecret']
            .forEach((key) => expect(isSensitiveKey(key)).toBe(true));
        ['content-type', 'accept', 'user-agent'].forEach((key) => expect(isSensitiveKey(key)).toBe(false));
    });

    it('redacts sensitive headers before they are persisted', () => {
        const [trace] = normalizeOtlpPayload(payload([span({
            attributes: [
                ...span().attributes,
                { key: 'http.request.header.authorization', value: { stringValue: 'Bearer super-secret' } },
                { key: 'http.request.header.content-type', value: { stringValue: 'application/json' } }
            ]
        })]));

        const headers = trace.spans[0].requestHeaders;
        const auth = headers.find((h) => h.key.toLowerCase() === 'authorization');
        const ct = headers.find((h) => h.key.toLowerCase() === 'content-type');

        expect(auth.value).toBe(REDACTED);
        expect(auth.sensitive).toBe(true);
        expect(ct.value).toBe('application/json');
        expect(JSON.stringify(trace)).not.toContain('super-secret');
    });

    it('redacts secret query params and URL userinfo', () => {
        expect(redactUrl('https://api.example.com/x?api_key=abc123&limit=5'))
            .toBe(`https://api.example.com/x?api_key=${encodeURIComponent(REDACTED)}&limit=5`);
        expect(redactUrl('https://user:hunter2@api.example.com/x')).not.toContain('hunter2');
    });

    it('redacts secret JSON body fields while keeping the shape', () => {
        const body = redactBody(JSON.stringify({ user: { id: 7, password: 'hunter2' }, token: 'abc' }));
        const parsed = JSON.parse(body);

        expect(parsed.user.id).toBe(7);
        expect(parsed.user.password).toBe(REDACTED);
        expect(parsed.token).toBe(REDACTED);
    });

    it('truncates oversized bodies and attribute values', () => {
        const huge = 'x'.repeat(LIMITS.maxBodyChars + 500);
        // Truncation appends a short "… [truncated N chars]" marker.
        expect(redactBody(huge).length).toBeLessThanOrEqual(LIMITS.maxBodyChars + 40);

        const attrs = redactAttributes([
            { key: 'big', value: { stringValue: 'y'.repeat(LIMITS.maxAttrValueChars + 100) } }
        ]);
        expect(String(attrs.big).length).toBeLessThanOrEqual(LIMITS.maxAttrValueChars + 40);
    });

    it('caps the number of retained attributes', () => {
        const attrs = redactAttributes(
            Array.from({ length: LIMITS.maxAttributes + 10 }, (_, i) => ({
                key: `k${i}`,
                value: { stringValue: 'v' }
            }))
        );
        expect(Object.keys(attrs).length).toBeLessThanOrEqual(LIMITS.maxAttributes);
    });
});
