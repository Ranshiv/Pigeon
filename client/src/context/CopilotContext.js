import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

const CopilotContext = createContext(null);
const STORAGE_KEY = 'pigeon:copilot-pins:v1';

// Pages without a resolvable resource still have to identify themselves, or the
// model keeps describing whatever resource the previous turn was about.
const isIdSegment = (segment) => /^[0-9a-f]{24}$/i.test(segment) || /^\d+$/.test(segment);
const prettify = (value) => String(value).replace(/[-_]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (character) => character.toUpperCase());
const pageTitle = (pathname, search) => {
    const parts = String(pathname || '').replace(/^\/workspace\/?/, '').split('/').filter(Boolean).filter((segment) => !isIdSegment(segment));
    const tab = new URLSearchParams(search || '').get('tab');
    return [...parts, tab].filter(Boolean).map(prettify).join(' · ') || 'Home';
};

const readPins = () => {
    try {
        const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        return value && typeof value === 'object' ? value : {};
    } catch (_) { return {}; }
};

const sourceKey = (source) => `${source?.type || ''}:${source?.id || ''}:${source?.parentId || source?.kind || ''}`;
const compactSource = (source) => source ? {
    type: source.type,
    id: String(source.id || ''),
    parentId: source.parentId ? String(source.parentId) : undefined,
    kind: source.kind || undefined,
    workspaceId: source.workspaceId ? String(source.workspaceId) : '',
    label: source.label || ''
} : null;

export const CopilotContextProvider = ({ children }) => {
    const [activeContext, setActiveContext] = useState(null);
    const [pinsByWorkspace, setPinsByWorkspace] = useState(readPins);
    const [openNonce, setOpenNonce] = useState(0);
    const [investigationRequest, setInvestigationRequest] = useState(null);
    const [incidentUpdateDraft, setIncidentUpdateDraftState] = useState(null);
    const registrationRef = useRef({ sequence: 0, values: new Map() });
    const location = useLocation();
    const activePage = useMemo(() => ({
        title: pageTitle(location.pathname, location.search),
        path: `${location.pathname}${location.search || ''}`
    }), [location.pathname, location.search]);

    const workspaceKey = activeContext?.workspaceId || 'overview';
    const pinnedSources = useMemo(() => pinsByWorkspace[workspaceKey] || [], [pinsByWorkspace, workspaceKey]);

    const registerPageContext = useCallback((descriptor) => {
        const registry = registrationRef.current;
        const token = registry.sequence + 1;
        registry.sequence = token;
        registry.values.set(token, compactSource(descriptor));
        setActiveContext(registry.values.get(token));
        return () => {
            registry.values.delete(token);
            const remaining = [...registry.values.entries()].sort((a, b) => b[0] - a[0]);
            setActiveContext(remaining[0]?.[1] || null);
        };
    }, []);

    const requestOpen = useCallback((descriptor) => {
        if (descriptor) setActiveContext(compactSource(descriptor));
        setOpenNonce((value) => value + 1);
    }, []);

    const requestInvestigation = useCallback((descriptor, timeRange = '24h') => {
        const compact = compactSource(descriptor);
        if (!compact || !['incident', 'monitor'].includes(compact.type)) return;
        setActiveContext(compact);
        setInvestigationRequest({ target: compact, timeRange, nonce: Date.now() });
        setOpenNonce((value) => value + 1);
    }, []);

    const clearInvestigationRequest = useCallback(() => setInvestigationRequest(null), []);
    const setIncidentUpdateDraft = useCallback((draft) => setIncidentUpdateDraftState(draft ? {
        incidentId: String(draft.incidentId || ''),
        text: String(draft.text || ''),
        audience: draft.audience === 'public' ? 'public' : 'internal'
    } : null), []);
    const clearIncidentUpdateDraft = useCallback(() => setIncidentUpdateDraftState(null), []);

    useEffect(() => {
        const onLegacyContext = (event) => {
            const collectionId = event.detail?.collectionId;
            if (!collectionId) return;
            requestOpen({ type: 'collection', id: collectionId, workspaceId: event.detail?.workspaceId || '', label: event.detail?.label || 'Selected collection' });
        };
        window.addEventListener('pigeon:copilot-context', onLegacyContext);
        return () => window.removeEventListener('pigeon:copilot-context', onLegacyContext);
    }, [requestOpen]);

    useEffect(() => {
        try {
            const idsOnly = Object.fromEntries(Object.entries(pinsByWorkspace).map(([key, sources]) => [key, (sources || []).map((source) => ({ ...source, label: '' }))]));
            localStorage.setItem(STORAGE_KEY, JSON.stringify(idsOnly));
        }
        catch (_) { /* Storage is optional; server authorization remains authoritative. */ }
    }, [pinsByWorkspace]);

    const togglePin = useCallback((source) => {
        const compact = compactSource(source);
        if (!compact?.id || !compact?.type) return;
        // Pins belong to the currently open Copilot thread. On the overview
        // thread, sources can come from many workspaces, so keying by the
        // source workspace would update a bucket the panel is not reading.
        const key = workspaceKey;
        setPinsByWorkspace((current) => {
            const existing = current[key] || [];
            const identity = sourceKey(compact);
            const next = existing.some((item) => sourceKey(item) === identity)
                ? existing.filter((item) => sourceKey(item) !== identity)
                : [...existing, compact].slice(-7);
            return { ...current, [key]: next };
        });
    }, [workspaceKey]);

    const clearPins = useCallback(() => {
        setPinsByWorkspace((current) => ({ ...current, [workspaceKey]: [] }));
    }, [workspaceKey]);

    const value = useMemo(() => ({
        activeContext,
        activePage,
        workspaceId: activeContext?.workspaceId || null,
        workspaceKey,
        pinnedSources,
        openNonce,
        investigationRequest,
        incidentUpdateDraft,
        registerPageContext,
        requestOpen,
        requestInvestigation,
        clearInvestigationRequest,
        setIncidentUpdateDraft,
        clearIncidentUpdateDraft,
        togglePin,
        clearPins,
        sourceKey
    }), [activeContext, activePage, workspaceKey, pinnedSources, openNonce, investigationRequest, incidentUpdateDraft, registerPageContext, requestOpen, requestInvestigation, clearInvestigationRequest, setIncidentUpdateDraft, clearIncidentUpdateDraft, togglePin, clearPins]);

    return <CopilotContext.Provider value={value}>{children}</CopilotContext.Provider>;
};

export const useCopilotContext = () => {
    const value = useContext(CopilotContext);
    if (!value) throw new Error('useCopilotContext must be used inside CopilotContextProvider.');
    return value;
};

export const useCopilotPageContext = (descriptor) => {
    const { registerPageContext } = useCopilotContext();
    const serialized = JSON.stringify(descriptor || null);
    useEffect(() => {
        const value = serialized ? JSON.parse(serialized) : null;
        if (!value?.type || !value?.id) return undefined;
        return registerPageContext(value);
    }, [registerPageContext, serialized]);
};
