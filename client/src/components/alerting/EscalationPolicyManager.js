// client/src/components/Alerting/EscalationPolicyManager.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './EscalationPolicyManager.css';

const EscalationPolicyManager = () => {
    const [policies, setPolicies] = useState([]);
    const [showEditor, setShowEditor] = useState(false);
    const [currentPolicy, setCurrentPolicy] = useState(null);
    const [users, setUsers] = useState([]);
    const [teams, setTeams] = useState([]);
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPolicies();
        fetchUsers();
        fetchTeams();
        fetchSchedules();
    }, []);

    const fetchPolicies = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/monitoring/escalation-policies');
            setPolicies(response.data);
        } catch (error) {
            console.error('Error fetching escalation policies:', error);
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

    const fetchSchedules = async () => {
        try {
            const response = await axios.get('/api/monitoring/on-call-schedules');
            setSchedules(response.data);
        } catch (error) {
            console.error('Error fetching schedules:', error);
        }
    };

    const handleCreatePolicy = () => {
        setCurrentPolicy({
            name: '',
            description: '',
            levels: [{
                order: 0,
                delayMinutes: 0,
                targets: []
            }],
            repeatCount: 0,
            repeatIntervalMinutes: 30,
            timeRestrictions: {
                enabled: false,
                windows: []
            }
        });
        setShowEditor(true);
    };

    const handleEditPolicy = (policy) => {
        setCurrentPolicy(policy);
        setShowEditor(true);
    };

    const handleSavePolicy = async () => {
        try {
            if (currentPolicy._id) {
                await axios.put(`/api/monitoring/escalation-policies/${currentPolicy._id}`, currentPolicy);
            } else {
                await axios.post('/api/monitoring/escalation-policies', currentPolicy);
            }
            setShowEditor(false);
            setCurrentPolicy(null);
            fetchPolicies();
        } catch (error) {
            console.error('Error saving policy:', error);
            alert('Failed to save policy: ' + error.response?.data?.error || error.message);
        }
    };

    const handleDeletePolicy = async (policyId) => {
        if (!window.confirm('Are you sure you want to delete this escalation policy?')) return;

        try {
            await axios.delete(`/api/monitoring/escalation-policies/${policyId}`);
            fetchPolicies();
        } catch (error) {
            console.error('Error deleting policy:', error);
        }
    };

    const addEscalationLevel = () => {
        const newLevel = {
            order: currentPolicy.levels.length,
            delayMinutes: currentPolicy.levels.length === 0 ? 0 : 15,
            targets: []
        };
        setCurrentPolicy({
            ...currentPolicy,
            levels: [...currentPolicy.levels, newLevel]
        });
    };

    const removeEscalationLevel = (index) => {
        const newLevels = currentPolicy.levels
            .filter((_, i) => i !== index)
            .map((level, i) => ({ ...level, order: i }));
        setCurrentPolicy({ ...currentPolicy, levels: newLevels });
    };

    const updateLevel = (index, field, value) => {
        const newLevels = [...currentPolicy.levels];
        newLevels[index] = { ...newLevels[index], [field]: value };
        setCurrentPolicy({ ...currentPolicy, levels: newLevels });
    };

    const addTargetToLevel = (levelIndex) => {
        const newLevels = [...currentPolicy.levels];
        newLevels[levelIndex].targets.push({
            type: 'user',
            id: ''
        });
        setCurrentPolicy({ ...currentPolicy, levels: newLevels });
    };

    const removeTargetFromLevel = (levelIndex, targetIndex) => {
        const newLevels = [...currentPolicy.levels];
        newLevels[levelIndex].targets = newLevels[levelIndex].targets.filter((_, i) => i !== targetIndex);
        setCurrentPolicy({ ...currentPolicy, levels: newLevels });
    };

    const updateTarget = (levelIndex, targetIndex, field, value) => {
        const newLevels = [...currentPolicy.levels];
        newLevels[levelIndex].targets[targetIndex] = {
            ...newLevels[levelIndex].targets[targetIndex],
            [field]: value
        };
        setCurrentPolicy({ ...currentPolicy, levels: newLevels });
    };

    const getTargetOptions = (targetType) => {
        switch (targetType) {
            case 'user':
                return users;
            case 'team':
                return teams;
            case 'schedule':
                return schedules;
            default:
                return [];
        }
    };

    const getTargetName = (target) => {
        const options = getTargetOptions(target.type);
        const item = options.find(opt => opt._id === target.id);
        return item ? item.name : 'Unknown';
    };

    const formatDelay = (minutes) => {
        if (minutes === 0) return 'Immediate';
        if (minutes < 60) return `${minutes} min`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    };

    return (
        <div className="escalation-policy-manager">
            <div className="manager-header">
                <h1 className="text-3xl font-bold text-gray-900">Escalation Policies</h1>
                <button onClick={handleCreatePolicy} className="btn-primary">
                    + Create Policy
                </button>
            </div>

            {showEditor ? (
                <div className="policy-editor">
                    <div className="editor-header">
                        <h2 className="text-2xl font-bold">
                            {currentPolicy._id ? 'Edit Escalation Policy' : 'Create Escalation Policy'}
                        </h2>
                    </div>

                    <div className="editor-content">
                        {/* Basic Information */}
                        <section className="editor-section">
                            <h3 className="section-title">Basic Information</h3>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Policy Name *</label>
                                    <input
                                        type="text"
                                        value={currentPolicy.name}
                                        onChange={(e) => setCurrentPolicy({
                                            ...currentPolicy,
                                            name: e.target.value
                                        })}
                                        placeholder="Critical Alert Escalation"
                                        className="form-input"
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Description</label>
                                <textarea
                                    value={currentPolicy.description}
                                    onChange={(e) => setCurrentPolicy({
                                        ...currentPolicy,
                                        description: e.target.value
                                    })}
                                    placeholder="Describe when and how this policy escalates..."
                                    className="form-textarea"
                                    rows="3"
                                />
                            </div>
                        </section>

                        {/* Escalation Levels */}
                        <section className="editor-section">
                            <div className="section-header">
                                <h3 className="section-title">Escalation Levels</h3>
                                <button onClick={addEscalationLevel} className="btn-secondary">
                                    + Add Level
                                </button>
                            </div>

                            <div className="escalation-timeline">
                                {currentPolicy.levels.map((level, levelIndex) => (
                                    <div key={levelIndex} className="escalation-level-card">
                                        <div className="level-header">
                                            <div className="level-badge">Level {level.order + 1}</div>
                                            <div className="level-delay">
                                                <label>Delay</label>
                                                <input
                                                    type="number"
                                                    value={level.delayMinutes}
                                                    onChange={(e) => updateLevel(levelIndex, 'delayMinutes', parseInt(e.target.value))}
                                                    className="form-input-sm"
                                                    min="0"
                                                />
                                                <span>minutes</span>
                                            </div>
                                            {currentPolicy.levels.length > 1 && (
                                                <button
                                                    onClick={() => removeEscalationLevel(levelIndex)}
                                                    className="btn-remove"
                                                    title="Remove level"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>

                                        <div className="level-targets">
                                            <label className="targets-label">Notify</label>
                                            {level.targets.map((target, targetIndex) => (
                                                <div key={targetIndex} className="target-row">
                                                    <select
                                                        value={target.type}
                                                        onChange={(e) => updateTarget(levelIndex, targetIndex, 'type', e.target.value)}
                                                        className="form-select-sm"
                                                    >
                                                        <option value="user">User</option>
                                                        <option value="team">Team</option>
                                                        <option value="schedule">On-Call Schedule</option>
                                                    </select>
                                                    <select
                                                        value={target.id}
                                                        onChange={(e) => updateTarget(levelIndex, targetIndex, 'id', e.target.value)}
                                                        className="form-select-sm flex-1"
                                                    >
                                                        <option value="">Select {target.type}</option>
                                                        {getTargetOptions(target.type).map(opt => (
                                                            <option key={opt._id} value={opt._id}>{opt.name}</option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        onClick={() => removeTargetFromLevel(levelIndex, targetIndex)}
                                                        className="btn-remove-sm"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ))}
                                            <button
                                                onClick={() => addTargetToLevel(levelIndex)}
                                                className="btn-add-target"
                                            >
                                                + Add Target
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Repeat Settings */}
                        <section className="editor-section">
                            <h3 className="section-title">Repeat Settings</h3>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Repeat Count</label>
                                    <input
                                        type="number"
                                        value={currentPolicy.repeatCount}
                                        onChange={(e) => setCurrentPolicy({
                                            ...currentPolicy,
                                            repeatCount: parseInt(e.target.value)
                                        })}
                                        min="0"
                                        max="10"
                                        className="form-input"
                                    />
                                    <small className="form-help">0 = no repeat, max 10 cycles</small>
                                </div>
                                {currentPolicy.repeatCount > 0 && (
                                    <div className="form-group">
                                        <label>Repeat Interval (minutes)</label>
                                        <input
                                            type="number"
                                            value={currentPolicy.repeatIntervalMinutes}
                                            onChange={(e) => setCurrentPolicy({
                                                ...currentPolicy,
                                                repeatIntervalMinutes: parseInt(e.target.value)
                                            })}
                                            min="5"
                                            className="form-input"
                                        />
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>

                    <div className="editor-actions">
                        <button
                            onClick={() => {
                                setShowEditor(false);
                                setCurrentPolicy(null);
                            }}
                            className="btn-secondary"
                        >
                            Cancel
                        </button>
                        <button onClick={handleSavePolicy} className="btn-primary">
                            Save Policy
                        </button>
                    </div>
                </div>
            ) : (
                <div className="policies-list">
                    {loading ? (
                        <div className="loading-state">
                            <div className="spinner"></div>
                            <p>Loading escalation policies...</p>
                        </div>
                    ) : policies.length === 0 ? (
                        <div className="empty-state">
                            <p className="text-gray-500">No escalation policies configured</p>
                        </div>
                    ) : (
                        policies.map(policy => (
                            <div key={policy._id} className="policy-card">
                                <div className="policy-header">
                                    <div>
                                        <h3 className="policy-name">{policy.name}</h3>
                                        {policy.description && (
                                            <p className="policy-description">{policy.description}</p>
                                        )}
                                    </div>
                                    <div className="policy-actions">
                                        <button
                                            onClick={() => handleEditPolicy(policy)}
                                            className="btn-icon"
                                            title="Edit"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={() => handleDeletePolicy(policy._id)}
                                            className="btn-icon"
                                            title="Delete"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>

                                <div className="policy-timeline">
                                    {policy.levels.map((level, index) => (
                                        <div key={index} className="timeline-level">
                                            <div className="timeline-connector">
                                                {index > 0 && <div className="connector-line"></div>}
                                                <div className="timeline-dot"></div>
                                                {index < policy.levels.length - 1 && <div className="connector-line"></div>}
                                            </div>
                                            <div className="timeline-content">
                                                <div className="timeline-header">
                                                    <span className="level-number">Level {level.order + 1}</span>
                                                    <span className="level-delay-badge">
                                                        {formatDelay(level.delayMinutes)}
                                                    </span>
                                                </div>
                                                <div className="timeline-targets">
                                                    {level.targets.map((target, tIndex) => (
                                                        <span key={tIndex} className="target-badge">
                                                            {target.type === 'user' && '👤'}
                                                            {target.type === 'team' && '👥'}
                                                            {target.type === 'schedule' && '📅'}
                                                            {getTargetName(target)}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {policy.repeatCount > 0 && (
                                        <div className="repeat-indicator">
                                            🔄 Repeats {policy.repeatCount}x every {formatDelay(policy.repeatIntervalMinutes)}
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

export default EscalationPolicyManager;
