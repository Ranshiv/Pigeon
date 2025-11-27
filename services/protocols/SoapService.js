// services/protocols/SoapService.js
const BaseProtocol = require('./BaseProtocol');
const axios = require('axios');
const xml2js = require('xml2js');

/**
 * SOAP Protocol Service
 * Handles SOAP web service calls with WSDL parsing,
 * envelope building, and response parsing
 */
class SoapService extends BaseProtocol {
    constructor(options = {}) {
        super(options);

        this.protocolName = 'soap';
        this.protocolVersion = '1.0.0';

        // SOAP specific
        this.wsdlCache = new Map();
        this.endpoints = new Map();
        this.soapVersion = options.soapVersion || '1.1';

        // XML parser options
        this.parserOptions = {
            explicitArray: false,
            ignoreAttrs: false,
            tagNameProcessors: [xml2js.processors.stripPrefix],
            attrNameProcessors: [xml2js.processors.stripPrefix],
            ...options.parserOptions
        };

        // XML builder options
        this.builderOptions = {
            headless: true,
            renderOpts: { pretty: true, indent: '  ' },
            ...options.builderOptions
        };
    }

    /**
     * Get protocol capabilities
     * @returns {Object} - SOAP capabilities
     */
    getCapabilities() {
        return {
            bidirectional: false,
            streaming: false,
            binarySupport: false,
            compression: true,
            encryption: true,
            authentication: true,
            subscriptions: false,
            requestResponse: true,
            pubSub: false
        };
    }

