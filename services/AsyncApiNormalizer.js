// services/AsyncApiNormalizer.js
// AsyncAPI 2.x / 3.x -> Pigeon normalisation. Split out of AsyncApiValidator.js
// to keep each file under 500 lines. Pure (no DB). Uses the redaction helpers
// and LIMITS re-exported by AsyncApiValidator.

const { LIMITS, redactSensitiveValues, redactBody, truncate } = require('./AsyncApiRedact');

const SUPPORTED_VERSIONS = new Set(['2.0.0', '2.1.0', '2.2.0', '2.3.0', '2.4.0', '2.5.0', '2.6.0', '3.0.0']);

function asString(v) { return typeof v === 'string' ? v : (v == null ? '' : String(v)); }

/**
 * Normalise a parsed 2.x or 3.x AsyncAPI JSON payload into the Pigeon document
 * shape (servers / channels / messages / operations). Preserves the original
 * payload under rawImport (with sensitive values redacted) for round-trip
 * export. Collects importWarnings for anything it cannot fully map.
 *
 * Pure — does no DB access.
 * @returns {Object}
 */
function normalizeAsyncApiDocument(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('AsyncAPI document must be a JSON object');
    }
    const asyncApiVersion = asString(payload.asyncapi);
    if (!asyncApiVersion) {
        throw new Error('Missing `asyncapi` version field — is this an AsyncAPI document?');
    }
    if (!SUPPORTED_VERSIONS.has(asyncApiVersion)) {
        throw new Error(`Unsupported AsyncAPI version: ${asyncApiVersion}. Supported: 2.x and 3.0.0`);
    }

    const warnings = [];
    const isV3 = asyncApiVersion.startsWith('3.');

    const servers = extractServers(payload, warnings);
    const { messages, messageByName } = extractMessages(payload, isV3, warnings);
    const channels = extractChannels(payload, messages, isV3, warnings);
    const operations = extractOperations(payload, channels, isV3, warnings);

    // Round-trip: keep the original (redacted) so export can re-emit fields we
    // don't model (bindings, traits, security schemes, schema refs).
    const rawImport = redactSensitiveValues(payload);

    // Surface unresolved $ref occurrences (we don't resolve them server-side).
    const refHits = countRefs(payload);
    if (refHits > 0) warnings.push(`${refHits} $ref pointer(s) found are preserved verbatim in rawImport — Pigeon does not resolve component refs during import.`);

    return {
        name: asString(payload.info?.title || 'Untitled AsyncAPI'),
        description: asString(payload.info?.description || ''),
        version: asString(payload.info?.version || '1.0.0'),
        asyncApiVersion,
        servers: servers.slice(0, LIMITS.maxServers),
        channels: channels.slice(0, LIMITS.maxChannels),
        messages: messages.slice(0, LIMITS.maxMessages),
        operations: operations.slice(0, LIMITS.maxOperations),
        tags: (Array.isArray(payload.info?.tags) ? payload.info.tags.map((t) => asString(t.name || t)).filter(Boolean) : []).slice(0, LIMITS.maxTags),
        rawImport,
        importWarnings: warnings
    };
}

function extractServers(payload, warnings) {
    const servers = [];
    const entries = payload.servers || {};
    if (Array.isArray(entries)) {
        // 3.x supports servers as array
        entries.forEach((srv, i) => {
            if (!srv) return;
            servers.push(normalizeServer(String(srv.host ? `${srv.host}` : (srv.url || '')), srv, i));
        });
    } else if (entries && typeof entries === 'object') {
        // 2.x servers is an object keyed by name
        for (const [name, srv] of Object.entries(entries)) {
            servers.push(normalizeServer(name, srv, servers.length));
        }
    }
    return servers;
}

function normalizeServer(name, srv, fallbackIndex) {
    const protocol = pickProtocol(srv);
    // Redact credential values inside security schemes.
    const security = redactSecurity(srv);
    const url = asString(srv.url || srv.host || '');
    return {
        name: asString(name || `server${fallbackIndex}`),
        url,
        protocol,
        description: asString(srv.description || ''),
        security
    };
}

function pickProtocol(srv) {
    const raw = asString((srv && (srv.protocol || srv.protocolVersion)) || '').toLowerCase();
    const allowed = ['websocket', 'socketio', 'mqtt', 'http', 'kafka', 'amqp', 'amqps', 'nats', 'stomp', 'other'];
    if (allowed.includes(raw)) return raw;
    // Heuristic from URL scheme.
    if (raw === 'ws' || /^wss?:/i.test(asString(srv?.url || ''))) return 'websocket';
    if (raw === 'mqtts' || /^mqtts?:/i.test(asString(srv?.url || ''))) return 'mqtt';
    if (raw === 'https' || /^https?:/i.test(asString(srv?.url || ''))) return 'http';
    if (raw === 'amqp') return 'amqp';
    return raw || 'other';
}

