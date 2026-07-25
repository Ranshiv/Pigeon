const SUPPORTED_METHODS = new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD']);
const MAX_REQUESTS = 1000;
const MAX_VARIABLES = 2000;

class PostmanImportError extends Error {
    constructor(message, code = 'INVALID_POSTMAN_DOCUMENT') {
        super(message);
        this.name = 'PostmanImportError';
        this.code = code;
    }
}

const toText = (value) => {
    if (typeof value === 'string') return value;
    if (value && typeof value.content === 'string') return value.content;
    return '';
};

const trimText = (value, fallback, maxLength = 500) => {
    const normalized = String(value ?? '').trim();
    return (normalized || fallback).slice(0, maxLength);
};

const getScript = (event) => {
    const lines = event?.script?.exec;
    if (Array.isArray(lines)) return lines.join('\n');
    return typeof lines === 'string' ? lines : '';
};

const getScripts = (events) => {
    const scripts = { prerequest: [], test: [] };
    (Array.isArray(events) ? events : []).forEach((event) => {
        const script = getScript(event).trim();
        if (script && scripts[event?.listen]) scripts[event.listen].push(script);
    });
    return scripts;
};

const appendScripts = (inherited, local) => ({
    prerequest: [...inherited.prerequest, ...local.prerequest],
    test: [...inherited.test, ...local.test]
});

const joinScripts = (scripts) => scripts.filter(Boolean).join('\n\n');

const buildUrl = (url) => {
    if (typeof url === 'string') return url.trim();
    if (!url || typeof url !== 'object') return '';
    if (typeof url.raw === 'string' && url.raw.trim()) return url.raw.trim();

    const protocol = String(url.protocol || 'https').replace(/:$/, '');
    const host = Array.isArray(url.host) ? url.host.join('.') : String(url.host || '');
    const path = Array.isArray(url.path)
        ? url.path.map((part) => String(part).replace(/^\/+|\/+$/g, '')).filter(Boolean).join('/')
        : String(url.path || '').replace(/^\/+/, '');
    if (!host) return '';

    const query = (Array.isArray(url.query) ? url.query : [])
        .filter((entry) => entry?.disabled !== true && entry?.key)
        .map((entry) => `${encodeURIComponent(entry.key)}=${encodeURIComponent(entry.value ?? '')}`)
        .join('&');
    return `${protocol}://${host}${path ? `/${path}` : ''}${query ? `?${query}` : ''}`;
};

const normalizePairs = (entries) => (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry && (entry.key || entry.name))
    .map((entry) => {
        const key = String(entry.key || entry.name);
        return {
            key,
            name: key,
            value: String(entry.value ?? ''),
            description: toText(entry.description),
            enabled: entry.disabled !== true,
            type: entry.type || 'text',
            src: entry.src || null
        };
    });

const authValue = (auth, key) => {
    const entries = Array.isArray(auth?.[auth?.type]) ? auth[auth.type] : [];
    return entries.find((entry) => entry?.key === key)?.value ?? '';
};

const convertAuth = (auth, warnings) => {
    const type = auth?.type;
    if (!type || type === 'noauth') return { type: 'No Auth' };

    if (type === 'bearer') {
        return { type: 'Bearer Token', bearer: { token: String(authValue(auth, 'token')) } };
    }
    if (type === 'basic') {
        return {
            type: 'Basic Auth',
            basic: {
                username: String(authValue(auth, 'username')),
                password: String(authValue(auth, 'password'))
            }
        };
    }
    if (type === 'apikey') {
        return {
            type: 'API Key',
            apiKey: {
                key: String(authValue(auth, 'key')),
                value: String(authValue(auth, 'value')),
                location: authValue(auth, 'in') === 'query' ? 'query' : 'header'
            }
        };
    }
    if (type === 'oauth2') {
        const accessToken = String(authValue(auth, 'accessToken') || authValue(auth, 'token'));
        return {
            type: 'OAuth 2.0',
            oauth2: {
                grantType: String(authValue(auth, 'grant_type') || 'authorization_code'),
                clientId: String(authValue(auth, 'clientId')),
                clientSecret: String(authValue(auth, 'clientSecret')),
                authUrl: String(authValue(auth, 'authUrl')),
                tokenUrl: String(authValue(auth, 'accessTokenUrl')),
                scope: String(authValue(auth, 'scope')),
                redirectUri: String(authValue(auth, 'redirect_uri')),
                accessToken,
                refreshToken: String(authValue(auth, 'refreshToken')),
                tokenStatus: accessToken ? 'authenticated' : 'not_authenticated'
            }
        };
    }

    warnings.add(`Postman authentication type "${type}" was preserved as metadata but is not executable in Pigeon yet.`);
    return { type: 'No Auth' };
};

