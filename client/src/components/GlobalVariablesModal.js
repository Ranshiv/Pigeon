import React, { useState, useEffect } from 'react';
import './GlobalVariablesModal.css';
import VariableEditor from './VariableEditor';
import { FiX, FiSave, FiGlobe } from 'react-icons/fi';

const GlobalVariablesModal = ({
    isOpen,
    onClose,
    workspaceId
}) => {
    const [variables, setVariables] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen && workspaceId) {
            fetchGlobalVariables();
        }
    }, [isOpen, workspaceId]);

    const fetchGlobalVariables = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`/api/workspaces/${workspaceId}/global-variables`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                setVariables(data.variables || []);
            } else {
                throw new Error('Failed to fetch global variables');
            }
        } catch (err) {
            setError(err.message || 'Failed to load global variables');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setError(null);

            const response = await fetch(`/api/workspaces/${workspaceId}/global-variables`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ variables })
            });

            if (response.ok) {
                onClose();
            } else {
                throw new Error('Failed to save global variables');
            }
        } catch (err) {
            setError(err.message || 'Failed to save global variables');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="global-variables-modal-overlay" onClick={onClose}>
            <div className="global-variables-modal" onClick={e => e.stopPropagation()}>
                <div className="global-variables-modal-header">
                    <h2>
                        <FiGlobe />
                        Global Variables
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

                <div className="global-variables-content">
                    {loading ? (
                        <div className="loading-state">
                            <div className="loading-spinner"></div>
                            <p>Loading global variables...</p>
                        </div>
                    ) : (
                        <div className="variables-container">
                            <div className="variables-description">
                                <p>
                                    Global variables are available across all collections and environments in this workspace.
                                    They have the lowest precedence in variable resolution.
                                </p>
                            </div>
                            <VariableEditor
                                scope="global"
                                variables={variables}
                                onVariablesChange={setVariables}
                                helpText="Define variables that will be available throughout your entire workspace."
                            />
                        </div>
                    )}
                </div>

                <div className="global-variables-modal-actions">
                    <button
                        type="button"
                        className="cancel-button"
                        onClick={onClose}
                        disabled={saving}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="save-button"
                        onClick={handleSave}
                        disabled={saving || loading}
                    >
                        <FiSave />
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GlobalVariablesModal;
