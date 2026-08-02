const crypto = require('crypto');
const dns = require('dns').promises;
const net = require('net');
const { isSensitiveKey } = require('./AsyncApiRedact');

const fetch = (...args) => import('node-fetch').then(({ default: nodeFetch }) => nodeFetch(...args));

const MCP_PROTOCOL_VERSION = '2025-03-26';
const RESPONSE_BODY_LIMIT = 1024 * 1024;
const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']);
const MAX_REDIRECTS = 5;

const getRequestId = (request) => String(request?._id || request?.id || '');

const toPlainValue = (value) => {
    if (value && typeof value.toObject === 'function') return value.toObject();
    return value;
};

const cloneValue = (value) => {
    if (value === undefined || value === null) return value;
    return JSON.parse(JSON.stringify(toPlainValue(value)));
};

const asString = (value) => value === undefined || value === null ? '' : String(value);

const resolveVariables = (value, variables) => {
    if (typeof value === 'string') {
        return value.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (match, rawKey) => {
            const key = rawKey.trim();
            return Object.prototype.hasOwnProperty.call(variables, key) ? asString(variables[key]) : match;
        });
    }
    if (Array.isArray(value)) return value.map((entry) => resolveVariables(entry, variables));
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, resolveVariables(entry, variables)]));
    }
    return value;
};

const getCollectionVariables = (collection) => (Array.isArray(collection?.variables) ? collection.variables : [])
    .filter((variable) => variable && variable.enabled !== false && variable.key)
    .reduce((variables, variable) => ({ ...variables, [String(variable.key)]: variable.value }), {});

const getConfig = (collection) => {
    const source = collection?.metadata?.mcpServer || {};
    return {
        enabled: source.enabled === true,
        name: asString(source.name).trim(),
        description: asString(source.description).trim(),
        requestIds: Array.isArray(source.requestIds) ? source.requestIds.map(String) : [],
        accessTokenHash: asString(source.accessTokenHash),
        tokenLastFour: asString(source.tokenLastFour),
        createdAt: source.createdAt || null,
        updatedAt: source.updatedAt || null,
        lastRotatedAt: source.lastRotatedAt || null
    };
};

const getEligibleRequests = (collection) => (Array.isArray(collection?.requests) ? collection.requests : [])
    .filter((request) => request && (request.protocol || 'http') === 'http' && HTTP_METHODS.has(String(request.method || 'GET').toUpperCase()) && request.url && getRequestId(request));

const safeRequestPath = (url) => {
    const withoutQuery = asString(url).split('?')[0];
    try {
        return new URL(withoutQuery).pathname || '/';
    } catch {
        return withoutQuery.replace(/^https?:\/\/[^/]+/i, '') || '/';
    }
};

const slugify = (value) => {
    const slug = asString(value)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 44);
    return slug || 'request';
};

const shortStableId = (value) => crypto.createHash('sha256').update(asString(value)).digest('hex').slice(0, 8);

const buildToolCatalog = (collection) => {
    const config = getConfig(collection);
    const selectedIds = new Set(config.requestIds);
    const requests = getEligibleRequests(collection).filter((request) => selectedIds.has(getRequestId(request)));
    const baseNameCount = requests.reduce((counts, request) => {
        const base = slugify(request.name);
        counts.set(base, (counts.get(base) || 0) + 1);
        return counts;
    }, new Map());

    const names = new Set();
    return requests.map((request) => {
        const base = slugify(request.name);
        let name = baseNameCount.get(base) > 1 ? `${base}_${shortStableId(getRequestId(request))}` : base;
        while (names.has(name)) name = `${base}_${shortStableId(`${getRequestId(request)}-${names.size}`)}`;
        names.add(name);

        const declaredParams = (Array.isArray(request.params) ? request.params : [])
            .filter((param) => param && param.enabled !== false && (param.key || param.name));
        const paramProperties = declaredParams.reduce((properties, param) => ({
            ...properties,
            [String(param.key || param.name)]: {
                type: ['string', 'number', 'boolean'],
                description: param.description || 'Optional query parameter.'
            }
        }), {});
        const bodyIsConfigured = request.bodyType && request.bodyType !== 'none';

        return {
            name,
            request,
            tool: {
                name,
                title: request.name || name,
                description: [request.description, `${request.method || 'GET'} ${safeRequestPath(request.url)}`].filter(Boolean).join('\n'),
                inputSchema: {
                    type: 'object',
                    properties: {
                        ...(Object.keys(paramProperties).length ? {
                            params: {
                                type: 'object',
                                properties: paramProperties,
                                additionalProperties: false,
                                description: 'Optional values for the request query parameters.'
                            }
                        } : {}),
                        ...(bodyIsConfigured ? {
                            body: {
                                description: 'Optional replacement request body. Use an object for JSON and form bodies, or a string for raw bodies.'
                            }
                        } : {})
                    },
                    additionalProperties: false
                }
            }
        };
    });
};

