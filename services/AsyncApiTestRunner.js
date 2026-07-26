// services/AsyncApiTestRunner.js
// Protocol-aware AsyncAPI test execution. Does real I/O for protocols we own a
// client for (ws, mqtt, http); honestly reports "connector required" for the
// rest (kafka/amqp/amqps/nats/stomp) rather than faking success.
//
// Mirrors the honesty pattern from FUTURE_CONNECTORS in
// client/src/components/traceToTest/TraceImportPanel.js: unsupported paths
// return a structured "not configured" result so the UI can surface the gap.

const WebSocket = require('ws');
const mqttClient = require('mqtt');
const { redactBody, redactSensitiveValues } = require('./AsyncApiValidator');
const variableResolver = require('./VariableResolver');

// Connectors we genuinely cannot speak client-side without a new dependency.
const CONNECTOR_REQUIRED_PROTOCOLS = new Set(['kafka', 'amqp', 'amqps', 'nats', 'stomp']);

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_PAYLOAD_CHARS = 16 * 1024;

/**
 * Run one AsyncAPI test step.
 * @param {object} opts document (AsyncApiDocument-style raw or mongoose doc),
 *                      server ({ name, url, protocol }), channel ({ name, address }),
 *                      operation ({ action }), message ({ payloadSchema, ... }),
 *                      payload (string), headers (object), timeoutMs, environmentId
 *                      (unused here — caller resolves placeholders against the
 *                      Environment first, via resolvePlaceholders()),
 *                      scenario (optional AsyncApiScenario raw doc, for expected
 *                      fields) — when passed, schema + field validation run too.
 * @returns {object} see module header
 */
async function runAsyncApiTest(opts) {
    const startedAt = Date.now();
    const {
        document: doc,
        server,
        channel,
        operation,
        message,
        payload,
        headers,
        timeoutMs = DEFAULT_TIMEOUT_MS,
        expectedSchemaValidation = true,
        expectedFields = []
    } = opts || {};

    const protocol = String(server?.protocol || '').toLowerCase();
    const channelName = channel?.address || channel?.name || '';
    const opAction = operation?.action || '';
    const baseResult = {
        protocol,
        channel: channelName,
        operation: opAction,
        durationMs: 0,
        requestPayload: redactBody(payload || '', MAX_PAYLOAD_CHARS),
        responsePayload: '',
        error: null,
        timestamp: new Date().toISOString()
    };

    try {
        let outcome;
        if (CONNECTOR_REQUIRED_PROTOCOLS.has(protocol)) {
            outcome = connectorRequiredResult(protocol);
        } else if (protocol === 'websocket' || protocol === 'socketio') {
            outcome = await runWebSocket(server, channel, operation, payload, headers, timeoutMs);
        } else if (protocol === 'mqtt') {
            outcome = await runMqtt(server, channel, operation, message, payload, headers, timeoutMs);
        } else if (protocol === 'http') {
            outcome = await runHttp(server, channel, operation, message, payload, headers, timeoutMs);
        } else {
            outcome = {
                status: 'error',
                error: `Unsupported protocol: ${protocol || '(none)'}`
            };
        }

        const durationMs = Date.now() - startedAt;
        const violations = [];

        // Schema validation only when we actually got a response and have a schema.
        const schema = message?.payloadSchema;
        const hasSchema = schema && typeof schema === 'object' && Object.keys(schema).length > 0;
        if (expectedSchemaValidation && outcome.responseRaw !== undefined) {
            if (!hasSchema) {
                violations.push({
                    kind: 'schema',
                    path: '',
                    message: 'No schema to validate against — payload not validated',
                    expected: 'JSON-Schema payloadSchema',
                    actual: 'missing'
                });
            } else {
                const parsed = parseJson(outcome.responseRaw);
                if (parsed.ok) {
                    const { validatePayloadAgainstSchema } = require('./AsyncApiValidator');
                    const { validated, violations: schemaViolations } =
                        validatePayloadAgainstSchema(parsed.value, schema);
                    if (!validated) {
                        violations.push({ kind: 'schema', path: '', message: 'No schema to validate against — payload not validated', expected: 'JSON-Schema payloadSchema', actual: 'missing' });
                    } else {
                        for (const v of schemaViolations) violations.push({ kind: 'schema', ...v, breaking: true });
                    }
                } else if (outcome.responseRaw !== '' && outcome.responseRaw != null) {
                    violations.push({ kind: 'schema', path: '', message: 'Response was not valid JSON — schema could not be checked', expected: 'JSON', actual: 'non-JSON' });
                }
            }
        }

        // Field expectations reuse fieldExpectationSchema + getByPath.
        if (Array.isArray(expectedFields) && expectedFields.length > 0) {
            const parsed = parseJson(outcome.responseRaw);
            if (parsed.ok && parsed.value !== null && typeof parsed.value === 'object') {
                const { getByPath, typeOf } = require('./AsyncApiValidator');
                for (const f of expectedFields) {
                    if (!f || !f.path) continue;
                    const { found, value } = getByPath(parsed.value, f.path);
                    if (!found) {
                        if (f.required !== false) violations.push({ kind: 'field', path: f.path, message: `Expected field \`${f.path}\` is missing`, expected: 'present', actual: 'missing', breaking: true });
                        continue;
                    }
                    if (f.type && f.type !== 'any' && typeOf(value) !== f.type) {
                        violations.push({ kind: 'field', path: f.path, message: `Expected \`${f.path}\` to be ${f.type}, received ${typeOf(value)}`, expected: f.type, actual: typeOf(value), breaking: true });
                    }
                }
            }
        }

        const status = outcome.status === 'passed' && violations.length === 0
            ? 'passed'
            : (outcome.status === 'passed' ? 'failed' : outcome.status);

        return {
            ...baseResult,
            status,
            durationMs,
            requestPayload: redactBody(payload || '', MAX_PAYLOAD_CHARS),
            responsePayload: redactBody(outcome.responseRaw == null ? '' : outcome.responseRaw, MAX_PAYLOAD_CHARS),
            error: outcome.error || null,
            violations
        };
    } catch (err) {
        return {
            ...baseResult,
            status: 'error',
            durationMs: Date.now() - startedAt,
            error: err && err.message ? err.message : String(err),
            violations: [{ kind: 'transport', path: '', message: err && err.message ? err.message : String(err), expected: 'connection', actual: 'error', breaking: false }]
        };
    }
}

