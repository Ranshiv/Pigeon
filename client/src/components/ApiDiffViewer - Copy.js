import React, { useState, useEffect, useCallback } from 'react';
import {
    FiGitBranch, FiAlertTriangle, FiInfo,
    FiDownload, FiChevronDown, FiChevronRight
} from 'react-icons/fi';
import './ApiDiffViewer.css';

const ApiDiffViewer = ({ baseVersionId, newVersionId, onClose }) => {
    const [diffResult, setDiffResult] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [expandedSections, setExpandedSections] = useState({
        summary: true,
        breakingChanges: true,
        nonBreakingChanges: false,
        changelog: false,
        technical: false
    });
    const [selectedFormat] = useState('json');

    const performDiff = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `/api/api-versions/${baseVersionId}/diff/${newVersionId}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        format: selectedFormat,
                        includeNonBreaking: true,
                        generateChangelog: true
                    })
                }
            );

            if (response.ok) {
                const data = await response.json();
                setDiffResult(data);
            } else {
                throw new Error('Failed to generate diff');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [baseVersionId, newVersionId, selectedFormat]);

    useEffect(() => {
        if (baseVersionId && newVersionId) {
            // Check if trying to compare same version
            if (baseVersionId === newVersionId) {
                setError('Cannot compare the same version against itself. Please select different versions.');
                return;
            }
            performDiff();
        }
    }, [baseVersionId, newVersionId, performDiff]);

    const toggleSection = (section) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const downloadReport = async (format) => {
        try {
            const response = await fetch(
                `/api/api-versions/${baseVersionId}/diff/${newVersionId}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        format,
                        includeNonBreaking: true,
                        generateChangelog: true
                    })
                }
            );

            if (response.ok) {
                const data = await response.json();
                const blob = new Blob(
                    [format === 'json' ? JSON.stringify(data, null, 2) : data.diffResult],
                    { type: format === 'html' ? 'text/html' : 'text/plain' }
                );
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `api-diff-${baseVersionId}-${newVersionId}.${format}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        } catch (err) {
            console.error('Failed to download report:', err);
        }
    };

    const getSeverityIcon = (severity) => {
        switch (severity) {
            case 'error':
                return <FiAlertTriangle className="severity-error" />;
            case 'warning':
                return <FiAlertTriangle className="severity-warning" />;
            default:
                return <FiInfo className="severity-info" />;
        }
    };

    const getSeverityClass = (severity) => {
        return `change-item ${severity}`;
    };

    if (isLoading) {
        return (
            <div className="api-diff-viewer">
                <div className="modal-container">
                    <div className="diff-header">
                        <div className="header-content">
                            <h3><FiGitBranch /> API Diff Analysis</h3>
                        </div>
                        <div className="header-actions">
                            <button className="close-btn" onClick={onClose}>✕</button>
                        </div>
                    </div>
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <h3>Analyzing API Differences</h3>
                        <p>Comparing specifications and detecting changes...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="api-diff-viewer">
                <div className="modal-container">
                    <div className="diff-header">
                        <div className="header-content">
                            <h3><FiGitBranch /> API Diff Analysis</h3>
                        </div>
                        <div className="header-actions">
                            <button className="close-btn" onClick={onClose}>✕</button>
                        </div>
                    </div>
                    <div className="error-state">
                        <FiAlertTriangle />
                        <h3>Analysis Failed</h3>
                        <p>{error}</p>
                        <button onClick={performDiff} className="retry-btn">
                            Retry Analysis
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!diffResult) {
        return (
            <div className="api-diff-viewer">
                <div className="modal-container">
                    <div className="diff-header">
                        <div className="header-content">
                            <h3><FiGitBranch /> API Diff Analysis</h3>
                        </div>
                        <div className="header-actions">
                            <button className="close-btn" onClick={onClose}>✕</button>
                        </div>
                    </div>
                    <div className="empty-state">
                        <div className="empty-icon">📊</div>
                        <h3>No Data Available</h3>
                        <p>Unable to load diff analysis results.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="api-diff-viewer">
            <div className="modal-container">
                <div className="diff-header">
                    <div className="header-content">
                        <h3><FiGitBranch /> API Diff Analysis</h3>
                        <div className="version-info">
                            <span className="version-badge base">Base: {diffResult.baseVersion || 'Unknown'}</span>
                            <span className="arrow">→</span>
                            <span className="version-badge new">New: {diffResult.newVersion || 'Unknown'}</span>
                        </div>
                    </div>
                    <div className="header-actions">
                        <div className="download-group">
                            <button
                                onClick={() => downloadReport('html')}
                                className="download-btn"
                                title="Download HTML Report"
                            >
                                <FiDownload /> HTML
                            </button>
                            <button
                                onClick={() => downloadReport('markdown')}
                                className="download-btn"
                                title="Download Markdown Report"
                            >
                                <FiDownload /> MD
                            </button>
                            <button
                                onClick={() => downloadReport('json')}
                                className="download-btn"
                                title="Download JSON Report"
                            >
                                <FiDownload /> JSON
                            </button>
                        </div>
                        <button className="close-btn" onClick={onClose}>✕</button>
                    </div>
                </div>

                <div className="diff-content">
                    {/* Summary Section */}
                    <div className="diff-section">
                        <div
                            className="section-header"
                            onClick={() => toggleSection('summary')}
                        >
                            {expandedSections.summary ? <FiChevronDown /> : <FiChevronRight />}
                            <h4>📊 Summary</h4>
                            <div className="summary-badges">
                                {diffResult.hasBreakingChanges && (
                                    <span className="badge breaking">Breaking Changes</span>
                                )}
                                <span className="badge total">
                                    {diffResult.summary?.totalChanges || 0} Changes
                                </span>
                            </div>
                        </div>

                        {expandedSections.summary && (
                            <div className={`section-content ${(!diffResult.summary?.totalChanges &&
                                !diffResult.summary?.breakingChanges &&
                                !diffResult.summary?.nonBreakingChanges &&
                                !diffResult.summary?.addedEndpoints &&
                                !diffResult.summary?.removedEndpoints &&
                                !diffResult.summary?.modifiedEndpoints) ? 'empty' : ''}`}>
                                {/* Check if all metrics are 0 for empty state */}
                                {(!diffResult.summary?.totalChanges &&
                                    !diffResult.summary?.breakingChanges &&
                                    !diffResult.summary?.nonBreakingChanges &&
                                    !diffResult.summary?.addedEndpoints &&
                                    !diffResult.summary?.removedEndpoints &&
                                    !diffResult.summary?.modifiedEndpoints) ? (
                                    <div className="empty-state">
                                        <div className="empty-state-icon">🎯</div>
                                        <h3>No Changes Detected</h3>
                                        <p>The API specifications are identical between these versions.</p>
                                    </div>
                                ) : (
                                    <div className="summary-grid">
                                        <div className="summary-card breaking">
                                            <div className="summary-number">
                                                {diffResult.summary?.breakingChanges || 0}
                                            </div>
                                            <div className="summary-label">Breaking Changes</div>
                                            <div className="summary-description">
                                                Changes that may break existing clients
                                            </div>
                                        </div>
                                        <div className="summary-card non-breaking">
                                            <div className="summary-number">
                                                {diffResult.summary?.nonBreakingChanges || 0}
                                            </div>
                                            <div className="summary-label">Non-Breaking</div>
                                            <div className="summary-description">
                                                Backward compatible changes
                                            </div>
                                        </div>
                                        <div className="summary-card added">
                                            <div className="summary-number">
                                                {diffResult.summary?.addedEndpoints || 0}
                                            </div>
                                            <div className="summary-label">Added Endpoints</div>
                                            <div className="summary-description">
                                                New API endpoints introduced
                                            </div>
                                        </div>
                                        <div className="summary-card removed">
                                            <div className="summary-number">
                                                {diffResult.summary?.removedEndpoints || 0}
                                            </div>
                                            <div className="summary-label">Removed Endpoints</div>
                                            <div className="summary-description">
                                                Deprecated or removed endpoints
                                            </div>
                                        </div>
                                        <div className="summary-card modified">
                                            <div className="summary-number">
                                                {diffResult.summary?.modifiedEndpoints || 0}
                                            </div>
                                            <div className="summary-label">Modified Endpoints</div>
                                            <div className="summary-description">
                                                Existing endpoints with changes
                                            </div>
                                        </div>
                                        <div className="summary-card total">
                                            <div className="summary-number">
                                                {diffResult.summary?.totalChanges || 0}
                                            </div>
                                            <div className="summary-label">Total Changes</div>
                                            <div className="summary-description">
                                                Overall modifications detected
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Non-Breaking Changes Section */}
                    {diffResult.nonBreakingChanges && diffResult.nonBreakingChanges.length > 0 && (
                        <div className="diff-section">
                            <div
                                className="section-header"
                                onClick={() => toggleSection('nonBreakingChanges')}
                            >
                                {expandedSections.nonBreakingChanges ? <FiChevronDown /> : <FiChevronRight />}
                                <h4>✅ Non-Breaking Changes ({diffResult.nonBreakingChanges.length})</h4>
                            </div>

                            {expandedSections.nonBreakingChanges && (
                                <div className="section-content">
                                    <div className="changes-list">
                                        {diffResult.nonBreakingChanges.map((change, index) => (
                                            <div key={index} className={getSeverityClass(change.severity || 'info')}>
                                                <div className="change-header">
                                                    {getSeverityIcon(change.severity || 'info')}
                                                    <span className="change-action">{change.action?.toUpperCase()}</span>
                                                    <span className="change-type">{change.type}</span>
                                                </div>
                                                <div className="change-description">
                                                    {change.description}
                                                </div>
                                                {change.location && (
                                                    <div className="change-location">
                                                        <code>{change.location}</code>
                                                    </div>
                                                )}
                                                {change.source && change.destination && (
                                                    <div className="change-values">
                                                        <span className="old-value">Old: {change.source}</span>
                                                        <span className="new-value">New: {change.destination}</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Breaking Changes Section */}
                    {diffResult.breakingChanges && diffResult.breakingChanges.length > 0 && (
                        <div className="diff-section">
                            <div
                                className="section-header"
                                onClick={() => toggleSection('breakingChanges')}
                            >
                                {expandedSections.breakingChanges ? <FiChevronDown /> : <FiChevronRight />}
                                <h4>🚨 Breaking Changes ({diffResult.breakingChanges.length})</h4>
                            </div>

                            {expandedSections.breakingChanges && (
                                <div className="section-content">
                                    <div className="changes-list">
                                        {diffResult.breakingChanges.map((change, index) => (
                                            <div key={index} className={getSeverityClass(change.severity)}>
                                                <div className="change-header">
                                                    {getSeverityIcon(change.severity)}
                                                    <span className="change-action">{change.action?.toUpperCase()}</span>
                                                    <span className="change-type">{change.type}</span>
                                                </div>
                                                <div className="change-description">
                                                    {change.description}
                                                </div>
                                                {change.location && (
                                                    <div className="change-location">
                                                        <code>{change.location}</code>
                                                    </div>
                                                )}
                                                {change.source && change.destination && (
                                                    <div className="change-values">
                                                        <span className="old-value">Old: {change.source}</span>
                                                        <span className="new-value">New: {change.destination}</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Changelog Section */}
                    {diffResult.changelog && (
                        <div className="diff-section">
                            <div
                                className="section-header"
                                onClick={() => toggleSection('changelog')}
                            >
                                {expandedSections.changelog ? <FiChevronDown /> : <FiChevronRight />}
                                <h4>📝 Generated Changelog</h4>
                            </div>

                            {expandedSections.changelog && (
                                <div className="section-content">
                                    <div className="changelog-content">
                                        <pre>{diffResult.changelog}</pre>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Technical Details Section */}
                    <div className="diff-section">
                        <div
                            className="section-header"
                            onClick={() => toggleSection('technical')}
                        >
                            {expandedSections.technical ? <FiChevronDown /> : <FiChevronRight />}
                            <h4>🔧 Technical Details</h4>
                        </div>

                        {expandedSections.technical && (
                            <div className="section-content">
                                <div className="technical-details">
                                    <pre>
                                        {JSON.stringify(diffResult.diffResult, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ApiDiffViewer;