function redactSecurity(srv) {
    const sec = srv?.security;
    if (!sec) return '';
    try {
        const redacted = redactSensitiveValues(sec);
        return truncate(JSON.stringify(redacted), 512);
    } catch {
        return '';
    }
}

function extractChannels(payload, messages, isV3, warnings) {
    const channels = [];
    const raw = payload.channels || {};
    if (!raw || typeof raw !== 'object') return channels;
    if (Array.isArray(raw)) {
        for (const ch of raw) {
            if (!ch) continue;
            const name = asString(ch.name || ch.address || '');
            channels.push({
                name,
                address: asString(ch.address || ch.name || ''),
                description: asString(ch.description || ''),
                bindings: redactSensitiveValues(ch.bindings || {})
            });
            warnUnmodeledChannelFields(warnings, name, ch);
        }
        return channels;
    }
    for (const [name, ch] of Object.entries(raw)) {
        if (!ch || typeof ch !== 'object') {
            warnings.push(`Channel \`${name}\` is malformed and was skipped.`);
            continue;
        }
        // 2.x channels may carry messages/subscribe/publish inline.
        channels.push({
            name,
            address: asString(ch.address || name),
            description: asString(ch.description || ''),
            bindings: redactSensitiveValues(ch.bindings || {})
        });
        if (isV3) warnUnmodeledChannelFields(warnings, name, ch);
    }
    return channels;
}

/**
 * Push a specific warning only when a 3.x channel carries fields Pigeon doesn't
 * model (parameters / server restrictions). Replaces the old blanket "3.x
 * restructured" notice so a clean import stays silent.
 */
function warnUnmodeledChannelFields(warnings, name, ch) {
    const hasParams = ch.parameters && typeof ch.parameters === 'object' && Object.keys(ch.parameters).length > 0;
    const hasServers = Array.isArray(ch.servers) && ch.servers.length > 0;
    if (!hasParams && !hasServers) return;
    const parts = [];
    if (hasParams) parts.push('parameters');
    if (hasServers) parts.push('a server restriction');
    warnings.push(`Channel \`${name}\` has ${parts.join(' and ')} that Pigeon does not model in the designer — preserved in rawImport only.`);
}

function extractMessages(payload, isV3, warnings) {
    const messages = [];
    const messageByName = new Map();
    const components = payload.components?.messages || {};

    // Components first so channel message refs can resolve by name.
    for (const [name, msg] of Object.entries(components)) {
        if (!msg || typeof msg !== 'object') continue;
        const m = normalizeMessage(name, msg);
        messages.push(m); messageByName.set(name, m);
    }

    function collectFromChannel(chName, ch) {
        const kinds = isV3 ? (ch ? ch.messages : null) : ch;
        const list = [];
        // 2.x: ch.subscribe / ch.publish each carry .message (single) or .message.oneOf (array)
        // 3.x: ch.messages is an object of refs/name -> message
        if (isV3 && ch && ch.messages && typeof ch.messages === 'object') {
            for (const [name, ref] of Object.entries(ch.messages)) {
                const msg = ref?.$ref ? resolveRef(payload, ref.$ref, 'message') : ref;
                if (msg) list.push([name, msg]);
            }
        } else if (ch && (ch.subscribe || ch.publish)) {
            for (const slot of [ch.subscribe, ch.publish]) {
                if (slot && slot.message) {
                    const m = slot.message;
                    if (Array.isArray(m.oneOf)) {
                        m.oneOf.forEach((one, i) => list.push([`${chName}-${slot.action || 'msg'}-${i}`, one]));
                    } else {
                        list.push([m.name || `${chName}-msg`, m]);
                    }
                }
            }
        }
        return list;
    }

    const channels = payload.channels || {};
    const channelEntries = Array.isArray(channels) ? channels.map((c) => [c.name || c.address || '', c]) : Object.entries(channels);
    for (const [chName, ch] of channelEntries) {
        if (!ch) continue;
        const collected = collectFromChannel(chName, ch);
        for (const [name, raw] of collected) {
            const resolved = raw?.$ref ? resolveRef(payload, raw.$ref, 'message') : raw;
            if (!resolved) continue;
            const m = normalizeMessage(name, resolved);
            if (!messageByName.has(m.name)) {
                messages.push(m);
                messageByName.set(m.name, m);
            }
        }
    }

    if (messages.length === 0) warnings.push('No messages were found — add at least one message per channel to test it.');
    return { messages, messageByName };
}

