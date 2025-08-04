import React, { useState } from 'react';
import { FiAlertTriangle, FiCheckCircle, FiFilter, FiChevronDown } from 'react-icons/fi';

const ValidationPanel = ({ validationErrors = [], onValidationIssueClick }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [filter, setFilter] = useState('all'); // 'all', 'errors', 'warnings'

    const errors = validationErrors.filter(issue => issue.type === 'error');
    const warnings = validationErrors.filter(issue => issue.type === 'warning');
    const totalIssues = validationErrors.length;

    const filteredIssues = validationErrors.filter(issue => {
        if (filter === 'errors') return issue.type === 'error';
        if (filter === 'warnings') return issue.type === 'warning';
        return true;
    });

    const getStatusIcon = () => {
        if (errors.length > 0) {
            return <FiAlertTriangle className="status-icon error" />;
        } else if (warnings.length > 0) {
            return <FiAlertTriangle className="status-icon warning" />;
        } else {
            return <FiCheckCircle className="status-icon success" />;
        }
    };

    const getStatusText = () => {
        if (errors.length === 0 && warnings.length === 0) {
            return "Valid";
        }
        return `${errors.length} Errors! ${warnings.length} Warnings`;
    };

    const getStatusClass = () => {
        if (errors.length > 0) return 'error';
        if (warnings.length > 0) return 'warning';
        return 'success';
    };

    return (
        <div className={`validation-panel ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="validation-header" onClick={() => setIsCollapsed(!isCollapsed)}>
                <div className="validation-status">
                    {getStatusIcon()}
                    <span className={`status-text ${getStatusClass()}`}>
                        Validation Issues
                    </span>
                    <span className={`status-count ${getStatusClass()}`}>
                        {getStatusText()}
                    </span>
                </div>

                <div className="validation-controls">
                    {!isCollapsed && totalIssues > 0 && (
                        <div className="filter-dropdown">
                            <FiFilter className="filter-icon" />
                            <select
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="filter-select"
                            >
                                <option value="all">All Issues</option>
                                {errors.length > 0 && <option value="errors">Errors Only</option>}
                                {warnings.length > 0 && <option value="warnings">Warnings Only</option>}
                            </select>
                        </div>
                    )}

                    <button
                        className="collapse-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsCollapsed(!isCollapsed);
                        }}
                    >
                        <FiChevronDown className={`chevron ${isCollapsed ? 'collapsed' : ''}`} />
                    </button>
                </div>
            </div>

            {!isCollapsed && (
                <div className="validation-content">
                    {totalIssues === 0 ? (
                        <div className="no-issues">
                            <FiCheckCircle className="success-icon" />
                            <div className="no-issues-text">
                                <h4>No validation issues found</h4>
                                <p>Your API specification is valid and ready to use.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="issues-list">
                            {filteredIssues.map((issue, index) => (
                                <div
                                    key={`${issue.path}-${index}`}
                                    className={`issue-item ${issue.type}`}
                                    onClick={() => onValidationIssueClick && onValidationIssueClick(issue)}
                                >
                                    <div className="issue-icon">
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
                                    <div className="issue-type">
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
