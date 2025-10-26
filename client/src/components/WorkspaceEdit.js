// client/src/components/WorkspaceEdit.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiLock, FiUsers, FiGlobe } from 'react-icons/fi';
import './WorkspaceEdit.css';

const WorkspaceEdit = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [workspace, setWorkspace] = useState(null);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isPublic, setIsPublic] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    // Fetch workspace data
    useEffect(() => {
        const fetchWorkspace = async () => {
            try {
                setLoading(true);
                const response = await fetch(`http://localhost:5001/api/workspaces/${id}`, {
                    credentials: 'include'
                });

                if (!response.ok) {
                    throw new Error(`Failed to load workspace: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();
                console.log('Workspace data received for editing:', data);
                setWorkspace(data);
                setName(data.name || '');
                setDescription(data.description || '');
                setIsPublic(data.isPublic || false);
            } catch (err) {
                console.error('Error in workspace data fetching:', err);
                setError('An error occurred while loading the workspace. See console for details.');
            } finally {
                setLoading(false);
            }
        };

        fetchWorkspace();
    }, [id]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            setError(null);

            // Basic validation
            if (!name.trim()) {
                setError('Workspace name is required');
                return;
            }

            const response = await fetch(`http://localhost:5001/api/workspaces/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    name,
                    description,
                    isPublic
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to update workspace');
            }

            const updatedWorkspace = await response.json();
            console.log('Workspace updated successfully:', updatedWorkspace);

            // Navigate back to workspace detail view
            navigate(`/workspace/workspaces/${id}`);
        } catch (err) {
            setError('Failed to update workspace. Please try again.');
            console.error('Error updating workspace:', err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="loading-container">
                Loading workspace data...
            </div>
        );
    }

    if (error && !workspace) {
        return (
            <div className="error-container">
                <div>
                    <h2>Error Loading Workspace</h2>
                    <p>{error}</p>
                    <button onClick={() => navigate('/workspace/workspaces')} className="back-button">
                        Back to Workspaces
                    </button>
                </div>
            </div>
        );
    }

    if (!workspace) {
        return (
            <div className="error-container">
                <div>
                    <h2>Workspace Not Found</h2>
                    <p>Workspace not found. Please check the URL or go back to workspaces.</p>
                    <button onClick={() => navigate('/workspace/workspaces')} className="back-button">
                        Back to Workspaces
                    </button>
                </div>
            </div>
        );
    }

    // Only admin can edit
    if (workspace.userRole !== 'admin') {
        return (
            <div className="error-container">
                <div>
                    <h2>Permission Denied</h2>
                    <p>You don't have permission to edit this workspace.</p>
                    <button onClick={() => navigate(`/workspace/workspaces/${id}`)} className="back-button">
                        Back to Workspace
                    </button>
                </div>
            </div>
        );
    }

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            navigate(`/workspace/workspaces/${id}`);
        }
    };

    return (
        <div className="workspace-edit-container" onClick={handleOverlayClick}>
            <div className="workspace-edit-modal-wrapper">
                <h1>Edit Workspace</h1>

                {error && <div className="error-message">{error}</div>}

                <form onSubmit={handleSubmit} className="workspace-edit-form">
                    <div className="form-group">
                        <label htmlFor="workspaceName">Name</label>
                        <input
                            type="text"
                            id="workspaceName"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            placeholder="Enter workspace name"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="workspaceDesc">Description</label>
                        <textarea
                            id="workspaceDesc"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
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
                                    className={`workspace-type-option ${!isPublic ? 'selected' : ''}`}
                                    onClick={() => setIsPublic(false)}
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
                                    className={`workspace-type-option ${isPublic ? 'selected' : ''}`}
                                    onClick={() => setIsPublic(true)}
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
                            onClick={() => navigate(`/workspace/workspaces/${id}`)}
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
    );
};

export default WorkspaceEdit;