const convertBody = (body, warnings) => {
    if (!body || !body.mode) return { body: '', bodyType: 'none', bodyFormData: [] };

    if (body.mode === 'raw') {
        const raw = String(body.raw ?? '');
        const language = body.options?.raw?.language;
        const isJson = language === 'json';
        if (isJson && raw.trim()) {
            try {
                JSON.parse(raw);
                return { body: raw, bodyType: 'json', bodyFormData: [] };
            } catch {
                warnings.add('A body marked as JSON was imported as raw text because it is not valid JSON.');
            }
        }
        return { body: raw, bodyType: 'raw', bodyFormData: [] };
    }

    if (body.mode === 'urlencoded' || body.mode === 'formdata') {
        const source = normalizePairs(body[body.mode]);
        const enabled = source.filter((entry) => entry.enabled);
        const hasFiles = (Array.isArray(body[body.mode]) ? body[body.mode] : []).some((entry) => entry?.type === 'file');
        if (hasFiles) warnings.add('Postman file form fields require reselecting local files after import.');
        const objectBody = enabled.reduce((result, entry) => {
            result[entry.key] = entry.value;
            return result;
        }, {});
        return {
            body: JSON.stringify(objectBody, null, 2),
            bodyType: body.mode === 'urlencoded' ? 'x-www-form-urlencoded' : 'form-data',
            bodyFormData: source
        };
    }

    if (body.mode === 'graphql') {
        const query = String(body.graphql?.query ?? '');
        const rawVariables = body.graphql?.variables ?? '{}';
        let variables = {};
        try {
            variables = typeof rawVariables === 'string' ? JSON.parse(rawVariables || '{}') : rawVariables;
        } catch {
            warnings.add('GraphQL variables were not valid JSON and were preserved as an empty object.');
        }
        return {
            body: JSON.stringify({ query, variables }, null, 2),
            bodyType: 'json',
            bodyFormData: [],
            protocol: 'graphql',
            graphql: { query, variables, operationType: '', operationName: '', schema: '', schemaUrl: '' }
        };
    }

    warnings.add(`Postman body mode "${body.mode}" is not supported and was preserved only in import metadata.`);
    return { body: '', bodyType: 'none', bodyFormData: [] };
};

const summarizeResponses = (responses) => (Array.isArray(responses) ? responses : []).slice(0, 20).map((response) => ({
    id: response.id || response._postman_previewlanguage || null,
    name: response.name || '',
    status: response.status || '',
    code: Number(response.code) || 0,
    headers: normalizePairs(response.header),
    body: String(response.body ?? '').slice(0, 250000)
}));

const scriptMarkdown = (title, script) => script
    ? `\n#### ${title}\n\n\`\`\`javascript\n${script.replace(/\`\`\`/g, '\\`\\`\\`')}\n\`\`\``
    : '';

const buildPostmanDocumentation = ({ name, description, collectionScripts, folderTree, requests }) => {
    const sections = [`# ${name}`];
    if (description) sections.push(description);

    const collectionScriptContent = [
        scriptMarkdown('Collection pre-request script', collectionScripts.prerequest),
        scriptMarkdown('Collection test script', collectionScripts.test)
    ].filter(Boolean).join('\n');
    if (collectionScriptContent) sections.push(`## Collection scripts\n${collectionScriptContent}`);

    if (folderTree.length) {
        const folderSections = folderTree.map((folder) => {
            const title = folder.path.join(' / ');
            const scripts = [
                scriptMarkdown('Folder pre-request script', folder.preRequestScript),
                scriptMarkdown('Folder test script', folder.testScript)
            ].filter(Boolean).join('\n');
            return [`### ${title}`, folder.description, scripts].filter(Boolean).join('\n\n');
        });
        sections.push(`## Folders\n\n${folderSections.join('\n\n')}`);
    }

    if (requests.length) {
        const requestSections = requests.map((request) => {
            const details = [
                `- **${request.method}** \`${request.url}\``,
                request.description
            ].filter(Boolean).join('\n\n');
            const scripts = [
                scriptMarkdown('Pre-request script', request.preRequestScript),
                scriptMarkdown('Test script', request.testScript)
            ].filter(Boolean).join('\n');
            const savedExampleCount = request.metadata?.savedExamples?.length || 0;
            const examples = savedExampleCount
                ? `\n\n_Saved response examples: ${savedExampleCount}_`
                : '';
            return [`### ${request.name}`, details, scripts, examples].filter(Boolean).join('\n\n');
        });
        sections.push(`## Requests\n\n${requestSections.join('\n\n')}`);
    }

    return sections.filter(Boolean).join('\n\n');
};

