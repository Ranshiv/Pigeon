import React, { useState, useEffect, useCallback, useRef, startTransition, Suspense } from 'react';
import {
    FiSave,
    FiUpload,
    FiCheck,
    FiGrid,
    FiCode,
    FiEye,
    FiChevronLeft,
    FiChevronRight,
    FiGitBranch,
    FiTag
} from 'react-icons/fi';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import DesignCanvas from './components/DesignCanvas';
import ComponentPalette from './components/ComponentPalette';
import PropertiesPanel from './components/PropertiesPanel';
import SpecPreview from './components/SpecPreview';
import ValidationPanel from './components/ValidationPanel';
import ContractDiffViewer from './components/ContractDiffViewer';
import ArazzoWorkflowWorkspace from './components/ArazzoWorkflowWorkspace';
import VersionCreationModal from './components/VersionCreationModal';
import ErrorBoundary from './components/ErrorBoundary';
import useDesignerState from './hooks/useDesignerState';
import useSpecGeneration from './hooks/useSpecGeneration';
import { debounce } from '../../utils/debounce';
import { suppressReactErrors } from '../../utils/errorSuppressor';
import { installDOMErrorHandlers, uninstallDOMErrorHandlers } from './utils/domErrorHandler';
import './VisualApiDesigner.css';
import './icon-styles.css';
import './node-borders.css';

