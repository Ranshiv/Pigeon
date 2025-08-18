import { useState, useCallback } from 'react';

const useDesignerState = (initialState = {}) => {
    const [state, setState] = useState({
        nodes: [],
        edges: [],
        selectedNode: null,
        selectedEdge: null,
        viewport: { x: 0, y: 0, zoom: 1 },
        isLoading: false,
        error: null,
        isDirty: false,
        history: [],
        historyIndex: -1,
        ...initialState
    });

    // Node operations with update batching for better performance
    const addNode = useCallback((nodeData) => {
        try {
            // Generate a stable unique ID based on type and timestamp for better predictability
            const timestamp = Date.now();
            const typePrefix = nodeData.type || 'node';
            const nodeId = `${typePrefix}-${timestamp}-${Math.random().toString(36).substr(2, 6)}`;

            // Create the new node object
            const newNode = {
                id: nodeId,
                type: nodeData.type || 'default',
                position: nodeData.position || { x: 100, y: 100 },
                data: nodeData.data || {},
                dimensions: nodeData.dimensions || { width: 240, height: 128 },
                ...nodeData
            };

            // Use a functional update to prevent stale state issues
            setState(prevState => {
                // Check if a node with this ID already exists to prevent duplicates
                if (prevState.nodes.some(node => node.id === nodeId)) {
                    console.warn('Duplicate node ID detected, skipping:', nodeId);
                    return prevState; // Skip update if node already exists
                }

                const newState = {
                    ...prevState,
                    nodes: [...prevState.nodes, newNode],
                    isDirty: true
                };
                return addToHistory(newState, prevState);
            });

            return newNode;
        } catch (error) {
            console.error('Error adding node:', error);
            // Return a safe fallback node to prevent UI crashes
            return {
                id: `error-${Date.now()}`,
                type: 'error',
                position: { x: 0, y: 0 },
                data: { error: error.message },
                dimensions: { width: 240, height: 128 }
            };
        }
    }, []);

    const updateNode = useCallback((nodeId, updates) => {
        setState(prevState => {
            const nodeIndex = prevState.nodes.findIndex(node => node.id === nodeId);
            if (nodeIndex === -1) return prevState;

            const updatedNodes = [...prevState.nodes];
            updatedNodes[nodeIndex] = {
                ...updatedNodes[nodeIndex],
                ...updates,
                data: {
                    ...updatedNodes[nodeIndex].data,
                    ...(updates.data || {})
                }
            };

            const newState = {
                ...prevState,
                nodes: updatedNodes,
                isDirty: true
            };
            return addToHistory(newState, prevState);
        });
    }, []);

    const deleteNode = useCallback((nodeId) => {
        setState(prevState => {
            // Remove node and associated edges
            const filteredNodes = prevState.nodes.filter(node => node.id !== nodeId);
            const filteredEdges = prevState.edges.filter(
                edge => edge.source !== nodeId && edge.target !== nodeId
            );

            const newState = {
                ...prevState,
                nodes: filteredNodes,
                edges: filteredEdges,
                selectedNode: prevState.selectedNode?.id === nodeId ? null : prevState.selectedNode,
                isDirty: true
            };
            return addToHistory(newState, prevState);
        });
    }, []);

    const selectNode = useCallback((nodeId) => {
        // Prevent infinite update loops by ensuring we only update when needed
        setState(prevState => {
            // Skip update if same node is already selected
            if (prevState.selectedNode && prevState.selectedNode.id === nodeId) {
                return prevState;
            }

            const selectedNode = prevState.nodes.find(node => node.id === nodeId) || null;

            // Skip update if we can't find the node and no node is currently selected
            if (!selectedNode && !prevState.selectedNode) {
                return prevState;
            }

            return {
                ...prevState,
                selectedNode: selectedNode,
                selectedEdge: null
            };
        });
    }, []);

    // Edge operations
    const addEdge = useCallback((edgeData) => {
        const newEdge = {
            id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            source: edgeData.source,
            target: edgeData.target,
            type: edgeData.type || 'default',
            data: edgeData.data || {},
            ...edgeData
        };

        setState(prevState => {
            // Check if edge already exists
            const existingEdge = prevState.edges.find(
                edge => edge.source === newEdge.source && edge.target === newEdge.target
            );

            if (existingEdge) {
                return prevState;
            }

            const newState = {
                ...prevState,
                edges: [...prevState.edges, newEdge],
                isDirty: true
            };
            return addToHistory(newState, prevState);
        });

        return newEdge;
    }, []);

    const updateEdge = useCallback((edgeId, updates) => {
        setState(prevState => {
            const edgeIndex = prevState.edges.findIndex(edge => edge.id === edgeId);
            if (edgeIndex === -1) return prevState;

            const updatedEdges = [...prevState.edges];
            updatedEdges[edgeIndex] = {
                ...updatedEdges[edgeIndex],
                ...updates
            };

            const newState = {
                ...prevState,
                edges: updatedEdges,
                isDirty: true
            };
            return addToHistory(newState, prevState);
        });
    }, []);

    const deleteEdge = useCallback((edgeId) => {
        setState(prevState => {
            const newState = {
                ...prevState,
                edges: prevState.edges.filter(edge => edge.id !== edgeId),
                selectedEdge: prevState.selectedEdge?.id === edgeId ? null : prevState.selectedEdge,
                isDirty: true
            };
            return addToHistory(newState, prevState);
        });
    }, []);

    const selectEdge = useCallback((edgeId) => {
        setState(prevState => ({
            ...prevState,
            selectedEdge: prevState.edges.find(edge => edge.id === edgeId) || null,
            selectedNode: null
        }));
    }, []);

    // Viewport operations
    const updateViewport = useCallback((viewportUpdate) => {
        setState(prevState => ({
            ...prevState,
            viewport: {
                ...prevState.viewport,
                ...viewportUpdate
            }
        }));
    }, []);

    // History operations
    const addToHistory = (newState, prevState) => {
        const historyEntry = {
            nodes: prevState.nodes,
            edges: prevState.edges,
            timestamp: Date.now()
        };

        const newHistory = newState.history.slice(0, newState.historyIndex + 1);
        newHistory.push(historyEntry);

        // Limit history to 50 entries
        if (newHistory.length > 50) {
            newHistory.shift();
        }

        return {
            ...newState,
            history: newHistory,
            historyIndex: newHistory.length - 1
        };
    };

    const undo = useCallback(() => {
        setState(prevState => {
            if (prevState.historyIndex <= 0) return prevState;

            const previousState = prevState.history[prevState.historyIndex - 1];
            return {
                ...prevState,
                nodes: previousState.nodes,
                edges: previousState.edges,
                historyIndex: prevState.historyIndex - 1,
                selectedNode: null,
                selectedEdge: null,
                isDirty: true
            };
        });
    }, []);

    const redo = useCallback(() => {
        setState(prevState => {
            if (prevState.historyIndex >= prevState.history.length - 1) return prevState;

            const nextState = prevState.history[prevState.historyIndex + 1];
            return {
                ...prevState,
                nodes: nextState.nodes,
                edges: nextState.edges,
                historyIndex: prevState.historyIndex + 1,
                selectedNode: null,
                selectedEdge: null,
                isDirty: true
            };
        });
    }, []);

    // Utility operations
    const clearCanvas = useCallback(() => {
        setState(prevState => {
            const newState = {
                ...prevState,
                nodes: [],
                edges: [],
                selectedNode: null,
                selectedEdge: null,
                isDirty: true
            };
            return addToHistory(newState, prevState);
        });
    }, []);

    const loadDesign = useCallback((designData) => {
        setState(prevState => {
            const newState = {
                ...prevState,
                nodes: designData.nodes || [],
                edges: designData.edges || [],
                selectedNode: null,
                selectedEdge: null,
                isDirty: false
            };
            return addToHistory(newState, prevState);
        });
    }, []);

    const setLoading = useCallback((loading) => {
        setState(prevState => ({
            ...prevState,
            isLoading: loading
        }));
    }, []);

    const setError = useCallback((error) => {
        setState(prevState => ({
            ...prevState,
            error,
            isLoading: false
        }));
    }, []);

    const markClean = useCallback(() => {
        setState(prevState => ({
            ...prevState,
            isDirty: false
        }));
    }, []);

    // Validation
    const validateDesign = useCallback(() => {
        const errors = [];
        const warnings = [];

        // Validate nodes
        state.nodes.forEach(node => {
            switch (node.type) {
                case 'endpoint':
                    if (!node.data?.path) {
                        errors.push(`Endpoint ${node.id} is missing a path`);
                    }
                    if (!node.data?.method) {
                        errors.push(`Endpoint ${node.id} is missing a method`);
                    }
                    break;
                case 'schema':
                    if (!node.data?.name) {
                        errors.push(`Schema ${node.id} is missing a name`);
                    }
                    break;
                case 'parameter':
                    if (!node.data?.name) {
                        errors.push(`Parameter ${node.id} is missing a name`);
                    }
                    break;
                default:
                    break;
            }
        });

        // Check for orphaned nodes
        const connectedNodeIds = new Set();
        state.edges.forEach(edge => {
            connectedNodeIds.add(edge.source);
            connectedNodeIds.add(edge.target);
        });

        state.nodes.forEach(node => {
            if (!connectedNodeIds.has(node.id) && state.nodes.length > 1) {
                warnings.push(`Node ${node.id} is not connected to any other nodes`);
            }
        });

        return { errors, warnings };
    }, [state.nodes, state.edges]);

    return {
        // State
        ...state,

        // Node operations
        addNode,
        updateNode,
        deleteNode,
        selectNode,

        // Edge operations
        addEdge,
        updateEdge,
        deleteEdge,
        selectEdge,

        // Viewport operations
        updateViewport,

        // History operations
        undo,
        redo,
        canUndo: state.historyIndex > 0,
        canRedo: state.historyIndex < state.history.length - 1,

        // Utility operations
        clearCanvas,
        loadDesign,
        setLoading,
        setError,
        markClean,
        validateDesign
    };
};

export default useDesignerState;
