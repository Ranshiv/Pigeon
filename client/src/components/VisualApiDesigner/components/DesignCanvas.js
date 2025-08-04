import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    DndContext,
    DragOverlay,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    useDraggable
} from '@dnd-kit/core';
import {
    arrayMove,
    sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import {
    FiPlus,
    FiGrid
} from 'react-icons/fi';
import CanvasControls from './CanvasControls';
import useZoom from '../hooks/useZoom';
import useDragAndDrop from '../hooks/useDragAndDrop';
import { createNodeRenderer } from '../utils/nodeRendererFactory';
import {
    QUICK_ACTIONS
} from '../constants/designCanvasConstants';
import '../VisualApiDesigner.css';
import './EnhancedCanvasStyles.css';

// Draggable wrapper component for nodes with optimized physics and resize functionality
const DraggableNode = ({ id, children, style, className, isDragging, onResize }) => {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: id,
    });

    const [isResizing, setIsResizing] = useState(false);
    const [resizeStart, setResizeStart] = useState(null);
    const resizeRef = useRef(null);

    // Enhanced transform calculation for precise cursor tracking
    const optimizedStyle = {
        ...style,
        // Apply transform immediately during drag with precise cursor tracking
        transform: isDragging && transform
            ? `translate(calc(-50% + ${transform.x}px), calc(-50% + ${transform.y}px)) scale(1.05) rotate(1deg)`
            : style.transform || 'translate(-50%, -50%)',
        // Remove all transitions during drag for immediate response
        transition: isDragging || isResizing ? 'none' : style.transition || 'all 0.2s ease',
        // Ensure immediate visual updates and add visual feedback
        willChange: isDragging || isResizing ? 'transform, width, height' : 'auto',
        // Add subtle visual enhancement during drag
        filter: isDragging
            ? 'drop-shadow(0 8px 25px rgba(0, 0, 0, 0.5)) brightness(1.1)'
            : style.filter || 'none'
    };

    // Handle resize start
    const handleResizeStart = useCallback((e, direction) => {
        e.preventDefault();
        e.stopPropagation();

        const rect = resizeRef.current?.getBoundingClientRect();
        if (!rect) return;

        setIsResizing(true);
        setResizeStart({
            x: e.clientX,
            y: e.clientY,
            width: rect.width,
            height: rect.height,
            direction
        });
    }, []);

    // Handle resize movement
    const handleResizeMove = useCallback((e) => {
        if (!resizeStart || !isResizing) return;

        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;

        let newWidth = resizeStart.width;
        let newHeight = resizeStart.height;

        // Calculate new dimensions based on resize direction
        switch (resizeStart.direction) {
            case 'se': // Southeast corner
                newWidth = Math.max(100, resizeStart.width + deltaX);
                newHeight = Math.max(80, resizeStart.height + deltaY);
                break;
            case 'sw': // Southwest corner
                newWidth = Math.max(100, resizeStart.width - deltaX);
                newHeight = Math.max(80, resizeStart.height + deltaY);
                break;
            case 'ne': // Northeast corner
                newWidth = Math.max(100, resizeStart.width + deltaX);
                newHeight = Math.max(80, resizeStart.height - deltaY);
                break;
            case 'nw': // Northwest corner
                newWidth = Math.max(100, resizeStart.width - deltaX);
                newHeight = Math.max(80, resizeStart.height - deltaY);
                break;
            case 'e': // East edge
                newWidth = Math.max(100, resizeStart.width + deltaX);
                break;
            case 'w': // West edge
                newWidth = Math.max(100, resizeStart.width - deltaX);
                break;
            case 's': // South edge
                newHeight = Math.max(80, resizeStart.height + deltaY);
                break;
            case 'n': // North edge
                newHeight = Math.max(80, resizeStart.height - deltaY);
                break;
            default:
                // No change for unknown directions
                break;
        }

        // Apply resize immediately for smooth feedback
        if (resizeRef.current) {
            resizeRef.current.style.width = `${newWidth}px`;
            resizeRef.current.style.height = `${newHeight}px`;
        }
    }, [resizeStart, isResizing]);

    // Handle resize end
    const handleResizeEnd = useCallback(() => {
        if (!resizeStart || !isResizing) return;

        setIsResizing(false);

        // Get final dimensions and notify parent
        const rect = resizeRef.current?.getBoundingClientRect();
        if (rect && onResize) {
            onResize(id, {
                width: rect.width,
                height: rect.height
            });
        }

        setResizeStart(null);
    }, [id, onResize, resizeStart, isResizing]);

    // Effect to handle global mouse events
    useEffect(() => {
        if (isResizing) {
            document.addEventListener('mousemove', handleResizeMove);
            document.addEventListener('mouseup', handleResizeEnd);

            return () => {
                document.removeEventListener('mousemove', handleResizeMove);
                document.removeEventListener('mouseup', handleResizeEnd);
            };
        }
    }, [isResizing, handleResizeMove, handleResizeEnd]);

    return (
        <div
            ref={(node) => {
                setNodeRef(node);
                resizeRef.current = node;
            }}
            style={optimizedStyle}
            className={`${className} ${isDragging ? 'dragging' : ''} ${isResizing ? 'resizing' : ''}`}
            {...attributes}
        >
            {/* Drag handle - only this area triggers drag */}
            <div
                className="drag-handle"
                {...listeners}
                style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    width: '20px',
                    height: '20px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '4px',
                    cursor: 'grab',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0.7,
                    zIndex: 10
                }}
            >
                ⋮⋮
            </div>

            {/* Resize handles */}
            <div className="resize-handles">
                {/* Corner handles */}
                <div
                    className="resize-handle resize-se"
                    onMouseDown={(e) => handleResizeStart(e, 'se')}
                />
                <div
                    className="resize-handle resize-sw"
                    onMouseDown={(e) => handleResizeStart(e, 'sw')}
                />
                <div
                    className="resize-handle resize-ne"
                    onMouseDown={(e) => handleResizeStart(e, 'ne')}
                />
                <div
                    className="resize-handle resize-nw"
                    onMouseDown={(e) => handleResizeStart(e, 'nw')}
                />

                {/* Edge handles */}
                <div
                    className="resize-handle resize-n"
                    onMouseDown={(e) => handleResizeStart(e, 'n')}
                />
                <div
                    className="resize-handle resize-s"
                    onMouseDown={(e) => handleResizeStart(e, 's')}
                />
                <div
                    className="resize-handle resize-e"
                    onMouseDown={(e) => handleResizeStart(e, 'e')}
                />
                <div
                    className="resize-handle resize-w"
                    onMouseDown={(e) => handleResizeStart(e, 'w')}
                />
            </div>

            {children}
        </div>
    );
};

