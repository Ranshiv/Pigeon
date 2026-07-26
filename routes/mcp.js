const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const McpConnectionProfile = require('../models/McpConnectionProfile');
const McpHistory = require('../models/McpHistory');
const mcp = require('../services/McpHttpService');
const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');
const collectionMcpServer = require('../services/CollectionMcpServerService');

const MAX_HISTORY_PAYLOAD_BYTES = 100000;

const limitHistoryValue = (value) => {
    if (value === undefined) return undefined;
    try {
        const serialized = JSON.stringify(value);
        if (serialized.length <= MAX_HISTORY_PAYLOAD_BYTES) return JSON.parse(serialized);
        return {
            truncated: true,
            preview: serialized.slice(0, MAX_HISTORY_PAYLOAD_BYTES),
            originalSize: serialized.length
        };
    } catch {
        return { unavailable: true };
    }
};

const recordHistory = async (req, { action, result, error, startedAt, target, input }) => {
    const serverUrl = result?.connection?.url || req.body?.url;
    if (!serverUrl || !req.user?.id) return;

    try {
        await McpHistory.create({
            userId: req.user.id,
            serverUrl,
            serverName: result?.connection?.serverInfo?.name || '',
            action,
            target: target || '',
            input: limitHistoryValue(input),
            result: limitHistoryValue(result?.result || result?.catalog || result?.connection),
            success: !error,
            error: error?.message || '',
            durationMs: Date.now() - startedAt
        });
    } catch (historyError) {
        // A history write must never prevent a user from operating an MCP server.
        console.error('Unable to record MCP history:', historyError.message);
    }
};

const runMcpAction = (action, operation, getTarget, getInput, fallbackMessage) => async (req, res) => {
    const startedAt = Date.now();
    try {
        const result = await operation(req.body || {});
        await recordHistory(req, {
            action,
            result,
            startedAt,
            target: getTarget(req.body || {}),
            input: getInput(req.body || {})
        });
        res.json(result);
    } catch (error) {
        await recordHistory(req, {
            action,
            error,
            startedAt,
            target: getTarget(req.body || {}),
            input: getInput(req.body || {})
        });
        res.status(400).json({ message: error.message || fallbackMessage, trace: error.mcpTrace });
    }
};

const getUserIdVariants = (user) => {
    const id = String(user?.id || user?._id || '');
    if (!id) return [];
    return ObjectId.isValid(id) ? [id, new ObjectId(id)] : [id];
};

const getManagedCollection = async (collectionId, user) => {
    if (!ObjectId.isValid(collectionId)) return null;
    const db = getDb();
    if (!db) throw new Error('Database not initialized');

    const userIds = getUserIdVariants(user);
    if (!userIds.length) return null;
    return db.collection('collections').findOne({
        _id: new ObjectId(collectionId),
        $or: [
            { userId: { $in: userIds } },
            { owner: { $in: userIds } },
            { collaborators: { $elemMatch: { userId: { $in: userIds }, role: { $in: ['editor', 'admin'] } } } }
        ]
    });
};

const getMcpServerEndpoint = (req, collectionId) => {
    const configuredBaseUrl = String(process.env.PUBLIC_APP_URL || '').replace(/\/$/, '');
    const inferredBaseUrl = `${req.protocol}://${req.get('host')}`;
    return `${configuredBaseUrl || inferredBaseUrl}/api/mcp-server/collections/${collectionId}`;
};

const buildMcpServerManagementResponse = (req, collection) => {
    const collectionId = String(collection._id);
    return {
        configuration: collectionMcpServer.publicConfig(collection, getMcpServerEndpoint(req, collectionId)),
        requests: collectionMcpServer.getEligibleRequests(collection).map((request) => ({
            id: String(request._id || request.id),
            name: request.name || 'Unnamed request',
            description: request.description || '',
            method: request.method || 'GET',
            url: request.url || ''
        }))
    };
};

router.get('/servers/collections/:collectionId', ensureAuthenticated, async (req, res) => {
    try {
        const collection = await getManagedCollection(req.params.collectionId, req.user);
        if (!collection) return res.status(404).json({ message: 'Collection not found or you do not have permission to configure its MCP server.' });
        return res.json(buildMcpServerManagementResponse(req, collection));
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Unable to load the collection MCP server.' });
    }
});

