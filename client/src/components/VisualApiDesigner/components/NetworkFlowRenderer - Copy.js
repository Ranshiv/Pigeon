import React, { useEffect, useRef, useState } from 'react';
import { NetworkFlowService } from '../services/NetworkFlowService';
import './NetworkFlowRenderer.css';

/**
 * Network Flow Renderer Component
 * Renders interactive network flow diagrams with MuleSoft-style visualization
 */
const NetworkFlowRenderer = ({
    nodes = [],
    edges = [],
    template = null,
    options = {},
    onNodeSelect = () => { },
    onEdgeSelect = () => { },
    className = ''
}) => {
    const containerRef = useRef(null);
    const [flowInstance, setFlowInstance] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedElement, setSelectedElement] = useState(null);

    // Generate unique container ID
    const containerId = `network-flow-${Math.random().toString(36).substr(2, 9)}`;

    useEffect(() => {
        const initializeFlow = async () => {
            try {
                setIsLoading(true);

                // Initialize the network flow service
                await NetworkFlowService.initialize();

                // Load templates
                NetworkFlowService.getFlowTemplates();

                // Create container div
                if (containerRef.current) {
                    const container = document.createElement('div');
                    container.id = containerId;
                    container.className = 'network-flow-container';
                    containerRef.current.appendChild(container);

                    let cy;
                    if (template) {
                        // Apply template
                        cy = NetworkFlowService.applyFlowTemplate(template, containerId);
                    } else if (nodes.length > 0) {
                        // Create from provided nodes and edges
                        cy = NetworkFlowService.createApiFlowDiagram(containerId, nodes, edges, options);
                    } else {
                        // Create real-time flow with any request details from options
                        cy = NetworkFlowService.createRealtimeFlow(containerId, {
                            ...options,
                            // These will be used by the NetworkFlowService to build the visualization
                            requestUrl: options.requestUrl || '',
                            requestMethod: options.requestMethod || 'GET',
                            headers: options.headers || {},
                            requestBody: options.requestBody || null
                        });
                    }

                    if (cy) {
                        setFlowInstance(cy);

                        // Add event listeners
                        cy.on('select', 'node', (event) => {
                            const node = event.target;
                            const nodeData = node.data();
                            setSelectedElement({ type: 'node', data: nodeData });
                            onNodeSelect(nodeData);
                        });

                        cy.on('select', 'edge', (event) => {
                            const edge = event.target;
                            const edgeData = edge.data();
                            setSelectedElement({ type: 'edge', data: edgeData });
                            onEdgeSelect(edgeData);
                        });

                        cy.on('unselect', () => {
                            setSelectedElement(null);
                        });
                    }
                }
            } catch (error) {
                console.error('Error initializing network flow:', error);
            } finally {
                setIsLoading(false);
            }
        };

        initializeFlow();

        return () => {
            // Cleanup
            NetworkFlowService.destroyFlow(containerId);
        };
    }, [nodes, edges, template, options, containerId, onNodeSelect, onEdgeSelect]);

    const handleExport = async (format) => {
        try {
            const exportData = NetworkFlowService.exportFlowDiagram(containerId, format);
            if (exportData) {
                const url = URL.createObjectURL(exportData);
                const a = document.createElement('a');
                a.href = url;
                a.download = `network-flow.${format}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('Export failed:', error);
        }
    };

    const handleFitView = () => {
        if (flowInstance) {
            // Use the correct Cytoscape.js method
            flowInstance.fit();
        }
    };

    const handleResetView = () => {
        if (flowInstance) {
            // Reset zoom and center the view
            flowInstance.zoom(1);
            flowInstance.center();
        }
    };

    const handleZoomIn = () => {
        if (flowInstance) {
            const currentZoom = flowInstance.zoom();
            flowInstance.zoom(currentZoom * 1.2);
        }
    };

    const handleZoomOut = () => {
        if (flowInstance) {
            const currentZoom = flowInstance.zoom();
            flowInstance.zoom(currentZoom * 0.8);
        }
    };

    if (isLoading) {
        return (
            <div className={`network-flow-renderer loading ${className}`}>
                <div className="loading-spinner">
                    <div className="spinner"></div>
                    <p>Loading network flow...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`network-flow-renderer ${className}`}>
            <div className="flow-toolbar">
                <div className="toolbar-left">
                    <button
                        className="toolbar-btn"
                        onClick={handleZoomIn}
                        title="Zoom In"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            <line x1="11" y1="8" x2="11" y2="14"></line>
                            <line x1="8" y1="11" x2="14" y2="11"></line>
                        </svg>
                        Zoom In
                    </button>
                    <button
                        className="toolbar-btn"
                        onClick={handleZoomOut}
                        title="Zoom Out"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            <line x1="8" y1="11" x2="14" y2="11"></line>
                        </svg>
                        Zoom Out
                    </button>
                    <button
                        className="toolbar-btn"
                        onClick={handleFitView}
                        title="Fit to view"
                    >
                        � Fit View
                    </button>
                    <button
                        className="toolbar-btn"
                        onClick={handleResetView}
                        title="Reset view"
                    >
                        🔄 Reset
                    </button>
                </div>

                <div className="toolbar-center">
                    <span className="flow-title">Network Flow Diagram</span>
                </div>

                <div className="toolbar-right">
                    <div className="export-buttons">
                        <button
                            className="toolbar-btn"
                            onClick={() => handleExport('png')}
                            title="Export as PNG"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                                <polyline points="14,2 14,8 20,8"></polyline>
                                <circle cx="10" cy="13" r="2"></circle>
                                <path d="M21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>
                            </svg>
                            PNG
                        </button>
                        <button
                            className="toolbar-btn"
                            onClick={() => handleExport('svg')}
                            title="Export as SVG"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                                <polyline points="14,2 14,8 20,8"></polyline>
                                <path d="M10 15l4-4"></path>
                                <path d="M10 11l4 4"></path>
                            </svg>
                            SVG
                        </button>
                    </div>
                </div>
            </div>

            <div className="flow-content">
                <div className="flow-main">
                    <div ref={containerRef} className="flow-container-wrapper" />
                </div>

                {selectedElement && (
                    <div className="flow-sidebar">
                        <div className="sidebar-header">
                            <h4>
                                {selectedElement.type === 'node' ? (
                                    <>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px' }}>
                                            <circle cx="12" cy="12" r="3"></circle>
                                            <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"></path>
                                        </svg>
                                        Node Details
                                    </>
                                ) : (
                                    <>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px' }}>
                                            <line x1="5" y1="12" x2="19" y2="12"></line>
                                            <polyline points="12,5 19,12 12,19"></polyline>
                                        </svg>
                                        Edge Details
                                    </>
                                )}
                            </h4>
                        </div>

                        <div className="sidebar-content">
                            <div className="detail-section">
                                <label>ID:</label>
                                <span>{selectedElement.data.id}</span>
                            </div>

                            <div className="detail-section">
                                <label>Label:</label>
                                <span>{selectedElement.data.label}</span>
                            </div>

                            <div className="detail-section">
                                <label>Type:</label>
                                <span className={`type-badge ${selectedElement.data.type}`}>
                                    {selectedElement.data.type}
                                </span>
                            </div>

                            {selectedElement.data.metadata && (
                                <div className="detail-section">
                                    <label>Metadata:</label>
                                    <pre className="metadata-json">
                                        {JSON.stringify(selectedElement.data.metadata, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="flow-legend">
                <div className="legend-header">
                    <h5>Legend</h5>
                </div>
                <div className="legend-items">
                    <div className="legend-item">
                        <div className="legend-node endpoint"></div>
                        <span>Endpoint</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-node service"></div>
                        <span>Service</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-node database"></div>
                        <span>Database</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-node gateway"></div>
                        <span>Gateway</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NetworkFlowRenderer;
