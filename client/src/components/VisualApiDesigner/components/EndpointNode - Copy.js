import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FiGlobe, FiChevronRight, FiCode } from 'react-icons/fi';
import './EndpointNode.css';

/**
 * EndpointNode component - Enhanced with modern UI
 * Follows Clean Code principles with proper component structure
 * and enhanced visualizations
 */
const EndpointNode = ({
    id,
    data,
    selected,
    onSelect,
    onUpdate,
    onDelete,
    onVisualize
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
    };

    const {
        path,
        summary,
        description,
        method = 'get',
        deprecated = false,
        parameters = [],
        responses = {}
    } = data || {};

    // Format HTTP method for display
    const httpMethod = method ? method.toUpperCase() : 'GET';

    // Get method color class
    const getMethodClass = () => {
        switch (httpMethod.toLowerCase()) {
            case 'get': return 'get';
            case 'post': return 'post';
            case 'put': return 'put';
            case 'delete': return 'delete';
            case 'patch': return 'patch';
            default: return '';
        }
    };

    // Get status badges to display
    const getStatusBadges = () => {
        const badges = [];

        if (deprecated) {
            badges.push(<span key="deprecated" className="status-badge deprecated">Deprecated</span>);
        }

        if (parameters && parameters.length > 0) {
            badges.push(<span key="params" className="status-badge">{parameters.length} Params</span>);
        }

        if (responses && Object.keys(responses).length > 0) {
            const successResponse = Object.keys(responses).find(code => code.startsWith('2'));
            if (successResponse) {
                badges.push(<span key="success" className="status-badge active">{successResponse}</span>);
            }
        }

        return badges;
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

    const handleVisualize = (e) => {
        e.stopPropagation();
        if (onVisualize) {
            onVisualize(data);
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`endpoint-node-modern ${selected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
        >
            <div className="node-card-outer">
                <div className="node-card-header">
                    <div className="node-card-icon">
                        <div className="icon-bg">
                            <FiGlobe size={16} />
                        </div>
                    </div>
                    <span className="node-card-type-badge">HTTP Endpoint</span>
                    {data?.status && (
                        <span className="node-card-status">{data.status}</span>
                    )}
                </div>

                <div className="node-card-content">
                    <div className="node-card-title">
                        {summary || "REST API Endpoint"}
                    </div>

                    <div className="node-card-desc">
                        {description || "Define your API endpoint here"}
                    </div>

                    <div className="endpoint-details">
                        <span className={`http-method ${getMethodClass()}`}>
                            {httpMethod}
                        </span>
                        {path && <span className="endpoint-path">{path}</span>}
                    </div>

                    {(deprecated || parameters?.length > 0 || Object.keys(responses || {}).length > 0) && (
                        <div className="endpoint-status">
                            {getStatusBadges()}
                        </div>
                    )}
                </div>

                {/* Expandable section for parameters */}
                {parameters?.length > 0 && (
                    <div className="node-card-children">
                        <div className="node-body">
                            <div className="parameters-list">
                                {parameters.slice(0, 3).map((param, index) => (
                                    <div key={index} className="parameter-item">
                                        <span className="parameter-name">{param.name}</span>
                                        {param.required && <span className="parameter-required">*</span>}
                                        <span className="parameter-type">{param.schema?.type || 'string'}</span>
                                    </div>
                                ))}
                                {parameters.length > 3 && (
                                    <div className="parameter-more">
                                        <FiChevronRight size={12} /> {parameters.length - 3} more parameters
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Actions footer */}
                {onVisualize && (
                    <div className="node-card-footer">
                        <button
                            className="node-action-btn"
                            onClick={handleVisualize}
                            title="Visualize endpoint"
                        >
                            <FiCode size={14} />
                            <span>Visualize</span>
                        </button>
                    </div>
                )}
            </div>

            {selected && (
                <div className="selection-outline"></div>
            )}
        </div>
    );
};

export default EndpointNode;
