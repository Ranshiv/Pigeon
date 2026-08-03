import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppSelect from './common/AppSelect/AppSelect';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FiAlertTriangle, FiArrowLeft, FiCheck, FiFileText, FiLoader, FiRefreshCw, FiUpload, FiUploadCloud, FiZap } from 'react-icons/fi';
import './DocumentationGeneratorPanel.css';

const TERMINAL_STATUSES = new Set(['completed', 'partial', 'failed']);
const GENERATION_SECTIONS = [
    ['overview', 'Overview'], ['authentication', 'Authentication'], ['getting-started', 'Getting started'],
    ['endpoints', 'Endpoints and errors'], ['tutorials', 'Tutorials']
];

const generationStage = (status, progress) => {
    if (status === 'failed') return 'Generation stopped before the draft was completed.';
    if (status === 'partial') return 'Draft ready with warnings to review.';
    if (status === 'completed') return 'Draft ready for review.';
    if (status === 'queued') return 'Waiting for an available generation worker.';
    if (progress < 15) return 'Analyzing the selected API operations.';
    if (progress < 85) return 'Writing grounded descriptions, examples, and guidance.';
    return 'Validating examples and assembling the final draft.';
};

async function responseData(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data.message || `Request failed (${response.status})`);
        error.data = data;
        throw error;
    }
    return data;
}