function connectorRequiredResult(protocol) {
    return {
        status: 'error',
        error: `Connector required: ${protocol} is not wired. Add a client/connector to execute ${protocol} tests.`,
        // Mark as a non-fatal notice: the UI uses warning styling for these.
        connectorRequired: true
    };
}

// ----------------------------------------------------------------- websocket

function runWebSocket(server, channel, operation, payload, headers, timeoutMs) {
    return new Promise((resolve) => {
        const url = String(server?.url || '');
        if (!/^wss?:\/\//i.test(url)) {
            return resolve({ status: 'error', error: `Invalid WebSocket URL: ${url}` });
        }
        let ws;
        let settled = false;
        let responseRaw = '';
        const finish = (status, err) => {
            if (settled) return;
            settled = true;
            try { if (ws) ws.terminate(); } catch { /* ignore */ }
            resolve({ status, responseRaw, error: err || null });
        };
        const timer = setTimeout(() => finish('failed', `Timed out after ${timeoutMs} ms`), timeoutMs);

        try {
            ws = new WebSocket(url, [], { headers: headers || {}, handshakeTimeout: timeoutMs });
        } catch (e) {
            clearTimeout(timer);
            return finish('error', `WebSocket init failed: ${e.message}`);
        }
        ws.on('open', () => {
            // 'subscribe' = consume; 'publish' = emit. For an echo server we
            // send the payload either way and listen for a reply.
            const body = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
            try { ws.send(body); } catch (e) { return finish('error', `Send failed: ${e.message}`); }
            if (operation?.action === 'subscribe' && !payload) {
                // Nothing to send; just wait for one inbound frame.
            }
        });
        ws.on('message', (data) => {
            responseRaw = Buffer.isBuffer(data) ? data.toString('utf8') : String(data);
            clearTimeout(timer);
            finish('passed');
        });
        ws.on('error', (err) => {
            clearTimeout(timer);
            finish('error', `WebSocket error: ${err && err.message ? err.message : String(err)}`);
        });
        ws.on('close', () => {
            // If we got nothing back and the socket closed cleanly, that's a
            // failure for an echo-style test but not an error.
            if (!settled) finish(responseRaw ? 'passed' : 'failed', responseRaw ? null : 'Server closed connection without a response');
        });
    });
}

// ----------------------------------------------------------------------- mqtt

