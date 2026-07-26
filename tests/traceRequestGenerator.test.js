// tests/traceRequestGenerator.test.js
const {
    buildRequestFromSpan,
    buildAssertionsFromSpan,
    buildTestScript,
    splitUrl
} = require('../services/TraceRequestGenerator');
const { REDACTED } = require('../services/OtlpTraceNormalizer');

const trace = { traceId: 'trace-abc' };

const span = (overrides = {}) => ({
    spanId: 'span-1',
    parentSpanId: null,
    name: 'GET /api/orders',
    kind: 'client',
    serviceName: 'orders-api',
    httpMethod: 'GET',
    url: 'https://api.example.com/api/orders?limit=10&api_key=' + encodeURIComponent(REDACTED),
    route: '/api/orders',
    httpStatusCode: 200,
    durationMs: 120,
    startTime: new Date('2026-01-01T00:00:00Z'),
    status: 'ok',
    requestHeaders: [
        { key: 'Content-Type', value: 'application/json', sensitive: false },
        { key: 'Authorization', value: REDACTED, sensitive: true }
    ],
    responseHeaders: [],
    requestBody: '',
    responseBody: JSON.stringify({ id: 7, name: 'Ada', total: 12.5, nested: { ok: true } }),
    environment: 'staging',
    deploymentVersion: '1.4.0',
    ...overrides
});

describe('trace-to-request generation', () => {
    it('templates the origin behind {{baseUrl}} and extracts query params', () => {
        const { url, params } = splitUrl('https://api.example.com/api/orders?limit=10');
        expect(url).toBe('{{baseUrl}}/api/orders');
        expect(params).toEqual([{ key: 'limit', name: 'limit', value: '10', enabled: true }]);
    });

    it('builds a saveable request from an HTTP span', () => {
        const request = buildRequestFromSpan(span(), trace);

        expect(request.method).toBe('GET');
        expect(request.url).toBe('{{baseUrl}}/api/orders');
        expect(request.metadata).toMatchObject({
            source: 'otel-trace',
            traceId: 'trace-abc',
            spanId: 'span-1',
            serviceName: 'orders-api',
            observedStatusCode: 200,
            environment: 'staging',
            deploymentVersion: '1.4.0'
        });
    });

    it('never copies sensitive header values — it substitutes placeholders', () => {
        const request = buildRequestFromSpan(span({
            requestHeaders: [
                { key: 'Authorization', value: 'Bearer super-secret', sensitive: false },
                { key: 'Cookie', value: 'session=abc123', sensitive: false },
                { key: 'X-API-Key', value: 'live_key_999', sensitive: false },
                { key: 'Accept', value: 'application/json', sensitive: false }
            ]
        }), trace);

        const byKey = Object.fromEntries(request.headers.map((h) => [h.key, h.value]));
        expect(byKey.Authorization).toBe('{{authorization}}');
        expect(byKey.Cookie).toBe('{{cookie}}');
        expect(byKey['X-API-Key']).toBe('{{x_api_key}}');
        expect(byKey.Accept).toBe('application/json');

        const serialized = JSON.stringify(request);
        ['super-secret', 'abc123', 'live_key_999'].forEach((s) => expect(serialized).not.toContain(s));
    });

    it('placeholders sensitive query params too, and never copies auth', () => {
        const request = buildRequestFromSpan(span({
            url: 'https://api.example.com/api/orders?token=leaked&limit=10'
        }), trace);

        const token = request.params.find((p) => p.key === 'token');
        expect(token.value).toBe('{{token}}');
        expect(request.authConfig).toEqual({ type: 'inherit' });
        expect(JSON.stringify(request)).not.toContain('leaked');
    });

    it('rejects a span that is not an HTTP call', () => {
        expect(() => buildRequestFromSpan(span({ httpMethod: null, url: '', route: null }), trace))
            .toThrow(/HTTP/);
    });
});

describe('trace-to-test assertion generation', () => {
    it('asserts the observed status, a padded response time and JSON fields', () => {
        const assertions = buildAssertionsFromSpan(span());

        const status = assertions.find((a) => a.kind === 'status');
        expect(status.expected).toBe(200);
        expect(status.warning).toBe('');

        const time = assertions.find((a) => a.kind === 'response-time');
        // 120 ms observed * 2x headroom, rounded up to 10 ms.
        expect(time.expected).toBe(240);

        const fields = assertions.filter((a) => a.kind === 'field').map((a) => a.expected);
        expect(fields).toEqual(expect.arrayContaining(['id', 'name', 'total']));
    });

    it('honours the opt-out options', () => {
        const assertions = buildAssertionsFromSpan(span(), { includeResponseTime: false, includeFields: false });
        expect(assertions.map((a) => a.kind)).toEqual(['status']);
    });

    it('warns on a failed span and derives no field expectations from it', () => {
        const assertions = buildAssertionsFromSpan(span({ httpStatusCode: 500, status: 'error' }));

        expect(assertions.find((a) => a.kind === 'status').warning).toMatch(/failed/i);
        expect(assertions.some((a) => a.kind === 'field')).toBe(false);
    });

    it('renders a script against the Pigeon assert/response sandbox', () => {
        const script = buildTestScript(buildAssertionsFromSpan(span()), { traceId: 'trace-abc', spanId: 'span-1' });

        expect(script).toContain('trace-abc');
        expect(script).toContain('assert.equal(response.status, 200');
        expect(script).toContain('assert.lessThan(response.duration, 240');
        expect(script).toContain("assert.isDefined(body['id']");
        expect(script).not.toContain('pm.');
    });

    it('emits a body parse preamble only when field assertions exist', () => {
        const withFields = buildTestScript(buildAssertionsFromSpan(span()));
        const withoutFields = buildTestScript(buildAssertionsFromSpan(span(), { includeFields: false }));

        expect(withFields).toContain('const body =');
        expect(withoutFields).not.toContain('const body =');
    });
});
