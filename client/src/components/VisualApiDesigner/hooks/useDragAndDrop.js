import { useState, useCallback, useRef, useEffect } from 'react';
import { DND_CONFIG } from '../constants/designCanvasConstants';
import {
    snapToGrid,
    shouldSnapToGrid,
    validateDropPosition,
    findAvailablePosition,
    throttle
} from '../utils/dragDropUtils';

/**
 * Returns default data structure for each node type
 * This ensures nodes have the proper structure for spec generation
 */
const getDefaultNodeData = (nodeType) => {
    switch (nodeType) {
        case 'endpoint':
            return {
                path: '/api/resource',
                method: 'GET',
                summary: 'New API Endpoint',
                description: 'Describe what this endpoint does',
                tags: [],
                deprecated: false,
                operationId: '',
                parameters: [],
                responses: {
                    '200': {
                        description: 'Successful response',
                        content: {
                            'application/json': {
                                schema: { type: 'object' }
                            }
                        }
                    }
                }
            };

        case 'schema':
            return {
                name: 'NewSchema',
                type: 'object',
                description: 'Define data structure',
                required: [],
                properties: {
                    id: { type: 'string', description: 'Unique identifier' },
                    name: { type: 'string', description: 'Name field' }
                },
                example: {
                    id: 'example-id',
                    name: 'Example Name'
                }
            };

        case 'parameter':
            return {
                name: 'newParameter',
                in: 'query',
                type: 'string',
                required: false,
                description: 'Parameter description',
                schema: { type: 'string' },
                example: 'example-value'
            };

        case 'security':
            return {
                name: 'bearerAuth',
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'Bearer token authentication'
            };

        case 'info':
            return {
                title: 'API Title',
                version: '1.0.0',
                description: 'API description',
                contact: {
                    name: 'API Support',
                    email: 'support@example.com'
                },
                license: {
                    name: 'MIT',
                    url: 'https://opensource.org/licenses/MIT'
                }
            };

        case 'resource':
            return {
                name: 'Resource Group',
                description: 'Group of related endpoints',
                tags: []
            };

        default:
            return {};
    }
};

/**
 * Enhanced Custom hook for managing drag and drop functionality
 * Follows SRP by only handling drag and drop state and operations
 * Added: snap-to-grid, collision detection, performance optimization
 */
const useDragAndDrop = (onNodeAdd, existingNodes = []) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const [dragOverPosition, setDragOverPosition] = useState(null);
    const [showGrid, setShowGrid] = useState(false);
    const throttledPositionUpdate = useRef(null);

    // Initialize throttled position update
    useEffect(() => {
        throttledPositionUpdate.current = throttle((position) => {
            setDragOverPosition(position);
        });
    }, []);

    const handleDrop = useCallback((event, canvasRef) => {
        event.preventDefault();
        setIsDragOver(false);
        setDragOverPosition(null);
        setShowGrid(false);

        try {
            const data = event.dataTransfer.getData(DND_CONFIG.DATA_TRANSFER_TYPE);
            if (data && canvasRef.current) {
                const componentData = JSON.parse(data);
                const rect = canvasRef.current.getBoundingClientRect();
                let position = {
                    x: event.clientX - rect.left,
                    y: event.clientY - rect.top
                };

                // Apply snap-to-grid if close enough
                if (shouldSnapToGrid(position)) {
                    position = snapToGrid(position);
                }

                // Validate position is within canvas bounds
                position = validateDropPosition(position, rect);

                // Find available position if collision detected
                position = findAvailablePosition(position, existingNodes);

                // Create node with enhanced position data and proper default data structure
                const defaultData = getDefaultNodeData(componentData.type);
                const newNode = {
                    type: componentData.type,
                    position: position,
                    data: {
                        ...defaultData,
                        name: componentData.name || componentData.type,
                        description: componentData.description || ''
                    },
                    metadata: {
                        createdAt: Date.now(),
                        snapToGrid: shouldSnapToGrid(position),
                        originalPosition: {
                            x: event.clientX - rect.left,
                            y: event.clientY - rect.top
                        }
                    }
                };

                // Console log removed to reduce noise

                // Wrap node creation in a setTimeout to prevent React render cascades
                if (onNodeAdd) {
                    // Use setTimeout with 0 delay to defer state updates to next event loop
                    setTimeout(() => {
                        onNodeAdd(newNode);
                    }, 0);
                }
            }
        } catch (error) {
            // Error handling silenced to prevent console noise
            // Could implement a more graceful user notification here
        }
    }, [onNodeAdd, existingNodes]);

    const handleDragOver = useCallback((event, canvasRef) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';

        if (!isDragOver) {
            setIsDragOver(true);
            setShowGrid(true);
        }

        if (canvasRef.current && throttledPositionUpdate.current) {
            const rect = canvasRef.current.getBoundingClientRect();
            const position = {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top
            };

            // Update position using throttled function for performance
            throttledPositionUpdate.current(position);
        }
    }, [isDragOver]);

    const handleDragLeave = useCallback((event, canvasRef) => {
        if (canvasRef.current && !canvasRef.current.contains(event.relatedTarget)) {
            setIsDragOver(false);
            setDragOverPosition(null);
            setShowGrid(false);
        }
    }, []);

    // Enhanced return with additional state for better visual feedback
    return {
        isDragOver,
        dragOverPosition,
        showGrid,
        handleDrop,
        handleDragOver,
        handleDragLeave
    };
};

export default useDragAndDrop;
