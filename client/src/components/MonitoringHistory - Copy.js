// client/src/components/MonitoringHistory.js
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    FiChevronLeft, FiClock, FiActivity, FiRefreshCw,
    FiFilter, FiDownload, FiAlertCircle, FiCheckCircle,
    FiXCircle
} from 'react-icons/fi';
import './MonitoringHistory.css';
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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [timeRange, setTimeRange] = useState('24h');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState(null);

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

    useEffect(() => {
        if (monitorId) {
            fetchMonitor();
            fetchHealthChecks();
        }
    }, [monitorId, fetchMonitor, fetchHealthChecks]);

    const handleRefresh = () => {
        fetchHealthChecks();
    };

    const handleTimeRangeChange = (newTimeRange) => {
        setTimeRange(newTimeRange);
        setPage(1); // Reset to first page when changing time range
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'success':
                return <FiCheckCircle className="status-icon success" />;
            case 'failure':
                return <FiXCircle className="status-icon failure" />;
            case 'timeout':
                return <FiAlertCircle className="status-icon timeout" />;
            default:
                return <FiActivity className="status-icon unknown" />;
        }
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
            <div className="monitoring-history">
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>Loading monitor history...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="monitoring-history">
                <div className="error-container">
                    <div className="error-message">{error}</div>
                    <Link to="/workspace/monitoring" className="back-button">
                        <FiChevronLeft /> Back to Monitoring
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="monitoring-history">
            <div className="history-header">
                <div className="header-navigation">
                    <Link to="/workspace/monitoring" className="back-button">
                        <FiChevronLeft /> Back to Monitoring
                    </Link>
                </div>

                <div className="monitor-info">
                    {monitor && (
                        <>
                            <h1>
                                <FiActivity className="monitor-icon" />
                                {monitor.name}
                            </h1>
                            <div className="monitor-details">
                                <span className="monitor-url">{monitor.url}</span>
                                <span className={`monitor-status status-${monitor.currentStatus}`}>
                                    {monitor.currentStatus}
                                </span>
                                <span className="monitor-uptime">
                                    {monitor.uptimePercentage}% uptime
                                </span>
                            </div>
                        </>
                    )}
                </div>

                <div className="history-controls">
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
                        className="refresh-btn"
                        onClick={handleRefresh}
                        disabled={loading}
                        title="Refresh history"
                    >
                        <FiRefreshCw className={loading ? 'spinning' : ''} />
                    </button>

                    <button
                        className="export-btn"
                        onClick={exportData}
                        disabled={!healthChecks.length}
                        title="Export as CSV"
                    >
                        <FiDownload /> Export
                    </button>
                </div>
            </div>

            <div className="history-content">
                {healthChecks.length === 0 ? (
                    <div className="empty-state">
                        <FiClock className="empty-icon" />
                        <h3>No health check history</h3>
                        <p>No health checks found for the selected time range.</p>
                    </div>
                ) : (
                    <>
                        <div className="history-stats">
                            <div className="stat-card">
                                <div className="stat-label">Total Checks</div>
                                <div className="stat-value">{pagination?.totalRecords || healthChecks.length}</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-label">Success Rate</div>
                                <div className="stat-value">
                                    {(() => {
                                        const successful = healthChecks.filter(check => check.status === 'success').length;
                                        const rate = healthChecks.length > 0 ? (successful / healthChecks.length * 100).toFixed(1) : 0;
                                        return `${rate}%`;
                                    })()}
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-label">Avg Response Time</div>
                                <div className="stat-value">
                                    {(() => {
                                        const avgTime = healthChecks.reduce((sum, check) => sum + (check.responseTime || 0), 0) / healthChecks.length;
                                        return formatDuration(Math.round(avgTime));
                                    })()}
                                </div>
                            </div>
                        </div>

                        <div className="history-table-container">
                            <table className="history-table">
                                <thead>
                                    <tr>
                                        <th>Status</th>
                                        <th>Timestamp</th>
                                        <th>Response Time</th>
                                        <th>Status Code</th>
                                        <th>Error</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {healthChecks.map((check, index) => (
                                        <tr key={check._id || index} className={getStatusColorClass(check.status)}>
                                            <td className="status-cell">
                                                {getStatusIcon(check.status)}
                                                <span className="status-text">{check.status}</span>
                                            </td>
                                            <td className="timestamp-cell">
                                                {formatTimestamp(check.checkedAt)}
                                            </td>
                                            <td className="response-time-cell">
                                                {formatDuration(check.responseTime || 0)}
                                            </td>
                                            <td className="status-code-cell">
                                                {check.statusCode || '-'}
                                            </td>
                                            <td className="error-cell">
                                                {check.errorMessage ? (
                                                    <span className="error-message" title={check.errorMessage}>
                                                        {check.errorMessage.length > 50
                                                            ? check.errorMessage.substring(0, 50) + '...'
                                                            : check.errorMessage
                                                        }
                                                    </span>
                                                ) : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {pagination && pagination.total > 1 && (
                            <div className="pagination">
                                <button
                                    className="pagination-btn"
                                    onClick={() => setPage(page - 1)}
                                    disabled={page <= 1}
                                >
                                    Previous
                                </button>
                                <span className="pagination-info">
                                    Page {page} of {pagination.total}
                                </span>
                                <button
                                    className="pagination-btn"
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
    );
};

export default MonitoringHistory;