    /**
     * Parse WSDL from URL
     * @param {string} wsdlUrl - WSDL URL
     * @param {Object} options - Fetch options
     * @returns {Promise<Object>} - Parsed WSDL
     */
    async parseWsdl(wsdlUrl, options = {}) {
        try {
            // Check cache
            if (this.wsdlCache.has(wsdlUrl)) {
                return {
                    success: true,
                    cached: true,
                    ...this.wsdlCache.get(wsdlUrl)
                };
            }

            // Fetch WSDL
            const response = await axios.get(wsdlUrl, {
                headers: options.headers || {},
                timeout: options.timeout || 30000
            });

            // Parse XML
            const parser = new xml2js.Parser(this.parserOptions);
            const wsdl = await parser.parseStringPromise(response.data);

            // Extract service info
            const serviceInfo = this.extractServiceInfo(wsdl);

            // Cache result
            this.wsdlCache.set(wsdlUrl, {
                wsdl,
                serviceInfo,
                fetchedAt: new Date()
            });

            return {
                success: true,
                cached: false,
                wsdl,
                serviceInfo
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Parse WSDL from string content
     * @param {string} wsdlContent - WSDL XML content
     * @returns {Promise<Object>} - Parsed WSDL
     */
    async parseWsdlFromString(wsdlContent) {
        try {
            const parser = new xml2js.Parser(this.parserOptions);
            const wsdl = await parser.parseStringPromise(wsdlContent);
            const serviceInfo = this.extractServiceInfo(wsdl);

            return {
                success: true,
                wsdl,
                serviceInfo
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Extract service information from parsed WSDL
     * @param {Object} wsdl - Parsed WSDL object
     * @returns {Object} - Service information
     */
    extractServiceInfo(wsdl) {
        const info = {
            services: [],
            operations: [],
            types: [],
            messages: [],
            bindings: []
        };

        // Helper to safely extract string value from XML node
        const getStringValue = (node) => {
            if (!node) return null;
            if (typeof node === 'string') return node;
            if (typeof node === 'object') {
                // Handle xml2js parsed objects with _ for text content
                if (node._) return String(node._);
                if (node.$) return node.$.name || node.$.value || null;
                // If it's still an object, try to stringify key values
                return null;
            }
            return String(node);
        };

        // Helper to get attribute value
        const getAttr = (node, attr) => {
            if (!node || !node.$) return null;
            const value = node.$[attr];
            return typeof value === 'string' ? value : getStringValue(value);
        };

        try {
            const definitions = wsdl.definitions || wsdl;

            // Extract services
            if (definitions.service) {
                const services = Array.isArray(definitions.service)
                    ? definitions.service
                    : [definitions.service];

                services.forEach(service => {
                    const serviceName = getAttr(service, 'name') || 'UnnamedService';
                    const ports = service.port ?
                        (Array.isArray(service.port) ? service.port : [service.port]) : [];

                    info.services.push({
                        name: serviceName,
                        ports: ports.map(port => ({
                            name: getAttr(port, 'name') || 'UnnamedPort',
                            binding: getAttr(port, 'binding'),
                            address: port.address ? getAttr(port.address, 'location') : null
                        }))
                    });
                });
            }

            // Extract port types (operations)
            if (definitions.portType) {
                const portTypes = Array.isArray(definitions.portType)
                    ? definitions.portType
                    : [definitions.portType];

                portTypes.forEach(portType => {
                    const operations = portType.operation ?
                        (Array.isArray(portType.operation) ? portType.operation : [portType.operation]) : [];

                    operations.forEach(op => {
                        info.operations.push({
                            name: getAttr(op, 'name') || 'UnnamedOperation',
                            portType: getAttr(portType, 'name') || 'UnnamedPortType',
                            input: op.input ? getAttr(op.input, 'message') : null,
                            output: op.output ? getAttr(op.output, 'message') : null,
                            documentation: getStringValue(op.documentation)
                        });
                    });
                });
            }

            // Extract messages
            if (definitions.message) {
                const messages = Array.isArray(definitions.message)
                    ? definitions.message
                    : [definitions.message];

                messages.forEach(message => {
                    const parts = message.part ?
                        (Array.isArray(message.part) ? message.part : [message.part]) : [];

                    info.messages.push({
                        name: getAttr(message, 'name') || 'UnnamedMessage',
                        parts: parts.map(part => ({
                            name: getAttr(part, 'name') || 'UnnamedPart',
                            element: getAttr(part, 'element'),
                            type: getAttr(part, 'type')
                        }))
                    });
                });
            }

            // Extract types (simplified)
            if (definitions.types && definitions.types.schema) {
                const schemas = Array.isArray(definitions.types.schema)
                    ? definitions.types.schema
                    : [definitions.types.schema];

                schemas.forEach(schema => {
                    if (schema.element) {
                        const elements = Array.isArray(schema.element)
                            ? schema.element
                            : [schema.element];

                        elements.forEach(el => {
                            info.types.push({
                                name: getAttr(el, 'name') || 'UnnamedType',
                                type: getAttr(el, 'type'),
                                complexType: !!el.complexType
                            });
                        });
                    }
                });
            }

        } catch (error) {
            console.error('Error extracting service info:', error);
        }

        return info;
    }

    /**
     * Build SOAP envelope
     * @param {string} operation - Operation name
     * @param {Object} body - Request body
     * @param {Object} options - Build options
     * @returns {string} - SOAP envelope XML
     */
    buildEnvelope(operation, body, options = {}) {
        const namespace = options.namespace || 'ns';
        const namespaceUri = options.namespaceUri || 'http://example.com/';
        const soapVersion = options.soapVersion || this.soapVersion;

        const soapNs = soapVersion === '1.2'
            ? 'http://www.w3.org/2003/05/soap-envelope'
            : 'http://schemas.xmlsoap.org/soap/envelope/';

        // Build body content
        const bodyContent = this.objectToXml(body, namespace);

        // Build headers if provided
        let headerContent = '';
        if (options.headers) {
            headerContent = `
    <soap:Header>
      ${this.objectToXml(options.headers, namespace)}
    </soap:Header>`;
        }

        // Security headers (WS-Security)
        if (options.security) {
            const securityHeader = this.buildSecurityHeader(options.security);
            headerContent = `
    <soap:Header>
      ${securityHeader}
    </soap:Header>`;
        }

        return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="${soapNs}" xmlns:${namespace}="${namespaceUri}">
${headerContent}
    <soap:Body>
        <${namespace}:${operation}>
${bodyContent}
        </${namespace}:${operation}>
    </soap:Body>
</soap:Envelope>`;
    }

    /**
     * Build WS-Security header
     * @param {Object} security - Security options
     * @returns {string} - Security header XML
     */
    buildSecurityHeader(security) {
        const wsse = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd';
        const wsu = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd';

        if (security.username && security.password) {
            const passwordType = security.passwordType || 'PasswordText';
            return `
      <wsse:Security xmlns:wsse="${wsse}" xmlns:wsu="${wsu}">
        <wsse:UsernameToken>
          <wsse:Username>${this.escapeXml(security.username)}</wsse:Username>
          <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#${passwordType}">${this.escapeXml(security.password)}</wsse:Password>
        </wsse:UsernameToken>
      </wsse:Security>`;
        }

        return '';
    }

    /**
     * Convert object to XML
     * @param {Object} obj - Object to convert
     * @param {string} namespace - XML namespace prefix
     * @param {number} indent - Current indentation level
     * @returns {string} - XML string
     */
    objectToXml(obj, namespace, indent = 3) {
        if (obj === null || obj === undefined) {
            return '';
        }

        if (typeof obj !== 'object') {
            return this.escapeXml(String(obj));
        }

        const spaces = '  '.repeat(indent);
        let xml = '';

        for (const [key, value] of Object.entries(obj)) {
            if (value === null || value === undefined) {
                xml += `${spaces}<${namespace}:${key}/>\n`;
            } else if (Array.isArray(value)) {
                value.forEach(item => {
                    if (typeof item === 'object') {
                        xml += `${spaces}<${namespace}:${key}>\n`;
                        xml += this.objectToXml(item, namespace, indent + 1);
                        xml += `${spaces}</${namespace}:${key}>\n`;
                    } else {
                        xml += `${spaces}<${namespace}:${key}>${this.escapeXml(String(item))}</${namespace}:${key}>\n`;
                    }
                });
            } else if (typeof value === 'object') {
                xml += `${spaces}<${namespace}:${key}>\n`;
                xml += this.objectToXml(value, namespace, indent + 1);
                xml += `${spaces}</${namespace}:${key}>\n`;
            } else {
                xml += `${spaces}<${namespace}:${key}>${this.escapeXml(String(value))}</${namespace}:${key}>\n`;
            }
        }

        return xml;
    }

    /**
     * Escape XML special characters
     * @param {string} str - String to escape
     * @returns {string} - Escaped string
     */
    escapeXml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    /**
     * Parse SOAP response
     * @param {string} responseXml - Response XML
     * @returns {Promise<Object>} - Parsed response
     */
    async parseResponse(responseXml) {
        try {
            const parser = new xml2js.Parser(this.parserOptions);
            const result = await parser.parseStringPromise(responseXml);

            // Navigate to body
            const envelope = result.Envelope || result;
            const body = envelope.Body || {};

            // Check for fault
            if (body.Fault) {
                return {
                    success: false,
                    fault: {
                        code: body.Fault.faultcode || body.Fault.Code?.Value,
                        string: body.Fault.faultstring || body.Fault.Reason?.Text,
                        detail: body.Fault.detail || body.Fault.Detail
                    }
                };
            }

            // Get response content (first non-fault child of Body)
            const responseContent = Object.entries(body)
                .filter(([key]) => key !== 'Fault' && key !== '$')
                .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

            return {
                success: true,
                data: responseContent,
                headers: envelope.Header || null
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to parse response: ${error.message}`
            };
        }
    }

    /**
     * Connect to a SOAP endpoint (store endpoint info)
     * @param {string} url - Endpoint URL
     * @param {Object} options - Connection options
     * @returns {Promise<Object>} - Connection result
     */
    async connect(url, options = {}) {
        try {
            this.connectionId = this.generateConnectionId();
            this.updateConnectionState('connecting');

            // Validate URL
            const parsedUrl = this.parseUrl(url, ['http', 'https']);
            if (!parsedUrl.valid) {
                throw new Error(`Invalid SOAP endpoint URL: ${parsedUrl.error}`);
            }

            // Store endpoint
            this.endpoints.set(this.connectionId, {
                url,
                options,
                createdAt: new Date()
            });

            // If WSDL URL provided, parse it
            if (options.wsdlUrl) {
                const wsdlResult = await this.parseWsdl(options.wsdlUrl, options);
                if (!wsdlResult.success) {
                    throw new Error(`Failed to parse WSDL: ${wsdlResult.error}`);
                }
            }

            this.updateConnectionState('connected');

            return {
                success: true,
                connectionId: this.connectionId,
                url
            };
        } catch (error) {
            this.updateConnectionState('error', { error: error.message });
            throw error;
        }
    }

    /**
     * Invoke a SOAP operation
     * @param {string} operation - Operation name
     * @param {Object} body - Request body
     * @param {Object} options - Call options
     * @returns {Promise<Object>} - Response
     */
    async invoke(operation, body, options = {}) {
        const endpoint = this.endpoints.get(this.connectionId);
        if (!endpoint) {
            throw new Error('Not connected to a SOAP endpoint');
        }

        const startTime = Date.now();

        try {
            // Build SOAP envelope
            const envelope = this.buildEnvelope(operation, body, {
                namespace: options.namespace,
                namespaceUri: options.namespaceUri,
                soapVersion: options.soapVersion || this.soapVersion,
                headers: options.soapHeaders,
                security: options.security
            });

            // Prepare HTTP headers
            const contentType = (options.soapVersion || this.soapVersion) === '1.2'
                ? 'application/soap+xml; charset=utf-8'
                : 'text/xml; charset=utf-8';

            const httpHeaders = {
                'Content-Type': contentType,
                'SOAPAction': options.soapAction || `"${operation}"`,
                ...options.headers
            };

            // Make HTTP request
            const response = await axios.post(endpoint.url, envelope, {
                headers: httpHeaders,
                timeout: options.timeout || this.options.timeout,
                validateStatus: () => true // Accept all status codes
            });

            const latency = Date.now() - startTime;
            this.recordLatency(latency);
            this.metrics.messagesSent++;
            this.metrics.messagesReceived++;

            // Parse response
            const parsed = await this.parseResponse(response.data);

            return {
                success: parsed.success,
                data: parsed.data,
                fault: parsed.fault,
                headers: parsed.headers,
                httpStatus: response.status,
                httpHeaders: response.headers,
                latency,
                requestEnvelope: envelope,
                responseXml: response.data,
                timestamp: new Date()
            };
        } catch (error) {
            this.metrics.errors++;
            const latency = Date.now() - startTime;

            return {
                success: false,
                error: error.message,
                latency,
                timestamp: new Date()
            };
        }
    }

    /**
     * Send message (alias for invoke)
     * @param {Object} message - Message containing operation and body
     * @param {Object} options - Call options
     * @returns {Promise<Object>} - Response
     */
    async send(message, options = {}) {
        const { operation, body } = message;
        return this.invoke(operation, body, options);
    }

    /**
     * Disconnect from SOAP endpoint
     */
    async disconnect() {
        this.endpoints.delete(this.connectionId);
        this.updateConnectionState('disconnected');
    }

    /**
     * Get cached WSDL info
     * @param {string} wsdlUrl - WSDL URL
     * @returns {Object|null} - Cached WSDL info
     */
    getCachedWsdl(wsdlUrl) {
        return this.wsdlCache.get(wsdlUrl) || null;
    }

    /**
     * Clear WSDL cache
     */
    clearWsdlCache() {
        this.wsdlCache.clear();
    }

    /**
     * Generate sample request body from WSDL
     * @param {string} operationName - Operation name
     * @param {string} wsdlUrl - WSDL URL
     * @returns {Object} - Sample request body
     */
    generateSampleRequest(operationName, wsdlUrl) {
        const cached = this.wsdlCache.get(wsdlUrl);
        if (!cached) {
            return { error: 'WSDL not loaded' };
        }

        const operation = cached.serviceInfo.operations.find(op => op.name === operationName);
        if (!operation) {
            return { error: `Operation ${operationName} not found` };
        }

        // Generate sample based on input message
        // This is a simplified implementation
        return {
            operation: operationName,
            body: {
                // Placeholder for sample body
                param1: 'value1',
                param2: 'value2'
            }
        };
    }

    /**
     * Clean up resources
     */
    async cleanup() {
        this.wsdlCache.clear();
        this.endpoints.clear();
        await super.cleanup();
    }
}

// Export singleton instance
module.exports = new SoapService();
module.exports.SoapService = SoapService;
