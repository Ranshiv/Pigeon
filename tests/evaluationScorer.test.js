// tests/evaluationScorer.test.js
// Pure unit tests for the deterministic transcript scorer. No I/O, no LLM,
// no DB. Covers each fail rule, the happy path, malformed-transcript rejection,
// and redaction of stored arguments.
const {
    validateTranscript,
    scoreScenario,
    scoreSuite,
    redactTranscript,
    summarizeRunResult
} = require('../services/EvaluationScorer');

const ALLOWED = ['get_user', 'create_user', 'delete_user'];
const baseTranscript = (calls) => ({ agentName: 'tester', toolCalls: calls });

const scenario = (overrides = {}) => ({
    _id: 's1',
    name: 'Create a user',
    objective: 'Agent must call create_user and not delete users.',
    requiredToolCalls: ['create_user'],
    forbiddenToolCalls: ['delete_user'],
    argumentAssertions: [],
    maxToolCalls: null,
    ...overrides
});

describe('validateTranscript — shape validation', () => {
    test('rejects non-object', () => {
        expect(validateTranscript('x').ok).toBe(false);
        expect(validateTranscript(null).ok).toBe(false);
    });
    test('rejects empty toolCalls', () => {
        const r = validateTranscript({ toolCalls: [] });
        expect(r.ok).toBe(false);
    });
    test('rejects missing toolName', () => {
        const r = validateTranscript({ toolCalls: [{ arguments: {} }] });
        expect(r.ok).toBe(false);
        expect(r.message).toMatch(/toolName/);
    });
    test('rejects bad timestamp', () => {
        const r = validateTranscript({ toolCalls: [{ toolName: 'get_user', arguments: {}, timestamp: 'not-a-date' }] });
        expect(r.ok).toBe(false);
        expect(r.message).toMatch(/timestamp/);
    });
    test('accepts and normalizes a valid transcript', () => {
        const r = validateTranscript({ agentName: 'a', toolCalls: [{ toolName: ' get_user ', arguments: { id: 1 } }] });
        expect(r.ok).toBe(true);
        expect(r.normalized.toolCalls[0].toolName).toBe('get_user');
        expect(r.normalized.toolCalls[0].arguments).toEqual({ id: 1 });
    });
    test('defaults missing arguments to {}', () => {
        const r = validateTranscript({ toolCalls: [{ toolName: 'get_user' }] });
        expect(r.ok).toBe(true);
        expect(r.normalized.toolCalls[0].arguments).toEqual({});
    });
});

describe('scoreScenario — fail rules', () => {
    test('fails on unknown tool', () => {
        const t = baseTranscript([{ toolName: 'get_user', arguments: {} }, { toolName: 'nope', arguments: {} }]);
        const r = scoreScenario(scenario(), validateTranscript(t).normalized, ALLOWED);
        expect(r.status).toBe('failed');
        expect(r.violations.some((v) => v.kind === 'unknown_tool')).toBe(true);
    });
    test('fails on forbidden tool called', () => {
        const t = baseTranscript([{ toolName: 'create_user', arguments: {} }, { toolName: 'delete_user', arguments: {} }]);
        const r = scoreScenario(scenario(), validateTranscript(t).normalized, ALLOWED);
        expect(r.violations.some((v) => v.kind === 'forbidden_tool')).toBe(true);
    });
    test('fails on required tool not called', () => {
        const t = baseTranscript([{ toolName: 'get_user', arguments: {} }]);
        const r = scoreScenario(scenario(), validateTranscript(t).normalized, ALLOWED);
        expect(r.violations.some((v) => v.kind === 'required_tool_missing')).toBe(true);
    });
    test('fails on exceeded maxToolCalls', () => {
        const t = baseTranscript([
            { toolName: 'create_user', arguments: {} },
            { toolName: 'get_user', arguments: {} },
            { toolName: 'get_user', arguments: {} }
        ]);
        const r = scoreScenario(scenario({ maxToolCalls: 2 }), validateTranscript(t).normalized, ALLOWED);
        expect(r.violations.some((v) => v.kind === 'max_tool_calls')).toBe(true);
    });
});

describe('scoreScenario — argument assertions', () => {
    const s = scenario({
        requiredToolCalls: ['create_user'],
        argumentAssertions: [{ toolName: 'create_user', path: 'email', operator: 'contains', expected: '@example.com' }]
    });
    test('passes assertion when value contains expected', () => {
        const t = baseTranscript([{ toolName: 'create_user', arguments: { email: 'a@example.com' } }]);
        const r = scoreScenario(s, validateTranscript(t).normalized, ALLOWED);
        expect(r.status).toBe('passed');
    });
    test('fails assertion when value missing expected substring', () => {
        const t = baseTranscript([{ toolName: 'create_user', arguments: { email: 'a@other.com' } }]);
        const r = scoreScenario(s, validateTranscript(t).normalized, ALLOWED);
        expect(r.violations.some((v) => v.kind === 'assertion')).toBe(true);
    });
    test('exists/notExists operators', () => {
        const s2 = scenario({
            requiredToolCalls: ['create_user'],
            argumentAssertions: [
                { toolName: 'create_user', path: 'name', operator: 'exists', expected: '' },
                { toolName: 'create_user', path: 'password', operator: 'notExists', expected: '' }
            ]
        });
        const t = baseTranscript([{ toolName: 'create_user', arguments: { name: 'x' } }]);
        const r = scoreScenario(s2, validateTranscript(t).normalized, ALLOWED);
        expect(r.status).toBe('passed');
    });
    test('fails when target tool not called for assertion', () => {
        const s3 = scenario({
            requiredToolCalls: [],
            argumentAssertions: [{ toolName: 'create_user', path: 'x', operator: 'exists', expected: '' }]
        });
        const t = baseTranscript([{ toolName: 'get_user', arguments: {} }]);
        const r = scoreScenario(s3, validateTranscript(t).normalized, ALLOWED);
        expect(r.violations.some((v) => v.kind === 'assertion')).toBe(true);
    });
});

