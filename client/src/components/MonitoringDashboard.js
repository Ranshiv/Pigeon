// client/src/components/MonitoringDashboard.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FiActivity, FiAlertCircle, FiCheckCircle, FiClock,
    FiPlus, FiGlobe, FiRefreshCw, FiEye, FiEdit,
    FiTrash2, FiPause, FiPlay, FiTrendingUp, FiBarChart,
    FiUsers, FiSettings, FiTool, FiBell, FiAlertTriangle
} from 'react-icons/fi';
import MonitorForm from './MonitorForm';
import './MonitoringDashboard.css';
import PageLoader from './common/PageLoader/PageLoader';

const MonitoringDashboard = ({ createOnLoad = false }) => {
    const navigate = useNavigate();
    const [monitors, setMonitors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState('all'); // all, up, down, degraded
    const [refreshing, setRefreshing] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingMonitor, setEditingMonitor] = useState(null);

    useEffect(() => {
        fetchMonitors();
        if (createOnLoad) {
            setShowCreateForm(true);
        }
        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchMonitors, 30000);
        return () => clearInterval(interval);
    }, [createOnLoad]);

    const fetchMonitors = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/monitoring', {
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
            setRefreshing(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchMonitors();
    };

    const toggleMonitor = async (monitorId, isActive) => {
        try {
            const response = await fetch(`/api/monitoring/${monitorId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ isActive: !isActive })
            });

            if (response.ok) {
                fetchMonitors();
            }
        } catch (err) {
            console.error('Error toggling monitor:', err);
        }
    };

    const deleteMonitor = async (monitorId) => {
        if (!window.confirm('Are you sure you want to delete this monitor?')) {
            return;
        }

        try {
            const response = await fetch(`/api/monitoring/${monitorId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                fetchMonitors();
            }
        } catch (err) {
            console.error('Error deleting monitor:', err);
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'up':
                return <FiCheckCircle className="status-icon up" />;
            case 'down':
                return <FiAlertCircle className="status-icon down" />;
            case 'degraded':
                return <FiClock className="status-icon degraded" />;
            default:
                return <FiClock className="status-icon unknown" />;
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'up': return '#10b981';
            case 'down': return '#ef4444';
            case 'degraded': return '#f59e0b';
            default: return '#6b7280';
        }
    };

    const getResponseTimeColor = (responseTime, expectedTime) => {
        if (responseTime <= expectedTime * 0.7) return '#10b981';
        if (responseTime <= expectedTime) return '#f59e0b';
        return '#ef4444';
    };

    const filteredMonitors = monitors.filter(monitor => {
        if (filter === 'all') return true;
        return monitor.currentStatus === filter;
    });

    const stats = {
        total: monitors.length,
        up: monitors.filter(m => m.currentStatus === 'up').length,
        down: monitors.filter(m => m.currentStatus === 'down').length,
        degraded: monitors.filter(m => m.currentStatus === 'degraded').length,
        avgUptime: monitors.length > 0
            ? (monitors.reduce((sum, m) => sum + parseFloat(m.uptimePercentage || 0), 0) / monitors.length).toFixed(1)
            : 0
    };

    const handleSaveMonitor = async (monitorData) => {
        try {
            const url = editingMonitor
                ? `/api/monitoring/${editingMonitor._id}`
                : '/api/monitoring';
            const method = editingMonitor ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(monitorData)
            });

            if (!response.ok) {
                throw new Error('Failed to save monitor');
            }

            // Refresh monitors list
            await fetchMonitors();

            // Close the form
            setShowCreateForm(false);
            setEditingMonitor(null);
        } catch (err) {
            console.error('Error saving monitor:', err);
            throw err; // Re-throw to let the form handle the error
        }
    };

    const handleEditMonitor = (monitor) => {
        setEditingMonitor(monitor);
        setShowCreateForm(true);
    };

    const handleCloseForm = () => {
        setShowCreateForm(false);
        setEditingMonitor(null);
    };

    if (loading && monitors.length === 0) {
        return (
            <div className="monitoring-dashboard">
                <PageLoader label="Loading monitors..." />
            </div>
        );
    }

    return (
        <div className="monitoring-dashboard">
            {/* Header */}
            <div className="dashboard-header">
                <div className="header-left">
                    <div className="header-icon" aria-hidden="true"><FiActivity /></div>
                    <div className="header-info">
                        <h1>API Monitoring</h1>
                        <p>Monitor your API endpoints and get alerts when they go down</p>
                    </div>
                </div>
                <div className="header-actions">
                    <button
                        className={`refresh-btn ${refreshing ? 'refreshing' : ''}`}
                        onClick={handleRefresh}
                        disabled={refreshing}
                    >
                        <FiRefreshCw /> Refresh
                    </button>
                    <button
                        className="btn-primary"
                        onClick={() => setShowCreateForm(true)}
                    >
                        <FiPlus /> Add Monitor
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="monitoring-nav">
                <button
                    className="nav-btn active"
                    onClick={() => navigate('/workspace/monitoring')}
                >
                    <FiActivity /> Dashboard
                </button>
                <button
                    className="nav-btn"
                    onClick={() => navigate('/workspace/monitoring/policies')}
                >
                    <FiBell /> Alerts & Policies
                </button>
                <button
                    className="nav-btn"
                    onClick={() => navigate('/workspace/monitoring/incidents')}
                >
                    <FiAlertTriangle /> Incidents
                </button>
                <button
                    className="nav-btn"
                    onClick={() => navigate('/workspace/monitoring/reports')}
                >
                    <FiBarChart /> Reports
                </button>
                <button
                    className="nav-btn"
                    onClick={() => navigate('/workspace/monitoring/teams')}
                >
                    <FiUsers /> Teams
                </button>
                <button
                    className="nav-btn"
                    onClick={() => navigate('/workspace/monitoring/integrations')}
                >
                    <FiSettings /> Integrations
                </button>
                <button
                    className="nav-btn"
                    onClick={() => navigate('/workspace/monitoring/maintenance')}
                >
                    <FiTool /> Maintenance
                </button>
            </div>

            {/* Stats Overview */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon">
                        <FiGlobe />
                    </div>
                    <div className="stat-content">
                        <div className="stat-value">{stats.total}</div>
                        <div className="stat-label">Total Monitors</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon up">
                        <FiCheckCircle />
                    </div>
                    <div className="stat-content">
                        <div className="stat-value">{stats.up}</div>
                        <div className="stat-label">Operational</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon down">
                        <FiAlertCircle />
                    </div>
                    <div className="stat-content">
                        <div className="stat-value">{stats.down}</div>
                        <div className="stat-label">Down</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">
                        <FiTrendingUp />
                    </div>
                    <div className="stat-content">
                        <div className="stat-value">{stats.avgUptime}%</div>
                        <div className="stat-label">Avg Uptime</div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="filters">
                {[
                    { key: 'all', label: 'All', count: stats.total },
                    { key: 'up', label: 'Operational', count: stats.up },
                    { key: 'down', label: 'Down', count: stats.down },
                    { key: 'degraded', label: 'Degraded', count: stats.degraded }
                ].map(filterOption => (
                    <button
                        key={filterOption.key}
                        className={`filter-btn ${filter === filterOption.key ? 'active' : ''}`}
                        onClick={() => setFilter(filterOption.key)}
                    >
                        {filterOption.label} ({filterOption.count})
                    </button>
                ))}
            </div>

            {/* Error State */}
            {error && (
                <div className="error-banner">
                    <FiAlertCircle />
                    <span>{error}</span>
                    <button onClick={fetchMonitors}>Retry</button>
                </div>
            )}

            {/* Monitors List */}
            <div className="monitors-list">
                {filteredMonitors.length === 0 ? (
                    <div className="empty-state">
                        <FiGlobe className="empty-icon" />
                        <h3>No monitors found</h3>
                        <p>
                            {filter === 'all'
                                ? 'Start monitoring your APIs by creating your first monitor'
                                : `No monitors with status "${filter}" found`
                            }
                        </p>
                        {filter === 'all' && (
                            <button
                                className="btn-primary"
                                onClick={() => navigate('/workspace/monitoring/new')}
                            >
                                <FiPlus /> Create Monitor
                            </button>
                        )}
                    </div>
                ) : (
                    filteredMonitors.map(monitor => (
                        <div key={monitor._id} className="monitor-card">
                            <div className="monitor-header">
                                <div className="monitor-status">
                                    {getStatusIcon(monitor.currentStatus)}
                                    <div className="monitor-info">
                                        <h3>{monitor.name}</h3>
                                        <p className="monitor-url">{monitor.url}</p>
                                    </div>
                                </div>
                                <div className="monitor-actions">
                                    <button
                                        className="action-btn"
                                        onClick={() => navigate(`/workspace/monitoring/${monitor._id}/analytics`)}
                                        title="View Analytics"
                                    >
                                        <FiTrendingUp />
                                    </button>
                                    <button
                                        className="action-btn"
                                        onClick={() => navigate(`/workspace/monitoring/${monitor._id}/history`)}
                                        title="View History"
                                    >
                                        <FiEye />
                                    </button>
                                    <button
                                        className="action-btn"
                                        onClick={() => handleEditMonitor(monitor)}
                                        title="Edit Monitor"
                                    >
                                        <FiEdit />
                                    </button>
                                    <button
                                        className={`action-btn ${monitor.isActive ? 'pause' : 'play'}`}
                                        onClick={() => toggleMonitor(monitor._id, monitor.isActive)}
                                        title={monitor.isActive ? 'Pause Monitor' : 'Resume Monitor'}
                                    >
                                        {monitor.isActive ? <FiPause /> : <FiPlay />}
                                    </button>
                                    <button
                                        className="action-btn delete"
                                        onClick={() => deleteMonitor(monitor._id)}
                                        title="Delete Monitor"
                                    >
                                        <FiTrash2 />
                                    </button>
                                </div>
                            </div>

                            <div className="monitor-metrics">
                                <div className="metric">
                                    <span className="metric-label">Status</span>
                                    <span
                                        className="metric-value metric-status-value"
                                        style={{ color: getStatusColor(monitor.currentStatus) }}
                                    >
                                        {monitor.currentStatus?.toUpperCase() || 'UNKNOWN'}
                                    </span>
                                </div>
                                <div className="metric">
                                    <span className="metric-label">Uptime</span>
                                    <span className="metric-value">
                                        {monitor.uptimePercentage}%
                                    </span>
                                </div>
                                <div className="metric">
                                    <span className="metric-label">Response Time</span>
                                    <span
                                        className="metric-value"
                                        style={{
                                            color: getResponseTimeColor(
                                                monitor.averageResponseTime,
                                                monitor.expectedResponseTime
                                            )
                                        }}
                                    >
                                        {monitor.averageResponseTime}ms
                                    </span>
                                </div>
                                <div className="metric">
                                    <span className="metric-label">Last Check</span>
                                    <span className="metric-value">
                                        {monitor.lastChecked
                                            ? new Date(monitor.lastChecked).toLocaleString()
                                            : 'Never'
                                        }
                                    </span>
                                </div>
                                <div className="metric">
                                    <span className="metric-label">Interval</span>
                                    <span className="metric-value">{monitor.interval}min</span>
                                </div>
                            </div>

                            {monitor.tags && monitor.tags.length > 0 && (
                                <div className="monitor-tags">
                                    {monitor.tags.map((tag, index) => (
                                        <span key={index} className="tag">{tag}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Monitor Form Modal */}
            <MonitorForm
                isOpen={showCreateForm}
                editMonitor={editingMonitor}
                onSave={handleSaveMonitor}
                onClose={handleCloseForm}
            />
        </div>
    );
};

export default MonitoringDashboard;
