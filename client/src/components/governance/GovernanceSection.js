// client/src/components/governance/GovernanceSection.js
import React, { useEffect, useMemo, useState } from 'react';
import { FiActivity, FiAward, FiRefreshCw, FiShield, FiX } from 'react-icons/fi';
import AppSelect from '../common/AppSelect/AppSelect';
import { useWorkspaceOptions } from '../compliance/useWorkspaceOptions';
import GovernanceScorePanel from './GovernanceScorePanel';
import './governance.css';

const SCORE_RANGES = [
    { value: 'all', label: 'Any score', test: () => true },
    { value: 'good', label: 'Good (80-100)', test: (s) => s >= 80 },
    { value: 'fair', label: 'Fair (50-79)', test: (s) => s >= 50 && s < 80 },
    { value: 'poor', label: 'Needs work (0-49)', test: (s) => s < 50 }
];

const MONITORING_OPTIONS = [
    { value: 'all', label: 'Any monitoring status' },
    { value: 'up', label: 'Healthy' },
    { value: 'degraded', label: 'Degraded' },
    { value: 'down', label: 'Down' },
    { value: 'paused', label: 'Paused' },
    { value: 'none', label: 'Not monitored' }
];

const MONITORING_LABELS = {
    up: 'Healthy',
    degraded: 'Degraded',
    down: 'Down',
    paused: 'Paused',
    none: 'Not monitored'
};

const formatDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const getGovernanceMetrics = (item) => {
    const metrics = item?.metrics || {};
    const requestCount = Number(metrics.requestCount ?? metrics.operationCount ?? metrics.channelCount ?? metrics.messageCount ?? 0);
    return {
        requestCount,
        documentedPercent: Number(metrics.documentedPercent ?? metrics.operationDocumentationPercent ?? metrics.channelDocumentationPercent ?? 0),
        authCoveragePercent: Number(metrics.authCoveragePercent ?? metrics.messageSchemaPercent ?? 0),
        variableUsagePercent: Number(metrics.variableUsagePercent ?? (metrics.usesEnvVariables ? 100 : 0)),
        monitoringStatus: metrics.monitoringStatus || (metrics.hasRuns ? 'up' : 'none'),
        lastUpdated: metrics.lastUpdated || item?.updatedAt || item?.createdAt
    };
};

