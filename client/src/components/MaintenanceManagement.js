// client/src/components/MaintenanceManagement.js
import React, { useState, useEffect } from 'react';
import './MaintenanceManagement.css';
import {
    FiTool, FiPlus, FiEdit, FiTrash2, FiClock, FiCalendar,
    FiRepeat, FiPause, FiPlay, FiX, FiSave, FiAlertCircle,
    FiCheckCircle, FiSettings, FiUsers, FiBell, FiEye
} from 'react-icons/fi';

const MaintenanceManagement = () => {
    const [maintenanceWindows, setMaintenanceWindows] = useState([]);
    const [selectedWindow, setSelectedWindow] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        startTime: '',
        endTime: '',
        affectedMonitors: [],
        notifySubscribers: true,
        isRecurring: false,
        recurrencePattern: {
            type: 'weekly',
            interval: 1,
            daysOfWeek: [],
            endDate: ''
        }
    });

    const [monitors, setMonitors] = useState([]);

    useEffect(() => {
        fetchMaintenanceWindows();
        fetchMonitors();
    }, []);

    const fetchMaintenanceWindows = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/maintenance', {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                setMaintenanceWindows(data);
            } else {
                setError('Failed to fetch maintenance windows');
            }
        } catch (err) {
            setError('Error fetching maintenance windows: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchMonitors = async () => {
        try {
            const response = await fetch('/api/monitoring', {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                setMonitors(data);
            }
        } catch (err) {
            console.error('Error fetching monitors:', err);
        }
    };

    const createMaintenanceWindow = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/maintenance', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                await fetchMaintenanceWindows();
                setShowCreateModal(false);
                resetForm();
            } else {
                const errorData = await response.json();
                setError(errorData.message || 'Failed to create maintenance window');
            }
        } catch (err) {
            setError('Error creating maintenance window: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const updateMaintenanceWindow = async (id, updates) => {
        try {
            const response = await fetch(`/api/maintenance/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(updates)
            });

            if (response.ok) {
                await fetchMaintenanceWindows();
            } else {
                const errorData = await response.json();
                setError(errorData.message || 'Failed to update maintenance window');
            }
        } catch (err) {
            setError('Error updating maintenance window: ' + err.message);
        }
    };

    const deleteMaintenanceWindow = async (id) => {
        if (!window.confirm('Are you sure you want to delete this maintenance window?')) return;

        try {
            const response = await fetch(`/api/maintenance/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                await fetchMaintenanceWindows();
                if (selectedWindow?._id === id) {
                    setSelectedWindow(null);
                }
            } else {
                const errorData = await response.json();
                setError(errorData.message || 'Failed to delete maintenance window');
            }
        } catch (err) {
            setError('Error deleting maintenance window: ' + err.message);
        }
    };

    const resetForm = () => {
        setFormData({
            title: '',
            description: '',
            startTime: '',
            endTime: '',
            affectedMonitors: [],
            notifySubscribers: true,
            isRecurring: false,
            recurrencePattern: {
                type: 'weekly',
                interval: 1,
                daysOfWeek: [],
                endDate: ''
            }
        });
    };

    const getStatusBadge = (window) => {
        const now = new Date();
        const start = new Date(window.startTime);
        const end = new Date(window.endTime);

        if (now >= start && now <= end) {
            return <span className="status-badge active">Active</span>;
        } else if (now < start) {
            return <span className="status-badge scheduled">Scheduled</span>;
        } else {
            return <span className="status-badge completed">Completed</span>;
        }
    };

    const formatDateTime = (dateTime) => {
        return new Date(dateTime).toLocaleString();
    };

    const formatDuration = (start, end) => {
        const duration = new Date(end) - new Date(start);
        const hours = Math.floor(duration / (1000 * 60 * 60));
        const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    };

    const handleMonitorSelection = (monitorId) => {
        const updatedMonitors = formData.affectedMonitors.includes(monitorId)
            ? formData.affectedMonitors.filter(id => id !== monitorId)
            : [...formData.affectedMonitors, monitorId];

        setFormData({ ...formData, affectedMonitors: updatedMonitors });
    };

    if (loading && maintenanceWindows.length === 0) {
        return (
            <div className="maintenance-management">
                <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>Loading maintenance windows...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="maintenance-management">
            <div className="maintenance-header">
                <div className="header-info">
                    <h1><FiTool /> Maintenance Windows</h1>
                    <p>Schedule and manage planned maintenance periods for your monitored services</p>
                </div>
                <button
                    className="btn-primary"
                    onClick={() => setShowCreateModal(true)}
                >
                    <FiPlus /> Schedule Maintenance
                </button>
            </div>

            {error && (
                <div className="error-banner">
                    <FiAlertCircle />
                    <span>{error}</span>
                    <button onClick={() => setError(null)}>Dismiss</button>
                </div>
            )}

            <div className="maintenance-layout">
                <div className="maintenance-list">
                    <div className="list-header">
                        <h3>Maintenance Windows</h3>
                        <span className="count">{maintenanceWindows.length} total</span>
                    </div>

                    <div className="windows-list">
                        {maintenanceWindows.map(window => (
                            <div
                                key={window._id}
                                className={`window-item ${selectedWindow?._id === window._id ? 'active' : ''}`}
                                onClick={() => setSelectedWindow(window)}
                            >
                                <div className="window-header">
                                    <h4>{window.title}</h4>
                                    {getStatusBadge(window)}
                                </div>
                                <div className="window-meta">
                                    <div className="meta-item">
                                        <FiCalendar />
                                        <span>{formatDateTime(window.startTime)}</span>
                                    </div>
                                    <div className="meta-item">
                                        <FiClock />
                                        <span>{formatDuration(window.startTime, window.endTime)}</span>
                                    </div>
                                    <div className="meta-item">
                                        <FiSettings />
                                        <span>{window.affectedMonitors?.length || 0} monitors</span>
                                    </div>
                                </div>
                                {window.isRecurring && (
                                    <div className="recurring-indicator">
                                        <FiRepeat />
                                        <span>Recurring</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {maintenanceWindows.length === 0 && (
                        <div className="empty-state">
                            <FiTool className="empty-icon" />
                            <h3>No Maintenance Windows</h3>
                            <p>Schedule your first maintenance window to notify users about planned downtime</p>
                            <button
                                className="btn-primary"
                                onClick={() => setShowCreateModal(true)}
                            >
                                <FiPlus /> Schedule Maintenance
                            </button>
                        </div>
                    )}
                </div>

                <div className="maintenance-details">
                    {selectedWindow ? (
                        <div className="detail-content">
                            <div className="detail-header">
                                <div className="detail-info">
                                    <h2>{selectedWindow.title}</h2>
                                    {getStatusBadge(selectedWindow)}
                                </div>
                                <div className="detail-actions">
                                    <button
                                        className="btn-secondary"
                                        onClick={() => setSelectedWindow({ ...selectedWindow, editing: true })}
                                    >
                                        <FiEdit /> Edit
                                    </button>
                                    <button
                                        className="btn-secondary delete"
                                        onClick={() => deleteMaintenanceWindow(selectedWindow._id)}
                                    >
                                        <FiTrash2 /> Delete
                                    </button>
                                </div>
                            </div>

                            <div className="detail-body">
                                <div className="info-section">
                                    <h3>Details</h3>
                                    <div className="info-grid">
                                        <div className="info-item">
                                            <label>Start Time</label>
                                            <span>{formatDateTime(selectedWindow.startTime)}</span>
                                        </div>
                                        <div className="info-item">
                                            <label>End Time</label>
                                            <span>{formatDateTime(selectedWindow.endTime)}</span>
                                        </div>
                                        <div className="info-item">
                                            <label>Duration</label>
                                            <span>{formatDuration(selectedWindow.startTime, selectedWindow.endTime)}</span>
                                        </div>
                                        <div className="info-item">
                                            <label>Affected Monitors</label>
                                            <span>{selectedWindow.affectedMonitors?.length || 0} monitors</span>
                                        </div>
                                    </div>
                                </div>

                                {selectedWindow.description && (
                                    <div className="info-section">
                                        <h3>Description</h3>
                                        <p>{selectedWindow.description}</p>
                                    </div>
                                )}

                                {selectedWindow.isRecurring && (
                                    <div className="info-section">
                                        <h3>Recurrence</h3>
                                        <div className="recurrence-info">
                                            <FiRepeat />
                                            <span>
                                                {selectedWindow.recurrencePattern?.type}
                                                {selectedWindow.recurrencePattern?.interval > 1 &&
                                                    ` (every ${selectedWindow.recurrencePattern.interval})`
                                                }
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div className="info-section">
                                    <h3>Affected Monitors</h3>
                                    <div className="monitors-list">
                                        {selectedWindow.affectedMonitors?.map(monitorId => {
                                            const monitor = monitors.find(m => m._id === monitorId);
                                            return monitor ? (
                                                <div key={monitor._id} className="monitor-item">
                                                    <div className="monitor-info">
                                                        <h4>{monitor.name}</h4>
                                                        <p>{monitor.url}</p>
                                                    </div>
                                                </div>
                                            ) : null;
                                        })}
                                    </div>
                                </div>

                                <div className="info-section">
                                    <h3>Notifications</h3>
                                    <div className="notification-status">
                                        {selectedWindow.notifySubscribers ? (
                                            <div className="notification-item enabled">
                                                <FiBell />
                                                <span>Subscribers will be notified</span>
                                            </div>
                                        ) : (
                                            <div className="notification-item disabled">
                                                <FiBell />
                                                <span>No notifications will be sent</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="no-selection">
                            <FiEye className="empty-icon" />
                            <h3>Select a Maintenance Window</h3>
                            <p>Choose a maintenance window from the list to view details</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Maintenance Window Modal */}
            {showCreateModal && (
                <div className="modal-overlay">
                    <div className="modal-content large">
                        <div className="modal-header">
                            <h2>Schedule Maintenance Window</h2>
                            <button
                                className="modal-close"
                                onClick={() => {
                                    setShowCreateModal(false);
                                    resetForm();
                                }}
                            >
                                <FiX />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Maintenance Title *</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="e.g., Database Upgrade"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Describe what maintenance will be performed..."
                                />
                            </div>

                            <div className="time-group">
                                <div className="form-group">
                                    <label>Start Time *</label>
                                    <input
                                        type="datetime-local"
                                        value={formData.startTime}
                                        onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>End Time *</label>
                                    <input
                                        type="datetime-local"
                                        value={formData.endTime}
                                        onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Affected Monitors</label>
                                <div className="monitors-selection">
                                    {monitors.map(monitor => (
                                        <label key={monitor._id} className="monitor-checkbox">
                                            <input
                                                type="checkbox"
                                                checked={formData.affectedMonitors.includes(monitor._id)}
                                                onChange={() => handleMonitorSelection(monitor._id)}
                                            />
                                            <span>{monitor.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="form-group checkbox-group">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={formData.notifySubscribers}
                                        onChange={(e) => setFormData({ ...formData, notifySubscribers: e.target.checked })}
                                    />
                                    Notify subscribers about this maintenance
                                </label>
                            </div>

                            <div className="form-group checkbox-group">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={formData.isRecurring}
                                        onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                                    />
                                    Make this a recurring maintenance window
                                </label>
                            </div>

                            {formData.isRecurring && (
                                <div className="recurrence-section">
                                    <h3>Recurrence Pattern</h3>
                                    <div className="form-group">
                                        <label>Repeat</label>
                                        <select
                                            value={formData.recurrencePattern.type}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                recurrencePattern: {
                                                    ...formData.recurrencePattern,
                                                    type: e.target.value
                                                }
                                            })}
                                        >
                                            <option value="daily">Daily</option>
                                            <option value="weekly">Weekly</option>
                                            <option value="monthly">Monthly</option>
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label>Every</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={formData.recurrencePattern.interval}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                recurrencePattern: {
                                                    ...formData.recurrencePattern,
                                                    interval: parseInt(e.target.value)
                                                }
                                            })}
                                        />
                                        <span>{formData.recurrencePattern.type.slice(0, -2)}(s)</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button
                                className="btn-secondary"
                                onClick={() => {
                                    setShowCreateModal(false);
                                    resetForm();
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-primary"
                                onClick={createMaintenanceWindow}
                                disabled={!formData.title || !formData.startTime || !formData.endTime || loading}
                            >
                                <FiSave /> Schedule Maintenance
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MaintenanceManagement;
