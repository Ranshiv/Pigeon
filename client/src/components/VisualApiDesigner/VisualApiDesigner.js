import React, { useState, useEffect, useCallback } from 'react';
import {
    FiSave,
    FiDownload,
    FiUpload,
    FiCheck,
    FiGrid,
    FiCode,
    FiEye
} from 'react-icons/fi';
import DesignCanvas from './components/DesignCanvas';
import ComponentPalette from './components/ComponentPalette';
import PropertiesPanel from './components/PropertiesPanel';
import SpecPreview from './components/SpecPreview';
import ValidationPanel from './components/ValidationPanel';
import useDesignerState from './hooks/useDesignerState';
import useSpecGeneration from './hooks/useSpecGeneration';
import './VisualApiDesigner.css';

const VisualApiDesigner = ({
    collectionId,
    onSpecUpdate,
    initialSpec = null,
    requests = [],
    onRequestsUpdate,
    collection,
    collaborationContext
}) => {
    const designerState = useDesignerState(initialSpec);
    const {
        nodes,
        edges,
        selectedNode,
        isDirty,
        addNode,
        updateNode,
        deleteNode,
        selectNode,
        undo,
        redo,
        canUndo,
        canRedo
    } = designerState;

    const { openApiSpec, validationErrors } = useSpecGeneration(nodes, edges);
    const [viewMode, setViewMode] = useState('design'); // 'design', 'preview', 'split'
    const [saveStatus, setSaveStatus] = useState('saved'); // 'saved', 'saving', 'unsaved'
    const [visualizationContext, setVisualizationContext] = useState(null); // For handling visualization requests
    const [isInitialized, setIsInitialized] = useState(false);

    // Initialize designer with collection requests
    useEffect(() => {
        if (requests && requests.length > 0 && !isInitialized) {
            // Convert collection requests to designer nodes
            const convertedNodes = requests.map((request, index) => ({
                id: `request-${request._id || request.id || index}`,
                type: 'endpoint',
                position: { x: 100 + (index % 3) * 200, y: 100 + Math.floor(index / 3) * 150 },
                data: {
                    method: request.method || 'GET',
                    path: request.url ? new URL(request.url).pathname : '/',
                    name: request.name || 'Unnamed Request',
                    description: request.description || '',
                    requestId: request._id || request.id
                }
            }));

            // Add nodes to designer
            convertedNodes.forEach(node => addNode(node.type, node.position, node.data));
            setIsInitialized(true);
        }
    }, [requests, isInitialized, addNode]);

    // Handle collaboration events
    useEffect(() => {
        if (collaborationContext && collectionId) {
            // Join collection for real-time collaboration
            collaborationContext.joinCollection(collectionId);

            // Send activity when designer is opened
            collaborationContext.sendActivity('designer_opened', {
                collectionId,
                collectionName: collection?.name
            });

            return () => {
                collaborationContext.leaveCollection(collectionId);
            };
        }
    }, [collaborationContext, collectionId, collection?.name]);

    const saveDesign = useCallback(async () => {
        try {
            const response = await fetch('/api/visual-designer/designs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    collectionId,
                    designerState: { nodes, edges },
                    openApiSpec
                })
            });

            if (!response.ok) {
                throw new Error('Failed to save design');
            }

            const result = await response.json();
            console.log('Design saved successfully:', result);

            // Notify parent component of spec update
            if (onSpecUpdate && openApiSpec) {
                onSpecUpdate(openApiSpec);
            }
        } catch (error) {
            console.error('Error saving design:', error);
            throw error;
        }
    }, [collectionId, nodes, edges, openApiSpec, onSpecUpdate]);

    const handleAutoSave = useCallback(async () => {
        if (saveStatus === 'unsaved') {
            setSaveStatus('saving');
            try {
                await saveDesign();
                setSaveStatus('saved');
            } catch (error) {
                console.error('Auto-save failed:', error);
                setSaveStatus('unsaved');
            }
        }
    }, [saveStatus, saveDesign]);

    // Auto-save functionality
    useEffect(() => {
        if (isDirty) {
            setSaveStatus('unsaved');
            const timer = setTimeout(() => {
                handleAutoSave();
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [isDirty, handleAutoSave]);

    // Handler functions for component interactions
    const handleDragStart = useCallback((componentData) => {
        // Only track drag start, don't create nodes here
        // Node creation happens in useDragAndDrop on drop
    }, []);

    const handleElementSelect = useCallback((elementId) => {
        selectNode(elementId);
    }, [selectNode]);

    const handleElementUpdate = useCallback((elementId, updates) => {
        updateNode(elementId, updates);
    }, [updateNode]);

    const handleElementDelete = useCallback((elementId) => {
        deleteNode(elementId);
    }, [deleteNode]);

    const handleVisualize = useCallback((nodeId, responseData) => {
        // Set visualization context and switch to preview mode with visualization tab active
        setVisualizationContext({
            nodeId,
            responseData,
            timestamp: Date.now()
        });

        // Switch to preview mode to show the visualization
        setViewMode('preview');
    }, []);

    const handleExportOpenAPI = () => {
        if (!openApiSpec) return;

        const blob = new Blob([JSON.stringify(openApiSpec, null, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${designerState.apiInfo?.title || 'api'}-spec.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleImportOpenAPI = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const spec = JSON.parse(e.target.result);
                // Convert OpenAPI spec to visual design
                // This will be implemented in Phase 2
                console.log('Importing OpenAPI spec:', spec);
            } catch (error) {
                console.error('Error importing OpenAPI spec:', error);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const renderTopToolbar = () => (
        <div className="visual-designer-toolbar">
            <div className="toolbar-left">
                <div className="toolbar-group">
                    <button
                        className="toolbar-btn"
                        onClick={undo}
                        disabled={!canUndo}
                        title="Undo"
                    >
                        ↶
                    </button>
                    <button
                        className="toolbar-btn"
                        onClick={redo}
                        disabled={!canRedo}
                        title="Redo"
                    >
                        ↷
                    </button>
                </div>

                <div className="toolbar-group">
                    <button
                        className="toolbar-btn"
                        onClick={() => saveDesign()}
                        disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                        title="Save Design"
                    >
                        <FiSave />
                        {saveStatus === 'saving' ? 'Saving...' : 'Save'}
                    </button>

                    <label className="toolbar-btn" title="Import OpenAPI">
                        <FiUpload />
                        Import
                        <input
                            type="file"
                            accept=".json,.yaml,.yml"
                            onChange={handleImportOpenAPI}
                            style={{ display: 'none' }}
                        />
                    </label>

                    <button
                        className="toolbar-btn"
                        onClick={handleExportOpenAPI}
                        disabled={!openApiSpec}
                        title="Export OpenAPI"
                    >
                        <FiDownload />
                        Export
                    </button>
                </div>

                <div className="toolbar-group">
                    <button
                        className={`toolbar-btn ${validationErrors.length === 0 ? 'success' : 'error'}`}
                        title={`${validationErrors.length} validation errors`}
                    >
                        <FiCheck />
                        {validationErrors.length === 0 ? 'Valid' : `${validationErrors.length} Errors`}
                    </button>
                </div>
            </div>

            <div className="toolbar-right">
                <div className="view-mode-toggle">
                    <button
                        className={`toggle-btn ${viewMode === 'design' ? 'active' : ''}`}
                        onClick={() => setViewMode('design')}
                    >
                        <FiGrid />
                        Design
                    </button>
                    <button
                        className={`toggle-btn ${viewMode === 'preview' ? 'active' : ''}`}
                        onClick={() => setViewMode('preview')}
                    >
                        <FiEye />
                        Preview
                    </button>
                    <button
                        className={`toggle-btn ${viewMode === 'split' ? 'active' : ''}`}
                        onClick={() => setViewMode('split')}
                    >
                        <FiCode />
                        Split
                    </button>
                </div>
            </div>
        </div>
    );

    const renderMainContent = () => {
        switch (viewMode) {
            case 'preview':
                return (
                    <div className="preview-container">
                        <SpecPreview
                            nodes={nodes}
                            edges={edges}
                            spec={openApiSpec}
                            validationErrors={validationErrors}
                            visualizationContext={visualizationContext}
                        />
                    </div>
                );
            case 'split':
                return (
                    <div className="split-container">
                        <div className="split-design">
                            {renderDesignView()}
                        </div>
                        <div className="split-preview">
                            <SpecPreview
                                nodes={nodes}
                                edges={edges}
                                spec={openApiSpec}
                                validationErrors={validationErrors}
                                visualizationContext={visualizationContext}
                            />
                        </div>
                    </div>
                );
            default:
                return renderDesignView();
        }
    };

    const handleVisualizationIssueClick = useCallback((issue) => {
        // Navigate to the problematic node or section
        if (issue.nodeId) {
            selectNode(issue.nodeId);
        }
        console.log('Validation issue clicked:', issue);
    }, [selectNode]);

    const renderDesignView = () => (
        <div className="design-workspace">
            <div className="workspace-left">
                <ComponentPalette onDragStart={handleDragStart} />
            </div>

            <div className="workspace-center">
                <DesignCanvas
                    nodes={nodes}
                    edges={edges}
                    selectedNode={selectedNode}
                    onNodeSelect={handleElementSelect}
                    onNodeUpdate={handleElementUpdate}
                    onNodeDelete={handleElementDelete}
                    onVisualize={handleVisualize}
                    onNodeAdd={addNode}
                />
            </div>

            <div className="workspace-right">
                <PropertiesPanel
                    selectedNode={selectedNode}
                    onNodeUpdate={handleElementUpdate}
                    onDeleteNode={handleElementDelete}
                    validationErrors={validationErrors}
                />
            </div>
        </div>
    );

    return (
        <div className="visual-api-designer">
            {renderTopToolbar()}
            <div className="designer-content">
                {renderMainContent()}
            </div>

            {/* Validation Panel */}
            <ValidationPanel
                validationErrors={validationErrors}
                onValidationIssueClick={handleVisualizationIssueClick}
            />
        </div>
    );
};

export default VisualApiDesigner;
