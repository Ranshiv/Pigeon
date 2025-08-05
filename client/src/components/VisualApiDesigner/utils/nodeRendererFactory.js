import React from 'react';
import EndpointNode from '../components/EndpointNode';
import SchemaNode from '../components/SchemaNode';
import ResourceNode from '../components/ResourceNode';
import {
    FiGlobe,
    FiFolderPlus,
    FiDatabase,
    FiSettings,
    FiLock,
    FiInfo,
    FiTag,
    FiMoreVertical
} from 'react-icons/fi';
import '../components/CommonNodes.css';

/**
 * Factory function to create enhanced node renderers with professional UI
 * Enhanced for Screenshot 2 style with proper visual hierarchy and Clean Code principles
 * Follows Single Responsibility Principle - only handles node rendering logic
 */

// Component type configurations following Open/Closed Principle
const COMPONENT_TYPES = {
    endpoint: {
        icon: FiGlobe,
        color: '#10B981', // emerald-500
        bgColor: '#ECFDF5', // emerald-50
        borderColor: '#6EE7B7', // emerald-300
        name: 'API Endpoint'
    },
    resource: {
        icon: FiFolderPlus,
        color: '#3B82F6', // blue-500
        bgColor: '#EFF6FF', // blue-50
        borderColor: '#93C5FD', // blue-300
        name: 'Resource'
    },
    schema: {
        icon: FiDatabase,
        color: '#8B5CF6', // violet-500
        bgColor: '#F5F3FF', // violet-50
        borderColor: '#C4B5FD', // violet-300
        name: 'Schema'
    },
    parameter: {
        icon: FiSettings,
        color: '#F59E0B', // amber-500
        bgColor: '#FFFBEB', // amber-50
        borderColor: '#FCD34D', // amber-300
        name: 'Parameter'
    },
    security: {
        icon: FiLock,
        color: '#EF4444', // red-500
        bgColor: '#FEF2F2', // red-50
        borderColor: '#FCA5A5', // red-300
        name: 'Security'
    },
    info: {
        icon: FiInfo,
        color: '#06B6D4', // cyan-500
        bgColor: '#ECFEFF', // cyan-50
        borderColor: '#67E8F9', // cyan-300
        name: 'API Info'
    },
    tag: {
        icon: FiTag,
        color: '#84CC16', // lime-500
        bgColor: '#F7FEE7', // lime-50
        borderColor: '#BEF264', // lime-300
        name: 'Tag'
    },
    default: {
        icon: FiMoreVertical,
        color: '#6B7280', // gray-500
        bgColor: '#F9FAFB', // gray-50
        borderColor: '#D1D5DB', // gray-300
        name: 'Component'
    }
};

const createNodeRenderer = (selectedNode, onNodeSelect, onNodeUpdate, onNodeDelete, onVisualize) => {
    // Validate required parameters
    if (!onNodeSelect || !onNodeUpdate || !onNodeDelete) {
        console.warn('createNodeRenderer: Missing required callback functions');
    }

    return (node) => {
        const isSelected = selectedNode?.id === node.id;
        const nodeProps = {
            id: node.id,
            data: node.data || {},
            selected: isSelected,
            onSelect: () => onNodeSelect(node.id),
            onUpdate: (updates) => onNodeUpdate(node.id, updates),
            onDelete: () => onNodeDelete(node.id),
            onVisualize: onVisualize ? (data) => onVisualize(node.id, data) : undefined
        };

        // Render specific node types with modern components
        switch (node.type) {
            case 'endpoint':
                return <EndpointNode {...nodeProps} />;
            case 'schema':
                return <SchemaNode {...nodeProps} />;
            case 'resource':
                return <ResourceNode {...nodeProps} />;
            default:
                // Fallback to legacy renderer for other types
                return renderLegacyNode(node, nodeProps);
        }
    };
};

// Legacy renderer for backwards compatibility
const renderLegacyNode = (node, nodeProps) => {
    const componentConfig = COMPONENT_TYPES[node.type] || COMPONENT_TYPES.default;
    const IconComponent = componentConfig.icon;
    const isSelected = nodeProps.selected;

    // Extract node data with proper defaults
    const displayName = node.data?.name || node.name || componentConfig.name;
    const description = node.data?.description || node.description || `Define REST API endpoint`;
    const method = node.data?.method;
    const path = node.data?.path;


    // Get status badge text based on node type
    const getStatusText = () => {
        switch (node.type) {
            case 'info': return 'API';
            case 'security': return 'AUTH';
            case 'tag': return 'TAG';
            case 'parameter': return 'PARAM';
            default: return 'ACTIVE';
        }
    };

    // Enhanced professional node renderer with dark theme (Screenshot 2 style)
    return (
        <div
            className={`endpoint-node-modern ${node.type}-node ${isSelected ? 'selected' : ''}`}
            onClick={(e) => {
                e.stopPropagation();
                if (nodeProps.onSelect) {
                    nodeProps.onSelect();
                }
            }}
        >
            {/* Node Card Structure */}
            <div className="node-card-outer">
                <div className="node-card-header">
                    <div className="node-card-icon">
                        <div className="icon-bg">
                            <IconComponent size={16} />
                        </div>
                    </div>
                    <div className="node-card-type-badge">
                        {componentConfig.name}
                    </div>
                    <div className="node-card-status">
                        {getStatusText()}
                    </div>
                </div>

                <div className="node-card-content">
                    <div className="node-card-title">
                        {displayName}
                    </div>

                    <div className="node-card-desc">
                        {description}
                    </div>

                    {/* Method & Path (only for endpoint type) */}
                    {node.type === 'endpoint' && method && (
                        <div className="endpoint-details">
                            <span className={`method-badge ${method.toLowerCase()}`}>
                                {method}
                            </span>
                            {path && <span className="endpoint-path">{path}</span>}
                        </div>
                    )}
                </div>
            </div>

            {/* Selection Outline */}
            {isSelected && <div className="selection-outline"></div>}

            {/* Status Indicators */}
            <div className="node-status">
                {node.data?.deprecated && (
                    <span className="status-badge deprecated">Deprecated</span>
                )}
                {node.metadata?.snapToGrid && (
                    <span className="status-badge snapped">Snapped</span>
                )}
            </div>
        </div>
    );
};

// Export both as named and default export for flexibility
export { createNodeRenderer };
export default createNodeRenderer;
