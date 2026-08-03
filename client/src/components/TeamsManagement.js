// client/src/components/TeamsManagement.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './TeamsManagement.css';
import AppSelect from './common/AppSelect/AppSelect';
import PageLoader from './common/PageLoader/PageLoader';
import {
    FiUsers, FiPlus, FiEdit, FiTrash2, FiMail, FiShield,
    FiCheckCircle, FiX, FiAlertCircle, FiSettings,
    FiEye, FiActivity, FiBarChart, FiTool, FiUser,
    FiUserPlus, FiUserX, FiSave, FiBell, FiAlertTriangle
} from 'react-icons/fi';
import { Sparkles } from 'lucide-react';

const MEMBER_ROLES = [
    { value: 'owner', label: 'Owner' },
    { value: 'admin', label: 'Admin' },
    { value: 'editor', label: 'Editor' },
    { value: 'viewer', label: 'Viewer' }
];

const ALERT_CHANNELS = [
    { value: 'email', label: 'Email' },
    { value: 'slack', label: 'Slack' },
    { value: 'teams', label: 'Microsoft Teams' },
    { value: 'pagerduty', label: 'PagerDuty' }
];

const ROLES = [
    { key: 'viewer', label: 'Viewer', icon: <FiEye /> },
    { key: 'editor', label: 'Editor', icon: <FiEdit /> },
    { key: 'admin', label: 'Admin', icon: <FiShield /> },
];

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

    useEffect(() => { fetchTeams(); }, []);

    const fetchTeams = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/teams', { credentials: 'include' });
            if (response.ok) setTeams(await response.json());
            else setError('Failed to fetch teams');
        } catch (err) { setError('Error fetching teams: ' + err.message); }
        finally { setLoading(false); }
    };

    const createTeam = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/teams', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                body: JSON.stringify(teamFormData)
            });
            if (response.ok) {
                await fetchTeams();
                setShowCreateModal(false);
                setTeamFormData({ name: '', description: '', defaultRole: 'viewer' });
            } else { const errorData = await response.json(); setError(errorData.message || 'Failed to create team'); }
        } catch (err) { setError('Error creating team: ' + err.message); }
        finally { setLoading(false); }
    };

    const inviteMember = async () => {
        if (!selectedTeam) return;
        setLoading(true);
        try {
            const response = await fetch(`/api/teams/${selectedTeam._id}/invite`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                body: JSON.stringify(inviteData)
            });
            if (response.ok) {
                await fetchTeams();
                setShowInviteModal(false);
                setInviteData({ email: '', role: 'viewer' });
            } else { const errorData = await response.json(); setError(errorData.message || 'Failed to invite member'); }
        } catch (err) { setError('Error inviting member: ' + err.message); }
        finally { setLoading(false); }
    };

    const updateMemberRole = async (teamId, memberId, newRole) => {
        try {
            const response = await fetch(`/api/teams/${teamId}/members/${memberId}/role`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                body: JSON.stringify({ role: newRole })
            });
            if (response.ok) await fetchTeams();
            else { const errorData = await response.json(); setError(errorData.message || 'Failed to update member role'); }
        } catch (err) { setError('Error updating member role: ' + err.message); }
    };

    const removeMember = async (teamId, memberId) => {
        if (!window.confirm('Are you sure you want to remove this member?')) return;
        try {
            const response = await fetch(`/api/teams/${teamId}/members/${memberId}`, { method: 'DELETE', credentials: 'include' });
            if (response.ok) await fetchTeams();
            else { const errorData = await response.json(); setError(errorData.message || 'Failed to remove member'); }
        } catch (err) { setError('Error removing member: ' + err.message); }
    };

    const getRoleIcon = (role) => {
        switch (role) {
            case 'admin': return <FiShield className="tm-role-icon admin" />;
            case 'editor': return <FiEdit className="tm-role-icon editor" />;
            case 'viewer': return <FiEye className="tm-role-icon viewer" />;
            default: return <FiUser className="tm-role-icon" />;
        }
    };

    /* ---------- Reusable role-chip picker ---------- */
    const RolePicker = ({ value, onChange, roles = ROLES }) => (
        <div className="tm-role-picker">
            {roles.map(r => (
                <button
                    type="button"
                    key={r.key}
                    className={`tm-role-chip ${value === r.key ? 'selected' : ''}`}
                    onClick={() => onChange(r.key)}
                >
                    {r.icon}
                    {r.label}
                </button>
            ))}
        </div>
    );

    if (loading && teams.length === 0) {
        return (
            <div className="tm-root">
                <PageLoader label="Loading teams..." />
            </div>
        );
    }

    return (
        <div className="tm-root">
            {/* Header */}
            <div className="tm-header">
                <div className="tm-header-left">
                    <div className="tm-header-icon" aria-hidden="true"><FiUsers /></div>
                    <div className="tm-header-info">
                        <h1>Teams & Organizations</h1>
                        <p>Manage team access, roles, and permissions for your monitoring setup</p>
                    </div>
                </div>
                <button className="tm-btn-primary" onClick={() => setShowCreateModal(true)}>
                    <FiPlus /> Create Team
                </button>
            </div>

            {/* Navigation Tabs */}
            <div className="tm-nav">
                <button className="tm-nav-btn" onClick={() => navigate('/workspace/monitoring/copilot')}>
                    <Sparkles /> Operations Copilot
                </button>
                <button className="tm-nav-btn" onClick={() => navigate('/workspace/monitoring')}>
                    <FiActivity /> Dashboard
                </button>
                <button className="tm-nav-btn" onClick={() => navigate('/workspace/monitoring/policies')}>
                    <FiBell /> Alerts & Policies
                </button>
                <button className="tm-nav-btn" onClick={() => navigate('/workspace/monitoring/incidents')}>
                    <FiAlertTriangle /> Incidents
                </button>
                <button className="tm-nav-btn" onClick={() => navigate('/workspace/monitoring/reports')}>
                    <FiBarChart /> Reports
                </button>
                <button className="tm-nav-btn active" onClick={() => navigate('/workspace/monitoring/teams')}>
                    <FiUsers /> Teams
                </button>
                <button className="tm-nav-btn" onClick={() => navigate('/workspace/monitoring/integrations')}>
                    <FiSettings /> Integrations
                </button>
                <button className="tm-nav-btn" onClick={() => navigate('/workspace/monitoring/maintenance')}>
                    <FiTool /> Maintenance
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="tm-error">
                    <FiAlertCircle />
                    <span>{error}</span>
                    <button onClick={() => setError(null)}>Dismiss</button>
                </div>
            )}

            {/* Layout */}
            <div className="tm-layout">
                {/* Sidebar */}
                <div className="tm-sidebar">
                    <h3>Teams</h3>
                    <div className="tm-list">
                        {teams.map(team => (
                            <div
                                key={team._id}
                                className={`tm-item ${selectedTeam?._id === team._id ? 'active' : ''}`}
                                onClick={() => setSelectedTeam(team)}
                            >
                                <div className="tm-item-info">
                                    <h4>{team.name}</h4>
                                    <p>{team.members?.length || 0} members</p>
                                </div>
                                <div className="tm-item-role">
                                    {getRoleIcon(team.userRole || 'member')}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Details */}
                <div className="tm-details">
                    {selectedTeam ? (
                        <div className="tm-detail-content">
                            <div className="tm-detail-head">
                                <div className="tm-team-info">
                                    <h2>{selectedTeam.name}</h2>
                                    <p>{selectedTeam.description}</p>
                                </div>
                                <div className="tm-detail-actions">
                                    <button className="tm-btn-secondary" onClick={() => setShowInviteModal(true)}>
                                        <FiUserPlus /> Invite Member
                                    </button>
                                    <button className="tm-btn-secondary" onClick={() => setShowSettingsModal(true)}>
                                        <FiSettings /> Settings
                                    </button>
                                </div>
                            </div>

                            <div className="tm-stats">
                                <div className="tm-stat-card">
                                    <div className="tm-stat-icon"><FiUsers /></div>
                                    <div className="tm-stat-content">
                                        <span className="tm-stat-value">{selectedTeam.members?.length || 0}</span>
                                        <span className="tm-stat-label">Team Members</span>
                                    </div>
                                </div>
                                <div className="tm-stat-card">
                                    <div className="tm-stat-icon"><FiShield /></div>
                                    <div className="tm-stat-content">
                                        <span className="tm-stat-value">{selectedTeam.monitors?.length || 0}</span>
                                        <span className="tm-stat-label">Assigned Monitors</span>
                                    </div>
                                </div>
                                <div className="tm-stat-card">
                                    <div className="tm-stat-icon"><FiCheckCircle /></div>
                                    <div className="tm-stat-content">
                                        <span className="tm-stat-value">{selectedTeam.alertRoutes?.length || 0}</span>
                                        <span className="tm-stat-label">Alert Routes</span>
                                    </div>
                                </div>
                            </div>

                            <div className="tm-members">
                                <h3>Team Members</h3>
                                <div className="tm-members-list">
                                    {selectedTeam.members?.map(member => {
                                        const u = member.userId || {};
                                        const name = u.displayName || u.name || u.email || 'Unknown';
                                        const email = u.email || '';
                                        const initial = (name || '?').charAt(0).toUpperCase();
                                        return (
                                        <div key={member._id} className="tm-member">
                                            <div className="tm-member-info">
                                                <div className="tm-member-avatar">{initial}</div>
                                                <div className="tm-member-details">
                                                    <h4>{name}</h4>
                                                    <p>{email}</p>
                                                </div>
                                            </div>
                                            <div className="tm-member-role">
                                                <span className={`tm-role-badge tm-role-badge--${member.role}`}>
                                                    {member.role}
                                                </span>
                                                <AppSelect
                                                    className="tm-role-select"
                                                    value={member.role}
                                                    onChange={(v) => updateMemberRole(selectedTeam._id, member._id, v)}
                                                    options={MEMBER_ROLES}
                                                />
                                            </div>
                                            <div className="tm-member-actions">
                                                <button
                                                    className="tm-action-btn remove"
                                                    onClick={() => removeMember(selectedTeam._id, member._id)}
                                                    title="Remove member"
                                                >
                                                    <FiUserX />
                                                </button>
                                            </div>
                                        </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="tm-no-selection">
                            <FiUsers className="tm-empty-icon" />
                            <h3>Select a Team</h3>
                            <p>Choose a team from the sidebar to view details and manage members</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Team Modal */}
            {showCreateModal && (
                <div className="tm-overlay">
                    <div className="tm-modal">
                        <div className="tm-modal-head">
                            <h2><FiUsers /> Create New Team</h2>
                            <button className="tm-modal-close" onClick={() => setShowCreateModal(false)}>
                                <FiX />
                            </button>
                        </div>
                        <div className="tm-modal-body">
                            <div className="tm-field">
                                <label>Team Name *</label>
                                <input
                                    type="text"
                                    value={teamFormData.name}
                                    onChange={(e) => setTeamFormData({ ...teamFormData, name: e.target.value })}
                                    placeholder="Enter team name"
                                />
                            </div>
                            <div className="tm-field">
                                <label>Description</label>
                                <textarea
                                    value={teamFormData.description}
                                    onChange={(e) => setTeamFormData({ ...teamFormData, description: e.target.value })}
                                    placeholder="Team description (optional)"
                                />
                            </div>
                            <div className="tm-field">
                                <label>Default Role for New Members</label>
                                <RolePicker
                                    value={teamFormData.defaultRole}
                                    onChange={(role) => setTeamFormData({ ...teamFormData, defaultRole: role })}
                                    roles={ROLES.filter(r => r.key !== 'admin')}
                                />
                            </div>
                        </div>
                        <div className="tm-modal-foot">
                            <button className="tm-btn-secondary" onClick={() => setShowCreateModal(false)}>
                                Cancel
                            </button>
                            <button
                                className="tm-btn-primary"
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
                <div className="tm-overlay">
                    <div className="tm-modal">
                        <div className="tm-modal-head">
                            <h2><FiUserPlus /> Invite Team Member</h2>
                            <button className="tm-modal-close" onClick={() => setShowInviteModal(false)}>
                                <FiX />
                            </button>
                        </div>
                        <div className="tm-modal-body">
                            <div className="tm-field">
                                <label>Email Address *</label>
                                <input
                                    type="email"
                                    value={inviteData.email}
                                    onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                                    placeholder="member@example.com"
                                />
                            </div>
                            <div className="tm-field">
                                <label>Role</label>
                                <RolePicker
                                    value={inviteData.role}
                                    onChange={(role) => setInviteData({ ...inviteData, role })}
                                />
                            </div>
                        </div>
                        <div className="tm-modal-foot">
                            <button className="tm-btn-secondary" onClick={() => setShowInviteModal(false)}>
                                Cancel
                            </button>
                            <button
                                className="tm-btn-primary"
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
                <div className="tm-overlay">
                    <div className="tm-modal">
                        <div className="tm-modal-head">
                            <h2><FiSettings /> Team Settings</h2>
                            <button className="tm-modal-close" onClick={() => setShowSettingsModal(false)}>
                                <FiX />
                            </button>
                        </div>
                        <div className="tm-modal-body">
                            <div className="tm-settings-section">
                                <h3>General Settings</h3>
                                <div className="tm-field">
                                    <label>Team Name</label>
                                    <input type="text" value={selectedTeam.name} readOnly />
                                </div>
                                <div className="tm-field">
                                    <label>Description</label>
                                    <textarea value={selectedTeam.description || ''} readOnly rows={3} />
                                </div>
                            </div>

                            <div className="tm-settings-section">
                                <h3>Team Permissions</h3>
                                <div className="tm-permissions-grid">
                                    <div className="tm-permission-item">
                                        <label>
                                            <input type="checkbox" checked readOnly />
                                            <span>View Monitors</span>
                                        </label>
                                    </div>
                                    <div className="tm-permission-item">
                                        <label>
                                            <input type="checkbox" checked readOnly />
                                            <span>Manage Monitors</span>
                                        </label>
                                    </div>
                                    <div className="tm-permission-item">
                                        <label>
                                            <input type="checkbox" checked readOnly />
                                            <span>View Reports</span>
                                        </label>
                                    </div>
                                    <div className="tm-permission-item">
                                        <label>
                                            <input type="checkbox" checked readOnly />
                                            <span>Manage Integrations</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="tm-settings-section">
                                <h3>Alert Routing</h3>
                                <div className="tm-field">
                                    <label>Default Alert Channel</label>
                                    <AppSelect
                                        value={selectedTeam.alertRouting?.defaultChannel || 'email'}
                                        disabled
                                        options={ALERT_CHANNELS}
                                    />
                                </div>
                            </div>

                            <div className="tm-settings-section tm-danger-zone">
                                <h3>Danger Zone</h3>
                                <div className="tm-danger-actions">
                                    <button
                                        className="tm-btn-danger"
                                        onClick={() => {
                                            if (window.confirm('Are you sure you want to delete this team? This action cannot be undone.')) {
                                                console.log('Delete team:', selectedTeam._id);
                                            }
                                        }}
                                    >
                                        <FiTrash2 /> Delete Team
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="tm-modal-foot">
                            <button className="tm-btn-secondary" onClick={() => setShowSettingsModal(false)}>
                                Close
                            </button>
                            <button className="tm-btn-primary">
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