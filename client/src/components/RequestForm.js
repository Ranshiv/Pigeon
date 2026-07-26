import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import './RequestForm.css';
import {
    List,
    Link as LinkIcon,
    Lock,
    ShieldOff,
    UserCheck,
    KeyRound,
    Fingerprint,
    Box,
    ShieldCheck,
    Zap,
    CheckCircle2,
    Key,
    Activity,
    Terminal,
    FolderOutput,
    Plus,
    X,
    Trash2,
    Upload,
    File as FileIcon,
    Bug,
    Play,
    BarChart2,
    FileText,
    ZoomIn,
    Maximize,
    RotateCcw,
    Globe,
    AlertCircle
} from 'lucide-react';
import ResponseDisplay from './ResponseDisplay';
import AppSelect from './common/AppSelect/AppSelect';
import UnifiedVariableViewer from './UnifiedVariableViewer';
import { interpolateRequest, resolveVariables, validateVariables, extractVariables } from '../utils/variableInterpolation';
import { PostRequestScriptService } from './VisualApiDesigner/services/PostRequestScriptService';
import { VisualizationDebugger } from './VisualApiDesigner/services/VisualizationDebugger';
import { ExportService } from './VisualApiDesigner/services/ExportService';
import { AuthVisualizationService } from './VisualApiDesigner/services/AuthVisualizationService';
import { NetworkFlowService } from './VisualApiDesigner/services/NetworkFlowService';
import NetworkFlowHost from "./VisualApiDesigner/components/NetworkFlowHost";
import AuthFlowHost from "./VisualApiDesigner/components/AuthFlowHost";
import DebugConsoleHost from "./VisualApiDesigner/components/DebugConsoleHost";

const getApiUrl = (path) => path;

// HTTP Methods
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

/* Resizable key/value/description columns for the Params + Headers tables.
   Usage: call useColumnResizer(tableId) -> returns { widths, startDrag, resizer }.
   widths is keyed by column id ('key'|'value'|'description'); resizer is the
   <span> to drop inside each resizable <th>. Drag updates pixels; min 60px. */
