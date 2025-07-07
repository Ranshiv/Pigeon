import React, { useState, useCallback, useRef } from 'react';
import {
    DndContext,
    DragOverlay,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
    FiPlus,
    FiZoomIn,
    FiZoomOut,
    FiMaximize,
    FiRefreshCw,
    FiGrid,
    FiMove,
    FiLayers
} from 'react-icons/fi';
import EndpointNode from './EndpointNode';
import SchemaNode from './SchemaNode';

const DesignCanvas = ({
    nodes = [],
    edges = [],
    selectedNode,
    onNodeSelect,
    onNodeUpdate,
    onNodeDelete,
    onVisualize,
    onNodeAdd
}) => {
    const [activeId, setActiveId] = useState(null);
    const [zoom, setZoom] = useState(100);
    const [isDragOver, setIsDragOver] = useState(false);
    const [dragOverPosition, setDragOverPosition] = useState(null);
    const canvasRef = useRef(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = useCallback((event) => {
        setActiveId(event.active.id);
    }, []);

    const handleDragEnd = useCallback((event) => {
        const { active, over } = event;

        if (active.id !== over?.id && nodes.length > 0) {
            const oldIndex = nodes.findIndex(node => node.id === active.id);
            const newIndex = nodes.findIndex(node => node.id === over.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                const newNodes = arrayMove(nodes, oldIndex, newIndex);
                console.log('Reordered nodes:', newNodes);
            }
        }

        setActiveId(null);
    }, [nodes]);

    const handleCanvasClick = useCallback((event) => {
        if (event.target.classList.contains('design-canvas-content') ||
            event.target.classList.contains('canvas-grid')) {
            onNodeSelect && onNodeSelect(null);
        }
    }, [onNodeSelect]);

    const handleDrop = useCallback((event) => {
        event.preventDefault();
        setIsDragOver(false);
        setDragOverPosition(null);

        try {
            const data = event.dataTransfer.getData('application/json');
            if (data) {
                const componentData = JSON.parse(data);
                const rect = canvasRef.current.getBoundingClientRect();
                const position = {
                    x: event.clientX - rect.left,
                    y: event.clientY - rect.top
                };

                if (onNodeAdd) {
                    onNodeAdd(componentData, position);
                }
            }
        } catch (error) {
            console.error('Error handling drop:', error);
        }
    }, [onNodeAdd]);

    const handleDragOver = useCallback((event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';

        if (!isDragOver) {
            setIsDragOver(true);
        }

        const rect = canvasRef.current.getBoundingClientRect();
        setDragOverPosition({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        });
    }, [isDragOver]);

    const handleDragLeave = useCallback((event) => {
        if (!canvasRef.current.contains(event.relatedTarget)) {
            setIsDragOver(false);
            setDragOverPosition(null);
        }
    }, []);

    const handleZoomIn = useCallback(() => {
        setZoom(prev => Math.min(prev + 25, 200));
    }, []);

    const handleZoomOut = useCallback(() => {
        setZoom(prev => Math.max(prev - 25, 25));
    }, []);

    const handleFitToScreen = useCallback(() => {
        setZoom(100);
    }, []);

    const handleResetView = useCallback(() => {
        setZoom(100);
    }, []);

    const renderNode = useCallback((node) => {
        const isSelected = selectedNode === node.id;

        switch (node.type) {
            case 'endpoint':
                return (
                    <EndpointNode
                        key={node.id}
                        node={node}
                        selected={isSelected}
                        onSelect={() => onNodeSelect(node.id)}
                        onUpdate={(updates) => onNodeUpdate(node.id, updates)}
                        onDelete={() => onNodeDelete(node.id)}
                        onVisualize={(data) => onVisualize(node.id, data)}
                    />
                );
            case 'schema':
                return (
                    <SchemaNode
                        key={node.id}
                        node={node}
                        selected={isSelected}
                        onSelect={() => onNodeSelect(node.id)}
                        onUpdate={(updates) => onNodeUpdate(node.id, updates)}
                        onDelete={() => onNodeDelete(node.id)}
                    />
                );
            default:
                return (
                    <div
                        key={node.id}
                        className={`node-element generic-node ${isSelected ? 'selected' : ''}`}
                        onClick={() => onNodeSelect(node.id)}
                    >
                        <div className="node-header">
                            <div className="node-title">
                                <FiLayers />
                                {node.data?.name || node.type}
                            </div>
                        </div>
                        <div className="node-content">
                            {node.data?.description || `${node.type} component`}
                        </div>
                    </div>
                );
        }
    }, [selectedNode, onNodeSelect, onNodeUpdate, onNodeDelete, onVisualize]);

    return (
        <div className="design-canvas">
            <div className="canvas-controls">
                <div className="zoom-controls">
                    <button
                        className="zoom-btn"
                        onClick={handleZoomOut}
                        disabled={zoom <= 25}
                        title="Zoom out"
                        aria-label="Zoom out"
                    >
                        <FiZoomOut />
                    </button>
                    <span className="zoom-level">{zoom}%</span>
                    <button
                        className="zoom-btn"
                        onClick={handleZoomIn}
                        disabled={zoom >= 200}
                        title="Zoom in"
                        aria-label="Zoom in"
                    >
                        <FiZoomIn />
                    </button>
                </div>

                <div className="canvas-actions">
                    <button
                        className="canvas-btn"
                        onClick={handleFitToScreen}
                        title="Fit to screen"
                    >
                        <FiMaximize />
                        Fit to Screen
                    </button>
                    <button
                        className="canvas-btn"
                        onClick={handleResetView}
                        title="Reset view"
                    >
                        <FiRefreshCw />
                        Reset View
                    </button>
                </div>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div
                    ref={canvasRef}
                    className={`design-canvas-content ${isDragOver ? 'drag-over' : ''}`}
                    style={{ transform: `scale(${zoom / 100})` }}
                    onClick={handleCanvasClick}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    role="main"
                    aria-label="API Design Canvas"
                >
                    <div className="canvas-grid" />

                    {/* API Info Section */}
                    <div className="canvas-section api-info-section">
                        <div className="section-header">
                            <h3>API Information</h3>
                            <button
                                className="add-section-btn"
                                onClick={() => onNodeAdd && onNodeAdd({ type: 'info' }, { x: 0, y: 0 })}
                                title="Add API info"
                            >
                                <FiPlus />
                            </button>
                        </div>
                        <div className="section-content">
                            {nodes.some(node => node.type === 'info') ? (
                                nodes.filter(node => node.type === 'info').map(renderNode)
                            ) : (
                                <div className="drop-zone api-info-drop">
                                    <div className="drop-zone-content">
                                        <div className="drop-zone-icon">📋</div>
                                        <div className="drop-zone-text">
                                            Drop API Info component here or click + to add
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Endpoints Section */}
                    <div className="canvas-section endpoints-section">
                        <div className="section-header">
                            <h3>Endpoints</h3>
                            <button
                                className="add-section-btn"
                                onClick={() => onNodeAdd && onNodeAdd({ type: 'endpoint' }, { x: 0, y: 0 })}
                                title="Add endpoint"
                            >
                                <FiPlus />
                            </button>
                        </div>
                        <div className="section-content">
                            <SortableContext
                                items={nodes.filter(node => node.type === 'endpoint')}
                                strategy={verticalListSortingStrategy}
                            >
                                {nodes.filter(node => node.type === 'endpoint').length > 0 ? (
                                    nodes.filter(node => node.type === 'endpoint').map(renderNode)
                                ) : (
                                    <div className="drop-zone endpoints-drop">
                                        <div className="drop-zone-content">
                                            <div className="drop-zone-icon">🌐</div>
                                            <div className="drop-zone-text">
                                                Drop Endpoint components here to define your API routes
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </SortableContext>
                        </div>
                    </div>

                    {/* Data Models Section */}
                    <div className="canvas-section schemas-section">
                        <div className="section-header">
                            <h3>Data Models</h3>
                            <button
                                className="add-section-btn"
                                onClick={() => onNodeAdd && onNodeAdd({ type: 'schema' }, { x: 0, y: 0 })}
                                title="Add data model"
                            >
                                <FiPlus />
                            </button>
                        </div>
                        <div className="section-content">
                            <SortableContext
                                items={nodes.filter(node => node.type === 'schema')}
                                strategy={verticalListSortingStrategy}
                            >
                                {nodes.filter(node => node.type === 'schema').length > 0 ? (
                                    nodes.filter(node => node.type === 'schema').map(renderNode)
                                ) : (
                                    <div className="drop-zone schemas-drop">
                                        <div className="drop-zone-content">
                                            <div className="drop-zone-icon">🗃️</div>
                                            <div className="drop-zone-text">
                                                Drop Schema components here to define data structures
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </SortableContext>
                        </div>
                    </div>

                    {/* Other components section */}
                    {nodes.filter(node => !['info', 'endpoint', 'schema'].includes(node.type)).length > 0 && (
                        <div className="canvas-section other-section">
                            <div className="section-header">
                                <h3>Other Components</h3>
                            </div>
                            <div className="section-content">
                                {nodes.filter(node => !['info', 'endpoint', 'schema'].includes(node.type)).map(renderNode)}
                            </div>
                        </div>
                    )}

                    {/* Empty state */}
                    {nodes.length === 0 && (
                        <div className="canvas-empty-state">
                            <div className="empty-state-content">
                                <div className="empty-state-icon">
                                    <FiGrid size={64} />
                                </div>
                                <h3>Start building your API</h3>
                                <p>Drag components from the palette on the left to begin designing your API structure.</p>
                                <div className="quick-actions">
                                    <button
                                        className="quick-action-btn"
                                        onClick={() => onNodeAdd && onNodeAdd({ type: 'info' }, { x: 200, y: 100 })}
                                    >
                                        <FiPlus />
                                        Add API Info
                                    </button>
                                    <button
                                        className="quick-action-btn"
                                        onClick={() => onNodeAdd && onNodeAdd({ type: 'endpoint' }, { x: 200, y: 200 })}
                                    >
                                        <FiPlus />
                                        Add Endpoint
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Drag over indicator */}
                    {isDragOver && dragOverPosition && (
                        <div
                            className="drag-over-indicator"
                            style={{
                                left: dragOverPosition.x - 50,
                                top: dragOverPosition.y - 25
                            }}
                        >
                            <FiPlus />
                            Drop here
                        </div>
                    )}
                </div>

                <DragOverlay>
                    {activeId ? (
                        <div className="drag-overlay">
                            <FiMove />
                            Moving component
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
};

export default DesignCanvas;
