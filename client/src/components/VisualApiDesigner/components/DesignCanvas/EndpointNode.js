import React from 'react';

const EndpointNode = ({ data, isSelected, onSelect, onDelete }) => {
    const { path, method, summary, description, tags, deprecated } = data || {};

    const getMethodColor = (method) => {
        const colors = {
            GET: '#4CAF50',
            POST: '#2196F3',
            PUT: '#FF9800',
            DELETE: '#F44336',
            PATCH: '#9C27B0',
            HEAD: '#607D8B',
            OPTIONS: '#795548'
        };
        return colors[method?.toUpperCase()] || '#757575';
    };

    const handleClick = (e) => {
        e.stopPropagation();
        if (onSelect) {
            onSelect();
        }
    };

    const handleDelete = (e) => {
        e.stopPropagation();
        if (onDelete) {
            onDelete();
        }
    };

    return (
        <div
            className={`endpoint-node ${isSelected ? 'selected' : ''} ${deprecated ? 'deprecated' : ''}`}
            onClick={handleClick}
            style={{
                border: `2px solid ${getMethodColor(method)}`,
                borderRadius: '8px',
                padding: '12px',
                background: 'white',
                minWidth: '200px',
                maxWidth: '300px',
                cursor: 'pointer',
                position: 'relative',
                boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.15)' : '0 2px 4px rgba(0,0,0,0.1)',
                opacity: deprecated ? 0.7 : 1
            }}
        >
            {/* Method Badge */}
            <div
                className="method-badge"
                style={{
                    position: 'absolute',
                    top: '-8px',
                    left: '12px',
                    background: getMethodColor(method),
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                }}
            >
                {method || 'GET'}
            </div>

            {/* Delete Button */}
            {isSelected && onDelete && (
                <button
                    className="delete-button"
                    onClick={handleDelete}
                    style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        background: '#F44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: '20px',
                        height: '20px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    ×
                </button>
            )}

            {/* Path */}
            <div
                className="endpoint-path"
                style={{
                    marginTop: '8px',
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: '#333',
                    wordBreak: 'break-all'
                }}
            >
                {path || '/path'}
            </div>

            {/* Summary */}
            {summary && (
                <div
                    className="endpoint-summary"
                    style={{
                        marginTop: '8px',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#333'
                    }}
                >
                    {summary}
                </div>
            )}

            {/* Description */}
            {description && (
                <div
                    className="endpoint-description"
                    style={{
                        marginTop: '4px',
                        fontSize: '12px',
                        color: '#666',
                        lineHeight: '1.4'
                    }}
                >
                    {description.length > 100 ? `${description.substring(0, 100)}...` : description}
                </div>
            )}

            {/* Tags */}
            {tags && tags.length > 0 && (
                <div
                    className="endpoint-tags"
                    style={{
                        marginTop: '8px',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '4px'
                    }}
                >
                    {tags.slice(0, 3).map((tag, index) => (
                        <span
                            key={index}
                            style={{
                                background: '#E3F2FD',
                                color: '#1976D2',
                                padding: '2px 6px',
                                borderRadius: '12px',
                                fontSize: '10px',
                                fontWeight: '500'
                            }}
                        >
                            {tag}
                        </span>
                    ))}
                    {tags.length > 3 && (
                        <span
                            style={{
                                color: '#666',
                                fontSize: '10px'
                            }}
                        >
                            +{tags.length - 3} more
                        </span>
                    )}
                </div>
            )}

            {/* Deprecated Badge */}
            {deprecated && (
                <div
                    className="deprecated-badge"
                    style={{
                        position: 'absolute',
                        top: '-8px',
                        right: '12px',
                        background: '#FF9800',
                        color: 'white',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 'bold'
                    }}
                >
                    DEPRECATED
                </div>
            )}

            {/* Connection Points */}
            <div
                className="connection-point input"
                style={{
                    position: 'absolute',
                    left: '-6px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '12px',
                    height: '12px',
                    background: '#fff',
                    border: `2px solid ${getMethodColor(method)}`,
                    borderRadius: '50%'
                }}
            />
            <div
                className="connection-point output"
                style={{
                    position: 'absolute',
                    right: '-6px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '12px',
                    height: '12px',
                    background: '#fff',
                    border: `2px solid ${getMethodColor(method)}`,
                    borderRadius: '50%'
                }}
            />
        </div>
    );
};

export default EndpointNode;
