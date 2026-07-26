// client/src/components/asyncapi/AsyncApiSection.js
// AsyncAPI design & testing: workspace picker (useWorkspaceOptions), summary
// tiles, list+filters, designer/import/test/scenarios panels, empty state.
// Mirrors TraceToTestSection structure closely; uses aa-* CSS namespace.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    FiActivity, FiAlertTriangle, FiBookOpen, FiDownload,
    FiPlus, FiRadio, FiRefreshCw, FiServer, FiTrash2, FiUpload, FiZap
} from 'react-icons/fi';
import AppSelect from '../common/AppSelect/AppSelect';
import { useWorkspaceOptions } from '../compliance/useWorkspaceOptions';
import AsyncApiDesigner from './AsyncApiDesigner';
import AsyncApiImportPanel from './AsyncApiImportPanel';
import AsyncApiModal from './AsyncApiModal';
import AsyncApiTestRunPanel from './AsyncApiTestRunPanel';
import AsyncApiScenarioManager from './AsyncApiScenarioManager';
import './asyncapi.css';

const STATUS_FILTERS = [
    { value: 'all', label: 'Any status' },
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' },
    { value: 'deprecated', label: 'Deprecated' }
];
const PROTOCOL_FILTERS = [
    { value: 'all', label: 'Any protocol' },
    { value: 'websocket', label: 'WebSocket' },
    { value: 'mqtt', label: 'MQTT' },
    { value: 'http', label: 'HTTP (webhook)' },
    { value: 'kafka', label: 'Kafka' },
    { value: 'amqp', label: 'AMQP' },
    { value: 'socketio', label: 'Socket.IO' },
    { value: 'nats', label: 'NATS' },
    { value: 'stomp', label: 'STOMP' }
];

const fmtTime = (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? 'Never' : d.toLocaleString(); };

const Tile = ({ icon: Icon, label, value, tone }) => (
    <div className={`aa-tile${tone ? ` aa-tile--${tone}` : ''}`}>
        <span className="aa-tile-label">{Icon && <Icon className="aa-tile-icon" />}{label}</span>
        <span className="aa-tile-value">{value}</span>
    </div>
);

