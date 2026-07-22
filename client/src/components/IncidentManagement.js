// client/src/components/IncidentManagement.js
import React, { useState, useEffect } from 'react';
import {
    FiAlertTriangle, FiPlus, FiEdit, FiTrash2,
    FiEye, FiClock, FiCheckCircle, FiAlertCircle,
    FiSearch, FiRefreshCw, FiBell, FiActivity, FiFileText,
    FiUsers, FiArrowUp, FiCheck, FiLink, FiCalendar, FiMessageCircle,
    FiBarChart, FiSettings, FiTool
} from 'react-icons/fi';
import './IncidentManagement.css';
import PageLoader from './common/PageLoader/PageLoader';
import AppSelect from './common/AppSelect/AppSelect';
import TabBar from './common/TabBar/TabBar';

const IncidentManagement = () => {
    const [incidents, setIncidents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingIncident, setEditingIncident] = useState(null);
    const [selectedIncident, setSelectedIncident] = useState(null);
    const [incidentTimeline, setIncidentTimeline] = useState([]);
    const [linkedAlerts, setLinkedAlerts] = useState([]);
    const [postMortem, setPostMortem] = useState(null);
    const [showPostMortem, setShowPostMortem] = useState(false);
    const [activeTab, setActiveTab] = useState('details'); // details | timeline | alerts | postmortem
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        const fetchIncidents = async () => {
            try {
                setLoading(true);
                const queryParams = new URLSearchParams();
                if (filter !== 'all') queryParams.append('status', filter);
                if (searchTerm) queryParams.append('search', searchTerm);

                const response = await fetch(`/api/incidents?${queryParams}`, {
                    credentials: 'include'
                });

                if (response.ok) {
                    const data = await response.json();
                    setIncidents(data.incidents || []);
                }
            } catch (err) {
                console.error('Error fetching incidents:', err);
                setError('Failed to load incidents. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchIncidents();
    }, [filter, searchTerm]);

    const refetchIncidents = async () => {
        try {
            setLoading(true);
            const queryParams = new URLSearchParams();
            if (filter !== 'all') queryParams.append('status', filter);
            if (searchTerm) queryParams.append('search', searchTerm);

            const response = await fetch(`/api/incidents?${queryParams}`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                setIncidents(data.incidents || []);
            }
        } catch (error) {
            console.error('Error fetching incidents:', error);
        } finally {
            setLoading(false);
        }
    };

    const createIncident = async (incidentData) => {
        try {
            const response = await fetch('/api/incidents', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(incidentData)
            });

            if (response.ok) {
                refetchIncidents();
                setShowCreateForm(false);
            }
        } catch (error) {
            console.error('Error creating incident:', error);
        }
    };

    const updateIncident = async (incidentId, updateData) => {
        try {
            const response = await fetch(`/api/incidents/${incidentId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(updateData)
            });

            if (response.ok) {
                refetchIncidents();
                if (selectedIncident && selectedIncident._id === incidentId) {
                    const updated = await response.json();
                    setSelectedIncident(updated);
                }
            }
        } catch (error) {
            console.error('Error updating incident:', error);
        }
    };

    const deleteIncident = async (incidentId) => {
        if (!window.confirm('Are you sure you want to delete this incident?')) return;

        try {
            const response = await fetch(`/api/incidents/${incidentId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                refetchIncidents();
                if (selectedIncident && selectedIncident._id === incidentId) {
                    setSelectedIncident(null);
                }
            }
        } catch (error) {
            console.error('Error deleting incident:', error);
        }
    };

    const getSeverityColor = (severity) => {
        switch (severity) {
            case 'critical': return '#ef4444';
            case 'major': return '#f59e0b';
            case 'minor': return '#3b82f6';
            default: return '#6b7280';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'investigating': return <FiAlertTriangle className="incident-list-status-icon investigating" />;
            case 'identified': return <FiEye className="incident-list-status-icon identified" />;
            case 'monitoring': return <FiClock className="incident-list-status-icon monitoring" />;
            case 'resolved': return <FiCheckCircle className="incident-list-status-icon resolved" />;
            default: return <FiAlertCircle className="incident-list-status-icon unknown" />;
        }
    };

    // Fetch incident timeline, linked alerts, and post-mortem when incident is selected
    useEffect(() => {
        if (selectedIncident) {
            fetchIncidentTimeline(selectedIncident._id);
            fetchLinkedAlerts(selectedIncident._id);
            if (selectedIncident.status === 'resolved') {
                fetchPostMortem(selectedIncident._id);
            }
        }
    }, [selectedIncident]);

    const fetchIncidentTimeline = async (incidentId) => {
        try {
            const response = await fetch(`/api/incidents/${incidentId}/timeline`, {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                setIncidentTimeline(data);
            }
        } catch (error) {
            console.error('Error fetching incident timeline:', error);
        }
    };

    const fetchLinkedAlerts = async (incidentId) => {
        try {
            const response = await fetch(`/api/incidents/${incidentId}/alerts`, {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                setLinkedAlerts(data);
            }
        } catch (error) {
            console.error('Error fetching linked alerts:', error);
        }
    };

    const fetchPostMortem = async (incidentId) => {
        try {
            const response = await fetch(`/api/incidents/${incidentId}/post-mortem`, {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                setPostMortem(data);
            }
        } catch (error) {
            console.error('Error fetching post-mortem:', error);
        }
    };

    const handleAcknowledge = async (incidentId) => {
        setActionLoading(true);
        try {
            const response = await fetch(`/api/incidents/${incidentId}/acknowledge`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
            });
            if (response.ok) {
                const updated = await response.json();
                setIncidents(incidents.map(inc => inc._id === incidentId ? updated : inc));
                setSelectedIncident(updated);
                fetchIncidentTimeline(incidentId); // Refresh timeline
            }
        } catch (error) {
            console.error('Error acknowledging incident:', error);
        } finally {
            setActionLoading(false);
        }
    };

    const handleEscalate = async (incidentId, targetLevel) => {
        setActionLoading(true);
        try {
            const response = await fetch(`/api/incidents/${incidentId}/escalate`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetLevel })
            });
            if (response.ok) {
                const updated = await response.json();
                setIncidents(incidents.map(inc => inc._id === incidentId ? updated : inc));
                setSelectedIncident(updated);
                fetchIncidentTimeline(incidentId); // Refresh timeline
            }
        } catch (error) {
            console.error('Error escalating incident:', error);
        } finally {
            setActionLoading(false);
        }
    };

    const handleResolve = async (incidentId, resolution) => {
        setActionLoading(true);
        try {
            const response = await fetch(`/api/incidents/${incidentId}/resolve`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resolution })
            });
            if (response.ok) {
                const updated = await response.json();
                setIncidents(incidents.map(inc => inc._id === incidentId ? updated : inc));
                setSelectedIncident(updated);
                fetchIncidentTimeline(incidentId); // Refresh timeline
                fetchPostMortem(incidentId); // Load post-mortem if generated
            }
        } catch (error) {
            console.error('Error resolving incident:', error);
        } finally {
            setActionLoading(false);
        }
    };

    const filteredIncidents = incidents.filter(incident => {
        const matchesSearch = incident.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            incident.description.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    // Calculate stats
    const stats = {
        total: incidents.length,
        investigating: incidents.filter(i => i.status === 'investigating').length,
        identified: incidents.filter(i => i.status === 'identified').length,
        monitoring: incidents.filter(i => i.status === 'monitoring').length,
        resolved: incidents.filter(i => i.status === 'resolved').length
    };

    const closeIncidentDetails = () => {
        setSelectedIncident(null);
        setActiveTab('details');
        setIncidentTimeline([]);
        setLinkedAlerts([]);
        setPostMortem(null);
    };

    if (loading) {
        return (
            <div className="incident-management">
                <PageLoader label="Loading incidents..." />
            </div>
        );
    }

    return (
        <div className="incident-management">
            {error && (
                <div className="error-banner">
                    <FiAlertCircle />
                    <span>{error}</span>
                    <button onClick={() => setError(null)}>Retry</button>
                </div>
            )}
            <div className="dashboard-header incident-header">
                <div className="header-left">
                    <div className="header-icon" aria-hidden="true"><FiAlertTriangle /></div>
                    <div className="header-info">
                        <h1>Incident Management</h1>
                        <p>Track and manage service incidents and outages</p>
                    </div>
                </div>
                <div className="header-actions">
                    <button
                        className="btn-refresh"
                        onClick={refetchIncidents}
                        title="Refresh incidents"
                    >
                        <FiRefreshCw /> Refresh
                    </button>
                    <button
                        className="btn-primary"
                        onClick={() => setShowCreateForm(true)}
                    >
                        <FiPlus /> Create Incident
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="monitoring-nav">
                <button
                    className="nav-btn"
                    onClick={() => window.location.href = '/workspace/monitoring'}
                >
                    <FiActivity /> Dashboard
                </button>
                <button
                    className="nav-btn"
                    onClick={() => window.location.href = '/alerts/policies'}
                >
                    <FiBell /> Alerts & Policies
                </button>
                <button
                    className="nav-btn active"
                >
                    <FiAlertTriangle /> Incidents
                </button>
                <button
                    className="nav-btn"
                    onClick={() => window.location.href = '/workspace/monitoring/reports'}
                >
                    <FiBarChart /> Reports
                </button>
                <button
                    className="nav-btn"
                    onClick={() => window.location.href = '/workspace/monitoring/teams'}
                >
                    <FiUsers /> Teams
                </button>
                <button
                    className="nav-btn"
                    onClick={() => window.location.href = '/workspace/monitoring/integrations'}
                >
                    <FiSettings /> Integrations
                </button>
                <button
                    className="nav-btn"
                    onClick={() => window.location.href = '/workspace/monitoring/maintenance'}
                >
                    <FiTool /> Maintenance
                </button>
            </div>

            {/* Stats Overview */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon">
                        <FiFileText />
                    </div>
                    <div className="stat-content">
                        <div className="stat-value">{stats.total}</div>
                        <div className="stat-label">Total Incidents</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon degraded">
                        <FiAlertCircle />
                    </div>
                    <div className="stat-content">
                        <div className="stat-value">{stats.investigating + stats.identified}</div>
                        <div className="stat-label">Active</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon up">
                        <FiCheckCircle />
                    </div>
                    <div className="stat-content">
                        <div className="stat-value">{stats.resolved}</div>
                        <div className="stat-label">Resolved</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon down">
                        <FiAlertTriangle />
                    </div>
                    <div className="stat-content">
                        <div className="stat-value">{incidents.filter(i => i.severity === 'critical' && i.status !== 'resolved').length}</div>
                        <div className="stat-label">Critical</div>
                    </div>
                </div>
            </div>

            <div className="incident-filters">
                <div className="filters">
                    {[
                        { key: 'all', label: 'All', count: stats.total },
                        { key: 'investigating', label: 'Investigating', count: stats.investigating },
                        { key: 'identified', label: 'Identified', count: stats.identified },
                        { key: 'monitoring', label: 'Monitoring', count: stats.monitoring },
                        { key: 'resolved', label: 'Resolved', count: stats.resolved }
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
                <div className="search-container">
                    <FiSearch className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search incidents..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                </div>
            </div>

            <div className="incident-content">
                <div className="incidents-list">
                    {filteredIncidents.length === 0 ? (
                        <div className="empty-state">
                            <FiAlertTriangle className="empty-icon" />
                            <h3>No incidents found</h3>
                            <p>No incidents match your current filters</p>
                            {filter === 'all' && (
                                <button
                                    className="btn-primary"
                                    onClick={() => setShowCreateForm(true)}
                                    style={{ marginTop: '16px' }}
                                >
                                    <FiPlus /> Create Incident
                                </button>
                            )}
                        </div>
                    ) : (
                        filteredIncidents.map(incident => (
                            <div
                                key={incident._id}
                                className={`incident-card ${selectedIncident?._id === incident._id ? 'selected' : ''}`}
                                onClick={() => setSelectedIncident(incident)}
                            >
                                <div className="incident-header-row">
                                    <div className="incident-status">
                                        {getStatusIcon(incident.status)}
                                        <div className="monitor-info">
                                            <h3 className="incident-title">{incident.title}</h3>
                                            <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                                                <span className={`incident-list-severity-badge ${incident.severity}`}>
                                                    {incident.severity}
                                                </span>
                                                <span className="status-text">{incident.status}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="monitor-actions">
                                        <button
                                            className="action-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingIncident(incident);
                                                setShowCreateForm(true);
                                            }}
                                            title="Edit incident"
                                        >
                                            <FiEdit />
                                        </button>
                                        <button
                                            className="action-btn delete"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteIncident(incident._id);
                                            }}
                                            title="Delete incident"
                                        >
                                            <FiTrash2 />
                                        </button>
                                    </div>
                                </div>

                                <p className="incident-description">{incident.description}</p>

                                <div className="incident-meta">
                                    <span className="incident-time">
                                        {new Date(incident.createdAt).toLocaleString()}
                                    </span>
                                    {incident.affectedServices && incident.affectedServices.length > 0 && (
                                        <span className="affected-services">
                                            {incident.affectedServices.length} service(s) affected
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

            </div>

            {selectedIncident && (
                <div className="incident-details-overlay" onClick={closeIncidentDetails}>
                    <div
                        className="incident-details-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-label={`Incident report: ${selectedIncident.title}`}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <EnhancedIncidentDetails
                            incident={selectedIncident}
                            timeline={incidentTimeline}
                            linkedAlerts={linkedAlerts}
                            postMortem={postMortem}
                            activeTab={activeTab}
                            onTabChange={setActiveTab}
                            onUpdate={updateIncident}
                            onClose={closeIncidentDetails}
                            onAcknowledge={handleAcknowledge}
                            onEscalate={handleEscalate}
                            onResolve={handleResolve}
                            actionLoading={actionLoading}
                        />
                    </div>
                </div>
            )}

            {showCreateForm && (
                <IncidentForm
                    incident={editingIncident}
                    onSave={editingIncident ?
                        (data) => updateIncident(editingIncident._id, data) :
                        createIncident
                    }
                    onClose={() => {
                        setShowCreateForm(false);
                        setEditingIncident(null);
                    }}
                />
            )}
        </div>
    );
};

const EnhancedIncidentDetails = ({
    incident,
    timeline,
    linkedAlerts,
    postMortem,
    activeTab,
    onTabChange,
    onUpdate,
    onClose,
    onAcknowledge,
    onEscalate,
    onResolve,
    actionLoading
}) => {
    const [newUpdate, setNewUpdate] = useState('');
    const [newStatus, setNewStatus] = useState(incident.status);
    const [showResolveModal, setShowResolveModal] = useState(false);
    const [showEscalateModal, setShowEscalateModal] = useState(false);
    const [resolution, setResolution] = useState('');
    const [escalationLevel, setEscalationLevel] = useState(1);

    const addUpdate = async () => {
        if (!newUpdate.trim()) return;

        const updateData = {
            updates: [
                ...incident.updates,
                {
                    message: newUpdate,
                    status: newStatus,
                    timestamp: new Date()
                }
            ],
            status: newStatus
        };

        await onUpdate(incident._id, updateData);
        setNewUpdate('');
    };

    const handleResolveConfirm = () => {
        onResolve(incident._id, resolution);
        setShowResolveModal(false);
        setResolution('');
    };

    const handleEscalateConfirm = () => {
        onEscalate(incident._id, escalationLevel);
        setShowEscalateModal(false);
    };

    return (
        <div className="incident-details enhanced incident-report">
            <div className="incident-report-header">
                <div className="incident-report-title-block">
                    <h2 className="incident-report-title">{incident.title}</h2>
                    <div className="incident-report-badges">
                        <span className={`incident-report-severity ${incident.severity}`}>{incident.severity}</span>
                        <span className={`incident-report-status ${incident.status}`}>{incident.status}</span>
                    </div>
                </div>
                <button type="button" className="incident-report-close" onClick={onClose} aria-label="Close incident report">×</button>
            </div>

            {/* Workflow Action Buttons */}
            <div className="incident-report-actions">
                {incident.status !== 'acknowledged' && incident.status !== 'resolved' && (
                    <button
                        className="incident-report-action acknowledge"
                        onClick={() => onAcknowledge(incident._id)}
                        disabled={actionLoading}
                    >
                        <FiCheck /> Acknowledge
                    </button>
                )}
                {incident.status !== 'resolved' && (
                    <button
                        className="incident-report-action escalate"
                        onClick={() => setShowEscalateModal(true)}
                        disabled={actionLoading}
                    >
                        <FiArrowUp /> Escalate
                    </button>
                )}
                {incident.status !== 'resolved' && (
                    <button
                        className="incident-report-action resolve"
                        onClick={() => setShowResolveModal(true)}
                        disabled={actionLoading}
                    >
                        <FiCheckCircle /> Resolve
                    </button>
                )}
            </div>

            {/* Tab Navigation */}
            <div className="incident-report-tabs">
                <TabBar
                    tabs={[
                        { id: 'details', label: 'Details', icon: <FiFileText /> },
                        { id: 'timeline', label: 'Timeline', icon: <FiActivity /> },
                        { id: 'alerts', label: 'Linked Alerts', icon: <FiBell />, badge: linkedAlerts.length },
                        ...(postMortem ? [{ id: 'postmortem', label: 'Post-Mortem', icon: <FiMessageCircle /> }] : [])
                    ]}
                    activeId={activeTab}
                    onChange={onTabChange}
                    ariaLabel="Incident report sections"
                />
            </div>

            {/* Tab Content */}
            <div className="incident-report-content">
                {activeTab === 'details' && (
                    <DetailsTab
                        incident={incident}
                        newUpdate={newUpdate}
                        newStatus={newStatus}
                        onUpdateChange={setNewUpdate}
                        onStatusChange={setNewStatus}
                        onAddUpdate={addUpdate}
                    />
                )}

                {activeTab === 'timeline' && (
                    <TimelineTab timeline={timeline} status={incident.status} />
                )}

                {activeTab === 'alerts' && (
                    <AlertsTab alerts={linkedAlerts} />
                )}

                {activeTab === 'postmortem' && postMortem && (
                    <PostMortemTab postMortem={postMortem} />
                )}
            </div>

            {/* Resolve Modal */}
            {showResolveModal && (
                <div className="action-modal-overlay" onClick={() => setShowResolveModal(false)}>
                    <div className="action-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Resolve Incident</h3>
                            <button className="close-btn" onClick={() => setShowResolveModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <label>Resolution Summary</label>
                            <textarea
                                value={resolution}
                                onChange={(e) => setResolution(e.target.value)}
                                placeholder="Describe how this incident was resolved..."
                                rows={4}
                                className="resolution-textarea"
                            />
                        </div>
                        <div className="modal-actions">
                            <button className="btn-secondary" onClick={() => setShowResolveModal(false)}>
                                Cancel
                            </button>
                            <button
                                className="btn-primary"
                                onClick={handleResolveConfirm}
                                disabled={!resolution.trim() || actionLoading}
                            >
                                Confirm Resolution
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Escalate Modal */}
            {showEscalateModal && (
                <div className="action-modal-overlay" onClick={() => setShowEscalateModal(false)}>
                    <div className="action-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Escalate Incident</h3>
                            <button className="close-btn" onClick={() => setShowEscalateModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <label>Escalation Level</label>
                            <select
                                value={escalationLevel}
                                onChange={(e) => setEscalationLevel(parseInt(e.target.value))}
                                className="escalation-select"
                            >
                                <option value={1}>Level 1 - Team Lead</option>
                                <option value={2}>Level 2 - Manager</option>
                                <option value={3}>Level 3 - Senior Management</option>
                                <option value={4}>Level 4 - Executive</option>
                            </select>
                            <p className="escalation-note">
                                <FiUsers /> This will notify the next level in the escalation policy.
                            </p>
                        </div>
                        <div className="modal-actions">
                            <button className="btn-secondary" onClick={() => setShowEscalateModal(false)}>
                                Cancel
                            </button>
                            <button
                                className="btn-warning"
                                onClick={handleEscalateConfirm}
                                disabled={actionLoading}
                            >
                                Escalate Now
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Details Tab Component
const DetailsTab = ({ incident, newUpdate, newStatus, onUpdateChange, onStatusChange, onAddUpdate }) => {
    return (
        <div className="incident-report-details">
            <div className="incident-report-summary" aria-label="Incident summary">
                <div className="incident-report-fact">
                    <span className="incident-report-fact-label">Status</span>
                    <span className={`incident-report-status ${incident.status}`}>{incident.status}</span>
                </div>
                <div className="incident-report-fact">
                    <span className="incident-report-fact-label">Severity</span>
                    <span className={`incident-report-severity ${incident.severity}`}>{incident.severity}</span>
                </div>
                <div className="incident-report-fact">
                    <span className="incident-report-fact-label">Created</span>
                    <span className="incident-report-fact-value">{new Date(incident.createdAt).toLocaleString()}</span>
                </div>
                {incident.resolvedAt && (
                    <div className="incident-report-fact">
                        <span className="incident-report-fact-label">Resolved</span>
                        <span className="incident-report-fact-value">{new Date(incident.resolvedAt).toLocaleString()}</span>
                    </div>
                )}
                {incident.acknowledgedAt && (
                    <div className="incident-report-fact">
                        <span className="incident-report-fact-label">Acknowledged</span>
                        <span className="incident-report-fact-value">{new Date(incident.acknowledgedAt).toLocaleString()}</span>
                    </div>
                )}
            </div>

            <section className="incident-report-section">
                <h3>Description</h3>
                <p>{incident.description}</p>
            </section>

            {incident.affectedServices && incident.affectedServices.length > 0 && (
                <section className="incident-report-section">
                    <h3>Affected Services</h3>
                    <div className="incident-report-services">
                        {incident.affectedServices.map((service, idx) => (
                            <span key={idx} className="incident-report-service-tag">{service.serviceName}</span>
                        ))}
                    </div>
                </section>
            )}

            <section className="incident-report-section incident-report-updates">
                <h3>Updates</h3>
                <div className="incident-report-updates-list">
                    {incident.updates && incident.updates.length > 0 ? (
                        incident.updates.map((update, index) => (
                            <div key={index} className={`incident-report-update-item ${update.status || ''}`}>
                                <div className="incident-report-update-meta">
                                    <span className={`incident-report-status ${update.status}`}>
                                        {update.status}
                                    </span>
                                    <span className="incident-report-update-time">
                                        <FiClock /> {new Date(update.timestamp).toLocaleString()}
                                    </span>
                                </div>
                                <p className="incident-report-update-message">{update.message}</p>
                            </div>
                        ))
                    ) : (
                        <p className="incident-report-empty">No updates yet</p>
                    )}
                </div>

                <div className="incident-report-add-update">
                    <h4>Add Update</h4>
                    <div className="incident-report-update-form">
                        <AppSelect
                            value={newStatus}
                            onChange={onStatusChange}
                            className="incident-report-status-select"
                            options={[
                                { value: 'investigating', label: 'Investigating' },
                                { value: 'identified', label: 'Identified' },
                                { value: 'monitoring', label: 'Monitoring' },
                                { value: 'resolved', label: 'Resolved' }
                            ]}
                        />
                        <textarea
                            value={newUpdate}
                            onChange={(e) => onUpdateChange(e.target.value)}
                            placeholder="Describe the current status..."
                            className="incident-report-update-textarea"
                            rows={3}
                        />
                        <button
                            className="btn-primary"
                            onClick={onAddUpdate}
                            disabled={!newUpdate.trim()}
                        >
                            Add Update
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
};

// Timeline Tab Component
const TimelineTab = ({ timeline, status }) => {
    const getEventIcon = (eventType) => {
        switch (eventType) {
            case 'created':
                return <FiAlertTriangle />;
            case 'acknowledged':
                return <FiCheck />;
            case 'escalated':
            case 'escalation':
                return <FiArrowUp />;
            case 'alert_linked':
            case 'routing':
                return <FiLink />;
            case 'status_change':
                return <FiActivity />;
            case 'resolved':
                return <FiCheckCircle />;
            case 'prediction':
                return <FiBell />;
            case 'snoozed':
                return <FiClock />;
            case 'note':
                return <FiMessageCircle />;
            default:
                return <FiCalendar />;
        }
    };

    const getEventColor = (eventType) => {
        switch (eventType) {
            case 'created': return '#f59e0b';
            case 'acknowledged':
            case 'status_change': return '#3b82f6';
            case 'escalated':
            case 'escalation': return '#ef4444';
            case 'resolved': return '#10b981';
            case 'prediction':
            case 'note': return 'var(--primary-color)';
            case 'snoozed': return 'var(--warning-color)';
            default: return 'var(--text-secondary)';
        }
    };

    const normalizeEvent = (event) => {
        const type = event.type || 'default';
        const title = event.title || event.message || `${type.replace(/_/g, ' ')} event`;
        const description = event.description || (event.data && typeof event.data === 'string' ? event.data : '');
        const timestamp = event.at || event.timestamp;
        const actorName = event.actor?.username || event.actor?.email || event.actor?.displayName || (typeof event.actor === 'string' ? event.actor : '');
        return { type, title, description, timestamp, actorName };
    };

    const formatEventTime = (ts) => {
        const d = new Date(ts);
        return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
    };

    const formatEventType = (type) => type.replace(/_/g, ' ');

    const isLive = status !== 'resolved';

    return (
        <div className="timeline-tab-content">
            {timeline.length === 0 ? (
                <div className="empty-timeline">
                    <FiActivity className="empty-icon" />
                    <p>No timeline events yet</p>
                </div>
            ) : (
                <div className={`timeline-events${isLive ? ' is-live' : ''}`}>
                    {timeline.map((event, index) => {
                        const { type, title, description, timestamp, actorName } = normalizeEvent(event);
                        const color = getEventColor(type);
                        return (
                            <div
                                key={index}
                                className={`timeline-event ${type.replace(/_/g, '-')}`}
                                style={{ '--event-color': color }}
                            >
                                <div className="event-icon-container">
                                    <div className={`event-icon ${type.replace(/_/g, '-')}`}>
                                        {getEventIcon(type)}
                                    </div>
                                    {index < timeline.length - 1 && <div className="event-connector" />}
                                </div>
                                <div className="event-card">
                                    <div className="event-meta">
                                        <span className="event-type-label">{formatEventType(type)}</span>
                                        <span className="event-time">
                                            <FiClock /> {formatEventTime(timestamp)}
                                        </span>
                                    </div>
                                    <h4 className="event-title">{title}</h4>
                                    {description && <p className="event-description">{description}</p>}
                                    {actorName && (
                                        <div className="event-footer">
                                            <span className="event-actor">
                                                <FiUsers /> {actorName}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// Alerts Tab Component
const AlertsTab = ({ alerts }) => {
    const getSeverityColor = (severity) => {
        switch (severity) {
            case 'critical':
                return '#dc3545';
            case 'warning':
                return '#ffc107';
            case 'info':
                return '#17a2b8';
            default:
                return '#6c757d';
        }
    };

    return (
        <div className="alerts-tab-content">
            {alerts.length === 0 ? (
                <div className="empty-alerts">
                    <FiBell className="empty-icon" />
                    <p>No linked alerts</p>
                </div>
            ) : (
                <div className="linked-alerts-list">
                    {alerts.map((alert) => (
                        <div key={alert._id} className="linked-alert-card">
                            <div className="alert-header">
                                <div className={`alert-severity-indicator ${alert.severity}`} />
                                <div className="alert-info">
                                    <h4 className="alert-name">{alert.name}</h4>
                                    <span className="alert-severity">{alert.severity}</span>
                                </div>
                                <span className="alert-status">{alert.status}</span>
                            </div>
                            <p className="alert-condition">{alert.condition}</p>
                            <div className="alert-meta">
                                <span className="alert-time">
                                    <FiClock /> {new Date(alert.triggeredAt).toLocaleString()}
                                </span>
                                {alert.groupId && (
                                    <span className="alert-group">
                                        <FiLink /> Group: {alert.groupId}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Post-Mortem Tab Component
const PostMortemTab = ({ postMortem }) => {
    return (
        <div className="postmortem-tab-content">
            <div className="postmortem-header">
                <h3>Post-Mortem Analysis</h3>
                <span className="postmortem-date">
                    Generated: {new Date(postMortem.generatedAt).toLocaleString()}
                </span>
            </div>

            <div className="postmortem-section">
                <h4><FiAlertTriangle /> Summary</h4>
                <p>{postMortem.summary}</p>
            </div>

            <div className="postmortem-section">
                <h4><FiActivity /> Timeline</h4>
                <div className="postmortem-timeline">
                    <div className="timeline-item">
                        <strong>Detection Time:</strong>
                        <span>{postMortem.detectionTime} minutes</span>
                    </div>
                    <div className="timeline-item">
                        <strong>Time to Acknowledge:</strong>
                        <span>{postMortem.timeToAcknowledge} minutes</span>
                    </div>
                    <div className="timeline-item">
                        <strong>Time to Resolve:</strong>
                        <span>{postMortem.timeToResolve} minutes</span>
                    </div>
                </div>
            </div>

            <div className="postmortem-section">
                <h4><FiFileText /> Root Cause</h4>
                <p>{postMortem.rootCause}</p>
            </div>

            <div className="postmortem-section">
                <h4><FiCheckCircle /> Resolution</h4>
                <p>{postMortem.resolution}</p>
            </div>

            {postMortem.actionItems && postMortem.actionItems.length > 0 && (
                <div className="postmortem-section">
                    <h4><FiCheck /> Action Items</h4>
                    <ul className="action-items-list">
                        {postMortem.actionItems.map((item, index) => (
                            <li key={index} className="action-item">
                                <input type="checkbox" className="action-checkbox" />
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {postMortem.lessonsLearned && postMortem.lessonsLearned.length > 0 && (
                <div className="postmortem-section">
                    <h4><FiMessageCircle /> Lessons Learned</h4>
                    <ul className="lessons-list">
                        {postMortem.lessonsLearned.map((lesson, index) => (
                            <li key={index}>{lesson}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

const IncidentForm = ({ incident, onSave, onClose }) => {
    const [formData, setFormData] = useState({
        title: incident?.title || '',
        description: incident?.description || '',
        severity: incident?.severity || 'minor',
        status: incident?.status || 'investigating',
        affectedServices: incident?.affectedServices || [],
        isPublic: incident?.isPublic !== undefined ? incident.isPublic : true
    });

    const [monitors, setMonitors] = useState([]);

    useEffect(() => {
        // Fetch available monitors for affected services
        const fetchMonitors = async () => {
            try {
                const response = await fetch('/api/monitoring', {
                    credentials: 'include'
                });
                if (response.ok) {
                    const data = await response.json();
                    setMonitors(data);
                }
            } catch (error) {
                console.error('Error fetching monitors:', error);
            }
        };

        fetchMonitors();
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    const toggleAffectedService = (monitorId, serviceName) => {
        setFormData(prev => ({
            ...prev,
            affectedServices: prev.affectedServices.some(s => s.monitorId === monitorId)
                ? prev.affectedServices.filter(s => s.monitorId !== monitorId)
                : [...prev.affectedServices, { monitorId, serviceName }]
        }));
    };

    return (
        <div className="incident-form-overlay">
            <div className="incident-form-modal">
                <div className="incident-form-header">
                    <h2>{incident ? 'Edit Incident' : 'Create New Incident'}</h2>
                    <button type="button" className="incident-form-close" onClick={onClose} aria-label="Close incident form">×</button>
                </div>

                <form onSubmit={handleSubmit} className="incident-form">
                    <div className="incident-form-group">
                        <label htmlFor="incident-title">Title</label>
                        <input
                            id="incident-title"
                            className="incident-form-control"
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                            required
                            placeholder="Incident title"
                        />
                    </div>

                    <div className="incident-form-group">
                        <label htmlFor="incident-description">Description</label>
                        <textarea
                            id="incident-description"
                            className="incident-form-control"
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            required
                            placeholder="Describe the incident"
                            rows={4}
                        />
                    </div>

                    <div className="incident-form-row">
                        <div className="incident-form-group">
                            <label htmlFor="incident-severity">Severity</label>
                            <AppSelect
                                id="incident-severity"
                                className="incident-form-select"
                                value={formData.severity}
                                onChange={(severity) => setFormData(prev => ({ ...prev, severity }))}
                                options={[
                                    { value: 'minor', label: 'Minor' },
                                    { value: 'major', label: 'Major' },
                                    { value: 'critical', label: 'Critical' }
                                ]}
                            />
                        </div>

                        <div className="incident-form-group">
                            <label htmlFor="incident-status">Status</label>
                            <AppSelect
                                id="incident-status"
                                className="incident-form-select"
                                value={formData.status}
                                onChange={(status) => setFormData(prev => ({ ...prev, status }))}
                                options={[
                                    { value: 'investigating', label: 'Investigating' },
                                    { value: 'identified', label: 'Identified' },
                                    { value: 'monitoring', label: 'Monitoring' },
                                    { value: 'resolved', label: 'Resolved' }
                                ]}
                            />
                        </div>
                    </div>

                    <div className="incident-form-group">
                        <label className="incident-form-toggle">
                            <input
                                type="checkbox"
                                checked={formData.isPublic}
                                onChange={(e) => setFormData(prev => ({ ...prev, isPublic: e.target.checked }))}
                            />
                            Show on public status page
                        </label>
                    </div>

                    <div className="incident-form-group">
                        <label>Affected Services</label>
                        <div className="incident-services-grid">
                            {monitors.map(monitor => (
                                <label key={monitor._id} className="incident-service-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={formData.affectedServices.some(s => s.monitorId === monitor._id)}
                                        onChange={() => toggleAffectedService(monitor._id, monitor.name)}
                                    />
                                    {monitor.name}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="incident-form-actions">
                        <button type="button" className="btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-primary">
                            {incident ? 'Update Incident' : 'Create Incident'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default IncidentManagement;
