// services/OtlpTraceNormalizer.js
// Pure OTLP (OpenTelemetry Protocol) JSON -> Pigeon trace/span normalisation.
// No I/O so it stays unit-testable and reusable by the collector poller.
//
// Redaction happens here, before anything is persisted or returned, so a
// secret in an incoming trace never reaches the database or the browser.

// Retention-friendly ceilings. Traces are diagnostic data, not an archive.
const LIMITS = {
    maxSpansPerTrace: 500,
    maxTracesPerImport: 100,
    maxAttributes: 60,
    maxAttrValueChars: 2048,
    maxBodyChars: 16 * 1024,
    maxHeaders: 40
};

const REDACTED = '[REDACTED]';

// Anything whose *name* looks like a credential is never stored verbatim.
const SENSITIVE_KEY = /(authorization|cookie|api[-_ ]?key|x[-_]api[-_]key|access[-_ ]?token|refresh[-_ ]?token|id[-_ ]?token|\btoken\b|password|passwd|secret|credential|private[-_ ]?key|session[-_ ]?id|x[-_]auth|auth[-_ ]?token|client[-_ ]?secret|signature)/i;

const isSensitiveKey = (key) => SENSITIVE_KEY.test(String(key || ''));

/** Unwrap an OTLP AnyValue into a plain JS value. */
function anyValue(value) {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'object') return value;

    if ('stringValue' in value) return value.stringValue;
    if ('boolValue' in value) return value.boolValue;
    if ('intValue' in value) return Number(value.intValue);
    if ('doubleValue' in value) return value.doubleValue;
    if ('bytesValue' in value) return String(value.bytesValue);
    if ('arrayValue' in value) return (value.arrayValue?.values || []).map(anyValue);
    if ('kvlistValue' in value) {
        return Object.fromEntries((value.kvlistValue?.values || []).map((kv) => [kv.key, anyValue(kv.value)]));
    }
    return null;
}

function truncate(text, max) {
    const str = typeof text === 'string' ? text : JSON.stringify(text ?? '');
    if (str === undefined) return '';
    return str.length > max ? `${str.slice(0, max)}… [truncated ${str.length - max} chars]` : str;
}

/**
 * Replace credential-looking values inside a JSON body while keeping its shape,
 * so field expectations can still be derived from it.
 */
function redactBody(body, max = LIMITS.maxBodyChars) {
    if (body === null || body === undefined || body === '') return '';
    let parsed = body;
    if (typeof body === 'string') {
        try { parsed = JSON.parse(body); } catch { return truncate(body, max); }
    }
    const walk = (node) => {
        if (Array.isArray(node)) return node.map(walk);
        if (node !== null && typeof node === 'object') {
            return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, isSensitiveKey(k) ? REDACTED : walk(v)]));
        }
        return node;
    };
    try {
        return truncate(JSON.stringify(walk(parsed)), max);
    } catch {
        return truncate(String(body), max);
    }
}

/** Strip credentials out of a URL's query string and userinfo. */
function redactUrl(rawUrl) {
    const url = String(rawUrl || '');
    if (!url) return '';
    try {
        const parsed = new URL(url);
        if (parsed.username || parsed.password) {
            parsed.username = REDACTED;
            parsed.password = '';
        }
        parsed.searchParams.forEach((value, key) => {
            if (isSensitiveKey(key)) parsed.searchParams.set(key, REDACTED);
        });
        return parsed.toString();
    } catch {
        // Relative path or template ("/users/{id}?token=..") — redact by regex.
        return url.replace(/([?&])([^=&]+)=([^&]*)/g, (match, sep, key, value) =>
            (isSensitiveKey(key) ? `${sep}${key}=${REDACTED}` : `${sep}${key}=${value}`));
    }
}

/** OTLP attribute array -> redacted, truncated plain object. */
function redactAttributes(attributes = []) {
    const out = {};
    const list = Array.isArray(attributes) ? attributes : [];
    for (const attr of list.slice(0, LIMITS.maxAttributes)) {
        if (!attr || !attr.key) continue;
        const key = String(attr.key);
        if (isSensitiveKey(key)) {
            out[key] = REDACTED;
            continue;
        }
        const value = anyValue(attr.value);
        out[key] = typeof value === 'string' ? truncate(value, LIMITS.maxAttrValueChars) : value;
    }
    return out;
}

const firstAttr = (attrs, keys) => {
    for (const key of keys) {
        if (attrs[key] !== undefined && attrs[key] !== null && attrs[key] !== '') return attrs[key];
    }
    return undefined;
};

