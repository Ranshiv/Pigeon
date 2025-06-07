// client/src/components/DocumentationSettingsVersionHistory.js
import React, { useState, useEffect } from 'react';
import { FiClock, FiUser, FiSettings, FiRotateCcw, FiEye, FiEyeOff, FiChevronRight, FiChevronDown } from 'react-icons/fi';
import { useCollaboration } from '../context/CollaborationContext';
import './DocumentationSettingsVersionHistory.css';

const DocumentationSettingsVersionHistory = ({ documentation, onSettingsRestore, collectionId }) => {
    const [versions, setVersions] = useState([]);
    const [selectedVersion, setSelectedVersion] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedVersion, setExpandedVersion] = useState(null);
    const [showDiffView, setShowDiffView] = useState(false);
    const [compareVersion, setCompareVersion] = useState(null);

    const { documentVersions, loadVersionHistory } = useCollaboration();    // Load version history for documentation settings
    useEffect(() => {
        // Create an initial version if none exists
        const createInitialSettingsVersion = () => {
            if (!documentation) return [];

            const initialSettings = extractSettingsFromDocumentation(documentation);
            return [{
                id: `settings-${Date.now()}`,
                timestamp: documentation.updatedAt || new Date().toISOString(),
                userId: 'system',
                userName: 'System',
                message: 'Initial settings configuration',
                type: 'settings',
                entityType: 'documentation',
                entityId: collectionId,
                settings: initialSettings,
                changes: {
                    added: Object.keys(initialSettings).map(key => ({
                        field: key,
                        value: initialSettings[key]
                    }))
                }
            }];
        };

        const loadSettingsHistory = async () => {
            try {
                setLoading(true);
                setError(null);

                // Load version history for documentation settings
                const entityType = 'documentation';
                const entityId = collectionId;

                let settingsVersions = documentVersions[`${entityType}:${entityId}:settings`];

                if (!settingsVersions || settingsVersions.length === 0) {
                    // Try to load from API with settings-specific endpoint
                    try {
                        const response = await fetch(`/api/collections/${collectionId}/documentation/settings/versions`, {
                            credentials: 'include'
                        });

                        if (response.ok) {
                            settingsVersions = await response.json();
                        } else {
                            // If no specific endpoint exists, create initial version history
                            settingsVersions = createInitialSettingsVersion();
                        }
                    } catch (apiError) {
                        console.log('Settings version API not available, creating initial version');
                        settingsVersions = createInitialSettingsVersion();
                    }
                }

                // Sort versions by timestamp (newest first)
                if (settingsVersions && settingsVersions.length > 0) {
                    const sortedVersions = [...settingsVersions].sort((a, b) =>
                        new Date(b.timestamp) - new Date(a.timestamp)
                    );
                    setVersions(sortedVersions);
                    setSelectedVersion(sortedVersions[0]);
                } else {
                    setVersions([]);
                }

            } catch (err) {
                console.error('Error loading settings version history:', err);
                setError('Failed to load version history');
            } finally {
                setLoading(false);
            }
        };

        if (collectionId) {
            loadSettingsHistory();
        }
    }, [collectionId, documentVersions, loadVersionHistory, documentation]);

    // Extract settings from documentation object
    const extractSettingsFromDocumentation = (doc) => {
        return {
            isPublic: typeof doc?.isPublic === 'boolean' ? doc.isPublic : false,
            metaTitle: doc?.metaTitle || '',
            metaDescription: doc?.metaDescription || '',
            customDomain: doc?.customDomain || '',
            allowComments: typeof doc?.allowComments === 'boolean' ? doc.allowComments : false,
            showLastUpdated: typeof doc?.showLastUpdated === 'boolean' ? doc.showLastUpdated : true,
            enableSearch: typeof doc?.enableSearch === 'boolean' ? doc.enableSearch : true,
            theme: doc?.theme || 'default',
            displayOptions: doc?.displayOptions || {}
        };
    };

    // Format timestamp for display
    const formatTimestamp = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleString();
    };

    // Format relative time
    const formatRelativeTime = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffSecs < 60) return `${diffSecs} seconds ago`;
        if (diffMins < 60) return `${diffMins} minutes ago`;
        if (diffHours < 24) return `${diffHours} hours ago`;
        return `${diffDays} days ago`;
    };    // Handle version selection
    const handleVersionSelect = (version) => {
        // Use id field if available, fallback to _id for backward compatibility
        const versionId = version.id || version._id;
        // Only toggle expansion, don't automatically set as selected
        setExpandedVersion(expandedVersion === versionId ? null : versionId);
    };// Handle restore version
    const handleRestoreVersion = (version) => {
        if (onSettingsRestore && version.settings) {
            // Set this version as selected for restore operation
            setSelectedVersion(version);

            // Create a deep copy to prevent reference issues
            const settingsToRestore = JSON.parse(JSON.stringify(version.settings));

            // Log the settings being restored
            console.log('Restoring settings version:', settingsToRestore);

            // Pass settings to the parent component for restoration
            onSettingsRestore(settingsToRestore);
        }
    };

    // Compare two versions
    const handleCompareVersions = (version1, version2) => {
        setCompareVersion(version2);
        setShowDiffView(true);
    };

    // Render settings changes
    const renderSettingsChanges = (version) => {
        if (!version.changes) return null;

        return (
            <div className="settings-changes">                {version.changes.added && version.changes.added.length > 0 && (
                <div className="changes-section added">
                    <h5>Added Settings</h5>
                    <ul>
                        {version.changes.added.map((change, index) => (
                            <li key={`${version.id}-added-${change.field}-${index}`}>
                                <span className="setting-name">{change.field}:</span>
                                <span className="setting-value added">{JSON.stringify(change.value)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}                {version.changes.modified && version.changes.modified.length > 0 && (
                <div className="changes-section modified">
                    <h5>Modified Settings</h5>
                    <ul>
                        {version.changes.modified.map((change, index) => (
                            <li key={`${version.id}-modified-${change.field}-${index}`}>
                                <span className="setting-name">{change.field}:</span>
                                <span className="setting-value old">{JSON.stringify(change.oldValue)}</span>
                                <FiChevronRight className="arrow" />
                                <span className="setting-value new">{JSON.stringify(change.newValue)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}                {version.changes.deleted && version.changes.deleted.length > 0 && (
                <div className="changes-section deleted">
                    <h5>Removed Settings</h5>
                    <ul>
                        {version.changes.deleted.map((change, index) => (
                            <li key={`${version.id}-deleted-${change.field}-${index}`}>
                                <span className="setting-name">{change.field}:</span>
                                <span className="setting-value deleted">{JSON.stringify(change.oldValue)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            </div>
        );
    };    // Render version item
    const renderVersionItem = (version, index) => {
        // Use id field if available, fallback to _id for backward compatibility
        const versionId = version.id || version._id;
        const isExpanded = expandedVersion === versionId;
        const isSelected = selectedVersion?.id === versionId || selectedVersion?._id === versionId;

        return (
            <div key={versionId} className={`version-item ${isSelected ? 'selected' : ''}`}>
                <div className="version-header" onClick={() => handleVersionSelect(version)}>
                    <div className="version-icon">
                        <FiSettings />
                    </div>
                    <div className="version-info">
                        <div className="version-title">
                            {version.message || 'Settings updated'}
                        </div>
                        <div className="version-meta">
                            <span className="version-author">
                                <FiUser size={12} />
                                {version.userName || 'Unknown'}
                            </span>
                            <span className="version-time">
                                <FiClock size={12} />
                                {formatRelativeTime(version.timestamp)}
                            </span>
                        </div>
                    </div>
                    <div className="version-actions">
                        {isExpanded ? <FiChevronDown /> : <FiChevronRight />}
                    </div>
                </div>

                {isExpanded && (
                    <div className="version-details">
                        <div className="version-timestamp">
                            Full timestamp: {formatTimestamp(version.timestamp)}
                        </div>

                        {renderSettingsChanges(version)}

                        <div className="version-actions-panel">
                            <button
                                className="restore-btn"
                                onClick={() => handleRestoreVersion(version)}
                                title="Restore these settings"
                            >
                                <FiRotateCcw size={14} />
                                Restore Settings
                            </button>

                            {index < versions.length - 1 && (
                                <button
                                    className="compare-btn"
                                    onClick={() => handleCompareVersions(version, versions[index + 1])}
                                    title="Compare with previous version"
                                >
                                    <FiEye size={14} />
                                    Compare
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="settings-version-history loading">
                <div className="loading-spinner"></div>
                <p>Loading settings history...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="settings-version-history error">
                <p>Error: {error}</p>
            </div>
        );
    }

    return (
        <div className="settings-version-history">
            <div className="version-history-header">
                <h4>Settings Version History</h4>
                <p className="version-count">{versions.length} versions</p>
            </div>

            {versions.length === 0 ? (
                <div className="no-versions">
                    <FiSettings size={24} />
                    <p>No settings changes recorded yet</p>
                </div>
            ) : (
                <div className="versions-list">
                    {versions.map((version, index) => renderVersionItem(version, index))}
                </div>
            )}

            {showDiffView && compareVersion && selectedVersion && (
                <div className="diff-modal">
                    <div className="diff-modal-content">
                        <div className="diff-header">
                            <h4>Settings Comparison</h4>
                            <button
                                className="close-diff"
                                onClick={() => setShowDiffView(false)}
                            >
                                <FiEyeOff />
                            </button>
                        </div>
                        <div className="diff-content">
                            <div className="diff-versions">
                                <div className="diff-version">
                                    <h5>Previous ({formatTimestamp(compareVersion.timestamp)})</h5>
                                    <pre>{JSON.stringify(compareVersion.settings, null, 2)}</pre>
                                </div>
                                <div className="diff-version">
                                    <h5>Current ({formatTimestamp(selectedVersion.timestamp)})</h5>
                                    <pre>{JSON.stringify(selectedVersion.settings, null, 2)}</pre>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DocumentationSettingsVersionHistory;
