// services/protocols/index.js
/**
 * Protocol Services Index
 * Exports all protocol-related services for multi-protocol support
 */

const BaseProtocol = require('./BaseProtocol');
const WebSocketService = require('./WebSocketService');
const GrpcService = require('./GrpcService');
const SoapService = require('./SoapService');
const MqttService = require('./MqttService');
const SseService = require('./SseService');
const ProtocolConverter = require('./ProtocolConverter');

module.exports = {
    BaseProtocol,
    WebSocketService,
    GrpcService,
    SoapService,
    MqttService,
    SseService,
    ProtocolConverter,

    // Convenience exports
    ws: WebSocketService,
    grpc: GrpcService,
    soap: SoapService,
    mqtt: MqttService,
    sse: SseService,
    converter: ProtocolConverter
};
