// services/EvaluationScorer.js
// Deterministic transcript scoring for collection-scoped AI-agent evaluation
// suites. Pure functions only — no I/O, no LLM, no external calls. V1 scores
// supplied tool-call transcripts against a suite's scenarios.
//
// The allowed API/tool contract is the collection's enabled MCP-server tool
// catalog (CollectionMcpServerService.buildToolCatalog) — a tool name not in
// the catalog is "unknown" and fails the scenario.

const { redactSensitiveValues } = require('./AsyncApiRedact');

const ASSERTION_OPERATORS = new Set(['equals', 'contains', 'exists', 'notExists']);

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const asString = (value) => {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try { return JSON.stringify(value); } catch { return String(value); }
};

const isValidIso8601 = (value) => {
    if (typeof value !== 'string' || !value) return false;
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime());
};

/**
 * Validate the supplied transcript shape.
 * @returns {{ ok: true, normalized: object } | { ok: false, message: string }}
 */
function validateTranscript(transcript) {
    if (!isPlainObject(transcript)) {
        return { ok: false, message: 'Transcript must be a JSON object.' };
    }
    if (transcript.agentName !== undefined && typeof transcript.agentName !== 'string') {
        return { ok: false, message: 'agentName must be a string when provided.' };
    }
    if (!Array.isArray(transcript.toolCalls)) {
        return { ok: false, message: 'toolCalls must be an array.' };
    }
    if (transcript.toolCalls.length === 0) {
        return { ok: false, message: 'toolCalls must contain at least one call.' };
    }
    for (let i = 0; i < transcript.toolCalls.length; i += 1) {
        const call = transcript.toolCalls[i];
        const at = `toolCalls[${i}]`;
        if (!isPlainObject(call)) return { ok: false, message: `${at} must be an object.` };
        if (typeof call.toolName !== 'string' || !call.toolName.trim()) {
            return { ok: false, message: `${at}.toolName must be a non-empty string.` };
        }
        if (call.arguments !== undefined && !isPlainObject(call.arguments)) {
            return { ok: false, message: `${at}.arguments must be an object when provided.` };
        }
        if (call.timestamp !== undefined && !isValidIso8601(call.timestamp)) {
            return { ok: false, message: `${at}.timestamp must be an ISO-8601 string when provided.` };
        }
    }

    const normalized = {
        agentName: typeof transcript.agentName === 'string' ? transcript.agentName : '',
        toolCalls: transcript.toolCalls.map((call) => ({
            toolName: String(call.toolName).trim(),
            arguments: isPlainObject(call.arguments) ? call.arguments : {},
            ...(call.timestamp !== undefined ? { timestamp: String(call.timestamp) } : {})
        }))
    };
    return { ok: true, normalized };
}

const getByPath = (obj, path) => {
    if (!path) return undefined;
    const segments = String(path).split('.').filter((segment) => segment.length);
    let node = obj;
    for (const segment of segments) {
        if (node === null || node === undefined) return undefined;
        node = node[segment];
    }
    return node;
};

const evalAssertion = (call, assertion) => {
    const actual = getByPath(call.arguments, assertion.path);
    const op = assertion.operator || 'equals';
    switch (op) {
        case 'exists':
            return actual !== undefined;
        case 'notExists':
            return actual === undefined;
        case 'contains':
            return asString(actual).includes(asString(assertion.expected));
        case 'equals':
            return asString(actual) === asString(assertion.expected);
        default:
            return false;
    }
};

/**
 * Score one scenario against a normalized transcript.
 * @param {object} scenario
 * @param {object} normalizedTranscript result of validateTranscript().normalized
 * @param {string[]} allowedToolNames catalog tool names
 * @returns {{ status: 'passed'|'failed', score: string, violations: object[], perRuleResults: object[] }}
 */
