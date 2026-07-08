// client/src/components/compliance/AccessReviewPage.js
import React, { useEffect, useState } from 'react';
import { FiDownload, FiLock, FiRefreshCw } from 'react-icons/fi';
import { useWorkspaceOptions } from './useWorkspaceOptions';
import { downloadFromApi } from './download';
import ThemedSelect from './ThemedSelect';

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
        <div className="cmp-card">
            <div className="cmp-card-head">
                <div className="cmp-card-title">
                    <FiLock className="cmp-card-title-icon" />
                    Access Review
                </div>
                <div className="cmp-actions">
                    <button className="cmp-btn cmp-btn--ghost" onClick={exportJson}>
                        <FiDownload /> Export
                    </button>
                    <button className="cmp-btn cmp-btn--ghost" onClick={fetchSnapshot} disabled={loading}>
                        <FiRefreshCw /> Refresh
                    </button>
                </div>
            </div>

            <div className="cmp-filters">
                <div className="cmp-filter-row cmp-filter-row--single">
                    <div className="cmp-field">
                        <label>Workspace</label>
                        <ThemedSelect
                            value={workspaceId}
                            onChange={setWorkspaceId}
                            disabled={workspacesLoading || workspaces.length === 0}
                            options={workspaces.length === 0
                                ? [{ value: '', label: 'No workspaces found' }]
                                : workspaces.map((w) => ({ value: w.id, label: w.label }))}
                        />
                    </div>
                </div>
            </div>

            {error && <div className="cmp-error">{error}</div>}

            {loading || !data ? (
                <div className="cmp-empty">Loading access review…</div>
            ) : (
                <div className="cmp-grid">
                    <div className="cmp-subcard">
                        <h3 className="cmp-subcard-title">Workspace</h3>
                        {!data.found ? (
                            <div className="cmp-empty cmp-empty--inline">Workspace not found.</div>
                        ) : (
                            <>
                                <div className="cmp-kv">
                                    <div className="cmp-k">Name</div>
                                    <div className="cmp-v">{data.workspace?.name || '—'}</div>

                                    <div className="cmp-k">Owner</div>
                                    <div className="cmp-v cmp-mono">{String(data.workspace?.owner ?? '—')}</div>

                                    <div className="cmp-k">Visibility</div>
                                    <div className="cmp-v">{data.workspace?.isPublic ? 'Public' : 'Private'}</div>
                                </div>

                                <h4 className="cmp-subsection-title">Collaborators</h4>
                                <div className="cmp-table-wrap">
                                    <table className="cmp-table">
                                        <thead>
                                            <tr>
                                                <th>User</th>
                                                <th>Role</th>
                                                <th>Email</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(data.workspace?.collaborators || []).length === 0 ? (
                                                <tr><td colSpan={3} className="cmp-empty">No collaborators.</td></tr>
                                            ) : (
                                                (data.workspace?.collaborators || []).map((c, idx) => (
                                                    <tr key={`${c.userId || c.email || idx}`}>
                                                        <td className="cmp-mono">{String(c.userId ?? '')}</td>
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

                    <div className="cmp-subcard">
                        <h3 className="cmp-subcard-title">Teams</h3>
                        <p className="cmp-muted">Teams linked to this workspace (if any).</p>
                        {(data.teams || []).length === 0 ? (
                            <div className="cmp-empty cmp-empty--inline">No teams found.</div>
                        ) : (
                            <div className="cmp-stack">
                                {(data.teams || []).map((t) => (
                                    <div key={t.teamId} className="cmp-team-card">
                                        <div className="cmp-team-title">
                                            <span>{t.name}</span>
                                            <span className="cmp-muted cmp-mono">{t.teamId}</span>
                                        </div>
                                        <div className="cmp-muted">Owner: <span className="cmp-mono">{String(t.ownerId ?? '')}</span></div>
                                        <div className="cmp-muted">Members: {(t.members || []).length}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {(data.issues || []).length > 0 && (
                            <>
                                <h4 className="cmp-subsection-title">Issues</h4>
                                <ul className="cmp-issues">
                                    {(data.issues || []).map((i, idx) => (
                                        <li key={idx}>
                                            <span className="cmp-mono">{i.type}</span> — {i.message}
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