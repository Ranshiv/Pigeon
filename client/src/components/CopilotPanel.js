import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiArrowUp, FiCheck, FiChevronDown, FiClock, FiLoader, FiMessageSquare, FiPlus, FiSearch, FiTrash2, FiX } from 'react-icons/fi';
import { Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getApiBaseUrl } from '../utils/apiBaseUrl';
import { useCopilotContext } from '../context/CopilotContext';
import AppSelect from './common/AppSelect/AppSelect';
import OperationsInvestigation from './operationsCopilot/OperationsInvestigation';
import { formatOperationsFollowUp } from './operationsCopilot/operationsFollowUpFormatter';
import './CopilotPanel.css';

const api = async (path, options = {}) => {
    const response = await fetch(`${getApiBaseUrl()}${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
    const data = response.status === 204 ? null : await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data?.message || data?.error || 'Copilot request failed.');
        error.code = data?.code;
        throw error;
    }
    return data;
};

const actionOutput = (action) => {
    const value = action?.result?.result?.result;
    if (value === undefined || value === null) return '';
    if (typeof value?.body === 'string' && /^\s*<!doctype\s+html|^\s*<html[\s>]/i.test(value.body)) {
        const title = value.body.match(/<title[^>]*>\s*([^<]{1,160})\s*<\/title>/i)?.[1]?.trim();
        return `Received an HTML document${title ? ` titled “${title}”` : ''}, not an API response.`;
    }
    const output = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    return output.length > 12000 ? `${output.slice(0, 12000)}\n\n[Output truncated]` : output;
};

const sourceIdentity = (source) => `${source?.type || ''}:${source?.id || ''}:${source?.parentId || source?.kind || ''}`;
const sourceTypeLabel = (type) => ({ workspace: 'Workspace', collection: 'Collection', request: 'Request', history: 'History', governance: 'Governance', trace: 'Trace', test_run: 'Test run', incident: 'Incident', alert: 'Alert', monitor: 'Monitor', analytics: 'Analytics' }[type] || type);
const isRemediationMessage = (message) => message?.role === 'assistant' && /investigation and remediation sequence|strongest supported hypothesis/i.test(message?.content || '');
const readableEmphasis = (value) => {
    if (typeof value !== 'string' || value !== value.toUpperCase() || !/[A-Z]/.test(value)) return value;
    return `${value.charAt(0)}${value.slice(1).toLowerCase()}`
        .replace(/\bapi\b/g, 'API')
        .replace(/\bdns\b/g, 'DNS')
        .replace(/\bhttp\b/g, 'HTTP')
        .replace(/\botel\b/g, 'OTel')
        .replace(/\btls\b/g, 'TLS');
};
const remediationMarkdownComponents = {
    strong: ({ children }) => <strong>{React.Children.map(children, readableEmphasis)}</strong>
};
const MIN_COPILOT_HEIGHT = 420;
const MIN_CONTEXT_PANE_HEIGHT = 112;
const DEFAULT_CONTEXT_PANE_HEIGHT = 210;

const getMaxCopilotHeight = () => Math.max(MIN_COPILOT_HEIGHT, window.innerHeight);

const clampCopilotHeight = (height) => Math.max(MIN_COPILOT_HEIGHT, Math.min(getMaxCopilotHeight(), height));

const EvidenceList = ({ findings = [] }) => {
    if (!findings.length) return null;
    return <section className="copilot-findings" aria-label="Evidence findings">
        <div className="copilot-findings-heading"><strong>Evidence ledger</strong><span>{findings.length} signal{findings.length === 1 ? '' : 's'}</span></div>
        {findings.map((finding, index) => <a className={`copilot-finding is-${finding.status || 'info'}`} href={finding.deepLink || undefined} key={finding.id || `${finding.kind}-${index}`}>
            <span>{finding.status || 'info'}</span>
            <strong>{finding.summary}</strong>
            {finding.detail ? <small>{finding.detail}</small> : null}
            {finding.relation ? <em>{finding.relation}{finding.confidenceReason ? ` · ${finding.confidenceReason}` : ''}</em> : null}
        </a>)}
    </section>;
};

const CopilotPanel = () => {
    const { activeContext, activePage, workspaceId, workspaceKey, pinnedSources, openNonce, investigationRequest, clearInvestigationRequest, setIncidentUpdateDraft, togglePin, clearPins } = useCopilotContext();
    const [open, setOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [profiles, setProfiles] = useState([]);
    const [profileId, setProfileId] = useState('');
    const [sources, setSources] = useState([]);
    const [sourceQuery, setSourceQuery] = useState('');
    const [contextExpanded, setContextExpanded] = useState(false);
    const [conversations, setConversations] = useState([]);
    const [conversation, setConversation] = useState(null);
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingShell, setLoadingShell] = useState(false);
    const [loadedShellKey, setLoadedShellKey] = useState('');
    const [error, setError] = useState('');
    const [actions, setActions] = useState([]);
    const [approvingActionId, setApprovingActionId] = useState('');
    const [generatingInvestigation, setGeneratingInvestigation] = useState(false);
    const [typed, setTyped] = useState({});
    const [panelWidth, setPanelWidth] = useState(520);
    const [panelHeight, setPanelHeight] = useState(null);
    const [contextPaneHeight, setContextPaneHeight] = useState(DEFAULT_CONTEXT_PANE_HEIGHT);
    const closeTimerRef = useRef(null);
    const resizeRef = useRef(null);
    const heightResizeRef = useRef(null);
    const contextResizeRef = useRef(null);
    const panelRef = useRef(null);
    const openNonceRef = useRef(0);
    const investigationNonceRef = useRef(null);
    const draftsRef = useRef({});
    const draftKey = `${workspaceKey}:${conversation?.id || 'new'}`;
    const retainedOperationsInvestigation = useMemo(() => [...(conversation?.messages || [])].reverse().find((message) => message.artifact?.type === 'operations_investigation')?.artifact?.data || null, [conversation]);

    useEffect(() => {
        if (openNonce > openNonceRef.current) {
            openNonceRef.current = openNonce;
            setIsClosing(false);
            setOpen(true);
        }
    }, [openNonce]);

    useEffect(() => { setPrompt(draftsRef.current[draftKey] || ''); }, [draftKey]);

    useEffect(() => { setActions([]); }, [workspaceKey]);

    useEffect(() => {
        draftsRef.current[draftKey] = prompt;
    }, [draftKey, prompt]);

    useEffect(() => {
        if (!open) return undefined;
        const controller = new AbortController();
        let mounted = true;
        const workspaceQuery = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
        const conversationQuery = `?workspaceId=${workspaceId ? encodeURIComponent(workspaceId) : 'overview'}`;
        setLoadingShell(true);
        setLoadedShellKey('');
        setError('');
        Promise.all([
            api('/api/copilot/profiles', { signal: controller.signal }),
            api(`/api/copilot/context/sources${workspaceQuery}`, { signal: controller.signal }),
            api(`/api/copilot/conversations${conversationQuery}`, { signal: controller.signal })
        ]).then(([profileData, contextData, conversationData]) => {
            if (!mounted) return;
            const nextProfiles = profileData.profiles || [];
            const nextConversations = conversationData.conversations || [];
            const nextConversation = nextConversations[0] || null;
            setProfiles(nextProfiles);
            setProfileId((current) => nextConversation?.profileId === 'deterministic' ? '' : nextConversation?.profileId && nextProfiles.some((profile) => profile.id === nextConversation.profileId)
                ? nextConversation.profileId
                : current && nextProfiles.some((profile) => profile.id === current) ? current : nextProfiles[0]?.id || '');
            setSources(contextData.sources || []);
            setConversations(nextConversations);
            setConversation(nextConversation);
        }).catch((loadError) => {
            if (mounted && loadError.name !== 'AbortError') setError(loadError.message);
        }).finally(() => { if (mounted) { setLoadingShell(false); setLoadedShellKey(workspaceKey); } });
        return () => { mounted = false; controller.abort(); };
    }, [open, workspaceId, workspaceKey]);

    useEffect(() => {
        if (!open || !investigationRequest || investigationNonceRef.current === investigationRequest.nonce || loadingShell || loadedShellKey !== workspaceKey || generatingInvestigation) return;
        investigationNonceRef.current = investigationRequest.nonce;
        setGeneratingInvestigation(true);
        setLoading(true);
        setError('');
        api('/api/copilot/operations/investigations', {
            method: 'POST',
            body: JSON.stringify({
                ...(profileId ? { profileId } : {}),
                target: { type: investigationRequest.target.type, id: investigationRequest.target.id },
                ...(investigationRequest.target.type === 'monitor' ? { timeRange: investigationRequest.timeRange || '24h' } : {})
            })
        }).then((result) => {
            setConversation(result.conversation);
            setConversations((current) => [result.conversation, ...current.filter((item) => item.id !== result.conversation.id)]);
            setActions([]);
        }).catch((investigationError) => setError(investigationError.message)).finally(() => {
            setGeneratingInvestigation(false);
            setLoading(false);
            clearInvestigationRequest();
        });
    }, [clearInvestigationRequest, generatingInvestigation, investigationRequest, loadedShellKey, loadingShell, open, profileId, workspaceKey]);

    useEffect(() => () => {
        if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    }, []);

    const pinnedKeys = useMemo(() => new Set(pinnedSources.map(sourceIdentity)), [pinnedSources]);
    const hydratedPins = useMemo(() => pinnedSources.map((pin) => sources.find((source) => sourceIdentity(source) === sourceIdentity(pin)) || pin), [pinnedSources, sources]);
    const filteredSources = useMemo(() => {
        const query = sourceQuery.trim().toLowerCase();
        if (!query) return sources;
        return sources.filter((source) => `${source.label || ''} ${source.detail || ''} ${source.type || ''}`.toLowerCase().includes(query));
    }, [sourceQuery, sources]);
    const conversationOptions = useMemo(() => [
        { value: '', label: 'New conversation' },
        ...conversations.map((item) => ({ value: item.id, label: item.title }))
    ], [conversations]);

    const activeResolved = useMemo(() => {
        if (!activeContext) return null;
        // The page label is more specific than the catalog label (it names the open
        // tab), so the catalog only fills in details the page did not provide.
        const catalogEntry = sources.find((source) => sourceIdentity(source) === sourceIdentity(activeContext));
        return { ...catalogEntry, ...activeContext, label: activeContext.label || catalogEntry?.label || '' };
    }, [activeContext, sources]);

    const openPanel = () => {
        if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
        setIsClosing(false);
        setOpen(true);
    };

    const closePanel = () => {
        if (isClosing) return;
        setIsClosing(true);
        closeTimerRef.current = window.setTimeout(() => {
            setOpen(false);
            setIsClosing(false);
        }, 180);
    };

    const startResize = useCallback((event) => {
        if (window.innerWidth < 900) return;
        event.preventDefault();
        resizeRef.current = { startX: event.clientX, startWidth: panelWidth };
        const onMove = (moveEvent) => {
            const resize = resizeRef.current;
            if (!resize) return;
            setPanelWidth(Math.max(420, Math.min(680, resize.startWidth + resize.startX - moveEvent.clientX)));
        };
        const onEnd = () => {
            resizeRef.current = null;
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onEnd);
        };
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onEnd);
    }, [panelWidth]);

    const startHeightResize = useCallback((event) => {
        if (window.innerWidth < 900) return;
        event.preventDefault();
        heightResizeRef.current = {
            startY: event.clientY,
            startHeight: panelRef.current?.getBoundingClientRect().height || window.innerHeight
        };
        const onMove = (moveEvent) => {
            const resize = heightResizeRef.current;
            if (!resize) return;
            // The panel is anchored to the bottom, so moving the top edge up
            // increases its height and moving it down decreases it.
            setPanelHeight(clampCopilotHeight(resize.startHeight + resize.startY - moveEvent.clientY));
        };
        const onEnd = () => {
            heightResizeRef.current = null;
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onEnd);
        };
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onEnd);
    }, []);

    const handleHeightResizeKeyDown = useCallback((event) => {
        const increments = event.shiftKey ? 100 : 40;
        let delta = 0;
        if (event.key === 'ArrowUp') delta = increments;
        if (event.key === 'ArrowDown') delta = -increments;
        if (event.key === 'Home') {
            event.preventDefault();
            setPanelHeight(MIN_COPILOT_HEIGHT);
            return;
        }
        if (event.key === 'End') {
            event.preventDefault();
            setPanelHeight(getMaxCopilotHeight());
            return;
        }
        if (!delta) return;
        event.preventDefault();
        const currentHeight = panelHeight || panelRef.current?.getBoundingClientRect().height || window.innerHeight;
        setPanelHeight(clampCopilotHeight(currentHeight + delta));
    }, [panelHeight]);

    const getMaxContextPaneHeight = useCallback(() => {
        const panelHeightValue = panelRef.current?.getBoundingClientRect().height || window.innerHeight;
        return Math.max(MIN_CONTEXT_PANE_HEIGHT, Math.min(360, panelHeightValue - 330));
    }, []);

    const clampContextPaneHeight = useCallback((height) => Math.max(MIN_CONTEXT_PANE_HEIGHT, Math.min(getMaxContextPaneHeight(), height)), [getMaxContextPaneHeight]);

    const startContextResize = useCallback((event) => {
        if (window.innerWidth < 900) return;
        event.preventDefault();
        contextResizeRef.current = { startY: event.clientY, startHeight: contextPaneHeight };
        const onMove = (moveEvent) => {
            const resize = contextResizeRef.current;
            if (!resize) return;
            setContextPaneHeight(clampContextPaneHeight(resize.startHeight + moveEvent.clientY - resize.startY));
        };
        const onEnd = () => {
            contextResizeRef.current = null;
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onEnd);
        };
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onEnd);
    }, [clampContextPaneHeight, contextPaneHeight]);

    const handleContextResizeKeyDown = useCallback((event) => {
        const increment = event.shiftKey ? 80 : 32;
        if (event.key === 'Home') {
            event.preventDefault();
            setContextPaneHeight(MIN_CONTEXT_PANE_HEIGHT);
            return;
        }
        if (event.key === 'End') {
            event.preventDefault();
            setContextPaneHeight(getMaxContextPaneHeight());
            return;
        }
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        event.preventDefault();
        setContextPaneHeight((current) => clampContextPaneHeight(current + (event.key === 'ArrowDown' ? increment : -increment)));
    }, [clampContextPaneHeight, getMaxContextPaneHeight]);

    const send = async (event) => {
        event.preventDefault();
        const message = prompt.trim();
        if (!message || loading || !profileId) return;
        setLoading(true);
        setError('');
        try {
            const result = await api('/api/copilot/messages', {
                method: 'POST',
                body: JSON.stringify({ conversationId: conversation?.id, profileId, prompt: message, activeContext, activePage, pinnedSources })
            });
            const fallback = formatOperationsFollowUp(message, retainedOperationsInvestigation, conversation?.messages || []);
            const nextConversation = fallback ? {
                ...result.conversation,
                messages: (result.conversation.messages || []).map((item, index, messages) => index === messages.length - 1 && item.role === 'assistant' ? { ...item, content: fallback } : item)
            } : result.conversation;
            delete draftsRef.current[draftKey];
            setConversation(nextConversation);
            setConversations((current) => [result.conversation, ...current.filter((item) => item.id !== result.conversation.id)]);
            setActions(result.actions || []);
            setPrompt('');
        } catch (sendError) { setError(sendError.message); }
        finally { setLoading(false); }
    };

    const approve = async (action) => {
        if (approvingActionId) return;
        setApprovingActionId(action.id);
        setError('');
        try {
            const result = await api(`/api/copilot/actions/${action.id}/approve`, { method: 'POST', body: JSON.stringify({ proposalHash: action.proposalHash || action.payloadHash || '', typedConfirmation: typed[action.id] || '' }) });
            setActions((current) => current.map((item) => item.id === action.id ? { ...item, status: result.status, result, error: result.error } : item));
            if (result.status === 'executed' && result.result?.collectionId) window.dispatchEvent(new CustomEvent('pigeon:documentation-updated', { detail: { collectionId: result.result.collectionId, updatedAt: result.result.updatedAt } }));
        } catch (actionError) {
            setActions((current) => current.map((item) => item.id === action.id ? { ...item, status: actionError.code === 'confirmation_required' ? undefined : 'failed', error: actionError.message } : item));
        } finally { setApprovingActionId(''); }
    };

    const reject = async (action) => {
        try { await api(`/api/copilot/actions/${action.id}/reject`, { method: 'POST' }); }
        catch (_) { /* Expired proposals can still be dismissed locally. */ }
        setActions((current) => current.filter((item) => item.id !== action.id));
    };

    const deleteConversation = async () => {
        if (!conversation?.id) return;
        try { await api(`/api/copilot/conversations/${conversation.id}`, { method: 'DELETE' }); }
        catch (deleteError) { setError(deleteError.message); return; }
        const remaining = conversations.filter((item) => item.id !== conversation.id);
        setConversations(remaining);
        setConversation(remaining[0] || null);
        setActions([]);
    };

    const newConversation = () => {
        delete draftsRef.current[`${workspaceKey}:new`];
        setConversation(null);
        setActions([]);
        setPrompt('');
    };

    const selectConversation = (conversationId) => {
        const next = conversations.find((item) => item.id === conversationId) || null;
        setConversation(next);
        if (next?.profileId) setProfileId(next.profileId === 'deterministic' ? '' : next.profileId);
        setActions([]);
    };

    const insertIncidentDraft = (text, audience) => {
        const artifact = [...(conversation?.messages || [])].reverse().find((message) => message.artifact?.type === 'operations_investigation')?.artifact?.data;
        if (artifact?.target?.type !== 'incident') return;
        setIncidentUpdateDraft({ incidentId: artifact.target.id, text, audience });
        closePanel();
    };

    return <>
        <button type="button" className="copilot-launcher" onClick={openPanel} aria-label="Open Pigeon Copilot"><Sparkles /> <span>Copilot</span></button>
        {open ? <aside ref={panelRef} className={`copilot-panel copilot-sidecar ${isClosing ? 'is-closing' : ''} ${loading ? 'is-searching' : ''}`} style={{ '--copilot-width': `${panelWidth}px`, ...(panelHeight ? { '--copilot-height': `${panelHeight}px` } : {}) }} aria-label="Pigeon Copilot">
            <div className="copilot-width-resizer" role="separator" aria-orientation="vertical" aria-label="Resize Copilot" onPointerDown={startResize} />
            <div className="copilot-height-resizer" role="separator" aria-orientation="horizontal" aria-label="Resize Copilot height" aria-valuemin={MIN_COPILOT_HEIGHT} aria-valuemax={typeof window === 'undefined' ? undefined : getMaxCopilotHeight()} aria-valuenow={Math.round(panelHeight || getMaxCopilotHeight())} tabIndex="0" onPointerDown={startHeightResize} onKeyDown={handleHeightResizeKeyDown} />
            <header className="copilot-header">
                <div className="copilot-header-title"><span className="copilot-header-icon"><Sparkles /></span><div><strong>Pigeon Copilot</strong><small>{workspaceId ? 'Workspace evidence thread' : 'Personal overview thread'}</small></div></div>
                <div className="copilot-header-actions">{conversation ? <button type="button" onClick={deleteConversation} aria-label="Delete conversation"><FiTrash2 /></button> : null}<button type="button" onClick={closePanel} aria-label="Close Copilot"><FiX /></button></div>
            </header>

            <div className="copilot-threadbar">
                <div className="copilot-thread-selector"><FiClock aria-hidden="true" /><AppSelect value={conversation?.id || ''} onChange={selectConversation} options={conversationOptions} className="copilot-thread-select" menuClassName="copilot-thread-menu" /></div>
                <button type="button" onClick={newConversation} aria-label="Start new conversation"><FiPlus /></button>
            </div>

            <section className="copilot-context">
                <div className="copilot-context-heading"><div><strong>Context ledger</strong><span>Active evidence is automatic; pins stay with this workspace.</span></div><button type="button" className={`copilot-context-toggle ${contextExpanded ? 'is-open' : ''}`} onClick={() => setContextExpanded((value) => !value)}>{pinnedSources.length ? `${pinnedSources.length} pinned` : 'Add evidence'} <FiChevronDown /></button></div>
                <div className="copilot-context-ledger">
                    {activeResolved ? <div className="copilot-context-chip is-active"><span>Active</span><strong>{activeResolved.label || sourceTypeLabel(activeResolved.type)}</strong><small>{sourceTypeLabel(activeResolved.type)}</small></div> : <div className="copilot-context-chip is-empty"><strong>{activePage?.title || 'No page resource selected'}</strong><small>No resource selected on this page; Copilot answers from the page, pins, or product knowledge.</small></div>}
                    {hydratedPins.slice(0, 3).map((source) => <button type="button" className="copilot-context-chip is-pinned" key={sourceIdentity(source)} onClick={() => togglePin(source)} title="Remove pinned source"><span>Pinned</span><strong>{source.label || sourceTypeLabel(source.type)}</strong><small>{sourceTypeLabel(source.type)}</small></button>)}
                    {pinnedSources.length > 3 ? <span className="copilot-context-more">+{pinnedSources.length - 3}</span> : null}
                </div>
                {contextExpanded ? <div className="copilot-source-picker" style={{ '--copilot-context-pane-height': `${contextPaneHeight}px` }}>
                    <label className="copilot-source-search"><FiSearch /><input value={sourceQuery} onChange={(event) => setSourceQuery(event.target.value)} placeholder="Search requests, traces, incidents…" /></label>
                    <div className="copilot-source-results">
                        {loadingShell ? <span className="copilot-source-empty"><FiLoader className="spin" /> Loading available evidence…</span> : filteredSources.map((source) => {
                            const isPinned = pinnedKeys.has(sourceIdentity(source));
                            return <button type="button" key={sourceIdentity(source)} aria-pressed={isPinned} className={`copilot-source-result ${isPinned ? 'is-selected' : ''}`} onClick={() => togglePin(source)}>
                                <span>{sourceTypeLabel(source.type)}</span><strong>{source.label}</strong><small>{source.detail}</small>{isPinned ? <FiCheck aria-hidden="true" /> : <FiPlus aria-hidden="true" />}
                            </button>;
                        })}
                        {!loadingShell && !filteredSources.length ? <span className="copilot-source-empty">No matching evidence sources.</span> : null}
                    </div>
                    {pinnedSources.length ? <div className="copilot-pins-footer"><span>{pinnedSources.length} workspace pin{pinnedSources.length === 1 ? '' : 's'}</span><button type="button" className="copilot-clear-pins" onClick={clearPins}><FiTrash2 aria-hidden="true" /> Clear pins</button></div> : null}
                    <div className="copilot-context-resizer" role="separator" aria-orientation="horizontal" aria-label="Resize evidence picker" aria-valuemin={MIN_CONTEXT_PANE_HEIGHT} aria-valuemax={getMaxContextPaneHeight()} aria-valuenow={Math.round(contextPaneHeight)} tabIndex="0" onPointerDown={startContextResize} onKeyDown={handleContextResizeKeyDown} />
                </div> : null}
            </section>

            <main className="copilot-messages" aria-live="polite">
                {!conversation?.messages?.length ? <div className="copilot-empty"><FiMessageSquare /><p>{generatingInvestigation ? 'Correlating alerts, monitor checks, analytics, and traces…' : 'Ask “What failed?”, “Why did this run regress?”, or “Where is this API used?” The answer will retain the exact redacted evidence snapshot it used.'}</p></div> : null}
                {(conversation?.messages || []).map((message, index) => <article key={`${message.createdAt || index}-${index}`} className={`copilot-message ${message.role} ${message.artifact?.type === 'operations_investigation' ? 'has-operations-artifact' : ''} ${isRemediationMessage(message) ? 'is-remediation' : ''}`}>
                    <span>{message.role === 'user' ? 'You' : 'Copilot'}</span>
                    {message.artifact?.type === 'operations_investigation' ? <OperationsInvestigation compact investigation={message.artifact.data} onInsertDraft={insertIncidentDraft} /> : <>
                        <div className="copilot-message-content"><ReactMarkdown remarkPlugins={[remarkGfm]} components={isRemediationMessage(message) ? remediationMarkdownComponents : undefined}>{message.content}</ReactMarkdown></div>
                        {message.citations?.length ? <div className="copilot-citations">{message.citations.map((citation) => citation.deepLink ? <a key={`${citation.type}:${citation.id}`} href={citation.deepLink}>{citation.label || citation.id}</a> : <small key={`${citation.type}:${citation.id}`}>{citation.label || citation.id}</small>)}</div> : null}
                        {message.role === 'assistant' ? <EvidenceList findings={message.findings || []} /> : null}
                    </>}
                </article>)}
                {actions.map((action) => <section className="copilot-action" key={action.id}><strong>Proposed action</strong><p>{action.preview}</p><code>{action.kind}</code>{action.typedConfirmationLabel ? <label>Type <b>{action.typedConfirmationLabel}</b> to delete<input value={typed[action.id] || ''} aria-invalid={Boolean(typed[action.id]) && typed[action.id] !== action.typedConfirmationLabel} onChange={(event) => setTyped((current) => ({ ...current, [action.id]: event.target.value }))} /></label> : null}{action.status ? <><small className={`copilot-action-${action.status}`}>{action.error || action.result?.result?.message || action.result?.message || action.status}</small>{actionOutput(action) ? <pre className="copilot-action-output">{actionOutput(action)}</pre> : null}</> : <div>{action.error ? <small className="copilot-action-pending-error">{action.error}</small> : null}<button type="button" onClick={() => approve(action)} disabled={approvingActionId === action.id || (action.typedConfirmationLabel && typed[action.id] !== action.typedConfirmationLabel)}>{approvingActionId === action.id ? <FiLoader className="spin" /> : <FiCheck />} {approvingActionId === action.id ? 'Applying…' : 'Confirm action'}</button><button type="button" className="quiet" onClick={() => reject(action)} disabled={approvingActionId === action.id}>Dismiss</button></div>}</section>)}
            </main>
            {error ? <div className="copilot-error">{error}</div> : null}
            <form className="copilot-composer" onSubmit={send}><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={activeResolved ? `Ask about ${activeResolved.label || sourceTypeLabel(activeResolved.type)}…` : 'Ask Pigeon Copilot…'} rows="1" onInput={(event) => { event.target.style.height = 'auto'; event.target.style.height = `${Math.min(event.target.scrollHeight, 140)}px`; }} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(event); } }} /><button type="submit" disabled={loading || !profileId || !prompt.trim()} aria-label="Send message">{loading ? <FiLoader className="spin" /> : <FiArrowUp />}</button></form>
            {profiles.length > 1 ? <div className="copilot-profile-note">Model profile: {profiles.find((profile) => profile.id === profileId)?.label || profileId}</div> : null}
        </aside> : null}
    </>;
};

export default CopilotPanel;
