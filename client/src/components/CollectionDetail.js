// client/src/components/CollectionDetail.js
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './CollectionDetail.css';
import ActiveCollaborators from './ActiveCollaborators';
import RequestForm from './RequestForm';
import ResponseDisplay from './ResponseDisplay';
import { useCollaboration } from '../context/CollaborationContext';
import { FiSave, FiSettings, FiPlay, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';

function CollectionDetail() {
  const { collectionId } = useParams();
  const navigate = useNavigate();
  const [collection, setCollection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [runAllResults, setRunAllResults] = useState([]);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(false);

  // Get collaboration context features
  const {
    joinCollection,
    leaveCollection,
    sendActivity,
    getActiveUsers,
    connected,
    startEditing,
    stopEditing,
    trackChanges
  } = useCollaboration();

  // Fetch collection data
  const fetchCollection = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:5001/api/collections/${collectionId}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch collection');
      }

      const data = await response.json();
      setCollection(data);
      setRequests(data.requests || []);

      // Select the first request by default if available
      if (data.requests && data.requests.length > 0) {
        setSelectedRequest(data.requests[0]);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching collection:', err);
      setError('Failed to load collection. Please try again later.');
      setLoading(false);
    }
  }, [collectionId]);

  // Join the collaboration room for this collection
  const joinCollaborationRoom = useCallback(() => {
    if (connected && collectionId && collection) {
      console.log(`Joining collaboration room for collection: ${collectionId}`);
      joinCollection(collectionId);

      // Start editing session for this collection
      startEditing('collection', collectionId, collection);

      // Notify other users
      setTimeout(() => {
        sendActivity('collection_view', {
          collectionName: collection?.name,
          collectionId: collectionId
        });
      }, 1000);
    }
  }, [connected, collectionId, collection, joinCollection, sendActivity, startEditing]);

  // Leave the collaboration room when unmounting
  const leaveCollaborationRoom = useCallback(() => {
    if (collectionId) {
      console.log(`Leaving collaboration room for collection: ${collectionId}`);
      leaveCollection(collectionId);

      // Stop editing and save changes if there are any
      if (pendingChanges) {
        stopEditing('collection', collectionId, true, 'Updated collection before leaving');
      }
    }
  }, [collectionId, leaveCollection, pendingChanges, stopEditing]);

  // UseEffect hooks after all functions are defined
  useEffect(() => {
    // Fetch collection details when component mounts
    fetchCollection();

    return () => {
      leaveCollaborationRoom();
    };
  }, [fetchCollection, leaveCollaborationRoom]);

  // Join the room after collection is loaded
  useEffect(() => {
    if (collection && connected) {
      joinCollaborationRoom();
    }
  }, [collection, connected, joinCollaborationRoom]);

  // Save collection changes to the server
  const saveCollection = async () => {
    try {
      setIsSaving(true);

      // Create updated collection with current requests
      const updatedCollection = {
        ...collection,
        requests: requests
      };

      // Track changes for version control
      trackChanges('collection', collectionId, updatedCollection);

      const response = await fetch(`http://localhost:5001/api/collections/${collectionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(updatedCollection)
      });

      if (!response.ok) {
        throw new Error('Failed to save collection');
      }

      // Update local collection state with the saved data
      const savedCollection = await response.json();
      setCollection(savedCollection);

      // Notify about saved collection
      sendActivity('collection_updated', {
        collectionName: collection.name,
        collectionId: collectionId
      });

      // Reset pending changes flag
      setPendingChanges(false);

      // Show success message
      alert('Collection saved successfully');

    } catch (err) {
      console.error('Error saving collection:', err);
      alert('Failed to save collection. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Run all requests in the collection
  const runAllRequests = async () => {
    if (requests.length === 0) {
      alert('No requests to run');
      return;
    }

    try {
      setIsRunningAll(true);
      setRunAllResults([]);

      // Notify collaborators
      sendActivity('collection_run', {
        collectionName: collection.name,
        requestCount: requests.length
      });

      // Process requests sequentially to avoid overwhelming the server
      const results = [];

      // Using for...of to allow await inside the loop
      for (const request of requests) {
        try {
          // Skip requests without a valid URL
          if (!request.url || request.url.trim() === '') {
            results.push({
              requestId: request._id || request.id,
              name: request.name,
              success: false,
              status: 400,
              message: 'Invalid URL (empty)'
            });
            continue;
          }

          // Send request to the server
          // For client-side testing, create a fallback ID if _id is missing
          const requestId = request._id || request.id;

          const response = await fetch(`http://localhost:5001/api/requests/${requestId}/send`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'include',
            // Include request data in body to ensure server has all request details
            body: JSON.stringify({
              method: request.method,
              url: request.url,
              headers: request.headers || [],
              body: request.body || ''
            })
          });

          if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
          }

          const responseData = await response.json();

          results.push({
            requestId: requestId,
            name: request.name,
            success: true,
            status: responseData.status,
            duration: responseData.duration,
            message: 'Success',
            data: responseData
          });
        } catch (err) {
          results.push({
            requestId: request._id || request.id,
            name: request.name,
            success: false,
            status: err.status || 500,
            message: err.message || 'Request failed'
          });
        }
      }

      setRunAllResults(results);

      // Notify about completion
      const successCount = results.filter(r => r.success).length;
      sendActivity('collection_run_completed', {
        collectionName: collection.name,
        totalRequests: requests.length,
        successCount,
        failCount: requests.length - successCount
      });

    } catch (err) {
      console.error('Error running all requests:', err);
      alert('Failed to run all requests. Please try again.');
    } finally {
      setIsRunningAll(false);
    }
  };

  // Handle request selection
  const handleSelectRequest = (request) => {
    setSelectedRequest(request);
    setShowRequestForm(true);
  };

  // Handle adding a new request
  const handleAddRequest = () => {
    const newRequest = {
      id: `req-${Date.now()}`, // Temporary ID
      name: 'New Request',
      method: 'GET',
      url: '',
      headers: [],
      body: '',
      isNew: true
    };

    setSelectedRequest(newRequest);
    setShowRequestForm(true);
  };

  // Handle saving a request
  const handleSaveRequest = (request) => {
    try {
      // If it's a new request, add it to the collection
      if (request.isNew) {
        const newRequests = [...requests, { ...request, isNew: false }];
        setRequests(newRequests);
      } else {
        // Otherwise update the existing request
        const newRequests = requests.map(req =>
          (req.id === request.id || req._id === request._id) ? { ...request } : req
        );
        setRequests(newRequests);
      }

      // Update the selected request
      setSelectedRequest({ ...request, isNew: false });

      // Mark that we have pending changes
      setPendingChanges(true);

      // Broadcast the change to other collaborators
      sendActivity('request_updated', {
        requestName: request.name,
        requestMethod: request.method,
        collectionName: collection.name
      });

    } catch (err) {
      console.error('Error saving request:', err);
      alert('Failed to save request. Please try again.');
    }
  };

  // Handle collection settings
  const handleSettingsClick = () => {
    setShowSettings(true);
  };

  // Close settings modal
  const closeSettings = () => {
    setShowSettings(false);
  };

  // Handle collection settings update
  const handleUpdateSettings = async (updatedSettings) => {
    try {
      // Create updated collection with new settings
      const updatedCollection = {
        ...collection,
        ...updatedSettings
      };

      // Track changes for version control
      trackChanges('collection', collectionId, updatedCollection);

      const response = await fetch(`http://localhost:5001/api/collections/${collectionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(updatedCollection)
      });

      if (!response.ok) {
        throw new Error('Failed to update collection settings');
      }

      // Update local collection state with the response from server
      const savedCollection = await response.json();
      setCollection(savedCollection);

      // Notify about settings update
      sendActivity('collection_settings_updated', {
        collectionName: collection.name,
        collectionId: collectionId
      });

      // Show success message
      alert('Collection settings updated successfully');

      // Close settings modal
      setShowSettings(false);

    } catch (err) {
      console.error('Error updating collection settings:', err);
      alert('Failed to update collection settings. Please try again.');
    }
  };

  // Handle request deletion
  const handleDeleteRequest = (requestId) => {
    // Confirm deletion
    if (!window.confirm('Are you sure you want to delete this request?')) {
      return;
    }

    // Filter out the deleted request
    const newRequests = requests.filter(req => (req.id !== requestId && req._id !== requestId));
    setRequests(newRequests);
    setPendingChanges(true);

    // If the deleted request was selected, unselect it
    if (selectedRequest && (selectedRequest.id === requestId || selectedRequest._id === requestId)) {
      setSelectedRequest(null);
      setShowRequestForm(false);
    }

    // Notify about request deletion
    sendActivity('request_deleted', {
      requestId,
      collectionName: collection.name
    });
  };

  // Collection settings modal
  const renderSettingsModal = () => {
    if (!showSettings) return null;

    return (
      <div className="modal-overlay">
        <div className="settings-modal">
          <h3>Collection Settings</h3>

          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const updatedSettings = {
              name: formData.get('name'),
              description: formData.get('description'),
              isPublic: formData.get('isPublic') === 'true',
            };
            handleUpdateSettings(updatedSettings);
          }}>
            <div className="form-group">
              <label htmlFor="name">Collection Name</label>
              <input
                type="text"
                id="name"
                name="name"
                defaultValue={collection.name}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                defaultValue={collection.description || ''}
                rows="4"
              />
            </div>

            <div className="form-group">
              <label htmlFor="isPublic">Visibility</label>
              <select
                id="isPublic"
                name="isPublic"
                defaultValue={collection.isPublic ? 'true' : 'false'}
              >
                <option value="false">Private</option>
                <option value="true">Public</option>
              </select>
              <small>
                {collection.isPublic ?
                  "This collection is publicly accessible to anyone with the link." :
                  "Only you and your collaborators can access this collection."}
              </small>
            </div>

            <div className="modal-actions">
              <button type="button" onClick={closeSettings} className="cancel-btn">
                Cancel
              </button>
              <button type="submit" className="save-btn">
                Save Settings
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Render run all results
  const renderRunAllResults = () => {
    if (runAllResults.length === 0) return null;

    const successCount = runAllResults.filter(r => r.success).length;

    return (
      <div className="run-all-results">
        <h3>Run Results ({successCount}/{runAllResults.length} successful)</h3>
        <div className="result-list">
          {runAllResults.map((result) => (
            <div
              key={result.requestId}
              className={`result-item ${result.success ? 'success' : 'failure'}`}
              onClick={() => handleSelectRequest(
                requests.find(r => r._id === result.requestId || r.id === result.requestId)
              )}
            >
              <div className="result-icon">
                {result.success ? <FiCheckCircle /> : <FiAlertCircle />}
              </div>
              <div className="result-info">
                <div className="result-name">{result.name}</div>
                <div className="result-status">
                  Status: {result.status}
                  {result.duration ? ` | ${result.duration}ms` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="collection-loading">
        <div className="spinner"></div>
        <p>Loading collection...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="collection-error">
        <h3>Error</h3>
        <p>{error}</p>
        <button onClick={() => navigate('/collections')}>Go Back to Collections</button>
      </div>
    );
  }

  return (
    <div className="collection-detail">
      <div className="collection-header">
        <div className="collection-title">
          <h2>{collection?.name || 'Unnamed Collection'}</h2>
          <div className="collaboration-wrapper">
            <ActiveCollaborators collectionId={collectionId} />
          </div>
        </div>
        <div className="collection-actions">
          <button
            className={`action-btn ${isSaving ? 'disabled' : ''} ${pendingChanges ? 'highlight' : ''}`}
            onClick={saveCollection}
            disabled={isSaving}
          >
            <FiSave className="icon" /> {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button
            className={`action-btn ${isRunningAll ? 'disabled' : ''}`}
            onClick={runAllRequests}
            disabled={isRunningAll || requests.length === 0}
          >
            <FiPlay className="icon" /> {isRunningAll ? 'Running...' : 'Run All'}
          </button>
          <button className="action-btn" onClick={handleSettingsClick}>
            <FiSettings className="icon" /> Settings
          </button>
        </div>
      </div>

      <div className="collection-content">
        <div className="collection-sidebar">
          <h3>Requests</h3>
          <div className="requests-list">
            {requests.length === 0 ? (
              <div className="no-requests">No requests found</div>
            ) : (
              <ul>
                {requests.map(request => (
                  <li
                    key={request._id || request.id}
                    className={`request-item ${selectedRequest && (selectedRequest._id === request._id || selectedRequest.id === request.id) ? 'active' : ''}`}
                    onClick={() => handleSelectRequest(request)}
                  >
                    <span className={`method-badge ${request.method.toLowerCase()}`}>
                      {request.method}
                    </span>
                    <span className="request-name">{request.name}</span>
                    <button
                      className="delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRequest(request._id || request.id);
                      }}
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="add-request">
            <button className="add-request-btn" onClick={handleAddRequest}>
              <i className="fas fa-plus"></i> Add Request
            </button>
          </div>
        </div>

        <div className="collection-main">
          {!selectedRequest && !showRequestForm ? (
            <div className="collection-info">
              <h3>Collection Details</h3>
              <div className="collection-description">
                {collection?.description || 'No description provided.'}
              </div>
              <div className="collection-meta">
                <div className="meta-item">
                  <strong>Created by:</strong> {collection?.owner ? collection.owner : 'Unknown'}
                </div>
                <div className="meta-item">
                  <strong>Created on:</strong> {collection?.createdAt ? new Date(collection.createdAt).toLocaleDateString() : 'Unknown'}
                </div>
                <div className="meta-item">
                  <strong>Last modified:</strong> {collection?.updatedAt ? new Date(collection.updatedAt).toLocaleDateString() : 'Unknown'}
                </div>
                <div className="meta-item">
                  <strong>Requests:</strong> {requests.length}
                </div>
                <div className="meta-item">
                  <strong>Visibility:</strong> {collection?.isPublic ? 'Public' : 'Private'}
                </div>
                <div className="meta-item">
                  <strong>Active Collaborators:</strong> <div className="collaborator-count">{getActiveUsers(collectionId).length}</div>
                </div>
              </div>

              <div className="real-time-info">
                <h4>Real-time Collaboration</h4>
                <p>This collection supports real-time collaboration. You can work together with your team members simultaneously.</p>
                <button className="primary-button" onClick={handleAddRequest}>Create Your First Request</button>
              </div>
            </div>
          ) : (
            showRequestForm && selectedRequest && (
              <div className="request-workspace">
                <RequestForm
                  request={selectedRequest}
                  onSave={handleSaveRequest}
                  onRunRequest={(requestId) => {
                    sendActivity('request_sent', {
                      requestId,
                      requestName: selectedRequest.name,
                      collectionName: collection.name
                    });
                  }}
                />
                <ResponseDisplay requestId={selectedRequest._id || selectedRequest.id} />
              </div>
            )
          )}
          {renderRunAllResults()}
        </div>
      </div>
      {renderSettingsModal()}
    </div>
  );
}

export default CollectionDetail;