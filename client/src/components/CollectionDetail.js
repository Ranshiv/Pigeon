// client/src/components/CollectionDetail.js
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import './CollectionDetail.css';
import ActiveCollaborators from './ActiveCollaborators';
import RequestForm from './RequestForm';
import SampleDataManager from './SampleDataManager';
import DocumentationViewer from './DocumentationViewer';
import EnvironmentSelector from './EnvironmentSelector';
import CollectionVariablesManager from './CollectionVariablesManager';
import VisualApiDesigner from './VisualApiDesigner/VisualApiDesigner';
import CollectionMcpServerPanel from './CollectionMcpServerPanel';
import EvaluationSuitePanel from './evaluation/EvaluationSuitePanel';
import FuzzTestingPanel from './FuzzTestingPanel';
import CollectionGitSyncPanel from './CollectionGitSyncPanel';
import { useCollaboration } from '../context/CollaborationContext';
import { useCopilotPageContext } from '../context/CopilotContext';
import {
  FiSettings, FiAlertCircle, FiCheckCircle, FiBook, FiEdit,
  FiPlus, FiTrash2, FiDatabase, FiGlobe, FiLock, FiUsers, FiPackage,
  FiFileText, FiInfo, FiGrid, FiFolder, FiChevronDown, FiChevronLeft, FiChevronRight,
  FiArrowLeft, FiRefreshCw, FiServer, FiTarget, FiGitBranch
} from 'react-icons/fi';
import { Sparkles } from 'lucide-react';
import { toast } from 'react-toastify'; // Import toast notification library

const folderPathKey = (path) => (Array.isArray(path) ? path : []).join('\u001f');

const buildRequestTree = (requests) => {
  const root = { folders: new Map(), requests: [] };
  requests.forEach((request) => {
    let branch = root;
    (request.folderPath || []).forEach((folderName) => {
      if (!branch.folders.has(folderName)) {
        branch.folders.set(folderName, { name: folderName, path: [...(branch.path || []), folderName], folders: new Map(), requests: [] });
      }
      branch = branch.folders.get(folderName);
    });
    branch.requests.push(request);
  });

  const toNodes = (branch) => [
    ...Array.from(branch.folders.values()).map((folder) => ({
      type: 'folder',
      name: folder.name,
      path: folder.path,
      children: toNodes(folder)
    })),
    ...branch.requests.map((request) => ({ type: 'request', request }))
  ];
  return toNodes(root);
};

const requestPath = (request) => {
  try {
    return request.url ? new URL(request.url).pathname : '/';
  } catch {
    return request.url || '/';
  }
};

const ImportedRequestTree = ({ nodes, selectedRequest, selectedFolderPath, onRequestSelect, onFolderSelect, onDelete, depth = 0 }) => (
  <ul className={`request-tree depth-${depth}`}>
    {nodes.map((node) => {
      if (node.type === 'folder') {
        const selected = folderPathKey(node.path) === folderPathKey(selectedFolderPath);
        return (
          <li key={`folder-${folderPathKey(node.path)}`} className="request-folder">
            <button
              type="button"
              className={`folder-tree-item ${selected ? 'active' : ''}`}
              onClick={() => onFolderSelect(node.path)}
            >
              <FiChevronDown aria-hidden="true" />
              <FiFolder aria-hidden="true" />
              <span>{node.name}</span>
            </button>
            <ImportedRequestTree
              nodes={node.children}
              selectedRequest={selectedRequest}
              selectedFolderPath={selectedFolderPath}
              onRequestSelect={onRequestSelect}
              onFolderSelect={onFolderSelect}
              onDelete={onDelete}
              depth={depth + 1}
            />
          </li>
        );
      }

      const request = node.request;
      const requestId = request._id || request.id;
      const isSelected = selectedRequest && (selectedRequest._id === request._id || selectedRequest.id === request.id);
      return (
        <li
          key={requestId}
          className={`request-item ${isSelected ? 'active' : ''}`}
          onClick={() => onRequestSelect(request)}
        >
          <span className={`method-badge ${request.method.toLowerCase()}`}>{request.method}</span>
          <div className="request-info">
            <span className="request-name">{request.name}</span>
            <small className="request-url">{requestPath(request)}</small>
          </div>
          <button
            className="delete-btn"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(requestId);
            }}
            title="Delete request"
          >
            <FiTrash2 />
          </button>
        </li>
      );
    })}
  </ul>
);

