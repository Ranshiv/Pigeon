import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './WorkspaceDetail.css';
import { FiUsers, FiPlus, FiEdit, FiTrash2, FiActivity, FiGitMerge, FiGitBranch, FiGitPullRequest, FiLock } from 'react-icons/fi';

const WorkspaceDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [workspace, setWorkspace] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [debugInfo, setDebugInfo] = useState(null); // Added for debugging
    const [collections, setCollections] = useState([]);
    const [activeTab, setActiveTab] = useState('collections');
    const [mergeRequests, setMergeRequests] = useState([]);
    const [collaborators, setCollaborators] = useState([]);
    const [activities, setActivities] = useState([]);
    const [showAddUserModal, setShowAddUserModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('viewer');

    // Fetch workspace data
    useEffect(() => {
        const fetchWorkspace = async () => {
            try {
                setLoading(true);
                setError(null); // Reset error state
                setDebugInfo(null); // Reset debug info

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

                try {
                    // Second API call - collections
                    console.log(`Fetching collections for workspace: ${id}`);
                    const collectionsResponse = await fetch(`http://localhost:5001/api/workspaces/${id}/collections`, {
                        credentials: 'include'
                    });

                    if (collectionsResponse.ok) {
                        const collectionsData = await collectionsResponse.json();
                        console.log('Collections data received:', collectionsData);
                        setCollections(collectionsData);
                    } else {
                        console.warn(`Failed to fetch collections: ${collectionsResponse.status} ${collectionsResponse.statusText}`);
                        // Don't throw error, just continue with empty collections
                    }
                } catch (collErr) {
                    console.error('Error fetching collections:', collErr);
                    // Continue execution, don't block on collections error
                }

                try {
                    // Third API call - merge requests
                    console.log(`Fetching merge requests for workspace: ${id}`);
                    const mergeResponse = await fetch(`http://localhost:5001/api/workspaces/${id}/merge-requests`, {
                        credentials: 'include'
                    });

                    if (mergeResponse.ok) {
                        const mergeData = await mergeResponse.json();
                        console.log('Merge requests data received:', mergeData);
                        setMergeRequests(mergeData);
                    } else {
                        console.warn(`Failed to fetch merge requests: ${mergeResponse.status} ${mergeResponse.statusText}`);
                        // Don't throw error, just continue with empty merge requests
                    }
                } catch (mergeErr) {
                    console.error('Error fetching merge requests:', mergeErr);
                    // Continue execution, don't block on merge requests error
                }

                try {
                    // Fourth API call - activity
                    console.log(`Fetching activity for workspace: ${id}`);
                    const activityResponse = await fetch(`http://localhost:5001/api/workspaces/${id}/activity`, {
                        credentials: 'include'
                    });

                    if (activityResponse.ok) {
                        const activityData = await activityResponse.json();
                        console.log('Activity data received:', activityData);
                        setActivities(activityData);
                    } else {
                        console.warn(`Failed to fetch activity: ${activityResponse.status} ${activityResponse.statusText}`);
                        // Don't throw error, just continue with empty activities
                    }
                } catch (actErr) {
                    console.error('Error fetching activity:', actErr);
                    // Continue execution, don't block on activity error
                }

            } catch (err) {
                console.error('Error in workspace data fetching:', err);
                setError('An error occurred while loading the workspace. See console for details.');
            } finally {
                setLoading(false);
            }
        };

        fetchWorkspace();
    }, [id]);

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
                setCollaborators(collaborators.filter(c => c.userId !== collaboratorId));
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
            setCollaborators(collaborators.map(c =>
                c.userId === collaboratorId ? { ...c, role: newRole } : c
            ));
        } catch (err) {
            setError('Failed to update collaborator role. Please try again.');
            console.error('Error updating collaborator role:', err);
        } finally {
            setLoading(false);
        }
    };

    // Handle workspace deletion
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
            setMergeRequests(mergeRequests.map(mr =>
                mr._id === mergeRequestId ? { ...mr, status: 'approved' } : mr
            ));
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
            setMergeRequests(mergeRequests.map(mr =>
                mr._id === mergeRequestId ? { ...mr, status: 'rejected' } : mr
            ));
        } catch (err) {
            setError('Failed to reject merge request. Please try again.');
            console.error('Error rejecting merge request:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading && !workspace) {
        return <div className="loading-container">Loading workspace...</div>;
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
            default: return <FiActivity />;
        }
    };

    return (
        <div className="workspace-detail-container">
            <header className="workspace-header">
                <div className="workspace-title-section">
                    <h1>{workspace.name}</h1>
                    {workspace.isPersonal && <span className="workspace-badge personal">Personal</span>}
                    {workspace.isPublic && <span className="workspace-badge public">Public</span>}
                    {!workspace.isPersonal && !workspace.isPublic && <span className="workspace-badge team">Team</span>}
                </div>

                <div className="workspace-actions">
                    {workspace.userRole === 'admin' && (
                        <>
                            <button className="workspace-edit-btn" onClick={() => navigate(`/workspace/workspaces/${id}/edit`)}>
                                <FiEdit /> Edit
                            </button>
                            <button className="workspace-delete-btn" onClick={handleDeleteWorkspace}>
                                <FiTrash2 /> Delete
                            </button>
                        </>
                    )}
                </div>
            </header>

            <p className="workspace-description">{workspace.description}</p>

            <div className="workspace-tabs">
                <button
                    className={`tab ${activeTab === 'collections' ? 'active' : ''}`}
                    onClick={() => setActiveTab('collections')}
                >
                    Collections
                </button>
                <button
                    className={`tab ${activeTab === 'members' ? 'active' : ''}`}
                    onClick={() => setActiveTab('members')}
                >
                    Members ({collaborators.length})
                </button>
                <button
                    className={`tab ${activeTab === 'merge-requests' ? 'active' : ''}`}
                    onClick={() => setActiveTab('merge-requests')}
                >
                    Merge Requests ({mergeRequests.length})
                </button>
                <button
                    className={`tab ${activeTab === 'activity' ? 'active' : ''}`}
                    onClick={() => setActiveTab('activity')}
                >
                    Activity
                </button>
            </div>

            <div className="workspace-content">
                {/* Collections Tab */}
                {activeTab === 'collections' && (
                    <div className="collections-tab">
                        <div className="tab-header">
                            <h2>Collections</h2>
                            <button className="add-collection-btn" onClick={() => navigate(`/workspace/collections/new?workspaceId=${id}`)}>
                                <FiPlus /> New Collection
                            </button>
                        </div>

                        <div className="collections-list">
                            {collections.length === 0 ? (
                                <div className="empty-state">
                                    <p>No collections in this workspace yet.</p>
                                    <button className="primary-btn" onClick={() => navigate(`/workspace/collections/new?workspaceId=${id}`)}>
                                        Create your first collection
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
                                                <span>Updated {new Date(collection.updatedAt).toLocaleDateString()}</span>
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

                        <div className="members-list">
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
                                    {collaborators.map(collab => (
                                        <tr key={collab.userId}>
                                            <td className="user-cell">
                                                <div className="avatar">{collab.displayName ? collab.displayName[0].toUpperCase() : 'U'}</div>
                                                <div className="user-info">
                                                    <span className="user-name">{collab.displayName}</span>
                                                    <span className="user-email">{collab.email}</span>
                                                </div>
                                            </td>
                                            <td>
                                                {workspace.userRole === 'admin' && collab.userId !== workspace.owner ? (
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
                                            <td>{new Date(collab.joinedAt).toLocaleDateString()}</td>
                                            {workspace.userRole === 'admin' && (
                                                <td>
                                                    {collab.userId !== workspace.owner && (
                                                        <button
                                                            className="remove-member-btn"
                                                            onClick={() => handleRemoveCollaborator(collab.userId)}
                                                        >
                                                            Remove
                                                        </button>
                                                    )}
                                                    {collab.userId === workspace.owner && (
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
                )}

                {/* Merge Requests Tab */}
                {activeTab === 'merge-requests' && (
                    <div className="merge-requests-tab">
                        <div className="tab-header">
                            <h2>Merge Requests</h2>
                        </div>

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
                                                <span>Created: {new Date(request.createdAt).toLocaleDateString()}</span>
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

                                            {request.status !== 'pending' && (
                                                <div className="merge-result">
                                                    <span>
                                                        {request.status === 'approved' ? 'Approved' : 'Rejected'} by: {request.actionBy.displayName}
                                                    </span>
                                                    <span>
                                                        {request.status === 'approved' ? 'Approved' : 'Rejected'} on: {new Date(request.updatedAt).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Activity Tab */}
                {activeTab === 'activity' && (
                    <div className="activity-tab">
                        <div className="tab-header">
                            <h2>Recent Activity</h2>
                        </div>

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
                                                <span className="time">{new Date(activity.timestamp).toLocaleString()}</span>
                                            </div>
                                            <p className="activity-message">{activity.message}</p>
                                            {activity.details && (
                                                <div className="activity-details">{activity.details}</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
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
        </div>
    );
};

export default WorkspaceDetail;