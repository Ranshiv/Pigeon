// client/src/components/consumerContracts/ContractEditor.js
import React, { useMemo, useState } from 'react';
import { FiCheckCircle, FiDownloadCloud, FiPlus, FiTrash2, FiX } from 'react-icons/fi';
import AppSelect from '../common/AppSelect/AppSelect';

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD']
    .map((m) => ({ value: m, label: m }));

const BODY_TYPES = [
    { value: 'none', label: 'No body' },
    { value: 'json', label: 'JSON' },
    { value: 'raw', label: 'Raw text' },
    { value: 'x-www-form-urlencoded', label: 'Form URL encoded' }
];

const FIELD_TYPES = ['any', 'string', 'number', 'boolean', 'object', 'array', 'null']
    .map((t) => ({ value: t, label: t === 'any' ? 'Any type' : t }));

const STATUS_OPTIONS = [
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' },
    { value: 'deprecated', label: 'Deprecated' }
];

const blankInteraction = () => ({
    name: 'New interaction',
    description: '',
    method: 'GET',
    url: '',
    headers: [],
    queryParams: [],
    body: '',
    bodyType: 'none',
    expectedStatus: 200,
    expectedHeaders: [],
    expectedBody: '',
    expectedFields: [],
    maxResponseTimeMs: null,
    tags: [],
    sourceRequestId: null
});

const KvRows = ({ rows, onChange, addLabel, keyPlaceholder, valuePlaceholder }) => (
    <>
        {rows.map((row, index) => (
            <div className="ccd-kv-row" key={index}>
                <input
                    className="ccd-input ccd-input--sm"
                    value={row.key || ''}
                    placeholder={keyPlaceholder}
                    aria-label={keyPlaceholder}
                    onChange={(e) => onChange(rows.map((r, i) => (i === index ? { ...r, key: e.target.value } : r)))}
                />
                <input
                    className="ccd-input ccd-input--sm"
                    value={row.value || ''}
                    placeholder={valuePlaceholder}
                    aria-label={valuePlaceholder}
                    onChange={(e) => onChange(rows.map((r, i) => (i === index ? { ...r, value: e.target.value } : r)))}
                />
                <button
                    type="button"
                    className="ccd-icon-btn"
                    aria-label={`Remove ${row.key || 'row'}`}
                    onClick={() => onChange(rows.filter((_, i) => i !== index))}
                >
                    <FiTrash2 size={14} />
                </button>
            </div>
        ))}
        <button
            type="button"
            className="ccd-btn ccd-btn--ghost ccd-btn--sm"
            onClick={() => onChange([...rows, { key: '', value: '', enabled: true }])}
        >
            <FiPlus size={14} /> {addLabel}
        </button>
    </>
);

