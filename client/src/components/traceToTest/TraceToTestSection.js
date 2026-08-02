// client/src/components/traceToTest/TraceToTestSection.js
// Browse imported OpenTelemetry traces and turn an observed span into a
// Pigeon request or regression test.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiActivity, FiAlertTriangle, FiClock, FiRefreshCw, FiUpload } from 'react-icons/fi';
import AppSelect from '../common/AppSelect/AppSelect';
import { useWorkspaceOptions } from '../compliance/useWorkspaceOptions';
import TraceDetail from './TraceDetail';
import TraceImportPanel from './TraceImportPanel';
import './traceToTest.css';
import { useCopilotPageContext } from '../../context/CopilotContext';

const STATUS_FILTERS = [
    { value: 'all', label: 'Any status' },
    { value: '2xx', label: '2xx success' },
    { value: '3xx', label: '3xx redirect' },
    { value: '4xx', label: '4xx client error' },
    { value: '5xx', label: '5xx server error' }
];

const DURATION_FILTERS = [
    { value: '0', label: 'Any duration' },
    { value: '100', label: 'Slower than 100 ms' },
    { value: '500', label: 'Slower than 500 ms' },
    { value: '1000', label: 'Slower than 1 s' },
    { value: '5000', label: 'Slower than 5 s' }
];

const ERROR_FILTERS = [
    { value: 'false', label: 'All traces' },
    { value: 'true', label: 'Errors only' }
];

const fmtMs = (ms) => (Number.isFinite(Number(ms)) ? `${Math.round(Number(ms))} ms` : '—');
const fmtTime = (v) => {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
};

const Tile = ({ icon: Icon, label, value, tone }) => (
    <div className={`ttt-tile${tone ? ` ttt-tile--${tone}` : ''}`}>
        <span className="ttt-tile-label">
            {Icon && <Icon className="ttt-tile-icon" />}
            {label}
        </span>
        <span className="ttt-tile-value">{value}</span>
    </div>
);