function runMqtt(server, channel, operation, message, payload, headers, timeoutMs) {
    return new Promise((resolve) => {
        const url = String(server?.url || '');
        if (!/^mqtt(s)?:\/\//i.test(url)) {
            return resolve({ status: 'error', error: `Invalid MQTT URL: ${url}` });
        }
        const topic = String(channel?.address || channel?.name || '');
        if (!topic) return resolve({ status: 'error', error: 'MQTT test requires a channel address/topic' });

        let client;
        let settled = false;
        let responseRaw = '';
        const finish = (status, err) => {
            if (settled) return;
            settled = true;
            try { if (client) client.end(true); } catch { /* ignore */ }
            resolve({ status, responseRaw, error: err || null });
        };
        const timer = setTimeout(() => finish('failed', `Timed out after ${timeoutMs} ms`), timeoutMs);

        const opts = {
            clientId: `pigeon_asyncaPI_${Date.now().toString(36)}`,
            connectTimeout: timeoutMs,
            reconnectPeriod: 0
        };
        try {
            client = mqttClient.connect(url, opts);
        } catch (e) {
            clearTimeout(timer);
            return finish('error', `MQTT init failed: ${e.message}`);
        }

        client.on('connect', async () => {
            try {
                await subscribe(client, topic);
                // Subscribe-side: wait for a message. Publish-side: publish then also listen.
                if (operation?.action === 'publish' || payload) {
                    const body = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
                    await publishMessage(client, topic, body);
                }
                // Wait for one inbound message (echo on subscribed topic).
                client.on('message', (t, msg) => {
                    if (t !== topic) return;
                    responseRaw = Buffer.isBuffer(msg) ? msg.toString('utf8') : String(msg);
                    clearTimeout(timer);
                    finish('passed');
                });
            } catch (e) {
                clearTimeout(timer);
                finish('error', `MQTT step failed: ${e.message}`);
            }
        });
        client.on('error', (err) => {
            clearTimeout(timer);
            finish('error', `MQTT error: ${err && err.message ? err.message : String(err)}`);
        });
    });
}

function subscribe(client, topic) {
    return new Promise((resolve, reject) => {
        client.subscribe(topic, { qos: 0 }, (err) => err ? reject(err) : resolve());
    });
}
function publishMessage(client, topic, body) {
    return new Promise((resolve, reject) => {
        client.publish(topic, body, { qos: 0 }, (err) => err ? reject(err) : resolve());
    });
}

// ----------------------------------------------------------------------- http

async function runHttp(server, channel, operation, message, payload, headers, timeoutMs) {
    const axios = require('axios');
    const url = String(server?.url || '');
    if (!/^https?:\/\//i.test(url)) {
        return { status: 'error', error: `Invalid HTTP URL: ${url}` };
    }
    const path = String(channel?.address || channel?.name || '').replace(/^\//, '');
    const fullUrl = path ? `${url.replace(/\/$/, '')}/${path}` : url;
    const method = operation?.action === 'subscribe' ? 'GET' : 'POST';
    try {
        const res = await axios.request({
            method,
            url: fullUrl,
            data: payload || undefined,
            headers: headers || {},
            timeout: timeoutMs,
            validateStatus: () => true,
            transformResponse: [(d) => d] // keep raw string for schema check
        });
        const body = typeof res.data === 'string' ? res.data : (res.data == null ? '' : JSON.stringify(res.data));
        return { status: (res.status >= 200 && res.status < 500) ? 'passed' : 'failed', responseRaw: body, error: res.status >= 500 ? `Server responded ${res.status}` : null };
    } catch (e) {
        return { status: 'error', error: `HTTP request failed: ${e.message}` };
    }
}

// ------------------------------------------------------------------- helpers

function parseJson(text) {
    if (text === null || text === undefined || text === '') return { ok: false, value: null };
    try { return { ok: true, value: JSON.parse(text) }; } catch { return { ok: false, value: null }; }
}

/**
 * Resolve {{var}} placeholders using the project's full layered VariableResolver
 * (request -> environment -> collection -> global), scoped per-call via a
 * throwaway context. AsyncAPI documents aren't tied to a Collection, so
 * collectionId is omitted (that layer resolves to {}).
 */
async function withResolvedVariables({ userId, workspaceId, environmentId, requestLocalVariables = {} }, fn) {
    const contextId = `asyncapi_${String(userId)}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    await variableResolver.createContext(contextId, { userId, workspaceId, environmentId, requestLocalVariables });
    try {
        return fn((template) => variableResolver.replaceVariables(contextId, typeof template === 'string' ? template : String(template ?? '')));
    } finally {
        variableResolver.destroyContext(contextId);
    }
}

module.exports = {
    runAsyncApiTest,
    withResolvedVariables,
    CONNECTOR_REQUIRED_PROTOCOLS,
    DEFAULT_TIMEOUT_MS
};
