import React from 'react';

const SchemaNode = ({ data, isSelected, onSelect, onDelete }) => {
    const { name, type, description, required, properties, example } = data || {};

    const getTypeColor = (type) => {
        const colors = {
            object: '#2196F3',
            array: '#4CAF50',
            string: '#FF9800',
            number: '#9C27B0',
            integer: '#9C27B0',
            boolean: '#F44336'
        };
        return colors[type?.toLowerCase()] || '#757575';
    };

    const getTypeIcon = (type) => {
        const icons = {
            object: '{}',
            array: '[]',
            string: 'Aa',
            number: '123',
            integer: '#',
            boolean: 'T/F'
        };
        return icons[type?.toLowerCase()] || '?';
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
            className={`schema-node ${isSelected ? 'selected' : ''}`}
            onClick={handleClick}
            style={{
                border: `2px solid ${getTypeColor(type)}`,
                borderRadius: '8px',
                padding: '12px',
                background: 'white',
                minWidth: '180px',
                maxWidth: '280px',
                cursor: 'pointer',
                position: 'relative',
                boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.15)' : '0 2px 4px rgba(0,0,0,0.1)'
            }}
        >
            {/* Type Badge */}
            <div
                className="type-badge"
                style={{
                    position: 'absolute',
                    top: '-8px',
                    left: '12px',
                    background: getTypeColor(type),
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                }}
            >
                <span>{getTypeIcon(type)}</span>
                <span>{type || 'object'}</span>
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

            {/* Schema Name */}
            <div
                className="schema-name"
                style={{
                    marginTop: '8px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: '#333',
                    wordBreak: 'break-word'
                }}
            >
                {name || 'Untitled Schema'}
            </div>

            {/* Description */}
            {description && (
                <div
                    className="schema-description"
                    style={{
                        marginTop: '6px',
                        fontSize: '12px',
                        color: '#666',
                        lineHeight: '1.4'
                    }}
                >
                    {description.length > 80 ? `${description.substring(0, 80)}...` : description}
                </div>
            )}

            {/* Properties Summary */}
            {type === 'object' && properties && (
                <div
                    className="properties-summary"
                    style={{
                        marginTop: '8px',
                        fontSize: '11px',
                        color: '#888'
                    }}
                >
                    <div style={{ fontWeight: '500', marginBottom: '4px' }}>Properties:</div>
                    {Object.keys(properties).slice(0, 3).map((propName, index) => (
                        <div
                            key={index}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                marginBottom: '2px'
                            }}
                        >
                            <span style={{ color: required?.includes(propName) ? '#F44336' : '#666' }}>
                                {propName}{required?.includes(propName) ? '*' : ''}
                            </span>
                            <span style={{ color: '#999' }}>
                                {properties[propName]?.type || 'any'}
                            </span>
                        </div>
                    ))}
                    {Object.keys(properties).length > 3 && (
                        <div style={{ color: '#999', fontStyle: 'italic' }}>
                            +{Object.keys(properties).length - 3} more
                        </div>
                    )}
                </div>
            )}

            {/* Array Items Info */}
            {type === 'array' && (
                <div
                    className="array-info"
                    style={{
                        marginTop: '8px',
                        fontSize: '11px',
                        color: '#666'
                    }}
                >
                    <span style={{ fontWeight: '500' }}>Items: </span>
                    <span>{data.items?.type || 'any'}</span>
                </div>
            )}

            {/* Required Fields Badge */}
            {type === 'object' && required && required.length > 0 && (
                <div
                    className="required-badge"
                    style={{
                        position: 'absolute',
                        top: '-8px',
                        right: '12px',
                        background: '#F44336',
                        color: 'white',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 'bold'
                    }}
                >
                    {required.length} required
                </div>
            )}

            {/* Example Preview */}
            {example && (
                <div
                    className="example-preview"
                    style={{
                        marginTop: '8px',
                        padding: '6px',
                        background: '#F5F5F5',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontFamily: 'monospace',
                        color: '#333',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }}
                >
                    {typeof example === 'string' ? example : JSON.stringify(example)}
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
                    border: `2px solid ${getTypeColor(type)}`,
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
                    border: `2px solid ${getTypeColor(type)}`,
                    borderRadius: '50%'
                }}
            />
        </div>
    );
};

export default SchemaNode;
