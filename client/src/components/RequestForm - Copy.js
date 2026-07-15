import React, { useState, useEffect, useCallback } from 'react';
import './RequestForm.css';
import {
    List,
    Link as LinkIcon,
    Lock,
    Box,
    ShieldCheck,
    Braces,
    Zap,
    CheckCircle2,
    Key,
    Eye,
    Activity,
    Terminal,
    FolderOutput,
    Plus,
    X,
    Trash2,
    UploadCloud,
    FileCheck2,
    KeyRound,
    EyeOff,
    SquarePen,
    RefreshCw,
    GitBranch,
    Network,
    ZoomIn,
    Maximize2,
    RotateCcw,
    Globe,
    ListChecks,
    FileText,
    Cable,
    Send,
    PackageCheck
} from 'lucide-react';
import ResponseDisplay from './ResponseDisplay';
import VariableEditor from './VariableEditor';
import TabBar from './common/TabBar/TabBar';
import UnifiedVariableViewer from './UnifiedVariableViewer';
import { interpolateRequest, resolveVariables, validateVariables, extractVariables } from '../utils/variableInterpolation';
import { PostRequestScriptService } from './VisualApiDesigner/services/PostRequestScriptService';
import { VisualizationDebugger } from './VisualApiDesigner/services/VisualizationDebugger';
import { ExportService } from './VisualApiDesigner/services/ExportService';
import { AuthVisualizationService } from './VisualApiDesigner/services/AuthVisualizationService';
import { NetworkFlowService } from './VisualApiDesigner/services/NetworkFlowService';

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
    collectionId, workspaceId, environmentId, collection, onResponse, hideResponse }) => {
    // Use either initialRequest or request prop (for backward compatibility)
    const initialData = request || initialRequest || {};

    // Form state
    const [method, setMethod] = useState(initialData.method || 'GET');
    const [url, setUrl] = useState(initialData.url || '');
    const [requestName, setRequestName] = useState(initialData.name || 'Get Users');
    const [activeTab, setActiveTab] = useState('params');
    const [isNew, setIsNew] = useState(initialData.isNew || false);

    // Response state - new state for storing response
    const [responseData, setResponseData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [responseError, setResponseError] = useState(null);

    // Tab content states
    const [params, setParams] = useState(initialData.params || []);
    const [headers, setHeaders] = useState(initialData.headers || []);
    const [bodyType, setBodyType] = useState(initialData.bodyType || 'none');
    const [bodyContent, setBodyContent] = useState(initialData.body || '');
    const [formDataFields, setFormDataFields] = useState(initialData.formData || []);
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
    // Derived from the collection prop — a useState would capture the initial
    // value and stay stale when collection changes (edits in another tab, etc.).
    const collectionVariables = collection?.variables || [];
    const [globalVariables, setGlobalVariables] = useState({});
    const [variableValidation, setVariableValidation] = useState({ isValid: true, missingVariables: [] });

    // Advanced features state
    const [showVisualizationDebugger, setShowVisualizationDebugger] = useState(false);
    const [postRequestScriptResults, setPostRequestScriptResults] = useState(null);
    const [authFlowVisualization, setAuthFlowVisualization] = useState(null);
    const [networkFlowData, setNetworkFlowData] = useState(null);
    const [debugConsoleOutput, setDebugConsoleOutput] = useState([]);
    const [exportOptions, setExportOptions] = useState({
        format: 'png',
        quality: 1.0,
        includeMetadata: true
    });
    const [exportPreview, setExportPreview] = useState(null);

    // Re-sync form state when user switches between requests.
    useEffect(() => {
        const nextData = request || initialRequest || {};

        setMethod(nextData.method || 'GET');
        setUrl(nextData.url || '');
        setRequestName(nextData.name || 'Get Users');
        setParams(nextData.params || []);
        setHeaders(nextData.headers || []);
        setBodyType(nextData.bodyType || 'none');
        setBodyContent(nextData.body || '');
        setFormDataFields(nextData.formData || []);
        setPreRequestScript(nextData.preRequestScript || '');
        setTests(nextData.tests || nextData.testScript || '');
        setVariables(nextData.variables || []);
        setAuthConfig(nextData.authConfig || {
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
        setSSLConfig(nextData.sslConfig || {
            verifyCert: true,
            allowSelfSigned: false,
            clientCert: null,
            clientKey: null,
            passphrase: ''
        });
        setIsNew(Boolean(nextData.isNew));

        // Clear the previous request's response so switching requests doesn't
        // leave a stale 200/error from the prior one on screen.
        setResponseData(null);
        setResponseError(null);
        setIsLoading(false);
        setPostRequestScriptResults(null);
    }, [request, initialRequest]);

    // Debug console state
    const [currentDebugSession, setCurrentDebugSession] = useState(null);
    const [consoleFilter, setConsoleFilter] = useState('all');

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
    };

    // Form-data field handlers
    const handleFormDataChange = (index, field, value) => {
        const next = [...formDataFields];
        next[index] = { ...next[index], [field]: value };
        setFormDataFields(next);
    };

    const handleAddFormDataField = () => {
        setFormDataFields([...formDataFields, { enabled: true, key: '', value: '', type: 'text', description: '' }]);
    };

    const handleRemoveFormDataField = (index) => {
        const next = [...formDataFields];
        next.splice(index, 1);
        setFormDataFields(next);
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

    // Save button handler
    const handleSave = () => {
        // Build request object
        const requestData = {
            _id: initialData._id || initialData.id,
            id: initialData.id || initialData._id,
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
            _id: initialData._id || initialData.id,
            id: initialData.id || initialData._id,
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
        }

        // If no external handlers exist, process the request directly using interpolated data
        setIsLoading(true);
        setResponseData(null);
        setResponseError(null);
        if (onResponse) onResponse(null, true, null);

        // Add debug console integration
        const debugSessionId = currentDebugSession?.id;
        const isDebugging = debugSessionId && typeof VisualizationDebugger !== 'undefined';

        // Declare requestId at function scope so it's available in catch block
        let requestId = null;

        try {
            // Log request start in debug console
            if (isDebugging) {
                VisualizationDebugger.addLog(debugSessionId, 'info', `🚀 Executing ${interpolatedRequest.method} request to ${interpolatedRequest.url}`);
                VisualizationDebugger.addLog(debugSessionId, 'debug', `⏱️ Request started at ${new Date().toLocaleTimeString()}`);
                VisualizationDebugger.addNetworkRequest(debugSessionId, {
                    id: `req-${Date.now()}`,
                    method: interpolatedRequest.method,
                    url: interpolatedRequest.url,
                    status: 'pending',
                    startTime: Date.now()
                });
            }

            // Prepare the request headers from interpolated data
            const headerObj = {};
            interpolatedRequest.headers.forEach(h => {
                if (h.enabled && h.key) {
                    headerObj[h.key] = h.value;
                }
            });

            // Log headers in debug console
            if (isDebugging && Object.keys(headerObj).length > 0) {
                VisualizationDebugger.addLog(debugSessionId, 'info', `📋 Request headers:`, headerObj);
            }

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

            // Log request body in debug console
            if (isDebugging && requestBody) {
                VisualizationDebugger.addLog(debugSessionId, 'info', `📤 Request body:`, requestBody);
            }

            const startTime = Date.now();
            requestId = `req-${startTime}`;

            // Log that we're making the actual HTTP request
            if (isDebugging) {
                VisualizationDebugger.addLog(debugSessionId, 'info', `📡 Sending HTTP request via proxy...`);
            }

            // Use proxy endpoint with interpolated URL and debug flag
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
                    timeout: 30000,
                    debug: isDebugging, // Enable debug logging on backend
                    debugSessionId: debugSessionId
                }),
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Server responded with status ${response.status}`);
            }

            // Log that we received a response
            if (isDebugging) {
                VisualizationDebugger.addLog(debugSessionId, 'info', `📥 Received response, parsing data...`);
            }

            const responseData = await response.json();
            const endTime = Date.now();

            // The proxy already provides all the information we need
            const finalResponseData = {
                ...responseData,
                duration: endTime - startTime
            };

            // Log response in debug console
            if (isDebugging) {
                VisualizationDebugger.addLog(debugSessionId, 'success', `✅ Response received: ${finalResponseData.status} ${finalResponseData.statusText} (${finalResponseData.duration}ms)`);
                VisualizationDebugger.addLog(debugSessionId, 'info', `📥 Response body:`, finalResponseData.body);

                // Update network request with completion
                VisualizationDebugger.updateNetworkRequest(debugSessionId, requestId, {
                    status: 'completed',
                    statusCode: finalResponseData.status,
                    statusText: finalResponseData.statusText,
                    endTime: endTime,
                    duration: finalResponseData.duration,
                    size: finalResponseData.size,
                    headers: finalResponseData.headers
                });
            }

            setResponseData(finalResponseData);
            if (onResponse) onResponse(finalResponseData, false, null);

            // Process backend debug logs if provided (removed verbose console logging)
            if (finalResponseData.debugLogs && finalResponseData.debugLogs.length > 0 && isDebugging) {
                finalResponseData.debugLogs.forEach((log) => {
                    VisualizationDebugger.addLog(debugSessionId, log.level || 'info', `🔧 Backend: ${log.message}`, log.data);
                });
            }

        } catch (err) {
            const errorMessage = err.message || "An error occurred while sending the request";
            setResponseError(errorMessage);
            if (onResponse) onResponse(null, false, errorMessage);

            // Log error in debug console
            if (isDebugging) {
                VisualizationDebugger.addLog(debugSessionId, 'error', `❌ Request failed: ${errorMessage}`);
                VisualizationDebugger.updateNetworkRequest(debugSessionId, requestId, {
                    status: 'failed',
                    error: errorMessage,
                    endTime: Date.now()
                });
            }
            console.error("Request error:", err);

            // Add error to debug logs using VisualizationDebugger
            if (typeof VisualizationDebugger !== 'undefined') {
                VisualizationDebugger.log(
                    `Request failed: ${errorMessage}`,
                    'error',
                    {
                        error: errorMessage,
                        url: interpolatedRequest.url,
                        method: interpolatedRequest.method
                    }
                );
            }
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

    // Initialize services
    useEffect(() => {
        PostRequestScriptService.initialize();
        // Initialize VisualizationDebugger for modern debug experience
        if (typeof VisualizationDebugger !== 'undefined') {
            VisualizationDebugger.initialize();
            // Clean up any existing popup panels on component mount
            VisualizationDebugger.removePopupPanels();

            // Create a default debug session if none exists
            const debugSessionId = 'default-debug-session-' + Date.now();
            const debugContainer = document.getElementById('visualization-debugger-container');

            if (debugContainer) {
                // Initialize a default session for console logs
                const sessionData = {
                    url: window.location.href,
                    method: 'GET',
                    title: 'Debug Console'
                };

                const session = VisualizationDebugger.startSession(
                    debugSessionId,
                    debugContainer,
                    sessionData
                );

                // Set the current debug session
                setCurrentDebugSession(session);

                // Add initial welcome message
                VisualizationDebugger.addLog(debugSessionId, 'info', `🎯 Debug console initialized and ready to capture logs`);
            }
        }
        AuthVisualizationService.initialize();
    }, []); // Remove activeTab dependency to prevent re-running

    // Separate useEffect for debug tab functionality
    useEffect(() => {
        if (activeTab !== 'debug-console') return;

        // Use a timeout to ensure DOM elements are ready
        const timeoutId = setTimeout(() => {
            const debugTabs = document.querySelectorAll('.debug-tab');
            const debugPanels = document.querySelectorAll('.debug-panel');

            if (debugTabs.length === 0) return; // Exit if no debug tabs found

            // Check if event listeners are already attached
            const firstTab = debugTabs[0];
            if (firstTab.getAttribute('data-listeners-attached') === 'true') {
                return; // Listeners already attached, don't add again
            }

            // Create click handler function
            const handleTabClick = function () {
                // Remove active class from all tabs and panels
                debugTabs.forEach(t => t.classList.remove('active'));
                debugPanels.forEach(p => p.classList.remove('active'));

                // Add active class to clicked tab
                this.classList.add('active');

                // Show corresponding panel
                const tabName = this.getAttribute('data-tab');
                const targetPanel = document.getElementById(`${tabName}-panel`);
                if (targetPanel) {
                    targetPanel.classList.add('active');
                }

                // Use VisualizationDebugger's tab switching if available
                if (typeof VisualizationDebugger !== 'undefined' && VisualizationDebugger.switchTab) {
                    VisualizationDebugger.switchTab(tabName);
                }
            };

            // Add event listeners and mark them as attached
            debugTabs.forEach(tab => {
                tab.addEventListener('click', handleTabClick);
                tab.setAttribute('data-listeners-attached', 'true');
            });
        }, 100); // Small delay to ensure DOM is ready

        // Cleanup function
        return () => {
            clearTimeout(timeoutId);
        };
    }, [activeTab]);

    // Handle post-request script execution
    const handlePostRequestScript = useCallback(async (response) => {
        if (!tests.trim()) return;

        try {
            const result = await PostRequestScriptService.executePostRequestScript(
                tests,
                response,
                {
                    url,
                    method,
                    headers: headers.filter(h => h.enabled && h.key),
                    body: bodyContent
                },
                resolvedVariables || {}
            );

            setPostRequestScriptResults(result);

            // If visualizations were created, show them
            if (result.visualizations && result.visualizations.length > 0) {
                // Trigger visualization display
                window.dispatchEvent(new CustomEvent('pigeon:showVisualizations', {
                    detail: { visualizations: result.visualizations }
                }));
            }

        } catch (error) {
            console.error('Post-request script execution failed:', error);
            setPostRequestScriptResults({
                success: false,
                errors: [error.message],
                visualizations: []
            });
        }
    }, [tests, url, method, headers, bodyContent, resolvedVariables]);

    // Handle authentication flow visualization
    const handleAuthFlowVisualization = useCallback(() => {
        if (authConfig.type === 'No Auth') return;

        try {
            const containerId = 'auth-flow-container';
            const flowType = authConfig.type.toLowerCase().replace(/\s+/g, '_');

            const cy = AuthVisualizationService.createInteractiveAuthFlow(
                containerId,
                flowType,
                authConfig
            );

            setAuthFlowVisualization(cy);
        } catch (error) {
            console.error('Auth flow visualization failed:', error);
        }
    }, [authConfig]);

    // Handle export functionality
    const handleExport = useCallback(async (element, format) => {
        try {
            const result = await ExportService.exportVisualization(element, format, exportOptions);
            console.log('Export completed:', result);
        } catch (error) {
            console.error('Export failed:', error);
        }
    }, [exportOptions]);

    // Generate export preview content
    const generateExportPreview = useCallback(async (format) => {
        try {
            const requestData = {
                method,
                url,
                headers: headers.filter(h => h.enabled && h.key && h.value),
                body: bodyType !== 'none' ? bodyContent : null,
                name: requestName
            };

            let preview = null;

            switch (format) {
                case 'postman':
                    const postmanCollection = {
                        info: {
                            name: 'Pigeon API Collection',
                            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
                        },
                        item: [{
                            name: requestData.name,
                            request: {
                                method: requestData.method,
                                url: requestData.url,
                                header: requestData.headers.map(h => ({
                                    key: h.key,
                                    value: h.value,
                                    enabled: h.enabled !== false
                                })),
                                body: requestData.body ? {
                                    mode: 'raw',
                                    raw: requestData.body
                                } : undefined
                            }
                        }]
                    };
                    preview = {
                        title: 'Postman Collection',
                        content: JSON.stringify(postmanCollection, null, 2),
                        copyable: true
                    };
                    break;

                case 'curl':
                    let curlCommand = `curl -X ${requestData.method} "${requestData.url}"`;

                    // Add headers
                    requestData.headers.forEach(header => {
                        if (header.key && header.value) {
                            curlCommand += ` \\\n  -H "${header.key}: ${header.value}"`;
                        }
                    });

                    // Add body
                    if (requestData.body && requestData.body.trim()) {
                        curlCommand += ` \\\n  -d '${requestData.body.replace(/'/g, `'"'"'`)}'`;
                    }

                    preview = {
                        title: 'cURL Command',
                        content: curlCommand,
                        copyable: true
                    };
                    break;

                case 'openapi':
                    let urlObj;
                    try {
                        urlObj = new URL(requestData.url);
                    } catch (error) {
                        // Handle invalid URL
                        preview = {
                            title: 'OpenAPI Specification',
                            content: 'Error: Invalid URL. Please provide a valid URL to generate OpenAPI spec.',
                            copyable: false
                        };
                        break;
                    }

                    const path = urlObj.pathname;

                    const openApiSpec = {
                        openapi: '3.0.0',
                        info: {
                            title: 'API Documentation',
                            version: '1.0.0'
                        },
                        servers: [{
                            url: `${urlObj.protocol}//${urlObj.host}`
                        }],
                        paths: {
                            [path]: {
                                [requestData.method.toLowerCase()]: {
                                    summary: `${requestData.method} ${path}`,
                                    parameters: requestData.headers.map(h => ({
                                        name: h.key,
                                        in: 'header',
                                        required: false,
                                        schema: { type: 'string' }
                                    })),
                                    requestBody: requestData.body ? {
                                        required: true,
                                        content: {
                                            'application/json': {
                                                schema: { type: 'object' }
                                            }
                                        }
                                    } : undefined,
                                    responses: {
                                        '200': {
                                            description: 'Success',
                                            content: {
                                                'application/json': {
                                                    schema: { type: 'object' }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    };

                    preview = {
                        title: 'OpenAPI Specification',
                        content: JSON.stringify(openApiSpec, null, 2),
                        copyable: true
                    };
                    break;

                case 'share':
                    const shareData = {
                        method: requestData.method,
                        url: requestData.url,
                        headers: requestData.headers,
                        body: requestData.body
                    };

                    const shareUrl = `${window.location.origin}/share?data=${encodeURIComponent(btoa(JSON.stringify(shareData)))}`;

                    preview = {
                        title: 'Shareable Link',
                        content: shareUrl,
                        copyable: true
                    };
                    break;

                default:
                    preview = {
                        title: 'Unknown Format',
                        content: 'Preview not available for this format',
                        copyable: false
                    };
            }

            setExportPreview(preview);
        } catch (error) {
            console.error('Export preview generation failed:', error);
            setExportPreview({
                title: 'Error',
                content: `Failed to generate preview: ${error.message}`,
                copyable: false
            });
        }
    }, [method, url, headers, bodyType, bodyContent, requestName]);

    // Render tab content based on active tab
    const renderTabContent = () => {
        switch (activeTab) {
            case 'params':
                return (
                    <div className="params-section">
                        <div className="section-header-row">
                            <div className="section-title">
                                <span className="section-title-icon"><List size={18} /></span>
                                <div className="section-title-text">
                                    <span>Query Parameters</span>
                                </div>
                                <span className="section-title-meta" title="Enabled / total">
                                    <span className="count-dot" />
                                    {params.filter(p => p.enabled && p.key).length}/{params.length}
                                </span>
                            </div>
                            <span className="section-description">Parameters sent in the URL query string</span>
                        </div>
                        {params.length === 0 ? (
                            <div className="empty-table-state">
                                <div className="empty-illustration"><List size={20} /></div>
                                <h4>No parameters yet</h4>
                                <p>Add query parameters to send with the request. They'll appear in the URL as <code>?key=value</code>.</p>
                                <button type="button" className="modern-add-btn empty-cta" onClick={handleAddParam}>
                                    <Plus size={16} />
                                    <span>Add Parameter</span>
                                </button>
                            </div>
                        ) : (
                            <>
                        <div className="table-container">
                            <table className="params-table">
                                <thead>
                                    <tr>
                                        <th width="40"></th>
                                        <th width="30%">Key</th>
                                        <th width="30%">Value</th>
                                        <th>Description</th>
                                        <th width="48"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {params.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="empty-table-row">
                                                <div className="empty-table-state">
                                                    <div className="empty-illustration"><List size={20} /></div>
                                                    <h4>No parameters yet</h4>
                                                    <p>Add query parameters to send with the request. They'll appear in the URL as <code>?key=value</code>.</p>
                                                    <button type="button" className="modern-add-btn empty-cta" onClick={handleAddParam}>
                                                        <Plus size={16} />
                                                        <span>Add your first parameter</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : params.map((param, index) => (
                                        <tr key={`param-${index}`} className={`param-row ${!param.enabled ? 'is-disabled' : ''}`}>
                                            <td className="checkbox-cell">
                                                <div className="custom-checkbox">
                                                    <input
                                                        type="checkbox"
                                                        id={`param-check-${index}`}
                                                        checked={param.enabled}
                                                        onChange={(e) => handleParamChange(index, 'enabled', e.target.checked)}
                                                    />
                                                    <label htmlFor={`param-check-${index}`}></label>
                                                </div>
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className={`table-input ${getVariableInputClass(param.key)}`}
                                                    value={param.key}
                                                    onChange={(e) => handleParamChange(index, 'key', e.target.value)}
                                                    placeholder="Enter Key"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className={`table-input ${getVariableInputClass(param.value)}`}
                                                    value={param.value}
                                                    onChange={(e) => handleParamChange(index, 'value', e.target.value)}
                                                    placeholder="Enter Value"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className="table-input"
                                                    value={param.description}
                                                    onChange={(e) => handleParamChange(index, 'description', e.target.value)}
                                                    placeholder="Enter Description"
                                                />
                                            </td>
                                            <td className="action-cell">
                                                <button
                                                    type="button"
                                                    className="delete-row-btn"
                                                    onClick={() => handleRemoveParam(index)}
                                                    aria-label="Delete parameter"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="add-row-container">
                            <button type="button" className="modern-add-btn" onClick={handleAddParam}>
                                <Plus size={16} />
                                <span>Add Parameter</span>
                            </button>
                        </div>
                            </>
                        )}
                    </div>
                );

            case 'headers':
                return (
                    <div className="headers-section">
                        <div className="section-header-row">
                            <div className="section-title">
                                <span className="section-title-icon"><LinkIcon size={18} /></span>
                                <div className="section-title-text">
                                    <span>Request Headers</span>
                                </div>
                                <span className="section-title-meta" title="Enabled / total">
                                    <span className="count-dot" />
                                    {headers.filter(h => h.enabled && h.key).length}/{headers.length}
                                </span>
                            </div>
                            <span className="section-description">Custom headers to include with the request</span>
                        </div>
                        {headers.length === 0 ? (
                            <div className="empty-table-state">
                                <div className="empty-illustration"><LinkIcon size={20} /></div>
                                <h4>No headers configured</h4>
                                <p>Add custom headers such as <code>Authorization</code>, <code>Content-Type</code>, or your own metadata.</p>
                                <button type="button" className="modern-add-btn empty-cta" onClick={handleAddHeader}>
                                    <Plus size={16} />
                                    <span>Add Header</span>
                                </button>
                            </div>
                        ) : (
                            <>
                        <div className="table-container">
                            <table className="params-table">
                                <thead>
                                    <tr>
                                        <th width="40"></th>
                                        <th width="30%">Key</th>
                                        <th width="30%">Value</th>
                                        <th>Description</th>
                                        <th width="48"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {headers.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="empty-table-row">
                                                <div className="empty-table-state">
                                                    <div className="empty-illustration"><LinkIcon size={20} /></div>
                                                    <h4>No headers configured</h4>
                                                    <p>Add custom headers such as <code>Authorization</code>, <code>Content-Type</code>, or your own metadata.</p>
                                                    <button type="button" className="modern-add-btn empty-cta" onClick={handleAddHeader}>
                                                        <Plus size={16} />
                                                        <span>Add your first header</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : headers.map((header, index) => (
                                        <tr key={`header-${index}`} className={`param-row ${!header.enabled ? 'is-disabled' : ''}`}>
                                            <td className="checkbox-cell">
                                                <div className="custom-checkbox">
                                                    <input
                                                        type="checkbox"
                                                        id={`header-check-${index}`}
                                                        checked={header.enabled}
                                                        onChange={(e) => handleHeaderChange(index, 'enabled', e.target.checked)}
                                                    />
                                                    <label htmlFor={`header-check-${index}`}></label>
                                                </div>
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className={`table-input ${getVariableInputClass(header.key)}`}
                                                    value={header.key}
                                                    onChange={(e) => handleHeaderChange(index, 'key', e.target.value)}
                                                    placeholder="Key"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className={`table-input ${getVariableInputClass(header.value)}`}
                                                    value={header.value}
                                                    onChange={(e) => handleHeaderChange(index, 'value', e.target.value)}
                                                    placeholder="Value"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className="table-input"
                                                    value={header.description}
                                                    onChange={(e) => handleHeaderChange(index, 'description', e.target.value)}
                                                    placeholder="Description"
                                                />
                                            </td>
                                            <td className="action-cell">
                                                <button
                                                    type="button"
                                                    className="delete-row-btn"
                                                    onClick={() => handleRemoveHeader(index)}
                                                    aria-label="Delete header"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="add-row-container">
                            <button type="button" className="modern-add-btn" onClick={handleAddHeader}>
                                <Plus size={16} />
                                <span>Add Header</span>
                            </button>
                        </div>
                            </>
                        )}
                    </div>
                );

            case 'body':
                return (
                    <div className="body-section">
                        <div className="section-header-row">
                            <div className="section-title">
                                <span className="section-title-icon"><Box size={18} /></span>
                                <div className="section-title-text">
                                    <span>Request Body</span>
                                </div>
                                <span className="section-title-meta" title="Selected type">
                                    <span className="count-dot" />
                                    {bodyType === 'x-www-form-urlencoded' ? 'url-encoded' : bodyType}
                                </span>
                            </div>
                            <span className="section-description">Payload sent with the request (for non-GET/HEAD methods)</span>
                        </div>
                        <div className="body-type-tabs">
                            <div
                                className={`body-type-tab ${bodyType === 'none' ? 'active' : ''}`}
                                onClick={() => setBodyType('none')}
                            >
                                <X size={13} /> None
                            </div>
                            <div
                                className={`body-type-tab ${bodyType === 'form-data' ? 'active' : ''}`}
                                onClick={() => setBodyType('form-data')}
                            >
                                <List size={13} /> Form Data
                            </div>
                            <div
                                className={`body-type-tab ${bodyType === 'x-www-form-urlencoded' ? 'active' : ''}`}
                                onClick={() => setBodyType('x-www-form-urlencoded')}
                            >
                                <List size={13} /> URL Encoded
                            </div>
                            <div
                                className={`body-type-tab ${bodyType === 'raw' ? 'active' : ''}`}
                                onClick={() => setBodyType('raw')}
                            >
                                <Braces size={13} /> Raw
                            </div>
                            <div
                                className={`body-type-tab ${bodyType === 'binary' ? 'active' : ''}`}
                                onClick={() => setBodyType('binary')}
                            >
                                <UploadCloud size={13} /> Binary
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
                                <X size={20} />
                                <span>This request does not have a body</span>
                            </div>
                        )}

                        {(bodyType === 'form-data' || bodyType === 'x-www-form-urlencoded') && (
                            <div className="form-data-editor">
                                {formDataFields.length === 0 ? (
                                    <div className="empty-table-state">
                                        <div className="empty-illustration"><List size={20} /></div>
                                        <h4>No form fields yet</h4>
                                        <p>Add key/value pairs to send as {bodyType === 'form-data' ? 'multipart/form-data' : 'application/x-www-form-urlencoded'}.</p>
                                        <button type="button" className="modern-add-btn empty-cta" onClick={handleAddFormDataField}>
                                            <Plus size={16} />
                                            <span>Add Field</span>
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="table-container">
                                            <table className="params-table">
                                                <thead>
                                                    <tr>
                                                        <th width="40"></th>
                                                        <th width="30%">Key</th>
                                                        <th width="30%">Value</th>
                                                        <th>Description</th>
                                                        <th width="48"></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {formDataFields.map((field, index) => (
                                                        <tr key={`form-field-${index}`} className={`param-row ${!field.enabled ? 'is-disabled' : ''}`}>
                                                            <td className="checkbox-cell">
                                                                <div className="custom-checkbox">
                                                                    <input
                                                                        type="checkbox"
                                                                        id={`form-field-check-${index}`}
                                                                        checked={field.enabled}
                                                                        onChange={(e) => handleFormDataChange(index, 'enabled', e.target.checked)}
                                                                    />
                                                                    <label htmlFor={`form-field-check-${index}`}></label>
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <input
                                                                    type="text"
                                                                    className={`table-input ${getVariableInputClass(field.key)}`}
                                                                    value={field.key}
                                                                    onChange={(e) => handleFormDataChange(index, 'key', e.target.value)}
                                                                    placeholder="Enter Key"
                                                                />
                                                            </td>
                                                            <td>
                                                                <input
                                                                    type="text"
                                                                    className={`table-input ${getVariableInputClass(field.value)}`}
                                                                    value={field.value}
                                                                    onChange={(e) => handleFormDataChange(index, 'value', e.target.value)}
                                                                    placeholder="Enter Value"
                                                                />
                                                            </td>
                                                            <td>
                                                                <input
                                                                    type="text"
                                                                    className="table-input"
                                                                    value={field.description}
                                                                    onChange={(e) => handleFormDataChange(index, 'description', e.target.value)}
                                                                    placeholder="Enter Description"
                                                                />
                                                            </td>
                                                            <td className="action-cell">
                                                                <button
                                                                    type="button"
                                                                    className="delete-row-btn"
                                                                    onClick={() => handleRemoveFormDataField(index)}
                                                                    aria-label="Delete field"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="add-row-container">
                                            <button type="button" className="modern-add-btn" onClick={handleAddFormDataField}>
                                                <Plus size={16} />
                                                <span>Add Field</span>
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {bodyType === 'binary' && (
                            <div className="binary-upload">
                                <div className="empty-table-state">
                                    <div className="empty-illustration"><UploadCloud size={20} /></div>
                                    <h4>Binary upload</h4>
                                    <p>Send a file as the request body (e.g. image, PDF, archive).</p>
                                    <label className="modern-add-btn empty-cta" style={{ cursor: 'pointer' }}>
                                        <UploadCloud size={16} />
                                        <span>Choose file</span>
                                        <input type="file" hidden />
                                    </label>
                                </div>
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
                        <div className="script-header">
                            <h4>Tests & Post-Request Scripts</h4>
                            <div className="script-actions">
                                <button
                                    className="btn btn-small"
                                    onClick={() => setShowVisualizationDebugger(!showVisualizationDebugger)}
                                >
                                    🔍 Debug Console
                                </button>
                                <button
                                    className="btn btn-small"
                                    onClick={() => {
                                        const templates = PostRequestScriptService.getScriptTemplates();
                                        // Show template selector modal
                                        console.log('Available templates:', templates);
                                    }}
                                >
                                    📋 Templates
                                </button>
                            </div>
                        </div>
                        <textarea
                            className="script-editor"
                            value={tests}
                            onChange={(e) => setTests(e.target.value)}
                            placeholder="// Write test script here (JavaScript)
// Examples:
// pm.test('Status code is 200', function () {
//     pm.response.to.have.status(200);
// });

// pm.visualizer.set(`
//     <h3>Response Data</h3>
//     <pre>{{json response}}</pre>
// `, pm.response.json());"
                            spellCheck="false"
                        />

                        {/* Post-request script results */}
                        {postRequestScriptResults && (
                            <div className="script-results">
                                <h5>Script Results</h5>
                                <div className={`result-status ${postRequestScriptResults.success ? 'success' : 'error'}`}>
                                    {postRequestScriptResults.success ? '✅ Success' : '❌ Failed'}
                                </div>

                                {postRequestScriptResults.errors.length > 0 && (
                                    <div className="script-errors">
                                        <h6>Errors:</h6>
                                        {postRequestScriptResults.errors.map((error, index) => (
                                            <div key={index} className="error-item">{error}</div>
                                        ))}
                                    </div>
                                )}

                                {postRequestScriptResults.visualizations.length > 0 && (
                                    <div className="script-visualizations">
                                        <h6>Visualizations Created:</h6>
                                        <div className="visualization-list">
                                            {postRequestScriptResults.visualizations.map((viz, index) => (
                                                <div key={index} className="visualization-item">
                                                    <span>{viz.name || `Visualization ${index + 1}`}</span>
                                                    <button
                                                        className="btn btn-small"
                                                        onClick={() => handleExport(viz, 'png')}
                                                    >
                                                        Export
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
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
                        <div className="section-header-row">
                            <div className="section-title">
                                <span className="section-title-icon"><Lock size={18} /></span>
                                <div className="section-title-text">
                                    <span>Authorization</span>
                                </div>
                                <span className="section-title-meta" title="Selected type">
                                    <span className="count-dot" />
                                    {authConfig.type}
                                </span>
                            </div>
                            <span className="section-description">Authenticate this request with the selected method</span>
                        </div>

                        <div className="auth-config">
                            <div className="auth-type-tabs" role="tablist" aria-label="Authentication type">
                                {[
                                    { value: 'No Auth', icon: X },
                                    { value: 'Bearer Token', icon: Key },
                                    { value: 'Basic Auth', icon: Lock },
                                    { value: 'API Key', icon: KeyRound },
                                    { value: 'OAuth 2.0', icon: ShieldCheck },
                                ].map(({ value, icon: Icon }) => (
                                    <button
                                        key={value}
                                        type="button"
                                        role="tab"
                                        aria-selected={authConfig.type === value}
                                        className={`auth-type-tab ${authConfig.type === value ? 'active' : ''}`}
                                        onClick={() => handleAuthConfigChange('type', value)}
                                    >
                                        <Icon size={13} /> {value}
                                    </button>
                                ))}
                            </div>

                            {/* Auth flow visualization container */}
                            {authFlowVisualization && (
                                <div className="auth-flow-container">
                                    <h5>Authentication Flow</h5>
                                    <div id="auth-flow-container" style={{ height: '400px', border: '1px solid var(--border-color)', marginTop: '10px' }}></div>
                                </div>
                            )}

                            {/* Existing auth configuration forms */}
                            {authConfig.type === 'No Auth' && (
                                <div className="empty-body">
                                    <X size={20} />
                                    <span>No authentication will be sent with this request</span>
                                </div>
                            )}

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
                        <div className="section-header-row">
                            <div className="section-title">
                                <Lock size={18} />
                                <span>SSL / Certificate Settings</span>
                            </div>
                            <span className="section-description">Control TLS verification and attach client certificates for mTLS</span>
                        </div>

                        <div className="ssl-config">
                            {/* Verification toggles */}
                            <div className="ssl-group">
                                <div className="ssl-group__title">Verification</div>
                                <div className="ssl-options">
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-pressed={sslConfig.verifyCert}
                                        className={`ssl-toggle ${sslConfig.verifyCert ? 'is-on' : ''}`}
                                        onClick={() => handleSSLConfigChange('verifyCert', !sslConfig.verifyCert)}
                                    >
                                        <div className="ssl-toggle__icon">
                                            <ShieldCheck size={16} />
                                        </div>
                                        <div className="ssl-toggle__text">
                                            <span className="ssl-toggle__label">Verify SSL certificates</span>
                                            <span className="ssl-toggle__hint">Reject invalid or expired TLS chains</span>
                                        </div>
                                        <span className="ssl-switch">
                                            <span className="ssl-switch__dot" />
                                        </span>
                                    </button>

                                    <button
                                        type="button"
                                        role="switch"
                                        aria-pressed={sslConfig.allowSelfSigned}
                                        className={`ssl-toggle ${sslConfig.allowSelfSigned ? 'is-on' : ''}`}
                                        onClick={() => handleSSLConfigChange('allowSelfSigned', !sslConfig.allowSelfSigned)}
                                    >
                                        <div className="ssl-toggle__icon">
                                            <KeyRound size={16} />
                                        </div>
                                        <div className="ssl-toggle__text">
                                            <span className="ssl-toggle__label">Allow self-signed certificates</span>
                                            <span className="ssl-toggle__hint">Accept certs not signed by a trusted CA</span>
                                        </div>
                                        <span className="ssl-switch">
                                            <span className="ssl-switch__dot" />
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {/* Client certs */}
                            <div className="ssl-group">
                                <div className="ssl-group__title">Client Certificates</div>
                                <div className="cert-upload-section">

                                    {/* Client Certificate */}
                                    <div className="cert-upload-container">
                                        <label className="cert-upload-label">
                                            <span className="cert-type-title"><FileCheck2 size={15} /> Client Certificate</span>
                                            <span className="cert-file-types">.crt · .pem · .cert</span>
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
                                            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
                                            onDragEnter={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
                                            onDragLeave={(e) => {
                                                e.preventDefault();
                                                if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.classList.remove('drag-over');
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
                                                    <div className="upload-icon uploading"><UploadCloud size={30} /></div>
                                                    <div className="upload-text">
                                                        <span className="upload-primary">Uploading certificate…</span>
                                                    </div>
                                                </div>
                                            ) : !sslConfig.clientCert ? (
                                                <div className="drop-zone-content">
                                                    <div className="upload-icon"><UploadCloud size={30} /></div>
                                                    <div className="upload-text">
                                                        <span className="upload-primary">Drop certificate or click to browse</span>
                                                        <span className="upload-secondary">PEM / DER encoded</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="uploaded-file">
                                                    <div className="file-icon"><FileCheck2 size={20} /></div>
                                                    <div className="file-details">
                                                        <div className="file-name">{sslConfig.clientCert.filename}</div>
                                                        <div className="file-meta">
                                                            <span className="file-size">{Math.round(sslConfig.clientCert.size / 1024)} KB</span>
                                                            {sslConfig.clientCert.info && (
                                                                <span className="cert-validity">
                                                                    Valid until {new Date(sslConfig.clientCert.info.validTo).toLocaleDateString()}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="remove-file-btn"
                                                        onClick={(e) => { e.stopPropagation(); setSSLConfig(prev => ({ ...prev, clientCert: null })); }}
                                                        title="Remove certificate"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Private Key */}
                                    <div className="cert-upload-container">
                                        <label className="cert-upload-label">
                                            <span className="cert-type-title"><KeyRound size={15} /> Private Key</span>
                                            <span className="cert-file-types">.key · .pem</span>
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
                                            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
                                            onDragEnter={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
                                            onDragLeave={(e) => {
                                                e.preventDefault();
                                                if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.classList.remove('drag-over');
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
                                                    <div className="upload-icon uploading"><UploadCloud size={30} /></div>
                                                    <div className="upload-text">
                                                        <span className="upload-primary">Uploading private key…</span>
                                                    </div>
                                                </div>
                                            ) : !sslConfig.clientKey ? (
                                                <div className="drop-zone-content">
                                                    <div className="upload-icon"><KeyRound size={30} /></div>
                                                    <div className="upload-text">
                                                        <span className="upload-primary">Drop private key or click to browse</span>
                                                        <span className="upload-secondary">Encrypted key supported</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="uploaded-file">
                                                    <div className="file-icon"><KeyRound size={20} /></div>
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
                                                        onClick={(e) => { e.stopPropagation(); setSSLConfig(prev => ({ ...prev, clientKey: null })); }}
                                                        title="Remove private key"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Passphrase */}
                                    <div className="form-group passphrase-group">
                                        <label htmlFor="cert-passphrase" className="passphrase-label">
                                            <KeyRound size={14} />
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
                                                    <div className="strength-indicator"><div className="strength-bar" /></div>
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

            case 'network-flow':
                return (
                    <div className="network-flow-section">
                        <div className="network-flow-header">
                            <div className="flow-title-section">
                                <div className="flow-title-row">
                                    <Activity size={16} className="flow-title-icon" />
                                    <h4>Network Flow Visualization</h4>
                                </div>
                                <p className="flow-subtitle">Visualize your request journey through the network</p>
                            </div>
                            <div className="flow-actions">
                                <button className="flow-btn primary" onClick={async () => {
                                    try {
                                        await NetworkFlowService.initialize();
                                        const container = document.getElementById('network-flow-diagram');
                                        if (container) container.innerHTML = '';
                                        const currentHeaders = {};
                                        headers.forEach(h => { if (h.enabled && h.key && h.value) currentHeaders[h.key] = h.value; });
                                        const flowData = await NetworkFlowService.createRealtimeFlow('network-flow-diagram', {
                                            animate: true,
                                            requestUrl: url,
                                            requestMethod: method,
                                            headers: currentHeaders,
                                            requestBody: bodyContent
                                        });
                                        setNetworkFlowData(flowData);
                                    } catch (error) {
                                        const container = document.getElementById('network-flow-diagram');
                                        if (container) {
                                            container.innerHTML = `
                                                <div class="flow-error-state">
                                                    <div class="error-icon">⚠️</div>
                                                    <h4>Error generating flow diagram</h4>
                                                    <p>${error.message}</p>
                                                    <p>Please check the console for more details.</p>
                                                </div>`;
                                        }
                                    }
                                }}>
                                    <RefreshCw size={14} />
                                    Generate Flow
                                </button>
                                <button className="flow-btn secondary" onClick={async () => {
                                    try {
                                        await NetworkFlowService.initialize();
                                        const container = document.getElementById('network-flow-diagram');
                                        if (container) container.innerHTML = '';
                                        const apiSpec = {
                                            paths: { [url || '/api/endpoint']: { [method.toLowerCase()]: { summary: `${method} ${url}`, responses: { '200': { description: 'Success' } } } } }
                                        };
                                        const topology = NetworkFlowService.generateNetworkTopology(apiSpec);
                                        if (topology.nodes && topology.edges && topology.nodes.length > 0) {
                                            setNetworkFlowData(NetworkFlowService.createApiFlowDiagram('network-flow-diagram', topology.nodes, topology.edges));
                                        } else if (container) {
                                            container.innerHTML = `
                                                <div class="flow-empty-state">
                                                    <div class="empty-icon">📊</div>
                                                    <h4>No topology data available</h4>
                                                    <p>Try using the "Generate Flow" button instead.</p>
                                                </div>`;
                                        }
                                    } catch (error) {
                                        const container = document.getElementById('network-flow-diagram');
                                        if (container) {
                                            container.innerHTML = `
                                                <div class="flow-error-state">
                                                    <div class="error-icon">⚠️</div>
                                                    <h4>Error visualizing request</h4>
                                                    <p>${error.message}</p>
                                                    <p>Please check the console for more details.</p>
                                                </div>`;
                                        }
                                    }
                                }}>
                                    <GitBranch size={14} />
                                    Visualize Request
                                </button>
                            </div>
                        </div>

                        <div className="flow-content">
                            <div className="flow-diagram-container">
                                <div className="diagram-header">
                                    <div className="diagram-title-row">
                                        <Network size={14} className="diagram-title-icon" />
                                        <h5>Request Flow</h5>
                                    </div>
                                    <div className="diagram-controls">
                                        <button className="control-btn" title="Zoom In" onClick={() => {
                                            const cy = NetworkFlowService.instances.get('network-flow-diagram');
                                            if (cy) cy.zoom(cy.zoom() * 1.2);
                                        }}><ZoomIn size={14} /></button>
                                        <button className="control-btn" title="Fit to Screen" onClick={() => {
                                            const cy = NetworkFlowService.instances.get('network-flow-diagram');
                                            if (cy) cy.fit();
                                        }}><Maximize2 size={14} /></button>
                                        <button className="control-btn" title="Reset" onClick={() => {
                                            const cy = NetworkFlowService.instances.get('network-flow-diagram');
                                            if (cy) { cy.zoom(1); cy.center(); }
                                        }}><RotateCcw size={14} /></button>
                                    </div>
                                </div>
                                <div id="network-flow-diagram" className="flow-diagram">
                                    <div className="flow-empty-state">
                                        <div className="empty-icon"><Globe size={32} /></div>
                                        <h4>Ready to visualize</h4>
                                        <p>Click "Generate Flow" to create a visual representation of your request flow</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flow-details">
                                <div className="details-header">
                                    <div className="details-title-row">
                                        <ListChecks size={14} className="details-title-icon" />
                                        <h5>Flow Steps</h5>
                                    </div>
                                    <div className="flow-status">
                                        <span className="status-indicator ready" />
                                        <span className="status-text">Ready</span>
                                    </div>
                                </div>
                                <div className="flow-steps">
                                    <div className="flow-step">
                                        <div className="step-number"><FileText size={11} /></div>
                                        <div className="step-content">
                                            <h6>Request Preparation</h6>
                                            <p>Validate headers and body</p>
                                        </div>
                                    </div>
                                    <div className="flow-step">
                                        <div className="step-number"><Globe size={11} /></div>
                                        <div className="step-content">
                                            <h6>DNS Resolution</h6>
                                            <p>Resolve domain to IP address</p>
                                        </div>
                                    </div>
                                    <div className="flow-step">
                                        <div className="step-number"><Cable size={11} /></div>
                                        <div className="step-content">
                                            <h6>TCP Connection</h6>
                                            <p>Establish connection to server</p>
                                        </div>
                                    </div>
                                    <div className="flow-step">
                                        <div className="step-number"><Send size={11} /></div>
                                        <div className="step-content">
                                            <h6>HTTP Request</h6>
                                            <p>Send request to endpoint</p>
                                        </div>
                                    </div>
                                    <div className="flow-step">
                                        <div className="step-number"><PackageCheck size={11} /></div>
                                        <div className="step-content">
                                            <h6>Response Processing</h6>
                                            <p>Parse and display response</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'debug-console':
                // Ensure VisualizationDebugger is initialized when this tab is shown
                if (typeof VisualizationDebugger !== 'undefined') {
                    VisualizationDebugger.initialize();
                    // Explicitly hide any popup panels since we're using the integrated console
                    VisualizationDebugger.hidePopupPanel();
                    // Also remove any popup panels from DOM completely
                    VisualizationDebugger.removePopupPanels();
                }

                return (
                    <div className="debug-console-section" id="visualization-debugger-container">
                        <div className="debug-console-header">
                            <div className="debug-title">
                                <div className="debug-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M20 4L3 11L10 13.5L12.5 20L20 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </div>
                                <h4>Debug Console</h4>
                                <div className="debug-status">
                                    <span className="status-indicator"></span>
                                    Ready
                                </div>
                            </div>
                            <div className="debug-actions">
                                <button
                                    type="button"
                                    className="debug-btn debug-btn-primary"
                                    onClick={() => {
                                        try {
                                            const debugSessionId = `${method.toLowerCase()}-${encodeURIComponent(url || "no-url")}-${Date.now()}`;
                                            const sessionData = {
                                                method,
                                                url,
                                                headers: headers.filter(h => h.enabled),
                                                body: bodyType !== 'none' ? bodyContent : null,
                                                bodyType,
                                                authConfig,
                                                timestamp: Date.now()
                                            };

                                            // Make sure the debug panel is visible
                                            if (typeof VisualizationDebugger !== 'undefined') {
                                                VisualizationDebugger.showDebugPanel();

                                                // Create a new session
                                                const session = VisualizationDebugger.startSession(
                                                    debugSessionId,
                                                    document.getElementById('visualization-debugger-container'),
                                                    sessionData
                                                );
                                                setCurrentDebugSession(session);

                                                // Add a clear instruction to user
                                                VisualizationDebugger.addLog(debugSessionId, 'info', `🎯 Debug session active. Click "Send" button to see request logs.`);
                                                VisualizationDebugger.addLog(debugSessionId, 'info', `💻 Use the filter buttons and search box above to filter logs.`);

                                                // Start browser console capture for external websites
                                                if (url && url !== 'no-url' && url.startsWith('http')) {
                                                    setTimeout(async () => {
                                                        const success = await VisualizationDebugger.startBrowserConsoleCapture(url);
                                                        if (success) {
                                                            VisualizationDebugger.addLog(debugSessionId, 'success', `🌐 Now capturing real-time console logs from ${url}`);
                                                            VisualizationDebugger.addLog(debugSessionId, 'info', `💡 Browser console output (console.log, errors, warnings) will appear here in real-time`);
                                                        } else {
                                                            VisualizationDebugger.addLog(debugSessionId, 'warn', `⚠️ Could not start browser console capture for ${url}`);
                                                            VisualizationDebugger.addLog(debugSessionId, 'info', `💡 You can still see Pigeon internal logs and proxy request/response data`);
                                                        }
                                                    }, 1000);
                                                } else {
                                                    VisualizationDebugger.addLog(debugSessionId, 'info', `💡 Enter a valid HTTP/HTTPS URL to capture external website console logs`);
                                                }

                                                // Test console interception with sample logs
                                                setTimeout(() => {
                                                    console.log("Test console.log - this should appear in debug console");
                                                    console.warn("Test console.warn - this should appear in debug console");
                                                    console.error("Test console.error - this should appear in debug console");
                                                }, 1000);
                                            }
                                        } catch (error) {
                                            console.error('Error starting debug session:', error);
                                        }
                                    }}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
                                        <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    Start Debugging
                                </button>
                                <button
                                    type="button"
                                    className="debug-btn debug-btn-ghost"
                                    onClick={() => {
                                        // Use VisualizationDebugger to clear the console
                                        if (typeof VisualizationDebugger !== 'undefined') {
                                            VisualizationDebugger.clearConsole();
                                        }
                                    }}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    Clear Console
                                </button>
                                <button
                                    type="button"
                                    className="debug-btn debug-btn-ghost"
                                    onClick={() => {
                                        // Test console interception
                                        if (typeof VisualizationDebugger !== 'undefined') {
                                            VisualizationDebugger.activateConsoleCapture();

                                            // Test with actual console calls
                                            setTimeout(() => {
                                                console.log("✅ Test log message - this should appear in debug console");
                                                console.warn("⚠️ Test warning message");
                                                console.error("❌ Test error message");
                                                console.log("Demo object:", { test: "data", number: 42 });
                                            }, 500);
                                        }
                                    }}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                                    </svg>
                                    Test Console Capture
                                </button>
                                <button
                                    type="button"
                                    className="debug-btn debug-btn-accent"
                                    onClick={async () => {
                                        // Toggle browser console capture with optimized polling
                                        if (typeof VisualizationDebugger !== 'undefined') {
                                            if (VisualizationDebugger._browserCaptureSession) {
                                                await VisualizationDebugger.stopBrowserConsoleCapture();
                                            } else if (url && url !== 'no-url' && url.startsWith('http')) {
                                                const success = await VisualizationDebugger.startBrowserConsoleCapture(url);
                                                if (success) {
                                                    if (currentDebugSession?.id) {
                                                        VisualizationDebugger.log(`🌐 Browser console capture started for ${url}`, 'success');
                                                    }

                                                    // Add a message in the UI about optimized capture
                                                    const consoleOutput = document.getElementById('console-output');
                                                    if (consoleOutput) {
                                                        const message = document.createElement('div');
                                                        message.className = 'log-entry log-info';
                                                        message.innerHTML = `
                                                            <div class="log-time">${new Date().toLocaleTimeString()}</div>
                                                            <div class="log-icon">ℹ️</div>
                                                            <div class="log-message">Console capture started with optimized polling (every 5s) to prevent excessive logging</div>
                                                        `;
                                                        consoleOutput.appendChild(message);
                                                        consoleOutput.scrollTop = consoleOutput.scrollHeight;
                                                    }
                                                } else {
                                                    if (currentDebugSession?.id) {
                                                        VisualizationDebugger.log(`❌ Failed to start browser console capture`, 'error');
                                                    }
                                                }
                                            } else {
                                                if (currentDebugSession?.id) {
                                                    VisualizationDebugger.log(`⚠️ Enter a valid HTTP/HTTPS URL to capture website console logs`, 'warn');
                                                }
                                            }
                                        }
                                    }}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    {(typeof VisualizationDebugger !== 'undefined' && VisualizationDebugger._browserCaptureSession) ? 'Stop Website Capture' : 'Capture Website Console'}
                                </button>
                            </div>
                        </div>

                        <div className="debug-content">
                            <div className="debug-tabs">
                                <button type="button" className="debug-tab active" data-tab="console">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
                                        <line x1="8" y1="12" x2="16" y2="12"></line>
                                        <line x1="8" y1="16" x2="14" y2="16"></line>
                                        <line x1="2" y1="8" x2="22" y2="8"></line>
                                    </svg>
                                    <span>Console</span>
                                </button>
                                <button type="button" className="debug-tab" data-tab="network">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <path d="M2 12h20"></path>
                                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                                    </svg>
                                    <span>Network</span>
                                </button>
                                <button type="button" className="debug-tab" data-tab="performance">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 20v-6"></path>
                                        <path d="M6 20v-12"></path>
                                        <path d="M18 20V8"></path>
                                    </svg>
                                    <span>Performance</span>
                                </button>
                                <button className="debug-tab" data-tab="elements">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                        <line x1="3" y1="9" x2="21" y2="9"></line>
                                        <line x1="9" y1="21" x2="9" y2="9"></line>
                                    </svg>
                                    <span>Elements</span>
                                </button>
                            </div>
                            <div className="debug-panels">
                                <div className="debug-panel active" id="console-panel">
                                    <div className="console-filters">
                                        <div className="filter-group">
                                            <button
                                                type="button"
                                                className={`filter-btn ${consoleFilter === 'all' ? 'active' : ''}`}
                                                onClick={() => {
                                                    setConsoleFilter('all');
                                                    if (typeof VisualizationDebugger !== 'undefined') {
                                                        VisualizationDebugger.setFilter('all');
                                                    }
                                                }}
                                            >
                                                All
                                            </button>
                                            <button
                                                type="button"
                                                className={`filter-btn ${consoleFilter === 'info' ? 'active' : ''}`}
                                                onClick={() => {
                                                    setConsoleFilter('info');
                                                    if (typeof VisualizationDebugger !== 'undefined') {
                                                        VisualizationDebugger.setFilter('info');
                                                    }
                                                }}
                                            >
                                                Info
                                            </button>
                                            <button
                                                type="button"
                                                className={`filter-btn ${consoleFilter === 'warn' ? 'active' : ''}`}
                                                onClick={() => {
                                                    setConsoleFilter('warn');
                                                    if (typeof VisualizationDebugger !== 'undefined') {
                                                        VisualizationDebugger.setFilter('warn');
                                                    }
                                                }}
                                            >
                                                Warnings
                                            </button>
                                            <button
                                                type="button"
                                                className={`filter-btn ${consoleFilter === 'error' ? 'active' : ''}`}
                                                onClick={() => {
                                                    setConsoleFilter('error');
                                                    if (typeof VisualizationDebugger !== 'undefined') {
                                                        VisualizationDebugger.setFilter('error');
                                                    }
                                                }}
                                            >
                                                Errors
                                            </button>
                                            <button
                                                type="button"
                                                className={`filter-btn ${consoleFilter === 'debug' ? 'active' : ''}`}
                                                onClick={() => {
                                                    setConsoleFilter('debug');
                                                    if (typeof VisualizationDebugger !== 'undefined') {
                                                        VisualizationDebugger.setFilter('debug');
                                                    }
                                                }}
                                            >
                                                Debug
                                            </button>
                                        </div>
                                        <div className="search-box">
                                            <span className="search-icon">🔍</span>
                                            <input
                                                type="text"
                                                placeholder="Search logs..."
                                                className="search-input"
                                                onChange={(e) => {
                                                    if (typeof VisualizationDebugger !== 'undefined') {
                                                        VisualizationDebugger.applyTextFilter(e.target.value.trim().toLowerCase());
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div className="modern-debug-placeholder">
                                        <div className="modern-debug-message">
                                            <h3>🔍 Modern Debug Console</h3>
                                            <p>Click "Start Debugging" to use the enhanced debug console with advanced filtering capabilities</p>
                                        </div>
                                    </div>
                                    <div className="console-input">
                                        <input
                                            type="text"
                                            id="console-input"
                                            placeholder="Enter command (type 'help' for available commands)..."
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    // Let VisualizationDebugger handle the command
                                                    return false;
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className="debug-panel" id="network-panel">
                                    <div className="network-requests" id="network-requests">
                                        <div className="empty-state">
                                            <h4>📡 Network Requests</h4>
                                            <p>Start debugging to see network request details</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="debug-panel" id="performance-panel">
                                    <div className="performance-metrics" id="performance-metrics">
                                        <div className="empty-state">
                                            <h4>⚡ Performance Metrics</h4>
                                            <p>Start debugging to see performance data</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="debug-panel" id="elements-panel">
                                    <div className="elements-tree" id="elements-tree">
                                        <div className="empty-state">
                                            <h4>🏗️ Request Elements</h4>
                                            <p>Start debugging to inspect request structure</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'export-options':
                return (
                    <div className="export-options-section">
                        <div className="export-header">
                            <h4>Export & Share Options</h4>
                            <div className="export-actions">
                                <button
                                    className="btn btn-small"
                                    onClick={() => {
                                        const requestData = {
                                            method,
                                            url,
                                            headers: headers.filter(h => h.enabled),
                                            body: bodyType !== 'none' ? bodyContent : null
                                        };
                                        ExportService.exportRequest(requestData, 'postman');
                                    }}
                                >
                                    📤 Export to Postman
                                </button>
                                <button
                                    className="btn btn-small"
                                    onClick={() => {
                                        const requestData = {
                                            method,
                                            url,
                                            headers: headers.filter(h => h.enabled),
                                            body: bodyType !== 'none' ? bodyContent : null
                                        };
                                        ExportService.exportRequest(requestData, 'curl');
                                    }}
                                >
                                    📋 Export as cURL
                                </button>
                                <button
                                    className="btn btn-small"
                                    onClick={() => {
                                        const requestData = {
                                            method,
                                            url,
                                            headers: headers.filter(h => h.enabled),
                                            body: bodyType !== 'none' ? bodyContent : null
                                        };
                                        ExportService.exportRequest(requestData, 'openapi');
                                    }}
                                >
                                    📄 Export as OpenAPI
                                </button>
                            </div>
                        </div>

                        <div className="export-content">
                            <div className="export-formats">
                                <h5>Export Formats</h5>
                                <div className="format-grid">
                                    <div className="format-item"
                                        onClick={() => generateExportPreview('postman')}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => e.key === 'Enter' && generateExportPreview('postman')}>
                                        <div className="format-icon">📤</div>
                                        <div className="format-details">
                                            <div className="format-name">Postman</div>
                                            <div className="format-description">Collection file</div>
                                        </div>
                                    </div>
                                    <div className="format-item"
                                        onClick={() => generateExportPreview('curl')}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => e.key === 'Enter' && generateExportPreview('curl')}>
                                        <div className="format-icon">📋</div>
                                        <div className="format-details">
                                            <div className="format-name">cURL</div>
                                            <div className="format-description">Terminal command</div>
                                        </div>
                                    </div>
                                    <div className="format-item"
                                        onClick={() => generateExportPreview('openapi')}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => e.key === 'Enter' && generateExportPreview('openapi')}>
                                        <div className="format-icon">📄</div>
                                        <div className="format-details">
                                            <div className="format-name">OpenAPI</div>
                                            <div className="format-description">API specification</div>
                                        </div>
                                    </div>
                                    <div className="format-item"
                                        onClick={() => generateExportPreview('share')}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => e.key === 'Enter' && generateExportPreview('share')}>
                                        <div className="format-icon">🔗</div>
                                        <div className="format-details">
                                            <div className="format-name">Share</div>
                                            <div className="format-description">Shareable link</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="export-preview">
                                <h5>Preview</h5>
                                <div className="preview-container">
                                    {exportPreview ? (
                                        <>
                                            <div className="preview-header">
                                                <h6 className="preview-title">{exportPreview.title}</h6>
                                                <div className="preview-actions">
                                                    {exportPreview.copyable && (
                                                        <button
                                                            className="preview-btn"
                                                            onClick={() => navigator.clipboard.writeText(exportPreview.content)}
                                                            title="Copy to clipboard"
                                                        >
                                                            📋 Copy
                                                        </button>
                                                    )}
                                                    <button
                                                        className="preview-btn"
                                                        onClick={() => setExportPreview(null)}
                                                        title="Clear preview"
                                                    >
                                                        ✕ Clear
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="preview-content">
                                                <pre className="preview-code">{exportPreview.content}</pre>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="preview-empty">
                                            <div className="preview-empty-icon">📋</div>
                                            <p className="preview-empty-text">Select an export format to preview</p>
                                            <p className="preview-empty-hint">Click on any format above to see the generated output</p>
                                        </div>
                                    )}
                                </div>
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

                {/* Request Name */}
                <div className="request-name-container">
                    <input
                        type="text"
                        className="request-name-input"
                        value={requestName}
                        onChange={(e) => setRequestName(e.target.value)}
                        placeholder="Request Name"
                    />
                </div>

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
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                if (!isLoading) {
                                    handleSubmit(e);
                                }
                            }
                        }}
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
                <TabBar
                    tabs={[
                        { id: 'params', label: 'Params', icon: <List size={16} /> },
                        { id: 'headers', label: 'Headers', icon: <LinkIcon size={16} /> },
                        { id: 'authorization', label: 'Authorization', icon: <Lock size={16} /> },
                        { id: 'body', label: 'Body', icon: <Box size={16} /> },
                        { id: 'ssl', label: 'SSL', icon: <ShieldCheck size={16} /> },
                        { id: 'pre-request-script', label: 'Script', icon: <Zap size={16} /> },
                        { id: 'tests', label: 'Tests', icon: <CheckCircle2 size={16} /> },
                        { id: 'variables', label: 'Variables', icon: <Key size={16} /> },
                        { id: 'variable-preview', label: 'Preview', icon: <Eye size={16} /> },
                        { id: 'network-flow', label: 'Flow', icon: <Activity size={16} /> },
                        { id: 'debug-console', label: 'Debug', icon: <Terminal size={16} /> },
                        { id: 'export-options', label: 'Export', icon: <FolderOutput size={16} /> },
                    ]}
                    activeId={activeTab}
                    onChange={handleTabChange}
                />

                {/* Tab content (direct, without extra container) */}
                {renderTabContent()}
            </form>

            {/* Only show this response section when there's data to display */}
            {!hideResponse && (responseData || isLoading || responseError) && (
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