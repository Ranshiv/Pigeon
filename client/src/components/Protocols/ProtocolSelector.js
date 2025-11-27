// client/src/components/Protocols/ProtocolSelector.js
import React, { useState, useEffect } from 'react';
import './ProtocolSelector.css';

// Modern SVG Protocol Icons
const ProtocolIcon = ({ type, size = 20, color = 'currentColor' }) => {
    const icons = {
        http: (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
        ),
        websocket: (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 17l6-6-6-6" />
                <path d="M20 7l-6 6 6 6" />
                <line x1="4" y1="12" x2="20" y2="12" />
            </svg>
        ),
        grpc: (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
        ),
        graphql: (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
                <circle cx="12" cy="12" r="3" />
                <line x1="12" y1="2" x2="12" y2="9" />
                <line x1="22" y1="8.5" x2="15" y2="12" />
                <line x1="22" y1="15.5" x2="15" y2="12" />
                <line x1="12" y1="22" x2="12" y2="15" />
                <line x1="2" y1="15.5" x2="9" y2="12" />
                <line x1="2" y1="8.5" x2="9" y2="12" />
            </svg>
        ),
        soap: (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="8" y1="13" x2="16" y2="13" />
                <line x1="8" y1="17" x2="16" y2="17" />
            </svg>
        ),
        mqtt: (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="17" x2="12" y2="17" />
                <path d="M12 2v4" />
                <path d="M12 18v4" />
                <path d="M4.93 4.93l2.83 2.83" />
                <path d="M16.24 16.24l2.83 2.83" />
            </svg>
        ),
        sse: (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="M12 5l7 7-7 7" />
                <path d="M5 5v14" />
            </svg>
        )
    };
    return icons[type] || icons.http;
};

export { ProtocolIcon };

/**
 * ProtocolSelector Component
 * 
 * A visual selector for choosing between different API protocols.
 * Displays protocol options with icons, descriptions, and visual indicators.
 */
