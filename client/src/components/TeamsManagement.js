// client/src/components/TeamsManagement.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './TeamsManagement.css';
import {
    FiUsers, FiPlus, FiEdit, FiTrash2, FiMail, FiShield,
    FiCheckCircle, FiX, FiAlertCircle, FiSettings,
    FiEye, FiActivity, FiBarChart, FiTool, FiUser,
    FiUserPlus, FiUserX, FiSave, FiBell
} from 'react-icons/fi';

const TeamsManagement = () => {
    const navigate = useNavigate();
    const [teams, setTeams] = useState([]);
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [teamFormData, setTeamFormData] = useState({
        name: '',
        description: '',
        defaultRole: 'viewer'
    });
    const [inviteData, setInviteData] = useState({
        email: '',
        role: 'viewer'
    });

    useEffect(() => {
        fetchTeams();
    }, []);

    const fetchTeams = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/teams', {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                setTeams(data);
            } else {
                setError('Failed to fetch teams');
            }
        } catch (err) {
            setError('Error fetching teams: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const createTeam = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/teams', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(teamFormData)
            });

            if (response.ok) {
                await fetchTeams();
                setShowCreateModal(false);
                setTeamFormData({ name: '', description: '', defaultRole: 'viewer' });
            } else {
                const errorData = await response.json();
                setError(errorData.message || 'Failed to create team');
            }
        } catch (err) {
            setError('Error creating team: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const inviteMember = async () => {
        if (!selectedTeam) return;

        setLoading(true);
        try {
            const response = await fetch(`/api/teams/${selectedTeam._id}/invite`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(inviteData)
            });

            if (response.ok) {
                await fetchTeams();
                setShowInviteModal(false);
                setInviteData({ email: '', role: 'viewer' });
            } else {
                const errorData = await response.json();
                setError(errorData.message || 'Failed to invite member');
            }
        } catch (err) {
            setError('Error inviting member: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const updateMemberRole = async (teamId, memberId, newRole) => {
        try {
            const response = await fetch(`/api/teams/${teamId}/members/${memberId}/role`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ role: newRole })
            });

            if (response.ok) {
                await fetchTeams();
            } else {
                const errorData = await response.json();
                setError(errorData.message || 'Failed to update member role');
            }
        } catch (err) {
            setError('Error updating member role: ' + err.message);
        }
    };

    const removeMember = async (teamId, memberId) => {
        if (!window.confirm('Are you sure you want to remove this member?')) return;

        try {
            const response = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                await fetchTeams();
            } else {
                const errorData = await response.json();
                setError(errorData.message || 'Failed to remove member');
            }
        } catch (err) {
            setError('Error removing member: ' + err.message);
        }
    };

    const getRoleIcon = (role) => {
        switch (role) {
            case 'admin': return <FiShield className="role-icon admin" />;
            case 'editor': return <FiEdit className="role-icon editor" />;
            case 'viewer': return <FiEye className="role-icon viewer" />;
            default: return <FiUser className="role-icon" />;
        }
    };

    const getRoleColor = (role) => {
        switch (role) {
            case 'admin': return '#e74c3c';
            case 'editor': return '#f39c12';
            case 'viewer': return '#27ae60';
            default: return '#95a5a6';
        }
    };

    if (loading && teams.length === 0) {
        return (
            <div className="teams-management">
                <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>Loading teams...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="teams-management">
            <div className="teams-header">
                <div className="header-info">
                    <h1><FiUsers /> Teams & Organizations</h1>
                    <p>Manage team access, roles, and permissions for your monitoring setup</p>
                </div>
                <button
                    className="btn-primary"
                    onClick={() => setShowCreateModal(true)}
                >
                    <FiPlus /> Create Team
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
                    onClick={() => navigate('/alerts/policies')}
                >
                    <FiBell /> Alerts & Policies
                </button>
                <button
                    className="nav-btn"
                    onClick={() => navigate('/workspace/monitoring/reports')}
                >
                    <FiBarChart /> Reports
                </button>
                <button
                    className="nav-btn active"
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
                    className="nav-btn"
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

            <div className="teams-layout">
                <div className="teams-sidebar">
                    <h3>Teams</h3>
                    <div className="teams-list">
                        {teams.map(team => (
                            <div
                                key={team._id}
                                className={`team-item ${selectedTeam?._id === team._id ? 'active' : ''}`}
                                onClick={() => setSelectedTeam(team)}
                            >
                                <div className="team-info">
                                    <h4>{team.name}</h4>
                                    <p>{team.members?.length || 0} members</p>
                                </div>
                                <div className="team-role">
                                    {getRoleIcon(team.userRole || 'member')}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="team-details">
                    {selectedTeam ? (
                        <div className="team-detail-content">
                            <div className="team-detail-header">
                                <div className="team-info">
                                    <h2>{selectedTeam.name}</h2>
                                    <p>{selectedTeam.description}</p>
                                </div>
                                <div className="team-actions">
                                    <button
                                        className="btn-secondary"
                                        onClick={() => setShowInviteModal(true)}
                                    >
                                        <FiUserPlus /> Invite Member
                                    </button>
                                    <button
                                        className="btn-secondary"
                                        onClick={() => setShowSettingsModal(true)}
                                    >
                                        <FiSettings /> Settings
                                    </button>
                                </div>
                            </div>

                            <div className="team-stats">
                                <div className="stat-card">
                                    <div className="stat-icon">
                                        <FiUsers />
                                    </div>
                                    <div className="stat-content">
                                        <span className="stat-value">{selectedTeam.members?.length || 0}</span>
                                        <span className="stat-label">Team Members</span>
                                    </div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-icon">
                                        <FiShield />
                                    </div>
                                    <div className="stat-content">
                                        <span className="stat-value">{selectedTeam.monitors?.length || 0}</span>
                                        <span className="stat-label">Assigned Monitors</span>
                                    </div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-icon">
                                        <FiCheckCircle />
                                    </div>
                                    <div className="stat-content">
                                        <span className="stat-value">{selectedTeam.alertRoutes?.length || 0}</span>
                                        <span className="stat-label">Alert Routes</span>
                                    </div>
                                </div>
                            </div>

                            <div className="team-members">
                                <h3>Team Members</h3>
                                <div className="members-list">
                                    {selectedTeam.members?.map(member => (
                                        <div key={member._id} className="member-item">
                                            <div className="member-info">
                                                <div className="member-avatar">
                                                    {member.name?.charAt(0) || member.email?.charAt(0)}
                                                </div>
                                                <div className="member-details">
                                                    <h4>{member.name || member.email}</h4>
                                                    <p>{member.email}</p>
                                                </div>
                                            </div>
                                            <div className="member-role">
                                                <select
                                                    value={member.role}
                                                    onChange={(e) => updateMemberRole(selectedTeam._id, member._id, e.target.value)}
                                                    className="role-select"
                                                >
                                                    <option value="viewer">Viewer</option>
                                                    <option value="editor">Editor</option>
                                                    <option value="admin">Admin</option>
                                                </select>
                                                {getRoleIcon(member.role)}
                                            </div>
                                            <div className="member-actions">
                                                <button
                                                    className="action-btn remove"
                                                    onClick={() => removeMember(selectedTeam._id, member._id)}
                                                    title="Remove member"
                                                >
                                                    <FiUserX />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="no-team-selected">
                            <FiUsers className="empty-icon" />
                            <h3>Select a Team</h3>
                            <p>Choose a team from the sidebar to view details and manage members</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Team Modal */}
            {showCreateModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>Create New Team</h2>
                            <button
                                className="modal-close"
                                onClick={() => setShowCreateModal(false)}
                            >
                                <FiX />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Team Name</label>
                                <input
                                    type="text"
                                    value={teamFormData.name}
                                    onChange={(e) => setTeamFormData({
                                        ...teamFormData,
                                        name: e.target.value
                                    })}
                                    placeholder="Enter team name"
                                />
                            </div>
                            <div className="form-group">
                                <label>Description</label>
                                <textarea
                                    value={teamFormData.description}
                                    onChange={(e) => setTeamFormData({
                                        ...teamFormData,
                                        description: e.target.value
                                    })}
                                    placeholder="Team description (optional)"
                                />
                            </div>
                            <div className="form-group">
                                <label>Default Role for New Members</label>
                                <select
                                    value={teamFormData.defaultRole}
                                    onChange={(e) => setTeamFormData({
                                        ...teamFormData,
                                        defaultRole: e.target.value
                                    })}
                                >
                                    <option value="viewer">Viewer</option>
                                    <option value="editor">Editor</option>
                                </select>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button
                                className="btn-secondary"
                                onClick={() => setShowCreateModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-primary"
                                onClick={createTeam}
                                disabled={!teamFormData.name}
                            >
                                <FiSave /> Create Team
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Invite Member Modal */}
            {showInviteModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>Invite Team Member</h2>
                            <button
                                className="modal-close"
                                onClick={() => setShowInviteModal(false)}
                            >
                                <FiX />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Email Address</label>
                                <input
                                    type="email"
                                    value={inviteData.email}
                                    onChange={(e) => setInviteData({
                                        ...inviteData,
                                        email: e.target.value
                                    })}
                                    placeholder="member@example.com"
                                />
                            </div>
                            <div className="form-group">
                                <label>Role</label>
                                <select
                                    value={inviteData.role}
                                    onChange={(e) => setInviteData({
                                        ...inviteData,
                                        role: e.target.value
                                    })}
                                >
                                    <option value="viewer">Viewer</option>
                                    <option value="editor">Editor</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button
                                className="btn-secondary"
                                onClick={() => setShowInviteModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-primary"
                                onClick={inviteMember}
                                disabled={!inviteData.email}
                            >
                                <FiMail /> Send Invitation
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Team Settings Modal */}
            {showSettingsModal && selectedTeam && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>Team Settings</h2>
                            <button
                                className="modal-close"
                                onClick={() => setShowSettingsModal(false)}
                            >
                                <FiX />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="settings-section">
                                <h3>General Settings</h3>
                                <div className="form-group">
                                    <label>Team Name</label>
                                    <input
                                        type="text"
                                        value={selectedTeam.name}
                                        readOnly
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Description</label>
                                    <textarea
                                        value={selectedTeam.description || ''}
                                        readOnly
                                        rows={3}
                                    />
                                </div>
                            </div>

                            <div className="settings-section">
                                <h3>Team Permissions</h3>
                                <div className="permissions-grid">
                                    <div className="permission-item">
                                        <label>
                                            <input type="checkbox" checked readOnly />
                                            <span>View Monitors</span>
                                        </label>
                                    </div>
                                    <div className="permission-item">
                                        <label>
                                            <input type="checkbox" checked readOnly />
                                            <span>Manage Monitors</span>
                                        </label>
                                    </div>
                                    <div className="permission-item">
                                        <label>
                                            <input type="checkbox" checked readOnly />
                                            <span>View Reports</span>
                                        </label>
                                    </div>
                                    <div className="permission-item">
                                        <label>
                                            <input type="checkbox" checked readOnly />
                                            <span>Manage Integrations</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="settings-section">
                                <h3>Alert Routing</h3>
                                <div className="form-group">
                                    <label>Default Alert Channel</label>
                                    <select value={selectedTeam.alertRouting?.defaultChannel || 'email'} readOnly>
                                        <option value="email">Email</option>
                                        <option value="slack">Slack</option>
                                        <option value="teams">Microsoft Teams</option>
                                        <option value="pagerduty">PagerDuty</option>
                                    </select>
                                </div>
                            </div>

                            <div className="settings-section danger-zone">
                                <h3>Danger Zone</h3>
                                <div className="danger-actions">
                                    <button
                                        className="btn-danger"
                                        onClick={() => {
                                            if (window.confirm('Are you sure you want to delete this team? This action cannot be undone.')) {
                                                // Add delete team functionality here
                                                console.log('Delete team:', selectedTeam._id);
                                            }
                                        }}
                                    >
                                        <FiTrash2 /> Delete Team
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button
                                className="btn-secondary"
                                onClick={() => setShowSettingsModal(false)}
                            >
                                Close
                            </button>
                            <button className="btn-primary">
                                <FiSave /> Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeamsManagement;