/**
 * DesignCanvas component - Flexible grid-based canvas for API design
 * Transformed to match Screenshot 2's free-form positioning layout
 * Follows Clean Code principles with component positioning and grid system
 */
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
    const canvasRef = useRef(null);

    // Custom hooks for separation of concerns
    const { zoom, zoomIn, zoomOut, fitToScreen, resetView } = useZoom();
    const { isDragOver, dragOverPosition, showGrid, handleDrop, handleDragOver, handleDragLeave } = useDragAndDrop(onNodeAdd, nodes);

    // Node renderer factory - restore onNodeSelect to prevent errors
    const renderNode = createNodeRenderer(selectedNode, onNodeSelect, onNodeUpdate, onNodeDelete, onVisualize);

    // More conservative sensors to allow clicks while preserving drag
    const sensors = useSensors(
        useSensor(PointerSensor, {
            // Distance threshold to clearly separate clicks from drags
            activationConstraint: {
                distance: 8, // Must move 8px before drag starts - allows clicks
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    ); const handleDragStart = useCallback((event) => {
        setActiveId(event.active.id);
    }, []);

    // Handle node position updates during drag
    const handleNodeDragEnd = useCallback((event) => {
        const { active, delta } = event;
        const nodeId = active.id;

        // Defensive programming: Check if delta exists and has valid coordinates
        if (delta && typeof delta.x === 'number' && typeof delta.y === 'number' &&
            (delta.x !== 0 || delta.y !== 0)) {
            const node = nodes.find(n => n.id === nodeId);
            if (node && node.position && onNodeUpdate) {
                const currentPosition = node.position;
                const newPosition = {
                    x: currentPosition.x + delta.x,
                    y: currentPosition.y + delta.y
                };

                // Ensure position is within reasonable bounds
                newPosition.x = Math.max(50, Math.min(newPosition.x, 2000));
                newPosition.y = Math.max(50, Math.min(newPosition.y, 2000));

                onNodeUpdate(nodeId, { position: newPosition });
            }
        }

        setActiveId(null);
    }, [nodes, onNodeUpdate]);

    const handleDragEnd = useCallback((event) => {
        const { active, over } = event;

        // Check if this is a node being moved
        if (nodes.some(node => node.id === active.id)) {
            handleNodeDragEnd(event);
            return;
        }

        // Original reordering logic for other drag operations
        if (active.id !== over?.id && nodes.length > 0) {
            const oldIndex = nodes.findIndex(node => node.id === active.id);
            const newIndex = nodes.findIndex(node => node.id === over.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                const newNodes = arrayMove(nodes, oldIndex, newIndex);
                console.log('Reordered nodes:', newNodes);
            }
        }

        setActiveId(null);
    }, [nodes, handleNodeDragEnd]);

    const handleCanvasClick = useCallback((event) => {
        if (event.target.classList.contains('design-canvas-content') ||
            event.target.classList.contains('canvas-grid')) {
            onNodeSelect && onNodeSelect(null);
        }
    }, [onNodeSelect]);

    // Handle component resize
    const handleNodeResize = useCallback((nodeId, dimensions) => {
        if (onNodeUpdate) {
            onNodeUpdate(nodeId, {
                dimensions: {
                    width: dimensions.width,
                    height: dimensions.height
                }
            });
        }
    }, [onNodeUpdate]);


    // Render positioned node (Screenshot 2 style) with drag capability
    const renderPositionedNode = useCallback((node) => {
        const isSelected = selectedNode?.id === node.id;
        const isDragging = activeId === node.id;
        const position = node.position || { x: 100, y: 100 };
        const dimensions = node.dimensions || { width: 240, height: 128 };

        // Enhanced node card structure
        return (
            <DraggableNode
                key={node.id}
                id={node.id}
                isDragging={isDragging}
                onResize={handleNodeResize}
                className={`positioned-node enhanced-node ${node.type}-node${isSelected ? ' selected' : ''}`}
                style={{
                    position: 'absolute',
                    left: position.x,
                    top: position.y,
                    width: dimensions.width,
                    height: dimensions.height,
                    transform: 'translate(-50%, -50%)',
                    zIndex: isSelected ? 10 : 1
                }}
                onClick={null}
            >
                {/* Enhanced Card UI */}
                <div className="node-card-outer">
                  <div className="node-card-header">
                    {/* Example: icon, type badge, status */}
                    <span className="node-card-icon" aria-label="Node type icon">
                      {/* Use Feather icon or node.icon if available */}
                      <span className="icon-bg"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M8 12h8" /><path d="M12 8v8" /></svg></span>
                    </span>
                    <span className="node-card-type-badge">{node.label || node.type || 'api endpoint'}</span>
                    {node.status && <span className={`node-card-status node-status-${node.status.toLowerCase()}`}>{node.status}</span>}
                  </div>
                  <div className="node-card-content">
                    <div className="node-card-title">{node.title || 'HTTP Endpoint'}</div>
                    <div className="node-card-desc">{node.description || 'Define REST API endpoint'}</div>
                  </div>
                  {/* Render the original node content below for extensibility */}
                  <div className="node-card-children">
                    {renderNode(node)}
                  </div>
                </div>
            </DraggableNode>
        );
    }, [selectedNode, renderNode, activeId, handleNodeResize]);

    // Keyboard delete support for selected node
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Only trigger if a node is selected and no input/textarea is focused
            if (!selectedNode || !selectedNode.id) return;
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (onNodeDelete) {
                    onNodeDelete(selectedNode.id);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedNode, onNodeDelete]);

    return (
        <div className="design-canvas">
            <CanvasControls
                zoom={zoom}
                onZoomIn={zoomIn}
                onZoomOut={zoomOut}
                onFitToScreen={fitToScreen}
                onResetView={resetView}
            />

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div
                    ref={canvasRef}
                    className={`design-canvas-content flexible-canvas ${isDragOver ? 'drag-over' : ''}`}
                    style={{ transform: `scale(${zoom / 100})` }}
                    onClick={handleCanvasClick}
                    onDrop={(e) => handleDrop(e, canvasRef)}
                    onDragOver={(e) => handleDragOver(e, canvasRef)}
                    onDragLeave={(e) => handleDragLeave(e, canvasRef)}
                    role="main"
                    aria-label="API Design Canvas"
                >
                    {/* Snap grid overlay for drag feedback */}
                    <div className={`snap-grid ${showGrid ? 'visible' : ''}`} />

                    {/* Grid background for visual guidance */}
                    <div className="canvas-grid" />

                    {/* Positioned nodes (Screenshot 2 style) */}
                    {nodes.map((node) => renderPositionedNode(node))}

                    {/* Empty state with grid pattern */}
                    {nodes.length === 0 && (
                        <div className="canvas-empty-state">
                            <div className="empty-state-content">
                                <div className="empty-state-icon">
                                    <span className="empty-state-icon-bg">
                                        <FiGrid size={48} />
                                    </span>
                                </div>
                                <h3 className="empty-state-title">Start building your API</h3>
                                <p className="empty-state-desc">Drag components from the palette on the left to begin designing your API structure.</p>
                                <div className="quick-actions">
                                    {QUICK_ACTIONS.map(action => (
                                        <button
                                            key={action.nodeType}
                                            className="quick-action-btn"
                                            onClick={() => onNodeAdd && onNodeAdd({ type: action.nodeType }, action.position)}
                                            aria-label={action.label}
                                        >
                                            <FiPlus style={{ marginRight: 6 }} />
                                            {action.label}
                                        </button>
                                    ))}
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
                                top: dragOverPosition.y - 25,
                                position: 'absolute',
                                zIndex: 1000
                            }}
                        >
                            <FiPlus />
                            Drop here
                        </div>
                    )}
                </div>

                <DragOverlay>
                    {/* Remove confusing drag overlay that moves in different direction */}
                    {null}
                </DragOverlay>
            </DndContext>
        </div>
    );
};

export default DesignCanvas;