const ProtocolSelector = ({
    selectedProtocol,
    onProtocolChange,
    protocols = null,
    showDescriptions = true,
    size = 'medium',
    orientation = 'horizontal',
    disabled = false
}) => {
    const [hoveredProtocol, setHoveredProtocol] = useState(null);

    // Default protocol definitions with modern icons
    const defaultProtocols = [
        {
            id: 'http',
            name: 'HTTP/REST',
            icon: 'http',
            color: '#3B82F6',
            description: 'Standard HTTP requests with REST conventions',
            features: ['GET, POST, PUT, DELETE', 'JSON/XML bodies', 'Headers & Auth']
        },
        {
            id: 'websocket',
            name: 'WebSocket',
            icon: 'websocket',
            color: '#8B5CF6',
            description: 'Full-duplex real-time communication',
            features: ['Bidirectional', 'Persistent connection', 'Low latency']
        },
        {
            id: 'grpc',
            name: 'gRPC',
            icon: 'grpc',
            color: '#06B6D4',
            description: 'High-performance RPC with Protocol Buffers',
            features: ['Streaming', 'Strong typing', 'HTTP/2']
        },
        {
            id: 'graphql',
            name: 'GraphQL',
            icon: 'graphql',
            color: '#E535AB',
            description: 'Query language for flexible data fetching',
            features: ['Flexible queries', 'Type system', 'Subscriptions']
        },
        {
            id: 'soap',
            name: 'SOAP',
            icon: 'soap',
            color: '#F59E0B',
            description: 'XML-based enterprise web services',
            features: ['WSDL', 'WS-Security', 'Standardized']
        },
        {
            id: 'mqtt',
            name: 'MQTT',
            icon: 'mqtt',
            color: '#22C55E',
            description: 'Lightweight pub/sub messaging for IoT',
            features: ['Publish/Subscribe', 'QoS levels', 'Retained messages']
        },
        {
            id: 'sse',
            name: 'SSE',
            icon: 'sse',
            color: '#EF4444',
            description: 'Server-Sent Events for real-time updates',
            features: ['Server push', 'Auto-reconnect', 'Event types']
        }
    ];

    const protocolList = protocols || defaultProtocols;

    const handleSelect = (protocolId) => {
        if (!disabled && onProtocolChange) {
            onProtocolChange(protocolId);
        }
    };

    const getProtocolBadge = (protocol) => {
        const badges = {
            http: 'Standard',
            websocket: 'Real-time',
            grpc: 'High-perf',
            graphql: 'Flexible',
            soap: 'Enterprise',
            mqtt: 'IoT',
            sse: 'Push'
        };
        return badges[protocol.id] || '';
    };

    return (
        <div
            className={`protocol-selector protocol-selector--${size} protocol-selector--${orientation} ${disabled ? 'protocol-selector--disabled' : ''}`}
        >
            <div className="protocol-selector__header">
                <h3 className="protocol-selector__title">Select Protocol</h3>
                {selectedProtocol && (
                    <span className="protocol-selector__current">
                        Current: {protocolList.find(p => p.id === selectedProtocol)?.name || selectedProtocol}
                    </span>
                )}
            </div>

            <div className="protocol-selector__grid">
                {protocolList.map((protocol) => (
                    <div
                        key={protocol.id}
                        className={`protocol-card ${selectedProtocol === protocol.id ? 'protocol-card--selected' : ''} ${hoveredProtocol === protocol.id ? 'protocol-card--hovered' : ''}`}
                        style={{ '--protocol-color': protocol.color }}
                        onClick={() => handleSelect(protocol.id)}
                        onMouseEnter={() => setHoveredProtocol(protocol.id)}
                        onMouseLeave={() => setHoveredProtocol(null)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && handleSelect(protocol.id)}
                    >
                        <div className="protocol-card__icon-wrapper">
                            <span className="protocol-card__icon">
                                <ProtocolIcon type={protocol.icon} size={22} color={protocol.color} />
                            </span>
                            {selectedProtocol === protocol.id && (
                                <span className="protocol-card__check">✓</span>
                            )}
                        </div>

                        <div className="protocol-card__content">
                            <div className="protocol-card__header">
                                <h4 className="protocol-card__name">{protocol.name}</h4>
                                <span className="protocol-card__badge">{getProtocolBadge(protocol)}</span>
                            </div>

                            {showDescriptions && (
                                <>
                                    <p className="protocol-card__description">{protocol.description}</p>

                                    <ul className="protocol-card__features">
                                        {protocol.features.map((feature, idx) => (
                                            <li key={idx} className="protocol-card__feature">
                                                <span className="protocol-card__feature-dot">•</span>
                                                {feature}
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </div>

                        <div className="protocol-card__indicator" />
                    </div>
                ))}
            </div>

            {hoveredProtocol && showDescriptions && (
                <div className="protocol-selector__tooltip">
                    <span className="protocol-selector__tooltip-text">
                        Click to switch to {protocolList.find(p => p.id === hoveredProtocol)?.name}
                    </span>
                </div>
            )}
        </div>
    );
};

/**
 * Compact Protocol Switcher
 * A smaller, inline version for quick switching
 */
export const ProtocolSwitcher = ({
    selectedProtocol,
    onProtocolChange,
    protocols = null,
    disabled = false
}) => {
    const defaultProtocols = [
        { id: 'http', name: 'HTTP', icon: 'http', color: '#3B82F6' },
        { id: 'websocket', name: 'WS', icon: 'websocket', color: '#8B5CF6' },
        { id: 'grpc', name: 'gRPC', icon: 'grpc', color: '#06B6D4' },
        { id: 'graphql', name: 'GQL', icon: 'graphql', color: '#E535AB' },
        { id: 'soap', name: 'SOAP', icon: 'soap', color: '#F59E0B' },
        { id: 'mqtt', name: 'MQTT', icon: 'mqtt', color: '#22C55E' },
        { id: 'sse', name: 'SSE', icon: 'sse', color: '#EF4444' }
    ];

    const protocolList = protocols || defaultProtocols;

    return (
        <div className={`protocol-switcher ${disabled ? 'protocol-switcher--disabled' : ''}`}>
            {protocolList.map((protocol) => (
                <button
                    key={protocol.id}
                    className={`protocol-switcher__btn ${selectedProtocol === protocol.id ? 'protocol-switcher__btn--active' : ''}`}
                    style={{ '--protocol-color': protocol.color }}
                    onClick={() => !disabled && onProtocolChange?.(protocol.id)}
                    disabled={disabled}
                    title={protocol.name}
                >
                    <span className="protocol-switcher__icon">
                        <ProtocolIcon type={protocol.icon} size={16} color={selectedProtocol === protocol.id ? '#fff' : protocol.color} />
                    </span>
                    <span className="protocol-switcher__name">{protocol.name}</span>
                </button>
            ))}
        </div>
    );
};

/**
 * Protocol Dropdown
 * A dropdown version for limited space
 */
export const ProtocolDropdown = ({
    selectedProtocol,
    onProtocolChange,
    protocols = null,
    disabled = false
}) => {
    const [isOpen, setIsOpen] = useState(false);

    const defaultProtocols = [
        { id: 'http', name: 'HTTP/REST', icon: 'http', color: '#3B82F6' },
        { id: 'websocket', name: 'WebSocket', icon: 'websocket', color: '#8B5CF6' },
        { id: 'grpc', name: 'gRPC', icon: 'grpc', color: '#06B6D4' },
        { id: 'graphql', name: 'GraphQL', icon: 'graphql', color: '#E535AB' },
        { id: 'soap', name: 'SOAP', icon: 'soap', color: '#F59E0B' },
        { id: 'mqtt', name: 'MQTT', icon: 'mqtt', color: '#22C55E' },
        { id: 'sse', name: 'SSE', icon: 'sse', color: '#EF4444' }
    ];

    const protocolList = protocols || defaultProtocols;
    const selected = protocolList.find(p => p.id === selectedProtocol) || protocolList[0];

    const handleSelect = (protocolId) => {
        onProtocolChange?.(protocolId);
        setIsOpen(false);
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!e.target.closest('.protocol-dropdown')) {
                setIsOpen(false);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    return (
        <div className={`protocol-dropdown ${isOpen ? 'protocol-dropdown--open' : ''} ${disabled ? 'protocol-dropdown--disabled' : ''}`}>
            <button
                className="protocol-dropdown__trigger"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                style={{ '--protocol-color': selected.color }}
            >
                <span className="protocol-dropdown__icon">
                    <ProtocolIcon type={selected.icon} size={18} color={selected.color} />
                </span>
                <span className="protocol-dropdown__name">{selected.name}</span>
                <span className="protocol-dropdown__arrow">{isOpen ? '▲' : '▼'}</span>
            </button>

            {isOpen && (
                <div className="protocol-dropdown__menu">
                    {protocolList.map((protocol) => (
                        <button
                            key={protocol.id}
                            className={`protocol-dropdown__item ${selectedProtocol === protocol.id ? 'protocol-dropdown__item--selected' : ''}`}
                            onClick={() => handleSelect(protocol.id)}
                            style={{ '--protocol-color': protocol.color }}
                        >
                            <span className="protocol-dropdown__item-icon">
                                <ProtocolIcon type={protocol.icon} size={16} color={protocol.color} />
                            </span>
                            <span className="protocol-dropdown__item-name">{protocol.name}</span>
                            {selectedProtocol === protocol.id && (
                                <span className="protocol-dropdown__item-check">✓</span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ProtocolSelector;
