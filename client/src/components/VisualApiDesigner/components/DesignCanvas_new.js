import React, { useState, useCallback, useRef } from 'react';
import { FiPlus, FiZoomIn, FiZoomOut, FiMaximize, FiRefreshCw, FiInfo, FiGlobe, FiDatabase } from 'react-icons/fi';

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
    const [zoom, setZoom] = useState(100);
    const [isDragOver, setIsDragOver] = useState(false);
    const canvasRef = useRef(null);

    const handleDrop = useCallback((event) => {
        event.preventDefault();
        const componentType = event.dataTransfer.getData('text/plain');
        const rect = canvasRef.current.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        if (onNodeAdd) {
            onNodeAdd({ type: componentType, position: { x, y } });
        }
        setIsDragOver(false);
    }, [onNodeAdd]);

    const handleDragOver = useCallback((event) => {
        event.preventDefault();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((event) => {
        event.preventDefault();
        setIsDragOver(false);
    }, []);

    const handleZoomIn = useCallback(() => {
        setZoom(prev => Math.min(prev + 25, 300));
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

    const dropZones = [
        {
            id: 'api-info',
            title: 'API Information',
            icon: <FiInfo />,
            description: 'Drop API Info component here or click + to add',
            acceptedTypes: ['info'],
            items: nodes.filter(n => n.type === 'info')
        },
        {
            id: 'endpoints',
            title: 'Endpoints',
            icon: <FiGlobe />,
            description: 'Drop Endpoint components here to define your API routes',
            acceptedTypes: ['endpoint', 'resource'],
            items: nodes.filter(n => ['endpoint', 'resource'].includes(n.type))
        },
        {
            id: 'data-models',
            title: 'Data Models',
            icon: <FiDatabase />,
            description: 'Drop Schema components here to define data structures',
            acceptedTypes: ['schema', 'parameter'],
            items: nodes.filter(n => ['schema', 'parameter'].includes(n.type))
        }
    ];

    return (
        <div className="design-canvas" ref={canvasRef}>
            {/* Canvas Controls */}
            <div className="canvas-controls">
                <button className="canvas-control-btn" onClick={handleZoomOut} title="Zoom Out">
                    <FiZoomOut />
                </button>
                <span className="zoom-indicator">{zoom}%</span>
                <button className="canvas-control-btn" onClick={handleZoomIn} title="Zoom In">
                    <FiZoomIn />
                </button>
                <button className="canvas-control-btn" onClick={handleFitToScreen} title="Fit to Screen">
                    <FiMaximize />
                </button>
                <button className="canvas-control-btn" onClick={handleResetView} title="Reset View">
                    <FiRefreshCw />
                </button>
            </div>

            {/* Drop Zones */}
            <div
                className="canvas-drop-zones"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                style={{ transform: `scale(${zoom / 100})` }}
            >
                {dropZones.map((zone) => (
                    <div
                        key={zone.id}
                        className={`drop-zone ${isDragOver ? 'drag-over' : ''}`}
                    >
                        <div className="drop-zone-header">
                            <div className="drop-zone-title">
                                {zone.icon}
                                {zone.title}
                            </div>
                            <button
                                className="drop-zone-add-btn"
                                onClick={() => {
                                    if (onNodeAdd && zone.acceptedTypes.length > 0) {
                                        onNodeAdd({ type: zone.acceptedTypes[0], position: { x: 200, y: 100 } });
                                    }
                                }}
                                title={`Add ${zone.title}`}
                            >
                                <FiPlus />
                            </button>
                        </div>

                        <div className="drop-zone-content">
                            {zone.items.length === 0 ? (
                                <>
                                    <div className="drop-zone-icon">{zone.icon}</div>
                                    <div className="drop-zone-text">{zone.description}</div>
                                    <div className="drop-zone-hint">Click + to add</div>
                                </>
                            ) : (
                                <div className="drop-zone-items">
                                    {zone.items.map((item) => (
                                        <div
                                            key={item.id}
                                            className={`zone-item ${selectedNode === item.id ? 'selected' : ''}`}
                                            onClick={() => onNodeSelect && onNodeSelect(item.id)}
                                        >
                                            <div className="zone-item-header">
                                                <span className="zone-item-type">{item.type}</span>
                                                <span className="zone-item-name">{item.data?.name || 'Unnamed'}</span>
                                            </div>
                                            {item.data?.description && (
                                                <div className="zone-item-description">
                                                    {item.data.description}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {/* Start building message */}
                {nodes.length === 0 && (
                    <div className="canvas-start-message">
                        <div className="start-message-content">
                            <h3>Start building your API</h3>
                            <p>Drag components from the palette on the left to begin designing your API structure.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DesignCanvas;
