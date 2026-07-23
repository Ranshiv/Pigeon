import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiSave, FiX, FiEye, FiEyeOff } from 'react-icons/fi';
import './VariableEditor.css';

const VariableEditor = ({
    variables = [],
    onVariablesChange,
    scope = 'environment', // 'global', 'collection', 'environment', 'request'
    editable = true,
    title,
    environmentId,
    collectionId,
    workspaceId,
    hideHeader = false,
    inlineAddForm = false
}) => {
    const [localVariables, setLocalVariables] = useState(variables);
    const [editingVariable, setEditingVariable] = useState(null);
    const [showValues, setShowValues] = useState({});
    const [newVariable, setNewVariable] = useState({ key: '', value: '', description: '', type: 'string' });
    const [showAddForm, setShowAddForm] = useState(false);

    useEffect(() => {
        setLocalVariables(variables);
    }, [variables]);

    const handleAddVariable = () => {
        if (!newVariable.key.trim()) return;

        const variable = {
            id: Date.now().toString(),
            key: newVariable.key.trim(),
            value: newVariable.value,
            description: newVariable.description,
            type: newVariable.type
        };

        const updatedVariables = [...localVariables, variable];
        setLocalVariables(updatedVariables);
        setNewVariable({ key: '', value: '', description: '', type: 'string' });
        setShowAddForm(false);

        if (onVariablesChange) {
            onVariablesChange(updatedVariables);
        }
    };

    const handleEditVariable = (variable) => {
        setEditingVariable({ ...variable });
    };

    const handleSaveEdit = () => {
        const updatedVariables = localVariables.map(v =>
            v.id === editingVariable.id || v.key === editingVariable.key ? editingVariable : v
        );
        setLocalVariables(updatedVariables);
        setEditingVariable(null);

        if (onVariablesChange) {
            onVariablesChange(updatedVariables);
        }
    };

    const handleDeleteVariable = (variableId, variableKey) => {
        const updatedVariables = localVariables.filter(v =>
            v.id !== variableId && v.key !== variableKey
        );
        setLocalVariables(updatedVariables);

        if (onVariablesChange) {
            onVariablesChange(updatedVariables);
        }
    };

    const toggleShowValue = (variableKey) => {
        setShowValues(prev => ({
            ...prev,
            [variableKey]: !prev[variableKey]
        }));
    };

    const getScopeColor = (scope) => {
        switch (scope) {
            case 'global': return '#9c27b0';
            case 'collection': return '#014C75';
            case 'environment': return '#4caf50';
            case 'request': return '#ff9800';
            default: return '#666';
        }
    };

    const getScopeLabel = (scope) => {
        switch (scope) {
            case 'global': return 'Global';
            case 'collection': return 'Collection';
            case 'environment': return 'Environment';
            case 'request': return 'Request';
            default: return 'Variables';
        }
    };

    return (
        <div className={`variable-editor${editingVariable ? ' variable-editor--editing' : ''}`}>
            {!hideHeader && (
            <div className="variable-editor-header">
                <div className="scope-indicator">
                    <span
                        className="scope-badge"
                        style={{ backgroundColor: getScopeColor(scope) }}
                    >
                        {getScopeLabel(scope)}
                    </span>
                    <h3>{title || `${getScopeLabel(scope)} Variables`}</h3>
                </div>

                {/* Removed Save button logic */}
            </div>
            )}

            <div className="variables-list">
                {localVariables.length === 0 ? (
                    editable && showAddForm && inlineAddForm ? (
                        <div className="add-variable-form" style={{ marginTop: 24 }}>
                            <div className="form-section">
                                <div className="form-row">
                                    <div className="input-group">
                                        <label htmlFor="new-key" className="input-label">Variable Name</label>
                                        <input
                                            id="new-key"
                                            type="text"
                                            placeholder="e.g., api_url, token, port"
                                            value={newVariable.key}
                                            onChange={(e) => setNewVariable({
                                                ...newVariable,
                                                key: e.target.value
                                            })}
                                            className="form-input variable-key-input"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label htmlFor="new-type" className="input-label">Type</label>
                                        <select
                                            id="new-type"
                                            value={newVariable.type}
                                            onChange={(e) => setNewVariable({
                                                ...newVariable,
                                                type: e.target.value
                                            })}
                                            className="form-select variable-type-select"
                                        >
                                            <option value="string">String</option>
                                            <option value="number">Number</option>
                                            <option value="boolean">Boolean</option>
                                            <option value="object">Object</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="input-group">
                                    <label htmlFor="new-value" className="input-label">Value</label>
                                    <input
                                        id="new-value"
                                        type="text"
                                        placeholder="Enter the variable value"
                                        value={newVariable.value}
                                        onChange={(e) => setNewVariable({
                                            ...newVariable,
                                            value: e.target.value
                                        })}
                                        className="form-input variable-value-input"
                                    />
                                </div>
                                <div className="input-group">
                                    <label htmlFor="new-description" className="input-label">Description (optional)</label>
                                    <input
                                        id="new-description"
                                        type="text"
                                        placeholder="Describe what this variable is used for"
                                        value={newVariable.description}
                                        onChange={(e) => setNewVariable({
                                            ...newVariable,
                                            description: e.target.value
                                        })}
                                        className="form-input variable-description-input"
                                    />
                                </div>
                            </div>
                            <div className="form-actions">
                                <button
                                    className="btn btn-primary add-variable-btn"
                                    onClick={handleAddVariable}
                                    disabled={!newVariable.key.trim()}
                                >
                                    <FiPlus /> Add Variable
                                </button>
                                <button
                                    className="btn btn-secondary cancel-add-btn"
                                    onClick={() => { setShowAddForm(false); setNewVariable({ key: '', value: '', description: '', type: 'string' }); }}
                                >
                                    <FiX /> Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="empty-state motion-fade-in">
                            <div className="empty-state-content">
                                <div className="empty-state-icon">
                                    <FiEdit2 size={48} />
                                </div>
                                <h3>No {getScopeLabel(scope).toLowerCase()} variables yet</h3>
                                <p>Create your first variable to get started. Variables allow you to store and reuse values across your requests.</p>
                                {editable && !showAddForm && (
                                    <button
                                        className="empty-state-action motion-interactive motion-transition-colors"
                                        onClick={() => setShowAddForm(true)}
                                    >
                                        <FiPlus /> Create Variable
                                    </button>
                                )}
                                {editable && showAddForm && !inlineAddForm && (
                                    <div className="add-variable-form motion-slide-up" style={{ marginTop: 24 }}>
                                        <div className="form-section">
                                            <div className="form-row">
                                                <div className="input-group">
                                                    <label htmlFor="new-key" className="input-label">Variable Name</label>
                                                    <input
                                                        id="new-key"
                                                        type="text"
                                                        placeholder="e.g., api_url, token, port"
                                                        value={newVariable.key}
                                                        onChange={(e) => setNewVariable({
                                                            ...newVariable,
                                                            key: e.target.value
                                                        })}
                                                        className="form-input variable-key-input"
                                                        autoFocus
                                                    />
                                                </div>
                                                <div className="input-group">
                                                    <label htmlFor="new-type" className="input-label">Type</label>
                                                    <select
                                                        id="new-type"
                                                        value={newVariable.type}
                                                        onChange={(e) => setNewVariable({
                                                            ...newVariable,
                                                            type: e.target.value
                                                        })}
                                                        className="form-select variable-type-select"
                                                    >
                                                        <option value="string">String</option>
                                                        <option value="number">Number</option>
                                                        <option value="boolean">Boolean</option>
                                                        <option value="object">Object</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="input-group">
                                                <label htmlFor="new-value" className="input-label">Value</label>
                                                <input
                                                    id="new-value"
                                                    type="text"
                                                    placeholder="Enter the variable value"
                                                    value={newVariable.value}
                                                    onChange={(e) => setNewVariable({
                                                        ...newVariable,
                                                        value: e.target.value
                                                    })}
                                                    className="form-input variable-value-input"
                                                />
                                            </div>
                                            <div className="input-group">
                                                <label htmlFor="new-description" className="input-label">Description (optional)</label>
                                                <input
                                                    id="new-description"
                                                    type="text"
                                                    placeholder="Describe what this variable is used for"
                                                    value={newVariable.description}
                                                    onChange={(e) => setNewVariable({
                                                        ...newVariable,
                                                        description: e.target.value
                                                    })}
                                                    className="form-input variable-description-input"
                                                />
                                            </div>
                                        </div>
                                        <div className="form-actions">
                                            <button
                                                className="btn btn-primary add-variable-btn"
                                                onClick={handleAddVariable}
                                                disabled={!newVariable.key.trim()}
                                            >
                                                <FiPlus /> Add Variable
                                            </button>
                                            <button
                                                className="btn btn-secondary cancel-add-btn"
                                                onClick={() => { setShowAddForm(false); setNewVariable({ key: '', value: '', description: '', type: 'string' }); }}
                                            >
                                                <FiX /> Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                ) : (
                    <>
                        <div className="variables-grid">
                            {localVariables.map((variable, index) => (
                                <div
                                    key={variable.id || variable.key || index}
                                    className={`variable-card${editingVariable && (editingVariable.id === variable.id || editingVariable.key === variable.key) ? ' variable-card--editing' : ''}`}
                                >
                                    {editingVariable && (editingVariable.id === variable.id || editingVariable.key === variable.key) ? (
                                        <div className="variable-edit-form motion-slide-up">
                                            <div className="form-section">
                                                <label className="form-label">Variable Details</label>
                                                <div className="form-row">
                                                    <div className="input-group">
                                                        <label htmlFor="edit-key" className="input-label">Name</label>
                                                        <input
                                                            id="edit-key"
                                                            type="text"
                                                            placeholder="e.g., api_url, token, port"
                                                            value={editingVariable.key}
                                                            onChange={(e) => setEditingVariable({
                                                                ...editingVariable,
                                                                key: e.target.value
                                                            })}
                                                            className="form-input variable-key-input"
                                                        />
                                                    </div>
                                                    <div className="input-group">
                                                        <label htmlFor="edit-type" className="input-label">Type</label>
                                                        <select
                                                            id="edit-type"
                                                            value={editingVariable.type}
                                                            onChange={(e) => setEditingVariable({
                                                                ...editingVariable,
                                                                type: e.target.value
                                                            })}
                                                            className="form-select variable-type-select"
                                                        >
                                                            <option value="string">String</option>
                                                            <option value="number">Number</option>
                                                            <option value="boolean">Boolean</option>
                                                            <option value="object">Object</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                <div className="input-group">
                                                    <label htmlFor="edit-value" className="input-label">Value</label>
                                                    <input
                                                        id="edit-value"
                                                        type="text"
                                                        placeholder="Enter the variable value"
                                                        value={editingVariable.value}
                                                        onChange={(e) => setEditingVariable({
                                                            ...editingVariable,
                                                            value: e.target.value
                                                        })}
                                                        className="form-input variable-value-input"
                                                    />
                                                </div>

                                                <div className="input-group">
                                                    <label htmlFor="edit-description" className="input-label">Description (optional)</label>
                                                    <input
                                                        id="edit-description"
                                                        type="text"
                                                        placeholder="Describe what this variable is used for"
                                                        value={editingVariable.description || ''}
                                                        onChange={(e) => setEditingVariable({
                                                            ...editingVariable,
                                                            description: e.target.value
                                                        })}
                                                        className="form-input variable-description-input"
                                                    />
                                                </div>
                                            </div>

                                            <div className="form-actions">
                                                <button
                                                    className="btn btn-primary save-edit-btn motion-interactive motion-transition-colors"
                                                    onClick={handleSaveEdit}
                                                >
                                                    <FiSave /> Save Changes
                                                </button>
                                                <button
                                                    className="btn btn-secondary cancel-edit-btn motion-interactive motion-transition-colors"
                                                    onClick={() => setEditingVariable(null)}
                                                >
                                                    <FiX /> Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="variable-display">
                                            <div className="variable-header">
                                                <div className="variable-title">
                                                    <span className="variable-key">{variable.key}</span>
                                                    <span className="variable-type-badge" data-type={variable.type}>
                                                        {variable.type}
                                                    </span>
                                                </div>
                                                {editable && (
                                                    <div className="variable-actions">
                                                        <button
                                                            className="action-btn edit-btn"
                                                            onClick={() => handleEditVariable(variable)}
                                                            title="Edit variable"
                                                        >
                                                            <FiEdit2 />
                                                        </button>
                                                        <button
                                                            className="action-btn delete-btn"
                                                            onClick={() => handleDeleteVariable(variable.id, variable.key)}
                                                            title="Delete variable"
                                                        >
                                                            <FiTrash2 />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="variable-value-section">
                                                <div className="value-container">
                                                    <span className="value-text">
                                                        {showValues[variable.key]
                                                            ? variable.value || '<empty>'
                                                            : '•'.repeat(Math.min(variable.value?.length || 8, 20))
                                                        }
                                                    </span>
                                                    <button
                                                        className="toggle-visibility-btn"
                                                        onClick={() => toggleShowValue(variable.key)}
                                                        title={showValues[variable.key] ? 'Hide value' : 'Show value'}
                                                    >
                                                        {showValues[variable.key] ? <FiEyeOff /> : <FiEye />}
                                                    </button>
                                                </div>
                                            </div>

                                            {variable.description && (
                                                <div className="variable-description">
                                                    <span className="description-text">{variable.description}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {editable && (
                            <div className={`add-variable-section ${inlineAddForm ? 'modal-add-section' : ''}`}>
                                {inlineAddForm && (
                                    <div className="add-section-title">
                                        <FiPlus /> Add New Variable
                                    </div>
                                )}

                                {!showAddForm ? (
                                    <button
                                        className="create-variable-btn motion-interactive motion-transition-colors"
                                        onClick={() => setShowAddForm(true)}
                                    >
                                        <FiPlus /> Create Variable
                                    </button>
                                ) : (
                                    <div className="add-variable-form motion-slide-up">
                                        <div className="form-section">
                                            <div className="form-row">
                                                <div className="input-group">
                                                    <label htmlFor="new-key" className="input-label">Variable Name</label>
                                                    <input
                                                        id="new-key"
                                                        type="text"
                                                        placeholder="e.g., api_url, token, port"
                                                        value={newVariable.key}
                                                        onChange={(e) => setNewVariable({
                                                            ...newVariable,
                                                            key: e.target.value
                                                        })}
                                                        className="form-input variable-key-input"
                                                        autoFocus
                                                    />
                                                </div>
                                                <div className="input-group">
                                                    <label htmlFor="new-type" className="input-label">Type</label>
                                                    <select
                                                        id="new-type"
                                                        value={newVariable.type}
                                                        onChange={(e) => setNewVariable({
                                                            ...newVariable,
                                                            type: e.target.value
                                                        })}
                                                        className="form-select variable-type-select"
                                                    >
                                                        <option value="string">String</option>
                                                        <option value="number">Number</option>
                                                        <option value="boolean">Boolean</option>
                                                        <option value="object">Object</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="input-group">
                                                <label htmlFor="new-value" className="input-label">Value</label>
                                                <input
                                                    id="new-value"
                                                    type="text"
                                                    placeholder="Enter the variable value"
                                                    value={newVariable.value}
                                                    onChange={(e) => setNewVariable({
                                                        ...newVariable,
                                                        value: e.target.value
                                                    })}
                                                    className="form-input variable-value-input"
                                                />
                                            </div>

                                            <div className="input-group">
                                                <label htmlFor="new-description" className="input-label">Description (optional)</label>
                                                <input
                                                    id="new-description"
                                                    type="text"
                                                    placeholder="Describe what this variable is used for"
                                                    value={newVariable.description}
                                                    onChange={(e) => setNewVariable({
                                                        ...newVariable,
                                                        description: e.target.value
                                                    })}
                                                    className="form-input variable-description-input"
                                                />
                                            </div>
                                        </div>

                                        <div className="form-actions">
                                            <button
                                                className="btn btn-primary add-variable-btn motion-interactive motion-transition-colors"
                                                onClick={handleAddVariable}
                                                disabled={!newVariable.key.trim()}
                                            >
                                                <FiPlus /> Add Variable
                                            </button>
                                            <button
                                                className="btn btn-secondary cancel-add-btn motion-interactive motion-transition-colors"
                                                onClick={() => { setShowAddForm(false); setNewVariable({ key: '', value: '', description: '', type: 'string' }); }}
                                            >
                                                <FiX /> Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default VariableEditor;
