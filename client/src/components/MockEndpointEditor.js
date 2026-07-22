// client/src/components/MockEndpointEditor.js
import React, { useState } from 'react';
import {
    FiPlus, FiTrash2, FiEdit2, FiSave, FiX, FiCopy, FiPlay,
    FiCode, FiChevronDown, FiChevronUp
} from 'react-icons/fi';
import './MockEndpointEditor.css';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

const MockEndpointEditor = ({ mockServer, onUpdate }) => {
    const [editingEndpoint, setEditingEndpoint] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [expandedEndpoint, setExpandedEndpoint] = useState(null);
    const [testResult, setTestResult] = useState(null);

    const [endpointForm, setEndpointForm] = useState({
        path: '',
        method: 'GET',
        statusCode: 200,
        responseBody: '{\n  "message": "Mock response"\n}',
        responseDelay: 0,
        responseHeaders: {}
    });

    const resetForm = () => {
        setEndpointForm({
            path: '',
            method: 'GET',
            statusCode: 200,
            responseBody: '{\n  "message": "Mock response"\n}',
            responseDelay: 0,
            responseHeaders: {}
        });
    };

    const handleAddEndpoint = async () => {
        if (!endpointForm.path.trim()) return;

        try {
            let responseBody;
            try {
                responseBody = JSON.parse(endpointForm.responseBody);
            } catch {
                responseBody = endpointForm.responseBody;
            }

            const response = await fetch(`/api/mock-servers/${mockServer._id}/endpoints`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    ...endpointForm,
                    responseBody
                })
            });

            if (!response.ok) throw new Error('Failed to add endpoint');

            const result = await response.json();
            onUpdate(result.mockServer);
            setShowAddForm(false);
            resetForm();
        } catch (err) {
            console.error('Error adding endpoint:', err);
            alert(`Error: ${err.message}`);
        }
    };

    const handleUpdateEndpoint = async () => {
        if (!editingEndpoint) return;

        try {
            let responseBody;
            try {
                responseBody = JSON.parse(endpointForm.responseBody);
            } catch {
                responseBody = endpointForm.responseBody;
            }

            const response = await fetch(`/api/mock-servers/${mockServer._id}/endpoints`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    ...endpointForm,
                    responseBody
                })
            });

            if (!response.ok) throw new Error('Failed to update endpoint');

            const result = await response.json();
            onUpdate(result.mockServer);
            setEditingEndpoint(null);
            resetForm();
        } catch (err) {
            console.error('Error updating endpoint:', err);
            alert(`Error: ${err.message}`);
        }
    };

    const handleDeleteEndpoint = async (endpoint) => {
        if (!window.confirm(`Delete endpoint ${endpoint.method} ${endpoint.path}?`)) return;

        try {
            // Remove endpoint from list
            const updatedEndpoints = mockServer.mockEndpoints.filter(
                ep => !(ep.path === endpoint.path && ep.method === endpoint.method)
            );

            const response = await fetch(`/api/mock-servers/${mockServer._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ mockEndpoints: updatedEndpoints })
            });

            if (!response.ok) throw new Error('Failed to delete endpoint');

            const result = await response.json();
            onUpdate(result.mockServer);
        } catch (err) {
            console.error('Error deleting endpoint:', err);
            alert(`Error: ${err.message}`);
        }
    };

    const startEditing = (endpoint) => {
        setEditingEndpoint(endpoint);
        setEndpointForm({
            path: endpoint.path,
            method: endpoint.method,
            statusCode: endpoint.statusCode || 200,
            responseBody: typeof endpoint.responseBody === 'string'
                ? endpoint.responseBody
                : JSON.stringify(endpoint.responseBody, null, 2),
            responseDelay: endpoint.responseDelay || 0,
            responseHeaders: endpoint.responseHeaders || {}
        });
        setShowAddForm(false);
    };

    const testEndpoint = async (endpoint) => {
        setTestResult({ loading: true, endpoint });

        try {
            const mockUrl = `/api/mock-servers/${mockServer._id}/simulate${endpoint.path}`;
            const startTime = Date.now();

            const response = await fetch(mockUrl, {
                method: endpoint.method,
                headers: { 'Content-Type': 'application/json' }
            });

            const duration = Date.now() - startTime;
            const data = await response.json();

            setTestResult({
                endpoint,
                success: true,
                status: response.status,
                duration,
                data
            });
        } catch (err) {
            setTestResult({
                endpoint,
                success: false,
                error: err.message
            });
        }
    };

    const copyEndpointUrl = (endpoint) => {
        const origin = window.location.origin;
        const url = `${origin}/api/mock-servers/${mockServer._id}/simulate${endpoint.path}`;
        navigator.clipboard.writeText(url);
    };

    const formatResponseBody = (body) => {
        if (typeof body === 'string') return body;
        return JSON.stringify(body, null, 2);
    };

    const getStatusClass = (status) => {
        if (status >= 200 && status < 300) return 'status-2xx';
        if (status >= 300 && status < 400) return 'status-3xx';
        if (status >= 400 && status < 500) return 'status-4xx';
        return 'status-5xx';
    };

    return (
        <div className="endpoint-editor">
            {/* Header */}
            <div className="editor-header">
                <div className="header-info">
                    <h3>Mock Endpoints</h3>
                    <span className="endpoint-count">
                        {mockServer.mockEndpoints?.length || 0} endpoints
                    </span>
                </div>
                <button
                    className="btn-add"
                    onClick={() => {
                        setShowAddForm(true);
                        setEditingEndpoint(null);
                        resetForm();
                    }}
                >
                    <FiPlus size={14} />
                    Add Endpoint
                </button>
            </div>

            {/* Add/Edit Form */}
            {(showAddForm || editingEndpoint) && (
                <div className="endpoint-form">
                    <div className="form-header">
                        <h4>{editingEndpoint ? 'Edit Endpoint' : 'Add New Endpoint'}</h4>
                        <button
                            className="btn-close"
                            onClick={() => {
                                setShowAddForm(false);
                                setEditingEndpoint(null);
                                resetForm();
                            }}
                        >
                            <FiX size={16} />
                        </button>
                    </div>

                    <div className="form-body">
                        <section className="form-section">
                            <div className="section-heading">
                                <div>
                                    <p className="section-eyebrow">Endpoint</p>
                                    <h5>Request Details</h5>
                                </div>
                                <span className="section-hint">Match incoming requests by method and path</span>
                            </div>

                            <div className="endpoint-meta-grid">
                                <div className="input-field method-selector">
                                    <span className="field-label">Method</span>
                                    <div className="method-pill-group">
                                        {HTTP_METHODS.map((method) => (
                                            <button
                                                type="button"
                                                key={method}
                                                className={`method-pill ${endpointForm.method === method ? 'active' : ''}`}
                                                onClick={() => setEndpointForm({ ...endpointForm, method })}
                                            >
                                                {method}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="input-field path-field">
                                    <label htmlFor="endpoint-path">Path</label>
                                    <div className="input-shell">
                                        <input
                                            id="endpoint-path"
                                            type="text"
                                            placeholder="/api/products"
                                            value={endpointForm.path}
                                            onChange={(e) => setEndpointForm({ ...endpointForm, path: e.target.value })}
                                        />
                                    </div>
                                    <span className="input-hint">Use params like /orders/:id if needed</span>
                                </div>

                                <div className="input-field small">
                                    <label htmlFor="status-code">Status Code</label>
                                    <input
                                        id="status-code"
                                        type="number"
                                        min="100"
                                        max="599"
                                        placeholder="201"
                                        value={endpointForm.statusCode}
                                        onChange={(e) => setEndpointForm({ ...endpointForm, statusCode: Number.parseInt(e.target.value, 10) })}
                                    />
                                </div>

                                <div className="input-field small">
                                    <label htmlFor="response-delay">
                                        Response Delay (ms)
                                    </label>
                                    <input
                                        id="response-delay"
                                        type="number"
                                        min="0"
                                        value={endpointForm.responseDelay}
                                        onChange={(e) => setEndpointForm({ ...endpointForm, responseDelay: Number.parseInt(e.target.value, 10) || 0 })}
                                    />
                                </div>
                            </div>
                        </section>

                        <section className="form-section response-body-section">
                            <div className="section-heading">
                                <div>
                                    <p className="section-eyebrow">Response</p>
                                    <h5>Body Template</h5>
                                </div>
                                <span className="section-hint">Supports JSON, text or template variables</span>
                            </div>
                            <div className="response-field">
                                <label className="sr-only" htmlFor="response-body">Response Body</label>
                                <textarea
                                    id="response-body"
                                    value={endpointForm.responseBody}
                                    onChange={(e) => setEndpointForm({ ...endpointForm, responseBody: e.target.value })}
                                    rows={8}
                                    placeholder='{"message": "Mock response"}'
                                    className="code-editor"
                                />
                                <div className="input-hint">
                                    Variables like <code>{'{{randomUUID}}'}</code> are replaced at runtime.
                                </div>
                            </div>
                        </section>

                        <div className="form-actions modern">
                            <button
                                className="btn-secondary"
                                onClick={() => {
                                    setShowAddForm(false);
                                    setEditingEndpoint(null);
                                    resetForm();
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-primary"
                                onClick={editingEndpoint ? handleUpdateEndpoint : handleAddEndpoint}
                            >
                                <FiSave size={14} />
                                {editingEndpoint ? 'Update Endpoint' : 'Add Endpoint'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Endpoints List */}
            <div className="endpoints-list">
                {mockServer.mockEndpoints?.length > 0 ? (
                    mockServer.mockEndpoints.map((endpoint, index) => (
                        <div key={`${endpoint.method}-${endpoint.path}-${index}`} className={`endpoint-card ${expandedEndpoint === index ? 'expanded' : ''}`}>
                            <div className="endpoint-header">
                                <button
                                    className="chevron-btn"
                                    onClick={() => setExpandedEndpoint(
                                        expandedEndpoint === index ? null : index
                                    )}
                                >
                                    {expandedEndpoint === index ? (
                                        <FiChevronUp size={16} />
                                    ) : (
                                        <FiChevronDown size={16} />
                                    )}
                                </button>
                                <div className="endpoint-main" onClick={() => setExpandedEndpoint(
                                    expandedEndpoint === index ? null : index
                                )}>
                                    <span className={`method ${endpoint.method.toLowerCase()}`}>
                                        {endpoint.method}
                                    </span>
                                    <span className="path">{endpoint.path}</span>
                                </div>
                                <span className={`status-badge ${getStatusClass(endpoint.statusCode)}`}>
                                    {endpoint.statusCode}
                                </span>
                                <div className="endpoint-actions">
                                    <button
                                        className="btn-icon"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            copyEndpointUrl(endpoint);
                                        }}
                                        title="Copy URL"
                                    >
                                        <FiCopy size={14} />
                                    </button>
                                    <button
                                        className="btn-icon"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            testEndpoint(endpoint);
                                        }}
                                        title="Test"
                                    >
                                        <FiPlay size={14} />
                                    </button>
                                    <button
                                        className="btn-icon"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            startEditing(endpoint);
                                        }}
                                        title="Edit"
                                    >
                                        <FiEdit2 size={14} />
                                    </button>
                                    <button
                                        className="btn-icon danger"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteEndpoint(endpoint);
                                        }}
                                        title="Delete"
                                    >
                                        <FiTrash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            {expandedEndpoint === index && (
                                <div className="endpoint-body">
                                    {/* Configuration Section */}
                                    <div className="response-section">
                                        <h5>Configuration</h5>
                                        <div className="config-grid">
                                            <div className="config-item">
                                                <span className="config-label">Status Code</span>
                                                <span className="config-value">
                                                    {endpoint.statusCode}
                                                </span>
                                            </div>
                                            <div className="config-item">
                                                <span className="config-label">Response Delay</span>
                                                <span className="config-value">
                                                    {endpoint.responseDelay || 0}ms
                                                </span>
                                            </div>
                                            <div className="config-item">
                                                <span className="config-label">Method</span>
                                                <span className="config-value">
                                                    {endpoint.method}
                                                </span>
                                            </div>
                                            <div className="config-item">
                                                <span className="config-label">Path</span>
                                                <span className="config-value path">{endpoint.path}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Response Headers Section */}
                                    <div className="response-section">
                                        <h5>Response Headers</h5>
                                        {endpoint.responseHeaders && Object.keys(endpoint.responseHeaders).length > 0 ? (
                                            <div className="headers-list">
                                                {Object.entries(endpoint.responseHeaders).map(([key, value]) => (
                                                    <div key={key} className="header-item">
                                                        <span className="header-key">{key}</span>
                                                        <span className="header-value">{value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="empty-headers">
                                                <span>No custom headers configured</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Response Body Section */}
                                    <div className="response-section">
                                        <h5>Response Body</h5>
                                        <pre className="code-block">
                                            {formatResponseBody(endpoint.responseBody)}
                                        </pre>
                                    </div>

                                    {/* Test Result */}
                                    {testResult?.endpoint?.path === endpoint.path &&
                                        testResult?.endpoint?.method === endpoint.method && (
                                            <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
                                                {testResult.loading ? (
                                                    <p>Testing endpoint...</p>
                                                ) : testResult.success ? (
                                                    <>
                                                        <div className="result-header">
                                                            <span className="result-status">
                                                                Status: {testResult.status}
                                                            </span>
                                                            <span className="result-time">
                                                                {testResult.duration}ms
                                                            </span>
                                                        </div>
                                                        <pre className="result-body">
                                                            {JSON.stringify(testResult.data, null, 2)}
                                                        </pre>
                                                    </>
                                                ) : (
                                                    <p className="error-message">Error: {testResult.error}</p>
                                                )}
                                            </div>
                                        )}
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="empty-endpoints">
                        <FiCode size={32} />
                        <p>No endpoints configured</p>
                        <span>Add endpoints to start mocking API responses</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MockEndpointEditor;
