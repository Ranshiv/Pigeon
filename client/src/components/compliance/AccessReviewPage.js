// client/src/components/compliance/AccessReviewPage.js
import React, { useEffect, useState } from 'react';
import { FiDownload, FiLock, FiRefreshCw } from 'react-icons/fi';
import { useWorkspaceOptions } from './useWorkspaceOptions';
import { downloadFromApi } from './download';

const AccessReviewPage = () => {
    const { workspaces, defaultWorkspaceId, loading: workspacesLoading } = useWorkspaceOptions();
    const [workspaceId, setWorkspaceId] = useState('');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchSnapshot = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch(`/api/compliance/access-review?workspaceId=${encodeURIComponent(workspaceId)}`, {
                credentials: 'include'
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || `Failed to fetch access review (${res.status})`);
            }
            const payload = await res.json();
            setData(payload);
        } catch (e) {
            console.error('AccessReviewPage error:', e);
            setError(e.message || 'Failed to load access review');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!workspaceId) return;
        fetchSnapshot();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspaceId]);

    useEffect(() => {
        if (workspaceId) return;
        if (!defaultWorkspaceId) return;
        setWorkspaceId(defaultWorkspaceId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [defaultWorkspaceId]);

    const exportJson = async () => {
        await downloadFromApi(
            `/api/compliance/reports/access-review?workspaceId=${encodeURIComponent(workspaceId)}&format=json`,
            `access_review_${Date.now()}.json`
        );
    };

    return (
        <div className="compliance-card">
            <div className="compliance-card-header">
                <div className="compliance-card-title">
                    <FiLock /> Access Review
                </div>
                <div className="compliance-actions">
                    <button className="btn-secondary" onClick={exportJson}>
                        <FiDownload /> Export
                    </button>
                    <button className="btn-secondary" onClick={fetchSnapshot} disabled={loading}>
                        <FiRefreshCw /> Refresh
                    </button>
                </div>
            </div>

            <div className="compliance-filters">
                <div className="filter-row">
                    <div className="field">
                        <label>Workspace</label>
                        <select
                            value={workspaceId}
                            onChange={(e) => setWorkspaceId(e.target.value)}
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
                </div>
            </div>

            {error && <div className="compliance-error">{error}</div>}

            {loading || !data ? (
                <div className="compliance-empty">Loading access review…</div>
            ) : (
                <div className="compliance-grid">
                    <div className="compliance-subcard">
                        <h3>Workspace</h3>
                        {!data.found ? (
                            <div className="muted">Workspace not found.</div>
                        ) : (
                            <>
                                <div className="kv">
                                    <div className="k">Name</div>
                                    <div className="v">{data.workspace?.name || '—'}</div>

                                    <div className="k">Owner</div>
                                    <div className="v mono">{String(data.workspace?.owner ?? '—')}</div>

                                    <div className="k">Visibility</div>
                                    <div className="v">{data.workspace?.isPublic ? 'Public' : 'Private'}</div>
                                </div>

                                <h4 style={{ marginTop: 14 }}>Collaborators</h4>
                                <div className="compliance-table-wrap">
                                    <table className="compliance-table">
                                        <thead>
                                            <tr>
                                                <th>User</th>
                                                <th>Role</th>
                                                <th>Email</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(data.workspace?.collaborators || []).length === 0 ? (
                                                <tr><td colSpan={3} className="compliance-empty">No collaborators.</td></tr>
                                            ) : (
                                                (data.workspace?.collaborators || []).map((c, idx) => (
                                                    <tr key={`${c.userId || c.email || idx}`}
                                                    >
                                                        <td className="mono">{String(c.userId ?? '')}</td>
                                                        <td>{c.role || '—'}</td>
                                                        <td>{c.email || '—'}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="compliance-subcard">
                        <h3>Teams</h3>
                        <p className="muted">Teams linked to this workspace (if any).</p>
                        {(data.teams || []).length === 0 ? (
                            <div className="compliance-empty">No teams found.</div>
                        ) : (
                            <div className="stack">
                                {(data.teams || []).map((t) => (
                                    <div key={t.teamId} className="team-card">
                                        <div className="team-title">
                                            <span>{t.name}</span>
                                            <span className="muted mono">{t.teamId}</span>
                                        </div>
                                        <div className="muted">Owner: <span className="mono">{String(t.ownerId ?? '')}</span></div>
                                        <div className="muted">Members: {(t.members || []).length}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {(data.issues || []).length > 0 && (
                            <>
                                <h4 style={{ marginTop: 14 }}>Issues</h4>
                                <ul className="issues">
                                    {(data.issues || []).map((i, idx) => (
                                        <li key={idx}>
                                            <span className="mono">{i.type}</span> — {i.message}
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AccessReviewPage;
