import React, { useState, useEffect } from 'react';
import './EnvironmentModal.css';
import VariableEditor from './VariableEditor';
import { FiBox, FiInfo, FiKey, FiSave, FiTrash2, FiX } from 'react-icons/fi';

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
            <div
                className="environment-editor-modal"
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="environment-editor-title"
            >
                <header className="env-editor-header">
                    <div className="env-editor-heading">
                        <span className="env-editor-heading-icon" aria-hidden="true">
                            <FiBox />
                        </span>
                        <div>
                            <span className="env-editor-eyebrow">
                                {environment ? 'Environment settings' : 'New environment'}
                            </span>
                            <div className="env-editor-title-row">
                                <h2 id="environment-editor-title">
                                    {environment ? 'Edit Environment' : 'Create Environment'}
                                </h2>
                                {environment?.isActive ? <span className="active-badge">Active</span> : null}
                            </div>
                            <p>Configure reusable values for requests in this workspace.</p>
                        </div>
                    </div>
                    <button className="env-editor-close" type="button" onClick={onClose} aria-label="Close environment editor">
                        <FiX />
                    </button>
                </header>

                <form onSubmit={handleSubmit} className="env-editor-form">
                    <div className="env-editor-body">
                        {error ? (
                            <div className="env-editor-error" role="alert">
                                {error}
                            </div>
                        ) : null}

                        <section className="env-form-section" aria-labelledby="environment-basics-title">
                            <div className="env-section-heading">
                                <span className="env-section-icon" aria-hidden="true"><FiInfo /></span>
                                <div>
                                    <h3 id="environment-basics-title">Basic information</h3>
                                    <p>Name this environment and explain where it should be used.</p>
                                </div>
                            </div>

                            <div className="env-field-grid">
                                <div className="env-field">
                                    <label htmlFor="environment-name">Environment name <span aria-hidden="true">*</span></label>
                                    <input
                                        type="text"
                                        id="environment-name"
                                        value={formData.name}
                                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="Development, Staging, Production"
                                        required
                                        disabled={isReadOnly || loading}
                                        autoFocus
                                    />
                                    <span className="env-field-hint">Use a short name your team will recognize.</span>
                                </div>

                                <div className="env-field">
                                    <label htmlFor="environment-description">Description <span className="env-optional">Optional</span></label>
                                    <textarea
                                        id="environment-description"
                                        value={formData.description}
                                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                        placeholder="Describe the services, region, or workflow this environment targets"
                                        rows={3}
                                        disabled={isReadOnly || loading}
                                    />
                                </div>
                            </div>
                        </section>

                        <section className="env-form-section env-variables-section" aria-labelledby="environment-variables-title">
                            <div className="env-section-heading env-section-heading--split">
                                <div className="env-section-heading-main">
                                    <span className="env-section-icon" aria-hidden="true"><FiKey /></span>
                                    <div>
                                        <h3 id="environment-variables-title">Environment variables</h3>
                                        <p>Store values such as base URLs, tokens, and service identifiers.</p>
                                    </div>
                                </div>
                                <span className="env-variable-count">
                                    {formData.variables.length} {formData.variables.length === 1 ? 'variable' : 'variables'}
                                </span>
                            </div>

                            <div className="env-variables-shell">
                                <VariableEditor
                                    scope="environment"
                                    variables={formData.variables}
                                    onVariablesChange={(variables) =>
                                        setFormData(prev => ({ ...prev, variables }))
                                    }
                                    editable={!isReadOnly && !loading}
                                    hideHeader
                                    inlineAddForm
                                    environmentId={environment ? environment._id : undefined}
                                />
                            </div>
                        </section>
                    </div>

                    <footer className="env-editor-footer">
                        <div className="left-actions">
                            {environment && !isReadOnly ? (
                                <button
                                    type="button"
                                    className="env-delete-button"
                                    onClick={handleDelete}
                                    disabled={loading}
                                >
                                    <FiTrash2 />
                                    Delete environment
                                </button>
                            ) : null}
                        </div>
                        <div className="right-actions">
                            <button
                                type="button"
                                className="env-cancel-button"
                                onClick={onClose}
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            {!isReadOnly ? (
                                <button
                                    type="submit"
                                    className="env-save-button"
                                    disabled={loading || !formData.name.trim()}
                                >
                                    <FiSave />
                                    {loading ? 'Saving...' : environment ? 'Update' : 'Create'}
                                </button>
                            ) : null}
                        </div>
                    </footer>
                </form>
            </div>
        </div>
    );
};

export default EnvironmentModal;
