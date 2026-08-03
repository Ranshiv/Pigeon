const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');
const { redactSensitiveValues, redactBody, isSensitiveKey, truncate } = require('./AsyncApiRedact');
const collectionMcpServer = require('./CollectionMcpServerService');

// Keep grounding compact enough for hosted inference to answer reliably.
const MAX_CONTEXT_CHARS = Math.max(4000, Number(process.env.PIGEON_COPILOT_MAX_CONTEXT_CHARS) || 10000);
const ACTION_TTL_MS = 10 * 60 * 1000;
const MCP_RESULT_LIMIT = 12000;
const ACTION_KINDS = new Set(['create_request', 'update_request', 'delete_request', 'run_request', 'update_documentation', 'mcp_call']);
const requestIdOf = (request) => String(request?._id || request?.id || request?.requestId || '');
const newRequestId = () => `req-${crypto.randomUUID()}`;

const asId = (value) => (ObjectId.isValid(String(value)) ? new ObjectId(String(value)) : null);
const userVariants = (user) => {
    const value = String(user?.id || user?._id || '');
    return ObjectId.isValid(value) ? [value, new ObjectId(value)] : value ? [value] : [];
};
const cleanValue = (value) => redactSensitiveValues(value && typeof value.toObject === 'function' ? value.toObject() : value);
const redactText = (value, limit = 12000) => truncate(String(value || '')
    .replace(/(authorization\s*[:=]\s*)(?:Bearer\s+)?([^\s,;]+)/gi, '$1[REDACTED]')
    .replace(/((?:api[-_ ]?key|access[-_ ]?token|refresh[-_ ]?token|password|secret|credential)\s*[:=]\s*)([^\s,;]+)/gi, '$1[REDACTED]'), limit);

function mcpResultForDisplay(result) {
    const value = result && typeof result === 'object' ? result : {};
    const output = { status: value.status, statusText: value.statusText || '' };
    const body = String(value.body || '');
    if (!body) return output;
    if (/^\s*<!doctype\s+html|^\s*<html[\s>]/i.test(body)) {
        const title = body.match(/<title[^>]*>\s*([^<]{1,160})\s*<\/title>/i)?.[1]?.trim();
        output.body = `Received an HTML document${title ? ` titled “${title}”` : ''}, not an API response. Update this MCP request to use the API endpoint rather than a web page.`;
        return output;
    }
    try {
        output.body = truncate(JSON.stringify(redactSensitiveValues(JSON.parse(body)), null, 2), MCP_RESULT_LIMIT);
    } catch (_) {
        output.body = redactText(body, MCP_RESULT_LIMIT);
    }
    if (body.length > MCP_RESULT_LIMIT) output.truncated = true;
    return output;
}

async function loadCollection(collectionId, user, requiredRole = 'viewer') {
    const id = asId(collectionId);
    if (!id) return null;
    const roles = requiredRole === 'viewer' ? ['viewer', 'editor', 'admin'] : ['editor', 'admin'];
    const userIds = userVariants(user);
    return getDb().collection('collections').findOne({
        _id: id,
        $or: [
            { owner: { $in: userIds } },
            { userId: { $in: userIds } },
            { collaborators: { $elemMatch: { userId: { $in: userIds }, role: { $in: roles } } } }
        ]
    });
}

async function loadWorkspaceGlobals(workspaceId, user) {
    const id = asId(workspaceId);
    if (!id) return [];
    // Access to this workspace is inherited from the already-authorized
    // collection source. This also supports older workspace records whose
    // owner/member fields use a different ID representation.
    const workspace = await getDb().collection('workspaces').findOne({
        _id: id,
    }, { projection: { globalVariables: 1 } });
    return workspace?.globalVariables || [];
}

function contextVariable(variable) {
    const key = variable?.key || '';
    return {
        key,
        // Secrets and conventional secret-bearing names are never sent to the model.
        value: variable?.isSecret || isSensitiveKey(key) ? '[REDACTED]' : variable?.value,
        description: variable?.description || '',
        type: variable?.type || 'string'
    };
}