router.put('/servers/collections/:collectionId', ensureAuthenticated, async (req, res) => {
    try {
        const collection = await getManagedCollection(req.params.collectionId, req.user);
        if (!collection) return res.status(404).json({ message: 'Collection not found or you do not have permission to configure its MCP server.' });

        const current = collectionMcpServer.getConfig(collection);
        const body = req.body || {};
        const name = body.name === undefined ? (current.name || `${collection.name || 'Collection'} MCP Server`) : String(body.name).trim();
        const description = body.description === undefined ? current.description : String(body.description).trim();
        const enabled = body.enabled === undefined ? current.enabled : body.enabled;
        const rawRequestIds = body.requestIds === undefined ? current.requestIds : body.requestIds;

        if (typeof enabled !== 'boolean') return res.status(400).json({ message: 'Enabled must be true or false.' });
        if (!name || name.length > 100) return res.status(400).json({ message: 'Server name must be between 1 and 100 characters.' });
        if (description.length > 500) return res.status(400).json({ message: 'Server description must be 500 characters or fewer.' });
        if (!Array.isArray(rawRequestIds) || rawRequestIds.length > 100) return res.status(400).json({ message: 'Choose up to 100 collection requests to expose.' });

        const requestIds = [...new Set(rawRequestIds.map(String))];
        const eligibleIds = new Set(collectionMcpServer.getEligibleRequests(collection).map((request) => String(request._id || request.id)));
        if (requestIds.some((requestId) => !eligibleIds.has(requestId))) {
            return res.status(400).json({ message: 'Only HTTP requests from this collection can be exposed as MCP tools.' });
        }
        if (enabled && requestIds.length === 0) return res.status(400).json({ message: 'Select at least one HTTP request before enabling the MCP server.' });

        const now = new Date();
        const nextConfig = {
            ...current,
            enabled,
            name,
            description,
            requestIds,
            createdAt: current.createdAt || now,
            updatedAt: now
        };
        const db = getDb();
        await db.collection('collections').updateOne(
            { _id: collection._id },
            { $set: { 'metadata.mcpServer': nextConfig, updatedAt: now } }
        );

        const updatedCollection = {
            ...collection,
            metadata: { ...(collection.metadata || {}), mcpServer: nextConfig }
        };
        return res.json(buildMcpServerManagementResponse(req, updatedCollection));
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Unable to save the collection MCP server.' });
    }
});

router.post('/servers/collections/:collectionId/token', ensureAuthenticated, async (req, res) => {
    try {
        const collection = await getManagedCollection(req.params.collectionId, req.user);
        if (!collection) return res.status(404).json({ message: 'Collection not found or you do not have permission to configure its MCP server.' });

        const current = collectionMcpServer.getConfig(collection);
        const accessToken = collectionMcpServer.createAccessToken();
        const now = new Date();
        const nextConfig = {
            ...current,
            name: current.name || `${collection.name || 'Collection'} MCP Server`,
            description: current.description || '',
            accessTokenHash: collectionMcpServer.hashAccessToken(accessToken),
            tokenLastFour: accessToken.slice(-4),
            createdAt: current.createdAt || now,
            updatedAt: now,
            lastRotatedAt: now
        };
        const db = getDb();
        await db.collection('collections').updateOne(
            { _id: collection._id },
            { $set: { 'metadata.mcpServer': nextConfig, updatedAt: now } }
        );

        const updatedCollection = {
            ...collection,
            metadata: { ...(collection.metadata || {}), mcpServer: nextConfig }
        };
        return res.json({
            ...buildMcpServerManagementResponse(req, updatedCollection),
            accessToken
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Unable to generate a collection MCP access token.' });
    }
});

router.get('/profiles', ensureAuthenticated, async (req, res) => {
    try {
        const profiles = await McpConnectionProfile.find({ userId: req.user.id })
            .sort({ updatedAt: -1 })
            .select('name url protocolVersion createdAt updatedAt');
        res.json(profiles);
    } catch (error) {
        res.status(500).json({ message: 'Unable to load MCP connection profiles.' });
    }
});

router.post('/profiles', ensureAuthenticated, async (req, res) => {
    try {
        const { name, url, protocolVersion } = req.body || {};
        if (!name || !String(name).trim()) throw new Error('A profile name is required.');

        const profile = await McpConnectionProfile.create({
            userId: req.user.id,
            name: String(name).trim(),
            url: mcp.validateServerUrl(url),
            protocolVersion: protocolVersion || '2025-03-26'
        });
        res.status(201).json(profile);
    } catch (error) {
        res.status(error?.code === 11000 ? 409 : 400).json({
            message: error?.code === 11000 ? 'A profile with this name already exists.' : error.message || 'Unable to save the MCP connection profile.'
        });
    }
});

router.delete('/profiles/:id', ensureAuthenticated, async (req, res) => {
    try {
        const deleted = await McpConnectionProfile.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        if (!deleted) return res.status(404).json({ message: 'MCP connection profile not found.' });
        return res.json({ message: 'MCP connection profile deleted.' });
    } catch (error) {
        return res.status(400).json({ message: 'Invalid MCP connection profile.' });
    }
});

router.get('/history', ensureAuthenticated, async (req, res) => {
    try {
        const history = await McpHistory.find({ userId: req.user.id })
            .sort({ createdAt: -1 })
            .limit(50);
        res.json(history);
    } catch (error) {
        res.status(500).json({ message: 'Unable to load MCP history.' });
    }
});

router.delete('/history', ensureAuthenticated, async (req, res) => {
    try {
        await McpHistory.deleteMany({ userId: req.user.id });
        res.json({ message: 'MCP history cleared.' });
    } catch (error) {
        res.status(500).json({ message: 'Unable to clear MCP history.' });
    }
});

router.post('/connect', ensureAuthenticated, runMcpAction(
    'connect',
    mcp.connect,
    () => '',
    () => ({}),
    'Unable to connect to the MCP server.'
));

router.post('/tools/call', ensureAuthenticated, runMcpAction(
    'tools/call',
    mcp.callTool,
    (body) => body.name,
    (body) => body.arguments,
    'Unable to call the MCP tool.'
));

router.post('/resources/read', ensureAuthenticated, runMcpAction(
    'resources/read',
    mcp.readResource,
    (body) => body.uri,
    (body) => ({ uri: body.uri }),
    'Unable to read the MCP resource.'
));

router.post('/prompts/get', ensureAuthenticated, runMcpAction(
    'prompts/get',
    mcp.getPrompt,
    (body) => body.name,
    (body) => body.arguments,
    'Unable to retrieve the MCP prompt.'
));

module.exports = router;
