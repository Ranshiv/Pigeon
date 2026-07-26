const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const McpConnectionProfile = require('../models/McpConnectionProfile');
const McpHistory = require('../models/McpHistory');
const mcp = require('../services/McpHttpService');

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