describe('scoreScenario — happy path', () => {
    test('passes with required called, forbidden avoided, under max', () => {
        const t = baseTranscript([{ toolName: 'create_user', arguments: { name: 'x' } }]);
        const r = scoreScenario(scenario({ maxToolCalls: 5 }), validateTranscript(t).normalized, ALLOWED);
        expect(r.status).toBe('passed');
        expect(r.score).toMatch(/\d+\/\d+/);
    });
});

describe('scoreSuite', () => {
    test('suite passes only when every scenario passes', () => {
        const scenarios = [
            scenario({ _id: 's1', requiredToolCalls: ['create_user'], forbiddenToolCalls: ['delete_user'] }),
            scenario({ _id: 's2', requiredToolCalls: ['get_user'], forbiddenToolCalls: [] })
        ];
        const t = baseTranscript([{ toolName: 'create_user', arguments: {} }, { toolName: 'get_user', arguments: {} }]);
        const r = scoreSuite(scenarios, validateTranscript(t).normalized, ALLOWED);
        expect(r.status).toBe('passed');
        expect(r.scenarioResults).toHaveLength(2);
    });
    test('suite fails if any scenario fails', () => {
        const scenarios = [
            scenario({ _id: 's1', requiredToolCalls: ['create_user'] }),
            scenario({ _id: 's2', requiredToolCalls: ['delete_user'] })
        ];
        const t = baseTranscript([{ toolName: 'create_user', arguments: {} }]);
        const r = scoreSuite(scenarios, validateTranscript(t).normalized, ALLOWED);
        expect(r.status).toBe('failed');
        expect(r.score).toBe('1/2');
    });
    test('empty suite fails (no scenarios to pass)', () => {
        const r = scoreSuite([], validateTranscript(baseTranscript([{ toolName: 'get_user', arguments: {} }])).normalized, ALLOWED);
        expect(r.status).toBe('failed');
    });
});

describe('redactTranscript', () => {
    test('replaces sensitive argument values with placeholder', () => {
        const t = baseTranscript([
            { toolName: 'create_user', arguments: { email: 'a@example.com', token: 'supersecret', nested: { password: 'p' } } }
        ]);
        const redacted = redactTranscript(validateTranscript(t).normalized);
        const parsed = JSON.parse(redacted);
        expect(parsed.toolCalls[0].arguments.token).toBe('{{ASYNCAPI_SECRET}}');
        expect(parsed.toolCalls[0].arguments.nested.password).toBe('{{ASYNCAPI_SECRET}}');
        expect(parsed.toolCalls[0].arguments.email).toBe('a@example.com');
    });
});
describe('summarizeRunResult — UI render decision', () => {
    test('maps a passing run to a passing summary with no violations', () => {
        const run = { status: 'passed', score: '3/3', violations: [], scenarioResults: [
            { scenarioId: 'a', name: 'S1', status: 'passed', score: '1/1' }
        ] };
        const s = summarizeRunResult(run);
        expect(s.status).toBe('passed');
        expect(s.score).toBe('3/3');
        expect(s.violationCount).toBe(0);
        expect(s.scenarioRows).toHaveLength(1);
        expect(s.scenarioRows[0].status).toBe('passed');
    });
    test('maps a failing run with violations', () => {
        const run = { status: 'failed', score: '1/2', violations: [
            { kind: 'forbidden_tool', toolName: 'delete_user', message: 'Forbidden tool called' }
        ], scenarioResults: [
            { scenarioId: 'a', name: 'S1', status: 'passed', score: '1/1' },
            { scenarioId: 'b', name: 'S2', status: 'failed', score: '0/1' }
        ] };
        const s = summarizeRunResult(run);
        expect(s.status).toBe('failed');
        expect(s.violationCount).toBe(1);
        expect(s.violations[0]).toEqual({ kind: 'forbidden_tool', toolName: 'delete_user', message: 'Forbidden tool called' });
        expect(s.scenarioRows).toHaveLength(2);
        expect(s.scenarioRows[1].status).toBe('failed');
    });
    test('treats undefined run as failed with zero counts', () => {
        const s = summarizeRunResult(undefined);
        expect(s.status).toBe('failed');
        expect(s.violationCount).toBe(0);
        expect(s.scenarioRows).toEqual([]);
    });
});
