import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
    FiGrid,
    FiDatabase,
    FiLock,
    FiInfo,
    FiList,
    FiServer,
    FiTag,
    FiBookOpen
} from 'react-icons/fi';
import CanvasControls from './CanvasControls';
import useZoom from '../hooks/useZoom';
import useDragAndDrop from '../hooks/useDragAndDrop';
import { createNodeRenderer } from '../utils/nodeRendererFactory';
import {
    QUICK_ACTIONS
} from '../constants/designCanvasConstants';
import '../VisualApiDesigner.css';

// Draggable wrapper component for nodes with optimized physics and resize functionality
const DraggableNode = ({ id, children, style, className, isDragging, onResize, onClick }) => {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: id,
    });

    const [isResizing, setIsResizing] = useState(false);
    const [resizeStart, setResizeStart] = useState(null);
    const resizeRef = useRef(null);

    // Cleanup effect to prevent DOM manipulation conflicts
    useEffect(() => {
        return () => {
            // Clean up any pending animations or timeouts when component unmounts
            if (resizeRef.current) {
                resizeRef.current.style.transition = 'none';
            }
        };
    }, []);

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
            : style.filter || 'none',
        // Add pointer events safety
        pointerEvents: style.pointerEvents || 'auto'
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
            onClick={(e) => {
                e.stopPropagation();
                onClick && onClick(e);
            }}
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
    selectedEdge,
    onNodeSelect,
    onNodeUpdate,
    onNodeDelete,
    onVisualize,
    onNodeAdd,
    onEdgeAdd,
    onEdgeDelete,
    onEdgeSelect
}) => {
    // Stabilize nodes array to prevent unnecessary re-renders
    const stableNodes = useMemo(() => {
        return nodes.filter(node => node && node.id && typeof node.id === 'string');
    }, [nodes]);

    const stableEdges = useMemo(() => {
        return edges.filter(edge => edge && edge.id);
    }, [edges]);

    // Track nodes being deleted to prevent race conditions
    const [nodesBeingDeleted, setNodesBeingDeleted] = useState(new Set());

    // Safe node deletion wrapper
    const handleSafeNodeDelete = useCallback((nodeId) => {
        if (!nodeId || nodesBeingDeleted.has(nodeId)) {
            return; // Prevent double deletion
        }

        // Mark node as being deleted
        setNodesBeingDeleted(prev => new Set([...prev, nodeId]));

        // Add a small delay to ensure any ongoing DOM operations complete
        setTimeout(() => {
            if (onNodeDelete) {
                onNodeDelete(nodeId);
            }
            // Remove from deletion tracking after a safe delay
            setTimeout(() => {
                setNodesBeingDeleted(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(nodeId);
                    return newSet;
                });
            }, 100);
        }, 16); // One animation frame
    }, [onNodeDelete, nodesBeingDeleted]);

    // Filter out nodes being deleted from rendering
    const renderableNodes = useMemo(() => {
        return stableNodes.filter(node => !nodesBeingDeleted.has(node.id));
    }, [stableNodes, nodesBeingDeleted]);
    const [activeId, setActiveId] = useState(null);
    const [dragDelta, setDragDelta] = useState({ x: 0, y: 0 });
    const canvasRef = useRef(null);
    const [edgeMenu, setEdgeMenu] = useState(null); // {x, y, edgeId}

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
        setDragDelta({ x: 0, y: 0 });
    }, []);

    const handleDragMove = useCallback((event) => {
        if (!event || !event.active) return;
        const d = event.delta || { x: 0, y: 0 };
        setDragDelta({ x: d.x || 0, y: d.y || 0 });
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
        setDragDelta({ x: 0, y: 0 });
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

    // removed here; redefined after connection state

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


    // Connection (edge) creation state
    const [connectingFrom, setConnectingFrom] = useState(null); // node id
    const [mousePos, setMousePos] = useState(null);
    const [hoverTargetId, setHoverTargetId] = useState(null); // highlight valid target under cursor

    const handleCanvasClick = useCallback((event) => {
        if (event.target.classList.contains('design-canvas-content') ||
            event.target.classList.contains('canvas-grid')) {
            onNodeSelect && onNodeSelect(null);
            setEdgeMenu(null);
            if (connectingFrom) {
                setConnectingFrom(null);
                setMousePos(null);
                setHoverTargetId(null);
            }
        }
    }, [onNodeSelect, connectingFrom]);

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
                className={`positioned-node enhanced-node ${node.type}-node${isSelected ? ' selected' : ''}${hoverTargetId === node.id ? ' can-connect' : ''}${nodesBeingDeleted.has(node.id) ? ' deleting' : ''}`}
                style={{
                    position: 'absolute',
                    left: position.x,
                    top: position.y,
                    width: dimensions.width,
                    height: dimensions.height,
                    transform: 'translate(-50%, -50%)',
                    zIndex: isSelected ? 10 : 1
                }}
                onClick={() => {
                    // If in keyboard-connect mode, clicking a node completes the edge
                    if (connectingFrom && connectingFrom !== node.id && onEdgeAdd) {
                        const source = nodes.find(n => n.id === connectingFrom);
                        const label = (source?.type === 'parameter' && node.type === 'endpoint') ? 'param' : null;
                        const data = label ? { label } : {};
                        onEdgeAdd({ source: connectingFrom, target: node.id, type: 'orthogonal', data });
                        setConnectingFrom(null);
                        setMousePos(null);
                        setHoverTargetId(null);
                        return;
                    }
                    onNodeSelect && onNodeSelect(node.id)
                }}
            >
                {/* Enhanced Card UI */}
                <div className="node-card-outer">
                    {/* connection handles */}
                    <button
                        className="conn-handle conn-out"
                        title="Drag to connect"
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            setConnectingFrom(node.id);
                        }}
                    />
                    <button
                        className="conn-handle conn-in"
                        title="Connect here"
                        onMouseUp={(e) => {
                            e.stopPropagation();
                            if (connectingFrom && connectingFrom !== node.id && onEdgeAdd) {
                                const source = nodes.find(n => n.id === connectingFrom);
                                const label = (source?.type === 'parameter' && node.type === 'endpoint') ? 'param' : null;
                                const data = label ? { label } : {};
                                onEdgeAdd({ source: connectingFrom, target: node.id, type: 'orthogonal', data });
                            }
                            setConnectingFrom(null);
                            setMousePos(null);
                            setHoverTargetId(null);
                        }}
                    />
                    <div className="node-card-header">
                        {/* Example: icon, type badge, status */}
                        <span className="node-card-icon" aria-label="Node type icon">
                            {/* Use Feather icon based on node type */}
                            <span className={`icon-bg icon-${node.type}`}>
                                {node.type === 'endpoint' && <FiServer size={18} />}
                                {node.type === 'schema' && <FiDatabase size={18} />}
                                {node.type === 'parameter' && <FiList size={18} />}
                                {node.type === 'security' && <FiLock size={18} />}
                                {node.type === 'info' && <FiInfo size={18} />}
                                {node.type === 'resource' && <FiServer size={18} />}
                                {node.type === 'tag' && <FiTag size={18} />}
                                {(!node.type || !['endpoint', 'schema', 'parameter', 'security', 'info', 'resource', 'tag'].includes(node.type)) &&
                                    <FiBookOpen size={18} />}
                            </span>
                        </span>
                        <span className="node-card-type-badge">{
                            node.type === 'endpoint' ? 'ENDPOINT' :
                                node.type === 'schema' ? 'SCHEMA' :
                                    node.type === 'security' ? 'SECURITY' :
                                        node.type === 'info' ? 'INFO' :
                                            node.type?.toUpperCase() || 'COMPONENT'
                        }</span>
                        {node.status && <span className={`node-card-status node-status-${node.status.toLowerCase()}`}>{node.status}</span>}
                    </div>
                    <div className="node-card-content">
                        <div className="node-card-title">{
                            node.type === 'endpoint' ? 'HTTP Endpoint' :
                                node.type === 'schema' ? 'HTTP Schema' :
                                    node.type === 'security' ? 'SECURITY' :
                                        node.type === 'info' ? 'INFO' :
                                            node.title || node.type || 'Component'
                        }</div>
                        <div className="node-card-desc">{node.description || 'Define REST API endpoint'}</div>
                    </div>
                    {/* Render the original node content below for extensibility */}
                    <div className="node-card-children">
                        {renderNode(node)}
                    </div>
                </div>
            </DraggableNode>
        );
    }, [selectedNode, renderNode, activeId, handleNodeResize, onNodeSelect, onEdgeAdd, connectingFrom, hoverTargetId, nodes, nodesBeingDeleted]);

    // Safe node renderer with error boundary
    const renderSafeNode = useCallback((node) => {
        // Safety checks to prevent rendering invalid nodes
        if (!node || !node.id || typeof node.id !== 'string') {
            console.warn('Skipping invalid node:', node);
            return null;
        }

        try {
            return renderPositionedNode(node);
        } catch (error) {
            console.error('Error rendering node:', node.id, error);
            return null;
        }
    }, [renderPositionedNode]);

    // Keyboard delete support for selected node
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Only trigger if a node is selected and no input/textarea is focused
            if (!selectedNode || !selectedNode.id) return;
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
            if (e.key === 'Delete' || e.key === 'Backspace') {
                handleSafeNodeDelete(selectedNode.id);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedNode, handleSafeNodeDelete]);

    // Keyboard delete support for selected edge
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!selectedEdge || !selectedEdge.id) return;
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
            if (e.key === 'Delete' || e.key === 'Backspace') {
                onEdgeDelete && onEdgeDelete(selectedEdge.id);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedEdge, onEdgeDelete]);

    // Helpers to compute positions for anchors and centers
    const getNodeCenter = (node) => {
        const base = node.position || { x: 0, y: 0 };
        const pos = node.id === activeId ? { x: base.x + dragDelta.x, y: base.y + dragDelta.y } : base;
        return { x: pos.x, y: pos.y };
    };

    // Get anchor point at a specific side of a node (left, right, top, bottom)
    const getAnchor = (node, side) => {
        const center = getNodeCenter(node);
        const dim = node.dimensions || { width: 240, height: 128 };
        switch (side) {
            case 'left':
                return { x: center.x - dim.width / 2, y: center.y };
            case 'right':
                return { x: center.x + dim.width / 2, y: center.y };
            case 'top':
                return { x: center.x, y: center.y - dim.height / 2 };
            case 'bottom':
                return { x: center.x, y: center.y + dim.height / 2 };
            default:
                return center;
        }
    };

    // Compute side-aware anchors (left/right/top/bottom) and orthogonal path with an outer gap so elbows avoid nodes
    const svgPathForEdge = (fromNode, toNode) => {
        const EDGE_GAP = 14; // pixels outside node boundary for elbows

        // Effective centers (include in-flight drag)
        const fc = getNodeCenter(fromNode);
        const tc = getNodeCenter(toNode);
        const dx = tc.x - fc.x;
        const dy = tc.y - fc.y;

        const horizontalPreferred = Math.abs(dx) >= Math.abs(dy);
        const fromSide = horizontalPreferred ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'bottom' : 'top');
        const toSide = horizontalPreferred ? (dx >= 0 ? 'left' : 'right') : (dy >= 0 ? 'top' : 'bottom');

        const s = getAnchor(fromNode, fromSide);
        const t = getAnchor(toNode, toSide);

        // Outward offsets based on side
        const sOut = { ...s };
        const tOut = { ...t };
        if (fromSide === 'right') sOut.x += EDGE_GAP;
        if (fromSide === 'left') sOut.x -= EDGE_GAP;
        if (fromSide === 'top') sOut.y -= EDGE_GAP;
        if (fromSide === 'bottom') sOut.y += EDGE_GAP;

        if (toSide === 'right') tOut.x += EDGE_GAP;
        if (toSide === 'left') tOut.x -= EDGE_GAP;
        if (toSide === 'top') tOut.y -= EDGE_GAP;
        if (toSide === 'bottom') tOut.y += EDGE_GAP;

        if (horizontalPreferred) {
            const midX = (sOut.x + tOut.x) / 2;
            return `M ${s.x} ${s.y} L ${sOut.x} ${sOut.y} L ${midX} ${sOut.y} L ${midX} ${tOut.y} L ${tOut.x} ${tOut.y} L ${t.x} ${t.y}`;
        } else {
            const midY = (sOut.y + tOut.y) / 2;
            return `M ${s.x} ${s.y} L ${sOut.x} ${sOut.y} L ${sOut.x} ${midY} L ${tOut.x} ${midY} L ${tOut.x} ${tOut.y} L ${t.x} ${t.y}`;
        }
    };

    const handleMouseMove = useCallback((e) => {
        if (!connectingFrom || !canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const pos = { x: (e.clientX - rect.left) / (zoom / 100), y: (e.clientY - rect.top) / (zoom / 100) };
        setMousePos(pos);
        // Determine potential target under cursor to highlight
        const target = (nodes || []).find(n => {
            const dim = n.dimensions || { width: 240, height: 128 };
            const p = n.position || { x: 0, y: 0 };
            const left = p.x - dim.width / 2;
            const top = p.y - dim.height / 2;
            const right = p.x + dim.width / 2;
            const bottom = p.y + dim.height / 2;
            return pos.x >= left && pos.x <= right && pos.y >= top && pos.y <= bottom;
        });
        setHoverTargetId(target && target.id !== connectingFrom ? target.id : null);
    }, [connectingFrom, zoom, nodes]);

    const handleMouseUp = useCallback((e) => {
        if (!connectingFrom) return;
        // Find node under cursor to connect to
        const target = (nodes || []).find(n => {
            const dim = n.dimensions || { width: 240, height: 128 };
            const pos = n.position || { x: 0, y: 0 };
            const left = pos.x - dim.width / 2;
            const top = pos.y - dim.height / 2;
            const right = pos.x + dim.width / 2;
            const bottom = pos.y + dim.height / 2;
            const pt = mousePos;
            return pt && pt.x >= left && pt.x <= right && pt.y >= top && pt.y <= bottom;
        });
        if (target && target.id !== connectingFrom && onEdgeAdd) {
            const source = nodes.find(n => n.id === connectingFrom);
            const label = (source?.type === 'parameter' && target.type === 'endpoint') ? 'param' : null;
            const data = label ? { label } : {};
            onEdgeAdd({ source: connectingFrom, target: target.id, type: 'orthogonal', data });
        }
        setConnectingFrom(null);
        setMousePos(null);
        setHoverTargetId(null);
    }, [connectingFrom, nodes, mousePos, onEdgeAdd]);

    useEffect(() => {
        if (connectingFrom) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [connectingFrom, handleMouseMove, handleMouseUp]);

    // Keyboard connect: press "c" to start connecting from selected node
    useEffect(() => {
        const onKey = (e) => {
            if ((e.key === 'c' || e.key === 'C') && selectedNode?.id) {
                setConnectingFrom(prev => prev ? null : selectedNode.id);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selectedNode]);

    // Compute dynamic content size so background/edges expand with far-away nodes
    const contentSize = useMemo(() => {
        if (!nodes || nodes.length === 0) return { width: '100%', height: '100%' };
        const PADDING = 300;
        let maxX = 0;
        let maxY = 0;
        for (const n of nodes) {
            const pos = n.position || { x: 0, y: 0 };
            const dim = n.dimensions || { width: 240, height: 128 };
            // nodes are centered at position with translate(-50%, -50%)
            const right = pos.x + dim.width / 2;
            const bottom = pos.y + dim.height / 2;
            if (right > maxX) maxX = right;
            if (bottom > maxY) maxY = bottom;
        }
        return { width: Math.max(1200, maxX + PADDING), height: Math.max(800, maxY + PADDING) };
    }, [nodes]);

    return (
        <div className="design-canvas">
            {/* Non-scaled base grid so background always fills viewport even when zoomed out */}
            <div className="canvas-grid base-grid" aria-hidden="true" />
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
                onDragMove={handleDragMove}
                onDragEnd={handleDragEnd}
            >
                <div
                    ref={canvasRef}
                    className={`design-canvas-content flexible-canvas ${isDragOver ? 'drag-over' : ''}`}
                    style={{
                        transform: `scale(${zoom / 100})`,
                        transformOrigin: '0 0',
                        minWidth: contentSize.width,
                        minHeight: contentSize.height,
                        background: 'transparent'
                    }}
                    onClick={handleCanvasClick}
                    onDrop={(e) => handleDrop(e, canvasRef)}
                    onDragOver={(e) => handleDragOver(e, canvasRef)}
                    onDragLeave={(e) => handleDragLeave(e, canvasRef)}
                    role="main"
                    aria-label="API Design Canvas"
                >
                    {/* Snap grid overlay for drag feedback */}
                    <div className={`snap-grid ${showGrid ? 'visible' : ''}`} />

                    {/* Grid background for visual guidance (scaled with content) */}
                    <div className="canvas-grid" />

                    {/* SVG edges below nodes but above grid */}
                    <svg className="edges-layer" width="100%" height="100%" style={{ position: 'absolute', left: 0, top: 0, zIndex: 1 }}>
                        {/* Define arrow marker for connection lines */}
                        <defs>
                            <marker
                                id="arrow-head"
                                viewBox="0 0 10 10"
                                refX="8"
                                refY="5"
                                markerWidth="6"
                                markerHeight="6"
                                orient="auto-start-reverse">
                                <path d="M 0 0 L 10 5 L 0 10 z" fill="#014C75" />
                            </marker>
                        </defs>
                        {/* Existing edges */}
                        {stableEdges.map(edge => {
                            const s = nodes.find(n => n.id === edge.source);
                            const t = nodes.find(n => n.id === edge.target);
                            if (!s || !t) return null;
                            const p = svgPathForEdge(s, t);
                            // Approximate label position as midpoint between chosen anchors
                            const fc = getNodeCenter(s);
                            const tc = getNodeCenter(t);
                            const dx = tc.x - fc.x;
                            const dy = tc.y - fc.y;
                            const horizontalPreferred = Math.abs(dx) >= Math.abs(dy);
                            const fromSide = horizontalPreferred ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'bottom' : 'top');
                            const toSide = horizontalPreferred ? (dx >= 0 ? 'left' : 'right') : (dy >= 0 ? 'top' : 'bottom');
                            const sp = getAnchor(s, fromSide);
                            const tp = getAnchor(t, toSide);
                            const midX = (sp.x + tp.x) / 2;
                            const midY = (sp.y + tp.y) / 2;
                            return (
                                <g key={edge.id}>
                                    <path
                                        d={p}
                                        className={`edge-path ${edge.type || 'default'} ${selectedEdge && selectedEdge.id === edge.id ? 'selected' : ''}`}
                                        strokeWidth={2}
                                        fill="none"
                                        style={{ pointerEvents: 'stroke', strokeLinejoin: 'round', strokeLinecap: 'round' }}
                                        markerEnd="url(#arrow-head)"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEdgeMenu(null);
                                            onEdgeSelect && onEdgeSelect(edge.id);
                                        }}
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setEdgeMenu({ x: e.clientX, y: e.clientY, edgeId: edge.id });
                                            onEdgeSelect && onEdgeSelect(edge.id);
                                        }}
                                    />
                                    {edge?.data?.label && edge.data.label !== 'link' && (
                                        <g className="edge-label-group">
                                            <text x={midX} y={midY - 6} className="edge-label" textAnchor="middle" dominantBaseline="ideographic">
                                                {edge.data.label}
                                            </text>
                                        </g>
                                    )}
                                </g>
                            );
                        })}

                        {/* Temporary connection preview */}
                        {connectingFrom && mousePos && (() => {
                            const s = nodes.find(n => n.id === connectingFrom);
                            if (!s) return null;
                            // Orthogonal preview that exits on the nearest side and heads toward the cursor with outer gap
                            const EDGE_GAP = 14;
                            const sc = getNodeCenter(s);
                            const dx = mousePos.x - sc.x;
                            const dy = mousePos.y - sc.y;
                            const horizontalPreferred = Math.abs(dx) >= Math.abs(dy);
                            const fromSide = horizontalPreferred ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'bottom' : 'top');
                            const sourcePos = getAnchor(s, fromSide);
                            const sOut = { ...sourcePos };
                            if (fromSide === 'right') sOut.x += EDGE_GAP;
                            if (fromSide === 'left') sOut.x -= EDGE_GAP;
                            if (fromSide === 'top') sOut.y -= EDGE_GAP;
                            if (fromSide === 'bottom') sOut.y += EDGE_GAP;

                            let pPrev;
                            if (horizontalPreferred) {
                                const midX = (sOut.x + mousePos.x) / 2;
                                pPrev = `M ${sourcePos.x} ${sourcePos.y} L ${sOut.x} ${sOut.y} L ${midX} ${sOut.y} L ${midX} ${mousePos.y} L ${mousePos.x} ${mousePos.y}`;
                            } else {
                                const midY = (sOut.y + mousePos.y) / 2;
                                pPrev = `M ${sourcePos.x} ${sourcePos.y} L ${sOut.x} ${sOut.y} L ${sOut.x} ${midY} L ${mousePos.x} ${midY} L ${mousePos.x} ${mousePos.y}`;
                            }
                            return <path d={pPrev} className="edge-path preview" strokeWidth={2} fill="none" style={{ pointerEvents: 'none', strokeLinejoin: 'round', strokeLinecap: 'round' }} markerEnd="url(#arrow-head)" />;
                        })()}
                    </svg>

                    {/* Positioned nodes (Screenshot 2 style) */}
                    {renderableNodes.map((node) => (
                        <React.Fragment key={`node-wrapper-${node.id}`}>
                            {renderSafeNode(node)}
                        </React.Fragment>
                    ))}

                    {/* Empty state with grid pattern */}
                    {renderableNodes.length === 0 && (
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
                                            onClick={() => onNodeAdd && onNodeAdd({ type: action.nodeType, position: action.position })}
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

            {/* Edge context menu */}
            {edgeMenu && (
                <div
                    className="edge-context-menu"
                    style={{ position: 'fixed', left: edgeMenu.x, top: edgeMenu.y, zIndex: 10000 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        className="edge-menu-item"
                        onClick={() => {
                            const label = window.prompt('Edge label', (edges.find(e => e.id === edgeMenu.edgeId)?.data?.label) || '');
                            if (label != null) {
                                // Use onEdgeSelect then update via a lightweight hack: delete+add same endpoints with label
                                const edge = edges.find(e => e.id === edgeMenu.edgeId);
                                if (edge) {
                                    onEdgeDelete && onEdgeDelete(edge.id);
                                    onEdgeAdd && onEdgeAdd({ source: edge.source, target: edge.target, type: edge.type || 'orthogonal', data: { ...edge.data, label } });
                                }
                            }
                            setEdgeMenu(null);
                        }}
                    >Edit label</button>
                    <button
                        className="edge-menu-item destructive"
                        onClick={() => {
                            onEdgeDelete && onEdgeDelete(edgeMenu.edgeId);
                            setEdgeMenu(null);
                        }}
                    >Delete</button>
                </div>
            )}
        </div>
    );
};

export default DesignCanvas;
