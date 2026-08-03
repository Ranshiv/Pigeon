import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiAlertTriangle, FiCheck, FiCpu, FiFileText, FiPlay, FiPlus, FiRefreshCw, FiShield, FiZap } from 'react-icons/fi';
import AppSelect from '../common/AppSelect/AppSelect';
import { useWorkspaceOptions } from '../compliance/useWorkspaceOptions';
import { useCopilotPageContext } from '../../context/CopilotContext';
import './testGenerator.css';

const CATEGORIES = [
    ['positive', 'Positive'], ['negative', 'Negative'], ['boundary', 'Boundary'],
    ['authorization', 'Authorization'], ['schema', 'Schema'], ['regression', 'Regression']
];
const SOURCE_LABELS = { openapi: 'OpenAPI', 'saved-request': 'Example', asyncapi: 'AsyncAPI', trace: 'OTLP trace', history: 'History', recording: 'Recording / HAR' };

const readError = async (response, fallback) => {
    const status = `${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
    try {
        const text = await response.text();
        if (text) {
            try {
                const payload = JSON.parse(text);
                const message = payload.message || payload.detail || payload.error || payload.title;
                if (message) return `${message}${payload.stage ? ` · stage: ${payload.stage}` : ''}${payload.requestId ? ` · request: ${payload.requestId}` : ''}`;
            } catch {
                if (!/^\s*</.test(text)) return text.slice(0, 300);
            }
        }
    } catch { /* Use the status-aware fallback below. */ }
    return `${fallback} (${status})`;
};

export default function TestGeneratorSection() {
    const { workspaces, defaultWorkspaceId, loading: workspacesLoading } = useWorkspaceOptions();
    const [workspaceId, setWorkspaceId] = useState(() => new URLSearchParams(window.location.search).get('workspaceId') || '');
    const [sources, setSources] = useState([]);
    const [collections, setCollections] = useState([]);
    const [suites, setSuites] = useState([]);
    const [profiles, setProfiles] = useState([]);
    const [environments, setEnvironments] = useState([]);
    const [selectedSources, setSelectedSources] = useState([]);
    const [selectedOperations, setSelectedOperations] = useState({});
    const [categories, setCategories] = useState(CATEGORIES.map(([value]) => value));
    const [authProfileIds, setAuthProfileIds] = useState([]);
    const [includeAi, setIncludeAi] = useState(true);
    const [name, setName] = useState('');
    const [activeSuite, setActiveSuite] = useState(null);
    const [cases, setCases] = useState([]);
    const [filter, setFilter] = useState('all');
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [runEnvironmentId, setRunEnvironmentId] = useState('');
    const [targetCollectionId, setTargetCollectionId] = useState('');
    const [acknowledged, setAcknowledged] = useState(false);
    const [profileDraft, setProfileDraft] = useState(null);

    useCopilotPageContext(workspaceId ? { type: 'workspace', id: workspaceId, workspaceId, label: 'AI Test Generator workspace' } : null);
    useEffect(() => { if (!workspaceId && defaultWorkspaceId) setWorkspaceId(defaultWorkspaceId); }, [defaultWorkspaceId, workspaceId]);

    const loadWorkspace = useCallback(async () => {
        if (!workspaceId) return;
        setError('');
        try {
            const query = encodeURIComponent(workspaceId);
            const [sourceRes, suiteRes, profileRes, environmentRes] = await Promise.all([
                fetch(`/api/test-generator/sources?workspaceId=${query}`, { credentials: 'include' }),
                fetch(`/api/test-generator/suites?workspaceId=${query}`, { credentials: 'include' }),
                fetch(`/api/test-generator/auth-profiles?workspaceId=${query}`, { credentials: 'include' }),
                fetch(`/api/environments?workspaceId=${query}`, { credentials: 'include' })
            ]);
            if (!sourceRes.ok) throw new Error(await readError(sourceRes, 'Unable to load test sources.'));
            const [sourceData, suiteData, profileData] = await Promise.all([sourceRes.json(), suiteRes.ok ? suiteRes.json() : { suites: [] }, profileRes.ok ? profileRes.json() : { profiles: [] }]);
            setSources(sourceData.sources || []); setCollections(sourceData.collections || []); setSuites(suiteData.suites || []); setProfiles(profileData.profiles || []);
            if (environmentRes.ok) { const data = await environmentRes.json(); setEnvironments(Array.isArray(data) ? data : (data.environments || [])); }
        } catch (reason) { setError(reason.message); }
    }, [workspaceId]);

    useEffect(() => { loadWorkspace(); }, [loadWorkspace]);
    useEffect(() => { setSelectedSources([]); setSelectedOperations({}); setTargetCollectionId(''); setActiveSuite(null); setCases([]); setNotice(''); }, [workspaceId]);

    const openSuite = async (suiteId) => {
        setBusy('load'); setError('');
        try {
            const response = await fetch(`/api/test-generator/suites/${suiteId}`, { credentials: 'include' });
            if (!response.ok) throw new Error(await readError(response, 'Unable to load the suite.'));
            const data = await response.json(); const candidateCollectionId = String(data.suite.collectionId || data.suite.sources?.find((item) => item.collectionId)?.collectionId || ''); setActiveSuite(data.suite); setCases(data.cases || []); setTargetCollectionId(collections.some((item) => item.editable && item.id === candidateCollectionId) ? candidateCollectionId : ''); setNotice('');
        } catch (reason) { setError(reason.message); } finally { setBusy(''); }
    };

    const generate = async () => {
        if (!selectedSources.length) { setError('Select at least one source.'); return; }
        setBusy('generate'); setError(''); setNotice('');
        try {
            const chosen = sources.filter((source) => selectedSources.includes(`${source.type}:${source.id}`)).map((source) => ({ type: source.type, id: source.id, label: source.label, collectionId: source.collectionId, operationIds: selectedOperations[`${source.type}:${source.id}`] || (source.operations || []).map((item) => item.id) }));
            const response = await fetch('/api/test-generator/suites', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceId, name: name || undefined, sources: chosen, categories, authProfileIds, includeAi }) });
            if (!response.ok) throw new Error(await readError(response, 'Unable to generate tests.'));
            const data = await response.json(); const candidateCollectionId = String(data.suite.collectionId || data.suite.sources?.find((item) => item.collectionId)?.collectionId || ''); setActiveSuite(data.suite); setCases(data.cases || []); setTargetCollectionId(collections.some((item) => item.editable && item.id === candidateCollectionId) ? candidateCollectionId : ''); setSuites((current) => [data.suite, ...current]);
            setNotice(`Generated ${data.cases?.length || 0} reviewable cases.`);
        } catch (reason) { setError(reason.message); } finally { setBusy(''); }
    };

    const toggleCase = async (testCase) => {
        if (activeSuite?.status !== 'draft') return;
        const enabled = !testCase.enabled;
        setCases((current) => current.map((item) => item._id === testCase._id ? { ...item, enabled } : item));
        const response = await fetch(`/api/test-generator/suites/${activeSuite._id}/cases/${testCase._id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }) });
        if (!response.ok) { setCases((current) => current.map((item) => item._id === testCase._id ? { ...item, enabled: !enabled } : item)); setError(await readError(response, 'Unable to update the case.')); }
    };

    const suiteAction = async (action, payload = {}) => {
        setBusy(action); setError(''); setNotice('');
        try {
            const response = await fetch(`/api/test-generator/suites/${activeSuite._id}/${action}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) throw new Error(await readError(response, `Unable to ${action} the suite.`));
            const data = await response.json();
            if (data.suite) setActiveSuite(data.suite);
            if (action === 'approve') setNotice('Suite approved. It is now locked and ready to materialize.');
            if (action === 'materialize') { setNotice(`Created ${data.created?.length || 0} native Pigeon artifacts${data.repaired ? ` and repaired ${data.repaired} references` : ''}.`); await openSuite(activeSuite._id); }
            if (action === 'run') setNotice(`Run complete: ${data.passed}/${data.total} cases passed.`);
            await loadWorkspace();
        } catch (reason) { setError(reason.message); } finally { setBusy(''); }
    };

    const saveProfile = async () => {
        setBusy('profile'); setError('');
        try {
            let authConfigTemplate;
            try { authConfigTemplate = JSON.parse(profileDraft.authConfigText || '{}'); } catch { throw new Error('Authentication template must be valid JSON.'); }
            const expectedAccess = String(profileDraft.expectedAccessText || '').split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
            const response = await fetch('/api/test-generator/auth-profiles', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceId, name: profileDraft.name, roleKey: profileDraft.roleKey, environmentId: profileDraft.environmentId || null, authConfigTemplate, expectedAccess }) });
            if (!response.ok) throw new Error(await readError(response, 'Unable to save the profile.'));
            setProfileDraft(null); await loadWorkspace(); setNotice('Authorization profile created.');
        } catch (reason) { setError(reason.message); } finally { setBusy(''); }
    };

    const groupedSources = useMemo(() => Object.entries(sources.reduce((groups, source) => ({ ...groups, [source.type]: [...(groups[source.type] || []), source] }), {})), [sources]);
    const visibleCases = useMemo(() => cases.filter((item) => filter === 'all' || item.category === filter), [cases, filter]);
    const enabledCount = cases.filter((item) => item.enabled).length;

    return <main className="tg-root">
        <header className="tg-header"><div><span className="tg-eyebrow"><FiCpu /> Hybrid deterministic + AI</span><h1>AI Test Generator</h1><p>Turn specifications, examples, and saved traffic into reviewable Pigeon tests without sending secrets to the model.</p></div><div className="tg-workspace"><label>Workspace</label><AppSelect value={workspaceId} onChange={setWorkspaceId} options={workspaces.map((item) => ({ value: item.id, label: item.label }))} disabled={workspacesLoading} /></div></header>
        {error && <div className="tg-message tg-message--error"><FiAlertTriangle /> {error}</div>}
        {notice && <div className="tg-message tg-message--ok"><FiCheck /> {notice}</div>}

        <section className="tg-layout">
            <aside className="tg-builder">
                <div className="tg-section-head"><div><span>1</span><h2>Sources</h2></div><small>{selectedSources.length} selected</small></div>
                <div className="tg-source-list">{groupedSources.map(([type, items]) => <div className="tg-source-group" key={type}><b>{SOURCE_LABELS[type] || type}</b>{items.map((source) => { const key = `${source.type}:${source.id}`; const selected = selectedSources.includes(key); const operationIds = selectedOperations[key] || []; const toggleSource = () => { setSelectedSources((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]); setSelectedOperations((current) => ({ ...current, [key]: selected ? [] : (source.operations || []).map((item) => item.id) })); }; return <div className="tg-source" key={key}><label><input type="checkbox" checked={selected} onChange={toggleSource} /><span>{source.label}<small>{source.operations?.length || 0} operation{source.operations?.length === 1 ? '' : 's'}</small></span></label>{selected && (source.operations || []).length > 1 && <div className="tg-operation-list">{source.operations.map((operation) => <label key={operation.id}><input type="checkbox" checked={operationIds.includes(operation.id)} onChange={() => setSelectedOperations((current) => ({ ...current, [key]: operationIds.includes(operation.id) ? operationIds.filter((id) => id !== operation.id) : [...operationIds, operation.id] }))} /><span>{operation.label}</span></label>)}</div>}</div>; })}</div>)}{!sources.length && <p className="tg-empty">No compatible sources were found in this workspace.</p>}</div>

                <div className="tg-section-head"><div><span>2</span><h2>Coverage</h2></div></div>
                <div className="tg-chips">{CATEGORIES.map(([value, label]) => <label className={categories.includes(value) ? 'active' : ''} key={value}><input type="checkbox" checked={categories.includes(value)} onChange={() => setCategories((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])} />{label}</label>)}</div>

                <div className="tg-section-head"><div><span>3</span><h2>Authorization identities</h2></div><button className="tg-link" type="button" onClick={() => setProfileDraft({ name: '', roleKey: '', environmentId: '', expectedAccessText: '', authConfigText: '{\n  "type": "Bearer Token",\n  "bearer": {\n    "token": "{{TEST_USER_TOKEN}}"\n  }\n}' })}><FiPlus /> Add profile</button></div>
                <div className="tg-profile-list">{profiles.map((profile) => <label key={profile._id}><input type="checkbox" disabled={profile.isAnonymous} checked={profile.isAnonymous || authProfileIds.includes(profile._id)} onChange={() => setAuthProfileIds((current) => current.includes(profile._id) ? current.filter((item) => item !== profile._id) : [...current, profile._id])} /><span><b>{profile.name}</b><small>{profile.isAnonymous ? 'Always included' : profile.roleKey}</small></span></label>)}</div>

                <div className="tg-section-head"><div><span>4</span><h2>Generate draft</h2></div></div>
                <label className="tg-field"><span>Suite name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Generated API confidence suite" /></label>
                <label className="tg-ai-toggle"><input type="checkbox" checked={includeAi} onChange={(event) => setIncludeAi(event.target.checked)} /><span><b>AI semantic enrichment</b><small>Deterministic generation still completes if AI is unavailable.</small></span></label>
                <button className="tg-primary" type="button" disabled={busy === 'generate' || !selectedSources.length || !categories.length} onClick={generate}><FiZap /> {busy === 'generate' ? 'Generating…' : 'Generate draft suite'}</button>
            </aside>

            <section className="tg-review">
                <div className="tg-review-head"><div><span className="tg-eyebrow">Review before run</span><h2>{activeSuite?.name || 'Generated suite'}</h2><p>{activeSuite ? `${activeSuite.status} · ${enabledCount}/${cases.length} enabled` : 'Select a saved suite or generate a new draft.'}</p></div><button className="tg-icon-button" type="button" onClick={loadWorkspace} aria-label="Refresh suites"><FiRefreshCw /></button></div>
                {!activeSuite && <div className="tg-suites"><h3>Recent suites</h3>{suites.map((suite) => <button type="button" key={suite._id} onClick={() => openSuite(suite._id)}><FiFileText /><span><b>{suite.name}</b><small>{suite.status} · {suite.caseCount} cases</small></span></button>)}{!suites.length && <div className="tg-empty-state"><FiShield /><h3>No generated suites yet</h3><p>Select source evidence on the left to create the first reviewable draft.</p></div>}</div>}
                {activeSuite && <>
                    {(activeSuite.warnings || []).length > 0 && <div className="tg-warnings">{activeSuite.warnings.map((warning) => <p key={warning}><FiAlertTriangle /> {warning}</p>)}</div>}
                    <div className="tg-toolbar"><div className="tg-chips tg-chips--filter"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>{CATEGORIES.map(([value, label]) => <button className={filter === value ? 'active' : ''} key={value} onClick={() => setFilter(value)}>{label}</button>)}</div><div className="tg-actions">{activeSuite.status === 'draft' && <button onClick={() => suiteAction('approve')} disabled={busy || !enabledCount}><FiCheck /> Approve</button>}{activeSuite.status === 'approved' && <button onClick={() => suiteAction('materialize', { collectionId: targetCollectionId || null })} disabled={busy || (!targetCollectionId && cases.some((item) => item.protocol !== 'asyncapi'))}><FiPlus /> Materialize</button>}{activeSuite.status === 'materialized' && <><button onClick={() => suiteAction('materialize', { collectionId: targetCollectionId || null })} disabled={busy || (!targetCollectionId && cases.some((item) => item.protocol !== 'asyncapi'))}><FiRefreshCw /> Repair artifacts</button><button onClick={() => suiteAction('run', { environmentId: runEnvironmentId || null, acknowledgedTestEnvironment: acknowledged })} disabled={busy || !acknowledged}><FiPlay /> Run suite</button></>}</div></div>
                    {activeSuite.status === 'approved' && cases.some((item) => item.protocol !== 'asyncapi') && <div className="tg-run-config"><span>Target collection</span><AppSelect value={targetCollectionId} onChange={setTargetCollectionId} options={[{ value: '', label: 'Choose a collection' }, ...collections.filter((item) => item.editable).map((item) => ({ value: item.id, label: item.name }))]} /></div>}
                    {activeSuite.status === 'materialized' && <div className="tg-run-config"><AppSelect value={runEnvironmentId} onChange={setRunEnvironmentId} options={[{ value: '', label: 'No environment' }, ...environments.map((item) => ({ value: String(item._id), label: item.name }))]} /><label><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /> I confirm this is a non-production test environment.</label></div>}
                    <div className="tg-case-list">{visibleCases.map((testCase) => <article className={`tg-case ${testCase.enabled ? '' : 'disabled'}`} key={testCase._id}><label className="tg-case-check"><input type="checkbox" checked={testCase.enabled} disabled={activeSuite.status !== 'draft'} onChange={() => toggleCase(testCase)} /></label><div><div className="tg-case-title"><span className={`tg-category tg-category--${testCase.category}`}>{testCase.category}</span><h3>{testCase.name}</h3>{testCase.provenance === 'ai' && <span className="tg-ai-badge"><FiCpu /> AI</span>}</div><p>{testCase.rationale}</p><div className="tg-case-meta"><span>{testCase.protocol}</span><span>{testCase.operationId}</span><span>{testCase.assertions?.length || 0} assertions</span>{testCase.blocked && <span className="blocked">Blocked: {testCase.blockedReason}</span>}</div></div></article>)}{!visibleCases.length && <p className="tg-empty">No cases match this filter.</p>}</div>
                </>}
            </section>
        </section>

        {profileDraft && <div className="tg-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setProfileDraft(null); }}><section className="tg-modal" role="dialog" aria-modal="true" aria-label="Create authorization profile"><header><div><span className="tg-eyebrow">Runtime secret references only</span><h2>New authorization profile</h2></div><button onClick={() => setProfileDraft(null)}>×</button></header><label className="tg-field"><span>Name</span><input value={profileDraft.name} onChange={(event) => setProfileDraft({ ...profileDraft, name: event.target.value })} placeholder="Regular user" /></label><label className="tg-field"><span>Role key</span><input value={profileDraft.roleKey} onChange={(event) => setProfileDraft({ ...profileDraft, roleKey: event.target.value })} placeholder="user" /></label><label className="tg-field"><span>Environment</span><AppSelect value={profileDraft.environmentId} onChange={(value) => setProfileDraft({ ...profileDraft, environmentId: value })} options={[{ value: '', label: 'No environment' }, ...environments.map((item) => ({ value: String(item._id), label: item.name }))]} /></label><label className="tg-field"><span>Allowed operation IDs</span><textarea rows="3" value={profileDraft.expectedAccessText} onChange={(event) => setProfileDraft({ ...profileDraft, expectedAccessText: event.target.value })} placeholder={'One canonical operation ID per line, or * for all'} /></label><label className="tg-field"><span>Authentication template</span><textarea rows="7" value={profileDraft.authConfigText} onChange={(event) => setProfileDraft({ ...profileDraft, authConfigText: event.target.value })} /></label><p className="tg-help">Sensitive fields must use placeholders such as <code>{'{{TEST_USER_TOKEN}}'}</code>. Literal credentials are rejected.</p><footer><button onClick={() => setProfileDraft(null)}>Cancel</button><button className="tg-primary" disabled={busy === 'profile' || !profileDraft.name || !profileDraft.roleKey} onClick={saveProfile}>{busy === 'profile' ? 'Saving…' : 'Create profile'}</button></footer></section></div>}
    </main>;
}
