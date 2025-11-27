// services/protocols/ProtocolConverter.js
const BaseProtocol = require('./BaseProtocol');

/**
 * Protocol Converter Service
 * Converts messages between different protocol formats
 * Supports HTTP/REST, WebSocket, gRPC, SOAP, MQTT, and SSE
 */
class ProtocolConverter {
    constructor() {
        // Supported protocols
        this.protocols = ['http', 'websocket', 'grpc', 'soap', 'mqtt', 'sse', 'graphql'];

        // Protocol metadata
        this.protocolInfo = {
            http: {
                name: 'HTTP/REST',
                description: 'Standard HTTP request/response protocol',
                bidirectional: false,
                streaming: false
            },
            websocket: {
                name: 'WebSocket',
                description: 'Full-duplex communication over TCP',
                bidirectional: true,
                streaming: true
            },
            grpc: {
                name: 'gRPC',
                description: 'High-performance RPC framework',
                bidirectional: true,
                streaming: true
            },
            soap: {
                name: 'SOAP',
                description: 'XML-based web service protocol',
                bidirectional: false,
                streaming: false
            },
            mqtt: {
                name: 'MQTT',
                description: 'Lightweight publish-subscribe messaging',
                bidirectional: true,
                streaming: false
            },
            sse: {
                name: 'Server-Sent Events',
                description: 'Server-to-client event streaming',
                bidirectional: false,
                streaming: true
            },
            graphql: {
                name: 'GraphQL',
                description: 'Query language for APIs',
                bidirectional: false,
                streaming: false
            }
        };
    }

    /**
     * Convert between protocols
     * @param {Object} source - Source message/request
     * @param {string} fromProtocol - Source protocol
     * @param {string} toProtocol - Target protocol
     * @param {Object} options - Conversion options
     * @returns {Object} - Converted message
     */
    convert(source, fromProtocol, toProtocol, options = {}) {
        // Validate protocols
        if (!this.protocols.includes(fromProtocol)) {
            throw new Error(`Unsupported source protocol: ${fromProtocol}`);
        }
        if (!this.protocols.includes(toProtocol)) {
            throw new Error(`Unsupported target protocol: ${toProtocol}`);
        }

        // Same protocol - return as is with minor adjustments
        if (fromProtocol === toProtocol) {
            return {
                success: true,
                converted: source,
                notes: ['No conversion needed - same protocol']
            };
        }

        // Get conversion function
        const converterName = `${fromProtocol}To${this.capitalize(toProtocol)}`;
        const converter = this[converterName];

        if (typeof converter !== 'function') {
            // Try generic conversion
            return this.genericConvert(source, fromProtocol, toProtocol, options);
        }

        return converter.call(this, source, options);
    }

    /**
     * HTTP to WebSocket conversion
     * @param {Object} httpRequest - HTTP request
     * @param {Object} options - Conversion options
     * @returns {Object} - WebSocket message
     */
    httpToWebsocket(httpRequest, options = {}) {
        const wsMessage = {
            type: 'request',
            method: httpRequest.method,
            path: httpRequest.url || httpRequest.path,
            headers: httpRequest.headers || {},
            body: httpRequest.body
        };

        return {
            success: true,
            converted: wsMessage,
            targetUrl: this.httpToWsUrl(httpRequest.url),
            notes: [
                'HTTP request converted to WebSocket message',
                'Connection must be established before sending'
            ],
            metadata: {
                originalMethod: httpRequest.method,
                requiresConnection: true
            }
        };
    }

    /**
     * HTTP to gRPC conversion
     * @param {Object} httpRequest - HTTP request
     * @param {Object} options - Conversion options
     * @returns {Object} - gRPC call structure
     */
    httpToGrpc(httpRequest, options = {}) {
        // Extract service and method from URL
        const urlParts = (httpRequest.url || httpRequest.path || '').split('/').filter(Boolean);
        const serviceName = options.serviceName || urlParts[0] || 'Service';
        const methodName = options.methodName || this.httpMethodToGrpcMethod(httpRequest.method, urlParts);

        const grpcCall = {
            service: serviceName,
            method: methodName,
            request: this.parseBody(httpRequest.body),
            metadata: this.headersToMetadata(httpRequest.headers)
        };

        return {
            success: true,
            converted: grpcCall,
            notes: [
                'HTTP request converted to gRPC call',
                'Proto file may need to be loaded',
                `Suggested service: ${serviceName}`,
                `Suggested method: ${methodName}`
            ],
            metadata: {
                requiresProto: true,
                streamingSupported: true
            }
        };
    }

