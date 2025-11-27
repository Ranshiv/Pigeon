// routes/protocols/grpc.js
const express = require('express');
const router = express.Router();
const GrpcService = require('../../services/protocols/GrpcService');
const ProtocolSession = require('../../models/ProtocolSession');

/**
 * gRPC Protocol Routes
 * Provides endpoints for gRPC operations including unary and streaming calls
 */

/**
 * POST /api/protocols/grpc/load-proto
 * Load and parse a proto file
 */
router.post('/load-proto', async (req, res) => {
    try {
        const { protoContent, protoPath, includePaths } = req.body;

        if (!protoContent && !protoPath) {
            return res.status(400).json({
                success: false,
                error: 'Proto content or path is required'
            });
        }

        let result;

        // If proto content is provided as string, use loadProtoFromString
        if (protoContent) {
            result = await GrpcService.loadProtoFromString(protoContent, `proto_${Date.now()}.proto`);
        } else {
            result = await GrpcService.loadProto(protoPath, includePaths || []);
        }

        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error || 'Failed to parse proto file'
            });
        }

        // Format services for frontend
        const services = (result.services || []).map(service => ({
            name: service.name || service.fullName,
            methods: (service.methods || []).map(method => ({
                name: method.name,
                requestType: method.requestType,
                responseType: method.responseType,
                requestStream: method.requestStream || false,
                responseStream: method.responseStream || false,
                type: method.type || 'unary'
            }))
        }));

        res.json({
            success: true,
            services,
            message: 'Proto file loaded successfully'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message,
            details: 'Failed to parse proto file'
        });
    }
});

/**
 * POST /api/protocols/grpc/connect
 * Create a gRPC client connection
 */
