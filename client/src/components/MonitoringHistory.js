// client/src/components/MonitoringHistory.js
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    FiChevronLeft, FiClock, FiActivity, FiRefreshCw,
    FiFilter, FiDownload, FiCopy, FiCheck, FiTrendingUp,
    FiZap, FiGrid, FiX
} from 'react-icons/fi';
import './MonitoringHistory.css';
import './WorkspaceDetail.css';
import AppSelect from './common/AppSelect/AppSelect';

const TIME_RANGES = [
    { value: '1h', label: 'Last Hour' },
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' }
];

const MonitoringHistory = () => {
    const { id: monitorId } = useParams();
    const [monitor, setMonitor] = useState(null);
    const [healthChecks, setHealthChecks] = useState([]);
    const [stripChecks, setStripChecks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [timeRange, setTimeRange] = useState('24h');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState(null);
    const [copied, setCopied] = useState(false);
    const [selectedCheck, setSelectedCheck] = useState(null);

    const fetchMonitor = useCallback(async () => {
        try {
            const response = await fetch(`/api/monitoring/${monitorId}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to fetch monitor details');
            }

            const data = await response.json();
            setMonitor(data);
        } catch (err) {
            setError(err.message);
        }
    }, [monitorId]);

    const fetchHealthChecks = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                timeRange,
                page: page.toString(),
                limit: '50'
            });

            const response = await fetch(`/api/monitoring/${monitorId}/history?${params}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to fetch health check history');
            }

            const data = await response.json();
            setHealthChecks(data.healthChecks || []);
            setPagination(data.pagination);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [monitorId, timeRange, page]);

    const fetchStripChecks = useCallback(async () => {
        try {
            const params = new URLSearchParams({ timeRange, page: '1', limit: '90' });
            const response = await fetch(`/api/monitoring/${monitorId}/history?${params}`, {
                credentials: 'include'
            });
            if (!response.ok) return;
            const data = await response.json();
            setStripChecks(data.healthChecks || []);
        } catch { /* strip is non-critical */ }
    }, [monitorId, timeRange]);

    useEffect(() => {
        if (monitorId) {
            fetchMonitor();
            fetchHealthChecks();
            fetchStripChecks();
        }
    }, [monitorId, fetchMonitor, fetchHealthChecks, fetchStripChecks]);

    const handleRefresh = () => {
        fetchHealthChecks();
        fetchStripChecks();
    };

    const handleCopyUrl = () => {
        if (!monitor?.url) return;
        navigator.clipboard.writeText(monitor.url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    // Oldest-to-newest strip of up to 48 slots for the availability heatmap
    const availabilitySlots = (() => {
        const ordered = [...stripChecks].reverse();
        const max = 90;
        let slots;
        if (ordered.length <= max) {
            slots = ordered;
        } else {
            const step = ordered.length / max;
            slots = Array.from({ length: max }, (_, i) => ordered[Math.floor(i * step)]);
        }
        // Pad right with empty slots so the strip always spans full width
        const pad = max - slots.length;
        return [...slots, ...Array.from({ length: pad }, () => ({ status: 'empty' }))];
    })();

    const handleTimeRangeChange = (newTimeRange) => {
        setTimeRange(newTimeRange);
        setPage(1); // Reset to first page when changing time range
    };

    const getStatusIcon = (status) => {
        const cls = ['success', 'failure', 'timeout'].includes(status) ? status : 'unknown';
        return <span className={`status-icon ${cls}`}>{status}</span>;
    };

    // Split raw errorMessage into Result (headline) + Diagnostic (detail).
    const parseCheckResult = (check) => {
        if (!check.errorMessage) {
            return {
                result: check.status === 'success' ? `HTTP ${check.statusCode || 200} OK` : 'No result',
                diagnostic: check.statusCode ? `Status ${check.statusCode}` : '—'
            };
        }
        const msg = check.errorMessage;
        // DNS / fetch errors like "request to https://... failed, reason: getaddrinfo ENOTFOUND ..."
        const fetchMatch = msg.match(/request to .* failed, reason:\s*(.+)/i);
        if (fetchMatch) {
            const reason = fetchMatch[1].trim();
            if (reason.includes('ENOTFOUND') || reason.includes('getaddrinfo')) {
                return { result: 'DNS lookup failed', diagnostic: reason };
            }
            return { result: 'Request failed', diagnostic: reason };
        }
        // HTTP status errors like "HTTP 404: Not Found"
        const httpMatch = msg.match(/HTTP\s+(\d+):?\s*(.*)/i);
        if (httpMatch) {
            return {
                result: `HTTP ${httpMatch[1]}${httpMatch[2] ? ` ${httpMatch[2]}` : ''}`,
                diagnostic: msg
            };
        }
        // Timeout
        if (msg.toLowerCase().includes('timeout')) {
            return { result: 'Timeout', diagnostic: msg };
        }
        return { result: msg, diagnostic: '—' };
    };

    const getStatusColorClass = (status) => {
        switch (status) {
            case 'success':
                return 'status-success';
            case 'failure':
                return 'status-failure';
            case 'timeout':
                return 'status-timeout';
            default:
                return 'status-unknown';
        }
    };

    const formatDuration = (responseTime) => {
        if (responseTime < 1000) {
            return `${responseTime}ms`;
        }
        return `${(responseTime / 1000).toFixed(2)}s`;
    };

    const formatTimestamp = (timestamp) => {
        return new Date(timestamp).toLocaleString();
    };

    const exportData = () => {
        const csvContent = [
            ['Timestamp', 'Status', 'Response Time (ms)', 'Status Code', 'Error Message'],
            ...healthChecks.map(check => [
                check.checkedAt,
                check.status,
                check.responseTime || 0,
                check.statusCode || '',
                check.errorMessage || ''
            ])
        ].map(row => row.join(',')).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `monitor-${monitor?.name || monitorId}-history.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    if (loading && !healthChecks.length) {
        return (
            <div className="workspace-test-page">
                <div className="ws-loading">
                    <div className="ws-loading-spinner"></div>
                    <p>Loading monitor history...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="workspace-test-page">
                <div className="ws-error">
                    <h2>{error}</h2>
                    <Link to="/workspace/monitoring" className="ws-btn">
                        <FiChevronLeft /> Back to Monitoring
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="workspace-test-page">
            <header className="ws-header mh-header">
                <div className="ws-header-title">
                    <div className="ws-eyebrow">
                        <Link to="/workspace/monitoring" className="back-button">
                            <FiChevronLeft /> Back to Monitoring
                        </Link>
                    </div>
                    {monitor && (
                        <>
                            <div className="mh-title-row">
                                <h1><FiActivity /> {monitor.name}</h1>
                                <span className={`monitor-status status-${monitor.currentStatus}`}>
                                    <span className="monitor-status-dot" />
                                    {monitor.currentStatus === 'up' ? 'Operational'
                                        : monitor.currentStatus === 'down' ? 'Down now'
                                        : monitor.currentStatus === 'degraded' ? 'Degraded'
                                        : 'Unknown'}
                                </span>
                            </div>
                            <div className="monitor-details">
                                <span className="ws-header-stat monitor-url">{monitor.url}</span>
                                <button
                                    className="mh-copy-btn"
                                    onClick={handleCopyUrl}
                                    title="Copy URL"
                                    type="button"
                                >
                                    {copied ? <FiCheck /> : <FiCopy />}
                                </button>
                            </div>
                        </>
                    )}
                </div>

                <div className="ws-header-actions history-controls">
                    <div className="time-range-selector">
                        <FiFilter className="filter-icon" />
                        <AppSelect
                            className="time-range-select"
                            value={timeRange}
                            onChange={handleTimeRangeChange}
                            options={TIME_RANGES}
                        />
                    </div>

                    <button
                        className="ws-btn icon-only"
                        onClick={handleRefresh}
                        disabled={loading}
                        title="Refresh history"
                    >
                        <FiRefreshCw className={loading ? 'spinning' : ''} />
                    </button>

                    <button
                        className="ws-btn"
                        onClick={exportData}
                        disabled={!healthChecks.length}
                        title="Export as CSV"
                    >
                        <FiDownload /> Export
                    </button>
                </div>
            </header>

            <div className="ws-page">
            <div className="ws-content">
                {healthChecks.length === 0 ? (
                    <div className="ws-empty">
                        <div className="ws-empty-icon"><FiClock /></div>
                        <h3 className="ws-empty-title">No health check history</h3>
                        <p className="ws-empty-subtext">No health checks found for the selected time range.</p>
                    </div>
                ) : (
                    <>
                        <div className="ws-collections-grid history-stats">
                            <div className="ws-panel stat-card">
                                <div className="stat-icon"><FiGrid /></div>
                                <div className="stat-body">
                                    <div className="stat-label">Total Checks</div>
                                    <div className="stat-value">{pagination?.totalRecords || healthChecks.length}</div>
                                </div>
                            </div>
                            <div className="ws-panel stat-card">
                                <div className="stat-icon"><FiTrendingUp /></div>
                                <div className="stat-body">
                                    <div className="stat-label">Success Rate</div>
                                    <div className="stat-value">
                                        {(() => {
                                            const successful = healthChecks.filter(check => check.status === 'success').length;
                                            const rate = healthChecks.length > 0 ? (successful / healthChecks.length * 100).toFixed(1) : 0;
                                            return `${rate}%`;
                                        })()}
                                    </div>
                                </div>
                            </div>
                            <div className="ws-panel stat-card">
                                <div className="stat-icon"><FiZap /></div>
                                <div className="stat-body">
                                    <div className="stat-label">Avg Response Time</div>
                                    <div className="stat-value">
                                        {(() => {
                                            const avgTime = healthChecks.reduce((sum, check) => sum + (check.responseTime || 0), 0) / healthChecks.length;
                                            return formatDuration(Math.round(avgTime));
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="ws-panel availability-strip-panel">
                            <div className="availability-strip-header">
                                <span className="availability-strip-title">Availability</span>
                                <div className="availability-legend">
                                    <span className="legend-item"><span className="legend-dot success" />Success</span>
                                    <span className="legend-item"><span className="legend-dot failure" />Failure</span>
                                    <span className="legend-item"><span className="legend-dot unknown" />Timeout</span>
                                </div>
                            </div>
                            <div className="availability-strip">
                                {availabilitySlots.map((check, i) => (
                                    <span
                                        key={check._id || i}
                                        className={`availability-bar ${check.status === 'empty' ? 'status-empty' : getStatusColorClass(check.status)}`}
                                        title={check.status === 'empty' ? '' : `${formatTimestamp(check.checkedAt)} — ${check.status}`}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="ws-panel history-table-container">
                            <table className="ws-table history-table">
                                <thead>
                                    <tr>
                                        <th>Status</th>
                                        <th>Timestamp</th>
                                        <th>Response Time</th>
                                        <th>Result</th>
                                        <th>Diagnostic</th>
                                        <th />
                                    </tr>
                                </thead>
                                <tbody>
                                    {healthChecks.map((check, index) => (
                                        <tr key={check._id || index} className={getStatusColorClass(check.status)}>
                                            <td className="status-cell">
                                                {getStatusIcon(check.status)}
                                            </td>
                                            <td className="timestamp-cell">
                                                {formatTimestamp(check.checkedAt)}
                                            </td>
                                            <td className="response-time-cell">
                                                {formatDuration(check.responseTime || 0)}
                                            </td>
                                            <td className="result-cell">
                                                {(() => {
                                                    const { result } = parseCheckResult(check);
                                                    return result;
                                                })()}
                                            </td>
                                            <td className="diagnostic-cell">
                                                {(() => {
                                                    const { diagnostic } = parseCheckResult(check);
                                                    return diagnostic !== '—' ? (
                                                        <span className="diagnostic-message" title={diagnostic}>
                                                            {diagnostic}
                                                        </span>
                                                    ) : diagnostic;
                                                })()}
                                            </td>
                                            <td className="action-cell">
                                                {check.errorMessage && (
                                                    <button
                                                        className="mh-view-error-btn"
                                                        onClick={() => setSelectedCheck(check)}
                                                        type="button"
                                                    >
                                                        View error
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {pagination && pagination.total > 1 && (
                            <div className="pagination">
                                <button
                                    className="ws-btn pagination-btn"
                                    onClick={() => setPage(page - 1)}
                                    disabled={page <= 1}
                                >
                                    Previous
                                </button>
                                <span className="pagination-info">
                                    Page {page} of {pagination.total}
                                </span>
                                <button
                                    className="ws-btn pagination-btn"
                                    onClick={() => setPage(page + 1)}
                                    disabled={page >= pagination.total}
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
            </div>

            {selectedCheck && (
                <div
                    className="mh-overlay"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setSelectedCheck(null);
                    }}
                >
                    <div className="mh-overlay-card">
                        <button
                            className="mh-overlay-close"
                            onClick={() => setSelectedCheck(null)}
                            type="button"
                        >
                            <FiX />
                        </button>
                        <h3>Error details</h3>
                        <div className="mh-overlay-meta">
                            <span className={`mh-overlay-status ${selectedCheck.status === 'success' ? 'success' : selectedCheck.status === 'failure' ? 'failure' : selectedCheck.status === 'timeout' ? 'timeout' : 'unknown'}`}>
                                {selectedCheck.status}
                            </span>
                            <span>{formatTimestamp(selectedCheck.checkedAt)}</span>
                            <span>·</span>
                            <span>{formatDuration(selectedCheck.responseTime || 0)}</span>
                        </div>
                        {(() => {
                            const { result, diagnostic } = parseCheckResult(selectedCheck);
                            return (
                                <>
                                    <div className="mh-overlay-field">
                                        <label>Result</label>
                                        <p>{result}</p>
                                    </div>
                                    <div className="mh-overlay-field">
                                        <label>Diagnostic</label>
                                        <p className="mh-overlay-diagnostic">{diagnostic}</p>
                                    </div>
                                </>
                            );
                        })()}
                        {selectedCheck.errorMessage && (
                            <div className="mh-overlay-field">
                                <label>Raw error</label>
                                <pre className="mh-overlay-raw">{selectedCheck.errorMessage}</pre>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MonitoringHistory;