const AsyncApiSection = () => {
    const { workspaces, defaultWorkspaceId, loading: workspacesLoading } = useWorkspaceOptions();

    const [workspaceId, setWorkspaceId] = useState('');
    const [docs, setDocs] = useState([]);
    const [environments, setEnvironments] = useState([]);
    const [protocolFilter, setProtocolFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [tagFilter, setTagFilter] = useState('all');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showImport, setShowImport] = useState(false);

    const [selectedId, setSelectedId] = useState(null);
    const [selected, setSelected] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailVersion, setDetailVersion] = useState(0);
    const [docError, setDocError] = useState(null);

    useEffect(() => { if (!workspaceId && defaultWorkspaceId) setWorkspaceId(defaultWorkspaceId); }, [defaultWorkspaceId, workspaceId]);

    const loadAll = useCallback(async (signal) => {
        if (!workspaceId) return;
        try {
            setLoading(true); setError(null);
            const params = new URLSearchParams({ workspaceId });
            if (protocolFilter !== 'all') params.set('protocol', protocolFilter);
            if (statusFilter !== 'all') params.set('status', statusFilter);
            if (tagFilter !== 'all') params.set('tag', tagFilter);
            const [docsRes, envsRes] = await Promise.all([
                fetch(`/api/asyncapi?${params.toString()}`, { credentials: 'include', signal }),
                fetch(`/api/environments?workspaceId=${encodeURIComponent(workspaceId)}`, { credentials: 'include', signal })
            ]);
            if (!docsRes.ok) {
                const t = await docsRes.text(); let msg = t; try { msg = JSON.parse(t).message || t; } catch { /* */ }
                throw new Error(msg || `Failed to load AsyncAPI docs (${docsRes.status})`);
            }
            const data = await docsRes.json();
            setDocs(data.documents || []);
            if (envsRes.ok) { const b = await envsRes.json(); setEnvironments(Array.isArray(b) ? b : (b.environments || [])); }
        } catch (e) {
            if (e.name === 'AbortError') return;
            setError(e.message || 'Failed to load AsyncAPI documents'); setDocs([]);
        } finally { setLoading(false); }
    }, [workspaceId, protocolFilter, statusFilter, tagFilter]);

    useEffect(() => { const c = new AbortController(); loadAll(c.signal); return () => c.abort(); }, [loadAll]);

    useEffect(() => {
        if (!selectedId || !workspaceId) { setSelected(null); return undefined; }
        const c = new AbortController();
        (async () => {
            try {
                setDetailLoading(true); setDocError(null);
                const res = await fetch(`/api/asyncapi/${encodeURIComponent(selectedId)}`, { credentials: 'include', signal: c.signal });
                const t = await res.text(); let data = {}; try { data = JSON.parse(t); } catch { /* */ }
                if (!res.ok) throw new Error(data.message || t || `Failed to load (${res.status})`);
                setSelected(data);
            } catch (e) {
                if (e.name === 'AbortError') return;
                setDocError(e.message || 'Failed to load document'); setSelected(null);
            } finally { setDetailLoading(false); }
        })();
        return () => c.abort();
    }, [selectedId, workspaceId, detailVersion]);

    const tagOptions = useMemo(() => {
        const set = new Set();
        docs.forEach((d) => (d.tags || []).forEach((t) => set.add(t)));
        return [{ value: 'all', label: 'Any tag' }, ...[...set].map((t) => ({ value: t, label: t }))];
    }, [docs]);

    const summary = useMemo(() => {
        const protocols = new Set();
        let channels = 0; let messages = 0;
        docs.forEach((d) => {
            (d.servers || []).forEach((s) => protocols.add(s.protocol));
            channels += (d.channels || []).length;
            messages += (d.messages || []).length;
        });
        const failing = docs.filter((d) => d.lastRun?.result === 'failed' || d.lastRun?.result === 'error').length;
        return { total: docs.length, failing, protocols: protocols.size, channels, messages };
    }, [docs]);

    const saveDocument = async (next) => {
        if (!selected?._id) return;
        setDocError(null);
        try {
            const res = await fetch(`/api/asyncapi/${selected._id}`, {
                method: 'PUT', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: next.name, description: next.description, version: next.version,
                    asyncApiVersion: next.asyncApiVersion, status: next.status, tags: next.tags,
                    servers: next.servers, channels: next.channels, messages: next.messages, operations: next.operations
                })
            });
            if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.message || `Save failed (${res.status})`); }
            setSelected(await res.json());
            loadAll();
            return true;
        } catch (e) {
            setDocError(e.message || 'Save failed');
            return false;
        }
    };

    const handleTestRun = useCallback((run) => {
        // Keep the workbench mounted so AsyncApiTestRunPanel retains and shows
        // its detailed result. Only update the denormalised latest-run summary
        // locally, then refresh the inventory list in the background.
        setSelected((current) => current ? {
            ...current,
            lastRun: {
                runId: run?._id || null,
                result: run?.status || null,
                ranAt: run?.createdAt || run?.timestamp || new Date().toISOString()
            }
        } : current);
        loadAll();
    }, [loadAll]);

    const createBlank = async () => {
        if (!workspaceId) return;
        try {
            const res = await fetch('/api/asyncapi', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceId, name: 'Untitled AsyncAPI document' })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'Create failed');
            await loadAll();
            setSelectedId(data._id);
        } catch (e) { setError(e.message || 'Create failed'); }
    };

    const removeDocument = async (id) => {
        const res = await fetch(`/api/asyncapi/${id}`, { method: 'DELETE', credentials: 'include' });
        if (res.ok) { if (selectedId === id) setSelectedId(null); loadAll(); }
    };

    const exportDoc = async (id, name) => {
        const res = await fetch(`/api/asyncapi/${id}/export`, { credentials: 'include' });
        if (!res.ok) { setError('Export failed'); return; }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${name || 'document'}.asyncapi.json`;
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    };

    const openDocumentation = async (id, name) => {
        // Hands the generated doc to the existing Documentation section via collection landing.
        try {
            const res = await fetch(`/api/documentation/asyncapi/${id}`, {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}) // no target collection: server returns markdown
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'Documentation generation failed');
            // Surface as inline notice rather than navigating; user can copy from console / future link.
            setDocError(null);
            if (data.documentation?.content) {
                const blob = new Blob([data.documentation.content], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `${name || 'document'}.asyncapi.md`;
                document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
            }
        } catch (e) { setDocError(e.message || 'Documentation generation failed'); }
    };

    const workspaceOptions = workspaces.map((w) => ({ value: w.id, label: w.label }));

    return (
        <div className="aa-root">
            <header className="aa-header">
                <div>
                    <h1 className="aa-title">AsyncAPI</h1>
                    <p className="aa-subtitle">Design event-driven APIs (WebSocket, MQTT, HTTP), run protocol-aware tests against live brokers, and ship docs from one model.</p>
                </div>
                <div className="aa-header-actions">
                    <button className="aa-btn aa-btn--ghost" onClick={() => loadAll()} disabled={loading}><FiRefreshCw className={loading ? 'aa-spin' : undefined} /> Refresh</button>
                    <button className="aa-btn aa-btn--primary" onClick={() => setShowImport((v) => !v)} disabled={!workspaceId}><FiUpload /> Import</button>
                    <button className="aa-btn aa-btn--primary" onClick={createBlank} disabled={!workspaceId}><FiPlus /> New document</button>
                </div>
            </header>

            {docs.length > 0 && (
                <div className="aa-summary">
                    <Tile icon={FiActivity} label="Documents" value={summary.total} />
                    <Tile icon={FiAlertTriangle} label="Failing tests" value={summary.failing} tone={summary.failing > 0 ? 'warn' : undefined} />
                    <Tile icon={FiRadio} label="Channels" value={summary.channels} />
                    <Tile icon={FiZap} label="Messages" value={summary.messages} />
                </div>
            )}

            <AsyncApiModal
                open={showImport}
                title="Import AsyncAPI"
                onClose={() => setShowImport(false)}
                variant="form"
            >
                <AsyncApiImportPanel
                    embedded
                    workspaceId={workspaceId}
                    onClose={() => setShowImport(false)}
                    onImported={() => loadAll()}
                />
            </AsyncApiModal>

            <div className="aa-card">
                <div className="aa-card-head">
                    <div className="aa-card-title"><FiServer className="aa-card-title-icon" /> AsyncAPI documents</div>
                    <span className="aa-muted">{loading ? 'Loading…' : `${docs.length} document${docs.length === 1 ? '' : 's'}`}</span>
                </div>

                <div className="aa-filters">
                    <div className="aa-field">
                        <label htmlFor="aa-workspace">Workspace</label>
                        <AppSelect id="aa-workspace" value={workspaceId} onChange={setWorkspaceId} disabled={workspacesLoading} options={workspaceOptions.length ? workspaceOptions : [{ value: '', label: 'No workspaces' }]} />
                    </div>
                    <div className="aa-field"><label htmlFor="aa-protocol">Protocol</label><AppSelect id="aa-protocol" value={protocolFilter} onChange={setProtocolFilter} options={PROTOCOL_FILTERS} /></div>
                    <div className="aa-field"><label htmlFor="aa-status">Status</label><AppSelect id="aa-status" value={statusFilter} onChange={setStatusFilter} options={STATUS_FILTERS} /></div>
                    <div className="aa-field"><label htmlFor="aa-tag">Tag</label><AppSelect id="aa-tag" value={tagFilter} onChange={setTagFilter} options={tagOptions} /></div>
                </div>

                {error && <div className="aa-error">{error}</div>}

                {loading && docs.length === 0 && <div className="aa-loading">Loading AsyncAPI documents…</div>}

                {!loading && !error && docs.length === 0 && (
                    <div className="aa-empty">
                        <strong>No AsyncAPI documents yet.</strong>
                        <span>Import an AsyncAPI 2.x or 3.0 spec, or create a blank one to start designing channels and messages.</span>
                    </div>
                )}

                {docs.length > 0 && (
                    <div className="aa-table-wrap">
                        <table className="aa-table">
                            <thead>
                                <tr><th>Document</th><th>Version</th><th>Protocol(s)</th><th>Channels</th><th>Messages</th><th>Status</th><th>Latest test</th><th>Updated</th><th></th></tr>
                            </thead>
                            <tbody>
                                {docs.map((d) => (
                                    <tr key={d._id} className={`aa-row${d._id === selectedId ? ' aa-row--active' : ''}`} onClick={() => setSelectedId(d._id)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(d._id); } }}>
                                        <td><span className="aa-name">{d.name}</span>{d.description && <span className="aa-sub">{d.description}</span>}</td>
                                        <td className="aa-mono">{d.asyncApiVersion || '2.6.0'} / {d.version || '1.0.0'}</td>
                                        <td>{[...new Set((d.servers || []).map((s) => s.protocol))].map((p) => <span key={p} className="aa-pill">{p}</span>)}</td>
                                        <td>{(d.channels || []).length}</td>
                                        <td>{(d.messages || []).length}</td>
                                        <td><span className={`aa-badge aa-badge--${d.status || 'draft'}`}>{d.status || 'draft'}</span></td>
                                        <td>{d.lastRun?.result ? <span className={`aa-badge aa-badge--${d.lastRun.result === 'passed' ? 'ok' : 'error'}`}>{d.lastRun.result}</span> : <span className="aa-muted">—</span>}</td>
                                        <td>{fmtTime(d.updatedAt)}</td>
                                        <td className="aa-actions-cell" onClick={(e) => e.stopPropagation()}>
                                            <button className="aa-btn aa-btn--ghost aa-btn--sm" title="Download AsyncAPI JSON" onClick={() => exportDoc(d._id, d.name)}><FiDownload size={12} /></button>
                                            <button className="aa-btn aa-btn--ghost aa-btn--sm" title="Open documentation" onClick={() => openDocumentation(d._id, d.name)}><FiBookOpen size={12} /></button>
                                            <button className="aa-btn aa-btn--danger aa-btn--sm" title="Delete document" onClick={() => removeDocument(d._id)}><FiTrash2 size={12} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <AsyncApiModal
                open={Boolean(selectedId)}
                title={selected?.name || 'AsyncAPI document'}
                ariaLabel="AsyncAPI document workbench"
                variant="workbench"
                onClose={() => { setSelectedId(null); setSelected(null); setDocError(null); }}
            >
                {detailLoading && <div className="aa-loading">Loading document…</div>}
                {!detailLoading && selected && (
                    <div className="aa-document-workbench">
                        {docError && <div className="aa-error">{docError}</div>}
                        <AsyncApiDesigner document={selected} onChange={saveDocument} />
                        <AsyncApiTestRunPanel document={selected} environments={environments} onRun={handleTestRun} />
                        <AsyncApiScenarioManager document={selected} environments={environments} onScenarioChanged={() => setDetailVersion((v) => v + 1)} />
                    </div>
                )}
            </AsyncApiModal>
        </div>
    );
};

export default AsyncApiSection;
