// services/TraceRequestGenerator.js
// Turn an observed HTTP client span into a saveable Pigeon collection request,
// and an observed successful response into a regression test script.
// Pure functions — no I/O — so both are unit-testable.

const { isSensitiveKey, REDACTED } = require('./OtlpTraceNormalizer');
const { deriveExpectedFields } = require('./ConsumerContractVerifier');

// Placeholders instead of real credentials. The user fills these in from an
// environment; the observed value is never copied.
const PLACEHOLDER_FOR = (headerName) => `{{${headerName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'secret'}}}`;

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

/**
 * Split an absolute URL into a {{baseUrl}}-style template plus query params,
 * so a generated request is portable across environments.
 */
function splitUrl(rawUrl) {
    const url = String(rawUrl || '').trim();
    if (!url) return { url: '', params: [], origin: '' };

    try {
        const parsed = new URL(url);
        const params = [...parsed.searchParams.entries()].map(([key, value]) => ({
            key,
            name: key,
            value: isSensitiveKey(key) ? PLACEHOLDER_FOR(key) : value,
            enabled: true
        }));
        return {
            url: `{{baseUrl}}${parsed.pathname}`,
            params,
            origin: parsed.origin
        };
    } catch {
        // Relative path — keep it as-is behind {{baseUrl}}.
        const [path, query = ''] = url.split('?');
        const params = query
            ? query.split('&').filter(Boolean).map((pair) => {
                const [key, value = ''] = pair.split('=');
                return {
                    key: decodeURIComponent(key),
                    name: decodeURIComponent(key),
                    value: isSensitiveKey(key) ? PLACEHOLDER_FOR(key) : decodeURIComponent(value),
                    enabled: true
                };
            })
            : [];
        return { url: path.startsWith('http') ? path : `{{baseUrl}}${path.startsWith('/') ? path : `/${path}`}`, params, origin: '' };
    }
}

/**
 * Build a collection request from a normalized span.
 * @param {Object} span - normalized span (see OtlpTraceNormalizer)
 * @param {Object} trace - its parent normalized trace
 * @returns {Object} a request document shaped for Collection.requests
 */
function buildRequestFromSpan(span, trace, { name } = {}) {
    if (!span) throw new Error('A span is required to generate a request');
    if (!span.httpMethod && !span.url) {
        throw new Error('This span has no HTTP method or URL — only HTTP client/server spans can become requests');
    }

    const method = METHODS.includes(String(span.httpMethod || '').toUpperCase())
        ? String(span.httpMethod).toUpperCase()
        : 'GET';

    const { url, params } = splitUrl(span.url || span.route || '');

    // Sensitive headers become placeholders; their observed values never travel.
    const headers = (span.requestHeaders || []).map((header) => {
        const sensitive = header.sensitive || isSensitiveKey(header.key) || header.value === REDACTED;
        return {
            key: header.key,
            name: header.key,
            value: sensitive ? PLACEHOLDER_FOR(header.key) : header.value,
            description: sensitive ? 'Placeholder — set this in your environment' : '',
            enabled: true
        };
    });

    const body = typeof span.requestBody === 'string' ? span.requestBody : '';
    let bodyType = 'none';
    if (body) {
        const contentType = (span.requestHeaders || [])
            .find((h) => String(h.key).toLowerCase() === 'content-type')?.value || '';
        bodyType = /json/i.test(contentType) || body.trim().startsWith('{') || body.trim().startsWith('[')
            ? 'json'
            : 'raw';
    }

    return {
        name: name || `${method} ${span.route || span.name || 'from trace'}`.slice(0, 120),
        description: `Generated from OpenTelemetry trace ${trace?.traceId || ''} (span ${span.spanId}).`.trim(),
        url,
        method,
        protocol: 'http',
        headers,
        params,
        body,
        bodyType,
        // Auth is never copied — the user wires this to an environment secret.
        authConfig: { type: 'inherit' },
        metadata: {
            source: 'otel-trace',
            traceId: trace?.traceId || null,
            spanId: span.spanId,
            parentSpanId: span.parentSpanId || null,
            serviceName: span.serviceName,
            observedStatusCode: span.httpStatusCode ?? null,
            observedDurationMs: span.durationMs ?? null,
            environment: span.environment || null,
            deploymentVersion: span.deploymentVersion || null,
            observedAt: span.startTime || null
        }
    };
}

