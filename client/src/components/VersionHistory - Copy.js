// client/src/components/VersionHistory.js
import React, { useState, useEffect } from 'react';
import { FiGitCommit, FiGitBranch, FiGitMerge, FiClock, FiUser, FiEdit, FiArrowLeft, FiArrowRight, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import { useCollaboration } from '../context/CollaborationContext';
import './VersionHistory.css';

const VersionHistory = ({ entityType, entityId, onVersionSelect, currentVersion }) => {
    const [versions, setVersions] = useState([]);
    const [selectedVersion, setSelectedVersion] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [diffView, setDiffView] = useState(false);
    const [compareVersion, setCompareVersion] = useState(null);

    const { documentVersions, loadVersionHistory } = useCollaboration();

    // Load version history for the entity
    useEffect(() => {
        const loadHistory = async () => {
            try {
                setLoading(true);
                setError(null);

                // Try to get versions from context first
                let entityVersions = documentVersions[`${entityType}:${entityId}`];

                // If not available in context, load from API
                if (!entityVersions || entityVersions.length === 0) {
                    entityVersions = await loadVersionHistory(entityType, entityId);
                }

                // Sort versions by timestamp (newest first)
                if (entityVersions) {
                    const sortedVersions = [...entityVersions].sort((a, b) =>
                        new Date(b.timestamp) - new Date(a.timestamp)
                    );

                    setVersions(sortedVersions);

                    // If a current version is provided, select it
                    if (currentVersion) {
                        const current = sortedVersions.find(v => v.id === currentVersion.id);
                        if (current) {
                            setSelectedVersion(current);
                        } else if (sortedVersions.length > 0) {
                            // Otherwise select the latest version
                            setSelectedVersion(sortedVersions[0]);
                        }
                    } else if (sortedVersions.length > 0) {
                        // If no current version provided, select the latest
                        setSelectedVersion(sortedVersions[0]);
                    }
                }
            } catch (err) {
                console.error('Error loading version history:', err);
                setError('Failed to load version history');
            } finally {
                setLoading(false);
            }
        };

        loadHistory();
    }, [entityType, entityId, documentVersions, loadVersionHistory, currentVersion]);

    // Handle version selection
    const handleVersionSelect = (version) => {
        setSelectedVersion(version);

        if (onVersionSelect) {
            onVersionSelect(version);
        }

        // Clear diff view when selecting a new version
        if (diffView) {
            setDiffView(false);
            setCompareVersion(null);
        }
    };

    // Enable diff view between two versions
    const handleEnableDiffView = () => {
        // When enabling diff view, set compare version to the previous version
        const currentIndex = versions.findIndex(v => v.id === selectedVersion.id);
        const previousVersion = currentIndex < versions.length - 1 ? versions[currentIndex + 1] : null;

        setDiffView(true);
        setCompareVersion(previousVersion);
    };

    // Handle selecting a different version to compare with
    const handleCompareVersionChange = (version) => {
        setCompareVersion(version);
    };

    // Format the date for display
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString();
    };

    // Format the time difference
    const formatTimeDiff = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffSeconds = Math.floor((now - date) / 1000);

        if (diffSeconds < 60) return `${diffSeconds} seconds ago`;
        if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} minutes ago`;
        if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)} hours ago`;
        return `${Math.floor(diffSeconds / 86400)} days ago`;
    };

    // Get icon based on version type
    const getVersionIcon = (version) => {
        switch (version.type) {
            case 'branch':
                return <FiGitBranch className="version-icon branch" />;
            case 'merge':
                return <FiGitMerge className="version-icon merge" />;
            default:
                return <FiGitCommit className="version-icon commit" />;
        }
    };

    // Render the changes in the selected version
    const renderChanges = (version) => {
        if (!version || !version.changes) return null;

        return (
            <div className="version-changes">
                {version.changes.added && version.changes.added.length > 0 && (
                    <div className="change-section added">
                        <h4>Added</h4>
                        <ul>
                            {version.changes.added.map((change, i) => (
                                <li key={`added-${i}`}>
                                    <span className="field-name">{change.field}</span>:
                                    <span className="field-value">{JSON.stringify(change.value)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {version.changes.modified && version.changes.modified.length > 0 && (
                    <div className="change-section modified">
                        <h4>Modified</h4>
                        <ul>
                            {version.changes.modified.map((change, i) => (
                                <li key={`modified-${i}`}>
                                    <span className="field-name">{change.field}</span>:
                                    <span className="old-value">{JSON.stringify(change.oldValue)}</span>
                                    <FiArrowRight className="arrow-icon" />
                                    <span className="new-value">{JSON.stringify(change.newValue)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {version.changes.deleted && version.changes.deleted.length > 0 && (
                    <div className="change-section deleted">
                        <h4>Deleted</h4>
                        <ul>
                            {version.changes.deleted.map((change, i) => (
                                <li key={`deleted-${i}`}>
                                    <span className="field-name">{change.field}</span>:
                                    <span className="old-value">{JSON.stringify(change.oldValue)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        );
    };

    // Render a diff view comparing two versions
    const renderDiffView = () => {
        if (!selectedVersion || !compareVersion) return null;

        return (
            <div className="diff-view">
                <div className="diff-header">
                    <div className="version-info">
                        <h4>Comparing Changes</h4>
                        <div className="comparison">
                            <div className="version from">
                                <span className="label">From:</span>
                                <span className="value">{compareVersion.message || `Version at ${formatDate(compareVersion.timestamp)}`}</span>
                            </div>
                            <FiArrowRight className="diff-arrow" />
                            <div className="version to">
                                <span className="label">To:</span>
                                <span className="value">{selectedVersion.message || `Version at ${formatDate(selectedVersion.timestamp)}`}</span>
                            </div>
                        </div>
                    </div>
                    <button className="exit-diff-btn" onClick={() => setDiffView(false)}>
                        Exit Diff View
                    </button>
                </div>

                <div className="combined-changes">
                    {renderChanges(selectedVersion)}
                </div>
            </div>
        );
    };

    // Show loading indicator
    if (loading) {
        return <div className="version-history-loading">Loading version history...</div>;
    }

    // Show error message
    if (error) {
        return <div className="version-history-error">{error}</div>;
    }

    return (
        <div className="version-history-container">
            <div className="version-history-sidebar">
                <h3>Version History</h3>
                {versions.length === 0 ? (
                    <div className="no-versions">No version history available</div>
                ) : (
                    <ul className="versions-list">
                        {versions.map((version) => (
                            <li
                                key={version.id}
                                className={`version-item ${version.id === selectedVersion?.id ? 'selected' : ''} ${diffView && version.id === compareVersion?.id ? 'compare-selected' : ''}`}
                                onClick={() => diffView ? handleCompareVersionChange(version) : handleVersionSelect(version)}
                            >
                                {getVersionIcon(version)}
                                <div className="version-meta">
                                    <div className="version-title">
                                        {version.message || `Changes at ${formatDate(version.timestamp)}`}
                                    </div>
                                    <div className="version-details">
                                        <span className="version-author">
                                            <FiUser /> {version.userName || 'Unknown'}
                                        </span>
                                        <span className="version-time">
                                            <FiClock /> {formatTimeDiff(version.timestamp)}
                                        </span>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="version-history-detail">
                {selectedVersion ? (
                    <>
                        <div className="version-header">
                            <h3>
                                {diffView ? 'Comparing Versions' : 'Version Details'}
                            </h3>
                            <div className="version-actions">
                                {!diffView && versions.length > 1 && (
                                    <button className="diff-btn" onClick={handleEnableDiffView}>
                                        Compare Versions
                                    </button>
                                )}

                                {diffView && (
                                    <button className="exit-diff-btn" onClick={() => setDiffView(false)}>
                                        Exit Compare Mode
                                    </button>
                                )}

                                <button className="restore-btn" onClick={() => onVersionSelect(selectedVersion)}>
                                    Restore This Version
                                </button>
                            </div>
                        </div>

                        {diffView ? (
                            renderDiffView()
                        ) : (
                            <div className="version-content">
                                <div className="version-info">
                                    <h4>{selectedVersion.message || 'Version Details'}</h4>
                                    <div className="version-meta-full">
                                        <div className="meta-item">
                                            <FiUser className="meta-icon" />
                                            <span>{selectedVersion.userName || 'Unknown user'}</span>
                                        </div>
                                        <div className="meta-item">
                                            <FiClock className="meta-icon" />
                                            <span>{formatDate(selectedVersion.timestamp)}</span>
                                        </div>
                                        {selectedVersion.type && (
                                            <div className="meta-item">
                                                {getVersionIcon(selectedVersion)}
                                                <span>{selectedVersion.type}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <h4>Changes in this version:</h4>
                                {renderChanges(selectedVersion)}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="no-selection">
                        Select a version to view details
                    </div>
                )}
            </div>
        </div>
    );
};

export default VersionHistory;