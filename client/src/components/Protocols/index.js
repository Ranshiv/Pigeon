/**
 * Protocol Components - Index
 * Exports all protocol testing components
 */

// Protocol Selector and Icon
export { default as ProtocolSelector, ProtocolIcon } from './ProtocolSelector';

// Protocol Testers
export { default as WebSocketTester } from './WebSocketTester';
export { default as GrpcTester } from './GrpcTester';
export { default as MqttTester } from './MqttTester';
export { default as SoapTester } from './SoapTester';
export { default as SseTester } from './SseTester';

// Protocol Converter
export { default as ProtocolConverterUI } from './ProtocolConverterUI';

// Protocol mapping for dynamic component loading
export const PROTOCOL_COMPONENTS = {
    websocket: 'WebSocketTester',
    grpc: 'GrpcTester',
    mqtt: 'MqttTester',
    soap: 'SoapTester',
    sse: 'SseTester'
};

// Protocol metadata with modern icons
export const PROTOCOLS = {
    http: {
        id: 'http',
        name: 'HTTP/REST',
        icon: 'http',
        color: '#3B82F6',
        description: 'Standard HTTP requests for REST APIs',
        features: ['GET/POST/PUT/DELETE', 'Headers', 'Authentication', 'Response parsing']
    },
    websocket: {
        id: 'websocket',
        name: 'WebSocket',
        icon: 'websocket',
        color: '#8B5CF6',
        description: 'Full-duplex communication over a single TCP connection',
        features: ['Real-time messaging', 'Bi-directional', 'Subprotocols', 'Auto-reconnect']
    },
    grpc: {
        id: 'grpc',
        name: 'gRPC',
        icon: 'grpc',
        color: '#06B6D4',
        description: 'High-performance RPC framework using Protocol Buffers',
        features: ['Proto definition', 'Streaming', 'Metadata', 'Service discovery']
    },
    soap: {
        id: 'soap',
        name: 'SOAP',
        icon: 'soap',
        color: '#F97316',
        description: 'XML-based messaging protocol for web services',
        features: ['WSDL parsing', 'Operation discovery', 'XML formatting', 'SOAP 1.1/1.2']
    },
    mqtt: {
        id: 'mqtt',
        name: 'MQTT',
        icon: 'mqtt',
        color: '#22C55E',
        description: 'Lightweight pub/sub messaging for IoT',
        features: ['Publish/Subscribe', 'QoS levels', 'Topic wildcards', 'Retained messages']
    },
    sse: {
        id: 'sse',
        name: 'SSE',
        icon: 'sse',
        color: '#EC4899',
        description: 'Server-Sent Events for real-time server-to-client updates',
        features: ['Auto-reconnect', 'Event types', 'Event IDs', 'Text-based']
    },
    graphql: {
        id: 'graphql',
        name: 'GraphQL',
        icon: 'graphql',
        color: '#E535AB',
        description: 'Query language for APIs',
        features: ['Queries', 'Mutations', 'Subscriptions', 'Schema introspection']
    }
};

// Get protocol by ID
export const getProtocol = (id) => PROTOCOLS[id] || null;

// Get all protocols as array
export const getAllProtocols = () => Object.values(PROTOCOLS);

// Get protocol color
export const getProtocolColor = (id) => PROTOCOLS[id]?.color || '#666666';

// Check if protocol supports real-time
export const isRealTimeProtocol = (id) => {
    return ['websocket', 'mqtt', 'sse', 'graphql'].includes(id);
};

// Check if protocol supports streaming
export const isStreamingProtocol = (id) => {
    return ['websocket', 'grpc', 'mqtt', 'sse'].includes(id);
};
