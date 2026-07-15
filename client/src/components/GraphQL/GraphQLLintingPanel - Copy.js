// client/src/components/GraphQL/GraphQLLintingPanel.js
import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../../context/ThemeContext';
import './GraphQLLintingPanel.css';

/**
 * GraphQL Linting Panel Component
 * Displays linting results, best practices validation, and optimization suggestions
 * Following 2025 Pigeon UI design standards with theme support
 */

const GraphQLLintingPanel = ({
    query,
    onLintComplete,
    autoLint = true,
    debounceMs = 500,
    preset = 'standard',
    collapsed = false,
    onToggleCollapse
}) => {
    const { theme } = useTheme();
    const [lintResults, setLintResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [selectedPreset, setSelectedPreset] = useState(preset);
    const [presets, setPresets] = useState([]);
    const [rules, setRules] = useState([]);
    const [activeTab, setActiveTab] = useState('issues');
    const [expandedIssues, setExpandedIssues] = useState(new Set());
    const [showRulesModal, setShowRulesModal] = useState(false);

    const lintQuery = useCallback(async () => {
        if (!query || query.trim() === '') {
            setLintResults(null);
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/graphql/lint', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query,
                    preset: selectedPreset
                })
            });
            const data = await res.json();

            if (data.success) {
                setLintResults(data.results);
                onLintComplete?.(data.results);
            }
        } catch (error) {
            console.error('Lint failed:', error);
        } finally {
            setLoading(false);
        }
    }, [query, selectedPreset, onLintComplete]);

    // Fetch available presets and rules on mount
    useEffect(() => {
        fetchPresets();
        fetchRules();
    }, []);

    // Auto-lint on query change
    useEffect(() => {
        if (autoLint && query) {
            const timer = setTimeout(() => {
                lintQuery();
            }, debounceMs);
            return () => clearTimeout(timer);
        }
    }, [query, selectedPreset, autoLint, debounceMs, lintQuery]);

    const fetchPresets = async () => {
        try {
            const res = await fetch('/api/graphql/lint/presets');
            const data = await res.json();
            if (data.success) {
                setPresets(data.presets);
            }
        } catch (error) {
            console.error('Failed to fetch presets:', error);
        }
    };

    const fetchRules = async () => {
        try {
            const res = await fetch('/api/graphql/lint/rules');
            const data = await res.json();
            if (data.success) {
                setRules(data.rules);
            }
        } catch (error) {
            console.error('Failed to fetch rules:', error);
        }
    };

    const toggleIssueExpanded = (issueId) => {
        setExpandedIssues(prev => {
            const next = new Set(prev);
            if (next.has(issueId)) {
                next.delete(issueId);
            } else {
                next.add(issueId);
            }
            return next;
        });
    };

    const getSeverityIcon = (severity) => {
        switch (severity) {
            case 'error':
                return (
                    <svg className="severity-icon error" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                    </svg>
                );
            case 'warning':
                return (
                    <svg className="severity-icon warning" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                    </svg>
                );
            case 'suggestion':
                return (
                    <svg className="severity-icon suggestion" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z" />
                    </svg>
                );
            case 'info':
                return (
                    <svg className="severity-icon info" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                    </svg>
                );
            default:
                return null;
        }
    };

    const getCategoryIcon = (category) => {
        switch (category) {
            case 'security':
                return (
                    <svg className="category-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
                    </svg>
                );
            case 'performance':
                return (
                    <svg className="category-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19.03 3.56c-1.67-1.39-3.74-2.3-6.03-2.51v2.01c1.73.19 3.31.88 4.61 1.92l1.42-1.42zM11 3.06V1.05c-2.29.2-4.36 1.12-6.03 2.51l1.42 1.42c1.3-1.04 2.88-1.73 4.61-1.92zM4.97 6.98L3.56 5.57C2.17 7.24 1.26 9.31 1.05 11.6h2.01c.19-1.73.88-3.31 1.91-4.62zM20.94 11.6h2.01c-.21-2.29-1.12-4.36-2.51-6.03l-1.42 1.42c1.04 1.3 1.73 2.88 1.92 4.61z" />
                        <path d="M12 21c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7zm0-12c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5z" />
                        <path d="M12.5 10v5l4.28 2.54-.72 1.21-5.06-3V10h1.5z" />
                    </svg>
                );
            case 'naming':
                return (
                    <svg className="category-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M2.5 4v3h5v12h3V7h5V4h-13zm19 5h-9v3h3v7h3v-7h3V9z" />
                    </svg>
                );
            case 'best-practices':
                return (
                    <svg className="category-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
                    </svg>
                );
            default:
                return (
                    <svg className="category-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                );
        }
    };

    const getScoreColor = (score) => {
        if (score >= 80) return 'excellent';
        if (score >= 60) return 'good';
        if (score >= 40) return 'fair';
        return 'poor';
    };

    const renderIssue = (issue, index, type) => {
        const issueId = `${type}-${index}`;
        const isExpanded = expandedIssues.has(issueId);

        return (
            <div
                key={issueId}
                className={`lint-issue ${issue.severity} ${isExpanded ? 'expanded' : ''}`}
                onClick={() => toggleIssueExpanded(issueId)}
            >
                <div className="issue-header">
                    {getSeverityIcon(issue.severity)}
                    <span className="issue-message">{issue.message}</span>
                    {issue.line && (
                        <span className="issue-location">Line {issue.line}</span>
                    )}
                    <svg className="expand-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d={isExpanded ? "M7 14l5-5 5 5z" : "M7 10l5 5 5-5z"} />
                    </svg>
                </div>
                {isExpanded && (
                    <div className="issue-details">
                        <div className="detail-row">
                            <span className="detail-label">Rule:</span>
                            <span className="detail-value">{issue.ruleId}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Category:</span>
                            <span className={`category-badge ${issue.category}`}>
                                {getCategoryIcon(issue.category)}
                                {issue.category}
                            </span>
                        </div>
                        {issue.fix && (
                            <div className="detail-row">
                                <span className="detail-label">Fix:</span>
                                <span className="detail-value fix-suggestion">
                                    {issue.fix.type === 'rename' && `Rename to: ${issue.fix.value}`}
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const renderSuggestion = (suggestion, index) => (
        <div key={index} className={`optimization-suggestion priority-${suggestion.priority}`}>
            <div className="suggestion-header">
                <span className={`priority-badge ${suggestion.priority}`}>
                    {suggestion.priority}
                </span>
                <h4 className="suggestion-title">{suggestion.title}</h4>
            </div>
            <p className="suggestion-description">{suggestion.description}</p>
            {suggestion.example && (
                <pre className="suggestion-example">
                    <code>{suggestion.example}</code>
                </pre>
            )}
            {suggestion.tips && (
                <ul className="suggestion-tips">
                    {suggestion.tips.map((tip, i) => (
                        <li key={i}>{tip}</li>
                    ))}
                </ul>
            )}
        </div>
    );

    const renderBestPractice = (practice, index) => (
        <div key={index} className="best-practice-card">
            <div className="practice-header">
                {getCategoryIcon(practice.category)}
                <h4 className="practice-title">{practice.title}</h4>
            </div>
            <p className="practice-description">{practice.description}</p>
            {practice.example && (
                <pre className="practice-example">
                    <code>{practice.example}</code>
                </pre>
            )}
            {practice.recommendation && (
                <p className="practice-recommendation">
                    <strong>Recommendation:</strong> {practice.recommendation}
                </p>
            )}
        </div>
    );

    const totalIssues = lintResults ?
        lintResults.errors.length +
        lintResults.warnings.length +
        lintResults.suggestions.length +
        lintResults.info.length : 0;

    if (collapsed) {
        return (
            <div className={`graphql-linting-panel collapsed ${theme}`}>
                <button
                    className="expand-panel-button"
                    onClick={onToggleCollapse}
                    title="Expand Linting Panel"
                >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                    <span>Lint</span>
                    {totalIssues > 0 && (
                        <span className="issue-count-badge">{totalIssues}</span>
                    )}
                </button>
            </div>
        );
    }

    return (
        <div className={`graphql-linting-panel ${theme}`}>
            {/* Header */}
            <div className="linting-header">
                <div className="header-left">
                    <h3 className="panel-title">
                        <svg className="panel-icon" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                        </svg>
                        GraphQL Linting
                    </h3>
                    {lintResults && (
                        <div className={`score-badge ${getScoreColor(lintResults.score)}`}>
                            {lintResults.score}/100
                        </div>
                    )}
                </div>
                <div className="header-right">
                    <select
                        className="preset-select"
                        value={selectedPreset}
                        onChange={(e) => setSelectedPreset(e.target.value)}
                    >
                        {presets.map(p => (
                            <option key={p.name} value={p.name}>
                                {p.name.charAt(0).toUpperCase() + p.name.slice(1)}
                            </option>
                        ))}
                    </select>
                    <button
                        className="rules-button"
                        onClick={() => setShowRulesModal(true)}
                        title="View Rules"
                    >
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" />
                        </svg>
                    </button>
                    <button
                        className="lint-button"
                        onClick={lintQuery}
                        disabled={loading || !query}
                    >
                        {loading ? (
                            <span className="loading-spinner"></span>
                        ) : (
                            <>
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
                                </svg>
                                Lint
                            </>
                        )}
                    </button>
                    {onToggleCollapse && (
                        <button
                            className="collapse-button"
                            onClick={onToggleCollapse}
                            title="Collapse Panel"
                        >
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="linting-tabs">
                <button
                    className={`tab-button ${activeTab === 'issues' ? 'active' : ''}`}
                    onClick={() => setActiveTab('issues')}
                >
                    Issues
                    {lintResults && totalIssues > 0 && (
                        <span className="tab-badge">{totalIssues}</span>
                    )}
                </button>
                <button
                    className={`tab-button ${activeTab === 'suggestions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('suggestions')}
                >
                    Suggestions
                    {lintResults?.suggestions?.length > 0 && (
                        <span className="tab-badge">{lintResults.suggestions.length}</span>
                    )}
                </button>
                <button
                    className={`tab-button ${activeTab === 'best-practices' ? 'active' : ''}`}
                    onClick={() => setActiveTab('best-practices')}
                >
                    Best Practices
                </button>
                <button
                    className={`tab-button ${activeTab === 'metrics' ? 'active' : ''}`}
                    onClick={() => setActiveTab('metrics')}
                >
                    Metrics
                </button>
            </div>

            {/* Content */}
            <div className="linting-content">
                {!query ? (
                    <div className="empty-state">
                        <svg className="empty-icon" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z" />
                        </svg>
                        <p>Write a GraphQL query to see linting results</p>
                    </div>
                ) : loading ? (
                    <div className="loading-state">
                        <div className="loading-spinner large"></div>
                        <p>Analyzing query...</p>
                    </div>
                ) : !lintResults ? (
                    <div className="empty-state">
                        <p>Click "Lint" to analyze your query</p>
                    </div>
                ) : (
                    <>
                        {activeTab === 'issues' && (
                            <div className="issues-tab">
                                {/* Summary */}
                                <div className="issues-summary">
                                    <div className="summary-item errors">
                                        {getSeverityIcon('error')}
                                        <span className="count">{lintResults.errors.length}</span>
                                        <span className="label">Errors</span>
                                    </div>
                                    <div className="summary-item warnings">
                                        {getSeverityIcon('warning')}
                                        <span className="count">{lintResults.warnings.length}</span>
                                        <span className="label">Warnings</span>
                                    </div>
                                    <div className="summary-item suggestions">
                                        {getSeverityIcon('suggestion')}
                                        <span className="count">{lintResults.suggestions.length}</span>
                                        <span className="label">Suggestions</span>
                                    </div>
                                    <div className="summary-item info">
                                        {getSeverityIcon('info')}
                                        <span className="count">{lintResults.info.length}</span>
                                        <span className="label">Info</span>
                                    </div>
                                </div>

                                {/* Issues List */}
                                <div className="issues-list">
                                    {totalIssues === 0 ? (
                                        <div className="no-issues">
                                            <svg className="check-icon" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                                            </svg>
                                            <p>No issues found! Your query follows best practices.</p>
                                        </div>
                                    ) : (
                                        <>
                                            {lintResults.errors.map((issue, i) =>
                                                renderIssue(issue, i, 'error')
                                            )}
                                            {lintResults.warnings.map((issue, i) =>
                                                renderIssue(issue, i, 'warning')
                                            )}
                                            {lintResults.suggestions.map((issue, i) =>
                                                renderIssue(issue, i, 'suggestion')
                                            )}
                                            {lintResults.info.map((issue, i) =>
                                                renderIssue(issue, i, 'info')
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'suggestions' && (
                            <div className="suggestions-tab">
                                {lintResults.suggestions?.length === 0 &&
                                    (!lintResults.bestPractices || lintResults.bestPractices.length === 0) ? (
                                    <div className="no-suggestions">
                                        <p>No optimization suggestions for this query.</p>
                                    </div>
                                ) : (
                                    <div className="suggestions-list">
                                        {(lintResults.suggestions || []).map((s, i) =>
                                            renderSuggestion(s, i)
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'best-practices' && (
                            <div className="best-practices-tab">
                                {lintResults.bestPractices && lintResults.bestPractices.length > 0 ? (
                                    <div className="best-practices-list">
                                        {lintResults.bestPractices.map((bp, i) =>
                                            renderBestPractice(bp, i)
                                        )}
                                    </div>
                                ) : (
                                    <div className="no-practices">
                                        <p>Great! Your query follows GraphQL best practices.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'metrics' && lintResults && lintResults.summary && (
                            <div className="metrics-tab">
                                <div className="metrics-grid">
                                    <div className="metric-card">
                                        <span className="metric-label">Score</span>
                                        <span className={`metric-value score ${getScoreColor(lintResults.score)}`}>
                                            {lintResults.score}
                                        </span>
                                    </div>
                                    <div className="metric-card">
                                        <span className="metric-label">Total Issues</span>
                                        <span className="metric-value">{lintResults.summary.totalIssues || 0}</span>
                                    </div>
                                    <div className="metric-card">
                                        <span className="metric-label">Errors</span>
                                        <span className="metric-value error">{lintResults.summary.errorCount || 0}</span>
                                    </div>
                                    <div className="metric-card">
                                        <span className="metric-label">Warnings</span>
                                        <span className="metric-value warning">{lintResults.summary.warningCount || 0}</span>
                                    </div>
                                </div>

                                {/* Category Breakdown */}
                                {lintResults.summary.byCategory && Object.keys(lintResults.summary.byCategory).length > 0 && (
                                    <div className="category-breakdown">
                                        <h4>Issues by Category</h4>
                                        <div className="categories-list">
                                            {Object.entries(lintResults.summary.byCategory).map(([cat, count]) => (
                                                <div key={cat} className="category-row">
                                                    <span className={`category-badge ${cat}`}>
                                                        {getCategoryIcon(cat)}
                                                        {cat}
                                                    </span>
                                                    <span className="category-count">{count}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Severity Breakdown */}
                                <div className="severity-breakdown">
                                    <h4>Issues by Severity</h4>
                                    <div className="severity-bars">
                                        <div className="severity-bar-row">
                                            <span className="severity-label error">Errors</span>
                                            <div className="severity-bar">
                                                <div
                                                    className="severity-fill error"
                                                    style={{ width: `${Math.min((lintResults.errors?.length || 0) * 20, 100)}%` }}
                                                ></div>
                                            </div>
                                            <span className="severity-count">{lintResults.errors?.length || 0}</span>
                                        </div>
                                        <div className="severity-bar-row">
                                            <span className="severity-label warning">Warnings</span>
                                            <div className="severity-bar">
                                                <div
                                                    className="severity-fill warning"
                                                    style={{ width: `${Math.min((lintResults.warnings?.length || 0) * 10, 100)}%` }}
                                                ></div>
                                            </div>
                                            <span className="severity-count">{lintResults.warnings?.length || 0}</span>
                                        </div>
                                        <div className="severity-bar-row">
                                            <span className="severity-label suggestion">Suggestions</span>
                                            <div className="severity-bar">
                                                <div
                                                    className="severity-fill suggestion"
                                                    style={{ width: `${Math.min((lintResults.suggestions?.length || 0) * 10, 100)}%` }}
                                                ></div>
                                            </div>
                                            <span className="severity-count">{lintResults.suggestions?.length || 0}</span>
                                        </div>
                                        <div className="severity-bar-row">
                                            <span className="severity-label info">Info</span>
                                            <div className="severity-bar">
                                                <div
                                                    className="severity-fill info"
                                                    style={{ width: `${Math.min((lintResults.info?.length || 0) * 10, 100)}%` }}
                                                ></div>
                                            </div>
                                            <span className="severity-count">{lintResults.info?.length || 0}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Rules Modal */}
            {showRulesModal && (
                <div className="rules-modal-overlay" onClick={() => setShowRulesModal(false)}>
                    <div className="rules-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Linting Rules</h3>
                            <button
                                className="close-button"
                                onClick={() => setShowRulesModal(false)}
                            >
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                </svg>
                            </button>
                        </div>
                        <div className="modal-content">
                            {['security', 'performance', 'naming', 'best-practices'].map(category => (
                                <div key={category} className="rule-category">
                                    <h4 className={`category-title ${category}`}>
                                        {getCategoryIcon(category)}
                                        {category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' ')}
                                    </h4>
                                    <div className="rules-list">
                                        {rules
                                            .filter(r => r.category === category)
                                            .map(rule => (
                                                <div key={rule.id} className="rule-item">
                                                    <span className={`severity-dot ${rule.severity}`}></span>
                                                    <div className="rule-info">
                                                        <span className="rule-name">{rule.name}</span>
                                                        <span className="rule-desc">{rule.description}</span>
                                                    </div>
                                                </div>
                                            ))
                                        }
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

GraphQLLintingPanel.propTypes = {
    query: PropTypes.string,
    onLintComplete: PropTypes.func,
    autoLint: PropTypes.bool,
    debounceMs: PropTypes.number,
    preset: PropTypes.string,
    collapsed: PropTypes.bool,
    onToggleCollapse: PropTypes.func
};

export default GraphQLLintingPanel;
