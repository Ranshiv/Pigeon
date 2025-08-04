import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './ModernNodeStyles.css';

const SchemaNode = ({
    id,
    data,
    selected,
    onSelect,
    onUpdate,
    onDelete
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? 'none' : transition,
        opacity: isDragging ? 0.8 : 1,
        zIndex: isDragging ? 1000 : 1,
    };

    const { name, type, description, properties, required } = data || {};
    const [isExpanded, setIsExpanded] = useState(false);

    const getTypeIcon = (type) => {
        const icons = {
            'object': '{}',
            'array': '[]',
            'string': 'Aa',
            'number': '#',
            'integer': '123',
            'boolean': 'T/F'
        };
        return icons[type] || '?';
    };

    const getTypeColor = (type) => {
        const colors = {
            'object': '#2196F3',
            'array': '#FF9800',
            'string': '#4CAF50',
            'number': '#9C27B0',
            'integer': '#9C27B0',
            'boolean': '#F44336'
        };
        return colors[type] || '#666666';
    };

    const handleClick = (e) => {
        e.stopPropagation();
        if (onSelect) {
            onSelect();
        }
    };

    const handleDoubleClick = (e) => {
        e.stopPropagation();
        setIsExpanded(!isExpanded);
    };

    const handleToggleExpand = (e) => {
        e.stopPropagation();
        setIsExpanded(!isExpanded);
    };

    const renderProperties = () => {
        if (!properties || typeof properties !== 'object') {
            return null;
        }

        return (
            <div className="schema-properties">
                {Object.entries(properties).slice(0, 5).map(([propName, propSchema]) => (
                    <div key={propName} className="property-item">
                        <div className="property-info">
                            <span className="property-name">{propName}</span>
                            {required?.includes(propName) && (
                                <span className="required-indicator" title="Required field">*</span>
                            )}
                        </div>
                        <span
                            className="property-type"
                            style={{ color: getTypeColor(propSchema.type) }}
                        >
                            {propSchema.type || 'any'}
                        </span>
                    </div>
                ))}
                {Object.keys(properties).length > 5 && (
                    <div className="property-item more-properties">
                        <span>+{Object.keys(properties).length - 5} more...</span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`modern-schema-node ${selected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
        >
            <div className="node-card">
                <div className="node-header">
                    <div className="node-icon-wrapper">
                        <div
                            className="type-badge"
                            style={{ backgroundColor: getTypeColor(type) }}
                            title={`Type: ${type || 'object'}`}
                        >
                            {getTypeIcon(type)}
                        </div>
                    </div>
                    <div className="node-info">
                        <div className="node-title">
                            <h4 className="schema-name">{name || 'Schema'}</h4>
                            <span className="schema-type-label">{type || 'object'}</span>
                        </div>
                    </div>
                    <div className="node-controls">
                        {(properties && Object.keys(properties).length > 0) && (
                            <button
                                className={`expand-btn ${isExpanded ? 'expanded' : ''}`}
                                onClick={handleToggleExpand}
                                title={isExpanded ? 'Collapse' : 'Expand'}
                            >
                                <svg 
                                    width="12" 
                                    height="12" 
                                    viewBox="0 0 12 12" 
                                    fill="currentColor"
                                    style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
                                >
                                    <path d="M6 8L2 4h8L6 8z"/>
                                </svg>
                            </button>
                        )}
                        {onDelete && (
                            <button
                                className="delete-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete();
                                }}
                                title="Delete schema"
                            >
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                                    <path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                {description && (
                    <div className="node-description">
                        {description}
                    </div>
                )}

                {isExpanded && (
                    <div className="node-content">
                        {renderProperties()}
                    </div>
                )}

                <div className="node-footer">
                    <div className="node-meta">
                        {properties && (
                            <span className="property-count">
                                {Object.keys(properties).length} {Object.keys(properties).length === 1 ? 'property' : 'properties'}
                            </span>
                        )}
                        {required && required.length > 0 && (
                            <span className="required-count">
                                {required.length} required
                            </span>
                        )}
                    </div>
                </div>

                <div className="node-handles">
                    <div className="handle handle-input" title="Connect input">
                        <div className="handle-dot"></div>
                    </div>
                    <div className="handle handle-output" title="Connect output">
                        <div className="handle-dot"></div>
                    </div>
                </div>

                {selected && (
                    <div className="selection-indicator"></div>
                )}
            </div>
        </div>
    );
};

export default SchemaNode;
