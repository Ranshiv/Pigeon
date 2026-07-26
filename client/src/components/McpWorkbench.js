import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiActivity, FiBookOpen, FiCode, FiCpu, FiPlay, FiRefreshCw, FiSave, FiSend, FiTool, FiTrash2, FiXCircle } from 'react-icons/fi';
import AppSelect from './common/AppSelect/AppSelect';
import './McpWorkbench.css';

const EMPTY_CATALOG = { tools: [], resources: [], prompts: [], resourceTemplates: [] };
const PROFILE_PLACEHOLDER = '__new_profile__';

const parseHeaders = (value) => value.split('\n').reduce((headers, line) => {
    const separator = line.indexOf(':');
    if (separator <= 0) return headers;
    const name = line.slice(0, separator).trim();
    const headerValue = line.slice(separator + 1).trim();
    if (name && headerValue) headers[name] = headerValue;
    return headers;
}, {});

const parseJsonObject = (value, label) => {
    try {
        const parsed = JSON.parse(value || '{}');
        if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error(`${label} must be a JSON object.`);
        return parsed;
    } catch (error) {
        throw new Error(error.message || `${label} must be valid JSON.`);
    }
};

const getTemplateVariables = (template = '') => [...new Set([...template.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1]))];

const formatHistoryTime = (value) => {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
};

