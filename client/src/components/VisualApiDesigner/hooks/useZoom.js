import { useState, useCallback } from 'react';
import { ZOOM_CONFIG } from '../constants/designCanvasConstants';

/**
 * Custom hook for managing canvas zoom functionality
 * Follows SRP by only handling zoom-related state and operations
 */
const useZoom = (initialZoom = ZOOM_CONFIG.DEFAULT_ZOOM) => {
    const [zoom, setZoom] = useState(initialZoom);

    const zoomIn = useCallback(() => {
        setZoom(prev => Math.min(prev + ZOOM_CONFIG.ZOOM_STEP, ZOOM_CONFIG.MAX_ZOOM));
    }, []);

    const zoomOut = useCallback(() => {
        setZoom(prev => Math.max(prev - ZOOM_CONFIG.ZOOM_STEP, ZOOM_CONFIG.MIN_ZOOM));
    }, []);

    const fitToScreen = useCallback(() => {
        setZoom(ZOOM_CONFIG.DEFAULT_ZOOM);
        // Additional logic to center content could be added here
    }, []);

    const resetView = useCallback(() => {
        setZoom(ZOOM_CONFIG.DEFAULT_ZOOM);
        // Reset any pan position if implemented
    }, []);

    return {
        zoom,
        zoomIn,
        zoomOut,
        fitToScreen,
        resetView
    };
};

export default useZoom;