/**
 * Pull `http.request.header.x` / `http.response.header.x` attributes out of a
 * span. Values arrive as arrays per the OTel spec; sensitive ones are already
 * REDACTED by redactAttributes.
 */
function collectHeaders(attrs, prefix) {
    const headers = [];
    for (const [key, value] of Object.entries(attrs)) {
        const lower = key.toLowerCase();
        if (!lower.startsWith(prefix)) continue;
        const name = key.slice(prefix.length);
        if (!name) continue;
        headers.push({
            key: name,
            value: Array.isArray(value) ? value.join(', ') : truncate(String(value ?? ''), LIMITS.maxAttrValueChars),
            sensitive: isSensitiveKey(name) || value === REDACTED
        });
        if (headers.length >= LIMITS.maxHeaders) break;
    }
    return headers;
}

const SPAN_KINDS = {
    0: 'internal', 1: 'internal', 2: 'server', 3: 'client', 4: 'producer', 5: 'consumer',
    SPAN_KIND_UNSPECIFIED: 'internal',
    SPAN_KIND_INTERNAL: 'internal',
    SPAN_KIND_SERVER: 'server',
    SPAN_KIND_CLIENT: 'client',
    SPAN_KIND_PRODUCER: 'producer',
    SPAN_KIND_CONSUMER: 'consumer'
};

const nanoToMs = (nano) => {
    const n = Number(nano);
    return Number.isFinite(n) ? n / 1e6 : null;
};

/** Normalise a single OTLP span plus its resource/scope context. */
function normalizeSpan(span, { resourceAttrs = {}, scopeName = '' } = {}) {
    const attrs = redactAttributes(span.attributes);
    const startMs = nanoToMs(span.startTimeUnixNano);
    const endMs = nanoToMs(span.endTimeUnixNano);

    const statusCodeRaw = span.status?.code;
    const statusName = typeof statusCodeRaw === 'string' ? statusCodeRaw : ({ 0: 'UNSET', 1: 'OK', 2: 'ERROR' })[statusCodeRaw];
    const isError = statusName === 'ERROR' || statusName === 'STATUS_CODE_ERROR';

    const httpStatus = Number(firstAttr(attrs, ['http.response.status_code', 'http.status_code']));
    const method = firstAttr(attrs, ['http.request.method', 'http.method']);
    const url = firstAttr(attrs, ['url.full', 'http.url']);
    const target = firstAttr(attrs, ['url.path', 'http.target']);
    const scheme = firstAttr(attrs, ['url.scheme', 'http.scheme']) || 'https';
    const host = firstAttr(attrs, ['server.address', 'http.host', 'net.peer.name', 'net.host.name']);
    const port = firstAttr(attrs, ['server.port', 'net.peer.port']);

    // Prefer the full URL; otherwise rebuild it from host + path.
    let resolvedUrl = url ? redactUrl(url) : '';
    if (!resolvedUrl && host && target) {
        const portPart = port && ![80, 443].includes(Number(port)) ? `:${port}` : '';
        resolvedUrl = redactUrl(`${scheme}://${host}${portPart}${target}`);
    }
    if (!resolvedUrl && target) resolvedUrl = redactUrl(String(target));

    return {
        spanId: String(span.spanId || ''),
        parentSpanId: String(span.parentSpanId || '') || null,
        name: truncate(span.name || '(unnamed span)', 300),
        kind: SPAN_KINDS[span.kind] || 'internal',
        serviceName: String(resourceAttrs['service.name'] || 'unknown-service'),
        scopeName: String(scopeName || ''),

        httpMethod: method ? String(method).toUpperCase() : null,
        url: resolvedUrl,
        route: firstAttr(attrs, ['http.route']) ? String(firstAttr(attrs, ['http.route'])) : null,
        httpStatusCode: Number.isFinite(httpStatus) ? httpStatus : null,

        startTime: startMs ? new Date(startMs) : null,
        durationMs: startMs !== null && endMs !== null ? Math.max(0, Number((endMs - startMs).toFixed(3))) : null,

        status: isError ? 'error' : (statusName === 'OK' ? 'ok' : 'unset'),
        statusMessage: truncate(span.status?.message || '', 500),

        requestHeaders: collectHeaders(attrs, 'http.request.header.'),
        responseHeaders: collectHeaders(attrs, 'http.response.header.'),
        requestBody: redactBody(firstAttr(attrs, ['http.request.body', 'http.request.body.content'])),
        responseBody: redactBody(firstAttr(attrs, ['http.response.body', 'http.response.body.content'])),

        // Environment/version normally live on the resource, not the span.
        environment: String(firstAttr({ ...resourceAttrs, ...attrs }, ['deployment.environment.name', 'deployment.environment']) || '') || null,
        deploymentVersion: String(firstAttr({ ...resourceAttrs, ...attrs }, ['service.version', 'deployment.version']) || '') || null,

        attributes: attrs
    };
}

