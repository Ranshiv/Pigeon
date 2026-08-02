import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FiArrowUp, FiCheck, FiChevronDown, FiLoader, FiMessageSquare, FiPlus, FiTrash2, FiX } from 'react-icons/fi';
import { Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getApiBaseUrl } from '../utils/apiBaseUrl';
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
        return `Received an HTML document${title ? ` titled “${title}”` : ''}, not an API response. Update this MCP request to use the API endpoint rather than a web page.`;
    }
    const output = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    return output.length > 12000 ? `${output.slice(0, 12000)}\n\n[Output truncated]` : output;
};

const CopilotPanel = () => {
    const location = useLocation();
    const [open, setOpen] = useState(false);
    const [profiles, setProfiles] = useState([]);
    const [profileId, setProfileId] = useState('');
    const [collections, setCollections] = useState([]);
    const [selected, setSelected] = useState([]);
    const [conversation, setConversation] = useState(null);
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [actions, setActions] = useState([]);
    const [approvingActionId, setApprovingActionId] = useState('');
    const [typed, setTyped] = useState({});
    const [contextExpanded, setContextExpanded] = useState(false);
    const [collectionPickerHeight, setCollectionPickerHeight] = useState(168);
    const pickerResizeRef = useRef(null);
    const [isClosing, setIsClosing] = useState(false);
    const closeTimerRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        Promise.all([api('/api/copilot/profiles'), api('/api/copilot/context/collections')])
            .then(([profileData, contextData]) => {
                setProfiles(profileData.profiles || []);
                setProfileId((current) => current || profileData.profiles?.[0]?.id || '');
                setCollections(contextData.collections || []);
            })
            .catch((loadError) => setError(loadError.message));
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const match = location.pathname.match(/^\/workspace\/collections\/([^/]+)/);
        const collectionId = match?.[1];
        if (collectionId) {
            // Keep route context authoritative so a source from a previously
            // opened collection cannot leak into the next conversation.
            setSelected([collectionId]);
        }
    }, [location.pathname, open]);

    useEffect(() => {
        const selectCollection = (event) => {
            const id = event.detail?.collectionId;
            if (!id) return;
            setOpen(true);
            setSelected((current) => current.includes(id) ? current : [...current, id]);
        };
        window.addEventListener('pigeon:copilot-context', selectCollection);
        return () => window.removeEventListener('pigeon:copilot-context', selectCollection);
    }, []);

    useEffect(() => () => {
        if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    }, []);

    const selectedSources = useMemo(() => selected.map((id) => ({ type: 'collection', id })), [selected]);
    const toggleCollection = (id) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    const actionCanBeApproved = (action) => !action.typedConfirmationLabel || typed[action.id] === action.typedConfirmationLabel;

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

    const startCollectionPickerResize = useCallback((event) => {
        event.preventDefault();
        pickerResizeRef.current = { startY: event.clientY, startHeight: collectionPickerHeight };
        const onMove = (moveEvent) => {
            const resize = pickerResizeRef.current;
            if (!resize) return;
            // One source card is the minimum; the chat remains the primary pane.
            setCollectionPickerHeight(Math.max(58, Math.min(320, resize.startHeight + moveEvent.clientY - resize.startY)));
        };
        const onEnd = () => {
            pickerResizeRef.current = null;
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onEnd);
        };
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onEnd);
    }, [collectionPickerHeight]);

    const send = async (event) => {
        event.preventDefault();
        if (!prompt.trim() || loading) return;
        setLoading(true); setError('');
        try {
            const result = await api('/api/copilot/messages', { method: 'POST', body: JSON.stringify({ conversationId: conversation?.id, profileId, prompt: prompt.trim(), sources: selectedSources }) });
            setConversation(result.conversation);
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
            if (result.status === 'executed' && result.result?.collectionId) {
                window.dispatchEvent(new CustomEvent('pigeon:documentation-updated', { detail: { collectionId: result.result.collectionId, updatedAt: result.result.updatedAt } }));
            }
        } catch (actionError) {
            setActions((current) => current.map((item) => item.id === action.id
                ? { ...item, status: actionError.code === 'confirmation_required' ? undefined : 'failed', error: actionError.message }
                : item));
        } finally { setApprovingActionId(''); }
    };

    const reject = async (action) => {
        try {
            await api(`/api/copilot/actions/${action.id}/reject`, { method: 'POST' });
        } catch (_) { /* The action may already have expired; remove it locally either way. */ }
        setActions((current) => current.filter((item) => item.id !== action.id));
    };

    const deleteConversation = async () => {
        if (!conversation?.id) return;
        try { await api(`/api/copilot/conversations/${conversation.id}`, { method: 'DELETE' }); }
        catch (deleteError) { setError(deleteError.message); return; }
        setConversation(null); setActions([]); setPrompt('');
    };

    return <>
        <button type="button" className="copilot-launcher" onClick={openPanel} aria-label="Open Pigeon Copilot"><Sparkles /> <span>Copilot</span></button>
        {open && <aside className={`copilot-panel ${isClosing ? 'is-closing' : ''}`} aria-label="Pigeon Copilot">
            <header className="copilot-header"><div className="copilot-header-title"><span className="copilot-header-icon"><Sparkles /></span><div><strong>Pigeon Copilot</strong><small>Context-aware workspace assistant</small></div></div><div className="copilot-header-actions">{conversation && <button type="button" onClick={deleteConversation} aria-label="Delete conversation"><FiTrash2 /></button>}<button type="button" onClick={closePanel} aria-label="Close Copilot"><FiX /></button></div></header>
            <div className="copilot-context">
                <div className="copilot-context-heading"><div><strong>Conversation context</strong><span>Select what Copilot can use in this message.</span></div></div>
                {!contextExpanded && <div className="copilot-context-source-row"><button type="button" className={`copilot-context-toggle ${contextExpanded ? 'is-open' : ''}`} onClick={() => setContextExpanded((value) => !value)}>{selected.length ? 'Change sources' : 'Choose sources'} <FiChevronDown /></button><div className={`copilot-context-summary ${selected.length ? 'has-selection' : ''}`}>{selected.length ? collections.filter((collection) => selected.includes(collection.id)).slice(0, 2).map((collection) => <span key={collection.id}>{collection.name}</span>) : <span>Optional — add a collection for API-specific answers.</span>}{selected.length > 2 && <span>+{selected.length - 2} more</span>}</div></div>}
                {contextExpanded && <div className="copilot-context-source-row"><button type="button" className="copilot-context-toggle is-open" onClick={() => setContextExpanded(false)}>Done <FiChevronDown /></button></div>}
                {contextExpanded && <><div className="copilot-collection-list" style={{ height: `${collectionPickerHeight}px`, maxHeight: `${collectionPickerHeight}px` }}>
                    {collections.map((collection, index) => <label key={collection.id} style={{ '--copilot-source-index': index }} className={`copilot-context-option ${selected.includes(collection.id) ? 'is-selected' : ''}`}><input type="checkbox" checked={selected.includes(collection.id)} onChange={() => toggleCollection(collection.id)} /><span><strong>{collection.name}</strong><small>Collection context</small></span></label>)}
                    {!collections.length && <span>No accessible collections found.</span>}
                </div><div className="copilot-context-resizer" role="separator" aria-orientation="horizontal" aria-label="Resize collection picker" onPointerDown={startCollectionPickerResize}><span /></div></>}
            </div>
            <main className="copilot-messages" aria-live="polite">
                {!conversation?.messages?.length && <div className="copilot-empty"><FiMessageSquare /><p>Ask about an API, failed test, documentation, monitoring issue, or MCP tool. Copilot only sees collections you select above.</p></div>}
                {conversation?.messages?.map((message, index) => <article key={`${message.createdAt || index}-${index}`} className={`copilot-message ${message.role}`}><span>{message.role === 'user' ? 'You' : 'Copilot'}</span><div className="copilot-message-content"><ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown></div>{message.citations?.length ? <small>Sources: {message.citations.map((citation) => citation.label || citation.id).join(', ')}</small> : null}</article>)}
                {actions.map((action) => <section className="copilot-action" key={action.id}><strong>Proposed action</strong><p>{action.preview}</p><code>{action.kind}</code>{action.typedConfirmationLabel && <label>Type <b>{action.typedConfirmationLabel}</b> to delete<input value={typed[action.id] || ''} aria-invalid={Boolean(typed[action.id]) && !actionCanBeApproved(action)} onChange={(event) => setTyped({ ...typed, [action.id]: event.target.value })} /></label>}{action.status ? <><small className={`copilot-action-${action.status}`}>{action.error || action.result?.result?.message || action.result?.message || action.status}</small>{actionOutput(action) && <pre className="copilot-action-output">{actionOutput(action)}</pre>}</> : <div>{action.error && <small className="copilot-action-pending-error">{action.error}</small>}<button type="button" onClick={() => approve(action)} disabled={approvingActionId === action.id}>{approvingActionId === action.id ? <FiLoader className="spin" /> : <FiCheck />} {approvingActionId === action.id ? 'Applying…' : 'Confirm action'}</button><button type="button" className="quiet" onClick={() => reject(action)} disabled={approvingActionId === action.id}>Dismiss</button></div>}</section>)}
            </main>
            {error && <div className="copilot-error">{error}</div>}
            <form className="copilot-composer" onSubmit={send}><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ask Pigeon Copilot…" rows="3" /><button type="submit" disabled={loading || !profileId} aria-label="Send message">{loading ? <FiLoader className="spin" /> : <FiArrowUp />}</button></form>
            {conversation && <button type="button" className="copilot-new" onClick={() => { setConversation(null); setActions([]); setPrompt(''); }}><FiPlus /> New conversation</button>}
        </aside>}
    </>;
};

export default CopilotPanel;
