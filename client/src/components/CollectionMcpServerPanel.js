import React, { useCallback, useEffect, useState } from 'react';
import { FiCheck, FiClipboard, FiCode, FiCopy, FiKey, FiLoader, FiLock, FiRefreshCw, FiServer } from 'react-icons/fi';
import { toast } from 'react-toastify';
import './CollectionMcpServerPanel.css';

const readPayload = async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || 'The collection MCP server request failed.');
    return payload;
};

const copyText = async (value, label) => {
    try {
        await navigator.clipboard.writeText(value);
        toast.success(`${label} copied.`);
    } catch {
        toast.error(`Unable to copy the ${label.toLowerCase()}.`);
    }
};

const CollectionMcpServerPanel = ({ collectionId }) => {
    const [configuration, setConfiguration] = useState(null);
    const [requests, setRequests] = useState([]);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [selectedRequestIds, setSelectedRequestIds] = useState([]);
    const [enabled, setEnabled] = useState(false);
    const [accessToken, setAccessToken] = useState('');
    const [state, setState] = useState('loading');
    const [saving, setSaving] = useState(false);
    const [rotating, setRotating] = useState(false);

    const applyPayload = useCallback((payload) => {
        const nextConfiguration = payload.configuration;
        setConfiguration(nextConfiguration);
        setRequests(payload.requests || []);
        setName(nextConfiguration?.name || '');
        setDescription(nextConfiguration?.description || '');
        setSelectedRequestIds(nextConfiguration?.requestIds || []);
        setEnabled(nextConfiguration?.enabled === true);
    }, []);

    const loadConfiguration = useCallback(async () => {
        setState('loading');
        try {
            const response = await fetch(`/api/mcp/servers/collections/${collectionId}`, { credentials: 'include' });
            applyPayload(await readPayload(response));
            setState('ready');
        } catch (error) {
            setState('error');
            toast.error(error.message || 'Unable to load the collection MCP server.');
        }
    }, [applyPayload, collectionId]);

    useEffect(() => {
        loadConfiguration();
    }, [loadConfiguration]);

    const toggleRequest = (requestId) => {
        setSelectedRequestIds((current) => current.includes(requestId)
            ? current.filter((id) => id !== requestId)
            : [...current, requestId]);
    };

    const saveConfiguration = async () => {
        if (saving) return;
        setSaving(true);
        try {
            const response = await fetch(`/api/mcp/servers/collections/${collectionId}`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description, enabled, requestIds: selectedRequestIds })
            });
            applyPayload(await readPayload(response));
            toast.success('Collection MCP server saved.');
        } catch (error) {
            toast.error(error.message || 'Unable to save the collection MCP server.');
        } finally {
            setSaving(false);
        }
    };

    const rotateToken = async () => {
        if (rotating) return;
        setRotating(true);
        try {
            const response = await fetch(`/api/mcp/servers/collections/${collectionId}/token`, {
                method: 'POST',
                credentials: 'include'
            });
            const payload = await readPayload(response);
            applyPayload(payload);
            setAccessToken(payload.accessToken || '');
            toast.success(configuration?.hasAccessToken ? 'Access token rotated.' : 'Access token generated.');
        } catch (error) {
            toast.error(error.message || 'Unable to generate an access token.');
        } finally {
            setRotating(false);
        }
    };

    if (state === 'loading') {
        return <div className="collection-mcp-loading"><FiLoader className="spinning" /> Loading MCP server settings…</div>;
    }

    if (state === 'error') {
        return (
            <div className="collection-mcp-error">
                <p>Unable to load this collection’s MCP server settings.</p>
                <button type="button" className="collection-mcp-secondary-button" onClick={loadConfiguration}><FiRefreshCw /> Try again</button>
            </div>
        );
    }

    const endpoint = configuration?.endpoint || 'https://your-pigeon-host/api/mcp-server/collections/your-collection-id';
    const initializeCommand = `# Step 5 — initialize the MCP server
$endpoint = "${endpoint}"
$tokenSecret = Read-Host "Paste bearer token" -AsSecureString
$token = [System.Net.NetworkCredential]::new("", $tokenSecret).Password
$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }

$initialize = @{
  jsonrpc = "2.0"; id = 1; method = "initialize"
  params = @{ protocolVersion = "2025-03-26"; capabilities = @{}; clientInfo = @{ name = "Pigeon MCP test"; version = "1.0" } }
} | ConvertTo-Json -Depth 8

Invoke-RestMethod -Method Post -Uri $endpoint -Headers $headers -Body $initialize`;
    const discoverToolsCommand = `# Step 6 — list the generated collection tools
$toolsRequest = @{ jsonrpc = "2.0"; id = 2; method = "tools/list"; params = @{} } | ConvertTo-Json -Depth 8
$tools = Invoke-RestMethod -Method Post -Uri $endpoint -Headers $headers -Body $toolsRequest
$tools.result.tools | Format-Table name, description`;
    const callToolCommand = `# Step 7 — call the first listed tool
$toolName = $tools.result.tools[0].name
$callRequest = @{
  jsonrpc = "2.0"; id = 3; method = "tools/call"
  params = @{ name = $toolName; arguments = @{} }
} | ConvertTo-Json -Depth 8

Invoke-RestMethod -Method Post -Uri $endpoint -Headers $headers -Body $callRequest
Remove-Variable token, tokenSecret`;

    return (
        <section className="collection-mcp-panel">
            <div className="collection-mcp-hero">
                <div className="collection-mcp-hero-icon"><FiServer /></div>
                <div>
                    <span className="collection-mcp-eyebrow">Hosted MCP server</span>
                    <h2>Give agents controlled access to this collection</h2>
                    <p>Select the HTTP requests an MCP client may use. Saved headers, authentication, and collection variables remain on Pigeon’s server.</p>
                </div>
                <label className="collection-mcp-toggle">
                    <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
                    <span>{enabled ? 'Enabled' : 'Disabled'}</span>
                </label>
            </div>

            <div className="collection-mcp-grid">
                <div className="collection-mcp-card collection-mcp-setup-card">
                    <div className="collection-mcp-card-heading">
                        <FiCode />
                        <div><h3>Server configuration</h3><p>These details are shown to the connecting MCP client.</p></div>
                    </div>
                    <label className="collection-mcp-field">
                        <span>Server name</span>
                        <input value={name} onChange={(event) => setName(event.target.value)} maxLength="100" placeholder="My collection MCP server" />
                    </label>
                    <label className="collection-mcp-field">
                        <span>Description <em>optional</em></span>
                        <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength="500" rows="3" placeholder="What agents can do with these tools" />
                    </label>

                    <div className="collection-mcp-request-heading">
                        <div><h3>Exposed requests</h3><p>{selectedRequestIds.length} of {requests.length} HTTP requests selected</p></div>
                    </div>
                    <div className="collection-mcp-request-list">
                        {requests.length ? requests.map((request) => (
                            <label className="collection-mcp-request" key={request.id}>
                                <input type="checkbox" checked={selectedRequestIds.includes(request.id)} onChange={() => toggleRequest(request.id)} />
                                <span className={`collection-mcp-method method-${request.method.toLowerCase()}`}>{request.method}</span>
                                <span className="collection-mcp-request-info"><strong>{request.name}</strong><small>{request.url}</small></span>
                                {selectedRequestIds.includes(request.id) ? <FiCheck className="collection-mcp-selected" /> : null}
                            </label>
                        )) : <div className="collection-mcp-empty">This collection has no HTTP requests eligible to expose yet.</div>}
                    </div>

                    <button type="button" className="collection-mcp-primary-button" onClick={saveConfiguration} disabled={saving}>
                        {saving ? <FiLoader className="spinning" /> : <FiCheck />} {saving ? 'Saving…' : 'Save MCP server'}
                    </button>
                </div>

                <aside className="collection-mcp-card collection-mcp-connect-card">
                    <div className="collection-mcp-card-heading">
                        <FiKey />
                        <div><h3>Connect an MCP client</h3><p>Use this endpoint with a bearer token.</p></div>
                    </div>
                    <label className="collection-mcp-readonly-field">
                        <span>Server endpoint</span>
                        <div><code>{configuration?.endpoint}</code><button type="button" onClick={() => copyText(configuration?.endpoint, 'Endpoint')} aria-label="Copy server endpoint"><FiCopy /></button></div>
                    </label>
                    <div className="collection-mcp-token-section">
                        <div>
                            <span>Bearer token</span>
                            <p>{configuration?.hasAccessToken ? `A token ending in ${configuration.tokenLastFour} is active.` : 'Generate a token after saving your server configuration.'}</p>
                        </div>
                        <button type="button" className="collection-mcp-secondary-button" onClick={rotateToken} disabled={rotating}>
                            {rotating ? <FiLoader className="spinning" /> : <FiRefreshCw />} {configuration?.hasAccessToken ? 'Rotate token' : 'Generate token'}
                        </button>
                    </div>
                    {accessToken ? (
                        <div className="collection-mcp-token-reveal">
                            <div><FiLock /><strong>Copy this token now</strong></div>
                            <p>For security, Pigeon will not display this token again.</p>
                            <div className="collection-mcp-token-value"><code>{accessToken}</code><button type="button" onClick={() => copyText(accessToken, 'Bearer token')} aria-label="Copy bearer token"><FiClipboard /></button></div>
                        </div>
                    ) : null}
                    <div className="collection-mcp-client-note">
                        <strong>Client setup</strong>
                        <p>Configure a Streamable HTTP MCP connection to the endpoint above and send <code>Authorization: Bearer &lt;token&gt;</code>.</p>
                    </div>
                </aside>
            </div>

            <details className="collection-mcp-test-guide" open>
                <summary><FiCode /> Test this MCP server with PowerShell</summary>
                <p>Follow the setup steps once, then copy the PowerShell steps in order. Paste the bearer token only into your local terminal; Pigeon never includes it in this guide.</p>
                <div className="collection-mcp-guide-section">
                    <h3>Set up the server</h3>
                    <div className="collection-mcp-setup-steps">
                        <article><div className="collection-mcp-guide-step-number">1</div><div><h4>Create or choose an HTTP request</h4><p>Use a safe public API request for your first test. Only HTTP collection requests can become tools.</p></div></article>
                        <article><div className="collection-mcp-guide-step-number">2</div><div><h4>Select the request</h4><p>Tick it under Exposed requests. Only selected requests are visible to MCP clients.</p></div></article>
                        <article><div className="collection-mcp-guide-step-number">3</div><div><h4>Enable and save</h4><p>Turn on Enabled at the top of this page, then click Save MCP server.</p></div></article>
                        <article><div className="collection-mcp-guide-step-number">4</div><div><h4>Generate a bearer token</h4><p>Copy it once and keep it private. Rotate the token whenever you need to revoke access.</p></div></article>
                    </div>
                </div>
                <div className="collection-mcp-guide-section">
                    <h3>Verify with PowerShell</h3>
                </div>
                <div className="collection-mcp-guide-steps">
                    <article>
                        <div className="collection-mcp-guide-step-number">5</div>
                        <div><h3>Initialize</h3><p>Confirms that the endpoint and bearer token are valid.</p></div>
                        <pre><code>{initializeCommand}</code></pre>
                    </article>
                    <article>
                        <div className="collection-mcp-guide-step-number">6</div>
                        <div><h3>List tools</h3><p>Shows the requests selected as MCP tools above.</p></div>
                        <pre><code>{discoverToolsCommand}</code></pre>
                    </article>
                    <article>
                        <div className="collection-mcp-guide-step-number">7</div>
                        <div><h3>Call a tool</h3><p>Runs the first listed tool. Use only a safe test request when validating your server.</p></div>
                        <pre><code>{callToolCommand}</code></pre>
                    </article>
                </div>
            </details>
        </section>
    );
};

export default CollectionMcpServerPanel;
