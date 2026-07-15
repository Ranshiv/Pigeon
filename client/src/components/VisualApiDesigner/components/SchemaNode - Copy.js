import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './SchemaNode.css';

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

    const { type, name, description } = data || {};

    const handleClick = (e) => {
        e.stopPropagation();
        if (onSelect) {
            onSelect();
        }
    };

    const handleDoubleClick = (e) => {
        e.stopPropagation();
        // Enable inline editing or open properties panel
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`schema-node-modern ${selected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
        >
            <div className="node-card-outer">
                <div className="node-card-header">
                    <div className="node-card-icon">
                        <div className="icon-bg">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                <polyline points="10 9 9 9 8 9"></polyline>
                            </svg>
                        </div>
                    </div>
                    <span className="node-card-type-badge">{type || "Schema"}</span>
                    <span className="node-card-status">SNAPPED</span>
                </div>

                <div className="node-card-content">
                    <div className="node-card-title">
                        {name || "Data Schema"}
                    </div>
                    <div className="node-card-desc">
                        {description || "Define data structure"}
                    </div>
                </div>

                <div className="node-card-children">
                    <div className="node-body">
                        <div className="schema-details">
                            {/* Schema properties would go here when expanded */}
                        </div>
                    </div>
                </div>
            </div>

            {selected && (
                <div className="selection-outline"></div>
            )}
        </div>
    );
};

export default SchemaNode;
