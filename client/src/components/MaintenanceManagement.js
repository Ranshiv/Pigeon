// client/src/components/MaintenanceManagement.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './MaintenanceManagement.css';
import {
    FiTool, FiPlus, FiEdit, FiTrash2, FiClock, FiCalendar,
    FiRepeat, FiX, FiSave, FiAlertCircle, FiSettings, FiBell, FiEye,
    FiActivity, FiBarChart, FiUsers
} from 'react-icons/fi';

const MaintenanceManagement = () => {
    const navigate = useNavigate();
    const [maintenanceWindows, setMaintenanceWindows] = useState([]);
    const [selectedWindow, setSelectedWindow] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingWindow, setEditingWindow] = useState(null);
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Effect to update the selected window when maintenance windows are refreshed
    useEffect(() => {
        if (selectedWindow && maintenanceWindows.length > 0) {
            const updatedSelectedWindow = maintenanceWindows.find(window => window._id === selectedWindow._id);
            if (updatedSelectedWindow) {
                setSelectedWindow(updatedSelectedWindow);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [maintenanceWindows]);

    const fetchMaintenanceWindows = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/maintenance', {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                setMaintenanceWindows(data);

                // If there's a selected window, update it with the latest data
                if (selectedWindow) {
                    const updatedSelectedWindow = data.find(window => window._id === selectedWindow._id);
                    if (updatedSelectedWindow) {
                        setSelectedWindow(updatedSelectedWindow);
                    }
                }
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
        setError(null);

        try {
            // Validate form data before submission
            if (!formData.title.trim()) {
                throw new Error('Title is required');
            }
            if (!formData.description.trim()) {
                throw new Error('Description is required');
            }
            if (!formData.startTime) {
                throw new Error('Start time is required');
            }
            if (!formData.endTime) {
                throw new Error('End time is required');
            }

            // Validate and format dates
            const startDate = new Date(formData.startTime);
            const endDate = new Date(formData.endTime);

            if (isNaN(startDate.getTime())) {
                throw new Error('Invalid start time format');
            }
            if (isNaN(endDate.getTime())) {
                throw new Error('Invalid end time format');
            }
            if (startDate >= endDate) {
                throw new Error('End time must be after start time');
            }
            if (startDate < new Date()) {
                throw new Error('Start time cannot be in the past');
            }

            // Map frontend fields to backend expected fields
            const requestData = {
                title: formData.title.trim(),
                description: formData.description.trim(),
                scheduledStartTime: startDate.toISOString(),
                scheduledEndTime: endDate.toISOString(),
                affectedServices: formData.affectedMonitors.map(monitorId => ({
                    monitorId: monitorId,
                    serviceName: monitors.find(m => m._id === monitorId)?.name || 'Unknown Service'
                })),
                isRecurring: formData.isRecurring,
                recurrencePattern: formData.isRecurring ? formData.recurrencePattern : undefined,
                notificationSettings: {
                    notifySubscribers: formData.notifySubscribers,
                    reminderMinutes: [1440, 60] // 24 hours and 1 hour before
                }
            };

            const response = await fetch('/api/maintenance', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(requestData)
            });

            if (response.ok) {
                // Get the newly created maintenance window from the response
                const newWindow = await response.json();

                // Close the create modal and reset form
                setShowCreateModal(false);
                resetForm();
                setError(null);

                // Set the new window as the selected window
                setSelectedWindow(newWindow);

                // Refresh the maintenance windows list from server
                await fetchMaintenanceWindows();
            } else {
                const errorData = await response.json();
                setError(errorData.message || 'Failed to create maintenance window');
            }
        } catch (err) {
            setError(err.message || 'Error creating maintenance window');
        } finally {
            setLoading(false);
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
                // If the deleted window was selected, clear the selection
                if (selectedWindow?._id === id) {
                    setSelectedWindow(null);
                }

                // Refresh the maintenance windows list
                await fetchMaintenanceWindows();
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

    const handleEditClick = (window) => {
        setEditingWindow(window);
        // Pre-populate form with existing data
        setFormData({
            title: window.title || '',
            description: window.description || '',
            startTime: window.scheduledStartTime ? new Date(window.scheduledStartTime).toISOString().slice(0, 16) : '',
            endTime: window.scheduledEndTime ? new Date(window.scheduledEndTime).toISOString().slice(0, 16) : '',
            affectedMonitors: window.affectedServices?.map(service => service.monitorId?._id || service.monitorId) || [],
            notifySubscribers: window.notificationSettings?.notifySubscribers !== undefined ? window.notificationSettings.notifySubscribers : true,
            isRecurring: window.isRecurring || false,
            recurrencePattern: window.recurrencePattern || {
                type: 'weekly',
                interval: 1,
                daysOfWeek: [],
                endDate: ''
            }
        });
        setShowEditModal(true);
    };

    const handleUpdateMaintenanceWindow = async () => {
        if (!editingWindow) return;

        setLoading(true);
        setError(null);

        try {
            // Validate form data before submission
            if (!formData.title.trim()) {
                throw new Error('Title is required');
            }
            if (!formData.description.trim()) {
                throw new Error('Description is required');
            }
            if (!formData.startTime) {
                throw new Error('Start time is required');
            }
            if (!formData.endTime) {
                throw new Error('End time is required');
            }

            // Validate and format dates
            const startDate = new Date(formData.startTime);
            const endDate = new Date(formData.endTime);

            if (isNaN(startDate.getTime())) {
                throw new Error('Invalid start time format');
            }
            if (isNaN(endDate.getTime())) {
                throw new Error('Invalid end time format');
            }
            if (startDate >= endDate) {
                throw new Error('End time must be after start time');
            }

            // Map frontend fields to backend expected fields
            const requestData = {
                title: formData.title.trim(),
                description: formData.description.trim(),
                scheduledStartTime: startDate.toISOString(),
                scheduledEndTime: endDate.toISOString(),
                affectedServices: formData.affectedMonitors.map(monitorId => ({
                    monitorId: monitorId,
                    serviceName: monitors.find(m => m._id === monitorId)?.name || 'Unknown Service'
                })),
                isRecurring: formData.isRecurring,
                recurrencePattern: formData.isRecurring ? formData.recurrencePattern : undefined,
                notificationSettings: {
                    notifySubscribers: formData.notifySubscribers,
                    reminderMinutes: [1440, 60] // 24 hours and 1 hour before
                }
            };

            const response = await fetch(`/api/maintenance/${editingWindow._id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(requestData)
            });

            if (response.ok) {
                // Get the updated window from the server response to ensure we have latest data
                const updatedWindow = await response.json();

                // Close the edit modal and reset form
                setShowEditModal(false);
                setEditingWindow(null);
                resetForm();
                setError(null);

                // Update the selected window with the fresh data
                if (selectedWindow && selectedWindow._id === editingWindow._id) {
                    setSelectedWindow(updatedWindow);
                }

                // Fetch updated data from server to refresh the list
                await fetchMaintenanceWindows();
            } else {
                const errorData = await response.json();
                setError(errorData.message || 'Failed to update maintenance window');
            }
        } catch (err) {
            setError(err.message || 'Error updating maintenance window');
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (window) => {
        const now = new Date();
        const start = new Date(window.scheduledStartTime);
        const end = new Date(window.scheduledEndTime);

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

            {/* Navigation Tabs */}
            <div className="monitoring-nav">
                <button
                    className="nav-btn"
                    onClick={() => navigate('/workspace/monitoring')}
                >
                    <FiActivity /> Dashboard
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
                    className="nav-btn active"
                    onClick={() => navigate('/workspace/monitoring/maintenance')}
                >
                    <FiTool /> Maintenance
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
                                        <span>{formatDateTime(window.scheduledStartTime)}</span>
                                    </div>
                                    <div className="meta-item">
                                        <FiClock />
                                        <span>{formatDuration(window.scheduledStartTime, window.scheduledEndTime)}</span>
                                    </div>
                                    <div className="meta-item">
                                        <FiSettings />
                                        <span>{window.affectedServices?.length || 0} monitors</span>
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
                                        onClick={() => handleEditClick(selectedWindow)}
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
                                            <span>{formatDateTime(selectedWindow.scheduledStartTime)}</span>
                                        </div>
                                        <div className="info-item">
                                            <label>End Time</label>
                                            <span>{formatDateTime(selectedWindow.scheduledEndTime)}</span>
                                        </div>
                                        <div className="info-item">
                                            <label>Duration</label>
                                            <span>{formatDuration(selectedWindow.scheduledStartTime, selectedWindow.scheduledEndTime)}</span>
                                        </div>
                                        <div className="info-item">
                                            <label>Affected Monitors</label>
                                            <span>{selectedWindow.affectedServices?.length || 0} monitors</span>
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
                                        {selectedWindow.affectedServices?.map(service => {
                                            return (
                                                <div key={service.monitorId?._id || service.monitorId} className="monitor-item">
                                                    <div className="monitor-info">
                                                        <h4>{service.serviceName || service.monitorId?.name || 'Unknown Service'}</h4>
                                                        <p>{service.monitorId?.url || 'No URL available'}</p>
                                                    </div>
                                                </div>
                                            );
                                        }) || (
                                                <p className="no-monitors">No monitors affected</p>
                                            )}
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
                            <div className="form-section">
                                <h4 className="form-section-title">Basic Information</h4>
                                <div className="form-group">
                                    <label>Maintenance Title*</label>
                                    <input
                                        type="text"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        placeholder="e.g., Database Upgrade"
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Description*</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Describe what maintenance will be performed..."
                                    />
                                </div>
                            </div>

                            <div className="form-section">
                                <h4 className="form-section-title">Schedule</h4>
                                <div className="time-inputs-row">
                                    <div className="time-input-group">
                                        <label>Start Time *</label>
                                        <input
                                            type="datetime-local"
                                            value={formData.startTime}
                                            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="time-input-group">
                                        <label>End Time *</label>
                                        <input
                                            type="datetime-local"
                                            value={formData.endTime}
                                            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="form-section">
                                <h4 className="form-section-title">Affected Services</h4>
                                <div className="form-group">
                                    <label>Select Monitors</label>
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
                            </div>

                            <div className="form-section">
                                <h4 className="form-section-title">Notification Settings</h4>
                                <div className="checkbox-section">
                                    <div className="checkbox-group">
                                        <input
                                            type="checkbox"
                                            id="notify-subscribers"
                                            checked={formData.notifySubscribers}
                                            onChange={(e) => setFormData({ ...formData, notifySubscribers: e.target.checked })}
                                        />
                                        <label htmlFor="notify-subscribers">
                                            Notify subscribers about this maintenance
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="form-section">
                                <h4 className="form-section-title">Recurrence (Optional)</h4>
                                <div className="checkbox-section">
                                    <div className="checkbox-group">
                                        <input
                                            type="checkbox"
                                            id="is-recurring"
                                            checked={formData.isRecurring}
                                            onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                                        />
                                        <label htmlFor="is-recurring">
                                            Make this a recurring maintenance window
                                        </label>
                                    </div>
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

            {/* Edit Maintenance Window Modal */}
            {showEditModal && (
                <div className="modal-overlay">
                    <div className="modal-content large">
                        <div className="modal-header">
                            <h2>Edit Maintenance Window</h2>
                            <button
                                className="modal-close"
                                onClick={() => {
                                    setShowEditModal(false);
                                    setEditingWindow(null);
                                    resetForm();
                                }}
                            >
                                <FiX />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-section">
                                <h4 className="form-section-title">Basic Information</h4>
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
                            </div>

                            <div className="form-section">
                                <h4 className="form-section-title">Schedule</h4>
                                <div className="time-inputs-row">
                                    <div className="time-input-group">
                                        <label>Start Time *</label>
                                        <input
                                            type="datetime-local"
                                            value={formData.startTime}
                                            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="time-input-group">
                                        <label>End Time *</label>
                                        <input
                                            type="datetime-local"
                                            value={formData.endTime}
                                            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="form-section">
                                <h4 className="form-section-title">Affected Services</h4>
                                <div className="form-group">
                                    <label>Select Monitors</label>
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
                            </div>

                            <div className="form-section">
                                <h4 className="form-section-title">Notification Settings</h4>
                                <div className="checkbox-section">
                                    <div className="checkbox-group">
                                        <input
                                            type="checkbox"
                                            id="edit-notify-subscribers"
                                            checked={formData.notifySubscribers}
                                            onChange={(e) => setFormData({ ...formData, notifySubscribers: e.target.checked })}
                                        />
                                        <label htmlFor="edit-notify-subscribers">
                                            Notify subscribers about this maintenance
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="form-section">
                                <h4 className="form-section-title">Recurrence (Optional)</h4>
                                <div className="checkbox-section">
                                    <div className="checkbox-group">
                                        <input
                                            type="checkbox"
                                            id="edit-is-recurring"
                                            checked={formData.isRecurring}
                                            onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                                        />
                                        <label htmlFor="edit-is-recurring">
                                            Make this a recurring maintenance window
                                        </label>
                                    </div>
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
                        </div>
                        <div className="modal-footer">
                            <button
                                className="btn-secondary"
                                onClick={() => {
                                    setShowEditModal(false);
                                    setEditingWindow(null);
                                    resetForm();
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-primary"
                                onClick={handleUpdateMaintenanceWindow}
                                disabled={!formData.title || !formData.startTime || !formData.endTime || loading}
                            >
                                <FiSave /> Update Maintenance
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MaintenanceManagement;