const TraceToTestSection = () => {
    const { workspaces, defaultWorkspaceId, loading: workspacesLoading } = useWorkspaceOptions();

    const [workspaceId, setWorkspaceId] = useState(() => new URLSearchParams(window.location.search).get('workspaceId') || '');
    const [traces, setTraces] = useState([]);
    const [collections, setCollections] = useState([]);
    const [environments, setEnvironments] = useState([]);

    const [serviceFilter, setServiceFilter] = useState('all');
    const [environmentFilter, setEnvironmentFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [durationFilter, setDurationFilter] = useState('0');
    const [errorsOnly, setErrorsOnly] = useState('false');
    const [routeQuery, setRouteQuery] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showImport, setShowImport] = useState(false);

    const [selectedTraceId, setSelectedTraceId] = useState(() => new URLSearchParams(window.location.search).get('traceId') || null);
    const [selectedTrace, setSelectedTrace] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    useCopilotPageContext(selectedTrace ? {
        type: 'trace',
        id: selectedTrace.traceId,
        workspaceId,
        label: `${selectedTrace.rootServiceName || 'Trace'} · ${selectedTrace.route || selectedTrace.traceId}`
    } : (workspaceId ? { type: 'workspace', id: workspaceId, workspaceId, label: 'Trace workspace' } : null));

    useEffect(() => {
        if (!workspaceId && defaultWorkspaceId) setWorkspaceId(defaultWorkspaceId);
    }, [defaultWorkspaceId, workspaceId]);

    const loadAll = useCallback(async (signal) => {
        if (!workspaceId) return;
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams({ workspaceId });
            if (serviceFilter !== 'all') params.set('service', serviceFilter);
            if (environmentFilter !== 'all') params.set('environment', environmentFilter);
            if (statusFilter !== 'all') params.set('status', statusFilter);
            if (durationFilter !== '0') params.set('minDurationMs', durationFilter);
            if (errorsOnly === 'true') params.set('errorsOnly', 'true');
            if (routeQuery.trim()) params.set('route', routeQuery.trim());

            const [tracesRes, collectionsRes, envsRes] = await Promise.all([
                fetch(`/api/traces?${params.toString()}`, { credentials: 'include', signal }),
                fetch(`/api/collections?workspaceId=${encodeURIComponent(workspaceId)}`, { credentials: 'include', signal }),
                fetch(`/api/environments?workspaceId=${encodeURIComponent(workspaceId)}`, { credentials: 'include', signal })
            ]);

            if (!tracesRes.ok) {
                const text = await tracesRes.text();
                let message = text;
                try { message = JSON.parse(text).message || text; } catch { /* plain text */ }
                throw new Error(message || `Failed to load traces (${tracesRes.status})`);
            }

            const data = await tracesRes.json();
            setTraces(data.traces || []);

            if (collectionsRes.ok) {
                const body = await collectionsRes.json();
                const all = Array.isArray(body) ? body : (body.collections || []);
                // /api/collections returns every collection the user owns; narrow
                // it to the selected workspace here.
                setCollections(all.filter((c) => String(c.workspaceId || '') === String(workspaceId)));
            }
            if (envsRes.ok) {
                const body = await envsRes.json();
                setEnvironments(Array.isArray(body) ? body : (body.environments || []));
            }
        } catch (e) {
            if (e.name === 'AbortError') return;
            setError(e.message || 'Failed to load traces');
            setTraces([]);
        } finally {
            setLoading(false);
        }
    }, [workspaceId, serviceFilter, environmentFilter, statusFilter, durationFilter, errorsOnly, routeQuery]);

    useEffect(() => {
        const controller = new AbortController();
        loadAll(controller.signal);
        return () => controller.abort();
    }, [loadAll]);

    // Spans are stripped from the list response, so the detail is fetched on demand.
    useEffect(() => {
        if (!selectedTraceId || !workspaceId) {
            setSelectedTrace(null);
            return undefined;
        }
        const controller = new AbortController();
        (async () => {
            try {
                setDetailLoading(true);
                setError(null);
                const res = await fetch(
                    `/api/traces/${encodeURIComponent(selectedTraceId)}?workspaceId=${encodeURIComponent(workspaceId)}`,
                    { credentials: 'include', signal: controller.signal }
                );
                if (!res.ok) {
                    const text = await res.text();
                    let message = text;
                    try { message = JSON.parse(text).message || text; } catch { /* plain text */ }
                    throw new Error(message || `Failed to load trace (${res.status})`);
                }
                setSelectedTrace(await res.json());
            } catch (e) {
                if (e.name === 'AbortError') return;
                setError(e.message || 'Failed to load trace');
                setSelectedTrace(null);
            } finally {
                setDetailLoading(false);
            }
        })();
        return () => controller.abort();
    }, [selectedTraceId, workspaceId]);

    const serviceOptions = useMemo(() => {
        const names = [...new Set(traces.flatMap((t) => t.services || []).filter(Boolean))];
        return [{ value: 'all', label: 'Any service' }, ...names.map((n) => ({ value: n, label: n }))];
    }, [traces]);

    const environmentOptions = useMemo(() => {
        const names = [...new Set(traces.map((t) => t.environment).filter(Boolean))];
        return [{ value: 'all', label: 'Any environment' }, ...names.map((n) => ({ value: n, label: n }))];
    }, [traces]);

    const summary = useMemo(() => {
        const durations = traces.map((t) => Number(t.durationMs)).filter(Number.isFinite);
        return {
            total: traces.length,
            failing: traces.filter((t) => t.hasError).length,
            services: new Set(traces.flatMap((t) => t.services || [])).size,
            slowest: durations.length ? fmtMs(Math.max(...durations)) : '—'
        };
    }, [traces]);

    const workspaceOptions = workspaces.map((w) => ({ value: w.id, label: w.label }));

    return (
        <div className="ttt-root">
            <header className="ttt-header">
                <div>
                    <h1 className="ttt-title">Trace to Test</h1>
                    <p className="ttt-subtitle">
                        Import OpenTelemetry traces, inspect the spans behind a failure or a slow call, and turn any
                        observed HTTP span into a Pigeon request or regression test.
                    </p>
                </div>
                <div className="ttt-header-actions">
                    <button className="ttt-btn ttt-btn--ghost" onClick={() => loadAll()} disabled={loading}>
                        <FiRefreshCw className={loading ? 'ttt-spin' : undefined} /> Refresh
                    </button>
                    <button
                        className="ttt-btn ttt-btn--primary"
                        onClick={() => setShowImport((v) => !v)}
                        disabled={!workspaceId}
                    >
                        <FiUpload /> Import traces
                    </button>
                </div>
            </header>

            {traces.length > 0 && (
                <div className="ttt-summary">
                    <Tile icon={FiActivity} label="Traces" value={summary.total} />
                    <Tile
                        icon={FiAlertTriangle}
                        label="With errors"
                        value={summary.failing}
                        tone={summary.failing > 0 ? 'warn' : undefined}
                    />
                    <Tile label="Services" value={summary.services} />
                    <Tile icon={FiClock} label="Slowest" value={summary.slowest} />
                </div>
            )}

            {showImport && (
                <TraceImportPanel
                    workspaceId={workspaceId}
                    onClose={() => setShowImport(false)}
                    onImported={() => loadAll()}
                />
            )}

            <div className="ttt-card">
                <div className="ttt-card-head">
                    <div className="ttt-card-title">
                        <FiActivity className="ttt-card-title-icon" />
                        Traces
                    </div>
                    <span className="ttt-muted">
                        {loading ? 'Loading…' : `${traces.length} trace${traces.length === 1 ? '' : 's'}`}
                    </span>
                </div>

                <div className="ttt-filters">
                    <div className="ttt-field">
                        <label htmlFor="ttt-workspace">Workspace</label>
                        <AppSelect
                            id="ttt-workspace"
                            value={workspaceId}
                            onChange={setWorkspaceId}
                            disabled={workspacesLoading}
                            options={workspaceOptions.length ? workspaceOptions : [{ value: '', label: 'No workspaces' }]}
                        />
                    </div>
                    <div className="ttt-field">
                        <label htmlFor="ttt-service">Service</label>
                        <AppSelect id="ttt-service" value={serviceFilter} onChange={setServiceFilter} options={serviceOptions} />
                    </div>
                    <div className="ttt-field">
                        <label htmlFor="ttt-env">Environment</label>
                        <AppSelect id="ttt-env" value={environmentFilter} onChange={setEnvironmentFilter} options={environmentOptions} />
                    </div>
                    <div className="ttt-field">
                        <label htmlFor="ttt-status">HTTP status</label>
                        <AppSelect id="ttt-status" value={statusFilter} onChange={setStatusFilter} options={STATUS_FILTERS} />
                    </div>
                    <div className="ttt-field">
                        <label htmlFor="ttt-duration">Duration</label>
                        <AppSelect id="ttt-duration" value={durationFilter} onChange={setDurationFilter} options={DURATION_FILTERS} />
                    </div>
                    <div className="ttt-field">
                        <label htmlFor="ttt-errors">Error state</label>
                        <AppSelect id="ttt-errors" value={errorsOnly} onChange={setErrorsOnly} options={ERROR_FILTERS} />
                    </div>
                    <div className="ttt-field">
                        <label htmlFor="ttt-route">Route contains</label>
                        <input
                            id="ttt-route"
                            className="ttt-input"
                            type="search"
                            value={routeQuery}
                            onChange={(e) => setRouteQuery(e.target.value)}
                            placeholder="/api/orders"
                        />
                    </div>
                </div>

                {error && <div className="ttt-error">{error}</div>}

                {loading && traces.length === 0 && <div className="ttt-loading">Loading traces…</div>}

                {!loading && !error && traces.length === 0 && (
                    <div className="ttt-empty">
                        <strong>No traces yet.</strong>
                        <span>Import an OTLP export, or pull from your collector, to start building tests from real traffic.</span>
                    </div>
                )}

                {traces.length > 0 && (
                    <div className="ttt-table-wrap">
                        <table className="ttt-table">
                            <thead>
                                <tr>
                                    <th>Trace</th>
                                    <th>Service</th>
                                    <th>Route</th>
                                    <th>Status</th>
                                    <th>Duration</th>
                                    <th>Spans</th>
                                    <th>Environment</th>
                                    <th>Started</th>
                                </tr>
                            </thead>
                            <tbody>
                                {traces.map((trace) => (
                                    <tr
                                        key={trace.traceId}
                                        className={`ttt-row${trace.traceId === selectedTraceId ? ' ttt-row--active' : ''}${trace.hasError ? ' ttt-row--error' : ''}`}
                                        onClick={() => setSelectedTraceId(trace.traceId)}
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                setSelectedTraceId(trace.traceId);
                                            }
                                        }}
                                    >
                                        <td>
                                            <span className="ttt-name">{trace.rootSpanName || trace.traceId}</span>
                                            <span className="ttt-sub ttt-mono">{trace.traceId}</span>
                                        </td>
                                        <td>{trace.rootServiceName}</td>
                                        <td>
                                            {trace.httpMethod && <span className="ttt-method">{trace.httpMethod}</span>}{' '}
                                            <span className="ttt-mono">{trace.route || '—'}</span>
                                        </td>
                                        <td>
                                            <span className={`ttt-badge ttt-badge--${trace.hasError ? 'error' : 'ok'}`}>
                                                {trace.httpStatusCode ?? (trace.hasError ? 'error' : 'ok')}
                                            </span>
                                        </td>
                                        <td className="ttt-mono">{fmtMs(trace.durationMs)}</td>
                                        <td>{trace.spanCount}</td>
                                        <td>{trace.environment || '—'}</td>
                                        <td>{fmtTime(trace.startTime)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {detailLoading && <div className="ttt-card"><div className="ttt-loading">Loading trace…</div></div>}

            {!detailLoading && selectedTrace && (
                <TraceDetail
                    trace={selectedTrace}
                    collections={collections}
                    environments={environments}
                    onGenerated={() => loadAll()}
                />
            )}
        </div>
    );
};

export default TraceToTestSection;
