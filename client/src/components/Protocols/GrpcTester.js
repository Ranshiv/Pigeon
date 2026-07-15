// client/src/components/Protocols/GrpcTester.js
import React, { useState, useCallback, useRef } from 'react';
import './tester-shell.css';
import './GrpcTester.css';

// Icon Components
const FileTextIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
    </svg>
);

const ConnectionIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 17l6-6-6-6" />
        <path d="M20 7l-6 6 6 6" />
    </svg>
);

const SendIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
);

const InboxIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
);

const FolderIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
);

const EditIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);

const ZapIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
);

const ArrowDownIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <polyline points="19 12 12 19 5 12" />
    </svg>
);

const ArrowUpIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="19" x2="12" y2="5" />
        <polyline points="5 12 12 5 19 12" />
    </svg>
);

const ArrowBothIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="17 1 21 5 17 9" />
        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <polyline points="7 23 3 19 7 15" />
        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
);

/**
 * GrpcTester Component
 * 
 * A comprehensive UI for testing gRPC services.
 * Supports proto loading, unary and streaming calls.
 */
const GrpcTester = ({
    initialUrl = '',
    onCallComplete,
    showSampleProto = false,
    className = ''
}) => {
    // Connection state
    const [url, setUrl] = useState(initialUrl);
    const [connectionId, setConnectionId] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Proto state
    const [protoContent, setProtoContent] = useState('');
    const [protoFileName, setProtoFileName] = useState('');
    const [services, setServices] = useState([]);
    const [selectedService, setSelectedService] = useState('');
    const [selectedMethod, setSelectedMethod] = useState('');

    // Request state
    const [requestMessage, setRequestMessage] = useState('{\n  \n}');
    const [metadata, setMetadata] = useState([{ name: '', value: '' }]);

    // Response state
    const [responses, setResponses] = useState([]);
    // eslint-disable-next-line no-unused-vars
    const [streamActive, setStreamActive] = useState(false);

    // Stats
    const [stats, setStats] = useState({
        callCount: 0,
        avgLatency: 0,
        lastLatency: null
    });

    const fileInputRef = useRef(null);

    // Sample proto for testing
    const sampleProto = `syntax = "proto3";

package greeter;

// The greeting service definition
service Greeter {
    // Sends a greeting - Unary RPC
    rpc SayHello (HelloRequest) returns (HelloReply) {}
    
    // Server streaming - sends multiple greetings
    rpc SayHelloServerStream (HelloRequest) returns (stream HelloReply) {}
    
    // Client streaming - receives multiple names
    rpc SayHelloClientStream (stream HelloRequest) returns (HelloReply) {}
    
    // Bidirectional streaming
    rpc SayHelloBidiStream (stream HelloRequest) returns (stream HelloReply) {}
}

// The request message containing the user's name
message HelloRequest {
    string name = 1;
    int32 count = 2;
}

// The response message containing the greetings
message HelloReply {
    string message = 1;
    string timestamp = 2;
}`;

    // Sample request for the Greeter service
    const sampleRequest = `{
  "name": "World",
  "count": 1
}`;

    const loadSampleProto = async () => {
        setProtoContent(sampleProto);
        setProtoFileName('sample_greeter.proto');
        setUrl('grpc.demo.example.com:443');
        setRequestMessage(sampleRequest);
        await parseProto(sampleProto);
    };

    // Load proto file
    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const content = await file.text();
            setProtoContent(content);
            setProtoFileName(file.name);
            await parseProto(content);
        } catch (err) {
            setError(`Failed to read file: ${err.message}`);
        }
    };

    const parseProto = async (content) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/protocols/grpc/load-proto', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ protoContent: content })
            });

            const data = await response.json();

            if (data.success) {
                setServices(data.services);
                if (data.services.length > 0) {
                    setSelectedService(data.services[0].name);
                    if (data.services[0].methods.length > 0) {
                        setSelectedMethod(data.services[0].methods[0].name);
                    }
                }
            } else {
                setError(data.error || 'Failed to parse proto');
            }
        } catch (err) {
            setError(`Failed to parse proto: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const connect = async () => {
        if (!url || !protoContent) {
            setError('URL and proto file are required');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/protocols/grpc/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url,
                    protoContent,
                    serviceName: selectedService
                })
            });

            const data = await response.json();

            if (data.success) {
                setConnectionId(data.connectionId);
                setIsConnected(true);
                addResponse({
                    type: 'system',
                    content: `Connected to ${url}`
                });
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError(`Connection failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const disconnect = async () => {
        if (!connectionId) return;

        try {
            await fetch(`/api/protocols/grpc/${connectionId}`, {
                method: 'DELETE'
            });
        } finally {
            setConnectionId(null);
            setIsConnected(false);
            addResponse({
                type: 'system',
                content: 'Disconnected'
            });
        }
    };

    const invokeMethod = async () => {
        if (!connectionId || !selectedMethod) {
            setError('Connect to a service and select a method first');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Parse request message
            let message;
            try {
                message = JSON.parse(requestMessage);
            } catch {
                setError('Invalid JSON in request message');
                setLoading(false);
                return;
            }

            // Get method info
            const service = services.find(s => s.name === selectedService);
            const method = service?.methods.find(m => m.name === selectedMethod);
            const methodType = method?.type || 'unary';

            addResponse({
                type: 'request',
                method: selectedMethod,
                content: message
            });

            const startTime = Date.now();

            let endpoint;
            if (methodType === 'unary') {
                endpoint = `/api/protocols/grpc/${connectionId}/invoke`;
            } else if (methodType === 'server_streaming') {
                endpoint = `/api/protocols/grpc/${connectionId}/stream/server`;
                setStreamActive(true);
            } else if (methodType === 'client_streaming') {
                endpoint = `/api/protocols/grpc/${connectionId}/stream/client`;
                setStreamActive(true);
            } else {
                endpoint = `/api/protocols/grpc/${connectionId}/stream/bidi`;
                setStreamActive(true);
            }

            // Build metadata
            const metadataObj = {};
            metadata.forEach(m => {
                if (m.name.trim()) {
                    metadataObj[m.name] = m.value;
                }
            });

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    methodName: selectedMethod,
                    message,
                    metadata: metadataObj
                })
            });

            const data = await response.json();
            const latency = Date.now() - startTime;

            if (data.success) {
                addResponse({
                    type: 'response',
                    method: selectedMethod,
                    content: data.response,
                    latency
                });

                setStats(prev => ({
                    callCount: prev.callCount + 1,
                    avgLatency: (prev.avgLatency * prev.callCount + latency) / (prev.callCount + 1),
                    lastLatency: latency
                }));

                onCallComplete?.(data);
            } else {
                addResponse({
                    type: 'error',
                    method: selectedMethod,
                    content: data.error,
                    code: data.code
                });
                setError(data.error);
            }
        } catch (err) {
            addResponse({
                type: 'error',
                content: err.message
            });
            setError(`Call failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const addResponse = (response) => {
        setResponses(prev => [...prev, {
            id: `resp-${Date.now()}`,
            timestamp: new Date(),
            ...response
        }]);
    };

    const clearResponses = () => {
        setResponses([]);
    };

    const addMetadataRow = () => {
        setMetadata(prev => [...prev, { name: '', value: '' }]);
    };

    const updateMetadata = (index, field, value) => {
        setMetadata(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    const removeMetadata = (index) => {
        setMetadata(prev => prev.filter((_, i) => i !== index));
    };

    const getCurrentMethods = () => {
        const service = services.find(s => s.name === selectedService);
        return service?.methods || [];
    };

    const getMethodTypeLabel = (type) => {
        const labels = {
            unary: <><ZapIcon size={14} /> Unary</>,
            server_streaming: <><ArrowDownIcon size={14} /> Server Stream</>,
            client_streaming: <><ArrowUpIcon size={14} /> Client Stream</>,
            bidi_streaming: <><ArrowBothIcon size={14} /> Bidi Stream</>
        };
        return labels[type] || type;
    };

    return (
        <div className={`grpc-tester ${className}`}>
            {/* Proto File Section */}
            <div className="grpc-section grpc-proto-section">
                <h3 className="grpc-section-title"><FileTextIcon size={16} /> Proto Definition</h3>

                <div className="grpc-proto-upload">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".proto"
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                    />
                    <button
                        className="grpc-btn grpc-btn-upload"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <FolderIcon size={14} /> Upload .proto File
                    </button>
                    <button
                        className="grpc-btn grpc-btn-sample"
                        onClick={loadSampleProto}
                        disabled={loading}
                    >
                        <EditIcon size={14} /> Use Sample Proto
                    </button>
                    {protoFileName && (
                        <span className="grpc-proto-filename">
                            {protoFileName}
                        </span>
                    )}
                </div>

                <textarea
                    className="grpc-proto-editor"
                    placeholder="// Paste your .proto content here or upload a file
syntax = &quot;proto3&quot;;

service MyService {
    rpc MyMethod (Request) returns (Response);
}"
                    value={protoContent}
                    onChange={(e) => setProtoContent(e.target.value)}
                />

                {protoContent && !services.length && (
                    <button
                        className="grpc-btn grpc-btn-parse"
                        onClick={() => parseProto(protoContent)}
                        disabled={loading}
                    >
                        {loading ? 'Parsing...' : 'Parse Proto'}
                    </button>
                )}
            </div>

            {/* Connection Section */}
            <div className="grpc-section grpc-connection-section">
                <h3 className="grpc-section-title"><ConnectionIcon size={16} /> Connection</h3>

                <div className="grpc-url-group">
                    <div className="grpc-protocol-badge">gRPC</div>
                    <input
                        type="text"
                        className="grpc-url-input"
                        placeholder="localhost:50051"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        disabled={isConnected}
                    />
                    {isConnected ? (
                        <button
                            className="grpc-btn grpc-btn-disconnect"
                            onClick={disconnect}
                        >
                            Disconnect
                        </button>
                    ) : (
                        <button
                            className="grpc-btn grpc-btn-connect"
                            onClick={connect}
                            disabled={loading || !url || !protoContent}
                            title={!protoContent ? 'Load a proto file first' : !url ? 'Enter server URL' : 'Connect to gRPC server'}
                        >
                            {loading ? 'Connecting...' : 'Connect'}
                        </button>
                    )}
                </div>

                {services.length > 0 && (
                    <div className="grpc-service-method-selector">
                        <div className="grpc-select-group">
                            <label>Service</label>
                            <select
                                value={selectedService}
                                onChange={(e) => {
                                    setSelectedService(e.target.value);
                                    const svc = services.find(s => s.name === e.target.value);
                                    if (svc?.methods.length > 0) {
                                        setSelectedMethod(svc.methods[0].name);
                                    }
                                }}
                                disabled={isConnected}
                            >
                                {services.map(svc => (
                                    <option key={svc.name} value={svc.name}>
                                        {svc.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="grpc-select-group">
                            <label>Method</label>
                            <select
                                value={selectedMethod}
                                onChange={(e) => setSelectedMethod(e.target.value)}
                            >
                                {getCurrentMethods().map(method => (
                                    <option key={method.name} value={method.name}>
                                        {method.name} ({getMethodTypeLabel(method.type)})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}

                {/* Connection Status */}
                <div className={`grpc-status ${isConnected ? 'grpc-status-connected' : 'grpc-status-disconnected'}`}>
                    <span className="grpc-status-dot"></span>
                    <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
                    {stats.callCount > 0 && (
                        <span className="grpc-stats">
                            • {stats.callCount} calls • Avg {Math.round(stats.avgLatency)}ms
                        </span>
                    )}
                </div>
            </div>

            {/* Request Section */}
            <div className="grpc-section grpc-request-section">
                <h3 className="grpc-section-title"><SendIcon size={16} /> Request</h3>

                {/* Metadata */}
                <div className="grpc-metadata">
                    <div className="grpc-metadata-header">
                        <span>Metadata (Headers)</span>
                        <button
                            className="grpc-btn grpc-btn-small"
                            onClick={addMetadataRow}
                        >
                            + Add
                        </button>
                    </div>
                    {metadata.map((m, idx) => (
                        <div key={idx} className="grpc-metadata-row">
                            <input
                                type="text"
                                placeholder="Key"
                                value={m.name}
                                onChange={(e) => updateMetadata(idx, 'name', e.target.value)}
                            />
                            <input
                                type="text"
                                placeholder="Value"
                                value={m.value}
                                onChange={(e) => updateMetadata(idx, 'value', e.target.value)}
                            />
                            <button
                                className="grpc-btn-remove"
                                onClick={() => removeMetadata(idx)}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>

                {/* Request Message */}
                <textarea
                    className="grpc-message-editor"
                    placeholder='{"field": "value"}'
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value)}
                />

                <button
                    className="grpc-btn grpc-btn-invoke"
                    onClick={invokeMethod}
                    disabled={!isConnected || loading || !selectedMethod}
                >
                    {loading ? 'Invoking...' : `Invoke ${selectedMethod || 'Method'}`}
                </button>
            </div>

            {/* Response Section */}
            <div className="grpc-section grpc-response-section">
                <div className="grpc-response-header">
                    <h3 className="grpc-section-title"><InboxIcon size={16} /> Responses</h3>
                    <button
                        className="grpc-btn grpc-btn-small"
                        onClick={clearResponses}
                    >
                        Clear
                    </button>
                </div>

                <div className="grpc-responses-list">
                    {responses.length === 0 ? (
                        <div className="grpc-empty">
                            No responses yet. Invoke a method to see results.
                        </div>
                    ) : (
                        responses.map(resp => (
                            <div key={resp.id} className={`grpc-response grpc-response-${resp.type}`}>
                                <div className="grpc-response-header-row">
                                    <span className="grpc-response-type">
                                        {resp.type === 'request' && '⬆️ Request'}
                                        {resp.type === 'response' && '⬇️ Response'}
                                        {resp.type === 'error' && '❌ Error'}
                                        {resp.type === 'system' && 'ℹ️ System'}
                                    </span>
                                    {resp.method && <span className="grpc-response-method">{resp.method}</span>}
                                    {resp.latency && <span className="grpc-response-latency">{resp.latency}ms</span>}
                                    <span className="grpc-response-time">
                                        {resp.timestamp.toLocaleTimeString()}
                                    </span>
                                </div>
                                <pre className="grpc-response-content">
                                    {typeof resp.content === 'object'
                                        ? JSON.stringify(resp.content, null, 2)
                                        : resp.content}
                                </pre>
                                {resp.code && <div className="grpc-response-code">Code: {resp.code}</div>}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="grpc-error">
                    <span>⚠️ {error}</span>
                    <button onClick={() => setError(null)}>×</button>
                </div>
            )}
        </div>
    );
};

export default GrpcTester;