function collectionContext(collection, globalVariables = [], documentation = null, prompt = '', budget = MAX_CONTEXT_CHARS) {
    const documentationIntent = /documentation|update_documentation|authentication section|docs?\b/i.test(prompt);
    const requestIntent = /create_request|update_request|delete_request|request named|endpoint/i.test(prompt);
    const mcpIntent = /\b(?:mcp_call|mcp|tools?)\b/i.test(prompt);
    const requests = (collection.requests || []).map((request) => ({
        id: requestIdOf(request), name: request.name, method: request.method,
        url: truncate(request.url || '', 300), description: truncate(request.description || '', 180), protocol: request.protocol || 'http',
        headers: documentationIntent ? [] : (request.headers || []).slice(0, 12).map(({ name, key, value, enabled }) => ({ name: name || key, value: isSensitiveKey(name || key) ? '[REDACTED]' : truncate(value || '', 160), enabled }))
    }));
    const sourceDocumentation = documentation || collection.documentation || {};
    const data = cleanValue({
        name: collection.name,
        description: truncate(collection.description || '', 500),
        globalVariables: globalVariables.slice(0, 50).map(contextVariable),
        variables: (collection.variables || []).slice(0, 50).map(contextVariable),
        requestCount: requests.length,
        requests: requests.slice(0, documentationIntent ? 8 : requestIntent ? 40 : 24),
        // Tool names and their declared argument shape are the only grounding
        // the model has for an mcp_call proposal; without them it invents one.
        mcpTools: mcpIntent ? collectionMcpServer.buildToolCatalog(collection).slice(0, 24).map(({ tool }) => ({
            name: tool.name, description: truncate(tool.description || '', 180),
            params: Object.keys(tool.inputSchema?.properties?.params?.properties || {}),
            acceptsBody: Boolean(tool.inputSchema?.properties?.body)
        })) : [],
        documentation: {
            title: sourceDocumentation.title || '',
            content: redactText(redactBody(sourceDocumentation.content || '', documentationIntent ? 5500 : requestIntent ? 800 : 2500), documentationIntent ? 5500 : requestIntent ? 800 : 2500)
        }
    });
    let text = JSON.stringify(data);
    while (text.length > budget && data.requests.length > 1) {
        data.requests.pop();
        text = JSON.stringify(data);
    }
    if (text.length > budget && data.documentation.content) {
        data.documentation.content = truncate(data.documentation.content, Math.max(300, data.documentation.content.length - (text.length - budget) - 100));
        text = JSON.stringify(data);
    }
    if (text.length > budget) {
        data.requests = data.requests.map(({ id, name, method, url, protocol }) => ({ id, name, method, url, protocol }));
        text = JSON.stringify(data);
    }
    if (text.length > budget) {
        data.globalVariables = data.globalVariables.map(({ key, type }) => ({ key, type }));
        data.variables = data.variables.map(({ key, type }) => ({ key, type }));
        text = JSON.stringify(data);
    }
    return {
        id: String(collection._id), type: 'collection', label: collection.name, workspaceId: collection.workspaceId ? String(collection.workspaceId) : null,
        text
    };
}

async function buildContext(sources, user, prompt = '') {
    // Context is optional for workspace-level guidance. Collection sources add
    // private, resource-specific grounding only when the user selects them.
    if (!Array.isArray(sources) || !sources.length) return [];
    const selectedSources = sources.slice(0, 8).filter((source) => source?.type === 'collection');
    const perSourceBudget = Math.max(2000, Math.floor(MAX_CONTEXT_CHARS / Math.max(1, selectedSources.length)));
    const items = [];
    for (const source of selectedSources) {
        if (source?.type !== 'collection') continue;
        const collection = await loadCollection(source.id, user, 'viewer');
        if (!collection) throw new Error('One or more selected context sources are unavailable.');
        const globalVariables = await loadWorkspaceGlobals(collection.workspaceId, user);
        const documentation = await getDb().collection('documentation').findOne({ collectionId: String(collection._id) });
        items.push(collectionContext(collection, globalVariables, documentation, prompt, perSourceBudget));
    }
    if (!items.length) throw new Error('One or more selected context sources are unavailable.');
    return items.filter((item) => item.text);
}

function pageMessage(activePage) {
    const title = redactText(String(activePage?.title || '')).trim();
    if (!title) return [];
    const path = redactText(String(activePage?.path || '')).trim();
    return [{ role: 'system', content: `The user is currently viewing the Pigeon page "${title}"${path ? ` (${path})` : ''}. This page, not any earlier one in the conversation, is what "this", "here", and "what am I looking at" refer to. Any selected evidence source below belongs to this page; if none is selected, describe the page itself rather than a resource from an earlier turn.` }];
}

