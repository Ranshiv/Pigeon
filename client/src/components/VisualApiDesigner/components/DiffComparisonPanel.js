import React, { useState, useMemo } from 'react';
import {
    FiEye,
    FiCode,
    FiColumns,
    FiDownload,
    FiCopy,
    FiCheck
} from 'react-icons/fi';
import './DiffComparisonPanel.css';

const DiffComparisonPanel = ({ originalSpec, modifiedSpec, changes }) => {
    const [viewMode, setViewMode] = useState('side-by-side'); // side-by-side, unified, visual
    const [copied, setCopied] = useState(false);

    // Create a unified diff view
    const unifiedDiff = useMemo(() => {
        if (!originalSpec || !modifiedSpec) return '';

        try {
            const original = JSON.stringify(originalSpec, null, 2);
            const modified = JSON.stringify(modifiedSpec, null, 2);

            // Simple diff highlighting (in a real implementation, you'd use a proper diff library)
            const originalLines = original.split('\n');
            const modifiedLines = modified.split('\n');

            return {
                original: originalLines,
                modified: modifiedLines
            };
        } catch (error) {
            console.error('Error creating diff:', error);
            return { original: [], modified: [] };
        }
    }, [originalSpec, modifiedSpec]);

    const handleCopyDiff = async () => {
        try {
            const diffText = JSON.stringify({
                original: originalSpec,
                modified: modifiedSpec,
                changes: changes
            }, null, 2);

            await navigator.clipboard.writeText(diffText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy diff:', error);
        }
    };

    const handleDownloadDiff = () => {
        const diffData = {
            original: originalSpec,
            modified: modifiedSpec,
            changes: changes,
            generatedAt: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(diffData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `api-diff-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const renderSideBySideView = () => (
        <div className="side-by-side-view">
            <div className="spec-panel original">
                <div className="panel-header">
                    <h4>Original Version</h4>
                </div>
                <div className="spec-content">
                    <pre>
                        <code>{JSON.stringify(originalSpec, null, 2)}</code>
                    </pre>
                </div>
            </div>

            <div className="spec-panel modified">
                <div className="panel-header">
                    <h4>Modified Version</h4>
                </div>
                <div className="spec-content">
                    <pre>
                        <code>{JSON.stringify(modifiedSpec, null, 2)}</code>
                    </pre>
                </div>
            </div>
        </div>
    );

    const renderUnifiedView = () => (
        <div className="unified-view">
            <div className="unified-panel">
                <div className="panel-header">
                    <h4>Unified Diff View</h4>
                </div>
                <div className="diff-content">
                    <div className="diff-lines">
                        {unifiedDiff.original.map((line, index) => {
                            const modifiedLine = unifiedDiff.modified[index];
                            const isChanged = line !== modifiedLine;

                            return (
                                <div key={`line-${index}`} className="diff-line-group">
                                    {isChanged && (
                                        <>
                                            <div className="diff-line removed">
                                                <span className="line-number">-{index + 1}</span>
                                                <span className="line-content">{line}</span>
                                            </div>
                                            {modifiedLine && (
                                                <div className="diff-line added">
                                                    <span className="line-number">+{index + 1}</span>
                                                    <span className="line-content">{modifiedLine}</span>
                                                </div>
                                            )}
                                        </>
                                    )}
                                    {!isChanged && (
                                        <div className="diff-line unchanged">
                                            <span className="line-number">{index + 1}</span>
                                            <span className="line-content">{line}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );

    const renderVisualView = () => (
        <div className="visual-view">
            <div className="visual-panel">
                <div className="panel-header">
                    <h4>Visual Comparison</h4>
                </div>
                <div className="visual-content">
                    <div className="endpoints-comparison">
                        {changes
                            .filter(change => change.path.includes('/paths/'))
                            .map((change, index) => (
                                <div key={index} className="endpoint-change">
                                    <div className="endpoint-info">
                                        <span className="method">{change.method || 'GET'}</span>
                                        <span className="path">{change.path.split('/paths/')[1]?.split('/')[0] || change.path}</span>
                                    </div>
                                    <div className="change-type">
                                        <span className={`change-badge ${change.type}`}>
                                            {change.type}
                                        </span>
                                    </div>
                                </div>
                            ))
                        }
                    </div>

                    {changes.filter(change => change.path.includes('/paths/')).length === 0 && (
                        <div className="no-visual-changes">
                            <FiEye className="icon" />
                            <p>No visual endpoint changes to display</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    if (!originalSpec || !modifiedSpec) {
        return (
            <div className="diff-comparison-panel">
                <div className="no-specs-message">
                    <FiCode className="icon" />
                    <h3>No Specifications to Compare</h3>
                    <p>Select two versions to view detailed comparison</p>
                </div>
            </div>
        );
    }

    return (
        <div className="diff-comparison-panel">
            <div className="comparison-header">
                <div className="view-mode-selector">
                    <button
                        className={`view-mode-btn ${viewMode === 'side-by-side' ? 'active' : ''}`}
                        onClick={() => setViewMode('side-by-side')}
                        title="Side by side view"
                    >
                        <FiColumns />
                        Side by Side
                    </button>

                    <button
                        className={`view-mode-btn ${viewMode === 'unified' ? 'active' : ''}`}
                        onClick={() => setViewMode('unified')}
                        title="Unified diff view"
                    >
                        <FiCode />
                        Unified
                    </button>

                    <button
                        className={`view-mode-btn ${viewMode === 'visual' ? 'active' : ''}`}
                        onClick={() => setViewMode('visual')}
                        title="Visual comparison"
                    >
                        <FiEye />
                        Visual
                    </button>
                </div>

                <div className="comparison-actions">
                    <button
                        className="action-btn"
                        onClick={handleCopyDiff}
                        title="Copy diff to clipboard"
                    >
                        {copied ? <FiCheck /> : <FiCopy />}
                        {copied ? 'Copied!' : 'Copy'}
                    </button>

                    <button
                        className="action-btn"
                        onClick={handleDownloadDiff}
                        title="Download diff as JSON"
                    >
                        <FiDownload />
                        Download
                    </button>
                </div>
            </div>

            <div className="comparison-content">
                {viewMode === 'side-by-side' && renderSideBySideView()}
                {viewMode === 'unified' && renderUnifiedView()}
                {viewMode === 'visual' && renderVisualView()}
            </div>
        </div>
    );
};

export default DiffComparisonPanel;
