// client/src/components/CollectionDetail.js
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import './CollectionDetail.css';
import ActiveCollaborators from './ActiveCollaborators';
import RequestForm from './RequestForm';
import ResponseDisplay from './ResponseDisplay';
import SampleDataManager from './SampleDataManager';
import DocumentationViewer from './DocumentationViewer';
import EnvironmentSelector from './EnvironmentSelector';
import CollectionVariablesManager from './CollectionVariablesManager';
import { useCollaboration } from '../context/CollaborationContext';
import {
  FiSave, FiSettings, FiPlay, FiAlertCircle, FiCheckCircle, FiBook, FiEdit,
  FiPlus, FiTrash2, FiDatabase, FiGlobe, FiLock, FiUsers, FiPackage,
  FiFileText
} from 'react-icons/fi';
import { toast } from 'react-toastify'; // Import toast notification library

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
  const [activeTab, setActiveTab] = useState('requests'); const [documentation, setDocumentation] = useState(null);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false); const [saveSuccess, setSaveSuccess] = useState(false);
  const [responseData, setResponseData] = useState(null);
  const [selectedEnvironment, setSelectedEnvironment] = useState(() => {
    // Restore selected environment from localStorage
    const storageKey = `selectedEnvironment_${collectionId}`;
    const stored = localStorage.getItem(storageKey);
    return stored || null;
  });

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
      const response = await fetch(`/api/collections/${collectionId}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch collection');
      }

      const data = await response.json();
      setCollection(data);
      setRequests(data.requests || []);

      // Select the first request by default if available
      if (data.requests && data.requests.length > 0 && !selectedRequest) {
        setSelectedRequest(data.requests[0]);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching collection:', err);
      setError('Failed to load collection. Please try again later.');
      setLoading(false);
    }
  }, [collectionId, selectedRequest]);

  // Fetch documentation data when the documentation tab is selected
  const fetchDocumentation = useCallback(async () => {
    if (activeTab !== 'documentation') return;

    try {
      setIsLoadingDocs(true);

      const response = await fetch(`/api/collections/${collectionId}/documentation`, {
        credentials: 'include'
      });

      if (!response.ok && response.status !== 404) {
        throw new Error('Failed to fetch documentation');
      }

      if (response.ok) {
        const data = await response.json();
        setDocumentation(data);
      } else {
        // No documentation exists yet
        setDocumentation(null);
      }
    } catch (err) {
      console.error('Error fetching documentation:', err);
      // Don't set error state, just log it
    } finally {
      setIsLoadingDocs(false);
    }
  }, [collectionId, activeTab]);

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

  // Fetch documentation when the documentation tab is selected
  useEffect(() => {
    fetchDocumentation();
  }, [fetchDocumentation]);

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

      const response = await fetch(`/api/collections/${collectionId}`, {
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

      // Show success indicator briefly
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);

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

          const response = await fetch(`/api/requests/${requestId}/send`, {
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

    // First clear any existing response data to avoid showing old responses
    setResponseData(null);

    // Set the new request as selected and ensure the form is shown
    setSelectedRequest(newRequest);
    setShowRequestForm(true);

    // Make sure we're on the requests tab
    setActiveTab('requests');

    // Log for debugging
    console.log('New request created:', newRequest);
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

      const response = await fetch(`/api/collections/${collectionId}`, {
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

  // Send a request and get the response
  const handleSendRequest = async (request) => {
    try {
      // For client-side testing, create a fallback ID if _id is missing
      const requestId = request._id || request.id;

      // Set a flag to indicate that a request has been sent
      sessionStorage.setItem(`request_${requestId}_sent`, 'true');

      const response = await fetch(`/api/requests/${requestId}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        // Include ALL request data in body, not just minimal information
        body: JSON.stringify({
          method: request.method,
          url: request.url,
          headers: request.headers || [],
          params: request.params || [],
          body: request.body || '',
          bodyType: request.bodyType || 'none',
          preRequestScript: request.preRequestScript || '',
          testScript: request.testScript || '',
          collectionId: collection._id
        })
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const responseData = await response.json();

      // Process response data to ensure all required fields are present
      const processedResponseData = {
        ...responseData,
        status: responseData.status || response.status,
        statusText: responseData.statusText || response.statusText,
        headers: responseData.headers || {},
        body: responseData.body || null,
        size: responseData.size || (responseData.body ? JSON.stringify(responseData.body).length : 0),
        duration: responseData.duration || 0,
        testResults: responseData.testResults || []
      };

      // Save the processed response data to state
      setResponseData(processedResponseData);

      // Send activity notification about the request being sent
      sendActivity('request_sent', {
        requestId: requestId,
        requestName: request.name,
        collectionName: collection.name
      });

      return processedResponseData;
    } catch (err) {
      console.error('Failed to send request:', err);
      toast.error(`Failed to send request: ${err.message}`);
      throw err;
    }
  };

  // Collection settings modal
  const renderSettingsModal = () => {
    if (!showSettings) return null;

    return (
      <div className="modal-overlay">
        <div className="settings-modal">
          <h3><FiSettings className="modal-icon" /> Collection Settings</h3>

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
                placeholder="Enter collection name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                defaultValue={collection.description || ''}
                rows="4"
                placeholder="Describe your collection"
              />
            </div>

            <div className="form-group">
              <label>Visibility</label>
              <div className="visibility-selector">
                <div
                  className={`visibility-option ${!collection.isPublic ? 'selected' : ''}`}
                  onClick={(e) => {
                    // Update all radio buttons
                    const radioButtons = e.currentTarget.closest('.visibility-selector').querySelectorAll('input[type="radio"]');
                    radioButtons.forEach(radio => radio.checked = false);

                    // Check the current one
                    const currentRadio = e.currentTarget.querySelector('input[type="radio"]');
                    if (currentRadio) currentRadio.checked = true;

                    // Update visual selection
                    const allOptions = e.currentTarget.closest('.visibility-selector').querySelectorAll('.visibility-option');
                    allOptions.forEach(option => option.classList.remove('selected'));
                    e.currentTarget.classList.add('selected');
                  }}
                >
                  <input
                    type="radio"
                    name="isPublic"
                    value="false"
                    defaultChecked={!collection.isPublic}
                    style={{ display: 'none' }}
                  />
                  <div className="visibility-icon">🔒</div>
                  <div>
                    <strong>Private</strong>
                    <p>Only you and your collaborators can access this collection</p>
                  </div>
                </div>
                <div
                  className={`visibility-option ${collection.isPublic ? 'selected' : ''}`}
                  onClick={(e) => {
                    // Update all radio buttons
                    const radioButtons = e.currentTarget.closest('.visibility-selector').querySelectorAll('input[type="radio"]');
                    radioButtons.forEach(radio => radio.checked = false);

                    // Check the current one
                    const currentRadio = e.currentTarget.querySelector('input[type="radio"]');
                    if (currentRadio) currentRadio.checked = true;

                    // Update visual selection
                    const allOptions = e.currentTarget.closest('.visibility-selector').querySelectorAll('.visibility-option');
                    allOptions.forEach(option => option.classList.remove('selected'));
                    e.currentTarget.classList.add('selected');
                  }}
                >
                  <input
                    type="radio"
                    name="isPublic"
                    value="true"
                    defaultChecked={collection.isPublic}
                    style={{ display: 'none' }}
                  />
                  <div className="visibility-icon">🌐</div>
                  <div>
                    <strong>Public</strong>
                    <p>This collection is publicly accessible to anyone with the link</p>
                  </div>
                </div>
              </div>
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
        <h3><FiAlertCircle className="error-icon" /> Error</h3>
        <p>{error}</p>
        <button onClick={() => navigate('/collections')}>Go Back to Collections</button>
      </div>
    );
  }

  const activeUsers = getActiveUsers(collectionId);

  return (
    <div className="collection-detail">
      <div className="collection-header">        <div className="collection-title">
        <div className="title-icon">
          <FiPackage />
        </div>
        <h2>{collection?.name || 'Unnamed Collection'}</h2>
        <div className="collection-visibility">
          {collection?.isPublic ?
            <span className="visibility-badge public"><FiGlobe /> Public</span> :
            <span className="visibility-badge private"><FiLock /> Private</span>
          }
        </div>        <div className="environment-selector-wrapper">
          <EnvironmentSelector
            selectedEnvironmentId={selectedEnvironment}
            workspaceId={collection?.workspaceId}
            collectionId={collectionId} onEnvironmentChange={(environmentId) => {
              // Store selected environment ID for request execution
              setSelectedEnvironment(environmentId);

              // Persist selection to localStorage
              const storageKey = `selectedEnvironment_${collectionId}`;
              if (environmentId) {
                localStorage.setItem(storageKey, environmentId);
              } else {
                localStorage.removeItem(storageKey);
              }
            }}
          />
        </div>
        <div className="collaboration-wrapper">
          <ActiveCollaborators collectionId={collectionId} />
        </div>
      </div>
        <div className="collection-actions">
          {pendingChanges && (
            <div className="pending-changes-indicator">Unsaved changes</div>
          )}
          <button
            className={`action-btn ${isSaving ? 'disabled' : ''} ${pendingChanges ? 'highlight' : ''} ${saveSuccess ? 'success' : ''}`}
            onClick={saveCollection}
            disabled={isSaving || !pendingChanges}
          >
            {saveSuccess ? <FiCheckCircle className="icon" /> : <FiSave className="icon" />}
            {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save'}
          </button>
          <button
            className={`action-btn ${isRunningAll ? 'disabled' : ''}`}
            onClick={runAllRequests}
            disabled={isRunningAll || requests.length === 0}
          >
            <FiPlay className="icon" /> {isRunningAll ? 'Running...' : 'Run All'}
          </button>          <button className="action-btn" onClick={handleSettingsClick}>
            <FiSettings className="icon" /> Settings
          </button>
        </div>
      </div>

      <div className="collection-content">
        <div className="collection-sidebar">
          <h3 data-count={requests.length}>Requests</h3>
          <div className="requests-list">
            {requests.length === 0 ? (
              <div className="no-requests">
                <FiPackage className="no-content-icon" />
                <p>No requests found</p>
                <small>Click "Add Request" below to create your first API request</small>
              </div>
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
                    <div className="request-info">
                      <span className="request-name">{request.name}</span>
                      <small className="request-url">{request.url ? new URL(request.url).pathname : '/'}</small>
                    </div>
                    <button
                      className="delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRequest(request._id || request.id);
                      }}
                      title="Delete request"
                    >
                      <FiTrash2 />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="add-request">
            <button className="add-request-btn" onClick={handleAddRequest}>
              <FiPlus className="icon" /> Add Request
            </button>
          </div>
        </div>

        <div className="collection-main">
          <div className="tab-navigation">
            <button
              className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
              onClick={() => setActiveTab('requests')}
            >
              <FiPackage /> Requests
            </button>
            <button
              className={`tab-btn ${activeTab === 'documentation' ? 'active' : ''}`}
              onClick={() => setActiveTab('documentation')}
            >
              <FiBook /> Documentation
            </button>            <button
              className={`tab-btn ${activeTab === 'sampleData' ? 'active' : ''}`}
              onClick={() => setActiveTab('sampleData')}
            >
              <FiDatabase /> Sample Data
            </button>
            <button
              className={`tab-btn ${activeTab === 'variables' ? 'active' : ''}`}
              onClick={() => setActiveTab('variables')}
            >
              <FiSettings /> Variables
            </button>
          </div>

          {activeTab === 'requests' && (
            <>
              {!selectedRequest && !showRequestForm ? (
                <div className="collection-info">
                  <h2>Collection Details</h2>
                  <div className="collection-description">
                    {collection?.description || 'No description provided.'}
                  </div>
                  <div className="collection-meta-grid">
                    <div className="meta-item">
                      <label>CREATED BY</label>
                      <div className="meta-value">{collection?.owner ? collection.owner : collection?.createdBy || 'Unknown'}</div>
                    </div>
                    <div className="meta-item">
                      <label>CREATED ON</label>
                      <div className="meta-value">{collection?.createdAt ? new Date(collection.createdAt).toLocaleDateString() : 'Unknown'}</div>
                    </div>
                    <div className="meta-item">
                      <label>LAST MODIFIED</label>
                      <div className="meta-value">{collection?.updatedAt ? new Date(collection.updatedAt).toLocaleDateString() : 'Unknown'}</div>
                    </div>
                    <div className="meta-item">
                      <label>REQUESTS</label>
                      <div className="meta-value">{requests.length}</div>
                    </div>
                    <div className="meta-item">
                      <label>VISIBILITY</label>
                      <div className="meta-value">{collection?.isPublic ? 'Public' : 'Private'}</div>
                    </div>
                    <div className="meta-item">
                      <label>ACTIVE COLLABORATORS</label>
                      <div className="collaborator-count">{activeUsers.length}</div>
                    </div>
                  </div>

                  <div className="real-time-info">
                    <h4><FiUsers className="info-icon" /> Real-time Collaboration</h4>
                    <p>This collection supports real-time collaboration. You can work together with your team members simultaneously.</p>
                    {requests.length === 0 && (
                      <button className="primary-button" onClick={handleAddRequest}>
                        <FiPlus className="icon" /> Create Your First Request
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                showRequestForm && selectedRequest && (
                  <div className="request-workspace">
                    <RequestForm
                      request={selectedRequest}
                      onSave={handleSaveRequest}
                      onSendRequest={handleSendRequest}
                      onRunRequest={(requestId) => {
                        sendActivity('request_sent', {
                          requestId,
                          requestName: selectedRequest.name,
                          collectionName: collection.name
                        });
                      }}
                    />
                    {/* Pass responseData to ResponseDisplay */}
                    <ResponseDisplay
                      requestId={selectedRequest._id || selectedRequest.id}
                      responseData={responseData}
                    />
                  </div>
                )
              )}
              {renderRunAllResults()}
            </>
          )}

          {activeTab === 'documentation' && (
            <div className="documentation-tab-content">
              {isLoadingDocs ? (
                <div className="documentation-loading">
                  <div className="spinner"></div>
                  <p>Loading documentation...</p>
                </div>
              ) : documentation ? (
                <DocumentationViewer documentation={documentation} collection={collection} />
              ) : (
                <div className="documentation-placeholder">
                  <FiBook className="placeholder-icon" />
                  <h3>No Documentation Available</h3>
                  <p>This collection doesn't have any documentation yet.</p>
                  <div className="documentation-actions">
                    <Link to={`/workspace/collections/${collectionId}/documentation`} className="create-doc-link">
                      <FiEdit /> Create Documentation
                    </Link>
                    <button onClick={() => navigate(`/workspace/collections/${collectionId}/documentation/swagger`)} className="preview-swagger-btn">
                      <FiFileText /> Preview Swagger Documentation
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}          {activeTab === 'sampleData' && (
            <div className="sample-data-tab-content">
              <SampleDataManager collectionId={collectionId} />
            </div>
          )}          {activeTab === 'variables' && (
            <div className="variables-tab-content">
              <CollectionVariablesManager
                collectionId={collectionId}
                collectionName={collection?.name}
                workspaceId={collection?.workspaceId}
                selectedEnvironment={selectedEnvironment}
              />
            </div>
          )}
        </div>      </div>
      {renderSettingsModal()}
    </div>
  );
}

export default CollectionDetail;