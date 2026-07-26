// services/AsyncApiValidator.js
// AsyncAPI schema validation + the re-export surface for the normaliser
// (AsyncApiNormalizer.js) and the back-export serializer (AsyncApiSerializer.js).
// Redaction primitives + LIMITS live in AsyncApiRedact.js (required by all
// three) so there's no circular dependency. This module re-exports the full
// surface existing callers depend on (routes/asyncapi.js, tests).
//
// Secrets are never stored verbatim: sensitive-looking values inside server
// security schemes / examples are redacted to an env-var placeholder string.

const {
    LIMITS, REDACTED, SECRET_PLACEHOLDER, SENSITIVE_KEY,
    isSensitiveKey, truncate, redactSensitiveValues, redactBody
} = require('./AsyncApiRedact');

function typeOf(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
}

/** Read a value out of parsed JSON using dot/bracket notation. Mirrors getByPath. */
function getByPath(root, path) {
    if (!path) return { found: false, value: undefined };
    const segments = String(path)
        .replace(/\[(\d+)\]/g, '.$1')
        .split('.')
        .filter((s) => s !== '');
    let current = root;
    for (const segment of segments) {
        if (current === null || current === undefined) return { found: false, value: undefined };
        if (Array.isArray(current)) {
            const index = Number(segment);
            if (!Number.isInteger(index) || index < 0 || index >= current.length) {
                return { found: false, value: undefined };
            }
            current = current[index];
            continue;
        }
        if (typeof current !== 'object') return { found: false, value: undefined };
        if (!Object.prototype.hasOwnProperty.call(current, segment)) {
            return { found: false, value: undefined };
        }
        current = current[segment];
    }
    return { found: true, value: current };
}

/**
 * Validate a JSON payload against a JSON-Schema-like schema.
 * Supports type/properties/items/required for object/array/string/number/
 * integer/boolean/null. Returns field-level errors: [{ path, message,
 * expected, actual }]. Mirrors ConsumerContractVerifier.js's field walk.
 *
 * @param {*} payload   Parsed JSON (object/array/scalar).
 * @param {object} schema JSON-Schema-like schema. May be {} / null.
 * @param {string} base  Dot path prefix (internal recursion).
 * @returns {Array}      violations array (empty = valid).
 */
function validatePayloadAgainstSchema(payload, schema) {
    if (!schema || typeof schema !== 'object' || Object.keys(schema).length === 0) {
        // No schema means we cannot honestly claim the payload validates.
        return { validated: false, violations: [] };
    }
    const violations = [];
    walk(payload, schema, '');
    return { validated: true, violations };

    function walk(value, sub, path) {
        const expectedType = sub.type;
        if (expectedType) {
            const actual = typeOf(value);
            if (!matchesType(actual, expectedType, value)) {
                violations.push({
                    path: path || '(root)',
                    message: `Expected ${expectedType}, received ${actual}`,
                    expected: expectedType,
                    actual
                });
                return;
            }
        }
        if (sub.enum && !sub.enum.includes(value)) {
            violations.push({
                path: path || '(root)',
                message: `Expected one of ${JSON.stringify(sub.enum)}, received ${JSON.stringify(value)}`,
                expected: `enum: ${JSON.stringify(sub.enum)}`,
                actual: JSON.stringify(value)
            });
        }
        if (expectedType === 'object' && value && typeof value === 'object' && !Array.isArray(value)) {
            const required = Array.isArray(sub.required) ? sub.required : [];
            for (const req of required) {
                if (!Object.prototype.hasOwnProperty.call(value, req)) {
                    violations.push({
                        path: path ? `${path}.${req}` : req,
                        message: `Missing required field \`${req}\``,
                        expected: 'present',
                        actual: 'missing'
                    });
                }
            }
            const props = sub.properties || {};
            for (const [key, child] of Object.entries(props)) {
                if (Object.prototype.hasOwnProperty.call(value, key)) {
                    walk(value[key], child, path ? `${path}.${key}` : key);
                }
            }
        }
        if (expectedType === 'array' && Array.isArray(value)) {
            const item = sub.items;
            if (item) {
                value.forEach((el, i) => walk(el, item, `${path}[${i}]`));
            }
            if (Number.isFinite(sub.minItems) && value.length < sub.minItems) {
                violations.push({
                    path: path || '(root)',
                    message: `Expected at least ${sub.minItems} item(s), received ${value.length}`,
                    expected: `>= ${sub.minItems}`,
                    actual: String(value.length)
                });
            }
            if (Number.isFinite(sub.maxItems) && value.length > sub.maxItems) {
                violations.push({
                    path: path || '(root)',
                    message: `Expected at most ${sub.maxItems} item(s), received ${value.length}`,
                    expected: `<= ${sub.maxItems}`,
                    actual: String(value.length)
                });
            }
        }
        if (expectedType === 'string' && typeof value === 'string') {
            if (Number.isFinite(sub.minLength) && value.length < sub.minLength) {
                violations.push({
                    path: path || '(root)',
                    message: `Expected string length >= ${sub.minLength}, received ${value.length}`,
                    expected: `>= ${sub.minLength}`,
                    actual: String(value.length)
                });
            }
            if (Number.isFinite(sub.maxLength) && value.length > sub.maxLength) {
                violations.push({
                    path: path || '(root)',
                    message: `Expected string length <= ${sub.maxLength}, received ${value.length}`,
                    expected: `<= ${sub.maxLength}`,
                    actual: String(value.length)
                });
            }
            if (sub.pattern) {
                const re = safeRegex(sub.pattern);
                if (re && !re.test(value)) {
                    violations.push({
                        path: path || '(root)',
                        message: `Expected string to match ${sub.pattern}`,
                        expected: sub.pattern,
                        actual: truncate(value, 80)
                    });
                }
            }
        }
        if ((expectedType === 'number' || expectedType === 'integer') && typeof value === 'number') {
            if (expectedType === 'integer' && !Number.isInteger(value)) {
                violations.push({
                    path: path || '(root)',
                    message: `Expected integer, received ${value}`,
                    expected: 'integer',
                    actual: String(value)
                });
            }
            if (Number.isFinite(sub.minimum) && value < sub.minimum) {
                violations.push({ path: path || '(root)', message: `Expected >= ${sub.minimum}, received ${value}`, expected: `>= ${sub.minimum}`, actual: String(value) });
            }
            if (Number.isFinite(sub.maximum) && value > sub.maximum) {
                violations.push({ path: path || '(root)', message: `Expected <= ${sub.maximum}, received ${value}`, expected: `<= ${sub.maximum}`, actual: String(value) });
            }
        }
    }
}

