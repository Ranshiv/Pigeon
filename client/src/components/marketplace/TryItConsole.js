import React, { useState, useEffect, useRef } from 'react';
import { Play, Save, Copy, Check, ChevronDown, ChevronRight, Loader, Code, Trash2 } from 'lucide-react';
import { generateCodeSnippet } from '../../utils/codeGenerator';
import AppSelect from '../common/AppSelect/AppSelect';
import './TryItConsole.css';

const METHOD_OPTIONS = [
    { value: 'GET', label: 'GET' },
    { value: 'POST', label: 'POST' },
    { value: 'PUT', label: 'PUT' },
    { value: 'PATCH', label: 'PATCH' },
    { value: 'DELETE', label: 'DELETE' }
];

const LANG_OPTIONS = [
    { value: 'curl', label: 'cURL' },
    { value: 'javascript', label: 'JavaScript (Fetch)' },
    { value: 'axios', label: 'JavaScript (Axios)' },
    { value: 'python', label: 'Python (Requests)' }
];

const TryItConsole = ({ api, selectedEndpoint, onEndpointChange, onSaveRequest }) => {
    const [endpoint, setEndpoint] = useState(selectedEndpoint);
    const [method, setMethod] = useState(selectedEndpoint?.method || 'GET');
    const userChangedMethodRef = useRef(false);
    const [url, setUrl] = useState('');
    const [pathParams, setPathParams] = useState({});
    const [queryParams, setQueryParams] = useState([]);
    const [headers, setHeaders] = useState({});
    const [body, setBody] = useState('');
    const [authType] = useState(api.authType);
    const [authValue, setAuthValue] = useState('');
    const [response, setResponse] = useState(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [showHeaders, setShowHeaders] = useState(false);
    const [showBody, setShowBody] = useState(false);

    // Code Generation State
    const [showCode, setShowCode] = useState(false);
    const [selectedLang, setSelectedLang] = useState('curl');
    const [codeCopied, setCodeCopied] = useState(false);

    useEffect(() => {
        if (selectedEndpoint) {
            setEndpoint(selectedEndpoint);
            if (!userChangedMethodRef.current) {
                setMethod(selectedEndpoint.method);
            }
            userChangedMethodRef.current = false;
            buildUrl(selectedEndpoint);
            initializeParams(selectedEndpoint);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedEndpoint]);

    const buildUrl = (ep) => {
        let path = ep.path || '';
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

        const base = api.baseUrl || api.url || '';
        const sanitizedBase = base.replace(/\/+$/, '');
        const sanitizedPath = path.replace(/^\/+/, '');

        setUrl(sanitizedPath ? `${sanitizedBase}/${sanitizedPath}` : sanitizedBase);
    };

    const initializeParams = (ep) => {
        if (ep.parameters) {
            const qParams = [];
            const pParams = {};

            ep.parameters.forEach(param => {
                if (param.type === 'query') {
                    qParams.push({
                        id: Math.random().toString(36).substr(2, 9),
                        name: param.name,
                        value: ''
                    });
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

    const updateQueryParam = (id, value) => {
        setQueryParams(prev => prev.map(p => p.id === id ? { ...p, value } : p));
    };

    const addQueryParam = () => {
        setQueryParams(prev => [
            ...prev,
            {
                id: Math.random().toString(36).substr(2, 9),
                name: `param${prev.length + 1}`,
                value: ''
            }
        ]);
    };

    const removeQueryParam = (id) => {
        setQueryParams(prev => prev.filter(p => p.id !== id));
    };

    const updateQueryParamKey = (id, newName) => {
        setQueryParams(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p));
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

        // Add query parameters for display
        const qp = queryParams
            .filter(p => p.name && p.value)
            .map(p => `${encodeURIComponent(p.name)}=${encodeURIComponent(p.value)}`)
            .join('&');

        if (qp) {
            finalUrl += (finalUrl.includes('?') ? '&' : '?') + qp;
        }

        return finalUrl;
    };

    const executeRequest = async () => {
        setLoading(true);
        setResponse(null);

        try {
            const currentPathParams = { ...pathParams };
            const currentQueryParams = {};
            queryParams.forEach(p => {
                if (p.name) currentQueryParams[p.name] = p.value;
            });
            let requestHeaders = { ...headers };
            let authInjected = false;

            // Smart Auth Injection
            // If the user provided an Auth Value (API Key), try to place it in the right parameter
            if (authValue) {
                const apiKeyNames = ['appid', 'api_key', 'apiKey', 'key', 'access_key'];

                // 1. Check Path Parameters
                for (const key of Object.keys(currentPathParams)) {
                    if (apiKeyNames.includes(key.toLowerCase()) || key.toLowerCase().includes('api_key')) {
                        currentPathParams[key] = authValue;
                        authInjected = true;
                    }
                }

                // 2. Check Query Parameters
                if (!authInjected) {
                    for (const key of Object.keys(currentQueryParams)) {
                        if (apiKeyNames.includes(key.toLowerCase()) || key.toLowerCase().includes('api_key')) {
                            currentQueryParams[key] = authValue;
                            authInjected = true;
                        }
                    }
                }

                // 3. Fallback: Authorization Header
                // If we didn't inject it into a parameter, or if explicit OAuth, add as Header
                if (!authInjected) {
                    if (authType === 'OAuth 2.0') {
                        requestHeaders['Authorization'] = `Bearer ${authValue}`;
                    } else if (authType === 'API Key') {
                        // Default behavior for unknown API Key styles
                        requestHeaders['Authorization'] = `Bearer ${authValue}`;
                    }
                }
            }

            // Construct final URL with updated params
            let finalUrl = url;
            Object.entries(currentPathParams).forEach(([key, value]) => {
                finalUrl = finalUrl.replace(`{${key}}`, value || `{${key}}`);
            });

            const requestData = {
                url: finalUrl,
                method,
                headers: requestHeaders,
                queryParams: currentQueryParams,
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
        const currentQueryParams = {};
        queryParams.forEach(p => {
            if (p.name) currentQueryParams[p.name] = p.value;
        });

        const requestData = {
            url: finalUrl,
            method,
            path: endpoint.path,
            headers,
            queryParams: currentQueryParams,
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

    const handleCopyCode = (code) => {
        navigator.clipboard.writeText(code);
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 2000);
    };

    const getGeneratedCode = () => {
        // Prepare request object for generator
        let currentPathParams = { ...pathParams };
        let currentQueryParams = {};
        queryParams.forEach(p => {
            if (p.name) currentQueryParams[p.name] = p.value;
        });
        let requestHeaders = { ...headers };
        let authInjected = false;

        // Logic must match executeRequest
        if (authValue) {
            const apiKeyNames = ['appid', 'api_key', 'apiKey', 'key', 'access_key'];

            // 1. Check Path Parameters
            for (const key of Object.keys(currentPathParams)) {
                if (apiKeyNames.includes(key.toLowerCase()) || key.toLowerCase().includes('api_key')) {
                    currentPathParams[key] = authValue;
                    authInjected = true;
                }
            }

            // 2. Check Query Parameters
            if (!authInjected) {
                for (const key of Object.keys(currentQueryParams)) {
                    if (apiKeyNames.includes(key.toLowerCase()) || key.toLowerCase().includes('api_key')) {
                        currentQueryParams[key] = authValue;
                        authInjected = true;
                    }
                }
            }

            // 3. Fallback: Authorization Header
            if (!authInjected) {
                if (authType === 'OAuth 2.0') {
                    requestHeaders['Authorization'] = `Bearer ${authValue}`;
                } else if (authType === 'API Key') {
                    requestHeaders['Authorization'] = `Bearer ${authValue}`;
                }
            }
        }

        // Reconstruct URL for display
        let finalUrl = url;
        Object.entries(currentPathParams).forEach(([key, value]) => {
            finalUrl = finalUrl.replace(`{${key}}`, value || `{${key}}`);
        });

        return generateCodeSnippet(selectedLang, {
            method,
            url: finalUrl,
            headers: requestHeaders,
            queryParams: currentQueryParams,
            body: showBody && body ? JSON.parse(body || '{}') : undefined
        });
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
                {api.endpoints.length > 1 && (() => {
                    const epOptions = api.endpoints.map((ep, idx) => ({
                        value: ep.path,
                        label: `${ep.method} ${ep.path} - ${ep.description || ''}`
                    }));
                    return (
                        <div className="form-group">
                            <label>Endpoint</label>
                            <AppSelect
                                className="tryit-endpoint-select"
                                value={endpoint?.path || ''}
                                onChange={(v) => {
                                    const selected = api.endpoints.find(ep => ep.path === v);
                                    onEndpointChange(selected);
                                }}
                                options={epOptions}
                            />
                        </div>
                    );
                })()}

                {/* Method and URL */}
                <div className="form-group">
                    <label>Request URL</label>
                    <div className="url-input-row">
                        <AppSelect
                            className="tryit-method-select"
                            value={method}
                            onChange={(v) => { setMethod(v); userChangedMethodRef.current = true; }}
                            options={METHOD_OPTIONS}
                        />
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
                <div className="form-group">
                    <div className="section-header-inline">
                        <label>Query Parameters</label>
                        <button className="add-param-btn-text" onClick={addQueryParam}>
                            + Add Parameter
                        </button>
                    </div>
                    <div className="params-list-modern">
                        {queryParams.map((param) => (
                            <div key={param.id} className="modern-param-row">
                                <input
                                    type="text"
                                    value={param.name}
                                    onChange={(e) => updateQueryParamKey(param.id, e.target.value)}
                                    placeholder="Key"
                                    className="modern-param-key"
                                />
                                <input
                                    type="text"
                                    value={param.value}
                                    onChange={(e) => updateQueryParam(param.id, e.target.value)}
                                    placeholder="Value"
                                    className="modern-param-value"
                                />
                                <button
                                    className="modern-remove-btn"
                                    onClick={() => removeQueryParam(param.id)}
                                    title="Remove parameter"
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

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
                        <span className="header-meta">{Object.keys(headers).length}</span>
                    </button>
                    {showHeaders && (
                        <div className="collapsible-content">
                            <div className="kv-table">
                                <div className="kv-table-head">
                                    <div className="kv-col-head">Key</div>
                                    <div className="kv-col-head">Value</div>
                                    <div className="kv-col-head kv-col-action" />
                                </div>
                                <div className="kv-table-body">
                                    {Object.entries(headers).map(([key, value]) => (
                                        <div key={key} className="kv-row">
                                            <input
                                                type="text"
                                                value={key}
                                                onChange={(e) => updateHeader(key, e.target.value, value)}
                                                placeholder="Header name"
                                                className="kv-input kv-key"
                                            />
                                            <input
                                                type="text"
                                                value={value}
                                                onChange={(e) => updateHeader(key, key, e.target.value)}
                                                placeholder="Header value"
                                                className="kv-input kv-value"
                                            />
                                            <button
                                                type="button"
                                                className="kv-remove"
                                                onClick={() => removeHeader(key)}
                                                title="Remove header"
                                                aria-label="Remove header"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    ))}
                                    {Object.keys(headers).length === 0 && (
                                        <div className="kv-empty">No headers yet — add one below.</div>
                                    )}
                                </div>
                                <div className="kv-table-foot">
                                    <button type="button" className="kv-add-btn" onClick={addHeader}>
                                        <span className="kv-add-plus">+</span>
                                        <span>Add Header</span>
                                    </button>
                                </div>
                            </div>
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
                                <div className="kv-table">
                                    <div className="kv-editor">
                                        <label className="kv-editor-label">JSON Body</label>
                                        <textarea
                                            value={body}
                                            onChange={(e) => setBody(e.target.value)}
                                            placeholder='{"key": "value"}'
                                            className="kv-textarea"
                                            rows={8}
                                            spellCheck={false}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Action Buttons */}
                <div className="button-group">
                    <button className="btn-save" onClick={handleSave}>
                        <Save size={18} />
                        Save Request
                    </button>
                    <button className="btn-code" onClick={() => setShowCode(!showCode)}>
                        <Code size={18} />
                        {showCode ? 'Hide Code' : 'View Code'}
                    </button>
                </div>
            </div>

            {/* Code Generation Section */}
            {showCode && (
                <div className="code-section-container">
                    <div className="code-header-actions">
                        <h3 className="section-title" style={{ margin: 0 }}>Code Snippet</h3>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <AppSelect
                                className="tryit-lang-select"
                                value={selectedLang}
                                onChange={setSelectedLang}
                                options={LANG_OPTIONS}
                            />
                            <button className="copy-btn" onClick={() => handleCopyCode(getGeneratedCode())}>
                                {codeCopied ? <Check size={16} /> : <Copy size={16} />}
                            </button>
                        </div>
                    </div>
                    <div className="code-preview">
                        <pre>{getGeneratedCode()}</pre>
                    </div>
                </div>
            )}

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
