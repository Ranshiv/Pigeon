import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiActivity, FiAlertTriangle, FiClock, FiEdit2, FiPlus, FiRefreshCw, FiTrash2, FiX, FiZap } from 'react-icons/fi';
import AppSelect from './common/AppSelect/AppSelect';
import './MockFaultLab.css';

const TYPE_OPTIONS = [
    { value: 'latency', label: 'Latency' }, { value: 'status', label: 'HTTP status override' },
    { value: 'abort', label: 'Connection abort' }, { value: 'throttle', label: 'Bandwidth throttle' },
    { value: 'malformed_json', label: 'Malformed JSON' }, { value: 'truncate', label: 'Truncated response' }
];
const METHOD_OPTIONS = ['*', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(value => ({ value, label: value === '*' ? 'Any method' : value }));
const SCHEDULE_OPTIONS = [{ value: 'continuous', label: 'Always active' }, { value: 'burst', label: 'Scheduled burst' }];
const defaultProfile = () => ({
    name: '', description: '', isActive: true, probability: 100, priority: 1,
    target: { method: '*', path: '*' }, schedule: { mode: 'continuous', startAt: new Date().toISOString().slice(0, 16), intervalMs: 60000, durationMs: 10000 },
    fault: { type: 'latency', delayMinMs: 250, delayMaxMs: 1000, statusCode: 500, responseBody: '', abortPhase: 'before_headers', bytesPerSecond: 1024, chunkSize: 256, truncateMode: 'percent', truncateValue: 50 }
});
const presets = {
    slow: { name: 'Slow network', fault: { type: 'latency', delayMinMs: 750, delayMaxMs: 1800 } },
    error: { name: 'Intermittent 500', probability: 30, fault: { type: 'status', statusCode: 500, responseBody: '{"error":"Temporary service failure"}' } },
    drop: { name: 'Connection drops', probability: 20, fault: { type: 'abort', abortPhase: 'before_headers' } },
    bandwidth: { name: 'Low bandwidth', fault: { type: 'throttle', bytesPerSecond: 512, chunkSize: 128 } },
    corrupt: { name: 'Corrupt JSON payload', probability: 25, fault: { type: 'malformed_json' } }
};

const MockFaultLab = ({ mockServerId }) => {
    const [lab, setLab] = useState({ enabled: false, profiles: [], events: [], summary: {} });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [preview, setPreview] = useState(null);
    const [editor, setEditor] = useState(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/mock-servers/${mockServerId}/fault-lab`, { credentials: 'include' });
            if (!response.ok) throw new Error((await response.json()).message || 'Unable to load Fault Lab');
            setLab(await response.json());
            setError('');
        } catch (err) { setError(err.message); } finally { setLoading(false); }
    }, [mockServerId]);
    useEffect(() => { load(); }, [load]);

    const request = async (url, options = {}) => {
        setSaving(true);
        try {
            const response = await fetch(url, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...options });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Fault Lab update failed');
            setLab(data.profiles ? data : await (await fetch(`/api/mock-servers/${mockServerId}/fault-lab`, { credentials: 'include' })).json());
            setError('');
            return data;
        } catch (err) { setError(err.message); return null; } finally { setSaving(false); }
    };
    const saveProfile = async (event) => {
        event.preventDefault();
        const profile = { ...editor, schedule: { ...editor.schedule, startAt: new Date(editor.schedule.startAt).toISOString() } };
        if (profile.fault.type === 'status' && profile.fault.responseBody) {
            try { profile.fault.responseBody = JSON.parse(profile.fault.responseBody); } catch (_) { /* text responses are supported */ }
        }
        const url = editor._id ? `/api/mock-servers/${mockServerId}/fault-lab/profiles/${editor._id}` : `/api/mock-servers/${mockServerId}/fault-lab/profiles`;
        const data = await request(url, { method: editor._id ? 'PUT' : 'POST', body: JSON.stringify(profile) });
        if (data) setEditor(null);
    };
    const previewProfile = async (profileId) => {
        const data = await request(`/api/mock-servers/${mockServerId}/fault-lab/profiles/${profileId}/preview`, { method: 'POST' });
        if (data) setPreview(data);
    };
    const openPreset = (preset) => setEditor({ ...defaultProfile(), ...preset, fault: { ...defaultProfile().fault, ...preset.fault } });
    const setField = (path, value) => setEditor(current => {
        const next = { ...current };
        const keys = path.split('.'); let cursor = next;
        keys.slice(0, -1).forEach(key => { cursor[key] = { ...cursor[key] }; cursor = cursor[key]; });
        cursor[keys[keys.length - 1]] = value;
        return next;
    });
    const summary = useMemo(() => lab.summary || {}, [lab]);

    return <div className="fault-lab">
        <div className="fault-lab__hero">
            <div><span className="fault-lab__eyebrow"><FiZap /> Network resilience</span><h3>Fault Lab</h3><p>Inject realistic failures into this mock server without affecting upstream APIs.</p></div>
            <div className="fault-lab__switch-wrap"><span>{lab.enabled ? 'Fault injection enabled' : 'Fault injection disabled'}</span><button type="button" aria-label="Toggle Fault Lab" className={`fault-switch ${lab.enabled ? 'is-on' : ''}`} disabled={saving} onClick={() => request(`/api/mock-servers/${mockServerId}/fault-lab`, { method: 'PUT', body: JSON.stringify({ enabled: !lab.enabled }) })}><i /></button></div>
        </div>
        {error && <div className="fault-lab__error"><FiAlertTriangle />{error}<button onClick={() => setError('')}><FiX /></button></div>}
        <div className="fault-lab__stats">
            <div><FiActivity /><span>Fault events</span><strong>{summary.total || 0}</strong></div><div><FiClock /><span>Added latency</span><strong>{summary.averageAddedDelay || 0}ms</strong></div><div><FiAlertTriangle /><span>Connection aborts</span><strong>{summary.aborts || 0}</strong></div>
        </div>
        <div className="fault-lab__toolbar"><div><h4>Fault profiles</h4><span>Highest-priority matching profile is applied first.</span></div><div><button className="btn-icon-text" onClick={load} disabled={loading}><FiRefreshCw className={loading ? 'spinning' : ''} />Refresh</button><button className="btn-primary" onClick={() => setEditor(defaultProfile())}><FiPlus />Add profile</button></div></div>
        {!lab.profiles.length && !loading ? <div className="fault-lab__empty"><FiZap /><h4>No profiles yet</h4><p>Start with a preset or make a custom fault profile.</p><div>{Object.entries(presets).map(([key, preset]) => <button key={key} onClick={() => openPreset(preset)}>{preset.name}</button>)}</div></div> : <div className="fault-lab__profiles">{lab.profiles.map(profile => <article key={profile._id} className={`fault-profile ${profile.isActive ? '' : 'is-disabled'}`}><div className="fault-profile__top"><div><span className="fault-type">{profile.fault?.type?.replace('_', ' ')}</span><h4>{profile.name}</h4><p>{profile.description || `${profile.target?.method || '*'} ${profile.target?.path || '*'}`}</p></div><button className={`fault-switch ${profile.isActive ? 'is-on' : ''}`} onClick={() => request(`/api/mock-servers/${mockServerId}/fault-lab/profiles/${profile._id}/toggle`, { method: 'PATCH' })}><i /></button></div><div className="fault-profile__meta"><span>{profile.target?.method || '*'} {profile.target?.path || '*'}</span><span>{profile.probability}% chance</span><span>{profile.schedule?.mode === 'burst' ? 'Burst schedule' : 'Continuous'}</span></div><div className="fault-profile__actions"><button onClick={() => previewProfile(profile._id)}><FiActivity />Preview</button><button onClick={() => setEditor({ ...defaultProfile(), ...profile, target: { ...defaultProfile().target, ...profile.target }, schedule: { ...defaultProfile().schedule, ...profile.schedule, startAt: new Date(profile.schedule?.startAt || Date.now()).toISOString().slice(0, 16) }, fault: { ...defaultProfile().fault, ...profile.fault, responseBody: typeof profile.fault?.responseBody === 'object' ? JSON.stringify(profile.fault.responseBody) : (profile.fault?.responseBody || '') } })}><FiEdit2 />Edit</button><button className="danger" onClick={() => window.confirm(`Delete ${profile.name}?`) && request(`/api/mock-servers/${mockServerId}/fault-lab/profiles/${profile._id}`, { method: 'DELETE' })}><FiTrash2 />Delete</button></div></article>)}</div>}
        {preview && <div className="fault-lab__preview"><FiZap /><span><strong>{preview.profileName}</strong> preview: {preview.faultType.replace('_', ' ')}, {preview.delayMs || 0}ms added delay{preview.transport ? `, ${preview.transport}` : ''}{preview.statusCode !== 200 ? `, HTTP ${preview.statusCode}` : ''}.</span><button onClick={() => setPreview(null)}><FiX /></button></div>}
        <section className="fault-lab__events"><div className="fault-lab__toolbar"><div><h4>Recent fault events</h4><span>Only injected faults appear here.</span></div><button className="btn-icon-text danger" onClick={() => window.confirm('Clear Fault Lab history?') && request(`/api/mock-servers/${mockServerId}/fault-lab/events`, { method: 'DELETE' })}>Clear history</button></div>{lab.events?.length ? <div className="fault-events">{lab.events.map(event => <div key={event._id}><span>{event.faultType?.replace('_', ' ')}</span><code>{event.method} {event.path}</code><small>{new Date(event.createdAt).toLocaleString()}</small></div>)}</div> : <p className="fault-lab__no-events">No fault has been injected yet.</p>}</section>
        {editor && <div className="fault-modal-backdrop" onMouseDown={() => setEditor(null)}><form className="fault-modal" onSubmit={saveProfile} onMouseDown={event => event.stopPropagation()}><header><div><span className="fault-lab__eyebrow"><FiZap /> Configuration</span><h3>{editor._id ? 'Edit fault profile' : 'Create fault profile'}</h3></div><button type="button" onClick={() => setEditor(null)}><FiX /></button></header><div className="fault-modal__body"><label>Name<input required value={editor.name} onChange={e => setField('name', e.target.value)} placeholder="e.g. Checkout API slowdown" /></label><label>Description<input value={editor.description || ''} onChange={e => setField('description', e.target.value)} placeholder="Optional note for your team" /></label><div className="fault-grid"><label>Fault type<AppSelect value={editor.fault.type} onChange={value => setField('fault.type', value)} options={TYPE_OPTIONS} /></label><label>Probability (%)<input type="number" min="0" max="100" value={editor.probability} onChange={e => setField('probability', Number(e.target.value))} /></label><label>Method<AppSelect value={editor.target.method} onChange={value => setField('target.method', value)} options={METHOD_OPTIONS} /></label><label>Path pattern<input value={editor.target.path} onChange={e => setField('target.path', e.target.value)} placeholder="/orders/:id or *" /></label></div>{['latency', 'status', 'abort', 'throttle', 'malformed_json', 'truncate'].includes(editor.fault.type) && <FaultSettings editor={editor} setField={setField} />}<div className="fault-grid"><label>Activation<AppSelect value={editor.schedule.mode} onChange={value => setField('schedule.mode', value)} options={SCHEDULE_OPTIONS} /></label>{editor.schedule.mode === 'burst' && <><label>Interval (ms)<input type="number" min="1000" value={editor.schedule.intervalMs} onChange={e => setField('schedule.intervalMs', Number(e.target.value))} /></label><label>Burst duration (ms)<input type="number" min="100" value={editor.schedule.durationMs} onChange={e => setField('schedule.durationMs', Number(e.target.value))} /></label></>}</div></div><footer><button type="button" className="btn-secondary" onClick={() => setEditor(null)}>Cancel</button><button className="btn-primary" disabled={saving}><FiZap />{editor._id ? 'Save profile' : 'Create profile'}</button></footer></form></div>}
    </div>;
};

const FaultSettings = ({ editor, setField }) => <div className="fault-settings">{['latency', 'status', 'abort', 'throttle', 'malformed_json', 'truncate'].includes(editor.fault.type) && editor.fault.type !== 'malformed_json' && <h5>Fault settings</h5>}{['latency', 'status', 'abort', 'throttle', 'malformed_json', 'truncate'].includes(editor.fault.type) && editor.fault.type !== 'abort' && <div className="fault-grid"><label>Extra delay min (ms)<input type="number" min="0" value={editor.fault.delayMinMs} onChange={e => setField('fault.delayMinMs', Number(e.target.value))} /></label><label>Extra delay max (ms)<input type="number" min="0" value={editor.fault.delayMaxMs} onChange={e => setField('fault.delayMaxMs', Number(e.target.value))} /></label></div>}{editor.fault.type === 'status' && <div className="fault-grid"><label>Status code<input type="number" min="100" max="599" value={editor.fault.statusCode} onChange={e => setField('fault.statusCode', Number(e.target.value))} /></label><label>Response body<textarea value={editor.fault.responseBody || ''} onChange={e => setField('fault.responseBody', e.target.value)} placeholder='{"error":"Unavailable"}' /></label></div>}{editor.fault.type === 'abort' && <label>Abort phase<AppSelect value={editor.fault.abortPhase} onChange={value => setField('fault.abortPhase', value)} options={[{ value: 'before_headers', label: 'Before response headers' }, { value: 'after_headers', label: 'After response headers' }]} /></label>}{editor.fault.type === 'throttle' && <div className="fault-grid"><label>Bytes per second<input type="number" min="64" value={editor.fault.bytesPerSecond} onChange={e => setField('fault.bytesPerSecond', Number(e.target.value))} /></label><label>Chunk size (bytes)<input type="number" min="16" value={editor.fault.chunkSize} onChange={e => setField('fault.chunkSize', Number(e.target.value))} /></label></div>}{editor.fault.type === 'truncate' && <div className="fault-grid"><label>Mode<AppSelect value={editor.fault.truncateMode} onChange={value => setField('fault.truncateMode', value)} options={[{ value: 'percent', label: 'Percentage' }, { value: 'bytes', label: 'Bytes' }]} /></label><label>Value<input type="number" min="1" value={editor.fault.truncateValue} onChange={e => setField('fault.truncateValue', Number(e.target.value))} /></label></div>}</div>;

export default MockFaultLab;