function modelMessages(history, context, prompt, activePage) {
    const catalog = Array.from(ACTION_KINDS).join(', ');
    return [
        { role: 'system', content: `You are Pigeon Copilot for API engineering and incident diagnosis. Use only supplied, redacted context and cite its exact source IDs. When an evidence fact directly supports the answer, include its evidenceId in the citation. Treat evidence with relation "confirmed" as stored linkage and relation "inferred" only as a correlation; state uncertainty plainly. Never reveal secrets, invent resources, or claim an action has executed. Return compact valid JSON only, without Markdown fences or explanatory text outside the JSON: {"answer":"string","citations":[{"type":"workspace|collection|request|history|governance|trace|test_run|incident|alert|monitor|analytics","id":"...","label":"...","evidenceId":"optional exact evidence id"}],"actions":[{"kind":"one of: ${catalog}","payload":{},"preview":"short human-readable description"}]}. Answer diagnostic questions with the failure, strongest evidence, likely root causes labeled with uncertainty, and the next inspection steps. Actions are proposals only and are supported only for collection/request context. Never emit actions for questions, summaries, explanations, searches, or location queries; return an empty actions array unless the user explicitly asks to create, change, run, call, or delete something. Inspect existing documentation before proposing changes. Keep documentation action content focused and under 600 words and do not repeat unchanged sections. A selected collection ID, or the collectionId embedded in selected request context, is authoritative for collection actions. For update_documentation, payload must include collectionId, revised section content, and mode "merge"; use mode "replace" only when explicitly requested. For create_request, payload must include collectionId and request. For update_request, payload must include collectionId, the exact request id from selected context, and request. For delete_request, payload must include collectionId, the exact request id from selected context, and confirmationName. For mcp_call, copy a declared tool name exactly and use only declared argument keys. Omit actions when selected context lacks the target.` },
        // Past model replies are not trusted context; retaining only user prompts
        // prevents an accidental disclosure in a previous reply from being sent again.
        ...history.slice(-10, -1).filter((message) => message.role === 'user').map((message) => ({ role: message.role, content: redactText(message.content) })),
        ...pageMessage(activePage),
        { role: 'system', content: context.length ? `Selected, redacted evidence context:\n${context.map((item) => `SOURCE ${item.type}:${item.id} (${item.label})${item.origin ? ` [${item.origin}]` : ''}: ${item.text}`).join('\n\n')}` : 'No workspace context was selected. Provide general Pigeon guidance only; do not claim to know workspace-specific resources or results.' },
        { role: 'user', content: prompt }
    ];
}