const McpWorkbench = () => {
    const [serverUrl, setServerUrl] = useState('');
    const [headerText, setHeaderText] = useState('');
    const [preferredProtocolVersion, setPreferredProtocolVersion] = useState('2025-03-26');
    const [connection, setConnection] = useState(null);
    const [catalog, setCatalog] = useState(EMPTY_CATALOG);
    const [profiles, setProfiles] = useState([]);
    const [selectedProfileId, setSelectedProfileId] = useState(PROFILE_PLACEHOLDER);
    const [profileName, setProfileName] = useState('');
    const [history, setHistory] = useState([]);
    const [selectedToolName, setSelectedToolName] = useState('');
    const [toolArguments, setToolArguments] = useState('{}');
    const [resourceUri, setResourceUri] = useState('');
    const [selectedResourceTemplateUri, setSelectedResourceTemplateUri] = useState('');
    const [resourceTemplateValues, setResourceTemplateValues] = useState({});
    const [selectedPromptName, setSelectedPromptName] = useState('');
    const [promptArguments, setPromptArguments] = useState('{}');
    const [promptArgumentValues, setPromptArgumentValues] = useState({});
    const [connectionState, setConnectionState] = useState('idle');
    const [toolState, setToolState] = useState('idle');
    const [resourceState, setResourceState] = useState('idle');
    const [promptState, setPromptState] = useState('idle');
    const [profileState, setProfileState] = useState('idle');
    const [historyState, setHistoryState] = useState('idle');
    const [error, setError] = useState('');
    const [toolResult, setToolResult] = useState(null);
    const [resourceResult, setResourceResult] = useState(null);
    const [promptResult, setPromptResult] = useState(null);
    const [inspectorEvents, setInspectorEvents] = useState([]);

    const selectedTool = useMemo(
        () => catalog.tools.find((tool) => tool.name === selectedToolName) || null,
        [catalog.tools, selectedToolName]
    );

    const selectedPrompt = useMemo(
        () => catalog.prompts.find((prompt) => prompt.name === selectedPromptName) || null,
        [catalog.prompts, selectedPromptName]
    );

    const selectedResourceTemplate = useMemo(
        () => catalog.resourceTemplates.find((template) => template.uriTemplate === selectedResourceTemplateUri) || null,
        [catalog.resourceTemplates, selectedResourceTemplateUri]
    );

    const resourceTemplateVariables = useMemo(
        () => getTemplateVariables(selectedResourceTemplate?.uriTemplate),
        [selectedResourceTemplate]
    );

    const resolvedResourceUri = useMemo(() => {
        if (!selectedResourceTemplate) return resourceUri;
        return selectedResourceTemplate.uriTemplate.replace(/\{([^{}]+)\}/g, (_, name) => {
            const value = resourceTemplateValues[name];
            return value ? encodeURIComponent(value) : `{${name}}`;
        });
    }, [resourceTemplateValues, resourceUri, selectedResourceTemplate]);

    const updateConnectionSession = useCallback((payload) => {
        setConnection((current) => current ? {
            ...current,
            sessionId: payload.sessionId || current.sessionId,
            protocolVersion: payload.protocolVersion || current.protocolVersion
        } : current);
    }, []);

    const appendInspectorEvent = useCallback((label, trace) => {
        if (!trace) return;
        setInspectorEvents((current) => [...current, {
            id: `${Date.now()}-${current.length}`,
            label,
            trace,
            createdAt: new Date().toISOString()
        }].slice(-30));
    }, []);

    const loadProfiles = useCallback(async () => {
        const response = await fetch('/api/mcp/profiles', { credentials: 'include' });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || 'Unable to load MCP connection profiles.');
        setProfiles(payload);
    }, []);

    const loadHistory = useCallback(async () => {
        setHistoryState('loading');
        try {
            const response = await fetch('/api/mcp/history', { credentials: 'include' });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.message || 'Unable to load MCP history.');
            setHistory(payload);
            setHistoryState('ready');
        } catch (historyError) {
            setHistoryState('error');
        }
    }, []);

    useEffect(() => {
        Promise.all([loadProfiles(), loadHistory()]).catch(() => {
            // The workbench remains usable if optional saved data is unavailable.
        });
    }, [loadHistory, loadProfiles]);

    const postMcp = async (path, body) => {
        const response = await fetch(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body)
        });
        const payload = await response.json();
        if (!response.ok) {
            const requestError = new Error(payload.message || 'The MCP request failed.');
            requestError.trace = payload.trace;
            throw requestError;
        }
        return payload;
    };

    const applyCatalog = (nextCatalog, preserveSelection = false) => {
        const normalizedCatalog = { ...EMPTY_CATALOG, ...nextCatalog };
        setCatalog(normalizedCatalog);
        setSelectedToolName((current) => preserveSelection && normalizedCatalog.tools.some((tool) => tool.name === current) ? current : normalizedCatalog.tools[0]?.name || '');
        setResourceUri((current) => preserveSelection && current ? current : normalizedCatalog.resources[0]?.uri || '');
        setSelectedResourceTemplateUri((current) => preserveSelection && normalizedCatalog.resourceTemplates.some((template) => template.uriTemplate === current) ? current : '');
        setResourceTemplateValues((current) => preserveSelection ? current : {});
        setSelectedPromptName((current) => preserveSelection && normalizedCatalog.prompts.some((prompt) => prompt.name === current) ? current : normalizedCatalog.prompts[0]?.name || '');
    };

    const connect = async ({ refresh = false } = {}) => {
        if (!serverUrl.trim() || connectionState === 'connecting') return;
        setConnectionState('connecting');
        setError('');
        try {
            const payload = await postMcp('/api/mcp/connect', {
                url: serverUrl.trim(),
                headers: parseHeaders(headerText),
                protocolVersion: preferredProtocolVersion
            });

            setConnection(payload.connection);
            applyCatalog(payload.catalog, refresh);
            setConnectionState('connected');
            appendInspectorEvent(refresh ? 'Refresh capability discovery' : 'Initialize connection', payload.trace);
            loadHistory();
        } catch (requestError) {
            setConnection(null);
            if (!refresh) {
                setCatalog(EMPTY_CATALOG);
                setResourceUri('');
                setSelectedPromptName('');
            }
            setConnectionState('error');
            setError(requestError.message || 'Unable to connect to the MCP server.');
            appendInspectorEvent(refresh ? 'Refresh failed' : 'Connection failed', requestError.trace);
            loadHistory();
        }
    };

    const callTool = async () => {
        if (!connection || !selectedTool || toolState === 'running') return;
        let parsedArguments;
        try {
            parsedArguments = parseJsonObject(toolArguments, 'Tool arguments');
        } catch (parseError) {
            setError(parseError.message);
            return;
        }

        setToolState('running');
        setError('');
        try {
            const payload = await postMcp('/api/mcp/tools/call', {
                url: connection.url,
                sessionId: connection.sessionId,
                protocolVersion: connection.protocolVersion,
                headers: parseHeaders(headerText),
                name: selectedTool.name,
                arguments: parsedArguments
            });
            setToolResult(payload.result);
            updateConnectionSession(payload);
            appendInspectorEvent(`tools/call · ${selectedTool.name}`, payload.trace);
            setToolState('complete');
            loadHistory();
        } catch (requestError) {
            setToolState('error');
            setError(requestError.message || 'MCP tool call failed.');
            appendInspectorEvent(`tools/call failed · ${selectedTool.name}`, requestError.trace);
            loadHistory();
        }
    };

    const readResource = async () => {
        if (!connection || !resolvedResourceUri.trim() || resourceState === 'running') return;
        if (selectedResourceTemplate && resourceTemplateVariables.some((name) => !resourceTemplateValues[name])) {
            setError('Fill every resource template field before reading it.');
            return;
        }

        setResourceState('running');
        setError('');
        try {
            const payload = await postMcp('/api/mcp/resources/read', {
                url: connection.url,
                sessionId: connection.sessionId,
                protocolVersion: connection.protocolVersion,
                headers: parseHeaders(headerText),
                uri: resolvedResourceUri.trim()
            });
            setResourceResult(payload.result);
            updateConnectionSession(payload);
            appendInspectorEvent(`resources/read · ${resolvedResourceUri}`, payload.trace);
            setResourceState('complete');
            loadHistory();
        } catch (requestError) {
            setResourceState('error');
            setError(requestError.message || 'MCP resource read failed.');
            appendInspectorEvent(`resources/read failed · ${resolvedResourceUri}`, requestError.trace);
            loadHistory();
        }
    };

    const getPrompt = async () => {
        if (!connection || !selectedPrompt || promptState === 'running') return;
        let parsedArguments;
        try {
            parsedArguments = parseJsonObject(promptArguments, 'Prompt arguments');
        } catch (parseError) {
            setError(parseError.message);
            return;
        }

        setPromptState('running');
        setError('');
        try {
            const payload = await postMcp('/api/mcp/prompts/get', {
                url: connection.url,
                sessionId: connection.sessionId,
                protocolVersion: connection.protocolVersion,
                headers: parseHeaders(headerText),
                name: selectedPrompt.name,
                arguments: parsedArguments
            });
            setPromptResult(payload.result);
            updateConnectionSession(payload);
            appendInspectorEvent(`prompts/get · ${selectedPrompt.name}`, payload.trace);
            setPromptState('complete');
            loadHistory();
        } catch (requestError) {
            setPromptState('error');
            setError(requestError.message || 'MCP prompt retrieval failed.');
            appendInspectorEvent(`prompts/get failed · ${selectedPrompt.name}`, requestError.trace);
            loadHistory();
        }
    };

    const selectProfile = (profileId) => {
        setSelectedProfileId(profileId);
        if (profileId === PROFILE_PLACEHOLDER) return;
        const profile = profiles.find((item) => item._id === profileId);
        if (!profile) return;
        setProfileName(profile.name);
        setServerUrl(profile.url);
        setPreferredProtocolVersion(profile.protocolVersion || '2025-03-26');
        setHeaderText('');
        setError('');
    };

    const saveProfile = async () => {
        if (!profileName.trim() || !serverUrl.trim() || profileState === 'saving') {
            if (!profileName.trim()) setError('Enter a profile name before saving.');
            return;
        }
        setProfileState('saving');
        setError('');
        try {
            const response = await fetch('/api/mcp/profiles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name: profileName.trim(), url: serverUrl.trim(), protocolVersion: preferredProtocolVersion })
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.message || 'Unable to save the MCP connection profile.');
            setProfiles((current) => [payload, ...current.filter((profile) => profile._id !== payload._id)]);
            setSelectedProfileId(payload._id);
            setProfileState('saved');
        } catch (requestError) {
            setProfileState('error');
            setError(requestError.message || 'Unable to save the MCP connection profile.');
        }
    };

    const deleteProfile = async () => {
        if (selectedProfileId === PROFILE_PLACEHOLDER || profileState === 'deleting') return;
        setProfileState('deleting');
        try {
            const response = await fetch(`/api/mcp/profiles/${selectedProfileId}`, { method: 'DELETE', credentials: 'include' });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.message || 'Unable to delete the MCP connection profile.');
            setProfiles((current) => current.filter((profile) => profile._id !== selectedProfileId));
            setSelectedProfileId(PROFILE_PLACEHOLDER);
            setProfileName('');
            setProfileState('idle');
        } catch (requestError) {
            setProfileState('error');
            setError(requestError.message || 'Unable to delete the MCP connection profile.');
        }
    };

    const clearHistory = async () => {
        try {
            const response = await fetch('/api/mcp/history', { method: 'DELETE', credentials: 'include' });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.message || 'Unable to clear MCP history.');
            setHistory([]);
        } catch (requestError) {
            setError(requestError.message || 'Unable to clear MCP history.');
        }
    };

    const selectResource = (uri) => {
        setSelectedResourceTemplateUri('');
        setResourceTemplateValues({});
        setResourceUri(uri);
    };

    const selectResourceTemplate = (uriTemplate) => {
        const values = getTemplateVariables(uriTemplate).reduce((result, name) => ({ ...result, [name]: '' }), {});
        setSelectedResourceTemplateUri(uriTemplate);
        setResourceTemplateValues(values);
        setResourceUri('');
    };

    const selectPrompt = (name) => {
        const prompt = catalog.prompts.find((item) => item.name === name);
        const values = (prompt?.arguments || []).reduce((result, argument) => ({ ...result, [argument.name]: argument.default || '' }), {});
        setSelectedPromptName(name);
        setPromptArgumentValues(values);
        setPromptArguments(JSON.stringify(values, null, 2));
    };

    const updatePromptArgument = (name, value) => {
        const next = { ...promptArgumentValues, [name]: value };
        setPromptArgumentValues(next);
        setPromptArguments(JSON.stringify(next, null, 2));
    };

    return (
        <main className="mcp-workbench">
            <section className="mcp-hero">
                <div>
                    <span className="mcp-eyebrow"><FiCpu /> MCP Workbench</span>
                    <h1>Model Context Protocol</h1>
                    <p>Connect, inspect, and test remote MCP capabilities from your API workspace.</p>
                </div>
                <div className="mcp-hero-actions">
                    {connection && <button className="mcp-secondary-button" type="button" onClick={() => connect({ refresh: true })} disabled={connectionState === 'connecting'}><FiRefreshCw /> Refresh</button>}
                    <div className={`mcp-connection-pill mcp-connection-pill--${connectionState}`}><span /> {connectionState === 'connected' ? 'Connected' : connectionState === 'connecting' ? 'Connecting…' : 'Not connected'}</div>
                </div>
            </section>

            <section className="mcp-card mcp-connect-card">
                <div className="mcp-card-heading">
                    <div><h2>Connection</h2><p>Use a remote Streamable HTTP endpoint. Authorization headers stay in this browser session only.</p></div>
                    <button className="mcp-primary-button" type="button" onClick={() => connect()} disabled={!serverUrl.trim() || connectionState === 'connecting'}><FiSend /> {connectionState === 'connecting' ? 'Connecting…' : 'Connect'}</button>
                </div>
                <div className="mcp-profile-grid">
                    <label>Saved connection<AppSelect value={selectedProfileId} onChange={selectProfile} options={[{ value: PROFILE_PLACEHOLDER, label: 'New connection' }, ...profiles.map((profile) => ({ value: profile._id, label: profile.name }))]} /></label>
                    <label>Profile name<input value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Production MCP" maxLength="80" /></label>
                    <div className="mcp-profile-actions"><button className="mcp-secondary-button" type="button" onClick={saveProfile} disabled={!profileName.trim() || !serverUrl.trim() || profileState === 'saving'}><FiSave /> {profileState === 'saving' ? 'Saving…' : 'Save profile'}</button><button className="mcp-icon-button" type="button" onClick={deleteProfile} disabled={selectedProfileId === PROFILE_PLACEHOLDER || profileState === 'deleting'} aria-label="Delete selected profile" title="Delete selected profile"><FiTrash2 /></button></div>
                </div>
                <div className="mcp-form-grid">
                    <label>Server URL<input value={serverUrl} onChange={(event) => setServerUrl(event.target.value)} placeholder="https://mcp.example.com/mcp" autoComplete="url" /></label>
                    <label>Request headers<textarea value={headerText} onChange={(event) => setHeaderText(event.target.value)} placeholder={'Authorization: Bearer …\nX-API-Key: …'} rows="3" spellCheck="false" /></label>
                </div>
                {connection && <div className="mcp-server-details"><strong>{connection.serverInfo?.name || 'MCP server'}</strong><span>Protocol {connection.protocolVersion}</span>{connection.serverInfo?.version && <span>Server {connection.serverInfo.version}</span>}</div>}
                {error && <p className="mcp-error" role="alert"><FiXCircle /> {error}</p>}
            </section>

            <section className="mcp-operations-grid">
                <section className="mcp-card mcp-history-card">
                    <div className="mcp-card-heading"><div><h2><FiActivity /> Recent MCP activity</h2><p>Tool, resource, prompt, and connection activity is retained for this account.</p></div>{history.length > 0 && <button className="mcp-text-button" type="button" onClick={clearHistory}>Clear</button>}</div>
                    {historyState === 'loading' ? <p className="mcp-empty">Loading activity…</p> : history.length ? <ul className="mcp-history-list">{history.slice(0, 6).map((entry) => <li key={entry._id}><span className={`mcp-history-status mcp-history-status--${entry.success ? 'success' : 'failed'}`} /><div><strong>{entry.action}{entry.target ? ` · ${entry.target}` : ''}</strong><span>{entry.serverName || entry.serverUrl}</span></div><time>{formatHistoryTime(entry.createdAt)}</time></li>)}</ul> : <p className="mcp-empty">Your MCP activity will appear here.</p>}
                </section>

                <section className="mcp-card mcp-inspector-card">
                    <div className="mcp-card-heading"><div><h2><FiCode /> Protocol inspector</h2><p>Session-only JSON-RPC traces. Authorization headers are never shown.</p></div></div>
                    {inspectorEvents.length ? <div className="mcp-inspector-list">{inspectorEvents.slice().reverse().map((event) => <details key={event.id}><summary><span>{event.label}</span><time>{formatHistoryTime(event.createdAt)}</time></summary><pre>{JSON.stringify(event.trace, null, 2)}</pre></details>)}</div> : <p className="mcp-empty">Connect or run an operation to inspect protocol traffic.</p>}
                </section>
            </section>

            <section className="mcp-catalog-grid">
                <div className="mcp-card mcp-catalog-card"><h2><FiTool /> Tools <span>{catalog.tools.length}</span></h2>{catalog.tools.length ? <ul>{catalog.tools.map((tool) => <li key={tool.name}><strong>{tool.name}</strong><span>{tool.description || 'No description provided.'}</span></li>)}</ul> : <p className="mcp-empty">Connect to list tools.</p>}</div>
                <div className="mcp-card mcp-catalog-card"><h2><FiBookOpen /> Resources <span>{catalog.resources.length + catalog.resourceTemplates.length}</span></h2>{catalog.resources.length || catalog.resourceTemplates.length ? <ul>{catalog.resources.map((resource) => <li key={resource.uri || resource.name}><strong>{resource.name || resource.uri}</strong><span>{resource.description || resource.mimeType || 'Resource'}</span></li>)}{catalog.resourceTemplates.map((template) => <li key={template.uriTemplate}><strong>{template.name || template.uriTemplate}</strong><span>Template · {template.description || template.uriTemplate}</span></li>)}</ul> : <p className="mcp-empty">No resources advertised.</p>}</div>
                <div className="mcp-card mcp-catalog-card"><h2><FiPlay /> Prompts <span>{catalog.prompts.length}</span></h2>{catalog.prompts.length ? <ul>{catalog.prompts.map((prompt) => <li key={prompt.name}><strong>{prompt.name}</strong><span>{prompt.description || 'Prompt template'}</span></li>)}</ul> : <p className="mcp-empty">No prompts advertised.</p>}</div>
            </section>

            <section className="mcp-card mcp-tool-runner">
                <div className="mcp-card-heading"><div><h2>Run a tool</h2><p>Tool calls execute against the active connection.</p></div><button className="mcp-primary-button" type="button" onClick={callTool} disabled={!selectedTool || toolState === 'running'}><FiPlay /> {toolState === 'running' ? 'Running…' : 'Run tool'}</button></div>
                <div className="mcp-form-grid"><label>Tool<AppSelect value={selectedToolName} onChange={setSelectedToolName} options={catalog.tools.map((tool) => ({ value: tool.name, label: tool.name }))} placeholder="Choose a tool" disabled={!catalog.tools.length} /></label><label>Arguments (JSON)<textarea value={toolArguments} onChange={(event) => setToolArguments(event.target.value)} rows="7" spellCheck="false" /></label></div>
                {selectedTool?.inputSchema && <details className="mcp-schema"><summary>Input schema</summary><pre>{JSON.stringify(selectedTool.inputSchema, null, 2)}</pre></details>}
                {toolResult && <div className="mcp-result"><h3>Tool result</h3><pre>{JSON.stringify(toolResult, null, 2)}</pre></div>}
            </section>

            <section className="mcp-runner-grid">
                <section className="mcp-card mcp-tool-runner"><div className="mcp-card-heading"><div><h2>Read a resource</h2><p>Read an advertised URI or resolve an MCP resource template.</p></div><button className="mcp-primary-button" type="button" onClick={readResource} disabled={!connection || !resolvedResourceUri.trim() || resourceState === 'running'}><FiBookOpen /> {resourceState === 'running' ? 'Reading…' : 'Read resource'}</button></div>
                    <div className="mcp-form-grid mcp-form-grid--stacked"><label>Advertised resource<AppSelect value={selectedResourceTemplate ? '' : resourceUri} onChange={selectResource} options={catalog.resources.filter((resource) => resource.uri).map((resource) => ({ value: resource.uri, label: resource.name || resource.uri }))} placeholder="Choose a resource" disabled={!catalog.resources.length} /></label>{catalog.resourceTemplates.length > 0 && <label>Resource template<AppSelect value={selectedResourceTemplateUri} onChange={selectResourceTemplate} options={catalog.resourceTemplates.map((template) => ({ value: template.uriTemplate, label: template.name || template.uriTemplate }))} placeholder="Choose a template" /></label>}{resourceTemplateVariables.length > 0 && <div className="mcp-guided-fields">{resourceTemplateVariables.map((name) => <label key={name}>{name}<input value={resourceTemplateValues[name] || ''} onChange={(event) => setResourceTemplateValues((current) => ({ ...current, [name]: event.target.value }))} placeholder={`Value for ${name}`} /></label>)}</div>}<label>{selectedResourceTemplate ? 'Resolved resource URI' : 'Resource URI'}<input value={resolvedResourceUri} onChange={(event) => { setSelectedResourceTemplateUri(''); setResourceUri(event.target.value); }} placeholder="file:///… or resource://…" spellCheck="false" readOnly={Boolean(selectedResourceTemplate)} /></label></div>
                    {resourceResult && <div className="mcp-result"><h3>Resource content</h3><pre>{JSON.stringify(resourceResult, null, 2)}</pre></div>}
                </section>

                <section className="mcp-card mcp-tool-runner"><div className="mcp-card-heading"><div><h2>Get a prompt</h2><p>Resolve a server prompt with guided values or raw JSON.</p></div><button className="mcp-primary-button" type="button" onClick={getPrompt} disabled={!selectedPrompt || promptState === 'running'}><FiPlay /> {promptState === 'running' ? 'Loading…' : 'Get prompt'}</button></div>
                    <div className="mcp-form-grid mcp-form-grid--stacked"><label>Prompt<AppSelect value={selectedPromptName} onChange={selectPrompt} options={catalog.prompts.map((prompt) => ({ value: prompt.name, label: prompt.name }))} placeholder="Choose a prompt" disabled={!catalog.prompts.length} /></label>{selectedPrompt?.arguments?.length > 0 && <div className="mcp-guided-fields">{selectedPrompt.arguments.map((argument) => <label key={argument.name}>{argument.name}{argument.required && <em>Required</em>}<input value={promptArgumentValues[argument.name] || ''} onChange={(event) => updatePromptArgument(argument.name, event.target.value)} placeholder={argument.description || argument.name} /></label>)}</div>}<label>Arguments (JSON)<textarea value={promptArguments} onChange={(event) => setPromptArguments(event.target.value)} rows="5" spellCheck="false" /></label></div>
                    {selectedPrompt?.arguments?.length > 0 && <details className="mcp-schema"><summary>Prompt arguments</summary><pre>{JSON.stringify(selectedPrompt.arguments, null, 2)}</pre></details>}
                    {promptResult && <div className="mcp-result"><h3>Prompt messages</h3><pre>{JSON.stringify(promptResult, null, 2)}</pre></div>}
                </section>
            </section>
        </main>
    );
};

export default McpWorkbench;
