// client/src/components/traceToTest/TraceDetail.js
// Span timeline for one trace, plus the create-request / create-test panel.
// Assertions are previewed from the server before anything is written.
import React, { useEffect, useMemo, useState } from 'react';
import { FiAlertTriangle, FiCheckCircle, FiClock, FiLock, FiPlus, FiRefreshCw } from 'react-icons/fi';
import AppSelect from '../common/AppSelect/AppSelect';

// A span is "slow" when it eats most of the trace — enough to be worth a look.
const SLOW_SHARE = 0.4;

const fmtMs = (ms) => (Number.isFinite(Number(ms)) ? `${Math.round(Number(ms))} ms` : '—');
const fmtTime = (v) => {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
};

/** Depth-first order so children sit under their parent. */
function orderSpans(spans = []) {
    const byParent = new Map();
    const ids = new Set(spans.map((s) => s.spanId));
    spans.forEach((s) => {
        const parent = s.parentSpanId && ids.has(s.parentSpanId) ? s.parentSpanId : '__root__';
        if (!byParent.has(parent)) byParent.set(parent, []);
        byParent.get(parent).push(s);
    });

    const out = [];
    const walk = (parent, depth) => {
        (byParent.get(parent) || []).forEach((span) => {
            out.push({ span, depth });
            walk(span.spanId, depth + 1);
        });
    };
    walk('__root__', 0);
    // Orphans (parent truncated away) would otherwise vanish — append them.
    if (out.length < spans.length) {
        const seen = new Set(out.map((o) => o.span.spanId));
        spans.filter((s) => !seen.has(s.spanId)).forEach((span) => out.push({ span, depth: 0 }));
    }
    return out;
}

