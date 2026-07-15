// client/src/components/OnCall/OnCallScheduler.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './OnCallScheduler.css';

const OnCallScheduler = () => {
    const [schedules, setSchedules] = useState([]);
    const [currentSchedule, setCurrentSchedule] = useState(null);
    const [showEditor, setShowEditor] = useState(false);
    const [users, setUsers] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSchedules();
        fetchUsers();
        fetchTeams();
    }, []);

    const fetchSchedules = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/monitoring/on-call-schedules');
            setSchedules(response.data);
        } catch (error) {
            console.error('Error fetching schedules:', error);
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

    const fetchTeams = async () => {
        try {
            const response = await axios.get('/api/teams');
            setTeams(response.data);
        } catch (error) {
            console.error('Error fetching teams:', error);
        }
    };

    const handleCreateSchedule = () => {
        setCurrentSchedule({
            name: '',
            description: '',
            team: '',
            timezone: 'UTC',
            rotation: {
                type: 'daily',
                frequency: 1,
                participants: []
            },
            overrides: [],
            coverageWindows: [{
                days: [1, 2, 3, 4, 5],
                startTime: '09:00',
                endTime: '17:00'
            }]
        });
        setShowEditor(true);
    };

    const handleEditSchedule = (schedule) => {
        setCurrentSchedule(schedule);
        setShowEditor(true);
    };

    const handleSaveSchedule = async () => {
        try {
            if (currentSchedule._id) {
                await axios.put(`/api/monitoring/on-call-schedules/${currentSchedule._id}`, currentSchedule);
            } else {
                await axios.post('/api/monitoring/on-call-schedules', currentSchedule);
            }
            setShowEditor(false);
            setCurrentSchedule(null);
            fetchSchedules();
        } catch (error) {
            console.error('Error saving schedule:', error);
            alert('Failed to save schedule: ' + error.response?.data?.error || error.message);
        }
    };

    const handleDeleteSchedule = async (scheduleId) => {
        if (!window.confirm('Are you sure you want to delete this schedule?')) return;
        
        try {
            await axios.delete(`/api/monitoring/on-call-schedules/${scheduleId}`);
            fetchSchedules();
        } catch (error) {
            console.error('Error deleting schedule:', error);
        }
    };

    const getRotationLabel = (rotation) => {
        const types = {
            daily: 'Daily',
            weekly: 'Weekly',
            custom: 'Custom'
        };
        return `${types[rotation.type]} (${rotation.frequency} ${rotation.type === 'daily' ? 'day(s)' : 'week(s)'})`;
    };

    const getDayName = (day) => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days[day];
    };

    return (
        <div className="oncall-scheduler">
            <div className="scheduler-header">
                <h1 className="text-3xl font-bold text-gray-900">On-Call Schedules</h1>
                <button onClick={handleCreateSchedule} className="btn-primary">
                    + Create Schedule
                </button>
            </div>

            {showEditor ? (
                <div className="schedule-editor">
                    <div className="editor-header">
                        <h2 className="text-2xl font-bold">
                            {currentSchedule._id ? 'Edit Schedule' : 'Create Schedule'}
                        </h2>
                    </div>

                    <div className="editor-content">
                        {/* Basic Info */}
                        <section className="editor-section">
                            <h3 className="section-title">Basic Information</h3>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Schedule Name *</label>
                                    <input
                                        type="text"
                                        value={currentSchedule.name}
                                        onChange={(e) => setCurrentSchedule({
                                            ...currentSchedule,
                                            name: e.target.value
                                        })}
                                        placeholder="Primary On-Call"
                                        className="form-input"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Team</label>
                                    <select
                                        value={currentSchedule.team}
                                        onChange={(e) => setCurrentSchedule({
                                            ...currentSchedule,
                                            team: e.target.value
                                        })}
                                        className="form-select"
                                    >
                                        <option value="">Select a team</option>
                                        {teams.map(team => (
                                            <option key={team._id} value={team._id}>{team.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Timezone</label>
                                    <select
                                        value={currentSchedule.timezone}
                                        onChange={(e) => setCurrentSchedule({
                                            ...currentSchedule,
                                            timezone: e.target.value
                                        })}
                                        className="form-select"
                                    >
                                        <option value="UTC">UTC</option>
                                        <option value="America/New_York">Eastern Time</option>
                                        <option value="America/Chicago">Central Time</option>
                                        <option value="America/Denver">Mountain Time</option>
                                        <option value="America/Los_Angeles">Pacific Time</option>
                                        <option value="Europe/London">London</option>
                                        <option value="Asia/Tokyo">Tokyo</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Description</label>
                                <textarea
                                    value={currentSchedule.description}
                                    onChange={(e) => setCurrentSchedule({
                                        ...currentSchedule,
                                        description: e.target.value
                                    })}
                                    placeholder="Describe this on-call schedule..."
                                    className="form-textarea"
                                    rows="3"
                                />
                            </div>
                        </section>

                        {/* Rotation Settings */}
                        <section className="editor-section">
                            <h3 className="section-title">Rotation Configuration</h3>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Rotation Type</label>
                                    <select
                                        value={currentSchedule.rotation.type}
                                        onChange={(e) => setCurrentSchedule({
                                            ...currentSchedule,
                                            rotation: { ...currentSchedule.rotation, type: e.target.value }
                                        })}
                                        className="form-select"
                                    >
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="custom">Custom</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Frequency</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={currentSchedule.rotation.frequency}
                                        onChange={(e) => setCurrentSchedule({
                                            ...currentSchedule,
                                            rotation: { ...currentSchedule.rotation, frequency: parseInt(e.target.value) }
                                        })}
                                        className="form-input"
                                    />
                                </div>
                            </div>

                            {/* Participants */}
                            <div className="participants-section">
                                <label className="section-subtitle">Rotation Participants</label>
                                <div className="participants-list">
                                    {currentSchedule.rotation.participants.map((participant, index) => (
                                        <div key={index} className="participant-card">
                                            <select
                                                value={participant.user}
                                                onChange={(e) => {
                                                    const newParticipants = [...currentSchedule.rotation.participants];
                                                    newParticipants[index].user = e.target.value;
                                                    setCurrentSchedule({
                                                        ...currentSchedule,
                                                        rotation: { ...currentSchedule.rotation, participants: newParticipants }
                                                    });
                                                }}
                                                className="form-select"
                                            >
                                                <option value="">Select user</option>
                                                {users.map(user => (
                                                    <option key={user._id} value={user._id}>{user.name}</option>
                                                ))}
                                            </select>
                                            <button
                                                onClick={() => {
                                                    const newParticipants = currentSchedule.rotation.participants.filter((_, i) => i !== index);
                                                    setCurrentSchedule({
                                                        ...currentSchedule,
                                                        rotation: { ...currentSchedule.rotation, participants: newParticipants }
                                                    });
                                                }}
                                                className="btn-remove"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => {
                                            const newParticipants = [...currentSchedule.rotation.participants, { user: '', order: currentSchedule.rotation.participants.length }];
                                            setCurrentSchedule({
                                                ...currentSchedule,
                                                rotation: { ...currentSchedule.rotation, participants: newParticipants }
                                            });
                                        }}
                                        className="btn-secondary"
                                    >
                                        + Add Participant
                                    </button>
                                </div>
                            </div>
                        </section>

                        {/* Coverage Windows */}
                        <section className="editor-section">
                            <h3 className="section-title">Coverage Windows</h3>
                            {currentSchedule.coverageWindows.map((window, index) => (
                                <div key={index} className="coverage-window-card">
                                    <div className="form-grid">
                                        <div className="form-group">
                                            <label>Days</label>
                                            <div className="days-selector">
                                                {[0, 1, 2, 3, 4, 5, 6].map(day => (
                                                    <label key={day} className="day-checkbox">
                                                        <input
                                                            type="checkbox"
                                                            checked={window.days.includes(day)}
                                                            onChange={(e) => {
                                                                const newWindows = [...currentSchedule.coverageWindows];
                                                                if (e.target.checked) {
                                                                    newWindows[index].days = [...newWindows[index].days, day].sort();
                                                                } else {
                                                                    newWindows[index].days = newWindows[index].days.filter(d => d !== day);
                                                                }
                                                                setCurrentSchedule({ ...currentSchedule, coverageWindows: newWindows });
                                                            }}
                                                        />
                                                        <span>{getDayName(day)}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="form-grid">
                                        <div className="form-group">
                                            <label>Start Time</label>
                                            <input
                                                type="time"
                                                value={window.startTime}
                                                onChange={(e) => {
                                                    const newWindows = [...currentSchedule.coverageWindows];
                                                    newWindows[index].startTime = e.target.value;
                                                    setCurrentSchedule({ ...currentSchedule, coverageWindows: newWindows });
                                                }}
                                                className="form-input"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>End Time</label>
                                            <input
                                                type="time"
                                                value={window.endTime}
                                                onChange={(e) => {
                                                    const newWindows = [...currentSchedule.coverageWindows];
                                                    newWindows[index].endTime = e.target.value;
                                                    setCurrentSchedule({ ...currentSchedule, coverageWindows: newWindows });
                                                }}
                                                className="form-input"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </section>
                    </div>

                    <div className="editor-actions">
                        <button
                            onClick={() => {
                                setShowEditor(false);
                                setCurrentSchedule(null);
                            }}
                            className="btn-secondary"
                        >
                            Cancel
                        </button>
                        <button onClick={handleSaveSchedule} className="btn-primary">
                            Save Schedule
                        </button>
                    </div>
                </div>
            ) : (
                <div className="schedules-list">
                    {loading ? (
                        <div className="loading-state">
                            <div className="spinner"></div>
                            <p>Loading schedules...</p>
                        </div>
                    ) : schedules.length === 0 ? (
                        <div className="empty-state">
                            <p className="text-gray-500">No on-call schedules configured</p>
                        </div>
                    ) : (
                        schedules.map(schedule => (
                            <div key={schedule._id} className="schedule-card">
                                <div className="schedule-header">
                                    <div>
                                        <h3 className="schedule-name">{schedule.name}</h3>
                                        {schedule.description && (
                                            <p className="schedule-description">{schedule.description}</p>
                                        )}
                                    </div>
                                    <div className="schedule-actions">
                                        <button
                                            onClick={() => handleEditSchedule(schedule)}
                                            className="btn-icon"
                                            title="Edit"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={() => handleDeleteSchedule(schedule._id)}
                                            className="btn-icon"
                                            title="Delete"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                                <div className="schedule-details">
                                    <div className="detail-item">
                                        <span className="detail-label">Rotation:</span>
                                        <span className="detail-value">{getRotationLabel(schedule.rotation)}</span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="detail-label">Participants:</span>
                                        <span className="detail-value">{schedule.rotation.participants.length}</span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="detail-label">Timezone:</span>
                                        <span className="detail-value">{schedule.timezone}</span>
                                    </div>
                                    {schedule.currentOnCall && (
                                        <div className="detail-item current-oncall">
                                            <span className="detail-label">Currently On-Call:</span>
                                            <span className="detail-value oncall-name">
                                                {schedule.currentOnCall.name}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default OnCallScheduler;
