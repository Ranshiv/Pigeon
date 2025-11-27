// routes/protocols/sse.js
const express = require('express');
const router = express.Router();
const SseService = require('../../services/protocols/SseService');
const ProtocolSession = require('../../models/ProtocolSession');

/**
 * SSE (Server-Sent Events) Protocol Routes
 * Provides endpoints for SSE connection management and event streaming
 */

/**
 * POST /api/protocols/sse/connect
 * Connect to an SSE endpoint
 */
router.post('/connect', async (req, res) => {
    try {
        const {
            url,
            headers,
            lastEventId,
            withCredentials,
            eventTypes,
            options
        } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'SSE endpoint URL is required'
            });
        }

        const connectionResult = await SseService.connect(url, {
            headers: headers || {},
            lastEventId,
            withCredentials,
            eventTypes,
            ...options
        });

        // Extract connectionId from result (service returns an object)
        const connectionId = connectionResult.connectionId || connectionResult;

        // Create session record
        const session = new ProtocolSession({
            sessionId: String(connectionId),
            protocol: 'sse',
            endpoint: url,
            state: 'connecting',
            userId: req.user?._id,
            workspaceId: req.body.workspaceId,
            sse: {
                lastEventId: lastEventId || '',
                eventTypes: eventTypes || [],
                withCredentials: withCredentials || false
            }
        });
        await session.save();

        res.json({
            success: true,
            connectionId,
            message: 'SSE connection initiated'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/protocols/sse/:connectionId/listen
 * Add an event type listener
 */
router.post('/:connectionId/listen', async (req, res) => {
    try {
        const { connectionId } = req.params;
        const { eventType } = req.body;

        if (!eventType) {
            return res.status(400).json({
                success: false,
                error: 'Event type is required'
            });
        }

        await SseService.addEventListener(connectionId, eventType);

        // Update session
        const session = await ProtocolSession.findOne({ sessionId: connectionId });
        if (session && !session.sse.eventTypes.includes(eventType)) {
            session.sse.eventTypes.push(eventType);
            await session.save();
        }

        res.json({
            success: true,
            eventType,
            message: 'Event listener added'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/protocols/sse/:connectionId/listen/:eventType
 * Remove an event type listener
 */
router.delete('/:connectionId/listen/:eventType', async (req, res) => {
    try {
        const { connectionId, eventType } = req.params;

        await SseService.removeEventListener(connectionId, eventType);

        // Update session
        const session = await ProtocolSession.findOne({ sessionId: connectionId });
        if (session) {
            session.sse.eventTypes = session.sse.eventTypes.filter(t => t !== eventType);
            await session.save();
        }

        res.json({
            success: true,
            eventType,
            message: 'Event listener removed'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/protocols/sse/:connectionId/events
 * Get event history for a connection
 */
router.get('/:connectionId/events', async (req, res) => {
    try {
        const { connectionId } = req.params;
        const { eventType, limit = 50, since } = req.query;

        const session = await ProtocolSession.findOne({ sessionId: connectionId });
        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Connection not found'
            });
        }

        let messages = session.messages.filter(m => m.direction === 'incoming');

        if (eventType) {
            messages = messages.filter(m => m.content?.type === eventType);
        }

        if (since) {
            const sinceDate = new Date(since);
            messages = messages.filter(m => new Date(m.timestamp) > sinceDate);
        }

        messages = messages.slice(-parseInt(limit));

        res.json({
            success: true,
            events: messages,
            total: messages.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/protocols/sse/:connectionId/status
 * Get SSE connection status
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

        const metrics = SseService.getMetrics(connectionId);

        res.json({
            success: true,
            connectionId,
            state: session.state,
            stats: session.stats,
            metrics,
            sse: session.sse,
            eventCounts: session.sse.eventCounts
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/protocols/sse/:connectionId
 * Close an SSE connection
 */
router.delete('/:connectionId', async (req, res) => {
    try {
        const { connectionId } = req.params;

        await SseService.disconnect(connectionId);

        // Update session
        const session = await ProtocolSession.findOne({ sessionId: connectionId });
        if (session) {
            session.updateState('closed');
            await session.save();
        }

        res.json({
            success: true,
            message: 'SSE connection closed'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/protocols/sse/connections
 * List all active SSE connections
 */
router.get('/connections', async (req, res) => {
    try {
        const sessions = await ProtocolSession.find({
            protocol: 'sse',
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
 * POST /api/protocols/sse/:connectionId/reconnect
 * Reconnect to an SSE endpoint
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

        // Get last event ID for resumption
        const lastEventId = session.sse?.lastEventId || '';

        const newConnectionId = await SseService.connect(session.endpoint, {
            headers: req.body.headers || {},
            lastEventId,
            eventTypes: session.sse?.eventTypes || []
        });

        session.sessionId = newConnectionId;
        session.updateState('connecting');
        await session.save();

        res.json({
            success: true,
            connectionId: newConnectionId,
            message: 'Reconnection initiated',
            resumeFrom: lastEventId
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/protocols/sse/:connectionId/events
 * Clear event history for a connection
 */
router.delete('/:connectionId/events', async (req, res) => {
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
        session.sse.eventCounts = {};
        await session.save();

        res.json({
            success: true,
            message: 'Event history cleared'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/protocols/sse/:connectionId/event-types
 * Get all event types received on this connection
 */
router.get('/:connectionId/event-types', async (req, res) => {
    try {
        const { connectionId } = req.params;

        const session = await ProtocolSession.findOne({ sessionId: connectionId });
        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Connection not found'
            });
        }

        // Extract unique event types from messages
        const eventTypes = [...new Set(
            session.messages
                .filter(m => m.direction === 'incoming' && m.content?.type)
                .map(m => m.content.type)
        )];

        res.json({
            success: true,
            eventTypes,
            listening: session.sse.eventTypes,
            counts: session.sse.eventCounts
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/protocols/sse/test-endpoint
 * Test if an endpoint supports SSE
 */
router.post('/test-endpoint', async (req, res) => {
    try {
        const { url, headers } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL is required'
            });
        }

        // Make a HEAD request to check content type
        const axios = require('axios');
        const response = await axios.head(url, {
            headers: headers || {},
            timeout: 5000,
            validateStatus: () => true
        });

        const contentType = response.headers['content-type'] || '';
        const isSSE = contentType.includes('text/event-stream');

        res.json({
            success: true,
            url,
            supportsSSE: isSSE,
            contentType,
            statusCode: response.status,
            headers: response.headers
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            hint: 'Endpoint may not be reachable or does not support HEAD requests'
        });
    }
});

/**
 * GET /api/protocols/sse/demo
 * Demo SSE endpoint for testing - sends periodic events
 */
router.get('/demo', (req, res) => {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    let eventId = 0;
    const eventTypes = ['message', 'update', 'notification', 'heartbeat'];
    const sampleData = [
        { type: 'user', action: 'login', user: 'john_doe' },
        { type: 'system', action: 'update', version: '2.1.0' },
        { type: 'alert', level: 'info', message: 'Server running smoothly' },
        { type: 'data', temperature: 23.5, humidity: 45 },
        { type: 'notification', title: 'New message', count: 3 }
    ];

    // Send initial connection event
    res.write(`event: connected\n`);
    res.write(`data: ${JSON.stringify({ message: 'Connected to Pigeon SSE Demo', timestamp: new Date() })}\n\n`);

    // Send events every 2 seconds
    const interval = setInterval(() => {
        eventId++;
        const eventType = eventTypes[eventId % eventTypes.length];
        const data = {
            ...sampleData[eventId % sampleData.length],
            eventId,
            timestamp: new Date().toISOString()
        };

        res.write(`id: ${eventId}\n`);
        res.write(`event: ${eventType}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    }, 2000);

    // Clean up on client disconnect
    req.on('close', () => {
        clearInterval(interval);
        res.end();
    });
});

module.exports = router;
