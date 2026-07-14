import React, { useEffect, useMemo, useRef, useState } from 'react';
import './PerformanceTestsPage.css';
import { FiActivity, FiBarChart2, FiPlay, FiPlus, FiRefreshCw, FiSave, FiTrash2 } from 'react-icons/fi';

import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const readCssVar = (name, fallback = '') => {
    if (typeof window === 'undefined' || !window.getComputedStyle) return fallback;
    const v = window.getComputedStyle(document.body).getPropertyValue(name);
    const trimmed = (v || '').trim();
    return trimmed || fallback;
};

const colorWithAlpha = (color, alpha) => {
    if (!color) return color;
    const c = String(color).trim();

    // #RGB / #RRGGBB
    if (c.startsWith('#')) {
        const hex = c.slice(1);
        const normalized = hex.length === 3
            ? hex.split('').map(ch => ch + ch).join('')
            : hex;

        if (normalized.length === 6) {
            const r = parseInt(normalized.slice(0, 2), 16);
            const g = parseInt(normalized.slice(2, 4), 16);
            const b = parseInt(normalized.slice(4, 6), 16);
            if ([r, g, b].every(Number.isFinite)) return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        return c;
    }

    const rgb = c.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
    if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;

    // If it's already rgba(...) or a named color, just return it.
    return c;
};

const apiFetch = async (path, options = {}) => {
    const res = await fetch(path, {
        credentials: 'include',
        ...options
    });

    if (!res.ok) {
        let message = `Request failed (${res.status})`;
        try {
            const data = await res.json();
            if (data?.message) message = data.message;
        } catch {
            // ignore
        }
        const err = new Error(message);
        err.status = res.status;
        throw err;
    }

    // Some endpoints may return 204 in the future
    if (res.status === 204) return null;
    return res.json();
};

const toNumberOrNull = (v) => {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

const formatNumber = (n, digits = 2) => {
    if (n === null || n === undefined) return '—';
    if (typeof n !== 'number') return String(n);
    return n.toFixed(digits);
};

const formatPct = (n, digits = 2) => {
    if (n === null || n === undefined) return '—';
    return `${(n * 100).toFixed(digits)}%`;
};

const formatDelta = (d, digits = 2, suffix = '') => {
    if (!d || typeof d !== 'object') return '—';
    const abs = typeof d.abs === 'number' ? d.abs : null;
    const pct = typeof d.pct === 'number' ? d.pct : null;
    if (abs === null) return '—';

    const absStr = `${abs >= 0 ? '+' : ''}${abs.toFixed(digits)}${suffix}`;
    const pctStr = pct === null ? '' : ` (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)`;
    return absStr + pctStr;
};

const getDownloadFileName = (res, fallback) => {
    const cd = res.headers.get('content-disposition') || '';
    const m = cd.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
    const name = decodeURIComponent((m && (m[1] || m[2])) || '');
    return name || fallback;
};

const downloadFromResponse = async (res, fallbackName) => {
    const blob = await res.blob();
    const name = getDownloadFileName(res, fallbackName);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
};

const formatBytes = (bytes) => {
    if (bytes === null || bytes === undefined) return '—';
    if (typeof bytes !== 'number') return String(bytes);
    const units = ['B', 'KB', 'MB', 'GB'];
    let v = bytes;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
        v /= 1024;
        i += 1;
    }
    return `${v.toFixed(2)} ${units[i]}`;
};

const defaultForm = () => ({
    name: 'New Load Test',
    description: '',
    targetUrl: 'http://localhost:5001/api/health',
    method: 'GET',
    timeoutSeconds: 30,
    headersJson: '{\n  "Content-Type": "application/json"\n}',
    body: '',
    phases: [{ durationSeconds: 10, connections: 10, pipelining: 1 }]
});

const PerformanceTestsPage = () => {
    const [tests, setTests] = useState([]);
    const [selectedTestId, setSelectedTestId] = useState(null);
    const [runs, setRuns] = useState([]);
    const [selectedRunId, setSelectedRunId] = useState(null);

    const [loadingTests, setLoadingTests] = useState(false);
    const [loadingRuns, setLoadingRuns] = useState(false);
    const [error, setError] = useState(null);

    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState(defaultForm);

    const [startingRun, setStartingRun] = useState(false);
    const [pollRunId, setPollRunId] = useState(null);

    // Benchmarking / comparison
    const [baselineRunId, setBaselineRunId] = useState('');
    const [comparison, setComparison] = useState(null);
    const [loadingComparison, setLoadingComparison] = useState(false);

    // Report exports
    const [exporting, setExporting] = useState(false);

    // Used to re-read CSS variables when the theme changes (e.g., body.dark-theme toggles)
    const [themeKey, setThemeKey] = useState(0);

    const pollTimerRef = useRef(null);

    useEffect(() => {
        if (typeof MutationObserver === 'undefined') return;
        const obs = new MutationObserver(() => setThemeKey(k => k + 1));
        obs.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
        return () => obs.disconnect();
    }, []);

    const chartTheme = useMemo(() => {
        return {
            themeKey,
            primary: readCssVar('--primary-color', '#014C75'),
            secondary: readCssVar('--secondary-color', '#6c757d'),
            success: readCssVar('--success-color', '#28a745'),
            warning: readCssVar('--warning-color', '#ffc107'),
            danger: readCssVar('--danger-color', '#dc3545'),
            textSecondary: readCssVar('--text-secondary', '#6c757d'),
            border: readCssVar('--border-color', '#e1e4e8')
        };
    }, [themeKey]);

    const selectedTest = useMemo(
        () => tests.find(t => t._id === selectedTestId) || null,
        [tests, selectedTestId]
    );

    const selectedRun = useMemo(
        () => runs.find(r => r._id === selectedRunId) || null,
        [runs, selectedRunId]
    );

    const completedRuns = useMemo(() => {
        return (runs || []).filter(r => r.status === 'completed' && r.metrics);
    }, [runs]);

    const refreshTests = async (opts = {}) => {
        const { selectFirst = false } = opts;
        setLoadingTests(true);
        setError(null);
        try {
            const data = await apiFetch('/api/performance-tests');
            setTests(Array.isArray(data) ? data : []);
            if (selectFirst && Array.isArray(data) && data.length > 0) {
                setSelectedTestId(data[0]._id);
            }
        } catch (e) {
            setError(e.message || 'Failed to load tests');
        } finally {
            setLoadingTests(false);
        }
    };

    const refreshRuns = async (testId) => {
        if (!testId) {
            setRuns([]);
            setSelectedRunId(null);
            return;
        }

        setLoadingRuns(true);
        setError(null);
        try {
            const data = await apiFetch(`/api/performance-tests/${testId}/runs`);
            const list = Array.isArray(data) ? data : [];
            setRuns(list);
            if (list.length > 0) {
                setSelectedRunId(prev => (prev ? prev : list[0]._id));
            } else {
                setSelectedRunId(null);
            }
        } catch (e) {
            setError(e.message || 'Failed to load runs');
        } finally {
            setLoadingRuns(false);
        }
    };

    useEffect(() => {
        refreshTests({ selectFirst: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        refreshRuns(selectedTestId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTestId]);

    // Reset comparison state when selection changes
    useEffect(() => {
        setComparison(null);
        // Keep baseline if still exists, otherwise clear.
        if (baselineRunId && !runs.some(r => r._id === baselineRunId)) {
            setBaselineRunId('');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedRunId, runs.length]);

    // Polling for an active run
    useEffect(() => {
        if (!pollRunId) return;

        if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
        }

        pollTimerRef.current = setInterval(async () => {
            try {
                const run = await apiFetch(`/api/performance-tests/runs/${pollRunId}`);
                setRuns(prev => {
                    const idx = prev.findIndex(r => r._id === run._id);
                    if (idx === -1) return [run, ...prev];
                    const copy = [...prev];
                    copy[idx] = run;
                    return copy;
                });
                setSelectedRunId(run._id);

                if (run.status === 'completed' || run.status === 'failed') {
                    setPollRunId(null);
                    // Refresh list to keep ordering accurate
                    if (selectedTestId) {
                        refreshRuns(selectedTestId);
                    }
                }
            } catch {
                // keep polling; transient errors happen during restarts
            }
        }, 1500);

        return () => {
            if (pollTimerRef.current) {
                clearInterval(pollTimerRef.current);
                pollTimerRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pollRunId]);

    const onCreateTest = async (e) => {
        e.preventDefault();
        setCreating(true);
        setError(null);

        try {
            let headers = {};
            if (form.headersJson && form.headersJson.trim()) {
                headers = JSON.parse(form.headersJson);
            }

            const payload = {
                name: form.name?.trim(),
                description: form.description || '',
                targetUrl: form.targetUrl?.trim(),
                method: form.method,
                timeoutSeconds: toNumberOrNull(form.timeoutSeconds) || 30,
                headers,
                body: form.body === '' ? undefined : form.body,
                phases: (form.phases || []).map(p => ({
                    durationSeconds: Number(p.durationSeconds),
                    connections: Number(p.connections),
                    pipelining: Number(p.pipelining ?? 1)
                }))
            };

            const created = await apiFetch('/api/performance-tests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            setTests(prev => [created, ...prev]);
            setSelectedTestId(created._id);
            setShowCreate(false);
            setForm(defaultForm());
        } catch (e2) {
            setError(e2.message || 'Failed to create test');
        } finally {
            setCreating(false);
        }
    };

    const onStartRun = async () => {
        if (!selectedTestId) return;
        setStartingRun(true);
        setError(null);

        try {
            const data = await apiFetch(`/api/performance-tests/${selectedTestId}/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const runId = data?.runId;
            if (!runId) throw new Error('Run did not return runId');

            // Optimistic insert
            const optimistic = {
                _id: runId,
                loadTestId: selectedTestId,
                status: data?.status || 'queued',
                createdAt: new Date().toISOString()
            };

            setRuns(prev => [optimistic, ...prev]);
            setSelectedRunId(runId);
            setPollRunId(runId);
        } catch (e) {
            setError(e.message || 'Failed to start run');
        } finally {
            setStartingRun(false);
        }
    };

    const onRemovePhase = (idx) => {
        setForm(prev => ({
            ...prev,
            phases: prev.phases.filter((_, i) => i !== idx)
        }));
    };

    const onAddPhase = () => {
        setForm(prev => ({
            ...prev,
            phases: [...prev.phases, { durationSeconds: 10, connections: 10, pipelining: 1 }]
        }));
    };

    const resourceSeries = useMemo(() => {
        const samples = selectedRun?.metrics?.resources || [];
        if (!Array.isArray(samples) || samples.length === 0) return null;

        const labels = samples.map(s => new Date(s.ts).toLocaleTimeString());
        const cpuUser = samples.map(s => s?.cpu?.userPct ?? null);
        const cpuSys = samples.map(s => s?.cpu?.systemPct ?? null);
        const elMean = samples.map(s => s?.eventLoopDelayMs?.mean ?? null);
        const rssMb = samples.map(s => (typeof s?.memory?.rss === 'number' ? s.memory.rss / (1024 * 1024) : null));

        return {
            labels,
            datasets: [
                {
                    label: 'CPU user %',
                    data: cpuUser,
                    borderColor: chartTheme.primary,
                    backgroundColor: colorWithAlpha(chartTheme.primary, 0.06),
                    tension: 0.3,
                    pointRadius: 0,
                    fill: false,
                    borderWidth: 3,
                    yAxisID: 'y'
                },
                {
                    label: 'CPU system %',
                    data: cpuSys,
                    borderColor: chartTheme.danger,
                    backgroundColor: colorWithAlpha(chartTheme.danger, 0.06),
                    tension: 0.3,
                    pointRadius: 0,
                    fill: false,
                    borderWidth: 3,
                    yAxisID: 'y'
                },
                {
                    label: 'Event loop mean (ms)',
                    data: elMean,
                    borderColor: chartTheme.success,
                    backgroundColor: colorWithAlpha(chartTheme.success, 0.10),
                    tension: 0.3,
                    pointRadius: 0,
                    fill: true,
                    borderWidth: 2,
                    yAxisID: 'y'
                },
                {
                    label: 'RSS (MB)',
                    data: rssMb,
                    borderColor: chartTheme.warning,
                    backgroundColor: colorWithAlpha(chartTheme.warning, 0.10),
                    tension: 0.3,
                    pointRadius: 0,
                    fill: true,
                    borderWidth: 2,
                    yAxisID: 'y1'
                }
            ]
        };
    }, [selectedRun, chartTheme]);

    const kpis = selectedRun?.analysis?.kpis || null;
    const insights = Array.isArray(selectedRun?.analysis?.insights) ? selectedRun.analysis.insights : [];

    const statusCodesRows = useMemo(() => {
        const map = selectedRun?.metrics?.http?.statusCodes;
        if (!map || typeof map !== 'object') return [];
        return Object.entries(map)
            .map(([code, count]) => ({ code, count: Number(count) }))
            .filter(r => Number.isFinite(r.count))
            .sort((a, b) => b.count - a.count)
            .slice(0, 20);
    }, [selectedRun]);

    const runComparison = async () => {
        if (!baselineRunId || !selectedRunId) return;
        if (baselineRunId === selectedRunId) return;

        setLoadingComparison(true);
        setError(null);
        try {
            const data = await apiFetch(`/api/performance-tests/runs/compare?baselineRunId=${encodeURIComponent(baselineRunId)}&candidateRunId=${encodeURIComponent(selectedRunId)}`);
            setComparison(data);
        } catch (e) {
            setComparison(null);
            setError(e.message || 'Failed to compare runs');
        } finally {
            setLoadingComparison(false);
        }
    };

    const exportReport = async (format) => {
        if (!selectedRunId) return;
        setExporting(true);
        setError(null);

        try {
            const res = await fetch(`/api/performance-tests/runs/${selectedRunId}/report?format=${encodeURIComponent(format)}`, {
                credentials: 'include'
            });
            if (!res.ok) {
                let message = `Export failed (${res.status})`;
                try {
                    const data = await res.json();
                    if (data?.message) message = data.message;
                } catch {
                    // ignore
                }
                throw new Error(message);
            }

            await downloadFromResponse(res, `performance-report-${selectedRunId.slice(0, 8)}.${format === 'html' ? 'html' : 'json'}`);
        } catch (e) {
            setError(e.message || 'Failed to export report');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="perf-tests-page">
            <div className="perf-tests-header">
                <div>
                    <h1><FiBarChart2 /> Performance Testing</h1>
                    <p>Create load tests, run them, and inspect latency, throughput, and resource impact.</p>
                </div>

                <div className="perf-tests-actions">
                    <button className="pt-btn" onClick={() => refreshTests({})} disabled={loadingTests}>
                        <FiRefreshCw /> Refresh
                    </button>
                    <button
                        className="pt-btn primary"
                        onClick={() => setShowCreate(v => !v)}
                    >
                        <FiPlus /> New Test
                    </button>
                </div>
            </div>

            {error && (
                <div className="pt-alert error">
                    {error}
                </div>
            )}

            <div className="perf-tests-grid">
                <div className="pt-panel">
                    <div className="pt-panel-title">
                        <FiActivity /> Tests
                    </div>

                    {loadingTests ? (
                        <div className="pt-muted">Loading tests…</div>
                    ) : tests.length === 0 ? (
                        <div className="pt-muted">No load tests yet. Click “New Test” to create one.</div>
                    ) : (
                        <div className="pt-list">
                            {tests.map(t => (
                                <button
                                    key={t._id}
                                    className={`pt-list-item ${t._id === selectedTestId ? 'active' : ''}`}
                                    onClick={() => setSelectedTestId(t._id)}
                                >
                                    <div className="pt-list-item-title">{t.name}</div>
                                    <div className="pt-list-item-sub">
                                        <span className="pill">{(t.method || 'GET').toUpperCase()}</span>
                                        <span className="mono truncate">{t.targetUrl}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="pt-panel">
                    <div className="pt-panel-title">
                        <FiPlay /> Runs
                    </div>

                    <div className="pt-run-actions">
                        <button
                            className="pt-btn primary"
                            onClick={onStartRun}
                            disabled={!selectedTestId || startingRun}
                        >
                            <FiPlay /> {startingRun ? 'Starting…' : 'Run Selected Test'}
                        </button>
                    </div>

                    {selectedTest && (
                        <div className="pt-selected-test">
                            <div className="pt-selected-test-title">{selectedTest.name}</div>
                            <div className="pt-selected-test-sub mono">
                                {selectedTest.method} {selectedTest.targetUrl}
                            </div>
                        </div>
                    )}

                    {loadingRuns ? (
                        <div className="pt-muted">Loading runs…</div>
                    ) : runs.length === 0 ? (
                        <div className="pt-muted">No runs yet for this test.</div>
                    ) : (
                        <div className="pt-runs">
                            {runs.map(r => (
                                <button
                                    key={r._id}
                                    className={`pt-run-row status-${r.status} ${r._id === selectedRunId ? 'active' : ''}`}
                                    onClick={() => setSelectedRunId(r._id)}
                                >
                                    <div className="pt-run-row-main">
                                        <span className={`status ${r.status}`}>{r.status}</span>
                                        <span className="mono">{r._id.slice(0, 8)}</span>
                                    </div>
                                    <div className="pt-run-row-sub">
                                        {r.startedAt ? `Started ${new Date(r.startedAt).toLocaleString()}` : `Created ${new Date(r.createdAt).toLocaleString()}`}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {selectedRun && (
                        <div className="pt-run-details">
                            <h3>Run details</h3>

                            <div className="pt-run-tools">
                                <div className="pt-compare">
                                    <div className="pt-compare-row">
                                        <label className="pt-compare-label">Compare to baseline</label>
                                        <select
                                            className="pt-compare-select"
                                            value={baselineRunId}
                                            onChange={(e) => setBaselineRunId(e.target.value)}
                                        >
                                            <option value="">Select a completed run…</option>
                                            {completedRuns
                                                .filter(r => r._id !== selectedRunId)
                                                .map(r => (
                                                    <option key={r._id} value={r._id}>
                                                        {r._id.slice(0, 8)} — {new Date(r.createdAt).toLocaleString()}
                                                    </option>
                                                ))}
                                        </select>

                                        <button
                                            className="pt-btn"
                                            onClick={runComparison}
                                            disabled={!baselineRunId || !selectedRunId || loadingComparison}
                                        >
                                            {loadingComparison ? 'Comparing…' : 'Compare'}
                                        </button>
                                    </div>

                                    {comparison?.comparison?.delta && (
                                        <div className="pt-compare-results">
                                            <div className="pt-compare-title">Delta (candidate − baseline)</div>
                                            <div className="pt-compare-grid">
                                                <div className="pt-compare-item">
                                                    <div className="label">Avg RPS</div>
                                                    <div className="value mono">{formatDelta(comparison.comparison.delta.avgRps, 1)}</div>
                                                </div>
                                                <div className="pt-compare-item">
                                                    <div className="label">P95 latency</div>
                                                    <div className="value mono">{formatDelta(comparison.comparison.delta.p95LatencyMs, 2, ' ms')}</div>
                                                </div>
                                                <div className="pt-compare-item">
                                                    <div className="label">P99 latency</div>
                                                    <div className="value mono">{formatDelta(comparison.comparison.delta.p99LatencyMs, 2, ' ms')}</div>
                                                </div>
                                                <div className="pt-compare-item">
                                                    <div className="label">Error rate</div>
                                                    <div className="value mono">{formatDelta(comparison.comparison.delta.errorRate, 4)}</div>
                                                </div>
                                                <div className="pt-compare-item">
                                                    <div className="label">Throughput avg</div>
                                                    <div className="value mono">{formatDelta(comparison.comparison.delta.throughputAvgBytes, 0, ' B/s')}</div>
                                                </div>
                                                <div className="pt-compare-item">
                                                    <div className="label">RSS max</div>
                                                    <div className="value mono">{formatDelta(comparison.comparison.delta.resources?.rssMaxMb, 2, ' MB')}</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-export">
                                    <div className="pt-export-title">Report</div>
                                    <div className="pt-export-actions">
                                        <button className="pt-btn" onClick={() => exportReport('json')} disabled={exporting}>
                                            Export JSON
                                        </button>
                                        <button className="pt-btn" onClick={() => exportReport('html')} disabled={exporting}>
                                            Export HTML
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-kpis">
                                <div className="pt-kpi">
                                    <div className="label">Avg RPS</div>
                                    <div className="value">{formatNumber(kpis?.avgRps, 1)}</div>
                                </div>
                                <div className="pt-kpi">
                                    <div className="label">P95 latency</div>
                                    <div className="value">{formatNumber(kpis?.p95LatencyMs, 2)} ms</div>
                                </div>
                                <div className="pt-kpi">
                                    <div className="label">P99 latency</div>
                                    <div className="value">{formatNumber(kpis?.p99LatencyMs, 2)} ms</div>
                                </div>
                                <div className="pt-kpi">
                                    <div className="label">Error rate</div>
                                    <div className="value">{formatPct(kpis?.errorRate, 2)}</div>
                                </div>
                                <div className="pt-kpi">
                                    <div className="label">Total req</div>
                                    <div className="value">{kpis?.totalRequests ?? '—'}</div>
                                </div>
                                <div className="pt-kpi">
                                    <div className="label">Throughput avg</div>
                                    <div className="value">{formatBytes(kpis?.throughputAvgBytes)}/s</div>
                                </div>
                            </div>

                            {selectedRun.status === 'running' || selectedRun.status === 'queued' ? (
                                <div className="pt-muted">This run is {selectedRun.status}. Live updates will appear automatically.</div>
                            ) : null}

                            {selectedRun.status === 'failed' && selectedRun.error ? (
                                <div className="pt-alert error">{selectedRun.error}</div>
                            ) : null}

                            <div className="pt-subsection">
                                <div className="pt-subsection-title">Bottleneck hints</div>
                                {insights.length === 0 ? (
                                    <div className="pt-muted">No strong bottleneck signals detected for this run.</div>
                                ) : (
                                    <ul className="pt-insights">
                                        {insights.map((i, idx) => (
                                            <li key={idx} className="pt-insight">
                                                <span className={`pill status-${i.severity || 'medium'}`}>{i.type}</span>
                                                <span>{i.message}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            <div className="pt-subsection">
                                <div className="pt-subsection-title">Status codes</div>
                                {statusCodesRows.length === 0 ? (
                                    <div className="pt-muted">No status code histogram available for this run (try running again with latest runner).</div>
                                ) : (
                                    <div className="pt-statuscodes">
                                        {statusCodesRows.map(r => (
                                            <div key={r.code} className="pt-statuscode-row">
                                                <span className="mono">{r.code}</span>
                                                <span className="mono">{r.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {resourceSeries && (
                                <div className="pt-chart">
                                    <Line
                                        data={resourceSeries}
                                        options={{
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            interaction: { mode: 'index', intersect: false },
                                            plugins: {
                                                legend: {
                                                    position: 'top',
                                                    labels: {
                                                        color: chartTheme.textSecondary
                                                    }
                                                },
                                                tooltip: {
                                                    backgroundColor: colorWithAlpha(chartTheme.border, 0.20),
                                                    borderColor: chartTheme.border,
                                                    borderWidth: 1,
                                                    titleColor: chartTheme.textSecondary,
                                                    bodyColor: chartTheme.textSecondary,
                                                    displayColors: true,
                                                    callbacks: {
                                                        label: (ctx) => {
                                                            const label = ctx.dataset?.label || '';
                                                            const v = ctx.parsed?.y;
                                                            if (v === null || v === undefined) return label;
                                                            if (label.includes('CPU')) return `${label}: ${Number(v).toFixed(1)}%`;
                                                            if (label.includes('Event loop')) return `${label}: ${Number(v).toFixed(2)} ms`;
                                                            if (label.includes('RSS')) return `${label}: ${Number(v).toFixed(2)} MB`;
                                                            return `${label}: ${Number(v).toFixed(2)}`;
                                                        }
                                                    }
                                                },
                                                title: { display: false }
                                            },
                                            scales: {
                                                x: {
                                                    ticks: { color: chartTheme.textSecondary },
                                                    grid: { color: chartTheme.border }
                                                },
                                                y: {
                                                    beginAtZero: true,
                                                    suggestedMax: 100,
                                                    ticks: { color: chartTheme.textSecondary },
                                                    grid: { color: chartTheme.border }
                                                },
                                                y1: {
                                                    beginAtZero: true,
                                                    position: 'right',
                                                    ticks: { color: chartTheme.textSecondary },
                                                    grid: {
                                                        drawOnChartArea: false,
                                                        color: chartTheme.border
                                                    }
                                                }
                                            }
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {showCreate && (
                <div className="pt-modal-overlay" onClick={() => setShowCreate(false)} style={{ zIndex: 100000 }}>
                    <div className="pt-modal" onClick={e => e.stopPropagation()}>
                        <div className="pt-modal-header">
                            <div className="pt-modal-title">
                                <FiSave /> Create load test
                            </div>
                            <button className="pt-modal-close" onClick={() => setShowCreate(false)}>×</button>
                        </div>
                        <div className="pt-modal-content">

                    <form className="pt-form" onSubmit={onCreateTest}>
                        <div className="pt-form-row">
                            <label>Name</label>
                            <input
                                value={form.name}
                                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="e.g., Healthcheck smoke load"
                                required
                            />
                        </div>

                        <div className="pt-form-row">
                            <label>Description</label>
                            <input
                                value={form.description}
                                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Optional"
                            />
                        </div>

                        <div className="pt-form-grid">
                            <div className="pt-form-row">
                                <label>Target URL</label>
                                <input
                                    value={form.targetUrl}
                                    onChange={(e) => setForm(prev => ({ ...prev, targetUrl: e.target.value }))}
                                    placeholder="https://api.example.com/v1/health"
                                    required
                                />
                            </div>

                            <div className="pt-form-row">
                                <label>Method</label>
                                <select
                                    value={form.method}
                                    onChange={(e) => setForm(prev => ({ ...prev, method: e.target.value }))}
                                >
                                    <option value="GET">GET</option>
                                    <option value="POST">POST</option>
                                    <option value="PUT">PUT</option>
                                    <option value="PATCH">PATCH</option>
                                    <option value="DELETE">DELETE</option>
                                </select>
                            </div>

                            <div className="pt-form-row">
                                <label>Timeout (seconds)</label>
                                <input
                                    type="number"
                                    min={1}
                                    value={form.timeoutSeconds}
                                    onChange={(e) => setForm(prev => ({ ...prev, timeoutSeconds: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="pt-form-row">
                            <label>Headers (JSON)</label>
                            <textarea
                                rows={6}
                                value={form.headersJson}
                                onChange={(e) => setForm(prev => ({ ...prev, headersJson: e.target.value }))}
                                placeholder='{"Authorization": "Bearer …"}'
                            />
                            <div className="pt-muted">Tip: leave empty for no headers.</div>
                        </div>

                        <div className="pt-form-row">
                            <label>Body</label>
                            <textarea
                                rows={4}
                                value={form.body}
                                onChange={(e) => setForm(prev => ({ ...prev, body: e.target.value }))}
                                placeholder="Optional (used for POST/PUT/PATCH)"
                            />
                        </div>

                        <div className="pt-form-row">
                            <label>Phases</label>
                            <div className="pt-phases">
                                {(form.phases || []).map((p, idx) => (
                                    <div key={idx} className="pt-phase">
                                        <div className="pt-phase-grid">
                                            <div>
                                                <div className="pt-phase-label">Duration (s)</div>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    value={p.durationSeconds}
                                                    onChange={(e) => {
                                                        const v = e.target.value;
                                                        setForm(prev => ({
                                                            ...prev,
                                                            phases: prev.phases.map((pp, i) => i === idx ? { ...pp, durationSeconds: v } : pp)
                                                        }));
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <div className="pt-phase-label">Connections</div>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    value={p.connections}
                                                    onChange={(e) => {
                                                        const v = e.target.value;
                                                        setForm(prev => ({
                                                            ...prev,
                                                            phases: prev.phases.map((pp, i) => i === idx ? { ...pp, connections: v } : pp)
                                                        }));
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <div className="pt-phase-label">Pipelining</div>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    value={p.pipelining}
                                                    onChange={(e) => {
                                                        const v = e.target.value;
                                                        setForm(prev => ({
                                                            ...prev,
                                                            phases: prev.phases.map((pp, i) => i === idx ? { ...pp, pipelining: v } : pp)
                                                        }));
                                                    }}
                                                />
                                            </div>
                                            <div className="pt-phase-actions">
                                                <button
                                                    type="button"
                                                    className="pt-btn danger"
                                                    onClick={() => onRemovePhase(idx)}
                                                    disabled={(form.phases || []).length <= 1}
                                                    title="Remove phase"
                                                >
                                                    <FiTrash2 />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                <button type="button" className="pt-btn" onClick={onAddPhase}>
                                    <FiPlus /> Add phase
                                </button>
                            </div>
                        </div>

                        <div className="pt-form-actions">
                            <button type="button" className="pt-btn" onClick={() => { setShowCreate(false); setForm(defaultForm()); }}>
                                Cancel
                            </button>
                            <button type="submit" className="pt-btn primary" disabled={creating}>
                                <FiSave /> {creating ? 'Saving…' : 'Create Test'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default PerformanceTestsPage;
