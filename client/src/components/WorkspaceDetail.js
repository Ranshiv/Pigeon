import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import './WorkspaceDetail.css';
import {
    FiUsers, FiPlus, FiEdit, FiTrash2, FiActivity,
    FiGitMerge, FiGitBranch, FiGitPullRequest, FiLock,
    FiCalendar, FiBarChart2, FiPackage, FiClock, FiStar,
    FiGlobe, FiX
} from 'react-icons/fi';
import { useCollaboration } from '../context/CollaborationContext';
import ActiveCollaborators from './ActiveCollaborators';
import GlobalVariablesModal from './GlobalVariablesModal';
import CollectionCreate from './CollectionCreate';

const WorkspaceDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [workspace, setWorkspace] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [debugInfo, setDebugInfo] = useState(null);
    const [collections, setCollections] = useState([]);
    const [activeTab, setActiveTab] = useState('collections');
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

                // First API call - main workspace data
                console.log(`Fetching workspace with ID: ${id}`);
                const response = await fetch(`http://localhost:5001/api/workspaces/${id}`, {
                    credentials: 'include'
                });

                if (!response.ok) {
                    // Capture specific HTTP error for main workspace endpoint
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

                // IMPORTANT: the route param can be an alias like "my-workspace".
                // For collection queries we must use the real workspace _id returned by the API when available.
                const resolvedWorkspaceId = data?._id || id;

                // Join the workspace room for real-time collaboration
                if (connected) {
                    joinWorkspace(id);
                    // Send activity that user joined the workspace
                    sendActivity('workspace_view', { workspaceId: id, workspaceName: data.name });
                }

                // Load collections, merge requests, and activities in parallel for better performance
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

        // Clean up when component unmounts
        return () => {
            // Nothing to clean up here as the context will handle socket disconnection
        };
    }, [id, joinWorkspace, connected, sendActivity]);

    // Effect to refresh collections when navigating back to this page
    useEffect(() => {
        // Only fetch collections if we're on the collections tab and workspace is loaded
        if (activeTab === 'collections' && workspace && id) {
            fetchCollections(workspace._id || id);
        }
    }, [location.pathname, activeTab]);

    // Effect to periodically update active users
    useEffect(() => {
        if (connected && id && activeTab === 'members') {
            // Initial update
            updateActiveUsers();

            // Set up interval to periodically refresh
            const interval = setInterval(updateActiveUsers, 5000);

            return () => clearInterval(interval);
        }
    }, [connected, id, activeTab]);

    // Function to update active users
    const updateActiveUsers = () => {
        if (connected && id) {
            const currentActiveUsers = getActiveUsers(id) || [];
            setActiveUsers(currentActiveUsers);
        }
    };

    // Combine both formal collaborators and active users for display
    const getAllMembers = useMemo(() => {
        if (!activeUsers.length) return collaborators;

        // Create a new array with all collaborators
        const allMembers = [...collaborators];

        // Add active users who aren't already in the collaborators list
        activeUsers.forEach(activeUser => {
            // Check if this active user is already in the collaborators list
            const existingMember = allMembers.find(
                collab => collab.userId === activeUser.id || collab.email === activeUser.email
            );

            // If they're not in the list, add them with 'visitor' role
            if (!existingMember) {
                allMembers.push({
                    userId: activeUser.id,
                    displayName: activeUser.name || `Guest ${activeUser.id.substring(0, 6)}`,
                    email: activeUser.email || 'Anonymous User',
                    role: 'visitor', // Indicate they're not formally invited
                    joinedAt: activeUser.joinedAt || new Date(),
                    isActiveVisitor: true // Flag to identify visitors vs. invited members
                });
            }
        });

        return allMembers;
    }, [collaborators, activeUsers]);

    // Helper functions for fetch operations
    const fetchCollections = async (workspaceId) => {
        try {
            console.log(`Fetching collections for workspace: ${workspaceId}`);
            const response = await fetch(`http://localhost:5001/api/workspaces/${workspaceId}/collections`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                console.log('Collections data received:', data);
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
            console.log(`Fetching merge requests for workspace: ${workspaceId}`);
            const response = await fetch(`http://localhost:5001/api/workspaces/${workspaceId}/merge-requests`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                console.log('Merge requests data received:', data);
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
            console.log(`Fetching activity for workspace: ${workspaceId}`);
            const response = await fetch(`http://localhost:5001/api/workspaces/${workspaceId}/activity`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                console.log('Activity data received:', data);
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

    // Send activities when changing tabs
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

    const openCreateCollectionModal = () => {
        setShowCreateCollectionModal(true);
    };

    const closeCreateCollectionModal = () => {
        setShowCreateCollectionModal(false);
    };

    // Handle inviting users to workspace
    const handleInviteUser = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const response = await fetch(`http://localhost:5001/api/workspaces/${id}/invite`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    email: inviteEmail,
                    role: inviteRole
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to invite user');
            }

            const updatedCollaborator = await response.json();

            // Update the collaborators list
            setCollaborators([...collaborators, updatedCollaborator]);

            // Send activity about the new member
            if (connected) {
                sendActivity('member_invited', {
                    email: inviteEmail,
                    role: inviteRole,
                    workspaceId: id
                });
            }

            // Reset form and close modal
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

    // Handle removing a collaborator
    const handleRemoveCollaborator = async (collaboratorId) => {
        if (window.confirm('Are you sure you want to remove this collaborator?')) {
            try {
                setLoading(true);
                const response = await fetch(`http://localhost:5001/api/workspaces/${id}/collaborators/${collaboratorId}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });

                if (!response.ok) {
                    throw new Error('Failed to remove collaborator');
                }

                // Update the collaborators list
                const removedCollaborator = collaborators.find(c => c.userId === collaboratorId);
                setCollaborators(collaborators.filter(c => c.userId !== collaboratorId));

                // Send activity about removed member
                if (connected && removedCollaborator) {
                    sendActivity('member_removed', {
                        email: removedCollaborator.email,
                        workspaceId: id
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

    // Handle updating a collaborator's role
    const handleUpdateCollaboratorRole = async (collaboratorId, newRole) => {
        try {
            setLoading(true);
            const response = await fetch(`http://localhost:5001/api/workspaces/${id}/collaborators/${collaboratorId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    role: newRole
                })
            });

            if (!response.ok) {
                throw new Error('Failed to update collaborator role');
            }

            const updatedCollaborator = await response.json();

            // Update the collaborators list
            const collaborator = collaborators.find(c => c.userId === collaboratorId);
            setCollaborators(collaborators.map(c =>
                c.userId === collaboratorId ? { ...c, role: newRole } : c
            ));

            // Send activity about role change
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

    // Handle workspace deletion
    // Handle edit workspace form submission
    const handleEditWorkspace = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            setEditError(null);

            // Basic validation
            if (!editName.trim()) {
                setEditError('Workspace name is required');
                return;
            }

            const response = await fetch(`http://localhost:5001/api/workspaces/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
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
            console.log('Workspace updated successfully:', updatedWorkspace);

            // Update local state
            setWorkspace(updatedWorkspace);
            setShowEditModal(false);

            // Send activity about workspace update
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

                if (!response.ok) {
                    throw new Error('Failed to delete workspace');
                }

                // Redirect to workspaces list
                navigate('/workspace/workspaces');
            } catch (err) {
                setError('Failed to delete workspace. Please try again.');
                console.error('Error deleting workspace:', err);
            } finally {
                setLoading(false);
            }
        }
    };

    // Handle approving a merge request
    const handleApproveMergeRequest = async (mergeRequestId) => {
        try {
            setLoading(true);
            const response = await fetch(`http://localhost:5001/api/merge-requests/${mergeRequestId}/approve`, {
                method: 'POST',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to approve merge request');
            }

            // Update the merge requests list
            const mergeRequest = mergeRequests.find(mr => mr._id === mergeRequestId);
            setMergeRequests(mergeRequests.map(mr =>
                mr._id === mergeRequestId ? { ...mr, status: 'approved' } : mr
            ));

            // Send activity about approved merge request
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

            if (!response.ok) {
                throw new Error('Failed to reject merge request');
            }

            // Update the merge requests list
            const mergeRequest = mergeRequests.find(mr => mr._id === mergeRequestId);
            setMergeRequests(mergeRequests.map(mr =>
                mr._id === mergeRequestId ? { ...mr, status: 'rejected' } : mr
            ));

            // Send activity about rejected merge request
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

    // Utility function to format dates nicely
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return 'Today';
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else {
            return date.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
            });
        }
    };

    if (loading && !workspace) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading workspace...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="error-container">
                <h2>Error Loading Workspace</h2>
                <p>{error}</p>
                {debugInfo && (
                    <div className="debug-info">
                        <p><strong>Failed API Endpoint:</strong> {debugInfo.endpoint}</p>
                        <p><strong>Status:</strong> {debugInfo.status} {debugInfo.statusText}</p>
                        <button
                            onClick={() => navigate('/workspace/workspaces')}
                            className="back-button"
                        >
                            Back to Workspaces
                        </button>
                    </div>
                )}
            </div>
        );
    }

    if (!workspace) {
        return <div className="error-container">Workspace not found. Please check the URL or go back to workspaces.</div>;
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
        <div className="workspace-detail-container">
            <header className="workspace-header">
                <div className="workspace-title-section">
                    <div className="workspace-title-row">
                        <h1>{workspace.name}</h1>
                        {workspace.isPersonal && <span className="workspace-badge personal">Personal</span>}
                        {workspace.isPublic && <span className="workspace-badge public">Public</span>}
                        {!workspace.isPersonal && !workspace.isPublic && <span className="workspace-badge team">Team</span>}
                    </div>

                    {workspace.description && (
                        <p className="workspace-description">{workspace.description}</p>
                    )}
                </div>

                <div className="workspace-actions">
                    <div className="members-indicator">
                        <FiUsers />
                        <span>{getAllMembers.length} {getAllMembers.length === 1 ? 'Member' : 'Members'}</span>
                        {!workspace.isPersonal && workspace.userRole === 'admin' && (
                            <button className="invite-member-btn-small" onClick={() => setShowAddUserModal(true)}>
                                <FiPlus />
                            </button>
                        )}
                    </div>

                    {/* Add Global Variables Button */}
                    <button className="workspace-global-vars-btn" onClick={() => setShowGlobalVariablesModal(true)}>
                        <FiGlobe /> Global Variables
                    </button>

                    {workspace.userRole === 'admin' && (
                        <>
                            <button className="workspace-edit-btn" onClick={() => {
                                setEditName(workspace.name);
                                setEditDescription(workspace.description || '');
                                setEditIsPublic(workspace.isPublic || false);
                                setShowEditModal(true);
                            }}>
                                <FiEdit /> Edit
                            </button>
                            {!workspace.isPersonal && (
                                <button className="workspace-delete-btn" onClick={handleDeleteWorkspace}>
                                    <FiTrash2 /> Delete
                                </button>
                            )}
                        </>
                    )}
                </div>
            </header>

            {/* Dashboard Overview Section - New addition */}
            <div className="workspace-dashboard">
                <div className="dashboard-stats">
                    <div className="stat-card">
                        <div className="stat-icon collections">
                            <FiPackage />
                        </div>
                        <div className="stat-info">
                            <span className="stat-value">{collections.length}</span>
                            <span className="stat-label">Collections</span>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon members">
                            <FiUsers />
                        </div>
                        <div className="stat-info">
                            <span className="stat-value">{getAllMembers.length}</span>
                            <span className="stat-label">Members</span>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon pending">
                            <FiGitPullRequest />
                        </div>
                        <div className="stat-info">
                            <span className="stat-value">{pendingMergeRequestsCount}</span>
                            <span className="stat-label">Pending Requests</span>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon activity">
                            <FiActivity />
                        </div>
                        <div className="stat-info">
                            <span className="stat-value">{activities.length}</span>
                            <span className="stat-label">Activities</span>
                        </div>
                    </div>
                </div>

                {recentCollections.length > 0 && (
                    <div className="recent-collections">
                        <h3><FiClock /> Recent Collections</h3>
                        <div className="recent-collections-list">
                            {recentCollections.map(collection => (
                                <div key={collection._id} className="recent-collection-item"
                                    onClick={() => navigate(`/workspace/collections/${collection._id}`)}>
                                    <div className="collection-name">{collection.name}</div>
                                    <div className="collection-updated">Updated {formatDate(collection.updatedAt)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="workspace-tabs">
                <button
                    className={`tab ${activeTab === 'collections' ? 'active' : ''}`}
                    onClick={() => handleTabChange('collections')}
                >
                    <FiPackage /> Collections
                </button>
                <button
                    className={`tab ${activeTab === 'members' ? 'active' : ''}`}
                    onClick={() => handleTabChange('members')}
                >
                    <FiUsers /> Members ({getAllMembers.length})
                </button>
                <button
                    className={`tab ${activeTab === 'merge-requests' ? 'active' : ''}`}
                    onClick={() => handleTabChange('merge-requests')}
                >
                    <FiGitPullRequest /> Merge Requests {pendingMergeRequestsCount > 0 && <span className="notification-badge">{pendingMergeRequestsCount}</span>}
                </button>
                <button
                    className={`tab ${activeTab === 'activity' ? 'active' : ''}`}
                    onClick={() => handleTabChange('activity')}
                >
                    <FiActivity /> Activity
                </button>
            </div>

            <div className="workspace-content">
                {/* Collections Tab */}
                {activeTab === 'collections' && (
                    <div className="collections-tab">
                        <div className="tab-header">
                            <h2>Collections</h2>
                            <button className="add-collection-btn" onClick={openCreateCollectionModal}>
                                <FiPlus /> New Collection
                            </button>
                        </div>

                        <div className="workspace-panel">
                            {collections.length === 0 ? (
                                <div className="empty-state">
                                    <FiPackage size={32} />
                                    <p>No collections yet</p>
                                    <p className="empty-state-subtext">Create your first collection to organize and test your API endpoints. Collections help you group related requests together.</p>
                                    <button className="primary-btn" onClick={openCreateCollectionModal}>
                                        + Create Collection
                                    </button>
                                </div>
                            ) : (
                                <div className="collections-grid">
                                    {collections.map(collection => (
                                        <div key={collection._id} className="collection-card">
                                            <h3>{collection.name}</h3>
                                            <p>{collection.description || 'No description'}</p>
                                            <div className="collection-meta">
                                                <span>{collection.requestsCount || 0} requests</span>
                                                <span>Updated {formatDate(collection.updatedAt)}</span>
                                            </div>
                                            <button className="view-collection-btn" onClick={() => navigate(`/workspace/collections/${collection._id}`)}>
                                                View Collection
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Members Tab */}
                {activeTab === 'members' && (
                    <div className="members-tab">
                        <div className="tab-header">
                            <h2>Workspace Members</h2>
                            {workspace.userRole === 'admin' && (
                                <button className="invite-member-btn" onClick={() => setShowAddUserModal(true)}>
                                    <FiPlus /> Invite Member
                                </button>
                            )}
                        </div>

                        <div className="workspace-panel">
                            <div className="active-members-section">
                                <div className="section-title">
                                    <h3>Currently Active</h3>
                                </div>
                                <ActiveCollaborators workspaceId={id} />
                            </div>

                            <div className="members-list">
                                <div className="section-title">
                                    <h3>All Members</h3>
                                </div>
                                <table className="members-table">
                                    <thead>
                                        <tr>
                                            <th>User</th>
                                            <th>Role</th>
                                            <th>Joined</th>
                                            {workspace.userRole === 'admin' && <th>Actions</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {getAllMembers.map(collab => (
                                            <tr key={collab.userId}>
                                                <td className="user-cell">
                                                    <div className="avatar">
                                                        {collab.displayName ? collab.displayName[0].toUpperCase() : 'U'}
                                                    </div>
                                                    <div className="user-info">
                                                        <span className="user-name">
                                                            {collab.displayName}
                                                            {collab.isActiveVisitor && <span className="active-indicator" title="Currently active in workspace"></span>}
                                                        </span>
                                                        <span className="user-email">{collab.email}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    {workspace.userRole === 'admin' && collab.userId !== workspace.owner && !collab.isActiveVisitor ? (
                                                        <select
                                                            value={collab.role}
                                                            onChange={(e) => handleUpdateCollaboratorRole(collab.userId, e.target.value)}
                                                            className="role-select"
                                                        >
                                                            <option value="admin">Admin</option>
                                                            <option value="editor">Editor</option>
                                                            <option value="viewer">Viewer</option>
                                                        </select>
                                                    ) : (
                                                        <span className={`role-badge ${collab.role}`}>
                                                            {collab.role === 'admin' ? 'Admin' : collab.role === 'editor' ? 'Editor' : 'Viewer'}
                                                        </span>
                                                    )}
                                                </td>
                                                <td>{formatDate(collab.joinedAt)}</td>
                                                {workspace.userRole === 'admin' && (
                                                    <td>
                                                        {collab.userId !== workspace.owner ? (
                                                            <button
                                                                className="remove-member-btn"
                                                                onClick={() => handleRemoveCollaborator(collab.userId)}
                                                            >
                                                                Remove
                                                            </button>
                                                        ) : (
                                                            <span className="owner-label">Owner</span>
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* Merge Requests Tab */}
                {activeTab === 'merge-requests' && (
                    <div className="merge-requests-tab">
                        <div className="tab-header">
                            <h2>Merge Requests</h2>
                        </div>

                        <div className="workspace-panel">
                            {mergeRequests.length === 0 ? (
                                <div className="empty-state">
                                    <FiGitPullRequest size={32} />
                                    <p>No merge requests yet.</p>
                                </div>
                            ) : (
                                <div className="merge-requests-list">
                                    {mergeRequests.map(request => (
                                        <div key={request._id} className={`merge-request-card ${request.status}`}>
                                            <div className="merge-request-header">
                                                <div className="merge-request-title">
                                                    <FiGitPullRequest className="merge-icon" />
                                                    <h3>
                                                        {request.title || `Merge from ${request.sourceCollection.name} to ${request.targetCollection.name}`}
                                                    </h3>
                                                </div>
                                                <span className={`status-badge ${request.status}`}>
                                                    {request.status === 'pending' ? 'Pending' :
                                                        request.status === 'approved' ? 'Approved' : 'Rejected'}
                                                </span>
                                            </div>

                                            <div className="merge-details">
                                                <div className="merge-collections">
                                                    <div className="source">
                                                        <span className="label">Source</span>
                                                        <span className="value">{request.sourceCollection.name}</span>
                                                    </div>
                                                    <FiGitBranch className="merge-arrow" />
                                                    <div className="target">
                                                        <span className="label">Target</span>
                                                        <span className="value">{request.targetCollection.name}</span>
                                                    </div>
                                                </div>

                                                <div className="merge-meta">
                                                    <span>Created by: {request.createdBy.displayName}</span>
                                                    <span>Created: {formatDate(request.createdAt)}</span>
                                                </div>

                                                {request.status === 'pending' && workspace.userRole !== 'viewer' && (
                                                    <div className="merge-actions">
                                                        <button
                                                            className="approve-btn"
                                                            onClick={() => handleApproveMergeRequest(request._id)}
                                                        >
                                                            Approve
                                                        </button>
                                                        <button
                                                            className="reject-btn"
                                                            onClick={() => handleRejectMergeRequest(request._id)}
                                                        >
                                                            Reject
                                                        </button>
                                                    </div>
                                                )}

                                                {request.status !== 'pending' && request.actionBy && (
                                                    <div className="merge-result">
                                                        <span>
                                                            {request.status === 'approved' ? 'Approved' : 'Rejected'} by: {request.actionBy.displayName}
                                                        </span>
                                                        <span>
                                                            {request.status === 'approved' ? 'Approved' : 'Rejected'} on: {formatDate(request.updatedAt)}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Activity Tab */}
                {activeTab === 'activity' && (
                    <div className="activity-tab">
                        <div className="tab-header">
                            <h2>Recent Activity</h2>
                        </div>

                        <div className="workspace-panel">
                            {activities.length === 0 ? (
                                <div className="empty-state">
                                    <FiActivity size={32} />
                                    <p>No activity recorded yet.</p>
                                </div>
                            ) : (
                                <div className="activity-timeline">
                                    {activities.map(activity => (
                                        <div key={activity._id} className="activity-item">
                                            <div className="activity-icon">
                                                {getActivityIcon(activity.type)}
                                            </div>
                                            <div className="activity-content">
                                                <div className="activity-header">
                                                    <span className="user">{activity.user.displayName}</span>
                                                    <span className="time">{formatDate(activity.timestamp)}</span>
                                                </div>
                                                <p className="activity-message">{activity.message}</p>
                                                {activity.details && (
                                                    <div className="activity-details">
                                                        {typeof activity.details === 'string'
                                                            ? activity.details
                                                            : JSON.stringify(activity.details)
                                                        }
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Invite User Modal */}
            {showAddUserModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>Invite to "{workspace.name}"</h2>
                        <form onSubmit={handleInviteUser}>
                            <div className="form-group">
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

                            <div className="form-group">
                                <label>Role</label>
                                <div className="role-options">
                                    <div
                                        className={`role-option ${inviteRole === 'viewer' ? 'selected' : ''}`}
                                        onClick={() => setInviteRole('viewer')}
                                    >
                                        <FiLock size={16} />
                                        <div>
                                            <strong>Viewer</strong>
                                            <p>Can view collections and requests</p>
                                        </div>
                                    </div>
                                    <div
                                        className={`role-option ${inviteRole === 'editor' ? 'selected' : ''}`}
                                        onClick={() => setInviteRole('editor')}
                                    >
                                        <FiEdit size={16} />
                                        <div>
                                            <strong>Editor</strong>
                                            <p>Can edit collections and approve merges</p>
                                        </div>
                                    </div>
                                    <div
                                        className={`role-option ${inviteRole === 'admin' ? 'selected' : ''}`}
                                        onClick={() => setInviteRole('admin')}
                                    >
                                        <FiUsers size={16} />
                                        <div>
                                            <strong>Admin</strong>
                                            <p>Can manage workspace and members</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="cancel-btn" onClick={() => setShowAddUserModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="invite-btn" disabled={loading}>
                                    {loading ? 'Inviting...' : 'Send Invitation'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Workspace Modal */}
            {showEditModal && (
                <div className="workspace-edit-container" onClick={(e) => {
                    if (e.target === e.currentTarget) {
                        setShowEditModal(false);
                    }
                }}>
                    <div className="workspace-edit-modal-wrapper">
                        <h1>Edit Workspace</h1>

                        {editError && <div className="error-message">{editError}</div>}

                        <form onSubmit={handleEditWorkspace} className="workspace-edit-form">
                            <div className="form-group">
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

                            <div className="form-group">
                                <label htmlFor="workspaceDesc">Description</label>
                                <textarea
                                    id="workspaceDesc"
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    placeholder="Describe your workspace"
                                    rows={3}
                                ></textarea>
                            </div>

                            {/* Don't allow changing personal workspace status */}
                            {!workspace.isPersonal && (
                                <div className="form-group">
                                    <label>Visibility</label>
                                    <div className="workspace-types">
                                        <div
                                            className={`workspace-type-option ${!editIsPublic ? 'selected' : ''}`}
                                            onClick={() => setEditIsPublic(false)}
                                        >
                                            <div className="type-icon">
                                                <FiUsers size={20} />
                                            </div>
                                            <div className="type-info">
                                                <strong>Team</strong>
                                                <p>Collaborate with specific people</p>
                                            </div>
                                        </div>

                                        <div
                                            className={`workspace-type-option ${editIsPublic ? 'selected' : ''}`}
                                            onClick={() => setEditIsPublic(true)}
                                        >
                                            <div className="type-icon">
                                                <FiGlobe size={20} />
                                            </div>
                                            <div className="type-info">
                                                <strong>Public</strong>
                                                <p>Visible to everyone in the community</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {workspace.isPersonal && (
                                <div className="form-group">
                                    <div className="info-box">
                                        <FiLock size={16} />
                                        <p>This is a personal workspace. Visibility settings cannot be changed.</p>
                                    </div>
                                </div>
                            )}

                            <div className="form-actions">
                                <button
                                    type="button"
                                    className="cancel-btn"
                                    onClick={() => setShowEditModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="save-btn"
                                    disabled={saving}
                                >
                                    {saving ? 'Saving...' : 'Save Changes'}
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
                <div className="modal-overlay" onClick={(e) => {
                    if (e.target === e.currentTarget) closeCreateCollectionModal();
                }}>
                    <div className="modal-content ws-collection-create-modal">
                        <button
                            type="button"
                            className="ws-modal-close"
                            onClick={closeCreateCollectionModal}
                            aria-label="Close"
                        >
                            <FiX />
                        </button>
                        <CollectionCreate
                            embedded
                            workspaceId={workspace._id}
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
    );
};

export default WorkspaceDetail;