import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './CollectionsManagement.css';
import { FiFolder, FiPlus, FiFolderPlus, FiTrash2, FiShare2, FiLock, FiUsers, FiGitMerge, FiGitPullRequest, FiEdit, FiCopy, FiStar, FiGitBranch, FiEye, FiCheck, FiX, FiArrowRight, FiCornerDownRight } from 'react-icons/fi';

const CollectionsManagement = () => {
    const navigate = useNavigate();
    const [collections, setCollections] = useState([]);
    const [sharedCollections, setSharedCollections] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [selectedCollection, setSelectedCollection] = useState(null);
    const [newCollectionName, setNewCollectionName] = useState('');
    const [newCollectionDesc, setNewCollectionDesc] = useState('');
    const [shareEmail, setShareEmail] = useState('');
    const [shareRole, setShareRole] = useState('viewer');
    const [activeView, setActiveView] = useState('my');

    // New state variables for branch management
    const [showBranchModal, setShowBranchModal] = useState(false);
    const [branchName, setBranchName] = useState('');
    const [branchDescription, setBranchDescription] = useState('');
    const [selectedCollectionBranches, setSelectedCollectionBranches] = useState([]);
    const [activeBranch, setActiveBranch] = useState('main');

    // New state variables for merge conflict resolution
    const [showMergeModal, setShowMergeModal] = useState(false);
    const [sourceCollection, setSourceCollection] = useState(null);
    const [targetCollection, setTargetCollection] = useState(null);
    const [mergeConflicts, setMergeConflicts] = useState([]);
    const [conflictResolutions, setConflictResolutions] = useState({});

    // New state variables for diff views
    const [showDiffModal, setShowDiffModal] = useState(false);
    const [diffSource, setDiffSource] = useState(null);
    const [diffTarget, setDiffTarget] = useState(null);
    const [diffDetails, setDiffDetails] = useState([]);
    const [selectedVersion, setSelectedVersion] = useState(null);
    const [versionHistory, setVersionHistory] = useState([]);

    useEffect(() => {
        fetchCollections();
        fetchSharedCollections();
    }, []);

    const fetchCollections = async () => {
        try {
            setLoading(true);
            const response = await fetch('http://localhost:5001/api/collections', {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                setCollections(data);
            } else {
                throw new Error('Failed to fetch collections');
            }
        } catch (err) {
            setError('Error loading collections. Please try again.');
            console.error('Error fetching collections:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchSharedCollections = async () => {
        try {
            const response = await fetch('http://localhost:5001/api/collections/shared', {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                setSharedCollections(data);
            }
        } catch (err) {
            console.error('Error fetching shared collections:', err);
        }
    };

    const handleCreateCollection = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            setError(null); // Clear any previous errors

            // Log the request attempt to help with debugging
            console.log('Creating new collection:', { name: newCollectionName, description: newCollectionDesc });

            const response = await fetch('http://localhost:5001/api/collections', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    name: newCollectionName,
                    description: newCollectionDesc
                })
            });

            // Log the raw response for debugging
            console.log('Create collection response status:', response.status);

            if (response.ok) {
                const newCollection = await response.json();
                console.log('Collection created successfully:', newCollection);
                setCollections([...collections, newCollection]);
                setNewCollectionName('');
                setNewCollectionDesc('');
                setShowCreateModal(false);
            } else {
                // Try to get more detailed error information
                let errorDetail = 'Server returned: ' + response.status;
                try {
                    const errorData = await response.json();
                    errorDetail = errorData.message || errorDetail;
                } catch (parseError) {
                    console.error('Could not parse error response:', parseError);
                }
                throw new Error(`Failed to create collection: ${errorDetail}`);
            }
        } catch (err) {
            const errorMessage = err.message || 'Failed to create collection. Please try again.';
            setError(errorMessage);
            console.error('Error creating collection:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteCollection = async (collectionId) => {
        if (window.confirm('Are you sure you want to delete this collection?')) {
            try {
                setLoading(true);
                const response = await fetch(`http://localhost:5001/api/collections/${collectionId}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });

                if (response.ok) {
                    setCollections(collections.filter(collection => collection._id !== collectionId));
                } else {
                    throw new Error('Failed to delete collection');
                }
            } catch (err) {
                setError('Failed to delete collection. Please try again.');
                console.error('Error deleting collection:', err);
            } finally {
                setLoading(false);
            }
        }
    };

    const handleForkCollection = async (collectionId) => {
        try {
            setLoading(true);
            const response = await fetch(`http://localhost:5001/api/collections/${collectionId}/fork`, {
                method: 'POST',
                credentials: 'include'
            });

            if (response.ok) {
                const forkedCollection = await response.json();
                setCollections([...collections, forkedCollection]);
                alert('Collection forked successfully!');
            } else {
                const error = await response.json();
                throw new Error(error.message);
            }
        } catch (err) {
            setError('Failed to fork collection');
            console.error('Error forking collection:', err);
            alert('Failed to fork collection. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleShareCollection = async (e) => {
        e.preventDefault();
        if (!selectedCollection) return;

        try {
            setLoading(true);
            const response = await fetch(`http://localhost:5001/api/collections/${selectedCollection._id}/share`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    email: shareEmail,
                    role: shareRole
                })
            });

            if (response.ok) {
                alert('Collection shared successfully!');
                setShowShareModal(false);
                setShareEmail('');

                // Refresh the collection to see updated collaborators
                const updatedCollectionResponse = await fetch(`http://localhost:5001/api/collections/${selectedCollection._id}`, {
                    credentials: 'include'
                });

                if (updatedCollectionResponse.ok) {
                    const updatedCollection = await updatedCollectionResponse.json();
                    setCollections(collections.map(col =>
                        col._id === updatedCollection._id ? updatedCollection : col
                    ));
                }
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to share collection');
            }
        } catch (err) {
            setError('Failed to share collection. Please try again.');
            console.error('Error sharing collection:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleMergeRequest = async (sourceCollection, targetCollection) => {
        try {
            setLoading(true);
            const response = await fetch(`http://localhost:5001/api/collections/${sourceCollection._id}/merge-request`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    targetCollectionId: targetCollection._id
                })
            });

            if (response.ok) {
                const mergeRequestData = await response.json();
                alert(`Merge request created successfully! Request ID: ${mergeRequestData._id}`);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to create merge request');
            }
        } catch (err) {
            setError('Failed to create merge request. Please try again.');
            console.error('Error creating merge request:', err);
        } finally {
            setLoading(false);
        }
    };

    // --- Branch Management Functions ---
    const fetchCollectionBranches = async (collectionId) => {
        try {
            setLoading(true);
            const response = await fetch(`http://localhost:5001/api/collections/${collectionId}/branches`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                setSelectedCollectionBranches(data);
                return data;
            } else {
                throw new Error('Failed to fetch branches');
            }
        } catch (err) {
            setError('Error loading branches. Please try again.');
            console.error('Error fetching branches:', err);
            return [];
        } finally {
            setLoading(false);
        }
    };

    const handleCreateBranch = async (e) => {
        e.preventDefault();
        if (!selectedCollection) return;

        try {
            setLoading(true);
            const response = await fetch(`http://localhost:5001/api/collections/${selectedCollection._id}/branches`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    name: branchName,
                    description: branchDescription,
                    baseBranch: activeBranch
                })
            });

            if (response.ok) {
                const newBranch = await response.json();
                setSelectedCollectionBranches([...selectedCollectionBranches, newBranch]);
                setBranchName('');
                setBranchDescription('');
                setShowBranchModal(false);
                alert(`Branch "${newBranch.name}" created successfully!`);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to create branch');
            }
        } catch (err) {
            setError('Failed to create branch. Please try again.');
            console.error('Error creating branch:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSwitchBranch = async (branchName, collectionId) => {
        try {
            setLoading(true);
            const response = await fetch(`http://localhost:5001/api/collections/${collectionId}/switch-branch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    branchName
                })
            });

            if (response.ok) {
                const updatedCollection = await response.json();
                setCollections(collections.map(col =>
                    col._id === collectionId ? updatedCollection : col
                ));
                setActiveBranch(branchName);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to switch branch');
            }
        } catch (err) {
            setError('Failed to switch branch. Please try again.');
            console.error('Error switching branch:', err);
        } finally {
            setLoading(false);
        }
    };

    // --- Version History Functions ---
    const fetchVersionHistory = async (collectionId) => {
        try {
            setLoading(true);
            const response = await fetch(`http://localhost:5001/api/collections/${collectionId}/versions`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                setVersionHistory(data);
                return data;
            } else {
                throw new Error('Failed to fetch version history');
            }
        } catch (err) {
            setError('Error loading version history. Please try again.');
            console.error('Error fetching version history:', err);
            return [];
        } finally {
            setLoading(false);
        }
    };

    // --- Diff View and Conflict Resolution Functions ---
    const openDiffModal = async (source, target) => {
        try {
            setLoading(true);
            setDiffSource(source);
            setDiffTarget(target);

            const response = await fetch(`http://localhost:5001/api/collections/diff`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    sourceId: source._id,
                    targetId: target._id,
                    sourceBranch: source.branch || 'main',
                    targetBranch: target.branch || 'main'
                })
            });

            if (response.ok) {
                const diffData = await response.json();
                setDiffDetails(diffData);
                setShowDiffModal(true);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch diff data');
            }
        } catch (err) {
            setError('Failed to load diff view. Please try again.');
            console.error('Error loading diff view:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCheckMergeConflicts = async (sourceCollection, targetCollection) => {
        try {
            setLoading(true);
            setSourceCollection(sourceCollection);
            setTargetCollection(targetCollection);

            const response = await fetch(`http://localhost:5001/api/collections/${sourceCollection._id}/check-conflicts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    targetCollectionId: targetCollection._id,
                    sourceBranch: activeBranch,
                    targetBranch: 'main' // Default target branch
                })
            });

            if (response.ok) {
                const conflictsData = await response.json();
                setMergeConflicts(conflictsData);

                // Initialize conflict resolutions object
                const initialResolutions = {};
                conflictsData.forEach(conflict => {
                    initialResolutions[conflict.id] = {
                        resolution: 'source', // Default to using source version
                        manualResolution: null // For manual edits
                    };
                });

                setConflictResolutions(initialResolutions);

                if (conflictsData.length > 0) {
                    setShowMergeModal(true);
                } else {
                    // If no conflicts, proceed with merge request
                    handleMergeRequest(sourceCollection, targetCollection);
                }
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to check for merge conflicts');
            }
        } catch (err) {
            setError('Failed to check for merge conflicts. Please try again.');
            console.error('Error checking merge conflicts:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleResolveConflict = (conflictId, resolution) => {
        setConflictResolutions(prev => ({
            ...prev,
            [conflictId]: {
                ...prev[conflictId],
                resolution
            }
        }));
    };

    const handleManualConflictResolution = (conflictId, manualResolution) => {
        setConflictResolutions(prev => ({
            ...prev,
            [conflictId]: {
                ...prev[conflictId],
                resolution: 'manual',
                manualResolution
            }
        }));
    };

    const handleApplyResolutions = async () => {
        try {
            setLoading(true);

            const response = await fetch(`http://localhost:5001/api/collections/${sourceCollection._id}/resolve-conflicts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    targetCollectionId: targetCollection._id,
                    resolutions: conflictResolutions
                })
            });

            if (response.ok) {
                const resolvedData = await response.json();
                setShowMergeModal(false);

                // Now create the merge request with resolved conflicts
                handleMergeRequest(sourceCollection, targetCollection);
                alert('Conflicts resolved successfully!');
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to resolve conflicts');
            }
        } catch (err) {
            setError('Failed to apply conflict resolutions. Please try again.');
            console.error('Error resolving conflicts:', err);
        } finally {
            setLoading(false);
        }
    };

    const openBranchModal = async (collection) => {
        setSelectedCollection(collection);
        const branches = await fetchCollectionBranches(collection._id);
        if (branches.length > 0) {
            const mainBranch = branches.find(b => b.name === 'main') || branches[0];
            setActiveBranch(mainBranch.name);
        } else {
            setActiveBranch('main'); // Default to main if no branches exist
        }
        setShowBranchModal(true);
    };

    const openShareModal = (collection) => {
        setSelectedCollection(collection);
        setShowShareModal(true);
    };

    const displayCollectionsByView = () => {
        const collectionsToDisplay = activeView === 'my' ? collections : sharedCollections;

        if (loading) return <div className="loading-message">Loading collections...</div>;
        if (error) return <div className="error-message">{error}</div>;

        if (collectionsToDisplay.length === 0) {
            return (
                <div className="empty-collections">
                    <FiFolder size={48} />
                    <p>{activeView === 'my' ? 'You don\'t have any collections yet.' : 'No collections are shared with you yet.'}</p>
                    {activeView === 'my' && (
                        <button className="create-collection-btn" onClick={() => setShowCreateModal(true)}>
                            <FiFolderPlus /> Create Your First Collection
                        </button>
                    )}
                </div>
            );
        }

        return (
            <div className="collections-grid">
                {collectionsToDisplay.map(collection => (
                    <div key={collection._id} className="collection-card">
                        <div className="collection-header">
                            <div className="collection-title-area">
                                <FiFolder className="collection-icon" />
                                <h3>{collection.name}</h3>
                            </div>
                            {collection.isPublic && <span className="public-badge">Public</span>}
                        </div>
                        <p className="collection-description">{collection.description}</p>

                        {collection.collaborators && collection.collaborators.length > 0 && (
                            <div className="collaborators">
                                <FiUsers className="collaborator-icon" />
                                <span>{collection.collaborators.length} collaborators</span>
                            </div>
                        )}

                        <div className="collection-meta">
                            <span className="request-count">{collection.requestCount || 0} requests</span>
                            <span className="last-updated">
                                Updated: {new Date(collection.updatedAt || Date.now()).toLocaleDateString()}
                            </span>
                        </div>

                        <div className="collection-actions">
                            <button
                                className="view-btn"
                                onClick={() => navigate(`/workspace/collections/${collection._id}`)}
                            >
                                View
                            </button>

                            {activeView === 'my' && (
                                <>
                                    <button className="branch-btn" onClick={() => openBranchModal(collection)}>
                                        <FiGitBranch />
                                    </button>
                                    <button className="share-btn" onClick={() => openShareModal(collection)}>
                                        <FiShare2 />
                                    </button>
                                    <button className="delete-btn" onClick={() => handleDeleteCollection(collection._id)}>
                                        <FiTrash2 />
                                    </button>
                                </>
                            )}

                            {activeView === 'shared' && collection.myRole === 'viewer' && (
                                <button className="fork-btn" onClick={() => handleForkCollection(collection._id)}>
                                    <FiCopy /> Fork
                                </button>
                            )}

                            {activeView === 'my' && collection.branches && collection.branches.length > 0 && (
                                <div className="branch-indicator">
                                    <FiGitBranch /> {collection.branches.length}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="collections-management">
            <div className="collections-header">
                <h1>API Collections</h1>
                {activeView === 'my' && (
                    <button className="new-collection-btn" onClick={(e) => {
                        e.preventDefault(); // Prevent any default navigation
                        setShowCreateModal(true);
                        // Reset form fields when opening the modal
                        setNewCollectionName('');
                        setNewCollectionDesc('');
                        setError(null); // Clear any previous errors
                    }}>
                        <FiPlus /> New Collection
                    </button>
                )}
            </div>

            <div className="view-tabs">
                <button
                    className={`view-tab ${activeView === 'my' ? 'active' : ''}`}
                    onClick={() => setActiveView('my')}
                >
                    My Collections
                </button>
                <button
                    className={`view-tab ${activeView === 'shared' ? 'active' : ''}`}
                    onClick={() => setActiveView('shared')}
                >
                    Shared with Me
                </button>
            </div>

            {displayCollectionsByView()}

            {/* Create Collection Modal */}
            {showCreateModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>Create New Collection</h2>
                        <form onSubmit={handleCreateCollection}>
                            <div className="form-group">
                                <label htmlFor="collectionName">Name</label>
                                <input
                                    type="text"
                                    id="collectionName"
                                    value={newCollectionName}
                                    onChange={(e) => setNewCollectionName(e.target.value)}
                                    required
                                    placeholder="Enter collection name"
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="collectionDesc">Description</label>
                                <textarea
                                    id="collectionDesc"
                                    value={newCollectionDesc}
                                    onChange={(e) => setNewCollectionDesc(e.target.value)}
                                    placeholder="Describe your collection"
                                    rows={3}
                                ></textarea>
                            </div>
                            <div className="modal-actions">
                                <button type="button" onClick={() => setShowCreateModal(false)} className="cancel-btn">
                                    Cancel
                                </button>
                                <button type="submit" className="create-btn" disabled={loading}>
                                    {loading ? 'Creating...' : 'Create Collection'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Share Collection Modal */}
            {showShareModal && selectedCollection && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>Share "{selectedCollection.name}"</h2>

                        {selectedCollection.collaborators && selectedCollection.collaborators.length > 0 && (
                            <div className="collaborators-list">
                                <h3>Current Collaborators</h3>
                                <ul>
                                    {selectedCollection.collaborators.map((collab, index) => (
                                        <li key={index}>
                                            <span className="collaborator-email">{collab.email}</span>
                                            <span className={`collaborator-role role-${collab.role}`}>
                                                {collab.role === 'editor' ? 'Can edit' : 'Can view'}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <form onSubmit={handleShareCollection}>
                            <div className="form-group">
                                <label htmlFor="shareEmail">Email</label>
                                <input
                                    type="email"
                                    id="shareEmail"
                                    value={shareEmail}
                                    onChange={(e) => setShareEmail(e.target.value)}
                                    required
                                    placeholder="Enter email address"
                                />
                            </div>
                            <div className="form-group">
                                <label>Permission</label>
                                <div className="role-selector">
                                    <div
                                        className={`role-option ${shareRole === 'viewer' ? 'selected' : ''}`}
                                        onClick={() => setShareRole('viewer')}
                                    >
                                        <FiLock size={16} />
                                        <div>
                                            <strong>Can view</strong>
                                            <p>Can view and fork the collection</p>
                                        </div>
                                    </div>
                                    <div
                                        className={`role-option ${shareRole === 'editor' ? 'selected' : ''}`}
                                        onClick={() => setShareRole('editor')}
                                    >
                                        <FiEdit size={16} />
                                        <div>
                                            <strong>Can edit</strong>
                                            <p>Can edit requests and settings</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-actions">
                                <button type="button" onClick={() => setShowShareModal(false)} className="cancel-btn">
                                    Cancel
                                </button>
                                <button type="submit" className="share-btn" disabled={loading}>
                                    {loading ? 'Sharing...' : 'Share'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Branch Management Modal */}
            {showBranchModal && selectedCollection && (
                <div className="modal-overlay">
                    <div className="modal-content branch-modal">
                        <h2>Branch Management - {selectedCollection.name}</h2>

                        <div className="branch-tabs">
                            <div className="branch-list">
                                <h3>Branches</h3>
                                {selectedCollectionBranches.length === 0 ? (
                                    <p className="no-branches-message">Only the main branch exists.</p>
                                ) : (
                                    <ul className="branches">
                                        <li className={`branch-item ${activeBranch === 'main' ? 'active' : ''}`} onClick={() => handleSwitchBranch('main', selectedCollection._id)}>
                                            <div className="branch-info">
                                                <FiGitBranch className="branch-icon" />
                                                <div>
                                                    <span className="branch-name">main</span>
                                                    <span className="branch-default-label">Default branch</span>
                                                </div>
                                            </div>
                                            {activeBranch === 'main' && <FiCheck className="active-branch-icon" />}
                                        </li>
                                        {selectedCollectionBranches.map(branch => (
                                            branch.name !== 'main' && (
                                                <li
                                                    key={branch.id}
                                                    className={`branch-item ${activeBranch === branch.name ? 'active' : ''}`}
                                                    onClick={() => handleSwitchBranch(branch.name, selectedCollection._id)}
                                                >
                                                    <div className="branch-info">
                                                        <FiGitBranch className="branch-icon" />
                                                        <div>
                                                            <span className="branch-name">{branch.name}</span>
                                                            <span className="branch-description">{branch.description}</span>
                                                            <span className="branch-created">Created {new Date(branch.createdAt).toLocaleDateString()}</span>
                                                        </div>
                                                    </div>
                                                    <div className="branch-actions">
                                                        {activeBranch === branch.name ? (
                                                            <FiCheck className="active-branch-icon" />
                                                        ) : (
                                                            <>
                                                                <button
                                                                    className="merge-branch-btn"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleCheckMergeConflicts(
                                                                            { ...selectedCollection, branch: branch.name },
                                                                            { ...selectedCollection, branch: 'main' }
                                                                        );
                                                                    }}
                                                                >
                                                                    <FiGitMerge /> Merge to main
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </li>
                                            )
                                        ))}
                                    </ul>
                                )}
                            </div>

                            <div className="create-branch-form">
                                <h3>Create New Branch</h3>
                                <form onSubmit={handleCreateBranch}>
                                    <div className="form-group">
                                        <label htmlFor="branchName">Branch Name</label>
                                        <input
                                            type="text"
                                            id="branchName"
                                            value={branchName}
                                            onChange={(e) => setBranchName(e.target.value)}
                                            required
                                            placeholder="feature/new-feature"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="branchDescription">Description (optional)</label>
                                        <textarea
                                            id="branchDescription"
                                            value={branchDescription}
                                            onChange={(e) => setBranchDescription(e.target.value)}
                                            placeholder="Describe the purpose of this branch"
                                            rows={3}
                                        ></textarea>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="baseBranch">Base Branch</label>
                                        <select
                                            id="baseBranch"
                                            value={activeBranch}
                                            onChange={(e) => setActiveBranch(e.target.value)}
                                        >
                                            <option value="main">main</option>
                                            {selectedCollectionBranches.map(branch => (
                                                branch.name !== 'main' && (
                                                    <option key={branch.id} value={branch.name}>
                                                        {branch.name}
                                                    </option>
                                                )
                                            ))}
                                        </select>
                                        <p className="form-helper">This is the branch your new branch will be based on</p>
                                    </div>
                                    <div className="modal-actions">
                                        <button type="submit" className="create-btn" disabled={loading}>
                                            {loading ? 'Creating...' : 'Create Branch'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>

                        <div className="modal-actions branch-modal-actions">
                            <button onClick={() => setShowBranchModal(false)} className="close-btn">
                                Close
                            </button>
                            {activeBranch !== 'main' && (
                                <div className="active-branch-indicator">
                                    <FiGitBranch /> Currently on: <strong>{activeBranch}</strong>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Merge Conflict Resolution Modal */}
            {showMergeModal && sourceCollection && targetCollection && (
                <div className="modal-overlay">
                    <div className="modal-content conflict-modal">
                        <h2>Resolve Merge Conflicts</h2>
                        <div className="conflict-header">
                            <div className="merge-info">
                                <div className="merge-branch-info">
                                    <div className="source">
                                        <span className="label">Source:</span>
                                        <span className="value">{sourceCollection.name}</span>
                                        <span className="branch">({sourceCollection.branch || 'main'})</span>
                                    </div>
                                    <FiArrowRight className="merge-arrow" />
                                    <div className="target">
                                        <span className="label">Target:</span>
                                        <span className="value">{targetCollection.name}</span>
                                        <span className="branch">({targetCollection.branch || 'main'})</span>
                                    </div>
                                </div>
                                <div className="conflict-count">
                                    <span>{mergeConflicts.length} {mergeConflicts.length === 1 ? 'conflict' : 'conflicts'} found</span>
                                </div>
                            </div>
                        </div>

                        <div className="conflicts-container">
                            {mergeConflicts.map((conflict, index) => (
                                <div key={conflict.id} className="conflict-item">
                                    <div className="conflict-title">
                                        <h3>Conflict #{index + 1}: {conflict.type}</h3>
                                        <span className="conflict-path">{conflict.path}</span>
                                    </div>

                                    <div className="conflict-diff">
                                        <div className="diff-panel source-panel">
                                            <div className="diff-header">
                                                <h4>Source Version</h4>
                                                <button
                                                    className={`use-btn ${conflictResolutions[conflict.id]?.resolution === 'source' ? 'selected' : ''}`}
                                                    onClick={() => handleResolveConflict(conflict.id, 'source')}
                                                >
                                                    <FiCheck /> Use This
                                                </button>
                                            </div>
                                            <pre className="diff-content">{JSON.stringify(conflict.source, null, 2)}</pre>
                                        </div>

                                        <div className="diff-panel target-panel">
                                            <div className="diff-header">
                                                <h4>Target Version</h4>
                                                <button
                                                    className={`use-btn ${conflictResolutions[conflict.id]?.resolution === 'target' ? 'selected' : ''}`}
                                                    onClick={() => handleResolveConflict(conflict.id, 'target')}
                                                >
                                                    <FiCheck /> Use This
                                                </button>
                                            </div>
                                            <pre className="diff-content">{JSON.stringify(conflict.target, null, 2)}</pre>
                                        </div>
                                    </div>

                                    <div className="manual-resolution">
                                        <div className="manual-header">
                                            <h4>Manual Resolution</h4>
                                            <button
                                                className={`use-btn ${conflictResolutions[conflict.id]?.resolution === 'manual' ? 'selected' : ''}`}
                                                onClick={() => {
                                                    if (!conflictResolutions[conflict.id]?.manualResolution) {
                                                        const initialManualValue = JSON.stringify(conflict.source, null, 2);
                                                        handleManualConflictResolution(conflict.id, initialManualValue);
                                                    }
                                                    handleResolveConflict(conflict.id, 'manual');
                                                }}
                                            >
                                                <FiCheck /> Use Manual Edit
                                            </button>
                                        </div>
                                        <textarea
                                            className="manual-editor"
                                            value={conflictResolutions[conflict.id]?.manualResolution || ''}
                                            onChange={(e) => handleManualConflictResolution(conflict.id, e.target.value)}
                                            placeholder="Enter your manual resolution here..."
                                            disabled={conflictResolutions[conflict.id]?.resolution !== 'manual'}
                                            rows={8}
                                        ></textarea>
                                    </div>

                                    <div className="conflict-resolution-status">
                                        <span className="resolution-label">Resolution:</span>
                                        {conflictResolutions[conflict.id]?.resolution === 'source' && (
                                            <span className="resolution-value">Using source version</span>
                                        )}
                                        {conflictResolutions[conflict.id]?.resolution === 'target' && (
                                            <span className="resolution-value">Using target version</span>
                                        )}
                                        {conflictResolutions[conflict.id]?.resolution === 'manual' && (
                                            <span className="resolution-value">Using manual edit</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="modal-actions">
                            <button
                                className="cancel-btn"
                                onClick={() => setShowMergeModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="apply-btn"
                                disabled={loading || Object.values(conflictResolutions).some(r => !r.resolution)}
                                onClick={handleApplyResolutions}
                            >
                                {loading ? 'Applying...' : 'Apply Resolutions & Create Merge Request'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Diff View Modal */}
            {showDiffModal && diffSource && diffTarget && (
                <div className="modal-overlay">
                    <div className="modal-content diff-modal">
                        <h2>Detailed Diff View</h2>
                        <div className="diff-header-info">
                            <div className="diff-source-target">
                                <div className="diff-entity">
                                    <span className="diff-label">Source:</span>
                                    <span className="diff-value">{diffSource.name}</span>
                                    <span className="diff-branch">{diffSource.branch ? `(${diffSource.branch})` : ''}</span>
                                </div>
                                <FiArrowRight className="diff-arrow" />
                                <div className="diff-entity">
                                    <span className="diff-label">Target:</span>
                                    <span className="diff-value">{diffTarget.name}</span>
                                    <span className="diff-branch">{diffTarget.branch ? `(${diffTarget.branch})` : ''}</span>
                                </div>
                            </div>
                            <div className="diff-summary">
                                <div className="diff-stat added">
                                    <span className="diff-count">+{diffDetails.summary?.added || 0}</span>
                                    <span>Added</span>
                                </div>
                                <div className="diff-stat modified">
                                    <span className="diff-count">~{diffDetails.summary?.modified || 0}</span>
                                    <span>Modified</span>
                                </div>
                                <div className="diff-stat deleted">
                                    <span className="diff-count">-{diffDetails.summary?.deleted || 0}</span>
                                    <span>Deleted</span>
                                </div>
                            </div>
                        </div>

                        <div className="diff-sections">
                            {/* Added Items Section */}
                            {diffDetails.added && diffDetails.added.length > 0 && (
                                <div className="diff-section">
                                    <h3 className="diff-section-title added">Added Items</h3>
                                    <div className="diff-items">
                                        {diffDetails.added.map((item, index) => (
                                            <div key={`added-${index}`} className="diff-item added">
                                                <div className="diff-item-header">
                                                    <span className="diff-item-path">{item.path}</span>
                                                    <span className="diff-item-type">{item.type}</span>
                                                </div>
                                                <pre className="diff-item-content">{JSON.stringify(item.value, null, 2)}</pre>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Modified Items Section */}
                            {diffDetails.modified && diffDetails.modified.length > 0 && (
                                <div className="diff-section">
                                    <h3 className="diff-section-title modified">Modified Items</h3>
                                    <div className="diff-items">
                                        {diffDetails.modified.map((item, index) => (
                                            <div key={`modified-${index}`} className="diff-item modified">
                                                <div className="diff-item-header">
                                                    <span className="diff-item-path">{item.path}</span>
                                                    <span className="diff-item-type">{item.type}</span>
                                                </div>
                                                <div className="diff-item-comparison">
                                                    <div className="diff-item-old">
                                                        <div className="diff-side-header">
                                                            <h4>Source Version</h4>
                                                        </div>
                                                        <pre className="diff-content">{JSON.stringify(item.oldValue, null, 2)}</pre>
                                                    </div>
                                                    <div className="diff-item-new">
                                                        <div className="diff-side-header">
                                                            <h4>Target Version</h4>
                                                        </div>
                                                        <pre className="diff-content">{JSON.stringify(item.newValue, null, 2)}</pre>
                                                    </div>
                                                </div>
                                                {item.changes && item.changes.length > 0 && (
                                                    <div className="diff-item-changes">
                                                        <h4>Specific Changes</h4>
                                                        <ul className="changes-list">
                                                            {item.changes.map((change, changeIndex) => (
                                                                <li key={`change-${index}-${changeIndex}`} className="change-item">
                                                                    <span className="change-field">{change.field}: </span>
                                                                    <span className="change-old">{JSON.stringify(change.oldValue)}</span>
                                                                    <FiArrowRight className="change-arrow" />
                                                                    <span className="change-new">{JSON.stringify(change.newValue)}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Deleted Items Section */}
                            {diffDetails.deleted && diffDetails.deleted.length > 0 && (
                                <div className="diff-section">
                                    <h3 className="diff-section-title deleted">Deleted Items</h3>
                                    <div className="diff-items">
                                        {diffDetails.deleted.map((item, index) => (
                                            <div key={`deleted-${index}`} className="diff-item deleted">
                                                <div className="diff-item-header">
                                                    <span className="diff-item-path">{item.path}</span>
                                                    <span className="diff-item-type">{item.type}</span>
                                                </div>
                                                <pre className="diff-item-content">{JSON.stringify(item.value, null, 2)}</pre>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* No Changes Message */}
                            {(!diffDetails.added || diffDetails.added.length === 0) &&
                                (!diffDetails.modified || diffDetails.modified.length === 0) &&
                                (!diffDetails.deleted || diffDetails.deleted.length === 0) && (
                                    <div className="no-diff-message">
                                        <p>No differences found between the selected versions.</p>
                                    </div>
                                )}
                        </div>

                        <div className="modal-actions">
                            <button className="close-btn" onClick={() => setShowDiffModal(false)}>
                                Close
                            </button>
                            {diffSource._id === diffTarget._id && (
                                <button
                                    className="create-merge-request-btn"
                                    onClick={() => {
                                        setShowDiffModal(false);
                                        handleCheckMergeConflicts(diffSource, diffTarget);
                                    }}
                                >
                                    <FiGitPullRequest /> Create Merge Request
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CollectionsManagement;