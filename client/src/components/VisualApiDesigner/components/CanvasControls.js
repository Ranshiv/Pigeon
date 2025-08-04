import React from 'react';
import {
    FiZoomIn,
    FiZoomOut,
    FiMaximize,
    FiRefreshCw
} from 'react-icons/fi';
import { ZOOM_CONFIG } from '../constants/designCanvasConstants';

/**
 * CanvasControls component handles zoom and canvas manipulation controls
 * Follows SRP by only managing canvas view controls
 */
const CanvasControls = ({
    zoom,
    onZoomIn,
    onZoomOut,
    onFitToScreen,
    onResetView
}) => {
    const isZoomInDisabled = zoom >= ZOOM_CONFIG.MAX_ZOOM;
    const isZoomOutDisabled = zoom <= ZOOM_CONFIG.MIN_ZOOM;

    return (
        <div className="canvas-controls">
            <div className="zoom-controls">
                <button
                    className="zoom-btn"
                    onClick={onZoomOut}
                    disabled={isZoomOutDisabled}
                    title="Zoom out"
                    aria-label="Zoom out"
                >
                    <FiZoomOut />
                </button>
                <span className="zoom-level">{zoom}%</span>
                <button
                    className="zoom-btn"
                    onClick={onZoomIn}
                    disabled={isZoomInDisabled}
                    title="Zoom in"
                    aria-label="Zoom in"
                >
                    <FiZoomIn />
                </button>
            </div>

            <div className="canvas-actions">
                <button
                    className="canvas-btn"
                    onClick={onFitToScreen}
                    title="Fit to screen"
                >
                    <FiMaximize />
                    Fit to Screen
                </button>
                <button
                    className="canvas-btn"
                    onClick={onResetView}
                    title="Reset view"
                >
                    <FiRefreshCw />
                    Reset View
                </button>
            </div>
        </div>
    );
};

export default CanvasControls;
