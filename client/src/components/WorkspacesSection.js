//client/src/components/WorkspacesSection.js
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams, Navigate, useLocation } from 'react-router-dom';
import SpotlightSection from './SpotlightSection';
import AIAgentToolsSection from './AIAgentToolsSection';
import RequestForm from './RequestForm';
import ResponseDisplay from './ResponseDisplay';
import WorkspaceDetail from './WorkspaceDetail';
import CollectionsManagement from './CollectionsManagement';
import { FiGrid, FiPlus, FiUsers, FiGlobe, FiLock, FiStar, FiX } from 'react-icons/fi';
import './WorkspacesSection.css';

const WorkspacesSection = ({ requests, response, onSend, onCreate, onUpdate, onDelete }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [workspaces, setWorkspaces] = useState([]);
    const [personalWorkspaces, setPersonalWorkspaces] = useState([]);
    const [teamWorkspaces, setTeamWorkspaces] = useState([]);
    const [publicWorkspaces, setPublicWorkspaces] = useState([]);
    const [myWorkspaces, setMyWorkspaces] = useState([]);
    const [sharedWorkspaces, setSharedWorkspaces] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newWorkspaceName, setNewWorkspaceName] = useState('');
    const [newWorkspaceDesc, setNewWorkspaceDesc] = useState('');
    const [newWorkspaceType, setNewWorkspaceType] = useState('personal');
    const [activeWorkspaceType, setActiveWorkspaceType] = useState('personal');
    const [viewMode, setViewMode] = useState('my'); // 'my' for My Workspaces, 'shared' for Shared Workspaces
    const [autoCreateWorkspace, setAutoCreateWorkspace] = useState(false);

    // Check if there's a create=true parameter in the URL
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('create') === 'true') {
            setShowCreateModal(true);
            // Remove the parameter from URL to avoid reopening modal on page refresh
            navigate('/workspace/workspaces', { replace: true });
        }
    }, [location.search, navigate]);

    // Effect to automatically create workspace when both name and description are provided
    useEffect(() => {
        // Only trigger auto-creation when both fields have values and autoCreateWorkspace is not already running
        if (newWorkspaceName.trim() && newWorkspaceDesc.trim() && !autoCreateWorkspace && !loading) {
            // Set small delay to avoid multiple triggers
            const timer = setTimeout(() => {
                setAutoCreateWorkspace(true);
                // Use a form submission event to create the workspace
                const event = new Event('submit', { cancelable: true });
                handleCreateWorkspace(event);
            }, 1000); // 1 second delay after user stops typing

            return () => clearTimeout(timer);
        }
    }, [newWorkspaceName, newWorkspaceDesc]);

    // Fetch workspaces on component mount
    useEffect(() => {
        fetchWorkspaces();
    }, []);

    const fetchWorkspaces = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/workspaces', {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to fetch workspaces');
            }

            const data = await response.json();
            console.log("Fetched workspaces data:", data); // Debug log to see what's coming from server

            // Convert the server response format to what our component expects
            let workspacesList = [];
            if (data.personal && Array.isArray(data.personal)) {
                workspacesList = [...workspacesList, ...data.personal];
            }
            if (data.team && Array.isArray(data.team)) {
                workspacesList = [...workspacesList, ...data.team];
            }

            // Mark which ones are owned by the current user
            workspacesList = workspacesList.map(workspace => ({
                ...workspace,
                isOwner: workspace.owner === 'temp-user-id' || workspace._id === 'ws1'
            }));

            console.log("Processed workspaces list:", workspacesList); // Debug log to see processed data

            // Set all workspaces
            setWorkspaces(workspacesList);

            // Filter workspaces owned by the current user vs shared with the current user
            const ownedWorkspaces = workspacesList.filter(workspace => workspace.isOwner === true);
            const sharedWithUser = workspacesList.filter(workspace => !workspace.isOwner && !workspace.isPublic);

            setMyWorkspaces(ownedWorkspaces);
            setSharedWorkspaces(sharedWithUser);

            // Also maintain the existing categories
            setPersonalWorkspaces(workspacesList.filter(workspace => workspace.isPersonal));
            setTeamWorkspaces(workspacesList.filter(workspace => !workspace.isPersonal && !workspace.isPublic));
            setPublicWorkspaces(workspacesList.filter(workspace => workspace.isPublic));

        } catch (err) {
            setError('Failed to load workspaces');
            console.error('Error fetching workspaces:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateWorkspace = async (e) => {
        e.preventDefault();
        try {
            setError(null); // Clear previous errors
            setLoading(true);

            if (!newWorkspaceName.trim()) {
                setError('Please enter a workspace name');
                setLoading(false);
                return;
            }

            const response = await fetch('/api/workspaces', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    name: newWorkspaceName,
                    description: newWorkspaceDesc,
                    isPersonal: newWorkspaceType === 'personal',
                    isPublic: newWorkspaceType === 'public'
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.message || 'Failed to create workspace';
                setError(errorMessage);
                throw new Error(errorMessage);
            }

            const newWorkspace = await response.json();

            // Add isOwner property
            newWorkspace.isOwner = true;

            // Update state with new workspace
            setWorkspaces(prevWorkspaces => [...prevWorkspaces, newWorkspace]);

            // Add to myWorkspaces since the user is creating it
            setMyWorkspaces(prevWorkspaces => [...prevWorkspaces, newWorkspace]);

            // Update the appropriate workspace category
            if (newWorkspaceType === 'personal') {
                setPersonalWorkspaces(prevWorkspaces => [...prevWorkspaces, newWorkspace]);
            } else if (newWorkspaceType === 'public') {
                setPublicWorkspaces(prevWorkspaces => [...prevWorkspaces, newWorkspace]);
            } else {
                setTeamWorkspaces(prevWorkspaces => [...prevWorkspaces, newWorkspace]);
            }

            // Reset form and close modal
            setNewWorkspaceName('');
            setNewWorkspaceDesc('');
            setNewWorkspaceType('personal');
            setShowCreateModal(false);

            // Fetch all workspaces to ensure UI is up to date
            await fetchWorkspaces();

            // Navigate to the new workspace
            navigate(`/workspace/workspaces/${newWorkspace._id}`);
        } catch (err) {
            console.error('Error creating workspace:', err);
            if (!error) {
                setError('Failed to create workspace. Please try again.');
            }
        } finally {
            setLoading(false);
            setAutoCreateWorkspace(false); // Reset auto creation flag
        }
    };

    const renderWorkspaces = () => {
        // Add debug logging to help understand what's happening
        console.log("Current state:", {
            workspaces,
            myWorkspaces,
            personalWorkspaces,
            teamWorkspaces,
            publicWorkspaces,
            activeWorkspaceType,
            viewMode
        });

        // Use the full workspaces list directly for more reliable filtering
        let workspacesToDisplay = [];

        // First determine if we're showing "My Workspaces" or "Shared Workspaces"
        if (viewMode === 'my') {
            // Use the full workspaces list and filter based on activeWorkspaceType
            switch (activeWorkspaceType) {
                case 'personal':
                    workspacesToDisplay = workspaces.filter(workspace => workspace.isPersonal);
                    break;
                case 'team':
                    workspacesToDisplay = workspaces.filter(workspace => !workspace.isPersonal && !workspace.isPublic);
                    break;
                case 'public':
                    workspacesToDisplay = workspaces.filter(workspace => workspace.isPublic);
                    break;
                default:
                    workspacesToDisplay = workspaces;
            }
        } else {
            // For Shared Workspaces
            switch (activeWorkspaceType) {
                case 'personal':
                    workspacesToDisplay = sharedWorkspaces.filter(workspace => workspace.isPersonal);
                    break;
                case 'team':
                    workspacesToDisplay = sharedWorkspaces.filter(workspace => !workspace.isPersonal && !workspace.isPublic);
                    break;
                case 'public':
                    workspacesToDisplay = sharedWorkspaces.filter(workspace => workspace.isPublic);
                    break;
                default:
                    workspacesToDisplay = sharedWorkspaces;
            }
        }

        console.log("Workspaces to display:", workspacesToDisplay);

        if (loading && workspacesToDisplay.length === 0) {
            return <div className="loading-message">Loading workspaces...</div>;
        }

        if (error) {
            return <div className="error-message">{error}</div>;
        }

        if (workspacesToDisplay.length === 0) {
            return (
                <div className="empty-workspaces">
                    <FiGrid size={48} />
                    <p>
                        {viewMode === 'my'
                            ? (activeWorkspaceType === 'personal'
                                ? "You don't have any personal workspaces yet."
                                : activeWorkspaceType === 'team'
                                    ? "You don't have any team workspaces yet."
                                    : "No public workspaces available.")
                            : "You don't have any shared workspaces of this type."
                        }
                    </p>
                    {viewMode === 'my' && (
                        <button className="create-workspace-btn" onClick={() => setShowCreateModal(true)}>
                            <FiPlus /> Create Your First Workspace
                        </button>
                    )}
                </div>
            );
        }

        return (
            <div className="workspaces-grid">
                {workspacesToDisplay.map(workspace => (
                    <div
                        key={workspace._id}
                        className="workspace-card"
                        onClick={() => navigate(`/workspace/workspaces/${workspace._id}`)}
                    >
                        <div className="workspace-card-header">
                            {workspace.isPersonal && (
                                <div className="workspace-icon personal">
                                    <FiLock />
                                </div>
                            )}
                            {workspace.isPublic && (
                                <div className="workspace-icon public">
                                    <FiGlobe />
                                </div>
                            )}
                            {!workspace.isPersonal && !workspace.isPublic && (
                                <div className="workspace-icon team">
                                    <FiUsers />
                                </div>
                            )}
                            <div className="workspace-title">
                                <h3>{workspace.name}</h3>
                            </div>
                        </div>

                        <div className="workspace-type-badge">
                            {workspace.isPersonal && <span className="workspace-type personal">PERSONAL</span>}
                            {workspace.isPublic && <span className="workspace-type public">PUBLIC</span>}
                            {!workspace.isPersonal && !workspace.isPublic && <span className="workspace-type team">TEAM</span>}
                        </div>

                        <p className="workspace-description">{workspace.description || 'No description provided.'}</p>

                        <div className="workspace-meta">
                            <div className="collections-count">
                                <strong>{workspace.collectionsCount || 0}</strong> collections
                            </div>
                            <div className="collaborators-count">
                                <FiUsers />
                                <span>{workspace.collaboratorsCount || 1}</span>
                            </div>
                        </div>

                        {workspace.userRole && (
                            <div className="workspace-role">
                                Your role: <span className="role">{workspace.userRole}</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="workspaces-section">
            <Routes>
                <Route
                    index
                    element={
                        <div className="workspaces-container">
                            <div className="workspaces-header">
                                <h1>Workspaces</h1>
                                <button className="new-workspace-btn" onClick={() => setShowCreateModal(true)}>
                                    <FiPlus /> New Workspace
                                </button>
                            </div>

                            <div className="workspace-types-tabs">
                                <button
                                    className={`workspace-tab ${activeWorkspaceType === 'personal' ? 'active' : ''}`}
                                    onClick={() => setActiveWorkspaceType('personal')}
                                >
                                    <FiLock size={16} /> Personal
                                </button>
                                <button
                                    className={`workspace-tab ${activeWorkspaceType === 'team' ? 'active' : ''}`}
                                    onClick={() => setActiveWorkspaceType('team')}
                                >
                                    <FiUsers size={16} /> Team
                                </button>
                                <button
                                    className={`workspace-tab ${activeWorkspaceType === 'public' ? 'active' : ''}`}
                                    onClick={() => setActiveWorkspaceType('public')}
                                >
                                    <FiGlobe size={16} /> Public
                                </button>
                            </div>

                            {renderWorkspaces()}

                            {/* Create Workspace Modal */}
                            {showCreateModal && (
                                <div className="modal-overlay">
                                    <div className="create-workspace-modal">
                                        <div className="modal-header">
                                            <h2>Create New Workspace</h2>
                                            <button className="close-btn" onClick={() => setShowCreateModal(false)}>
                                                <FiX size={20} />
                                            </button>
                                        </div>
                                        <form className="create-workspace-form" onSubmit={handleCreateWorkspace}>
                                            <div className="form-group">
                                                <label htmlFor="workspaceName">Name</label>
                                                <input
                                                    type="text"
                                                    id="workspaceName"
                                                    value={newWorkspaceName}
                                                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                                                    required
                                                    placeholder="Enter workspace name"
                                                />
                                            </div>

                                            <div className="form-group">
                                                <label htmlFor="workspaceDesc">Description</label>
                                                <textarea
                                                    id="workspaceDesc"
                                                    value={newWorkspaceDesc}
                                                    onChange={(e) => setNewWorkspaceDesc(e.target.value)}
                                                    placeholder="Describe your workspace"
                                                    rows={3}
                                                ></textarea>
                                            </div>

                                            <div className="form-group">
                                                <label>Workspace Type</label>
                                                <div className="workspace-types">
                                                    <div
                                                        className={`workspace-type-option ${newWorkspaceType === 'personal' ? 'selected' : ''}`}
                                                        onClick={() => setNewWorkspaceType('personal')}
                                                    >
                                                        <div className="type-icon">
                                                            <FiLock size={20} />
                                                        </div>
                                                        <div className="type-info">
                                                            <strong>Personal</strong>
                                                            <p>Private workspace only for you</p>
                                                        </div>
                                                    </div>

                                                    <div
                                                        className={`workspace-type-option ${newWorkspaceType === 'team' ? 'selected' : ''}`}
                                                        onClick={() => setNewWorkspaceType('team')}
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
                                                        className={`workspace-type-option ${newWorkspaceType === 'public' ? 'selected' : ''}`}
                                                        onClick={() => setNewWorkspaceType('public')}
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

                                            <div className="modal-actions">
                                                <button type="button" className="cancel-btn" onClick={() => setShowCreateModal(false)}>
                                                    Cancel
                                                </button>
                                                <button type="submit" className="create-btn" disabled={loading}>
                                                    {loading ? 'Creating...' : 'Create Workspace'}
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            )}
                        </div>
                    }
                />

                {/* Workspace Detail Route */}
                <Route path=":id" element={<WorkspaceDetail />} />

                {/* Workspace Edit Route - Redirect to detail page (edit modal will open there) */}
                <Route path=":id/edit" element={<Navigate to=".." replace />} />

                {/* Collections Management Route */}
                <Route path="collections/*" element={<CollectionsManagement />} />

                {/* Explore redirects to the new marketplace explore page */}
                <Route path="explore" element={<Navigate to="/workspace/api-network/explore" replace />} />
                <Route path="spotlight" element={<SpotlightSection />} />
                <Route path="ai-agent-tools" element={<AIAgentToolsSection />} />
                <Route
                    path="requests/new"
                    element={<RequestForm onSubmit={onCreate} onCancel={() => navigate('explore')} />}
                />
                <Route
                    path="requests/edit/:id"
                    element={<EditRequestForm requests={requests} onSubmit={onUpdate} />}
                />
                <Route
                    path="requests/:id"
                    element={<RequestDetails requests={requests} response={response} onSend={onSend} />}
                />
            </Routes>
        </div>
    );
};

// Existing Components (keep them as is)
const RequestDetails = ({ requests, response, onSend }) => {
    const { id } = useParams();
    const request = requests.find((r) => r._id === id);
    const navigate = useNavigate();

    if (!request) {
        return <div>Loading request details...</div>;
    }

    return (
        <>
            <h2>Request Details</h2>
            <p>
                <strong>Name:</strong> {request.name}
            </p>
            <p>
                <strong>URL:</strong> {request.url}
            </p>
            <p>
                <strong>Method:</strong> {request.method}
            </p>
            <button className="send-request-button" onClick={() => onSend(request)}>
                Send Request
            </button>
            <button className='edit-request-button' onClick={() => navigate(`requests/edit/${request._id}`)}>Edit</button>
            {response && <ResponseDisplay response={response} />}
        </>
    );
};

const EditRequestForm = ({ requests, onSubmit }) => {
    const { id } = useParams();
    const request = requests.find((r) => r._id === id);
    const navigate = useNavigate();

    if (!request) {
        return <div>Loading..</div>;
    }

    return (
        <RequestForm initialValues={request} onSubmit={onSubmit} onCancel={() => navigate(`requests/${id}`)} />
    )
}

export default WorkspacesSection;
