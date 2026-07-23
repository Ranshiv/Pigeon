// client/src/components/Alerting/AlertsDashboard.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FiArrowLeft } from 'react-icons/fi';
import './AlertsDashboard.css';
import PageLoader from '../common/PageLoader/PageLoader';

const AlertsDashboard = () => {
    const navigate = useNavigate();
    const [alerts, setAlerts] = useState([]);
    const [groupedView, setGroupedView] = useState(true);
    const [filters, setFilters] = useState({
        severity: 'all',
        status: 'all',
        timeRange: '24h'
    });
    const [loading, setLoading] = useState(true);
    const [statistics, setStatistics] = useState(null);

    useEffect(() => {
        fetchAlerts();
        fetchStatistics();

        // Set up polling for real-time updates
        const interval = setInterval(() => {
            fetchAlerts();
            fetchStatistics();
        }, 30000); // Poll every 30 seconds

        return () => clearInterval(interval);
    }, [filters, groupedView]);

    const fetchAlerts = async () => {
        try {
            setLoading(true);
            const endpoint = groupedView
                ? '/api/monitoring/alerts/grouped'
                : '/api/alerts';

            const params = {};
            if (filters.status !== 'all') params.status = filters.status;
            if (filters.severity !== 'all') params.severity = filters.severity;

            const response = await axios.get(endpoint, { params });
            setAlerts(response.data);
        } catch (error) {
            console.error('Error fetching alerts:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchStatistics = async () => {
        try {
            const response = await axios.get('/api/monitoring/alerts/statistics');
            setStatistics(response.data);
        } catch (error) {
            console.error('Error fetching statistics:', error);
        }
    };

    const handleAcknowledge = async (alertId) => {
        try {
            await axios.post(`/api/alerts/${alertId}/acknowledge`);
            fetchAlerts();
        } catch (error) {
            console.error('Error acknowledging alert:', error);
        }
    };

    const handleSnooze = async (alertId, duration) => {
        try {
            await axios.post(`/api/alerts/${alertId}/snooze`, { duration });
            fetchAlerts();
        } catch (error) {
            console.error('Error snoozing alert:', error);
        }
    };

    const handleResolve = async (alertId) => {
        try {
            await axios.post(`/api/alerts/${alertId}/resolve`);
            fetchAlerts();
        } catch (error) {
            console.error('Error resolving alert:', error);
        }
    };

    const getSeverityClass = (severity) => {
        const normalized = (severity || 'info').toLowerCase();
        const allowed = new Set(['critical', 'high', 'medium', 'low', 'info']);
        return allowed.has(normalized) ? normalized : 'info';
    };

    const getSeverityIcon = (severity) => {
        const icons = {
            critical: '🔴',
            high: '🟠',
            medium: '🟡',
            low: '🔵',
            info: '⚪'
        };
        return icons[severity] || icons.info;
    };

    const formatDuration = (ms) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m`;
        return `${seconds}s`;
    };

    return (
        <div className="alerts-dashboard">
            <div className="alerts-header">
                <div className="alerts-header-left">
                    <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => navigate('/workspace/monitoring/policies')}
                    >
                        <FiArrowLeft /> Back
                    </button>
                    <div>
                        <h1 className="alerts-title">Alerts Dashboard</h1>
                        <p className="alerts-subtitle">Track, acknowledge, and resolve alert incidents.</p>
                    </div>
                </div>
                <div className="header-actions">
                    <button
                        onClick={() => setGroupedView(!groupedView)}
                        className="btn-secondary"
                    >
                        {groupedView ? 'Show Individual' : 'Show Grouped'}
                    </button>
                </div>
            </div>

            {/* Statistics Cards */}
            {statistics && (
                <div className="statistics-grid">
                    <div className="stat-card">
                        <div className="stat-label">Total Alerts</div>
                        <div className="stat-value">{statistics.totalAlerts || 0}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">MTTA</div>
                        <div className="stat-value">
                            {formatDuration(statistics.mtta || 0)}
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">By Severity</div>
                        <div className="severity-breakdown">
                            {statistics.bySeverity?.map(item => (
                                <div key={item._id} className="severity-item">
                                    <span className={`severity-badge ${item._id}`}>
                                        {getSeverityIcon(item._id)} {item.count}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="filters-bar">
                <div className="filter-group">
                    <label>Severity</label>
                    <select
                        value={filters.severity}
                        onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
                        className="filter-select"
                    >
                        <option value="all">All Severities</option>
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                        <option value="info">Info</option>
                    </select>
                </div>

                <div className="filter-group">
                    <label>Status</label>
                    <select
                        value={filters.status}
                        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                        className="filter-select"
                    >
                        <option value="all">All Statuses</option>
                        <option value="triggered">Triggered</option>
                        <option value="acknowledged">Acknowledged</option>
                        <option value="resolved">Resolved</option>
                        <option value="snoozed">Snoozed</option>
                    </select>
                </div>

                <div className="filter-group">
                    <label>Time Range</label>
                    <select
                        value={filters.timeRange}
                        onChange={(e) => setFilters({ ...filters, timeRange: e.target.value })}
                        className="filter-select"
                    >
                        <option value="1h">Last Hour</option>
                        <option value="24h">Last 24 Hours</option>
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                    </select>
                </div>
            </div>

            {/* Alerts List */}
            <div className="alerts-container">
                {loading ? (
                    <PageLoader label="Loading alerts..." />
                ) : alerts.length === 0 ? (
                    <div className="empty-state">
                        <p className="muted">No alerts found</p>
                    </div>
                ) : (
                    <div className="alerts-list">
                        {groupedView ? (
                            alerts.map(group => (
                                <div key={group._id} className="alert-group-card">
                                    <div className="group-header">
                                        <div className="group-info">
                                            <span className={`severity-badge ${getSeverityClass(group.severity)}`}>
                                                {getSeverityIcon(group.severity)} {group.severity}
                                            </span>
                                            <h3 className="group-title">{group.title}</h3>
                                            <span className="alert-count">{group.count} alerts</span>
                                        </div>
                                        <div className="group-meta">
                                            <span className="meta-text">
                                                First: {new Date(group.firstTriggered).toLocaleString()}
                                            </span>
                                            <span className="meta-text">
                                                Last: {new Date(group.lastTriggered).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="group-alerts">
                                        {group.alerts.map(alert => (
                                            <div key={alert._id} className="grouped-alert">
                                                <div className="alert-content">
                                                    <p className="alert-title">{alert.title}</p>
                                                    <span className="alert-time">
                                                        {new Date(alert.triggeredAt).toLocaleString()}
                                                    </span>
                                                </div>
                                                <div className="alert-actions">
                                                    {alert.status === 'triggered' && (
                                                        <>
                                                            <button
                                                                onClick={() => handleAcknowledge(alert._id)}
                                                                className="btn-sm btn-primary"
                                                            >
                                                                Acknowledge
                                                            </button>
                                                            <button
                                                                onClick={() => handleSnooze(alert._id, 3600000)}
                                                                className="btn-sm btn-secondary"
                                                            >
                                                                Snooze 1h
                                                            </button>
                                                        </>
                                                    )}
                                                    {alert.status === 'acknowledged' && (
                                                        <button
                                                            onClick={() => handleResolve(alert._id)}
                                                            className="btn-sm btn-success"
                                                        >
                                                            Resolve
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))
                        ) : (
                            alerts.map(alert => (
                                <div key={alert._id} className="alert-card">
                                    <div className="alert-header">
                                        <span className={`severity-badge ${getSeverityClass(alert.severity)}`}>
                                            {getSeverityIcon(alert.severity)} {alert.severity}
                                        </span>
                                        <span className={`status-badge status-${alert.status}`}>
                                            {alert.status}
                                        </span>
                                        {alert.isPredictive && (
                                            <span className="predictive-badge">📊 Predictive</span>
                                        )}
                                    </div>
                                    <h3 className="alert-title">{alert.title}</h3>
                                    <p className="alert-description">{alert.description}</p>
                                    <div className="alert-meta">
                                        <span>Triggered: {new Date(alert.triggeredAt).toLocaleString()}</span>
                                        <span>Duration: {formatDuration(Date.now() - new Date(alert.triggeredAt))}</span>
                                    </div>
                                    <div className="alert-actions">
                                        {alert.status === 'triggered' && (
                                            <>
                                                <button
                                                    onClick={() => handleAcknowledge(alert._id)}
                                                    className="btn-primary"
                                                >
                                                    Acknowledge
                                                </button>
                                                <button
                                                    onClick={() => handleSnooze(alert._id, 3600000)}
                                                    className="btn-secondary"
                                                >
                                                    Snooze 1h
                                                </button>
                                            </>
                                        )}
                                        {alert.status === 'acknowledged' && (
                                            <button
                                                onClick={() => handleResolve(alert._id)}
                                                className="btn-success"
                                            >
                                                Resolve
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AlertsDashboard;