const useColumnResizer = () => {
    const [widths, setWidths] = useState({ key: 0, value: 0, description: 0 });
    const dragRef = useRef(null);

    const startDrag = useCallback((colId, e) => {
        e.preventDefault();
        e.stopPropagation();
        const th = e.currentTarget.closest('th');
        if (!th) return;
        const startX = e.clientX;
        const startW = th.getBoundingClientRect().width;
        dragRef.current = { colId, startX, startW };

        const onMove = (ev) => {
            const d = dragRef.current;
            if (!d) return;
            const next = Math.max(60, d.startW + (ev.clientX - d.startX));
            setWidths((w) => ({ ...w, [d.colId]: next }));
        };
        const onUp = () => {
            dragRef.current = null;
            document.body.classList.remove('workspace-resizing');
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        document.body.classList.add('workspace-resizing');
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }, []);

    const resizer = useCallback((colId) => (
        <span
            className="col-resizer"
            onMouseDown={(e) => startDrag(colId, e)}
            role="separator"
            aria-orientation="vertical"
            aria-label={`Resize ${colId} column`}
            tabIndex={0}
        />
    ), [startDrag]);

    return { widths, resizer };
};

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

    // Resizable columns for the Params + Headers KV tables.
    const paramCols = useColumnResizer();
    const headerCols = useColumnResizer();

    // Response state - new state for storing response
    const [responseData, setResponseData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [responseError, setResponseError] = useState(null);

    // Notify parent split-pane view of response state changes (used when
    // this form is embedded with an external ResponseDisplay pane).
    useEffect(() => {
        if (onResponse) {
            onResponse(responseData, isLoading, responseError);
        }
    }, [responseData, isLoading, responseError, onResponse]);

    // Tab content states
    const [params, setParams] = useState(initialData.params || []);
    const [bodyFormData, setBodyFormData] = useState(initialData.bodyFormData || [{ enabled: true, key: '', value: '', description: '' }]);
    const [headers, setHeaders] = useState(initialData.headers || []);
    const [bodyType, setBodyType] = useState(initialData.bodyType || 'none');
    const [bodyContent, setBodyContent] = useState(initialData.body || '');
    const [binaryFile, setBinaryFile] = useState(null);
    const [isFileDragging, setIsFileDragging] = useState(false);
    const formatFileSize = (bytes) => {
        if (!bytes) return '0 Bytes';
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
        return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
    };
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
    // Local override after an in-panel add; falls back to the collection prop
    // (which a useState would otherwise capture stale on remount).
    const [collectionVariablesOverride, setCollectionVariablesOverride] = useState(null);
    // ponytail: useMemo keeps this stable across renders so the resolve-variables effect
    // (line ~294) doesn't loop on a fresh []/object ref every render → "Maximum update depth".
    const collectionVariables = useMemo(
        () => collectionVariablesOverride || collection?.variables || [],
        [collectionVariablesOverride, collection]
    );
    const [globalVariables, setGlobalVariables] = useState({});
    const [variableValidation, setVariableValidation] = useState({ isValid: true, missingVariables: [] });
    const [isVariableWarningDismissed, setIsVariableWarningDismissed] = useState(false);
    const [requestAddSignal, setRequestAddSignal] = useState(0);
    const missingVariableKey = variableValidation.missingVariables.join('\u001f');

    // A dismissed warning returns only when the set of unresolved variables changes.
    // Validation itself continues to prevent sending an incomplete request.
    useEffect(() => {
        setIsVariableWarningDismissed(false);
    }, [missingVariableKey]);

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
    const [exportFormat, setExportFormat] = useState(null);

    // Re-sync form state when user switches between requests.
    const prevRequestIdRef = useRef(null);
    useEffect(() => {
        const nextData = request || initialRequest || {};
        const nextId = nextData.id || nextData._id;

        // A save/send returns a fresh object for the same request. Keep the
        // in-progress form intact in that case instead of resetting it just
        // after the first Send click.
        if (prevRequestIdRef.current === nextId) return;

        setMethod(nextData.method || 'GET');
        setUrl(nextData.url || '');
        setRequestName(nextData.name || 'Get Users');
        setParams(nextData.params || []);
        setHeaders(nextData.headers || []);
        setBodyFormData(nextData.bodyFormData || [{ enabled: true, key: '', value: '', description: '' }]);
        setBodyType(nextData.bodyType || 'none');
        setBodyContent(nextData.body || '');
        setBinaryFile(null);
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

        // Clear the previous request's response ONLY when switching to a
        // different request — saving the same request returns a new object
        // reference for the same id, and clipping responseData there wipes
        // the just-rendered response (matches the "flashes then disappears"
        // symptom on Send).
        setResponseData(null);
        setResponseError(null);
        setIsLoading(false);
        setPostRequestScriptResults(null);
        prevRequestIdRef.current = nextId;
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
    const handleMethodChange = (nextMethod) => setMethod(
        typeof nextMethod === 'string' ? nextMethod : nextMethod.target.value
    );
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

    const handleAddVariable = async (variable, scopeId) => {
        if (scopeId === 'request') {
            setVariables(prev => [...prev, { id: Date.now().toString(), ...variable }]);
            return;
        }
        try {
            if (scopeId === 'environment' && environmentId) {
                const res = await fetch(getApiUrl(`/api/environments/${environmentId}/variables`), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(variable)
                });
                if (res.ok) {
                    const env = await res.json();
                    setEnvironmentVariables(env.variables || []);
                }
            } else if (scopeId === 'collection' && collectionId) {
                const res = await fetch(getApiUrl(`/api/collections/${collectionId}/variables`), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(variable)
                });
                if (res.ok) {
                    setCollectionVariablesOverride([...collectionVariables, variable]);
                }
            } else if (scopeId === 'global' && workspaceId) {
                const nextVariables = [...(Array.isArray(globalVariables) ? globalVariables : []), variable];
                const res = await fetch(getApiUrl(`/api/workspaces/${workspaceId}/global-variables`), {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ variables: nextVariables })
                });
                if (res.ok) {
                    setGlobalVariables(nextVariables);
                }
            }
        } catch (error) {
            console.error('Error adding variable:', error);
        }
    };

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

    // Body form-data handlers
    const handleBodyFormDataChange = (index, field, value) => {
        const next = [...bodyFormData];
        next[index] = { ...next[index], [field]: value };
        setBodyFormData(next);
    };

    const handleAddBodyFormData = () => {
        setBodyFormData([...bodyFormData, { enabled: true, key: '', value: '', description: '' }]);
    };

    const handleRemoveBodyFormData = (index) => {
        const next = [...bodyFormData];
        next.splice(index, 1);
        setBodyFormData(next);
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

    // Save button handler
    const handleSave = () => {
        // Build request object
        const requestData = {
            _id: initialData._id || initialData.id,
            id: initialData.id || initialData._id,
            name: requestName,
            workspaceId: workspaceId || initialData.workspaceId || null,
            method,
            url,
            params: params.filter(p => p.enabled && p.key),
            headers: headers.filter(h => h.enabled && h.key),
            bodyType,
            body: bodyContent,
            bodyFormData,
            preRequestScript,
            tests,
            testScript: tests,
            variables: variables.filter(v => v.key),
            authConfig,
            sslConfig,
            description: initialData.description || '',
            protocol: initialData.protocol || 'http',
            graphql: initialData.graphql,
            folderPath: initialData.folderPath || [],
            metadata: initialData.metadata || {},
            order: initialData.order,
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
            workspaceId: workspaceId || initialData.workspaceId || null,
            method,
            url,
            params: params.filter(p => p.enabled && p.key),
            headers: headers.filter(h => h.enabled && h.key),
            bodyType,
            body: bodyContent,
            bodyFormData,
            preRequestScript,
            tests,
            testScript: tests,
            variables: variables.filter(v => v.key),
            authConfig,
            sslConfig,
            description: initialData.description || '',
            protocol: initialData.protocol || 'http',
            graphql: initialData.graphql,
            folderPath: initialData.folderPath || [],
            metadata: initialData.metadata || {},
            order: initialData.order,
            isNew
        };

        // Apply variable interpolation to the request data
        const interpolatedRequest = interpolateRequest(requestData, resolvedVariables);

        // Check for external handlers first
        if (onSendRequest) {
            setIsLoading(true);
            setResponseData(null);
            setResponseError(null);
            try {
                const result = await onSendRequest(interpolatedRequest);
                if (result) {
                    setResponseData(result);
                }
            } catch (err) {
                setResponseError(err.message || 'Failed to send request');
            } finally {
                setIsLoading(false);
            }
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
                } else if (bodyType === 'x-www-form-urlencoded') {
                    const usp = new URLSearchParams();
                    bodyFormData.filter(f => f.enabled && f.key).forEach(f => usp.append(f.key, f.value || ''));
                    requestBody = usp.toString();
                } else if (bodyType === 'form-data') {
                    const fd = new FormData();
                    bodyFormData.filter(f => f.enabled && f.key).forEach(f => fd.append(f.key, f.value || ''));
                    requestBody = fd;
                }
            }

            // Log request body in debug console
            if (isDebugging && requestBody) {
                VisualizationDebugger.addLog(debugSessionId, 'info', `📤 Request body:`, requestBody);
            }

            const startTime = Date.now();
            requestId = `req-${startTime}`;
            const requestHasId = interpolatedRequest._id || interpolatedRequest.id;

            // Log that we're making the actual HTTP request
            if (isDebugging) {
                VisualizationDebugger.addLog(debugSessionId, 'info', `📡 Sending HTTP request${requestHasId ? ' via saved request endpoint' : ' via proxy'}...`);
            }

            // Saved requests go through /api/requests/:id/send so history + activity are recorded.
            // Unsaved/new requests fall back to the generic proxy.
            const sendUrl = requestHasId
                ? getApiUrl(`/api/requests/${requestHasId}/send`)
                : getApiUrl('/api/proxy');
            const sendBody = requestHasId
                ? JSON.stringify({
                    url: interpolatedRequest.url,
                    method: interpolatedRequest.method,
                    headers: interpolatedRequest.headers,
                    body: requestBody,
                    bodyType,
                    params: interpolatedRequest.params,
                    timeout: 30000,
                    debug: isDebugging,
                    debugSessionId
                })
                : JSON.stringify({
                    url: interpolatedRequest.url,
                    method: interpolatedRequest.method,
                    headers: headerObj,
                    body: requestBody,
                    timeout: 30000,
                    debug: isDebugging,
                    debugSessionId
                });

            const response = await fetch(sendUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: sendBody,
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

            // Process backend debug logs if provided (removed verbose console logging)
            if (finalResponseData.debugLogs && finalResponseData.debugLogs.length > 0 && isDebugging) {
                finalResponseData.debugLogs.forEach((log) => {
                    VisualizationDebugger.addLog(debugSessionId, log.level || 'info', `🔧 Backend: ${log.message}`, log.data);
                });
            }

        } catch (err) {
            const errorMessage = err.message || "An error occurred while sending the request";
            setResponseError(errorMessage);

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
                                <List size={18} />
                                <span>Query Parameters</span>
                            </div>
                            <span className="section-description">Parameters sent in the URL query string</span>
                        </div>
                        <div className="table-container">
                            <table className="params-table">
                                <thead>
                                    <tr>
                                        <th width="40"></th>
                                        <th width="30%" style={paramCols.widths.key ? { width: paramCols.widths.key } : undefined}>
                                            Key {paramCols.resizer('key')}
                                        </th>
                                        <th width="30%" style={paramCols.widths.value ? { width: paramCols.widths.value } : undefined}>
                                            Value {paramCols.resizer('value')}
                                        </th>
                                        <th style={paramCols.widths.description ? { width: paramCols.widths.description } : undefined}>
                                            Description {paramCols.resizer('description')}
                                        </th>
                                        <th width="48"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {params.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="empty-table-row">
                                                No parameters added. Use the button below to add your first parameter.
                                            </td>
                                        </tr>
                                    ) : params.map((param, index) => (
                                        <tr key={`param-${index}`} className="param-row">
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
                                            <td style={paramCols.widths.key ? { width: paramCols.widths.key } : undefined}>
                                                <input
                                                    type="text"
                                                    className={`table-input ${getVariableInputClass(param.key)}`}
                                                    value={param.key}
                                                    onChange={(e) => handleParamChange(index, 'key', e.target.value)}
                                                    placeholder="Enter Key"
                                                />
                                            </td>
                                            <td style={paramCols.widths.value ? { width: paramCols.widths.value } : undefined}>
                                                <input
                                                    type="text"
                                                    className={`table-input ${getVariableInputClass(param.value)}`}
                                                    value={param.value}
                                                    onChange={(e) => handleParamChange(index, 'value', e.target.value)}
                                                    placeholder="Enter Value"
                                                />
                                            </td>
                                            <td style={paramCols.widths.description ? { width: paramCols.widths.description } : undefined}>
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
                    </div>
                );

            case 'headers':
                return (
                    <div className="headers-section">
                        <div className="section-header-row">
                            <div className="section-title">
                                <LinkIcon size={18} />
                                <span>Request Headers</span>
                            </div>
                            <span className="section-description">Custom headers to include with the request</span>
                        </div>
                        <div className="table-container">
                            <table className="params-table">
                                <thead>
                                    <tr>
                                        <th width="40"></th>
                                        <th width="30%" style={headerCols.widths.key ? { width: headerCols.widths.key } : undefined}>
                                            Key {headerCols.resizer('key')}
                                        </th>
                                        <th width="30%" style={headerCols.widths.value ? { width: headerCols.widths.value } : undefined}>
                                            Value {headerCols.resizer('value')}
                                        </th>
                                        <th style={headerCols.widths.description ? { width: headerCols.widths.description } : undefined}>
                                            Description {headerCols.resizer('description')}
                                        </th>
                                        <th width="48"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {headers.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="empty-table-row">
                                                No headers added. Click below to add a custom header.
                                            </td>
                                        </tr>
                                    ) : headers.map((header, index) => (
                                        <tr key={`header-${index}`} className="param-row">
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
                                            <td style={headerCols.widths.key ? { width: headerCols.widths.key } : undefined}>
                                                <input
                                                    type="text"
                                                    className={`table-input ${getVariableInputClass(header.key)}`}
                                                    value={header.key}
                                                    onChange={(e) => handleHeaderChange(index, 'key', e.target.value)}
                                                    placeholder="Key"
                                                />
                                            </td>
                                            <td style={headerCols.widths.value ? { width: headerCols.widths.value } : undefined}>
                                                <input
                                                    type="text"
                                                    className={`table-input ${getVariableInputClass(header.value)}`}
                                                    value={header.value}
                                                    onChange={(e) => handleHeaderChange(index, 'value', e.target.value)}
                                                    placeholder="Value"
                                                />
                                            </td>
                                            <td style={headerCols.widths.description ? { width: headerCols.widths.description } : undefined}>
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
                                                <th width="40"></th>
                                                <th width="30%">Key</th>
                                                <th width="30%">Value</th>
                                                <th>Description</th>
                                                <th width="48"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {bodyFormData.map((field, index) => (
                                                <tr className="param-row" key={index}>
                                                    <td className="checkbox-cell">
                                                        <div className="custom-checkbox">
                                                            <input
                                                                type="checkbox"
                                                                id={`body-form-check-${index}`}
                                                                checked={field.enabled}
                                                                onChange={(e) => handleBodyFormDataChange(index, 'enabled', e.target.checked)}
                                                            />
                                                            <label htmlFor={`body-form-check-${index}`}></label>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            className="table-input"
                                                            placeholder="Key"
                                                            value={field.key}
                                                            onChange={(e) => handleBodyFormDataChange(index, 'key', e.target.value)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            className="table-input"
                                                            placeholder="Value"
                                                            value={field.value}
                                                            onChange={(e) => handleBodyFormDataChange(index, 'value', e.target.value)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            className="table-input"
                                                            placeholder="Description"
                                                            value={field.description}
                                                            onChange={(e) => handleBodyFormDataChange(index, 'description', e.target.value)}
                                                        />
                                                    </td>
                                                    <td className="action-cell">
                                                        <button type="button" className="delete-row-btn" onClick={() => handleRemoveBodyFormData(index)}>
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="add-row-container">
                                    <button type="button" className="modern-add-btn" onClick={handleAddBodyFormData}>
                                        <Plus size={16} />
                                        <span>Add Form Field</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {bodyType === 'binary' && (
                            <div className="binary-upload">
                                {!binaryFile ? (
                                    <label
                                        className={`binary-dropzone ${isFileDragging ? 'dragging' : ''}`}
                                        onDragOver={(e) => { e.preventDefault(); setIsFileDragging(true); }}
                                        onDragLeave={() => setIsFileDragging(false)}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            setIsFileDragging(false);
                                            const file = e.dataTransfer.files?.[0];
                                            if (file) setBinaryFile(file);
                                        }}
                                    >
                                        <input
                                            type="file"
                                            className="binary-file-input"
                                            onChange={(e) => setBinaryFile(e.target.files?.[0] || null)}
                                        />
                                        <Upload size={28} />
                                        <span className="binary-dropzone-title">Drop a file here or click to browse</span>
                                        <span className="binary-dropzone-hint">Sent as the raw request body</span>
                                    </label>
                                ) : (
                                    <div className="binary-file-selected">
                                        <FileIcon size={20} />
                                        <div className="binary-file-meta">
                                            <span className="binary-file-name">{binaryFile.name}</span>
                                            <span className="binary-file-size">{formatFileSize(binaryFile.size)}</span>
                                        </div>
                                        <label className="binary-file-replace" title="Replace file">
                                            <input
                                                type="file"
                                                className="binary-file-input"
                                                onChange={(e) => setBinaryFile(e.target.files?.[0] || null)}
                                            />
                                            Replace
                                        </label>
                                        <button
                                            type="button"
                                            className="binary-file-remove"
                                            onClick={() => setBinaryFile(null)}
                                            title="Remove file"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                )}
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
                                    type="button"
                                    className="btn btn-small"
                                    onClick={() => setShowVisualizationDebugger(!showVisualizationDebugger)}
                                >
                                    <Bug size={14} />
                                    Debug Console
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-small"
                                    onClick={() => {
                                        const templates = PostRequestScriptService.getScriptTemplates();
                                        // Show template selector modal
                                        console.log('Available templates:', templates);
                                    }}
                                >
                                    <FileText size={14} />
                                    Templates
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
                ); case 'variable-preview':
                return (
                    <div className="variable-preview-section">
                        <div className="vp-preview-header">
                            <h4>Variable Overview</h4>
                            <div className="vp-preview-header-actions">
                                {variableValidation.isValid ? (
                                    <span className="vp-status-valid"><CheckCircle2 size={13} /> All variables resolved</span>
                                ) : (
                                    <span className="vp-status-invalid"><AlertCircle size={13} /> {variableValidation.missingVariables.length} missing variable{variableValidation.missingVariables.length === 1 ? '' : 's'}</span>
                                )}
                                <button
                                    type="button"
                                    className="vp-add-variable-btn"
                                    onClick={() => setRequestAddSignal(n => n + 1)}
                                >
                                    <Plus size={13} /> Add request variable
                                </button>
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
                            editableScope={['request', environmentId && 'environment', collectionId && 'collection', workspaceId && 'global'].filter(Boolean)}
                            onAddVariable={handleAddVariable}
                            openAddSignal={requestAddSignal}
                            openAddScope="request"
                        />

                        {!variableValidation.isValid && (
                            <div className="vp-missing-alert">
                                <h5>Missing Variables ({variableValidation.missingVariables.length})</h5>
                                <p>The following variables are referenced but not defined:</p>
                                <div className="vp-missing-list">
                                    {variableValidation.missingVariables.map(varName => (
                                        <code key={varName} className="vp-missing-name">{varName}</code>
                                    ))}
                                </div>
                                <p className="vp-missing-help">
                                    Define these variables in your environment, collection, or request variables.
                                </p>
                            </div>
                        )}

                        {/\{\{[^}]+\}\}/.test(url + headers.map(h => h.key + h.value).join('') + (bodyContent || '')) && <div className="vp-interpolated">
                            <h5>Request Preview (with variables)</h5>
                            <div className="vp-url">
                                <strong>URL:</strong>
                                <code>{resolvedVariables ?
                                    url.replace(/\{\{([^}]+)\}\}/g, (match, varName) =>
                                        resolvedVariables[varName.trim()] || match
                                    ) : url
                                }</code>
                            </div>

                            {headers.filter(h => h.enabled && h.key).length > 0 && (
                                <div className="vp-headers">
                                    <strong>Headers:</strong>
                                    <div className="vp-header-list">
                                        {headers.filter(h => h.enabled && h.key).map((header, index) => (
                                            <div key={index} className="vp-header-item">
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
                                <div className="vp-body">
                                    <strong>Body:</strong>
                                    <pre className="vp-body-preview">
                                        {bodyContent.replace(/\{\{([^}]+)\}\}/g, (match, varName) =>
                                            resolvedVariables[varName.trim()] || match
                                        )}
                                    </pre>
                                </div>
                            )}
                        </div>}
                    </div>
                );

            case 'authorization':
                return (
                    <div className="auth-section">


                        <div className="auth-config">
                            <div className="auth-type-section">
                                <div className="section-header-row">
                                    <div className="section-title">
                                        <Lock size={18} />
                                        <span>Authentication</span>
                                    </div>
                                    <span className="section-description">Choose how the request authenticates against the API</span>
                                </div>
                                <div className="auth-type-grid" role="radiogroup" aria-label="Authentication type">
                                    {[
                                        { v: 'No Auth', label: 'No Auth', desc: 'Send request without credentials', icon: ShieldOff },
                                        { v: 'Bearer Token', label: 'Bearer', desc: 'Token in Authorization header', icon: Key },
                                        { v: 'Basic Auth', label: 'Basic', desc: 'Username + password (base64)', icon: UserCheck },
                                        { v: 'API Key', label: 'API Key', desc: 'Key sent via header or query', icon: KeyRound },
                                        { v: 'OAuth 2.0', label: 'OAuth 2.0', desc: 'Authorize + token exchange flow', icon: Fingerprint },
                                    ].map(({ v, label, desc, icon: Icon }) => {
                                        const active = authConfig.type === v;
                                        return (
                                            <button
                                                key={v}
                                                type="button"
                                                role="radio"
                                                aria-checked={active}
                                                className={`auth-type-card${active ? ' active' : ''}`}
                                                onClick={() => handleAuthConfigChange('type', v)}
                                            >
                                                <span className="auth-type-card-icon"><Icon size={20} /></span>
                                                <span className="auth-type-card-label">{label}</span>
                                                <span className="auth-type-card-desc">{desc}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Auth flow visualization container */}
                            {authFlowVisualization && (
                                <div className="auth-flow-container">
                                    <h5>Authentication Flow</h5>
                                    <div id="auth-flow-container" style={{ height: '400px', border: '1px solid var(--border-color)', marginTop: '10px' }}></div>
                                </div>
                            )}

                            {/* Existing auth configuration forms */}
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
                                        <div className={`status-indicator ${authConfig.oauth2.tokenStatus}`} />
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
                                <ShieldCheck size={18} />
                                <span>TLS & SSL</span>
                            </div>
                            <span className="section-description">Configure certificate validation and manage keys for mutual TLS authentication.</span>
                        </div>
                        <div className="ssl-config">
                            <div className="ssl-options">
                                <div className="ssl-options-header">
                                    <ShieldCheck size={16} />
                                    <span className="ssl-options-title">Certificate Validation</span>
                                </div>
                                <p className="ssl-section-hint">Control how Pigeon validates the server's TLS certificate.</p>
                                <div className="toggle-group">
                                    <label className={`toggle-row${sslConfig.verifyCert ? ' on' : ''}`}>
                                        <div className="toggle-text">
                                            <span className="toggle-label">Verify SSL certificates</span>
                                            <span className="toggle-hint">Require server certificate to be signed by a trusted CA.</span>
                                        </div>
                                        <span
                                            className="toggle-switch"
                                            role="switch"
                                            aria-checked={sslConfig.verifyCert}
                                            tabIndex={0}
                                            onClick={() => handleSSLConfigChange('verifyCert', !sslConfig.verifyCert)}
                                            onKeyDown={(e) => {
                                                if (e.key === ' ' || e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleSSLConfigChange('verifyCert', !sslConfig.verifyCert);
                                                }
                                            }}
                                        >
                                            <span className="toggle-knob" />
                                        </span>
                                    </label>
                                    <label className={`toggle-row${sslConfig.allowSelfSigned ? ' on' : ''}`}>
                                        <div className="toggle-text">
                                            <span className="toggle-label">Allow self-signed certificates</span>
                                            <span className="toggle-hint">Permit certificates not issued by a trusted CA.</span>
                                        </div>
                                        <span
                                            className="toggle-switch"
                                            role="switch"
                                            aria-checked={sslConfig.allowSelfSigned}
                                            tabIndex={0}
                                            onClick={() => handleSSLConfigChange('allowSelfSigned', !sslConfig.allowSelfSigned)}
                                            onKeyDown={(e) => {
                                                if (e.key === ' ' || e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleSSLConfigChange('allowSelfSigned', !sslConfig.allowSelfSigned);
                                                }
                                            }}
                                        >
                                            <span className="toggle-knob" />
                                        </span>
                                    </label>
                                </div>
                            </div>

                            <div className="certificate-upload">
                                <div className="cert-section-header">
                                    <KeyRound size={16} />
                                    <span className="ssl-section-title">Client Certificates</span>
                                </div>
                                <p className="ssl-section-hint">Attach a client certificate and key for mutual TLS authentication.</p>
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
                                                placeholder="Enter passphrase"
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
                                        <p className="passphrase-hint">Only required if your certificate is encrypted.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="ssl-actions">
                                <button
                                    type="button"
                                    className="btn-primary send-btn"
                                    onClick={handleTestSSLConnection}
                                    disabled={!url}
                                >
                                    <ShieldCheck size={14} />
                                    Test SSL Connection
                                </button>
                            </div>
                        </div>
                    </div>
                );

            case 'network-flow':
                return (
                    <div className="network-flow-section">
                        <div className="flow-header-row">
                            <div className="flow-header-text">
                                <div className="section-title">
                                    <Activity size={18} />
                                    <span>Network Flow Visualization</span>
                                </div>
                                <span className="section-description">Visualize your request journey through the network</span>
                            </div>
                            <div className="flow-actions">
                            <button
                                    className="flow-btn primary"
                                    onClick={async () => {
                                        try {
                                            // Initialize the NetworkFlowService first
                                            await NetworkFlowService.initialize();

                                            // Clear any existing content
                                            const container = document.getElementById('network-flow-diagram');
                                            if (container) {
                                                container.innerHTML = '';
                                            }

                                            // Get current request details
                                            const currentUrl = url;
                                            const currentMethod = method;
                                            const currentHeaders = {};

                                            // Extract headers from header inputs
                                            headers.forEach(header => {
                                                if (header.enabled && header.key && header.value) {
                                                    currentHeaders[header.key] = header.value;
                                                }
                                            });

                                            // Create the flow diagram with request details
                                            const flowData = await NetworkFlowService.createRealtimeFlow(
                                                'network-flow-diagram',
                                                {
                                                    animate: true,
                                                    requestUrl: currentUrl,
                                                    requestMethod: currentMethod,
                                                    headers: currentHeaders,
                                                    requestBody: bodyContent
                                                }
                                            );

                                            console.log('Flow diagram generated successfully:', flowData);
                                            setNetworkFlowData(flowData);
                                        } catch (error) {
                                            console.error('Error generating flow:', error);
                                            // Show error in the container
                                            const container = document.getElementById('network-flow-diagram');
                                            if (container) {
                                                container.innerHTML = `
                                                    <div class="flow-error-state">
                                                        <div class="error-icon">⚠️</div>
                                                        <h4>Error generating flow diagram</h4>
                                                        <p>${error.message}</p>
                                                        <p>Please check the console for more details.</p>
                                                    </div>
                                                `;
                                            }
                                        }
                                    }}
                                >
                                    <Play size={14} />
                                    Generate Flow
                                </button>
                                <button
                                    className="flow-btn secondary"
                                    onClick={async () => {
                                        try {
                                            // Initialize the NetworkFlowService first
                                            await NetworkFlowService.initialize();

                                            // Clear any existing content
                                            const container = document.getElementById('network-flow-diagram');
                                            if (container) {
                                                container.innerHTML = '';
                                            }

                                            // Create API spec from current request
                                            const apiSpec = {
                                                paths: {
                                                    [url || '/api/endpoint']: {
                                                        [method.toLowerCase()]: {
                                                            summary: `${method} ${url}`,
                                                            responses: {
                                                                '200': { description: 'Success' }
                                                            }
                                                        }
                                                    }
                                                }
                                            };

                                            // Generate topology
                                            const topology = NetworkFlowService.generateNetworkTopology(apiSpec);
                                            console.log('Network topology generated:', topology);

                                            if (topology.nodes && topology.edges && topology.nodes.length > 0) {
                                                // Create flow diagram
                                                const flowDiagram = NetworkFlowService.createApiFlowDiagram(
                                                    'network-flow-diagram',
                                                    topology.nodes,
                                                    topology.edges
                                                );
                                                setNetworkFlowData(flowDiagram);
                                                console.log('Request flow visualization created successfully');
                                            } else {
                                                // Show no data message
                                                const container = document.getElementById('network-flow-diagram');
                                                if (container) {
                                                    container.innerHTML = `
                                                        <div class="flow-empty-state">
                                                            <div class="empty-icon">📊</div>
                                                            <h4>No topology data available</h4>
                                                            <p>Try using the "Generate Flow" button instead.</p>
                                                        </div>
                                                    `;
                                                }
                                            }
                                        } catch (error) {
                                            console.error('Error visualizing request:', error);
                                            // Show error in the container
                                            const container = document.getElementById('network-flow-diagram');
                                            if (container) {
                                                container.innerHTML = `
                                                    <div class="flow-error-state">
                                                        <div class="error-icon">⚠️</div>
                                                        <h4>Error visualizing request</h4>
                                                        <p>${error.message}</p>
                                                        <p>Please check the console for more details.</p>
                                                    </div>
                                                `;
                                            }
                                        }
                                    }}
                                >
                                    <BarChart2 size={14} />
                                    Visualize Request
                                </button>
                            </div>
                        </div>

                        <div className="flow-content">
                            <div className="flow-diagram-container">
                                <div className="diagram-header">
                                    <div className="diagram-title-row">
                                        <span className="diagram-title-icon"><BarChart2 size={14} /></span>
                                        <h5>Request Flow</h5>
                                    </div>
                                    <div className="diagram-controls">
                                        <button
                                            className="control-btn"
                                            title="Zoom In"
                                            onClick={() => {
                                                const cy = NetworkFlowService.instances.get('network-flow-diagram');
                                                if (cy) {
                                                    const currentZoom = cy.zoom();
                                                    cy.zoom(currentZoom * 1.2);
                                                }
                                            }}
                                        >
                                            <ZoomIn size={14} />
                                        </button>
                                        <button
                                            className="control-btn"
                                            title="Fit to Screen"
                                            onClick={() => {
                                                const cy = NetworkFlowService.instances.get('network-flow-diagram');
                                                if (cy) {
                                                    cy.fit();
                                                }
                                            }}
                                        >
                                            <Maximize size={14} />
                                        </button>
                                        <button
                                            className="control-btn"
                                            title="Reset"
                                            onClick={() => {
                                                const cy = NetworkFlowService.instances.get('network-flow-diagram');
                                                if (cy) {
                                                    cy.zoom(1);
                                                    cy.center();
                                                }
                                            }}
                                        >
                                            <RotateCcw size={14} />
                                        </button>
                                    </div>
                                </div>
                                <div id="network-flow-diagram" className="flow-diagram">
                                    <div className="flow-empty-state">
                                        <Globe size={48} className="empty-icon" />
                                        <h4>Ready to visualize</h4>
                                        <p>Click "Generate Flow" to create a visual representation of your request flow</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flow-details">
                                <div className="details-header">
                                    <div className="details-title-row">
                                        <span className="details-title-icon"><List size={14} /></span>
                                        <h5>Flow Details</h5>
                                    </div>
                                    <div className="flow-status">
                                        <span className="status-indicator ready"></span>
                                        <span className="status-text">Ready</span>
                                    </div>
                                </div>
                                <div className="flow-steps">
                                    <div className="flow-step">
                                        <div className="step-number">1</div>
                                        <div className="step-content">
                                            <h6>Request Preparation</h6>
                                            <p>Validate headers and body</p>
                                        </div>
                                    </div>
                                    <div className="flow-step">
                                        <div className="step-number">2</div>
                                        <div className="step-content">
                                            <h6>DNS Resolution</h6>
                                            <p>Resolve domain to IP address</p>
                                        </div>
                                    </div>
                                    <div className="flow-step">
                                        <div className="step-number">3</div>
                                        <div className="step-content">
                                            <h6>TCP Connection</h6>
                                            <p>Establish connection to server</p>
                                        </div>
                                    </div>
                                    <div className="flow-step">
                                        <div className="step-number">4</div>
                                        <div className="step-content">
                                            <h6>HTTP Request</h6>
                                            <p>Send request to endpoint</p>
                                        </div>
                                    </div>
                                    <div className="flow-step">
                                        <div className="step-number">5</div>
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
                return (
                    <DebugConsoleHost
                        method={method}
                        url={url}
                        headers={headers}
                        bodyContent={bodyContent}
                        bodyType={bodyType}
                        authConfig={authConfig}
                        setCurrentDebugSession={setCurrentDebugSession}
                    />
                );

            case 'export-options':
                return (
                    <div className="export-options-section">
                        <div className="section-header-row">
                            <div className="section-title">
                                <FolderOutput size={18} />
                                <span>Export Request</span>
                            </div>
                            <span className="section-description">
                                Generate a shareable format of this request — Postman collection, cURL command, OpenAPI spec, or a link
                            </span>
                        </div>

                        <div className="auth-type-grid" role="radiogroup" aria-label="Export format">
                            {[
                                { key: 'postman', label: 'Postman', desc: 'Collection v2.1 JSON', icon: FileText },
                                { key: 'curl', label: 'cURL', desc: 'Shell command', icon: Terminal },
                                { key: 'openapi', label: 'OpenAPI', desc: '3.0 spec JSON', icon: FileText },
                                { key: 'share', label: 'Share Link', desc: 'Encoded URL', icon: Globe }
                            ].map(({ key, label, desc, icon: Icon }) => {
                                const active = exportFormat === key;
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        role="radio"
                                        aria-checked={active}
                                        className={`auth-type-card${active ? ' active' : ''}`}
                                        onClick={() => { setExportFormat(key); generateExportPreview(key); }}
                                    >
                                        <span className="auth-type-card-icon"><Icon size={20} /></span>
                                        <span className="auth-type-card-label">{label}</span>
                                        <span className="auth-type-card-desc">{desc}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {exportPreview && (
                            <div className="export-preview-box">
                                <div className="export-preview-head">
                                    <FileText size={15} />
                                    <span className="export-preview-title">{exportPreview.title}</span>
                                    {exportPreview.copyable && (
                                        <button
                                            type="button"
                                            className="export-copy-btn"
                                            onClick={() => navigator.clipboard?.writeText(exportPreview.content)}
                                        >
                                            Copy
                                        </button>
                                    )}
                                </div>
                                <pre className="export-preview-code">{exportPreview.content}</pre>
                            </div>
                        )}
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
                    {/* Generated from an OpenTelemetry span — link back while the trace still exists. */}
                    {initialData.metadata?.traceId && (
                        <a
                            className="request-source-trace"
                            href={`/workspace/trace-to-test?traceId=${encodeURIComponent(initialData.metadata.traceId)}`}
                            title={`Trace ${initialData.metadata.traceId} · span ${initialData.metadata.spanId || '—'}`}
                        >
                            Open source trace
                        </a>
                    )}
                </div>

                {/* URL bar */}
                <div className="request-url-bar">
                    <AppSelect
                        className={`request-method-select method-${method.toLowerCase()}`}
                        value={method}
                        onChange={handleMethodChange}
                        options={HTTP_METHODS.map((httpMethod) => ({
                            value: httpMethod,
                            label: httpMethod
                        }))}
                        id="request-method"
                    />
                    <input
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
                {!variableValidation.isValid && !isVariableWarningDismissed && (
                    <div className="variable-validation-error" role="alert">
                        <div className="variable-validation-header">
                            <span className="variable-validation-title">
                                <span className="variable-validation-icon" aria-hidden="true">⚠️</span>
                                <span>Missing Variables</span>
                            </span>
                            <button
                                type="button"
                                className="variable-validation-dismiss"
                                onClick={() => setIsVariableWarningDismissed(true)}
                                aria-label="Hide missing variables warning"
                                title="Hide warning"
                            >
                                <X size={16} aria-hidden="true" />
                            </button>
                        </div>
                        <div className="missing-variables-list">
                            {variableValidation.missingVariables.map(varName => (
                                <span key={varName} className="missing-variable-chip">
                                    {varName}
                                </span>
                            ))}
                        </div>
                        <div className="variable-validation-message">
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
                        <List size={16} /> <span>Params</span>
                    </div>
                    <div
                        className={`request-tab ${activeTab === 'headers' ? 'active' : ''}`}
                        onClick={() => handleTabChange('headers')}
                    >
                        <LinkIcon size={16} /> <span>Headers</span>
                    </div>
                    <div
                        className={`request-tab ${activeTab === 'authorization' ? 'active' : ''}`}
                        onClick={() => handleTabChange('authorization')}
                    >
                        <Lock size={16} /> <span>Authorization</span>
                    </div>
                    <div
                        className={`request-tab ${activeTab === 'body' ? 'active' : ''}`}
                        onClick={() => handleTabChange('body')}
                    >
                        <Box size={16} /> <span>Body</span>
                    </div>
                    <div
                        className={`request-tab ${activeTab === 'ssl' ? 'active' : ''}`}
                        onClick={() => handleTabChange('ssl')}
                    >
                        <ShieldCheck size={16} /> <span>SSL</span>
                    </div>
                    <div
                        className={`request-tab ${activeTab === 'pre-request-script' ? 'active' : ''}`}
                        onClick={() => handleTabChange('pre-request-script')}
                    >
                        <Zap size={16} /> <span>Script</span>
                    </div>
                    <div
                        className={`request-tab ${activeTab === 'tests' ? 'active' : ''}`}
                        onClick={() => handleTabChange('tests')}
                    >
                        <CheckCircle2 size={16} /> <span>Tests</span>
                    </div>
                    <div
                        className={`request-tab ${activeTab === 'variable-preview' ? 'active' : ''}`}
                        onClick={() => handleTabChange('variable-preview')}
                    >
                        <Key size={16} /> <span>Variables</span>
                    </div>
                    <div
                        className={`request-tab ${activeTab === 'network-flow' ? 'active' : ''}`}
                        onClick={() => handleTabChange('network-flow')}
                    >
                        <Activity size={16} /> <span>Flow</span>
                    </div>
                    <div
                        className={`request-tab ${activeTab === 'debug-console' ? 'active' : ''}`}
                        onClick={() => handleTabChange('debug-console')}
                    >
                        <Terminal size={16} /> <span>Debug</span>
                    </div>
                    <div
                        className={`request-tab ${activeTab === 'export-options' ? 'active' : ''}`}
                        onClick={() => handleTabChange('export-options')}
                    >
                        <FolderOutput size={16} /> <span>Export</span>
                    </div>
                </div>

                {/* Tab content (direct, without extra container) */}
                {renderTabContent()}
            </form>

            {/* Only show this response section when there's data to display and
                the parent isn't rendering its own split-pane response view. */}
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
