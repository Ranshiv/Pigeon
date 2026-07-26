// client/src/components/asyncapi/AsyncApiImportPanel.js
// Import AsyncAPI docs (paste JSON / upload .json) with actionable validation
// BEFORE save, plus export download. Honest "connector required" note block
// mirrors TraceImportPanel's FUTURE_CONNECTORS pattern for non-flattenable
// protocols. No alert()/confirm() — inline-notice only.
import React, { useRef, useState } from 'react';
import { FiDownload, FiRefreshCw, FiUpload, FiX } from 'react-icons/fi';
import AppSelect from '../common/AppSelect/AppSelect';

const SOURCES = [
    { value: 'paste', label: 'Paste AsyncAPI JSON' },
    { value: 'upload', label: 'Upload .json file' }
];

// Asynchronous protocols that we cannot yet reach through a first-party client
// — surfaced honestly so users know exactly what they can test today.
const ASYNCAPI_CONNECTOR_NOTES = [
    { protocol: 'kafka', note: 'Kafka: connector required — Broker client (kafkajs) not wired in this build.' },
    { protocol: 'amqp/amqps', note: 'AMQP: connector required — RabbitMQ client (amqplib) not wired.' },
    { protocol: 'nats', note: 'NATS: connector required — nats client not wired.' },
    { protocol: 'stomp', note: 'STOMP: connector required — @stomp/stompjs not wired.' }
];

const AsyncApiImportPanel = ({ workspaceId, onClose, onImported, embedded = false }) => {
    const [source, setSource] = useState('paste');
    const [payload, setPayload] = useState('');
    const [name, setName] = useState('');
    const [file, setFile] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    const fileInput = useRef(null);

    const submit = async () => {
        if (!workspaceId) return setError('Pick a workspace first.');
        setBusy(true); setError(null); setResult(null);
        try {
            let res;
            if (source === 'upload') {
                if (!file) throw new Error('Choose an AsyncAPI .json file to upload.');
                const form = new FormData();
                form.append('workspaceId', workspaceId);
                if (name.trim()) form.append('name', name.trim());
                form.append('file', file);
                res = await fetch('/api/asyncapi/import', { method: 'POST', credentials: 'include', body: form });
            } else {
                if (!payload.trim()) throw new Error('Paste an AsyncAPI JSON document.');
                res = await fetch('/api/asyncapi/import', {
                    method: 'POST', credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ workspaceId, name: name.trim() || undefined, payload })
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

    const exportDoc = async (documentId, docName) => {
        try {
            const res = await fetch(`/api/asyncapi/${documentId}/export`, { credentials: 'include' });
            if (!res.ok) throw new Error(`Export failed (${res.status})`);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${docName || 'document'}.asyncapi.json`;
            document.body.appendChild(a); a.click(); a.remove();
            URL.revokeObjectURL(url);
        } catch (e) {
            setError(e.message || 'Export failed');
        }
    };

    return (
        <div className={embedded ? 'aa-import-panel' : 'aa-card'}>
            {!embedded && <div className="aa-card-head">
                <div className="aa-card-title"><FiUpload className="aa-card-title-icon" /> Import AsyncAPI</div>
                <button className="aa-btn aa-btn--ghost aa-btn--sm" onClick={onClose} aria-label="Close import panel"><FiX size={14} /> Close</button>
            </div>}

            {error && <div className="aa-error">{error}</div>}
            {result && (
                <div className="aa-notice">
                    Imported <strong>{result.document?.name || 'document'}</strong>.
                    {(result.warnings || []).length > 0 && ' Import notes:'}
                    {(result.warnings || []).length > 0 && <ul style={{ margin: '6px 0 0 18px' }}>{result.warnings.slice(0, 6).map((w, i) => <li key={i}>{w}</li>)}</ul>}
                    <div style={{ marginTop: 10 }}>
                        <button className="aa-btn aa-btn--ghost aa-btn--sm" onClick={() => exportDoc(result.document._id, result.document.name)}>
                            <FiDownload size={12} /> Download exported JSON
                        </button>
                    </div>
                </div>
            )}

            <div className={embedded ? 'aa-import-body' : 'aa-card-body'}>
                <div className="aa-field"><label>Optional document name override</label><input className="aa-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="(defaults to info.title)" /></div>
                <div className="aa-field"><label>Source</label><AppSelect value={source} onChange={setSource} options={SOURCES} /></div>

                {source === 'paste' && (
                    <div className="aa-field">
                        <label>AsyncAPI JSON</label>
                        <textarea className="aa-textarea" value={payload} onChange={(e) => setPayload(e.target.value)} spellCheck={false} placeholder='{"asyncapi":"2.6.0","info":{"title":"...","version":"1.0.0"},"channels":{}}' />
                        <span className="aa-muted">Credential-looking values inside server security / examples are redacted to <code>{'{{ASYNCAPI_SECRET}}'}</code> before storage.</span>
                    </div>
                )}
                {source === 'upload' && (
                    <div className="aa-field">
                        <label>AsyncAPI .json export (max 5 MB)</label>
                        <input className="aa-input" ref={fileInput} type="file" accept="application/json,.json" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                    </div>
                )}

                <div className="aa-warning">
                    <strong>Not every protocol runs today.</strong>
                    <ul style={{ margin: '6px 0 0 18px' }}>
                        <li>WebSocket / Socket.IO / MQTT / HTTP — wired & tested live.</li>
                        {ASYNCAPI_CONNECTOR_NOTES.map((c) => <li key={c.protocol}>{c.note}</li>)}
                    </ul>
                </div>

                <div className="aa-header-actions">
                    <button className="aa-btn aa-btn--primary" onClick={submit} disabled={busy || !workspaceId}>
                        {busy ? <FiRefreshCw className="aa-spin" /> : <FiUpload />}
                        {busy ? 'Importing…' : 'Import'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AsyncApiImportPanel;
