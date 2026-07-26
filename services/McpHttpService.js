const fetch = (...args) => import('node-fetch').then(({ default: nodeFetch }) => nodeFetch(...args));
const net = require('net');

const DEFAULT_PROTOCOL_VERSION = '2025-03-26';
const BLOCKED_HOSTS = new Set(['localhost', '0.0.0.0', '::1', '169.254.169.254', 'metadata.google.internal']);
const BLOCKED_HEADERS = new Set(['host', 'content-length', 'connection', 'mcp-session-id', 'mcp-protocol-version']);

const isPrivateIpAddress = (host) => {
    const address = host.replace(/^\[|\]$/g, '').toLowerCase();
    const ipVersion = net.isIP(address);
    if (!ipVersion) return false;

    if (ipVersion === 4) {
        const [first, second] = address.split('.').map(Number);
        return first === 0
            || first === 10
            || first === 127
            || first === 169 && second === 254
            || first === 172 && second >= 16 && second <= 31
            || first === 192 && second === 168
            || first === 100 && second >= 64 && second <= 127;
    }

    return address === '::1'
        || address === '::'
        || address.startsWith('fc')
        || address.startsWith('fd')
        || address.startsWith('fe8')
        || address.startsWith('fe9')
        || address.startsWith('fea')
        || address.startsWith('feb')
        || address.startsWith('::ffff:127.')
        || address.startsWith('::ffff:10.')
        || address.startsWith('::ffff:192.168.');
};

const parseMcpPayload = async (response) => {
    const text = await response.text();
    if (!text.trim()) return null;

    try {
        return JSON.parse(text);
    } catch {
        const dataLines = text.split(/\r?\n/)
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim())
            .filter(Boolean);
        if (!dataLines.length) throw new Error('MCP server returned a response that was not JSON or SSE data.');
        return JSON.parse(dataLines[dataLines.length - 1]);
    }
};

const validateServerUrl = (value) => {
    let parsed;
    try {
        parsed = new URL(value);
    } catch {
        throw new Error('Enter a valid MCP server URL.');
    }

    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) {
        throw new Error('MCP server URLs must use HTTP(S) and cannot contain embedded credentials.');
    }
    const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (BLOCKED_HOSTS.has(hostname) || hostname.endsWith('.localhost') || isPrivateIpAddress(hostname)) {
        throw new Error('Local and private-network MCP server addresses are not allowed through the remote connector.');
    }
    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
        throw new Error('Remote MCP servers must use HTTPS in production.');
    }
    return parsed.toString();
};

const sanitizeHeaders = (headers = {}) => Object.entries(headers).reduce((result, [name, value]) => {
    const normalizedName = String(name).trim();
    if (!normalizedName || BLOCKED_HEADERS.has(normalizedName.toLowerCase())) return result;
    result[normalizedName] = String(value);
    return result;
}, {});

const rpcError = (payload) => {
    if (payload?.error) return payload.error.message || 'The MCP server returned an error.';
    return null;
};

const sendMessage = async ({ url, headers, sessionId, protocolVersion = DEFAULT_PROTOCOL_VERSION, message }) => {
    const startedAt = Date.now();
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Accept: 'application/json, text/event-stream',
            'Content-Type': 'application/json',
            'MCP-Protocol-Version': protocolVersion,
            ...(sessionId ? { 'MCP-Session-Id': sessionId } : {}),
            ...sanitizeHeaders(headers)
        },
        body: JSON.stringify(message)
    });
    const payload = await parseMcpPayload(response);
    const trace = {
        method: message.method,
        params: message.params || {},
        status: response.status,
        durationMs: Date.now() - startedAt,
        response: payload
    };
    if (!response.ok) {
        const error = new Error(payload?.error?.message || `MCP server responded with HTTP ${response.status}.`);
        error.mcpTrace = trace;
        throw error;
    }
    const error = rpcError(payload);
    if (error) {
        const rpcFailure = new Error(error);
        rpcFailure.mcpTrace = trace;
        throw rpcFailure;
    }

    return {
        payload,
        sessionId: response.headers.get('mcp-session-id') || sessionId,
        protocolVersion: response.headers.get('mcp-protocol-version') || protocolVersion,
        trace
    };
};

const createRequest = (id, method, params) => ({ jsonrpc: '2.0', id, method, params });

