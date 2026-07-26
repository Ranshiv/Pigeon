import React, { useState, useEffect, useCallback } from 'react';
import { FiSettings, FiCheck, FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
import './EnvironmentSelector.css';
import EnvironmentModal from './EnvironmentModal';
import VariablePreviewTooltip from './VariablePreviewTooltip';

// Helper function to get the correct API base URL
const getApiUrl = (path) => path;

const EnvironmentSelector = ({
    selectedEnvironmentId,
    onEnvironmentChange,
    workspaceId,
    collectionId
}) => {
    const [environments, setEnvironments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [showManageModal, setShowManageModal] = useState(false);
    const [selectedEnvironment, setSelectedEnvironment] = useState(null);
    const [showEnvironmentModal, setShowEnvironmentModal] = useState(false);
    const [editingEnvironment, setEditingEnvironment] = useState(null);
    const [variablePreview, setVariablePreview] = useState({ show: false, environment: null });

    // Fetch environments
    const fetchEnvironments = useCallback(async () => {
        try {
            setLoading(true);
            const path = workspaceId
                ? `/api/environments?workspaceId=${workspaceId}`
                : '/api/environments';
            const url = getApiUrl(path);

            const response = await fetch(url, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                setEnvironments(data);

                // Update selectedEnvironment based on the current selectedEnvironmentId
                if (selectedEnvironmentId) {
                    const currentEnv = data.find(env => env._id === selectedEnvironmentId);
                    setSelectedEnvironment(currentEnv);
                } else {
                    setSelectedEnvironment(null);
                }
            }
        } catch (error) {
            console.error('Error fetching environments:', error);
        } finally {
            setLoading(false);
        }
    }, [workspaceId, selectedEnvironmentId]);

    useEffect(() => {
        fetchEnvironments();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspaceId, selectedEnvironmentId]);

    const handleEnvironmentSelect = (environment) => {
        setSelectedEnvironment(environment);
        onEnvironmentChange(environment); // Pass the full environment object
        setShowDropdown(false);
    };

    const handleSetActive = async (environmentId) => {
        try {
            const url = getApiUrl(`/api/environments/${environmentId}/set-active`);
            const response = await fetch(url, {
                method: 'POST',
                credentials: 'include'
            });

            if (response.ok) {
                await fetchEnvironments();
            }
        } catch (error) {
            console.error('Error setting active environment:', error);
        }
    };

    const handleDeleteEnvironment = async (environmentId) => {
        if (!window.confirm('Are you sure you want to delete this environment?')) {
            return;
        }

        try {
            const url = getApiUrl(`/api/environments/${environmentId}`);
            const response = await fetch(url, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                await fetchEnvironments();
                if (selectedEnvironmentId === environmentId) {
                    setSelectedEnvironment(null);
                    onEnvironmentChange(null);
                }
            }
        } catch (error) {
            console.error('Error deleting environment:', error);
        }
    };

    const handleCreateEnvironment = () => {
        setEditingEnvironment(null);
        setShowEnvironmentModal(true);
        setShowDropdown(false);
    };

    const handleEditEnvironment = (environment) => {
        setEditingEnvironment(environment);
        setShowEnvironmentModal(true);
        setShowDropdown(false);
    };

    const handleSaveEnvironment = async (environmentData) => {
        try {
            // Remove 'id' property from each variable before sending to backend
            const cleanedVariables = (environmentData.variables || []).map(({ id, ...rest }) => rest);
            const cleanedEnvironmentData = { ...environmentData, variables: cleanedVariables };

            const path = environmentData._id
                ? `/api/environments/${environmentData._id}`
                : '/api/environments';
            const url = getApiUrl(path);
            const method = environmentData._id ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(cleanedEnvironmentData)
            });

            if (response.ok) {
                await fetchEnvironments();
                setShowEnvironmentModal(false);
            } else {
                throw new Error('Failed to save environment');
            }
        } catch (error) {
            console.error('Error saving environment:', error);
            throw error;
        }
    };

    const handleDeleteEnvironmentFromModal = async (environmentId) => {
        await handleDeleteEnvironment(environmentId);
        setShowEnvironmentModal(false);
    };

    return (
        <div className="environment-selector">
            <div className="environment-dropdown">
                <button
                    className="environment-button"
                    onClick={() => setShowDropdown(!showDropdown)}
                    disabled={loading}
                >
                    <span className="environment-label">
                        {loading ? 'Loading...' :
                            selectedEnvironment ? selectedEnvironment.name : 'No Environment'}
                    </span>
                    <span className="environment-arrow">▼</span>
                </button>

                {showDropdown && (
                    <div className="environment-dropdown-menu">
                        <div className="environment-header">
                            <span>Select Environment</span>
                            <button
                                className="manage-btn"
                                onClick={() => {
                                    setShowManageModal(true);
                                    setShowDropdown(false);
                                }}
                            >
                                <FiSettings />
                            </button>
                        </div>

                        <div className="environment-list">
                            <div
                                className={`environment-option none-option ${!selectedEnvironmentId ? 'selected' : ''}`}
                                onClick={() => handleEnvironmentSelect(null)}
                            >
                                <span>No Environment</span>
                                {!selectedEnvironmentId && <FiCheck className="check-icon" />}
                            </div>

                            {environments.map(env => (
                                <div
                                    key={env._id}
                                    className={`environment-option ${selectedEnvironmentId === env._id ? 'selected' : ''}`}
                                    onClick={() => handleEnvironmentSelect(env)}
                                >
                                    <div className="environment-info">
                                        <span className="environment-name">{env.name}</span>
                                        {env.isDefault && <span className="default-badge">Default</span>}
                                    </div>
                                    <div className="environment-actions">
                                        <button
                                            className="edit-env-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleEditEnvironment(env);
                                            }}
                                            title="Edit environment"
                                        >
                                            <FiEdit2 />
                                        </button>
                                        {selectedEnvironmentId === env._id && <FiCheck className="check-icon" />}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="environment-footer">
                            <button
                                className="create-environment-btn"
                                onClick={handleCreateEnvironment}
                            >
                                <FiPlus /> Create Environment
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Environment Management Modal */}
            {showManageModal && (
                <div className="environment-manage-overlay" onClick={() => setShowManageModal(false)}>
                    <div className="environment-manage-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="environment-manage-header">
                            <h3>Manage Environments</h3>
                            <button
                                className="environment-manage-close"
                                onClick={() => setShowManageModal(false)}
                                aria-label="Close environment management"
                            >
                                ×
                            </button>
                        </div>

                        <div className="environment-manage-content">
                            <div className="environments-list">
                                {environments.map(env => (
                                    <div key={env._id} className="environment-item">
                                        <div className="environment-details">
                                            <div className="environment-name">{env.name}</div>
                                            <div className="environment-description">
                                                {env.description || 'No description'}
                                            </div>
                                            <div className="environment-meta">
                                                <span
                                                    className="variables-count"
                                                    onMouseEnter={() => setVariablePreview({
                                                        show: true,
                                                        environment: env
                                                    })}
                                                    onMouseLeave={() => setVariablePreview({
                                                        show: false,
                                                        environment: null
                                                    })}
                                                    title="Click to preview variables"
                                                >
                                                    {env.variables?.length || 0} variables
                                                </span>
                                                {env.isDefault && <span className="default-badge">Default</span>}

                                                {/* Variable Preview Tooltip */}
                                                {variablePreview.show && variablePreview.environment?._id === env._id && (
                                                    <VariablePreviewTooltip
                                                        variables={env.variables || []}
                                                        environmentName={env.name}
                                                        visible={true}
                                                        onClose={() => setVariablePreview({ show: false, environment: null })}
                                                    />
                                                )}
                                            </div>
                                        </div>

                                        <div className="environment-actions">
                                            {!env.isDefault && (
                                                <button
                                                    className="action-btn set-default-btn"
                                                    onClick={() => handleSetActive(env._id)}
                                                    title="Set as default"
                                                >
                                                    Set Default
                                                </button>
                                            )}
                                            <button
                                                className="action-btn edit-btn"
                                                onClick={() => {
                                                    // TODO: Open edit environment modal
                                                }}
                                                title="Edit environment"
                                            >
                                                <FiEdit2 />
                                            </button>
                                            <button
                                                className="action-btn delete-btn"
                                                onClick={() => handleDeleteEnvironment(env._id)}
                                                title="Delete environment"
                                            >
                                                <FiTrash2 />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {environments.length === 0 && (
                                    <div className="no-environments">
                                        <p>No environments found</p>
                                        <button className="create-first-btn" onClick={handleCreateEnvironment}>
                                            <FiPlus /> Create Your First Environment
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Environment Create/Edit Modal */}
            <EnvironmentModal
                isOpen={showEnvironmentModal}
                onClose={() => setShowEnvironmentModal(false)}
                environment={editingEnvironment}
                workspaceId={workspaceId}
                onSave={handleSaveEnvironment}
                onDelete={handleDeleteEnvironmentFromModal}
            />
        </div>
    );
};

export default EnvironmentSelector;
