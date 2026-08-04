import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, GripVertical, Loader2, Minus, Sparkles } from 'lucide-react';
import { getApiBaseUrl } from '../utils/apiBaseUrl';
import './RequestAgentPanel.css';

const api = async (path, options = {}) => {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Request Agent request failed.');
    return data;
};

const QUICK_ACTIONS = [
    ['complete', 'Complete request'],
    ['explain', 'Explain this request'],
    ['debug', 'Debug last response'],
    ['tests', 'Add tests'],
    ['secure', 'Improve security']
];
const LAYOUT_KEY = 'pigeon:request-agent-layout:v1';
const EDGE_GAP = 12;
const readLayout = () => {
    try {
        const stored = JSON.parse(window.localStorage.getItem(LAYOUT_KEY) || 'null');
        if (stored && typeof stored === 'object' && typeof stored.x === 'number' && typeof stored.y === 'number') return stored;
    } catch (_) { /* Use the default placement. */ }
    return { x: null, y: null, minimized: false };
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default function RequestAgentPanel({ request, response, collectionId, activeTab, onApplyPatches, onUndo, canUndo }) {
    const [layout, setLayout] = useState(readLayout);
    const [prompt, setPrompt] = useState('');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const panelRef = useRef(null);
    const dragRef = useRef(null);
    const hasResponse = Boolean(response && (response.status || response.error || response.body || response.data));
    const contextLabel = useMemo(() => hasResponse ? 'Request + last response' : 'Current request draft', [hasResponse]);

    useEffect(() => {
        try { window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch (_) { /* Storage is optional. */ }
    }, [layout]);

    const stopDragging = useCallback(() => {
        const drag = dragRef.current;
        if (!drag || !panelRef.current) return;
        dragRef.current = null;
        window.removeEventListener('pointermove', drag.onMove);
        window.removeEventListener('pointerup', drag.onUp);
        const rect = panelRef.current.getBoundingClientRect();
        const maxX = Math.max(EDGE_GAP, window.innerWidth - rect.width - EDGE_GAP);
        const maxY = Math.max(EDGE_GAP, window.innerHeight - rect.height - EDGE_GAP);
        let x = clamp(drag.x, EDGE_GAP, maxX);
        let y = clamp(drag.y, EDGE_GAP, maxY);
        const distances = [{ edge: 'left', value: x }, { edge: 'right', value: maxX - x }, { edge: 'top', value: y }, { edge: 'bottom', value: maxY - y }];
        const nearest = distances.reduce((best, item) => item.value < best.value ? item : best);
        if (nearest.edge === 'left') x = EDGE_GAP;
        if (nearest.edge === 'right') x = maxX;
        if (nearest.edge === 'top') y = EDGE_GAP;
        if (nearest.edge === 'bottom') y = maxY;
        setLayout((current) => ({ ...current, x, y }));
    }, []);

    const startDragging = useCallback((event) => {
        if (event.button !== 0 || !panelRef.current) return;
        event.preventDefault();
        const rect = panelRef.current.getBoundingClientRect();
        const drag = { offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, x: rect.left, y: rect.top };
        drag.onMove = (moveEvent) => {
            drag.x = moveEvent.clientX - drag.offsetX;
            drag.y = moveEvent.clientY - drag.offsetY;
            if (panelRef.current) { panelRef.current.style.left = `${drag.x}px`; panelRef.current.style.top = `${drag.y}px`; panelRef.current.style.right = 'auto'; }
        };
        drag.onUp = stopDragging;
        dragRef.current = drag;
        window.addEventListener('pointermove', drag.onMove);
        window.addEventListener('pointerup', drag.onUp, { once: true });
    }, [stopDragging]);

    useEffect(() => () => {
        if (dragRef.current) { window.removeEventListener('pointermove', dragRef.current.onMove); window.removeEventListener('pointerup', dragRef.current.onUp); }
    }, []);

    const ask = async (instruction) => {
        const message = String(instruction || prompt).trim();
        if (!message || loading) return;
        setLoading(true);
        setError('');
        setResult(null);
        try {
            const next = await api('/api/copilot/request-assistant', {
                method: 'POST',
                body: JSON.stringify({ collectionId, request, response, prompt: message, activeTab })
            });
            setResult(next);
            if (next.patches?.length) onApplyPatches(next.patches);
            setPrompt('');
        } catch (reason) { setError(reason.message || 'The Request Agent is unavailable.'); }
        finally { setLoading(false); }
    };

    const panelStyle = layout.x === null ? undefined : { left: `${layout.x}px`, top: `${layout.y}px`, right: 'auto' };
    return <section ref={panelRef} style={panelStyle} className={`request-agent ${layout.minimized ? 'is-minimized' : 'is-expanded'}`} aria-label="Request Agent">
        {layout.minimized ? <div className="request-agent-mini-launcher">
            <button type="button" className="request-agent-drag-handle" onPointerDown={startDragging} aria-label="Move Request Agent" title="Drag to move"><GripVertical size={16} /></button>
            <button type="button" className="request-agent-mini-open" onClick={() => setLayout((current) => ({ ...current, minimized: false }))} aria-label="Open Request Agent" title="Open Request Agent"><Sparkles size={15} /><span>Request Agent</span></button>
        </div> : <><div className="request-agent-header">
            <button type="button" className="request-agent-drag-handle" onPointerDown={startDragging} aria-label="Move Request Agent" title="Drag to move; it snaps to the nearest edge"><GripVertical size={16} /></button>
            <button type="button" className="request-agent-toggle" onClick={() => setLayout((current) => ({ ...current, minimized: !current.minimized }))} aria-expanded={!layout.minimized}>
                <span className="request-agent-title"><Sparkles size={15} /> Request Agent</span>
            </button>
            <small>{contextLabel}</small>
            <button type="button" className="request-agent-minimize" onClick={() => setLayout((current) => ({ ...current, minimized: true }))} aria-label="Minimize Request Agent" title="Minimize"><Minus size={15} /></button>
        </div>
        <div className="request-agent-body">
            <div className="request-agent-quick-actions">
                {QUICK_ACTIONS.map(([key, label]) => <button type="button" key={key} onClick={() => ask({ complete: 'Complete this request with sensible parameters, headers, authentication placeholders, and a useful name.', explain: 'Explain the current request and identify anything that may surprise a user.', debug: 'Diagnose the last response and propose the smallest safe fixes.', tests: 'Suggest practical response assertions and add them to the tests field.', secure: 'Review this request for secret leakage, authentication, TLS, and unsafe configuration.' }[key])}>{label}</button>)}
            </div>
            <div className="request-agent-composer">
                <input value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); ask(); } }} placeholder="Ask the agent about this request…" aria-label="Request Agent instruction" />
                <button type="button" onClick={() => ask()} disabled={loading || !prompt.trim()}>{loading ? <Loader2 className="request-agent-spin" size={16} /> : <Sparkles size={16} />} Ask</button>
            </div>
            {error && <div className="request-agent-error" role="alert">{error}</div>}
            {result && <div className="request-agent-result">
                <p className="request-agent-answer">{result.answer}</p>
                {result.patches?.length ? <div className="request-agent-apply-state"><span>{result.patches.length} field{result.patches.length === 1 ? '' : 's'} updated in this unsaved draft.</span>{canUndo ? <button type="button" onClick={onUndo}>Undo agent changes</button> : null}</div> : null}
                {result.warnings?.length ? <div className="request-agent-warnings"><strong>Review carefully</strong>{result.warnings.map((warning, index) => <span key={index}>{warning}</span>)}</div> : null}
                {result.diagnostics?.length ? <div className="request-agent-diagnostics"><strong>Diagnostics</strong>{result.diagnostics.map((item, index) => <span key={index}>{item}</span>)}</div> : null}
                {result.patches?.length ? <div className="request-agent-patches"><strong>Applied changes</strong>{result.patches.map((patch, index) => <article key={`${patch.field}-${index}`} className="is-applied"><div><code>{patch.field}</code><span>{patch.reason || 'Updated by the Request Agent.'}</span></div><span className="request-agent-applied"><Check size={14} /> Applied</span></article>)}</div> : null}
                {result.suggestedTests && <details className="request-agent-tests"><summary>Suggested test script</summary><pre>{result.suggestedTests}</pre></details>}
            </div>}
        </div></>}
    </section>;
}