function parseModelResult(raw, context) {
    const source = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    let parsed;
    try { parsed = JSON.parse(source); } catch {
        // Providers occasionally wrap valid JSON in prose. Recover only a
        // complete JSON object; never display malformed provider JSON to users.
        const start = source.indexOf('{');
        if (start >= 0) {
            let depth = 0;
            let inString = false;
            let escaped = false;
            for (let index = start; index < source.length; index += 1) {
                const character = source[index];
                if (inString) {
                    if (escaped) escaped = false;
                    else if (character === '\\') escaped = true;
                    else if (character === '"') inString = false;
                    continue;
                }
                if (character === '"') inString = true;
                else if (character === '{') depth += 1;
                else if (character === '}') {
                    depth -= 1;
                    if (depth === 0) {
                        try { parsed = JSON.parse(source.slice(start, index + 1)); } catch (_) { parsed = null; }
                        break;
                    }
                }
            }
        }
        if (!parsed) {
            const looksLikeProviderJson = /^\s*[{[]/.test(source) || /"(?:answer|actions|citations)"\s*:/.test(source);
            return { answer: looksLikeProviderJson ? 'I could not safely read that response. Please try again.' : source, citations: [], actions: [] };
        }
    }
    const validSources = new Map(context.map((item) => [`${item.type}:${item.id}`, item]));
    const citations = (Array.isArray(parsed.citations) ? parsed.citations : []).map((citation) => {
        const sourceItem = validSources.get(`${citation?.type}:${citation?.id}`);
        if (!sourceItem) return null;
        const evidence = citation?.evidenceId ? (sourceItem.evidence || []).find((item) => item.id === citation.evidenceId) : null;
        return {
            type: sourceItem.type,
            id: sourceItem.id,
            label: sourceItem.label,
            ...(evidence?.deepLink || sourceItem.deepLink ? { deepLink: evidence?.deepLink || sourceItem.deepLink } : {}),
            ...(evidence ? { evidenceId: evidence.id, relation: evidence.relation || '', confidenceReason: evidence.confidenceReason || '' } : {})
        };
    }).filter(Boolean);
    const actions = (Array.isArray(parsed.actions) ? parsed.actions : []).filter((action) => ACTION_KINDS.has(action?.kind) && action.payload && typeof action.payload === 'object').slice(0, 3);
    return { answer: String(parsed.answer || 'I could not produce an answer.').slice(0, 12000), citations, actions };
}

function actionRequestedForKind(kind, prompt) {
    const text = String(prompt || '').toLowerCase();
    const explicitlyProposes = /\b(?:propose|draft|prepare)\b/.test(text);
    const directlyRequests = (verbs) => new RegExp(`^(?:(?:i\\s+mean|i\\s+meant\\s+to|actually|instead)\\s+)?(?:please\\s+)?(?:(?:can|could|would)\\s+you\\s+)?(?:${verbs})\\b|\\b(?:i want you to|please)\\s+(?:${verbs})\\b`, 'i').test(text);
    switch (kind) {
        case 'update_documentation': return /\b(?:update_documentation|documentation|docs?|section)\b/.test(text) && (explicitlyProposes || directlyRequests('add|append|change|clean|consolidate|create|edit|fix|generate|improve|merge|provide|replace|review|rewrite|update|write'));
        case 'create_request': return /\b(?:create_request|request)\b/.test(text) && (explicitlyProposes || directlyRequests('add|create'));
        case 'update_request': return /\b(?:update_request|request)\b/.test(text) && (explicitlyProposes || directlyRequests('change|edit|rename|update'));
        case 'delete_request': return /\b(?:delete_request|request)\b/.test(text) && (explicitlyProposes || directlyRequests('delete|remove'));
        case 'run_request': return /\b(?:run_request|request)\b/.test(text) && (explicitlyProposes || directlyRequests('execute|run|send'));
        case 'mcp_call': return /\b(?:mcp_call|mcp|tool)\b/.test(text) && (explicitlyProposes || directlyRequests('call|execute|invoke|run'));
        default: return false;
    }
}

const hasActionIntent = (prompt) => Array.from(ACTION_KINDS).some((kind) => actionRequestedForKind(kind, prompt));
const isActionFollowUp = (prompt) => /^(?:do it(?: then)?|go ahead|proceed|apply (?:it|that)|make (?:it|that change)|yes[,. ]*(?:do it|proceed|apply it))[\s!.]*$/i.test(String(prompt || '').trim());

const COLLECTION_NAVIGATION = [
    { pattern: /\bapi\s+designer\b/i, label: 'API Designer' },
    { pattern: /\bdocumentation\b/i, label: 'Documentation' },
    { pattern: /\bsample\s+data\b/i, label: 'Sample Data' },
    { pattern: /\bvariables?\b/i, label: 'Variables' },
    { pattern: /\bmcp\s+server\b/i, label: 'MCP Server' },
    { pattern: /\bagent\s+evaluation\b/i, label: 'Agent Evaluation' },
    { pattern: /\bfuzz\s+testing\b/i, label: 'Fuzz Testing' },
    { pattern: /\bgit\s+sync\b/i, label: 'Git Sync' }
];

function appNavigationAnswer(prompt) {
    const text = String(prompt || '').trim();
    if (!/\b(?:where|find|locat|open|access|navigate|go to)\w*\b/i.test(text)) return null;
    const destination = COLLECTION_NAVIGATION.find(({ pattern }) => pattern.test(text));
    return destination ? `Open the collection, then select the ${destination.label} tab in the collection tab bar.` : null;
}

function resolveActionIntentPrompt(prompt, history = []) {
    if (!isActionFollowUp(prompt)) return String(prompt || '');
    const messages = Array.isArray(history) ? history : [];
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (message?.role !== 'user' || !hasActionIntent(message.content)) continue;
        // The confirmation refers to the proposal, not the original ask. Without
        // restating it the model re-derives a plan and often re-emits unchanged
        // sections, producing a merge that silently changes nothing.
        const proposal = messages.slice(index + 1).find((item) => item?.role === 'assistant')?.content;
        return [
            message.content,
            proposal ? `Your previous proposal, which the user is confirming: ${redactText(proposal, 2000)}` : '',
            `The user now explicitly confirms: ${prompt}. Emit the full content for every section that proposal adds or revises.`
        ].filter(Boolean).join('\n\n');
    }
    return String(prompt || '');
}

// Providers name the documentation field inconsistently (content, revisedContent,
// documentation_content, markdown, …), so match on the key suffix rather than an
// exhaustive list — a missed name silently drops the whole action.
const DOCUMENTATION_CONTENT_KEY = /(?:content|markdown|documentation|body|text|changes|update)$/i;

function documentationContentFromPayload(payload) {
    const candidate = (value) => {
        if (typeof value === 'string' && value.trim()) return value;
        if (value && typeof value === 'object' && typeof value.content === 'string' && value.content.trim()) return value.content;
        return '';
    };
    const direct = candidate(payload.content)
        || Object.keys(payload).filter((key) => DOCUMENTATION_CONTENT_KEY.test(key)).map((key) => candidate(payload[key])).find(Boolean);
    if (direct) return direct;
    const sections = Array.isArray(payload.sections) ? payload.sections : [payload.section, payload.authenticationSection, payload.authentication_section].filter(Boolean);
    const rendered = sections.map((section) => {
        if (typeof section === 'string') return section.trim();
        if (!section || typeof section !== 'object') return '';
        const title = section.title || section.heading || section.name || '';
        const body = section.content || section.body || section.text || section.description || '';
        if (typeof body !== 'string' || !body.trim()) return '';
        return title ? `## ${String(title).replace(/^#+\s*/, '').trim()}\n\n${body.trim()}` : body.trim();
    }).filter(Boolean);
    if (rendered.length) return rendered.join('\n\n');
    const body = payload.body || payload.text;
    if (typeof body === 'string' && body.trim()) {
        const title = payload.title || payload.heading;
        return title ? `## ${String(title).replace(/^#+\s*/, '').trim()}\n\n${body.trim()}` : body.trim();
    }
    return '';
}

function requestCandidatesFromContext(context, collectionId) {
    const source = context.find((item) => item?.type === 'collection' && String(item.id) === String(collectionId))
        || context.find((item) => item?.type === 'request' && contextCollectionId(item) === String(collectionId));
    if (!source?.text) return null;
    try {
        const parsed = JSON.parse(source.text);
        const resource = parsed.resource || parsed;
        if (source.type === 'request') return resource?.id ? [{ id: String(resource.id), name: String(resource.name || '') }] : null;
        if (!Array.isArray(resource.requests)) return null;
        return resource.requests
            .filter((request) => request?.name)
            .map((request) => ({ id: request?.id ? String(request.id) : '', name: String(request.name) }));
    } catch (_) {
        // The model context may be trimmed under an unusually small context
        // limit. In that case, leave validation to the secure executor.
        return null;
    }
}

const comparableRequestName = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

function requestNameFromPrompt(prompt) {
    const text = String(prompt || '');
    const quoted = text.match(/\b(?:find|update|rename|delete|remove|run|send)\s+(?:the\s+)?["“]([^"”]+)["”]\s+request\b/i);
    if (quoted) return quoted[1];
    const named = text.match(/\brequest\s+(?:named|called)\s+["“]?([^"”.\n]+?)["”]?(?=\s*(?:[.?!]|$|\b(?:in|from|for|to|and)\b))/i);
    if (named) return named[1];
    const natural = text.match(/\b(?:find|update|rename|delete|remove|run|send)\s+(?:the\s+)?(.+?)\s+request\b/i);
    return natural ? natural[1] : '';
}

function resolveRequestTarget(payload, candidates, prompt) {
    if (!Array.isArray(candidates)) return undefined;
    const values = [
        payload.requestId,
        payload.requestName,
        payload.targetRequestName,
        payload.target?.name,
        payload.request?.existingName,
        payload.request?.oldName,
        requestNameFromPrompt(prompt)
    ].filter((value) => typeof value === 'string' && value.trim());
    for (const value of values) {
        const exactId = candidates.find((request) => request.id && request.id === String(value));
        if (exactId) return exactId;
        const name = comparableRequestName(value);
        const matchingNames = candidates.filter((request) => comparableRequestName(request.name) === name);
        if (matchingNames.length === 1) return matchingNames[0];
    }
    return null;
}

function mcpToolsFromContext(context, collectionId) {
    const source = context.find((item) => item?.type === 'collection' && String(item.id) === String(collectionId));
    if (!source?.text) return null;
    try {
        const parsed = JSON.parse(source.text);
        const resource = parsed.resource || parsed;
        return Array.isArray(resource.mcpTools) ? resource.mcpTools.filter((tool) => tool?.name) : null;
    } catch (_) { return null; }
}

function contextCollectionId(item) {
    if (item?.type === 'collection') return String(item.id || '');
    if (item?.type !== 'request' || !item.text) return '';
    try {
        const parsed = JSON.parse(item.text);
        return String((parsed.resource || parsed).collectionId || '');
    } catch (_) { return ''; }
}

function normalizeActionProposal(proposal, context, prompt = '') {
    if (!proposal || !ACTION_KINDS.has(proposal.kind) || !proposal.payload || typeof proposal.payload !== 'object') return null;
    if (!actionRequestedForKind(proposal.kind, prompt)) return null;
    const selectedIds = [...new Set(context.map(contextCollectionId).filter(Boolean))];
    if (!selectedIds.length) return null;
    const payload = { ...proposal.payload };
    if (selectedIds.length === 1 && !selectedIds.includes(String(payload.collectionId || ''))) payload.collectionId = selectedIds[0];
    if (!selectedIds.includes(String(payload.collectionId || ''))) return null;
    if (proposal.kind === 'update_request' && !payload.request && payload.updates && typeof payload.updates === 'object') payload.request = payload.updates;
    if (['update_request', 'delete_request', 'run_request'].includes(proposal.kind)) {
        const target = resolveRequestTarget(payload, requestCandidatesFromContext(context, payload.collectionId), prompt);
        // Reject a proposal whose target cannot be grounded in the selected
        // collection. The route will retry once rather than show an approval
        // card that is guaranteed to fail when confirmed.
        if (target === null) return null;
        if (target?.name) payload.targetRequestName = target.name;
        if (proposal.kind === 'delete_request' && target?.name) payload.confirmationName = target.name;
        if (target?.id) payload.requestId = target.id;
        else if (target?.name) {
            // Legacy requests without an embedded ID can only be targeted by
            // an unambiguous exact name. The executor upgrades them on save.
            delete payload.requestId;
            payload.targetRequestName = target.name;
        }
    }
    if (proposal.kind === 'mcp_call') {
        const tools = mcpToolsFromContext(context, payload.collectionId);
        if (!tools?.length) return null;
        const tool = tools.find((entry) => entry.name === String(payload.toolName || ''));
        if (!tool) return null;
        if (payload.arguments === undefined || payload.arguments === null) payload.arguments = {};
        if (typeof payload.arguments !== 'object' || Array.isArray(payload.arguments)) return null;
        // Mirror the executor's allow-list so an approval card can never be
        // confirmed into a guaranteed argument-validation failure.
        const allowedKeys = new Set(['params', ...(tool.acceptsBody ? ['body'] : [])]);
        if (Object.keys(payload.arguments).some((key) => !allowedKeys.has(key))) return null;
        const params = payload.arguments.params;
        if (params !== undefined) {
            if (!params || typeof params !== 'object' || Array.isArray(params)) return null;
            const declared = new Set(Array.isArray(tool.params) ? tool.params : []);
            if (Object.keys(params).some((key) => !declared.has(key))) return null;
        }
    }
    if (proposal.kind === 'update_documentation') payload.content = documentationContentFromPayload(payload);
    if (proposal.kind === 'update_documentation') {
        if (typeof payload.content !== 'string' || !payload.content.trim()) return null;
        // Some providers double-escape newlines inside the JSON string, which
        // would otherwise render as literal \n in the saved Markdown.
        payload.content = payload.content.replace(/\\r\\n|\\n/g, '\n').replace(/\\t/g, '\t').trim();
        payload.mode = payload.mode === 'replace' ? 'replace' : 'merge';
    }
    return { ...proposal, payload };
}

const normalizeHeading = (value) => String(value || '').replace(/\s+#+\s*$/, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const placeholderSection = (body) => /\b(?:describe|list|add)\b[^.\n]*(?:here|used|required|details?)\b|\b(?:todo|tbd|placeholder)\b/i.test(String(body || ''));

function markdownSections(content) {
    const lines = String(content || '').replace(/\r\n/g, '\n').split('\n');
    const sections = [];
    let current = { key: null, heading: '', body: [] };
    let fence = null;
    const headingPath = [];
    const pushCurrent = () => {
        const body = current.body.join('\n').trim();
        if (current.heading || body) sections.push({ ...current, body });
    };
    for (const line of lines) {
        const fenceMatch = line.match(/^\s*(```+|~~~+)/);
        if (fenceMatch) fence = fence ? (line.trim().startsWith(fence) ? null : fence) : fenceMatch[1].slice(0, 3);
        const headingMatch = !fence && line.match(/^(#{1,6})\s+(.+?)\s*$/);
        if (headingMatch) {
            pushCurrent();
            const level = headingMatch[1].length;
            const title = headingMatch[2].replace(/\s+#+\s*$/, '').trim();
            const titleKey = normalizeHeading(title);
            headingPath[level - 1] = titleKey;
            headingPath.length = level;
            current = { key: level <= 2 ? titleKey : headingPath.join(' > '), heading: `${headingMatch[1]} ${title}`, body: [] };
        } else current.body.push(line);
    }
    pushCurrent();
    return sections;
}

function sectionScore(section) {
    const body = String(section?.body || '').trim();
    return body.length - (placeholderSection(body) ? 100000 : 0);
}

function dedupeMarkdownSections(sections) {
    const best = new Map();
    for (const section of sections) {
        if (!section.key) continue;
        if (!best.has(section.key) || sectionScore(section) > sectionScore(best.get(section.key))) best.set(section.key, section);
    }
    const emitted = new Set();
    return sections.filter((section) => {
        if (!section.key) return Boolean(section.body);
        if (emitted.has(section.key)) return false;
        emitted.add(section.key);
        return true;
    }).map((section) => section.key ? best.get(section.key) : section);
}

function renderMarkdownSections(sections) {
    return sections.map((section) => [section.heading, section.body].filter(Boolean).join('\n')).filter(Boolean).join('\n\n').trim();
}

function mergeDocumentationContent(existingContent, proposedContent) {
    const existing = String(existingContent || '').trim();
    const proposed = String(proposedContent || '').trim();
    if (!existing) return proposed;
    if (!proposed || existing.includes(proposed)) return renderMarkdownSections(dedupeMarkdownSections(markdownSections(existing)));
    const incomingSections = markdownSections(proposed);
    if (!incomingSections.some((section) => section.key)) return `${renderMarkdownSections(dedupeMarkdownSections(markdownSections(existing)))}\n\n${proposed}`.trim();
    const merged = dedupeMarkdownSections(markdownSections(existing));
    for (const incoming of dedupeMarkdownSections(incomingSections)) {
        if (!incoming.key) continue;
        const index = merged.findIndex((section) => section.key === incoming.key);
        if (index < 0) merged.push(incoming);
        else if (!placeholderSection(incoming.body) || placeholderSection(merged[index].body)) merged[index] = incoming;
    }
    return renderMarkdownSections(dedupeMarkdownSections(merged));
}

function proposalHash(kind, payload) { return crypto.createHash('sha256').update(JSON.stringify({ kind, payload })).digest('hex'); }
function actionExpiresAt() { return new Date(Date.now() + ACTION_TTL_MS); }
function actionPreview(kind, payload) {
    switch (kind) {
        case 'create_request': return `Create request “${redactText(payload?.request?.name, 120)}” in the selected collection.`;
        case 'update_request': return `Update request “${redactText(payload?.targetRequestName || payload?.requestId, 120)}” in the selected collection.`;
        case 'delete_request': return `Delete request “${redactText(payload?.targetRequestName || payload?.requestId, 120)}” from the selected collection.`;
        case 'update_documentation': return `${payload?.mode === 'replace' ? 'Replace' : 'Update'} the selected collection documentation with the proposed content.`;
        case 'mcp_call': return `Call MCP tool “${redactText(payload?.toolName, 120)}” using the shown arguments.`;
        case 'run_request': return `Run request ${String(payload?.requestId || '').slice(0, 24)} from the selected collection.`;
        default: return 'Perform the proposed Copilot action.';
    }
}

async function executeAction(action, user, typedConfirmation = '') {
    const payload = action.payload || {};
    const collection = await loadCollection(payload.collectionId, user, 'editor');
    if (!collection) throw new Error('You no longer have edit access to the action target.');
    const requests = collection.requests || [];
    const targetName = comparableRequestName(payload.targetRequestName);
    const requestIndex = requests.findIndex((request) => requestIdOf(request) === String(payload.requestId || ''));
    const targetRequestIndex = requestIndex >= 0 ? requestIndex : targetName
        ? requests.findIndex((request) => comparableRequestName(request.name) === targetName)
        : -1;
    if (action.kind === 'create_request') {
        if (!payload.request?.name || !payload.request?.url || !payload.request?.method) throw new Error('A new request needs a name, URL, and method.');
        collection.requests = requests;
        const request = cleanValue(payload.request);
        // Request IDs are assigned by the trusted executor so future Copilot
        // updates and deletions can always address the new request.
        request._id = newRequestId();
        collection.requests.push(request);
        await getDb().collection('collections').updateOne({ _id: collection._id }, { $set: { requests: collection.requests, updatedAt: new Date() } });
        return { message: 'Request created.', requestId: request._id };
    }
    if (action.kind === 'update_request') {
        if (targetRequestIndex < 0 || !payload.request || typeof payload.request !== 'object') throw new Error('The request to update was not found.');
        const existing = collection.requests[targetRequestIndex];
        collection.requests[targetRequestIndex] = { ...existing, ...cleanValue(payload.request), _id: requestIdOf(existing) || newRequestId() };
        await getDb().collection('collections').updateOne({ _id: collection._id }, { $set: { requests: collection.requests, updatedAt: new Date() } });
        return { message: 'Request updated.', requestId: collection.requests[targetRequestIndex]._id };
    }
    if (action.kind === 'delete_request') {
        const request = collection.requests?.[targetRequestIndex];
        if (!request) throw new Error('The request to delete was not found.');
        if (typedConfirmation !== String(request.name)) throw new Error('Type the exact request name to confirm deletion.');
        collection.requests.splice(targetRequestIndex, 1);
        await getDb().collection('collections').updateOne({ _id: collection._id }, { $set: { requests: collection.requests, updatedAt: new Date() } });
        return { message: 'Request deleted.' };
    }
    if (action.kind === 'update_documentation') {
        if (typeof payload.content !== 'string') throw new Error('Documentation content must be text.');
        const now = new Date();
        const collectionId = String(collection._id);
        const db = getDb();
        const existingDocumentation = await db.collection('documentation').findOne({ collectionId });
        const existingContent = existingDocumentation?.content || collection.documentation?.content || '';
        const nextContent = payload.mode === 'replace' || !existingContent.trim()
            ? payload.content
            : mergeDocumentationContent(existingContent, payload.content);
        if (nextContent === existingContent) throw new Error('The proposed content matches the current documentation, so nothing was changed.');
        const [collectionUpdate, documentationUpdate] = await Promise.all([
            db.collection('collections').updateOne(
                { _id: collection._id },
                { $set: { 'documentation.content': nextContent, 'documentation.lastModifiedAt': now, updatedAt: now } }
            ),
            db.collection('documentation').updateOne(
                { collectionId },
                {
                    $set: { content: nextContent, updatedAt: now, importedFrom: 'copilot' },
                    $setOnInsert: { title: `${collection.name} Documentation`, collectionId, createdAt: now, settings: {} }
                },
                { upsert: true }
            )
        ]);
        if (collectionUpdate.matchedCount !== 1 || (!documentationUpdate.matchedCount && !documentationUpdate.upsertedCount)) throw new Error('Documentation could not be saved.');
        if (nextContent !== existingContent) {
            await db.collection('documentationContentVersions').insertOne({
                collectionId,
                userId: String(user?.id || user?._id || ''),
                title: existingDocumentation?.title || `${collection.name} Documentation`,
                content: nextContent,
                message: 'Documentation updated by Copilot',
                timestamp: now,
                type: 'commit',
                importedFrom: 'copilot'
            });
        }
        return { message: 'Documentation updated.', collectionId, updatedAt: now, mode: payload.mode === 'replace' ? 'replace' : 'merge' };
    }
    if (action.kind === 'mcp_call') {
        const result = await collectionMcpServer.executeTool(collection, payload.toolName, payload.arguments || {});
        return { message: 'MCP tool completed.', result: mcpResultForDisplay(result) };
    }
    if (action.kind === 'run_request') throw new Error('Run-request proposals are shown in V1 but must be run from the request workspace until the secure executor is enabled.');
    throw new Error('This Copilot action is not supported.');
}

module.exports = { buildContext, loadCollection, modelMessages, pageMessage, parseModelResult, normalizeActionProposal, hasActionIntent, resolveActionIntentPrompt, appNavigationAnswer, mergeDocumentationContent, proposalHash, actionExpiresAt, actionPreview, redactText, executeAction };
