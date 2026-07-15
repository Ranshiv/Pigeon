import React, { useState, useEffect } from 'react';
import { FiPackage, FiInfo, FiEdit3, FiLayers } from 'react-icons/fi';
import VariableEditor from './VariableEditor';
import UnifiedVariableViewer from './UnifiedVariableViewer';
import './CollectionVariablesManager.css';

const CollectionVariablesManager = ({
    collectionId,
    collectionName,
    workspaceId,
    selectedEnvironment
}) => {
    const [variables, setVariables] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [viewMode, setViewMode] = useState('unified'); // 'editor', 'unified'

    // For unified viewer - fetch all variable levels
    const [globalVariables, setGlobalVariables] = useState([]);
    const [environmentVariables, setEnvironmentVariables] = useState([]);
    const [resolvedVariables, setResolvedVariables] = useState({});

    useEffect(() => {
        if (collectionId) {
            fetchCollectionVariables();
            fetchAllVariables();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [collectionId]);

    // Add useEffect to refetch variables when workspaceId or selectedEnvironment changes
    useEffect(() => {
        if (workspaceId || selectedEnvironment) {
            fetchAllVariables();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspaceId, selectedEnvironment]);

    const fetchCollectionVariables = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`/api/collections/${collectionId}/variables`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                setVariables(data.variables || []);
            } else if (response.status === 404) {
                setVariables([]);
            } else {
                throw new Error('Failed to fetch collection variables');
            }
        } catch (err) {
            setError(err.message || 'Failed to load collection variables');
        } finally {
            setLoading(false);
        }
    };

    const fetchAllVariables = async () => {
        try {
            // Fetch global variables using actual workspaceId
            if (workspaceId) {
                const globalResponse = await fetch(`/api/workspaces/${workspaceId}/global-variables`, {
                    credentials: 'include'
                });
                if (globalResponse.ok) {
                    const globalData = await globalResponse.json();
                    setGlobalVariables(globalData.variables || []);
                }
            }

            // Fetch environment variables using selected environment ID (object or string)
            let environmentId = null;
            if (selectedEnvironment) {
                if (typeof selectedEnvironment === 'object' && selectedEnvironment._id) {
                    environmentId = selectedEnvironment._id;
                } else if (typeof selectedEnvironment === 'string') {
                    environmentId = selectedEnvironment;
                }
            }
            console.log('Fetching environment variables for environmentId:', environmentId, selectedEnvironment);
            if (environmentId) {
                const envResponse = await fetch(`/api/environments/${environmentId}/variables`, {
                    credentials: 'include'
                });
                const envData = await envResponse.json();
                console.log('Fetched environment variables response:', envData);
                if (envResponse.ok) {
                    setEnvironmentVariables(envData.variables || []);
                } else {
                    console.error('Error fetching environment variables:', envData);
                }
            }

            // Resolve all variables
            resolveAllVariables();
        } catch (err) {
            console.error('Error fetching all variables:', err);
        }
    };

    const resolveAllVariables = () => {
        // Simulate variable resolution with precedence
        const resolved = {};

        // Add global variables (lowest precedence)
        globalVariables.forEach(v => {
            resolved[v.key] = v.value;
        });

        // Add collection variables (higher precedence)
        variables.forEach(v => {
            resolved[v.key] = v.value;
        });

        // Add environment variables (higher precedence)
        environmentVariables.forEach(v => {
            resolved[v.key] = v.value;
        });

        setResolvedVariables(resolved);
    };

    const handleVariablesChange = async (newVariables) => {
        setVariables(newVariables);
        await saveVariables(newVariables);
        resolveAllVariables(); // Re-resolve after changes
    };

    const saveVariables = async (variablesToSave = variables) => {
        try {
            setSaving(true);
            setError(null);
            setSaveSuccess(false);

            const response = await fetch(`/api/collections/${collectionId}/variables`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ variables: variablesToSave })
            });

            if (response.ok) {
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 2000);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to save collection variables');
            }
        } catch (err) {
            setError(err.message || 'Failed to save collection variables');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="collection-variables-loading">
                <div className="loading-spinner"></div>
                <p>Loading collection variables...</p>
            </div>
        );
    }

    return (
        <div className="collection-variables-manager">
            <div className="collection-variables-header">
                <div className="header-title">
                    <FiPackage className="header-icon" />
                    <h3>Collection Variables</h3>
                    {saving && <span className="saving-indicator">Saving...</span>}
                    {saveSuccess && <span className="save-success">Saved!</span>}
                </div>
                <div className="header-actions">
                    <div className="view-mode-toggle">
                        <button
                            className={`mode-btn ${viewMode === 'unified' ? 'active' : ''}`}
                            onClick={() => setViewMode('unified')}
                            title="Unified view showing all variable levels"
                        >
                            <FiLayers size={16} /> Overview
                        </button>
                        <button
                            className={`mode-btn ${viewMode === 'editor' ? 'active' : ''}`}
                            onClick={() => setViewMode('editor')}
                            title="Edit collection variables"
                        >
                            <FiEdit3 size={16} /> Edit
                        </button>
                    </div>
                    <div className="collection-info">
                        <span className="collection-name">{collectionName}</span>
                    </div>
                </div>
            </div>

            {error && (
                <div className="error-message">
                    <strong>Error:</strong> {error}
                    <button
                        className="retry-button"
                        onClick={fetchCollectionVariables}
                        disabled={loading}
                    >
                        Retry
                    </button>
                </div>
            )}

            {viewMode === 'unified' ? (
                <div className="unified-view-container">
                    <UnifiedVariableViewer
                        globalVariables={globalVariables}
                        collectionVariables={variables}
                        environmentVariables={environmentVariables}
                        requestVariables={[]} // Empty for collection-level view
                        resolvedVariables={resolvedVariables}
                        onEditVariable={(variable, level) => {
                            // Switch to editor mode for the appropriate level
                            if (level === 'collection') {
                                setViewMode('editor');
                            } else {
                                // Could emit event to parent to open other variable editors
                                console.log(`Edit ${level} variable:`, variable);
                            }
                        }}
                        showActions={true}
                    />
                </div>
            ) : (
                <>
                    <div className="variables-description">
                        <div className="info-box">
                            <FiInfo className="info-icon" />
                            <div className="info-content">
                                <h4>Collection Variables</h4>
                                <p>
                                    Variables defined here are available to all requests within this collection.
                                    They have higher precedence than global variables but lower than environment
                                    and request-specific variables.
                                </p>
                                <div className="precedence-order">
                                    <strong>Variable Precedence:</strong> Request &gt; Environment &gt; Collection &gt; Global
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="variables-content">
                        <VariableEditor
                            scope="collection"
                            variables={variables}
                            onVariablesChange={handleVariablesChange}
                            collectionId={collectionId}
                            helpText="Define variables that will be available to all requests in this collection."
                            editable={true}
                        />
                    </div>
                </>
            )}
        </div>
    );
};

export default CollectionVariablesManager;
