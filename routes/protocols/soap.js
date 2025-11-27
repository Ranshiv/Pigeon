// routes/protocols/soap.js
const express = require('express');
const router = express.Router();
const SoapService = require('../../services/protocols/SoapService');

/**
 * SOAP Protocol Routes
 * Provides endpoints for SOAP web service operations
 */

/**
 * POST /api/protocols/soap/parse-wsdl
 * Parse a WSDL file and extract service information
 */
router.post('/parse-wsdl', async (req, res) => {
    try {
        const { wsdlUrl, wsdlContent } = req.body;

        if (!wsdlUrl && !wsdlContent) {
            return res.status(400).json({
                success: false,
                error: 'WSDL URL or content is required'
            });
        }

        const result = await SoapService.parseWsdl(wsdlUrl || wsdlContent);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error || 'Failed to parse WSDL'
            });
        }

        const serviceInfo = result.serviceInfo || {};

        // Map operations to services/ports for the frontend
        const services = (serviceInfo.services || []).map(service => ({
            ...service,
            ports: (service.ports || []).map(port => ({
                ...port,
                // Attach operations to each port
                operations: serviceInfo.operations || []
            }))
        }));

        res.json({
            success: true,
            services: services,
            operations: serviceInfo.operations || [],
            messages: serviceInfo.messages || [],
            types: serviceInfo.types || [],
            bindings: serviceInfo.bindings || []
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message,
            details: 'Failed to parse WSDL'
        });
    }
});

/**
 * POST /api/protocols/soap/invoke
 * Invoke a SOAP operation
 */
router.post('/invoke', async (req, res) => {
    try {
        const {
            url,
            operation,
            parameters,
            headers,
            wsdlUrl,
            soapVersion,
            soapAction,
            security,
            namespaces
        } = req.body;

        if (!url || !operation) {
            return res.status(400).json({
                success: false,
                error: 'URL and operation are required'
            });
        }

        const startTime = Date.now();
        const result = await SoapService.invoke({
            url,
            operation,
            parameters: parameters || {},
            headers: headers || {},
            wsdlUrl,
            soapVersion: soapVersion || '1.1',
            soapAction,
            security,
            namespaces
        });
        const latency = Date.now() - startTime;

        res.json({
            success: true,
            response: result.data,
            envelope: result.envelope,
            headers: result.headers,
            latency,
            operation
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            fault: error.fault,
            details: error.details
        });
    }
});

/**
 * POST /api/protocols/soap/build-envelope
 * Build a SOAP envelope without sending
 */
router.post('/build-envelope', async (req, res) => {
    try {
        const {
            operation,
            parameters,
            soapVersion,
            namespaces,
            security,
            wsdlUrl
        } = req.body;

        if (!operation) {
            return res.status(400).json({
                success: false,
                error: 'Operation is required'
            });
        }

        const envelope = await SoapService.buildEnvelope({
            operation,
            parameters: parameters || {},
            soapVersion: soapVersion || '1.1',
            namespaces,
            security,
            wsdlUrl
        });

        res.json({
            success: true,
            envelope,
            contentType: soapVersion === '1.2'
                ? 'application/soap+xml; charset=utf-8'
                : 'text/xml; charset=utf-8'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/protocols/soap/parse-response
 * Parse a SOAP response envelope
 */
router.post('/parse-response', async (req, res) => {
    try {
        const { envelope } = req.body;

        if (!envelope) {
            return res.status(400).json({
                success: false,
                error: 'SOAP envelope is required'
            });
        }

        const parsed = await SoapService.parseResponse(envelope);

        res.json({
            success: true,
            body: parsed.body,
            headers: parsed.headers,
            fault: parsed.fault,
            isFault: !!parsed.fault
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message,
            details: 'Failed to parse SOAP response'
        });
    }
});

/**
 * POST /api/protocols/soap/validate-envelope
 * Validate a SOAP envelope structure
 */
router.post('/validate-envelope', async (req, res) => {
    try {
        const { envelope, soapVersion } = req.body;

        if (!envelope) {
            return res.status(400).json({
                success: false,
                error: 'SOAP envelope is required'
            });
        }

        const validation = await SoapService.validateEnvelope(envelope, soapVersion);

        res.json({
            success: true,
            valid: validation.valid,
            errors: validation.errors,
            warnings: validation.warnings
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/protocols/soap/generate-sample
 * Generate a sample request for a SOAP operation
 */
router.post('/generate-sample', async (req, res) => {
    try {
        const { wsdlUrl, operation, soapVersion } = req.body;

        if (!wsdlUrl || !operation) {
            return res.status(400).json({
                success: false,
                error: 'WSDL URL and operation are required'
            });
        }

        const sample = await SoapService.generateSampleRequest(wsdlUrl, operation, soapVersion);

        res.json({
            success: true,
            envelope: sample.envelope,
            parameters: sample.parameters,
            headers: sample.headers
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/protocols/soap/namespaces
 * Get common SOAP namespaces
 */
router.get('/namespaces', (req, res) => {
    res.json({
        success: true,
        namespaces: {
            'soap': 'http://schemas.xmlsoap.org/soap/envelope/',
            'soap12': 'http://www.w3.org/2003/05/soap-envelope',
            'wsse': 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd',
            'wsu': 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd',
            'xsi': 'http://www.w3.org/2001/XMLSchema-instance',
            'xsd': 'http://www.w3.org/2001/XMLSchema'
        }
    });
});

/**
 * POST /api/protocols/soap/format-xml
 * Format/prettify XML content
 */
router.post('/format-xml', async (req, res) => {
    try {
        const { xml } = req.body;

        if (!xml) {
            return res.status(400).json({
                success: false,
                error: 'XML content is required'
            });
        }

        const formatted = await SoapService.formatXml(xml);

        res.json({
            success: true,
            formatted
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message,
            details: 'Failed to format XML'
        });
    }
});

/**
 * POST /api/protocols/soap/security-header
 * Generate a WS-Security header
 */
router.post('/security-header', async (req, res) => {
    try {
        const { username, password, passwordType, includeNonce, includeTimestamp } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Username and password are required'
            });
        }

        const header = await SoapService.buildSecurityHeader({
            username,
            password,
            passwordType: passwordType || 'PasswordText',
            nonce: includeNonce,
            timestamp: includeTimestamp
        });

        res.json({
            success: true,
            header
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
