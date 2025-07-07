import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
        transition,
        opacity: isDragging ? 0.6 : 1,
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
                {Object.entries(properties).slice(0, 3).map(([propName, propSchema]) => (
                    <div key={propName} className="property-item">
                        <span className="property-name">{propName}</span>
                        <span
                            className="property-type"
                            style={{ color: getTypeColor(propSchema.type) }}
                        >
                            {propSchema.type || 'any'}
                        </span>
                        {required?.includes(propName) && (
                            <span className="required-indicator">*</span>
                        )}
                    </div>
                ))}
                {Object.keys(properties).length > 3 && (
                    <div className="property-item more-properties">
                        +{Object.keys(properties).length - 3} more...
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
            className={`schema-node ${selected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
        >
            <div className="node-header">
                <div
                    className="type-badge"
                    style={{ backgroundColor: getTypeColor(type) }}
                    title={`Type: ${type || 'object'}`}
                >
                    {getTypeIcon(type)}
                </div>
                <div className="node-title">
                    <div className="schema-name">{name || 'Schema'}</div>
                    <div className="schema-type">{type || 'object'}</div>
                </div>
                <div className="node-controls">
                    {(properties && Object.keys(properties).length > 0) && (
                        <button
                            className={`expand-btn ${isExpanded ? 'expanded' : ''}`}
                            onClick={handleToggleExpand}
                            title={isExpanded ? 'Collapse' : 'Expand'}
                        >
                            {isExpanded ? '−' : '+'}
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
                            ×
                        </button>
                    )}
                </div>
            </div>

            {description && (
                <div className="node-description">
                    {description}
                </div>
            )}

            {isExpanded && renderProperties()}

            <div className="node-handles">
                <div className="handle handle-input" title="Connect input">
                    <div className="handle-dot"></div>
                </div>
                <div className="handle handle-output" title="Connect output">
                    <div className="handle-dot"></div>
                </div>
            </div>

            {selected && (
                <div className="selection-outline"></div>
            )}
        </div>
    );
};

export default SchemaNode;