function matchesType(actual, expected, value) {
    if (actual === expected) return true;
    // integer is a refinement of number.
    if (expected === 'number' && actual === 'number') return true;
    if (expected === 'integer' && typeof value === 'number' && Number.isInteger(value)) return true;
    // Allow null literal under 'null' only.
    return false;
}

function safeRegex(pattern) {
    try { return new RegExp(pattern); } catch { return null; }
}

/**
 * Infer a JSON-Schema-shaped object by walking a JSON example. Mirrors
 * deriveExpectedFields() in ConsumerContractVerifier.js: every leaf becomes a
 * typed path; arrays describe their first element only.
 */
function deriveSchemaFromExample(json) {
    if (json === null) return { type: 'null' };
    const t = typeOf(json);
    if (t === 'object') {
        const properties = {};
        const required = [];
        for (const [k, v] of Object.entries(json)) {
            properties[k] = deriveSchemaFromExample(v);
            // Only require keys whose value is not null (null is ambiguous).
            if (v !== null) required.push(k);
        }
        return { type: 'object', properties, ...(required.length ? { required } : {}) };
    }
    if (t === 'array') {
        const item = json.length ? deriveSchemaFromExample(json[0]) : {};
        return { type: 'array', items: item };
    }
    if (t === 'number') {
        return Number.isInteger(json) ? { type: 'integer' } : { type: 'number' };
    }
    return { type: t };
}

// ------------------------------------------------------------ back-export
// Re-exported from AsyncApiSerializer.js (split out to keep this file under
// 500 lines). denormalizeToAsyncApiJson always rebuilds live arrays; rawImport
// only supplies fields Pigeon doesn't model.
const { denormalizeToAsyncApiJson } = require('./AsyncApiSerializer');
// Import normaliser split out to AsyncApiNormalizer.js (uses this module's
// redaction helpers + LIMITS). Re-exported here so existing require sites stay
// unchanged.
const { normalizeAsyncApiDocument } = require('./AsyncApiNormalizer');

module.exports = {
    LIMITS,
    REDACTED,
    SECRET_PLACEHOLDER,
    SENSITIVE_KEY,
    isSensitiveKey,
    redactSensitiveValues,
    redactBody,
    truncate,
    typeOf,
    getByPath,
    validatePayloadAgainstSchema,
    deriveSchemaFromExample,
    normalizeAsyncApiDocument,
    denormalizeToAsyncApiJson
};
