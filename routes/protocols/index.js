// routes/protocols/index.js
const express = require('express');
const router = express.Router();

// Import protocol-specific routes
const websocketRoutes = require('./websocket');
const grpcRoutes = require('./grpc');
const soapRoutes = require('./soap');
const mqttRoutes = require('./mqtt');
const sseRoutes = require('./sse');
const converterRoutes = require('./converter');

// Import models for session management
const ProtocolSession = require('../../models/ProtocolSession');

/**
 * Protocol Routes Index
 * Aggregates all protocol-specific routes under /api/protocols
 */

// Mount protocol-specific routes
router.use('/websocket', websocketRoutes);
router.use('/grpc', grpcRoutes);
router.use('/soap', soapRoutes);
router.use('/mqtt', mqttRoutes);
router.use('/sse', sseRoutes);
router.use('/convert', converterRoutes);

/**
 * GET /api/protocols
 * Get overview of all protocols and their status
 */
router.get('/', async (req, res) => {
    try {
        const userId = req.user?._id;

        // Get session counts by protocol
        const sessionStats = await ProtocolSession.aggregate([
            { $match: userId ? { userId } : {} },
            {
                $group: {
                    _id: '$protocol',
                    total: { $sum: 1 },
                    active: {
                        $sum: {
                            $cond: [{ $in: ['$state', ['connected', 'connecting', 'reconnecting']] }, 1, 0]
                        }
                    }
                }
            }
        ]);

        const protocolInfo = {
            websocket: {
                name: 'WebSocket',
                description: 'Full-duplex communication over a single TCP connection',
                features: ['bidirectional', 'real-time', 'low-latency'],
                useCases: ['Chat applications', 'Live updates', 'Gaming', 'Collaborative editing']
            },
            grpc: {
                name: 'gRPC',
                description: 'High-performance RPC framework using Protocol Buffers',
                features: ['streaming', 'strongly-typed', 'multiplexing'],
                useCases: ['Microservices', 'Mobile backends', 'Real-time communication']
            },
            soap: {
                name: 'SOAP',
                description: 'XML-based messaging protocol for web services',
                features: ['WS-Security', 'WSDL', 'standardized'],
                useCases: ['Enterprise integration', 'Legacy systems', 'Financial services']
            },
            mqtt: {
                name: 'MQTT',
                description: 'Lightweight publish/subscribe messaging protocol',
                features: ['pub/sub', 'QoS levels', 'last-will'],
                useCases: ['IoT devices', 'Sensor networks', 'Mobile messaging']
            },
            sse: {
                name: 'Server-Sent Events',
                description: 'Server-push technology for real-time updates',
                features: ['server-push', 'auto-reconnect', 'event-types'],
                useCases: ['Live feeds', 'Notifications', 'Stock tickers', 'Social streams']
            },
            http: {
                name: 'HTTP/REST',
                description: 'Standard request-response protocol',
                features: ['stateless', 'cacheable', 'uniform-interface'],
                useCases: ['APIs', 'Web services', 'CRUD operations']
            },
            graphql: {
                name: 'GraphQL',
                description: 'Query language for APIs with a type system',
                features: ['flexible-queries', 'type-system', 'subscriptions'],
                useCases: ['Complex data requirements', 'Mobile apps', 'Aggregation layers']
            }
        };

        // Merge session stats with protocol info
        const protocols = Object.entries(protocolInfo).map(([key, info]) => {
            const stats = sessionStats.find(s => s._id === key) || { total: 0, active: 0 };
            return {
                id: key,
                ...info,
                sessions: {
                    total: stats.total,
                    active: stats.active
                }
            };
        });

        res.json({
            success: true,
            protocols,
            conversion: {
                supported: true,
                endpoint: '/api/protocols/convert'
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/protocols/sessions
 * Get all protocol sessions for the current user
 */
router.get('/sessions', async (req, res) => {
    try {
        const { protocol, state, limit = 50 } = req.query;

        const query = {};
        if (req.user?._id) {
            query.userId = req.user._id;
        }
        if (protocol) {
            query.protocol = protocol;
        }
        if (state) {
            query.state = state;
        }

        const sessions = await ProtocolSession.find(query)
            .sort({ 'stats.lastActiveAt': -1 })
            .limit(parseInt(limit))
            .select('-messages -events');

        res.json({
            success: true,
            sessions,
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
 * GET /api/protocols/sessions/:sessionId
 * Get a specific session with full details
 */
router.get('/sessions/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        const session = await ProtocolSession.findOne({ sessionId });

        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }

        res.json({
            success: true,
            session
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/protocols/sessions/:sessionId
 * Delete a protocol session
 */
router.delete('/sessions/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        const session = await ProtocolSession.findOneAndDelete({ sessionId });

        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }

        res.json({
            success: true,
            message: 'Session deleted'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/protocols/sessions/:sessionId/pin
 * Pin a message in a session
 */
router.post('/sessions/:sessionId/pin', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { messageId, note } = req.body;

        const session = await ProtocolSession.findOne({ sessionId });

        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }

        session.pinMessage(messageId, note);
        await session.save();

        res.json({
            success: true,
            pinnedMessages: session.pinnedMessages
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/protocols/sessions/:sessionId/pin/:messageId
 * Unpin a message in a session
 */
router.delete('/sessions/:sessionId/pin/:messageId', async (req, res) => {
    try {
        const { sessionId, messageId } = req.params;

        const session = await ProtocolSession.findOne({ sessionId });

        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }

        session.unpinMessage(messageId);
        await session.save();

        res.json({
            success: true,
            pinnedMessages: session.pinnedMessages
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/protocols/stats
 * Get aggregate statistics for all protocols
 */
router.get('/stats', async (req, res) => {
    try {
        const userId = req.user?._id;
        const match = userId ? { userId } : {};

        const stats = await ProtocolSession.aggregate([
            { $match: match },
            {
                $group: {
                    _id: null,
                    totalSessions: { $sum: 1 },
                    activeSessions: {
                        $sum: {
                            $cond: [{ $in: ['$state', ['connected', 'connecting']] }, 1, 0]
                        }
                    },
                    totalMessages: {
                        $sum: { $add: ['$stats.totalMessagesSent', '$stats.totalMessagesReceived'] }
                    },
                    totalBytesSent: { $sum: '$stats.totalBytesSent' },
                    totalBytesReceived: { $sum: '$stats.totalBytesReceived' },
                    avgLatency: { $avg: '$stats.averageLatency' }
                }
            }
        ]);

        const byProtocol = await ProtocolSession.aggregate([
            { $match: match },
            {
                $group: {
                    _id: '$protocol',
                    sessions: { $sum: 1 },
                    messages: {
                        $sum: { $add: ['$stats.totalMessagesSent', '$stats.totalMessagesReceived'] }
                    }
                }
            }
        ]);

        res.json({
            success: true,
            overall: stats[0] || {
                totalSessions: 0,
                activeSessions: 0,
                totalMessages: 0,
                totalBytesSent: 0,
                totalBytesReceived: 0,
                avgLatency: 0
            },
            byProtocol
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/protocols/cleanup
 * Clean up expired sessions
 */
router.post('/cleanup', async (req, res) => {
    try {
        const result = await ProtocolSession.cleanupExpiredSessions();

        res.json({
            success: true,
            deletedCount: result.deletedCount,
            message: 'Expired sessions cleaned up'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
