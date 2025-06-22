// client/src/components/monitoring/MonitoringDashboard.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './MonitoringDashboard.css';

const MonitoringDashboard = () => {
    const [monitors, setMonitors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState('all');
    const navigate = useNavigate();

    useEffect(() => {
        fetchMonitors();
    }, [filter]);

    const fetchMonitors = async () => {
        try {
            setLoading(true);
            const queryParams = filter !== 'all' ? `?status=${filter}` : '';
            const response = await fetch(`/api/monitoring${queryParams}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to fetch monitors');
            }

            const data = await response.json();
            setMonitors(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleManualCheck = async (monitorId) => {
        try {
            await fetch(`/api/monitoring/${monitorId}/check`, {
                method: 'POST',
                credentials: 'include'
            });

            // Refresh monitors after manual check
            fetchMonitors();
        } catch (err) {
            console.error('Failed to run manual check:', err);
        }
    };

    const handleDeleteMonitor = async (monitorId) => {
        if (!window.confirm('Are you sure you want to delete this monitor?')) {
            return;
        }

        try {
            await fetch(`/api/monitoring/${monitorId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            fetchMonitors();
        } catch (err) {
            console.error('Failed to delete monitor:', err);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'up': return '#28a745';
            case 'down': return '#dc3545';
            case 'degraded': return '#ffc107';
            default: return '#6c757d';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'up': return '🟢';
            case 'down': return '🔴';
            case 'degraded': return '🟡';
            default: return '⚪';
        }
    };

    if (loading) {
        return (
            <div className="monitoring-dashboard">
                <div className="loading">Loading monitors...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="monitoring-dashboard">
                <div className="error">Error: {error}</div>
            </div>
        );
    }

    return (
        <div className="monitoring-dashboard">
            <div className="dashboard-header">
                <h1>API Monitoring</h1>
                <div className="header-actions">
                    <button
                        className="btn btn-primary"
                        onClick={() => navigate('/monitoring/create')}
                    >
                        Add Monitor
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={() => navigate('/monitoring/status')}
                    >
                        Public Status
                    </button>
                </div>
            </div>

            <div className="dashboard-filters">
                <button
                    className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                    onClick={() => setFilter('all')}
                >
                    All ({monitors.length})
                </button>
                <button
                    className={`filter-btn ${filter === 'up' ? 'active' : ''}`}
                    onClick={() => setFilter('up')}
                >
                    Up ({monitors.filter(m => m.currentStatus === 'up').length})
                </button>
                <button
                    className={`filter-btn ${filter === 'down' ? 'active' : ''}`}
                    onClick={() => setFilter('down')}
                >
                    Down ({monitors.filter(m => m.currentStatus === 'down').length})
                </button>
                <button
                    className={`filter-btn ${filter === 'degraded' ? 'active' : ''}`}
                    onClick={() => setFilter('degraded')}
                >
                    Degraded ({monitors.filter(m => m.currentStatus === 'degraded').length})
                </button>
            </div>

            {monitors.length === 0 ? (
                <div className="empty-state">
                    <h3>No monitors found</h3>
                    <p>Create your first monitor to start monitoring your APIs</p>
                    <button
                        className="btn btn-primary"
                        onClick={() => navigate('/monitoring/create')}
                    >
                        Create Monitor
                    </button>
                </div>
            ) : (
                <div className="monitors-grid">
                    {monitors.map(monitor => (
                        <div key={monitor._id} className="monitor-card">
                            <div className="monitor-header">
                                <div className="monitor-title">
                                    <span className="status-icon">{getStatusIcon(monitor.currentStatus)}</span>
                                    <h3>{monitor.name}</h3>
                                </div>
                                <div className="monitor-actions">
                                    <button
                                        className="btn-icon"
                                        title="Run check now"
                                        onClick={() => handleManualCheck(monitor._id)}
                                    >
                                        ⟳
                                    </button>
                                    <button
                                        className="btn-icon"
                                        title="Edit monitor"
                                        onClick={() => navigate(`/monitoring/${monitor._id}/edit`)}
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        className="btn-icon delete"
                                        title="Delete monitor"
                                        onClick={() => handleDeleteMonitor(monitor._id)}
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>

                            <div className="monitor-details">
                                <div className="detail-row">
                                    <span className="label">URL:</span>
                                    <span className="value">{monitor.url}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="label">Method:</span>
                                    <span className="value">{monitor.method}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="label">Status:</span>
                                    <span
                                        className="value status-badge"
                                        style={{ backgroundColor: getStatusColor(monitor.currentStatus) }}
                                    >
                                        {monitor.currentStatus?.toUpperCase()}
                                    </span>
                                </div>
                            </div>

                            <div className="monitor-stats">
                                <div className="stat">
                                    <div className="stat-value">{monitor.uptimePercentage}%</div>
                                    <div className="stat-label">Uptime</div>
                                </div>
                                <div className="stat">
                                    <div className="stat-value">{monitor.averageResponseTime}ms</div>
                                    <div className="stat-label">Avg Response</div>
                                </div>
                                <div className="stat">
                                    <div className="stat-value">{monitor.interval}min</div>
                                    <div className="stat-label">Interval</div>
                                </div>
                            </div>

                            <div className="monitor-footer">
                                <small>
                                    Last checked: {monitor.lastChecked ?
                                        new Date(monitor.lastChecked).toLocaleString() :
                                        'Never'
                                    }
                                </small>
                                <button
                                    className="btn btn-small"
                                    onClick={() => navigate(`/monitoring/${monitor._id}`)}
                                >
                                    View Details
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MonitoringDashboard;
