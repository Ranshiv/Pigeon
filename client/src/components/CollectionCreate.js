import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './CollectionsManagement.css'; // Reuse the existing CSS

const CollectionCreate = ({
    workspaceId: workspaceIdProp,
    workspaceName,
    embedded = false,
    onCancel,
    onCreated
} = {}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [newCollectionName, setNewCollectionName] = useState('');
    const [newCollectionDesc, setNewCollectionDesc] = useState('');

    // Get workspace ID from query params if available
    const queryParams = new URLSearchParams(location.search);
    const workspaceId = workspaceIdProp || queryParams.get('workspaceId');

    const handleCreateCollection = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            setError(null);

            console.log('Creating new collection:', {
                name: newCollectionName,
                description: newCollectionDesc,
                workspaceId: workspaceId || 'default'
            });

            // Create the request body with workspaceId if available
            const requestBody = {
                name: newCollectionName,
                description: newCollectionDesc
            };

            // Only add workspaceId to the request if it exists
            if (workspaceId) {
                requestBody.workspaceId = workspaceId;
            }

            const response = await fetch('http://localhost:5001/api/collections', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(requestBody)
            });

            console.log('Create collection response status:', response.status);

            if (response.ok) {
                const newCollection = await response.json();
                console.log('Collection created successfully:', newCollection);

                // If embedded (modal/overlay use-case), delegate behavior to caller.
                if (typeof onCreated === 'function') {
                    onCreated(newCollection);
                    return;
                }

                // Navigate to either the workspace detail or collections list
                if (workspaceId) {
                    navigate(`/workspace/workspaces/${workspaceId}`);
                } else {
                    navigate('/workspace/collections');
                }
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

    const handleCancel = () => {
        if (typeof onCancel === 'function') {
            onCancel();
            return;
        }
        // Navigate back to either the workspace detail or collections list
        if (workspaceId) {
            navigate(`/workspace/workspaces/${workspaceId}`);
        } else {
            navigate('/workspace/collections');
        }
    };

    return (
        <div className={`collection-create-page${embedded ? ' embedded' : ''}`}>
            <div className="page-header">
                <h1>Create New Collection</h1>
                <p className="subtitle">
                    {workspaceId
                        ? `Creating collection in workspace: ${workspaceName || workspaceId}`
                        : 'Creating collection in your default workspace'}
                </p>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="create-collection-form-container">
                <form onSubmit={handleCreateCollection} className="create-collection-form">
                    <div className="form-group">
                        <label htmlFor="collectionName">Collection Name</label>
                        <input
                            type="text"
                            id="collectionName"
                            value={newCollectionName}
                            onChange={(e) => setNewCollectionName(e.target.value)}
                            required
                            placeholder="Enter collection name"
                            className="form-input"
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="collectionDesc">Description</label>
                        <textarea
                            id="collectionDesc"
                            value={newCollectionDesc}
                            onChange={(e) => setNewCollectionDesc(e.target.value)}
                            placeholder="Describe your collection"
                            rows={4}
                            className="form-textarea"
                        ></textarea>
                    </div>
                    <div className="form-actions">
                        <button type="button" onClick={handleCancel} className="cancel-btn">
                            Cancel
                        </button>
                        <button type="submit" className="create-btn" disabled={loading}>
                            {loading ? 'Creating...' : 'Create Collection'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CollectionCreate;