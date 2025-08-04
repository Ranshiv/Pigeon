import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ApiResponseMockService } from '../services/ApiResponseMockService';
import './ModernNodeStyles.css';

const EndpointNode = ({
    id,
    data,
    selected,
    onSelect,
    onUpdate,
    onDelete,
    onApiTest, // New prop for handling API test results
    onVisualize // New prop for visualizing API responses
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id });

    const [isTestingApi, setIsTestingApi] = useState(false);
    const [lastTestResult, setLastTestResult] = useState(null);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? 'none' : transition,
        opacity: isDragging ? 0.8 : 1,
        zIndex: isDragging ? 1000 : 1,
    };

    const { path, method, summary, deprecated } = data || {};

    const getMethodColor = (method) => {
        const colors = {
            'GET': '#4CAF50',
            'POST': '#2196F3',
            'PUT': '#FF9800',
            'DELETE': '#F44336',
            'PATCH': '#9C27B0',
            'HEAD': '#607D8B',
            'OPTIONS': '#795548'
        };
        return colors[method?.toUpperCase()] || '#666666';
    };

    const handleClick = (e) => {
        e.stopPropagation();
        if (onSelect) {
            onSelect();
        }
    };

    const handleDoubleClick = (e) => {
        e.stopPropagation();
        // Enable inline editing or open properties panel
    };

    const handleTestApi = async (e) => {
        e.stopPropagation();

        if (!data) return;

        setIsTestingApi(true);

        try {
            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

            // Generate mock response
            const mockResponse = ApiResponseMockService.generateMockResponse(data);

            // Store the response
            ApiResponseMockService.storeResponse(id, mockResponse);
            setLastTestResult(mockResponse);

            // Notify parent component
            if (onApiTest) {
                onApiTest(id, mockResponse);
            }

        } catch (error) {
            const errorResponse = {
                status: 500,
                statusText: 'Internal Server Error',
                data: { error: 'Failed to test API endpoint' },
                responseTime: 0,
                size: 0,
                timestamp: new Date().toISOString()
            };

            setLastTestResult(errorResponse);

            if (onApiTest) {
                onApiTest(id, errorResponse);
            }
        } finally {
            setIsTestingApi(false);
        }
    };

    const getStatusColor = (status) => {
        if (status >= 200 && status < 300) return '#28a745';
        if (status >= 300 && status < 400) return '#ffc107';
        if (status >= 400) return '#dc3545';
        return '#6c757d';
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`modern-endpoint-node ${selected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
        >
            <div className="node-card">
                <div className="node-header">
                    <div className="node-icon-wrapper">
                        <div
                            className="method-badge"
                            style={{ backgroundColor: getMethodColor(method) }}
                        >
                            {method || 'GET'}
                        </div>
                    </div>
                    <div className="node-info">
                        <div className="node-title">
                            <h4 className="endpoint-path">{path || '/endpoint'}</h4>
                            <div className="endpoint-meta">
                                {deprecated && <span className="deprecated-badge">DEPRECATED</span>}
                                {summary && <span className="endpoint-summary">{summary}</span>}
                            </div>
                        </div>
                    </div>
                    <div className="node-controls">
                        {/* Test API Button */}
                        <button
                            className={`test-api-btn ${isTestingApi ? 'testing' : ''}`}
                            onClick={handleTestApi}
                            disabled={isTestingApi}
                            title="Test API endpoint"
                        >
                            {isTestingApi ? (
                                <svg className="spin" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                                    <path d="M6 1a5 5 0 0 1 5 5h-1a4 4 0 0 0-4-4V1z"/>
                                </svg>
                            ) : (
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                                    <path d="M3 2l6 4-6 4V2z"/>
                                </svg>
                            )}
                        </button>

                        {lastTestResult && (
                            <button
                                className="visualize-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (onVisualize) {
                                        onVisualize(id, lastTestResult);
                                    }
                                }}
                                title="Visualize response data"
                            >
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                                    <path d="M1 8h2l1-3 2 6 2-4 1 2h2"/>
                                </svg>
                            </button>
                        )}

                        {onDelete && (
                            <button
                                className="delete-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete();
                                }}
                                title="Delete endpoint"
                            >
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                                    <path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                {/* API Test Result Indicator */}
                {lastTestResult && (
                    <div className="api-test-result">
                        <div
                            className="status-indicator"
                            style={{ backgroundColor: getStatusColor(lastTestResult.status) }}
                        >
                            {lastTestResult.status}
                        </div>
                        <div className="result-details">
                            <span className="response-time">{lastTestResult.responseTime}ms</span>
                            <span className="response-size">{Math.round(lastTestResult.size / 1024)}KB</span>
                        </div>
                    </div>
                )}

                <div className="node-footer">
                    <div className="node-meta">
                        <span className="endpoint-type">API Endpoint</span>
                        {lastTestResult && (
                            <span className="last-tested">
                                Tested {new Date(lastTestResult.timestamp).toLocaleTimeString()}
                            </span>
                        )}
                    </div>
                </div>

                <div className="node-handles">
                    <div className="handle handle-input" title="Connect input">
                        <div className="handle-dot"></div>
                    </div>
                    <div className="handle handle-output" title="Connect output">
                        <div className="handle-dot"></div>
                    </div>
                </div>

                {selected && (
                    <div className="selection-indicator"></div>
                )}
            </div>
        </div>
    );
};

export default EndpointNode;
