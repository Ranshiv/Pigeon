// services/ConsumerContractVerifier.js
// Pure comparison of a consumer's expectations against an actual provider
// response. No I/O here so it stays unit-testable and reusable by CI.

/**
 * Read a value out of a parsed JSON body using dot/bracket notation.
 * Returns { found, value } so a legitimately-null field is distinguishable
 * from a missing one.
 */
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

function typeOf(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
}

function describe(value) {
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return value;
    try {
        const json = JSON.stringify(value);
        return json === undefined ? String(value) : json;
    } catch {
        return String(value);
    }
}

/**
 * Derive field expectations from an example response body. Every leaf becomes
 * a required path with its observed type — key order is irrelevant because we
 * only ever compare by path.
 */
function deriveExpectedFields(body, { maxFields = 200 } = {}) {
    let parsed = body;
    if (typeof body === 'string') {
        if (!body.trim()) return [];
        try {
            parsed = JSON.parse(body);
        } catch {
            return [];
        }
    }
    if (parsed === null || typeof parsed !== 'object') return [];

    const fields = [];
    const walk = (node, prefix) => {
        if (fields.length >= maxFields) return;
        if (Array.isArray(node)) {
            // Only describe the first element — contracts assert shape, not length.
            if (node.length > 0) walk(node[0], `${prefix}[0]`);
            return;
        }
        if (node !== null && typeof node === 'object') {
            Object.keys(node).forEach((key) => {
                const path = prefix ? `${prefix}.${key}` : key;
                const value = node[key];
                if (value !== null && typeof value === 'object') {
                    fields.push({ path, required: true, type: typeOf(value), matchValue: false, expectedValue: '' });
                    walk(value, path);
                } else {
                    fields.push({ path, required: true, type: typeOf(value), matchValue: false, expectedValue: '' });
                }
            });
        }
    };
    walk(parsed, '');
    return fields.slice(0, maxFields);
}

/**
 * Compare one interaction's expectations against the actual response.
 * @returns {{passed: boolean, breaking: boolean, violations: Array}}
 */
function verifyInteraction(interaction, actual) {
    const violations = [];
    const expectedStatus = Number(interaction.expectedStatus);

    if (Number.isFinite(expectedStatus) && expectedStatus > 0) {
        if (Number(actual.status) !== expectedStatus) {
            violations.push({
                kind: 'status',
                path: '',
                message: `Expected ${expectedStatus}, received ${actual.status}`,
                expected: String(expectedStatus),
                actual: String(actual.status),
                breaking: true
            });
        }
    }

    // Header names are case-insensitive per RFC 9110.
    const actualHeaders = {};
    Object.entries(actual.headers || {}).forEach(([k, v]) => {
        actualHeaders[String(k).toLowerCase()] = v;
    });

    (interaction.expectedHeaders || [])
        .filter((h) => h && h.enabled !== false && h.key)
        .forEach((h) => {
            const name = String(h.key).toLowerCase();
            const actualValue = actualHeaders[name];
            if (actualValue === undefined) {
                violations.push({
                    kind: 'header',
                    path: h.key,
                    message: `Expected \`${h.key}: ${h.value}\``,
                    expected: `${h.key}: ${h.value}`,
                    actual: 'header absent',
                    breaking: true
                });
                return;
            }
            if (!h.value) return; // presence-only expectation
            // content-type carries parameters (charset); match the media type.
            const matches = String(actualValue).toLowerCase().includes(String(h.value).toLowerCase());
            if (!matches) {
                violations.push({
                    kind: 'header',
                    path: h.key,
                    message: `Expected \`${h.key}: ${h.value}\``,
                    expected: `${h.key}: ${h.value}`,
                    actual: `${h.key}: ${actualValue}`,
                    breaking: true
                });
            }
        });

    const expectations = (interaction.expectedFields || []).filter((f) => f && f.path);
    if (expectations.length > 0) {
        let parsedBody = actual.body;
        if (typeof parsedBody === 'string') {
            try {
                parsedBody = parsedBody.trim() ? JSON.parse(parsedBody) : null;
            } catch {
                parsedBody = undefined;
            }
        }

        if (parsedBody === undefined) {
            violations.push({
                kind: 'field-missing',
                path: '',
                message: 'Expected a JSON response body, received a non-JSON payload',
                expected: 'JSON body',
                actual: 'unparseable body',
                breaking: true
            });
        } else {
            expectations.forEach((field) => {
                const { found, value } = getByPath(parsedBody, field.path);

                if (!found) {
                    if (field.required !== false) {
                        violations.push({
                            kind: 'field-missing',
                            path: field.path,
                            message: `Expected response field \`${field.path}\` is missing`,
                            expected: field.type && field.type !== 'any' ? field.type : 'present',
                            actual: 'missing',
                            breaking: true
                        });
                    }
                    return;
                }

                if (field.type && field.type !== 'any' && typeOf(value) !== field.type) {
                    violations.push({
                        kind: 'field-type',
                        path: field.path,
                        message: `Expected \`${field.path}\` to be ${field.type}, received ${typeOf(value)}`,
                        expected: field.type,
                        actual: typeOf(value),
                        breaking: true
                    });
                    return;
                }

                if (field.matchValue) {
                    const raw = field.expectedValue;
                    let expectedValue = raw;
                    if (typeof value !== 'string') {
                        try {
                            expectedValue = JSON.parse(raw);
                        } catch {
                            expectedValue = raw;
                        }
                    }
                    const equal = JSON.stringify(value) === JSON.stringify(expectedValue);
                    if (!equal) {
                        violations.push({
                            kind: 'field-value',
                            path: field.path,
                            message: `Expected \`${field.path}\` to equal ${describe(expectedValue)}, received ${describe(value)}`,
                            expected: describe(expectedValue),
                            actual: describe(value),
                            breaking: true
                        });
                    }
                }
            });
        }
    }

    const threshold = Number(interaction.maxResponseTimeMs);
    if (Number.isFinite(threshold) && threshold > 0 && Number(actual.durationMs) > threshold) {
        violations.push({
            kind: 'response-time',
            path: '',
            message: `Response exceeded the ${threshold} ms consumer threshold`,
            expected: `<= ${threshold} ms`,
            actual: `${actual.durationMs} ms`,
            // Slowness is a regression but not a contract-shape break.
            breaking: false
        });
    }

    return {
        passed: violations.length === 0,
        breaking: violations.some((v) => v.breaking),
        violations
    };
}

module.exports = { verifyInteraction, deriveExpectedFields, getByPath, typeOf };
