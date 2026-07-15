// client/src/components/compliance/AuditLogPage.js
import React, { useEffect, useMemo, useState } from 'react';
import { FiDownload, FiFilter, FiRefreshCw, FiShield } from 'react-icons/fi';
import { useWorkspaceOptions } from './useWorkspaceOptions';
import { downloadFromApi } from './download';
import AppSelect from '../common/AppSelect/AppSelect';

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

            const query = buildQuery({ workspaceId, action, actorId, startDate, endDate, page, limit });
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
        const t = setTimeout(() => { fetchAuditEvents(); }, 450);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspaceId, action, actorId, startDate, endDate, page]);

    const exportAuditLog = async (format) => {
        const query = buildQuery({ workspaceId, action, actorId, startDate, endDate, format });
        const ext = format === 'csv' ? 'csv' : 'json';
        await downloadFromApi(`/api/compliance/reports/audit-log?${query}`, `audit_log_${Date.now()}.${ext}`);
    };

    return (
        <div className="cmp-card">
            <div className="cmp-card-head">
                <div className="cmp-card-title">
                    <FiShield className="cmp-card-title-icon" />
                    Audit Log
                </div>
                <div className="cmp-actions">
                    <button className="cmp-btn cmp-btn--ghost" onClick={() => exportAuditLog('csv')}>
                        <FiDownload /> CSV
                    </button>
                    <button className="cmp-btn cmp-btn--ghost" onClick={() => exportAuditLog('json')}>
                        <FiDownload /> JSON
                    </button>
                </div>
            </div>

            <div className="cmp-filters">
                <div className="cmp-filter-row">
                    <div className="cmp-field">
                        <label>Workspace</label>
                        <AppSelect
                            value={workspaceId}
                            onChange={(v) => { setWorkspaceId(v); setPage(1); }}
                            disabled={workspacesLoading || workspaces.length === 0}
                            options={workspaces.length === 0
                                ? [{ value: '', label: 'No workspaces found' }]
                                : workspaces.map((w) => ({ value: w.id, label: w.label }))}
                        />
                    </div>
                    <div className="cmp-field">
                        <label>Action</label>
                        <input
                            value={action}
                            onChange={(e) => { setAction(e.target.value); setPage(1); }}
                            placeholder="e.g. workspace.update"
                        />
                    </div>
                    <div className="cmp-field">
                        <label>Actor Id</label>
                        <input
                            value={actorId}
                            onChange={(e) => { setActorId(e.target.value); setPage(1); }}
                            placeholder="User ObjectId"
                        />
                    </div>
                    <div className="cmp-field">
                        <label>Start</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                        />
                    </div>
                    <div className="cmp-field">
                        <label>End</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                        />
                    </div>
                </div>

                <div className="cmp-filter-actions">
                    <div className="cmp-muted"><FiFilter /> Filters apply automatically.</div>
                    <button className="cmp-btn cmp-btn--ghost" onClick={() => fetchAuditEvents()} disabled={loading}>
                        <FiRefreshCw /> Refresh
                    </button>
                </div>
            </div>

            {error && <div className="cmp-error">{error}</div>}

            <div className="cmp-table-wrap">
                <table className="cmp-table">
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
                            <tr><td colSpan={5} className="cmp-empty">Loading…</td></tr>
                        ) : items.length === 0 ? (
                            <tr><td colSpan={5} className="cmp-empty">No audit events found.</td></tr>
                        ) : (
                            items.map((e) => (
                                <tr key={e._id}>
                                    <td className="cmp-mono">{new Date(e.createdAt).toLocaleString()}</td>
                                    <td className="cmp-mono">{e.action}</td>
                                    <td className="cmp-mono">{e.targetType}:{String(e.targetId ?? '')}</td>
                                    <td className="cmp-mono">{String(e.actorId ?? '')}</td>
                                    <td className="cmp-metadata-cell">
                                        <pre className="cmp-metadata">{JSON.stringify(e.metadata || {}, null, 2)}</pre>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="cmp-pagination">
                <div className="cmp-muted">Showing page {page} of {totalPages} · {total} total</div>
                <div className="cmp-pager">
                    <button
                        className="cmp-btn cmp-btn--ghost"
                        onClick={() => setPage((p) => Math.max(p - 1, 1))}
                        disabled={page <= 1 || loading}
                    >
                        Prev
                    </button>
                    <button
                        className="cmp-btn cmp-btn--ghost"
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