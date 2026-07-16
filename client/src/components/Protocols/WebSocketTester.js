/**
 * WebSocketTester.js - WebSocket Testing Component
 * MQTT-style observability layout for connection, messaging, and history.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import './tester-shell.css';
import './WebSocketTester.css';

const Icon = ({ d, size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
);

const ICONS = {
    connection: ['M4 17l6-6-6-6', 'M20 7l-6 6 6 6'],
    message: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
    link: ['M4 17l6-6-6-6', 'M20 7l-6 6 6 6'],
    settings: ['M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'],
    arrowUp: ['M12 19V5', 'M5 12l7-7 7 7'],
    arrowDown: ['M12 5v14', 'M19 12l-7 7-7-7'],
    clock: ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M12 6v6l4 2'],
    info: ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M12 16v-4', 'M12 8h.01'],
    alert: ['M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z', 'M12 9v4', 'M12 17h.01'],
    send: ['M22 2L11 13', 'M22 2l-7 20-4-9-9-4 20-7z']
};

const WebSocketTester = ({ initialUrl = '', onConnectionChange, onMessage, headers = {}, className = '' }) => {
    const [url, setUrl] = useState(initialUrl);
    const [connectionState, setConnectionState] = useState('disconnected');
    const [error, setError] = useState(null);
    const [connectionId, setConnectionId] = useState(null);
    const [messageInput, setMessageInput] = useState('');
    const [messageType, setMessageType] = useState('text');
    const [messages, setMessages] = useState([]);
    const [filter, setFilter] = useState('all');
    const [showSettings, setShowSettings] = useState(false);
    const [autoScroll, setAutoScroll] = useState(true);
    const [formatJson, setFormatJson] = useState(true);
    const [showTimestamps, setShowTimestamps] = useState(true);
    const [subprotocol, setSubprotocol] = useState('');
    const [reconnectOnClose, setReconnectOnClose] = useState(true);
    const [stats, setStats] = useState({ messagesSent: 0, messagesReceived: 0, bytesSent: 0, bytesReceived: 0, connectedAt: null, latency: null });
    const messagesEndRef = useRef(null);
    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);

    useEffect(() => {
        if (autoScroll && messagesEndRef.current && messages.length > 0) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [messages, autoScroll]);

    useEffect(() => () => {
        if (wsRef.current) wsRef.current.close();
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    }, []);

    const addMessage = useCallback((message) => {
        setMessages(prev => [...prev, { ...message, id: message.id || `msg-${Date.now()}` }]);
    }, []);

    const connect = useCallback(() => {
        if (!url) { setError('Please enter a WebSocket URL'); return; }
        if (!url.startsWith('ws://') && !url.startsWith('wss://')) { setError('URL must start with ws:// or wss://'); return; }
        setConnectionState('connecting');
        setError(null);
        try {
            wsRef.current = new WebSocket(url, subprotocol ? [subprotocol] : undefined);
            wsRef.current.onopen = () => {
                setConnectionState('connected');
                setStats(prev => ({ ...prev, connectedAt: new Date() }));
                setConnectionId(`ws-${Date.now()}`);
                addMessage({ type: 'system', content: `Connected to ${url}`, timestamp: new Date() });
                onConnectionChange?.('connected', wsRef.current);
            };
            wsRef.current.onmessage = (event) => {
                const size = typeof event.data === 'string' ? new Blob([event.data]).size : event.data.size || 0;
                setStats(prev => ({ ...prev, messagesReceived: prev.messagesReceived + 1, bytesReceived: prev.bytesReceived + size }));
                const message = { id: `msg-${Date.now()}-${Math.random()}`, type: 'received', content: event.data, timestamp: new Date(), size };
                addMessage(message);
                onMessage?.(message);
            };
            wsRef.current.onclose = (event) => {
                setConnectionState('disconnected');
                addMessage({ type: 'system', content: `Disconnected: ${event.reason || 'Connection closed'} (code: ${event.code})`, timestamp: new Date() });
                onConnectionChange?.('disconnected', null);
                if (reconnectOnClose && event.code !== 1000) {
                    reconnectTimeoutRef.current = setTimeout(() => { if (connectionState !== 'connected') connect(); }, 3000);
                }
            };
            wsRef.current.onerror = () => {
                setConnectionState('error');
                setError('Connection error occurred');
                addMessage({ type: 'error', content: 'WebSocket error occurred', timestamp: new Date() });
            };
        } catch (err) {
            setConnectionState('error');
            setError(err.message);
        }
    }, [url, subprotocol, reconnectOnClose, onConnectionChange, onMessage, connectionState, addMessage]);

    const disconnect = useCallback(() => {
        if (wsRef.current) wsRef.current.close(1000, 'User disconnected');
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    }, []);

    const sendMessage = useCallback(() => {
        if (!wsRef.current || connectionState !== 'connected') { setError('Not connected'); return; }
        if (!messageInput.trim()) return;
        try {
            if (messageType === 'json') JSON.parse(messageInput);
            wsRef.current.send(messageInput);
            const size = new Blob([messageInput]).size;
            setStats(prev => ({ ...prev, messagesSent: prev.messagesSent + 1, bytesSent: prev.bytesSent + size }));
            addMessage({ id: `msg-${Date.now()}-${Math.random()}`, type: 'sent', content: messageInput, timestamp: new Date(), size, messageType });
            setMessageInput('');
        } catch (err) {
            setError(`Failed to send: ${err.message}`);
        }
    }, [messageInput, messageType, connectionState, addMessage]);

    const clearMessages = () => setMessages([]);

    const formatContent = (content) => {
        if (formatJson && (typeof content === 'string' && content.trim().startsWith('{'))) {
            try { return JSON.stringify(JSON.parse(content), null, 2); } catch { return content; }
        }
        return content;
    };

    const filteredMessages = messages.filter(msg => filter === 'all' || msg.type === filter);
    const sentCount = messages.filter(m => m.type === 'sent').length;
    const receivedCount = messages.filter(m => m.type === 'received').length;

    const getConnectionDuration = () => {
        if (!stats.connectedAt) return '—';
        const seconds = Math.floor((Date.now() - stats.connectedAt.getTime()) / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    };

    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const statusClass = connectionState === 'connected' ? 'connected' : connectionState === 'connecting' ? 'running' : connectionState === 'error' ? 'error' : 'disconnected';
    const isConnected = connectionState === 'connected';

    return (
        <div className={`websocket-tester ${className}`}>
            {error && (
                <div className="ws-error" role="alert">
                    <span className="ws-error-text"><Icon d={ICONS.alert} size={14} /> {error}</span>
                    <button onClick={() => setError(null)} aria-label="Dismiss error">×</button>
                </div>
            )}

            <div className="ws-panel ws-connection-panel">
                <div className="ws-connection-header">
                    <h3 className="ws-panel-title"><Icon d={ICONS.connection} size={16} /> Connection</h3>
                    <div className={`ts-status ${statusClass}`}>{connectionState}</div>
                </div>

                <div className="ws-url-group">
                    <div className="ws-protocol-badge">WS</div>
                    <input
                        type="text"
                        className="ws-url-input"
                        placeholder="wss://echo.websocket.org"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !isConnected && connect()}
                        disabled={isConnected}
                        aria-label="WebSocket URL"
                    />
                    {isConnected ? (
                        <button className="ws-btn ws-btn-disconnect" onClick={disconnect}>Disconnect</button>
                    ) : (
                        <button className="ws-btn ws-btn-connect" onClick={connect} disabled={connectionState === 'connecting'}>
                            {connectionState === 'connecting' ? 'Connecting…' : 'Connect'}
                        </button>
                    )}
                    <button
                        className={`ws-btn ws-btn-settings ${showSettings ? 'active' : ''}`}
                        onClick={() => setShowSettings(!showSettings)}
                        aria-label="Connection settings"
                        aria-expanded={showSettings}
                        title="Connection settings"
                    >
                        <Icon d={ICONS.settings} size={16} />
                    </button>
                </div>

                {showSettings && (
                    <div className="ws-settings">
                        <div className="ws-setting">
                            <label htmlFor="ws-subprotocol">Subprotocol</label>
                            <input
                                id="ws-subprotocol"
                                type="text"
                                value={subprotocol}
                                onChange={(e) => setSubprotocol(e.target.value)}
                                placeholder="e.g., graphql-ws"
                                disabled={isConnected}
                            />
                        </div>
                        <label className="ws-setting-row"><input type="checkbox" checked={reconnectOnClose} onChange={(e) => setReconnectOnClose(e.target.checked)} /> Auto-reconnect</label>
                        <label className="ws-setting-row"><input type="checkbox" checked={formatJson} onChange={(e) => setFormatJson(e.target.checked)} /> Format JSON</label>
                        <label className="ws-setting-row"><input type="checkbox" checked={showTimestamps} onChange={(e) => setShowTimestamps(e.target.checked)} /> Show timestamps</label>
                        <label className="ws-setting-row"><input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} /> Auto-scroll</label>
                    </div>
                )}

                <div className="ws-kpi-strip">
                    <div className={`ts-kpi ${isConnected ? 'live' : ''}`}>
                        <div className="ts-kpi-label">Sent</div>
                        <div className="ts-kpi-value">{stats.messagesSent}<span className="ts-kpi-unit">{formatBytes(stats.bytesSent)}</span></div>
                    </div>
                    <div className={`ts-kpi ${isConnected ? 'live' : ''}`}>
                        <div className="ts-kpi-label">Received</div>
                        <div className="ts-kpi-value">{stats.messagesReceived}<span className="ts-kpi-unit">{formatBytes(stats.bytesReceived)}</span></div>
                    </div>
                    <div className="ts-kpi">
                        <div className="ts-kpi-label">Uptime</div>
                        <div className="ts-kpi-value" style={{ fontSize: '1.05rem' }}>{getConnectionDuration()}</div>
                    </div>
                    <div className="ts-kpi">
                        <div className="ts-kpi-label">Latency</div>
                        <div className="ts-kpi-value">{stats.latency ?? '—'}{stats.latency ? <span className="ts-kpi-unit">ms</span> : null}</div>
                    </div>
                </div>
            </div>

            <div className="ws-main-content">
                <div className="ws-left-column">
                    <div className="ws-panel ws-send-panel">
                        <h3 className="ws-panel-title"><Icon d={ICONS.send} size={16} /> Send Message</h3>
                        <div className="ws-type-selector" role="tablist" aria-label="Message type">
                            {['text', 'json'].map(t => (
                                <button
                                    key={t}
                                    role="tab"
                                    aria-selected={messageType === t}
                                    className={`ws-type-btn ${messageType === t ? 'active' : ''}`}
                                    onClick={() => setMessageType(t)}
                                >
                                    {t.toUpperCase()}
                                </button>
                            ))}
                        </div>
                        <div className="ws-send-form">
                            <textarea
                                className="ws-message-input"
                                placeholder={messageType === 'json' ? '{"key": "value"}' : 'Type a message...'}
                                value={messageInput}
                                onChange={(e) => setMessageInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                                disabled={!isConnected}
                                aria-label="Message to send"
                            />
                            <button className="ws-btn ws-btn-send" onClick={sendMessage} disabled={!isConnected || !messageInput.trim()}>
                                <Icon d={ICONS.send} size={14} /> Send
                            </button>
                            <span className="ws-input-hint">Press Enter to send, Shift+Enter for new line</span>
                        </div>
                    </div>
                </div>

                <div className="ws-right-column">
                    <div className="ws-panel ws-messages-panel">
                        <div className="ws-messages-header">
                            <h3 className="ws-panel-title"><Icon d={ICONS.message} size={16} /> Messages</h3>
                            <div className="ws-message-filters" role="tablist" aria-label="Message filter">
                                {[
                                    { key: 'all', label: 'All', count: messages.length },
                                    { key: 'sent', label: 'Sent', count: sentCount },
                                    { key: 'received', label: 'Received', count: receivedCount }
                                ].map(f => (
                                    <button
                                        key={f.key}
                                        role="tab"
                                        aria-selected={filter === f.key}
                                        className={`ws-filter-btn ${filter === f.key ? 'active' : ''}`}
                                        onClick={() => setFilter(f.key)}
                                    >
                                        {f.label}
                                        {f.count > 0 && <span className="ws-filter-count">{f.count}</span>}
                                    </button>
                                ))}
                            </div>
                            <button className="ws-btn ws-btn-clear" onClick={clearMessages} disabled={messages.length === 0}>
                                Clear
                            </button>
                        </div>

                        <div className="ws-messages-list">
                            {filteredMessages.length === 0 ? (
                                <div className="ws-empty">
                                    <span className="ws-empty-icon"><Icon d={ICONS.message} size={44} /></span>
                                    <p className="ws-empty-title">No messages yet</p>
                                    <p className="ws-empty-hint">{isConnected ? 'Send a message or wait for incoming data' : 'Connect to a WebSocket server to start'}</p>
                                </div>
                            ) : filteredMessages.map(msg => (
                                <div key={msg.id} className={`ws-message ws-message-${msg.type}`}>
                                    <div className="ws-message-header">
                                        <span className={`ws-message-direction ws-direction-${msg.type}`}>
                                            {msg.type === 'sent' && <><Icon d={ICONS.arrowUp} size={12} /> Sent</>}
                                            {msg.type === 'received' && <><Icon d={ICONS.arrowDown} size={12} /> Received</>}
                                            {msg.type === 'system' && <><Icon d={ICONS.info} size={12} /> System</>}
                                            {msg.type === 'error' && <><Icon d={ICONS.alert} size={12} /> Error</>}
                                        </span>
                                        {showTimestamps && <span className="ws-message-time"><Icon d={ICONS.clock} size={12} /> {msg.timestamp.toLocaleTimeString()}</span>}
                                        {msg.size && <span className="ws-message-size">{formatBytes(msg.size)}</span>}
                                    </div>
                                    <pre className="ws-message-content">{formatContent(msg.content)}</pre>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WebSocketTester;
