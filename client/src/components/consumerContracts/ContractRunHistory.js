// client/src/components/consumerContracts/ContractRunHistory.js
import React, { useCallback, useEffect, useState } from 'react';
import { FiAlertTriangle, FiCheckCircle, FiChevronDown, FiChevronRight, FiXCircle } from 'react-icons/fi';
import { useCopilotPageContext } from '../../context/CopilotContext';

const formatDateTime = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

const pretty = (text) => {
    if (!text) return '';
    try {
        return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
        return text;
    }
};

const InteractionResult = ({ result }) => {
    const [open, setOpen] = useState(!result.passed);

    return (
        <div className={`ccd-result${result.passed ? '' : ' ccd-result--failed'}`}>
            <button
                type="button"
                className="ccd-result-head"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
            >
                {open ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                {result.passed
                    ? <FiCheckCircle size={15} color="var(--success-text, #15803d)" />
                    : <FiXCircle size={15} color="var(--danger-text)" />}
                <span className="ccd-method">{result.method}</span>
                <span className="ccd-interaction-main">
                    <span className="ccd-interaction-name">{result.interactionName}</span>
                    <span className="ccd-interaction-url">{result.url}</span>
                </span>
                {result.breaking && <span className="ccd-badge ccd-badge--breaking">Breaking</span>}
                <span className="ccd-muted">{result.durationMs} ms</span>
            </button>

            {open && (
                <div className="ccd-result-body">
                    {result.error && <div className="ccd-error" style={{ borderBottom: 'none' }}>{result.error}</div>}

                    {result.violations?.length > 0 ? (
                        <ul className="ccd-violations">
                            {result.violations.map((v, i) => (
                                <li key={i} className={`ccd-violation${v.breaking ? ' ccd-violation--breaking' : ''}`}>
                                    <FiAlertTriangle size={14} className="ccd-violation-icon" />
                                    <span className="ccd-violation-text">
                                        {v.message}
                                        <span className="ccd-violation-diff">
                                            expected: {v.expected || '—'} · actual: {v.actual || '—'}
                                        </span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <span className="ccd-muted">All consumer expectations were met.</span>
                    )}

                    <div className="ccd-diff-grid">
                        <div>
                            <span className="ccd-pre-label">Expected body (consumer)</span>
                            <pre className="ccd-pre">{pretty(result.expectedBody) || 'Not recorded'}</pre>
                        </div>
                        <div>
                            <span className="ccd-pre-label">
                                Actual body (provider · HTTP {result.actualStatus ?? '—'})
                            </span>
                            <pre className="ccd-pre">{pretty(result.actualBody) || 'No body'}</pre>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ContractRunHistory = ({ contractId, workspaceId, refreshToken }) => {
    const [runs, setRuns] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const requestedRunId = new URLSearchParams(window.location.search).get('run');
    const [openRunId, setOpenRunId] = useState(null);
    const [runDetail, setRunDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const activeRun = runDetail || runs.find((run) => String(run._id) === String(openRunId));
    useCopilotPageContext(activeRun?._id ? {
        type: 'test_run',
        kind: 'consumer_contract',
        id: activeRun._id,
        workspaceId: workspaceId || '',
        label: `Consumer contract · ${activeRun.status || 'run'}`
    } : null);

    const loadRuns = useCallback(async (signal) => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch(`/api/consumer-contracts/${contractId}/runs`, { credentials: 'include', signal });
            if (!res.ok) throw new Error((await res.text()) || `Failed to load runs (${res.status})`);
            const data = await res.json();
            setRuns(data.runs || []);
        } catch (e) {
            if (e.name === 'AbortError') return;
            setError(e.message || 'Failed to load runs');
        } finally {
            setLoading(false);
        }
    }, [contractId]);

    useEffect(() => {
        const controller = new AbortController();
        loadRuns(controller.signal);
        setOpenRunId(null);
        setRunDetail(null);
        return () => controller.abort();
    }, [loadRuns, refreshToken, requestedRunId]);

    useEffect(() => {
        if (requestedRunId && runs.some((run) => String(run._id) === String(requestedRunId)) && !runDetail) toggleRun(requestedRunId);
        // toggleRun intentionally remains event-shaped; the URL deep link runs it once after history loads.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [requestedRunId, runs.length, refreshToken]);

    const toggleRun = async (runId) => {
        if (openRunId === runId) {
            setOpenRunId(null);
            setRunDetail(null);
            return;
        }
        setOpenRunId(runId);
        setRunDetail(null);
        try {
            setDetailLoading(true);
            const res = await fetch(`/api/consumer-contracts/runs/${runId}`, { credentials: 'include' });
            if (!res.ok) throw new Error((await res.text()) || 'Failed to load run');
            setRunDetail(await res.json());
        } catch (e) {
            setError(e.message || 'Failed to load run');
        } finally {
            setDetailLoading(false);
        }
    };

    return (
        <div className="ccd-card">
            <div className="ccd-card-head">
                <div className="ccd-card-title">Run history</div>
                <span className="ccd-muted">{loading ? 'Loading…' : `${runs.length} run${runs.length === 1 ? '' : 's'}`}</span>
            </div>

            {error && <div className="ccd-error">{error}</div>}

            {loading && runs.length === 0 && <div className="ccd-loading">Loading run history…</div>}

            {!loading && !error && runs.length === 0 && (
                <div className="ccd-empty">
                    <strong>This contract has not been run yet.</strong>
                    <span>Run it against an environment to record a pass rate and detect breaking changes.</span>
                </div>
            )}

            {runs.length > 0 && (
                <div className="ccd-table-wrap">
                    <table className="ccd-table">
                        <thead>
                            <tr>
                                <th>Run</th>
                                <th>Environment</th>
                                <th>Result</th>
                                <th>Pass rate</th>
                                <th>Failures</th>
                                <th>Duration</th>
                            </tr>
                        </thead>
                        <tbody>
                            {runs.map((run) => (
                                <React.Fragment key={run._id}>
                                    <tr
                                        className={`ccd-row${openRunId === run._id ? ' ccd-row--active' : ''}`}
                                        onClick={() => toggleRun(run._id)}
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                toggleRun(run._id);
                                            }
                                        }}
                                    >
                                        <td>
                                            <span className="ccd-name">{formatDateTime(run.createdAt)}</span>
                                            <span className="ccd-sub">v{run.contractVersion || '—'}</span>
                                        </td>
                                        <td>{run.environmentName}</td>
                                        <td>
                                            <span className={`ccd-badge ccd-badge--${run.status}`}>{run.status}</span>
                                            {run.breaking && <span className="ccd-badge ccd-badge--breaking">Breaking</span>}
                                        </td>
                                        <td>
                                            {run.total === 0 ? '—' : `${Math.round((run.passedCount / run.total) * 100)}%`}
                                            <span className="ccd-sub">{run.passedCount}/{run.total} passed</span>
                                        </td>
                                        <td>{run.failedCount}</td>
                                        <td>{run.durationMs} ms</td>
                                    </tr>
                                    {openRunId === run._id && (
                                        <tr>
                                            <td colSpan={6} style={{ whiteSpace: 'normal', padding: '12px 18px' }}>
                                                {detailLoading && <div className="ccd-loading">Loading interaction results…</div>}
                                                {!detailLoading && runDetail?.results?.length > 0 && (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                        {runDetail.results.map((r, i) => (
                                                            <InteractionResult key={i} result={r} />
                                                        ))}
                                                    </div>
                                                )}
                                                {!detailLoading && runDetail && !runDetail.results?.length && (
                                                    <span className="ccd-muted">This run recorded no interaction results.</span>
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default ContractRunHistory;
