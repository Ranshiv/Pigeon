// client/src/components/MaintenanceManagement.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './MaintenanceManagement.css';
import AppSelect from './common/AppSelect/AppSelect';
import PageLoader from './common/PageLoader/PageLoader';
import {
    FiTool, FiPlus, FiEdit, FiTrash2, FiClock, FiCalendar,
    FiRepeat, FiX, FiSave, FiAlertCircle, FiSettings, FiBell, FiEye,
    FiActivity, FiBarChart, FiUsers, FiAlertTriangle
} from 'react-icons/fi';

const RECURRENCE_TYPES = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' }
];

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
                    reminderMinutes: [1440, 60]
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
                const newWindow = await response.json();
                setShowCreateModal(false);
                resetForm();
                setError(null);
                setSelectedWindow(newWindow);
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
                if (selectedWindow?._id === id) {
                    setSelectedWindow(null);
                }
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
                    reminderMinutes: [1440, 60]
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
                const updatedWindow = await response.json();
                setShowEditModal(false);
                setEditingWindow(null);
                resetForm();
                setError(null);

                if (selectedWindow && selectedWindow._id === editingWindow._id) {
                    setSelectedWindow(updatedWindow);
                }
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
            return <span className="mtm-badge active">Active</span>;
        } else if (now < start) {
            return <span className="mtm-badge scheduled">Scheduled</span>;
        } else {
            return <span className="mtm-badge completed">Completed</span>;
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

    /* ---------- Modal form body (shared between create & edit) ---------- */
    const renderFormBody = () => (
        <div className="mtm-modal-body">
            <div className="mtm-form-section">
                <h4 className="mtm-form-section-title">Basic Information</h4>
                <div className="mtm-field">
                    <label>Maintenance Title *</label>
                    <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="e.g., Database Upgrade"
                        required
                    />
                </div>
                <div className="mtm-field">
                    <label>Description *</label>
                    <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Describe what maintenance will be performed..."
                    />
                </div>
            </div>

            <div className="mtm-form-section">
                <h4 className="mtm-form-section-title">Schedule</h4>
                <div className="mtm-time-row">
                    <div className="mtm-field">
                        <label>Start Time *</label>
                        <input
                            type="datetime-local"
                            value={formData.startTime}
                            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                            required
                        />
                    </div>
                    <div className="mtm-field">
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

            <div className="mtm-form-section">
                <h4 className="mtm-form-section-title">Affected Services</h4>
                <div className="mtm-field">
                    <label>Select Monitors</label>
                    <div className="mtm-monitors-select">
                        {monitors.map(monitor => (
                            <label key={monitor._id} className="mtm-monitor-opt">
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

            <div className="mtm-form-section">
                <h4 className="mtm-form-section-title">Notification Settings</h4>
                <div className="mtm-checkbox-wrap">
                    <label className="mtm-checkbox-label">
                        <input
                            type="checkbox"
                            checked={formData.notifySubscribers}
                            onChange={(e) => setFormData({ ...formData, notifySubscribers: e.target.checked })}
                        />
                        Notify subscribers about this maintenance
                    </label>
                </div>
            </div>

            <div className="mtm-form-section">
                <h4 className="mtm-form-section-title">Recurrence (Optional)</h4>
                <div className="mtm-checkbox-wrap">
                    <label className="mtm-checkbox-label">
                        <input
                            type="checkbox"
                            checked={formData.isRecurring}
                            onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                        />
                        Make this a recurring maintenance window
                    </label>
                </div>

                {formData.isRecurring && (
                    <div className="mtm-recurrence">
                        <h3>Recurrence Pattern</h3>
                        <div className="mtm-field">
                            <label>Repeat</label>
                            <AppSelect
                                value={formData.recurrencePattern.type}
                                onChange={(v) => setFormData({
                                    ...formData,
                                    recurrencePattern: { ...formData.recurrencePattern, type: v }
                                })}
                                options={RECURRENCE_TYPES}
                            />
                        </div>
                        <div className="mtm-field">
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
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    if (loading && maintenanceWindows.length === 0) {
        return (
            <div className="mtm-root">
                <PageLoader label="Loading maintenance windows..." />
            </div>
        );
    }

    return (
        <div className="mtm-root">
            {/* Header */}
            <div className="mtm-header">
                <div className="mtm-header-left">
                    <div className="mtm-header-icon" aria-hidden="true"><FiTool /></div>
                    <div className="mtm-header-info">
                        <h1>Maintenance Windows</h1>
                        <p>Schedule and manage planned maintenance periods for your monitored services</p>
                    </div>
                </div>
                <button
                    className="mtm-btn-primary"
                    onClick={() => setShowCreateModal(true)}
                >
                    <FiPlus /> Schedule Maintenance
                </button>
            </div>

            {/* Navigation Tabs */}
            <div className="mtm-nav">
                <button
                    className="mtm-nav-btn"
                    onClick={() => navigate('/workspace/monitoring')}
                >
                    <FiActivity /> Dashboard
                </button>
                <button
                    className="mtm-nav-btn"
                    onClick={() => navigate('/alerts/policies')}
                >
                    <FiBell /> Alerts & Policies
                </button>
                <button
                    className="mtm-nav-btn"
                    onClick={() => navigate('/workspace/monitoring/incidents')}
                >
                    <FiAlertTriangle /> Incidents
                </button>
                <button
                    className="mtm-nav-btn"
                    onClick={() => navigate('/workspace/monitoring/reports')}
                >
                    <FiBarChart /> Reports
                </button>
                <button
                    className="mtm-nav-btn"
                    onClick={() => navigate('/workspace/monitoring/teams')}
                >
                    <FiUsers /> Teams
                </button>
                <button
                    className="mtm-nav-btn"
                    onClick={() => navigate('/workspace/monitoring/integrations')}
                >
                    <FiSettings /> Integrations
                </button>
                <button
                    className="mtm-nav-btn active"
                    onClick={() => navigate('/workspace/monitoring/maintenance')}
                >
                    <FiTool /> Maintenance
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="mtm-error">
                    <FiAlertCircle />
                    <span>{error}</span>
                    <button onClick={() => setError(null)}>Dismiss</button>
                </div>
            )}

            {/* Main Layout */}
            <div className="mtm-layout">
                {/* List Panel */}
                <div className="mtm-list-panel">
                    <div className="mtm-list-head">
                        <h3>Maintenance Windows</h3>
                        <span className="mtm-count">{maintenanceWindows.length} total</span>
                    </div>
                    {maintenanceWindows.length === 0 && (
                        <div className="mtm-empty">
                            <FiTool className="mtm-empty-icon" />
                            <h3>No Maintenance Windows</h3>
                            <p>Schedule your first maintenance window to notify users about planned downtime</p>
                            <button
                                className="mtm-btn-primary"
                                onClick={() => setShowCreateModal(true)}
                            >
                                <FiPlus /> Schedule Maintenance
                            </button>
                        </div>
                    )}
                    <div className="mtm-items">
                        {maintenanceWindows.map(window => (
                            <div
                                key={window._id}
                                className={`mtm-item ${selectedWindow?._id === window._id ? 'active' : ''}`}
                                onClick={() => setSelectedWindow(window)}
                            >
                                <div className="mtm-item-head">
                                    <h4>{window.title}</h4>
                                    {getStatusBadge(window)}
                                </div>
                                <div className="mtm-meta">
                                    <div className="mtm-meta-item">
                                        <FiCalendar />
                                        <span>{formatDateTime(window.scheduledStartTime)}</span>
                                    </div>
                                    <div className="mtm-meta-item">
                                        <FiClock />
                                        <span>{formatDuration(window.scheduledStartTime, window.scheduledEndTime)}</span>
                                    </div>
                                    <div className="mtm-meta-item">
                                        <FiSettings />
                                        <span>{window.affectedServices?.length || 0} monitors</span>
                                    </div>
                                </div>
                                {window.isRecurring && (
                                    <div className="mtm-recurring">
                                        <FiRepeat />
                                        <span>Recurring</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Details Panel */}
                <div className="mtm-details">
                    {selectedWindow ? (
                        <div className="mtm-detail-content">
                            <div className="mtm-detail-head">
                                <div className="mtm-detail-info">
                                    <h2>{selectedWindow.title}</h2>
                                    {getStatusBadge(selectedWindow)}
                                </div>
                                <div className="mtm-detail-actions">
                                    <button
                                        className="mtm-btn-secondary"
                                        onClick={() => handleEditClick(selectedWindow)}
                                    >
                                        <FiEdit /> Edit
                                    </button>
                                    <button
                                        className="mtm-btn-secondary mtm-delete"
                                        onClick={() => deleteMaintenanceWindow(selectedWindow._id)}
                                    >
                                        <FiTrash2 /> Delete
                                    </button>
                                </div>
                            </div>

                            <div className="mtm-detail-body">
                                <div className="mtm-section">
                                    <h3>Details</h3>
                                    <div className="mtm-info-grid">
                                        <div className="mtm-info-item">
                                            <label>Start Time</label>
                                            <span>{formatDateTime(selectedWindow.scheduledStartTime)}</span>
                                        </div>
                                        <div className="mtm-info-item">
                                            <label>End Time</label>
                                            <span>{formatDateTime(selectedWindow.scheduledEndTime)}</span>
                                        </div>
                                        <div className="mtm-info-item">
                                            <label>Duration</label>
                                            <span>{formatDuration(selectedWindow.scheduledStartTime, selectedWindow.scheduledEndTime)}</span>
                                        </div>
                                        <div className="mtm-info-item">
                                            <label>Affected Monitors</label>
                                            <span>{selectedWindow.affectedServices?.length || 0} monitors</span>
                                        </div>
                                    </div>
                                </div>

                                {selectedWindow.description && (
                                    <div className="mtm-section">
                                        <h3>Description</h3>
                                        <p>{selectedWindow.description}</p>
                                    </div>
                                )}

                                {selectedWindow.isRecurring && (
                                    <div className="mtm-section">
                                        <h3>Recurrence</h3>
                                        <div className="mtm-recurrence-info">
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

                                <div className="mtm-section">
                                    <h3>Affected Monitors</h3>
                                    <div className="mtm-monitors-list">
                                        {selectedWindow.affectedServices?.map(service => (
                                            <div key={service.monitorId?._id || service.monitorId} className="mtm-monitor-item">
                                                <h4>{service.serviceName || service.monitorId?.name || 'Unknown Service'}</h4>
                                                <p>{service.monitorId?.url || 'No URL available'}</p>
                                            </div>
                                        )) || (
                                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No monitors affected</p>
                                        )}
                                    </div>
                                </div>

                                <div className="mtm-section">
                                    <h3>Notifications</h3>
                                    <div className="mtm-notif-status">
                                        {selectedWindow.notifySubscribers ? (
                                            <div className="mtm-notif-item enabled">
                                                <FiBell />
                                                <span>Subscribers will be notified</span>
                                            </div>
                                        ) : (
                                            <div className="mtm-notif-item disabled">
                                                <FiBell />
                                                <span>No notifications will be sent</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="mtm-no-selection">
                            <FiEye className="mtm-empty-icon" />
                            <h3>Select a Maintenance Window</h3>
                            <p>Choose a maintenance window from the list to view details</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="mtm-overlay">
                    <div className="mtm-modal">
                        <div className="mtm-modal-head">
                            <h2>Schedule Maintenance Window</h2>
                            <button
                                className="mtm-modal-close"
                                onClick={() => {
                                    setShowCreateModal(false);
                                    resetForm();
                                }}
                            >
                                <FiX />
                            </button>
                        </div>
                        {renderFormBody()}
                        <div className="mtm-modal-foot">
                            <button
                                className="mtm-btn-secondary"
                                onClick={() => {
                                    setShowCreateModal(false);
                                    resetForm();
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                className="mtm-btn-primary"
                                onClick={createMaintenanceWindow}
                                disabled={!formData.title || !formData.startTime || !formData.endTime || loading}
                            >
                                <FiSave /> Schedule Maintenance
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && (
                <div className="mtm-overlay">
                    <div className="mtm-modal">
                        <div className="mtm-modal-head">
                            <h2>Edit Maintenance Window</h2>
                            <button
                                className="mtm-modal-close"
                                onClick={() => {
                                    setShowEditModal(false);
                                    setEditingWindow(null);
                                    resetForm();
                                }}
                            >
                                <FiX />
                            </button>
                        </div>
                        {renderFormBody()}
                        <div className="mtm-modal-foot">
                            <button
                                className="mtm-btn-secondary"
                                onClick={() => {
                                    setShowEditModal(false);
                                    setEditingWindow(null);
                                    resetForm();
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                className="mtm-btn-primary"
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
