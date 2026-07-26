// services/ConsumerContractRunner.js
// Executes contract interactions sequentially against a provider environment,
// reusing Pigeon's variable resolution and authentication infrastructure.
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const variableResolver = require('./VariableResolver');
const AuthenticationService = require('./AuthenticationService');
const { verifyInteraction } = require('./ConsumerContractVerifier');

const authService = new AuthenticationService();

const REQUEST_TIMEOUT_MS = 30000;
// Response bodies are stored per interaction per run; cap them so history
// documents stay well inside Mongo's 16 MB limit.
const MAX_STORED_BODY = 20000;

function truncate(text) {
    const str = typeof text === 'string' ? text : String(text ?? '');
    return str.length > MAX_STORED_BODY ? `${str.slice(0, MAX_STORED_BODY)}\n… [truncated]` : str;
}

function buildUrl(baseUrl, queryParams, resolve) {
    const url = resolve(baseUrl);
    const pairs = (queryParams || [])
        .filter((p) => p && p.enabled !== false && p.key)
        .map((p) => [resolve(p.key), resolve(p.value || '')]);
    if (pairs.length === 0) return url;

    const separator = url.includes('?') ? '&' : '?';
    const search = pairs
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
    return `${url}${separator}${search}`;
}

/**
 * Run every interaction of a contract in order.
 * @param {Object} contract - ConsumerContract document (or plain object)
 * @param {Object} options - { userId, workspaceId, environmentId, authConfig }
 * @returns {Promise<Object>} run summary + per-interaction results
 */
async function runContract(contract, options = {}) {
    const { userId, workspaceId, environmentId = null, authConfig = null } = options;
    const contextId = `contract-${contract._id || 'adhoc'}-${Date.now()}`;

    await variableResolver.createContext(contextId, {
        userId,
        workspaceId,
        environmentId,
        collectionId: contract.providerCollectionId ? String(contract.providerCollectionId) : null
    });

    const resolve = (value) => {
        if (typeof value !== 'string' || !value) return value || '';
        return variableResolver.replaceVariables(contextId, value);
    };

    const runStart = Date.now();
    const results = [];

    try {
        for (const interaction of contract.interactions || []) {
            results.push(await runInteraction(interaction, { resolve, authConfig }));
        }
    } finally {
        variableResolver.destroyContext(contextId);
    }

    const passedCount = results.filter((r) => r.passed).length;

    return {
        total: results.length,
        passedCount,
        failedCount: results.length - passedCount,
        durationMs: Date.now() - runStart,
        breaking: results.some((r) => r.breaking),
        status: results.some((r) => r.error) && passedCount === 0 && results.length > 0
            ? 'error'
            : (passedCount === results.length ? 'passed' : 'failed'),
        results
    };
}

async function runInteraction(interaction, { resolve, authConfig }) {
    const method = String(interaction.method || 'GET').toUpperCase();
    const base = {
        interactionName: interaction.name,
        method,
        url: '',
        tags: interaction.tags || [],
        expectedStatus: interaction.expectedStatus ?? null,
        expectedBody: truncate(interaction.expectedBody || '')
    };

    let url;
    try {
        url = buildUrl(interaction.url, interaction.queryParams, resolve);
        base.url = url;
    } catch (e) {
        return { ...base, passed: false, breaking: true, durationMs: 0, error: `Invalid URL: ${e.message}`, violations: [] };
    }

    const headers = {};
    (interaction.headers || [])
        .filter((h) => h && h.enabled !== false && h.key)
        .forEach((h) => { headers[resolve(h.key)] = resolve(h.value || ''); });

    const fetchOptions = { method, headers, timeout: REQUEST_TIMEOUT_MS };

    if (interaction.bodyType && interaction.bodyType !== 'none' && !['GET', 'HEAD'].includes(method)) {
        fetchOptions.body = resolve(interaction.body || '');
        const hasContentType = Object.keys(headers).some((h) => h.toLowerCase() === 'content-type');
        if (!hasContentType) {
            if (interaction.bodyType === 'json') headers['Content-Type'] = 'application/json';
            else if (interaction.bodyType === 'x-www-form-urlencoded') headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
    }

    let requestConfig = { url, method, headers, body: fetchOptions.body };
    if (authConfig && authConfig.type && authConfig.type !== 'No Auth') {
        try {
            requestConfig = await authService.applyAuthentication(requestConfig, authConfig);
            fetchOptions.headers = requestConfig.headers;
            if (requestConfig.agent) fetchOptions.agent = requestConfig.agent;
        } catch (authError) {
            return {
                ...base,
                passed: false,
                breaking: true,
                durationMs: 0,
                error: `Authentication failed: ${authError.message}`,
                violations: []
            };
        }
    }

    const start = Date.now();
    let response;
    let bodyText = '';
    try {
        response = await fetch(requestConfig.url || url, fetchOptions);
        bodyText = await response.text();
    } catch (e) {
        return {
            ...base,
            passed: false,
            breaking: true,
            durationMs: Date.now() - start,
            actualStatus: null,
            error: e.message || 'Request failed',
            violations: [{
                kind: 'transport',
                path: '',
                message: `Request failed: ${e.message || 'network error'}`,
                expected: `HTTP ${interaction.expectedStatus ?? ''}`.trim(),
                actual: 'no response',
                breaking: true
            }]
        };
    }

    const durationMs = Date.now() - start;
    const actualHeaders = {};
    response.headers.forEach((value, name) => { actualHeaders[name] = value; });

    const verdict = verifyInteraction(interaction, {
        status: response.status,
        headers: actualHeaders,
        body: bodyText,
        durationMs
    });

    return {
        ...base,
        passed: verdict.passed,
        breaking: verdict.breaking,
        durationMs,
        actualStatus: response.status,
        actualHeaders,
        actualBody: truncate(bodyText),
        violations: verdict.violations,
        error: null
    };
}

module.exports = { runContract };
