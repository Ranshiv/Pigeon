// client/src/components/asyncapi/AsyncApiScenarioManager.js
// List/create/edit/run scenarios for one AsyncAPI document. "Generate from
// channel's message example" uses the /asyncapi/scenarios/from-example route.
import React, { useCallback, useEffect, useState } from 'react';
import { FiClock, FiEdit2, FiPlay, FiPlus, FiRefreshCw, FiTrash2 } from 'react-icons/fi';
import AppSelect from '../common/AppSelect/AppSelect';
import AsyncApiModal from './AsyncApiModal';

const ACTIONS = [{ value: 'publish', label: 'Publish' }, { value: 'subscribe', label: 'Subscribe' }];

const blankScenario = (doc) => ({
    name: '', description: '', documentId: String(doc._id || ''),
    channelName: (doc.channels?.[0]?.name) || '',
    operation: (doc.operations?.[0]?.action) || 'publish',
    messageName: (doc.operations?.[0]?.messageName) || '',
    payload: '', headers: [], headersText: '[]',
    expectedSchemaValidation: true,
    expectedFields: [], timeoutMs: 5000, environmentId: null
});

const ScenarioForm = ({ draft, setDraft, channelOptions, messageOptions, envOptions }) => {
    const setField = (field, value) => setDraft((current) => ({ ...current, [field]: value }));

    return (
        <>
            <div className="aa-field"><label>Name</label><input className="aa-input" value={draft.name || ''} onChange={(e) => setField('name', e.target.value)} /></div>
            <div className="aa-field"><label>Description</label><input className="aa-input" value={draft.description || ''} onChange={(e) => setField('description', e.target.value)} /></div>
            <div className="aa-grid-2">
                <div className="aa-field"><label>Channel</label><AppSelect value={draft.channelName || ''} onChange={(v) => setField('channelName', v)} options={channelOptions} /></div>
                <div className="aa-field"><label>Operation</label><AppSelect value={draft.operation || 'publish'} onChange={(v) => setField('operation', v)} options={ACTIONS} /></div>
            </div>
            <div className="aa-grid-2">
                <div className="aa-field"><label>Message</label><AppSelect value={draft.messageName || ''} onChange={(v) => setField('messageName', v)} options={messageOptions} /></div>
                <div className="aa-field"><label>Environment</label><AppSelect value={draft.environmentId || ''} onChange={(v) => setField('environmentId', v)} options={envOptions} /></div>
            </div>
            <div className="aa-grid-2">
                <div className="aa-field"><label>Timeout (ms)</label><input className="aa-number" type="number" min={500} max={60000} value={draft.timeoutMs ?? 5000} onChange={(e) => setField('timeoutMs', e.target.value)} /></div>
                <div className="aa-field aa-check-field">
                    <label>Response validation</label>
                    <label className="aa-check">
                        <input className="aa-toggle-input" type="checkbox" checked={Boolean(draft.expectedSchemaValidation)} onChange={(e) => setField('expectedSchemaValidation', e.target.checked)} />
                        <span>Validate against message payloadSchema</span>
                        <span className="aa-toggle-control" aria-hidden="true"><span className="aa-toggle-thumb" /></span>
                    </label>
                </div>
            </div>
            <div className="aa-field"><label>Payload (JSON)</label><textarea className="aa-textarea" value={draft.payload || ''} onChange={(e) => setField('payload', e.target.value)} spellCheck={false} /></div>
            <div className="aa-field"><label>Headers (JSON array: <code>{'[{"key":"Authorization","value":"{{ASYNCAPI_SECRET}}"}]'}</code>)</label><textarea className="aa-textarea" value={draft.headersText ?? '[]'} onChange={(e) => setField('headersText', e.target.value)} spellCheck={false} /></div>
        </>
    );
};

const parseHeaders = (draft) => {
    const raw = draft.headersText ?? JSON.stringify(draft.headersObj || draft.headers || []);
    const parsed = JSON.parse(raw || '[]');
    if (!Array.isArray(parsed)) throw new Error('Headers must be a JSON array');
    return parsed;
};

