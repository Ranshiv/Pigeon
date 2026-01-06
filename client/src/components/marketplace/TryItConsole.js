import React, { useState, useEffect } from 'react';
import { Play, Save, Copy, Check, ChevronDown, ChevronRight, Loader } from 'lucide-react';
import './TryItConsole.css';

const TryItConsole = ({ api, selectedEndpoint, onEndpointChange, onSaveRequest }) => {
    const [endpoint, setEndpoint] = useState(selectedEndpoint);
    const [method, setMethod] = useState(selectedEndpoint?.method || 'GET');
    const [url, setUrl] = useState('');
    const [pathParams, setPathParams] = useState({});
    const [queryParams, setQueryParams] = useState({});
    const [headers, setHeaders] = useState({});
    const [body, setBody] = useState('');
    const [authType] = useState(api.authType);
    const [authValue, setAuthValue] = useState('');
    const [response, setResponse] = useState(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [showHeaders, setShowHeaders] = useState(false);
    const [showBody, setShowBody] = useState(false);

    useEffect(() => {
        if (selectedEndpoint) {
            setEndpoint(selectedEndpoint);
            setMethod(selectedEndpoint.method);
            buildUrl(selectedEndpoint);
            initializeParams(selectedEndpoint);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedEndpoint]);

    const buildUrl = (ep) => {
        let path = ep.path;
        // Replace path parameters with placeholders
        const pathParamMatches = path.match(/\{([^}]+)\}/g);
        if (pathParamMatches) {
            const params = {};
            pathParamMatches.forEach(match => {
                const paramName = match.slice(1, -1);
                params[paramName] = '';
            });
            setPathParams(params);
        }
        setUrl(api.baseUrl + path);
    };

    const initializeParams = (ep) => {
        if (ep.parameters) {
            const qParams = {};
            const pParams = {};

            ep.parameters.forEach(param => {
                if (param.type === 'query') {
                    qParams[param.name] = '';
                } else if (param.type === 'path') {
                    pParams[param.name] = '';
                }
            });

            setQueryParams(qParams);
            setPathParams(pParams);
        }

        if (ep.body) {
            setBody(JSON.stringify(ep.body, null, 2));
            setShowBody(true);
        } else {
            setBody('');
            setShowBody(false);
        }
    };

    const updatePathParam = (key, value) => {
        setPathParams(prev => ({ ...prev, [key]: value }));
    };

    const updateQueryParam = (key, value) => {
        setQueryParams(prev => ({ ...prev, [key]: value }));
    };

    const addHeader = () => {
        const key = `Header-${Object.keys(headers).length + 1}`;
        setHeaders(prev => ({ ...prev, [key]: '' }));
    };

    const updateHeader = (oldKey, newKey, value) => {
        setHeaders(prev => {
            const updated = { ...prev };
            if (oldKey !== newKey) {
                delete updated[oldKey];
            }
            updated[newKey] = value;
            return updated;
        });
    };

    const removeHeader = (key) => {
        setHeaders(prev => {
            const updated = { ...prev };
            delete updated[key];
            return updated;
        });
    };

    const getFinalUrl = () => {
        let finalUrl = url;

        // Replace path parameters
        Object.entries(pathParams).forEach(([key, value]) => {
            finalUrl = finalUrl.replace(`{${key}}`, value || `{${key}}`);
        });

        return finalUrl;
    };

    const executeRequest = async () => {
        setLoading(true);
        setResponse(null);

        try {
            const finalUrl = getFinalUrl();
            const requestHeaders = { ...headers };

            // Add authentication
            if (authType === 'API Key' && authValue) {
                requestHeaders['Authorization'] = `Bearer ${authValue}`;
            } else if (authType === 'OAuth 2.0' && authValue) {
                requestHeaders['Authorization'] = `Bearer ${authValue}`;
            }

            const requestData = {
                url: finalUrl,
                method,
                headers: requestHeaders,
                queryParams,
                body: showBody && body ? JSON.parse(body) : undefined
            };

            const proxyResponse = await fetch('http://localhost:5001/api/marketplace/proxy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(requestData)
            });

            const data = await proxyResponse.json();
            setResponse(data);
        } catch (error) {
            console.error('Request error:', error);
            setResponse({
                error: 'Request failed',
                message: error.message,
                success: false
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = () => {
        const finalUrl = getFinalUrl();
        const requestData = {
            url: finalUrl,
            method,
            path: endpoint.path,
            headers,
            queryParams,
            body: showBody && body ? body : undefined
        };
        onSaveRequest(requestData);
    };

    const copyResponse = () => {
        const responseToCopy = JSON.stringify(response.body, null, 2);
        navigator.clipboard.writeText(responseToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const getStatusColor = (status) => {
        if (status >= 200 && status < 300) return 'var(--success-color)';
        if (status >= 300 && status < 400) return 'var(--info-color)';
        if (status >= 400 && status < 500) return 'var(--warning-color)';
        if (status >= 500) return 'var(--danger-color)';
        return 'var(--text-muted)';
    };

    return (
        <div className="tryit-console">
            {/* Request Builder */}
            <div className="console-section request-section">
                <h3 className="section-title">Request</h3>

                {/* Endpoint Selector */}
                {api.endpoints.length > 1 && (
                    <div className="form-group">
                        <label>Endpoint</label>
                        <select
                            value={endpoint?.path || ''}
                            onChange={(e) => {
                                const selected = api.endpoints.find(ep => ep.path === e.target.value);
                                onEndpointChange(selected);
                            }}
                            className="form-select"
                        >
                            {api.endpoints.map((ep, idx) => (
                                <option key={idx} value={ep.path}>
                                    {ep.method} {ep.path} - {ep.description}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Method and URL */}
                <div className="form-group">
                    <label>Request URL</label>
                    <div className="url-input-row">
                        <select
                            value={method}
                            onChange={(e) => setMethod(e.target.value)}
                            className="method-select"
                        >
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="PATCH">PATCH</option>
                            <option value="DELETE">DELETE</option>
                        </select>
                        <input
                            type="text"
                            value={getFinalUrl()}
                            readOnly
                            className="url-input"
                        />
                        <button
                            className="btn-execute"
                            onClick={executeRequest}
                            disabled={loading}
                        >
                            {loading ? <Loader size={18} className="spinning" /> : <Play size={18} />}
                            Send
                        </button>
                    </div>
                </div>

                {/* Path Parameters */}
                {Object.keys(pathParams).length > 0 && (
                    <div className="form-group">
                        <label>Path Parameters</label>
                        <div className="params-grid">
                            {Object.entries(pathParams).map(([key, value]) => (
                                <div key={key} className="param-row">
                                    <span className="param-key">{key}</span>
                                    <input
                                        type="text"
                                        value={value}
                                        onChange={(e) => updatePathParam(key, e.target.value)}
                                        placeholder={`Enter ${key}`}
                                        className="param-input"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Query Parameters */}
                {Object.keys(queryParams).length > 0 && (
                    <div className="form-group">
                        <label>Query Parameters</label>
                        <div className="params-grid">
                            {Object.entries(queryParams).map(([key, value]) => (
                                <div key={key} className="param-row">
                                    <span className="param-key">{key}</span>
                                    <input
                                        type="text"
                                        value={value}
                                        onChange={(e) => updateQueryParam(key, e.target.value)}
                                        placeholder={`Enter ${key}`}
                                        className="param-input"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Authentication */}
                {authType !== 'None' && (
                    <div className="form-group">
                        <label>Authentication ({authType})</label>
                        <input
                            type="password"
                            value={authValue}
                            onChange={(e) => setAuthValue(e.target.value)}
                            placeholder={`Enter ${authType === 'API Key' ? 'API Key' : 'Access Token'}`}
                            className="form-input"
                        />
                    </div>
                )}

                {/* Headers */}
                <div className="form-group collapsible">
                    <button
                        className="collapsible-header"
                        onClick={() => setShowHeaders(!showHeaders)}
                    >
                        <div className="header-label">
                            {showHeaders ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                            <span>Headers</span>
                        </div>
                        <span className="header-meta">({Object.keys(headers).length})</span>
                    </button>
                    {showHeaders && (
                        <div className="collapsible-content">
                            {Object.entries(headers).map(([key, value]) => (
                                <div key={key} className="header-row">
                                    <input
                                        type="text"
                                        value={key}
                                        onChange={(e) => updateHeader(key, e.target.value, value)}
                                        placeholder="Header name"
                                        className="header-key-input"
                                    />
                                    <input
                                        type="text"
                                        value={value}
                                        onChange={(e) => updateHeader(key, key, e.target.value)}
                                        placeholder="Header value"
                                        className="header-value-input"
                                    />
                                    <button
                                        className="remove-btn"
                                        onClick={() => removeHeader(key)}
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                            <button className="add-header-btn" onClick={addHeader}>
                                + Add Header
                            </button>
                        </div>
                    )}
                </div>

                {/* Body */}
                {['POST', 'PUT', 'PATCH'].includes(method) && (
                    <div className="form-group collapsible">
                        <button
                            className="collapsible-header"
                            onClick={() => setShowBody(!showBody)}
                        >
                            <div className="header-label">
                                {showBody ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                <span>Body (JSON)</span>
                            </div>
                        </button>
                        {showBody && (
                            <div className="collapsible-content">
                                <textarea
                                    value={body}
                                    onChange={(e) => setBody(e.target.value)}
                                    placeholder='{"key": "value"}'
                                    className="body-textarea"
                                    rows={8}
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Save Button */}
                <button className="btn-save" onClick={handleSave}>
                    <Save size={18} />
                    Save Request
                </button>
            </div>

            {/* Response Viewer */}
            {response && (
                <div className="console-section response-section">
                    <div className="section-header">
                        <h3 className="section-title">Response</h3>
                        <div className="response-meta">
                            <span
                                className="status-badge"
                                style={{
                                    backgroundColor: getStatusColor(response.status) + '20',
                                    color: getStatusColor(response.status)
                                }}
                            >
                                {response.status} {response.statusText}
                            </span>
                            <span className="time-badge">{response.duration}ms</span>
                            <span className="size-badge">{(response.size / 1024).toFixed(2)} KB</span>
                            <button className="copy-btn" onClick={copyResponse}>
                                {copied ? <Check size={16} /> : <Copy size={16} />}
                            </button>
                        </div>
                    </div>

                    {response.error ? (
                        <div className="error-display">
                            <strong>Error:</strong> {response.message}
                        </div>
                    ) : (
                        <>
                            {/* Response Headers */}
                            <div className="response-headers">
                                <strong>Headers:</strong>
                                <pre>{JSON.stringify(response.headers, null, 2)}</pre>
                            </div>

                            {/* Response Body */}
                            <div className="response-body">
                                <strong>Body:</strong>
                                <pre>{JSON.stringify(response.body, null, 2)}</pre>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default TryItConsole;
