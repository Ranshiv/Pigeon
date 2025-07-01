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
    const [params, setParams] = useState(initialData.params || []);
    const [headers, setHeaders] = useState(initialData.headers || []);
    const [bodyType, setBodyType] = useState(initialData.bodyType || 'none');
    const [bodyContent, setBodyContent] = useState(initialData.body || '');
    const [preRequestScript, setPreRequestScript] = useState(initialData.preRequestScript || '');
    const [tests, setTests] = useState(initialData.tests || '');
    const [variables, setVariables] = useState(initialData.variables || []);

    // Authentication state
    const [authConfig, setAuthConfig] = useState(initialData.authConfig || {
        type: 'No Auth',
        bearer: { token: '' },
        basic: { username: '', password: '' },
        apiKey: { key: '', value: '', location: 'header' },
        oauth2: {
            grantType: 'authorization_code',
            clientId: '',
            clientSecret: '',
            authUrl: '',
            tokenUrl: '',
            scope: '',
            redirectUri: '',
            accessToken: '',
            refreshToken: '',
            tokenStatus: 'not_authenticated'
        }
    });

    // SSL configuration state
    const [sslConfig, setSSLConfig] = useState(initialData.sslConfig || {
        verifyCert: true,
        allowSelfSigned: false,
        clientCert: null,
        clientKey: null,
        passphrase: ''
    });

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
    };    // OAuth 2.0 handlers
    const handleAuthConfigChange = (field, value) => {
        setAuthConfig(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleOAuth2ConfigChange = (field, value) => {
        setAuthConfig(prev => ({
            ...prev,
            oauth2: {
                ...prev.oauth2,
                [field]: value
            }
        }));
    };

    const handleBasicAuthChange = (field, value) => {
        setAuthConfig(prev => ({
            ...prev,
            basic: {
                ...prev.basic,
                [field]: value
            }
        }));
    };

    const handleBearerTokenChange = (value) => {
        setAuthConfig(prev => ({
            ...prev,
            bearer: { token: value }
        }));
    };

    const handleApiKeyChange = (field, value) => {
        setAuthConfig(prev => ({
            ...prev,
            apiKey: {
                ...prev.apiKey,
                [field]: value
            }
        }));
    };

    const handleOAuth2Authorize = async () => {
        try {
            const { oauth2 } = authConfig;

            // Call backend to generate proper auth URL with state management
            const response = await fetch('/api/oauth/authorize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    clientId: oauth2.clientId,
                    clientSecret: oauth2.clientSecret,
                    authUrl: oauth2.authUrl,
                    tokenUrl: oauth2.tokenUrl,
                    redirectUri: oauth2.redirectUri || 'http://localhost:3000/oauth/callback',
                    scope: oauth2.scope || ''
                })
            });

            if (!response.ok) {
                throw new Error('Failed to generate authorization URL');
            }

            const { authUrl } = await response.json();

            // Open authorization window
            const popup = window.open(authUrl, 'oauth2', 'width=600,height=600');

            // Listen for the callback
            const messageListener = async (event) => {
                if (event.origin !== window.location.origin) return;

                if (event.data.type === 'OAUTH_CALLBACK') {
                    popup?.close();
                    window.removeEventListener('message', messageListener);

                    if (event.data.code) {
                        await handleOAuth2TokenExchange(event.data.code, event.data.state);
                    } else {
                        console.error('OAuth authorization failed:', event.data.error);
                        setAuthConfig(prev => ({
                            ...prev,
                            oauth2: {
                                ...prev.oauth2,
                                tokenStatus: 'error'
                            }
                        }));
                    }
                }
            };

            window.addEventListener('message', messageListener);

            // Update status
            setAuthConfig(prev => ({
                ...prev,
                oauth2: {
                    ...prev.oauth2,
                    tokenStatus: 'authorizing'
                }
            }));

        } catch (error) {
            console.error('OAuth authorization error:', error);
            setAuthConfig(prev => ({
                ...prev,
                oauth2: {
                    ...prev.oauth2,
                    tokenStatus: 'error'
                }
            }));
        }
    };

    const handleOAuth2TokenExchange = async (code, state) => {
        try {
            const response = await fetch('/api/oauth/exchange', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code,
                    state,
                    clientId: authConfig.oauth2.clientId,
                    clientSecret: authConfig.oauth2.clientSecret,
                    redirectUri: authConfig.oauth2.redirectUri || 'http://localhost:3000/oauth/callback',
                    tokenUrl: authConfig.oauth2.tokenUrl
                })
            });

            if (response.ok) {
                const tokens = await response.json();
                setAuthConfig(prev => ({
                    ...prev,
                    oauth2: {
                        ...prev.oauth2,
                        accessToken: tokens.access_token,
                        refreshToken: tokens.refresh_token,
                        tokenStatus: 'authenticated'
                    }
                }));
            } else {
                throw new Error('Token exchange failed');
            }
        } catch (error) {
            console.error('Token exchange error:', error);
            setAuthConfig(prev => ({
                ...prev,
                oauth2: {
                    ...prev.oauth2,
                    tokenStatus: 'error'
                }
            }));
        }
    };

    const handleOAuth2Refresh = async () => {
        try {
            const response = await fetch('/api/oauth/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    refreshToken: authConfig.oauth2.refreshToken,
                    clientId: authConfig.oauth2.clientId,
                    clientSecret: authConfig.oauth2.clientSecret,
                    tokenUrl: authConfig.oauth2.tokenUrl
                })
            });

            if (response.ok) {
                const tokens = await response.json();
                setAuthConfig(prev => ({
                    ...prev,
                    oauth2: {
                        ...prev.oauth2,
                        accessToken: tokens.access_token,
                        refreshToken: tokens.refresh_token || prev.oauth2.refreshToken,
                        tokenStatus: 'authenticated'
                    }
                }));
            } else {
                throw new Error('Token refresh failed');
            }
        } catch (error) {
            console.error('Token refresh error:', error);
            setAuthConfig(prev => ({
                ...prev,
                oauth2: {
                    ...prev.oauth2,
                    tokenStatus: 'error'
                }
            }));
        }
    };

    const handleOAuth2Clear = () => {
        setAuthConfig(prev => ({
            ...prev,
            oauth2: {
                ...prev.oauth2,
                accessToken: '',
                refreshToken: '',
                tokenStatus: 'not_authenticated'
            }
        }));
    };

    // SSL configuration handlers
    const handleSSLConfigChange = (field, value) => {
        setSSLConfig(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // File validation helper
    const validateCertificateFile = (file, type) => {
        const validExtensions = type === 'clientCert'
            ? ['.crt', '.pem', '.cert', '.cer']
            : ['.key', '.pem'];

        const isValidExtension = validExtensions.some(ext =>
            file.name.toLowerCase().endsWith(ext)
        );

        if (!isValidExtension) {
            return {
                valid: false,
                error: `Invalid file type. Expected: ${validExtensions.join(', ')}`
            };
        }

        // Check file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            return {
                valid: false,
                error: 'File size too large. Maximum 10MB allowed.'
            };
        }

        return { valid: true };
    };

    const handleCertificateUpload = async (type, file) => {
        try {
            // Validate file first
            const validation = validateCertificateFile(file, type);
            if (!validation.valid) {
                alert(validation.error);
                return;
            }

            // Set loading state
            setSSLConfig(prev => ({
                ...prev,
                [`${type}Loading`]: true
            }));

            const formData = new FormData();

            // Add the file with the correct field name
            if (type === 'clientCert') {
                formData.append('certificate', file);
            } else if (type === 'clientKey') {
                formData.append('privateKey', file);
            }

            // Add required metadata
            formData.append('workspaceId', workspaceId || 'default');
            formData.append('name', `${type}_${Date.now()}`);

            // Add passphrase if provided
            if (sslConfig.passphrase) {
                formData.append('passphrase', sslConfig.passphrase);
            }

            const response = await fetch(getApiUrl('/api/certificates/upload'), {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });

            if (response.ok) {
                const result = await response.json();
                setSSLConfig(prev => ({
                    ...prev,
                    [type]: {
                        filename: file.name,
                        size: file.size,
                        certificateId: result.certificate.id,
                        info: result.certificate,
                        uploadedAt: new Date().toISOString()
                    },
                    [`${type}Loading`]: false
                }));

                // Show success message (replace alert with better UX)
                console.log(`${type === 'clientCert' ? 'Certificate' : 'Private key'} uploaded successfully!`);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || errorData.error || 'Upload failed');
            }
        } catch (error) {
            console.error('Certificate upload error:', error);
            setSSLConfig(prev => ({
                ...prev,
                [`${type}Loading`]: false,
                [`${type}Error`]: error.message
            }));

            // Show error message
            alert(`Failed to upload ${type === 'clientCert' ? 'certificate' : 'private key'}: ${error.message}`);
        }
    };

    const handleTestSSLConnection = async () => {
        try {
            if (!url) {
                alert('Please enter a URL first');
                return;
            }

            const response = await fetch('/api/certificates/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url,
                    sslConfig
                })
            });

            const result = await response.json();
            alert(`SSL Test Result: ${result.valid ? 'Valid' : 'Invalid'}\nDetails: ${result.details}`);
        } catch (error) {
            console.error('SSL test error:', error);
            alert(`SSL test failed: ${error.message}`);
        }
    };

    // ...existing code...
    // Save button handler
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
            authConfig,
            sslConfig,
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
            authConfig,
            sslConfig,
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
                                            </td>
                                            <td>
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
                                            </td>
                                            <td>
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

            case 'authorization':
                return (
                    <div className="auth-section">
                        <div className="auth-config">
                            <div className="auth-type-selector">
                                <label htmlFor="auth-type">Authentication Type:</label>
                                <select
                                    id="auth-type"
                                    value={authConfig.type}
                                    onChange={(e) => handleAuthConfigChange('type', e.target.value)}
                                    className="auth-type-select"
                                >
                                    <option value="No Auth">No Auth</option>
                                    <option value="Bearer Token">Bearer Token</option>
                                    <option value="Basic Auth">Basic Auth</option>
                                    <option value="API Key">API Key</option>
                                    <option value="OAuth 2.0">OAuth 2.0</option>
                                </select>
                            </div>

                            {authConfig.type === 'Bearer Token' && (
                                <div className="auth-form">
                                    <div className="form-group">
                                        <label htmlFor="bearer-token">Token:</label>
                                        <input
                                            id="bearer-token"
                                            type="text"
                                            value={authConfig.bearer.token}
                                            onChange={(e) => handleBearerTokenChange(e.target.value)}
                                            placeholder="Enter bearer token"
                                            className="auth-input"
                                        />
                                    </div>
                                </div>
                            )}

                            {authConfig.type === 'Basic Auth' && (
                                <div className="auth-form">
                                    <div className="form-group">
                                        <label htmlFor="basic-username">Username:</label>
                                        <input
                                            id="basic-username"
                                            type="text"
                                            value={authConfig.basic.username}
                                            onChange={(e) => handleBasicAuthChange('username', e.target.value)}
                                            placeholder="Username"
                                            className="auth-input"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="basic-password">Password:</label>
                                        <input
                                            id="basic-password"
                                            type="password"
                                            value={authConfig.basic.password}
                                            onChange={(e) => handleBasicAuthChange('password', e.target.value)}
                                            placeholder="Password"
                                            className="auth-input"
                                        />
                                    </div>
                                </div>
                            )}

                            {authConfig.type === 'API Key' && (
                                <div className="auth-form">
                                    <div className="form-group">
                                        <label htmlFor="api-key">Key:</label>
                                        <input
                                            id="api-key"
                                            type="text"
                                            value={authConfig.apiKey.key}
                                            onChange={(e) => handleApiKeyChange('key', e.target.value)}
                                            placeholder="API key name"
                                            className="auth-input"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="api-value">Value:</label>
                                        <input
                                            id="api-value"
                                            type="text"
                                            value={authConfig.apiKey.value}
                                            onChange={(e) => handleApiKeyChange('value', e.target.value)}
                                            placeholder="API key value"
                                            className="auth-input"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="api-location">Add to:</label>
                                        <select
                                            id="api-location"
                                            value={authConfig.apiKey.location}
                                            onChange={(e) => handleApiKeyChange('location', e.target.value)}
                                            className="auth-select"
                                        >
                                            <option value="header">Header</option>
                                            <option value="query">Query Params</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {authConfig.type === 'OAuth 2.0' && (
                                <div className="auth-form oauth-form">
                                    <div className="oauth-status">
                                        <div className={`status-indicator ${authConfig.oauth2.tokenStatus}`}>
                                            {authConfig.oauth2.tokenStatus === 'authenticated' ? '🟢' :
                                                authConfig.oauth2.tokenStatus === 'authorizing' ? '🟡' :
                                                    authConfig.oauth2.tokenStatus === 'error' ? '🔴' : '⚪'}
                                        </div>
                                        <span className="status-text">
                                            {authConfig.oauth2.tokenStatus === 'authenticated' ? 'Authenticated' :
                                                authConfig.oauth2.tokenStatus === 'authorizing' ? 'Authorizing...' :
                                                    authConfig.oauth2.tokenStatus === 'error' ? 'Authentication Error' :
                                                        'Not Authenticated'}
                                        </span>
                                    </div>

                                    <div className="form-row">
                                        <div className="form-group">
                                            <label htmlFor="oauth-grant-type">Grant Type:</label>
                                            <select
                                                id="oauth-grant-type"
                                                value={authConfig.oauth2.grantType}
                                                onChange={(e) => handleOAuth2ConfigChange('grantType', e.target.value)}
                                                className="auth-select"
                                            >
                                                <option value="authorization_code">Authorization Code</option>
                                                <option value="client_credentials">Client Credentials</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label htmlFor="oauth-client-id">Client ID:</label>
                                            <input
                                                id="oauth-client-id"
                                                type="text"
                                                value={authConfig.oauth2.clientId}
                                                onChange={(e) => handleOAuth2ConfigChange('clientId', e.target.value)}
                                                placeholder="Client ID"
                                                className="auth-input"
                                            />
                                        </div>
                                    </div>

                                    <div className="form-row">
                                        <div className="form-group">
                                            <label htmlFor="oauth-client-secret">Client Secret:</label>
                                            <input
                                                id="oauth-client-secret"
                                                type="password"
                                                value={authConfig.oauth2.clientSecret}
                                                onChange={(e) => handleOAuth2ConfigChange('clientSecret', e.target.value)}
                                                placeholder="Client Secret"
                                                className="auth-input"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label htmlFor="oauth-scope">Scope:</label>
                                            <input
                                                id="oauth-scope"
                                                type="text"
                                                value={authConfig.oauth2.scope}
                                                onChange={(e) => handleOAuth2ConfigChange('scope', e.target.value)}
                                                placeholder="read write"
                                                className="auth-input"
                                            />
                                        </div>
                                    </div>

                                    <div className="form-row">
                                        <div className="form-group">
                                            <label htmlFor="oauth-auth-url">Auth URL:</label>
                                            <input
                                                id="oauth-auth-url"
                                                type="url"
                                                value={authConfig.oauth2.authUrl}
                                                onChange={(e) => handleOAuth2ConfigChange('authUrl', e.target.value)}
                                                placeholder="https://example.com/oauth/authorize"
                                                className="auth-input"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label htmlFor="oauth-token-url">Token URL:</label>
                                            <input
                                                id="oauth-token-url"
                                                type="url"
                                                value={authConfig.oauth2.tokenUrl}
                                                onChange={(e) => handleOAuth2ConfigChange('tokenUrl', e.target.value)}
                                                placeholder="https://example.com/oauth/token"
                                                className="auth-input"
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="oauth-redirect-uri">Redirect URI:</label>
                                        <input
                                            id="oauth-redirect-uri"
                                            type="url"
                                            value={authConfig.oauth2.redirectUri}
                                            onChange={(e) => handleOAuth2ConfigChange('redirectUri', e.target.value)}
                                            placeholder="http://localhost:3000/oauth/callback"
                                            className="auth-input"
                                        />
                                    </div>

                                    <div className="oauth-actions">
                                        <button
                                            type="button"
                                            className="btn-primary"
                                            onClick={handleOAuth2Authorize}
                                            disabled={!authConfig.oauth2.clientId || !authConfig.oauth2.authUrl}
                                        >
                                            Authorize
                                        </button>
                                        {authConfig.oauth2.refreshToken && (
                                            <button
                                                type="button"
                                                className="btn-secondary"
                                                onClick={handleOAuth2Refresh}
                                            >
                                                Refresh Token
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            className="btn-secondary"
                                            onClick={handleOAuth2Clear}
                                        >
                                            Clear Tokens
                                        </button>
                                    </div>

                                    {authConfig.oauth2.accessToken && (
                                        <div className="token-display">
                                            <label>Access Token:</label>
                                            <input
                                                type="text"
                                                value={authConfig.oauth2.accessToken}
                                                readOnly
                                                className="token-input"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'ssl':
                return (
                    <div className="ssl-section">
                        <div className="ssl-config">
                            <div className="ssl-options">
                                <div className="form-group">
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={sslConfig.verifyCert}
                                            onChange={(e) => handleSSLConfigChange('verifyCert', e.target.checked)}
                                        />
                                        <span>Verify SSL certificates</span>
                                    </label>
                                </div>
                                <div className="form-group">
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={sslConfig.allowSelfSigned}
                                            onChange={(e) => handleSSLConfigChange('allowSelfSigned', e.target.checked)}
                                        />
                                        <span>Allow self-signed certificates</span>
                                    </label>
                                </div>
                            </div>

                            <div className="certificate-upload">
                                <h4>Client Certificates</h4>
                                <div className="cert-upload-section">
                                    {/* Client Certificate Upload */}
                                    <div className="cert-upload-container">
                                        <label className="cert-upload-label">
                                            <span className="cert-type-title">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                    <polyline points="14,2 14,8 20,8" />
                                                    <line x1="16" y1="13" x2="8" y2="13" />
                                                    <line x1="16" y1="17" x2="8" y2="17" />
                                                    <polyline points="10,9 9,9 8,9" />
                                                </svg>
                                                Client Certificate
                                            </span>
                                            <span className="cert-file-types">(.crt, .pem, .cert)</span>
                                        </label>

                                        <div
                                            className={`cert-drop-zone ${sslConfig.clientCert ? 'has-file' : ''}`}
                                            onClick={() => !sslConfig.clientCert && !sslConfig.clientCertLoading && document.getElementById('client-cert').click()}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                e.currentTarget.classList.remove('drag-over');
                                                const file = e.dataTransfer.files[0];
                                                if (file && ['.crt', '.pem', '.cert'].some(ext => file.name.toLowerCase().endsWith(ext))) {
                                                    handleCertificateUpload('clientCert', file);
                                                }
                                            }}
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                e.currentTarget.classList.add('drag-over');
                                            }}
                                            onDragEnter={(e) => {
                                                e.preventDefault();
                                                e.currentTarget.classList.add('drag-over');
                                            }}
                                            onDragLeave={(e) => {
                                                e.preventDefault();
                                                if (!e.currentTarget.contains(e.relatedTarget)) {
                                                    e.currentTarget.classList.remove('drag-over');
                                                }
                                            }}
                                        >
                                            <input
                                                id="client-cert"
                                                type="file"
                                                accept=".crt,.pem,.cert"
                                                onChange={(e) => {
                                                    const file = e.target.files[0];
                                                    if (file) handleCertificateUpload('clientCert', file);
                                                }}
                                                className="cert-file-input"
                                                hidden
                                            />

                                            {sslConfig.clientCertLoading ? (
                                                <div className="drop-zone-content">
                                                    <div className="upload-icon uploading">
                                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M21 12a9 9 0 11-6.219-8.56" />
                                                        </svg>
                                                    </div>
                                                    <div className="upload-text">
                                                        <span className="upload-primary">Uploading certificate...</span>
                                                        <span className="upload-secondary">Please wait</span>
                                                    </div>
                                                </div>
                                            ) : !sslConfig.clientCert ? (
                                                <div className="drop-zone-content">
                                                    <div className="upload-icon">
                                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                            <polyline points="7,10 12,15 17,10" />
                                                            <line x1="12" y1="15" x2="12" y2="3" />
                                                        </svg>
                                                    </div>
                                                    <div className="upload-text">
                                                        <span className="upload-primary">Drop certificate file here</span>
                                                        <span className="upload-secondary">or click to browse</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="uploaded-file">
                                                    <div className="file-icon">
                                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M9 12l2 2 4-4" />
                                                            <path d="M21 12c.552 0 1-.448 1-1V8a2 2 0 00-2-2h-5L9 3H4a2 2 0 00-2 2v13a2 2 0 002 2h16a2 2 0 002-2v-1c0-.552-.448-1-1-1z" />
                                                        </svg>
                                                    </div>
                                                    <div className="file-details">
                                                        <div className="file-name">{sslConfig.clientCert.filename}</div>
                                                        <div className="file-meta">
                                                            <span className="file-size">{Math.round(sslConfig.clientCert.size / 1024)} KB</span>
                                                            {sslConfig.clientCert.info && (
                                                                <span className="cert-validity">
                                                                    Valid until: {new Date(sslConfig.clientCert.info.validTo).toLocaleDateString()}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="remove-file-btn"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSSLConfig(prev => ({ ...prev, clientCert: null }));
                                                        }}
                                                        title="Remove certificate"
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <line x1="18" y1="6" x2="6" y2="18" />
                                                            <line x1="6" y1="6" x2="18" y2="18" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Client Key Upload */}
                                    <div className="cert-upload-container">
                                        <label className="cert-upload-label">
                                            <span className="cert-type-title">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                                    <circle cx="12" cy="16" r="1" />
                                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                                </svg>
                                                Private Key
                                            </span>
                                            <span className="cert-file-types">(.key, .pem)</span>
                                        </label>

                                        <div
                                            className={`cert-drop-zone ${sslConfig.clientKey ? 'has-file' : ''}`}
                                            onClick={() => !sslConfig.clientKey && !sslConfig.clientKeyLoading && document.getElementById('client-key').click()}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                e.currentTarget.classList.remove('drag-over');
                                                const file = e.dataTransfer.files[0];
                                                if (file && ['.key', '.pem'].some(ext => file.name.toLowerCase().endsWith(ext))) {
                                                    handleCertificateUpload('clientKey', file);
                                                }
                                            }}
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                e.currentTarget.classList.add('drag-over');
                                            }}
                                            onDragEnter={(e) => {
                                                e.preventDefault();
                                                e.currentTarget.classList.add('drag-over');
                                            }}
                                            onDragLeave={(e) => {
                                                e.preventDefault();
                                                if (!e.currentTarget.contains(e.relatedTarget)) {
                                                    e.currentTarget.classList.remove('drag-over');
                                                }
                                            }}
                                        >
                                            <input
                                                id="client-key"
                                                type="file"
                                                accept=".key,.pem"
                                                onChange={(e) => {
                                                    const file = e.target.files[0];
                                                    if (file) handleCertificateUpload('clientKey', file);
                                                }}
                                                className="cert-file-input"
                                                hidden
                                            />

                                            {sslConfig.clientKeyLoading ? (
                                                <div className="drop-zone-content">
                                                    <div className="upload-icon uploading">
                                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M21 12a9 9 0 11-6.219-8.56" />
                                                        </svg>
                                                    </div>
                                                    <div className="upload-text">
                                                        <span className="upload-primary">Uploading private key...</span>
                                                        <span className="upload-secondary">Please wait</span>
                                                    </div>
                                                </div>
                                            ) : !sslConfig.clientKey ? (
                                                <div className="drop-zone-content">
                                                    <div className="upload-icon">
                                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                            <polyline points="7,10 12,15 17,10" />
                                                            <line x1="12" y1="15" x2="12" y2="3" />
                                                        </svg>
                                                    </div>
                                                    <div className="upload-text">
                                                        <span className="upload-primary">Drop private key here</span>
                                                        <span className="upload-secondary">or click to browse</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="uploaded-file">
                                                    <div className="file-icon">
                                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M9 12l2 2 4-4" />
                                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                                            <circle cx="12" cy="16" r="1" />
                                                        </svg>
                                                    </div>
                                                    <div className="file-details">
                                                        <div className="file-name">{sslConfig.clientKey.filename}</div>
                                                        <div className="file-meta">
                                                            <span className="file-size">{Math.round(sslConfig.clientKey.size / 1024)} KB</span>
                                                            <span className="key-status">Encrypted</span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="remove-file-btn"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSSLConfig(prev => ({ ...prev, clientKey: null }));
                                                        }}
                                                        title="Remove private key"
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <line x1="18" y1="6" x2="6" y2="18" />
                                                            <line x1="6" y1="6" x2="18" y2="18" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Passphrase Input */}
                                    <div className="form-group passphrase-group">
                                        <label htmlFor="cert-passphrase" className="passphrase-label">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                            </svg>
                                            Certificate Passphrase
                                            <span className="optional-label">(optional)</span>
                                        </label>
                                        <div className="passphrase-input-container">
                                            <input
                                                id="cert-passphrase"
                                                type="password"
                                                value={sslConfig.passphrase}
                                                onChange={(e) => handleSSLConfigChange('passphrase', e.target.value)}
                                                placeholder="Enter passphrase if your certificate is encrypted"
                                                className="passphrase-input"
                                            />
                                            {sslConfig.passphrase && (
                                                <div className="passphrase-strength">
                                                    <div className="strength-indicator">
                                                        <div className="strength-bar" />
                                                    </div>
                                                    <span className="strength-text">Protected</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="ssl-actions">
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={handleTestSSLConnection}
                                    disabled={!url}
                                >
                                    Test SSL Connection
                                </button>
                            </div>
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
                        className={`request-tab ${activeTab === 'authorization' ? 'active' : ''}`}
                        onClick={() => handleTabChange('authorization')}
                    >
                        🔒 Authorization
                    </div>
                    <div
                        className={`request-tab ${activeTab === 'body' ? 'active' : ''}`}
                        onClick={() => handleTabChange('body')}
                    >
                        Body
                    </div>
                    <div
                        className={`request-tab ${activeTab === 'ssl' ? 'active' : ''}`}
                        onClick={() => handleTabChange('ssl')}
                    >
                        🛡️ SSL
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