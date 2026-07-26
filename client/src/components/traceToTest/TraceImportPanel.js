// client/src/components/traceToTest/TraceImportPanel.js
// Ingest OTLP traces three ways: paste JSON, upload a .json export, or pull
// from a collector endpoint. Collector credentials are sent for that one
// fetch and never stored.
import React, { useRef, useState } from 'react';
import { FiClock, FiRefreshCw, FiUpload, FiX } from 'react-icons/fi';
import AppSelect from '../common/AppSelect/AppSelect';

const SOURCES = [
    { value: 'paste', label: 'Paste OTLP JSON' },
    { value: 'upload', label: 'Upload .json export' },
    { value: 'collector', label: 'Collector endpoint' }
];

// Not wired yet — shown so the path is visible without pretending it works.
const FUTURE_CONNECTORS = ['Jaeger', 'Grafana Tempo', 'Honeycomb'];

const TraceImportPanel = ({ workspaceId, onClose, onImported }) => {
    const [source, setSource] = useState('paste');
    const [payload, setPayload] = useState('');
    const [collectorUrl, setCollectorUrl] = useState('');
    const [collectorToken, setCollectorToken] = useState('');
    const [file, setFile] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    const fileInput = useRef(null);

    const submit = async () => {
        if (!workspaceId) return setError('Pick a workspace first.');
        setBusy(true);
        setError(null);
        setResult(null);
        try {
            let res;
            if (source === 'upload') {
                if (!file) throw new Error('Choose an OTLP .json export to upload.');
                const form = new FormData();
                form.append('workspaceId', workspaceId);
                form.append('file', file);
                res = await fetch('/api/traces/import', { method: 'POST', credentials: 'include', body: form });
            } else {
                const body = source === 'collector'
                    ? { workspaceId, collectorUrl: collectorUrl.trim(), collectorToken: collectorToken.trim() || undefined }
                    : { workspaceId, payload };
                if (source === 'collector' && !body.collectorUrl) throw new Error('Enter the collector endpoint URL.');
                if (source === 'paste' && !payload.trim()) throw new Error('Paste an OTLP JSON payload.');
                res = await fetch('/api/traces/import', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
            }

            const text = await res.text();
            let data = {};
            try { data = JSON.parse(text); } catch { /* non-JSON error body */ }
            if (!res.ok) throw new Error(data.message || text || `Import failed (${res.status})`);

            setResult(data);
            onImported?.(data);
        } catch (e) {
            setError(e.message || 'Import failed');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="ttt-card">
            <div className="ttt-card-head">
                <div className="ttt-card-title">
                    <FiUpload className="ttt-card-title-icon" />
                    Import traces
                </div>
                <button className="ttt-btn ttt-btn--ghost ttt-btn--sm" onClick={onClose} aria-label="Close import panel">
                    <FiX size={14} /> Close
                </button>
            </div>

            {error && <div className="ttt-error">{error}</div>}
            {result && (
                <div className="ttt-notice">
                    Imported {result.imported} trace{result.imported === 1 ? '' : 's'}.
                    {result.truncated > 0 && ` ${result.truncated} span${result.truncated === 1 ? '' : 's'} were dropped by the per-trace limit of ${result.limits?.maxSpansPerTrace}.`}
                </div>
            )}

            <div className="ttt-card-body">
                <div className="ttt-field">
                    <label htmlFor="ttt-source">Source</label>
                    <AppSelect id="ttt-source" value={source} onChange={setSource} options={SOURCES} />
                </div>

                {source === 'paste' && (
                    <div className="ttt-field">
                        <label htmlFor="ttt-payload">OTLP JSON</label>
                        <textarea
                            id="ttt-payload"
                            className="ttt-textarea"
                            value={payload}
                            onChange={(e) => setPayload(e.target.value)}
                            placeholder='{"resourceSpans": [ ... ]}'
                            spellCheck={false}
                        />
                        <span className="ttt-muted">
                            Sensitive headers, query values and body fields are redacted before anything is stored.
                        </span>
                    </div>
                )}

                {source === 'upload' && (
                    <div className="ttt-field">
                        <label htmlFor="ttt-file">OTLP export (.json, max 5 MB)</label>
                        <input
                            id="ttt-file"
                            ref={fileInput}
                            className="ttt-input"
                            type="file"
                            accept="application/json,.json"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                        />
                    </div>
                )}

                {source === 'collector' && (
                    <div className="ttt-grid-2">
                        <div className="ttt-field">
                            <label htmlFor="ttt-collector">Collector endpoint</label>
                            <input
                                id="ttt-collector"
                                className="ttt-input"
                                type="url"
                                value={collectorUrl}
                                onChange={(e) => setCollectorUrl(e.target.value)}
                                placeholder="https://collector.internal/api/traces"
                            />
                        </div>
                        <div className="ttt-field">
                            <label htmlFor="ttt-collector-token">Bearer token (optional)</label>
                            <input
                                id="ttt-collector-token"
                                className="ttt-input"
                                type="password"
                                autoComplete="off"
                                value={collectorToken}
                                onChange={(e) => setCollectorToken(e.target.value)}
                                placeholder="Used for this fetch only — never stored"
                            />
                        </div>
                    </div>
                )}

                <div className="ttt-connector-note">
                    <FiClock size={14} />
                    Direct connectors for {FUTURE_CONNECTORS.join(', ')} are not available yet — export OTLP JSON from
                    them, or point the collector endpoint at their OTLP-compatible API.
                </div>

                <div className="ttt-header-actions">
                    <button className="ttt-btn ttt-btn--primary" onClick={submit} disabled={busy || !workspaceId}>
                        {busy ? <FiRefreshCw className="ttt-spin" /> : <FiUpload />}
                        {busy ? 'Importing…' : 'Import'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TraceImportPanel;
