const { redactSensitiveValues, redactBody, truncate, isSensitiveKey } = require('./AsyncApiRedact');

const PATCH_FIELDS = new Set([
    'name', 'method', 'url', 'params', 'headers', 'authConfig', 'bodyType',
    'body', 'bodyFormData', 'variables', 'preRequestScript', 'tests', 'sslConfig'
]);
const METHODS = new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'GRAPHQL']);
const MAX_PROMPT = 3000;
const MAX_RESPONSE = 8000;
const MUTATION_VERBS = /\b(?:add|apply|build|change|complete|create|fill|generate|make|set|update|use)\b/i;

const safeText = (value, max = 1200) => truncate(String(value || ''), max);
const redactPlainText = (value, max = 6000) => safeText(value, max)
    .replace(/(authorization\s*[:=]\s*)(?:Bearer\s+)?[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/((?:api[-_ ]?key|access[-_ ]?token|refresh[-_ ]?token|password|secret|credential)\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]');

function containsRedacted(value) {
    if (typeof value === 'string') return value.includes('[REDACTED]');
    if (Array.isArray(value)) return value.some(containsRedacted);
    if (value && typeof value === 'object') return Object.values(value).some(containsRedacted);
    return false;
}

function containsUnsafeSecretPatch(field, value) {
    const placeholder = (candidate) => /^Bearer\s+\{\{[^}]+\}\}$|^\{\{[^}]+\}\}$/.test(String(candidate || '').trim());
    if (field === 'headers' && Array.isArray(value)) {
        return value.some((header) => isSensitiveKey(header?.key || header?.name) && !placeholder(header?.value));
    }
    if (field === 'authConfig' && value && typeof value === 'object') {
        const walk = (node, key = '') => {
            if (node && typeof node === 'object') return Object.entries(node).some(([childKey, childValue]) => walk(childValue, childKey));
            return isSensitiveKey(key) && node && !placeholder(node);
        };
        return walk(value);
    }
    return false;
}

function redactAuth(authConfig) {
    if (!authConfig || typeof authConfig !== 'object') return {};
    const result = redactSensitiveValues(authConfig);
    // These fields can be secret even when their names are abbreviated.
    for (const key of ['token', 'password', 'clientSecret', 'accessToken', 'refreshToken']) {
        if (Object.prototype.hasOwnProperty.call(result, key)) result[key] = '[REDACTED]';
    }
    return result;
}

function normalizeList(value, limit = 30) {
    if (!Array.isArray(value)) return [];
    return value.slice(0, limit).map((item) => redactSensitiveValues(item));
}

function redactRequest(request = {}) {
    const input = request && typeof request === 'object' ? request : {};
    return {
        name: safeText(input.name, 160),
        method: METHODS.has(String(input.method || '').toUpperCase()) ? String(input.method).toUpperCase() : 'GET',
        url: safeText(input.url, 1000),
        params: normalizeList(input.params),
        headers: normalizeList(input.headers).map((header) => {
            const next = { ...header };
            if (isSensitiveKey(next.key || next.name)) next.value = '[REDACTED]';
            return next;
        }),
        authConfig: redactAuth(input.authConfig),
        bodyType: safeText(input.bodyType, 40),
        body: redactPlainText(redactBody(input.body, 6000)),
        bodyFormData: normalizeList(input.bodyFormData),
        variables: normalizeList(input.variables).map((variable) => isSensitiveKey(variable?.key) ? { ...variable, value: '[REDACTED]' } : variable),
        preRequestScript: safeText(input.preRequestScript, 2500),
        tests: safeText(input.tests || input.testScript, 2500),
        sslConfig: redactSensitiveValues(input.sslConfig || {})
    };
}

function redactResponse(response) {
    if (!response || typeof response !== 'object') return null;
    return redactSensitiveValues({
        status: response.status,
        statusText: response.statusText,
        duration: response.duration,
        error: safeText(response.error, 1200),
        body: safeText(response.body || response.data, MAX_RESPONSE)
    });
}

function normalizeEditorRows(value, kind) {
    if (!Array.isArray(value)) return [];
    return value.filter((row) => row && typeof row === 'object').map((row) => ({
        ...row,
        enabled: row.enabled !== false,
        key: String(row.key ?? row.name ?? ''),
        value: typeof row.value === 'string' ? row.value : row.value == null ? '' : String(row.value),
        description: String(row.description || ''),
        ...(kind === 'variables' && row.type ? { type: row.type } : {})
    }));
}

