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
                        <span className="ts-eyebrow">Global</span>
                        Global Variables
                    </h2>
                    <button className="gv-close-btn" onClick={onClose} aria-label="Close">
                        <FiX />
                    </button>
                </div>

                <div className="global-variables-content">
                    {error && (
                        <div className="global-variables-error">
                            {error}
                        </div>
                    )}

                    {loading ? (
                        <div className="global-variables-loading">
                            <div className="global-variables-spinner"></div>
                            <p>Loading global variables…</p>
                        </div>
                    ) : variables.length === 0 ? (
                        <div className="global-variables-empty">
                            <div className="global-variables-empty-icon">
                                <FiGlobe />
                            </div>
                            <h3 className="global-variables-empty-title">No global variables yet</h3>
                            <p className="global-variables-empty-subtext">
                                Global variables are available across all collections and environments in this workspace.
                                Create your first to share values like API base URLs, tokens, or feature flags.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="global-variables-banner">
                                <p>
                                    Global variables are available across all collections and environments in this workspace.
                                    They have the lowest precedence in variable resolution.
                                </p>
                            </div>
                            <VariableEditor
                                scope="global"
                                variables={variables}
                                onVariablesChange={setVariables}
                                editable={true}
                                hideHeader
                            />
                        </>
                    )}
                </div>

                <div className="global-variables-footer">
                    <button
                        type="button"
                        className="gv-cancel-btn"
                        onClick={onClose}
                        disabled={saving}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="gv-save-btn"
                        onClick={handleSave}
                        disabled={saving || loading}
                    >
                        <FiSave />
                        {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GlobalVariablesModal;