const hashAccessToken = (token) => crypto.createHash('sha256').update(asString(token)).digest('hex');

const createAccessToken = () => crypto.randomBytes(32).toString('base64url');

const matchesAccessToken = (token, storedHash) => {
    const expected = Buffer.from(asString(storedHash), 'utf8');
    const actual = Buffer.from(hashAccessToken(token), 'utf8');
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
};

const isPrivateIpv4 = (address) => {
    const parts = address.split('.').map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
    const [a, b] = parts;
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168);
};

const isPrivateAddress = (address) => {
    if (net.isIP(address) === 4) return isPrivateIpv4(address);
    if (net.isIP(address) === 6) {
        const normalized = address.toLowerCase();
        return normalized === '::' || normalized === '::1' || normalized.startsWith('fc') ||
            normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') ||
            normalized.startsWith('fea') || normalized.startsWith('feb') || normalized.startsWith('::ffff:127.') ||
            normalized.startsWith('::ffff:10.') || normalized.startsWith('::ffff:192.168.');
    }
    return true;
};

const assertSafeTargetUrl = async (value) => {
    let url;
    try {
        url = new URL(value);
    } catch {
        throw new Error('The saved request has an invalid URL.');
    }
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP and HTTPS collection requests can be exposed through MCP.');

    const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') ||
        (net.isIP(hostname) !== 0 && isPrivateAddress(hostname))) {
        throw new Error('Collection MCP servers cannot call private or local network addresses.');
    }

    let addresses;
    try {
        addresses = await dns.lookup(hostname, { all: true, verbatim: true });
    } catch {
        throw new Error('The saved request host could not be resolved.');
    }
    if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
        throw new Error('Collection MCP servers cannot call private or local network addresses.');
    }
    return url;
};

const hasUnresolvedVariables = (value) => /\{\{\s*[^{}]+?\s*\}\}/.test(asString(value));

const buildHeaders = (request, variables) => (Array.isArray(request.headers) ? request.headers : [])
    .filter((header) => header && header.enabled !== false && (header.name || header.key))
    .reduce((headers, header) => ({
        ...headers,
        [String(header.name || header.key)]: resolveVariables(asString(header.value), variables)
    }), {});

const hasHeader = (headers, name) => Object.keys(headers).some((key) => key.toLowerCase() === name.toLowerCase());

const applyStoredAuthentication = (url, headers, authConfig) => {
    const config = authConfig && typeof authConfig === 'object' ? authConfig : {};
    const nextHeaders = { ...headers };
    switch (config.type) {
        case 'Bearer Token':
            if (config.bearer?.token) nextHeaders.Authorization = `Bearer ${config.bearer.token}`;
            break;
        case 'Basic Auth':
            if (config.basic?.username && config.basic?.password) {
                nextHeaders.Authorization = `Basic ${Buffer.from(`${config.basic.username}:${config.basic.password}`).toString('base64')}`;
            }
            break;
        case 'API Key':
            if (config.apiKey?.key && config.apiKey?.value) {
                if (config.apiKey.location === 'query') url.searchParams.set(config.apiKey.key, config.apiKey.value);
                else nextHeaders[config.apiKey.key] = config.apiKey.value;
            }
            break;
        case 'OAuth 2.0':
            if (config.oauth2?.accessToken) nextHeaders.Authorization = `Bearer ${config.oauth2.accessToken}`;
            break;
        default:
            break;
    }
    return nextHeaders;
};

