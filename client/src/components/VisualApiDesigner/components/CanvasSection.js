import React from 'react';
import { FiPlus } from 'react-icons/fi';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

/**
 * CanvasSection component represents a section of the design canvas
 * Follows SRP by only handling section rendering and layout
 * Eliminates code duplication from the main DesignCanvas component
 */
const CanvasSection = ({
    id,
    title,
    nodeType,
    icon,
    dropZoneText,
    className,
    nodes = [],
    renderNode,
    onAddNode,
    shouldUseSortable = false
}) => {
    const sectionNodes = nodes.filter(node => node.type === nodeType);
    const hasNodes = sectionNodes.length > 0;

    const renderDropZone = () => (
        <div className={`drop-zone ${nodeType}-drop`}>
            <div className="drop-zone-content">
                <div className="drop-zone-icon">{icon}</div>
                <div className="drop-zone-text">
                    {dropZoneText}
                </div>
            </div>
        </div>
    );

    const renderNodeList = () => {
        if (shouldUseSortable) {
            return (
                <SortableContext
                    items={sectionNodes.map(node => node.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {sectionNodes.map(renderNode)}
                </SortableContext>
            );
        }
        return sectionNodes.map(renderNode);
    };

    const handleAddNode = () => {
        if (onAddNode) {
            onAddNode({ type: nodeType, position: { x: 0, y: 0 } });
        }
    };

    return (
        <div className={`canvas-section ${className}`}>
            <div className="section-header">
                <h3>{title}</h3>
                <button
                    className="add-section-btn"
                    onClick={handleAddNode}
                    title={`Add ${title.toLowerCase()}`}
                >
                    <FiPlus />
                </button>
            </div>
            <div className="section-content">
                {hasNodes ? renderNodeList() : renderDropZone()}
            </div>
        </div>
    );
};

export default CanvasSection;
