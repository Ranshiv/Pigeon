// client/src/components/Protocols/WebSocketTester.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import './WebSocketTester.css';

// Icon Components
const SignalIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.55a11 11 0 0 1 14.08 0" />
        <path d="M1.42 9a16 16 0 0 1 21.16 0" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
);

const MessageIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
);

/**
 * WebSocketTester Component
 * 
 * A comprehensive UI for testing WebSocket connections.
 * Supports connection management, message sending/receiving, and history viewing.
 */
const WebSocketTester = ({
    initialUrl = '',
    onConnectionChange,
    onMessage,
    headers = {},
    className = ''
}) => {
    // Connection state
    const [url, setUrl] = useState(initialUrl);
    const [connectionState, setConnectionState] = useState('disconnected'); // disconnected, connecting, connected, error
    const [error, setError] = useState(null);
    const [connectionId, setConnectionId] = useState(null);

    // Message state
    const [messageInput, setMessageInput] = useState('');
    const [messageType, setMessageType] = useState('text'); // text, json, binary
    const [messages, setMessages] = useState([]);
    const [filter, setFilter] = useState('all'); // all, sent, received

    // UI state
    const [showSettings, setShowSettings] = useState(false);
    const [autoScroll, setAutoScroll] = useState(true);
    const [formatJson, setFormatJson] = useState(true);
    const [showTimestamps, setShowTimestamps] = useState(true);

    // Settings
    const [subprotocol, setSubprotocol] = useState('');
    const [pingInterval, setPingInterval] = useState(30000);
    const [reconnectOnClose, setReconnectOnClose] = useState(true);

    // Stats
    const [stats, setStats] = useState({
        messagesSent: 0,
        messagesReceived: 0,
        bytesSent: 0,
        bytesReceived: 0,
        connectedAt: null,
        latency: null
    });

    const messagesEndRef = useRef(null);
    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);

    // Auto-scroll to bottom when new messages arrive - only when there are actual messages
    useEffect(() => {
        if (autoScroll && messagesEndRef.current && messages.length > 0) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [messages, autoScroll]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, []);

    const connect = useCallback(() => {
        if (!url) {
            setError('Please enter a WebSocket URL');
            return;
        }

        // Validate URL
        if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
            setError('URL must start with ws:// or wss://');
            return;
        }

        setConnectionState('connecting');
        setError(null);

        try {
            const protocols = subprotocol ? [subprotocol] : undefined;
            wsRef.current = new WebSocket(url, protocols);

            wsRef.current.onopen = () => {
                setConnectionState('connected');
                setStats(prev => ({
                    ...prev,
                    connectedAt: new Date()
                }));
                setConnectionId(`ws-${Date.now()}`);
                addMessage({
                    type: 'system',
                    content: `Connected to ${url}`,
                    timestamp: new Date()
                });
                onConnectionChange?.('connected', wsRef.current);
            };

            wsRef.current.onmessage = (event) => {
                const size = typeof event.data === 'string'
                    ? new Blob([event.data]).size
                    : event.data.size || 0;

                setStats(prev => ({
                    ...prev,
                    messagesReceived: prev.messagesReceived + 1,
                    bytesReceived: prev.bytesReceived + size
                }));

                const message = {
                    id: `msg-${Date.now()}-${Math.random()}`,
                    type: 'received',
                    content: event.data,
                    timestamp: new Date(),
                    size
                };

                addMessage(message);
                onMessage?.(message);
            };

            wsRef.current.onclose = (event) => {
                setConnectionState('disconnected');
                addMessage({
                    type: 'system',
                    content: `Disconnected: ${event.reason || 'Connection closed'} (code: ${event.code})`,
                    timestamp: new Date()
                });
                onConnectionChange?.('disconnected', null);

                // Auto-reconnect logic
                if (reconnectOnClose && event.code !== 1000) {
                    reconnectTimeoutRef.current = setTimeout(() => {
                        if (connectionState !== 'connected') {
                            connect();
                        }
                    }, 3000);
                }
            };

            wsRef.current.onerror = (error) => {
                setConnectionState('error');
                setError('Connection error occurred');
                addMessage({
                    type: 'error',
                    content: 'WebSocket error occurred',
                    timestamp: new Date()
                });
            };
        } catch (err) {
            setConnectionState('error');
            setError(err.message);
        }
    }, [url, subprotocol, reconnectOnClose, onConnectionChange, onMessage]);

    const disconnect = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close(1000, 'User disconnected');
        }
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
    }, []);

    const sendMessage = useCallback(() => {
        if (!wsRef.current || connectionState !== 'connected') {
            setError('Not connected');
            return;
        }

        if (!messageInput.trim()) {
            return;
        }

        try {
            let dataToSend = messageInput;

            // Validate JSON if type is json
            if (messageType === 'json') {
                JSON.parse(messageInput); // Will throw if invalid
            }

            wsRef.current.send(dataToSend);

            const size = new Blob([dataToSend]).size;
            setStats(prev => ({
                ...prev,
                messagesSent: prev.messagesSent + 1,
                bytesSent: prev.bytesSent + size
            }));

            addMessage({
                id: `msg-${Date.now()}-${Math.random()}`,
                type: 'sent',
                content: messageInput,
                timestamp: new Date(),
                size,
                messageType
            });

            setMessageInput('');
        } catch (err) {
            setError(`Failed to send: ${err.message}`);
        }
    }, [messageInput, messageType, connectionState]);

    const addMessage = (message) => {
        setMessages(prev => [...prev, { ...message, id: message.id || `msg-${Date.now()}` }]);
    };

    const clearMessages = () => {
        setMessages([]);
    };

    const ping = useCallback(async () => {
        if (!wsRef.current || connectionState !== 'connected') return;

        const start = Date.now();
        wsRef.current.send('ping');
        // Note: This is a simple ping - real ping/pong would need server support
        setStats(prev => ({ ...prev, latency: Date.now() - start }));
    }, [connectionState]);

    const formatContent = (content, type) => {
        if (formatJson && (type === 'json' || (typeof content === 'string' && content.trim().startsWith('{')))) {
            try {
                return JSON.stringify(JSON.parse(content), null, 2);
            } catch {
                return content;
            }
        }
        return content;
    };

    const filteredMessages = messages.filter(msg => {
        if (filter === 'all') return true;
        if (filter === 'sent') return msg.type === 'sent';
        if (filter === 'received') return msg.type === 'received';
        return true;
    });

    const getConnectionDuration = () => {
        if (!stats.connectedAt) return null;
        const seconds = Math.floor((Date.now() - stats.connectedAt.getTime()) / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    };

    return (
        <div className={`websocket-tester ${className}`}>
            {/* Connection Panel */}
            <div className="ws-connection-panel">
                <div className="ws-url-input-group">
                    <div className="ws-protocol-badge">WS</div>
                    <input
                        type="text"
                        className="ws-url-input"
                        placeholder="wss://echo.websocket.org"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && connectionState !== 'connected' && connect()}
                        disabled={connectionState === 'connected'}
                    />
                    {connectionState === 'connected' ? (
                        <button
                            className="ws-btn ws-btn-disconnect"
                            onClick={disconnect}
                        >
                            Disconnect
                        </button>
                    ) : (
                        <button
                            className="ws-btn ws-btn-connect"
                            onClick={connect}
                            disabled={connectionState === 'connecting'}
                        >
                            {connectionState === 'connecting' ? 'Connecting...' : 'Connect'}
                        </button>
                    )}
                    <button
                        className="ws-btn ws-btn-settings"
                        onClick={() => setShowSettings(!showSettings)}
                        title="Settings"
                    >
                        ⚙️
                    </button>
                </div>

                {/* Connection Status */}
                <div className="ws-status-bar">
                    <div className={`ws-status-indicator ws-status-${connectionState}`}>
                        <span className="ws-status-dot"></span>
                        <span className="ws-status-text">
                            {connectionState.charAt(0).toUpperCase() + connectionState.slice(1)}
                        </span>
                    </div>

                    {connectionState === 'connected' && (
                        <div className="ws-stats">
                            <span className="ws-stat">
                                ⬆️ {stats.messagesSent} ({formatBytes(stats.bytesSent)})
                            </span>
                            <span className="ws-stat">
                                ⬇️ {stats.messagesReceived} ({formatBytes(stats.bytesReceived)})
                            </span>
                            {getConnectionDuration() && (
                                <span className="ws-stat">⏱️ {getConnectionDuration()}</span>
                            )}
                            {stats.latency && (
                                <span className="ws-stat"><SignalIcon size={14} /> {stats.latency}ms</span>
                            )}
                        </div>
                    )}
                </div>

                {/* Settings Panel */}
                {showSettings && (
                    <div className="ws-settings-panel">
                        <div className="ws-setting">
                            <label>Subprotocol</label>
                            <input
                                type="text"
                                value={subprotocol}
                                onChange={(e) => setSubprotocol(e.target.value)}
                                placeholder="e.g., graphql-ws"
                                disabled={connectionState === 'connected'}
                            />
                        </div>
                        <div className="ws-setting">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={reconnectOnClose}
                                    onChange={(e) => setReconnectOnClose(e.target.checked)}
                                />
                                Auto-reconnect
                            </label>
                        </div>
                        <div className="ws-setting">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={formatJson}
                                    onChange={(e) => setFormatJson(e.target.checked)}
                                />
                                Format JSON
                            </label>
                        </div>
                        <div className="ws-setting">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={showTimestamps}
                                    onChange={(e) => setShowTimestamps(e.target.checked)}
                                />
                                Show timestamps
                            </label>
                        </div>
                        <div className="ws-setting">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={autoScroll}
                                    onChange={(e) => setAutoScroll(e.target.checked)}
                                />
                                Auto-scroll
                            </label>
                        </div>
                    </div>
                )}

                {/* Error Display */}
                {error && (
                    <div className="ws-error">
                        <span className="ws-error-icon">⚠️</span>
                        <span className="ws-error-text">{error}</span>
                        <button className="ws-error-close" onClick={() => setError(null)}>×</button>
                    </div>
                )}
            </div>

            {/* Messages Panel */}
            <div className="ws-messages-panel">
                <div className="ws-messages-header">
                    <div className="ws-messages-filter">
                        <button
                            className={`ws-filter-btn ${filter === 'all' ? 'active' : ''}`}
                            onClick={() => setFilter('all')}
                        >
                            All ({messages.length})
                        </button>
                        <button
                            className={`ws-filter-btn ${filter === 'sent' ? 'active' : ''}`}
                            onClick={() => setFilter('sent')}
                        >
                            Sent ({messages.filter(m => m.type === 'sent').length})
                        </button>
                        <button
                            className={`ws-filter-btn ${filter === 'received' ? 'active' : ''}`}
                            onClick={() => setFilter('received')}
                        >
                            Received ({messages.filter(m => m.type === 'received').length})
                        </button>
                    </div>
                    <button className="ws-btn ws-btn-clear" onClick={clearMessages}>
                        Clear
                    </button>
                </div>

                <div className="ws-messages-list">
                    {filteredMessages.length === 0 ? (
                        <div className="ws-messages-empty">
                            <span className="ws-empty-icon"><MessageIcon size={48} /></span>
                            <p>No messages yet</p>
                            <p className="ws-empty-hint">
                                {connectionState === 'connected'
                                    ? 'Send a message or wait for incoming data'
                                    : 'Connect to a WebSocket server to start'}
                            </p>
                        </div>
                    ) : (
                        filteredMessages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`ws-message ws-message-${msg.type}`}
                            >
                                <div className="ws-message-header">
                                    <span className={`ws-message-direction ws-direction-${msg.type}`}>
                                        {msg.type === 'sent' ? '⬆️ Sent' :
                                            msg.type === 'received' ? '⬇️ Received' :
                                                msg.type === 'system' ? 'ℹ️ System' :
                                                    '⚠️ Error'}
                                    </span>
                                    {showTimestamps && (
                                        <span className="ws-message-time">
                                            {msg.timestamp.toLocaleTimeString()}
                                        </span>
                                    )}
                                    {msg.size && (
                                        <span className="ws-message-size">
                                            {formatBytes(msg.size)}
                                        </span>
                                    )}
                                </div>
                                <div className="ws-message-content">
                                    <pre>{formatContent(msg.content, msg.messageType)}</pre>
                                </div>
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Message Input Panel */}
            <div className="ws-input-panel">
                <div className="ws-input-type-selector">
                    <button
                        className={`ws-type-btn ${messageType === 'text' ? 'active' : ''}`}
                        onClick={() => setMessageType('text')}
                    >
                        Text
                    </button>
                    <button
                        className={`ws-type-btn ${messageType === 'json' ? 'active' : ''}`}
                        onClick={() => setMessageType('json')}
                    >
                        JSON
                    </button>
                </div>
                <div className="ws-input-area">
                    <textarea
                        className="ws-message-input"
                        placeholder={messageType === 'json' ? '{"key": "value"}' : 'Type a message...'}
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                sendMessage();
                            }
                        }}
                        disabled={connectionState !== 'connected'}
                    />
                    <button
                        className="ws-btn ws-btn-send"
                        onClick={sendMessage}
                        disabled={connectionState !== 'connected' || !messageInput.trim()}
                    >
                        Send
                    </button>
                </div>
                <div className="ws-input-hint">
                    Press Enter to send, Shift+Enter for new line
                </div>
            </div>
        </div>
    );
};

// Helper function to format bytes
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default WebSocketTester;
