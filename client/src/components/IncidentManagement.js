// client/src/components/IncidentManagement.js
import React, { useState, useEffect } from 'react';
import {
    FiAlertTriangle, FiPlus, FiEdit, FiTrash2,
    FiEye, FiClock, FiCheckCircle, FiAlertCircle,
    FiSearch, FiRefreshCw, FiBell, FiActivity, FiFileText,
    FiUsers, FiArrowUp, FiCheck, FiLink, FiCalendar, FiMessageCircle
} from 'react-icons/fi';
import './IncidentManagement.css';
import PageLoader from './common/PageLoader/PageLoader';

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

                const response = await fetch(`/api/monitoring/incidents?${queryParams}`, {
                    credentials: 'include'
                });

                if (response.ok) {
                    const data = await response.json();
                    setIncidents(data);
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

            const response = await fetch(`/api/monitoring/incidents?${queryParams}`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                setIncidents(data);
            }
        } catch (error) {
            console.error('Error fetching incidents:', error);
        } finally {
            setLoading(false);
        }
    };

    const createIncident = async (incidentData) => {
        try {
            const response = await fetch('/api/monitoring/incidents', {
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
            const response = await fetch(`/api/monitoring/incidents/${incidentId}`, {
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
            const response = await fetch(`/api/monitoring/incidents/${incidentId}`, {
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
            case 'critical': return '#dc3545';
            case 'major': return '#fd7e14';
            case 'minor': return '#ffc107';
            default: return '#6c757d';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'investigating': return <FiAlertTriangle className="status-icon investigating" />;
            case 'identified': return <FiEye className="status-icon identified" />;
            case 'monitoring': return <FiClock className="status-icon monitoring" />;
            case 'resolved': return <FiCheckCircle className="status-icon resolved" />;
            default: return <FiAlertCircle className="status-icon unknown" />;
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

    if (loading) {
        return (
            <div className="incident-management">
                <PageLoader label="Loading incidents..." />
                </div>
            </div>
        );
    }

    return (
        <div className="incident-management">
            {error && (
                <div className="error-banner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: 'var(--error-bg, #fef2f2)', color: 'var(--error-text, #ef4444)', borderRadius: '6px', marginBottom: '12px' }}>
                    <span>{error}</span>
                    <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '18px' }}>×</button>
                </div>
            )}
            <div className="incident-header">
                <div className="header-info">
                    <h1><FiAlertTriangle /> Incident Management</h1>
                    <p>Track and manage service incidents and outages</p>
                </div>
                <div className="header-actions">
                    <button
                        className="btn-refresh"
                        onClick={refetchIncidents}
                        title="Refresh incidents"
                    >
                        <FiRefreshCw />
                    </button>
                    <button
                        className="btn-primary"
                        onClick={() => setShowCreateForm(true)}
                    >
                        <FiPlus /> Create Incident
                    </button>
                </div>
            </div>

            <div className="incident-filters">
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

                <div className="filter-buttons">
                    {[
                        { key: 'all', label: 'All' },
                        { key: 'investigating', label: 'Investigating' },
                        { key: 'identified', label: 'Identified' },
                        { key: 'monitoring', label: 'Monitoring' },
                        { key: 'resolved', label: 'Resolved' }
                    ].map(filterOption => (
                        <button
                            key={filterOption.key}
                            className={`filter-btn ${filter === filterOption.key ? 'active' : ''}`}
                            onClick={() => setFilter(filterOption.key)}
                        >
                            {filterOption.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="incident-content">
                <div className="incidents-list">
                    {filteredIncidents.length === 0 ? (
                        <div className="empty-state">
                            <FiAlertTriangle className="empty-icon" />
                            <h3>No incidents found</h3>
                            <p>No incidents match your current filters</p>
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
                                        <span className="status-text">{incident.status}</span>
                                    </div>
                                    <div
                                        className="severity-badge"
                                        style={{ backgroundColor: getSeverityColor(incident.severity) }}
                                    >
                                        {incident.severity}
                                    </div>
                                </div>

                                <h3 className="incident-title">{incident.title}</h3>
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

                                <div className="incident-actions">
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
                        ))
                    )}
                </div>

                {selectedIncident && (
                    <EnhancedIncidentDetails
                        incident={selectedIncident}
                        timeline={incidentTimeline}
                        linkedAlerts={linkedAlerts}
                        postMortem={postMortem}
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                        onUpdate={updateIncident}
                        onClose={() => {
                            setSelectedIncident(null);
                            setActiveTab('details');
                            setIncidentTimeline([]);
                            setLinkedAlerts([]);
                            setPostMortem(null);
                        }}
                        onAcknowledge={handleAcknowledge}
                        onEscalate={handleEscalate}
                        onResolve={handleResolve}
                        actionLoading={actionLoading}
                    />
                )}
            </div>

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
        <div className="incident-details enhanced">
            <div className="details-header">
                <div className="header-left">
                    <h2>{incident.title}</h2>
                    <div className="incident-badges">
                        <span className={`severity-badge ${incident.severity}`}>{incident.severity}</span>
                        <span className={`status-badge ${incident.status}`}>{incident.status}</span>
                    </div>
                </div>
                <button className="close-btn" onClick={onClose}>×</button>
            </div>

            {/* Workflow Action Buttons */}
            <div className="workflow-actions">
                {incident.status !== 'acknowledged' && incident.status !== 'resolved' && (
                    <button
                        className="action-btn acknowledge"
                        onClick={() => onAcknowledge(incident._id)}
                        disabled={actionLoading}
                    >
                        <FiCheck /> Acknowledge
                    </button>
                )}
                {incident.status !== 'resolved' && (
                    <button
                        className="action-btn escalate"
                        onClick={() => setShowEscalateModal(true)}
                        disabled={actionLoading}
                    >
                        <FiArrowUp /> Escalate
                    </button>
                )}
                {incident.status !== 'resolved' && (
                    <button
                        className="action-btn resolve"
                        onClick={() => setShowResolveModal(true)}
                        disabled={actionLoading}
                    >
                        <FiCheckCircle /> Resolve
                    </button>
                )}
            </div>

            {/* Tab Navigation */}
            <div className="details-tabs">
                <button
                    className={`tab-btn ${activeTab === 'details' ? 'active' : ''}`}
                    onClick={() => onTabChange('details')}
                >
                    <FiFileText /> Details
                </button>
                <button
                    className={`tab-btn ${activeTab === 'timeline' ? 'active' : ''}`}
                    onClick={() => onTabChange('timeline')}
                >
                    <FiActivity /> Timeline
                </button>
                <button
                    className={`tab-btn ${activeTab === 'alerts' ? 'active' : ''}`}
                    onClick={() => onTabChange('alerts')}
                >
                    <FiBell /> Linked Alerts ({linkedAlerts.length})
                </button>
                {postMortem && (
                    <button
                        className={`tab-btn ${activeTab === 'postmortem' ? 'active' : ''}`}
                        onClick={() => onTabChange('postmortem')}
                    >
                        <FiMessageCircle /> Post-Mortem
                    </button>
                )}
            </div>

            {/* Tab Content */}
            <div className="tab-content">
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
                    <TimelineTab timeline={timeline} />
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
        <div className="details-tab-content">
            <div className="incident-info">
                <div className="info-row">
                    <strong>Status:</strong>
                    <span className={`status ${incident.status}`}>{incident.status}</span>
                </div>
                <div className="info-row">
                    <strong>Severity:</strong>
                    <span className={`severity ${incident.severity}`}>{incident.severity}</span>
                </div>
                <div className="info-row">
                    <strong>Created:</strong>
                    <span>{new Date(incident.createdAt).toLocaleString()}</span>
                </div>
                {incident.resolvedAt && (
                    <div className="info-row">
                        <strong>Resolved:</strong>
                        <span>{new Date(incident.resolvedAt).toLocaleString()}</span>
                    </div>
                )}
                {incident.acknowledgedAt && (
                    <div className="info-row">
                        <strong>Acknowledged:</strong>
                        <span>{new Date(incident.acknowledgedAt).toLocaleString()}</span>
                    </div>
                )}
            </div>

            <div className="incident-description">
                <h4>Description</h4>
                <p>{incident.description}</p>
            </div>

            {incident.affectedServices && incident.affectedServices.length > 0 && (
                <div className="affected-services-section">
                    <h4>Affected Services</h4>
                    <div className="services-list">
                        {incident.affectedServices.map((service, idx) => (
                            <span key={idx} className="service-tag">{service.serviceName}</span>
                        ))}
                    </div>
                </div>
            )}

            <div className="incident-updates">
                <h3>Updates</h3>
                <div className="updates-list">
                    {incident.updates && incident.updates.length > 0 ? (
                        incident.updates.map((update, index) => (
                            <div key={index} className="update-item">
                                <div className="update-header">
                                    <span className={`update-status ${update.status}`}>
                                        {update.status}
                                    </span>
                                    <span className="update-time">
                                        {new Date(update.timestamp).toLocaleString()}
                                    </span>
                                </div>
                                <p className="update-message">{update.message}</p>
                            </div>
                        ))
                    ) : (
                        <p className="no-updates">No updates yet</p>
                    )}
                </div>

                <div className="add-update">
                    <h4>Add Update</h4>
                    <div className="update-form">
                        <select
                            value={newStatus}
                            onChange={(e) => onStatusChange(e.target.value)}
                            className="status-select"
                        >
                            <option value="investigating">Investigating</option>
                            <option value="identified">Identified</option>
                            <option value="monitoring">Monitoring</option>
                            <option value="resolved">Resolved</option>
                        </select>
                        <textarea
                            value={newUpdate}
                            onChange={(e) => onUpdateChange(e.target.value)}
                            placeholder="Describe the current status..."
                            className="update-textarea"
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
            </div>
        </div>
    );
};

// Timeline Tab Component
const TimelineTab = ({ timeline }) => {
    const getEventIcon = (eventType) => {
        switch (eventType) {
            case 'created':
                return <FiAlertTriangle className="event-icon created" />;
            case 'acknowledged':
                return <FiCheck className="event-icon acknowledged" />;
            case 'escalated':
                return <FiArrowUp className="event-icon escalated" />;
            case 'alert_linked':
                return <FiLink className="event-icon linked" />;
            case 'status_change':
                return <FiActivity className="event-icon status-change" />;
            case 'resolved':
                return <FiCheckCircle className="event-icon resolved" />;
            default:
                return <FiCalendar className="event-icon default" />;
        }
    };

    return (
        <div className="timeline-tab-content">
            {timeline.length === 0 ? (
                <div className="empty-timeline">
                    <FiActivity className="empty-icon" />
                    <p>No timeline events yet</p>
                </div>
            ) : (
                <div className="timeline-events">
                    {timeline.map((event, index) => (
                        <div key={index} className="timeline-event">
                            <div className="event-icon-container">
                                {getEventIcon(event.type)}
                                {index < timeline.length - 1 && <div className="event-connector" />}
                            </div>
                            <div className="event-content">
                                <div className="event-header">
                                    <h4 className="event-title">{event.title}</h4>
                                    <span className="event-time">
                                        {new Date(event.timestamp).toLocaleString()}
                                    </span>
                                </div>
                                <p className="event-description">{event.description}</p>
                                {event.actor && (
                                    <span className="event-actor">
                                        <FiUsers /> {event.actor}
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
                                <div
                                    className="alert-severity-indicator"
                                    style={{ backgroundColor: getSeverityColor(alert.severity) }}
                                />
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
        <div className="modal-overlay">
            <div className="incident-form-modal">
                <div className="modal-header">
                    <h2>{incident ? 'Edit Incident' : 'Create New Incident'}</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <form onSubmit={handleSubmit} className="incident-form">
                    <div className="form-group">
                        <label>Title</label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                            required
                            placeholder="Incident title"
                        />
                    </div>

                    <div className="form-group">
                        <label>Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            required
                            placeholder="Describe the incident"
                            rows={4}
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Severity</label>
                            <select
                                value={formData.severity}
                                onChange={(e) => setFormData(prev => ({ ...prev, severity: e.target.value }))}
                            >
                                <option value="minor">Minor</option>
                                <option value="major">Major</option>
                                <option value="critical">Critical</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Status</label>
                            <select
                                value={formData.status}
                                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                            >
                                <option value="investigating">Investigating</option>
                                <option value="identified">Identified</option>
                                <option value="monitoring">Monitoring</option>
                                <option value="resolved">Resolved</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>
                            <input
                                type="checkbox"
                                checked={formData.isPublic}
                                onChange={(e) => setFormData(prev => ({ ...prev, isPublic: e.target.checked }))}
                            />
                            Show on public status page
                        </label>
                    </div>

                    <div className="form-group">
                        <label>Affected Services</label>
                        <div className="services-grid">
                            {monitors.map(monitor => (
                                <label key={monitor._id} className="service-checkbox">
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

                    <div className="form-actions">
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