/**
 * Derive review-ready assertions from a span's observed successful response.
 * A failed span has no trustworthy "expected" shape, so status is the only
 * assertion we take from it.
 */
function buildAssertionsFromSpan(span, {
    includeResponseTime = true,
    includeFields = true,
    // Give the service headroom over what was observed rather than asserting
    // the exact latency, which would flap on every run.
    responseTimeMultiplier = 2,
    maxFields = 15
} = {}) {
    if (!span) throw new Error('A span is required to generate assertions');

    const assertions = [];
    const status = Number(span.httpStatusCode);
    const observedOk = Number.isFinite(status) && status >= 200 && status < 400;

    if (Number.isFinite(status)) {
        assertions.push({
            kind: 'status',
            label: `Status code is ${status}`,
            expected: status,
            // A failing span's status is what we saw, not what we want.
            warning: observedOk ? '' : 'This span failed — confirm this is the status you expect.'
        });
    }

    if (includeResponseTime && Number.isFinite(Number(span.durationMs)) && span.durationMs > 0) {
        const threshold = Math.max(50, Math.ceil((span.durationMs * responseTimeMultiplier) / 10) * 10);
        assertions.push({
            kind: 'response-time',
            label: `Response time is under ${threshold} ms`,
            expected: threshold,
            observed: span.durationMs,
            warning: ''
        });
    }

    if (includeFields && observedOk && span.responseBody) {
        deriveExpectedFields(span.responseBody, { maxFields })
            .filter((field) => field.type !== 'object' && field.type !== 'array')
            .slice(0, maxFields)
            .forEach((field) => {
                assertions.push({
                    kind: 'field',
                    label: `Response body has \`${field.path}\` (${field.type})`,
                    expected: field.path,
                    type: field.type,
                    warning: ''
                });
            });
    }

    return assertions;
}

const pathAccessor = (path) => `body${String(path)
    .replace(/\[(\d+)\]/g, '[$1]')
    .split('.')
    .filter(Boolean)
    .map((seg) => (seg.includes('[') ? seg.replace(/^([^[]+)/, "['$1']") : `['${seg}']`))
    .join('')}`;

/**
 * Render assertions as a Pigeon test script using the `assert` + `response`
 * sandbox globals provided by utils/scriptRunner.js.
 */
function buildTestScript(assertions = [], { traceId, spanId } = {}) {
    const lines = ['// Regression test generated from an OpenTelemetry trace.'];
    if (traceId) lines.push(`// Trace: ${traceId}${spanId ? ` / span: ${spanId}` : ''}`);
    lines.push('');

    const needsBody = assertions.some((a) => a.kind === 'field');
    if (needsBody) {
        lines.push('const body = typeof response.body === "string"');
        lines.push('    ? (() => { try { return JSON.parse(response.body); } catch { return {}; } })()');
        lines.push('    : (response.body || {});');
        lines.push('');
    }

    assertions.forEach((assertion) => {
        if (assertion.kind === 'status') {
            lines.push(`assert.equal(response.status, ${Number(assertion.expected)}, "Status code is ${Number(assertion.expected)}");`);
        } else if (assertion.kind === 'response-time') {
            lines.push(`assert.lessThan(response.duration, ${Number(assertion.expected)}, "Response time is under ${Number(assertion.expected)} ms");`);
        } else if (assertion.kind === 'field') {
            const accessor = pathAccessor(assertion.expected);
            lines.push(`assert.isDefined(${accessor}, "Response body has ${assertion.expected}");`);
        }
    });

    return `${lines.join('\n')}\n`;
}

module.exports = {
    buildRequestFromSpan,
    buildAssertionsFromSpan,
    buildTestScript,
    splitUrl,
    PLACEHOLDER_FOR
};
