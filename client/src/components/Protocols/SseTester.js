/**
 * SseTester.js - Server-Sent Events Testing Component
 * MQTT-style observability layout for real-time event streams.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import './tester-shell.css';
import './SseTester.css';

const Icon = ({ d, size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
);

const ICONS = {
    connection: ['M4 17l6-6-6-6', 'M20 7l-6 6 6 6'],
    radio: ['M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z', 'M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14'],
    refresh: ['M23 4v6h-6', 'M1 20v-6h6', 'M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15'],
    chart: ['M18 20V10', 'M12 20V4', 'M6 20v-6'],
    settings: ['M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'],
    save: ['M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z', 'M17 21v-8H7v8', 'M7 3v5h8'],
    file: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M16 13H8', 'M16 17H8'],
    tag: ['M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z', 'M7 7h.01'],
    trash: ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'],
    alert: ['M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z', 'M12 9v4', 'M12 17h.01'],
    info: ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M12 16v-4', 'M12 8h.01']
};

const SseTester = ({ initialUrl = '', onEventReceived, onConnectionChange, savedConnections = [] }) => {
    const [url, setUrl] = useState(initialUrl);
    const [connectionState, setConnectionState] = useState('disconnected');
    const [eventSource, setEventSource] = useState(null);
    const [withCredentials, setWithCredentials] = useState(false);
    const [eventTypes, setEventTypes] = useState(['message']);
    const [newEventType, setNewEventType] = useState('');
    const [events, setEvents] = useState([]);
    const [filter, setFilter] = useState('all');
    const [autoScroll, setAutoScroll] = useState(true);
    const [stats, setStats] = useState({ connected: null, eventsReceived: 0, lastEventTime: null, reconnects: 0 });
    const [error, setError] = useState(null);
    const [showConfig, setShowConfig] = useState(false);
    const eventsEndRef = useRef(null);
    const eventSourceRef = useRef(null);

    useEffect(() => {
        if (autoScroll && eventsEndRef.current && events.length > 0) {
            eventsEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [events, autoScroll]);

    useEffect(() => () => { if (eventSourceRef.current) eventSourceRef.current.close(); }, []);

    const addSystemEvent = useCallback((message) => {
        setEvents(prev => [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, type: 'system', data: message, timestamp: new Date() }]);
    }, []);

    const handleEvent = useCallback((type, event) => {
        const eventData = {
            id: `${Date.now()}${Math.random().toString(36).slice(2, 9)}`,
            type,
            data: event.data,
            lastEventId: event.lastEventId,
            origin: event.origin,
            timestamp: new Date()
        };
        try { eventData.parsedData = JSON.parse(event.data); } catch { eventData.parsedData = null; }
        setEvents(prev => [...prev, eventData]);
        setStats(prev => ({ ...prev, eventsReceived: prev.eventsReceived + 1, lastEventTime: new Date() }));
        onEventReceived?.(eventData);
    }, [onEventReceived]);

    const connect = useCallback(() => {
        if (!url.trim()) { setError('Please enter an SSE endpoint URL'); return; }
        if (eventSourceRef.current) eventSourceRef.current.close();
        setError(null);
        setConnectionState('connecting');

        try {
            let sseUrl = url;
            if (url.startsWith('/api/')) {
                sseUrl = `http://localhost:${process.env.REACT_APP_API_PORT || '5001'}${url}`;
            }
            const es = new EventSource(sseUrl, { withCredentials });
            eventSourceRef.current = es;
            setEventSource(es);

            es.onopen = () => {
                setConnectionState('connected');
                setStats(prev => ({ ...prev, connected: new Date(), eventsReceived: 0 }));
                addSystemEvent(`Connected to ${url}`);
                onConnectionChange?.({ state: 'connected', url });
            };
            es.onmessage = (event) => handleEvent('message', event);
            eventTypes.filter(t => t !== 'message').forEach(type => {
                es.addEventListener(type, (event) => handleEvent(type, event));
            });
            es.onerror = () => {
                if (es.readyState === EventSource.CLOSED) {
                    setConnectionState('disconnected');
                    addSystemEvent('Connection closed');
                } else if (es.readyState === EventSource.CONNECTING) {
                    setConnectionState('reconnecting');
                    setStats(prev => ({ ...prev, reconnects: prev.reconnects + 1 }));
                    addSystemEvent('Reconnecting...');
                }
                onConnectionChange?.({ state: 'error', url });
            };
        } catch (err) {
            setError(err.message);
            setConnectionState('disconnected');
        }
    }, [url, withCredentials, eventTypes, onConnectionChange, handleEvent, addSystemEvent]);

    const disconnect = useCallback(() => {
        if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; setEventSource(null); }
        setConnectionState('disconnected');
        addSystemEvent('Disconnected');
        onConnectionChange?.({ state: 'disconnected', url });
    }, [url, onConnectionChange, addSystemEvent]);

    const addEventType = useCallback(() => {
        const type = newEventType.trim();
        if (type && !eventTypes.includes(type)) {
            setEventTypes(prev => [...prev, type]);
            setNewEventType('');
            if (eventSourceRef.current && connectionState === 'connected') {
                eventSourceRef.current.addEventListener(type, (event) => handleEvent(type, event));
            }
        }
    }, [newEventType, eventTypes, connectionState, handleEvent]);

    const removeEventType = useCallback((type) => {
        if (type === 'message') return;
        setEventTypes(prev => prev.filter(t => t !== type));
    }, []);

    const clearEvents = useCallback(() => setEvents([]), []);

    const formatTime = (date) => date ? date.toLocaleTimeString('en-US', { hour12: false }) : '-';

    const formatDuration = () => {
        if (!stats.connected) return '-';
        const diff = Math.floor((new Date() - stats.connected) / 1000);
        const h = Math.floor(diff / 3600).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    const filteredEvents = events.filter(event => {
        if (filter === 'all') return true;
        if (filter === 'data') return event.type !== 'system';
        return event.type === filter;
    });

    const receivedEventTypes = [...new Set(events.filter(e => e.type !== 'system').map(e => e.type))];
    const filters = [
        { key: 'all', label: 'All', count: events.length },
        { key: 'data', label: 'Data', count: events.filter(e => e.type !== 'system').length },
        { key: 'system', label: 'System', count: events.filter(e => e.type === 'system').length }
    ];
    const isConnected = connectionState === 'connected';

    const statusClass = connectionState === 'connected' ? 'connected' : connectionState === 'connecting' || connectionState === 'reconnecting' ? 'running' : 'disconnected';

    return (
        <div className="sse-tester">
            {error && (
                <div className="sse-error" role="alert">
                    <span className="sse-error-text"><Icon d={ICONS.alert} size={14} /> {error}</span>
                    <button onClick={() => setError(null)} aria-label="Dismiss error">×</button>
                </div>
            )}

            <div className="sse-panel sse-connection-panel">
                <div className="sse-connection-header">
                    <h3 className="sse-panel-title"><Icon d={ICONS.connection} size={16} /> Endpoint Connection</h3>
                    <div className={`ts-status ${statusClass}`}>{connectionState}</div>
                </div>

                <div className="sse-url-group">
                    <div className="sse-protocol-badge">SSE</div>
                    <input
                        type="text"
                        className="sse-url-input"
                        placeholder="https://api.example.com/events"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && connectionState === 'disconnected' && url.trim() && connect()}
                        disabled={isConnected}
                        aria-label="SSE endpoint URL"
                    />
                    {isConnected ? (
                        <button className="sse-btn sse-btn-disconnect" onClick={disconnect}>Disconnect</button>
                    ) : (
                        <button className="sse-btn sse-btn-connect" onClick={connect} disabled={!url.trim()}>Connect</button>
                    )}
                    <button
                        className={`sse-btn sse-btn-settings ${showConfig ? 'active' : ''}`}
                        onClick={() => setShowConfig(!showConfig)}
                        aria-label="Connection settings"
                        aria-expanded={showConfig}
                        title="Connection settings"
                    >
                        <Icon d={ICONS.settings} size={16} />
                    </button>
                </div>

                {showConfig && (
                    <div className="sse-settings">
                        <div className="sse-setting">
                            <label>Event Types</label>
                            <div className="sse-event-types">
                                {eventTypes.map(type => (
                                    <span key={type} className="sse-event-type-tag">
                                        {type}
                                        {type !== 'message' && <button onClick={() => removeEventType(type)} aria-label={`Remove ${type}`}>×</button>}
                                    </span>
                                ))}
                                <div className="sse-add-event-type">
                                    <input
                                        type="text"
                                        value={newEventType}
                                        onChange={(e) => setNewEventType(e.target.value)}
                                        placeholder="Add type"
                                        onKeyDown={(e) => e.key === 'Enter' && addEventType()}
                                    />
                                    <button onClick={addEventType}>+</button>
                                </div>
                            </div>
                        </div>
                        <div className="sse-setting">
                            <label>Options</label>
                            <label className="sse-setting-row">
                                <input
                                    type="checkbox"
                                    checked={withCredentials}
                                    onChange={(e) => setWithCredentials(e.target.checked)}
                                    disabled={isConnected}
                                />
                                Include credentials (cookies)
                            </label>
                        </div>
                    </div>
                )}

                <div className="sse-kpi-strip">
                    <div className={`ts-kpi ${isConnected ? 'live' : ''}`}>
                        <div className="ts-kpi-label">Events</div>
                        <div className="ts-kpi-value">{stats.eventsReceived}</div>
                    </div>
                    <div className="ts-kpi">
                        <div className="ts-kpi-label">Duration</div>
                        <div className="ts-kpi-value" style={{ fontSize: '1.05rem' }}>{formatDuration()}</div>
                    </div>
                    <div className="ts-kpi">
                        <div className="ts-kpi-label">Reconnects</div>
                        <div className="ts-kpi-value">{stats.reconnects}</div>
                    </div>
                    <div className="ts-kpi">
                        <div className="ts-kpi-label">Types</div>
                        <div className="ts-kpi-value">{receivedEventTypes.length}</div>
                    </div>
                </div>
            </div>

            <div className="sse-main-content">
                <div className="sse-left-column">
                    <div className="sse-panel sse-config-panel">
                        <h3 className="sse-panel-title"><Icon d={ICONS.tag} size={16} /> Filters & Controls</h3>

                        <div className="sse-setting" style={{ marginBottom: '14px' }}>
                            <label>Event Filter</label>
                            <div className="sse-event-filters" role="tablist" aria-label="Event filter">
                                {filters.map(f => (
                                    <button
                                        key={f.key}
                                        role="tab"
                                        aria-selected={filter === f.key}
                                        className={`sse-filter-btn ${filter === f.key ? 'active' : ''}`}
                                        onClick={() => setFilter(f.key)}
                                    >
                                        {f.label}
                                        {f.count > 0 && <span className="sse-filter-count">{f.count}</span>}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <label className="sse-setting-row">
                            <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
                            Auto-scroll to latest event
                        </label>
                    </div>

                    {connectionState === 'disconnected' && events.length === 0 && (
                        <div className="sse-panel sse-info-panel">
                            <h3 className="sse-panel-title"><Icon d={ICONS.info} size={16} /> About Server-Sent Events</h3>
                            <p className="sse-empty-hint" style={{ marginBottom: '14px' }}>
                                SSE provides a one-way communication channel from server to client, ideal for real-time updates, notifications, and live feeds.
                            </p>
                            <div className="sse-info-grid">
                                <div className="sse-info-feature"><Icon d={ICONS.refresh} size={14} /> Automatic reconnection</div>
                                <div className="sse-info-feature"><Icon d={ICONS.file} size={14} /> Text-based (UTF-8)</div>
                                <div className="sse-info-feature"><Icon d={ICONS.tag} size={14} /> Named event types</div>
                                <div className="sse-info-feature"><Icon d={ICONS.save} size={14} /> Event IDs for resuming</div>
                            </div>
                        </div>
                    )}

                    {savedConnections.length > 0 && (
                        <div className="sse-panel sse-saved-panel">
                            <h3 className="sse-panel-title"><Icon d={ICONS.save} size={16} /> Saved Connections</h3>
                            <div className="sse-saved-list">
                                {savedConnections.map(saved => (
                                    <div key={saved.id} className="sse-saved-item" onClick={() => setUrl(saved.url)}>
                                        <span className="sse-saved-url">{saved.url}</span>
                                        <span className="sse-saved-time">{new Date(saved.timestamp).toLocaleDateString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="sse-right-column">
                    <div className="sse-panel sse-events-panel">
                        <div className="sse-events-header">
                            <h3 className="sse-panel-title"><Icon d={ICONS.radio} size={16} /> Event Stream</h3>
                            <button className="sse-btn sse-btn-clear" onClick={clearEvents} disabled={events.length === 0}>
                                <Icon d={ICONS.trash} size={14} /> Clear
                            </button>
                        </div>

                        <div className="sse-events-list">
                            {filteredEvents.length === 0 ? (
                                <div className="sse-empty">
                                    <span className="sse-empty-icon"><Icon d={ICONS.radio} size={44} /></span>
                                    <p className="sse-empty-title">No events received yet</p>
                                    <p className="sse-empty-hint">
                                        {isConnected ? 'Waiting for events...' : 'Connect to an SSE endpoint to see events'}
                                    </p>
                                </div>
                            ) : (
                                filteredEvents.map(event => (
                                    <div key={event.id} className={`sse-event sse-event-${event.type === 'system' ? 'system' : 'message'}`}>
                                        <div className="sse-event-header">
                                            <span className="sse-event-type">{event.type}</span>
                                            {event.lastEventId && <span className="sse-event-id">ID: {event.lastEventId}</span>}
                                            <span className="sse-event-time">{formatTime(event.timestamp)}</span>
                                        </div>
                                        {event.type !== 'system' ? (
                                            <pre className="sse-event-content">
                                                {event.parsedData ? JSON.stringify(event.parsedData, null, 2) : event.data}
                                            </pre>
                                        ) : (
                                            <div className="sse-event-system-message">{event.data}</div>
                                        )}
                                    </div>
                                ))
                            )}
                            <div ref={eventsEndRef} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SseTester;