const convertPostmanCollection = (document) => {
    if (!document?.info || !Array.isArray(document.item)) {
        throw new PostmanImportError('This JSON file is not a Postman Collection v2.x document.');
    }

    const schema = String(document.info.schema || '');
    if (schema && !schema.includes('getpostman.com/json/collection')) {
        throw new PostmanImportError('Unsupported Postman collection schema. Export the collection as v2.0 or v2.1 JSON.');
    }

    const warnings = new Set();
    const requests = [];
    const folderTree = [];
    const collectionScripts = getScripts(document.event);
    const collectionAuth = document.auth || null;
    let hasImportedScripts = collectionScripts.prerequest.length > 0 || collectionScripts.test.length > 0;

    const walk = (items, context) => {
        (Array.isArray(items) ? items : []).forEach((item) => {
            if (Array.isArray(item?.item)) {
                const name = trimText(item.name, 'Untitled folder', 200);
                const folderPath = [...context.folderPath, name];
                const localScripts = getScripts(item.event);
                hasImportedScripts = hasImportedScripts || localScripts.prerequest.length > 0 || localScripts.test.length > 0;
                const scripts = appendScripts(context.scripts, localScripts);
                const auth = Object.prototype.hasOwnProperty.call(item, 'auth') ? item.auth : context.auth;
                folderTree.push({
                    path: folderPath,
                    description: toText(item.description),
                    preRequestScript: joinScripts(localScripts.prerequest),
                    testScript: joinScripts(localScripts.test)
                });
                walk(item.item, { folderPath, scripts, auth });
                return;
            }

            if (!item?.request) {
                warnings.add(`Skipped non-request item "${trimText(item?.name, 'Untitled item', 120)}".`);
                return;
            }

            if (requests.length >= MAX_REQUESTS) {
                throw new PostmanImportError(`Collections with more than ${MAX_REQUESTS} requests are not supported.`, 'IMPORT_LIMIT_EXCEEDED');
            }

            const url = buildUrl(item.request.url);
            if (!url) {
                warnings.add(`Skipped request "${trimText(item.name, 'Untitled request', 120)}" because it has no URL.`);
                return;
            }

            const requestedMethod = String(item.request.method || 'GET').toUpperCase();
            const method = SUPPORTED_METHODS.has(requestedMethod) ? requestedMethod : 'GET';
            if (method !== requestedMethod) warnings.add(`Method "${requestedMethod}" was imported as GET because Pigeon does not support it.`);

            const body = convertBody(item.request.body, warnings);
            const localScripts = getScripts(item.event);
            hasImportedScripts = hasImportedScripts || localScripts.prerequest.length > 0 || localScripts.test.length > 0;
            const scripts = appendScripts(context.scripts, localScripts);
            const effectiveAuth = Object.prototype.hasOwnProperty.call(item.request, 'auth')
                ? item.request.auth
                : context.auth;
            const headers = normalizePairs(item.request.header);
            const params = normalizePairs(typeof item.request.url === 'object' ? item.request.url.query : []);
            const sourceId = item.id || item._postman_id || null;

            requests.push({
                name: trimText(item.name, `${method} request`, 200),
                description: toText(item.request.description || item.description),
                url,
                method,
                protocol: body.protocol || 'http',
                headers,
                params,
                body: body.body,
                bodyType: body.bodyType,
                bodyFormData: body.bodyFormData,
                graphql: body.graphql,
                preRequestScript: joinScripts(scripts.prerequest),
                testScript: joinScripts(scripts.test),
                tests: joinScripts(scripts.test),
                authConfig: convertAuth(effectiveAuth, warnings),
                folderPath: context.folderPath,
                order: requests.length,
                metadata: {
                    importSource: 'postman',
                    sourceId,
                    originalAuth: effectiveAuth || null,
                    originalBodyMode: item.request.body?.mode || 'none',
                    disabledHeaders: headers.filter((entry) => !entry.enabled),
                    disabledParams: params.filter((entry) => !entry.enabled),
                    savedExamples: summarizeResponses(item.response)
                }
            });
        });
    };

    walk(document.item, {
        folderPath: [],
        scripts: collectionScripts,
        auth: collectionAuth
    });

    const allVariables = Array.isArray(document.variable) ? document.variable : [];
    if (allVariables.length > MAX_VARIABLES) {
        throw new PostmanImportError(`Collections with more than ${MAX_VARIABLES} variables are not supported.`, 'IMPORT_LIMIT_EXCEEDED');
    }
    const variables = allVariables
        .filter((variable) => variable?.key && variable.disabled !== true)
        .map((variable) => ({
            key: String(variable.key),
            value: String(variable.value ?? ''),
            description: toText(variable.description),
            type: ['number', 'boolean', 'object'].includes(variable.type) ? variable.type : 'string',
            isSecret: variable.type === 'secret',
            enabled: true
        }));

    if (hasImportedScripts) {
        warnings.add('Postman scripts were preserved, but some pm.* APIs may require manual migration to Pigeon script APIs.');
    }

    const name = trimText(document.info.name, 'Imported Postman Collection', 200);
    const description = toText(document.info.description);
    return {
        kind: 'collection',
        name,
        description,
        variables,
        requests,
        documentation: {
            title: `${name} Documentation`,
            content: buildPostmanDocumentation({
                name,
                description,
                collectionScripts: {
                    prerequest: joinScripts(collectionScripts.prerequest),
                    test: joinScripts(collectionScripts.test)
                },
                folderTree,
                requests
            })
        },
        metadata: {
            importSource: 'postman',
            sourceId: document.info._postman_id || null,
            sourceSchema: schema || null,
            importedAt: new Date(),
            folderTree,
            disabledVariables: allVariables.filter((variable) => variable?.disabled === true),
            originalAuth: collectionAuth
        },
        warnings: [...warnings]
    };
};