function normalizeAuthConfig(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return {
        type: value.type || 'No Auth',
        bearer: { token: '', ...(value.bearer || {}) },
        basic: { username: '', password: '', ...(value.basic || {}) },
        apiKey: { key: '', value: '', location: 'header', ...(value.apiKey || {}) },
        oauth2: { grantType: 'authorization_code', clientId: '', clientSecret: '', authUrl: '', tokenUrl: '', scope: '', redirectUri: '', accessToken: '', refreshToken: '', tokenStatus: 'not_authenticated', ...(value.oauth2 || {}) }
    };
}

function normalizePatch(patch) {
    if (!patch || typeof patch !== 'object' || !PATCH_FIELDS.has(patch.field)) return null;
    const field = patch.field;
    let value = patch.value;
    if (['params', 'headers', 'bodyFormData', 'variables'].includes(field) && !Array.isArray(value)) return null;
    if (['params', 'headers', 'bodyFormData', 'variables'].includes(field)) value = normalizeEditorRows(value, field);
    if (field === 'authConfig') value = normalizeAuthConfig(value);
    if (field === 'method') {
        value = String(value || '').toUpperCase();
        if (!METHODS.has(value)) return null;
    }
    if (['name', 'url', 'bodyType', 'body', 'preRequestScript', 'tests'].includes(field) && typeof value !== 'string') return null;
    if (containsRedacted(value) || containsUnsafeSecretPatch(field, value)) return null;
    return {
        field,
        value: redactSensitiveValues(value),
        reason: safeText(patch.reason, 500),
        risk: ['authConfig', 'headers', 'body', 'preRequestScript', 'tests'].includes(field) ? 'review' : 'low'
    };
}

function patchFromField(field, value, reason) {
    return normalizePatch({ field, value, reason });
}

