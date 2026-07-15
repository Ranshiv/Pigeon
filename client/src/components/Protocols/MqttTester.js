// client/src/components/Protocols/MqttTester.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import AppSelect from '../common/AppSelect/AppSelect';
import './tester-shell.css';
import './MqttTester.css';

// Icon Components
const ConnectionIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 17l6-6-6-6" />
        <path d="M20 7l-6 6 6 6" />
    </svg>
);

const InboxIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
);

const SendIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
);

const MessageIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
);

const RadioIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="2" />
        <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
    </svg>
);

const GearIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
);

const ArrowUpIcon = ({ size = 12 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="19" x2="12" y2="5" />
        <polyline points="5 12 12 5 19 12" />
    </svg>
);

const ArrowDownIcon = ({ size = 12 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <polyline points="19 12 12 19 5 12" />
    </svg>
);

const InfoIcon = ({ size = 12 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
);

const AlertIcon = ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
);

/**
 * MqttTester Component
 *
 * A comprehensive UI for testing MQTT pub/sub messaging.
 * Supports broker connection, topic subscription, and message publishing.
 */
const MqttTester = ({
    initialBroker = '',
    onConnectionChange,
    onMessage,
    className = ''
}) => {
    // Connection state
    const [brokerUrl, setBrokerUrl] = useState(initialBroker);
    const [clientId, setClientId] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [connectionState, setConnectionState] = useState('disconnected');
    const [connectionId, setConnectionId] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    // Subscription state
    const [subscriptions, setSubscriptions] = useState([]);
    const [newTopic, setNewTopic] = useState('');
    const [newQos, setNewQos] = useState(0);

    // Publish state
    const [publishTopic, setPublishTopic] = useState('');
    const [publishMessage, setPublishMessage] = useState('');
    const [publishQos, setPublishQos] = useState(0);
    const [publishRetain, setPublishRetain] = useState(false);

    // Messages
    const [messages, setMessages] = useState([]);
    const [filter, setFilter] = useState('all'); // all, published, received

    // UI state
    const [showSettings, setShowSettings] = useState(false);
    const [autoScroll] = useState(true);

    const messagesEndRef = useRef(null);

    // Auto-scroll only when there are actual messages
    useEffect(() => {
        if (autoScroll && messagesEndRef.current && messages.length > 0) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [messages, autoScroll]);

    const connect = async () => {
        if (!brokerUrl) {
            setError('Broker URL is required');
            return;
        }

        setLoading(true);
        setError(null);
        setConnectionState('connecting');

        try {
            const response = await fetch('/api/protocols/mqtt/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: brokerUrl,
                    clientId: clientId || `pigeon-${Date.now()}`,
                    username: username || undefined,
                    password: password || undefined
                })
            });

            const data = await response.json();

            if (data.success) {
                setConnectionId(data.connectionId);
                setConnectionState('connected');
                addMessage('system', `Connected to ${brokerUrl}`);
                onConnectionChange?.('connected', data.connectionId);
            } else {
                setError(data.error);
                setConnectionState('error');
            }
        } catch (err) {
            setError(`Connection failed: ${err.message}`);
            setConnectionState('error');
        } finally {
            setLoading(false);
        }
    };

    const disconnect = async () => {
        if (!connectionId) return;

        try {
            await fetch(`/api/protocols/mqtt/${connectionId}`, {
                method: 'DELETE'
            });
        } finally {
            setConnectionId(null);
            setConnectionState('disconnected');
            setSubscriptions([]);
            addMessage('system', 'Disconnected from broker');
            onConnectionChange?.('disconnected', null);
        }
    };

    const subscribe = async () => {
        if (!connectionId || !newTopic.trim()) {
            setError('Enter a topic to subscribe');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/protocols/mqtt/${connectionId}/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic: newTopic,
                    qos: newQos
                })
            });

            const data = await response.json();

            if (data.success) {
                setSubscriptions(prev => [...prev, { topic: newTopic, qos: newQos }]);
                addMessage('system', `Subscribed to "${newTopic}" with QoS ${newQos}`);
                setNewTopic('');
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError(`Subscribe failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const unsubscribe = async (topic) => {
        if (!connectionId) return;

        try {
            await fetch(`/api/protocols/mqtt/${connectionId}/unsubscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic })
            });

            setSubscriptions(prev => prev.filter(s => s.topic !== topic));
            addMessage('system', `Unsubscribed from "${topic}"`);
        } catch (err) {
            setError(`Unsubscribe failed: ${err.message}`);
        }
    };

    const publish = async () => {
        if (!connectionId || !publishTopic.trim()) {
            setError('Enter a topic to publish');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/protocols/mqtt/${connectionId}/publish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic: publishTopic,
                    message: publishMessage,
                    qos: publishQos,
                    retain: publishRetain
                })
            });

            const data = await response.json();

            if (data.success) {
                addMessage('published', publishMessage, {
                    topic: publishTopic,
                    qos: publishQos,
                    retain: publishRetain
                });
                setPublishMessage('');
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError(`Publish failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const addMessage = useCallback((type, content, meta = {}) => {
        setMessages(prev => [...prev, {
            id: `msg-${Date.now()}-${Math.random()}`,
            type,
            content,
            timestamp: new Date(),
            ...meta
        }]);
        if (type !== 'system') {
            onMessage?.({ type, content, ...meta });
        }
    }, [onMessage]);

    const clearMessages = () => setMessages([]);

    const filteredMessages = messages.filter(m => {
        if (filter === 'published') return m.type === 'published';
        if (filter === 'received') return m.type === 'received';
        return true;
    });

    const sentCount = messages.filter(m => m.type === 'published').length;
    const receivedCount = messages.filter(m => m.type === 'received').length;
    const isConnected = connectionState === 'connected';

    const QOS_OPTIONS = [
        { value: 0, label: 'QoS 0' },
        { value: 1, label: 'QoS 1' },
        { value: 2, label: 'QoS 2' }
    ];

    const qosSelect = (value, onChange, id) => (
        <AppSelect
            id={id}
            className="mqtt-qos-select"
            value={value}
            onChange={onChange}
            options={QOS_OPTIONS}
            disabled={!isConnected}
        />
    );

    return (
        <div className={`mqtt-tester ${className}`}>
            {/* Connection Topbar */}
            <div className="mqtt-panel mqtt-connection-panel">
                <div className="mqtt-connection-header">
                    <h3 className="mqtt-panel-title"><ConnectionIcon size={16} /> Broker Connection</h3>
                    <div className={`ts-status ${connectionState}`}>
                        {connectionState}
                    </div>
                </div>

                <div className="mqtt-url-group">
                    <div className="mqtt-protocol-badge">MQTT</div>
                    <input
                        type="text"
                        className="mqtt-url-input"
                        placeholder="mqtt://broker.example.com:1883"
                        value={brokerUrl}
                        onChange={(e) => setBrokerUrl(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !isConnected && !loading && connect()}
                        disabled={isConnected}
                        aria-label="Broker URL"
                    />
                    {isConnected ? (
                        <button className="mqtt-btn mqtt-btn-disconnect" onClick={disconnect}>
                            Disconnect
                        </button>
                    ) : (
                        <button
                            className="mqtt-btn mqtt-btn-connect"
                            onClick={connect}
                            disabled={loading}
                        >
                            {loading ? 'Connecting…' : 'Connect'}
                        </button>
                    )}
                    <button
                        className={`mqtt-btn mqtt-btn-settings ${showSettings ? 'active' : ''}`}
                        onClick={() => setShowSettings(!showSettings)}
                        aria-label="Connection settings"
                        aria-expanded={showSettings}
                        title="Connection settings"
                    >
                        <GearIcon size={16} />
                    </button>
                </div>

                {showSettings && (
                    <div className="mqtt-settings">
                        <div className="mqtt-setting">
                            <label htmlFor="mqtt-client-id">Client ID</label>
                            <input
                                id="mqtt-client-id"
                                type="text"
                                value={clientId}
                                onChange={(e) => setClientId(e.target.value)}
                                placeholder="Auto-generated if empty"
                                disabled={isConnected}
                            />
                        </div>
                        <div className="mqtt-setting">
                            <label htmlFor="mqtt-username">Username</label>
                            <input
                                id="mqtt-username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Optional"
                                disabled={isConnected}
                            />
                        </div>
                        <div className="mqtt-setting">
                            <label htmlFor="mqtt-password">Password</label>
                            <input
                                id="mqtt-password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Optional"
                                disabled={isConnected}
                            />
                        </div>
                    </div>
                )}

                <div className="mqtt-kpi-strip">
                    <div className={`ts-kpi ${isConnected ? 'live' : ''}`}>
                        <div className="ts-kpi-label">Sent</div>
                        <div className="ts-kpi-value">{sentCount}</div>
                    </div>
                    <div className={`ts-kpi ${isConnected ? 'live' : ''}`}>
                        <div className="ts-kpi-label">Received</div>
                        <div className="ts-kpi-value">{receivedCount}</div>
                    </div>
                    <div className="ts-kpi">
                        <div className="ts-kpi-label">Subscriptions</div>
                        <div className="ts-kpi-value">{subscriptions.length}</div>
                    </div>
                </div>
            </div>

            {/* Main Content - Two Column Layout */}
            <div className="mqtt-main-content">
                {/* Left Column - Subscribe & Publish */}
                <div className="mqtt-left-column">
                    {/* Subscriptions Panel */}
                    <div className="mqtt-panel mqtt-subscriptions-panel">
                        <h3 className="mqtt-panel-title"><InboxIcon size={16} /> Subscriptions</h3>

                        <div className="mqtt-subscribe-form">
                            <input
                                type="text"
                                className="mqtt-topic-input"
                                placeholder="sensor/+/temperature"
                                value={newTopic}
                                onChange={(e) => setNewTopic(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && subscribe()}
                                disabled={!isConnected}
                                aria-label="Topic to subscribe"
                            />
                            {qosSelect(newQos, setNewQos, 'mqtt-subscribe-qos')}
                            <button
                                className="mqtt-btn mqtt-btn-subscribe"
                                onClick={subscribe}
                                disabled={!isConnected || loading}
                            >
                                Subscribe
                            </button>
                        </div>

                        <div className="mqtt-subscriptions-list">
                            {subscriptions.length === 0 ? (
                                <div className="mqtt-empty mqtt-empty-compact">
                                    {isConnected
                                        ? 'No active subscriptions'
                                        : 'Connect to a broker to subscribe'}
                                </div>
                            ) : (
                                subscriptions.map((sub, idx) => (
                                    <div key={idx} className="mqtt-subscription">
                                        <span className="mqtt-sub-topic">{sub.topic}</span>
                                        <span className="mqtt-sub-qos">QoS {sub.qos}</span>
                                        <button
                                            className="mqtt-btn-unsub"
                                            onClick={() => unsubscribe(sub.topic)}
                                            aria-label={`Unsubscribe from ${sub.topic}`}
                                            title="Unsubscribe"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="mqtt-topic-hints">
                            <span className="mqtt-hint"><code>+</code> single level wildcard</span>
                            <span className="mqtt-hint"><code>#</code> multi level wildcard</span>
                        </div>
                    </div>

                    {/* Publish Panel */}
                    <div className="mqtt-panel mqtt-publish-panel">
                        <h3 className="mqtt-panel-title"><SendIcon size={16} /> Publish Message</h3>

                        <div className="mqtt-publish-form">
                            <input
                                type="text"
                                className="mqtt-topic-input"
                                placeholder="sensor/living-room/temperature"
                                value={publishTopic}
                                onChange={(e) => setPublishTopic(e.target.value)}
                                disabled={!isConnected}
                                aria-label="Topic to publish to"
                            />

                            <textarea
                                className="mqtt-message-input"
                                placeholder='{"temperature": 23.5, "unit": "celsius"}'
                                value={publishMessage}
                                onChange={(e) => setPublishMessage(e.target.value)}
                                disabled={!isConnected}
                                aria-label="Message payload"
                            />

                            <div className="mqtt-publish-options">
                                {qosSelect(publishQos, setPublishQos, 'mqtt-publish-qos')}

                                <label className={`mqtt-retain-toggle ${publishRetain ? 'checked' : ''}`}>
                                    <input
                                        type="checkbox"
                                        checked={publishRetain}
                                        onChange={(e) => setPublishRetain(e.target.checked)}
                                        disabled={!isConnected}
                                    />
                                    Retain
                                </label>

                                <button
                                    className="mqtt-btn mqtt-btn-publish"
                                    onClick={publish}
                                    disabled={!isConnected || loading}
                                >
                                    <SendIcon size={13} /> Publish
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column - Messages */}
                <div className="mqtt-right-column">
                    <div className="mqtt-panel mqtt-messages-panel">
                        <div className="mqtt-messages-header">
                            <h3 className="mqtt-panel-title"><MessageIcon size={16} /> Messages</h3>
                            <div className="mqtt-message-filters" role="tablist" aria-label="Message filter">
                                {[
                                    { key: 'all', label: 'All', count: messages.length },
                                    { key: 'published', label: 'Sent', count: sentCount },
                                    { key: 'received', label: 'Received', count: receivedCount }
                                ].map(f => (
                                    <button
                                        key={f.key}
                                        role="tab"
                                        aria-selected={filter === f.key}
                                        className={`mqtt-filter-btn ${filter === f.key ? 'active' : ''}`}
                                        onClick={() => setFilter(f.key)}
                                    >
                                        {f.label}
                                        {f.count > 0 && <span className="mqtt-filter-count">{f.count}</span>}
                                    </button>
                                ))}
                            </div>
                            <button
                                className="mqtt-btn mqtt-btn-clear"
                                onClick={clearMessages}
                                disabled={messages.length === 0}
                            >
                                Clear
                            </button>
                        </div>

                        <div className="mqtt-messages-list">
                            {filteredMessages.length === 0 ? (
                                <div className="mqtt-empty">
                                    <span className="mqtt-empty-icon"><RadioIcon size={44} /></span>
                                    <p className="mqtt-empty-title">No messages yet</p>
                                    <p className="mqtt-empty-hint">
                                        Subscribe to topics and publish messages to see activity
                                    </p>
                                </div>
                            ) : (
                                filteredMessages.map(msg => (
                                    <div key={msg.id} className={`mqtt-message mqtt-message-${msg.type}`}>
                                        <div className="mqtt-message-header">
                                            <span className={`mqtt-message-type mqtt-type-${msg.type}`}>
                                                {msg.type === 'published' && <><ArrowUpIcon /> Published</>}
                                                {msg.type === 'received' && <><ArrowDownIcon /> Received</>}
                                                {msg.type === 'system' && <><InfoIcon /> System</>}
                                            </span>
                                            {msg.topic && (
                                                <span className="mqtt-message-topic">{msg.topic}</span>
                                            )}
                                            {msg.qos !== undefined && (
                                                <span className="mqtt-message-qos">QoS {msg.qos}</span>
                                            )}
                                            {msg.retain && (
                                                <span className="mqtt-message-retain">Retained</span>
                                            )}
                                            <span className="mqtt-message-time">
                                                {msg.timestamp.toLocaleTimeString()}
                                            </span>
                                        </div>
                                        <pre className="mqtt-message-content">{msg.content}</pre>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="mqtt-error" role="alert">
                    <span className="mqtt-error-text"><AlertIcon /> {error}</span>
                    <button onClick={() => setError(null)} aria-label="Dismiss error">×</button>
                </div>
            )}
        </div>
    );
};

export default MqttTester;
