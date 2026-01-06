// client/src/components/compliance/PoliciesPage.js
import React, { useEffect, useState } from 'react';
import { FiSave, FiShield, FiDownload } from 'react-icons/fi';
import { useWorkspaceOptions } from './useWorkspaceOptions';
import { downloadFromApi } from './download';

const PoliciesPage = () => {
    const { workspaces, defaultWorkspaceId, loading: workspacesLoading } = useWorkspaceOptions();
    const [workspaceId, setWorkspaceId] = useState('');

    const [policy, setPolicy] = useState(null);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchPolicy = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch(`/api/compliance/policy?workspaceId=${encodeURIComponent(workspaceId)}`, {
                credentials: 'include'
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || `Failed to fetch policy (${res.status})`);
            }
            const data = await res.json();
            setPolicy(data);
        } catch (e) {
            console.error('PoliciesPage fetch error:', e);
            setError(e.message || 'Failed to load policy');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!workspaceId) return;
        fetchPolicy();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspaceId]);

    useEffect(() => {
        if (workspaceId) return;
        if (!defaultWorkspaceId) return;
        setWorkspaceId(defaultWorkspaceId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [defaultWorkspaceId]);

    const savePolicy = async () => {
        try {
            setSaving(true);
            setError(null);

            // We update at top-level keys (retention, gdpr) under settings.compliance.
            const res = await fetch(`/api/compliance/policy?workspaceId=${encodeURIComponent(workspaceId)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    retention: policy?.retention,
                    gdpr: policy?.gdpr
                })
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || `Failed to save policy (${res.status})`);
            }

            const updated = await res.json();
            setPolicy(updated);
        } catch (e) {
            console.error('PoliciesPage save error:', e);
            setError(e.message || 'Failed to save policy');
        } finally {
            setSaving(false);
        }
    };

    const downloadEvidenceBundle = async () => {
        await downloadFromApi(
            `/api/compliance/reports/evidence-bundle?workspaceId=${encodeURIComponent(workspaceId)}`,
            `evidence_bundle_${Date.now()}.json`
        );
    };

    const setRetentionValue = (key, value) => {
        setPolicy((prev) => ({
            ...(prev || {}),
            retention: {
                ...(prev?.retention || {}),
                [key]: value
            }
        }));
    };

    const setGdprValue = (key, value) => {
        setPolicy((prev) => ({
            ...(prev || {}),
            gdpr: {
                ...(prev?.gdpr || {}),
                [key]: value
            }
        }));
    };

    return (
        <div className="compliance-card">
            <div className="compliance-card-header">
                <div className="compliance-card-title">
                    <FiShield /> Policies
                </div>
                <div className="compliance-actions">
                    <button className="btn-secondary" onClick={downloadEvidenceBundle}>
                        <FiDownload /> Evidence Bundle
                    </button>
                    <button className="btn-primary" onClick={savePolicy} disabled={saving || loading || !policy}>
                        <FiSave /> {saving ? 'Saving…' : 'Save'}
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

            {loading || !policy ? (
                <div className="compliance-empty">Loading policy…</div>
            ) : (
                <div className="compliance-grid">
                    <div className="compliance-subcard">
                        <h3>Retention</h3>
                        <p className="muted">Controls how long compliance artifacts are retained. Audit events use per-record expiry (TTL) based on these values.</p>

                        <div className="form-grid">
                            <div className="field">
                                <label>Audit Log Days</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={policy.retention?.auditLogDays ?? ''}
                                    onChange={(e) => setRetentionValue('auditLogDays', parseInt(e.target.value, 10) || 0)}
                                />
                            </div>
                            <div className="field">
                                <label>Policy Violation Days</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={policy.retention?.policyViolationDays ?? ''}
                                    onChange={(e) => setRetentionValue('policyViolationDays', parseInt(e.target.value, 10) || 0)}
                                />
                            </div>
                            <div className="field">
                                <label>Access Review Days</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={policy.retention?.accessReviewDays ?? ''}
                                    onChange={(e) => setRetentionValue('accessReviewDays', parseInt(e.target.value, 10) || 0)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="compliance-subcard">
                        <h3>GDPR</h3>
                        <p className="muted">Starter controls for GDPR workflows. (Exports + anonymization are available via the backend endpoints.)</p>

                        <div className="form-grid">
                            <div className="field">
                                <label>Enabled</label>
                                <select
                                    value={String(Boolean(policy.gdpr?.enabled))}
                                    onChange={(e) => setGdprValue('enabled', e.target.value === 'true')}
                                >
                                    <option value="true">Enabled</option>
                                    <option value="false">Disabled</option>
                                </select>
                            </div>

                            <div className="field">
                                <label>Default Processing Basis</label>
                                <select
                                    value={policy.gdpr?.processingBasisDefault || 'contract'}
                                    onChange={(e) => setGdprValue('processingBasisDefault', e.target.value)}
                                >
                                    <option value="contract">Contract</option>
                                    <option value="consent">Consent</option>
                                    <option value="legal_obligation">Legal obligation</option>
                                    <option value="legitimate_interest">Legitimate interest</option>
                                    <option value="vital_interest">Vital interest</option>
                                    <option value="public_task">Public task</option>
                                </select>
                            </div>
                        </div>

                        <div className="muted" style={{ marginTop: 10 }}>
                            Tip: GDPR exports are under <span className="mono">/api/compliance/gdpr/export</span>.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PoliciesPage;