function shellTokens(value) {
    const tokens = [];
    const expression = /(?:[^\s"']+|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')+/g;
    for (const token of String(value || '').match(expression) || []) {
        tokens.push(token.replace(/^['"]|['"]$/g, '').replace(/\\(["'])/g, '$1'));
    }
    return tokens;
}

function parseCurl(prompt) {
    const tokens = shellTokens(prompt);
    if (!tokens.some((token) => /^curl(?:\.exe)?$/i.test(token))) return [];
    let method = 'GET'; let url = ''; let body = ''; const headers = [];
    for (let index = 0; index < tokens.length; index += 1) {
        const token = tokens[index];
        const next = tokens[index + 1];
        if (/^(?:-X|--request)$/i.test(token) && next) { method = next.toUpperCase(); index += 1; continue; }
        if (/^(?:-H|--header)$/i.test(token) && next) {
            const separator = next.indexOf(':');
            if (separator > 0) headers.push({ enabled: true, key: next.slice(0, separator).trim(), value: next.slice(separator + 1).trim(), description: '' });
            index += 1; continue;
        }
        if (/^(?:-d|--data|--data-raw|--data-binary)$/i.test(token) && next) { body = next; if (method === 'GET') method = 'POST'; index += 1; continue; }
        if (/^https?:\/\//i.test(token) && !url) url = token;
    }
    const patches = [];
    if (url) patches.push(patchFromField('url', url, 'Use the URL from the cURL command.'));
    if (METHODS.has(method)) patches.push(patchFromField('method', method, 'Use the method from the cURL command.'));
    if (headers.length) patches.push(patchFromField('headers', headers, 'Use the headers from the cURL command.'));
    if (body) {
        const contentType = headers.find((header) => /^content-type$/i.test(header.key))?.value || '';
        patches.push(patchFromField('bodyType', /application\/json/i.test(contentType) || /^[\[{]/.test(body.trim()) ? 'raw' : 'x-www-form-urlencoded', 'Use the request body from the cURL command.'));
        patches.push(patchFromField('body', body, 'Use the request body from the cURL command.'));
    }
    return patches.filter(Boolean);
}

function nameForUrl(url, method) {
    try {
        const parsed = new URL(url);
        const segment = parsed.pathname.split('/').filter(Boolean).pop() || parsed.hostname.replace(/^www\./, '');
        return `${method || 'GET'} ${segment.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())}`;
    } catch (_) { return ''; }
}

function parseNaturalLanguage(prompt) {
    const text = String(prompt || '').trim();
    if (!text || /\bcurl(?:\.exe)?\b/i.test(text)) return [];
    const patches = [];
    const method = text.match(/\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/i)?.[1]?.toUpperCase();
    const url = text.match(/https?:\/\/[^\s"'<>`]+/i)?.[0]?.replace(/[),.;!?]+$/, '') || explicitUrlIntent(text) || '';
    if (method && METHODS.has(method)) patches.push(patchFromField('method', method, 'Use the method requested by the user.'));
    if (url) patches.push(patchFromField('url', url, 'Use the URL requested by the user.'));
    if (url && /(create|make|build|generate|complete|request)/i.test(text)) {
        const generatedName = nameForUrl(url, method || 'GET');
        if (generatedName) patches.push(patchFromField('name', generatedName, 'Name the request from its method and endpoint.'));
    }
    const params = [];
    for (const match of text.matchAll(/\b([A-Za-z][\w.-]*)\s*=\s*([^,\s]+)/g)) {
        if (!['http', 'https'].includes(match[1].toLowerCase())) params.push({ enabled: true, key: match[1], value: match[2].replace(/[),.;!?]+$/, ''), description: '' });
    }
    if (params.length) patches.push(patchFromField('params', params, 'Add the query parameters requested by the user.'));
    return patches.filter(Boolean);
}

function deterministicPatches(prompt) {
    const curlPatches = parseCurl(prompt);
    return curlPatches.length ? curlPatches : parseNaturalLanguage(prompt);
}

function isMutationIntent(prompt) {
    return MUTATION_VERBS.test(String(prompt || '')) || /\bcurl(?:\.exe)?\b/i.test(String(prompt || ''));
}

function parseResult(raw) {
    const source = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    let parsed;
    try { parsed = JSON.parse(source); } catch (_) {
        const start = source.indexOf('{');
        const end = source.lastIndexOf('}');
        if (start >= 0 && end > start) {
            try { parsed = JSON.parse(source.slice(start, end + 1)); } catch (error) { parsed = null; }
        }
    }
    if (!parsed || typeof parsed !== 'object') {
        // Some NIM models occasionally ignore JSON mode and return a concise
        // natural-language answer. Preserve that answer instead of showing a
        // misleading empty recommendation state.
        if (source && !/^\s*[\[{]/.test(source)) {
            return { answer: safeText(source, 6000), warnings: [], diagnostics: [], suggestedTests: '', patches: [] };
        }
        throw new Error('The AI agent returned an unreadable response. Please try again.');
    }
    const envelope = parsed.result && typeof parsed.result === 'object' ? { ...parsed.result, ...parsed } : parsed;
    const answerCandidate = envelope.answer
        || envelope.response
        || envelope.text
        || envelope.content
        || (envelope.message && typeof envelope.message === 'object' ? envelope.message.content || envelope.message.text : envelope.message);
    const candidatePatches = Array.isArray(envelope.patches) ? envelope.patches
        : Array.isArray(envelope.changes) ? envelope.changes
            : Array.isArray(envelope.suggestions) ? envelope.suggestions
                : envelope.fields && typeof envelope.fields === 'object' ? Object.entries(envelope.fields).map(([field, value]) => ({ field, value, reason: 'Suggested by the Request Agent.' })) : [];
    const patches = candidatePatches.map((patch) => patch?.field ? patch : patch?.path ? { ...patch, field: String(patch.path).replace(/^\//, '') } : patch).map(normalizePatch).filter(Boolean).slice(0, 20);
    const answer = safeText(answerCandidate || (patches.length ? 'I prepared safe suggestions for this request draft.' : 'I could not identify a safe change to recommend.'), 6000);
    const safeAnswer = /\b(?:request|changes?)\s+(?:was|were)?\s*(?:created|saved|sent|updated|deleted)\b|\bsuccessfully\s+(?:created|saved|sent|updated|deleted)\b/i.test(answer)
        ? 'I prepared suggestions for this request draft. Nothing was saved, sent, or created.'
        : answer;
    return {
        answer: safeAnswer,
        warnings: Array.isArray(envelope.warnings) ? envelope.warnings.map((item) => safeText(item, 500)).slice(0, 12) : [],
        diagnostics: Array.isArray(envelope.diagnostics) ? envelope.diagnostics.map((item) => safeText(item, 800)).slice(0, 12) : [],
        suggestedTests: safeText(envelope.suggestedTests || envelope.tests, 3000),
        patches,
        rejectedPatchCount: Math.max(0, candidatePatches.length - patches.length)
    };
}

function explicitUrlIntent(prompt) {
    const text = String(prompt || '').trim();
    const asksForUrl = /\b(?:url|endpoint|base\s+url|address)\b/i.test(text)
        && /\b(?:set|change|replace|use|make|point|provide|give|switch|update)\b/i.test(text);
    if (!asksForUrl) return null;
    const literal = text.match(/https?:\/\/[^\s"'<>`]+/i)?.[0]?.replace(/[),.;!?]+$/, '');
    if (literal) return literal;
    // “Google URL” is an explicit request for the well-known public URL,
    // not a request to add a query parameter to the current endpoint.
    if (/\bgoogle(?:\.com)?\b/i.test(text) && !/\bapi\b/i.test(text)) return 'https://www.google.com';
    return '';
}

function enforceUrlIntent(result, prompt) {
    const targetUrl = explicitUrlIntent(prompt);
    if (targetUrl === null) return result;
    const patches = (result.patches || []).filter((patch) => patch.field !== 'params');
    if (!targetUrl) {
        return {
            ...result,
            patches,
            warnings: [...(result.warnings || []), 'Provide the exact destination URL before applying this change.'],
            diagnostics: [...(result.diagnostics || []), 'The agent did not infer a destination from the URL request.']
        };
    }
    const urlPatch = { field: 'url', value: targetUrl, reason: 'Set the request URL to the destination you specified.', risk: 'review' };
    return { ...result, patches: [urlPatch, ...patches.filter((patch) => patch.field !== 'url')] };
}

function buildMessages({ request, response, prompt, activeTab }) {
    const requestJson = JSON.stringify(redactRequest(request));
    const responseJson = JSON.stringify(redactResponse(response));
    return [
        {
            role: 'system',
            content: `You are Pigeon Request Agent, an API request builder inside a request editor. Use only the supplied redacted request and response. Never invent a successful execution, expose secrets, or claim that a request was saved or sent. If the user asks to create, complete, change, or add to a request, you MUST return one or more field patches, not only an explanation. Return valid JSON only: {"answer":"string","warnings":["string"],"diagnostics":["string"],"suggestedTests":"string","patches":[{"field":"allowed request field","value":"or array/object","reason":"string"}]}. Allowed patch fields: ${Array.from(PATCH_FIELDS).join(', ')}. Use exact user-supplied URLs and cURL values. Use params only for explicit query parameters; changing a destination must use the url field. Use patches for concrete changes and keep them minimal. Do not replace unrelated user work. If information is missing, explain what is missing. The user is viewing the ${safeText(activeTab, 40) || 'request'} tab.`
        },
        { role: 'system', content: `CURRENT REDACTED REQUEST:\n${requestJson}\n\nLAST REDACTED RESPONSE (may be null):\n${responseJson}` },
        { role: 'user', content: safeText(prompt, MAX_PROMPT) }
    ];
}

async function assist({ profile, nim, request, response, prompt, activeTab }) {
    if (!profile) throw new Error('The selected NVIDIA NIM profile is unavailable.');
    if (!String(prompt || '').trim()) throw new Error('Enter an instruction for the Request Agent.');
    const deterministic = deterministicPatches(prompt);
    const requestMessages = buildMessages({ request, response, prompt, activeTab });
    const askModel = async (messages) => {
        try { return parseResult(await nim.complete(profile, messages)); }
        catch (error) { return { answer: '', warnings: [], diagnostics: [error.message || 'The model response could not be parsed.'], suggestedTests: '', patches: [] }; }
    };
    let result = enforceUrlIntent(await askModel(requestMessages), prompt);
    if (isMutationIntent(prompt) && !result.patches.length && !deterministic.length) {
        const retryMessages = [...requestMessages, { role: 'system', content: 'Your previous response did not produce a valid patch. Return at least one valid patches entry now for the requested request-editor change.' }];
        result = enforceUrlIntent(await askModel(retryMessages), prompt);
    }
    const byField = new Map(result.patches.map((patch) => [patch.field, patch]));
    deterministic.forEach((patch) => byField.set(patch.field, patch));
    const patches = Array.from(byField.values());
    const needsClarification = isMutationIntent(prompt) && !patches.length;
    return {
        ...result,
        answer: needsClarification ? 'Tell me the destination URL, HTTP method, or paste a cURL command and I will fill the draft.' : result.answer,
        patches,
        appliedIntent: deterministic.length ? 'deterministic_request_build' : result.patches.length ? 'model_request_build' : 'advice',
        needsClarification,
        confidence: deterministic.length ? 'high' : patches.length ? 'medium' : 'low',
        requestSnapshot: redactRequest(request)
    };
}

module.exports = { PATCH_FIELDS, redactRequest, redactResponse, normalizePatch, parseCurl, parseNaturalLanguage, deterministicPatches, parseResult, buildMessages, explicitUrlIntent, enforceUrlIntent, assist };
