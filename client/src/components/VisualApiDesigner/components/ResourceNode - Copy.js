import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './ResourceNode.css';

const ResourceNode = ({
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

    const { name } = data || {};

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
            className={`resource-node-modern ${selected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
        >
            <div className="node-card-outer">
                <div className="node-card-header">
                    <div className="node-card-icon">
                        <div className="icon-bg">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
                                <path d="M7 8h10M7 12h10M7 16h6" stroke="currentColor" strokeWidth="2" />
                            </svg>
                        </div>
                    </div>
                    <div className="node-card-type-badge">Resource</div>
                    <div className="node-card-status">ACTIVE</div>
                </div>

                <div className="node-card-content">
                    <div className="node-card-title">
                        {name || 'Resource'}
                    </div>
                    <div className="node-card-desc">
                        Define API resource model
                    </div>
                </div>
            </div>

            {selected && (
                <div className="selection-outline"></div>
            )}
        </div>
    );
};

export default ResourceNode;