    /**
     * HTTP to SOAP conversion
     * @param {Object} httpRequest - HTTP request
     * @param {Object} options - Conversion options
     * @returns {Object} - SOAP envelope
     */
    httpToSoap(httpRequest, options = {}) {
        const body = this.parseBody(httpRequest.body);
        const operation = options.operation || this.inferOperationName(httpRequest);
        const namespace = options.namespace || 'ns';
        const namespaceUri = options.namespaceUri || 'http://example.com/';

        // Build SOAP envelope
        const soapEnvelope = this.buildSoapEnvelope(operation, body, {
            namespace,
            namespaceUri,
            soapVersion: options.soapVersion || '1.1'
        });

        return {
            success: true,
            converted: {
                envelope: soapEnvelope,
                operation,
                body,
                headers: {
                    'Content-Type': 'text/xml; charset=utf-8',
                    'SOAPAction': `"${operation}"`
                }
            },
            notes: [
                'HTTP request converted to SOAP envelope',
                'WSDL may be needed for proper type definitions',
                `Inferred operation: ${operation}`
            ],
            metadata: {
                soapVersion: options.soapVersion || '1.1',
                requiresWsdl: true
            }
        };
    }

    /**
     * HTTP to MQTT conversion
     * @param {Object} httpRequest - HTTP request
     * @param {Object} options - Conversion options
     * @returns {Object} - MQTT publish message
     */
    httpToMqtt(httpRequest, options = {}) {
        const topic = options.topic || this.urlToTopic(httpRequest.url);
        const payload = this.parseBody(httpRequest.body);

        const mqttMessage = {
            topic,
            payload,
            qos: options.qos || 0,
            retain: options.retain || false
        };

        return {
            success: true,
            converted: mqttMessage,
            notes: [
                'HTTP request converted to MQTT publish message',
                `Topic: ${topic}`,
                'Broker connection required before publishing'
            ],
            metadata: {
                requiresConnection: true,
                isPubSub: true
            }
        };
    }

    /**
     * WebSocket to HTTP conversion
     * @param {Object} wsMessage - WebSocket message
     * @param {Object} options - Conversion options
     * @returns {Object} - HTTP request
     */
    websocketToHttp(wsMessage, options = {}) {
        const message = typeof wsMessage === 'string' ? JSON.parse(wsMessage) : wsMessage;

        const httpRequest = {
            method: message.method || options.method || 'POST',
            url: message.path || options.url || '/',
            headers: {
                'Content-Type': 'application/json',
                ...message.headers
            },
            body: message.body || message.data || message
        };

        return {
            success: true,
            converted: httpRequest,
            notes: [
                'WebSocket message converted to HTTP request',
                'Real-time capabilities will be lost'
            ],
            metadata: {
                lossOfRealtimeCapability: true
            }
        };
    }

    /**
     * gRPC to HTTP conversion
     * @param {Object} grpcCall - gRPC call
     * @param {Object} options - Conversion options
     * @returns {Object} - HTTP request
     */
    grpcToHttp(grpcCall, options = {}) {
        const httpRequest = {
            method: options.method || 'POST',
            url: options.url || `/${grpcCall.service}/${grpcCall.method}`,
            headers: {
                'Content-Type': 'application/json',
                ...this.metadataToHeaders(grpcCall.metadata)
            },
            body: JSON.stringify(grpcCall.request)
        };

        return {
            success: true,
            converted: httpRequest,
            notes: [
                'gRPC call converted to HTTP request',
                'Streaming capabilities will be lost',
                'Binary efficiency will be reduced'
            ],
            metadata: {
                lossOfStreaming: true,
                lossOfBinaryEfficiency: true
            }
        };
    }

