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
    workspaceId
}) => {
    const [localVariables, setLocalVariables] = useState(variables);
    const [editingVariable, setEditingVariable] = useState(null);
    const [showValues, setShowValues] = useState({});
    const [saving, setSaving] = useState(false);
    const [newVariable, setNewVariable] = useState({ key: '', value: '', description: '', type: 'string' });

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

    const saveToServer = async () => {
        setSaving(true);
        try {
            let endpoint = '';
            let payload = { variables: localVariables };

            switch (scope) {
                case 'global':
                    endpoint = '/api/environments/global/variables';
                    break;
                case 'collection':
                    endpoint = `/api/collections/${collectionId}/variables`;
                    break;
                case 'environment':
                    endpoint = `/api/environments/${environmentId}/variables`;
                    break;
                default:
                    console.warn('Cannot save request-level variables to server');
                    return;
            }

            const response = await fetch(endpoint, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error('Failed to save variables');
            }

            console.log('Variables saved successfully');
        } catch (error) {
            console.error('Error saving variables:', error);
            alert('Failed to save variables. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const getScopeColor = (scope) => {
        switch (scope) {
            case 'global': return '#9c27b0';
            case 'collection': return '#2196f3';
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
        <div className="variable-editor">
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

                {editable && scope !== 'request' && (
                    <button
                        className="save-btn"
                        onClick={saveToServer}
                        disabled={saving}
                    >
                        <FiSave /> {saving ? 'Saving...' : 'Save'}
                    </button>
                )}
            </div>

            <div className="variables-list">
                {localVariables.length === 0 ? (
                    <div className="no-variables">
                        <p>No {getScopeLabel(scope).toLowerCase()} variables defined</p>
                    </div>
                ) : (
                    localVariables.map((variable, index) => (
                        <div key={variable.id || variable.key || index} className="variable-item">
                            {editingVariable && (editingVariable.id === variable.id || editingVariable.key === variable.key) ? (
                                <div className="variable-edit-form">
                                    <div className="form-row">
                                        <input
                                            type="text"
                                            placeholder="Variable name"
                                            value={editingVariable.key}
                                            onChange={(e) => setEditingVariable({
                                                ...editingVariable,
                                                key: e.target.value
                                            })}
                                            className="variable-key-input"
                                        />
                                        <select
                                            value={editingVariable.type}
                                            onChange={(e) => setEditingVariable({
                                                ...editingVariable,
                                                type: e.target.value
                                            })}
                                            className="variable-type-select"
                                        >
                                            <option value="string">String</option>
                                            <option value="number">Number</option>
                                            <option value="boolean">Boolean</option>
                                            <option value="object">Object</option>
                                        </select>
                                    </div>

                                    <input
                                        type="text"
                                        placeholder="Variable value"
                                        value={editingVariable.value}
                                        onChange={(e) => setEditingVariable({
                                            ...editingVariable,
                                            value: e.target.value
                                        })}
                                        className="variable-value-input"
                                    />

                                    <input
                                        type="text"
                                        placeholder="Description (optional)"
                                        value={editingVariable.description || ''}
                                        onChange={(e) => setEditingVariable({
                                            ...editingVariable,
                                            description: e.target.value
                                        })}
                                        className="variable-description-input"
                                    />

                                    <div className="edit-actions">
                                        <button
                                            className="save-edit-btn"
                                            onClick={handleSaveEdit}
                                        >
                                            <FiSave />
                                        </button>
                                        <button
                                            className="cancel-edit-btn"
                                            onClick={() => setEditingVariable(null)}
                                        >
                                            <FiX />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="variable-display">
                                    <div className="variable-info">
                                        <div className="variable-header">
                                            <span className="variable-key">{variable.key}</span>
                                            <span className="variable-type">{variable.type}</span>
                                        </div>

                                        <div className="variable-value">
                                            <span className="value-label">Value:</span>
                                            <div className="value-container">
                                                <span className="value-text">
                                                    {showValues[variable.key]
                                                        ? variable.value
                                                        : '•'.repeat(Math.min(variable.value?.length || 8, 20))
                                                    }
                                                </span>
                                                <button
                                                    className="toggle-visibility-btn"
                                                    onClick={() => toggleShowValue(variable.key)}
                                                >
                                                    {showValues[variable.key] ? <FiEyeOff /> : <FiEye />}
                                                </button>
                                            </div>
                                        </div>

                                        {variable.description && (
                                            <div className="variable-description">
                                                {variable.description}
                                            </div>
                                        )}
                                    </div>

                                    {editable && (
                                        <div className="variable-actions">
                                            <button
                                                className="edit-variable-btn"
                                                onClick={() => handleEditVariable(variable)}
                                            >
                                                <FiEdit2 />
                                            </button>
                                            <button
                                                className="delete-variable-btn"
                                                onClick={() => handleDeleteVariable(variable.id, variable.key)}
                                            >
                                                <FiTrash2 />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {editable && (
                <div className="add-variable-section">
                    <div className="add-variable-form">
                        <div className="form-row">
                            <input
                                type="text"
                                placeholder="Variable name"
                                value={newVariable.key}
                                onChange={(e) => setNewVariable({
                                    ...newVariable,
                                    key: e.target.value
                                })}
                                className="variable-key-input"
                            />
                            <select
                                value={newVariable.type}
                                onChange={(e) => setNewVariable({
                                    ...newVariable,
                                    type: e.target.value
                                })}
                                className="variable-type-select"
                            >
                                <option value="string">String</option>
                                <option value="number">Number</option>
                                <option value="boolean">Boolean</option>
                                <option value="object">Object</option>
                            </select>
                        </div>

                        <input
                            type="text"
                            placeholder="Variable value"
                            value={newVariable.value}
                            onChange={(e) => setNewVariable({
                                ...newVariable,
                                value: e.target.value
                            })}
                            className="variable-value-input"
                        />

                        <input
                            type="text"
                            placeholder="Description (optional)"
                            value={newVariable.description}
                            onChange={(e) => setNewVariable({
                                ...newVariable,
                                description: e.target.value
                            })}
                            className="variable-description-input"
                        />

                        <button
                            className="add-variable-btn"
                            onClick={handleAddVariable}
                            disabled={!newVariable.key.trim()}
                        >
                            <FiPlus /> Add Variable
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VariableEditor;
