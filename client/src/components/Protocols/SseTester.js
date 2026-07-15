/**
 * SseTester.js - Server-Sent Events Testing Component
 * UI for connecting to SSE endpoints and viewing real-time event streams
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import './tester-shell.css';
import './SseTester.css';

// Icon Components
const RefreshIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
);

const ChartIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
);

const RadioIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="2" />
        <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
    </svg>
);

const TrashIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
);

const BookIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
);

const FileTextIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
);

const TagIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
);

const SaveIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
        <polyline points="17 21 17 13 7 13 7 21" />
        <polyline points="7 3 7 8 15 8" />
    </svg>
);

const SseTester = ({
    initialUrl = '',
    onEventReceived,
    onConnectionChange,
    savedConnections = []
}) => {
    // Connection State
    const [url, setUrl] = useState(initialUrl);
    const [connectionState, setConnectionState] = useState('disconnected');
    const [eventSource, setEventSource] = useState(null);

    // Configuration
    const [withCredentials, setWithCredentials] = useState(false);
    const [eventTypes, setEventTypes] = useState(['message']);
    const [newEventType, setNewEventType] = useState('');

    // Events State
    const [events, setEvents] = useState([]);
    const [filter, setFilter] = useState('all');
    const [autoScroll, setAutoScroll] = useState(true);

    // Stats
    const [stats, setStats] = useState({
        connected: null,
        eventsReceived: 0,
        lastEventTime: null,
        reconnects: 0
    });

    // UI State
    const [error, setError] = useState(null);
    const [showConfig, setShowConfig] = useState(false);

    // Refs
    const eventsEndRef = useRef(null);
    const eventSourceRef = useRef(null);

    // Auto-scroll effect - only scroll when there are actual events
    useEffect(() => {
        if (autoScroll && eventsEndRef.current && events.length > 0) {
            eventsEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [events, autoScroll]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, []);

    // Connect to SSE endpoint
    const connect = useCallback(() => {
        if (!url.trim()) {
            setError('Please enter an SSE endpoint URL');
            return;
        }

        // Close existing connection
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }

        setError(null);
        setConnectionState('connecting');

        try {
            // For relative URLs in development, use the backend server directly
            let sseUrl = url;
            if (url.startsWith('/api/')) {
                // In development, the backend runs on port 5001
                const backendPort = process.env.REACT_APP_API_PORT || '5001';
                sseUrl = `http://localhost:${backendPort}${url}`;
            }

            const es = new EventSource(sseUrl, { withCredentials });
            eventSourceRef.current = es;
            setEventSource(es);

            // Connection opened
            es.onopen = () => {
                setConnectionState('connected');
                setStats(prev => ({
                    ...prev,
                    connected: new Date(),
                    eventsReceived: 0
                }));

                addSystemEvent('Connected to SSE endpoint');

                if (onConnectionChange) {
                    onConnectionChange({ state: 'connected', url });
                }
            };

            // Default message handler
            es.onmessage = (event) => {
                handleEvent('message', event);
            };

            // Add handlers for custom event types
            eventTypes.filter(t => t !== 'message').forEach(type => {
                es.addEventListener(type, (event) => {
                    handleEvent(type, event);
                });
            });

            // Error handler
            es.onerror = (event) => {
                if (es.readyState === EventSource.CLOSED) {
                    setConnectionState('disconnected');
                    addSystemEvent('Connection closed');
                } else if (es.readyState === EventSource.CONNECTING) {
                    setConnectionState('reconnecting');
                    setStats(prev => ({ ...prev, reconnects: prev.reconnects + 1 }));
                    addSystemEvent('Reconnecting...');
                }

                if (onConnectionChange) {
                    onConnectionChange({ state: 'error', url });
                }
            };
        } catch (err) {
            setError(err.message);
            setConnectionState('disconnected');
        }
    }, [url, withCredentials, eventTypes, onConnectionChange]);

    // Handle incoming event
    const handleEvent = useCallback((type, event) => {
        const eventData = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            type,
            data: event.data,
            lastEventId: event.lastEventId,
            origin: event.origin,
            timestamp: new Date()
        };

        // Try to parse JSON data
        try {
            eventData.parsedData = JSON.parse(event.data);
        } catch {
            eventData.parsedData = null;
        }

        setEvents(prev => [...prev, eventData]);
        setStats(prev => ({
            ...prev,
            eventsReceived: prev.eventsReceived + 1,
            lastEventTime: new Date()
        }));

        if (onEventReceived) {
            onEventReceived(eventData);
        }
    }, [onEventReceived]);

    // Add system event
    const addSystemEvent = useCallback((message) => {
        setEvents(prev => [...prev, {
            id: Date.now().toString(),
            type: 'system',
            data: message,
            timestamp: new Date()
        }]);
    }, []);

    // Disconnect
    const disconnect = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
            setEventSource(null);
        }
        setConnectionState('disconnected');
        addSystemEvent('Disconnected');

        if (onConnectionChange) {
            onConnectionChange({ state: 'disconnected', url });
        }
    }, [url, onConnectionChange, addSystemEvent]);

    // Add event type listener
    const addEventType = useCallback(() => {
        if (newEventType.trim() && !eventTypes.includes(newEventType.trim())) {
            setEventTypes(prev => [...prev, newEventType.trim()]);
            setNewEventType('');

            // If connected, add listener to existing EventSource
            if (eventSourceRef.current && connectionState === 'connected') {
                eventSourceRef.current.addEventListener(newEventType.trim(), (event) => {
                    handleEvent(newEventType.trim(), event);
                });
            }
        }
    }, [newEventType, eventTypes, connectionState, handleEvent]);

    // Remove event type listener
    const removeEventType = useCallback((type) => {
        if (type === 'message') return; // Can't remove default message type
        setEventTypes(prev => prev.filter(t => t !== type));
    }, []);

    // Clear events
    const clearEvents = useCallback(() => {
        setEvents([]);
    }, []);

    // Filter events
    const filteredEvents = events.filter(event => {
        if (filter === 'all') return true;
        if (filter === 'data') return event.type !== 'system';
        return event.type === filter;
    });

    // Get unique event types from received events
    const receivedEventTypes = [...new Set(events.map(e => e.type))];

    // Format time
    const formatTime = (date) => {
        if (!date) return '-';
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    };

    // Format duration
    const formatDuration = () => {
        if (!stats.connected) return '-';
        const diff = Math.floor((new Date() - stats.connected) / 1000);
        const hours = Math.floor(diff / 3600);
        const minutes = Math.floor((diff % 3600) / 60);
        const seconds = diff % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <div className="sse-tester">
            {/* Error Display */}
            {error && (
                <div className="sse-error">
                    <span>⚠️ {error}</span>
                    <button onClick={() => setError(null)}>×</button>
                </div>
            )}

            {/* Connection Panel */}
            <div className="sse-panel sse-connection-panel">
                <div className="sse-url-group">
                    <span className="sse-protocol-badge">SSE</span>
                    <input
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://api.example.com/events"
                        className="sse-url-input"
                        disabled={connectionState === 'connected'}
                    />
                    {connectionState === 'disconnected' ? (
                        <button
                            className="sse-btn sse-btn-connect"
                            onClick={connect}
                            disabled={!url.trim()}
                        >
                            Connect
                        </button>
                    ) : (
                        <button
                            className="sse-btn sse-btn-disconnect"
                            onClick={disconnect}
                        >
                            Disconnect
                        </button>
                    )}
                    <button
                        className={`sse-btn sse-btn-settings ${showConfig ? 'active' : ''}`}
                        onClick={() => setShowConfig(!showConfig)}
                    >
                        ⚙️
                    </button>
                </div>

                {/* Configuration */}
                {showConfig && (
                    <div className="sse-config">
                        <div className="sse-config-row">
                            <label className="sse-checkbox">
                                <input
                                    type="checkbox"
                                    checked={withCredentials}
                                    onChange={(e) => setWithCredentials(e.target.checked)}
                                    disabled={connectionState === 'connected'}
                                />
                                Include credentials (cookies)
                            </label>
                        </div>

                        <div className="sse-config-row">
                            <label>Event Types:</label>
                            <div className="sse-event-types">
                                {eventTypes.map(type => (
                                    <span key={type} className="sse-event-type-tag">
                                        {type}
                                        {type !== 'message' && (
                                            <button onClick={() => removeEventType(type)}>×</button>
                                        )}
                                    </span>
                                ))}
                                <div className="sse-add-event-type">
                                    <input
                                        type="text"
                                        value={newEventType}
                                        onChange={(e) => setNewEventType(e.target.value)}
                                        placeholder="Add event type"
                                        onKeyPress={(e) => e.key === 'Enter' && addEventType()}
                                    />
                                    <button onClick={addEventType}>+</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Status Bar */}
                <div className={`sse-status sse-status-${connectionState}`}>
                    <span className="sse-status-dot"></span>
                    <span className="sse-status-text">
                        {connectionState === 'connected' && 'Connected'}
                        {connectionState === 'connecting' && 'Connecting...'}
                        {connectionState === 'reconnecting' && 'Reconnecting...'}
                        {connectionState === 'disconnected' && 'Disconnected'}
                    </span>

                    {connectionState === 'connected' && (
                        <div className="sse-stats">
                            <span><ChartIcon size={14} /> {stats.eventsReceived} events</span>
                            <span>⏱️ {formatDuration()}</span>
                            {stats.reconnects > 0 && (
                                <span><RefreshIcon size={14} /> {stats.reconnects} reconnects</span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Events Panel */}
            <div className="sse-panel sse-events-panel">
                <div className="sse-events-header">
                    <h3 className="sse-panel-title"><RadioIcon size={16} /> Event Stream</h3>

                    <div className="sse-events-controls">
                        <div className="sse-filter-group">
                            <select
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                            >
                                <option value="all">All Events</option>
                                <option value="data">Data Only</option>
                                {receivedEventTypes
                                    .filter(t => t !== 'system')
                                    .map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))
                                }
                            </select>
                        </div>

                        <label className="sse-checkbox sse-autoscroll">
                            <input
                                type="checkbox"
                                checked={autoScroll}
                                onChange={(e) => setAutoScroll(e.target.checked)}
                            />
                            Auto-scroll
                        </label>

                        <button
                            className="sse-btn sse-btn-clear"
                            onClick={clearEvents}
                            disabled={events.length === 0}
                        >
                            <TrashIcon size={14} /> Clear
                        </button>
                    </div>
                </div>

                <div className="sse-events-list">
                    {filteredEvents.length === 0 ? (
                        <div className="sse-empty">
                            <span className="sse-empty-icon"><RadioIcon size={48} /></span>
                            <p>No events received yet</p>
                            <span className="sse-empty-hint">
                                {connectionState === 'connected'
                                    ? 'Waiting for events...'
                                    : 'Connect to an SSE endpoint to see events'
                                }
                            </span>
                        </div>
                    ) : (
                        filteredEvents.map(event => (
                            <div
                                key={event.id}
                                className={`sse-event sse-event-${event.type}`}
                            >
                                <div className="sse-event-header">
                                    <span className="sse-event-type">{event.type}</span>
                                    {event.lastEventId && (
                                        <span className="sse-event-id">ID: {event.lastEventId}</span>
                                    )}
                                    <span className="sse-event-time">
                                        {formatTime(event.timestamp)}
                                    </span>
                                </div>

                                {event.type !== 'system' ? (
                                    <div className="sse-event-content">
                                        {event.parsedData ? (
                                            <pre className="sse-event-json">
                                                {JSON.stringify(event.parsedData, null, 2)}
                                            </pre>
                                        ) : (
                                            <pre className="sse-event-text">{event.data}</pre>
                                        )}
                                    </div>
                                ) : (
                                    <div className="sse-event-system-message">
                                        {event.data}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                    <div ref={eventsEndRef} />
                </div>
            </div>

            {/* Quick Info */}
            {connectionState === 'disconnected' && events.length === 0 && (
                <div className="sse-info-panel">
                    <h4><BookIcon size={16} /> About Server-Sent Events</h4>
                    <div className="sse-info-content">
                        <p>
                            SSE provides a one-way communication channel from server to client,
                            ideal for real-time updates, notifications, and live feeds.
                        </p>
                        <div className="sse-info-features">
                            <div className="sse-info-feature">
                                <span><RefreshIcon size={14} /></span>
                                <span>Automatic reconnection</span>
                            </div>
                            <div className="sse-info-feature">
                                <span><FileTextIcon size={14} /></span>
                                <span>Text-based (UTF-8)</span>
                            </div>
                            <div className="sse-info-feature">
                                <span><TagIcon size={14} /></span>
                                <span>Named event types</span>
                            </div>
                            <div className="sse-info-feature">
                                <span>🆔</span>
                                <span>Event IDs for resuming</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Saved Connections */}
            {savedConnections.length > 0 && (
                <div className="sse-panel sse-saved-panel">
                    <h3 className="sse-panel-title"><SaveIcon size={16} /> Saved Connections</h3>
                    <div className="sse-saved-list">
                        {savedConnections.map(saved => (
                            <div
                                key={saved.id}
                                className="sse-saved-item"
                                onClick={() => setUrl(saved.url)}
                            >
                                <span className="sse-saved-url">{saved.url}</span>
                                <span className="sse-saved-time">
                                    {new Date(saved.timestamp).toLocaleDateString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SseTester;
