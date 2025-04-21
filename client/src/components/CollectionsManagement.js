import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './CollectionsManagement.css';
import { FiFolder, FiPlus, FiFolderPlus, FiTrash2, FiShare2, FiLock, FiUsers, FiGitMerge, FiGitPullRequest, FiEdit, FiCopy, FiStar } from 'react-icons/fi';

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

            if (response.ok) {
                const newCollection = await response.json();
                setCollections([...collections, newCollection]);
                setNewCollectionName('');
                setNewCollectionDesc('');
                setShowCreateModal(false);
            } else {
                throw new Error('Failed to create collection');
            }
        } catch (err) {
            setError('Failed to create collection. Please try again.');
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
                    <button className="new-collection-btn" onClick={() => setShowCreateModal(true)}>
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
        </div>
    );
};

export default CollectionsManagement;