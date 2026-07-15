// client/src/components/compliance/PoliciesPage.js
import React, { useEffect, useState } from 'react';
import { FiSave, FiBookOpen, FiDownload } from 'react-icons/fi';
import { useWorkspaceOptions } from './useWorkspaceOptions';
import { downloadFromApi } from './download';
import AppSelect from '../common/AppSelect/AppSelect';

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
            retention: { ...(prev?.retention || {}), [key]: value }
        }));
    };

    const setGdprValue = (key, value) => {
        setPolicy((prev) => ({
            ...(prev || {}),
            gdpr: { ...(prev?.gdpr || {}), [key]: value }
        }));
    };

    return (
        <div className="cmp-card">
            <div className="cmp-card-head">
                <div className="cmp-card-title">
                    <FiBookOpen className="cmp-card-title-icon" />
                    Policies
                </div>
                <div className="cmp-actions">
                    <button className="cmp-btn cmp-btn--ghost" onClick={downloadEvidenceBundle}>
                        <FiDownload /> Evidence Bundle
                    </button>
                    <button className="cmp-btn cmp-btn--primary" onClick={savePolicy} disabled={saving || loading || !policy}>
                        <FiSave /> {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>

            <div className="cmp-filters">
                <div className="cmp-filter-row cmp-filter-row--single">
                    <div className="cmp-field">
                        <label>Workspace</label>
                        <AppSelect
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

            {loading || !policy ? (
                <div className="cmp-empty">Loading policy…</div>
            ) : (
                <div className="cmp-grid">
                    <div className="cmp-subcard">
                        <h3 className="cmp-subcard-title">Retention</h3>
                        <p className="cmp-muted">Controls how long compliance artifacts are retained. Audit events use per-record expiry (TTL) based on these values.</p>

                        <div className="cmp-form-grid">
                            <div className="cmp-field">
                                <label>Audit Log Days</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={policy.retention?.auditLogDays ?? ''}
                                    onChange={(e) => setRetentionValue('auditLogDays', parseInt(e.target.value, 10) || 0)}
                                />
                            </div>
                            <div className="cmp-field">
                                <label>Policy Violation Days</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={policy.retention?.policyViolationDays ?? ''}
                                    onChange={(e) => setRetentionValue('policyViolationDays', parseInt(e.target.value, 10) || 0)}
                                />
                            </div>
                            <div className="cmp-field">
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

                    <div className="cmp-subcard">
                        <h3 className="cmp-subcard-title">GDPR</h3>
                        <p className="cmp-muted">Starter controls for GDPR workflows. (Exports + anonymization are available via the backend endpoints.)</p>

                        <div className="cmp-form-grid">
                            <div className="cmp-field">
                                <label>Enabled</label>
                                <AppSelect
                                    value={String(Boolean(policy.gdpr?.enabled))}
                                    onChange={(v) => setGdprValue('enabled', v === 'true')}
                                    options={[
                                        { value: 'true', label: 'Enabled' },
                                        { value: 'false', label: 'Disabled' }
                                    ]}
                                />
                            </div>

                            <div className="cmp-field">
                                <label>Default Processing Basis</label>
                                <AppSelect
                                    value={policy.gdpr?.processingBasisDefault || 'contract'}
                                    onChange={(v) => setGdprValue('processingBasisDefault', v)}
                                    options={[
                                        { value: 'contract', label: 'Contract' },
                                        { value: 'consent', label: 'Consent' },
                                        { value: 'legal_obligation', label: 'Legal obligation' },
                                        { value: 'legitimate_interest', label: 'Legitimate interest' },
                                        { value: 'vital_interest', label: 'Vital interest' },
                                        { value: 'public_task', label: 'Public task' }
                                    ]}
                                />
                            </div>
                        </div>

                        <div className="cmp-muted cmp-tip">
                            Tip: GDPR exports are under <span className="cmp-mono">/api/compliance/gdpr/export</span>.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PoliciesPage;