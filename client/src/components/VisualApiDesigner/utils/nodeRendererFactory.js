import React from 'react';
import {
    FiGlobe,
    FiFolderPlus,
    FiDatabase,
    FiSettings,
    FiLock,
    FiInfo,
    FiTag,
    FiTrash2,
    FiMoreVertical
} from 'react-icons/fi';

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
            selected: isSelected,
            onSelect: () => onNodeSelect(node.id),
            onUpdate: (updates) => onNodeUpdate(node.id, updates),
            onDelete: () => onNodeDelete(node.id),
            onVisualize: onVisualize ? (data) => onVisualize(node.id, data) : undefined
        };

        // Get component configuration with fallback
        const componentConfig = COMPONENT_TYPES[node.type] || COMPONENT_TYPES.default;
        const IconComponent = componentConfig.icon;

        // Extract node data with proper defaults
        const displayName = node.data?.name || node.name || componentConfig.name;
        const description = node.data?.description || node.description;
        const method = node.data?.method;
        const path = node.data?.path;

        // Enhanced professional node renderer
        return (
            <div
                className={`enhanced-node ${node.type}-node ${isSelected ? 'selected' : ''}`}
                onClick={(e) => {
                    console.log('Node clicked in renderer:', node.id); // Debug log
                    e.stopPropagation();
                    if (nodeProps.onSelect) {
                        nodeProps.onSelect();
                    }
                }}
                style={{
                    '--node-color': componentConfig.color,
                    '--node-bg-color': componentConfig.bgColor,
                    '--node-border-color': componentConfig.borderColor,
                    pointerEvents: 'auto' // Ensure pointer events work
                }}
            >
                {/* Node Header with Icon and Type */}
                <div className="enhanced-node-header">
                    <div className="node-icon-container">
                        <IconComponent size={16} />
                    </div>
                    <div className="node-type-badge">
                        {componentConfig.name}
                    </div>
                    {isSelected && (
                        <button
                            className="node-delete-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                nodeProps.onDelete();
                            }}
                            title="Delete component"
                        >
                            <FiTrash2 size={14} />
                        </button>
                    )}
                </div>

                {/* Node Content */}
                <div className="enhanced-node-content">
                    <div className="node-title">
                        {displayName}
                    </div>

                    {/* Endpoint-specific content */}
                    {node.type === 'endpoint' && method && (
                        <div className="endpoint-details">
                            <span className={`method-badge ${method.toLowerCase()}`}>
                                {method}
                            </span>
                            {path && <span className="endpoint-path">{path}</span>}
                        </div>
                    )}

                    {/* Schema-specific content */}
                    {node.type === 'schema' && (
                        <div className="schema-details">
                            <span className="schema-type">Data Structure</span>
                        </div>
                    )}

                    {/* Description */}
                    {description && (
                        <div className="node-description">
                            {description}
                        </div>
                    )}
                </div>

                {/* Selection Indicator */}
                {isSelected && <div className="selection-indicator" />}

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
};

// Export both as named and default export for flexibility
export { createNodeRenderer };
export default createNodeRenderer;
