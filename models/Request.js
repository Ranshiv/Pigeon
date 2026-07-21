// models/Request.js
const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
    name: { type: String, required: true }, // Name of the request configuration
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null },
    url: { type: String, required: true },
    method: { type: String, required: true, enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD', 'GRAPHQL'] },
    headers: [{ name: String, value: String }],
    body: { type: String, default: '' }, // Store the request body as a string
    bodyType: { type: String, enum: ['none', 'json', 'form-data', 'x-www-form-urlencoded', 'raw', 'graphql'], default: 'none' }, // Type of request body

    // Protocol type - determines which protocol-specific config to use
    protocol: {
        type: String,
        enum: ['http', 'websocket', 'grpc', 'soap', 'mqtt', 'sse', 'graphql'],
        default: 'http'
    },

    // GraphQL-specific fields
    graphql: {
        query: { type: String, default: '' }, // GraphQL query/mutation/subscription
        variables: { type: mongoose.Schema.Types.Mixed, default: {} }, // GraphQL variables as JSON
        operationType: { type: String, enum: ['query', 'mutation', 'subscription', ''], default: '' }, // Type of GraphQL operation
        operationName: { type: String, default: '' }, // Named operation
        schema: { type: String, default: '' }, // GraphQL schema (SDL format)
        schemaUrl: { type: String, default: '' }, // URL for schema introspection
    },

    // WebSocket-specific fields
    websocket: {
        subprotocol: { type: String, default: '' }, // WebSocket subprotocol (e.g., 'graphql-ws')
        pingInterval: { type: Number, default: 30000 }, // Ping interval in ms
        reconnectOnClose: { type: Boolean, default: true }, // Auto-reconnect on connection close
        maxReconnectAttempts: { type: Number, default: 5 }, // Max reconnection attempts
        reconnectDelay: { type: Number, default: 1000 }, // Delay between reconnects in ms
        binaryType: { type: String, enum: ['blob', 'arraybuffer'], default: 'arraybuffer' }, // Binary data type
        messages: [{ // Saved messages for playback
            content: { type: String },
            type: { type: String, enum: ['text', 'binary', 'json'], default: 'text' },
            direction: { type: String, enum: ['outgoing', 'incoming'], default: 'outgoing' }
        }]
    },

    // gRPC-specific fields
    grpc: {
        protoFile: { type: String, default: '' }, // Proto file content or path
        protoPath: { type: String, default: '' }, // Include path for proto imports
        packageName: { type: String, default: '' }, // gRPC package name
        serviceName: { type: String, default: '' }, // Service to call
        methodName: { type: String, default: '' }, // Method to invoke
        methodType: {
            type: String,
            enum: ['unary', 'server_streaming', 'client_streaming', 'bidi_streaming'],
            default: 'unary'
        },
        metadata: [{ name: String, value: String }], // gRPC metadata (like headers)
        message: { type: mongoose.Schema.Types.Mixed, default: {} }, // Request message as JSON
        deadline: { type: Number, default: 30000 }, // Request deadline in ms
        useTls: { type: Boolean, default: false }, // Use TLS/SSL
        tlsCert: { type: String, default: '' }, // TLS certificate
        tlsKey: { type: String, default: '' }, // TLS private key
        tlsCa: { type: String, default: '' } // TLS CA certificate
    },

    // SOAP-specific fields
    soap: {
        wsdlUrl: { type: String, default: '' }, // WSDL URL for service definition
        wsdlContent: { type: String, default: '' }, // Cached WSDL content
        operation: { type: String, default: '' }, // SOAP operation name
        soapVersion: { type: String, enum: ['1.1', '1.2'], default: '1.1' }, // SOAP version
        envelope: { type: String, default: '' }, // Custom SOAP envelope (overrides auto-generation)
        soapAction: { type: String, default: '' }, // SOAPAction header value
        namespaces: [{ prefix: String, uri: String }], // Custom namespace declarations
        security: {
            type: { type: String, enum: ['none', 'wsse', 'basic'], default: 'none' },
            username: { type: String, default: '' },
            password: { type: String, default: '' },
            passwordType: { type: String, enum: ['PasswordText', 'PasswordDigest'], default: 'PasswordText' },
            nonce: { type: Boolean, default: false },
            timestamp: { type: Boolean, default: false }
        },
        parameters: { type: mongoose.Schema.Types.Mixed, default: {} } // Operation parameters
    },

    // MQTT-specific fields
    mqtt: {
        clientId: { type: String, default: '' }, // MQTT client ID
        username: { type: String, default: '' }, // Broker username
        password: { type: String, default: '' }, // Broker password
        topic: { type: String, default: '' }, // Topic to publish/subscribe
        topics: [{ // Multiple subscription topics
            topic: { type: String },
            qos: { type: Number, enum: [0, 1, 2], default: 0 }
        }],
        qos: { type: Number, enum: [0, 1, 2], default: 0 }, // Quality of Service level
        retain: { type: Boolean, default: false }, // Retain flag for publishing
        cleanSession: { type: Boolean, default: true }, // Clean session on connect
        keepAlive: { type: Number, default: 60 }, // Keep alive interval in seconds
        will: { // Last Will and Testament
            topic: { type: String, default: '' },
            payload: { type: String, default: '' },
            qos: { type: Number, enum: [0, 1, 2], default: 0 },
            retain: { type: Boolean, default: false }
        },
        useTls: { type: Boolean, default: false }, // Use TLS/SSL
        tlsCert: { type: String, default: '' }, // TLS certificate
        tlsKey: { type: String, default: '' }, // TLS private key
        tlsCa: { type: String, default: '' } // TLS CA certificate
    },

    // SSE-specific fields
    sse: {
        lastEventId: { type: String, default: '' }, // Last-Event-ID for resumption
        withCredentials: { type: Boolean, default: false }, // Send credentials with request
        eventTypes: [{ type: String }], // Event types to listen for (empty = all)
        reconnectTime: { type: Number, default: 3000 }, // Reconnection time in ms
        maxRetries: { type: Number, default: -1 }, // Max retry attempts (-1 = infinite)
        recordEvents: { type: Boolean, default: true } // Record events for history
    },

    // Protocol conversion settings
    conversion: {
        sourceProtocol: { type: String, enum: ['http', 'websocket', 'grpc', 'soap', 'mqtt', 'sse', 'graphql', ''], default: '' },
        targetProtocol: { type: String, enum: ['http', 'websocket', 'grpc', 'soap', 'mqtt', 'sse', 'graphql', ''], default: '' },
        mappings: { type: mongoose.Schema.Types.Mixed, default: {} }, // Field mappings between protocols
        autoConvert: { type: Boolean, default: false } // Auto-convert on protocol change
    },

    // Add fields for pre-request script and test script
    preRequestScript: { type: String, default: '' },
    testScript: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Index for efficient protocol-based queries
requestSchema.index({ protocol: 1 });
requestSchema.index({ 'mqtt.topic': 1 });
requestSchema.index({ 'grpc.serviceName': 1, 'grpc.methodName': 1 });


module.exports = mongoose.model('Request', requestSchema);