const listCapability = async (connection, id, method, key) => {
    try {
        const result = await sendMessage({ ...connection, message: createRequest(id, method, {}) });
        return { items: result.payload?.result?.[key] || [], trace: result.trace };
    } catch (error) {
        return {
            items: [],
            trace: error.mcpTrace || { method, status: 'error', error: error.message || 'Capability discovery failed.' }
        };
    }
};

const connect = async ({ url, headers = {}, protocolVersion = DEFAULT_PROTOCOL_VERSION }) => {
    const serverUrl = validateServerUrl(url);
    const initialization = await sendMessage({
        url: serverUrl,
        headers,
        protocolVersion,
        message: createRequest(1, 'initialize', {
            protocolVersion,
            capabilities: {},
            clientInfo: { name: 'Pigeon MCP Workbench', version: '1.0.0' }
        })
    });

    const negotiatedVersion = initialization.payload?.result?.protocolVersion || initialization.protocolVersion;
    const connection = {
        url: serverUrl,
        headers,
        sessionId: initialization.sessionId,
        protocolVersion: negotiatedVersion
    };

    const initializedNotification = await sendMessage({
        ...connection,
        message: { jsonrpc: '2.0', method: 'notifications/initialized', params: {} }
    });

    const [tools, resources, prompts, resourceTemplates] = await Promise.all([
        listCapability(connection, 2, 'tools/list', 'tools'),
        listCapability(connection, 3, 'resources/list', 'resources'),
        listCapability(connection, 4, 'prompts/list', 'prompts'),
        listCapability(connection, 5, 'resources/templates/list', 'resourceTemplates')
    ]);

    return {
        connection: {
            url: serverUrl,
            sessionId: connection.sessionId,
            protocolVersion: negotiatedVersion,
            serverInfo: initialization.payload?.result?.serverInfo || {},
            capabilities: initialization.payload?.result?.capabilities || {}
        },
        catalog: {
            tools: tools.items,
            resources: resources.items,
            prompts: prompts.items,
            resourceTemplates: resourceTemplates.items
        },
        trace: {
            initialization: initialization.trace,
            initializedNotification: initializedNotification.trace,
            discovery: [tools.trace, resources.trace, prompts.trace, resourceTemplates.trace]
        }
    };
};

const callTool = async ({ url, headers = {}, sessionId, protocolVersion = DEFAULT_PROTOCOL_VERSION, name, arguments: toolArguments = {} }) => {
    const serverUrl = validateServerUrl(url);
    if (!name || typeof name !== 'string') throw new Error('A tool name is required.');
    if (!toolArguments || typeof toolArguments !== 'object' || Array.isArray(toolArguments)) {
        throw new Error('Tool arguments must be a JSON object.');
    }

    const result = await sendMessage({
        url: serverUrl,
        headers,
        sessionId,
        protocolVersion,
        message: createRequest(Date.now(), 'tools/call', { name, arguments: toolArguments })
    });

    return { result: result.payload?.result || {}, sessionId: result.sessionId, protocolVersion: result.protocolVersion, trace: result.trace };
};

const readResource = async ({ url, headers = {}, sessionId, protocolVersion = DEFAULT_PROTOCOL_VERSION, uri }) => {
    const serverUrl = validateServerUrl(url);
    if (!uri || typeof uri !== 'string') throw new Error('A resource URI is required.');

    const result = await sendMessage({
        url: serverUrl,
        headers,
        sessionId,
        protocolVersion,
        message: createRequest(Date.now(), 'resources/read', { uri })
    });

    return { result: result.payload?.result || {}, sessionId: result.sessionId, protocolVersion: result.protocolVersion, trace: result.trace };
};

const getPrompt = async ({ url, headers = {}, sessionId, protocolVersion = DEFAULT_PROTOCOL_VERSION, name, arguments: promptArguments = {} }) => {
    const serverUrl = validateServerUrl(url);
    if (!name || typeof name !== 'string') throw new Error('A prompt name is required.');
    if (!promptArguments || typeof promptArguments !== 'object' || Array.isArray(promptArguments)) {
        throw new Error('Prompt arguments must be a JSON object.');
    }

    const result = await sendMessage({
        url: serverUrl,
        headers,
        sessionId,
        protocolVersion,
        message: createRequest(Date.now(), 'prompts/get', { name, arguments: promptArguments })
    });

    return { result: result.payload?.result || {}, sessionId: result.sessionId, protocolVersion: result.protocolVersion, trace: result.trace };
};

module.exports = { connect, callTool, readResource, getPrompt, validateServerUrl };
