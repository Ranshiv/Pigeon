// services/AsyncApiRedact.js
// Redaction primitives + LIMITS, split out of AsyncApiValidator.js so the
// normaliser (AsyncApiNormalizer.js) can require these without a circular
// dependency on AsyncApiValidator.js. Mirrors services/OtlpTraceNormalizer.js's
// trust-boundary rule. AsyncApiValidator re-exports everything here.

const LIMITS = {
    maxServers: 50,
    maxChannels: 200,
    maxMessages: 200,
    maxOperations: 400,
    maxTags: 40,
    maxBodyChars: 16 * 1024
};

const REDACTED = '[REDACTED]';
// Env-var placeholder for redacted secrets — supports a later VariableResolver
// substitution step ({{ASYNCAPI_SECRET}} or {{key}}). Kept constant here so
// the round-trip export stays stable.
const SECRET_PLACEHOLDER = '{{ASYNCAPI_SECRET}}';

// Verbatim copy from services/OtlpTraceNormalizer.js — same trust-boundary rule.
const SENSITIVE_KEY = /(authorization|cookie|api[-_ ]?key|x[-_]api[-_]key|access[-_ ]?token|refresh[-_ ]?token|id[-_ ]?token|\btoken\b|password|passwd|secret|credential|private[-_ ]?key|session[-_ ]?id|x[-_]auth|auth[-_ ]?token|client[-_ ]?secret|signature)/i;

const isSensitiveKey = (key) => SENSITIVE_KEY.test(String(key || ''));

function truncate(text, max) {
    const str = typeof text === 'string' ? text : JSON.stringify(text ?? '');
    if (str === undefined) return '';
    return str.length > max ? `${str.slice(0, max)}… [truncated ${str.length - max} chars]` : str;
}

/** Redact sensitive-string VALUES inside a parsed JSON object (depth walk). */
function redactSensitiveValues(node) {
    if (Array.isArray(node)) return node.map(redactSensitiveValues);
    if (node !== null && typeof node === 'object') {
        return Object.fromEntries(Object.entries(node).map(([k, v]) => {
            if (typeof v === 'string' && isSensitiveKey(k)) return [k, SECRET_PLACEHOLDER];
            return [k, redactSensitiveValues(v)];
        }));
    }
    return node;
}

/**
 * Redact a JSON body string (URL, server security, payload example). Mirrors
 * redactBody() from OtlpTraceNormalizer.js for the request/response path.
 */
function redactBody(body, max = LIMITS.maxBodyChars) {
    if (body === null || body === undefined || body === '') return '';
    let parsed = body;
    if (typeof body === 'string') {
        try { parsed = JSON.parse(body); } catch { return truncate(body, max); }
    }
    const walked = redactSensitiveValues(parsed);
    try {
        return truncate(JSON.stringify(walked), max);
    } catch {
        return truncate(String(body), max);
    }
}

module.exports = {
    LIMITS,
    REDACTED,
    SECRET_PLACEHOLDER,
    SENSITIVE_KEY,
    isSensitiveKey,
    truncate,
    redactSensitiveValues,
    redactBody
};