/**
 * Normalise a whole OTLP export payload into one Pigeon trace per traceId.
 * Accepts `{ resourceSpans: [...] }` (also the legacy
 * `instrumentationLibrarySpans` key) and tolerates a bare array.
 *
 * @returns {Array<Object>} traces, newest first
 */
function normalizeOtlpPayload(payload) {
    if (!payload || typeof payload !== 'object') {
        throw new Error('OTLP payload must be a JSON object');
    }
    const resourceSpans = Array.isArray(payload) ? payload : (payload.resourceSpans || payload.resource_spans);
    if (!Array.isArray(resourceSpans) || resourceSpans.length === 0) {
        throw new Error('No resourceSpans found — is this an OTLP trace export?');
    }

    const byTraceId = new Map();

    for (const resourceSpan of resourceSpans) {
        const resourceAttrs = redactAttributes(resourceSpan?.resource?.attributes);
        const scopeSpans = resourceSpan?.scopeSpans
            || resourceSpan?.scope_spans
            || resourceSpan?.instrumentationLibrarySpans
            || [];

        for (const scopeSpan of scopeSpans) {
            const scopeName = scopeSpan?.scope?.name || scopeSpan?.instrumentationLibrary?.name || '';
            for (const rawSpan of (scopeSpan?.spans || [])) {
                const traceId = String(rawSpan?.traceId || rawSpan?.trace_id || '');
                if (!traceId) continue;

                if (!byTraceId.has(traceId)) {
                    if (byTraceId.size >= LIMITS.maxTracesPerImport) continue;
                    byTraceId.set(traceId, { traceId, spans: [], truncatedSpans: 0 });
                }
                const trace = byTraceId.get(traceId);
                if (trace.spans.length >= LIMITS.maxSpansPerTrace) {
                    trace.truncatedSpans += 1;
                    continue;
                }
                trace.spans.push(normalizeSpan(rawSpan, { resourceAttrs, scopeName }));
            }
        }
    }

    if (byTraceId.size === 0) throw new Error('No spans with a traceId were found in this payload');

    return [...byTraceId.values()]
        .map((trace) => summarizeTrace(trace))
        .sort((a, b) => new Date(b.startTime || 0) - new Date(a.startTime || 0));
}

/** Derive the trace-level roll-up the list view filters on. */
function summarizeTrace(trace) {
    const spans = trace.spans;
    const starts = spans.map((s) => s.startTime).filter(Boolean).map((d) => d.getTime());
    const startTime = starts.length ? new Date(Math.min(...starts)) : null;

    const spanById = new Map(spans.map((s) => [s.spanId, s]));
    const root = spans.find((s) => !s.parentSpanId || !spanById.has(s.parentSpanId)) || spans[0];

    const errorSpans = spans.filter((s) => s.status === 'error' || (s.httpStatusCode && s.httpStatusCode >= 400));
    const ends = spans
        .filter((s) => s.startTime && s.durationMs !== null)
        .map((s) => s.startTime.getTime() + s.durationMs);

    return {
        traceId: trace.traceId,
        rootServiceName: root?.serviceName || 'unknown-service',
        rootSpanName: root?.name || '',
        route: spans.find((s) => s.route)?.route || root?.route || root?.url || '',
        httpMethod: spans.find((s) => s.httpMethod)?.httpMethod || null,
        httpStatusCode: root?.httpStatusCode ?? spans.find((s) => s.httpStatusCode)?.httpStatusCode ?? null,
        environment: spans.find((s) => s.environment)?.environment || null,
        deploymentVersion: spans.find((s) => s.deploymentVersion)?.deploymentVersion || null,
        services: [...new Set(spans.map((s) => s.serviceName))],
        startTime,
        durationMs: starts.length && ends.length ? Number((Math.max(...ends) - Math.min(...starts)).toFixed(3)) : null,
        hasError: errorSpans.length > 0,
        errorCount: errorSpans.length,
        errorMessage: errorSpans.find((s) => s.statusMessage)?.statusMessage || '',
        spanCount: spans.length,
        truncatedSpans: trace.truncatedSpans,
        spans
    };
}

module.exports = {
    normalizeOtlpPayload,
    normalizeSpan,
    summarizeTrace,
    redactAttributes,
    redactBody,
    redactUrl,
    isSensitiveKey,
    anyValue,
    LIMITS,
    REDACTED
};
