import React, { useState, useEffect, useCallback } from 'react';
import {
    FiGitBranch, FiPlus, FiTrash2, FiClock, FiAlertTriangle,
    FiServer, FiInfo, FiFileText, FiSettings
} from 'react-icons/fi';
import MockServerManager from './MockServerManager';
import './ApiVersionManager.css';

const ApiVersionManager = ({ collectionId, collection }) => {
    const [versions, setVersions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showMockServerManager, setShowMockServerManager] = useState(false);
    const [selectedVersionId, setSelectedVersionId] = useState(null);
    const [formData, setFormData] = useState({
        version: '',
        name: '',
        description: '',
        changelog: '',
        migrationGuide: '',
        isBackwardCompatible: true,
        specification: ''
    });

    const fetchVersions = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await fetch(`/api/api-versions/collection/${collectionId}`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                setVersions(data);
            } else {
                throw new Error('Failed to fetch versions');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [collectionId]);

    useEffect(() => {
        if (collectionId) {
            fetchVersions();
        }
    }, [collectionId, fetchVersions]);

    const handleCreateVersion = async (e) => {
        e.preventDefault();
        try {
            console.log('Creating version with collectionId:', collectionId);

            if (!collectionId) {
                setError('Collection ID is required to create a version');
                return;
            }

            const versionData = {
                version: formData.version,
                name: formData.name || `${formData.version} API`,
                description: formData.description,
                changelog: formData.changelog,
                migrationGuide: formData.migrationGuide,
                backwardCompatible: formData.isBackwardCompatible,
                openApiSpec: formData.specification ? JSON.parse(formData.specification) : null,
                collectionId: collectionId
            };

            console.log('Sending version data:', versionData);

            const response = await fetch(`/api/api-versions/collections/${collectionId}/versions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(versionData)
            });

            if (response.ok) {
                const newVersion = await response.json();
                setVersions([...versions, newVersion]);
                setShowCreateForm(false);
                setFormData({
                    version: '',
                    name: '',
                    description: '',
                    changelog: '',
                    migrationGuide: '',
                    isBackwardCompatible: true,
                    specification: ''
                });
            } else {
                throw new Error('Failed to create version');
            }
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDeprecateVersion = async (versionId) => {
        if (!window.confirm('Are you sure you want to deprecate this version?')) {
            return;
        }

        try {
            const response = await fetch(`/api/api-versions/${versionId}/deprecate`, {
                method: 'POST',
                credentials: 'include'
            });

            if (response.ok) {
                fetchVersions(); // Refresh the list
            } else {
                throw new Error('Failed to deprecate version');
            }
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDeleteVersion = async (versionId) => {
        if (!window.confirm('Are you sure you want to delete this version? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`/api/api-versions/${versionId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                setVersions(versions.filter(v => v._id !== versionId));
            } else {
                throw new Error('Failed to delete version');
            }
        } catch (err) {
            setError(err.message);
        }
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleCheckboxGroupClick = (fieldName) => {
        setFormData(prev => ({
            ...prev,
            [fieldName]: !prev[fieldName]
        }));
    };

    const handleManageMockServers = (versionId) => {
        setSelectedVersionId(versionId);
        setShowMockServerManager(true);
    };

    if (showMockServerManager && selectedVersionId) {
        return (
            <MockServerManager
                collectionId={collectionId}
                versionId={selectedVersionId}
                onClose={() => {
                    setShowMockServerManager(false);
                    setSelectedVersionId(null);
                }}
            />
        );
    }

    return (
        <div className="api-version-manager">
            <div className="api-version-header">
                <div className="header-info">
                    <h2>
                        <FiGitBranch className="icon" />
                        API Versions
                    </h2>
                    <p>Manage API versions for {collection?.name || 'this collection'}</p>
                </div>
                <div className="header-actions">
                    <button
                        className="create-version-btn"
                        onClick={() => setShowCreateForm(true)}
                    >
                        <FiPlus /> Create Version
                    </button>
                </div>
            </div>

            {error && (
                <div className="api-version-error">
                    <h3>Error</h3>
                    <p>{error}</p>
                </div>
            )}

            {isLoading ? (
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading versions...</p>
                </div>
            ) : (
                <div className="versions-list">
                    <h3>Versions ({versions.length})</h3>

                    {versions.length === 0 ? (
                        <div className="empty-state">
                            <FiGitBranch size={48} />
                            <h4>No API versions found</h4>
                            <p>Create your first API version to start managing your API lifecycle.</p>
                            <button
                                className="create-version-btn"
                                onClick={() => setShowCreateForm(true)}
                            >
                                <FiPlus /> Create First Version
                            </button>
                        </div>
                    ) : (
                        <div className="versions-grid">
                            {versions.map(version => (
                                <div key={version._id} className="version-card">
                                    <div className="version-header">
                                        <div className="version-info">
                                            <h4>v{version.version}</h4>
                                            <p>{version.description}</p>
                                        </div>
                                        <div className={`version-status ${version.isDeprecated ? 'deprecated' : 'active'}`}>
                                            {version.isDeprecated ? 'Deprecated' : 'Active'}
                                        </div>
                                    </div>

                                    <div className="version-details">
                                        <p>{version.changelog}</p>

                                        <div className="version-meta">
                                            <span>
                                                <FiClock size={12} />
                                                {new Date(version.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>

                                        <div className={`compatibility-badge ${version.isBackwardCompatible ? 'compatible' : 'breaking'}`}>
                                            {version.isBackwardCompatible ? (
                                                <span>✓ Backward Compatible</span>
                                            ) : (
                                                <span>⚠ Breaking Changes</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="version-actions">
                                        <button
                                            className="action-btn mock-server"
                                            onClick={() => handleManageMockServers(version._id)}
                                        >
                                            <FiServer size={14} />
                                            Mock Servers
                                        </button>

                                        <div className="action-btn-group">
                                            {!version.isDeprecated && (
                                                <button
                                                    className="action-btn deprecate"
                                                    onClick={() => handleDeprecateVersion(version._id)}
                                                >
                                                    <FiAlertTriangle size={14} />
                                                    Deprecate
                                                </button>
                                            )}

                                            <button
                                                className="action-btn delete"
                                                onClick={() => handleDeleteVersion(version._id)}
                                            >
                                                <FiTrash2 size={14} />
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {showCreateForm && (
                <div className="create-version-form">
                    <form onSubmit={handleCreateVersion}>
                        <div className="form-header">
                            <h3>Create New API Version</h3>
                            <button
                                type="button"
                                className="close-btn"
                                onClick={() => setShowCreateForm(false)}
                                aria-label="Close form"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Basic Information Section */}
                        <div className="form-section">
                            <div className="form-section-header">
                                <FiInfo className="icon" />
                                <h4>Basic Information</h4>
                            </div>
                            <p className="form-section-description">
                                Define the fundamental details of your new API version.
                            </p>

                            <div className="form-row">
                                <div className="form-group required">
                                    <label htmlFor="version">Version Number</label>
                                    <input
                                        type="text"
                                        id="version"
                                        name="version"
                                        value={formData.version}
                                        onChange={handleInputChange}
                                        placeholder="e.g., 1.0.0, 2.1.3"
                                        required
                                    />
                                    <div className="field-hint">
                                        Use semantic versioning (major.minor.patch)
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="name">Version Name</label>
                                    <input
                                        type="text"
                                        id="name"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        placeholder="e.g., Stable Release, Beta"
                                    />
                                    <div className="field-hint">
                                        Optional friendly name for this version
                                    </div>
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="description">Description</label>
                                <textarea
                                    id="description"
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    placeholder="Brief overview of what this version introduces..."
                                    rows={3}
                                />
                                <div className="field-hint">
                                    Provide a clear summary of this version's purpose
                                </div>
                            </div>
                        </div>

                        {/* Documentation Section */}
                        <div className="form-section">
                            <div className="form-section-header">
                                <FiFileText className="icon" />
                                <h4>Documentation & Changes</h4>
                            </div>
                            <p className="form-section-description">
                                Document changes and provide migration guidance for developers.
                            </p>

                            <div className="form-group">
                                <label htmlFor="changelog">Changelog</label>
                                <textarea
                                    id="changelog"
                                    name="changelog"
                                    value={formData.changelog}
                                    onChange={handleInputChange}
                                    placeholder="• Added new endpoints for user management&#10;• Fixed bug in authentication flow&#10;• Improved error handling..."
                                    rows={4}
                                />
                                <div className="field-hint">
                                    List new features, improvements, and bug fixes
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="migrationGuide">Migration Guide</label>
                                <textarea
                                    id="migrationGuide"
                                    name="migrationGuide"
                                    value={formData.migrationGuide}
                                    onChange={handleInputChange}
                                    placeholder="1. Update endpoint URLs to include /v2/&#10;2. Replace deprecated parameters...&#10;3. Test authentication flow..."
                                    rows={4}
                                />
                                <div className="field-hint">
                                    Step-by-step instructions for upgrading from previous versions
                                </div>
                            </div>
                        </div>

                        {/* Configuration Section */}
                        <div className="form-section">
                            <div className="form-section-header">
                                <FiSettings className="icon" />
                                <h4>Version Configuration</h4>
                            </div>
                            <p className="form-section-description">
                                Set compatibility options and optional API specification.
                            </p>

                            <div
                                className={`checkbox-group ${formData.isBackwardCompatible ? 'checked' : ''}`}
                                onClick={(e) => {
                                    // Only trigger if clicking on the container, not the checkbox itself
                                    if (e.target.tagName !== 'INPUT') {
                                        handleCheckboxGroupClick('isBackwardCompatible');
                                    }
                                }}
                            >

                                <label htmlFor="isBackwardCompatible">
                                    Backward Compatible Version
                                    <input
                                        type="checkbox"
                                        id="isBackwardCompatible"
                                        name="isBackwardCompatible"
                                        checked={formData.isBackwardCompatible}
                                        onChange={handleInputChange}
                                    />
                                    <div className="checkbox-description">
                                        This version maintains compatibility with previous versions and won't break existing integrations
                                    </div>
                                </label>

                            </div>

                            <div className="form-group">
                                <label htmlFor="specification">OpenAPI Specification (JSON)</label>
                                <textarea
                                    id="specification"
                                    name="specification"
                                    value={formData.specification}
                                    onChange={handleInputChange}
                                    placeholder='{"openapi": "3.0.0", "info": {...}, "paths": {...}}'
                                    rows={6}
                                />
                                <div className="field-hint">
                                    Paste your OpenAPI 3.0 specification here (optional)
                                </div>
                            </div>
                        </div>

                        <div className="form-actions">
                            <button type="button" onClick={() => setShowCreateForm(false)}>
                                Cancel
                            </button>
                            <button type="submit">
                                <FiPlus />
                                Create Version
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Compatibility Report */}
            {versions.length > 0 && (
                <div className="compatibility-report">
                    <h3>Compatibility Overview</h3>
                    <div className="report-stats">
                        <div className="stat">
                            <div className="stat-number">{versions.length}</div>
                            <div className="stat-label">Total Versions</div>
                        </div>
                        <div className="stat">
                            <div className="stat-number">
                                {versions.filter(v => !v.isDeprecated).length}
                            </div>
                            <div className="stat-label">Active</div>
                        </div>
                        <div className="stat">
                            <div className="stat-number">
                                {versions.filter(v => v.isDeprecated).length}
                            </div>
                            <div className="stat-label">Deprecated</div>
                        </div>
                        <div className="stat">
                            <div className="stat-number">
                                {versions.filter(v => v.isBackwardCompatible).length}
                            </div>
                            <div className="stat-label">Compatible</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ApiVersionManager;