const VisualApiDesigner = ({
    collectionId,
    onSpecUpdate,
    initialSpec = null,
    requests = [],
    onRequestsUpdate,
    collection,
    collaborationContext
}) => {
    // Responsive hook for panel direction
    const [isSmallScreen, setIsSmallScreen] = useState(false);

    useEffect(() => {
        const checkScreenSize = () => {
            setIsSmallScreen(window.innerWidth <= 1024);
        };

        // Debounce the screen size check to prevent excessive calls during zoom/resize
        const debouncedCheckScreenSize = debounce(checkScreenSize, 100);

        checkScreenSize();
        window.addEventListener('resize', debouncedCheckScreenSize);
        return () => window.removeEventListener('resize', debouncedCheckScreenSize);
    }, []);

    // Suppress specific React errors to reduce console noise
    useEffect(() => {
        const cleanup = suppressReactErrors();
        return cleanup; // Clean up error handlers when component unmounts
    }, []);

    // Install DOM error handlers to prevent React reconciliation conflicts
    useEffect(() => {
        installDOMErrorHandlers();
        return () => {
            uninstallDOMErrorHandlers();
        };
    }, []);

    const designerState = useDesignerState(initialSpec);
    const {
        nodes,
        edges,
        selectedEdge,
        selectedNode,
        isDirty,
        addNode,
        addEdge,
        deleteEdge,
        selectEdge,
        updateNode,
        deleteNode,
        selectNode,
        markClean,
        undo,
        redo,
        canUndo,
        canRedo
    } = designerState;

    // Get the loadDesign function from designer state
    const { loadDesign: loadDesignerState } = designerState;

    const { generatedSpec, validationErrors } = useSpecGeneration(nodes, edges);
    const [viewMode, setViewMode] = useState('design'); // 'design', 'workflow', 'preview', 'split', 'diff'
    const [arazzoWorkflow, setArazzoWorkflow] = useState(null);
    const [isTransitioning, setIsTransitioning] = useState(false); // Smooth mode transitions
    const [saveStatus, setSaveStatus] = useState('saved'); // 'saved', 'saving', 'unsaved'
    const [visualizationContext, setVisualizationContext] = useState(null); // For handling visualization requests
    const [isInitialized, setIsInitialized] = useState(false);
    const [leftSidebarExpanded, setLeftSidebarExpanded] = useState(true); // For Component Palette
    const [rightSidebarExpanded, setRightSidebarExpanded] = useState(true); // For Properties Panel
    const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
    const [isSavingVersion, setIsSavingVersion] = useState(false);

    // Use ref to avoid recreating debug function
    const collectionIdRef = useRef(collectionId);
    const lastSaveRef = useRef(0); // Track last save time
    const isDev = process.env.NODE_ENV === 'development';

    // Update ref when collectionId changes
    useEffect(() => {
        collectionIdRef.current = collectionId;
    }, [collectionId]);

    // Add keyboard shortcuts for toggling sidebars after state initialization
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Prevent shortcuts during transitions
            if (isTransitioning) return;

            // Alt + L to toggle left sidebar
            if (e.altKey && e.key === 'l') {
                setLeftSidebarExpanded(prev => !prev);
            }
            // Alt + R to toggle right sidebar
            if (e.altKey && e.key === 'r') {
                setRightSidebarExpanded(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isTransitioning]);

    // Initialize designer with collection requests
    useEffect(() => {
        // Only run initialization once when requests are available and no design is loaded
        if (requests && requests.length > 0 && !isInitialized) {
            console.log('🚀 Initializing designer with', requests.length, 'requests');
            try {
                // We'll use a debounced approach to avoid excessive state updates

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
                })).filter(node => node && node.type && node.data); // Filter out invalid nodes

                // Add nodes with delay to prevent React rendering issues
                if (convertedNodes.length > 0) {
                    console.log('📝 Adding', convertedNodes.length, 'nodes from requests');
                    // Use setTimeout to defer processing to next event loop
                    // This helps prevent cascading updates and max depth issues
                    setTimeout(() => {
                        // Process nodes in smaller batches to prevent UI freezing
                        const processBatch = (startIndex) => {
                            const batchSize = 5;
                            const endIndex = Math.min(startIndex + batchSize, convertedNodes.length);

                            for (let i = startIndex; i < endIndex; i++) {
                                // addNode expects a single object with { type, position, data }
                                const n = convertedNodes[i];
                                addNode({ type: n.type, position: n.position, data: n.data });
                            }

                            if (endIndex < convertedNodes.length) {
                                setTimeout(() => processBatch(endIndex), 50);
                            }
                        };

                        processBatch(0);
                    }, 100);
                } else {
                    console.log('📝 No valid nodes to add from requests');
                }
            } catch (error) {
                // Catch any errors in the processing to prevent component crashes
                console.warn("Error initializing API designer:", error.message);
            }
            // Mark as initialized to prevent repeated processing
            setIsInitialized(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [requests, isInitialized]); // Remove addNode from dependencies to prevent re-runs

    const joinCollectionFn = collaborationContext?.joinCollection;
    const leaveCollectionFn = collaborationContext?.leaveCollection;
    const sendActivityFn = collaborationContext?.sendActivity;

    // Handle collaboration events
    useEffect(() => {
        if (!collectionId) return;
        if (typeof joinCollectionFn !== 'function' || typeof leaveCollectionFn !== 'function') return;

        // Join collection for real-time collaboration
        joinCollectionFn(collectionId);

        // Send activity when designer is opened (explicit room avoids timing issues)
        if (typeof sendActivityFn === 'function') {
            sendActivityFn('designer_opened', {
                collectionId,
                collectionName: collection?.name
            }, `collection:${collectionId}`);
        }

        return () => {
            leaveCollectionFn(collectionId);
        };
    }, [collectionId, joinCollectionFn, leaveCollectionFn, sendActivityFn]);

    const saveDesign = useCallback(async (workflowOverride = arazzoWorkflow) => {
        try {
            // Skip if collection ID is invalid or contains '#' character
            if (!collectionId || typeof collectionId !== 'string' || collectionId.includes('#')) {
                return { success: true, message: 'Save skipped - invalid collection ID' };
            }

            setSaveStatus('saving');

            // Only log when there are significant changes
            if (nodes?.length > 0 || edges?.length > 0) {
                console.log('💾 Saving design with', nodes?.length || 0, 'nodes and', edges?.length || 0, 'edges');
            }

            // Prepare the designer state
            const designerState = {
                nodes: nodes || [],
                edges: edges || [],
                viewport: { x: 0, y: 0, zoom: 1 }
            };

            // Make API call to save design
            const response = await fetch('/api/visual-designer/designs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    collectionId,
                    designerState,
                    openApiSpec: generatedSpec,
                    arazzoWorkflow: workflowOverride,
                    name: collection?.name ? `${collection.name} Visual Design` : 'Untitled Design'
                })
            });

            const result = await response.json();

            // Only log errors or first successful save
            if (!response.ok) {
                console.error('💾 Save failed:', { status: response.status, result });
                throw new Error(result.message || `HTTP ${response.status}: Failed to save design`);
            }

            // Notify parent component of spec update
            if (onSpecUpdate && generatedSpec) {
                onSpecUpdate(generatedSpec);
            }

            setSaveStatus('saved');

            // Reset isDirty flag after successful save
            markClean();
            console.log('✅ Save successful, isDirty reset to false');

            return {
                success: true,
                message: result.message || 'Design saved successfully',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            // Only log errors in development mode
            if (isDev) {
                console.error('Error saving design:', error);
            }
            setSaveStatus('unsaved');

            return {
                success: false,
                message: error.message || 'Failed to save design'
            };
        }
    }, [collectionId, nodes, edges, generatedSpec, arazzoWorkflow, onSpecUpdate, collection?.name, isDev, markClean]);

    const loadDesign = useCallback(async () => {
        try {
            // Skip if collection ID is invalid
            if (!collectionId || typeof collectionId !== 'string' || collectionId.includes('#')) {
                return;
            }

            // Make API call to load design
            const response = await fetch(`/api/visual-designer/designs/${collectionId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            const result = await response.json();

            // Always log load operations to debug refresh issues
            console.log('📖 Load design response:', {
                status: response.status,
                success: result.success,
                hasData: !!result.data,
                hasDesignerState: !!result.data?.designerState,
                nodeCount: result.data?.designerState?.nodes?.length || 0,
                edgeCount: result.data?.designerState?.edges?.length || 0
            });

            if (!response.ok) {
                throw new Error(result.message || `HTTP ${response.status}: Failed to load design`);
            }

            // Load the design state if it exists
            if (result.data?.designerState) {
                const { designerState } = result.data;

                console.log('📖 Loading designer state:', {
                    nodeCount: designerState.nodes?.length || 0,
                    edgeCount: designerState.edges?.length || 0,
                    hasViewport: !!designerState.viewport
                });

                // Always load the designer state, even if empty
                loadDesignerState(designerState);
                setSaveStatus('saved');

                if (designerState.nodes?.length > 0 || designerState.edges?.length > 0) {
                    console.log('✅ Design loaded with', designerState.nodes?.length || 0, 'nodes and', designerState.edges?.length || 0, 'edges');
                } else {
                    console.log('📝 Empty design loaded');
                }
            } else {
                console.log('📝 No designer state found in response');
            }

            setArazzoWorkflow(result.data?.arazzoWorkflow || null);

            return result.data;
        } catch (error) {
            console.error('❌ Error loading design:', error);
            // Silently fail loading to not break the component
        }
    }, [collectionId, loadDesignerState]);

    // Priority load effect - load saved design first, before initialization
    useEffect(() => {
        if (collectionId && !isInitialized) {
            console.log('🎯 Priority load: Attempting to load saved design before initialization for:', collectionId);
            loadDesign().then((loadedData) => {
                if (loadedData?.designerState?.nodes?.length > 0) {
                    console.log('✅ Found saved design with', loadedData.designerState.nodes.length, 'nodes - skipping request initialization');
                    setIsInitialized(true); // Skip request initialization
                } else {
                    console.log('📝 No saved design found, allowing request initialization to proceed');
                    // Let the initialization effect run by not setting isInitialized here
                }
            }).catch(error => {
                console.log('⚠️ Priority load failed, allowing request initialization to proceed:', error.message);
                // Let the initialization effect run
            });
        }
    }, [collectionId, isInitialized, loadDesign, setIsInitialized]);

    // Load design when component mounts or collection changes (after initialization)
    useEffect(() => {
        console.log('🔄 Standard load effect triggered:', {
            hasCollectionId: !!collectionId,
            collectionId: collectionId,
            isInitialized,
            loadDesignRef: typeof loadDesign
        });

        // Only load after initialization is complete (this handles cases where
        // the priority load didn't find anything but initialization completed)
        if (collectionId && isInitialized) {
            console.log('📖 Standard load: Checking for design updates for collection:', collectionId);
            // This is a secondary load to catch any updates
            loadDesign();
        } else {
            console.log('⏭️ Skipping standard load - missing requirements:', {
                hasCollectionId: !!collectionId,
                isInitialized
            });
        }
    }, [collectionId, isInitialized, loadDesign]);

    // Debug function to check database state - memoized to prevent recreation
    const debugDatabase = useCallback(async () => {
        const currentCollectionId = collectionIdRef.current;
        if (!currentCollectionId) {
            console.log('🔍 No collectionId to debug');
            return;
        }

        try {
            const response = await fetch(`/api/visual-designer/debug/${currentCollectionId}`, {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer dev-token'
                }
            });

            if (response.ok) {
                const debugData = await response.json();
                console.log('🔍 Database debug data:', debugData);
            } else {
                console.error('🔍 Debug endpoint failed:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('🔍 Debug check error:', error);
        }
    }, []);

    // Add debug function to window for console access - only once and only in development
    useEffect(() => {
        if (isDev) {
            window.debugVisualDesigner = debugDatabase;
            return () => {
                delete window.debugVisualDesigner;
            };
        }
    }, [debugDatabase, isDev]);

    const handleAutoSave = useCallback(async () => {
        if (saveStatus === 'unsaved') {
            setSaveStatus('saving');
            try {
                await saveDesign();
                setSaveStatus('saved');
            } catch (error) {
                // Silent error handling to avoid console noise
                setSaveStatus('unsaved');
            }
        }
    }, [saveStatus, saveDesign]);

    // Debounced save to prevent excessive saves - use ref to avoid recreation
    const debouncedSaveRef = useRef(null);

    const debouncedSave = useCallback(() => {
        if (debouncedSaveRef.current) {
            clearTimeout(debouncedSaveRef.current);
        }
        debouncedSaveRef.current = setTimeout(() => {
            console.log('⚡ Debounced save executing...');
            handleAutoSave();
        }, 1000); // Reduced from 2000ms to 1000ms for faster saves
    }, [handleAutoSave]);

    // Auto-save functionality with improved debouncing and throttling
    useEffect(() => {
        // Auto-save only when:
        // 1. There are actual changes (isDirty)
        // 2. We're not already saving
        // 3. Collection ID is valid
        // 4. Enough time has passed since last save (throttling)
        const now = Date.now();
        const timeSinceLastSave = now - lastSaveRef.current;
        const minSaveInterval = isDev ? 1000 : 2000; // 1s in dev, 2s in prod (much faster)

        console.log('🔍 Auto-save check:', {
            isDirty,
            saveStatus,
            collectionId,
            timeSinceLastSave,
            minSaveInterval,
            willTrigger: isDirty &&
                saveStatus !== 'saving' &&
                collectionId &&
                typeof collectionId === 'string' &&
                !collectionId.includes('#') &&
                timeSinceLastSave >= minSaveInterval
        });

        if (isDirty &&
            saveStatus !== 'saving' &&
            collectionId &&
            typeof collectionId === 'string' &&
            !collectionId.includes('#') &&
            timeSinceLastSave >= minSaveInterval) {

            console.log('🔄 Auto-save triggered - isDirty:', isDirty, 'timeSinceLastSave:', timeSinceLastSave);
            setSaveStatus('unsaved');
            lastSaveRef.current = now;
            debouncedSave();
        }
    }, [isDirty, saveStatus, collectionId, debouncedSave, isDev]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (debouncedSaveRef.current) {
                clearTimeout(debouncedSaveRef.current);
            }
        };
    }, []);

    // Save on page unload if there are unsaved changes
    useEffect(() => {
        const handleBeforeUnload = async (event) => {
            if (isDirty && saveStatus !== 'saving') {
                // Try to save changes before page unload
                try {
                    await saveDesign();
                    console.log('💾 Emergency save completed before page unload');
                } catch (error) {
                    console.warn('💾 Emergency save failed:', error);
                    // Show warning to user
                    event.preventDefault();
                    event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                    return 'You have unsaved changes. Are you sure you want to leave?';
                }
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty, saveStatus, saveDesign]);

    // Sidebar state management - preserve user preferences across mode switches
    // Only provide gentle suggestions without forcing changes
    useEffect(() => {
        // Gentle sidebar suggestions without forcing changes
        // Users can manually adjust sidebars as needed

        // Note: Removed aggressive auto-management to respect user preferences
        // Sidebars now maintain their state across mode switches
    }, [viewMode]); // Simplified dependency array
    const handleDragStart = useCallback((componentData) => {
        // When dragging starts, make sure the left sidebar is expanded
        if (!leftSidebarExpanded) {
            setLeftSidebarExpanded(true);
        }
        // Only track drag start, don't create nodes here
        // Node creation happens in useDragAndDrop on drop
    }, [leftSidebarExpanded]);

    const handleElementSelect = useCallback((elementId) => {
        selectNode(elementId);
        // Expand the right sidebar when a node is selected
        if (elementId && !rightSidebarExpanded) {
            setRightSidebarExpanded(true);
        }
    }, [selectNode, rightSidebarExpanded]);

    // Clean up design canvas states when switching to preview mode
    useEffect(() => {
        if (viewMode === 'preview') {
            // Clear any active selections or drag states when switching to preview
            // This prevents UI inconsistencies
            selectNode(null);
        }
    }, [viewMode, selectNode]);

    const handleElementUpdate = useCallback((elementId, updates) => {
        console.log('🎯 handleElementUpdate called for', elementId, 'with updates:', updates);
        updateNode(elementId, updates);
    }, [updateNode]);

    const handleElementDelete = useCallback((elementId) => {
        console.log('🗑️ handleElementDelete called for', elementId);
        // Debounce deletion to prevent rapid successive calls and add safety delay
        const debouncedDelete = debounce(() => {
            // Double-check the element still exists before deleting
            const elementExists = nodes.find(node => node.id === elementId);
            if (!elementExists) {
                console.warn('Element already deleted:', elementId);
                return;
            }

            // Use React transition to batch the update and prevent conflicts
            startTransition(() => {
                // Add small delay to ensure DOM is stable
                requestAnimationFrame(() => {
                    deleteNode(elementId);
                });
            });
        }, 100);
        debouncedDelete();
    }, [deleteNode, nodes]);

    const handleVisualize = useCallback((nodeId, responseData) => {
        try {
            // Validate response data structure
            if (!responseData || typeof responseData !== 'object') {
                console.warn('Invalid response data for visualization:', responseData);
                return;
            }

            // Validate nodeId exists in current nodes
            const node = nodes.find(n => n.id === nodeId);
            if (!node) {
                console.warn('Node not found for visualization:', nodeId);
                return;
            }

            // Set visualization context and switch to preview mode with visualization tab active
            setVisualizationContext({
                nodeId,
                responseData,
                timestamp: Date.now(),
                nodeName: node.data?.name || node.type || 'Unknown Node'
            });

            // Switch to preview mode to show the visualization
            setViewMode('preview');
        } catch (error) {
            console.error('Error setting up visualization:', error);
            // Don't break the app, just log the error
        }
    }, [nodes]);

    // Simple visualization context - no complex persistence needed
    // Context stays available across mode switches to prevent data loss

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

    const handleSaveAsVersion = useCallback(async (versionData) => {
        setIsSavingVersion(true);

        try {
            const response = await fetch(`/api/api-versions/collections/${collectionId}/versions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(versionData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to create API version');
            }

            const result = await response.json();
            console.log('✅ API version created successfully:', result.apiVersion);

            // Optionally switch to diff view to show the new version
            // setViewMode('diff');

            return result.apiVersion;
        } catch (error) {
            console.error('Error creating API version:', error);
            throw error;
        } finally {
            setIsSavingVersion(false);
        }
    }, [collectionId]);

    // Handle smooth mode transitions
    const handleViewModeChange = useCallback((newMode) => {
        if (newMode === viewMode || isTransitioning) return;

        try {
            setIsTransitioning(true);

            // Brief transition delay for smooth UI changes
            setTimeout(() => {
                setViewMode(newMode);
                setIsTransitioning(false);
            }, 100);
        } catch (error) {
            console.warn('Error during mode transition:', error);
            setIsTransitioning(false);
            // Fallback to immediate mode change
            setViewMode(newMode);
        }
    }, [viewMode, isTransitioning]);

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
                        className="toolbar-btn toolbar-btn-primary"
                        title="Save current design as API version"
                        onClick={() => setIsVersionModalOpen(true)}
                        disabled={!generatedSpec || Object.keys(generatedSpec?.paths || {}).length === 0}
                    >
                        <FiTag />
                        Save as Version
                    </button>

                    {/* Export functionality moved to preview panel for consistency */}
                </div>
            </div>

            <div className="toolbar-right">
                <div className="view-mode-toggle">
                    <button
                        className={`toggle-btn ${viewMode === 'design' ? 'active' : ''}`}
                        onClick={() => handleViewModeChange('design')}
                        disabled={isTransitioning}
                    >
                        <FiGrid />
                        Design
                    </button>
                    <button
                        className={`toggle-btn ${viewMode === 'workflow' ? 'active' : ''}`}
                        onClick={() => handleViewModeChange('workflow')}
                        disabled={isTransitioning}
                        title="Arazzo API workflows"
                    >
                        <FiGitBranch />
                        Workflow
                    </button>
                    <button
                        className={`toggle-btn ${viewMode === 'preview' ? 'active' : ''}`}
                        onClick={() => handleViewModeChange('preview')}
                        disabled={isTransitioning}
                    >
                        <FiEye />
                        Preview
                    </button>
                    <button
                        className={`toggle-btn ${viewMode === 'split' ? 'active' : ''}`}
                        onClick={() => handleViewModeChange('split')}
                        disabled={isTransitioning}
                    >
                        <FiCode />
                        Split
                    </button>
                    <button
                        className={`toggle-btn ${viewMode === 'diff' ? 'active' : ''}`}
                        onClick={() => handleViewModeChange('diff')}
                        disabled={isTransitioning}
                        title="Contract Diff & Breaking Changes"
                    >
                        <FiGitBranch />
                        Diff
                    </button>
                </div>
            </div>
        </div>
    );

    const renderMainContent = () => {
        switch (viewMode) {
            case 'workflow':
                return (
                    <ArazzoWorkflowWorkspace
                        collectionName={collection?.name || 'Pigeon API'}
                        collectionId={collectionId}
                        requests={requests}
                        collectionVariables={collection?.variables || []}
                        workflow={arazzoWorkflow}
                        onWorkflowChange={setArazzoWorkflow}
                        onSave={async (workflow) => {
                            setArazzoWorkflow(workflow);
                            return saveDesign(workflow);
                        }}
                    />
                );
            case 'preview':
                return (
                    <div className="preview-container">
                        <SpecPreview
                            nodes={nodes}
                            edges={edges}
                            spec={generatedSpec}
                            validationErrors={validationErrors}
                            visualizationContext={visualizationContext}
                        />
                    </div>
                );
            case 'split':
                return (
                    <PanelGroup
                        direction={isSmallScreen ? "vertical" : "horizontal"}
                        className="split-container"
                    >
                        <Panel
                            defaultSize={50}
                            minSize={20}
                            className="split-design"
                        >
                            {renderDesignView()}
                        </Panel>
                        <PanelResizeHandle className="resize-handle" />
                        <Panel
                            defaultSize={50}
                            minSize={20}
                            className="split-preview"
                        >
                            <SpecPreview
                                nodes={nodes}
                                edges={edges}
                                spec={generatedSpec}
                                validationErrors={validationErrors}
                                visualizationContext={visualizationContext}
                            />
                        </Panel>
                    </PanelGroup>
                );
            case 'diff':
                return (
                    <div className="diff-container">
                        <ContractDiffViewer
                            currentSpec={generatedSpec}
                            workspaceId={collection?.workspaceId}
                            collectionId={collectionId}
                            onVersionCompare={(comparison) => {
                                console.log('Version comparison:', comparison);
                            }}
                        />
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
            <div className={`workspace-left ${!leftSidebarExpanded ? 'collapsed' : ''}`}>
                {/* Move the toggle button outside of conditional rendering to ensure it's always visible */}
                <div
                    className="sidebar-toggle left-toggle"
                    onClick={() => setLeftSidebarExpanded(!leftSidebarExpanded)}
                    title={leftSidebarExpanded ? "Collapse Component Palette (Alt+L)" : "Expand Component Palette (Alt+L)"}
                    aria-label={leftSidebarExpanded ? "Collapse Component Palette" : "Expand Component Palette"}
                >
                    {leftSidebarExpanded ? <FiChevronLeft /> : <FiChevronRight />}
                </div>

                {leftSidebarExpanded && <ComponentPalette onDragStart={handleDragStart} />}
                {!leftSidebarExpanded && (
                    <div className="sidebar-label vertical-text">
                        Component Palette
                    </div>
                )}
            </div>

            <div className="workspace-center">
                <ErrorBoundary fallbackMessage="The design canvas encountered an issue. Please try refreshing or contact support if the problem persists.">
                    <Suspense fallback={<div className="loading-canvas">Loading canvas...</div>}>
                        <DesignCanvas
                            nodes={nodes}
                            edges={edges}
                            selectedEdge={selectedEdge}
                            selectedNode={selectedNode}
                            onNodeSelect={handleElementSelect}
                            onNodeUpdate={handleElementUpdate}
                            onNodeDelete={handleElementDelete}
                            onVisualize={handleVisualize}
                            onNodeAdd={addNode}
                            onEdgeAdd={addEdge}
                            onEdgeDelete={deleteEdge}
                            onEdgeSelect={selectEdge}
                        />
                    </Suspense>
                </ErrorBoundary>
            </div>            <div className={`workspace-right ${!rightSidebarExpanded ? 'collapsed' : ''}`}>
                {/* Move the toggle button outside of conditional rendering to ensure it's always visible */}
                <div
                    className="sidebar-toggle right-toggle"
                    onClick={() => setRightSidebarExpanded(!rightSidebarExpanded)}
                    title={rightSidebarExpanded ? "Collapse Properties Panel (Alt+R)" : "Expand Properties Panel (Alt+R)"}
                    aria-label={rightSidebarExpanded ? "Collapse Properties Panel" : "Expand Properties Panel"}
                >
                    {rightSidebarExpanded ? <FiChevronRight /> : <FiChevronLeft />}
                </div>

                {rightSidebarExpanded && (
                    <PropertiesPanel
                        selectedNode={selectedNode}
                        onNodeUpdate={handleElementUpdate}
                        onDeleteNode={handleElementDelete}
                        onTestEndpoint={handleVisualize}
                        validationErrors={validationErrors}
                    />
                )}
                {!rightSidebarExpanded && (
                    <div className="sidebar-label vertical-text">
                        Properties Panel
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className={`visual-api-designer ${isTransitioning ? 'transitioning' : ''}`}>
            {renderTopToolbar()}
            <div className="designer-content">
                {isTransitioning ? (
                    <div className="mode-transition-loading">
                        <div className="loading-spinner"></div>
                        <p>Switching modes...</p>
                    </div>
                ) : (
                    renderMainContent()
                )}
            </div>

            {/* Validation Panel */}
            <ValidationPanel
                validationErrors={validationErrors}
                onValidationIssueClick={handleVisualizationIssueClick}
            />

            {/* Version Creation Modal */}
            <VersionCreationModal
                isOpen={isVersionModalOpen}
                onClose={() => setIsVersionModalOpen(false)}
                onSave={handleSaveAsVersion}
                collectionId={collectionId}
                openApiSpec={generatedSpec}
                isLoading={isSavingVersion}
            />
        </div>
    );
};

export default VisualApiDesigner;
