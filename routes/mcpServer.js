const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');
const collectionMcpServer = require('../services/CollectionMcpServerService');

const router = express.Router();

const jsonRpcError = (res, id, code, message, status = 200) => res.status(status).json({
    jsonrpc: '2.0',
    id: id ?? null,
    error: { code, message }
});

const isNotification = (message) => !Object.prototype.hasOwnProperty.call(message, 'id');

const readBearerToken = (header) => {
    const match = /^Bearer\s+(.+)$/i.exec(String(header || '').trim());
    return match ? match[1].trim() : '';
};

const sendResult = (res, message, result) => {
    if (isNotification(message)) return res.status(202).end();
    return res.json({ jsonrpc: '2.0', id: message.id, result });
};

const loadEnabledCollection = async (collectionId, token) => {
    if (!ObjectId.isValid(collectionId)) return null;
    const db = getDb();
    if (!db) throw new Error('Database not initialized');

    const collection = await db.collection('collections').findOne({ _id: new ObjectId(collectionId) });
    const config = collectionMcpServer.getConfig(collection);
    if (!collection || !config.enabled || !config.accessTokenHash || !collectionMcpServer.matchesAccessToken(token, config.accessTokenHash)) {
        return null;
    }
    return collection;
};

router.post('/collections/:collectionId', async (req, res) => {
    res.set('Cache-Control', 'no-store');

    const token = readBearerToken(req.get('authorization'));
    if (!token) {
        res.set('WWW-Authenticate', 'Bearer');
        return res.status(401).json({ message: 'A collection MCP bearer token is required.' });
    }

    let collection;
    try {
        collection = await loadEnabledCollection(req.params.collectionId, token);
    } catch (error) {
        return res.status(503).json({ message: 'The collection MCP server is temporarily unavailable.' });
    }
    if (!collection) {
        res.set('WWW-Authenticate', 'Bearer');
        return res.status(401).json({ message: 'Invalid collection MCP token or server unavailable.' });
    }

    const message = req.body;
    if (!message || Array.isArray(message) || typeof message !== 'object' || message.jsonrpc !== '2.0' || !message.method) {
        return jsonRpcError(res, message?.id, -32600, 'Invalid JSON-RPC request.');
    }

    const config = collectionMcpServer.getConfig(collection);
    const serverInfo = {
        name: config.name || `${collection.name || 'Collection'} MCP Server`,
        version: '1.0.0'
    };

    if (message.method === 'initialize') {
        return sendResult(res, message, {
            protocolVersion: collectionMcpServer.MCP_PROTOCOL_VERSION,
            capabilities: { tools: { listChanged: false } },
            serverInfo
        });
    }

    if (message.method === 'notifications/initialized') return sendResult(res, message, undefined);

    if (message.method === 'tools/list') {
        const tools = collectionMcpServer.buildToolCatalog(collection).map((entry) => entry.tool);
        return sendResult(res, message, { tools });
    }

    if (message.method === 'tools/call') {
        const params = message.params;
        if (!params || typeof params.name !== 'string') return jsonRpcError(res, message.id, -32602, 'A tool name is required.');
        try {
            const output = await collectionMcpServer.executeTool(collection, params.name, params.arguments || {});
            return sendResult(res, message, {
                content: [{
                    type: 'text',
                    text: `HTTP ${output.status} ${output.statusText}\n\n${output.body}`
                }],
                isError: output.status >= 400
            });
        } catch (error) {
            return sendResult(res, message, {
                content: [{ type: 'text', text: error.message || 'The collection request could not be completed.' }],
                isError: true
            });
        }
    }

    return jsonRpcError(res, message.id, -32601, `MCP method '${message.method}' is not supported.`);
});

module.exports = router;
