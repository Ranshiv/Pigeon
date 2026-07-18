import React, { useState, useEffect } from 'react';
import { FiGlobe, FiLayers, FiDatabase, FiSettings, FiEye, FiEyeOff, FiInfo, FiPlus } from 'react-icons/fi';
import './UnifiedVariableViewer.css';

const UnifiedVariableViewer = ({
    globalVariables = [],
    collectionVariables = [],
    environmentVariables = [],
    requestVariables = [],
    resolvedVariables = {},
    onEditVariable,
    onAddVariable,
    editableScope,
    showActions = false,
    compact = false,
    defaultScope = 'request',
    openAddSignal,
    openAddScope
}) => {
    const smartDefault = requestVariables.length ? 'request'
        : environmentVariables.length ? 'environment'
        : collectionVariables.length ? 'collection'
        : globalVariables.length ? 'global'
        : defaultScope;
    const [activeScope, setActiveScope] = useState(smartDefault);
    const [showValues, setShowValues] = useState({});
    const [showAddForm, setShowAddForm] = useState(false);
    const [newVariable, setNewVariable] = useState({ key: '', value: '', description: '', type: 'string' });

    useEffect(() => {
        if (!openAddSignal) return;
        setActiveScope(openAddScope || 'request');
        setShowAddForm(true);
    }, [openAddSignal]);

    // Variable precedence levels with metadata
    const variableLevels = [
        {
            id: 'request',
            name: 'Request Variables',
            tab: 'Request',
            icon: FiSettings,
            color: '#22c55e',
            description: 'Variables specific to this request (highest priority)',
            variables: requestVariables,
            priority: 1
        },
        {
            id: 'environment',
            name: 'Environment Variables',
            tab: 'Environment',
            icon: FiLayers,
            color: '#014C75',
            description: 'Variables for the current environment',
            variables: environmentVariables,
            priority: 2
        },
        {
            id: 'collection',
            name: 'Collection Variables',
            tab: 'Collection',
            icon: FiDatabase,
            color: '#f59e0b',
            description: 'Variables shared across all requests in this collection',
            variables: collectionVariables,
            priority: 3
        },
        {
            id: 'global',
            name: 'Global Variables',
            tab: 'Global',
            icon: FiGlobe,
            color: '#014C75',
            description: 'Variables available across all workspaces (lowest priority)',
            variables: globalVariables,
            priority: 4
        }
    ];

    const handleAddVariable = (levelId) => {
        if (!newVariable.key.trim() || !onAddVariable) return;
        onAddVariable({ ...newVariable, key: newVariable.key.trim() }, levelId);
        setNewVariable({ key: '', value: '', description: '', type: 'string' });
        setShowAddForm(false);
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
        const isEditable = !!onAddVariable && (
            editableScope === 'all' ||
            editableScope === level.id ||
            (Array.isArray(editableScope) && editableScope.includes(level.id))
        );

        return (
            <div key={level.id} className={`variable-level ${level.id}`}>
                <div className="level-content">
                    {level.variables.length > 0 ? (
                        <div className="variables-list">
                            {level.variables.map(variable => renderVariableItem(variable, level))}
                            {isEditable && (
                                showAddForm ? (
                                    <div className="inline-add-form inline-add-form-inline">
                                        <div className="inline-form-row">
                                            <input
                                                type="text"
                                                placeholder="Variable name"
                                                value={newVariable.key}
                                                onChange={(e) => setNewVariable({ ...newVariable, key: e.target.value })}
                                                className="inline-form-input"
                                                autoFocus
                                            />
                                            <input
                                                type="text"
                                                placeholder="Value"
                                                value={newVariable.value}
                                                onChange={(e) => setNewVariable({ ...newVariable, value: e.target.value })}
                                                className="inline-form-input"
                                            />
                                        </div>
                                        <div className="inline-form-actions">
                                            <button
                                                className="inline-add-confirm"
                                                onClick={() => handleAddVariable(level.id)}
                                                disabled={!newVariable.key.trim()}
                                            >
                                                <FiPlus size={14} /> Add Variable
                                            </button>
                                            <button
                                                className="inline-add-cancel"
                                                onClick={() => { setShowAddForm(false); setNewVariable({ key: '', value: '', description: '', type: 'string' }); }}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button className="add-variable-row-btn" onClick={() => setShowAddForm(true)}>
                                        <FiPlus size={13} /> Add variable
                                    </button>
                                )
                            )}
                        </div>
                    ) : (
                        <div className="empty-variables-card">
                            <FiInfo className="empty-icon" />
                            <p className="empty-title">No {level.name.toLowerCase()} yet</p>
                            <p className="empty-subtitle">
                                Create reusable values such as API URLs, tokens, and user IDs.
                            </p>
                            {isEditable && !showAddForm && (
                                <button className="empty-add-btn" onClick={() => setShowAddForm(true)}>
                                    <FiPlus size={14} /> Add {level.tab.toLowerCase()} variable
                                </button>
                            )}
                            {isEditable && showAddForm && (
                                <div className="inline-add-form">
                                    <div className="inline-form-row">
                                        <input
                                            type="text"
                                            placeholder="Variable name"
                                            value={newVariable.key}
                                            onChange={(e) => setNewVariable({ ...newVariable, key: e.target.value })}
                                            className="inline-form-input"
                                            autoFocus
                                        />
                                        <input
                                            type="text"
                                            placeholder="Value"
                                            value={newVariable.value}
                                            onChange={(e) => setNewVariable({ ...newVariable, value: e.target.value })}
                                            className="inline-form-input"
                                        />
                                    </div>
                                    <div className="inline-form-actions">
                                        <button
                                            className="inline-add-confirm"
                                            onClick={handleAddVariable}
                                            disabled={!newVariable.key.trim()}
                                        >
                                            <FiPlus size={14} /> Add Variable
                                        </button>
                                        <button
                                            className="inline-add-cancel"
                                            onClick={() => { setShowAddForm(false); setNewVariable({ key: '', value: '', description: '', type: 'string' }); }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const totalVariables = variableLevels.reduce((sum, level) => sum + level.variables.length, 0);
    const totalActive = Object.keys(resolvedVariables).length;

    return (
        <div className={`unified-variable-viewer ${compact ? 'compact' : ''}`}>
            <div className="viewer-header">
                <div className="uvv-header-info">
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

            <div className="variable-scope-tabs">
                {variableLevels.map(level => {
                    const count = level.variables.length;
                    const active = activeScope === level.id;
                    return (
                        <div
                            key={level.id}
                            className={`scope-tab${active ? ' active' : ''}`}
                            onClick={() => setActiveScope(level.id)}
                            role="tab"
                            aria-selected={active}
                        >
                            <level.icon size={13} />
                            <span>{level.tab}</span>
                            <span className="scope-tab-count">{count}</span>
                        </div>
                    );
                })}
            </div>

            <div className="variable-levels">
                {variableLevels
                    .filter(level => level.id === activeScope)
                    .map(renderVariableLevel)}
            </div>
        </div>
    );
};

export default UnifiedVariableViewer;
