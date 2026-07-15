import React, { useState, useEffect } from 'react';
import './EnvironmentModal.css';
import VariableEditor from './VariableEditor';
import { FiX, FiSave, FiTrash2 } from 'react-icons/fi';

const EnvironmentModal = ({
    isOpen,
    onClose,
    environment = null,
    workspaceId,
    onSave,
    onDelete,
    isReadOnly = false
}) => {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        variables: [],
        isActive: false
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (environment) {
            setFormData({
                name: environment.name || '',
                description: environment.description || '',
                variables: environment.variables || [],
                isActive: environment.isActive || false
            });
        } else {
            setFormData({
                name: '',
                description: '',
                variables: [],
                isActive: false
            });
        }
        setError(null);
    }, [environment, isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            setError('Environment name is required');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const environmentData = {
                ...formData,
                workspaceId,
                ...(environment && { _id: environment._id })
            };

            await onSave(environmentData);
            onClose();
        } catch (err) {
            setError(err.message || 'Failed to save environment');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!environment || !window.confirm('Are you sure you want to delete this environment?')) {
            return;
        }

        setLoading(true);
        try {
            await onDelete(environment._id);
            onClose();
        } catch (err) {
            setError(err.message || 'Failed to delete environment');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="environment-modal-overlay" onClick={onClose}>
            <div className="environment-modal" onClick={e => e.stopPropagation()}>
                <div className="environment-modal-header">
                    <h2>
                        {environment ? 'Edit Environment' : 'Create Environment'}
                        {environment?.isActive && <span className="active-badge">Active</span>}
                    </h2>
                    <button className="close-button" onClick={onClose}>
                        <FiX />
                    </button>
                </div>

                {error && (
                    <div className="error-message">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="environment-form">
                    <div className="form-group">
                        <label htmlFor="name">Environment Name *</label>
                        <input
                            type="text"
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="e.g., Development, Staging, Production"
                            required
                            disabled={isReadOnly || loading}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="description">Description</label>
                        <textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Optional description for this environment"
                            rows={3}
                            disabled={isReadOnly || loading}
                        />
                    </div>

                    <div className="form-group">
                        <label>Environment Variables</label>
                        <div className="variables-container">
                            <VariableEditor
                                scope="environment"
                                variables={formData.variables}
                                onVariablesChange={(variables) =>
                                    setFormData(prev => ({ ...prev, variables }))
                                }
                                helpText="Define variables specific to this environment. These will be available to all requests when this environment is active."
                                readOnly={isReadOnly}
                                environmentId={environment ? environment._id : undefined}
                            />
                        </div>
                    </div>

                    <div className="environment-modal-actions">
                        <div className="left-actions">
                            {environment && !isReadOnly && (
                                <button
                                    type="button"
                                    className="delete-button"
                                    onClick={handleDelete}
                                    disabled={loading}
                                >
                                    <FiTrash2 />
                                    Delete
                                </button>
                            )}
                        </div>
                        <div className="right-actions">
                            <button
                                type="button"
                                className="cancel-button"
                                onClick={onClose}
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            {!isReadOnly && (
                                <button
                                    type="submit"
                                    className="save-button"
                                    disabled={loading || !formData.name.trim()}
                                >
                                    <FiSave />
                                    {loading ? 'Saving...' : environment ? 'Update' : 'Create'}
                                </button>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EnvironmentModal;
