import React, { useState, useEffect } from 'react';
import { FiGlobe, FiLayers, FiDatabase, FiSettings, FiRefreshCw } from 'react-icons/fi';
import UnifiedVariableViewer from './UnifiedVariableViewer';
import './VariableManagementHub.css';

const VariableManagementHub = ({
    workspaceId,
    collectionId,
    environmentId,
    onNavigateToEditor
}) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [variables, setVariables] = useState({
        global: [],
        collection: [],
        environment: [],
        request: []
    });
    const [resolvedVariables, setResolvedVariables] = useState({});
    const [stats, setStats] = useState({
        totalVariables: 0,
        uniqueKeys: 0,
        overridden: 0
    });

    useEffect(() => {
        fetchAllVariables();
    }, [workspaceId, collectionId, environmentId]);

    const fetchAllVariables = async () => {
        try {
            setLoading(true);
            setError(null);

            const requests = [];

            // Fetch global variables
            if (workspaceId) {
                requests.push(
                    fetch(`/api/workspaces/${workspaceId}/global-variables`, {
                        credentials: 'include'
                    }).then(res => res.ok ? res.json() : { variables: [] })
                );
            } else {
                requests.push(Promise.resolve({ variables: [] }));
            }

            // Fetch collection variables
            if (collectionId) {
                requests.push(
                    fetch(`/api/collections/${collectionId}/variables`, {
                        credentials: 'include'
                    }).then(res => res.ok ? res.json() : { variables: [] })
                );
            } else {
                requests.push(Promise.resolve({ variables: [] }));
            }

            // Fetch environment variables
            if (environmentId) {
                requests.push(
                    fetch(`/api/environments/${environmentId}/variables`, {
                        credentials: 'include'
                    }).then(res => res.ok ? res.json() : { variables: [] })
                );
            } else {
                requests.push(Promise.resolve({ variables: [] }));
            }

            const [globalData, collectionData, environmentData] = await Promise.all(requests);

            const newVariables = {
                global: globalData.variables || [],
                collection: collectionData.variables || [],
                environment: environmentData.variables || [],
                request: [] // Request variables would come from context
            };

            setVariables(newVariables);
            calculateStats(newVariables);
            resolveVariables(newVariables);

        } catch (err) {
            setError(err.message || 'Failed to load variables');
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (vars) => {
        const allVars = [
            ...vars.global,
            ...vars.collection,
            ...vars.environment,
            ...vars.request
        ];

        const keyCount = {};
        allVars.forEach(v => {
            keyCount[v.key] = (keyCount[v.key] || 0) + 1;
        });

        const totalVariables = allVars.length;
        const uniqueKeys = Object.keys(keyCount).length;
        const overridden = Object.values(keyCount).filter(count => count > 1).length;

        setStats({ totalVariables, uniqueKeys, overridden });
    };

    const resolveVariables = (vars) => {
        const resolved = {};

        // Apply in reverse precedence order (global -> collection -> environment -> request)
        [...vars.global, ...vars.collection, ...vars.environment, ...vars.request]
            .forEach(v => {
                resolved[v.key] = v.value;
            });

        setResolvedVariables(resolved);
    };

    const handleEditVariable = (variable, level) => {
        if (onNavigateToEditor) {
            onNavigateToEditor(level, variable);
        }
    };

    if (loading) {
        return (
            <div className="variable-hub-loading">
                <div className="loading-spinner"></div>
                <p>Loading variable data...</p>
            </div>
        );
    }

    return (
        <div className="variable-management-hub">
            <div className="hub-header">
                <div className="header-content">
                    <h2>
                        <FiSettings className="header-icon" />
                        Variable Management
                    </h2>
                    <p className="header-description">
                        Centralized view of all variables across your workspace, collections, and environments.
                    </p>
                </div>

                <div className="header-actions">
                    <button
                        className="refresh-btn"
                        onClick={fetchAllVariables}
                        disabled={loading}
                        title="Refresh all variables"
                    >
                        <FiRefreshCw className={loading ? 'spinning' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            {error && (
                <div className="error-banner">
                    <strong>Error:</strong> {error}
                    <button onClick={fetchAllVariables} className="retry-btn">
                        Retry
                    </button>
                </div>
            )}

            <div className="hub-stats">
                <div className="stat-card">
                    <div className="stat-icon">
                        <FiDatabase />
                    </div>
                    <div className="stat-content">
                        <div className="stat-value">{stats.totalVariables}</div>
                        <div className="stat-label">Total Variables</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">
                        <FiLayers />
                    </div>
                    <div className="stat-content">
                        <div className="stat-value">{stats.uniqueKeys}</div>
                        <div className="stat-label">Unique Keys</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">
                        <FiGlobe />
                    </div>
                    <div className="stat-content">
                        <div className="stat-value">{stats.overridden}</div>
                        <div className="stat-label">Overridden Keys</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">
                        <FiSettings />
                    </div>
                    <div className="stat-content">
                        <div className="stat-value">{Object.keys(resolvedVariables).length}</div>
                        <div className="stat-label">Resolved Variables</div>
                    </div>
                </div>
            </div>

            <div className="hub-content">
                <UnifiedVariableViewer
                    globalVariables={variables.global}
                    collectionVariables={variables.collection}
                    environmentVariables={variables.environment}
                    requestVariables={variables.request}
                    resolvedVariables={resolvedVariables}
                    onEditVariable={handleEditVariable}
                    showActions={true}
                    compact={false}
                />
            </div>
        </div>
    );
};

export default VariableManagementHub;
