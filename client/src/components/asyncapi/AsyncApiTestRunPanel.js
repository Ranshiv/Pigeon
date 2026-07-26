// client/src/components/asyncapi/AsyncApiTestRunPanel.js
// Ad-hoc test execution against a saved AsyncAPI document. Lets the user pick
// a server / channel / operation / message, resolve {{vars}} via an
// environment, then send a payload + headers. Shows redacted request/response,
// schema violations, and connector-required notices (warning styling, not
// danger, for non-fatal states). No alert()/confirm() — inline-notice only.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FiPlay, FiRefreshCw } from 'react-icons/fi';
import AppSelect from '../common/AppSelect/AppSelect';

const AsyncApiTestRunPanel = ({ document: doc, environments = [], onRun }) => {
    const serverOptions = useMemo(() => (doc.servers || []).map((s, i) => ({
        value: String(i),
        label: `${s.name || 'server'} (${s.protocol}) ${s.url || ''}`
    })), [doc.servers]);
    const channelOptions = useMemo(() => (doc.channels || []).map((c) => ({
        value: c.name || c.address || '',
        label: c.name || c.address || '(unnamed channel)'
    })), [doc.channels]);
    const messageOptions = useMemo(() => (doc.messages || []).map((m) => ({
        value: m.name || '',
        label: m.name || '(unnamed message)'
    })), [doc.messages]);

    const opOptionsForChannel = (channelName) => (doc.operations || [])
        .filter((o) => !channelName || o.channelName === channelName)
        .map((o) => ({ value: o.action, label: `${o.action} → ${o.messageName || ''}`.trim() }));

    const [serverIndex, setServerIndex] = useState(serverOptions[0]?.value || '');
    const [channelName, setChannelName] = useState(channelOptions[0]?.value || '');
    const [operation, setOperation] = useState(opOptionsForChannel(channelName)[0]?.value || 'publish');
    const [messageName, setMessageName] = useState('');
    const [payload, setPayload] = useState('');
    const [headers, setHeaders] = useState('');
    const [environmentId, setEnvironmentId] = useState('');
    const [timeoutMs, setTimeoutMs] = useState(5000);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [runResult, setRunResult] = useState(null);
    const resultRef = useRef(null);

    useEffect(() => {
        const channel = (doc.channels || []).find((c) => (c.name || c.address) === channelName);
        const op = (doc.operations || []).find((o) => o.channelName === (channel?.name || channelName) && o.action === operation) || (doc.operations || []).find((o) => o.channelName === (channel?.name || channelName));
        if (op?.messageName && !messageName) setMessageName(op.messageName);
        const message = (doc.messages || []).find((m) => m.name === (op?.messageName || messageName));
        if (!payload && message?.payloadExample) setPayload(message.payloadExample);
    }, [channelName, operation]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (runResult) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [runResult]);

    const envOptions = [{ value: '', label: 'No environment' }, ...environments.map((e) => ({ value: e._id || e.id, label: e.name }))];

    const submit = async () => {
        if (!doc?._id) return;
        setBusy(true); setError(null); setRunResult(null);
        try {
            if (!serverIndex) throw new Error('Pick a server first.');
            if (!channelName) throw new Error('Pick a channel first.');
            const res = await fetch(`/api/asyncapi/${doc._id}/test`, {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serverIndex: Number(serverIndex),
                    channelName,
                    operation,
                    messageName,
                    payload,
                    headers: headers ? safeJsonParse(headers) : {},
                    environmentId: environmentId || undefined,
                    timeoutMs: Number(timeoutMs) || 5000
                })
            });
            const text = await res.text();
            let data = {};
            try { data = JSON.parse(text); } catch { /* */ }
            if (!res.ok) throw new Error(data.message || text || `Test failed (${res.status})`);
            setRunResult(data);
            onRun?.(data);
        } catch (e) {
            setError(e.message || 'Test failed');
        } finally {
            setBusy(false);
        }
    };

    const connectorRequired = runResult && (runResult.error || '').includes('Connector required');

    return (
        <div className="aa-section">
            <div className="aa-section-title"><FiPlay /> Test run</div>

            {error && <div className="aa-test-guidance">{error}</div>}
            {runResult && <ResultPanel resultRef={resultRef} result={runResult} connectorRequired={connectorRequired} />}
            <div className="aa-grid-2">
                <div className="aa-field"><label>Server</label><AppSelect value={serverIndex} onChange={setServerIndex} options={serverOptions.length ? serverOptions : [{ value: '', label: 'No servers yet' }]} /></div>
                <div className="aa-field"><label>Channel</label><AppSelect value={channelName} onChange={setChannelName} options={channelOptions.length ? channelOptions : [{ value: '', label: 'No channels yet' }]} /></div>
            </div>
            <div className="aa-grid-2">
                <div className="aa-field"><label>Operation</label><AppSelect value={operation} onChange={setOperation} options={opOptionsForChannel(channelName).length ? opOptionsForChannel(channelName) : [{ value: 'publish', label: 'publish' }, { value: 'subscribe', label: 'subscribe' }]} /></div>
                <div className="aa-field"><label>Message</label><AppSelect value={messageName} onChange={setMessageName} options={messageOptions.length ? messageOptions : [{ value: '', label: 'No messages yet' }]} /></div>
            </div>
            <div className="aa-grid-2">
                <div className="aa-field"><label>Environment</label><AppSelect value={environmentId} onChange={setEnvironmentId} options={envOptions} /></div>
                <div className="aa-field"><label>Timeout (ms)</label><input className="aa-number" type="number" min={500} max={60000} value={timeoutMs} onChange={(e) => setTimeoutMs(e.target.value)} /></div>
            </div>
            <div className="aa-field"><label>Payload (JSON)</label><textarea className="aa-textarea" value={payload} onChange={(e) => setPayload(e.target.value)} spellCheck={false} placeholder='{"event":"ping"}' /></div>
            <div className="aa-field"><label>Headers (JSON object)</label><textarea className="aa-textarea" value={headers} onChange={(e) => setHeaders(e.target.value)} spellCheck={false} placeholder='{"Authorization":"{{ASYNCAPI_SECRET}}"}' /></div>

            <div className="aa-header-actions">
                <button className="aa-btn aa-btn--primary" onClick={submit} disabled={busy || !doc?._id}>
                    {busy ? <FiRefreshCw className="aa-spin" /> : <FiPlay />}
                    {busy ? 'Running…' : 'Run test'}
                </button>
            </div>
        </div>
    );
};

