import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FiActivity, FiAlertCircle, FiAlertTriangle, FiArrowUp, FiBarChart, FiBell,
    FiLoader, FiSearch, FiSettings, FiTarget, FiTool, FiUsers
} from 'react-icons/fi';
import { Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import AppSelect from '../common/AppSelect/AppSelect';
import PageLoader from '../common/PageLoader/PageLoader';
import { getApiBaseUrl } from '../../utils/apiBaseUrl';
import { useCopilotContext, useCopilotPageContext } from '../../context/CopilotContext';
import OperationsInvestigation from './OperationsInvestigation';
import { formatOperationsFollowUp } from './operationsFollowUpFormatter';
import './operationsCopilotWorkspace.css';

const request = async (path, options = {}) => {
    const response = await fetch(`${getApiBaseUrl()}${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'The operations Copilot request failed.');
    return data;
};

const OperationsCopilotWorkspace = () => {
    const navigate = useNavigate();
    const { setIncidentUpdateDraft } = useCopilotContext();
    const query = useMemo(() => new URLSearchParams(window.location.search), []);
    const initialTargetId = query.get('id') || '';
    const initialTargetType = query.get('type') === 'monitor' ? 'monitor' : 'incident';
    const [targets, setTargets] = useState({ workspaces: [], incidents: [], monitors: [] });
    const [profiles, setProfiles] = useState([]);
    const [profileId, setProfileId] = useState('');
    const [workspaceId, setWorkspaceId] = useState(query.get('workspaceId') || '');
    const [targetType, setTargetType] = useState(initialTargetType);
    const [targetId, setTargetId] = useState(initialTargetId);
    const [timeRange, setTimeRange] = useState('24h');
    const [search, setSearch] = useState('');
    const [investigation, setInvestigation] = useState(null);
    const [conversation, setConversation] = useState(null);
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');

    const availableTargets = targetType === 'incident' ? targets.incidents : targets.monitors;
    const filteredTargets = useMemo(() => {
        const term = search.trim().toLowerCase();
        return availableTargets.filter((target) => (!workspaceId || target.workspaceId === workspaceId)
            && (!term || `${target.label} ${target.detail} ${target.workspaceName}`.toLowerCase().includes(term)));
    }, [availableTargets, search, workspaceId]);
    const selectedTarget = availableTargets.find((target) => target.id === targetId) || null;

    useCopilotPageContext(selectedTarget ? {
        type: selectedTarget.type,
        id: selectedTarget.id,
        workspaceId: selectedTarget.workspaceId,
        label: selectedTarget.label
    } : null);

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        Promise.all([request('/api/copilot/profiles'), request('/api/copilot/operations/targets')])
            .then(([profileData, targetData]) => {
                if (!mounted) return;
                const nextProfiles = profileData.profiles || [];
                setProfiles(nextProfiles);
                setProfileId(nextProfiles[0]?.id || '');
                setTargets(targetData);
                if (initialTargetId) {
                    const initial = [...(targetData.incidents || []), ...(targetData.monitors || [])].find((target) => target.id === initialTargetId);
                    if (initial) {
                        setTargetType(initial.type);
                        setTargetId(initial.id);
                        setWorkspaceId(initial.workspaceId || '');
                    }
                }
            })
            .catch((loadError) => { if (mounted) setError(loadError.message); })
            .finally(() => { if (mounted) setLoading(false); });
        return () => { mounted = false; };
    }, [initialTargetId]);

    useEffect(() => {
        if (targetId && !availableTargets.some((target) => target.id === targetId)) setTargetId('');
        setInvestigation(null);
        setConversation(null);
    }, [targetType]); // eslint-disable-line react-hooks/exhaustive-deps

    const selectTarget = (target) => {
        setTargetId(target.id);
        setWorkspaceId(target.workspaceId || workspaceId);
        setInvestigation(null);
        setConversation(null);
        setError('');
        const params = new URLSearchParams({ type: target.type, id: target.id });
        if (target.workspaceId) params.set('workspaceId', target.workspaceId);
        navigate(`/workspace/monitoring/copilot?${params}`, { replace: true });
    };

    const generate = async () => {
        if (!selectedTarget || generating) return;
        setGenerating(true);
        setError('');
        try {
            const data = await request('/api/copilot/operations/investigations', {
                method: 'POST',
                cache: 'no-store',
                body: JSON.stringify({
                    ...(profileId ? { profileId } : {}),
                    ...(conversation?.id ? { conversationId: conversation.id } : {}),
                    target: { type: selectedTarget.type, id: selectedTarget.id },
                    ...(selectedTarget.type === 'monitor' ? { timeRange } : {})
                })
            });
            if (!data.investigation) {
                throw new Error('The refreshed briefing did not include investigation data.');
            }
            setInvestigation(data.investigation);
            setConversation(data.conversation || null);
        } catch (generateError) { setError(generateError.message); }
        finally { setGenerating(false); }
    };

    const sendFollowUp = async (event) => {
        event.preventDefault();
        const message = prompt.trim();
        if (!message || !profileId || !conversation?.id || sending) return;
        setSending(true);
        setError('');
        try {
            const data = await request('/api/copilot/messages', {
                method: 'POST',
                body: JSON.stringify({
                    conversationId: conversation.id,
                    profileId,
                    prompt: message,
                    activeContext: { type: selectedTarget.type, id: selectedTarget.id, workspaceId: selectedTarget.workspaceId, label: selectedTarget.label },
                    activePage: { title: 'Monitoring · Copilot', path: window.location.pathname + window.location.search },
                    pinnedSources: []
                })
            });
            const fallback = formatOperationsFollowUp(message, investigation, conversation.messages || []);
            const nextConversation = fallback ? {
                ...data.conversation,
                messages: (data.conversation.messages || []).map((item, index, messages) => index === messages.length - 1 && item.role === 'assistant' ? { ...item, content: fallback } : item)
            } : data.conversation;
            setConversation(nextConversation);
            setPrompt('');
        } catch (sendError) { setError(sendError.message); }
        finally { setSending(false); }
    };

    const insertDraft = (text, audience) => {
        if (investigation?.target?.type !== 'incident') return;
        setIncidentUpdateDraft({ incidentId: investigation.target.id, text, audience });
        navigate(investigation.target.deepLink || `/workspace/monitoring/incidents?incident=${investigation.target.id}`);
    };

    const followUps = useMemo(() => {
        const messages = conversation?.messages || [];
        const lastArtifactIndex = messages.reduce((latest, message, index) => message.artifact?.type === 'operations_investigation' ? index : latest, -1);
        return messages.slice(lastArtifactIndex + 1);
    }, [conversation]);

    if (loading) return <div className="operations-copilot-page"><PageLoader label="Loading operations evidence…" /></div>;

    return <div className="operations-copilot-page">
        <div className="dashboard-header operations-copilot-header">
            <div className="header-left">
                <div className="header-icon" aria-hidden="true"><Sparkles /></div>
                <div className="header-info">
                    <h1>Incident and Monitoring Copilot</h1>
                    <p>Correlate current operational signals, investigate impact, and prepare evidence-grounded updates.</p>
                </div>
            </div>
        </div>

        <div className="monitoring-nav">
            <button type="button" className="nav-btn active">
                <Sparkles /> Operations Copilot
            </button>
            <button type="button" className="nav-btn" onClick={() => navigate('/workspace/monitoring')}>
                <FiActivity /> Dashboard
            </button>
            <button type="button" className="nav-btn" onClick={() => navigate('/workspace/monitoring/policies')}>
                <FiBell /> Alerts &amp; Policies
            </button>
            <button type="button" className="nav-btn" onClick={() => navigate('/workspace/monitoring/incidents')}>
                <FiAlertTriangle /> Incidents
            </button>
            <button type="button" className="nav-btn" onClick={() => navigate('/workspace/monitoring/reports')}>
                <FiBarChart /> Reports
            </button>
            <button type="button" className="nav-btn" onClick={() => navigate('/workspace/monitoring/teams')}>
                <FiUsers /> Teams
            </button>
            <button type="button" className="nav-btn" onClick={() => navigate('/workspace/monitoring/integrations')}>
                <FiSettings /> Integrations
            </button>
            <button type="button" className="nav-btn" onClick={() => navigate('/workspace/monitoring/maintenance')}>
                <FiTool /> Maintenance
            </button>
        </div>

        <div className="operations-copilot-layout">
            <aside className="operations-copilot-targets" aria-label="Investigation targets">
                <div className="operations-copilot-target-filters">
                    <AppSelect value={workspaceId} onChange={(value) => { setWorkspaceId(value); setTargetId(''); setInvestigation(null); }} options={[{ value: '', label: 'All accessible workspaces' }, ...targets.workspaces.map((workspace) => ({ value: workspace.id, label: workspace.name }))]} />
                    <div className="operations-copilot-type-tabs">
                        <button type="button" className={targetType === 'incident' ? 'active' : ''} onClick={() => setTargetType('incident')}><FiAlertCircle /> Incidents <span>{targets.incidents.length}</span></button>
                        <button type="button" className={targetType === 'monitor' ? 'active' : ''} onClick={() => setTargetType('monitor')}><FiActivity /> Monitors <span>{targets.monitors.length}</span></button>
                    </div>
                    <label className="operations-copilot-search"><FiSearch /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${targetType}s…`} /></label>
                </div>
                <div className="operations-copilot-target-list">
                    {filteredTargets.map((target) => <button type="button" key={target.id} className={target.id === targetId ? 'active' : ''} onClick={() => selectTarget(target)}>
                        <span className={`target-status is-${target.status || 'unknown'}`} aria-hidden="true" />
                        <div><strong>{target.label}</strong><small>{target.workspaceName} · {target.detail}</small></div>
                    </button>)}
                    {!filteredTargets.length ? <div className="operations-copilot-target-empty"><FiTarget /><strong>No matching {targetType}s</strong><p>Change the workspace or search filter.</p></div> : null}
                </div>
            </aside>

            <main className="operations-copilot-main">
                {!selectedTarget ? <div className="operations-copilot-welcome"><Sparkles /><h2>Select an incident or monitor</h2><p>The Copilot will use current alerts, health checks, analytics, and OpenTelemetry traces from the accessible workspace.</p></div> : <>
                    <section className="operations-copilot-runbar">
                        <div><small>Selected {selectedTarget.type}</small><strong>{selectedTarget.label}</strong><span>{selectedTarget.workspaceName} · {selectedTarget.detail}</span></div>
                        <div>
                            {selectedTarget.type === 'monitor' ? <AppSelect value={timeRange} onChange={setTimeRange} options={[{ value: '1h', label: 'Last hour' }, { value: '24h', label: 'Last 24 hours' }, { value: '7d', label: 'Last 7 days' }, { value: '30d', label: 'Last 30 days' }]} /> : null}
                            {profiles.length > 1 ? <AppSelect value={profileId} onChange={setProfileId} options={profiles.map((profile) => ({ value: profile.id, label: profile.label }))} /> : null}
                            <button type="button" className="operations-copilot-generate" onClick={generate} disabled={generating}>{generating ? <FiLoader className="spin" /> : <Sparkles />} {generating ? 'Correlating…' : investigation ? 'Refresh briefing' : 'Generate briefing'}</button>
                        </div>
                    </section>
                    {generating && !investigation ? <div className="operations-copilot-progress" role="status"><FiLoader className="spin" /><div><strong>Correlating operational evidence</strong><p>Reviewing direct links, monitor history, analytics, traces, and temporal relationships.</p></div></div> : null}
                    {error ? <div className="operations-copilot-error" role="alert"><FiAlertCircle /><span>{error}</span></div> : null}
                    {investigation ? <OperationsInvestigation investigation={investigation} onInsertDraft={insertDraft} /> : null}
                    {investigation ? <section className="operations-copilot-followup">
                        <div className="operations-copilot-section-title"><Sparkles /><div><h2>Follow-up investigation</h2><p>Ask about the retained evidence snapshot and current target context.</p></div></div>
                        {followUps.length ? <div className="operations-copilot-followup-messages">{followUps.map((message, index) => <article className={message.role} key={`${message.createdAt || index}-${index}`}><span className="ops-followup-role">{message.role === 'user' ? 'You' : 'Copilot'}</span><div className="ops-followup-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown></div></article>)}</div> : null}
                        <form onSubmit={sendFollowUp}><textarea rows="2" value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendFollowUp(event); } }} placeholder={profileId ? 'Ask a follow-up about impact, evidence, or next steps…' : 'Configure NVIDIA NIM to ask model follow-ups.'} disabled={!profileId} /><button type="submit" disabled={!profileId || !prompt.trim() || sending} aria-label="Send follow-up">{sending ? <FiLoader className="spin" /> : <FiArrowUp />}</button></form>
                    </section> : null}
                </>}
            </main>
        </div>
    </div>;
};

export default OperationsCopilotWorkspace;
