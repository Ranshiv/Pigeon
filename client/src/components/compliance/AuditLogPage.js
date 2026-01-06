// client/src/components/compliance/AuditLogPage.js
import React, { useEffect, useMemo, useState } from 'react';
import { FiDownload, FiFilter, FiRefreshCw, FiShield } from 'react-icons/fi';
import { useWorkspaceOptions } from './useWorkspaceOptions';
import { downloadFromApi } from './download';

function buildQuery(params) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v === undefined || v === null || v === '') return;
        qs.set(k, String(v));
    });
    return qs.toString();
}

const AuditLogPage = () => {
    const { workspaces, defaultWorkspaceId, loading: workspacesLoading } = useWorkspaceOptions();
    const [workspaceId, setWorkspaceId] = useState('');
    const [action, setAction] = useState('');
    const [actorId, setActorId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [page, setPage] = useState(1);
    const [limit] = useState(50);

    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const totalPages = useMemo(() => Math.max(Math.ceil((total || 0) / limit), 1), [total, limit]);

    // Initialize workspaceId once we know available workspaces.
    useEffect(() => {
        if (workspaceId) return;
        if (!defaultWorkspaceId) return;
        setWorkspaceId(defaultWorkspaceId);
        setPage(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [defaultWorkspaceId]);

    const fetchAuditEvents = async () => {
        try {
            setLoading(true);
            setError(null);

            const query = buildQuery({
                workspaceId,
                action,
                actorId,
                startDate,
                endDate,
                page,
                limit
            });

            const res = await fetch(`/api/compliance/audit-events?${query}`, { credentials: 'include' });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || `Failed to fetch audit events (${res.status})`);
            }
            const data = await res.json();

            setItems(data.items || []);
            setTotal(data.total || 0);
        } catch (e) {
            console.error('AuditLogPage error:', e);
            setError(e.message || 'Failed to load audit events');
            setItems([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!workspaceId) return;

        // Debounce to avoid spamming audit-log.view while typing.
        const t = setTimeout(() => {
            fetchAuditEvents();
        }, 450);

        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspaceId, action, actorId, startDate, endDate, page]);

    const exportAuditLog = async (format) => {
        const query = buildQuery({ workspaceId, action, actorId, startDate, endDate, format });
        const ext = format === 'csv' ? 'csv' : 'json';
        await downloadFromApi(
            `/api/compliance/reports/audit-log?${query}`,
            `audit_log_${Date.now()}.${ext}`
        );
    };

    return (
        <div className="compliance-card">
            <div className="compliance-card-header">
                <div className="compliance-card-title">
                    <FiShield /> Audit Log
                </div>
                <div className="compliance-actions">
                    <button className="btn-secondary" onClick={() => exportAuditLog('csv')}>
                        <FiDownload /> CSV
                    </button>
                    <button className="btn-secondary" onClick={() => exportAuditLog('json')}>
                        <FiDownload /> JSON
                    </button>
                </div>
            </div>

            <div className="compliance-filters">
                <div className="filter-row">
                    <div className="field">
                        <label>Workspace</label>
                        <select
                            value={workspaceId}
                            onChange={(e) => {
                                setWorkspaceId(e.target.value);
                                setPage(1);
                            }}
                            disabled={workspacesLoading || workspaces.length === 0}
                        >
                            {workspaces.length === 0 ? (
                                <option value="">No workspaces found</option>
                            ) : (
                                workspaces.map((w) => (
                                    <option key={w.id} value={w.id}>{w.label}</option>
                                ))
                            )}
                        </select>
                    </div>
                    <div className="field">
                        <label>Action</label>
                        <input
                            value={action}
                            onChange={(e) => {
                                setAction(e.target.value);
                                setPage(1);
                            }}
                            placeholder="e.g. workspace.update"
                        />
                    </div>
                    <div className="field">
                        <label>Actor Id</label>
                        <input
                            value={actorId}
                            onChange={(e) => {
                                setActorId(e.target.value);
                                setPage(1);
                            }}
                            placeholder="User ObjectId"
                        />
                    </div>
                    <div className="field">
                        <label>Start</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => {
                                setStartDate(e.target.value);
                                setPage(1);
                            }}
                        />
                    </div>
                    <div className="field">
                        <label>End</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => {
                                setEndDate(e.target.value);
                                setPage(1);
                            }}
                        />
                    </div>
                </div>

                <div className="filter-actions">
                    <div className="muted">
                        <FiFilter /> Filters apply automatically.
                    </div>
                    <button className="btn-secondary" onClick={() => fetchAuditEvents()} disabled={loading}>
                        <FiRefreshCw /> Refresh
                    </button>
                </div>
            </div>

            {error && <div className="compliance-error">{error}</div>}

            <div className="compliance-table-wrap">
                <table className="compliance-table">
                    <thead>
                        <tr>
                            <th style={{ width: 170 }}>Time</th>
                            <th style={{ width: 260 }}>Action</th>
                            <th style={{ width: 220 }}>Target</th>
                            <th style={{ width: 240 }}>Actor</th>
                            <th>Metadata</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="compliance-empty">Loading…</td>
                            </tr>
                        ) : items.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="compliance-empty">No audit events found.</td>
                            </tr>
                        ) : (
                            items.map((e) => (
                                <tr key={e._id}>
                                    <td className="mono">{new Date(e.createdAt).toLocaleString()}</td>
                                    <td className="mono">{e.action}</td>
                                    <td className="mono">{e.targetType}:{String(e.targetId ?? '')}</td>
                                    <td className="mono">{String(e.actorId ?? '')}</td>
                                    <td className="metadata-cell">
                                        <pre className="metadata">{JSON.stringify(e.metadata || {}, null, 2)}</pre>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="compliance-pagination">
                <div className="muted">Showing page {page} of {totalPages} · {total} total</div>
                <div className="pager">
                    <button
                        className="btn-secondary"
                        onClick={() => setPage((p) => Math.max(p - 1, 1))}
                        disabled={page <= 1 || loading}
                    >
                        Prev
                    </button>
                    <button
                        className="btn-secondary"
                        onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                        disabled={page >= totalPages || loading}
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AuditLogPage;
