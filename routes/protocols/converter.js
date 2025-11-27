// routes/protocols/converter.js
const express = require('express');
const router = express.Router();
const ProtocolConverter = require('../../services/protocols/ProtocolConverter');

/**
 * Protocol Converter Routes
 * Provides endpoints for converting between different API protocols
 */

/**
 * POST /api/protocols/convert
 * Convert a request from one protocol to another
 */
router.post('/', async (req, res) => {
    try {
        const { sourceProtocol, targetProtocol, request, options } = req.body;

        if (!sourceProtocol || !targetProtocol) {
            return res.status(400).json({
                success: false,
                error: 'Source and target protocols are required'
            });
        }

        if (!request) {
            return res.status(400).json({
                success: false,
                error: 'Request data is required'
            });
        }

        const converted = ProtocolConverter.convert(
            request,
            sourceProtocol,
            targetProtocol,
            options || {}
        );

        res.json({
            success: true,
            sourceProtocol,
            targetProtocol,
            original: request,
            ...converted
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message,
            hint: 'Check that the source and target protocols are supported'
        });
    }
});

/**
 * GET /api/protocols/convert/supported
 * Get supported protocol conversions
 */
router.get('/supported', (req, res) => {
    try {
        const protocols = ProtocolConverter.getSupportedProtocols();
        const matrix = ProtocolConverter.getCompatibilityMatrix();

        res.json({
            success: true,
            protocols,
            compatibilityMatrix: matrix
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/protocols/convert/batch
 * Convert multiple requests at once
 */
router.post('/batch', async (req, res) => {
    try {
        const { conversions } = req.body;

        if (!conversions || !Array.isArray(conversions) || conversions.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Conversions array is required'
            });
        }

        const results = conversions.map((conv) => {
            try {
                const converted = ProtocolConverter.convert(
                    conv.request,
                    conv.sourceProtocol,
                    conv.targetProtocol,
                    conv.options || {}
                );
                return {
                    success: true,
                    sourceProtocol: conv.sourceProtocol,
                    targetProtocol: conv.targetProtocol,
                    ...converted
                };
            } catch (error) {
                return {
                    success: false,
                    sourceProtocol: conv.sourceProtocol,
                    targetProtocol: conv.targetProtocol,
                    error: error.message
                };
            }
        });

        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        res.json({
            success: true,
            results,
            summary: {
                total: results.length,
                successful,
                failed
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
 * POST /api/protocols/convert/http-to-websocket
 * Convert HTTP request to WebSocket message
 */
router.post('/http-to-websocket', async (req, res) => {
    try {
        const { request, options } = req.body;

        if (!request) {
            return res.status(400).json({
                success: false,
                error: 'HTTP request is required'
            });
        }

        const result = ProtocolConverter.httpToWebsocket(request, options || {});

        res.json({
            ...result,
            hint: 'Use the websocket connect endpoint to send this message'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/protocols/convert/http-to-grpc
 * Convert HTTP request to gRPC call
 */
router.post('/http-to-grpc', async (req, res) => {
    try {
        const { request, options } = req.body;

        if (!request) {
            return res.status(400).json({
                success: false,
                error: 'HTTP request is required'
            });
        }

        const result = ProtocolConverter.httpToGrpc(request, options || {});

        res.json({
            ...result,
            hint: 'A proto file may need to be loaded before invoking the gRPC call'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/protocols/convert/http-to-soap
 * Convert HTTP request to SOAP envelope
 */
router.post('/http-to-soap', async (req, res) => {
    try {
        const { request, options } = req.body;

        if (!request) {
            return res.status(400).json({
                success: false,
                error: 'HTTP request is required'
            });
        }

        const result = ProtocolConverter.httpToSoap(request, options || {});

        res.json({
            ...result
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/protocols/convert/http-to-mqtt
 * Convert HTTP request to MQTT message
 */
router.post('/http-to-mqtt', async (req, res) => {
    try {
        const { request, options } = req.body;

        if (!request) {
            return res.status(400).json({
                success: false,
                error: 'HTTP request is required'
            });
        }

        const result = ProtocolConverter.httpToMqtt(request, options || {});

        res.json({
            ...result
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/protocols/convert/graphql-to-http
 * Convert GraphQL query to HTTP request
 */
router.post('/graphql-to-http', async (req, res) => {
    try {
        const { request, options } = req.body;

        if (!request) {
            return res.status(400).json({
                success: false,
                error: 'GraphQL request is required'
            });
        }

        const result = ProtocolConverter.graphqlToHttp(request, options || {});

        res.json({
            ...result
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/protocols/convert/soap-to-http
 * Convert SOAP envelope to HTTP request
 */
router.post('/soap-to-http', async (req, res) => {
    try {
        const { request, options } = req.body;

        if (!request) {
            return res.status(400).json({
                success: false,
                error: 'SOAP request is required'
            });
        }

        const result = ProtocolConverter.soapToHttp(request, options || {});

        res.json({
            ...result
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/protocols/convert/validate
 * Validate if a conversion is possible and what may be lost
 */
router.post('/validate', (req, res) => {
    try {
        const { sourceProtocol, targetProtocol, request } = req.body;

        if (!sourceProtocol || !targetProtocol) {
            return res.status(400).json({
                success: false,
                error: 'Source and target protocols are required'
            });
        }

        // Check if conversion is possible
        const matrix = ProtocolConverter.getCompatibilityMatrix();
        const conversionInfo = matrix[sourceProtocol]?.[targetProtocol];

        if (!conversionInfo) {
            return res.status(400).json({
                success: false,
                error: `Unsupported protocol pair: ${sourceProtocol} to ${targetProtocol}`
            });
        }

        res.json({
            success: true,
            supported: conversionInfo.supported,
            hasDirectConverter: conversionInfo.hasDirectConverter,
            notes: conversionInfo.notes,
            sourceProtocol,
            targetProtocol
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/protocols/convert/mappings/:source/:target
 * Get field mappings between two protocols
 */
router.get('/mappings/:source/:target', (req, res) => {
    try {
        const { source, target } = req.params;

        // Get compatibility info for this conversion
        const matrix = ProtocolConverter.getCompatibilityMatrix();
        const conversionInfo = matrix[source]?.[target];

        if (!conversionInfo) {
            return res.status(400).json({
                success: false,
                error: `No mapping available for ${source} to ${target}`
            });
        }

        // Return conversion guidance
        res.json({
            success: true,
            source,
            target,
            supported: conversionInfo.supported,
            hasDirectConverter: conversionInfo.hasDirectConverter,
            notes: conversionInfo.notes,
            guidance: {
                message: conversionInfo.hasDirectConverter
                    ? `Direct conversion available from ${source} to ${target}`
                    : `Generic conversion will be used from ${source} to ${target}. Some features may be lost.`
            }
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
