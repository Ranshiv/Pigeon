/**
 * GrpcTester.js - gRPC Testing Component
 * MQTT-style observability layout for proto loading, connection, and RPC invocation.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import AppSelect from '../common/AppSelect/AppSelect';
import './tester-shell.css';
import './GrpcTester.css';

const Icon = ({ d, size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
);

const ICONS = {
    file: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M16 13H8', 'M16 17H8', 'M10 9H8'],
    folder: ['M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z'],
    edit: ['M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7', 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'],
    connection: ['M4 17l6-6-6-6', 'M20 7l-6 6 6 6'],
    send: ['M22 2L11 13', 'M22 2l-7 20-4-9-9-4 20-7z'],
    inbox: ['M22 12h-6l-2 3H10l-2-3H2', 'M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z'],
    zap: ['M13 2L3 14h9l-1 8 10-12h-9l1-8z'],
    arrowDown: ['M12 5v14', 'M19 12l-7 7-7-7'],
    arrowUp: ['M12 19V5', 'M5 12l7-7 7 7'],
    arrows: ['M17 1l4 4-4 4', 'M3 11V9a4 4 0 0 1 4-4h14', 'M7 23l-4-4 4-4', 'M21 13v2a4 4 0 0 1-4 4H3'],
    alert: ['M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z', 'M12 9v4', 'M12 17h.01'],
    code: ['M16 18l6-6-6-6', 'M8 6l-6 6 6 6', 'M21 12H9']
};

const TYPE_LABELS = {
    unary: { icon: 'zap', label: 'Unary' },
    server_streaming: { icon: 'arrowDown', label: 'Server Stream' },
    client_streaming: { icon: 'arrowUp', label: 'Client Stream' },
    bidi_streaming: { icon: 'arrows', label: 'Bidi Stream' }
};

const GrpcTester = ({ initialUrl = '', onCallComplete, showSampleProto = false, className = '' }) => {
    const [url, setUrl] = useState(initialUrl);
    const [connectionId, setConnectionId] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [protoContent, setProtoContent] = useState('');
    const [protoFileName, setProtoFileName] = useState('');
    const [services, setServices] = useState([]);
    const [selectedService, setSelectedService] = useState('');
    const [selectedMethod, setSelectedMethod] = useState('');
    const [requestMessage, setRequestMessage] = useState('{\n  \n}');
    const [metadata, setMetadata] = useState([{ name: '', value: '' }]);
    const [responses, setResponses] = useState([]);
    const [stats, setStats] = useState({ callCount: 0, avgLatency: 0, lastLatency: null });
    const fileInputRef = useRef(null);

    const sampleProto = `syntax = "proto3";
package greeter;
service Greeter {
    rpc SayHello (HelloRequest) returns (HelloReply) {}
    rpc SayHelloServerStream (HelloRequest) returns (stream HelloReply) {}
    rpc SayHelloClientStream (stream HelloRequest) returns (HelloReply) {}
    rpc SayHelloBidiStream (stream HelloRequest) returns (stream HelloReply) {}
}
message HelloRequest { string name = 1; int32 count = 2; }
message HelloReply { string message = 1; string timestamp = 2; }`;

    const sampleRequest = '{\n  "name": "World",\n  "count": 1\n}';

    useEffect(() => { if (showSampleProto) loadSampleProto(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const addResponse = useCallback((response) => {
        setResponses(prev => [...prev, { id: `resp-${Date.now()}`, timestamp: new Date(), ...response }]);
    }, []);

    const loadSampleProto = useCallback(async () => {
        setProtoContent(sampleProto);
        setProtoFileName('sample_greeter.proto');
        setUrl('grpc.demo.example.com:443');
        setRequestMessage(sampleRequest);
        await parseProto(sampleProto);
    }, []);

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

    const parseProto = useCallback(async (content) => {
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
                    setSelectedMethod(data.services[0].methods[0]?.name || '');
                }
            } else {
                setError(data.error || 'Failed to parse proto');
            }
        } catch (err) {
            setError(`Failed to parse proto: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, []);

    const connect = async () => {
        if (!url || !protoContent) { setError('URL and proto file are required'); return; }
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/protocols/grpc/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, protoContent, serviceName: selectedService })
            });
            const data = await response.json();
            if (data.success) {
                setConnectionId(data.connectionId);
                setIsConnected(true);
                addResponse({ type: 'system', content: `Connected to ${url}` });
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
        try { await fetch(`/api/protocols/grpc/${connectionId}`, { method: 'DELETE' }); } finally {
            setConnectionId(null);
            setIsConnected(false);
            addResponse({ type: 'system', content: 'Disconnected' });
        }
    };

    const invokeMethod = async () => {
        if (!connectionId || !selectedMethod) { setError('Connect to a service and select a method first'); return; }
        setLoading(true);
        setError(null);
        try {
            let message;
            try { message = JSON.parse(requestMessage); } catch {
                setError('Invalid JSON in request message');
                setLoading(false);
                return;
            }
            const service = services.find(s => s.name === selectedService);
            const method = service?.methods.find(m => m.name === selectedMethod);
            const methodType = method?.type || 'unary';
            addResponse({ type: 'request', method: selectedMethod, content: message });
            const startTime = Date.now();

            let endpoint;
            if (methodType === 'unary') endpoint = `/api/protocols/grpc/${connectionId}/invoke`;
            else if (methodType === 'server_streaming') endpoint = `/api/protocols/grpc/${connectionId}/stream/server`;
            else if (methodType === 'client_streaming') endpoint = `/api/protocols/grpc/${connectionId}/stream/client`;
            else endpoint = `/api/protocols/grpc/${connectionId}/stream/bidi`;

            const metadataObj = {};
            metadata.forEach(m => { if (m.name.trim()) metadataObj[m.name] = m.value; });

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ methodName: selectedMethod, message, metadata: metadataObj })
            });
            const data = await response.json();
            const latency = Date.now() - startTime;

            if (data.success) {
                addResponse({ type: 'response', method: selectedMethod, content: data.response, latency });
                setStats(prev => ({
                    callCount: prev.callCount + 1,
                    avgLatency: (prev.avgLatency * prev.callCount + latency) / (prev.callCount + 1),
                    lastLatency: latency
                }));
                onCallComplete?.(data);
            } else {
                addResponse({ type: 'error', method: selectedMethod, content: data.error, code: data.code });
                setError(data.error);
            }
        } catch (err) {
            addResponse({ type: 'error', content: err.message });
            setError(`Call failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const clearResponses = () => setResponses([]);
    const addMetadataRow = () => setMetadata(prev => [...prev, { name: '', value: '' }]);
    const updateMetadata = (index, field, value) => setMetadata(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
    const removeMetadata = (index) => setMetadata(prev => prev.filter((_, i) => i !== index));

    const getCurrentMethods = () => services.find(s => s.name === selectedService)?.methods || [];

    const service = services.find(s => s.name === selectedService);
    const method = service?.methods.find(m => m.name === selectedMethod);
    const methodInfo = method ? TYPE_LABELS[method.type] || { icon: 'zap', label: method.type } : null;

    const statusClass = isConnected ? 'connected' : 'disconnected';

    return (
        <div className={`grpc-tester ${className}`}>
            {error && (
                <div className="grpc-error" role="alert">
                    <span className="grpc-error-text"><Icon d={ICONS.alert} size={14} /> {error}</span>
                    <button onClick={() => setError(null)} aria-label="Dismiss error">×</button>
                </div>
            )}

            <div className="grpc-panel grpc-config-panel">
                <div className="grpc-config-grid">
                    <div className="grpc-config-col">
                        <h3 className="grpc-panel-title"><Icon d={ICONS.file} size={16} /> Proto Definition</h3>
                        <div className="grpc-proto-upload">
                            <input ref={fileInputRef} type="file" accept=".proto" onChange={handleFileUpload} style={{ display: 'none' }} />
                            <button className="grpc-btn grpc-btn-small" onClick={() => fileInputRef.current?.click()}>
                                <Icon d={ICONS.folder} size={14} /> Upload
                            </button>
                            <button className="grpc-btn grpc-btn-primary grpc-btn-small" onClick={loadSampleProto} disabled={loading}>
                                <Icon d={ICONS.edit} size={14} /> Sample
                            </button>
                            {protoFileName && <span className="grpc-proto-filename">{protoFileName}</span>}
                        </div>
                        <textarea
                            className="grpc-proto-editor"
                            placeholder="// Paste your .proto content here or upload a file"
                            value={protoContent}
                            onChange={(e) => setProtoContent(e.target.value)}
                        />
                        {protoContent && !services.length && (
                            <button className="grpc-btn grpc-btn-primary grpc-btn-small" onClick={() => parseProto(protoContent)} disabled={loading}>
                                {loading ? 'Parsing…' : 'Parse Proto'}
                            </button>
                        )}
                    </div>

                    <div className="grpc-config-col">
                        <h3 className="grpc-panel-title"><Icon d={ICONS.connection} size={16} /> Connection</h3>
                        <div className="grpc-url-group">
                            <div className="grpc-protocol-badge">gRPC</div>
                            <input
                                type="text"
                                className="grpc-url-input"
                                placeholder="localhost:50051"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !isConnected && url && protoContent && connect()}
                                disabled={isConnected}
                                aria-label="gRPC server URL"
                            />
                            {isConnected ? (
                                <button className="grpc-btn grpc-btn-disconnect" onClick={disconnect}>Disconnect</button>
                            ) : (
                                <button className="grpc-btn grpc-btn-connect" onClick={connect} disabled={loading || !url || !protoContent}>
                                    {loading ? 'Connecting…' : 'Connect'}
                                </button>
                            )}
                        </div>

                        {services.length > 0 && (
                            <div className="grpc-select-row">
                                <div className="grpc-select-group">
                                    <label>Service</label>
                                    <AppSelect
                                        value={selectedService}
                                        onChange={(value) => {
                                            setSelectedService(value);
                                            const svc = services.find(s => s.name === value);
                                            setSelectedMethod(svc?.methods[0]?.name || '');
                                        }}
                                        options={services.map(svc => ({ value: svc.name, label: svc.name }))}
                                        disabled={isConnected}
                                    />
                                </div>
                                <div className="grpc-select-group">
                                    <label>Method</label>
                                    <AppSelect
                                        value={selectedMethod}
                                        onChange={setSelectedMethod}
                                        options={getCurrentMethods().map(m => ({ value: m.name, label: m.name }))}
                                    />
                                    {methodInfo && <span className="grpc-method-type"><Icon d={ICONS[methodInfo.icon]} size={12} /> {methodInfo.label}</span>}
                                </div>
                            </div>
                        )}

                        <div className="grpc-kpi-strip">
                            <div className={`ts-kpi ${isConnected ? 'live' : ''}`}>
                                <div className="ts-kpi-label">Status</div>
                                <div className="ts-kpi-value" style={{ fontSize: '0.95rem' }}>{isConnected ? 'Connected' : 'Disconnected'}</div>
                            </div>
                            <div className="ts-kpi">
                                <div className="ts-kpi-label">Calls</div>
                                <div className="ts-kpi-value">{stats.callCount}</div>
                            </div>
                            <div className="ts-kpi">
                                <div className="ts-kpi-label">Avg Latency</div>
                                <div className="ts-kpi-value">{Math.round(stats.avgLatency)}<span className="ts-kpi-unit">ms</span></div>
                            </div>
                            <div className="ts-kpi">
                                <div className="ts-kpi-label">Services</div>
                                <div className="ts-kpi-value">{services.length}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grpc-main-content">
                <div className="grpc-left-column">
                    <div className="grpc-panel grpc-request-panel">
                        <h3 className="grpc-panel-title"><Icon d={ICONS.send} size={16} /> Request</h3>

                        <div className="grpc-metadata">
                            <div className="grpc-metadata-header">
                                <span>Metadata (Headers)</span>
                                <button className="grpc-btn grpc-btn-small" onClick={addMetadataRow}>+ Add</button>
                            </div>
                            {metadata.map((m, idx) => (
                                <div key={idx} className="grpc-metadata-row">
                                    <input type="text" placeholder="Key" value={m.name} onChange={(e) => updateMetadata(idx, 'name', e.target.value)} />
                                    <input type="text" placeholder="Value" value={m.value} onChange={(e) => updateMetadata(idx, 'value', e.target.value)} />
                                    <button className="grpc-btn-remove" onClick={() => removeMetadata(idx)} aria-label="Remove metadata row">×</button>
                                </div>
                            ))}
                        </div>

                        <textarea
                            className="grpc-message-editor"
                            placeholder='{"field": "value"}'
                            value={requestMessage}
                            onChange={(e) => setRequestMessage(e.target.value)}
                            spellCheck={false}
                        />

                        <button className="grpc-btn grpc-btn-primary grpc-btn-invoke" onClick={invokeMethod} disabled={!isConnected || loading || !selectedMethod}
                        >
                            {loading ? 'Invoking…' : <><Icon d={ICONS.zap} size={13} /> Invoke {selectedMethod || 'Method'}</>}
                        </button>
                    </div>
                </div>

                <div className="grpc-right-column">
                    <div className="grpc-panel grpc-response-panel">
                        <div className="grpc-response-header">
                            <h3 className="grpc-panel-title"><Icon d={ICONS.inbox} size={16} /> Responses</h3>
                            <button className="grpc-btn grpc-btn-small" onClick={clearResponses} disabled={responses.length === 0}>Clear</button>
                        </div>

                        <div className="grpc-responses-list">
                            {responses.length === 0 ? (
                                <div className="grpc-empty">
                                    <span className="grpc-empty-icon"><Icon d={ICONS.code} size={44} /></span>
                                    <p className="grpc-empty-title">No responses yet</p>
                                    <p className="grpc-empty-hint">Connect to a gRPC service and invoke a method to see results</p>
                                </div>
                            ) : responses.map(resp => (
                                <div key={resp.id} className={`grpc-response grpc-response-${resp.type}`}>
                                    <div className="grpc-response-header-row">
                                        <span className="grpc-response-type">{resp.type}</span>
                                        {resp.method && <span className="grpc-response-method">{resp.method}</span>}
                                        {resp.latency && <span className="grpc-response-latency">{resp.latency}ms</span>}
                                        <span className="grpc-response-time">{resp.timestamp.toLocaleTimeString()}</span>
                                    </div>
                                    <pre className="grpc-response-content">
                                        {typeof resp.content === 'object' ? JSON.stringify(resp.content, null, 2) : resp.content}
                                    </pre>
                                    {resp.code && <div className="grpc-response-code">Code: {resp.code}</div>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GrpcTester;
