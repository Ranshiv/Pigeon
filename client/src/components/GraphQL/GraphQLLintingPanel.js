// client/src/components/GraphQL/GraphQLLintingPanel.js
import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../../context/ThemeContext';
import AppSelect from '../common/AppSelect/AppSelect';
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
                    <svg className="severity-icon error" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                );
            case 'warning':
                return (
                    <svg className="severity-icon warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                );
            case 'suggestion':
                return (
                    <svg className="severity-icon suggestion" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18h6" />
                        <path d="M10 22h4" />
                        <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8a6 6 0 0 0-12 0c0 1.39.5 2.5 1.5 3.5.76.76 1.23 1.52 1.41 2.5" />
                    </svg>
                );
            case 'info':
                return (
                    <svg className="severity-icon info" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
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
                    <svg className="category-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <circle cx="12" cy="11" r="3" />
                    </svg>
                );
            case 'performance':
                return (
                    <svg className="category-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="13 2 13 10 21 10" />
                        <path d="m21 22-8-8H3v-2.3" />
                    </svg>
                );
            case 'naming':
                return (
                    <svg className="category-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 7V4h16v3" />
                        <path d="M9 20h6" />
                        <path d="M12 4v16" />
                    </svg>
                );
            case 'best-practices':
                return (
                    <svg className="category-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m9 12 2 2 4-4" />
                        <circle cx="12" cy="12" r="10" />
                    </svg>
                );
            default:
                return (
                    <svg className="category-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
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
                        <svg className="panel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            <path d="m9 12 2 2 4-4" />
                        </svg>
                        GraphQL Linting
                        {lintResults && (
                            <span className={`score-badge ${getScoreColor(lintResults.score)}`}>
                                {lintResults.score}/100
                            </span>
                        )}
                    </h3>
                </div>
                <div className="header-right">
                    <AppSelect
                        className="preset-select"
                        value={selectedPreset}
                        onChange={setSelectedPreset}
                        options={presets.map(p => ({
                            value: p.name,
                            label: p.name.charAt(0).toUpperCase() + p.name.slice(1)
                        }))}
                        id="lint-preset-select"
                    />
                    <button
                        className="rules-button"
                        onClick={() => setShowRulesModal(true)}
                        title="Rules"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
                        </svg>
                    </button>
                    <button
                        className="lint-button"
                        onClick={lintQuery}
                        disabled={loading || !query}
                        title="Run Lint"
                    >
                        {loading ? (
                            <span className="loading-spinner"></span>
                        ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                <path d="M3 3v5h5" />
                                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                                <path d="M16 21h5v-5" />
                            </svg>
                        )}
                    </button>
                    {onToggleCollapse && (
                        <button
                            className="collapse-button"
                            onClick={onToggleCollapse}
                            title="Collapse"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M15 18l-6-6 6-6" />
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
                        <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z" />
                            <path d="M12 8v8" />
                            <path d="M8 12h8" />
                        </svg>
                        <h4>Ready to analyze</h4>
                        <p>Enter a query to lint</p>
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
                                    <div className="metric-card score">
                                        <span className="metric-label">Score</span>
                                        <span className={`metric-value score ${getScoreColor(lintResults.score)}`}>
                                            {lintResults.score}
                                        </span>
                                    </div>
                                    <div className="metric-card">
                                        <span className="metric-label">Total</span>
                                        <span className="metric-value">{lintResults.summary.totalIssues || 0}</span>
                                    </div>
                                    <div className="metric-card error">
                                        <span className="metric-label">Errors</span>
                                        <span className="metric-value">{lintResults.summary.errorCount || 0}</span>
                                    </div>
                                    <div className="metric-card warning">
                                        <span className="metric-label">Warnings</span>
                                        <span className="metric-value">{lintResults.summary.warningCount || 0}</span>
                                    </div>
                                    <div className="metric-card suggestion">
                                        <span className="metric-label">Suggestions</span>
                                        <span className="metric-value">{lintResults.summary.suggestionCount || lintResults.suggestions?.length || 0}</span>
                                    </div>
                                    <div className="metric-card info">
                                        <span className="metric-label">Info</span>
                                        <span className="metric-value">{lintResults.summary.infoCount || lintResults.info?.length || 0}</span>
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
                            <h3>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
                                </svg>
                                Linting Rules
                            </h3>
                            <button
                                className="close-button"
                                onClick={() => setShowRulesModal(false)}
                                title="Close"
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 6 6 18" />
                                    <path d="m6 6 12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="modal-content">
                            {['security', 'performance', 'naming', 'best-practices'].map(category => {
                                const categoryRules = rules.filter(r => r.category === category);
                                if (categoryRules.length === 0) return null;
                                return (
                                    <div key={category} className="rule-category">
                                        <h4 className={`category-title ${category}`}>
                                            {getCategoryIcon(category)}
                                            <span>{category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' ')}</span>
                                            <span className="category-count">{categoryRules.length}</span>
                                        </h4>
                                        <div className="rules-list">
                                            {categoryRules.map(rule => (
                                                <div key={rule.id} className="rule-item">
                                                    <span className={`severity-badge ${rule.severity}`}>{rule.severity}</span>
                                                    <div className="rule-info">
                                                        <span className="rule-name">{rule.name}</span>
                                                        <span className="rule-desc">{rule.description}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
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