const GovernanceSection = () => {
    const { workspaces, loading: workspacesLoading } = useWorkspaceOptions();

    const [workspaceId, setWorkspaceId] = useState('all');
    const [scoreRange, setScoreRange] = useState('all');
    const [monitoringStatus, setMonitoringStatus] = useState('all');
    const [ownerId, setOwnerId] = useState('all');

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedId, setSelectedId] = useState(null);

    const fetchScorecard = async (signal) => {
        try {
            setLoading(true);
            setError(null);

            const query = workspaceId && workspaceId !== 'all' ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
            const res = await fetch(`/api/governance/scorecard${query}`, { credentials: 'include', signal });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || `Failed to load governance data (${res.status})`);
            }
            setData(await res.json());
        } catch (e) {
            if (e.name === 'AbortError') return;
            console.error('GovernanceSection error:', e);
            setError(e.message || 'Failed to load governance data');
            setData(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        fetchScorecard(controller.signal);
        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspaceId]);

    const items = useMemo(() => (Array.isArray(data?.items) ? data.items : []), [data]);

    const ownerOptions = useMemo(() => {
        const seen = new Map();
        items.forEach((i) => {
            if (i.ownerId && !seen.has(i.ownerId)) seen.set(i.ownerId, i.ownerName);
        });
        return [
            { value: 'all', label: 'Any owner' },
            ...[...seen.entries()].map(([value, label]) => ({ value, label }))
        ];
    }, [items]);

    const filtered = useMemo(() => {
        const range = SCORE_RANGES.find((r) => r.value === scoreRange) || SCORE_RANGES[0];
        return items.filter((i) => {
            if (!range.test(i.score)) return false;
            if (monitoringStatus !== 'all' && getGovernanceMetrics(i).monitoringStatus !== monitoringStatus) return false;
            if (ownerId !== 'all' && i.ownerId !== ownerId) return false;
            return true;
        });
    }, [items, scoreRange, monitoringStatus, ownerId]);

    const selected = useMemo(
        () => filtered.find((i) => i.collectionId === selectedId) || null,
        [filtered, selectedId]
    );

    useEffect(() => {
        if (!selected) return undefined;

        const onKeyDown = (event) => {
            if (event.key === 'Escape') setSelectedId(null);
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [selected]);

    const summary = data?.summary;
    const hasAnyData = items.length > 0;

    const workspaceOptions = [
        { value: 'all', label: 'All workspaces' },
        ...workspaces.map((w) => ({ value: w.id, label: w.label }))
    ];

    return (
        <div className="gov-root">
            <header className="gov-header">
                <div className="gov-header-text">
                    <span className="gov-kicker"><FiShield /> API intelligence</span>
                    <h1 className="gov-title">Governance</h1>
                    <p className="gov-subtitle">
                        API inventory and governance scorecard across documentation, security, monitoring and compliance signals.
                    </p>
                </div>
                <button className="gov-btn gov-btn--ghost" onClick={() => fetchScorecard()} disabled={loading}>
                    <FiRefreshCw className={loading ? 'gov-spin' : undefined} /> Refresh
                </button>
            </header>

            {hasAnyData && summary && (
                <div className="gov-summary">
                    <SummaryTile icon={FiAward} label="Average score" value={`${summary.averageScore}`} suffix="/100" />
                    <SummaryTile icon={FiShield} label="APIs tracked" value={summary.totalApis} />
                    <SummaryTile icon={FiActivity} label="Monitored" value={`${summary.monitoredApis}/${summary.totalApis}`} />
                    <SummaryTile label="Endpoints documented" value={`${summary.documentedPercent}%`} />
                    <SummaryTile label="Below 50" value={summary.atRisk} tone={summary.atRisk > 0 ? 'warn' : undefined} />
                </div>
            )}

            <div className="gov-card">
                <div className="gov-card-head gov-card-head--inventory">
                    <div>
                        <div className="gov-card-title">
                            <FiShield className="gov-card-title-icon" />
                            API Inventory
                        </div>
                        <span className="gov-card-caption">Compare readiness across your accessible collections.</span>
                    </div>
                    <span className="gov-muted">
                        {loading ? 'Loading…' : `${filtered.length} of ${items.length} API${items.length === 1 ? '' : 's'}`}
                    </span>
                </div>

                <div className="gov-filters">
                    <div className="gov-filter-row">
                        <div className="gov-field">
                            <label id="gov-ws-label">Workspace</label>
                            <AppSelect
                                value={workspaceId}
                                onChange={setWorkspaceId}
                                disabled={workspacesLoading}
                                options={workspaceOptions}
                            />
                        </div>
                        <div className="gov-field">
                            <label>Score range</label>
                            <AppSelect
                                value={scoreRange}
                                onChange={setScoreRange}
                                options={SCORE_RANGES.map(({ value, label }) => ({ value, label }))}
                            />
                        </div>
                        <div className="gov-field">
                            <label>Monitoring</label>
                            <AppSelect value={monitoringStatus} onChange={setMonitoringStatus} options={MONITORING_OPTIONS} />
                        </div>
                        <div className="gov-field">
                            <label>Ownership</label>
                            <AppSelect
                                value={ownerId}
                                onChange={setOwnerId}
                                disabled={ownerOptions.length <= 1}
                                options={ownerOptions}
                            />
                        </div>
                    </div>
                </div>

                {error && <div className="gov-error">{error}</div>}

                {!loading && !error && items.length === 0 && (
                    <div className="gov-empty">
                        <strong>No APIs to score yet.</strong>
                        <span>Create or import a collection, then return here to see its governance scorecard.</span>
                    </div>
                )}

                {!loading && !error && items.length > 0 && filtered.length === 0 && (
                    <div className="gov-empty">
                        <strong>No APIs match these filters.</strong>
                        <span>Widen the score range, monitoring status, or ownership filter.</span>
                    </div>
                )}

                {filtered.length > 0 && (
                    <div className="gov-table-wrap">
                        <table className="gov-table">
                            <thead>
                                <tr>
                                    <th>API</th>
                                    <th>Workspace</th>
                                    <th className="gov-num">Requests</th>
                                    <th className="gov-num">Documented</th>
                                    <th className="gov-num">Auth coverage</th>
                                    <th className="gov-num">Env vars</th>
                                    <th>Monitoring</th>
                                    <th>Last updated</th>
                                    <th className="gov-num">Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((item) => {
                                    const metrics = getGovernanceMetrics(item);
                                    return (
                                    <tr
                                        key={item.collectionId}
                                        className={`gov-row${item.collectionId === selectedId ? ' gov-row--active' : ''}`}
                                        onClick={() => setSelectedId(item.collectionId)}
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                setSelectedId(item.collectionId);
                                            }
                                        }}
                                    >
                                        <td>
                                            <span className="gov-api-name">{item.name}</span>
                                            <span className="gov-api-owner">{item.ownerName}</span>
                                        </td>
                                        <td>{item.workspaceName}</td>
                                        <td className="gov-num">{metrics.requestCount}</td>
                                        <td className="gov-num">{metrics.requestCount === 0 ? '—' : `${metrics.documentedPercent}%`}</td>
                                        <td className="gov-num">{metrics.requestCount === 0 ? '—' : `${metrics.authCoveragePercent}%`}</td>
                                        <td className="gov-num">{metrics.requestCount === 0 ? '—' : `${metrics.variableUsagePercent}%`}</td>
                                        <td>
                                            <span className={`gov-status gov-status--${metrics.monitoringStatus}`}>
                                                {MONITORING_LABELS[metrics.monitoringStatus] || 'Not monitored'}
                                            </span>
                                        </td>
                                        <td>{formatDate(metrics.lastUpdated)}</td>
                                        <td className="gov-num">
                                            <span className={`gov-score gov-score--${item.grade}`}>{item.score}</span>
                                        </td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {selected && (
                <div
                    className="gov-analysis-overlay"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) setSelectedId(null);
                    }}
                >
                    <section
                        className="gov-analysis-dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="gov-analysis-title"
                    >
                        <div className="gov-card-head gov-card-head--analysis">
                            <div>
                                <span className="gov-analysis-eyebrow">Selected API analysis</span>
                                <div className="gov-card-title" id="gov-analysis-title">
                                    <FiAward className="gov-card-title-icon" />
                                    {selected.name} — score breakdown
                                </div>
                            </div>
                            <button
                                className="gov-btn gov-btn--ghost"
                                onClick={() => setSelectedId(null)}
                                aria-label="Close score breakdown"
                            >
                                <FiX /> Close
                            </button>
                        </div>
                        <GovernanceScorePanel
                            item={selected}
                            weights={data?.weights || {}}
                            categoryLabels={data?.categoryLabels || {}}
                        />
                    </section>
                </div>
            )}
        </div>
    );
};

const SummaryTile = ({ icon: Icon, label, value, suffix, tone }) => (
    <div className={`gov-tile${tone ? ` gov-tile--${tone}` : ''}`}>
        <span className="gov-tile-label">
            {Icon && <Icon className="gov-tile-icon" />}
            {label}
        </span>
        <span className="gov-tile-value">
            {value}
            {suffix && <span className="gov-tile-suffix">{suffix}</span>}
        </span>
    </div>
);

export default GovernanceSection;
