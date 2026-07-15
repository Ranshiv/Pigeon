// client/src/components/PublicStatusPage.js
import React, { useState, useEffect } from 'react';
import {
    FiCheckCircle, FiAlertCircle, FiClock, FiActivity,
    FiRefreshCw, FiCalendar, FiTrendingUp, FiGlobe
} from 'react-icons/fi';
import './PublicStatusPage.css';

const PublicStatusPage = () => {
    const [monitors, setMonitors] = useState([]);
    const [incidents, setIncidents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [autoRefresh, setAutoRefresh] = useState(true);

    useEffect(() => {
        fetchStatusData();

        // Auto-refresh every 60 seconds if enabled
        let interval;
        if (autoRefresh) {
            interval = setInterval(fetchStatusData, 60000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [autoRefresh]);

    const fetchStatusData = async () => {
        try {
            setLoading(true);

            // Fetch public monitors
            const monitorsResponse = await fetch('/api/monitoring/public');
            if (monitorsResponse.ok) {
                const monitorsData = await monitorsResponse.json();
                setMonitors(monitorsData);
            }

            // Fetch recent incidents (you'll need to implement this endpoint)
            const incidentsResponse = await fetch('/api/monitoring/incidents/recent');
            if (incidentsResponse.ok) {
                const incidentsData = await incidentsResponse.json();
                setIncidents(incidentsData);
            }

            setLastUpdated(new Date());
        } catch (err) {
            console.error('Error fetching status data:', err);
        } finally {
            setLoading(false);
        }
    };

    const getOverallStatus = () => {
        if (monitors.length === 0) return 'unknown';

        const downMonitors = monitors.filter(m => m.currentStatus === 'down').length;
        const degradedMonitors = monitors.filter(m => m.currentStatus === 'degraded').length;

        if (downMonitors > 0) return 'down';
        if (degradedMonitors > 0) return 'degraded';
        return 'operational';
    };

    const getStatusMessage = (status) => {
        switch (status) {
            case 'operational':
                return 'All systems operational';
            case 'degraded':
                return 'Some systems experiencing issues';
            case 'down':
                return 'System outage detected';
            default:
                return 'Status unknown';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'operational':
                return <FiCheckCircle className="status-icon operational" />;
            case 'degraded':
                return <FiClock className="status-icon degraded" />;
            case 'down':
                return <FiAlertCircle className="status-icon down" />;
            default:
                return <FiClock className="status-icon unknown" />;
        }
    };

    const formatUptime = (uptimePercentage) => {
        const uptime = parseFloat(uptimePercentage);
        if (uptime >= 99.9) return 'Excellent';
        if (uptime >= 99.0) return 'Good';
        if (uptime >= 95.0) return 'Fair';
        return 'Poor';
    };

    const overallStatus = getOverallStatus();

    return (
        <div className="public-status-page">
            <div className="status-container">
                {/* Header */}
                <header className="status-header">
                    <div className="header-content">
                        <h1><FiGlobe /> Pigeon API Status</h1>
                        <p>Current status of our API services and infrastructure</p>
                    </div>
                    <div className="header-actions">
                        <button
                            className={`auto-refresh-toggle ${autoRefresh ? 'active' : ''}`}
                            onClick={() => setAutoRefresh(!autoRefresh)}
                            title={autoRefresh ? 'Disable auto-refresh' : 'Enable auto-refresh'}
                        >
                            <FiRefreshCw />
                            Auto-refresh
                        </button>
                        <button
                            className="refresh-btn"
                            onClick={fetchStatusData}
                            disabled={loading}
                        >
                            <FiRefreshCw className={loading ? 'spinning' : ''} />
                            Refresh
                        </button>
                    </div>
                </header>

                {/* Overall Status */}
                <div className={`overall-status ${overallStatus}`}>
                    <div className="status-info">
                        {getStatusIcon(overallStatus)}
                        <div className="status-text">
                            <h2>{getStatusMessage(overallStatus)}</h2>
                            <p>Last updated: {lastUpdated.toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                {/* Services Status */}
                <section className="services-section">
                    <h3><FiActivity /> Services</h3>
                    <div className="services-list">
                        {loading && monitors.length === 0 ? (
                            <div className="loading-services">
                                <FiActivity className="loading-icon" />
                                <p>Loading service status...</p>
                            </div>
                        ) : monitors.length === 0 ? (
                            <div className="no-services">
                                <p>No public services to display</p>
                            </div>
                        ) : (
                            monitors.map(monitor => (
                                <div key={monitor._id} className="service-item">
                                    <div className="service-info">
                                        <div className="service-name">{monitor.name}</div>
                                        <div className="service-description">{monitor.description || monitor.url}</div>
                                    </div>
                                    <div className="service-metrics">
                                        <div className="service-status">
                                            {getStatusIcon(monitor.currentStatus)}
                                            <span className={`status-text ${monitor.currentStatus}`}>
                                                {monitor.currentStatus?.toUpperCase() || 'UNKNOWN'}
                                            </span>
                                        </div>
                                        <div className="service-uptime">
                                            <span className="uptime-value">{monitor.uptimePercentage}%</span>
                                            <span className="uptime-label">uptime</span>
                                        </div>
                                        <div className="service-response-time">
                                            <span className="response-time-value">{monitor.averageResponseTime || 0}ms</span>
                                            <span className="response-time-label">avg response</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                {/* Recent Incidents */}
                <section className="incidents-section">
                    <h3><FiCalendar /> Recent Incidents</h3>
                    <div className="incidents-list">
                        {incidents.length === 0 ? (
                            <div className="no-incidents">
                                <FiCheckCircle className="no-incidents-icon" />
                                <p>No incidents to report</p>
                                <small>All systems have been running smoothly</small>
                            </div>
                        ) : (
                            incidents.map(incident => (
                                <div key={incident.id} className="incident-item">
                                    <div className="incident-header">
                                        <div className="incident-status">
                                            {getStatusIcon(incident.status)}
                                            <span className="incident-title">{incident.title}</span>
                                        </div>
                                        <span className="incident-date">
                                            {new Date(incident.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <p className="incident-description">{incident.description}</p>
                                    {incident.updates && incident.updates.length > 0 && (
                                        <div className="incident-updates">
                                            {incident.updates.map((update, index) => (
                                                <div key={index} className="incident-update">
                                                    <span className="update-time">
                                                        {new Date(update.timestamp).toLocaleString()}
                                                    </span>
                                                    <span className="update-message">{update.message}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </section>

                {/* Statistics */}
                <section className="stats-section">
                    <h3><FiTrendingUp /> System Statistics</h3>
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-value">
                                {monitors.filter(m => m.currentStatus === 'operational').length}
                                <span className="stat-total">/{monitors.length}</span>
                            </div>
                            <div className="stat-label">Services Operational</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">
                                {monitors.length > 0
                                    ? (monitors.reduce((sum, m) => sum + parseFloat(m.uptimePercentage || 0), 0) / monitors.length).toFixed(1)
                                    : 0
                                }%
                            </div>
                            <div className="stat-label">Average Uptime</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">
                                {monitors.length > 0
                                    ? Math.round(monitors.reduce((sum, m) => sum + (m.averageResponseTime || 0), 0) / monitors.length)
                                    : 0
                                }ms
                            </div>
                            <div className="stat-label">Average Response Time</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{incidents.length}</div>
                            <div className="stat-label">Incidents (30 days)</div>
                        </div>
                    </div>
                </section>

                {/* Footer */}
                <footer className="status-footer">
                    <p>
                        Powered by <strong>Pigeon API Monitoring</strong> •
                        Last updated: {lastUpdated.toLocaleString()} •
                        <span className={`auto-refresh-status ${autoRefresh ? 'active' : ''}`}>
                            Auto-refresh: {autoRefresh ? 'On' : 'Off'}
                        </span>
                    </p>
                </footer>
            </div>
        </div>
    );
};

export default PublicStatusPage;