const TraceDetail = ({ trace, collections, environments, onGenerated }) => {
    const [selectedSpanId, setSelectedSpanId] = useState(null);
    const [collectionId, setCollectionId] = useState('');
    const [environmentId, setEnvironmentId] = useState('none');
    const [includeResponseTime, setIncludeResponseTime] = useState(true);
    const [includeFields, setIncludeFields] = useState(true);
    const [assertions, setAssertions] = useState(null);
    const [testScript, setTestScript] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);

    const ordered = useMemo(() => orderSpans(trace?.spans || []), [trace]);

    const span = useMemo(
        () => (trace?.spans || []).find((s) => s.spanId === selectedSpanId) || null,
        [trace, selectedSpanId]
    );

    // A new trace invalidates the previously previewed assertions.
    useEffect(() => {
        setSelectedSpanId(null);
        setAssertions(null);
        setTestScript('');
        setError(null);
        setNotice(null);
    }, [trace?.traceId]);

    useEffect(() => { setAssertions(null); setTestScript(''); }, [selectedSpanId]);

    const traceStart = trace?.startTime ? new Date(trace.startTime).getTime() : null;
    const traceDuration = Number(trace?.durationMs) || 0;

    const call = async (path, body) => {
        const res = await fetch(`/api/traces/${encodeURIComponent(trace.traceId)}/${path}`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const text = await res.text();
        let data = {};
        try { data = JSON.parse(text); } catch { /* non-JSON error body */ }
        if (!res.ok) throw new Error(data.message || text || `Request failed (${res.status})`);
        return data;
    };

    const run = async (fn) => {
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            await fn();
        } catch (e) {
            setError(e.message || 'Something went wrong');
        } finally {
            setBusy(false);
        }
    };

    const preview = () => run(async () => {
        const data = await call('create-test', {
            spanId: span.spanId,
            preview: true,
            options: { includeResponseTime, includeFields }
        });
        setAssertions(data.assertions || []);
        setTestScript(data.testScript || '');
    });

    const createRequest = () => run(async () => {
        const data = await call('create-request', {
            spanId: span.spanId,
            collectionId,
            environmentId: environmentId === 'none' ? undefined : environmentId
        });
        setNotice(`Created request "${data.request?.name}" in the selected collection.`);
        onGenerated?.();
    });

    const createTest = () => run(async () => {
        const data = await call('create-test', {
            spanId: span.spanId,
            collectionId,
            environmentId: environmentId === 'none' ? undefined : environmentId,
            options: { includeResponseTime, includeFields }
        });
        setAssertions(data.assertions || []);
        setTestScript(data.testScript || '');
        setNotice(`Saved a regression test with ${(data.assertions || []).length} assertion(s) on "${data.request?.name}".`);
        onGenerated?.();
    });

    const collectionOptions = useMemo(() => [
        { value: '', label: 'Choose a collection…' },
        ...collections.map((c) => ({ value: String(c._id), label: c.name }))
    ], [collections]);

    const environmentOptions = useMemo(() => [
        { value: 'none', label: 'No environment' },
        ...environments.map((e) => ({ value: String(e._id), label: e.name }))
    ], [environments]);

    const canGenerate = Boolean(span && collectionId && (span.httpMethod || span.url));

    return (
        <div className="ttt-card">
            <div className="ttt-card-head">
                <div className="ttt-card-title">
                    <FiClock className="ttt-card-title-icon" />
                    {trace.rootServiceName} · {trace.route || trace.rootSpanName || trace.traceId}
                </div>
                <span className="ttt-muted ttt-mono">{trace.traceId}</span>
            </div>

            {error && <div className="ttt-error">{error}</div>}
            {notice && <div className="ttt-notice">{notice}</div>}
            {trace.truncatedSpans > 0 && (
                <div className="ttt-notice">
                    {trace.truncatedSpans} span{trace.truncatedSpans === 1 ? ' was' : 's were'} dropped by the
                    per-trace import limit and are not shown.
                </div>
            )}

            <div className="ttt-card-body">
                <div className="ttt-detail-layout">
                    <div className="ttt-section">
                        <h3 className="ttt-section-title">
                            Spans
                            <span className="ttt-muted">{ordered.length} span{ordered.length === 1 ? '' : 's'}</span>
                        </h3>
                        <div className="ttt-tree">
                            {ordered.map(({ span: s, depth }) => {
                                const isError = s.status === 'error';
                                const share = traceDuration > 0 ? (Number(s.durationMs) || 0) / traceDuration : 0;
                                const isSlow = !isError && share >= SLOW_SHARE;
                                const spanStart = s.startTime ? new Date(s.startTime).getTime() : null;
                                const offset = traceStart != null && spanStart != null && traceDuration > 0
                                    ? Math.min(100, Math.max(0, ((spanStart - traceStart) / traceDuration) * 100))
                                    : 0;
                                const width = Math.min(100 - offset, Math.max(1, share * 100));
                                const fillClass = isError ? ' ttt-span-bar-fill--error' : isSlow ? ' ttt-span-bar-fill--slow' : '';

                                return (
                                    <button
                                        type="button"
                                        key={s.spanId}
                                        className={`ttt-span${s.spanId === selectedSpanId ? ' ttt-span--active' : ''}${isError ? ' ttt-span--error' : ''}${isSlow ? ' ttt-span--slow' : ''}`}
                                        style={{ marginLeft: `${Math.min(depth, 6) * 14}px` }}
                                        aria-pressed={s.spanId === selectedSpanId}
                                        onClick={() => setSelectedSpanId(s.spanId)}
                                    >
                                        <span className="ttt-span-main">
                                            {s.httpMethod && <span className="ttt-method">{s.httpMethod}</span>}
                                            <span className="ttt-span-name">{s.route || s.name || s.spanId}</span>
                                            <span className="ttt-span-service">{s.serviceName}</span>
                                            {isError && <FiAlertTriangle size={13} aria-label="Failed span" />}
                                        </span>
                                        <span className="ttt-span-bar">
                                            <span
                                                className={`ttt-span-bar-fill${fillClass}`}
                                                style={{ left: `${offset}%`, width: `${width}%` }}
                                            />
                                        </span>
                                        <span className="ttt-span-duration">
                                            {fmtMs(s.durationMs)}
                                            {Number.isFinite(Number(s.httpStatusCode)) && ` · ${s.httpStatusCode}`}
                                        </span>
                                    </button>
                                );
                            })}
                            {ordered.length === 0 && <div className="ttt-empty"><strong>This trace has no spans.</strong></div>}
                        </div>
                    </div>

                    <div className="ttt-section">
                        <h3 className="ttt-section-title">Span details</h3>
                        {!span && <span className="ttt-muted">Pick a span to see its details and generate from it.</span>}
                        {span && (
                            <>
                                <dl className="ttt-kv">
                                    <dt>Span ID</dt><dd>{span.spanId}</dd>
                                    <dt>Service</dt><dd>{span.serviceName}</dd>
                                    <dt>Kind</dt><dd>{span.kind}</dd>
                                    <dt>Status</dt><dd>{span.status}{span.statusMessage ? ` — ${span.statusMessage}` : ''}</dd>
                                    <dt>URL</dt><dd>{span.url || span.route || '—'}</dd>
                                    <dt>HTTP status</dt><dd>{span.httpStatusCode ?? '—'}</dd>
                                    <dt>Duration</dt><dd>{fmtMs(span.durationMs)}</dd>
                                    <dt>Started</dt><dd>{fmtTime(span.startTime)}</dd>
                                    <dt>Environment</dt><dd>{span.environment || '—'}</dd>
                                    <dt>Version</dt><dd>{span.deploymentVersion || '—'}</dd>
                                </dl>

                                {(span.requestHeaders || []).length > 0 && (
                                    <div>
                                        <span className="ttt-pre-label">Request headers</span>
                                        <pre className="ttt-pre">
                                            {span.requestHeaders.map((h) => `${h.key}: ${h.sensitive ? '🔒 redacted' : h.value}`).join('\n')}
                                        </pre>
                                    </div>
                                )}
                                {span.responseBody && (
                                    <div>
                                        <span className="ttt-pre-label">Response body</span>
                                        <pre className="ttt-pre">{span.responseBody}</pre>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {span && (
                    <div className="ttt-section">
                        <h3 className="ttt-section-title">
                            Generate from this span
                            <span className="ttt-connector-note"><FiLock size={13} /> Secrets become {'{{placeholders}}'} — observed values are never copied.</span>
                        </h3>

                        {!(span.httpMethod || span.url) && (
                            <span className="ttt-muted">
                                This span has no HTTP method or URL, so it cannot become a request. Pick an HTTP client or server span.
                            </span>
                        )}

                        <div className="ttt-grid-2">
                            <div className="ttt-field">
                                <label htmlFor="ttt-collection">Target collection</label>
                                <AppSelect id="ttt-collection" value={collectionId} onChange={setCollectionId} options={collectionOptions} />
                            </div>
                            <div className="ttt-field">
                                <label htmlFor="ttt-environment">Environment</label>
                                <AppSelect id="ttt-environment" value={environmentId} onChange={setEnvironmentId} options={environmentOptions} />
                            </div>
                        </div>

                        <div className="ttt-grid-2">
                            <label className="ttt-check">
                                <input
                                    type="checkbox"
                                    checked={includeResponseTime}
                                    onChange={(e) => setIncludeResponseTime(e.target.checked)}
                                />
                                Assert a response-time threshold
                            </label>
                            <label className="ttt-check">
                                <input
                                    type="checkbox"
                                    checked={includeFields}
                                    onChange={(e) => setIncludeFields(e.target.checked)}
                                />
                                Assert required JSON response fields
                            </label>
                        </div>

                        <div className="ttt-header-actions">
                            <button className="ttt-btn ttt-btn--ghost" onClick={preview} disabled={busy || !span}>
                                {busy ? <FiRefreshCw className="ttt-spin" /> : <FiCheckCircle />} Preview assertions
                            </button>
                            <button className="ttt-btn ttt-btn--ghost" onClick={createRequest} disabled={busy || !canGenerate}>
                                <FiPlus /> Create Pigeon request
                            </button>
                            <button className="ttt-btn ttt-btn--primary" onClick={createTest} disabled={busy || !canGenerate}>
                                <FiPlus /> Create regression test
                            </button>
                        </div>

                        {assertions && assertions.length === 0 && (
                            <span className="ttt-muted">
                                No assertions could be derived from this span — it has no status code, duration or response body.
                            </span>
                        )}

                        {assertions && assertions.length > 0 && (
                            <>
                                <ul className="ttt-assertions">
                                    {assertions.map((a, i) => (
                                        <li key={`${a.kind}-${i}`} className={`ttt-assertion${a.warning ? ' ttt-assertion--warn' : ''}`}>
                                            <span className="ttt-assertion-icon">
                                                {a.warning ? <FiAlertTriangle size={15} /> : <FiCheckCircle size={15} />}
                                            </span>
                                            <span className="ttt-assertion-text">
                                                {a.label}
                                                {a.warning && <span className="ttt-sub">{a.warning}</span>}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                                <div>
                                    <span className="ttt-pre-label">Generated test script</span>
                                    <pre className="ttt-pre">{testScript}</pre>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TraceDetail;