    /**
     * SOAP to HTTP conversion
     * @param {Object} soapRequest - SOAP request
     * @param {Object} options - Conversion options
     * @returns {Object} - HTTP request
     */
    soapToHttp(soapRequest, options = {}) {
        // Extract body from SOAP envelope
        const body = this.extractSoapBody(soapRequest.envelope);

        const httpRequest = {
            method: 'POST',
            url: options.url || soapRequest.endpoint || '/',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        };

        return {
            success: true,
            converted: httpRequest,
            notes: [
                'SOAP request converted to HTTP/JSON request',
                'XML envelope has been removed',
                'WS-* features (security, transactions) are lost'
            ],
            metadata: {
                lossOfWsFeatures: true
            }
        };
    }

    /**
     * MQTT to WebSocket conversion
     * @param {Object} mqttMessage - MQTT message
     * @param {Object} options - Conversion options
     * @returns {Object} - WebSocket message
     */
    mqttToWebsocket(mqttMessage, options = {}) {
        const wsMessage = {
            type: 'mqtt_message',
            topic: mqttMessage.topic,
            payload: mqttMessage.payload,
            qos: mqttMessage.qos,
            retain: mqttMessage.retain,
            timestamp: new Date().toISOString()
        };

        return {
            success: true,
            converted: wsMessage,
            notes: [
                'MQTT message converted to WebSocket message',
                'Topic-based routing may need to be implemented on WS server'
            ],
            metadata: {
                requiresTopicRouting: true
            }
        };
    }

