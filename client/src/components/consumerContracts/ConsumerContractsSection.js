// client/src/components/consumerContracts/ConsumerContractsSection.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiAlertTriangle, FiFileText, FiPlay, FiPlus, FiRefreshCw, FiShield, FiUsers } from 'react-icons/fi';
import AppSelect from '../common/AppSelect/AppSelect';
import { useWorkspaceOptions } from '../compliance/useWorkspaceOptions';
import ContractEditor from './ContractEditor';
import ContractRunHistory from './ContractRunHistory';
import './consumerContracts.css';

const STATUS_FILTERS = [
    { value: 'all', label: 'Any status' },
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' },
    { value: 'deprecated', label: 'Deprecated' }
];

const RESULT_FILTERS = [
    { value: 'all', label: 'Any latest result' },
    { value: 'passed', label: 'Passing' },
    { value: 'failed', label: 'Failing' },
    { value: 'breaking', label: 'Breaking change' },
    { value: 'never', label: 'Never run' }
];

const formatDateTime = (value) => {
    if (!value) return 'Never';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Never' : date.toLocaleString();
};

const emptyContract = (workspaceId) => ({
    name: '',
    description: '',
    consumerName: '',
    workspaceId,
    providerCollectionId: '',
    environmentId: null,
    version: '1.0.0',
    status: 'draft',
    interactions: []
});