function scoreScenario(scenario, normalizedTranscript, allowedToolNames) {
    const allowed = new Set(allowedToolNames);
    const calls = Array.isArray(normalizedTranscript?.toolCalls) ? normalizedTranscript.toolCalls : [];
    const calledNames = calls.map((call) => call.toolName);
    const violations = [];
    const perRuleResults = [];

    const fail = (kind, toolName, message, extra = {}) => {
        violations.push({ kind, toolName, message, ...extra });
        perRuleResults.push({ rule: kind, passed: false, detail: message, ...extra });
    };
    const pass = (rule, detail) => perRuleResults.push({ rule, passed: true, detail });

    // 1. unknown tool — name not in catalog
    for (const call of calls) {
        if (!allowed.has(call.toolName)) {
            fail('unknown_tool', call.toolName, `Tool "${call.toolName}" is not in the collection's MCP tool catalog.`);
        }
    }

    // 2. forbidden tool called
    const forbidden = Array.isArray(scenario.forbiddenToolCalls) ? scenario.forbiddenToolCalls : [];
    for (const name of forbidden) {
        if (calledNames.includes(name)) {
            fail('forbidden_tool', name, `Forbidden tool "${name}" was called.`);
        } else {
            pass('forbidden_tool', `Forbidden tool "${name}" was not called.`);
        }
    }

    // 3. required tool not called
    const required = Array.isArray(scenario.requiredToolCalls) ? scenario.requiredToolCalls : [];
    for (const name of required) {
        if (!calledNames.includes(name)) {
            fail('required_tool_missing', name, `Required tool "${name}" was never called.`);
        } else {
            pass('required_tool_missing', `Required tool "${name}" was called.`);
        }
    }

    // 4. argument assertions
    const assertions = Array.isArray(scenario.argumentAssertions) ? scenario.argumentAssertions : [];
    for (const assertion of assertions) {
        const op = assertion.operator || 'equals';
        if (!ASSERTION_OPERATORS.has(op)) {
            fail('assertion', assertion.toolName || '', `Unknown assertion operator "${op}".`, { path: assertion.path, operator: op });
            continue;
        }
        const matchingCalls = calls.filter((call) => call.toolName === assertion.toolName);
        if (matchingCalls.length === 0) {
            fail('assertion', assertion.toolName || '', `No "${assertion.toolName}" call to assert "${assertion.path}".`, { path: assertion.path, operator: op, expected: asString(assertion.expected) });
            continue;
        }
        const anyPassed = matchingCalls.some((call) => evalAssertion(call, assertion));
        if (anyPassed) {
            pass('assertion', `Assertion "${assertion.path}" ${op} "${asString(assertion.expected)}" on "${assertion.toolName}" passed.`);
        } else {
            fail('assertion', assertion.toolName || '', `Assertion "${assertion.path}" ${op} "${asString(assertion.expected)}" on "${assertion.toolName}" failed.`, { path: assertion.path, operator: op, expected: asString(assertion.expected) });
        }
    }

    // 5. exceeds maxToolCalls
    if (typeof scenario.maxToolCalls === 'number' && Number.isFinite(scenario.maxToolCalls)) {
        if (calls.length > scenario.maxToolCalls) {
            fail('max_tool_calls', '', `Transcript made ${calls.length} tool calls; limit is ${scenario.maxToolCalls}.`, { actual: calls.length, limit: scenario.maxToolCalls });
        } else {
            pass('max_tool_calls', `${calls.length} of ${scenario.maxToolCalls} allowed tool calls.`);
        }
    }

    const passedCount = perRuleResults.filter((r) => r.passed).length;
    const status = violations.length === 0 ? 'passed' : 'failed';
    return { status, score: `${passedCount}/${perRuleResults.length}`, violations, perRuleResults };
}

/**
 * Score every enabled scenario of a suite.
 * @returns {{ status, score, scenarioResults: object[], suiteResult: object }}
 */
function scoreSuite(scenarios, normalizedTranscript, allowedToolNames) {
    const ordered = [...scenarios].sort((a, b) => (a.order || 0) - (b.order || 0));
    const scenarioResults = ordered.map((scenario) => ({
        scenarioId: String(scenario._id || scenario.id || ''),
        name: scenario.name,
        ...scoreScenario(scenario, normalizedTranscript, allowedToolNames)
    }));
    const passedScenarios = scenarioResults.filter((r) => r.status === 'passed').length;
    const status = scenarioResults.length > 0 && passedScenarios === scenarioResults.length ? 'passed' : 'failed';
    const suiteResult = {
        status,
        score: `${passedScenarios}/${scenarioResults.length}`,
        scenarioResults
    };
    return suiteResult;
}

/**
 * Pure render-decision helper for UI result rendering. Maps a scored run into
 * the rows the panel shows (status badge, violation list, per-scenario rows).
 * Kept in the scorer (not the React component) so it is unit-testable without
 * a DOM framework.
 */
function summarizeRunResult(run) {
    const status = run?.status === 'passed' ? 'passed' : run?.status === 'error' ? 'error' : 'failed';
    const score = run?.score || '0/0';
    const violations = Array.isArray(run?.violations) ? run.violations.map((v) => ({
        kind: v.kind,
        toolName: v.toolName || '',
        message: v.message || ''
    })) : [];
    const scenarioRows = Array.isArray(run?.scenarioResults) ? run.scenarioResults.map((s) => ({
        name: s.name || '',
        status: s.status === 'passed' ? 'passed' : 'failed',
        score: s.score || '0/0'
    })) : [];
    return { status, score, violationCount: violations.length, violations, scenarioRows };
}

/**
 * Redact sensitive values in each tool call's arguments. Returns a copy safe
 * to persist and return to clients.
 */
function redactTranscript(normalizedTranscript) {
    if (!normalizedTranscript) return '';
    const safe = {
        agentName: normalizedTranscript.agentName || '',
        toolCalls: (normalizedTranscript.toolCalls || []).map((call) => ({
            toolName: call.toolName,
            arguments: redactSensitiveValues(call.arguments || {}),
            ...(call.timestamp ? { timestamp: call.timestamp } : {})
        }))
    };
    try { return JSON.stringify(safe); } catch { return ''; }
}

module.exports = {
    ASSERTION_OPERATORS,
    validateTranscript,
    scoreScenario,
    scoreSuite,
    redactTranscript,
    summarizeRunResult
};