    /**
     * GraphQL to HTTP conversion
     * @param {Object} graphqlRequest - GraphQL request
     * @param {Object} options - Conversion options
     * @returns {Object} - HTTP request
     */
    graphqlToHttp(graphqlRequest, options = {}) {
        const httpRequest = {
            method: 'POST',
            url: options.url || '/graphql',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: graphqlRequest.query,
                variables: graphqlRequest.variables || {},
                operationName: graphqlRequest.operationName
            })
        };

        return {
            success: true,
            converted: httpRequest,
            notes: [
                'GraphQL request converted to HTTP POST',
                'This is the standard transport for GraphQL'
            ]
        };
    }

    /**
     * HTTP to GraphQL conversion
     * @param {Object} httpRequest - HTTP request
     * @param {Object} options - Conversion options
     * @returns {Object} - GraphQL request
     */
    httpToGraphql(httpRequest, options = {}) {
        const body = this.parseBody(httpRequest.body);

        // Try to infer GraphQL structure
        let graphqlRequest = {};

        if (body.query) {
            graphqlRequest = body;
        } else {
            // Convert REST-like request to GraphQL
            const operation = this.inferGraphQLOperation(httpRequest);
            graphqlRequest = {
                query: operation.query,
                variables: operation.variables,
                operationName: operation.name
            };
        }

        return {
            success: true,
            converted: graphqlRequest,
            notes: [
                'HTTP request converted to GraphQL query',
                'Schema may be needed for proper type mapping',
                body.query ? 'Request already contained GraphQL query' : 'REST endpoint converted to GraphQL operation'
            ],
            metadata: {
                schemaRecommended: !body.query
            }
        };
    }

    /**
     * Generic conversion for unsupported pairs
     * @param {Object} source - Source message
     * @param {string} fromProtocol - Source protocol
     * @param {string} toProtocol - Target protocol
     * @param {Object} options - Conversion options
     * @returns {Object} - Best-effort conversion
     */
    genericConvert(source, fromProtocol, toProtocol, options = {}) {
        // Extract data from source
        const data = this.extractData(source);

        // Build target format
        const converted = this.buildTargetFormat(data, toProtocol, options);

        return {
            success: true,
            converted,
            notes: [
                `Generic conversion from ${fromProtocol} to ${toProtocol}`,
                'Some protocol-specific features may be lost',
                'Manual adjustments may be needed'
            ],
            metadata: {
                genericConversion: true,
                fromProtocol,
                toProtocol
            }
        };
    }

    /**
     * Extract data from any protocol format
     * @param {Object} source - Source data
     * @returns {Object} - Extracted data
     */
    extractData(source) {
        if (typeof source === 'string') {
            try {
                return JSON.parse(source);
            } catch {
                return { data: source };
            }
        }

        return {
            data: source.body || source.payload || source.data || source.request || source,
            headers: source.headers || source.metadata || {},
            path: source.url || source.path || source.topic || ''
        };
    }

    /**
     * Build target format
     * @param {Object} data - Extracted data
     * @param {string} protocol - Target protocol
     * @param {Object} options - Build options
     * @returns {Object} - Target format
     */
    buildTargetFormat(data, protocol, options = {}) {
        switch (protocol) {
            case 'http':
                return {
                    method: options.method || 'POST',
                    url: data.path || '/',
                    headers: data.headers,
                    body: data.data
                };

            case 'websocket':
                return {
                    type: 'message',
                    data: data.data,
                    headers: data.headers
                };

            case 'grpc':
                return {
                    service: options.service || 'Service',
                    method: options.method || 'Method',
                    request: data.data,
                    metadata: data.headers
                };

            case 'soap':
                return {
                    operation: options.operation || 'Operation',
                    body: data.data
                };

            case 'mqtt':
                return {
                    topic: data.path || options.topic || 'default',
                    payload: data.data,
                    qos: options.qos || 0
                };

            case 'sse':
                return {
                    event: options.event || 'message',
                    data: data.data,
                    id: options.id
                };

            case 'graphql':
                return {
                    query: options.query || 'query { __typename }',
                    variables: data.data
                };

            default:
                return data;
        }
    }

    // Helper methods

    /**
     * Convert HTTP URL to WebSocket URL
     * @param {string} httpUrl - HTTP URL
     * @returns {string} - WebSocket URL
     */
    httpToWsUrl(httpUrl) {
        if (!httpUrl) return 'ws://localhost';
        return httpUrl
            .replace(/^https:/, 'wss:')
            .replace(/^http:/, 'ws:');
    }

    /**
     * Convert URL path to MQTT topic
     * @param {string} url - URL path
     * @returns {string} - MQTT topic
     */
    urlToTopic(url) {
        if (!url) return 'default';
        return url
            .replace(/^\//, '')
            .replace(/\//g, '/')
            .replace(/[?#].*$/, '');
    }

    /**
     * Convert HTTP method to gRPC method name
     * @param {string} httpMethod - HTTP method
     * @param {string[]} urlParts - URL path parts
     * @returns {string} - gRPC method name
     */
    httpMethodToGrpcMethod(httpMethod, urlParts = []) {
        const resourceName = urlParts[urlParts.length - 1] || 'Resource';
        const capitalized = this.capitalize(resourceName);

        switch (httpMethod.toUpperCase()) {
            case 'GET': return `Get${capitalized}`;
            case 'POST': return `Create${capitalized}`;
            case 'PUT': return `Update${capitalized}`;
            case 'DELETE': return `Delete${capitalized}`;
            case 'PATCH': return `Patch${capitalized}`;
            default: return `Process${capitalized}`;
        }
    }

    /**
     * Convert headers to gRPC metadata
     * @param {Object} headers - HTTP headers
     * @returns {Object} - gRPC metadata
     */
    headersToMetadata(headers = {}) {
        const metadata = {};
        for (const [key, value] of Object.entries(headers)) {
            // Convert header names to lowercase (gRPC convention)
            const metadataKey = key.toLowerCase().replace(/-/g, '_');
            // Skip certain HTTP-specific headers
            if (!['content-length', 'host', 'connection'].includes(key.toLowerCase())) {
                metadata[metadataKey] = value;
            }
        }
        return metadata;
    }

    /**
     * Convert gRPC metadata to headers
     * @param {Object} metadata - gRPC metadata
     * @returns {Object} - HTTP headers
     */
    metadataToHeaders(metadata = {}) {
        const headers = {};
        for (const [key, value] of Object.entries(metadata)) {
            // Convert metadata names to HTTP header format
            const headerKey = key.replace(/_/g, '-');
            headers[headerKey] = value;
        }
        return headers;
    }

    /**
     * Parse body from various formats
     * @param {*} body - Body content
     * @returns {Object} - Parsed body
     */
    parseBody(body) {
        if (!body) return {};
        if (typeof body === 'object') return body;
        try {
            return JSON.parse(body);
        } catch {
            return { data: body };
        }
    }

    /**
     * Infer operation name from HTTP request
     * @param {Object} httpRequest - HTTP request
     * @returns {string} - Operation name
     */
    inferOperationName(httpRequest) {
        const method = httpRequest.method || 'POST';
        const path = httpRequest.url || httpRequest.path || '';
        const parts = path.split('/').filter(Boolean);
        const resource = parts[parts.length - 1] || 'Resource';

        return `${method.toLowerCase()}${this.capitalize(resource)}`;
    }

    /**
     * Infer GraphQL operation from HTTP request
     * @param {Object} httpRequest - HTTP request
     * @returns {Object} - GraphQL operation
     */
    inferGraphQLOperation(httpRequest) {
        const method = httpRequest.method || 'GET';
        const path = httpRequest.url || httpRequest.path || '';
        const parts = path.split('/').filter(Boolean);
        const body = this.parseBody(httpRequest.body);

        const isQuery = method === 'GET';
        const operationType = isQuery ? 'query' : 'mutation';
        const resourceName = parts[parts.length - 1] || 'resource';
        const operationName = `${isQuery ? 'Get' : this.capitalize(method.toLowerCase())}${this.capitalize(resourceName)}`;

        // Build simple query/mutation
        const query = isQuery
            ? `query ${operationName} { ${resourceName} { id } }`
            : `mutation ${operationName}($input: ${this.capitalize(resourceName)}Input!) { ${method.toLowerCase()}${this.capitalize(resourceName)}(input: $input) { id } }`;

        return {
            name: operationName,
            query,
            variables: isQuery ? {} : { input: body }
        };
    }

    /**
     * Build SOAP envelope
     * @param {string} operation - Operation name
     * @param {Object} body - Request body
     * @param {Object} options - Envelope options
     * @returns {string} - SOAP envelope XML
     */
    buildSoapEnvelope(operation, body, options = {}) {
        const namespace = options.namespace || 'ns';
        const namespaceUri = options.namespaceUri || 'http://example.com/';
        const soapNs = options.soapVersion === '1.2'
            ? 'http://www.w3.org/2003/05/soap-envelope'
            : 'http://schemas.xmlsoap.org/soap/envelope/';

        const bodyXml = this.objectToXml(body, namespace);

        return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="${soapNs}" xmlns:${namespace}="${namespaceUri}">
    <soap:Body>
        <${namespace}:${operation}>
${bodyXml}
        </${namespace}:${operation}>
    </soap:Body>
</soap:Envelope>`;
    }

    /**
     * Convert object to XML
     * @param {Object} obj - Object to convert
     * @param {string} namespace - XML namespace
     * @param {number} indent - Indentation level
     * @returns {string} - XML string
     */
    objectToXml(obj, namespace, indent = 3) {
        if (!obj || typeof obj !== 'object') return '';

        const spaces = '  '.repeat(indent);
        let xml = '';

        for (const [key, value] of Object.entries(obj)) {
            if (value === null || value === undefined) {
                xml += `${spaces}<${namespace}:${key}/>\n`;
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
     * Extract body from SOAP envelope
     * @param {string} envelope - SOAP envelope XML
     * @returns {Object} - Extracted body
     */
    extractSoapBody(envelope) {
        // Simple extraction - in production, use proper XML parser
        const bodyMatch = envelope.match(/<soap:Body[^>]*>([\s\S]*?)<\/soap:Body>/);
        if (bodyMatch) {
            // Return as-is for now, proper implementation would parse XML to JSON
            return { soapBody: bodyMatch[1].trim() };
        }
        return {};
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
     * Capitalize first letter
     * @param {string} str - String to capitalize
     * @returns {string} - Capitalized string
     */
    capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Get supported protocols
     * @returns {Array} - Protocol information
     */
    getSupportedProtocols() {
        return this.protocols.map(p => ({
            id: p,
            ...this.protocolInfo[p]
        }));
    }

    /**
     * Get conversion compatibility matrix
     * @returns {Object} - Compatibility matrix
     */
    getCompatibilityMatrix() {
        const matrix = {};

        this.protocols.forEach(from => {
            matrix[from] = {};
            this.protocols.forEach(to => {
                if (from === to) {
                    matrix[from][to] = { supported: true, notes: 'Same protocol' };
                } else {
                    const converterName = `${from}To${this.capitalize(to)}`;
                    const hasConverter = typeof this[converterName] === 'function';
                    matrix[from][to] = {
                        supported: true, // All conversions supported (with generic fallback)
                        hasDirectConverter: hasConverter,
                        notes: hasConverter ? 'Direct conversion' : 'Generic conversion'
                    };
                }
            });
        });

        return matrix;
    }
}

// Export singleton instance
module.exports = new ProtocolConverter();
module.exports.ProtocolConverter = ProtocolConverter;
