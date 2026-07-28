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
    const isAsyncApi = item.type === 'asyncapi';
    const requestCount = m.requestCount ?? m.operationCount ?? m.channelCount ?? m.messageCount ?? 0;
    const documentedCount = m.documentedCount ?? m.documentedOperationCount ?? m.documentedChannelCount ?? m.documentedMessageCount ?? 0;
    const authCoverage = m.authedCount ?? (m.messageSchemaCount ?? 0);
    const variableUsage = m.variableUsageCount ?? (m.usesEnvVariables ? requestCount : 0);

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
                        <dt>{isAsyncApi ? 'Operations' : 'Requests'}</dt>
                        <dd>{requestCount}</dd>
                        <dt>{isAsyncApi ? 'Documented operations' : 'Documented endpoints'}</dt>
                        <dd>{documentedCount} of {requestCount}</dd>
                        <dt>{isAsyncApi ? 'Payload schemas' : 'Collection docs'}</dt>
                        <dd>{isAsyncApi ? `${m.messageSchemaCount ?? 0} of ${m.messageCount ?? 0}` : (m.hasCollectionDocs ? 'Present' : 'Missing')}</dd>
                        <dt>{isAsyncApi ? 'Schema coverage' : 'Authenticated requests'}</dt>
                        <dd>{isAsyncApi ? `${authCoverage} of ${m.messageCount ?? 0}` : `${authCoverage} of ${requestCount}`}</dd>
                        <dt>{isAsyncApi ? 'Server variables' : 'Unauthenticated writes'}</dt>
                        <dd>{isAsyncApi ? (m.usesEnvVariables ? 'Configured' : 'Missing') : `${m.unauthenticatedWriteCount ?? 0} of ${m.writeRequestCount ?? 0}`}</dd>
                        <dt>{isAsyncApi ? 'Scenario coverage' : 'Requests using variables'}</dt>
                        <dd>{isAsyncApi ? `${m.scenariosCount ?? 0} scenarios` : `${variableUsage} of ${requestCount}`}</dd>
                        {!isAsyncApi && <><dt>Requests with tests</dt><dd>{m.testedCount ?? 0} of {requestCount}</dd></>}
                        <dt>Environments</dt>
                        <dd>{m.environmentCount === 0 ? 'None' : (m.environmentNames || []).join(', ') || `${m.environmentCount} configured`}</dd>
                        <dt>Monitors</dt>
                        <dd>{m.monitorCount === 0 ? 'None' : isAsyncApi ? (m.monitoringStatus || 'Configured') : `${m.upMonitorCount ?? 0} up of ${m.activeMonitorCount ?? 0} active`}</dd>
                        <dt>Published versions</dt>
                        <dd>{m.versionCount ?? 0}</dd>
                        <dt>Audit events</dt>
                        <dd>{m.auditEventCount ?? 0}</dd>
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
