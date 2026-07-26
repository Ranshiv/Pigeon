// client/src/components/governance/GovernanceScorePanel.js
import React from 'react';
import { FiAlertTriangle, FiCheckCircle, FiInfo } from 'react-icons/fi';

const SEVERITY_ICON = {
    high: FiAlertTriangle,
    medium: FiInfo,
    low: FiInfo
};

const gradeOf = (value) => (value >= 80 ? 'good' : value >= 50 ? 'fair' : 'poor');

const GovernanceScorePanel = ({ item, weights = {}, categoryLabels = {} }) => {
    const categories = Object.entries(item.categories || {});
    const m = item.metrics || {};

    return (
        <div className="gov-panel">
            <div className="gov-panel-grid">
                <section className="gov-subcard">
                    <h3 className="gov-subcard-title">Category scores</h3>
                    <p className="gov-muted">
                        Overall score is the weighted average of the categories below.
                    </p>
                    <ul className="gov-bars">
                        {categories.map(([key, value]) => (
                            <li className="gov-bar-row" key={key}>
                                <div className="gov-bar-head">
                                    <span className="gov-bar-label">{categoryLabels[key] || key}</span>
                                    <span className="gov-bar-value">
                                        {value}
                                        <span className="gov-bar-weight">
                                            {weights[key] ? ` · ${weights[key]}% weight` : ''}
                                        </span>
                                    </span>
                                </div>
                                <div className="gov-bar-track">
                                    <div
                                        className={`gov-bar-fill gov-bar-fill--${gradeOf(value)}`}
                                        style={{ width: `${value}%` }}
                                    />
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>

                <section className="gov-subcard">
                    <h3 className="gov-subcard-title">Evidence</h3>
                    <dl className="gov-kv">
                        <dt>Requests</dt>
                        <dd>{m.requestCount}</dd>
                        <dt>Documented endpoints</dt>
                        <dd>{m.documentedCount} of {m.requestCount}</dd>
                        <dt>Collection docs</dt>
                        <dd>{m.hasCollectionDocs ? 'Present' : 'Missing'}</dd>
                        <dt>Authenticated requests</dt>
                        <dd>{m.authedCount} of {m.requestCount}</dd>
                        <dt>Unauthenticated writes</dt>
                        <dd>{m.unauthenticatedWriteCount} of {m.writeRequestCount}</dd>
                        <dt>Requests using variables</dt>
                        <dd>{m.variableUsageCount} of {m.requestCount}</dd>
                        <dt>Requests with tests</dt>
                        <dd>{m.testedCount} of {m.requestCount}</dd>
                        <dt>Environments</dt>
                        <dd>{m.environmentCount === 0 ? 'None' : m.environmentNames.join(', ')}</dd>
                        <dt>Monitors</dt>
                        <dd>{m.monitorCount === 0 ? 'None' : `${m.upMonitorCount} up of ${m.activeMonitorCount} active`}</dd>
                        <dt>Published versions</dt>
                        <dd>{m.versionCount}</dd>
                        <dt>Audit events</dt>
                        <dd>{m.auditEventCount}</dd>
                    </dl>
                </section>
            </div>

            <section className="gov-subcard gov-subcard--wide">
                <h3 className="gov-subcard-title">Recommendations</h3>
                {item.recommendations.length === 0 ? (
                    <div className="gov-all-clear">
                        <FiCheckCircle /> No outstanding governance actions for this API.
                    </div>
                ) : (
                    <ul className="gov-recs">
                        {item.recommendations.map((rec, index) => {
                            const Icon = SEVERITY_ICON[rec.severity] || FiInfo;
                            return (
                                <li className={`gov-rec gov-rec--${rec.severity}`} key={`${rec.category}-${index}`}>
                                    <Icon className="gov-rec-icon" />
                                    <span className="gov-rec-text">{rec.message}</span>
                                    <span className="gov-rec-cat">{categoryLabels[rec.category] || rec.category}</span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>
        </div>
    );
};

export default GovernanceScorePanel;