const ConsumerContractsSection = () => {
    const { workspaces, defaultWorkspaceId, loading: workspacesLoading } = useWorkspaceOptions();

    const [workspaceId, setWorkspaceId] = useState('');
    const [contracts, setContracts] = useState([]);
    const [collections, setCollections] = useState([]);
    const [environments, setEnvironments] = useState([]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [providerFilter, setProviderFilter] = useState('all');
    const [consumerFilter, setConsumerFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [resultFilter, setResultFilter] = useState('all');
    const [environmentFilter, setEnvironmentFilter] = useState('all');
    const [tagFilter, setTagFilter] = useState('all');

    const [selectedId, setSelectedId] = useState(null);
    const [draft, setDraft] = useState(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [runningId, setRunningId] = useState(null);
    const [runRefresh, setRunRefresh] = useState(0);

    useEffect(() => {
        if (!workspaceId && defaultWorkspaceId) setWorkspaceId(defaultWorkspaceId);
    }, [defaultWorkspaceId, workspaceId]);

    const loadAll = useCallback(async (signal) => {
        if (!workspaceId) return;
        try {
            setLoading(true);
            setError(null);

            const [contractsRes, collectionsRes, envsRes] = await Promise.all([
                fetch(`/api/consumer-contracts?workspaceId=${encodeURIComponent(workspaceId)}`, { credentials: 'include', signal }),
                fetch(`/api/collections?workspaceId=${encodeURIComponent(workspaceId)}`, { credentials: 'include', signal }),
                fetch(`/api/environments?workspaceId=${encodeURIComponent(workspaceId)}`, { credentials: 'include', signal })
            ]);

            if (!contractsRes.ok) throw new Error((await contractsRes.text()) || `Failed to load contracts (${contractsRes.status})`);

            const contractsData = await contractsRes.json();
            setContracts(contractsData.contracts || []);

            if (collectionsRes.ok) {
                const data = await collectionsRes.json();
                const all = Array.isArray(data) ? data : (data.collections || []);
                // /api/collections returns every collection the user owns; narrow
                // it to the selected workspace here.
                setCollections(all.filter((c) => String(c.workspaceId || '') === String(workspaceId)));
            }
            if (envsRes.ok) {
                const data = await envsRes.json();
                setEnvironments(Array.isArray(data) ? data : (data.environments || []));
            }
        } catch (e) {
            if (e.name === 'AbortError') return;
            setError(e.message || 'Failed to load consumer contracts');
            setContracts([]);
        } finally {
            setLoading(false);
        }
    }, [workspaceId]);

    useEffect(() => {
        const controller = new AbortController();
        loadAll(controller.signal);
        return () => controller.abort();
    }, [loadAll]);

    useEffect(() => {
        if (!draft || saving) return undefined;
        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                setDraft(null);
                setSaveError(null);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [draft, saving]);

    useEffect(() => {
        if (!draft) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previousOverflow; };
    }, [draft]);

    const consumerOptions = useMemo(() => {
        const names = [...new Set(contracts.map((c) => c.consumerName).filter(Boolean))];
        return [{ value: 'all', label: 'Any consumer' }, ...names.map((n) => ({ value: n, label: n }))];
    }, [contracts]);

    const tagOptions = useMemo(() => {
        const tags = new Set();
        contracts.forEach((c) => (c.interactions || []).forEach((i) => (i.tags || []).forEach((t) => tags.add(t))));
        return [{ value: 'all', label: 'Any tag' }, ...[...tags].map((t) => ({ value: t, label: t }))];
    }, [contracts]);

    const providerOptions = useMemo(() => [
        { value: 'all', label: 'Any provider collection' },
        ...collections.map((c) => ({ value: String(c._id), label: c.name }))
    ], [collections]);

    const environmentOptions = useMemo(() => [
        { value: 'all', label: 'Any environment' },
        { value: 'none', label: 'No environment' },
        ...environments.map((e) => ({ value: String(e._id), label: e.name }))
    ], [environments]);

    const filtered = useMemo(() => contracts.filter((c) => {
        if (providerFilter !== 'all' && String(c.providerCollectionId) !== providerFilter) return false;
        if (consumerFilter !== 'all' && c.consumerName !== consumerFilter) return false;
        if (statusFilter !== 'all' && c.status !== statusFilter) return false;

        if (environmentFilter === 'none' && c.environmentId) return false;
        if (environmentFilter !== 'all' && environmentFilter !== 'none'
            && String(c.environmentId || '') !== environmentFilter) return false;

        if (resultFilter === 'never' && c.lastRun?.result) return false;
        if (resultFilter === 'breaking' && !c.lastRun?.breaking) return false;
        if ((resultFilter === 'passed' || resultFilter === 'failed') && c.lastRun?.result !== resultFilter) return false;

        if (tagFilter !== 'all') {
            const hasTag = (c.interactions || []).some((i) => (i.tags || []).includes(tagFilter));
            if (!hasTag) return false;
        }
        return true;
    }), [contracts, providerFilter, consumerFilter, statusFilter, resultFilter, environmentFilter, tagFilter]);

    const summary = useMemo(() => ({
        total: contracts.length,
        active: contracts.filter((c) => c.status === 'active').length,
        failing: contracts.filter((c) => c.lastRun?.result === 'failed' || c.lastRun?.result === 'error').length,
        breaking: contracts.filter((c) => c.lastRun?.breaking).length
    }), [contracts]);

    const selected = useMemo(
        () => contracts.find((c) => String(c._id) === String(selectedId)) || null,
        [contracts, selectedId]
    );

    const saveDraft = async () => {
        if (!draft) return;
        try {
            setSaving(true);
            setSaveError(null);

            const isNew = !draft._id;
            const res = await fetch(
                isNew ? '/api/consumer-contracts' : `/api/consumer-contracts/${draft._id}`,
                {
                    method: isNew ? 'POST' : 'PUT',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...draft, workspaceId })
                }
            );
            if (!res.ok) {
                const text = await res.text();
                let message = text;
                try { message = JSON.parse(text).message || text; } catch { /* plain text */ }
                throw new Error(message || `Failed to save contract (${res.status})`);
            }

            const saved = await res.json();
            setDraft(null);
            setSelectedId(String(saved._id));
            await loadAll();
        } catch (e) {
            setSaveError(e.message || 'Failed to save contract');
        } finally {
            setSaving(false);
        }
    };

    const deleteContract = async (contract) => {
        // eslint-disable-next-line no-alert
        if (!window.confirm(`Delete "${contract.name}" and all of its run history? This cannot be undone.`)) return;
        try {
            const res = await fetch(`/api/consumer-contracts/${contract._id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (!res.ok) throw new Error((await res.text()) || 'Failed to delete contract');
            if (String(selectedId) === String(contract._id)) setSelectedId(null);
            await loadAll();
        } catch (e) {
            setError(e.message || 'Failed to delete contract');
        }
    };

    const runContract = async (contract) => {
        try {
            setRunningId(String(contract._id));
            setError(null);
            const res = await fetch(`/api/consumer-contracts/${contract._id}/run`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ environmentId: contract.environmentId || null })
            });
            if (!res.ok) {
                const text = await res.text();
                let message = text;
                try { message = JSON.parse(text).message || text; } catch { /* plain text */ }
                throw new Error(message || 'Contract run failed');
            }
            setSelectedId(String(contract._id));
            setRunRefresh((n) => n + 1);
            await loadAll();
        } catch (e) {
            setError(e.message || 'Contract run failed');
        } finally {
            setRunningId(null);
        }
    };

    const workspaceOptions = workspaces.map((w) => ({ value: w.id, label: w.label }));

    return (
        <div className="ccd-root">
            <header className="ccd-header">
                <div>
                    <span className="ccd-kicker"><FiShield /> Provider compatibility</span>
                    <h1 className="ccd-title">Consumer Contracts</h1>
                    <p className="ccd-subtitle">
                        Record what each consumer expects from a provider API, verify it against a live environment,
                        and catch breaking changes before they ship.
                    </p>
                </div>
                <div className="ccd-header-actions">
                    <button className="ccd-btn ccd-btn--ghost" onClick={() => loadAll()} disabled={loading}>
                        <FiRefreshCw className={loading ? 'ccd-spin' : undefined} /> Refresh
                    </button>
                    <button
                        className="ccd-btn ccd-btn--primary"
                        onClick={() => { setDraft(emptyContract(workspaceId)); setSaveError(null); }}
                        disabled={!workspaceId}
                    >
                        <FiPlus /> New contract
                    </button>
                </div>
            </header>

            {contracts.length > 0 && (
                <div className="ccd-summary">
                    <Tile icon={FiFileText} label="Contracts" value={summary.total} />
                    <Tile icon={FiUsers} label="Active" value={summary.active} />
                    <Tile label="Failing" value={summary.failing} tone={summary.failing > 0 ? 'warn' : undefined} />
                    <Tile
                        icon={FiAlertTriangle}
                        label="Breaking changes"
                        value={summary.breaking}
                        tone={summary.breaking > 0 ? 'warn' : undefined}
                    />
                </div>
            )}

            <div className="ccd-card">
                <div className="ccd-card-head">
                    <div className="ccd-card-title">
                        <FiFileText className="ccd-card-title-icon" />
                        Contracts
                    </div>
                    <span className="ccd-muted">
                        {loading ? 'Loading…' : `${filtered.length} of ${contracts.length} contract${contracts.length === 1 ? '' : 's'}`}
                    </span>
                </div>

                <div className="ccd-filters">
                    <div className="ccd-field">
                        <label>Workspace</label>
                        <AppSelect
                            value={workspaceId}
                            onChange={setWorkspaceId}
                            disabled={workspacesLoading}
                            options={workspaceOptions.length ? workspaceOptions : [{ value: '', label: 'No workspaces' }]}
                        />
                    </div>
                    <div className="ccd-field">
                        <label>Provider collection</label>
                        <AppSelect value={providerFilter} onChange={setProviderFilter} options={providerOptions} />
                    </div>
                    <div className="ccd-field">
                        <label>Consumer</label>
                        <AppSelect value={consumerFilter} onChange={setConsumerFilter} options={consumerOptions} />
                    </div>
                    <div className="ccd-field">
                        <label>Contract status</label>
                        <AppSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_FILTERS} />
                    </div>
                    <div className="ccd-field">
                        <label>Latest run result</label>
                        <AppSelect value={resultFilter} onChange={setResultFilter} options={RESULT_FILTERS} />
                    </div>
                    <div className="ccd-field">
                        <label>Environment</label>
                        <AppSelect value={environmentFilter} onChange={setEnvironmentFilter} options={environmentOptions} />
                    </div>
                    <div className="ccd-field">
                        <label>Tags</label>
                        <AppSelect
                            value={tagFilter}
                            onChange={setTagFilter}
                            disabled={tagOptions.length <= 1}
                            options={tagOptions}
                        />
                    </div>
                </div>

                {error && <div className="ccd-error">{error}</div>}

                {loading && contracts.length === 0 && <div className="ccd-loading">Loading consumer contracts…</div>}

                {!loading && !error && contracts.length === 0 && (
                    <div className="ccd-empty">
                        <strong>No consumer contracts yet.</strong>
                        <span>Create one to record what a consuming team depends on, then run it against an environment.</span>
                    </div>
                )}

                {!loading && contracts.length > 0 && filtered.length === 0 && (
                    <div className="ccd-empty">
                        <strong>No contracts match these filters.</strong>
                        <span>Widen the provider, consumer, status, result, environment or tag filter.</span>
                    </div>
                )}

                {filtered.length > 0 && (
                    <div className="ccd-table-wrap">
                        <table className="ccd-table">
                            <thead>
                                <tr>
                                    <th>Contract</th>
                                    <th>Consumer</th>
                                    <th>Provider</th>
                                    <th>Version</th>
                                    <th>Status</th>
                                    <th>Interactions</th>
                                    <th>Latest run</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((contract) => (
                                    <tr
                                        key={contract._id}
                                        className={`ccd-row${String(contract._id) === String(selectedId) ? ' ccd-row--active' : ''}`}
                                        onClick={() => setSelectedId(String(contract._id))}
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                setSelectedId(String(contract._id));
                                            }
                                        }}
                                    >
                                        <td>
                                            <span className="ccd-name">{contract.name}</span>
                                            {contract.description && <span className="ccd-sub">{contract.description}</span>}
                                        </td>
                                        <td>{contract.consumerName}</td>
                                        <td>{contract.providerCollectionName || '—'}</td>
                                        <td>{contract.version}</td>
                                        <td><span className={`ccd-badge ccd-badge--${contract.status}`}>{contract.status}</span></td>
                                        <td>{(contract.interactions || []).length}</td>
                                        <td>
                                            {contract.lastRun?.result
                                                ? (
                                                    <>
                                                        <span className={`ccd-badge ccd-badge--${contract.lastRun.result}`}>
                                                            {contract.lastRun.result}
                                                        </span>
                                                        {contract.lastRun.breaking && (
                                                            <span className="ccd-badge ccd-badge--breaking">Breaking</span>
                                                        )}
                                                        <span className="ccd-sub">{formatDateTime(contract.lastRun.ranAt)}</span>
                                                    </>
                                                )
                                                : <span className="ccd-muted">Never run</span>}
                                        </td>
                                        <td onClick={(e) => e.stopPropagation()}>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <button
                                                    className="ccd-btn ccd-btn--ghost ccd-btn--sm"
                                                    onClick={() => runContract(contract)}
                                                    disabled={runningId === String(contract._id)}
                                                >
                                                    <FiPlay size={13} />
                                                    {runningId === String(contract._id) ? 'Running…' : 'Run'}
                                                </button>
                                                <button
                                                    className="ccd-btn ccd-btn--ghost ccd-btn--sm"
                                                    onClick={() => {
                                                        setDraft(JSON.parse(JSON.stringify(contract)));
                                                        setSaveError(null);
                                                    }}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    className="ccd-btn ccd-btn--danger ccd-btn--sm"
                                                    onClick={() => deleteContract(contract)}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {selected && <ContractRunHistory contractId={selected._id} refreshToken={runRefresh} />}

            {draft && createPortal(
                <div
                    className="ccd-editor-overlay"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget && !saving) {
                            setDraft(null);
                            setSaveError(null);
                        }
                    }}
                >
                    <section
                        className="ccd-editor-dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-label={draft._id ? 'Edit consumer contract' : 'Create consumer contract'}
                    >
                        <ContractEditor
                            contract={draft}
                            collections={collections}
                            environments={environments}
                            onChange={setDraft}
                            onSave={saveDraft}
                            onCancel={() => { setDraft(null); setSaveError(null); }}
                            saving={saving}
                            error={saveError}
                        />
                    </section>
                </div>,
                document.body
            )}
        </div>
    );
};

const Tile = ({ icon: Icon, label, value, tone }) => (
    <div className={`ccd-tile${tone ? ` ccd-tile--${tone}` : ''}`}>
        <span className="ccd-tile-label">
            {Icon && <Icon className="ccd-tile-icon" />}
            {label}
        </span>
        <span className="ccd-tile-value">{value}</span>
    </div>
);

export default ConsumerContractsSection;
