# Multi-Protocol Support

## Overview

Pigeon's Multi-Protocol Support feature extends the application beyond traditional HTTP/REST API testing to support a comprehensive range of communication protocols. This enables developers and teams to test, monitor, and debug various types of APIs and real-time communication systems from a single unified interface.

---

## Table of Contents

1. [Introduction](#introduction)
2. [Supported Protocols](#supported-protocols)
3. [Architecture](#architecture)
4. [Protocol Details](#protocol-details)
   - [gRPC](#grpc)
   - [WebSocket](#websocket)
   - [SOAP](#soap)
   - [MQTT](#mqtt)
   - [Server-Sent Events (SSE)](#server-sent-events-sse)
5. [Protocol Conversion](#protocol-conversion)
6. [API Reference](#api-reference)
7. [Session Management](#session-management)
8. [Testing Guide](#testing-guide)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Introduction

### What is Multi-Protocol Support?

Multi-Protocol Support in Pigeon allows users to interact with different types of APIs and communication protocols without switching between multiple tools. Whether you're working with modern microservices using gRPC, real-time applications using WebSocket, legacy enterprise systems using SOAP, or IoT devices using MQTT, Pigeon provides a consistent interface for all.

### Why Multi-Protocol Support?

| Challenge | Solution |
|-----------|----------|
| Modern systems use diverse protocols | Single tool for all protocols |
| Context switching between tools | Unified interface and workflow |
| Inconsistent testing approaches | Standardized testing methodology |
| Difficulty comparing protocol behaviors | Built-in protocol conversion |
| Session management complexity | Centralized session persistence |

### Key Benefits

- **Unified Interface**: Test all protocols from one application
- **Session Persistence**: Resume connections after page refresh
- **Protocol Conversion**: Convert requests between different protocols
- **Real-time Monitoring**: Track messages, latency, and connection states
- **Comprehensive Metrics**: Detailed statistics for all protocol interactions

---

## Supported Protocols

| Protocol | Type | Use Cases | Bidirectional |
|----------|------|-----------|---------------|
| **gRPC** | RPC Framework | Microservices, Mobile backends | ✅ Yes |
| **WebSocket** | Full-duplex | Chat, Live updates, Gaming | ✅ Yes |
| **SOAP** | XML-based | Enterprise, Legacy systems | ❌ No |
| **MQTT** | Pub/Sub | IoT, Sensor networks | ✅ Yes |
| **SSE** | Server-push | Live feeds, Notifications | ❌ No (Server → Client) |
| **HTTP/REST** | Request/Response | Standard APIs | ❌ No |
| **GraphQL** | Query Language | Flexible APIs | ❌ No |

---

## Architecture

### Directory Structure

```
services/protocols/
├── BaseProtocol.js       # Abstract base class for all protocols
├── GrpcService.js        # gRPC protocol implementation
├── WebSocketService.js   # WebSocket protocol implementation
├── SoapService.js        # SOAP protocol implementation
├── MqttService.js        # MQTT protocol implementation
├── SseService.js         # SSE protocol implementation
├── ProtocolConverter.js  # Protocol conversion service
└── index.js              # Service exports

routes/protocols/
├── grpc.js               # gRPC API endpoints
├── websocket.js          # WebSocket API endpoints
├── soap.js               # SOAP API endpoints
├── mqtt.js               # MQTT API endpoints
├── sse.js                # SSE API endpoints
├── converter.js          # Conversion API endpoints
└── index.js              # Route aggregation

models/
└── ProtocolSession.js    # Session persistence model
```

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Pigeon Client                            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Protocol Routes                            │
│  ┌─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐ │
│  │  gRPC   │WebSocket│  SOAP   │  MQTT   │   SSE   │Converter│ │
│  └─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Protocol Services                           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    BaseProtocol                             ││
│  │  • Connection management    • Message tracking              ││
│  │  • Metrics collection       • Keep-alive handling           ││
│  │  • Error handling           • Retry logic                   ││
│  └─────────────────────────────────────────────────────────────┘│
│         ▲           ▲           ▲           ▲           ▲       │
│         │           │           │           │           │       │
│  ┌──────┴──┐ ┌──────┴──┐ ┌──────┴──┐ ┌──────┴──┐ ┌──────┴──┐   │
│  │  gRPC   │ │WebSocket│ │  SOAP   │ │  MQTT   │ │   SSE   │   │
│  │ Service │ │ Service │ │ Service │ │ Service │ │ Service │   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ProtocolSession Model                        │
│              (MongoDB - Session Persistence)                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Protocol Details

### gRPC

#### What is gRPC?

gRPC is a high-performance, open-source RPC (Remote Procedure Call) framework developed by Google. It uses Protocol Buffers (protobuf) for serialization and HTTP/2 for transport.

#### Features in Pigeon

| Feature | Description |
|---------|-------------|
| Proto File Loading | Load and parse `.proto` files from path or content |
| Service Discovery | Extract services and methods from proto definitions |
| Unary Calls | Standard request-response pattern |
| Server Streaming | Server sends multiple responses to single request |
| Client Streaming | Client sends multiple requests, server sends single response |
| Bidirectional Streaming | Both client and server send streams of messages |
| Metadata Support | Send and receive gRPC metadata headers |
| SSL/TLS | Secure connections with certificate support |

#### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/protocols/grpc/load-proto` | Load and parse a proto file |
| POST | `/api/protocols/grpc/connect` | Create a gRPC client connection |
| POST | `/api/protocols/grpc/:connectionId/invoke` | Invoke a unary method |
| POST | `/api/protocols/grpc/:connectionId/stream/server` | Start server streaming |
| POST | `/api/protocols/grpc/:connectionId/stream/client` | Start client streaming |
| POST | `/api/protocols/grpc/:connectionId/stream/bidi` | Start bidirectional streaming |
| POST | `/api/protocols/grpc/stream/:streamId/send` | Send message to stream |
| POST | `/api/protocols/grpc/stream/:streamId/end` | End a stream |
| DELETE | `/api/protocols/grpc/:connectionId` | Close connection |
| GET | `/api/protocols/grpc/:connectionId/status` | Get connection status |
| GET | `/api/protocols/grpc/connections` | List all connections |
| POST | `/api/protocols/grpc/reflect` | Use server reflection |

#### Example: Loading Proto and Invoking Method

```javascript
// 1. Load proto file
const protoResult = await fetch('/api/protocols/grpc/load-proto', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    protoContent: `
      syntax = "proto3";
      package example;
      
      service Greeter {
        rpc SayHello (HelloRequest) returns (HelloReply);
      }
      
      message HelloRequest {
        string name = 1;
      }
      
      message HelloReply {
        string message = 1;
      }
    `
  })
});

// 2. Connect to gRPC server
const connectResult = await fetch('/api/protocols/grpc/connect', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'localhost:50051',
    serviceName: 'Greeter',
    protoContent: '...'
  })
});
const { connectionId } = await connectResult.json();

// 3. Invoke unary method
const invokeResult = await fetch(`/api/protocols/grpc/${connectionId}/invoke`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    methodName: 'SayHello',
    message: { name: 'World' }
  })
});
```

---

### WebSocket

#### What is WebSocket?

WebSocket is a communication protocol providing full-duplex communication channels over a single TCP connection. It enables real-time, bidirectional communication between client and server.

#### Features in Pigeon

| Feature | Description |
|---------|-------------|
| Connection Management | Connect, disconnect, reconnect with state tracking |
| Message Types | Support for text and binary messages |
| Subprotocol Support | Negotiate specific subprotocols |
| Ping/Pong | Built-in heartbeat mechanism |
| Auto-Reconnect | Automatic reconnection on disconnection |
| Message History | Track sent and received messages |
| Compression | Per-message deflate compression |

#### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/protocols/websocket/connect` | Establish connection |
| POST | `/api/protocols/websocket/:connectionId/send` | Send message |
| DELETE | `/api/protocols/websocket/:connectionId` | Close connection |
| GET | `/api/protocols/websocket/:connectionId/status` | Get status |
| GET | `/api/protocols/websocket/:connectionId/messages` | Get message history |
| POST | `/api/protocols/websocket/:connectionId/ping` | Send ping |
| GET | `/api/protocols/websocket/connections` | List connections |
| POST | `/api/protocols/websocket/:connectionId/reconnect` | Reconnect |
| DELETE | `/api/protocols/websocket/:connectionId/messages` | Clear history |

#### Example: WebSocket Communication

```javascript
// 1. Connect to WebSocket server
const connectResult = await fetch('/api/protocols/websocket/connect', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'wss://echo.websocket.org',
    headers: { 'Authorization': 'Bearer token' }
  })
});
const { connectionId } = await connectResult.json();

// 2. Send a message
await fetch(`/api/protocols/websocket/${connectionId}/send`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: { type: 'greeting', text: 'Hello!' }
  })
});

// 3. Get message history
const messages = await fetch(`/api/protocols/websocket/${connectionId}/messages`);
```

---

### SOAP

#### What is SOAP?

SOAP (Simple Object Access Protocol) is a messaging protocol specification for exchanging structured information using XML. It's commonly used in enterprise environments and legacy systems.

#### Features in Pigeon

| Feature | Description |
|---------|-------------|
| WSDL Parsing | Parse WSDL files to discover services and operations |
| Envelope Building | Construct SOAP 1.1 and 1.2 envelopes |
| WS-Security | Username token authentication |
| Operation Invocation | Call SOAP operations with parameters |
| Response Parsing | Parse XML responses and handle faults |
| Namespace Management | Handle XML namespaces properly |
| XML Formatting | Pretty-print XML content |

#### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/protocols/soap/parse-wsdl` | Parse WSDL file |
| POST | `/api/protocols/soap/invoke` | Invoke SOAP operation |
| POST | `/api/protocols/soap/build-envelope` | Build envelope without sending |
| POST | `/api/protocols/soap/parse-response` | Parse SOAP response |
| POST | `/api/protocols/soap/validate-envelope` | Validate envelope structure |
| POST | `/api/protocols/soap/generate-sample` | Generate sample request |
| GET | `/api/protocols/soap/namespaces` | Get common namespaces |
| POST | `/api/protocols/soap/format-xml` | Format XML content |
| POST | `/api/protocols/soap/security-header` | Generate security header |

#### Example: SOAP Invocation

```javascript
// 1. Parse WSDL
const wsdlResult = await fetch('/api/protocols/soap/parse-wsdl', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    wsdlUrl: 'http://example.com/service?wsdl'
  })
});
const { services, operations } = await wsdlResult.json();

// 2. Invoke operation
const result = await fetch('/api/protocols/soap/invoke', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'http://example.com/service',
    operation: 'GetUser',
    parameters: { userId: '123' },
    soapVersion: '1.1',
    security: {
      username: 'admin',
      password: 'secret'
    }
  })
});
```

---

### MQTT

#### What is MQTT?

MQTT (Message Queuing Telemetry Transport) is a lightweight publish-subscribe messaging protocol designed for IoT devices and low-bandwidth, high-latency networks.

#### Features in Pigeon

| Feature | Description |
|---------|-------------|
| Broker Connection | Connect to MQTT brokers with authentication |
| Topic Subscription | Subscribe to topics with QoS levels |
| Publishing | Publish messages with QoS and retain flags |
| Wildcards | Support for `+` and `#` topic wildcards |
| Will Messages | Last will and testament support |
| QoS Levels | Support for QoS 0, 1, and 2 |
| Message History | Track messages per topic |
| Keep-Alive | Connection heartbeat mechanism |

#### QoS Levels Explained

| Level | Name | Guarantee | Use Case |
|-------|------|-----------|----------|
| 0 | At most once | Fire and forget | Non-critical data |
| 1 | At least once | Delivered, may duplicate | Important messages |
| 2 | Exactly once | Delivered exactly once | Critical messages |

#### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/protocols/mqtt/connect` | Connect to broker |
| POST | `/api/protocols/mqtt/:connectionId/subscribe` | Subscribe to topics |
| POST | `/api/protocols/mqtt/:connectionId/unsubscribe` | Unsubscribe from topics |
| POST | `/api/protocols/mqtt/:connectionId/publish` | Publish message |
| GET | `/api/protocols/mqtt/:connectionId/subscriptions` | Get subscriptions |
| GET | `/api/protocols/mqtt/:connectionId/messages` | Get message history |
| DELETE | `/api/protocols/mqtt/:connectionId` | Disconnect |
| GET | `/api/protocols/mqtt/:connectionId/status` | Get status |
| GET | `/api/protocols/mqtt/connections` | List connections |
| POST | `/api/protocols/mqtt/:connectionId/test-topic` | Test topic matching |
| GET | `/api/protocols/mqtt/qos-levels` | Get QoS info |

#### Example: MQTT Pub/Sub

```javascript
// 1. Connect to MQTT broker
const connectResult = await fetch('/api/protocols/mqtt/connect', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'mqtt://broker.example.com:1883',
    clientId: 'pigeon-client',
    username: 'user',
    password: 'pass'
  })
});
const { connectionId } = await connectResult.json();

// 2. Subscribe to topics
await fetch(`/api/protocols/mqtt/${connectionId}/subscribe`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    topics: [
      { topic: 'sensors/+/temperature', qos: 1 },
      { topic: 'alerts/#', qos: 2 }
    ]
  })
});

// 3. Publish a message
await fetch(`/api/protocols/mqtt/${connectionId}/publish`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    topic: 'sensors/room1/temperature',
    message: { value: 23.5, unit: 'celsius' },
    qos: 1,
    retain: false
  })
});
```

---

### Server-Sent Events (SSE)

#### What is SSE?

Server-Sent Events is a technology for pushing updates from server to client over HTTP. Unlike WebSocket, SSE is unidirectional (server to client only) but simpler to implement and works over standard HTTP.

#### Features in Pigeon

| Feature | Description |
|---------|-------------|
| Event Streaming | Receive server-pushed events |
| Custom Event Types | Listen for specific event types |
| Last-Event-ID | Resume streams from last received event |
| Auto-Reconnect | Automatic reconnection on disconnection |
| Event History | Track received events |
| Demo Endpoint | Built-in SSE demo for testing |

#### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/protocols/sse/connect` | Connect to SSE endpoint |
| POST | `/api/protocols/sse/:connectionId/listen` | Add event listener |
| DELETE | `/api/protocols/sse/:connectionId/listen/:eventType` | Remove listener |
| GET | `/api/protocols/sse/:connectionId/events` | Get event history |
| GET | `/api/protocols/sse/:connectionId/status` | Get status |
| DELETE | `/api/protocols/sse/:connectionId` | Close connection |
| GET | `/api/protocols/sse/connections` | List connections |
| POST | `/api/protocols/sse/:connectionId/reconnect` | Reconnect |
| DELETE | `/api/protocols/sse/:connectionId/events` | Clear history |
| GET | `/api/protocols/sse/:connectionId/event-types` | Get event types |
| POST | `/api/protocols/sse/test-endpoint` | Test SSE support |
| GET | `/api/protocols/sse/demo` | Demo SSE stream |

#### Example: SSE Streaming

```javascript
// 1. Connect to SSE endpoint
const connectResult = await fetch('/api/protocols/sse/connect', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://api.example.com/events',
    eventTypes: ['message', 'notification', 'update']
  })
});
const { connectionId } = await connectResult.json();

// 2. Add custom event listener
await fetch(`/api/protocols/sse/${connectionId}/listen`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    eventType: 'custom-event'
  })
});

// 3. Get received events
const events = await fetch(`/api/protocols/sse/${connectionId}/events?limit=100`);
```

---

## Protocol Conversion

### Overview

Pigeon's Protocol Converter allows you to transform requests between different protocol formats. This is useful for:

- Migrating from one protocol to another
- Understanding how the same data would be represented in different formats
- Testing how legacy systems might integrate with modern APIs

### Supported Conversions

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│  HTTP   │────▶│ Pigeon  │────▶│  gRPC   │
│  REST   │◀────│Converter│◀────│         │
└─────────┘     └─────────┘     └─────────┘
     │               │               │
     ▼               ▼               ▼
┌─────────┐     ┌─────────┐     ┌─────────┐
│WebSocket│     │  SOAP   │     │  MQTT   │
└─────────┘     └─────────┘     └─────────┘
```

### Conversion Matrix

| From \ To | HTTP | WebSocket | gRPC | SOAP | MQTT | SSE | GraphQL |
|-----------|------|-----------|------|------|------|-----|---------|
| **HTTP** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **WebSocket** | ✅ | ✅ | ⚠️ | ⚠️ | ✅ | ⚠️ | ⚠️ |
| **gRPC** | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ | ⚠️ | ⚠️ |
| **SOAP** | ✅ | ⚠️ | ⚠️ | ✅ | ⚠️ | ⚠️ | ⚠️ |
| **MQTT** | ⚠️ | ✅ | ⚠️ | ⚠️ | ✅ | ⚠️ | ⚠️ |
| **GraphQL** | ✅ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ✅ |

✅ = Direct conversion  |  ⚠️ = Generic conversion (may require adjustments)

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/protocols/convert` | Convert between protocols |
| GET | `/api/protocols/convert/supported` | Get supported conversions |
| POST | `/api/protocols/convert/batch` | Batch convert multiple requests |
| POST | `/api/protocols/convert/http-to-websocket` | HTTP → WebSocket |
| POST | `/api/protocols/convert/http-to-grpc` | HTTP → gRPC |
| POST | `/api/protocols/convert/http-to-soap` | HTTP → SOAP |
| POST | `/api/protocols/convert/http-to-mqtt` | HTTP → MQTT |
| POST | `/api/protocols/convert/graphql-to-http` | GraphQL → HTTP |
| POST | `/api/protocols/convert/soap-to-http` | SOAP → HTTP |
| POST | `/api/protocols/convert/validate` | Validate conversion |
| GET | `/api/protocols/convert/mappings/:source/:target` | Get field mappings |

### Example: Protocol Conversion

```javascript
// Convert HTTP request to gRPC call
const result = await fetch('/api/protocols/convert', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sourceProtocol: 'http',
    targetProtocol: 'grpc',
    request: {
      method: 'POST',
      url: '/users/create',
      headers: { 'Content-Type': 'application/json' },
      body: { name: 'John', email: 'john@example.com' }
    },
    options: {
      serviceName: 'UserService',
      methodName: 'CreateUser'
    }
  })
});

// Result:
// {
//   "success": true,
//   "converted": {
//     "service": "UserService",
//     "method": "CreateUser",
//     "request": { "name": "John", "email": "john@example.com" },
//     "metadata": { "content_type": "application/json" }
//   }
// }
```

---

## API Reference

### Common Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/protocols` | Get all protocols overview |
| GET | `/api/protocols/sessions` | Get all user sessions |
| GET | `/api/protocols/sessions/:sessionId` | Get specific session |
| DELETE | `/api/protocols/sessions/:sessionId` | Delete session |
| POST | `/api/protocols/sessions/:sessionId/pin` | Pin a message |
| DELETE | `/api/protocols/sessions/:sessionId/pin/:messageId` | Unpin message |
| GET | `/api/protocols/stats` | Get aggregate statistics |
| POST | `/api/protocols/cleanup` | Clean up expired sessions |

### Response Format

All API responses follow a consistent format:

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional status message",
  "error": "Error message if success is false"
}
```

### Error Handling

| HTTP Status | Meaning |
|-------------|---------|
| 200 | Success |
| 400 | Bad Request - Invalid parameters |
| 404 | Not Found - Resource doesn't exist |
| 500 | Server Error - Internal error |

---

## Session Management

### ProtocolSession Model

Pigeon persists protocol sessions to MongoDB, enabling:

- **Session Resumption**: Reconnect after page refresh
- **Message History**: Access to sent/received messages
- **Connection Analytics**: Track performance metrics
- **Multi-device Sync**: Access sessions from different devices

### Session Properties

```javascript
{
  sessionId: "unique-session-id",
  protocol: "websocket|grpc|mqtt|sse",
  endpoint: "connection-url",
  state: "connecting|connected|disconnected|reconnecting|error|closed",
  stats: {
    connectedAt: Date,
    disconnectedAt: Date,
    totalConnections: Number,
    totalMessagesSent: Number,
    totalMessagesReceived: Number,
    averageLatency: Number
  },
  messages: [...],  // Message history
  events: [...]     // Connection events
}
```

### Session States

```
   ┌───────────────┐
   │  Disconnected │
   └───────┬───────┘
           │ connect()
           ▼
   ┌───────────────┐
   │  Connecting   │
   └───────┬───────┘
           │ success
           ▼
   ┌───────────────┐     error      ┌───────────────┐
   │   Connected   │───────────────▶│     Error     │
   └───────┬───────┘                └───────────────┘
           │ disconnect()                   │
           ▼                                │ retry
   ┌───────────────┐                        │
   │    Closed     │◀───────────────────────┘
   └───────────────┘
```

---

## Testing Guide

### Testing gRPC

```bash
# 1. Start a gRPC server (example using grpcurl)
grpcurl -plaintext localhost:50051 list

# 2. Test proto loading
curl -X POST http://localhost:5000/api/protocols/grpc/load-proto \
  -H "Content-Type: application/json" \
  -d '{"protoPath": "./protos/service.proto"}'

# 3. Test connection
curl -X POST http://localhost:5000/api/protocols/grpc/connect \
  -H "Content-Type: application/json" \
  -d '{"url": "localhost:50051", "protoPath": "./protos/service.proto"}'
```

### Testing WebSocket

```bash
# 1. Connect to WebSocket echo server
curl -X POST http://localhost:5000/api/protocols/websocket/connect \
  -H "Content-Type: application/json" \
  -d '{"url": "wss://echo.websocket.org"}'

# 2. Send a message (replace CONNECTION_ID)
curl -X POST http://localhost:5000/api/protocols/websocket/CONNECTION_ID/send \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, WebSocket!"}'
```

### Testing SOAP

```bash
# 1. Parse a public WSDL
curl -X POST http://localhost:5000/api/protocols/soap/parse-wsdl \
  -H "Content-Type: application/json" \
  -d '{"wsdlUrl": "http://www.dneonline.com/calculator.asmx?wsdl"}'

# 2. Invoke an operation
curl -X POST http://localhost:5000/api/protocols/soap/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://www.dneonline.com/calculator.asmx",
    "operation": "Add",
    "parameters": {"intA": 5, "intB": 3}
  }'
```

### Testing MQTT

```bash
# 1. Connect to public MQTT broker
curl -X POST http://localhost:5000/api/protocols/mqtt/connect \
  -H "Content-Type: application/json" \
  -d '{"url": "mqtt://test.mosquitto.org:1883"}'

# 2. Subscribe to a topic
curl -X POST http://localhost:5000/api/protocols/mqtt/CONNECTION_ID/subscribe \
  -H "Content-Type: application/json" \
  -d '{"topic": "pigeon/test/#", "qos": 1}'

# 3. Publish a message
curl -X POST http://localhost:5000/api/protocols/mqtt/CONNECTION_ID/publish \
  -H "Content-Type: application/json" \
  -d '{"topic": "pigeon/test/hello", "message": "Hello MQTT!"}'
```

### Testing SSE

```bash
# 1. Use the built-in demo endpoint
curl http://localhost:5000/api/protocols/sse/demo

# 2. Connect to SSE endpoint programmatically
curl -X POST http://localhost:5000/api/protocols/sse/connect \
  -H "Content-Type: application/json" \
  -d '{"url": "http://localhost:5000/api/protocols/sse/demo"}'
```

### Testing Protocol Conversion

```bash
# Convert HTTP to WebSocket
curl -X POST http://localhost:5000/api/protocols/convert/http-to-websocket \
  -H "Content-Type: application/json" \
  -d '{
    "request": {
      "method": "POST",
      "url": "/api/messages",
      "body": {"text": "Hello"}
    }
  }'
```

---

## Best Practices

### Connection Management

1. **Always close connections** when done to free resources
2. **Use session persistence** for long-running connections
3. **Implement error handlers** for connection failures
4. **Set appropriate timeouts** to prevent hanging connections

### Message Handling

1. **Validate messages** before sending
2. **Use appropriate QoS** (for MQTT) based on message importance
3. **Implement message acknowledgment** for critical data
4. **Monitor message queues** to prevent memory issues

### Security

1. **Use TLS/SSL** for production connections
2. **Never expose credentials** in logs or error messages
3. **Implement authentication** for all protocol connections
4. **Validate all input** from external sources

### Performance

1. **Batch messages** when possible
2. **Use compression** for large payloads
3. **Monitor latency metrics** to identify issues
4. **Clean up old sessions** regularly

---

## Troubleshooting

### Common Issues

#### Connection Refused

```
Error: Connection refused
```

**Causes:**
- Server not running
- Wrong host/port
- Firewall blocking connection

**Solutions:**
1. Verify server is running
2. Check host and port configuration
3. Check firewall rules

#### SSL/TLS Errors

```
Error: unable to verify certificate
```

**Causes:**
- Self-signed certificate
- Certificate expired
- Wrong CA certificate

**Solutions:**
1. Add CA certificate to connection options
2. Renew expired certificates
3. Use `rejectUnauthorized: false` for testing only

#### Timeout Errors

```
Error: Connection timeout
```

**Causes:**
- Network latency
- Server overloaded
- Timeout value too low

**Solutions:**
1. Increase timeout value
2. Check network connectivity
3. Verify server health

#### Proto Loading Fails (gRPC)

```
Error: Failed to load proto file
```

**Causes:**
- Invalid proto syntax
- Missing imports
- File not found

**Solutions:**
1. Validate proto syntax
2. Include all import paths
3. Verify file path is correct

#### WSDL Parsing Fails (SOAP)

```
Error: Failed to parse WSDL
```

**Causes:**
- Invalid WSDL URL
- Network issues
- Malformed WSDL

**Solutions:**
1. Verify WSDL URL is accessible
2. Check network connectivity
3. Validate WSDL structure

### Debug Mode

Enable verbose logging by setting environment variable:

```bash
DEBUG=pigeon:protocols* npm start
```

---

## Glossary

| Term | Definition |
|------|------------|
| **Bidirectional** | Communication flows in both directions simultaneously |
| **Proto/Protobuf** | Protocol Buffers - binary serialization format used by gRPC |
| **QoS** | Quality of Service - message delivery guarantee level in MQTT |
| **RPC** | Remote Procedure Call - executing functions on remote servers |
| **Streaming** | Continuous flow of data rather than discrete requests |
| **Subprotocol** | Application-level protocol negotiated over WebSocket |
| **WSDL** | Web Services Description Language - XML format describing SOAP services |
| **Envelope** | SOAP message container with header and body |
| **Topic** | Named channel for publishing/subscribing messages in MQTT |
| **Last-Event-ID** | Identifier for resuming SSE streams |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025 | Initial implementation of multi-protocol support |

---

## Related Documentation

- [Pigeon API Reference](../api-reference.md)
- [Testing Automation](../testing-automation/README.md)
- [Collections](../collections/README.md)
- [Environments](../environments/README.md)

---

## Support

For issues or questions regarding Multi-Protocol Support:

1. Check this documentation first
2. Search existing GitHub issues
3. Create a new issue with:
   - Protocol being used
   - Steps to reproduce
   - Error messages
   - Environment details

---

*Multi-Protocol Support in Pigeon - Unifying API testing across all protocols.*
