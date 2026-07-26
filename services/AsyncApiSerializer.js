// services/AsyncApiSerializer.js
// AsyncAPI back-export (denormalise). Split out of AsyncApiValidator.js to
// keep each file under 500 lines. Always rebuild servers/channels/messages/
// operations from the live document fields (source of truth, reflecting all
// designer + granular edits), for 2.x and 3.x; rawImport supplies only the
// fields Pigeon doesn't model.

/**
 * Build an AsyncAPI JSON object back out of a stored document. servers/channels
 * /messages/operations always come from the live doc — never from the stale
 * rawImport snapshot. rawImport only supplies fields Pigeon doesn't model
 * (contact/license/termsOfService/externalDocs, defaultContentType, x-*
 * extensions, non-message components), merged without overriding live arrays
 * or info scalars.
 */
function denormalizeToAsyncApiJson(doc) {
    const d = doc && doc.toObject ? doc.toObject() : doc;
    const isV3 = String(d.asyncApiVersion || '').startsWith('3.');
    const built = isV3 ? buildAsyncApi3Json(d) : buildAsyncApi2Json(d);
    if (d.rawImport && typeof d.rawImport === 'object' && !Array.isArray(d.rawImport)) {
        mergeUnmodeledFields(built, d.rawImport);
    }
    return built;
}

function buildAsyncApi2Json(d) {
    const out = {
        asyncapi: d.asyncApiVersion || '2.6.0',
        info: {
            title: d.name || 'Untitled AsyncAPI',
            version: d.version || '1.0.0',
            ...(d.description ? { description: d.description } : {}),
            ...(Array.isArray(d.tags) && d.tags.length ? { tags: d.tags.map((t) => ({ name: t })) } : {})
        },
        servers: {},
        channels: {}
    };
    for (const s of (d.servers || [])) {
        out.servers[s.name || 'server'] = {
            url: s.url || '',
            protocol: s.protocol || 'websocket',
            ...(s.description ? { description: s.description } : {}),
            ...(s.security ? { security: s.security } : {})
        };
    }
    for (const c of (d.channels || [])) {
        const channel = {};
        if (c.address) channel.address = c.address;
        if (c.description) channel.description = c.description;
        if (c.bindings && Object.keys(c.bindings).length) channel.bindings = c.bindings;
        // Attach publish/subscribe from operations on this channel.
        const ops = (d.operations || []).filter((op) => op.channelName === (c.name || c.address));
        for (const op of ops) {
            channel[op.action] = {
                ...(op.summary ? { summary: op.summary } : {}),
                ...(op.messageName ? { message: { name: op.messageName } } : {})
            };
        }
        out.channels[c.name || c.address || 'channel'] = channel;
    }
    if (Array.isArray(d.messages) && d.messages.length) {
        out.components = { messages: {} };
        for (const m of d.messages) {
            out.components.messages[m.name || 'message'] = {
                name: m.name || 'message',
                contentType: m.contentType || 'application/json',
                ...(m.payloadSchema && Object.keys(m.payloadSchema).length ? { payload: m.payloadSchema } : {})
            };
        }
    }
    return out;
}

function buildAsyncApi3Json(d) {
    const out = {
        asyncapi: d.asyncApiVersion || '3.0.0',
        info: {
            title: d.name || 'Untitled AsyncAPI',
            version: d.version || '1.0.0',
            ...(d.description ? { description: d.description } : {}),
            ...(Array.isArray(d.tags) && d.tags.length ? { tags: d.tags.map((t) => ({ name: t })) } : {})
        },
        servers: {},
        channels: {},
        operations: {}
    };
    for (const s of (d.servers || [])) {
        // ponytail: 3.x spec splits host/protocol/pathname; Pigeon doesn't need
        // strict splitting — emit host=full url, consumers tolerate it.
        out.servers[s.name || 'server'] = {
            host: s.url || '',
            protocol: s.protocol || 'websocket',
            ...(s.description ? { description: s.description } : {}),
            ...(s.security ? { security: s.security } : {})
        };
    }
    for (const c of (d.channels || [])) {
        const key = c.name || c.address || 'channel';
        const ops = (d.operations || []).filter((op) => op.channelName === (c.name || c.address));
        const messages = {};
        for (const op of ops) {
            if (op.messageName) messages[op.messageName] = { $ref: `#/components/messages/${op.messageName}` };
        }
        out.channels[key] = {
            address: c.address || key,
            ...(c.description ? { description: c.description } : {}),
            ...(c.bindings && Object.keys(c.bindings).length ? { bindings: c.bindings } : {}),
            ...(Object.keys(messages).length ? { messages } : {})
        };
    }
    for (const op of (d.operations || [])) {
        const action = op.action === 'publish' ? 'send' : op.action === 'subscribe' ? 'receive' : (op.action || 'send');
        const key = `${op.channelName || 'channel'}-${action}`;
        out.operations[key] = {
            action,
            channel: { $ref: `#/channels/${op.channelName || 'channel'}` },
            ...(op.summary ? { summary: op.summary } : {}),
            ...(op.messageName ? { messages: [{ $ref: `#/components/messages/${op.messageName}` }] } : {})
        };
    }
    if (Array.isArray(d.messages) && d.messages.length) {
        out.components = { messages: {} };
        for (const m of d.messages) {
            out.components.messages[m.name || 'message'] = buildComponentMessage3(m);
        }
    }
    return out;
}

function buildComponentMessage3(m) {
    return {
        ...(m.title ? { title: m.title } : {}),
        ...(m.description ? { description: m.description } : {}),
        contentType: m.contentType || 'application/json',
        ...(m.payloadSchema && Object.keys(m.payloadSchema).length ? { payload: m.payloadSchema } : {}),
        ...(m.headersSchema && Object.keys(m.headersSchema).length ? { headers: m.headersSchema } : {})
    };
}

/**
 * Copy fields Pigeon doesn't model (contact/license/termsOfService/
 * externalDocs, defaultContentType, x-* extensions, non-message components)
 * from the original import into the freshly-built export, without ever
 * overriding servers/channels/messages/operations/info.
 */
function mergeUnmodeledFields(built, rawImport) {
    const info = rawImport.info;
    if (info && typeof info === 'object') {
        built.info = built.info || {};
        for (const key of ['contact', 'license', 'termsOfService', 'externalDocs']) {
            if (info[key] !== undefined && built.info[key] === undefined) built.info[key] = info[key];
        }
    }
    if (rawImport.defaultContentType !== undefined && built.defaultContentType === undefined) {
        built.defaultContentType = rawImport.defaultContentType;
    }
    if (rawImport.externalDocs !== undefined && built.externalDocs === undefined) {
        built.externalDocs = rawImport.externalDocs;
    }
    if (rawImport.components && typeof rawImport.components === 'object') {
        const extraComponents = { ...rawImport.components };
        delete extraComponents.messages; // messages are always rebuilt live
        if (Object.keys(extraComponents).length) {
            built.components = { ...(built.components || {}), ...extraComponents };
        }
    }
    for (const key of Object.keys(rawImport)) {
        if (key.startsWith('x-') && built[key] === undefined) built[key] = rawImport[key];
    }
}

module.exports = { denormalizeToAsyncApiJson };