import React, { useState, useEffect } from 'react';
import './RequestForm.css';
import ResponseDisplay from './ResponseDisplay';
import VariableEditor from './VariableEditor';
import UnifiedVariableViewer from './UnifiedVariableViewer';
import { interpolateRequest, resolveVariables, validateVariables, extractVariables } from '../utils/variableInterpolation';

// Helper function to get the correct API base URL
const getApiUrl = (path) => {
    // In development, if proxy isn't working, use direct backend URL
    const isDevelopment = process.env.NODE_ENV === 'development';
    const baseUrl = isDevelopment ? 'http://localhost:5001' : '';
    return `${baseUrl}${path}`;
};

// HTTP Methods
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

const RequestForm = ({ onSendRequest, onSubmit, onSave, onRunRequest, initialRequest, request,
    collectionId, workspaceId, environmentId, collection }) => {
    // Use either initialRequest or request prop (for backward compatibility)
    const initialData = request || initialRequest || {};

    // Form state
    const [method, setMethod] = useState(initialData.method || 'GET');
    const [url, setUrl] = useState(initialData.url || '');
    const [requestName, setRequestName] = useState(initialData.name || 'Get Users');
    const [activeTab, setActiveTab] = useState('params');
    const [isNew] = useState(initialData.isNew || false);

    // Response state - new state for storing response
    const [responseData, setResponseData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [responseError, setResponseError] = useState(null);

    // Tab content states
    const [params, setParams] = useState(initialData.params || [
        { enabled: true, key: 'Key', value: 'Value', description: 'Description' }
    ]);
    const [headers, setHeaders] = useState(initialData.headers || []);
    const [bodyType, setBodyType] = useState(initialData.bodyType || 'none'); const [bodyContent, setBodyContent] = useState(initialData.body || '');
    const [preRequestScript, setPreRequestScript] = useState(initialData.preRequestScript || '');
    const [tests, setTests] = useState(initialData.tests || ''); const [variables, setVariables] = useState(initialData.variables || []);

    // Variable resolution state
    const [resolvedVariables, setResolvedVariables] = useState({});
    const [environmentVariables, setEnvironmentVariables] = useState({});
    const [collectionVariables] = useState(collection?.variables || []);
    const [globalVariables, setGlobalVariables] = useState({});
    const [variableValidation, setVariableValidation] = useState({ isValid: true, missingVariables: [] });

    // Utility function to get CSS classes for inputs with variables
    const getVariableInputClass = (value) => {
        if (!value) return '';

        const variables = extractVariables(value);
        if (variables.length === 0) return '';

        const missingVars = variables.filter(varName => !resolvedVariables.hasOwnProperty(varName));

        if (missingVars.length > 0) {
            return 'has-missing-variables';
        } else {
            return 'has-variables';
        }
    };// Handlers for form inputs
    const handleMethodChange = (e) => setMethod(e.target.value);
    const handleUrlChange = (e) => setUrl(e.target.value);

    // Variable loading and resolution effects
    useEffect(() => {
        const loadVariables = async () => {
            try {                // Load environment variables if environmentId is provided
                if (environmentId) {
                    const envResponse = await fetch(getApiUrl(`/api/environments/${environmentId}/variables`), {
                        credentials: 'include'
                    });
                    if (envResponse.ok) {
                        const envData = await envResponse.json();
                        setEnvironmentVariables(envData.variables || []);
                    }
                }

                // Load global variables if workspaceId is provided
                if (workspaceId) {
                    const globalResponse = await fetch(getApiUrl(`/api/workspaces/${workspaceId}/global-variables`), {
                        credentials: 'include'
                    });
                    if (globalResponse.ok) {
                        const globalData = await globalResponse.json();
                        setGlobalVariables(globalData.variables || []);
                    }
                }
            } catch (error) {
                console.error('Error loading variables:', error);
            }
        };

        loadVariables();
    }, [environmentId, workspaceId]);

    // Resolve variables whenever any variable set changes
    useEffect(() => {
        const resolved = resolveVariables(
            variables,
            environmentVariables,
            collectionVariables,
            globalVariables
        );
        setResolvedVariables(resolved);

        // Validate variables in current request
        const requestData = {
            url,
            headers: headers.filter(h => h.enabled),
            params: params.filter(p => p.enabled),
            body: bodyContent
        };

        const validation = validateVariables(requestData, resolved);
        setVariableValidation(validation);
    }, [variables, environmentVariables, collectionVariables, globalVariables, url, headers, params, bodyContent]);    // Tab change handler
    const handleTabChange = (tab) => setActiveTab(tab);

    // Name change handler
    const handleNameChange = (e) => setRequestName(e.target.value);

    // Parameter handlers
    const handleParamChange = (index, field, value) => {
        const newParams = [...params];
        newParams[index][field] = value;
        setParams(newParams);
    };

    const handleAddParam = () => {
        setParams([...params, { enabled: true, key: '', value: '', description: '' }]);
    };

    const handleRemoveParam = (index) => {
        const newParams = [...params];
        newParams.splice(index, 1);
        setParams(newParams);
    };

    // Header handlers
    const handleHeaderChange = (index, field, value) => {
        const newHeaders = [...headers];
        newHeaders[index][field] = value;
        setHeaders(newHeaders);
    };

    const handleAddHeader = () => {
        setHeaders([...headers, { enabled: true, key: '', value: '', description: '' }]);
    };

    const handleRemoveHeader = (index) => {
        const newHeaders = [...headers];
        newHeaders.splice(index, 1);
        setHeaders(newHeaders);
    };    // Save button handler
    const handleSave = () => {
        // Build request object
        const requestData = {
            name: requestName,
            method,
            url,
            params: params.filter(p => p.enabled && p.key),
            headers: headers.filter(h => h.enabled && h.key),
            bodyType,
            body: bodyContent,
            preRequestScript,
            tests,
            variables: variables.filter(v => v.key),
            isNew
        };

        // Use onSave prop if available
        if (onSave) {
            onSave(requestData);
        }
    };    // Form submission handler
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Build request object
        const requestData = {
            name: requestName,
            method,
            url,
            params: params.filter(p => p.enabled && p.key),
            headers: headers.filter(h => h.enabled && h.key),
            bodyType,
            body: bodyContent,
            preRequestScript,
            tests,
            variables: variables.filter(v => v.key),
            isNew,
            _id: initialData._id || initialData.id
        };

        // Apply variable interpolation to the request data
        const interpolatedRequest = interpolateRequest(requestData, resolvedVariables);

        // Check for external handlers first
        if (onSendRequest) {
            onSendRequest(interpolatedRequest);
            return;
        } else if (onSubmit) {
            onSubmit(interpolatedRequest);
            return;
        } else if (onRunRequest) {
            onRunRequest(interpolatedRequest._id || initialData._id || initialData.id);
            return;
        }        // If no external handlers exist, process the request directly using interpolated data
        setIsLoading(true);
        setResponseData(null);
        setResponseError(null);

        try {
            // Prepare the request headers from interpolated data
            const headerObj = {};
            interpolatedRequest.headers.forEach(h => {
                if (h.enabled && h.key) {
                    headerObj[h.key] = h.value;
                }
            });

            // Prepare request body from interpolated data
            let requestBody = null;
            if (interpolatedRequest.method !== 'GET' && interpolatedRequest.method !== 'HEAD' && bodyType !== 'none') {
                if (bodyType === 'raw') {
                    requestBody = interpolatedRequest.body;
                } else if (bodyType === 'form-data' || bodyType === 'x-www-form-urlencoded') {
                    // Form data not implemented in this version
                    requestBody = '';
                }
            }

            const startTime = Date.now();            // Use proxy endpoint with interpolated URL
            const response = await fetch(getApiUrl('/api/proxy'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    url: interpolatedRequest.url,
                    method: interpolatedRequest.method,
                    headers: headerObj,
                    body: requestBody,
                    timeout: 30000
                }),
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Server responded with status ${response.status}`);
            }

            const responseData = await response.json();
            const endTime = Date.now();

            // The proxy already provides all the information we need
            setResponseData({
                ...responseData,
                duration: endTime - startTime
            });
        } catch (err) {
            setResponseError(err.message || "An error occurred while sending the request");
            console.error("Request error:", err);
        } finally {
            setIsLoading(false);
        }

        // Save request if onSave provided
        if (onSave) {
            onSave(requestData);
        }
    };    // Update URL with query parameters
    useEffect(() => {
        const updateUrlWithParams = () => {
            try {
                const urlObj = new URL(url);

                // Clear existing params
                urlObj.search = '';

                // Add enabled params
                params.forEach(param => {
                    if (param.enabled && param.key) {
                        urlObj.searchParams.append(param.key, param.value || '');
                    }
                });

                // Update URL without triggering infinite loop
                const newUrl = urlObj.toString();
                if (newUrl !== url) {
                    setUrl(newUrl);
                }
            } catch (error) {
                // Invalid URL, ignore
            }
        };

        // Only update if URL is valid and we have params
        if (url?.includes('://') && params.some(p => p.enabled && p.key)) {
            updateUrlWithParams();
        }
    }, [params, url]);

    // Render tab content based on active tab
    const renderTabContent = () => {
        switch (activeTab) {
            case 'params':
                return (
                    <div className="params-section">
                        <div className="table-container">
                            <table className="params-table">
                                <thead>
                                    <tr>
                                        <th width="30"></th>
                                        <th width="30%">Key</th>
                                        <th width="30%">Value</th>
                                        <th width="30%">Description</th>
                                        <th width="40"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {params.map((param, index) => (
                                        <tr key={`param-${index}`}>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={param.enabled}
                                                    onChange={(e) => handleParamChange(index, 'enabled', e.target.checked)}
                                                />
                                            </td>                                            <td>
                                                <input
                                                    type="text"
                                                    className={getVariableInputClass(param.key)}
                                                    value={param.key}
                                                    onChange={(e) => handleParamChange(index, 'key', e.target.value)}
                                                    placeholder="Key"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className={getVariableInputClass(param.value)}
                                                    value={param.value}
                                                    onChange={(e) => handleParamChange(index, 'value', e.target.value)}
                                                    placeholder="Value"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    value={param.description}
                                                    onChange={(e) => handleParamChange(index, 'description', e.target.value)}
                                                    placeholder="Description"
                                                />
                                            </td>
                                            <td>
                                                <button
                                                    className="delete-row-btn"
                                                    onClick={() => handleRemoveParam(index)}
                                                    aria-label="Delete parameter"
                                                >
                                                    ×
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="add-row-container">
                            <button type="button" className="add-row-btn" onClick={handleAddParam}>
                                <span className="add-icon">+</span> Add
                            </button>
                        </div>
                    </div>
                );

            case 'headers':
                return (
                    <div className="headers-section">
                        <div className="table-container">
                            <table className="params-table">
                                <thead>
                                    <tr>
                                        <th width="30"></th>
                                        <th width="30%">Key</th>
                                        <th width="30%">Value</th>
                                        <th width="30%">Description</th>
                                        <th width="40"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {headers.map((header, index) => (
                                        <tr key={`header-${index}`}>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={header.enabled}
                                                    onChange={(e) => handleHeaderChange(index, 'enabled', e.target.checked)}
                                                />
                                            </td>                                            <td>
                                                <input
                                                    type="text"
                                                    className={getVariableInputClass(header.key)}
                                                    value={header.key}
                                                    onChange={(e) => handleHeaderChange(index, 'key', e.target.value)}
                                                    placeholder="Key"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className={getVariableInputClass(header.value)}
                                                    value={header.value}
                                                    onChange={(e) => handleHeaderChange(index, 'value', e.target.value)}
                                                    placeholder="Value"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    value={header.description}
                                                    onChange={(e) => handleHeaderChange(index, 'description', e.target.value)}
                                                    placeholder="Description"
                                                />
                                            </td>
                                            <td>
                                                <button
                                                    className="delete-row-btn"
                                                    onClick={() => handleRemoveHeader(index)}
                                                    aria-label="Delete header"
                                                >
                                                    ×
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="add-row-container">
                            <button type="button" className="add-row-btn" onClick={handleAddHeader}>
                                <span className="add-icon">+</span> Add
                            </button>
                        </div>
                    </div>
                );

            case 'body':
                return (
                    <div className="body-section">
                        <div className="body-type-tabs">
                            <div
                                className={`body-type-tab ${bodyType === 'none' ? 'active' : ''}`}
                                onClick={() => setBodyType('none')}
                            >
                                None
                            </div>
                            <div
                                className={`body-type-tab ${bodyType === 'form-data' ? 'active' : ''}`}
                                onClick={() => setBodyType('form-data')}
                            >
                                Form Data
                            </div>
                            <div
                                className={`body-type-tab ${bodyType === 'x-www-form-urlencoded' ? 'active' : ''}`}
                                onClick={() => setBodyType('x-www-form-urlencoded')}
                            >
                                x-www-form-urlencoded
                            </div>
                            <div
                                className={`body-type-tab ${bodyType === 'raw' ? 'active' : ''}`}
                                onClick={() => setBodyType('raw')}
                            >
                                Raw
                            </div>
                            <div
                                className={`body-type-tab ${bodyType === 'binary' ? 'active' : ''}`}
                                onClick={() => setBodyType('binary')}
                            >
                                Binary
                            </div>
                        </div>

                        {bodyType === 'raw' && (<textarea
                            className={`body-editor ${getVariableInputClass(bodyContent)}`}
                            value={bodyContent}
                            onChange={(e) => setBodyContent(e.target.value)}
                            placeholder="Enter request body"
                            spellCheck="false"
                        />
                        )}

                        {bodyType === 'none' && (
                            <div className="empty-body">
                                This request does not have a body
                            </div>
                        )}

                        {(bodyType === 'form-data' || bodyType === 'x-www-form-urlencoded') && (
                            <div className="form-data-editor">
                                <div className="table-container">
                                    <table className="params-table">
                                        <thead>
                                            <tr>
                                                <th width="30"></th>
                                                <th width="30%">Key</th>
                                                <th width="30%">Value</th>
                                                <th width="30%">Description</th>
                                                <th width="40"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td>
                                                    <input type="checkbox" checked={true} />
                                                </td>
                                                <td>
                                                    <input type="text" placeholder="Key" />
                                                </td>
                                                <td>
                                                    <input type="text" placeholder="Value" />
                                                </td>
                                                <td>
                                                    <input type="text" placeholder="Description" />
                                                </td>
                                                <td>
                                                    <button className="delete-row-btn">×</button>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                <button className="add-row-btn">
                                    + Add
                                </button>
                            </div>
                        )}

                        {bodyType === 'binary' && (
                            <div className="binary-upload">
                                <input type="file" />
                            </div>
                        )}
                    </div>
                );

            case 'pre-request-script':
                return (
                    <div className="script-section">
                        <textarea
                            className="script-editor"
                            value={preRequestScript}
                            onChange={(e) => setPreRequestScript(e.target.value)}
                            placeholder="// Write pre-request script here (JavaScript)"
                            spellCheck="false"
                        />
                    </div>
                ); case 'tests':
                return (
                    <div className="script-section">
                        <textarea
                            className="script-editor"
                            value={tests}
                            onChange={(e) => setTests(e.target.value)}
                            placeholder="// Write test script here (JavaScript)"
                            spellCheck="false"
                        />
                    </div>
                ); case 'variables':
                return (
                    <div className="variables-section">
                        <VariableEditor
                            scope="request"
                            variables={variables}
                            onVariablesChange={setVariables}
                            helpText="Request-level variables override collection and environment variables during execution."
                        />
                    </div>
                ); case 'variable-preview':
                return (
                    <div className="variable-preview-section">
                        <div className="preview-header">
                            <h4>Variable Overview</h4>
                            <div className="preview-status">
                                {variableValidation.isValid ? (
                                    <span className="status-valid">✅ All variables resolved</span>
                                ) : (
                                    <span className="status-invalid">⚠️ {variableValidation.missingVariables.length} missing variables</span>
                                )}
                            </div>
                        </div>

                        <UnifiedVariableViewer
                            globalVariables={Array.isArray(globalVariables) ? globalVariables : Object.entries(globalVariables).map(([key, value]) => ({ key, value }))}
                            collectionVariables={Array.isArray(collectionVariables) ? collectionVariables : Object.entries(collectionVariables).map(([key, value]) => ({ key, value }))}
                            environmentVariables={Array.isArray(environmentVariables) ? environmentVariables : Object.entries(environmentVariables).map(([key, value]) => ({ key, value }))}
                            requestVariables={variables}
                            resolvedVariables={resolvedVariables}
                            compact={true}
                            showActions={false}
                        />

                        {!variableValidation.isValid && (
                            <div className="missing-variables-alert">
                                <h5>Missing Variables ({variableValidation.missingVariables.length})</h5>
                                <p>The following variables are referenced but not defined:</p>
                                <div className="missing-variables-list">
                                    {variableValidation.missingVariables.map(varName => (
                                        <code key={varName} className="missing-variable-name">{varName}</code>
                                    ))}
                                </div>
                                <p className="missing-variables-help">
                                    Define these variables in your environment, collection, or request variables.
                                </p>
                            </div>
                        )}

                        <div className="interpolated-preview">
                            <h5>Request Preview (with variables)</h5>
                            <div className="preview-url">
                                <strong>URL:</strong>
                                <code>{resolvedVariables ?
                                    url.replace(/\{\{([^}]+)\}\}/g, (match, varName) =>
                                        resolvedVariables[varName.trim()] || match
                                    ) : url
                                }</code>
                            </div>

                            {headers.filter(h => h.enabled && h.key).length > 0 && (
                                <div className="preview-headers">
                                    <strong>Headers:</strong>
                                    <div className="header-list">
                                        {headers.filter(h => h.enabled && h.key).map((header, index) => (
                                            <div key={index} className="header-item">
                                                <code>
                                                    {header.key.replace(/\{\{([^}]+)\}\}/g, (match, varName) =>
                                                        resolvedVariables[varName.trim()] || match
                                                    )}:&nbsp;
                                                    {header.value.replace(/\{\{([^}]+)\}\}/g, (match, varName) =>
                                                        resolvedVariables[varName.trim()] || match
                                                    )}
                                                </code>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {bodyType === 'raw' && bodyContent && (
                                <div className="preview-body">
                                    <strong>Body:</strong>
                                    <pre className="body-preview">
                                        {bodyContent.replace(/\{\{([^}]+)\}\}/g, (match, varName) =>
                                            resolvedVariables[varName.trim()] || match
                                        )}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="request-workspace">
            <form onSubmit={handleSubmit}>

                {/* URL bar */}
                <div className="request-url-bar">
                    <select
                        className="method-select"
                        data-method={method}
                        value={method}
                        onChange={handleMethodChange}
                    >
                        {HTTP_METHODS.map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>                    <input
                        type="text"
                        className={`url-input ${getVariableInputClass(url)}`}
                        value={url}
                        onChange={handleUrlChange}
                        placeholder="Enter request URL"
                        required
                    /><button type="submit" className="send-btn" disabled={isLoading || !variableValidation.isValid}>
                        {isLoading ? 'Sending...' : 'Send'}
                    </button>

                    <button type="button" className="save-btn" onClick={handleSave}>
                        Save
                    </button>
                </div>

                {/* Variable validation display */}
                {!variableValidation.isValid && (
                    <div className="variable-validation-error">
                        <div className="validation-header">
                            <span className="validation-icon">⚠️</span>
                            <span>Missing Variables</span>
                        </div>
                        <div className="missing-variables">
                            {variableValidation.missingVariables.map(varName => (
                                <span key={varName} className="missing-variable">
                                    {varName}
                                </span>
                            ))}
                        </div>
                        <div className="validation-message">
                            Please define these variables in your environment, collection, or request variables.
                        </div>
                    </div>
                )}

                {/* Request tabs */}
                <div className="request-tabs">
                    <div
                        className={`request-tab ${activeTab === 'params' ? 'active' : ''}`}
                        onClick={() => handleTabChange('params')}
                    >
                        Params
                    </div>
                    <div
                        className={`request-tab ${activeTab === 'headers' ? 'active' : ''}`}
                        onClick={() => handleTabChange('headers')}
                    >
                        Headers
                    </div>
                    <div
                        className={`request-tab ${activeTab === 'body' ? 'active' : ''}`}
                        onClick={() => handleTabChange('body')}
                    >
                        Body
                    </div>
                    <div
                        className={`request-tab ${activeTab === 'pre-request-script' ? 'active' : ''}`}
                        onClick={() => handleTabChange('pre-request-script')}
                    >
                        Pre-request Script
                    </div>                    <div
                        className={`request-tab ${activeTab === 'tests' ? 'active' : ''}`}
                        onClick={() => handleTabChange('tests')}
                    >
                        Tests
                    </div>                    <div
                        className={`request-tab ${activeTab === 'variables' ? 'active' : ''}`}
                        onClick={() => handleTabChange('variables')}
                    >
                        Variables
                    </div>
                    <div
                        className={`request-tab ${activeTab === 'variable-preview' ? 'active' : ''}`}
                        onClick={() => handleTabChange('variable-preview')}
                    >
                        Preview
                    </div>
                </div>

                {/* Tab content (direct, without extra container) */}
                {renderTabContent()}
            </form>

            {/* Only show this response section when there's data to display */}
            {(responseData || isLoading || responseError) && (
                <div className="response-section">
                    <h3>Response</h3>

                    {/* Loading indicator */}
                    {isLoading && <div className="loading-indicator">Loading...</div>}

                    {/* Response data display */}
                    {!isLoading && responseData && (
                        <ResponseDisplay responseData={responseData} />
                    )}

                    {/* Error message */}
                    {!isLoading && responseError && (
                        <div className="response-error">
                            Error: {responseError}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default RequestForm;