const ImportedFolderOverview = ({ folder }) => (
  <div className="imported-folder-overview">
    <div className="imported-folder-overview-header">
      <FiFolder aria-hidden="true" />
      <div>
        <span>Imported Postman folder</span>
        <h2>{folder.path.join(' / ')}</h2>
      </div>
    </div>
    {folder.description ? <p className="imported-folder-description">{folder.description}</p> : <p className="imported-folder-description muted">No folder description was provided in Postman.</p>}
    {(folder.preRequestScript || folder.testScript) && (
      <div className="imported-folder-scripts">
        <h3>Folder scripts</h3>
        {folder.preRequestScript && <><h4>Pre-request script</h4><pre>{folder.preRequestScript}</pre></>}
        {folder.testScript && <><h4>Test script</h4><pre>{folder.testScript}</pre></>}
      </div>
    )}
  </div>
);

const importedScriptMarkdown = (title, script) => script
  ? `#### ${title}\n\n\`\`\`javascript\n${script.replace(/\`\`\`/g, '\\\`\\\`\\\`')}\n\`\`\``
  : '';

const buildImportedDocumentationFallback = (collection, requests) => {
  if (collection?.metadata?.importSource !== 'postman' || !collection.description) return null;
  const folders = (collection.metadata.folderTree || []).map((folder) => [
    `### ${folder.path.join(' / ')}`,
    folder.description || 'No folder description provided.',
    importedScriptMarkdown('Folder pre-request script', folder.preRequestScript),
    importedScriptMarkdown('Folder test script', folder.testScript)
  ].filter(Boolean).join('\n\n'));
  const requestSections = requests.map((request) => [
    `### ${request.name}`,
    `- **${request.method}** \`${request.url}\``,
    request.description,
    importedScriptMarkdown('Pre-request script', request.preRequestScript),
    importedScriptMarkdown('Test script', request.testScript || request.tests),
    request.metadata?.savedExamples?.length
      ? `_Saved response examples: ${request.metadata.savedExamples.length}_`
      : ''
  ].filter(Boolean).join('\n\n'));
  return {
    title: `${collection.name} Documentation`,
    content: [`# ${collection.name}`, collection.description, folders.length ? `## Folders\n\n${folders.join('\n\n')}` : '', requestSections.length ? `## Requests\n\n${requestSections.join('\n\n')}` : ''].filter(Boolean).join('\n\n'),
    importedFrom: 'postman'
  };
};

