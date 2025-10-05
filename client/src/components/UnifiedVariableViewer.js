import React, { useState } from 'react';
import { FiGlobe, FiLayers, FiDatabase, FiSettings, FiEye, FiEyeOff, FiInfo, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import './UnifiedVariableViewer.css';

const UnifiedVariableViewer = ({
    globalVariables = [],
    collectionVariables = [],
    environmentVariables = [],
    requestVariables = [],
    resolvedVariables = {},
    onEditVariable,
    showActions = false,
    compact = false
}) => {
    const [expandedSections, setExpandedSections] = useState({
        global: true,
        collection: true,
        environment: true,
        request: true
    });
    const [showValues, setShowValues] = useState({});

    // Variable precedence levels with metadata
    const variableLevels = [
        {
            id: 'request',
            name: 'Request Variables',
            icon: FiSettings,
            color: '#22c55e',
            description: 'Variables specific to this request (highest priority)',
            variables: requestVariables,
            priority: 1
        },
        {
            id: 'environment',
            name: 'Environment Variables',
            icon: FiLayers,
            color: '#014C75',
            description: 'Variables for the current environment',
            variables: environmentVariables,
            priority: 2
        },
        {
            id: 'collection',
            name: 'Collection Variables',
            icon: FiDatabase,
            color: '#f59e0b',
            description: 'Variables shared across all requests in this collection',
            variables: collectionVariables,
            priority: 3
        },
        {
            id: 'global',
            name: 'Global Variables',
            icon: FiGlobe,
            color: '#014C75',
            description: 'Variables available across all workspaces (lowest priority)',
            variables: globalVariables,
            priority: 4
        }
    ];

    const toggleSection = (sectionId) => {
        setExpandedSections(prev => ({
            ...prev,
            [sectionId]: !prev[sectionId]
        }));
    };

    const toggleShowValue = (variableKey) => {
        setShowValues(prev => ({
            ...prev,
            [variableKey]: !prev[variableKey]
        }));
    };

    const getVariableSource = (variableName) => {
        // Check which level provides this variable (highest priority wins)
        for (const level of variableLevels) {
            const variable = level.variables.find(v => v.key === variableName);
            if (variable) {
                return level;
            }
        }
        return null;
    };

    const isVariableOverridden = (variableName, currentLevel) => {
        // Check if this variable is overridden by a higher priority level
        for (const level of variableLevels) {
            if (level.priority < currentLevel.priority) {
                const hasVariable = level.variables.find(v => v.key === variableName);
                if (hasVariable) return true;
            }
        }
        return false;
    };

    const renderVariableItem = (variable, level) => {
        const isOverridden = isVariableOverridden(variable.key, level);
        const isResolved = resolvedVariables.hasOwnProperty(variable.key);
        const resolvedValue = resolvedVariables[variable.key];
        const showValue = showValues[variable.key];

        return (
            <div
                key={variable.key}
                className={`variable-item ${isOverridden ? 'overridden' : ''} ${isResolved ? 'active' : ''}`}
            >
                <div className="variable-main">
                    <div className="variable-header">
                        <div className="variable-name-section">
                            <span className="variable-name">{variable.key}</span>
                            {isOverridden && (
                                <span className="override-indicator" title="This variable is overridden by a higher priority level">
                                    ⚠️ Overridden
                                </span>
                            )}
                            {isResolved && !isOverridden && (
                                <span className="active-indicator" title="This variable is currently active">
                                    ✅ Active
                                </span>
                            )}
                        </div>
                        <div className="variable-actions">
                            <button
                                className="show-value-btn"
                                onClick={() => toggleShowValue(variable.key)}
                                title={showValue ? 'Hide value' : 'Show value'}
                            >
                                {showValue ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                            </button>
                            {showActions && onEditVariable && (
                                <button
                                    className="edit-btn"
                                    onClick={() => onEditVariable(variable, level.id)}
                                    title="Edit variable"
                                >
                                    <FiSettings size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="variable-details">
                        <div className="variable-value-section">
                            <span className="value-label">Value:</span>
                            <span className={`variable-value ${showValue ? 'revealed' : 'hidden'}`}>
                                {showValue ? (variable.value || '(empty)') : '••••••••'}
                            </span>
                        </div>

                        {isResolved && resolvedValue !== variable.value && (
                            <div className="resolved-value-section">
                                <span className="resolved-label">Resolved to:</span>
                                <span className="resolved-value">
                                    {showValue ? resolvedValue : '••••••••'}
                                </span>
                            </div>
                        )}

                        {variable.description && (
                            <div className="variable-description">
                                {variable.description}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderVariableLevel = (level) => {
        const isExpanded = expandedSections[level.id];
        const variableCount = level.variables.length;
        const activeCount = level.variables.filter(v =>
            resolvedVariables.hasOwnProperty(v.key) && !isVariableOverridden(v.key, level)
        ).length;

        return (
            <div key={level.id} className={`variable-level ${level.id}`}>
                <div
                    className="level-header"
                    onClick={() => toggleSection(level.id)}
                    style={{ '--level-color': level.color }}
                >
                    <div className="level-info">
                        <level.icon className="level-icon" size={18} />
                        <div className="level-details">
                            <h4 className="level-name">{level.name}</h4>
                            <p className="level-description">{level.description}</p>
                        </div>
                    </div>
                    <div className="level-stats">
                        <span className="variable-count">
                            {variableCount} variable{variableCount !== 1 ? 's' : ''}
                            {activeCount > 0 && (
                                <span className="active-count"> • {activeCount} active</span>
                            )}
                        </span>
                        <div className="priority-indicator">
                            Priority: {level.priority}
                        </div>
                        {isExpanded ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
                    </div>
                </div>

                {isExpanded && (
                    <div className="level-content">
                        {level.variables.length > 0 ? (
                            <div className="variables-list">
                                {level.variables.map(variable => renderVariableItem(variable, level))}
                            </div>
                        ) : (
                            <div className="empty-variables">
                                <FiInfo className="empty-icon" />
                                <span>No {level.name.toLowerCase()} defined</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const totalVariables = variableLevels.reduce((sum, level) => sum + level.variables.length, 0);
    const totalActive = Object.keys(resolvedVariables).length;

    return (
        <div className={`unified-variable-viewer ${compact ? 'compact' : ''}`}>
            <div className="viewer-header">
                <div className="header-info">
                    <h3>Variable Overview</h3>
                    <p className="header-description">
                        Variables are resolved in priority order. Higher priority levels override lower ones.
                    </p>
                </div>
                <div className="header-stats">
                    <div className="stat-item">
                        <span className="stat-value">{totalVariables}</span>
                        <span className="stat-label">Total</span>
                    </div>
                    <div className="stat-item active">
                        <span className="stat-value">{totalActive}</span>
                        <span className="stat-label">Active</span>
                    </div>
                </div>
            </div>

            <div className="precedence-indicator">
                <div className="precedence-flow">
                    {variableLevels.map((level, index) => (
                        <React.Fragment key={level.id}>
                            <div className="precedence-step" style={{ '--level-color': level.color }}>
                                <level.icon size={14} />
                                <span>{level.name.split(' ')[0]}</span>
                            </div>
                            {index < variableLevels.length - 1 && (
                                <div className="precedence-arrow">→</div>
                            )}
                        </React.Fragment>
                    ))}
                </div>
                <div className="precedence-note">
                    <FiInfo size={12} />
                    Variables on the left override variables on the right
                </div>
            </div>

            <div className="variable-levels">
                {variableLevels.map(renderVariableLevel)}
            </div>
        </div>
    );
};

export default UnifiedVariableViewer;
