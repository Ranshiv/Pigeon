import React, { useState } from 'react';
import {
    FiAlertTriangle,
    FiCheckCircle,
    FiChevronDown,
    FiChevronRight,
    FiCode,
    FiPlus,
    FiMinus,
    FiEdit3
} from 'react-icons/fi';
import './ChangesList.css';

const ChangesList = ({ changes, searchTerm }) => {
    const [expandedChanges, setExpandedChanges] = useState(new Set());

    const toggleChangeExpansion = (changeId) => {
        const newExpanded = new Set(expandedChanges);
        if (newExpanded.has(changeId)) {
            newExpanded.delete(changeId);
        } else {
            newExpanded.add(changeId);
        }
        setExpandedChanges(newExpanded);
    };

    const getChangeIcon = (change) => {
        switch (change.type) {
            case 'addition':
                return <FiPlus className="change-icon addition" />;
            case 'removal':
                return <FiMinus className="change-icon removal" />;
            case 'modification':
                return <FiEdit3 className="change-icon modification" />;
            default:
                return <FiCode className="change-icon" />;
        }
    };

    const highlightText = (text, highlight) => {
        if (!highlight) return text;

        const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
        return parts.map((part, index) =>
            part.toLowerCase() === highlight.toLowerCase() ?
                <mark key={index} className="search-highlight">{part}</mark> : part
        );
    };

    if (changes.length === 0) {
        return (
            <div className="changes-list-empty">
                <FiCheckCircle className="empty-icon" />
                <h3>No Changes Found</h3>
                <p>
                    {searchTerm ?
                        'No changes match your search criteria.' :
                        'The selected versions are identical.'
                    }
                </p>
            </div>
        );
    }

    return (
        <div className="changes-list">
            <div className="changes-header">
                <h3>Changes Overview</h3>
                <span className="changes-count">{changes.length} change{changes.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="changes-items">
                {changes.map((change, index) => {
                    const changeId = `${change.path}-${index}`;
                    const isExpanded = expandedChanges.has(changeId);

                    return (
                        <div
                            key={changeId}
                            className={`change-item ${change.breaking ? 'breaking' : 'safe'}`}
                        >
                            <div
                                className="change-header"
                                onClick={() => toggleChangeExpansion(changeId)}
                            >
                                <div className="change-main">
                                    <div className="change-indicators">
                                        {getChangeIcon(change)}
                                        {change.breaking ? (
                                            <FiAlertTriangle className="breaking-indicator" title="Breaking Change" />
                                        ) : (
                                            <FiCheckCircle className="safe-indicator" title="Safe Change" />
                                        )}
                                    </div>

                                    <div className="change-content">
                                        <div className="change-path">
                                            {highlightText(change.path, searchTerm)}
                                        </div>
                                        <div className="change-description">
                                            {highlightText(change.description, searchTerm)}
                                        </div>
                                    </div>
                                </div>

                                <div className="change-actions">
                                    <span className={`change-type ${change.type}`}>
                                        {change.type}
                                    </span>
                                    <button className="expand-btn">
                                        {isExpanded ? <FiChevronDown /> : <FiChevronRight />}
                                    </button>
                                </div>
                            </div>

                            {isExpanded && (
                                <div className="change-details">
                                    {change.details && (
                                        <div className="change-detail-section">
                                            <h4>Details</h4>
                                            <p>{change.details}</p>
                                        </div>
                                    )}

                                    {change.breaking && change.impact && (
                                        <div className="change-detail-section impact">
                                            <h4>Impact</h4>
                                            <p>{change.impact}</p>
                                        </div>
                                    )}

                                    {change.recommendation && (
                                        <div className="change-detail-section recommendation">
                                            <h4>Recommendation</h4>
                                            <p>{change.recommendation}</p>
                                        </div>
                                    )}

                                    {(change.oldValue || change.newValue) && (
                                        <div className="change-detail-section values">
                                            <h4>Value Changes</h4>
                                            <div className="value-comparison">
                                                {change.oldValue && (
                                                    <div className="old-value">
                                                        <span className="value-label">Before:</span>
                                                        <code>{JSON.stringify(change.oldValue, null, 2)}</code>
                                                    </div>
                                                )}
                                                {change.newValue && (
                                                    <div className="new-value">
                                                        <span className="value-label">After:</span>
                                                        <code>{JSON.stringify(change.newValue, null, 2)}</code>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {change.examples && change.examples.length > 0 && (
                                        <div className="change-detail-section examples">
                                            <h4>Examples</h4>
                                            {change.examples.map((example, idx) => (
                                                <div key={idx} className="example-item">
                                                    <code>{example}</code>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ChangesList;
