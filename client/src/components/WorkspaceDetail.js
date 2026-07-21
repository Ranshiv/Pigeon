import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import './WorkspaceDetail.css';
import './Protocols/tester-shell.css';
import {
    FiUsers, FiPlus, FiEdit, FiTrash2, FiActivity,
    FiGitMerge, FiGitBranch, FiGitPullRequest, FiLock,
    FiCalendar, FiBarChart2, FiPackage, FiClock, FiStar,
    FiGlobe, FiX, FiFolder, FiInbox, FiCheckSquare
} from 'react-icons/fi';
import { useCollaboration } from '../context/CollaborationContext';
import ActiveCollaborators from './ActiveCollaborators';
import GlobalVariablesModal from './GlobalVariablesModal';
import CollectionCreate from './CollectionCreate';
import ReviewDashboard from './collaboration/ReviewDashboard';

const WorkspaceDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [workspace, setWorkspace] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [debugInfo, setDebugInfo] = useState(null);
    const [collections, setCollections] = useState([]);
    const [activeTab, setActiveTab] = useState(() => new URLSearchParams(location.search).get('tab') || 'collections');
    const [mergeRequests, setMergeRequests] = useState([]);
    const [collaborators, setCollaborators] = useState([]);
    const [activities, setActivities] = useState([]);
    const [showAddUserModal, setShowAddUserModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('viewer');
    const [activeUsers, setActiveUsers] = useState([]);
    const [showGlobalVariablesModal, setShowGlobalVariablesModal] = useState(false);
    const [showCreateCollectionModal, setShowCreateCollectionModal] = useState(false);

    // Edit modal state
    const [showEditModal, setShowEditModal] = useState(false);
    const [editName, setEditName] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editIsPublic, setEditIsPublic] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editError, setEditError] = useState(null);

    // Access the collaboration context
    const { joinWorkspace, sendActivity, connected, getActiveUsers } = useCollaboration();

    // Computed values
    const pendingMergeRequestsCount = useMemo(() =>
        mergeRequests.filter(mr => mr.status === 'pending').length,
        [mergeRequests]
    );

    // Recent collections based on updated time
    const recentCollections = useMemo(() =>
        [...collections].sort((a, b) =>
            new Date(b.updatedAt) - new Date(a.updatedAt)
        ).slice(0, 3),
        [collections]
    );

    // Fetch workspace data
    useEffect(() => {
        const fetchWorkspace = async () => {
            try {
                setLoading(true);
                setError(null);
                setDebugInfo(null);

                console.log(`Fetching workspace with ID: ${id}`);
                const response = await fetch(`http://localhost:5001/api/workspaces/${id}`, {
                    credentials: 'include'
                });

                if (!response.ok) {
                    const errorMessage = `Failed to load workspace: ${response.status} ${response.statusText}`;
                    setDebugInfo({
                        endpoint: `/api/workspaces/${id}`,
                        status: response.status,
                        statusText: response.statusText
                    });
                    throw new Error(errorMessage);
                }

                const data = await response.json();
                console.log('Workspace data received:', data);
                setWorkspace(data);
                setCollaborators(data.collaborators || []);

                const resolvedWorkspaceId = data?._id || id;

                if (connected) {
                    joinWorkspace(id);
                    sendActivity('workspace_view', { workspaceId: id, workspaceName: data.name });
                }

                await Promise.allSettled([
                    fetchCollections(resolvedWorkspaceId),
                    fetchMergeRequests(resolvedWorkspaceId),
                    fetchActivities(resolvedWorkspaceId)
                ]);

            } catch (err) {
                console.error('Error in workspace data fetching:', err);
                setError('An error occurred while loading the workspace. See console for details.');
            } finally {
                setLoading(false);
            }
        };

        fetchWorkspace();

        return () => { };
    }, [id, joinWorkspace, connected, sendActivity]);

    useEffect(() => {
        if (activeTab === 'collections' && workspace && id) {
            fetchCollections(workspace._id || id);
        }
    }, [location.pathname, activeTab]);

    useEffect(() => {
        if (connected && id && activeTab === 'members') {
            updateActiveUsers();
            const interval = setInterval(updateActiveUsers, 5000);
            return () => clearInterval(interval);
        }
    }, [connected, id, activeTab]);

    const updateActiveUsers = () => {
        if (connected && id) {
            const currentActiveUsers = getActiveUsers(id) || [];
            setActiveUsers(currentActiveUsers);
        }
    };

    const getAllMembers = useMemo(() => {
        if (!activeUsers.length) return collaborators;
        const allMembers = [...collaborators];
        activeUsers.forEach(activeUser => {
            const existingMember = allMembers.find(
                collab => collab.userId === activeUser.id || collab.email === activeUser.email
            );
            if (!existingMember) {
                allMembers.push({
                    userId: activeUser.id,
                    displayName: activeUser.name || `Guest ${activeUser.id.substring(0, 6)}`,
                    email: activeUser.email || 'Anonymous User',
                    role: 'visitor',
                    joinedAt: activeUser.joinedAt || new Date(),
                    isActiveVisitor: true
                });
            }
        });
        return allMembers;
    }, [collaborators, activeUsers]);

    const fetchCollections = async (workspaceId) => {
        try {
            const response = await fetch(`http://localhost:5001/api/workspaces/${workspaceId}/collections`, {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                setCollections(data);
                return data;
            } else {
                console.warn(`Failed to fetch collections: ${response.status} ${response.statusText}`);
                return [];
            }
        } catch (err) {
            console.error('Error fetching collections:', err);
            return [];
        }
    };

    const fetchMergeRequests = async (workspaceId) => {
        try {
            const response = await fetch(`http://localhost:5001/api/workspaces/${workspaceId}/merge-requests`, {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                setMergeRequests(data);
                return data;
            } else {
                console.warn(`Failed to fetch merge requests: ${response.status} ${response.statusText}`);
                return [];
            }
        } catch (err) {
            console.error('Error fetching merge requests:', err);
            return [];
        }
    };

    const fetchActivities = async (workspaceId) => {
        try {
            const response = await fetch(`http://localhost:5001/api/workspaces/${workspaceId}/activity`, {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                setActivities(data);
                return data;
            } else {
                console.warn(`Failed to fetch activity: ${response.status} ${response.statusText}`);
                return [];
            }
        } catch (err) {
            console.error('Error fetching activity:', err);
            return [];
        }
    };

    const handleTabChange = (tabName) => {
        setActiveTab(tabName);
        if (connected && workspace) {
            sendActivity('tab_change', {
                tab: tabName,
                workspaceId: id,
                workspaceName: workspace.name
            });
        }
    };

    const openCreateCollectionModal = () => setShowCreateCollectionModal(true);
    const closeCreateCollectionModal = () => setShowCreateCollectionModal(false);

    const handleInviteUser = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const response = await fetch(`http://localhost:5001/api/workspaces/${id}/invite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email: inviteEmail, role: inviteRole })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to invite user');
            }

            const updatedCollaborator = await response.json();
            setCollaborators([...collaborators, updatedCollaborator]);

            if (connected) {
                sendActivity('member_invited', {
                    email: inviteEmail, role: inviteRole, workspaceId: id
                });
            }

            setInviteEmail('');
            setInviteRole('viewer');
            setShowAddUserModal(false);
        } catch (err) {
            setError('Failed to invite user. Please try again.');
            console.error('Error inviting user:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveCollaborator = async (collaboratorId) => {
        if (window.confirm('Are you sure you want to remove this collaborator?')) {
            try {
                setLoading(true);
                const response = await fetch(`http://localhost:5001/api/workspaces/${id}/collaborators/${collaboratorId}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });

                if (!response.ok) throw new Error('Failed to remove collaborator');

                const removedCollaborator = collaborators.find(c => c.userId === collaboratorId);
                setCollaborators(collaborators.filter(c => c.userId !== collaboratorId));

                if (connected && removedCollaborator) {
                    sendActivity('member_removed', {
                        email: removedCollaborator.email, workspaceId: id
                    });
                }
            } catch (err) {
                setError('Failed to remove collaborator. Please try again.');
                console.error('Error removing collaborator:', err);
            } finally {
                setLoading(false);
            }
        }
    };

    const handleUpdateCollaboratorRole = async (collaboratorId, newRole) => {
        try {
            setLoading(true);
            const response = await fetch(`http://localhost:5001/api/workspaces/${id}/collaborators/${collaboratorId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ role: newRole })
            });

            if (!response.ok) throw new Error('Failed to update collaborator role');

            const collaborator = collaborators.find(c => c.userId === collaboratorId);
            setCollaborators(collaborators.map(c =>
                c.userId === collaboratorId ? { ...c, role: newRole } : c
            ));

            if (connected && collaborator) {
                sendActivity('role_updated', {
                    email: collaborator.email,
                    previousRole: collaborator.role,
                    newRole: newRole,
                    workspaceId: id
                });
            }
        } catch (err) {
            setError('Failed to update collaborator role. Please try again.');
            console.error('Error updating collaborator role:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleEditWorkspace = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            setEditError(null);

            if (!editName.trim()) {
                setEditError('Workspace name is required');
                return;
            }

            const response = await fetch(`http://localhost:5001/api/workspaces/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    name: editName,
                    description: editDescription,
                    isPublic: editIsPublic
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to update workspace');
            }

            const updatedWorkspace = await response.json();
            setWorkspace(updatedWorkspace);
            setShowEditModal(false);

            if (connected) {
                sendActivity('workspace_updated', {
                    workspaceId: id,
                    workspaceName: editName
                });
            }
        } catch (err) {
            setEditError('Failed to update workspace. Please try again.');
            console.error('Error updating workspace:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteWorkspace = async () => {
        if (window.confirm('Are you sure you want to delete this workspace? This action cannot be undone.')) {
            try {
                setLoading(true);
                const response = await fetch(`http://localhost:5001/api/workspaces/${id}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });

                if (!response.ok) throw new Error('Failed to delete workspace');

                navigate('/workspace/workspaces');
            } catch (err) {
                setError('Failed to delete workspace. Please try again.');
                console.error('Error deleting workspace:', err);
            } finally {
                setLoading(false);
            }
        }
    };

    const handleApproveMergeRequest = async (mergeRequestId) => {
        try {
            setLoading(true);
            const response = await fetch(`http://localhost:5001/api/merge-requests/${mergeRequestId}/approve`, {
                method: 'POST',
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Failed to approve merge request');

            const mergeRequest = mergeRequests.find(mr => mr._id === mergeRequestId);
            setMergeRequests(mergeRequests.map(mr =>
                mr._id === mergeRequestId ? { ...mr, status: 'approved' } : mr
            ));

            if (connected && mergeRequest) {
                sendActivity('merge_approved', {
                    mergeRequestId,
                    sourceName: mergeRequest.sourceCollection.name,
                    targetName: mergeRequest.targetCollection.name
                });
            }
        } catch (err) {
            setError('Failed to approve merge request. Please try again.');
            console.error('Error approving merge request:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRejectMergeRequest = async (mergeRequestId) => {
        try {
            setLoading(true);
            const response = await fetch(`http://localhost:5001/api/merge-requests/${mergeRequestId}/reject`, {
                method: 'POST',
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Failed to reject merge request');

            const mergeRequest = mergeRequests.find(mr => mr._id === mergeRequestId);
            setMergeRequests(mergeRequests.map(mr =>
                mr._id === mergeRequestId ? { ...mr, status: 'rejected' } : mr
            ));

            if (connected && mergeRequest) {
                sendActivity('merge_rejected', {
                    mergeRequestId,
                    sourceName: mergeRequest.sourceCollection.name,
                    targetName: mergeRequest.targetCollection.name
                });
            }
        } catch (err) {
            setError('Failed to reject merge request. Please try again.');
            console.error('Error rejecting merge request:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    };

    if (loading && !workspace) {
        return (
            <div className="ws-loading">
                <div className="ws-loading-spinner"></div>
                <p>Loading workspace…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="ws-error">
                <h2>Error Loading Workspace</h2>
                <p>{error}</p>
                {debugInfo && (
                    <div className="ws-debug-info">
                        <p><strong>Failed API Endpoint:</strong> {debugInfo.endpoint}</p>
                        <p><strong>Status:</strong> {debugInfo.status} {debugInfo.statusText}</p>
                        <button
                            onClick={() => navigate('/workspace/workspaces')}
                            className="ws-btn primary"
                            style={{ marginTop: '10px' }}
                        >
                            Back to Workspaces
                        </button>
                    </div>
                )}
            </div>
        );
    }

    if (!workspace) {
        return <div className="ws-error">Workspace not found. Please check the URL or go back to workspaces.</div>;
    }

    const getActivityIcon = (activityType) => {
        switch (activityType) {
            case 'collection_created': return <FiPlus />;
            case 'collection_updated': return <FiEdit />;
            case 'request_added': return <FiPlus />;
            case 'request_sent': return <FiActivity />;
            case 'merge_requested': return <FiGitPullRequest />;
            case 'merge_approved': return <FiGitMerge />;
            case 'user_added': return <FiUsers />;
            default: return <FiActivity />;
        }
    };

    return (
        <div className="workspace-test-page">
            {/* Header */}
            <header className="ws-header">
                <div className="ws-header-title">
                    <div className="ws-eyebrow">
                        <FiFolder /> Workspace
                    </div>
                    <h1>
                        <FiGlobe /> {workspace.name}
                        {workspace.isPersonal && <span className="ws-role-chip admin" style={{ marginLeft: 12 }}>Personal</span>}
                        {workspace.isPublic && <span className="ws-role-chip editor" style={{ marginLeft: 12 }}>Public</span>}
                        {!workspace.isPersonal && !workspace.isPublic && <span className="ws-role-chip visitor" style={{ marginLeft: 12 }}>Team</span>}
                    </h1>
                    {workspace.description && (
                        <p>{workspace.description}</p>
                    )}
                </div>

                <div className="ws-header-actions">
                    <button
                        className="ws-btn"
                        onClick={() => setShowGlobalVariablesModal(true)}
                    >
                        <FiGlobe /> Global Variables
                    </button>

                    {workspace.userRole === 'admin' && (
                        <>
                            <button
                                className="ws-btn icon-only"
                                onClick={() => {
                                    setEditName(workspace.name);
                                    setEditDescription(workspace.description || '');
                                    setEditIsPublic(workspace.isPublic || false);
                                    setShowEditModal(true);
                                }}
                                aria-label="Edit workspace"
                                title="Edit"
                            >
                                <FiEdit />
                            </button>
                            {!workspace.isPersonal && (
                                <button
                                    className="ws-btn icon-only danger"
                                    onClick={handleDeleteWorkspace}
                                    aria-label="Delete workspace"
                                    title="Delete"
                                >
                                    <FiTrash2 />
                                </button>
                            )}
                        </>
                    )}
                </div>
            </header>

            {/* Segmented tabs */}
            <nav className="ws-header ws-header--tabs">
                <div className="ws-header-tabs">
                    <button
                        className={`ws-tab ${activeTab === 'collections' ? 'active' : ''}`}
                        onClick={() => handleTabChange('collections')}
                    >
                        <FiFolder /> Collections
                    </button>
                    <button
                        className={`ws-tab ${activeTab === 'members' ? 'active' : ''}`}
                        onClick={() => handleTabChange('members')}
                    >
                        <FiUsers /> Members
                        {getAllMembers.length > 0 && <span style={{ opacity: 0.7, fontSize: '0.78em' }}>({getAllMembers.length})</span>}
                    </button>
                    <button
                        className={`ws-tab ${activeTab === 'merge-requests' ? 'active' : ''}`}
                        onClick={() => handleTabChange('merge-requests')}
                    >
                        <FiGitPullRequest /> Merge Requests
                        {pendingMergeRequestsCount > 0 && <span className="tab-count">{pendingMergeRequestsCount}</span>}
                    </button>
                    <button
                        className={`ws-tab ${activeTab === 'activity' ? 'active' : ''}`}
                        onClick={() => handleTabChange('activity')}
                    >
                        <FiActivity /> Activity
                    </button>
                    <button
                        className={`ws-tab ${activeTab === 'reviews' ? 'active' : ''}`}
                        onClick={() => handleTabChange('reviews')}
                    >
                        <FiCheckSquare /> Reviews
                    </button>
                </div>
                <div className="ws-header-stats">
                    <span className="ws-header-stat">
                        <FiPackage /> {collections.length} {collections.length === 1 ? 'collection' : 'collections'}
                    </span>
                    <span className="ws-header-stat">
                        <FiUsers /> {getAllMembers.length} {getAllMembers.length === 1 ? 'member' : 'members'}
                    </span>
                    <span className="ws-header-stat">
                        <FiGitPullRequest /> {pendingMergeRequestsCount} pending
                    </span>
                </div>
            </nav>

            {/* Content */}
            <div className="ws-page">
            <div className="ws-content">
                {/* Collections tab */}
                {activeTab === 'collections' && (
                    <section className="ws-panel">
                        <h2 className="ws-panel-title">
                            <FiFolder /> Collections
                            <span className="ws-panel-title-right">
                                <button className="ws-btn primary" onClick={openCreateCollectionModal}>
                                    <FiPlus /> New Collection
                                </button>
                            </span>
                        </h2>

                        {collections.length === 0 ? (
                            <div className="ws-empty">
                                <div className="ws-empty-icon"><FiInbox size={24} /></div>
                                <h3 className="ws-empty-title">No collections yet</h3>
                                <p className="ws-empty-subtext">Create your first collection to organize and test your API endpoints. Collections help you group related requests together.</p>
                                <button className="ws-btn primary" onClick={openCreateCollectionModal}>
                                    <FiPlus /> Create Collection
                                </button>
                            </div>
                        ) : (
                            <div className={`ws-collections-layout ${recentCollections.length === 0 ? "no-sidebar" : ""}`}>
                                {recentCollections.length > 0 && (
                                    <div className="ws-collections-side">
                                        <h3 className="ws-section-title">
                                            <FiClock /> Recent Activity
                                        </h3>
                                        <div className="ws-recent-list">
                                            {recentCollections.map(collection => (
                                                <div
                                                    key={collection._id}
                                                    className="ws-recent-item"
                                                    onClick={() => navigate(`/workspace/collections/${collection._id}`)}
                                                    role="button"
                                                    tabIndex={0}
                                                >
                                                    <p className="ws-recent-name">
                                                        <FiFolder style={{ marginRight: 8, color: 'var(--ws-accent)' }} />
                                                        {collection.name}
                                                    </p>
                                                    <span className="ws-recent-meta">
                                                        <FiClock /> Updated {formatDate(collection.updatedAt)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="ws-collections-main">
                                    <h3 className="ws-section-title">
                                        <FiPackage /> All Collections
                                    </h3>
                                    <div className="ws-collections-grid">
                                        {collections.map(collection => (
                                            <div key={collection._id} className="ws-collection-card">
                                                <div className="ws-collection-card-head">
                                                    <span className="ws-collection-icon">
                                                        <FiFolder />
                                                    </span>
                                                    <h3>{collection.name}</h3>
                                                </div>
                                                <p>{collection.description || 'No description'}</p>
                                                <div className="ws-collection-meta">
                                                    <span>{collection.requestsCount || 0} requests</span>
                                                    <span>Updated {formatDate(collection.updatedAt)}</span>
                                                </div>
                                                <button
                                                    className="ws-btn"
                                                    onClick={() => navigate(`/workspace/collections/${collection._id}`)}
                                                >
                                                    Open Collection
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {/* Members tab */}
                {activeTab === 'members' && (
                    <section className="ws-panel">
                        <h2 className="ws-panel-title">
                            <FiUsers /> Workspace Members
                            {workspace.userRole === 'admin' && (
                                <span className="ws-panel-title-right">
                                    <button className="ws-btn primary" onClick={() => setShowAddUserModal(true)}>
                                        <FiPlus /> Invite Member
                                    </button>
                                </span>
                            )}
                        </h2>

                        <div className="ws-active-section">
                            <h3 className="ws-section-title">
                                <FiActivity /> Currently Active
                            </h3>
                            <ActiveCollaborators workspaceId={id} />
                        </div>

                        <h3 className="ws-section-title">
                            <FiUsers /> All Members
                        </h3>
                        <div className="ws-table-wrap">
                            <table className="ws-table">
                                <thead>
                                    <tr>
                                        <th>User</th>
                                        <th>Role</th>
                                        <th>Joined</th>
                                        {workspace.userRole === 'admin' && <th style={{ textAlign: 'right' }}>Actions</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {getAllMembers.map(collab => (
                                        <tr key={collab.userId}>
                                            <td>
                                                <div className="ws-user-cell">
                                                    <div className="ws-avatar">
                                                        {collab.displayName ? collab.displayName[0].toUpperCase() : 'U'}
                                                    </div>
                                                    <div className="ws-user-info">
                                                        <span className="ws-user-name">
                                                            {collab.displayName}
                                                            {collab.isActiveVisitor && <span className="active-dot" title="Currently active"></span>}
                                                        </span>
                                                        <span className="ws-user-email">{collab.email}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                {workspace.userRole === 'admin' && collab.userId !== workspace.owner && !collab.isActiveVisitor ? (
                                                    <select
                                                        value={collab.role}
                                                        onChange={(e) => handleUpdateCollaboratorRole(collab.userId, e.target.value)}
                                                        className="ws-role-select"
                                                    >
                                                        <option value="admin">Admin</option>
                                                        <option value="editor">Editor</option>
                                                        <option value="viewer">Viewer</option>
                                                    </select>
                                                ) : (
                                                    <span className={`ws-role-chip ${collab.role}`}>
                                                        {collab.role === 'admin' ? 'Admin' : collab.role === 'editor' ? 'Editor' : collab.role === 'visitor' ? 'Visitor' : 'Viewer'}
                                                    </span>
                                                )}
                                            </td>
                                            <td>{formatDate(collab.joinedAt)}</td>
                                            {workspace.userRole === 'admin' && (
                                                <td style={{ textAlign: 'right' }}>
                                                    {collab.userId !== workspace.owner ? (
                                                        <button
                                                            className="ws-remove-btn"
                                                            onClick={() => handleRemoveCollaborator(collab.userId)}
                                                        >
                                                            <FiX size={12} /> Remove
                                                        </button>
                                                    ) : (
                                                        <span className="ws-owner-label">Owner</span>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {/* Merge requests tab */}
                {activeTab === 'merge-requests' && (
                    <section className="ws-panel">
                        <h2 className="ws-panel-title">
                            <FiGitPullRequest /> Merge Requests
                        </h2>

                        {mergeRequests.length === 0 ? (
                            <div className="ws-empty">
                                <div className="ws-empty-icon"><FiGitPullRequest size={24} /></div>
                                <h3 className="ws-empty-title">No merge requests yet</h3>
                                <p className="ws-empty-subtext">Merge requests let collaborators propose changes between collections without overwriting each other's work.</p>
                            </div>
                        ) : (
                            <div className="ws-mr-list">
                                {mergeRequests.map(request => (
                                    <div key={request._id} className={`ws-mr-card ${request.status}`}>
                                        <div className="ws-mr-header">
                                            <div className="ws-mr-title">
                                                <FiGitPullRequest className="ws-muted" />
                                                <h3>
                                                    {request.title || `Merge from ${request.sourceCollection.name} to ${request.targetCollection.name}`}
                                                </h3>
                                            </div>
                                            <span className={`ws-mr-status ${request.status}`}>
                                                {request.status === 'pending' ? 'Pending' :
                                                    request.status === 'approved' ? 'Approved' : 'Rejected'}
                                            </span>
                                        </div>

                                        <div className="ws-mr-collections">
                                            <div className="ws-mr-source">
                                                <span className="ws-mr-label">Source</span>
                                                <span className="ws-mr-value">{request.sourceCollection.name}</span>
                                            </div>
                                            <FiGitBranch className="ws-mr-arrow" />
                                            <div className="ws-mr-target">
                                                <span className="ws-mr-label">Target</span>
                                                <span className="ws-mr-value">{request.targetCollection.name}</span>
                                            </div>
                                        </div>

                                        <div className="ws-mr-meta">
                                            <span>Created by: {request.createdBy.displayName}</span>
                                            <span>Created: {formatDate(request.createdAt)}</span>
                                        </div>

                                        {request.status === 'pending' && workspace.userRole !== 'viewer' && (
                                            <div className="ws-mr-actions">
                                                <button
                                                    className="ws-btn primary"
                                                    onClick={() => handleApproveMergeRequest(request._id)}
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    className="ws-btn danger"
                                                    onClick={() => handleRejectMergeRequest(request._id)}
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        )}

                                        {request.status !== 'pending' && request.actionBy && (
                                            <div className="ws-mr-result">
                                                <span>
                                                    {request.status === 'approved' ? 'Approved' : 'Rejected'} by: {request.actionBy.displayName}
                                                </span>
                                                <span>
                                                    {request.status === 'approved' ? 'Approved' : 'Rejected'} on: {formatDate(request.updatedAt)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {/* Activity tab */}
                {activeTab === 'activity' && (
                    <section className="ws-panel">
                        <h2 className="ws-panel-title">
                            <FiActivity /> Recent Activity
                        </h2>

                        {activities.length === 0 ? (
                            <div className="ws-empty">
                                <div className="ws-empty-icon"><FiActivity size={24} /></div>
                                <h3 className="ws-empty-title">No activity recorded yet</h3>
                                <p className="ws-empty-subtext">Workspace events like collection changes, member joins, and merge request actions will appear here.</p>
                            </div>
                        ) : (
                            <div className="ws-timeline">
                                {activities.map(activity => (
                                    <div key={activity._id} className="ws-activity-item">
                                        <div className="ws-activity-icon">
                                            {getActivityIcon(activity.type)}
                                        </div>
                                        <div className="ws-activity-content">
                                            <div className="ws-activity-header">
                                                <span className="ws-activity-user">{activity.user.displayName}</span>
                                                <span className="ws-activity-time">{formatDate(activity.timestamp)}</span>
                                            </div>
                                            <p className="ws-activity-message">{activity.message}</p>
                                            {activity.details && (
                                                <div className="ws-activity-details">
                                                    {typeof activity.details === 'string'
                                                        ? activity.details
                                                        : JSON.stringify(activity.details)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {/* Reviews tab */}
                {activeTab === 'reviews' && (
                    <ReviewDashboard workspaceId={id} />
                )}
            </div>

            {/* Invite User Modal */}
            {showAddUserModal && (
                <div className="ws-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowAddUserModal(false); }}>
                    <div className="ws-modal" onClick={(e) => e.stopPropagation()}>
                        <button className="ws-modal-close" onClick={() => setShowAddUserModal(false)} aria-label="Close">
                            <FiX />
                        </button>
                        <div className="ws-modal-title">Invite</div>
                        <h2>Invite to "{workspace.name}"</h2>
                        <form onSubmit={handleInviteUser}>
                            <div className="ws-form-group">
                                <label htmlFor="inviteEmail">Email</label>
                                <input
                                    type="email"
                                    id="inviteEmail"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    required
                                    placeholder="Enter email address"
                                />
                            </div>

                            <div className="ws-form-group">
                                <label>Role</label>
                                <div className="ws-role-options">
                                    {[
                                        { id: 'viewer', icon: <FiLock />, title: 'Viewer', desc: 'Can view collections and requests' },
                                        { id: 'editor', icon: <FiEdit />, title: 'Editor', desc: 'Can edit collections and approve merges' },
                                        { id: 'admin', icon: <FiUsers />, title: 'Admin', desc: 'Can manage workspace and members' }
                                    ].map(role => (
                                        <div
                                            key={role.id}
                                            className={`ws-role-option ${inviteRole === role.id ? 'selected' : ''}`}
                                            onClick={() => setInviteRole(role.id)}
                                        >
                                            {role.icon}
                                            <div>
                                                <strong>{role.title}</strong>
                                                <p>{role.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="ws-modal-actions">
                                <button type="button" className="ws-btn" onClick={() => setShowAddUserModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="ws-btn primary" disabled={loading}>
                                    {loading ? 'Inviting…' : 'Send Invitation'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Workspace Modal */}
            {showEditModal && (
                <div className="ws-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowEditModal(false); }}>
                    <div className="ws-modal wide" onClick={(e) => e.stopPropagation()}>
                        <button className="ws-modal-close" onClick={() => setShowEditModal(false)} aria-label="Close">
                            <FiX />
                        </button>
                        <div className="ws-modal-title">Edit</div>
                        <h2>Edit Workspace</h2>

                        {editError && <div className="ws-form-error">{editError}</div>}

                        <form onSubmit={handleEditWorkspace}>
                            <div className="ws-form-group">
                                <label htmlFor="workspaceName">Name</label>
                                <input
                                    type="text"
                                    id="workspaceName"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    required
                                    placeholder="Enter workspace name"
                                />
                            </div>

                            <div className="ws-form-group">
                                <label htmlFor="workspaceDesc">Description</label>
                                <textarea
                                    id="workspaceDesc"
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    placeholder="Describe your workspace"
                                    rows={3}
                                ></textarea>
                            </div>

                            {!workspace.isPersonal && (
                                <div className="ws-form-group">
                                    <label>Visibility</label>
                                    <div className="ws-workspace-type-options">
                                        <div
                                            className={`ws-role-option ${!editIsPublic ? 'selected' : ''}`}
                                            onClick={() => setEditIsPublic(false)}
                                        >
                                            <FiUsers />
                                            <div>
                                                <strong>Team</strong>
                                                <p>Collaborate with specific people</p>
                                            </div>
                                        </div>
                                        <div
                                            className={`ws-role-option ${editIsPublic ? 'selected' : ''}`}
                                            onClick={() => setEditIsPublic(true)}
                                        >
                                            <FiGlobe />
                                            <div>
                                                <strong>Public</strong>
                                                <p>Visible to everyone in the community</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {workspace.isPersonal && (
                                <div className="ws-info-box">
                                    <FiLock />
                                    <p>This is a personal workspace. Visibility settings cannot be changed.</p>
                                </div>
                            )}

                            <div className="ws-modal-actions">
                                <button type="button" className="ws-btn" onClick={() => setShowEditModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="ws-btn primary" disabled={saving}>
                                    {saving ? 'Saving…' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Global Variables Modal */}
            <GlobalVariablesModal
                isOpen={showGlobalVariablesModal}
                onClose={() => setShowGlobalVariablesModal(false)}
                workspaceId={workspace._id}
            />

            {/* Create Collection Modal */}
            {showCreateCollectionModal && (
                <div className="ws-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeCreateCollectionModal(); }}>
                    <div className="ws-modal wide" onClick={(e) => e.stopPropagation()}>
                        <button className="ws-modal-close" onClick={closeCreateCollectionModal} aria-label="Close">
                            <FiX />
                        </button>
                        <CollectionCreate
                            embedded
                            workspaceId={workspace._id}
                            workspaceName={workspace.name}
                            onCancel={closeCreateCollectionModal}
                            onCreated={async () => {
                                closeCreateCollectionModal();
                                await fetchCollections(workspace._id || id);
                            }}
                        />
                    </div>
                </div>
            )}
            </div>
        </div>
    );
};

export default WorkspaceDetail;