export default function DocumentationGeneratorPanel({ collectionId, collection, documentation, onDocumentationChange, onClose }) {
    const [sourceText, setSourceText] = useState('');
    const [sourceVersionId, setSourceVersionId] = useState('');
    const [importResult, setImportResult] = useState(null);
    const [run, setRun] = useState(null);
    const [selectedSections, setSelectedSections] = useState(() => new Set());
    const [selectedOperations, setSelectedOperations] = useState(() => new Set());
    const [generationSections, setGenerationSections] = useState(() => new Set(GENERATION_SECTIONS.map(([id]) => id)));
    const [mode, setMode] = useState('merge');
    const [tone, setTone] = useState('concise');
    const [audience, setAudience] = useState('API developers');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const fileRef = useRef(null);
    const [fileName, setFileName] = useState('');

    const sections = useMemo(() => run?.draft?.sections || [], [run?.draft?.sections]);
    const sourceOperations = useMemo(() => importResult?.operations || (collection?.requests || []).filter((item) => item?.method && item?.url).map((item, index) => ({ operationId: String(item._id || item.id || `request-${index + 1}`), method: item.method, path: item.url, summary: item.name || `${item.method} ${item.url}` })), [collection?.requests, importResult?.operations]);

    useEffect(() => {
        setSelectedOperations(new Set(sourceOperations.slice(0, 250).map((item) => String(item.operationId))));
    }, [sourceOperations]);

    useEffect(() => {
        if (!run?.runId || TERMINAL_STATUSES.has(run.status)) return undefined;
        let cancelled = false;
        const poll = async () => {
            try {
                const response = await fetch(`/api/collections/${collectionId}/documentation/generations/${run.runId}`, { credentials: 'include' });
                const next = await responseData(response);
                if (cancelled) return;
                const normalized = { ...next, runId: next._id || run.runId };
                setRun(normalized);
                if (normalized.draft?.sections) setSelectedSections(new Set(normalized.draft.sections.map((section) => section.id)));
            } catch (pollError) {
                if (!cancelled) setError(pollError.message);
            }
        };
        poll();
        const timer = window.setInterval(poll, 2000);
        return () => { cancelled = true; window.clearInterval(timer); };
    }, [collectionId, run?.runId, run?.status]);

    const importOpenApi = useCallback(async () => {
        const file = fileRef.current?.files?.[0];
        if (!file && !sourceText.trim()) {
            setError('Choose an OpenAPI file or paste JSON/YAML first.');
            return;
        }
        setBusy(true);
        setError('');
        try {
            let body;
            let headers;
            if (file) {
                body = new FormData();
                body.append('file', file);
            } else {
                headers = { 'Content-Type': 'application/json' };
                const trimmed = sourceText.trimStart();
                body = JSON.stringify({ content: sourceText, format: trimmed.startsWith('{') || trimmed.startsWith('[') ? 'json' : 'yaml' });
            }
            const result = await responseData(await fetch(`/api/collections/${collectionId}/openapi-imports`, { method: 'POST', headers, body, credentials: 'include' }));
            setImportResult(result);
            setSourceVersionId(result.sourceVersionId);
        } catch (importError) {
            setError(importError.message);
        } finally {
            setBusy(false);
        }
    }, [collectionId, sourceText]);

    const generate = useCallback(async () => {
        setBusy(true);
        setError('');
        try {
            const result = await responseData(await fetch(`/api/collections/${collectionId}/documentation/generations`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                body: JSON.stringify({ sourceVersionId: sourceVersionId || undefined, operationIds: Array.from(selectedOperations), audience, tone, sections: Array.from(generationSections), exampleLanguages: ['curl', 'javascript', 'python'] })
            }));
            setRun(result);
        } catch (generationError) {
            setError(generationError.message);
        } finally {
            setBusy(false);
        }
    }, [audience, collectionId, generationSections, selectedOperations, sourceVersionId, tone]);

    const toggleOperation = useCallback((operationId) => {
        setSelectedOperations((current) => {
            const next = new Set(current);
            if (next.has(operationId)) next.delete(operationId); else if (next.size < 250) next.add(operationId);
            return next;
        });
    }, []);

    const toggleGenerationSection = useCallback((sectionId) => {
        setGenerationSections((current) => {
            const next = new Set(current);
            if (next.has(sectionId)) next.delete(sectionId); else next.add(sectionId);
            return next;
        });
    }, []);

    const toggleSection = useCallback((sectionId) => {
        setSelectedSections((current) => {
            const next = new Set(current);
            if (next.has(sectionId)) next.delete(sectionId); else next.add(sectionId);
            return next;
        });
    }, []);

    const applyDraft = useCallback(async () => {
        if (!selectedSections.size) {
            setError('Select at least one section to apply.');
            return;
        }
        setBusy(true);
        setError('');
        try {
            const result = await responseData(await fetch(`/api/collections/${collectionId}/documentation/generations/${run.runId}/apply`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                body: JSON.stringify({ sectionIds: Array.from(selectedSections), mode, revision: Number(documentation?.revision || 0) })
            }));
            onDocumentationChange(result.documentation);
        } catch (applyError) {
            setError(applyError.message);
            if (applyError.data?.current) onDocumentationChange(applyError.data.current, { stayOpen: true });
        } finally {
            setBusy(false);
        }
    }, [collectionId, documentation?.revision, mode, onDocumentationChange, run?.runId, selectedSections]);

    const runProgress = Math.min(100, Math.max(0, Number(run?.progress) || 0));
    const runIsActive = Boolean(run && !TERMINAL_STATUSES.has(run.status));

    return (
        <section className="documentation-generator" aria-labelledby="documentation-generator-title">
            <button type="button" className="generator-back" onClick={onClose}><FiArrowLeft /> Back to editor</button>
            <header className="generator-header">
                <div>
                    <span className="generator-eyebrow"><FiZap /> AI documentation</span>
                    <h3 id="documentation-generator-title">Generate a reviewable draft</h3>
                    <p>Use the current collection or import an OpenAPI contract. Generated content is private until you apply and publish it.</p>
                </div>
            </header>

            {error ? <div className="generator-message generator-error" role="alert"><FiAlertTriangle /> {error}</div> : null}

            <div className="generator-grid">
                <div className="generator-card">
                    <span className="generator-step">1</span>
                    <h4>Choose the source</h4>
                    <p>Generate from the saved collection, or import OpenAPI 3.0–3.2 / Swagger 2.0.</p>
                    <label className="generator-file">
                        <FiUpload />
                        <span>{fileName || 'Choose an OpenAPI file'}<small>JSON or YAML · OpenAPI 3.0–3.2 / Swagger 2.0</small></span>
                        <em>Browse</em>
                        <input ref={fileRef} type="file" accept=".json,.yaml,.yml,application/json,application/yaml,text/yaml" onChange={(event) => setFileName(event.target.files?.[0]?.name || '')} />
                    </label>
                    <label htmlFor="openapi-source">Or paste JSON/YAML</label>
                    <textarea id="openapi-source" value={sourceText} onChange={(event) => setSourceText(event.target.value)} rows={7} placeholder="openapi: 3.2.0" />
                    <button type="button" className="generator-secondary generator-import" disabled={busy || (!fileName && !sourceText.trim())} onClick={importOpenApi}>
                        {busy ? <><FiLoader className="generator-spin" /> Importing…</> : <><FiUploadCloud /> Validate and import</>}
                    </button>
                    {importResult ? (
                        <>
                            <div className="generator-message generator-success"><FiCheck /> Imported {importResult.version}: {importResult.summary.operations} operations.</div>
                            {importResult.diagnostics?.length ? <ul className="generator-import-diagnostics">{importResult.diagnostics.map((item, index) => <li key={`${item.code}-${index}`} className={item.severity}>{item.message}</li>)}</ul> : null}
                            {importResult.documentationMarkedStale ? <div className="generator-message generator-error"><FiAlertTriangle /> Existing documentation was marked stale because the source contract changed.</div> : null}
                        </>
                    ) : <div className="generator-source-note"><FiFileText /> No import required to generate from this collection.</div>}
                </div>

                <div className="generator-card">
                    <span className="generator-step">2</span>
                    <h4>Configure the draft</h4>
                    <label htmlFor="documentation-audience">Audience</label>
                    <input id="documentation-audience" value={audience} onChange={(event) => setAudience(event.target.value)} maxLength={120} />
                    <label htmlFor="documentation-tone" id="documentation-tone-label">Style</label>
                    <AppSelect id="documentation-tone" value={tone} onChange={setTone} options={[
                        { value: 'concise', label: 'Concise reference' },
                        { value: 'tutorial', label: 'Tutorial-led' },
                        { value: 'reference', label: 'Detailed reference' }
                    ]} />
                    <fieldset className="generator-section-picker">
                        <legend>Sections to generate</legend>
                        {GENERATION_SECTIONS.map(([id, label]) => <label key={id}><input type="checkbox" checked={generationSections.has(id)} onChange={() => toggleGenerationSection(id)} /> {label}</label>)}
                    </fieldset>
                    {sourceOperations.length ? (
                        <details className="generator-operation-picker">
                            <summary>{selectedOperations.size} of {sourceOperations.length} operations selected</summary>
                            <div>{sourceOperations.map((operation) => {
                                const operationId = String(operation.operationId);
                                return <label key={operationId}><input type="checkbox" checked={selectedOperations.has(operationId)} onChange={() => toggleOperation(operationId)} /> <strong>{operation.method}</strong><span>{operation.summary}</span><code>{operation.path}</code></label>;
                            })}</div>
                            {sourceOperations.length > 250 ? <p>Generation is limited to 250 operations per draft.</p> : null}
                        </details>
                    ) : null}
                    <button type="button" className="generator-primary" disabled={busy || !selectedOperations.size || !generationSections.size || (run && !TERMINAL_STATUSES.has(run.status))} onClick={generate}>
                        <FiZap /> {sourceVersionId ? 'Generate from imported version' : 'Generate from collection'}
                    </button>
                    {run ? (
                        <div className={`generator-progress generator-progress--${run.status}`} role="status" aria-live="polite">
                            <div className="generator-progress-header">
                                <span className="generator-progress-icon" aria-hidden="true">
                                    {run.status === 'failed' ? <FiAlertTriangle /> : TERMINAL_STATUSES.has(run.status) ? <FiCheck /> : <FiLoader className="generator-spin" />}
                                </span>
                                <span className="generator-progress-copy">
                                    <strong>{run.status === 'failed' ? 'Generation failed' : runIsActive ? 'Generating documentation' : 'Generation complete'}</strong>
                                    <small>{generationStage(run.status, runProgress)}</small>
                                </span>
                                <strong className="generator-progress-value">{runProgress}%</strong>
                            </div>
                            <div
                                className="generator-progress-track"
                                role="progressbar"
                                aria-label="Documentation generation progress"
                                aria-valuemin="0"
                                aria-valuemax="100"
                                aria-valuenow={runProgress}
                            >
                                <span className={runIsActive ? 'is-active' : ''} style={{ width: `${runProgress}%` }} />
                            </div>
                            {run.error ? <p>{run.error}</p> : null}
                        </div>
                    ) : null}
                </div>
            </div>

            {run?.warnings?.length ? (
                <div className="generator-warnings">
                    <h4>Review warnings</h4>
                    <ul>{run.warnings.map((warning, index) => <li key={`${warning.code}-${index}`}>{warning.message}</li>)}</ul>
                </div>
            ) : null}

            {sections.length ? (
                <div className="generator-review">
                    <div className="generator-review-header">
                        <div><span className="generator-step">3</span><h4>Review and apply</h4><p>Select only the sections you have verified.</p></div>
                        <div className="generator-apply-controls">
                            <AppSelect className="generator-mode-select" value={mode} onChange={setMode} options={[
                                { value: 'merge', label: 'Merge with current docs' },
                                { value: 'replace', label: 'Replace current docs' }
                            ]} />
                            <button type="button" className="generator-primary" disabled={busy || !selectedSections.size} onClick={applyDraft}>{busy ? 'Applying…' : 'Apply selected sections'}</button>
                        </div>
                    </div>
                    <div className="generator-coverage">
                        <span className="ok">{run.draft.coverage.selected}/{run.draft.coverage.total} operations selected</span>
                        {[['missing examples', run.draft.coverage.missingExamples], ['invalid examples', run.draft.coverage.invalidExamples || 0], ['missing error responses', run.draft.coverage.missingErrors]].map(([label, count]) => (
                            <span key={label} className={count ? 'warn' : ''}>{count} {label}</span>
                        ))}
                    </div>
                    <div className="generator-sections">
                        {sections.map((section) => (
                            <article key={section.id} className={`generator-section ${selectedSections.has(section.id) ? 'selected' : ''}`}>
                                <label><input type="checkbox" checked={selectedSections.has(section.id)} onChange={() => toggleSection(section.id)} /> {section.title}</label>
                                {/* Anchor comments (<!-- pigeon:operation:… -->) are metadata, not prose. */}
                                <div className="generator-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{(section.markdown || '').replace(/<!--[\s\S]*?-->/g, '')}</ReactMarkdown></div>
                            </article>
                        ))}
                    </div>
                </div>
            ) : null}

            {run?.status === 'failed' ? <button type="button" className="generator-secondary" onClick={generate}><FiRefreshCw /> Retry generation</button> : null}
        </section>
    );
}