const buildBody = (request, argumentsValue, variables, headers) => {
    const bodyType = request.bodyType || 'none';
    const hasReplacement = Object.prototype.hasOwnProperty.call(argumentsValue || {}, 'body');
    if (bodyType === 'none') {
        if (hasReplacement) throw new Error('This MCP tool does not accept a request body.');
        return undefined;
    }

    const replacement = hasReplacement ? argumentsValue.body : resolveVariables(request.body || '', variables);
    if (bodyType === 'form-data') {
        const formValues = hasReplacement ? replacement : (Array.isArray(request.bodyFormData) ? request.bodyFormData
            .filter((field) => field && field.enabled !== false && field.key && field.type !== 'file')
            .reduce((values, field) => ({ ...values, [field.key]: resolveVariables(asString(field.value), variables) }), {}) : replacement);
        if (formValues === undefined || formValues === null || formValues === '') return undefined;
        if (Array.isArray(formValues) || typeof formValues !== 'object') {
            throw new Error('The tool body must be an object for a form-data request. File uploads are not supported.');
        }
        const form = new FormData();
        Object.entries(formValues).forEach(([key, value]) => form.append(key, asString(value)));
        Object.keys(headers).forEach((key) => {
            if (key.toLowerCase() === 'content-type') delete headers[key];
        });
        return form;
    }
    if (replacement === undefined || replacement === null || replacement === '') return undefined;

    if (bodyType === 'json') {
        if (!hasHeader(headers, 'content-type')) headers['Content-Type'] = 'application/json';
        return typeof replacement === 'string' ? replacement : JSON.stringify(replacement);
    }
    if (bodyType === 'x-www-form-urlencoded') {
        if (!hasHeader(headers, 'content-type')) headers['Content-Type'] = 'application/x-www-form-urlencoded';
        if (typeof replacement === 'string') return replacement;
        if (!replacement || Array.isArray(replacement) || typeof replacement !== 'object') throw new Error('The tool body must be an object for a URL-encoded request.');
        return new URLSearchParams(Object.entries(replacement).map(([key, value]) => [key, asString(value)])).toString();
    }
    return typeof replacement === 'string' ? replacement : JSON.stringify(replacement);
};

const readResponseText = async (response) => {
    const chunks = [];
    let size = 0;
    let truncated = false;
    try {
        for await (const chunk of response.body) {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            const remaining = RESPONSE_BODY_LIMIT - size;
            if (remaining <= 0) {
                truncated = true;
                response.body.destroy();
                break;
            }
            if (buffer.length > remaining) {
                chunks.push(buffer.subarray(0, remaining));
                size += remaining;
                truncated = true;
                response.body.destroy();
                break;
            }
            chunks.push(buffer);
            size += buffer.length;
        }
    } catch (error) {
        if (!truncated) throw error;
    }
    return `${Buffer.concat(chunks).toString('utf8')}${truncated ? '\n\n[Response body truncated at 1 MB]' : ''}`;
};