const ResultPanel = ({ resultRef, result, connectorRequired }) => (
    <section ref={resultRef} className="aa-test-result" aria-live="polite" aria-label="Latest test result">
        <div className="aa-section-title">
            <span>Latest test result</span>
            <span className={`aa-badge aa-badge--${result.status === 'passed' ? 'ok' : result.status === 'failed' ? 'warn' : 'error'}`}>
                {result.status.toUpperCase()}
            </span>
        </div>
        <span className="aa-muted">{result.protocol} · {result.channel} · {result.operation} · {result.durationMs} ms</span>
        {result.error && (connectorRequired ? <div className="aa-warning">{result.error}</div> : <div className="aa-error">{result.error}</div>)}
        {(result.violations || []).length > 0 && (
            <ul className="aa-violations">
                {result.violations.map((v, i) => (
                    <li key={i} className={v.kind === 'schema' && v.expected === 'JSON-Schema payloadSchema' && v.actual === 'missing' ? 'aa-violation aa-violation--warn' : 'aa-violation'}>
                        <div>
                            {v.path && <span className="aa-violation-path">{v.path} — </span>}
                            {v.message}
                            {v.expected && <div className="aa-muted">expected: {v.expected}</div>}
                            {v.actual && <div className="aa-muted">actual: {v.actual}</div>}
                        </div>
                    </li>
                ))}
            </ul>
        )}
        {result.responsePayload && <ResultPayload label="Response (redacted)" value={result.responsePayload} />}
        {result.requestPayload && <ResultPayload label="Request (redacted)" value={result.requestPayload} />}
    </section>
);

const ResultPayload = ({ label, value }) => (
    <div className="aa-test-result-payload">
        <span className="aa-muted">{label}</span>
        <pre className="aa-pre">{value}</pre>
    </div>
);

function safeJsonParse(text) {
    try { return JSON.parse(text); } catch { return {}; }
}

export default AsyncApiTestRunPanel;