const ContractEditor = ({
    contract,
    collections,
    environments,
    onChange,
    onSave,
    onCancel,
    saving,
    error
}) => {
    const [selectedIndex, setSelectedIndex] = useState(contract.interactions?.length ? 0 : -1);
    const [seedRequestId, setSeedRequestId] = useState('');
    const [seedError, setSeedError] = useState(null);
    const [seeding, setSeeding] = useState(false);

    const interactions = contract.interactions || [];
    const interaction = selectedIndex >= 0 ? interactions[selectedIndex] : null;

    const providerCollection = useMemo(
        () => collections.find((c) => String(c._id) === String(contract.providerCollectionId)) || null,
        [collections, contract.providerCollectionId]
    );

    const requestOptions = useMemo(() => [
        { value: '', label: providerCollection ? 'Choose a saved request…' : 'Select a provider collection first' },
        ...((providerCollection?.requests || []).map((r) => ({
            value: String(r._id),
            label: `${r.method} ${r.name}`
        })))
    ], [providerCollection]);

    const setInteraction = (patch) => {
        onChange({
            ...contract,
            interactions: interactions.map((it, i) => (i === selectedIndex ? { ...it, ...patch } : it))
        });
    };

    const addInteraction = () => {
        onChange({ ...contract, interactions: [...interactions, blankInteraction()] });
        setSelectedIndex(interactions.length);
    };

    const removeInteraction = (index) => {
        onChange({ ...contract, interactions: interactions.filter((_, i) => i !== index) });
        setSelectedIndex((current) => (current >= index ? Math.max(-1, current - 1) : current));
    };

    const generateFromRequest = async () => {
        if (!seedRequestId || !contract.providerCollectionId) return;
        try {
            setSeeding(true);
            setSeedError(null);
            const res = await fetch('/api/consumer-contracts/interactions/from-request', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    collectionId: contract.providerCollectionId,
                    requestId: seedRequestId
                })
            });
            if (!res.ok) throw new Error((await res.text()) || `Failed to generate interaction (${res.status})`);
            const data = await res.json();
            onChange({ ...contract, interactions: [...interactions, data.interaction] });
            setSelectedIndex(interactions.length);
            setSeedRequestId('');
            if (!data.seededFromHistory) {
                setSeedError('No saved response found for that request — expectations were left at their defaults.');
            }
        } catch (e) {
            setSeedError(e.message || 'Failed to generate interaction');
        } finally {
            setSeeding(false);
        }
    };

    const deriveFields = async () => {
        if (!interaction?.expectedBody) return;
        try {
            const res = await fetch('/api/consumer-contracts/interactions/derive-fields', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ body: interaction.expectedBody })
            });
            if (!res.ok) return;
            const data = await res.json();
            setInteraction({ expectedFields: data.fields || [] });
        } catch { /* leave existing expectations untouched */ }
    };

    return (
        <div className="ccd-card">
            <div className="ccd-card-head">
                <div className="ccd-card-title">
                    {contract._id ? 'Edit contract' : 'New consumer contract'}
                </div>
                <div className="ccd-header-actions">
                    <button type="button" className="ccd-btn ccd-btn--ghost" onClick={onCancel}>
                        <FiX /> Cancel
                    </button>
                    <button type="button" className="ccd-btn ccd-btn--primary" onClick={onSave} disabled={saving}>
                        {saving ? 'Saving…' : 'Save contract'}
                    </button>
                </div>
            </div>

            {error && <div className="ccd-error">{error}</div>}

            <div className="ccd-card-body">
                <div className="ccd-section">
                    <h3 className="ccd-section-title">Contract details</h3>
                    <div className="ccd-grid-2">
                        <div className="ccd-field">
                            <label htmlFor="ccd-name">Name</label>
                            <input
                                id="ccd-name"
                                className="ccd-input"
                                value={contract.name || ''}
                                onChange={(e) => onChange({ ...contract, name: e.target.value })}
                                placeholder="Checkout depends on Payments API"
                            />
                        </div>
                        <div className="ccd-field">
                            <label htmlFor="ccd-consumer">Consumer / team</label>
                            <input
                                id="ccd-consumer"
                                className="ccd-input"
                                value={contract.consumerName || ''}
                                onChange={(e) => onChange({ ...contract, consumerName: e.target.value })}
                                placeholder="Checkout web"
                            />
                        </div>
                    </div>

                    <div className="ccd-field">
                        <label htmlFor="ccd-desc">Description</label>
                        <input
                            id="ccd-desc"
                            className="ccd-input"
                            value={contract.description || ''}
                            onChange={(e) => onChange({ ...contract, description: e.target.value })}
                            placeholder="What this consumer relies on"
                        />
                    </div>

                    <div className="ccd-grid-2">
                        <div className="ccd-field">
                            <label>Provider collection</label>
                            <AppSelect
                                value={String(contract.providerCollectionId || '')}
                                onChange={(value) => onChange({ ...contract, providerCollectionId: value })}
                                options={[
                                    { value: '', label: 'Choose a provider collection…' },
                                    ...collections.map((c) => ({ value: String(c._id), label: c.name }))
                                ]}
                            />
                        </div>
                        <div className="ccd-field">
                            <label>Target environment</label>
                            <AppSelect
                                value={String(contract.environmentId || '')}
                                onChange={(value) => onChange({ ...contract, environmentId: value || null })}
                                options={[
                                    { value: '', label: 'No environment' },
                                    ...environments.map((e) => ({ value: String(e._id), label: e.name }))
                                ]}
                            />
                        </div>
                    </div>

                    <div className="ccd-grid-2">
                        <div className="ccd-field">
                            <label htmlFor="ccd-version">Contract version</label>
                            <input
                                id="ccd-version"
                                className="ccd-input"
                                value={contract.version || ''}
                                onChange={(e) => onChange({ ...contract, version: e.target.value })}
                                placeholder="1.0.0"
                            />
                        </div>
                        <div className="ccd-field">
                            <label>Status</label>
                            <AppSelect
                                value={contract.status || 'draft'}
                                onChange={(value) => onChange({ ...contract, status: value })}
                                options={STATUS_OPTIONS}
                            />
                        </div>
                    </div>
                </div>

                <div className="ccd-section">
                    <h3 className="ccd-section-title">
                        Generate from a saved request
                        <span className="ccd-muted">Uses the request&apos;s latest response as the expectation</span>
                    </h3>
                    <div className="ccd-grid-2">
                        <div className="ccd-field">
                            <label>Saved request</label>
                            <AppSelect
                                value={seedRequestId}
                                onChange={setSeedRequestId}
                                disabled={!providerCollection}
                                options={requestOptions}
                            />
                        </div>
                        <div className="ccd-field">
                            <label>&nbsp;</label>
                            <button
                                type="button"
                                className="ccd-btn ccd-btn--ghost"
                                onClick={generateFromRequest}
                                disabled={!seedRequestId || seeding}
                            >
                                <FiDownloadCloud /> {seeding ? 'Generating…' : 'Generate interaction'}
                            </button>
                        </div>
                    </div>
                    {seedError && <span className="ccd-muted">{seedError}</span>}
                </div>

                <div className="ccd-editor-layout">
                    <div className="ccd-section">
                        <h3 className="ccd-section-title">Interactions</h3>
                        {interactions.length === 0 && (
                            <span className="ccd-muted">No interactions yet. Add one or generate it from a request.</span>
                        )}
                        <div className="ccd-interaction-list">
                            {interactions.map((it, index) => (
                                <div key={index} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    <button
                                        type="button"
                                        className={`ccd-interaction${index === selectedIndex ? ' ccd-interaction--active' : ''}`}
                                        onClick={() => setSelectedIndex(index)}
                                    >
                                        <span className="ccd-method">{it.method}</span>
                                        <span className="ccd-interaction-main">
                                            <span className="ccd-interaction-name">{it.name || 'Untitled'}</span>
                                            <span className="ccd-interaction-url">{it.url || 'No URL set'}</span>
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        className="ccd-icon-btn"
                                        aria-label={`Delete ${it.name || 'interaction'}`}
                                        onClick={() => removeInteraction(index)}
                                    >
                                        <FiTrash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button type="button" className="ccd-btn ccd-btn--ghost ccd-btn--sm" onClick={addInteraction}>
                            <FiPlus size={14} /> Add interaction
                        </button>
                    </div>

                    {!interaction ? (
                        <div className="ccd-empty">
                            <strong>No interaction selected.</strong>
                            <span>Pick one on the left, or add a new interaction to start defining expectations.</span>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
                            <div className="ccd-section">
                                <h3 className="ccd-section-title">Consumer request</h3>
                                <div className="ccd-grid-2">
                                    <div className="ccd-field">
                                        <label htmlFor="ccd-it-name">Interaction name</label>
                                        <input
                                            id="ccd-it-name"
                                            className="ccd-input"
                                            value={interaction.name || ''}
                                            onChange={(e) => setInteraction({ name: e.target.value })}
                                        />
                                    </div>
                                    <div className="ccd-field">
                                        <label>Method</label>
                                        <AppSelect
                                            value={interaction.method || 'GET'}
                                            onChange={(value) => setInteraction({ method: value })}
                                            options={METHODS}
                                        />
                                    </div>
                                </div>

                                <div className="ccd-field">
                                    <label htmlFor="ccd-it-url">URL or path</label>
                                    <input
                                        id="ccd-it-url"
                                        className="ccd-input"
                                        value={interaction.url || ''}
                                        onChange={(e) => setInteraction({ url: e.target.value })}
                                        placeholder="{{baseUrl}}/users/1"
                                    />
                                </div>

                                <div className="ccd-field">
                                    <label>Headers</label>
                                    <KvRows
                                        rows={interaction.headers || []}
                                        onChange={(headers) => setInteraction({ headers })}
                                        addLabel="Add header"
                                        keyPlaceholder="Header name"
                                        valuePlaceholder="Header value"
                                    />
                                </div>

                                <div className="ccd-field">
                                    <label>Query parameters</label>
                                    <KvRows
                                        rows={interaction.queryParams || []}
                                        onChange={(queryParams) => setInteraction({ queryParams })}
                                        addLabel="Add parameter"
                                        keyPlaceholder="Parameter"
                                        valuePlaceholder="Value"
                                    />
                                </div>

                                <div className="ccd-field">
                                    <label>Request body type</label>
                                    <AppSelect
                                        value={interaction.bodyType || 'none'}
                                        onChange={(value) => setInteraction({ bodyType: value })}
                                        options={BODY_TYPES}
                                    />
                                </div>

                                {interaction.bodyType !== 'none' && (
                                    <div className="ccd-field">
                                        <label htmlFor="ccd-it-body">Request body</label>
                                        <textarea
                                            id="ccd-it-body"
                                            className="ccd-textarea"
                                            value={interaction.body || ''}
                                            onChange={(e) => setInteraction({ body: e.target.value })}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="ccd-section ccd-section--expect">
                                <h3 className="ccd-section-title">
                                    Provider must return
                                    <span className="ccd-expect-flag">
                                        <FiCheckCircle size={12} /> Consumer expectations
                                    </span>
                                </h3>

                                <div className="ccd-grid-3">
                                    <div className="ccd-field">
                                        <label htmlFor="ccd-it-status">Expected status</label>
                                        <input
                                            id="ccd-it-status"
                                            className="ccd-input"
                                            type="number"
                                            value={interaction.expectedStatus ?? ''}
                                            onChange={(e) => setInteraction({ expectedStatus: Number(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <div className="ccd-field">
                                        <label htmlFor="ccd-it-rt">Max response time (ms)</label>
                                        <input
                                            id="ccd-it-rt"
                                            className="ccd-input"
                                            type="number"
                                            placeholder="No threshold"
                                            value={interaction.maxResponseTimeMs ?? ''}
                                            onChange={(e) => setInteraction({
                                                maxResponseTimeMs: e.target.value === '' ? null : Number(e.target.value)
                                            })}
                                        />
                                    </div>
                                    <div className="ccd-field">
                                        <label htmlFor="ccd-it-tags">Tags (comma separated)</label>
                                        <input
                                            id="ccd-it-tags"
                                            className="ccd-input"
                                            value={(interaction.tags || []).join(', ')}
                                            onChange={(e) => setInteraction({
                                                tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean)
                                            })}
                                            placeholder="critical, checkout"
                                        />
                                    </div>
                                </div>

                                <div className="ccd-field">
                                    <label>Expected response headers</label>
                                    <KvRows
                                        rows={interaction.expectedHeaders || []}
                                        onChange={(expectedHeaders) => setInteraction({ expectedHeaders })}
                                        addLabel="Add expected header"
                                        keyPlaceholder="content-type"
                                        valuePlaceholder="application/json"
                                    />
                                </div>

                                <div className="ccd-field">
                                    <label htmlFor="ccd-it-expected-body">Expected response body (example)</label>
                                    <textarea
                                        id="ccd-it-expected-body"
                                        className="ccd-textarea"
                                        value={interaction.expectedBody || ''}
                                        onChange={(e) => setInteraction({ expectedBody: e.target.value })}
                                        placeholder={'{\n  "user": { "id": 1 }\n}'}
                                    />
                                    <button
                                        type="button"
                                        className="ccd-btn ccd-btn--ghost ccd-btn--sm"
                                        style={{ marginTop: '8px', alignSelf: 'flex-start' }}
                                        onClick={deriveFields}
                                        disabled={!interaction.expectedBody}
                                    >
                                        Derive field expectations from this example
                                    </button>
                                </div>

                                <div className="ccd-field">
                                    <label>Required response fields</label>
                                    {(interaction.expectedFields || []).length === 0 && (
                                        <span className="ccd-muted">
                                            No field expectations. Key order is never compared — only these paths are.
                                        </span>
                                    )}
                                    {(interaction.expectedFields || []).map((field, index) => {
                                        const update = (patch) => setInteraction({
                                            expectedFields: interaction.expectedFields.map((f, i) => (i === index ? { ...f, ...patch } : f))
                                        });
                                        return (
                                            <div className="ccd-field-row" key={index}>
                                                <input
                                                    className="ccd-input ccd-input--sm"
                                                    value={field.path || ''}
                                                    aria-label="Field path"
                                                    placeholder="user.id"
                                                    onChange={(e) => update({ path: e.target.value })}
                                                />
                                                <AppSelect
                                                    value={field.type || 'any'}
                                                    onChange={(value) => update({ type: value })}
                                                    options={FIELD_TYPES}
                                                />
                                                <label className="ccd-check">
                                                    <input
                                                        type="checkbox"
                                                        checked={field.required !== false}
                                                        onChange={(e) => update({ required: e.target.checked })}
                                                    />
                                                    Required
                                                </label>
                                                <label className="ccd-check">
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(field.matchValue)}
                                                        onChange={(e) => update({ matchValue: e.target.checked })}
                                                    />
                                                    Match value
                                                </label>
                                                <input
                                                    className="ccd-input ccd-input--sm"
                                                    value={field.expectedValue || ''}
                                                    aria-label="Expected value"
                                                    placeholder="Expected value"
                                                    disabled={!field.matchValue}
                                                    onChange={(e) => update({ expectedValue: e.target.value })}
                                                />
                                                <button
                                                    type="button"
                                                    className="ccd-icon-btn"
                                                    aria-label={`Remove ${field.path || 'field'}`}
                                                    onClick={() => setInteraction({
                                                        expectedFields: interaction.expectedFields.filter((_, i) => i !== index)
                                                    })}
                                                >
                                                    <FiTrash2 size={14} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                    <button
                                        type="button"
                                        className="ccd-btn ccd-btn--ghost ccd-btn--sm"
                                        onClick={() => setInteraction({
                                            expectedFields: [
                                                ...(interaction.expectedFields || []),
                                                { path: '', required: true, type: 'any', matchValue: false, expectedValue: '' }
                                            ]
                                        })}
                                    >
                                        <FiPlus size={14} /> Add expected field
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ContractEditor;