const executeTool = async (collection, toolName, argumentsValue = {}, transport = fetch) => {
    if (!argumentsValue || Array.isArray(argumentsValue) || typeof argumentsValue !== 'object') {
        throw new Error('Tool arguments must be a JSON object.');
    }
    const toolEntry = buildToolCatalog(collection).find((entry) => entry.name === toolName);
    if (!toolEntry) throw new Error('The requested MCP tool is not available.');

    const request = cloneValue(toolEntry.request);
    const bodyIsConfigured = request.bodyType && request.bodyType !== 'none';
    const allowedArgumentKeys = new Set(['params', ...(bodyIsConfigured ? ['body'] : [])]);
    if (Object.keys(argumentsValue).some((key) => !allowedArgumentKeys.has(key))) {
        throw new Error('Tool arguments include a field that is not supported by this request.');
    }
    const variables = getCollectionVariables(collection);
    const url = await assertSafeTargetUrl(resolveVariables(request.url, variables));
    if (hasUnresolvedVariables(url.toString())) throw new Error('The saved request has unresolved collection variables.');

    const allowedParams = new Set((Array.isArray(request.params) ? request.params : [])
        .filter((param) => param && param.enabled !== false && (param.key || param.name))
        .map((param) => String(param.key || param.name)));
    const requestedParams = argumentsValue.params || {};
    if (Array.isArray(requestedParams) || typeof requestedParams !== 'object') throw new Error('Tool params must be a JSON object.');
    Object.entries(requestedParams).forEach(([key, value]) => {
        if (!allowedParams.has(key)) throw new Error(`Query parameter '${key}' is not declared by this collection request.`);
        if (value === undefined || value === null) url.searchParams.delete(key);
        else url.searchParams.set(key, asString(value));
    });

    (Array.isArray(request.params) ? request.params : [])
        .filter((param) => param && param.enabled !== false && (param.key || param.name) && !Object.prototype.hasOwnProperty.call(requestedParams, param.key || param.name))
        .forEach((param) => url.searchParams.set(String(param.key || param.name), resolveVariables(asString(param.value), variables)));

    const headers = buildHeaders(request, variables);
    const resolvedAuthConfig = resolveVariables(cloneValue(request.authConfig || {}), variables);
    const finalHeaders = applyStoredAuthentication(url, headers, resolvedAuthConfig);
    const body = buildBody(request, argumentsValue, variables, finalHeaders);

    const method = String(request.method || 'GET').toUpperCase();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
        let target = url;
        let headersForHop = finalHeaders;
        // Redirects are followed manually so every hop passes the same SSRF
        // check as the first. Credentials are dropped on a cross-origin hop.
        for (let hop = 0; ; hop += 1) {
            const response = await transport(target.toString(), {
                method,
                headers: headersForHop,
                body: ['GET', 'HEAD'].includes(method) ? undefined : body,
                signal: controller.signal,
                redirect: 'manual'
            });
            const location = response.status >= 300 && response.status < 400 ? response.headers.get('location') : null;
            if (!location) {
                return { status: response.status, statusText: response.statusText, body: await readResponseText(response) };
            }
            if (hop >= MAX_REDIRECTS) throw new Error(`The upstream request redirected more than ${MAX_REDIRECTS} times.`);
            let next;
            try { next = new URL(location, target); } catch { throw new Error('The upstream request redirected to an invalid URL.'); }
            const validated = await assertSafeTargetUrl(next.toString());
            if (!['GET', 'HEAD'].includes(method)) {
                // A 307/308 keeps the method and body. We can replay it only
                // within the exact same origin, after validating the target,
                // so an upstream redirect cannot forward a write or credential
                // to another host. Method-changing redirects stay blocked.
                if (![307, 308].includes(response.status)) {
                    throw new Error('The upstream request redirected with a method-changing status. Update the saved MCP request to its final URL.');
                }
                if (validated.origin !== target.origin) {
                    throw new Error('The upstream request redirected to a different origin, which is not allowed for a collection MCP tool that sends a body.');
                }
            }
            if (validated.origin !== target.origin) {
                headersForHop = Object.fromEntries(Object.entries(headersForHop).filter(([key]) => key.toLowerCase() !== 'authorization' && !isSensitiveKey(key)));
            }
            target = validated;
        }
    } catch (error) {
        if (error.name === 'AbortError') throw new Error('The upstream request timed out after 30 seconds.');
        if (/redirect|private or local|could not be resolved|invalid URL|HTTP and HTTPS/.test(error.message || '')) throw error;
        throw new Error('The upstream request could not be completed.');
    } finally {
        clearTimeout(timeout);
    }
};

const publicConfig = (collection, endpoint) => {
    const config = getConfig(collection);
    return {
        enabled: config.enabled,
        name: config.name || `${collection?.name || 'Collection'} MCP Server`,
        description: config.description,
        requestIds: config.requestIds,
        hasAccessToken: Boolean(config.accessTokenHash),
        tokenLastFour: config.tokenLastFour,
        endpoint,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
        lastRotatedAt: config.lastRotatedAt
    };
};

module.exports = {
    MCP_PROTOCOL_VERSION,
    getConfig,
    getEligibleRequests,
    buildToolCatalog,
    createAccessToken,
    hashAccessToken,
    matchesAccessToken,
    executeTool,
    publicConfig
};