const convertPostmanEnvironment = (document) => {
    if (!Array.isArray(document?.values) || Array.isArray(document?.item)) {
        throw new PostmanImportError('This JSON file is not a Postman environment document.');
    }
    if (document.values.length > MAX_VARIABLES) {
        throw new PostmanImportError(`Environments with more than ${MAX_VARIABLES} variables are not supported.`, 'IMPORT_LIMIT_EXCEEDED');
    }

    const enabledVariables = document.values.filter((variable) => variable?.key && variable.enabled !== false);
    const variables = enabledVariables.map((variable) => ({
        key: String(variable.key),
        value: String(variable.value ?? ''),
        description: toText(variable.description),
        isSecret: variable.type === 'secret',
        type: 'string',
        enabled: true
    }));
    const warnings = [];
    if (document._postman_variable_scope === 'globals') {
        warnings.push('Postman globals were imported as a regular Pigeon environment to avoid overwriting existing global variables.');
    }
    if (variables.some((variable) => variable.isSecret && variable.value)) {
        warnings.push('Secret values were imported. Review and rotate credentials if this export file was shared.');
    }

    return {
        kind: 'environment',
        name: trimText(document.name, 'Imported Postman Environment', 200),
        description: 'Imported from Postman',
        type: 'environment',
        variables,
        metadata: {
            importSource: 'postman',
            sourceId: document.id || document._postman_id || null,
            originalScope: document._postman_variable_scope || 'environment',
            importedAt: new Date(),
            disabledVariables: document.values.filter((variable) => variable?.enabled === false)
        },
        warnings
    };
};

const detectPostmanDocument = (document) => {
    if (!document || typeof document !== 'object' || Array.isArray(document)) {
        throw new PostmanImportError('The uploaded file must contain a JSON object.');
    }
    if (document.info && Array.isArray(document.item)) return 'collection';
    if (Array.isArray(document.values)) return 'environment';
    throw new PostmanImportError('The uploaded JSON is neither a Postman collection nor a Postman environment.');
};

const convertPostmanDocument = (document) => detectPostmanDocument(document) === 'collection'
    ? convertPostmanCollection(document)
    : convertPostmanEnvironment(document);

module.exports = {
    MAX_REQUESTS,
    MAX_VARIABLES,
    PostmanImportError,
    detectPostmanDocument,
    convertPostmanCollection,
    convertPostmanEnvironment,
    convertPostmanDocument,
    buildPostmanDocumentation
};
