// client/src/components/OnCall/OnCallOverrides.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './OnCallOverrides.css';

const OnCallOverrides = ({ scheduleId }) => {
    const [schedule, setSchedule] = useState(null);
    const [overrides, setOverrides] = useState([]);
    const [showOverrideForm, setShowOverrideForm] = useState(false);
    const [newOverride, setNewOverride] = useState({
        user: '',
        startTime: '',
        endTime: '',
        reason: ''
    });
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (scheduleId) {
            fetchSchedule();
            fetchUsers();
        }
    }, [scheduleId]);

    const fetchSchedule = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`/api/monitoring/on-call-schedules/${scheduleId}`);
            setSchedule(response.data);
            setOverrides(response.data.overrides || []);
        } catch (error) {
            console.error('Error fetching schedule:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const response = await axios.get('/api/users');
            setUsers(response.data);
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    const handleAddOverride = async () => {
        try {
            const override = {
                ...newOverride,
                startTime: new Date(newOverride.startTime),
                endTime: new Date(newOverride.endTime)
            };

            const response = await axios.post(
                `/api/monitoring/on-call-schedules/${scheduleId}/overrides`,
                override
            );

            setOverrides([...overrides, response.data]);
            setShowOverrideForm(false);
            setNewOverride({
                user: '',
                startTime: '',
                endTime: '',
                reason: ''
            });
            fetchSchedule();
        } catch (error) {
            console.error('Error adding override:', error);
            alert('Failed to add override: ' + error.response?.data?.error || error.message);
        }
    };

    const handleDeleteOverride = async (overrideId) => {
        if (!window.confirm('Are you sure you want to delete this override?')) return;

        try {
            await axios.delete(
                `/api/monitoring/on-call-schedules/${scheduleId}/overrides/${overrideId}`
            );
            setOverrides(overrides.filter(o => o._id !== overrideId));
            fetchSchedule();
        } catch (error) {
            console.error('Error deleting override:', error);
        }
    };

    const formatDateTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getOverrideDuration = (start, end) => {
        const startDate = new Date(start);
        const endDate = new Date(end);
        const durationMs = endDate - startDate;
        const hours = Math.floor(durationMs / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);

        if (days > 0) {
            const remainingHours = hours % 24;
            return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
        }
        return `${hours}h`;
    };

    const isOverrideActive = (override) => {
        const now = new Date();
        const start = new Date(override.startTime);
        const end = new Date(override.endTime);
        return now >= start && now <= end;
    };

    const isOverrideFuture = (override) => {
        const now = new Date();
        const start = new Date(override.startTime);
        return start > now;
    };

    const getUserName = (userId) => {
        const user = users.find(u => u._id === userId);
        return user ? user.name : 'Unknown User';
    };

    const sortedOverrides = [...overrides].sort((a, b) =>
        new Date(a.startTime) - new Date(b.startTime)
    );

    const activeOverrides = sortedOverrides.filter(isOverrideActive);
    const futureOverrides = sortedOverrides.filter(isOverrideFuture);
    const pastOverrides = sortedOverrides.filter(o => !isOverrideActive(o) && !isOverrideFuture(o));

    return (
        <div className="oncall-overrides">
            <div className="overrides-header">
                <div>
                    <h2 className="text-2xl font-bold">Schedule Overrides</h2>
                    {schedule && (
                        <p className="text-gray-600 mt-1">
                            {schedule.name}
                        </p>
                    )}
                </div>
                <button
                    onClick={() => setShowOverrideForm(true)}
                    className="btn-primary"
                >
                    + Add Override
                </button>
            </div>

            {showOverrideForm && (
                <div className="override-form-modal">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3 className="text-xl font-bold">Add Schedule Override</h3>
                            <button
                                onClick={() => setShowOverrideForm(false)}
                                className="btn-close"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="modal-body">
                            <div className="form-group">
                                <label>Override User *</label>
                                <select
                                    value={newOverride.user}
                                    onChange={(e) => setNewOverride({
                                        ...newOverride,
                                        user: e.target.value
                                    })}
                                    className="form-select"
                                >
                                    <option value="">Select user</option>
                                    {users.map(user => (
                                        <option key={user._id} value={user._id}>
                                            {user.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Start Time *</label>
                                    <input
                                        type="datetime-local"
                                        value={newOverride.startTime}
                                        onChange={(e) => setNewOverride({
                                            ...newOverride,
                                            startTime: e.target.value
                                        })}
                                        className="form-input"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>End Time *</label>
                                    <input
                                        type="datetime-local"
                                        value={newOverride.endTime}
                                        onChange={(e) => setNewOverride({
                                            ...newOverride,
                                            endTime: e.target.value
                                        })}
                                        className="form-input"
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Reason</label>
                                <textarea
                                    value={newOverride.reason}
                                    onChange={(e) => setNewOverride({
                                        ...newOverride,
                                        reason: e.target.value
                                    })}
                                    placeholder="e.g., Vacation coverage, Emergency replacement"
                                    className="form-textarea"
                                    rows="3"
                                />
                            </div>
                        </div>

                        <div className="modal-actions">
                            <button
                                onClick={() => setShowOverrideForm(false)}
                                className="btn-secondary"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddOverride}
                                className="btn-primary"
                                disabled={!newOverride.user || !newOverride.startTime || !newOverride.endTime}
                            >
                                Add Override
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading overrides...</p>
                </div>
            ) : (
                <div className="overrides-content">
                    {/* Active Overrides */}
                    {activeOverrides.length > 0 && (
                        <section className="overrides-section">
                            <h3 className="section-title">
                                <span className="status-indicator active"></span>
                                Currently Active
                            </h3>
                            <div className="overrides-list">
                                {activeOverrides.map(override => (
                                    <div key={override._id} className="override-card active">
                                        <div className="override-header">
                                            <div className="override-user">
                                                <span className="user-avatar">👤</span>
                                                <span className="user-name">
                                                    {getUserName(override.user)}
                                                </span>
                                            </div>
                                            <span className="active-badge">Active Now</span>
                                        </div>
                                        <div className="override-details">
                                            <div className="detail-row">
                                                <span className="detail-label">Start:</span>
                                                <span className="detail-value">
                                                    {formatDateTime(override.startTime)}
                                                </span>
                                            </div>
                                            <div className="detail-row">
                                                <span className="detail-label">End:</span>
                                                <span className="detail-value">
                                                    {formatDateTime(override.endTime)}
                                                </span>
                                            </div>
                                            <div className="detail-row">
                                                <span className="detail-label">Duration:</span>
                                                <span className="detail-value">
                                                    {getOverrideDuration(override.startTime, override.endTime)}
                                                </span>
                                            </div>
                                            {override.reason && (
                                                <div className="override-reason">
                                                    <span className="reason-label">Reason:</span>
                                                    <p className="reason-text">{override.reason}</p>
                                                </div>
                                            )}
                                        </div>
                                        <div className="override-actions">
                                            <button
                                                onClick={() => handleDeleteOverride(override._id)}
                                                className="btn-delete"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Future Overrides */}
                    {futureOverrides.length > 0 && (
                        <section className="overrides-section">
                            <h3 className="section-title">
                                <span className="status-indicator future"></span>
                                Upcoming
                            </h3>
                            <div className="overrides-list">
                                {futureOverrides.map(override => (
                                    <div key={override._id} className="override-card future">
                                        <div className="override-header">
                                            <div className="override-user">
                                                <span className="user-avatar">👤</span>
                                                <span className="user-name">
                                                    {getUserName(override.user)}
                                                </span>
                                            </div>
                                            <span className="future-badge">Scheduled</span>
                                        </div>
                                        <div className="override-details">
                                            <div className="detail-row">
                                                <span className="detail-label">Start:</span>
                                                <span className="detail-value">
                                                    {formatDateTime(override.startTime)}
                                                </span>
                                            </div>
                                            <div className="detail-row">
                                                <span className="detail-label">End:</span>
                                                <span className="detail-value">
                                                    {formatDateTime(override.endTime)}
                                                </span>
                                            </div>
                                            <div className="detail-row">
                                                <span className="detail-label">Duration:</span>
                                                <span className="detail-value">
                                                    {getOverrideDuration(override.startTime, override.endTime)}
                                                </span>
                                            </div>
                                            {override.reason && (
                                                <div className="override-reason">
                                                    <span className="reason-label">Reason:</span>
                                                    <p className="reason-text">{override.reason}</p>
                                                </div>
                                            )}
                                        </div>
                                        <div className="override-actions">
                                            <button
                                                onClick={() => handleDeleteOverride(override._id)}
                                                className="btn-delete"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Past Overrides */}
                    {pastOverrides.length > 0 && (
                        <section className="overrides-section">
                            <h3 className="section-title">
                                <span className="status-indicator past"></span>
                                Past
                            </h3>
                            <div className="overrides-list">
                                {pastOverrides.slice(0, 5).map(override => (
                                    <div key={override._id} className="override-card past">
                                        <div className="override-header">
                                            <div className="override-user">
                                                <span className="user-avatar">👤</span>
                                                <span className="user-name">
                                                    {getUserName(override.user)}
                                                </span>
                                            </div>
                                            <span className="past-badge">Completed</span>
                                        </div>
                                        <div className="override-details">
                                            <div className="detail-row">
                                                <span className="detail-label">Period:</span>
                                                <span className="detail-value">
                                                    {formatDateTime(override.startTime)} - {formatDateTime(override.endTime)}
                                                </span>
                                            </div>
                                            {override.reason && (
                                                <div className="override-reason">
                                                    <p className="reason-text">{override.reason}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {overrides.length === 0 && (
                        <div className="empty-state">
                            <p className="text-gray-500">No overrides configured for this schedule</p>
                            <button
                                onClick={() => setShowOverrideForm(true)}
                                className="btn-secondary mt-4"
                            >
                                Add First Override
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default OnCallOverrides;
