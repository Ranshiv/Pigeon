import React from 'react';
import {
    FiZoomIn,
    FiZoomOut,
    FiMaximize,
    FiRefreshCw,
    FiGrid,
    FiDownload,
    FiEye
} from 'react-icons/fi';
import { ZOOM_CONFIG } from '../constants/designCanvasConstants';
import './CanvasControls.css';

/**
 * CanvasControls component handles zoom and canvas manipulation controls
 * Enhanced modern UI with improved user experience
 * Follows SRP by only managing canvas view controls
 */
const CanvasControls = ({
    zoom,
    onZoomIn,
    onZoomOut,
    onFitToScreen,
    onResetView,
    onToggleGrid,
    onExport,
    onPreview,
    showGrid = false,
    className = ''
}) => {
    const isZoomInDisabled = zoom >= ZOOM_CONFIG.MAX_ZOOM;
    const isZoomOutDisabled = zoom <= ZOOM_CONFIG.MIN_ZOOM;

    // Define keyboard shortcuts for tooltips
    const zoomInShortcut = "Ctrl+Plus";
    const zoomOutShortcut = "Ctrl+Minus";
    const fitScreenShortcut = "Ctrl+0";

    return (
        <div className={`canvas-controls ${className}`}>
            <div className="controls-group">
                <button
                    className={`control-btn ${isZoomOutDisabled ? 'disabled' : ''}`}
                    onClick={onZoomOut}
                    disabled={isZoomOutDisabled}
                    title={`Zoom Out (${zoomOutShortcut})`}
                    aria-label="Zoom Out"
                >
                    <FiZoomOut className="icon" />
                </button>

                <div className="zoom-indicator" title={`Current zoom: ${zoom}%`}>
                    <span className="zoom-value">{zoom}%</span>
                </div>

                <button
                    className={`control-btn ${isZoomInDisabled ? 'disabled' : ''}`}
                    onClick={onZoomIn}
                    disabled={isZoomInDisabled}
                    title={`Zoom In (${zoomInShortcut})`}
                    aria-label="Zoom In"
                >
                    <FiZoomIn className="icon" />
                </button>
            </div>

            <div className="controls-divider"></div>

            <div className="controls-group">
                <button
                    className="control-btn"
                    onClick={onFitToScreen}
                    title={`Fit to Screen (${fitScreenShortcut})`}
                    aria-label="Fit to Screen"
                >
                    <FiMaximize className="icon" />
                </button>

                <button
                    className="control-btn"
                    onClick={onResetView}
                    title="Reset View"
                    aria-label="Reset View"
                >
                    <FiRefreshCw className="icon" />
                </button>

                {onToggleGrid && (
                    <button
                        className={`control-btn ${showGrid ? 'active' : ''}`}
                        onClick={onToggleGrid}
                        title={showGrid ? "Hide Grid" : "Show Grid"}
                        aria-label={showGrid ? "Hide Grid" : "Show Grid"}
                        aria-pressed={showGrid}
                    >
                        <FiGrid className="icon" />
                    </button>
                )}
            </div>

            {(onExport || onPreview) && (
                <>
                    <div className="controls-divider"></div>
                    <div className="controls-group">
                        {onExport && (
                            <button
                                className="control-btn"
                                onClick={onExport}
                                title="Export"
                                aria-label="Export"
                            >
                                <FiDownload className="icon" />
                            </button>
                        )}

                        {onPreview && (
                            <button
                                className="control-btn"
                                onClick={onPreview}
                                title="Preview"
                                aria-label="Preview"
                            >
                                <FiEye className="icon" />
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default CanvasControls;
