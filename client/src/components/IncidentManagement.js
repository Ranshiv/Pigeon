// client/src/components/IncidentManagement.js
import React, { useState, useEffect } from 'react';
import {
    FiAlertTriangle, FiPlus, FiEdit, FiTrash2,
    FiEye, FiClock, FiCheckCircle, FiAlertCircle,
    FiSearch, FiRefreshCw
} from 'react-icons/fi';
import './IncidentManagement.css';

const IncidentManagement = () => {
    const [incidents, setIncidents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingIncident, setEditingIncident] = useState(null);
    const [selectedIncident, setSelectedIncident] = useState(null);

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
            } catch (error) {
                console.error('Error fetching incidents:', error);
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

    const filteredIncidents = incidents.filter(incident => {
        const matchesSearch = incident.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            incident.description.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    if (loading) {
        return (
            <div className="incident-management">
                <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>Loading incidents...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="incident-management">
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
                    <IncidentDetails
                        incident={selectedIncident}
                        onUpdate={updateIncident}
                        onClose={() => setSelectedIncident(null)}
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

const IncidentDetails = ({ incident, onUpdate, onClose }) => {
    const [newUpdate, setNewUpdate] = useState('');
    const [newStatus, setNewStatus] = useState(incident.status);

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

    return (
        <div className="incident-details">
            <div className="details-header">
                <h2>{incident.title}</h2>
                <button className="close-btn" onClick={onClose}>×</button>
            </div>

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
            </div>

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
                            onChange={(e) => setNewStatus(e.target.value)}
                            className="status-select"
                        >
                            <option value="investigating">Investigating</option>
                            <option value="identified">Identified</option>
                            <option value="monitoring">Monitoring</option>
                            <option value="resolved">Resolved</option>
                        </select>
                        <textarea
                            value={newUpdate}
                            onChange={(e) => setNewUpdate(e.target.value)}
                            placeholder="Describe the current status..."
                            className="update-textarea"
                            rows={3}
                        />
                        <button
                            className="btn-primary"
                            onClick={addUpdate}
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
