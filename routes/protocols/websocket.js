// routes/protocols/websocket.js
const express = require('express');
const router = express.Router();
const WebSocketService = require('../../services/protocols/WebSocketService');
const ProtocolSession = require('../../models/ProtocolSession');

/**
 * WebSocket Protocol Routes
 * Provides endpoints for WebSocket connection management and messaging
 */

/**
 * POST /api/protocols/websocket/connect
 * Establish a new WebSocket connection
 */
router.post('/connect', async (req, res) => {
    try {
        const { url, headers, subprotocol, options } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'WebSocket URL is required'
            });
        }

        const connectionResult = await WebSocketService.connect(url, {
            headers: headers || {},
            subprotocol,
            ...options
        });

        // Extract connectionId from result (service returns an object)
        const connectionId = connectionResult.connectionId || connectionResult;

        // Create session record
        const session = new ProtocolSession({
            sessionId: String(connectionId),
            protocol: 'websocket',
            endpoint: url,
            state: 'connecting',
            userId: req.user?._id,
            workspaceId: req.body.workspaceId,
            websocket: {
                subprotocol: subprotocol || ''
            }
        });
        await session.save();

        res.json({
            success: true,
            connectionId,
            message: 'WebSocket connection initiated',
            session: session._id
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * POST /api/protocols/websocket/:connectionId/send
 * Send a message through an existing WebSocket connection
 */
router.post('/:connectionId/send', async (req, res) => {
    try {
        const { connectionId } = req.params;
        const { message, type } = req.body;

        if (message === undefined || message === null) {
            return res.status(400).json({
                success: false,
                error: 'Message is required'
            });
        }

        await WebSocketService.send(connectionId, message);

        // Update session
        const session = await ProtocolSession.findOne({ sessionId: connectionId });
        if (session) {
            session.addMessage({
                direction: 'outgoing',
                type: type || 'text',
                content: message
            });
            await session.save();
        }

        res.json({
            success: true,
            message: 'Message sent successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/protocols/websocket/:connectionId
 * Close a WebSocket connection
 */
router.delete('/:connectionId', async (req, res) => {
    try {
        const { connectionId } = req.params;
        const { code, reason } = req.body;

        await WebSocketService.disconnect(connectionId, code, reason);

        // Update session
        const session = await ProtocolSession.findOne({ sessionId: connectionId });
        if (session) {
            session.updateState('closed');
            await session.save();
        }

        res.json({
            success: true,
            message: 'WebSocket connection closed'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/protocols/websocket/:connectionId/status
 * Get the status of a WebSocket connection
 */
router.get('/:connectionId/status', async (req, res) => {
    try {
        const { connectionId } = req.params;
        const session = await ProtocolSession.findOne({ sessionId: connectionId });

        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Connection not found'
            });
        }

        const metrics = WebSocketService.getMetrics(connectionId);

        res.json({
            success: true,
            connectionId,
            state: session.state,
            stats: session.stats,
            metrics,
            websocket: session.websocket
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/protocols/websocket/:connectionId/messages
 * Get message history for a WebSocket connection
 */
router.get('/:connectionId/messages', async (req, res) => {
    try {
        const { connectionId } = req.params;
        const { limit = 50, offset = 0, direction } = req.query;

        const session = await ProtocolSession.findOne({ sessionId: connectionId });

        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Connection not found'
            });
        }

        let messages = session.messages;
        if (direction && direction !== 'all') {
            messages = messages.filter(m => m.direction === direction);
        }

        const total = messages.length;
        messages = messages.slice(-parseInt(limit) - parseInt(offset), messages.length - parseInt(offset));

        res.json({
            success: true,
            messages,
            total,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/protocols/websocket/:connectionId/ping
 * Send a ping to test the connection
 */
router.post('/:connectionId/ping', async (req, res) => {
    try {
        const { connectionId } = req.params;
        const startTime = Date.now();

        await WebSocketService.ping(connectionId);

        const latency = Date.now() - startTime;

        // Update session
        const session = await ProtocolSession.findOne({ sessionId: connectionId });
        if (session) {
            session.updateLatency(latency);
            await session.save();
        }

        res.json({
            success: true,
            latency,
            message: 'Pong received'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/protocols/websocket/connections
 * List all active WebSocket connections
 */
router.get('/connections', async (req, res) => {
    try {
        const sessions = await ProtocolSession.find({
            protocol: 'websocket',
            userId: req.user?._id,
            state: { $in: ['connected', 'connecting', 'reconnecting'] }
        }).sort({ 'stats.lastActiveAt': -1 });

        res.json({
            success: true,
            connections: sessions,
            total: sessions.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/protocols/websocket/:connectionId/reconnect
 * Reconnect a closed WebSocket connection
 */
router.post('/:connectionId/reconnect', async (req, res) => {
    try {
        const { connectionId } = req.params;

        const session = await ProtocolSession.findOne({ sessionId: connectionId });
        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }

        const newConnectionId = await WebSocketService.connect(session.endpoint, {
            headers: req.body.headers || {},
            subprotocol: session.websocket?.subprotocol
        });

        session.sessionId = newConnectionId;
        session.updateState('connecting');
        await session.save();

        res.json({
            success: true,
            connectionId: newConnectionId,
            message: 'Reconnection initiated'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/protocols/websocket/:connectionId/messages
 * Clear message history for a connection
 */
router.delete('/:connectionId/messages', async (req, res) => {
    try {
        const { connectionId } = req.params;

        const session = await ProtocolSession.findOne({ sessionId: connectionId });
        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }

        session.clearMessages();
        await session.save();

        res.json({
            success: true,
            message: 'Message history cleared'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