function CollectionDetail() {
  const { collectionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
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
  // The open tab lives in the URL so refreshes, deep links, and anything that
  // reads the route (Copilot page context) all see the same page identity.
  const activeTab = useMemo(() => {
    const tab = new URLSearchParams(location.search).get('tab');
    return ['requests', 'documentation', 'sampleData', 'variables', 'designer', 'mcp-server', 'evaluation', 'fuzz-testing', 'git-sync'].includes(tab) ? tab : 'requests';
  }, [location.search]);
  const requestedId = useMemo(() => new URLSearchParams(location.search).get('request') || '', [location.search]);
  const setActiveTab = useCallback((tab) => {
    const params = new URLSearchParams(location.search);
    if (tab === 'requests') params.delete('tab'); else params.set('tab', tab);
    navigate({ search: params.toString() }, { replace: true });
  }, [location.search, navigate]);
  const [documentation, setDocumentation] = useState(null);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false); const [saveSuccess, setSaveSuccess] = useState(false); const [responseData, setResponseData] = useState(null);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState(() => {
    // Restore selected environment from localStorage
    const storageKey = `selectedEnvironment_${collectionId}`;
    const stored = localStorage.getItem(storageKey);
    return stored || null;
  });
  const [selectedEnvironment, setSelectedEnvironment] = useState(null);
  const [requestSidebarCollapsed, setRequestSidebarCollapsed] = useState(false);
  const [selectedFolderPath, setSelectedFolderPath] = useState(null);

  // The selected request only describes the page while the requests tab is open.
  // Every other tab is about the collection, and the tabs that render their own
  // Copilot context (fuzz testing, agent evaluation) register it themselves.
  const copilotTabLabels = {
    documentation: 'documentation',
    sampleData: 'sample data',
    variables: 'variables',
    designer: 'API designer',
    'mcp-server': 'MCP server',
    'git-sync': 'Git sync'
  };
  const onRequestsTab = activeTab === 'requests';
  const tabOwnsContext = ['fuzz-testing', 'evaluation'].includes(activeTab);
  const activeRequestId = onRequestsTab && selectedRequest ? String(selectedRequest._id || selectedRequest.id || '') : '';
  useCopilotPageContext(tabOwnsContext ? null : {
    type: activeRequestId ? 'request' : 'collection',
    id: activeRequestId || collectionId,
    parentId: activeRequestId ? collectionId : undefined,
    workspaceId: collection?.workspaceId ? String(collection.workspaceId) : '',
    label: activeRequestId
      ? `${selectedRequest.method || 'GET'} ${selectedRequest.name || 'request'}`
      : [collection?.name || 'Collection', copilotTabLabels[activeTab]].filter(Boolean).join(' ')
  });

  // Add keyboard shortcut for toggling the requests sidebar
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Alt + Q to toggle requests sidebar
      if (e.altKey && e.key === 'q') {
        setRequestSidebarCollapsed(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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

  // Helper function to get owner display name
  const getOwnerDisplayName = (collection) => {
    if (!collection) return 'Unknown';

    // If owner is an object (populated), use displayName
    if (collection.owner && typeof collection.owner === 'object' && collection.owner.displayName) {
      return collection.owner.displayName;
    }

    // If owner is a string (user ID), check if it's the current user
    if (collection.owner && typeof collection.owner === 'string') {
      // If it matches current user ID, show current user's name
      // Note: We would need user context for this, for now return a fallback
      return 'Collection Owner';
    }

    // Fallback for createdBy field
    if (collection.createdBy && typeof collection.createdBy === 'object' && collection.createdBy.displayName) {
      return collection.createdBy.displayName;
    }

    if (collection.createdBy && typeof collection.createdBy === 'string') {
      return 'Collection Creator';
    }

    return 'Unknown User';
  };

  // Fetch collection data
  const fetchCollection = useCallback(async () => {
    try {
      setError(null);
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

      // Select the first request when this is a different collection than the
      // current selection belongs to. `prev || data.requests[0]` alone kept the
      // previous collection's request selected after navigating between collections.
      if (data.requests && data.requests.length > 0) {
        setSelectedRequest((prev) => {
          const requested = requestedId && data.requests.find(r => String(r._id || r.id) === requestedId);
          if (requested) return requested;
          const stillInCollection = prev && data.requests.some(r => r.id === prev.id);
          return stillInCollection ? prev : data.requests[0];
        });
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching collection:', err);
      setError('Failed to load collection. Please try again later.');
      setLoading(false);
    }
    // Depends on `requestedId` only, not the whole query string: the open tab
    // also lives in the URL now, and switching tabs must not refetch.
  }, [collectionId, requestedId]);

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

  useEffect(() => {
    const refreshCopilotDocumentation = (event) => {
      if (String(event.detail?.collectionId || '') === String(collectionId)) fetchDocumentation();
    };
    window.addEventListener('pigeon:documentation-updated', refreshCopilotDocumentation);
    return () => window.removeEventListener('pigeon:documentation-updated', refreshCopilotDocumentation);
  }, [collectionId, fetchDocumentation]);

  // When selectedEnvironmentId changes, fetch the full environment object if needed
  useEffect(() => {
    async function fetchSelectedEnvironment() {
      if (selectedEnvironmentId) {
        try {
          const response = await fetch(`/api/environments/${selectedEnvironmentId}`, {
            credentials: 'include'
          });
          if (response.ok) {
            const env = await response.json();
            setSelectedEnvironment(env);
          } else {
            setSelectedEnvironment(null);
          }
        } catch (err) {
          setSelectedEnvironment(null);
        }
      } else {
        setSelectedEnvironment(null);
      }
    }
    fetchSelectedEnvironment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEnvironmentId]);

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
    setSelectedFolderPath(null);
    setSelectedRequest(request);
    setShowRequestForm(true);
  };

  const handleSelectFolder = (folderPath) => {
    setSelectedFolderPath(folderPath);
    setSelectedRequest(null);
    setShowRequestForm(false);
    setResponseData(null);
  };

  // Handle adding a new request
  const handleAddRequest = () => {
    setSelectedFolderPath(null);
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
  const handleSaveRequest = async (request) => {
    try {
      const requestId = request._id || request.id;
      const existingIndex = requests.findIndex(
        (req) => String(req._id || req.id) === String(requestId)
      );

      const normalizedRequest = {
        ...request,
        _id: request._id || request.id || `req-${Date.now()}`,
        isNew: false
      };
      const updatedRequests = request.isNew || existingIndex === -1
        ? [...requests, normalizedRequest]
        : requests.map((current, index) => index === existingIndex ? { ...current, ...normalizedRequest } : current);

      const response = await fetch(`/api/collections/${collectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ requests: updatedRequests })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || 'Could not save this request to the collection.');
      }

      const savedCollection = await response.json();
      const savedRequests = savedCollection.requests || updatedRequests;
      const savedRequest = savedRequests.find((item) => String(item._id || item.id) === String(normalizedRequest._id || normalizedRequest.id)) || normalizedRequest;
      setCollection(savedCollection);
      setRequests(savedRequests);
      setSelectedRequest({ ...savedRequest, id: request.id || savedRequest.id || normalizedRequest._id, isNew: false });
      setPendingChanges(false);
      toast.success('Request saved to the collection.');

      // Broadcast the change to other collaborators
      sendActivity('request_updated', {
        requestName: request.name,
        requestMethod: request.method,
        collectionName: collection.name
      });

    } catch (err) {
      console.error('Error saving request:', err);
      toast.error(err.message || 'Failed to save request. Please try again.');
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
      // Requests in this view live in the collection document. Persist the
      // current form state before sending so a newly sent request appears in
      // the sidebar immediately and remains there after a refresh.
      const requestId = request._id || request.id || `req-${Date.now()}`;
      const requestToSave = {
        ...request,
        _id: requestId,
        id: request.id || requestId,
        isNew: false
      };
      const existingIndex = requests.findIndex(
        (item) => (item._id || item.id) === requestId
      );
      const updatedRequests = existingIndex === -1
        ? [...requests, requestToSave]
        : requests.map((item, index) => index === existingIndex ? requestToSave : item);

      const saveResponse = await fetch(`/api/collections/${collectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ requests: updatedRequests })
      });

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to save the request to this collection');
      }

      const savedCollection = await saveResponse.json();
      const persistedRequests = savedCollection.requests || updatedRequests;
      const savedRequest = persistedRequests.find(
        (item) => (item._id || item.id) === requestId
      ) || requestToSave;
      // Keep the temporary client id as a stable form identity even if the
      // database assigns an embedded-document _id during the first save.
      const persistedRequest = {
        ...savedRequest,
        id: request.id || savedRequest.id || requestId,
        isNew: false
      };

      setCollection(savedCollection);
      setRequests(persistedRequests);
      setSelectedRequest(persistedRequest);
      setPendingChanges(false);

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
          method: persistedRequest.method,
          url: persistedRequest.url,
          headers: persistedRequest.headers || [],
          params: persistedRequest.params || [],
          body: persistedRequest.body || '',
          bodyType: persistedRequest.bodyType || 'none',
          bodyFormData: persistedRequest.bodyFormData || [],
          protocol: persistedRequest.protocol || 'http',
          graphql: persistedRequest.graphql || {},
          preRequestScript: persistedRequest.preRequestScript || '',
          testScript: persistedRequest.testScript || '',
          authConfig: persistedRequest.authConfig || { type: 'No Auth' },
          sslConfig: persistedRequest.sslConfig || {},
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
        requestName: persistedRequest.name,
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
                  <div className="visibility-icon private-icon"><FiLock /></div>
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
                  <div className="visibility-icon public-icon"><FiGlobe /></div>
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

  const routeWorkspaceId = location.state?.workspaceId;
  const collectionWorkspaceId = collection?.workspaceId?._id || collection?.workspaceId;
  const workspaceId = routeWorkspaceId || collectionWorkspaceId;
  const collectionsReturnPath = location.state?.returnTo || (workspaceId
    ? `/workspace/workspaces/${workspaceId}?tab=collections`
    : '/workspace/workspaces');
  const collectionRouteState = workspaceId
    ? { workspaceId, returnTo: collectionsReturnPath }
    : location.state;

  if (error) {
    return (
      <div className="collection-error">
        <section className="collection-error-panel" role="alert" aria-live="assertive">
          <div className="collection-error-icon" aria-hidden="true">
            <FiAlertCircle />
          </div>
          <div className="collection-error-copy">
            <span className="collection-error-label">Collection unavailable</span>
            <h1>Unable to load this collection</h1>
            <p>{error}</p>
          </div>
          <div className="collection-error-actions">
            <button
              type="button"
              className="collection-error-btn primary"
              onClick={fetchCollection}
            >
              <FiRefreshCw aria-hidden="true" />
              Try Again
            </button>
            <button
              type="button"
              className="collection-error-btn secondary"
              onClick={() => navigate(collectionsReturnPath)}
            >
              <FiArrowLeft aria-hidden="true" />
              Back to Collections
            </button>
          </div>
        </section>
      </div>
    );
  }

  const activeUsers = getActiveUsers(collectionId);
  const requestTree = buildRequestTree(requests);
  const importedFolders = collection?.metadata?.folderTree || [];
  const selectedFolder = selectedFolderPath
    ? importedFolders.find((folder) => folderPathKey(folder.path) === folderPathKey(selectedFolderPath))
    : null;
  // Collections imported before documentation records were created still have
  // their source description and folder metadata. Render that data immediately
  // instead of making the user re-import a collection just to read it.
  const documentationToDisplay = documentation || buildImportedDocumentationFallback(collection, requests);

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
            selectedEnvironmentId={selectedEnvironmentId}
            workspaceId={collection?.workspaceId}
            collectionId={collectionId}
            onEnvironmentChange={(environmentObj) => {
              // environmentObj is either the full environment object or null
              setSelectedEnvironment(environmentObj);
              setSelectedEnvironmentId(environmentObj ? environmentObj._id : null);
              // Persist selection to localStorage
              const storageKey = `selectedEnvironment_${collectionId}`;
              if (environmentObj && environmentObj._id) {
                localStorage.setItem(storageKey, environmentObj._id);
              } else {
                localStorage.removeItem(storageKey);
              }
            }}
          />
        </div>
        <div className="collaboration-wrapper">
          <ActiveCollaborators collectionId={collectionId} />
        </div>
        <button
          type="button"
          className="tab-btn"
          onClick={() => window.dispatchEvent(new CustomEvent('pigeon:copilot-context', { detail: { collectionId, workspaceId: collection?.workspaceId, label: collection?.name } }))}
          title="Ask Copilot about this collection"
        >
          <Sparkles /> Ask Copilot
        </button>
      </div>
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
          </button>
          <button
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
          <button
            className={`tab-btn ${activeTab === 'designer' ? 'active' : ''}`}
            onClick={() => setActiveTab('designer')}
          >
            <FiGrid /> API Designer
          </button>
          <button
            className={`tab-btn ${activeTab === 'mcp-server' ? 'active' : ''}`}
            onClick={() => setActiveTab('mcp-server')}
          >
            <FiServer /> MCP Server
          </button>
          <button
            className={`tab-btn ${activeTab === 'evaluation' ? 'active' : ''}`}
            onClick={() => setActiveTab('evaluation')}
          >
            <FiTarget /> Agent Evaluation
          </button>
          <button
            className={`tab-btn ${activeTab === 'fuzz-testing' ? 'active' : ''}`}
            onClick={() => setActiveTab('fuzz-testing')}
          >
            <FiTarget /> Fuzz Testing
          </button>
          <button
            className={`tab-btn ${activeTab === 'git-sync' ? 'active' : ''}`}
            onClick={() => setActiveTab('git-sync')}
          >
            <FiGitBranch /> Git Sync
          </button>
        </div>
        <div className="collection-actions">
          {activeTab === 'requests' && (
            <button className="action-btn new-request-header-btn" onClick={handleAddRequest}>
              <FiPlus className="icon" /> New Request
            </button>
          )}
          <button className="action-btn" onClick={handleSettingsClick}>
            <FiSettings className="icon" /> Settings
          </button>
        </div>
      </div>

      <div className="collection-content">
        <div className={`collection-sidebar ${requestSidebarCollapsed ? 'collapsed' : ''}`}>
          {/* Toggle button for sidebar collapse/expand */}
          <div
            className="sidebar-toggle"
            onClick={() => setRequestSidebarCollapsed(!requestSidebarCollapsed)}
            title={requestSidebarCollapsed ? "Expand Requests (Alt+Q)" : "Collapse Requests (Alt+Q)"}
            aria-label={requestSidebarCollapsed ? "Expand Requests" : "Collapse Requests"}
          >
            {requestSidebarCollapsed ? <FiChevronRight size={14} /> : <FiChevronLeft size={14} />}
          </div>

          {!requestSidebarCollapsed && <h3 data-count={requests.length}>Requests</h3>}
          {requestSidebarCollapsed && (
            <div className="sidebar-label vertical-text">
              REQUESTS
            </div>
          )}

          {!requestSidebarCollapsed && (
            <div className="requests-list">
              {requests.length === 0 ? (
                <div className="no-requests">
                  <FiPackage className="no-content-icon" />
                  <p>No requests found</p>
                  <small>Click "Add Request" below to create your first API request</small>
                </div>
              ) : (
                <ImportedRequestTree
                  nodes={requestTree}
                  selectedRequest={selectedRequest}
                  selectedFolderPath={selectedFolderPath}
                  onRequestSelect={handleSelectRequest}
                  onFolderSelect={handleSelectFolder}
                  onDelete={handleDeleteRequest}
                />
              )}
            </div>
          )}

          <div className="add-request">
            <button
              className="add-request-btn"
              onClick={handleAddRequest}
            >
              <FiPlus className="icon" />
              {!requestSidebarCollapsed && 'Add Request'}
            </button>
          </div>
        </div>

        <div className="collection-main">
          {activeTab === 'requests' && (
            <>
              {selectedFolder ? (
                <ImportedFolderOverview folder={selectedFolder} />
              ) : (!selectedRequest || !showRequestForm) ? (<div className={`collection-info ${requests.length ? 'requests-welcome' : ''}`}>
                <h2>{requests.length ? 'Choose a request to begin' : 'Collection Details'}</h2>

                <div className="collection-overview-card">
                  <div className="collection-description">
                    {requests.length
                      ? 'Select a request from the left panel to edit and send it, or create a new request to add an endpoint to this collection.'
                      : (collection?.description || 'No description provided.')}
                  </div>
                  {requests.length > 0 && (
                    <button className="primary-button" onClick={handleAddRequest}>
                      <FiPlus className="icon" /> Create New Request
                    </button>
                  )}
                </div>

                {requests.length === 0 && <div className="collection-metadata-section">
                  <div className="metadata-header">
                    <FiInfo className="metadata-icon" />
                    <h3 className="metadata-title">Collection Information</h3>
                  </div>
                  <div className="collection-meta-grid">                    <div className="meta-item">
                    <label>Created By</label>
                    <div className="meta-value">{getOwnerDisplayName(collection)}</div>
                  </div>
                    <div className="meta-item">
                      <label>Created On</label>
                      <div className="meta-value">{collection?.createdAt ? new Date(collection.createdAt).toLocaleDateString() : 'Unknown'}</div>
                    </div>
                    <div className="meta-item">
                      <label>Last Modified</label>
                      <div className="meta-value">{collection?.updatedAt ? new Date(collection.updatedAt).toLocaleDateString() : 'Unknown'}</div>
                    </div>
                    <div className="meta-item">
                      <label>Total Requests</label>
                      <div className="meta-value">{requests.length}</div>
                    </div>
                    <div className="meta-item">
                      <label>Visibility</label>
                      <div className="meta-value">{collection?.isPublic ? 'Public' : 'Private'}</div>
                    </div>
                    <div className="meta-item">
                      <label>Active Collaborators</label>
                      <div className="collaborator-count">{activeUsers.length}</div>
                    </div>
                  </div>
                </div>}

                {requests.length === 0 && <div className="real-time-info">
                  <h4><FiUsers className="info-icon" /> Real-time Collaboration</h4>
                  <p>This collection supports real-time collaboration. You can work together with your team members simultaneously.</p>
                  {requests.length === 0 && (
                    <button className="primary-button" onClick={handleAddRequest}>
                      <FiPlus className="icon" /> Create Your First Request
                    </button>
                  )}
                </div>}
              </div>
              ) : (
                showRequestForm && selectedRequest && (
                  <div className="request-workspace">
                    <RequestForm
                      key={selectedRequest?.id || selectedRequest?._id || 'new-request'}
                      request={selectedRequest}
                      collection={collection}
                      collectionId={collectionId}
                      workspaceId={collection?.workspaceId}
                      environmentId={selectedEnvironmentId}
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
              ) : documentationToDisplay ? (
                <DocumentationViewer documentation={documentationToDisplay} collection={collection} />
              ) : (
                <div className="documentation-placeholder">
                  <FiBook className="placeholder-icon" />
                  <span className="documentation-placeholder-eyebrow">Collection documentation</span>
                  <h3>Start documenting your API</h3>
                  <p>Create documentation from this collection, or preview the generated Swagger documentation when you are ready to share it.</p>
                  <div className="documentation-actions">
                    <Link to={`/workspace/collections/${collectionId}/documentation`} state={collectionRouteState} className="create-doc-link">
                      <FiEdit /> Create Documentation
                    </Link>
                    <button onClick={() => navigate(`/workspace/collections/${collectionId}/documentation/swagger`, { state: collectionRouteState })} className="preview-swagger-btn">
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

          {activeTab === 'designer' && (
            <div className="designer-tab-content">
              <VisualApiDesigner
                collectionId={collectionId}
                requests={requests}
                onRequestsUpdate={setRequests}
                collection={collection}
                collaborationContext={{
                  sendActivity,
                  getActiveUsers,
                  joinCollection,
                  leaveCollection
                }}
              />
            </div>
          )}

          {activeTab === 'mcp-server' && (
            <CollectionMcpServerPanel collectionId={collectionId} />
          )}

          {activeTab === 'evaluation' && (
            <EvaluationSuitePanel collectionId={collectionId} workspaceId={collection?.workspaceId} />
          )}

          {activeTab === 'fuzz-testing' && (
            <FuzzTestingPanel
              requests={requests}
              collectionId={collectionId}
              workspaceId={collection?.workspaceId}
              selectedEnvironment={selectedEnvironment}
              collectionVariables={collection?.variables}
            />
          )}

          {activeTab === 'git-sync' && (
            <CollectionGitSyncPanel collectionId={collectionId} collectionName={collection?.name} />
          )}
        </div>      </div>
      {renderSettingsModal()}
    </div>
  );
}

export default CollectionDetail;
