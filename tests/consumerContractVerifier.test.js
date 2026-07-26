// tests/consumerContractVerifier.test.js
const { verifyInteraction, deriveExpectedFields, getByPath } = require('../services/ConsumerContractVerifier');

const interaction = {
    name: 'Get user',
    method: 'GET',
    url: 'https://api.test/users/1',
    expectedStatus: 200,
    expectedHeaders: [{ key: 'content-type', value: 'application/json', enabled: true }],
    expectedFields: [
        { path: 'user.id', required: true, type: 'number' },
        { path: 'user.name', required: true, type: 'string' },
        { path: 'user.role', required: true, type: 'string', matchValue: true, expectedValue: 'admin' }
    ],
    maxResponseTimeMs: 500
};

const okActual = {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ user: { name: 'Ada', role: 'admin', id: 1 } }),
    durationMs: 120
};

describe('verifyInteraction', () => {
    test('passes when the provider satisfies every expectation', () => {
        const result = verifyInteraction(interaction, okActual);
        expect(result.passed).toBe(true);
        expect(result.violations).toHaveLength(0);
    });

    test('ignores JSON key order', () => {
        const reordered = {
            ...okActual,
            body: JSON.stringify({ user: { id: 1, role: 'admin', name: 'Ada' } })
        };
        expect(verifyInteraction(interaction, reordered).passed).toBe(true);
    });

    test('flags a missing required field as breaking', () => {
        const actual = { ...okActual, body: JSON.stringify({ user: { name: 'Ada', role: 'admin' } }) };
        const result = verifyInteraction(interaction, actual);
        expect(result.breaking).toBe(true);
        expect(result.violations.some(v => v.message === 'Expected response field `user.id` is missing')).toBe(true);
    });

    test('flags a status change as breaking', () => {
        const result = verifyInteraction(interaction, { ...okActual, status: 201 });
        expect(result.violations.find(v => v.kind === 'status').message).toBe('Expected 200, received 201');
        expect(result.breaking).toBe(true);
    });

    test('flags a missing expected header', () => {
        const result = verifyInteraction(interaction, { ...okActual, headers: {} });
        const v = result.violations.find(x => x.kind === 'header');
        expect(v.message).toBe('Expected `content-type: application/json`');
        expect(v.breaking).toBe(true);
    });

    test('flags a type change as breaking', () => {
        const actual = { ...okActual, body: JSON.stringify({ user: { id: '1', name: 'Ada', role: 'admin' } }) };
        const v = verifyInteraction(interaction, actual).violations.find(x => x.kind === 'field-type');
        expect(v.message).toBe('Expected `user.id` to be number, received string');
    });

    test('flags a changed expected value', () => {
        const actual = { ...okActual, body: JSON.stringify({ user: { id: 1, name: 'Ada', role: 'viewer' } }) };
        const v = verifyInteraction(interaction, actual).violations.find(x => x.kind === 'field-value');
        expect(v.message).toBe('Expected `user.role` to equal admin, received viewer');
    });

    test('reports a slow response but does not call it breaking', () => {
        const result = verifyInteraction(interaction, { ...okActual, durationMs: 900 });
        expect(result.passed).toBe(false);
        expect(result.breaking).toBe(false);
        expect(result.violations[0].message).toBe('Response exceeded the 500 ms consumer threshold');
    });

    test('optional fields may be absent', () => {
        const optional = {
            expectedStatus: 200,
            expectedFields: [{ path: 'meta.trace', required: false, type: 'string' }]
        };
        expect(verifyInteraction(optional, { ...okActual, headers: {} }).passed).toBe(true);
    });
});

describe('deriveExpectedFields', () => {
    test('walks nested objects and the first array element', () => {
        const fields = deriveExpectedFields(JSON.stringify({
            id: 7,
            user: { name: 'Ada' },
            items: [{ sku: 'A1' }]
        }));
        const byPath = Object.fromEntries(fields.map(f => [f.path, f.type]));
        expect(byPath.id).toBe('number');
        expect(byPath['user.name']).toBe('string');
        expect(byPath['items[0].sku']).toBe('string');
    });

    test('returns nothing for non-JSON bodies', () => {
        expect(deriveExpectedFields('<html></html>')).toEqual([]);
        expect(deriveExpectedFields('')).toEqual([]);
    });
});

describe('getByPath', () => {
    test('distinguishes a null value from a missing key', () => {
        expect(getByPath({ a: null }, 'a')).toEqual({ found: true, value: null });
        expect(getByPath({ a: null }, 'b').found).toBe(false);
    });
});
