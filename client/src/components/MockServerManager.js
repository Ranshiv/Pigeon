// client/src/components/MockServerManager.js
import React, { useState, useEffect } from 'react';
import {
    FiServer, FiPlay, FiPlus, FiTrash2, FiCopy, FiX, FiClock
} from 'react-icons/fi';
import './MockServerManager.css';

const MockServerManager = ({ collectionId, versionId, onClose }) => {
    // const { collectionId } = useParams(); // Remove this since collectionId is passed as prop

    const [mockServers, setMockServers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingEndpoint, setEditingEndpoint] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        baseUrl: '',
        mockEndpoints: []
    });

    const [endpointForm, setEndpointForm] = useState({
        path: '',
        method: 'GET',
        statusCode: 200,
        responseBody: '{}',
        responseDelay: 0
    });

    useEffect(() => {
        const loadMockServers = async () => {
            if (!versionId) return;

            try {
                setIsLoading(true);

                const response = await fetch(`/api/mock-servers/collection/${collectionId}/version/${versionId}`, {
                    credentials: 'include'
                });

                if (response.ok) {
                    const data = await response.json();
                    setMockServers(data.mockServers || []);
                } else {
                    setError('Failed to fetch mock servers');
                }
            } catch (err) {
                console.error('Error fetching mock servers:', err);
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        loadMockServers();
    }, [collectionId, versionId]);

    const handleCreateMockServer = async (e) => {
        e.preventDefault();

        try {
            const response = await fetch('/api/mock-servers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    ...formData,
                    collectionId,
                    versionId,
                    baseUrl: formData.baseUrl || `/mock/${versionId}`
                })
            });

            if (response.ok) {
                const result = await response.json();
                setMockServers([result.mockServer, ...mockServers]);
                setShowCreateForm(false);
                setFormData({
                    name: '',
                    description: '',
                    baseUrl: '',
                    mockEndpoints: []
                });
            } else {
                const errorData = await response.json();
                alert(`Error creating mock server: ${errorData.message}`);
            }
        } catch (err) {
            console.error('Error creating mock server:', err);
            alert(`Error creating mock server: ${err.message}`);
        }
    };

    const handleDeleteMockServer = async (mockServerId) => {
        if (!window.confirm('Are you sure you want to delete this mock server?')) {
            return;
        }

        try {
            const response = await fetch(`/api/mock-servers/${mockServerId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                setMockServers(mockServers.filter(server => server._id !== mockServerId));
            } else {
                const errorData = await response.json();
                alert(`Error deleting mock server: ${errorData.message}`);
            }
        } catch (err) {
            console.error('Error deleting mock server:', err);
            alert(`Error deleting mock server: ${err.message}`);
        }
    };

    const handleAddEndpoint = async (mockServerId) => {
        try {
            let responseBody;
            try {
                responseBody = JSON.parse(endpointForm.responseBody);
            } catch (e) {
                responseBody = endpointForm.responseBody;
            }

            const response = await fetch(`/api/mock-servers/${mockServerId}/endpoints`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    ...endpointForm,
                    responseBody,
                    responseHeaders: new Map([
                        ['Content-Type', 'application/json'],
                        ['Access-Control-Allow-Origin', '*']
                    ])
                })
            });

            if (response.ok) {
                window.location.reload(); // Refresh the data
                setEditingEndpoint(null);
                setEndpointForm({
                    path: '',
                    method: 'GET',
                    statusCode: 200,
                    responseBody: '{}',
                    responseDelay: 0
                });
            } else {
                const errorData = await response.json();
                alert(`Error adding endpoint: ${errorData.message}`);
            }
        } catch (err) {
            console.error('Error adding endpoint:', err);
            alert(`Error adding endpoint: ${err.message}`);
        }
    };

    const copyMockUrl = (server, endpoint) => {
        const mockUrl = `${window.location.origin}/api/mock-servers/${server._id}/simulate${endpoint.path}`;
        navigator.clipboard.writeText(mockUrl);

        // Show feedback
        const button = document.getElementById(`copy-${server._id}-${endpoint.path.replace('/', '_')}`);
        if (button) {
            const originalText = button.innerHTML;
            button.innerHTML = '<svg>...</svg> Copied!';
            setTimeout(() => {
                button.innerHTML = originalText;
            }, 2000);
        }
    };

    const testEndpoint = async (server, endpoint) => {
        try {
            const mockUrl = `/api/mock-servers/${server._id}/simulate${endpoint.path}`;

            const response = await fetch(mockUrl, {
                method: endpoint.method,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            alert(`Test successful!\nStatus: ${response.status}\nResponse: ${JSON.stringify(data, null, 2)}`);
        } catch (err) {
            alert(`Test failed: ${err.message}`);
        }
    };

    if (isLoading) {
        return (
            <div className="mock-server-loading">
                <div className="spinner"></div>
                <p>Loading mock servers...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="mock-server-error">
                <h4>Error loading mock servers</h4>
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div className="mock-server-manager">
            <div className="mock-server-header">
                <div className="header-info">
                    <h3>
                        <FiServer className="icon" />
                        Mock Servers for API Version
                    </h3>
                    <p>Create and manage mock API endpoints for testing</p>
                </div>
                <div className="header-actions">
                    <button
                        className="create-mock-btn"
                        onClick={() => setShowCreateForm(true)}
                    >
                        <FiPlus /> Create Mock Server
                    </button>
                    {onClose && (
                        <button
                            className="close-btn"
                            onClick={onClose}
                        >
                            <FiX /> Close
                        </button>
                    )}
                </div>
            </div>

            {/* Create Mock Server Form */}
            {showCreateForm && (
                <div className="create-mock-form">
                    <div className="form-header">
                        <h4>Create Mock Server</h4>
                        <button
                            className="close-btn"
                            onClick={() => setShowCreateForm(false)}
                        >
                            <FiX />
                        </button>
                    </div>

                    <form onSubmit={handleCreateMockServer}>
                        <div className="form-group">
                            <label>Name</label>
                            <input
                                type="text"
                                placeholder="Mock server name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Description</label>
                            <textarea
                                placeholder="What does this mock server simulate?"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={2}
                            />
                        </div>

                        <div className="form-group">
                            <label>Base URL (optional)</label>
                            <input
                                type="text"
                                placeholder={`/mock/${versionId}`}
                                value={formData.baseUrl}
                                onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                            />
                        </div>

                        <div className="form-actions">
                            <button type="button" onClick={() => setShowCreateForm(false)}>
                                Cancel
                            </button>
                            <button type="submit">Create Mock Server</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Mock Servers List */}
            {mockServers.length === 0 ? (
                <div className="empty-state">
                    <FiServer size={48} color="#ccc" />
                    <h4>No Mock Servers</h4>
                    <p>Create a mock server to simulate API responses for testing</p>
                </div>
            ) : (
                <div className="mock-servers-list">
                    {mockServers.map((server) => (
                        <div key={server._id} className="mock-server-card">
                            <div className="server-header">
                                <div className="server-info">
                                    <h4>{server.name}</h4>
                                    <p>{server.description}</p>
                                    <div className="server-meta">
                                        <span>Base URL: {server.baseUrl}</span>
                                        <span className={`status ${server.isActive ? 'active' : 'inactive'}`}>
                                            {server.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                </div>
                                <div className="server-actions">
                                    <button
                                        className="action-btn"
                                        onClick={() => setEditingEndpoint(server._id)}
                                    >
                                        <FiPlus /> Add Endpoint
                                    </button>
                                    <button
                                        className="action-btn delete"
                                        onClick={() => handleDeleteMockServer(server._id)}
                                    >
                                        <FiTrash2 /> Delete
                                    </button>
                                </div>
                            </div>

                            {/* Endpoints List */}
                            <div className="endpoints-section">
                                <h5>Endpoints ({server.mockEndpoints?.length || 0})</h5>

                                {server.mockEndpoints && server.mockEndpoints.length > 0 ? (
                                    <div className="endpoints-list">
                                        {server.mockEndpoints.map((endpoint, index) => (
                                            <div key={index} className="endpoint-item">
                                                <div className="endpoint-info">
                                                    <span className={`method ${endpoint.method.toLowerCase()}`}>
                                                        {endpoint.method}
                                                    </span>
                                                    <span className="path">{endpoint.path}</span>
                                                    <span className="status">Status: {endpoint.statusCode}</span>
                                                    {endpoint.responseDelay > 0 && (
                                                        <span className="delay">
                                                            <FiClock /> {endpoint.responseDelay}ms
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="endpoint-actions">
                                                    <button
                                                        id={`copy-${server._id}-${endpoint.path.replace('/', '_')}`}
                                                        className="action-btn small"
                                                        onClick={() => copyMockUrl(server, endpoint)}
                                                    >
                                                        <FiCopy /> Copy URL
                                                    </button>
                                                    <button
                                                        className="action-btn small"
                                                        onClick={() => testEndpoint(server, endpoint)}
                                                    >
                                                        <FiPlay /> Test
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="no-endpoints">No endpoints configured</p>
                                )}
                            </div>

                            {/* Add Endpoint Form */}
                            {editingEndpoint === server._id && (
                                <div className="endpoint-form">
                                    <h5>Add New Endpoint</h5>
                                    <div className="form-row">
                                        <select
                                            value={endpointForm.method}
                                            onChange={(e) => setEndpointForm({ ...endpointForm, method: e.target.value })}
                                        >
                                            <option value="GET">GET</option>
                                            <option value="POST">POST</option>
                                            <option value="PUT">PUT</option>
                                            <option value="DELETE">DELETE</option>
                                            <option value="PATCH">PATCH</option>
                                        </select>
                                        <input
                                            type="text"
                                            placeholder="/api/users"
                                            value={endpointForm.path}
                                            onChange={(e) => setEndpointForm({ ...endpointForm, path: e.target.value })}
                                        />
                                        <input
                                            type="number"
                                            placeholder="200"
                                            value={endpointForm.statusCode}
                                            onChange={(e) => setEndpointForm({ ...endpointForm, statusCode: parseInt(e.target.value) })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Response Body (JSON)</label>
                                        <textarea
                                            value={endpointForm.responseBody}
                                            onChange={(e) => setEndpointForm({ ...endpointForm, responseBody: e.target.value })}
                                            rows={4}
                                            placeholder='{"message": "Mock response"}'
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Response Delay (ms)</label>
                                        <input
                                            type="number"
                                            value={endpointForm.responseDelay}
                                            onChange={(e) => setEndpointForm({ ...endpointForm, responseDelay: parseInt(e.target.value) })}
                                            min="0"
                                        />
                                    </div>
                                    <div className="form-actions">
                                        <button
                                            type="button"
                                            onClick={() => setEditingEndpoint(null)}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleAddEndpoint(server._id)}
                                        >
                                            Add Endpoint
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MockServerManager;