const AsyncApiScenarioManager = ({ document: doc, environments = [], onScenarioChanged }) => {
    const [scenarios, setScenarios] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [editing, setEditing] = useState(null);
    const [creating, setCreating] = useState(null);
    const [runForId, setRunForId] = useState(null);

    const load = useCallback(async () => {
        if (!doc?._id) return;
        setLoading(true); setError(null);
        try {
            const res = await fetch(`/api/asyncapi/scenarios?documentId=${encodeURIComponent(doc._id)}`, { credentials: 'include' });
            const text = await res.text();
            const data = text ? JSON.parse(text) : {};
            if (!res.ok) throw new Error(data.message || `Failed to load scenarios (${res.status})`);
            setScenarios(data.scenarios || []);
        } catch (e) {
            setError(e.message || 'Failed to load scenarios');
            setScenarios([]);
        } finally { setLoading(false); }
    }, [doc._id]);

    useEffect(() => { load(); }, [load]);

    const createScenario = async () => {
        if (!creating) return;
        const { draft } = creating;
        if (!draft.name || !draft.channelName) { setError('Scenario name and channel are required'); return; }
        try {
            const parsedHeaders = parseHeaders(draft);
            const res = await fetch('/api/asyncapi/scenarios', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...draft, environmentId: draft.environmentId || undefined, headers: parsedHeaders, payload: draft.payload })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || `Failed to save (${res.status})`);
            setCreating(null); onScenarioChanged?.(); load();
        } catch (e) { setError(e.message || 'Failed to save scenario'); }
    };

    const updateScenario = async () => {
        if (!editing) return;
        const { scenarioId, draft } = editing;
        let parsedHeaders;
        try { parsedHeaders = parseHeaders(draft); }
        catch (e) { setError(e.message || 'Headers must contain valid JSON'); return; }
        const res = await fetch(`/api/asyncapi/scenarios/${scenarioId}`, {
            method: 'PUT', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...draft, environmentId: draft.environmentId || undefined, headers: parsedHeaders, payload: draft.payload })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { setError(data.message || `Failed to save (${res.status})`); return; }
        setEditing(null); onScenarioChanged?.(); load();
    };

    const runScenario = async (scenarioId) => {
        setRunForId(scenarioId);
        try {
            const res = await fetch(`/api/asyncapi/scenarios/${scenarioId}/run`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || `Run failed (${res.status})`);
            onScenarioChanged?.(); load();
        } catch (e) { setError(e.message || 'Scenario run failed'); }
        finally { setRunForId(null); }
    };

    const removeScenario = async (scenarioId) => {
        const res = await fetch(`/api/asyncapi/scenarios/${scenarioId}`, { method: 'DELETE', credentials: 'include' });
        if (res.ok) { onScenarioChanged?.(); load(); }
    };

    const generateFromExample = async () => {
        try {
            const firstChannel = (doc.channels || [])[0];
            if (!firstChannel) { setError('Add a channel/message first'); return; }
            const res = await fetch('/api/asyncapi/scenarios/from-example', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ documentId: doc._id, channelName: firstChannel.name || firstChannel.address })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || `Failed (${res.status})`);
            setCreating({ draft: { ...data.scenario, headersText: JSON.stringify(data.scenario.headers || [], null, 2), payload: data.scenario.payload || '' } });
        } catch (e) { setError(e.message || 'Could not generate scenario from example'); }
    };

    const channelOptions = (doc.channels || []).map((c) => ({ value: c.name || c.address || '', label: c.name || c.address || '(channel)' }));
    const messageOptions = (doc.messages || []).map((m) => ({ value: m.name || '', label: m.name || '(message)' }));
    const envOptions = [{ value: '', label: 'No environment' }, ...environments.map((e) => ({ value: e._id || e.id, label: e.name }))];

    const editingDraft = editing?.draft;
    const creatingDraft = creating?.draft;

    return (
        <div className="aa-section">
            <div className="aa-section-title">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><FiClock /> Scenarios ({scenarios.length})</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="aa-btn aa-btn--ghost aa-btn--sm" onClick={generateFromExample}>From message example</button>
                    <button className="aa-btn aa-btn--primary aa-btn--sm" onClick={() => setCreating({ draft: blankScenario(doc) })}><FiPlus /> New scenario</button>
                </div>
            </div>

            {error && <div className="aa-error aa-scenario-error">{error}</div>}
            {loading && <div className="aa-loading">Loading scenarios…</div>}
            {!loading && scenarios.length === 0 && <div className="aa-empty"><strong>No scenarios yet.</strong><span>Generate one from a message example, or create manually.</span></div>}

            {scenarios.length > 0 && (
                <div className="aa-table-wrap">
                    <table className="aa-table">
                        <thead><tr><th>Scenario</th><th>Channel</th><th>Op</th><th>Latest</th><th></th></tr></thead>
                        <tbody>
                            {scenarios.map((s) => (
                                <tr key={s._id}>
                                    <td><span className="aa-name">{s.name}</span><span className="aa-sub">{s.description}</span></td>
                                    <td className="aa-mono">{s.channelName}</td>
                                    <td><span className="aa-pill">{s.operation}</span></td>
                                    <td>{s.lastRun?.result ? <span className={`aa-badge aa-badge--${s.lastRun.result === 'passed' ? 'ok' : 'error'}`}>{s.lastRun.result}</span> : <span className="aa-muted">never run</span>}</td>
                                    <td className="aa-actions-cell">
                                        <button className="aa-btn aa-btn--ghost aa-btn--sm" onClick={() => setEditing({ scenarioId: s._id, draft: { ...s, headersText: JSON.stringify(s.headers || [], null, 2), payload: s.payload || '' } })}><FiEdit2 size={12} /> Edit</button>
                                        <button className="aa-btn aa-btn--primary aa-btn--sm" onClick={() => runScenario(s._id)} disabled={runForId === s._id}>{runForId === s._id ? <FiRefreshCw className="aa-spin" /> : <FiPlay size={12} />} Run</button>
                                        <button className="aa-btn aa-btn--danger aa-btn--sm" aria-label={`Delete scenario ${s.name || ''}`} title="Delete scenario" onClick={() => removeScenario(s._id)}><FiTrash2 size={12} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <AsyncApiModal
                open={Boolean(creating)}
                title="New scenario"
                onClose={() => setCreating(null)}
                footer={<button className="aa-btn aa-btn--primary" onClick={createScenario}>Save</button>}
            >
                {creatingDraft && <ScenarioForm draft={creatingDraft} channelOptions={channelOptions} messageOptions={messageOptions} envOptions={envOptions} setDraft={(updater) => setCreating((current) => current ? ({ ...current, draft: typeof updater === 'function' ? updater(current.draft) : updater }) : current)} />}
            </AsyncApiModal>

            <AsyncApiModal
                open={Boolean(editing)}
                title="Edit scenario"
                onClose={() => setEditing(null)}
                footer={<button className="aa-btn aa-btn--primary" onClick={updateScenario}>Save</button>}
            >
                {editingDraft && <ScenarioForm draft={editingDraft} channelOptions={channelOptions} messageOptions={messageOptions} envOptions={envOptions} setDraft={(updater) => setEditing((current) => current ? ({ ...current, draft: typeof updater === 'function' ? updater(current.draft) : updater }) : current)} />}
            </AsyncApiModal>
        </div>
    );
};

export default AsyncApiScenarioManager;
