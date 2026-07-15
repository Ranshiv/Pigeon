import React, { useState, useMemo, useCallback } from 'react';
import { FiAlertTriangle, FiCheckCircle, FiFilter, FiChevronDown } from 'react-icons/fi';

const ValidationPanel = ({ validationErrors = [], onValidationIssueClick }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [filter, setFilter] = useState('all'); // 'all', 'errors', 'warnings'
    // Normalize issues to consistent shape
    const normalized = (validationErrors || []).map((issue) => {
        if (typeof issue === 'string') {
            return { type: 'error', message: issue };
        }
        if (!issue.type) {
            return { ...issue, type: 'error' };
        }
        return issue;
    });

    const { errors, warnings, totalIssues } = useMemo(() => {
        const errs = normalized.filter(issue => issue.type === 'error');
        const warns = normalized.filter(issue => issue.type === 'warning');
        return { errors: errs, warnings: warns, totalIssues: normalized.length };
    }, [normalized]);

    const filteredIssues = normalized.filter(issue => {
        if (filter === 'errors') return issue.type === 'error';
        if (filter === 'warnings') return issue.type === 'warning';
        return true;
    });

    // Status icon removed in favor of a compact, color-coded status chip

    const getStatusText = () => {
        if (errors.length === 0 && warnings.length === 0) return 'Valid';
        const parts = [];
        if (errors.length) parts.push(`${errors.length} error${errors.length > 1 ? 's' : ''}`);
        if (warnings.length) parts.push(`${warnings.length} warning${warnings.length > 1 ? 's' : ''}`);
        return parts.join(' • ');
    };

    const getStatusClass = () => {
        if (errors.length > 0) return 'error';
        if (warnings.length > 0) return 'warning';
        return 'success';
    };

    const onHeaderKeyDown = useCallback((e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsCollapsed((c) => !c);
        }
    }, []);

    return (
        <div
            className={`validation-panel ${isCollapsed ? 'collapsed' : ''}`}
            role="region"
            aria-label="Validation"
            data-status={getStatusClass()}
        >
            <div
                className="validation-header"
                onClick={() => setIsCollapsed(!isCollapsed)}
                onKeyDown={onHeaderKeyDown}
                role="button"
                tabIndex={0}
                aria-expanded={!isCollapsed}
                title="Toggle validation panel"
            >
                <div className="validation-status">
                    {/* status chip */}
                    <div className={`status-chip ${getStatusClass()}`}>
                        <span className="dot" aria-hidden />
                        <span className="label">{getStatusText()}</span>
                    </div>
                    <span className="status-text">{totalIssues === 0 ? 'Validation' : 'Validation issues'}</span>
                </div>

                <div className="validation-controls">
                    {!isCollapsed && totalIssues > 0 && (
                        <div className="filter-dropdown" onClick={(e) => e.stopPropagation()}>
                            <FiFilter className="filter-icon" />
                            <select
                                aria-label="Filter issues"
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="filter-select"
                            >
                                <option value="all">All</option>
                                {errors.length > 0 && <option value="errors">Errors</option>}
                                {warnings.length > 0 && <option value="warnings">Warnings</option>}
                            </select>
                        </div>
                    )}

                    <button
                        className="collapse-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsCollapsed(!isCollapsed);
                        }}
                        aria-label={isCollapsed ? 'Expand validation panel' : 'Collapse validation panel'}
                    >
                        <FiChevronDown className={`chevron ${isCollapsed ? 'collapsed' : ''}`} />
                    </button>
                </div>
            </div>

            {!isCollapsed && (
                <div className="validation-content">
                    {totalIssues === 0 ? (
                        <div className="no-issues card-valid" aria-live="polite">
                            <FiCheckCircle className="success-icon" />
                            <div className="no-issues-text">
                                <h4>No validation issues found</h4>
                                <p>Your API specification is valid and ready to use.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="issues-list" role="list">
                            {filteredIssues.map((issue, index) => (
                                <div
                                    role="listitem"
                                    key={`${issue.path || issue.message}-${index}`}
                                    className={`issue-item ${issue.type}`}
                                    onClick={() => onValidationIssueClick && onValidationIssueClick(issue)}
                                >
                                    <div className="issue-icon" aria-hidden>
                                        <FiAlertTriangle />
                                    </div>
                                    <div className="issue-content">
                                        <div className="issue-message">{issue.message}</div>
                                        {issue.path && (
                                            <div className="issue-path">
                                                Path: {issue.path}
                                            </div>
                                        )}
                                    </div>
                                    <div className="issue-type" aria-label={`Type: ${issue.type}`}>
                                        {issue.type}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ValidationPanel;