router.post('/connect', async (req, res) => {
    try {
        const { url, protoContent, protoPath, packageName, serviceName, options } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'gRPC server URL is required'
            });
        }

        if (!protoContent && !protoPath) {
            return res.status(400).json({
                success: false,
                error: 'Proto definition is required'
            });
        }

        const connectionResult = await GrpcService.connect(url, {
            protoContent,
            protoPath,
            packageName,
            serviceName,
            ...options
        });

        // Extract the connectionId string from the result
        const connectionId = connectionResult.connectionId || connectionResult;

        // Create session record
        const session = new ProtocolSession({
            sessionId: String(connectionId),
            protocol: 'grpc',
            endpoint: url,
            state: 'connected',
            userId: req.user?._id,
            workspaceId: req.body.workspaceId,
            grpc: {
                serviceName: serviceName || '',
                packageName: packageName || ''
            }
        });
        await session.save();

        res.json({
            success: true,
            connectionId: String(connectionId),
            message: 'gRPC client connected'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/protocols/grpc/:connectionId/invoke
 * Invoke a unary gRPC method
 */
router.post('/:connectionId/invoke', async (req, res) => {
    try {
        const { connectionId } = req.params;
        const { methodName, message, metadata, deadline } = req.body;

        if (!methodName) {
            return res.status(400).json({
                success: false,
                error: 'Method name is required'
            });
        }

        const startTime = Date.now();
        const result = await GrpcService.invokeUnary(connectionId, methodName, message || {}, {
            metadata,
            deadline
        });
        const latency = Date.now() - startTime;

        // Update session
        const session = await ProtocolSession.findOne({ sessionId: connectionId });
        if (session) {
            session.grpc.methodName = methodName;
            session.grpc.methodType = 'unary';
            session.addMessage({
                direction: 'outgoing',
                type: 'grpc-request',
                content: { method: methodName, message }
            });
            session.addMessage({
                direction: 'incoming',
                type: 'grpc-response',
                content: result
            });
            session.updateLatency(latency);
            await session.save();
        }

        res.json({
            success: true,
            response: result,
            latency,
            method: methodName
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            code: error.code,
            details: error.details
        });
    }
});

/**
 * POST /api/protocols/grpc/:connectionId/stream/server
 * Start a server streaming call
 */
router.post('/:connectionId/stream/server', async (req, res) => {
    try {
        const { connectionId } = req.params;
        const { methodName, message, metadata } = req.body;

        if (!methodName) {
            return res.status(400).json({
                success: false,
                error: 'Method name is required'
            });
        }

        const streamId = await GrpcService.invokeServerStreaming(
            connectionId,
            methodName,
            message || {},
            { metadata }
        );

        // Update session
        const session = await ProtocolSession.findOne({ sessionId: connectionId });
        if (session) {
            session.grpc.methodName = methodName;
            session.grpc.methodType = 'server_streaming';
            session.grpc.streamId = streamId;
            await session.save();
        }

        res.json({
            success: true,
            streamId,
            message: 'Server streaming started',
            hint: 'Subscribe to WebSocket events for stream data'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/protocols/grpc/:connectionId/stream/client
 * Start a client streaming call
 */
router.post('/:connectionId/stream/client', async (req, res) => {
    try {
        const { connectionId } = req.params;
        const { methodName, metadata } = req.body;

        if (!methodName) {
            return res.status(400).json({
                success: false,
                error: 'Method name is required'
            });
        }

        const streamId = await GrpcService.invokeClientStreaming(
            connectionId,
            methodName,
            { metadata }
        );

        // Update session
        const session = await ProtocolSession.findOne({ sessionId: connectionId });
        if (session) {
            session.grpc.methodName = methodName;
            session.grpc.methodType = 'client_streaming';
            session.grpc.streamId = streamId;
            await session.save();
        }

        res.json({
            success: true,
            streamId,
            message: 'Client streaming started',
            hint: 'Use /stream/:streamId/send to send messages'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/protocols/grpc/:connectionId/stream/bidi
 * Start a bidirectional streaming call
 */
router.post('/:connectionId/stream/bidi', async (req, res) => {
    try {
        const { connectionId } = req.params;
        const { methodName, metadata } = req.body;

        if (!methodName) {
            return res.status(400).json({
                success: false,
                error: 'Method name is required'
            });
        }

        const streamId = await GrpcService.invokeBidiStreaming(
            connectionId,
            methodName,
            { metadata }
        );

        // Update session
        const session = await ProtocolSession.findOne({ sessionId: connectionId });
        if (session) {
            session.grpc.methodName = methodName;
            session.grpc.methodType = 'bidi_streaming';
            session.grpc.streamId = streamId;
            await session.save();
        }

        res.json({
            success: true,
            streamId,
            message: 'Bidirectional streaming started'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/protocols/grpc/stream/:streamId/send
 * Send a message to an active stream
 */
router.post('/stream/:streamId/send', async (req, res) => {
    try {
        const { streamId } = req.params;
        const { message } = req.body;

        await GrpcService.sendToStream(streamId, message);

        res.json({
            success: true,
            message: 'Message sent to stream'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/protocols/grpc/stream/:streamId/end
 * End a client or bidirectional stream
 */
router.post('/stream/:streamId/end', async (req, res) => {
    try {
        const { streamId } = req.params;

        await GrpcService.endStream(streamId);

        res.json({
            success: true,
            message: 'Stream ended'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/protocols/grpc/:connectionId
 * Close a gRPC connection
 */
router.delete('/:connectionId', async (req, res) => {
    try {
        const { connectionId } = req.params;

        await GrpcService.disconnect(connectionId);

        // Update session
        const session = await ProtocolSession.findOne({ sessionId: connectionId });
        if (session) {
            session.updateState('closed');
            await session.save();
        }

        res.json({
            success: true,
            message: 'gRPC connection closed'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/protocols/grpc/:connectionId/status
 * Get gRPC connection status
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

        const metrics = GrpcService.getMetrics(connectionId);

        res.json({
            success: true,
            connectionId,
            state: session.state,
            stats: session.stats,
            metrics,
            grpc: session.grpc
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/protocols/grpc/connections
 * List all active gRPC connections
 */
router.get('/connections', async (req, res) => {
    try {
        const sessions = await ProtocolSession.find({
            protocol: 'grpc',
            userId: req.user?._id,
            state: { $in: ['connected', 'connecting'] }
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
 * POST /api/protocols/grpc/reflect
 * Use gRPC reflection to discover services (if server supports it)
 */
router.post('/reflect', async (req, res) => {
    try {
        const { url, options } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'Server URL is required'
            });
        }

        // This would use gRPC server reflection
        // Note: Requires server to have reflection enabled
        const services = await GrpcService.reflect(url, options);

        res.json({
            success: true,
            services,
            message: 'Services discovered via reflection'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            hint: 'Server may not have reflection enabled'
        });
    }
});

// Helper function to determine method type
function getMethodType(method) {
    if (method.requestStream && method.responseStream) {
        return 'bidi_streaming';
    } else if (method.requestStream) {
        return 'client_streaming';
    } else if (method.responseStream) {
        return 'server_streaming';
    }
    return 'unary';
}

module.exports = router;
