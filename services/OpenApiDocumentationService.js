const crypto = require('crypto');
const yaml = require('js-yaml');
const Ajv2020 = require('ajv/dist/2020');

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace', 'query']);
const SECRET_PATTERN = /(api[-_ ]?key|access[-_ ]?token|authorization|bearer|client[-_ ]?secret|private[-_ ]?key|password)\s*[:=]\s*["']?(?!\{\{|<|your-|example|redacted)([^\s"']{8,})/ig;
const exampleValidator = new Ajv2020({ strict: false, allErrors: true, validateFormats: false, allowUnionTypes: true });

class DocumentationInputError extends Error {
    constructor(message, code = 'INVALID_OPENAPI', statusCode = 400, diagnostics = []) {
        super(message);
        this.name = 'DocumentationInputError';
        this.code = code;
        this.statusCode = statusCode;
        this.diagnostics = diagnostics;
    }
}

const cleanText = (value, max = 12000) => String(value || '').replace(/\r\n/g, '\n').trim().slice(0, max);
const escapeCell = (value) => cleanText(value, 1000).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const slug = (value) => cleanText(value, 160).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'operation';
const sourceHash = (value) => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');

function normalizePastedSource(source) {
    const withoutBom = String(source).replace(/^\uFEFF/, '').replace(/^```(?:ya?ml|json)?\s*\r?\n/i, '').replace(/\r?\n```\s*$/i, '');
    const lines = withoutBom.split(/\r?\n/);
    const firstContentIndex = lines.findIndex((line) => line.trim());
    if (firstContentIndex === -1) return withoutBom;

    const firstIndent = lines[firstContentIndex].match(/^ */)[0].length;
    const followingIndents = lines.slice(firstContentIndex + 1)
        .filter((line) => line.trim())
        .map((line) => line.match(/^ */)[0].length);
    const accidentalIndent = followingIndents.length ? Math.min(...followingIndents) - firstIndent : 0;

    // Copying a code block from an indented Markdown list can leave line one
    // flush-left while every following line retains the list indentation.
    if (accidentalIndent <= 0) return withoutBom;
    return lines.map((line, index) => {
        if (index <= firstContentIndex || !line.trim()) return line;
        return line.slice(Math.min(accidentalIndent, line.match(/^ */)[0].length));
    }).join('\n');
}

function decodePointerPart(value) {
    return value.replace(/~1/g, '/').replace(/~0/g, '~');
}

function resolveLocalRef(spec, value, seen = new Set()) {
    if (!value || typeof value !== 'object' || !value.$ref || !String(value.$ref).startsWith('#/')) return value;
    if (seen.has(value.$ref)) return value;
    const target = String(value.$ref).slice(2).split('/').map(decodePointerPart).reduce((node, part) => node?.[part], spec);
    if (!target) return value;
    return { ...resolveLocalRef(spec, target, new Set([...seen, value.$ref])), ...Object.fromEntries(Object.entries(value).filter(([key]) => key !== '$ref')) };
}

function parseOpenApi(source, formatHint = '') {
    if (typeof source !== 'string' || !source.trim()) throw new DocumentationInputError('OpenAPI content is required.', 'CONTENT_REQUIRED');
    const normalizedSource = normalizePastedSource(source);
    let spec;
    try {
        const jsonFirst = /json/i.test(formatHint) || /^[\s\n]*[\[{]/.test(normalizedSource);
        spec = jsonFirst ? JSON.parse(normalizedSource) : yaml.load(normalizedSource, { schema: yaml.JSON_SCHEMA, json: true });
    } catch (error) {
        throw new DocumentationInputError(`The OpenAPI document is not valid JSON or YAML: ${error.message}`, 'PARSE_ERROR');
    }
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new DocumentationInputError('The OpenAPI document must be an object.', 'INVALID_DOCUMENT');

    const declared = cleanText(spec.openapi || spec.swagger, 20);
    const supported = spec.swagger === '2.0' || /^3\.(0|1)(\.\d+)?$/.test(declared) || /^3\.2(\.0)?$/.test(declared);
    if (!supported) throw new DocumentationInputError('Supported formats are Swagger 2.0 and OpenAPI 3.0, 3.1, or 3.2.', 'UNSUPPORTED_VERSION');

    const externalRefs = [];
    const visit = (node, path = '$', visited = new Set()) => {
        if (!node || typeof node !== 'object' || visited.has(node)) return;
        visited.add(node);
        if (typeof node.$ref === 'string' && !node.$ref.startsWith('#/')) externalRefs.push({ path, ref: node.$ref });
        Object.entries(node).forEach(([key, child]) => visit(child, `${path}.${key}`, visited));
    };
    visit(spec);
    if (externalRefs.length) {
        throw new DocumentationInputError('External $ref values are not fetched. Bundle referenced files into one document before importing.', 'EXTERNAL_REF_BLOCKED', 400, externalRefs.slice(0, 20).map((item) => ({ severity: 'error', code: 'external-ref', message: item.ref, path: item.path })));
    }
    return spec;
}

function schemaExample(spec, rawSchema, depth = 0) {
    if (depth > 5) return null;
    const schema = resolveLocalRef(spec, rawSchema) || {};
    if (schema.example !== undefined) return schema.example;
    if (schema.examples && Array.isArray(schema.examples) && schema.examples.length) return schema.examples[0];
    if (schema.default !== undefined) return schema.default;
    if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
    if (schema.const !== undefined) return schema.const;
    if (schema.oneOf?.length) return schemaExample(spec, schema.oneOf[0], depth + 1);
    if (schema.anyOf?.length) return schemaExample(spec, schema.anyOf[0], depth + 1);
    if (schema.type === 'array' || schema.items) return [schemaExample(spec, schema.items || {}, depth + 1)];
    if (schema.type === 'object' || schema.properties) {
        return Object.fromEntries(Object.entries(schema.properties || {}).slice(0, 30).map(([key, value]) => [key, schemaExample(spec, value, depth + 1)]));
    }
    if (schema.type === 'integer' || schema.type === 'number') return schema.minimum ?? 0;
    if (schema.type === 'boolean') return false;
    if (schema.format === 'date-time') return '2026-01-01T00:00:00Z';
    if (schema.format === 'date') return '2026-01-01';
    if (schema.format === 'email') return 'user@example.com';
    if (schema.format === 'uuid') return '00000000-0000-4000-8000-000000000000';
    return 'string';
}

function operationExample(spec, content) {
    const entries = Object.entries(content || {});
    if (!entries.length) return null;
    const [mediaType, media] = entries[0];
    const explicit = media?.example ?? Object.values(media?.examples || {})[0]?.value;
    const schema = resolveLocalRef(spec, media?.schema || {}) || {};
    const value = explicit !== undefined ? explicit : schemaExample(spec, schema);
    let validationErrors = [];
    try {
        const valid = exampleValidator.validate(schema, value);
        if (!valid) validationErrors = (exampleValidator.errors || []).map((item) => `${item.instancePath || '/'} ${item.message}`.trim());
    } catch (error) {
        // Complex recursive/local references stay grounded but cannot always be
        // compiled as an isolated schema. Surface that as unvalidated, not valid.
        validationErrors = null;
    }
    return { mediaType, value, schema, validationErrors };
}

function normalizeSecurity(spec, operation) {
    const definitions = spec.components?.securitySchemes || spec.securityDefinitions || {};
    const requirements = operation.security === undefined ? (spec.security || []) : operation.security;
    if (Array.isArray(requirements) && requirements.length === 0) return [];
    const names = new Set((requirements || []).flatMap((item) => Object.keys(item || {})));
    return Array.from(names).map((name) => {
        const scheme = resolveLocalRef(spec, definitions[name]) || {};
        return {
            name,
            type: scheme.type || 'unknown',
            scheme: scheme.scheme || '',
            bearerFormat: scheme.bearerFormat || '',
            in: scheme.in || '',
            parameterName: scheme.name || '',
            flows: scheme.flows || scheme.flow || null,
            openIdConnectUrl: scheme.openIdConnectUrl || ''
        };
    });
}

function normalizeOpenApi(spec) {
    const diagnostics = [];
    if (!spec.info?.title) diagnostics.push({ severity: 'warning', code: 'missing-title', message: 'info.title is missing.' });
    if (!spec.info?.version) diagnostics.push({ severity: 'warning', code: 'missing-version', message: 'info.version is missing.' });
    if (!spec.paths || typeof spec.paths !== 'object') diagnostics.push({ severity: 'error', code: 'missing-paths', message: 'paths is missing.' });

    const operations = [];
    Object.entries(spec.paths || {}).forEach(([path, pathItemValue]) => {
        const pathItem = resolveLocalRef(spec, pathItemValue) || {};
        Object.entries(pathItem).forEach(([method, operationValue]) => {
            if (!HTTP_METHODS.has(method.toLowerCase()) || !operationValue || typeof operationValue !== 'object') return;
            const operation = resolveLocalRef(spec, operationValue);
            const operationId = cleanText(operation.operationId, 200) || `${method.toLowerCase()}:${path}`;
            const parameters = [...(pathItem.parameters || []), ...(operation.parameters || [])].map((parameter) => {
                const item = resolveLocalRef(spec, parameter) || {};
                return { name: item.name || '', in: item.in || '', required: Boolean(item.required), description: cleanText(item.description, 1200), schema: resolveLocalRef(spec, item.schema) || {} };
            });
            const requestExample = operationExample(spec, operation.requestBody?.content || (operation.parameters || []).find((item) => item.in === 'body')?.schema && { 'application/json': { schema: (operation.parameters || []).find((item) => item.in === 'body').schema } });
            const responses = Object.entries(operation.responses || {}).map(([status, responseValue]) => {
                const response = resolveLocalRef(spec, responseValue) || {};
                return { status, description: cleanText(response.description, 1600), example: operationExample(spec, response.content || (response.schema ? { 'application/json': { schema: response.schema, example: response.examples?.['application/json'] } } : null)), headers: response.headers || {} };
            });
            operations.push({
                operationId,
                method: method.toUpperCase(),
                path,
                summary: cleanText(operation.summary, 500),
                description: cleanText(operation.description, 4000),
                tags: operation.tags || [],
                deprecated: Boolean(operation.deprecated),
                parameters,
                requestExample,
                responses,
                security: normalizeSecurity(spec, operation),
                links: Object.values(operation.responses || {}).flatMap((response) => Object.entries(resolveLocalRef(spec, response)?.links || {}).map(([name, link]) => ({ name, operationId: link.operationId || '', operationRef: link.operationRef || '', description: cleanText(link.description, 1000) })))
            });
        });
    });
    if (!operations.length) diagnostics.push({ severity: 'warning', code: 'no-operations', message: 'No HTTP operations were found.' });
    operations.forEach((operation) => {
        const examples = [operation.requestExample, ...operation.responses.map((response) => response.example)].filter(Boolean);
        examples.forEach((example) => {
            if (Array.isArray(example.validationErrors) && example.validationErrors.length) diagnostics.push({ severity: 'warning', code: 'invalid-example', operationId: operation.operationId, message: `An example for ${operation.method} ${operation.path} does not match its schema: ${example.validationErrors[0]}` });
            if (example.validationErrors === null) diagnostics.push({ severity: 'warning', code: 'example-not-validated', operationId: operation.operationId, message: `An example for ${operation.method} ${operation.path} uses references that could not be validated in isolation.` });
        });
    });
    return {
        kind: 'openapi',
        title: cleanText(spec.info?.title, 300) || 'API Documentation',
        version: cleanText(spec.info?.version, 80) || '1.0.0',
        description: cleanText(spec.info?.description, 6000),
        specificationVersion: cleanText(spec.openapi || spec.swagger, 20),
        servers: (spec.servers || (spec.host ? [{ url: `${(spec.schemes || ['https'])[0]}://${spec.host}${spec.basePath || ''}` }] : [])).map((server) => ({ url: cleanText(server.url, 1000), description: cleanText(server.description, 1000) })),
        operations,
        diagnostics,
        sourceHash: sourceHash(spec),
        raw: spec
    };
}

function normalizeCollection(collection) {
    const operations = (collection.requests || []).filter((request) => request?.url && request?.method).map((request, index) => {
        let bodyExample = null;
        const requestUrl = String(request.url).replace(/%7B/gi, '{').replace(/%7D/gi, '}');
        if (typeof request.body === 'string' && request.body.trim()) {
            try { bodyExample = { mediaType: 'application/json', value: JSON.parse(request.body) }; } catch { bodyExample = { mediaType: 'text/plain', value: request.body.slice(0, 4000) }; }
        }
        return {
            operationId: String(request._id || request.id || `request-${index + 1}`),
            method: String(request.method).toUpperCase(),
            path: requestUrl,
            summary: cleanText(request.name, 500),
            description: cleanText(request.description, 4000),
            tags: request.folderPath || [],
            deprecated: false,
            parameters: (request.params || []).filter((item) => item.enabled !== false).map((item) => ({ name: item.name || item.key || '', in: 'query', required: false, description: cleanText(item.description, 1000), schema: { type: 'string' } })),
            requestExample: bodyExample,
            responses: [],
            security: request.authConfig?.type ? [{ name: request.authConfig.type, type: request.authConfig.type, scheme: request.authConfig.type }] : [],
            links: []
        };
    });
    return {
        kind: 'collection', title: cleanText(collection.name, 300) || 'API Documentation', version: cleanText(collection.version, 80) || '1.0.0',
        description: cleanText(collection.description, 6000), specificationVersion: '', servers: [], operations,
        diagnostics: operations.length ? [] : [{ severity: 'warning', code: 'no-operations', message: 'The collection has no documented HTTP requests.' }],
        sourceHash: sourceHash({ id: collection._id, updatedAt: collection.updatedAt, requests: collection.requests }), raw: null
    };
}

function exampleBlock(example) {
    if (!example) return '';
    const value = typeof example.value === 'string' ? example.value : JSON.stringify(example.value, null, 2);
    const language = /json/i.test(example.mediaType || '') && typeof example.value !== 'string' ? 'json' : 'text';
    return `Content-Type: \`${example.mediaType || 'application/json'}\`\n\n\`\`\`${language}\n${value}\n\`\`\``;
}

function requestSnippets(source, operation) {
    const baseUrl = String(source.servers[0]?.url || 'https://api.example.com').replace(/\/$/, '');
    let pathValue = String(operation.path || '/').startsWith('http') ? operation.path : `${baseUrl}${String(operation.path || '/').startsWith('/') ? '' : '/'}${operation.path || ''}`;
    const security = operation.security[0];
    const apiKey = security?.type === 'apiKey' ? security : null;
    if (apiKey?.in === 'query') pathValue += `${pathValue.includes('?') ? '&' : '?'}${apiKey.parameterName || apiKey.name}=<api-key>`;
    const authHeader = apiKey?.in === 'header'
        ? `${apiKey.parameterName || apiKey.name}: <api-key>`
        : (security && (!apiKey || apiKey.in === 'header') ? (/basic/i.test(security.scheme || '') ? 'Authorization: Basic <credentials>' : 'Authorization: Bearer <access-token>') : '');
    const body = operation.requestExample ? (typeof operation.requestExample.value === 'string' ? operation.requestExample.value : JSON.stringify(operation.requestExample.value)) : '';
    const curlParts = [`curl --request ${operation.method}`, `  --url '${pathValue}'`];
    if (authHeader) curlParts.push(`  --header '${authHeader}'`);
    if (body) curlParts.push(`  --header 'Content-Type: ${operation.requestExample.mediaType || 'application/json'}'`, `  --data '${body.replace(/'/g, "'\\''")}'`);
    const fetchOptions = [`method: '${operation.method}'`];
    const [headerName, ...headerValueParts] = authHeader.split(': ');
    const jsAuthHeader = authHeader ? `'${headerName}': '${headerValueParts.join(': ')}'` : '';
    if (authHeader || body) fetchOptions.push(`headers: { ${jsAuthHeader}${authHeader && body ? ', ' : ''}${body ? `'Content-Type': '${operation.requestExample.mediaType || 'application/json'}'` : ''} }`);
    if (body) fetchOptions.push(`body: JSON.stringify(${typeof operation.requestExample.value === 'string' ? JSON.stringify(operation.requestExample.value) : JSON.stringify(operation.requestExample.value, null, 2)})`);
    const pythonHeaders = authHeader ? `headers={${JSON.stringify(headerName)}: ${JSON.stringify(headerValueParts.join(': '))}}` : '';
    const pythonValue = body ? (/json/i.test(operation.requestExample.mediaType || '') ? `json=json.loads(${JSON.stringify(body)})` : `data=${JSON.stringify(body)}`) : '';
    const pythonArguments = [pythonHeaders, pythonValue].filter(Boolean).join(', ');
    return [
        '#### Request examples', '',
        '**cURL**', '', '```bash', curlParts.join(' \\\n'), '```', '',
        '**JavaScript**', '', '```javascript', `const response = await fetch('${pathValue}', {\n  ${fetchOptions.join(',\n  ')}\n});`, '```', '',
        '**Python**', '', '```python', `import json\nimport requests\n\nresponse = requests.request('${operation.method}', '${pathValue}'${pythonArguments ? `, ${pythonArguments}` : ''})`, '```', ''
    ];
}

function authMarkdown(source) {
    const schemes = new Map();
    source.operations.forEach((operation) => operation.security.forEach((security) => schemes.set(security.name, security)));
    if (!schemes.size) return '## Authentication\n\nNo authentication scheme is declared by the selected API source. Confirm this before publishing.';
    const lines = ['## Authentication', '', 'Never place production credentials in documentation, source control, or shared examples.', ''];
    schemes.forEach((item) => {
        lines.push(`### ${item.name}`, '');
        if (item.type === 'apiKey') lines.push(`Send the API key in the ${item.in || 'configured location'} named \`${item.parameterName || item.name}\`. Use a least-privilege test key in examples.`);
        else if (item.type === 'oauth2' || item.type === 'openIdConnect') lines.push('Use an authorization-code flow with PKCE where supported. Validate redirect URIs exactly, restrict token audience and scope, rotate refresh tokens, and do not use the implicit or resource-owner-password flow.');
        else if (/basic/i.test(item.scheme)) lines.push('Send test credentials with HTTP Basic authentication over HTTPS only. Prefer a stronger token-based scheme for production APIs and never place credentials in URLs.');
        else if (/bearer/i.test(item.scheme) || item.type === 'http') lines.push('Send a short-lived bearer credential as `Authorization: Bearer <access-token>`. Keep tokens out of URLs, logs, and example payloads.');
        else if (/mutual|mtls/i.test(`${item.type} ${item.scheme}`)) lines.push('Present a client certificate issued by the configured trust chain and rotate it before expiry.');
        else lines.push(`Follow the configured ${item.type || 'authentication'} scheme and substitute placeholders with test credentials at runtime.`);
        lines.push('');
    });
    return lines.join('\n').trim();
}

function endpointMarkdown(source, operation) {
    const title = operation.summary || `${operation.method} ${operation.path}`;
    const lines = [`### ${title}`, '', `\`${operation.method} ${operation.path}\``, '', operation.description || `Use this operation to ${title.charAt(0).toLowerCase()}${title.slice(1)}.`, ''];
    if (operation.deprecated) lines.push('> Deprecated: review the migration guidance before using this operation.', '');
    if (operation.parameters.length) {
        lines.push('#### Parameters', '', '| Name | In | Type | Required | Description |', '|---|---|---|---|---|');
        operation.parameters.forEach((item) => lines.push(`| ${escapeCell(item.name)} | ${escapeCell(item.in)} | ${escapeCell(item.schema?.type || 'object')} | ${item.required ? 'Yes' : 'No'} | ${escapeCell(item.description)} |`));
        lines.push('');
    }
    if (operation.requestExample) lines.push('#### Request example', '', exampleBlock(operation.requestExample), '');
    lines.push(...requestSnippets(source, operation));
    const success = operation.responses.find((item) => /^2/.test(item.status) && item.example);
    if (success) lines.push(`#### Response example (${success.status})`, '', exampleBlock(success.example), '');
    const errors = operation.responses.filter((item) => /^(4|5|default)/.test(item.status));
    if (errors.length) {
        lines.push('#### Errors', '', '| Status | Meaning | Recommended action |', '|---|---|---|');
        errors.forEach((item) => lines.push(`| ${escapeCell(item.status)} | ${escapeCell(item.description || 'Request failed')} | Check the request, authentication, and documented response fields before retrying. |`));
        lines.push('');
        const problem = errors.find((item) => /application\/problem\+json/i.test(item.example?.mediaType || ''));
        if (problem) lines.push('RFC 9457 problem responses use `type`, `title`, `status`, `detail`, and `instance`; extensions may add API-specific fields.', '', exampleBlock(problem.example), '');
    }
    return lines.join('\n').trim();
}

function buildDeterministicDraft(source, options = {}) {
    const selected = new Set(Array.isArray(options.operationIds) && options.operationIds.length ? options.operationIds.map(String) : source.operations.map((item) => String(item.operationId)));
    const operations = source.operations.filter((item) => selected.has(String(item.operationId))).slice(0, 250);
    const sections = [
        { id: 'overview', title: 'Overview', markdown: `# ${source.title}\n\n${source.description || `Reference documentation for ${source.title}.`}\n\n**API version:** ${source.version}\n${source.servers[0]?.url ? `\n**Base URL:** \`${source.servers[0].url}\`` : ''}` },
        { id: 'authentication', title: 'Authentication', markdown: authMarkdown({ ...source, operations }) },
        { id: 'getting-started', title: 'Getting started', markdown: `## Getting started\n\n1. Choose the documented server or configure the collection environment.\n2. Configure the required test credentials without committing secrets.\n3. Start with \`${operations[0]?.method || 'GET'} ${operations[0]?.path || '/'}\`.\n4. Check the documented success response and handle error responses explicitly.` },
        { id: 'endpoints', title: 'Endpoints', markdown: `## Endpoints\n\n${operations.map((operation) => `<!-- pigeon:operation:${slug(operation.operationId)} -->\n${endpointMarkdown(source, operation)}`).join('\n\n') || '_No operations selected._'}` }
    ];
    const linked = operations.filter((item) => item.links.length).slice(0, 5);
    const tutorialOperations = (linked.length ? linked : operations.slice(0, 3));
    sections.push({ id: 'tutorials', title: 'Tutorials', markdown: `## Tutorials\n\n${tutorialOperations.map((item, index) => `### Workflow ${index + 1}: ${item.summary || item.operationId}\n\n1. Configure the documented base URL and test credentials.\n2. Call \`${item.method} ${item.path}\`.\n3. ${item.links.length ? `Use the documented response with ${item.links.map((link) => link.operationId || link.operationRef || link.name).join(', ')}.` : 'Verify the status and response schema before using returned values.'}\n4. Handle documented error statuses without exposing credentials in logs.`).join('\n\n') || 'Import or add an operation to generate a task tutorial.'}` });
    const requestedSections = new Set(Array.isArray(options.sections) && options.sections.length ? options.sections : sections.map((section) => section.id));
    const includedSections = sections.filter((section) => requestedSections.has(section.id));
    return { title: `${source.title} Documentation`, sections: includedSections, markdown: includedSections.map((section) => `<!-- pigeon:section:${section.id} -->\n${section.markdown}`).join('\n\n'), coverage: { selected: operations.length, total: source.operations.length, missingDescriptions: operations.filter((item) => !item.description).length, missingExamples: operations.filter((item) => !item.requestExample && !item.responses.some((response) => response.example)).length, invalidExamples: operations.flatMap((item) => [item.requestExample, ...item.responses.map((response) => response.example)]).filter((example) => Array.isArray(example?.validationErrors) && example.validationErrors.length).length, missingErrors: operations.filter((item) => !item.responses.some((response) => /^(4|5|default)/.test(response.status))).length } };
}

function scanSecrets(markdown) {
    const findings = [];
    String(markdown || '').replace(SECRET_PATTERN, (match, key, value, offset) => {
        findings.push({ severity: 'error', code: 'possible-secret', message: `Possible ${key} value must be replaced with a placeholder.`, offset, preview: `${key}: ${String(value).slice(0, 4)}…` });
        return match;
    });
    SECRET_PATTERN.lastIndex = 0;
    return findings;
}

function mergeGeneratedSections(current, sections, mode = 'merge') {
    const selected = sections || [];
    if (mode === 'replace' || !String(current || '').trim()) return selected.map((section) => `<!-- pigeon:section:${section.id} -->\n${section.markdown}`).join('\n\n');
    let next = String(current);
    selected.forEach((section) => {
        const marker = `<!-- pigeon:section:${section.id} -->`;
        const start = next.indexOf(marker);
        const replacement = `${marker}\n${section.markdown}`;
        if (start < 0) next = `${next.trim()}\n\n${replacement}`;
        else {
            const following = next.indexOf('<!-- pigeon:section:', start + marker.length);
            next = `${next.slice(0, start)}${replacement}${following < 0 ? '' : `\n\n${next.slice(following)}`}`.trim();
        }
    });
    return next;
}

module.exports = {
    DocumentationInputError,
    parseOpenApi,
    normalizeOpenApi,
    normalizeCollection,
    buildDeterministicDraft,
    mergeGeneratedSections,
    scanSecrets,
    sourceHash
};
