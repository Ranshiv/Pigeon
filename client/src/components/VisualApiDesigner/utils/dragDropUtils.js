/**
 * Drag and Drop Utilities
 * Follows Clean Code principles by extracting common drag/drop operations
 * into reusable, single-responsibility functions
 */

import { DND_CONFIG } from '../constants/designCanvasConstants';

/**
 * Creates a custom drag image for better visual feedback
 * Follows SRP - only handles drag image creation
 */
export const createDragImage = (component) => {
    const dragImage = document.createElement('div');
    dragImage.className = 'drag-preview';
    dragImage.innerHTML = `
        <div class="drag-preview-content">
            <div class="drag-preview-header">
                <span class="drag-preview-type">${component.type}</span>
            </div>
            <div class="drag-preview-title">${component.name}</div>
        </div>
    `;

    // Style the drag image
    Object.assign(dragImage.style, {
        position: 'absolute',
        top: '-1000px',
        left: '-1000px',
        padding: '8px 12px',
        backgroundColor: 'var(--color-primary)',
        color: 'white',
        borderRadius: '6px',
        fontSize: '14px',
        fontWeight: '500',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        zIndex: '9999',
        pointerEvents: 'none'
    });

    document.body.appendChild(dragImage);
    return dragImage;
};

/**
 * Snaps position to grid for consistent alignment
 * Follows SRP - only handles position snapping
 */
export const snapToGrid = (position, gridSize = DND_CONFIG.GRID_SIZE) => {
    return {
        x: Math.round(position.x / gridSize) * gridSize,
        y: Math.round(position.y / gridSize) * gridSize
    };
};

/**
 * Checks if position should snap to grid based on threshold
 */
export const shouldSnapToGrid = (position, gridSize = DND_CONFIG.GRID_SIZE, threshold = DND_CONFIG.SNAP_THRESHOLD) => {
    const snappedPos = snapToGrid(position, gridSize);
    const distance = Math.sqrt(
        Math.pow(position.x - snappedPos.x, 2) +
        Math.pow(position.y - snappedPos.y, 2)
    );
    return distance <= threshold;
};

/**
 * Validates drop position to ensure it's within canvas bounds
 * Follows SRP - only handles position validation
 */
export const validateDropPosition = (position, canvasBounds, nodeDimensions = { width: 200, height: 100 }) => {
    const margin = 20;
    return {
        x: Math.max(margin, Math.min(position.x, canvasBounds.width - nodeDimensions.width - margin)),
        y: Math.max(margin, Math.min(position.y, canvasBounds.height - nodeDimensions.height - margin))
    };
};

/**
 * Checks for collisions with existing nodes
 * Returns true if position would collide with existing nodes
 */
export const checkCollision = (position, existingNodes, nodeDimensions = { width: 200, height: 100 }) => {
    const newNodeBounds = {
        left: position.x - nodeDimensions.width / 2,
        right: position.x + nodeDimensions.width / 2,
        top: position.y - nodeDimensions.height / 2,
        bottom: position.y + nodeDimensions.height / 2
    };

    return existingNodes.some(node => {
        if (!node.position) return false;

        const existingBounds = {
            left: node.position.x - nodeDimensions.width / 2,
            right: node.position.x + nodeDimensions.width / 2,
            top: node.position.y - nodeDimensions.height / 2,
            bottom: node.position.y + nodeDimensions.height / 2
        };

        return !(newNodeBounds.right < existingBounds.left ||
            newNodeBounds.left > existingBounds.right ||
            newNodeBounds.bottom < existingBounds.top ||
            newNodeBounds.top > existingBounds.bottom);
    });
};

/**
 * Finds next available position if collision detected
 */
export const findAvailablePosition = (preferredPosition, existingNodes, gridSize = DND_CONFIG.GRID_SIZE) => {
    let position = { ...preferredPosition };
    const maxAttempts = 50;
    let attempts = 0;

    while (checkCollision(position, existingNodes) && attempts < maxAttempts) {
        // Try positions in spiral pattern
        const radius = Math.ceil(attempts / 8) * gridSize;
        const angle = (attempts % 8) * (Math.PI / 4);

        position = {
            x: preferredPosition.x + radius * Math.cos(angle),
            y: preferredPosition.y + radius * Math.sin(angle)
        };

        position = snapToGrid(position, gridSize);
        attempts++;
    }

    return position;
};

/**
 * Throttles function calls for performance optimization
 * Follows SRP - only handles function throttling
 */
export const throttle = (func, delay = DND_CONFIG.THROTTLE_DELAY) => {
    let timeoutId;
    let lastExecTime = 0;

    return function (...args) {
        const currentTime = Date.now();

        if (currentTime - lastExecTime > delay) {
            func.apply(this, args);
            lastExecTime = currentTime;
        } else {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(this, args);
                lastExecTime = Date.now();
            }, delay - (currentTime - lastExecTime));
        }
    };
};

/**
 * Cleans up drag operation resources
 */
export const cleanupDragOperation = () => {
    // Remove any temporary drag images
    const dragPreviews = document.querySelectorAll('.drag-preview');
    dragPreviews.forEach(preview => preview.remove());

    // Reset cursor
    document.body.style.cursor = '';
};