function normalizeMessage(name, msg) {
    const payloadSchema = msg?.payload && typeof msg.payload === 'object'
        ? redactSensitiveValues(msg.payload)
        : {};
    const headersSchema = msg?.headers && typeof msg.headers === 'object'
        ? redactSensitiveValues(msg.headers)
        : {};
    let payloadExample = '';
    if (msg?.payload?.$examples ?? msg?.examples) {
        const ex = Array.isArray(msg.examples) ? msg.examples[0] : (msg.payload?.$examples?.[0] || msg.example);
        if (ex) payloadExample = redactBody(typeof ex === 'string' ? ex : JSON.stringify(ex));
    }
    // payloadExample may also be inline under `examples` on the message root.
    if (!payloadExample && Array.isArray(msg?.examples) && msg.examples.length) {
        payloadExample = redactBody(typeof msg.examples[0] === 'string' ? msg.examples[0] : JSON.stringify(msg.examples[0]));
    }
    return {
        name: asString(name || msg?.name || 'message'),
        title: asString(msg?.title || ''),
        description: asString(msg?.description || ''),
        contentType: asString(msg?.contentType || 'application/json'),
        payloadSchema,
        payloadExample,
        headersSchema,
        headersExample: ''
    };
}

function extractOperations(payload, channels, isV3, warnings) {
    const operations = [];
    // 3.x has a top-level `operations` array; 2.x derives operations from channel publish/subscribe.
    if (Array.isArray(payload.operations)) {
        for (const op of payload.operations) {
            if (!op) continue;
            const channelPtr = op.channel?.$ref || op.channel || '';
            const channelName = ptrLeaf(channelPtr);
            operations.push({
                channelName: asString(channelName || ''),
                action: op.action === 'send' ? 'publish' : op.action === 'receive' ? 'subscribe' : (op.action || 'publish'),
                messageName: ptrLeaf(op.messages?.$ref || (Array.isArray(op.messages) ? op.messages[0]?.$ref : '') || ''),
                summary: asString(op.title || op.summary || '')
            });
            warnUnmodeledOperationFields(warnings, channelName, op);
        }
        return operations;
    }

    const channelList = Array.isArray(channels) ? channels : [];
    // 2.x: derive operations from the RAW payload channels (publish/subscribe
    // fields are stripped off by extractChannels above, so we can't read them
    // back from the normalized array).
    const rawChannels = payload.channels || {};
    if (rawChannels && typeof rawChannels === 'object' && !Array.isArray(rawChannels)) {
        for (const [name, ch] of Object.entries(rawChannels)) {
            if (!ch) continue;
            if (ch.publish) operations.push({ channelName: name, action: 'publish', messageName: leafFromMessage(ch.publish.message) || '', summary: asString(ch.publish.summary || '') });
            if (ch.subscribe) operations.push({ channelName: name, action: 'subscribe', messageName: leafFromMessage(ch.subscribe.message) || '', summary: asString(ch.subscribe.summary || '') });
        }
    } else {
        for (const ch of channelList) {
            // 3.x channel — operations are defined separately; emit a stub join.
            operations.push({ channelName: asString(ch.name || ''), action: 'publish', messageName: '', summary: '' });
        }
    }
    if (operations.length === 0) warnings.push('No operations were inferred — declare publish/subscribe on channels for 2.x, or an operations[] array for 3.x.');
    return operations;
}

function leafFromMessage(message) {
    if (!message) return '';
    if (message.$ref) return ptrLeaf(message.$ref);
    if (message.name) return message.name;
    if (Array.isArray(message.oneOf) && message.oneOf[0]?.$ref) return ptrLeaf(message.oneOf[0].$ref);
    if (Array.isArray(message.oneOf) && message.oneOf[0]?.name) return message.oneOf[0].name;
    return '';
}

/**
 * Push a specific warning only when a 3.x operation carries fields Pigeon
 * drops (reply / security / traits). Replaces the blanket "3.x restructured"
 * notice so a clean import stays silent.
 */
function warnUnmodeledOperationFields(warnings, channelName, op) {
    const dropped = ['reply', 'security', 'traits'].filter((k) => op[k] !== undefined && op[k] !== null);
    if (!dropped.length) return;
    warnings.push(`Operation on channel \`${channelName || '(unknown)'}\` has ${dropped.join('/')} that Pigeon does not model — preserved in rawImport only.`);
}

function ptrLeaf(ptr) {
    if (typeof ptr !== 'string' || !ptr) return '';
    const parts = ptr.split('/');
    return parts[parts.length - 1] || '';
}

function resolveRef(root, ref, kind) {
    if (typeof ref !== 'string' || !ref.startsWith('#/')) return null;
    const parts = ref.slice(2).split('/');
    let node = root;
    for (const part of parts) {
        if (!node || typeof node !== 'object') return null;
        node = node[decodeURIComponent(part)];
    }
    return node && typeof node === 'object' ? node : null;
}

function countRefs(node) {
    let count = 0;
    const walk = (n) => {
        if (Array.isArray(n)) return n.forEach(walk);
        if (n && typeof n === 'object') {
            if (typeof n.$ref === 'string') count += 1;
            for (const v of Object.values(n)) walk(v);
        }
    };
    walk(node);
    return count;
}

module.exports = { normalizeAsyncApiDocument };