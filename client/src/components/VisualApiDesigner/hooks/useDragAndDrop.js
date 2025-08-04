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

                // Create node with enhanced position data
                const newNode = {
                    type: componentData.type,
                    position: position,
                    data: {
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

                console.log('useDragAndDrop: Creating node from drop:', newNode);

                if (onNodeAdd) {
                    onNodeAdd(newNode);
                }
            }
        } catch (error) {
            console.error('Error handling drop:', error);
            // Could show user notification here
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
