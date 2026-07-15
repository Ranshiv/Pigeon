// client/src/components/EnhancedPublicStatusPage.js
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
    FiCheckCircle, FiAlertCircle, FiClock, FiRefreshCw,
    FiMail, FiActivity, FiSettings
} from 'react-icons/fi';
import './EnhancedPublicStatusPage.css';

const EnhancedPublicStatusPage = () => {
    const { workspaceId } = useParams();
    const [statusData, setStatusData] = useState(null);
    const [maintenanceWindows, setMaintenanceWindows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [subscribing, setSubscribing] = useState(false);
    const [email, setEmail] = useState('');
    const [subscriptionMessage, setSubscriptionMessage] = useState('');
    const [lastUpdated, setLastUpdated] = useState(new Date());

    const fetchStatusData = useCallback(async () => {
        try {
            const response = await fetch(`/api/status-pages/public/${workspaceId}`);
            if (response.ok) {
                const data = await response.json();
                setStatusData(data);
                setLastUpdated(new Date());
            }
        } catch (error) {
            console.error('Error fetching status data:', error);
        } finally {
            setLoading(false);
        }
    }, [workspaceId]);

    const fetchMaintenanceWindows = useCallback(async () => {
        try {
            const response = await fetch(`/api/maintenance/public/${workspaceId}`);
            if (response.ok) {
                const data = await response.json();
                setMaintenanceWindows(data);
            }
        } catch (error) {
            console.error('Error fetching maintenance windows:', error);
        }
    }, [workspaceId]);

    useEffect(() => {
        fetchStatusData();
        fetchMaintenanceWindows();

        // Auto-refresh every 30 seconds
        const interval = setInterval(() => {
            fetchStatusData();
            fetchMaintenanceWindows();
        }, 30000);

        return () => clearInterval(interval);
    }, [fetchStatusData, fetchMaintenanceWindows]);

    const handleSubscribe = async (e) => {
        e.preventDefault();
        setSubscribing(true);
        setSubscriptionMessage('');

        try {
            const response = await fetch(`/api/status-pages/subscribe/${workspaceId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email,
                    subscriptionTypes: ['incident_updates', 'maintenance_windows']
                })
            });

            const result = await response.json();

            if (response.ok) {
                setSubscriptionMessage('Subscription successful! Please check your email to confirm.');
                setEmail('');
            } else {
                setSubscriptionMessage(`Error: ${result.message}`);
            }
        } catch (error) {
            setSubscriptionMessage('Error subscribing. Please try again.');
        } finally {
            setSubscribing(false);
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'operational':
                return <FiCheckCircle className="status-icon operational" />;
            case 'degraded_performance':
                return <FiClock className="status-icon degraded" />;
            case 'partial_outage':
            case 'major_outage':
                return <FiAlertCircle className="status-icon outage" />;
            default:
                return <FiClock className="status-icon unknown" />;
        }
    };

    const getStatusMessage = (status) => {
        switch (status) {
            case 'operational':
                return 'All systems operational';
            case 'degraded_performance':
                return 'Some systems experiencing degraded performance';
            case 'partial_outage':
                return 'Some systems are experiencing issues';
            case 'major_outage':
                return 'Multiple systems are experiencing issues';
            default:
                return 'Status unknown';
        }
    };

    const formatUptime = (uptime) => {
        const num = parseFloat(uptime);
        if (num >= 99.95) return 'Excellent';
        if (num >= 99.50) return 'Good';
        if (num >= 95.00) return 'Fair';
        return 'Poor';
    };

    if (loading) {
        return (
            <div className="status-page loading">
                <div className="loading-content">
                    <FiActivity className="loading-icon" />
                    <p>Loading status page...</p>
                </div>
            </div>
        );
    }

    if (!statusData) {
        return (
            <div className="status-page error">
                <h1>Status Page Not Found</h1>
                <p>The requested status page could not be found.</p>
            </div>
        );
    }

    const { config, overallStatus, monitors, incidents } = statusData;

    return (
        <div
            className="enhanced-status-page"
            style={{
                '--primary-color': config?.branding?.primaryColor || '#007bff',
                '--secondary-color': config?.branding?.secondaryColor || '#6c757d',
                '--background-color': config?.branding?.backgroundColor || '#ffffff',
                '--text-color': config?.branding?.textColor || '#333333'
            }}
        >
            {/* Header */}
            <header className="status-header">
                <div className="container">
                    <div className="header-content">
                        {config?.branding?.logoUrl && (
                            <img
                                src={config.branding.logoUrl}
                                alt="Logo"
                                className="status-logo"
                            />
                        )}
                        <h1>{config?.content?.headline || 'System Status'}</h1>
                        <p>{config?.content?.description || 'Current status and uptime monitoring for our services'}</p>
                    </div>
                </div>
            </header>

            <main className="status-main">
                <div className="container">
                    {/* Overall Status */}
                    <section className="overall-status">
                        <div className="status-card">
                            {getStatusIcon(overallStatus)}
                            <div className="status-content">
                                <h2>{getStatusMessage(overallStatus)}</h2>
                                <p className="last-updated">
                                    Last updated: {lastUpdated.toLocaleString()}
                                    <button
                                        className="refresh-btn"
                                        onClick={() => {
                                            fetchStatusData();
                                            fetchMaintenanceWindows();
                                        }}
                                        title="Refresh"
                                    >
                                        <FiRefreshCw />
                                    </button>
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Maintenance Windows */}
                    {maintenanceWindows.length > 0 && (
                        <section className="maintenance-section">
                            <h3><FiSettings /> Scheduled Maintenance</h3>
                            {maintenanceWindows.map(maintenance => (
                                <div key={maintenance.id} className="maintenance-card">
                                    <div className="maintenance-header">
                                        <h4>{maintenance.title}</h4>
                                        <span className={`status-badge ${maintenance.status}`}>
                                            {maintenance.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                    <p>{maintenance.description}</p>
                                    <div className="maintenance-time">
                                        <strong>
                                            {maintenance.status === 'in_progress' ? 'Started:' : 'Scheduled:'}
                                        </strong>
                                        {' '}
                                        {new Date(maintenance.scheduledStartTime).toLocaleString()}
                                        {' - '}
                                        {new Date(maintenance.scheduledEndTime).toLocaleString()}
                                    </div>
                                    {maintenance.affectedServices.length > 0 && (
                                        <div className="affected-services">
                                            <strong>Affected Services:</strong>
                                            {maintenance.affectedServices.map((service, index) => (
                                                <span key={index} className="service-tag">
                                                    {service.name}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {maintenance.updates.length > 0 && (
                                        <div className="maintenance-updates">
                                            <strong>Updates:</strong>
                                            {maintenance.updates.slice(0, 3).map((update, index) => (
                                                <div key={index} className="update-item">
                                                    <small>{new Date(update.timestamp).toLocaleString()}</small>
                                                    <p>{update.message}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </section>
                    )}

                    {/* Services Status */}
                    <section className="services-section">
                        <h3><FiActivity /> Service Status</h3>
                        <div className="services-grid">
                            {monitors.map(monitor => (
                                <div key={monitor.id} className="service-card">
                                    <div className="service-header">
                                        {getStatusIcon(monitor.status)}
                                        <div className="service-info">
                                            <h4>{monitor.name}</h4>
                                            <p>{monitor.description}</p>
                                        </div>
                                    </div>

                                    {config?.content?.showMetrics && (
                                        <div className="service-metrics">
                                            <div className="metric">
                                                <span className="metric-value">{monitor.uptimePercentage}%</span>
                                                <span className="metric-label">Uptime (30d)</span>
                                            </div>
                                            <div className="metric">
                                                <span className="metric-value">{monitor.averageResponseTime}ms</span>
                                                <span className="metric-label">Response Time</span>
                                            </div>
                                            <div className="metric">
                                                <span className="metric-value">{formatUptime(monitor.uptimePercentage)}</span>
                                                <span className="metric-label">Performance</span>
                                            </div>
                                        </div>
                                    )}

                                    {monitor.tags && monitor.tags.length > 0 && (
                                        <div className="service-tags">
                                            {monitor.tags.map((tag, index) => (
                                                <span key={index} className="tag">{tag}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Incidents */}
                    {config?.content?.showIncidents && incidents.length > 0 && (
                        <section className="incidents-section">
                            <h3><FiAlertCircle /> Recent Incidents</h3>
                            {incidents.slice(0, 5).map(incident => (
                                <div key={incident.id} className="incident-card">
                                    <div className="incident-header">
                                        <h4>{incident.title}</h4>
                                        <div className="incident-meta">
                                            <span className={`severity-badge ${incident.severity}`}>
                                                {incident.severity}
                                            </span>
                                            <span className={`status-badge ${incident.status}`}>
                                                {incident.status.replace('_', ' ')}
                                            </span>
                                        </div>
                                    </div>
                                    <p>{incident.description}</p>
                                    <div className="incident-time">
                                        <strong>Started:</strong> {new Date(incident.createdAt).toLocaleString()}
                                        {incident.resolvedAt && (
                                            <>
                                                <br />
                                                <strong>Resolved:</strong> {new Date(incident.resolvedAt).toLocaleString()}
                                            </>
                                        )}
                                    </div>
                                    {incident.affectedServices.length > 0 && (
                                        <div className="affected-services">
                                            <strong>Affected Services:</strong>
                                            {incident.affectedServices.map((service, index) => (
                                                <span key={index} className="service-tag">
                                                    {service.name}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </section>
                    )}

                    {/* Subscription Form */}
                    {config?.notifications?.enableSubscriptions && (
                        <section className="subscription-section">
                            <div className="subscription-card">
                                <h3><FiMail /> Subscribe to Updates</h3>
                                <p>Get notified about incidents and maintenance windows</p>

                                <form onSubmit={handleSubscribe} className="subscription-form">
                                    <div className="form-group">
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="Enter your email address"
                                            required
                                            disabled={subscribing}
                                        />
                                        <button
                                            type="submit"
                                            disabled={subscribing || !email}
                                        >
                                            {subscribing ? 'Subscribing...' : 'Subscribe'}
                                        </button>
                                    </div>
                                </form>

                                {subscriptionMessage && (
                                    <div className={`subscription-message ${subscriptionMessage.includes('Error') ? 'error' : 'success'}`}>
                                        {subscriptionMessage}
                                    </div>
                                )}
                            </div>
                        </section>
                    )}
                </div>
            </main>

            {/* Footer */}
            <footer className="status-footer">
                <div className="container">
                    <p>
                        {config?.content?.footerText || 'Powered by Pigeon Monitoring'}
                    </p>
                </div>
            </footer>

            {/* Custom CSS */}
            {config?.branding?.customCss && (
                <style dangerouslySetInnerHTML={{ __html: config.branding.customCss }} />
            )}
        </div>
    );
};

export default EnhancedPublicStatusPage;
