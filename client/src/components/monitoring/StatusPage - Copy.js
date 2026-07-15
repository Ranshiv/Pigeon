// client/src/components/monitoring/StatusPage.js
import React, { useState, useEffect } from 'react';
import './StatusPage.css';

const StatusPage = () => {
    const [statusData, setStatusData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastRefresh, setLastRefresh] = useState(new Date());

    useEffect(() => {
        fetchStatusData();

        // Set up auto-refresh every 30 seconds
        const interval = setInterval(() => {
            fetchStatusData();
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    const fetchStatusData = async () => {
        try {
            const response = await fetch('/api/monitoring/public/status');

            if (!response.ok) {
                throw new Error('Failed to fetch status data');
            }

            const data = await response.json();
            setStatusData(data);
            setLastRefresh(new Date());
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getOverallStatusInfo = (status) => {
        switch (status) {
            case 'operational':
                return {
                    icon: '🟢',
                    text: 'All Systems Operational',
                    color: '#28a745',
                    description: 'All monitored services are operating normally.'
                };
            case 'partial_outage':
                return {
                    icon: '🟡',
                    text: 'Partial System Outage',
                    color: '#ffc107',
                    description: 'Some services are experiencing issues.'
                };
            case 'major_outage':
                return {
                    icon: '🔴',
                    text: 'Major System Outage',
                    color: '#dc3545',
                    description: 'Multiple services are currently unavailable.'
                };
            default:
                return {
                    icon: '⚪',
                    text: 'Status Unknown',
                    color: '#6c757d',
                    description: 'Unable to determine system status.'
                };
        }
    };

    const getServiceStatusInfo = (status) => {
        switch (status) {
            case 'up':
                return {
                    icon: '🟢',
                    text: 'Operational',
                    color: '#28a745'
                };
            case 'degraded':
                return {
                    icon: '🟡',
                    text: 'Degraded',
                    color: '#ffc107'
                };
            case 'down':
                return {
                    icon: '🔴',
                    text: 'Down',
                    color: '#dc3545'
                };
            default:
                return {
                    icon: '⚪',
                    text: 'Unknown',
                    color: '#6c757d'
                };
        }
    };

    if (loading) {
        return (
            <div className="status-page">
                <div className="status-header">
                    <h1>System Status</h1>
                </div>
                <div className="loading">Loading status information...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="status-page">
                <div className="status-header">
                    <h1>System Status</h1>
                </div>
                <div className="error">
                    <h3>Unable to load status information</h3>
                    <p>{error}</p>
                    <button className="btn btn-primary" onClick={fetchStatusData}>
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    const overallStatus = getOverallStatusInfo(statusData.overallStatus);

    return (
        <div className="status-page">
            <div className="status-header">
                <h1>System Status</h1>
                <p>Real-time status and uptime monitoring for our services</p>
            </div>

            <div className="overall-status">
                <div className="status-indicator" style={{ backgroundColor: overallStatus.color }}>
                    <span className="status-icon">{overallStatus.icon}</span>
                    <div className="status-text">
                        <h2>{overallStatus.text}</h2>
                        <p>{overallStatus.description}</p>
                    </div>
                </div>
            </div>

            {statusData.summary && (
                <div className="status-summary">
                    <div className="summary-stats">
                        <div className="stat">
                            <div className="stat-number">{statusData.summary.operational}</div>
                            <div className="stat-label">Operational</div>
                        </div>
                        <div className="stat">
                            <div className="stat-number">{statusData.summary.degraded}</div>
                            <div className="stat-label">Degraded</div>
                        </div>
                        <div className="stat">
                            <div className="stat-number">{statusData.summary.down}</div>
                            <div className="stat-label">Down</div>
                        </div>
                        <div className="stat">
                            <div className="stat-number">{statusData.summary.total}</div>
                            <div className="stat-label">Total Services</div>
                        </div>
                    </div>
                </div>
            )}

            <div className="services-status">
                <h3>Service Status</h3>
                {statusData.monitors && statusData.monitors.length > 0 ? (
                    <div className="services-list">
                        {statusData.monitors.map(monitor => {
                            const serviceStatus = getServiceStatusInfo(monitor.currentStatus);
                            return (
                                <div key={monitor._id} className="service-item">
                                    <div className="service-info">
                                        <div className="service-name">
                                            <span className="service-icon">{serviceStatus.icon}</span>
                                            {monitor.name}
                                        </div>
                                        <div className="service-url">{monitor.url}</div>
                                    </div>

                                    <div className="service-metrics">
                                        <div className="metric">
                                            <span className="metric-value">{monitor.uptimePercentage}%</span>
                                            <span className="metric-label">Uptime</span>
                                        </div>
                                        <div className="metric">
                                            <span className="metric-value">{monitor.averageResponseTime}ms</span>
                                            <span className="metric-label">Response Time</span>
                                        </div>
                                    </div>

                                    <div className="service-status">
                                        <span
                                            className="status-badge"
                                            style={{ backgroundColor: serviceStatus.color }}
                                        >
                                            {serviceStatus.text}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="no-services">
                        <p>No public services are currently being monitored.</p>
                    </div>
                )}
            </div>

            <div className="status-footer">
                <div className="last-updated">
                    <small>
                        Last updated: {lastRefresh.toLocaleString()}
                        <button
                            className="refresh-btn"
                            onClick={fetchStatusData}
                            title="Refresh status"
                        >
                            ⟳
                        </button>
                    </small>
                </div>
                <div className="powered-by">
                    <small>Powered by Pigeon API Monitor</small>
                </div>
            </div>
        </div>
    );
};

export default StatusPage;
