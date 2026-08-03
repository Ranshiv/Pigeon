import React, { useMemo, useState } from 'react';
import {
    FiActivity, FiAlertTriangle, FiCheck, FiCheckCircle, FiClipboard,
    FiClock, FiCopy, FiExternalLink, FiFileText, FiTarget, FiUsers
} from 'react-icons/fi';
import './operationsCopilot.css';

const formatDateTime = (value) => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : 'Unavailable';
};

const confidenceLabel = (value) => value === 'confirmed' ? 'Confirmed' : `${String(value || 'low').replace(/^./, (letter) => letter.toUpperCase())} confidence`;

const copyText = async (value) => {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
    throw new Error('Clipboard access is unavailable.');
};

const draftText = (value) => {
    if (typeof value === 'string') return value.trim();
    if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
    const text = ['content', 'text', 'message', 'body', 'draft', 'update', 'summary']
        .map((key) => value[key])
        .find((candidate) => typeof candidate === 'string');
    return text?.trim() || '';
};

const EvidenceTimeline = ({ evidence, evidenceIds }) => {
    const selected = useMemo(() => evidence.filter((item) => !evidenceIds || evidenceIds.includes(item.id)), [evidence, evidenceIds]);
    if (!selected.length) return <p className="ops-copilot-muted">No retained evidence supports this item yet.</p>;
    return <div className="ops-copilot-evidence-list">
        {selected.map((item) => <a href={item.deepLink || undefined} className={`ops-copilot-evidence is-${item.status || 'info'}`} key={item.id}>
            <span className="ops-copilot-evidence-dot" aria-hidden="true" />
            <div>
                <small>{item.family} · {item.relation}{item.timestamp ? ` · ${formatDateTime(item.timestamp)}` : ''}</small>
                <strong>{item.summary}</strong>
                {item.detail ? <p>{item.detail}</p> : null}
                {item.confidenceReason ? <em>{item.confidenceReason}</em> : null}
            </div>
            {item.deepLink ? <FiExternalLink aria-hidden="true" /> : null}
        </a>)}
    </div>;
};

const DraftCard = ({ audience, value, canInsert, onInsert }) => {
    const [copied, setCopied] = useState(false);
    const [copyError, setCopyError] = useState('');
    const text = draftText(value);
    const handleCopy = async () => {
        if (!text) return;
        try {
            await copyText(text);
            setCopied(true);
            setCopyError('');
            window.setTimeout(() => setCopied(false), 1600);
        } catch (error) { setCopyError(error.message); }
    };
    return <article className="ops-copilot-draft">
        <div className="ops-copilot-draft-heading">
            <div><span>{audience === 'public' ? <FiUsers /> : <FiFileText />}</span><div><strong>{audience === 'public' ? 'Public update' : 'Internal update'}</strong><small>{audience === 'public' ? 'Plain-language customer communication' : 'Technical responder context'}</small></div></div>
        </div>
        <p>{text || 'No draft is available for this briefing yet.'}</p>
        <div className="ops-copilot-draft-actions">
            <button type="button" onClick={handleCopy} disabled={!text}>{copied ? <FiCheck /> : <FiCopy />} {copied ? 'Copied' : 'Copy'}</button>
            {canInsert && text ? <button type="button" className="secondary" onClick={() => onInsert(text, audience)}><FiClipboard /> Insert into incident</button> : null}
        </div>
        {copyError ? <small className="ops-copilot-copy-error" role="alert">{copyError}</small> : null}
    </article>;
};

const OperationsInvestigation = ({ investigation, onInsertDraft, compact = false }) => {
    const [expandedCause, setExpandedCause] = useState(0);
    if (!investigation) return null;
    const { impact = {}, rootCauses = [], steps = [], evidence = [], drafts = {}, warnings = [] } = investigation;
    return <section className={`ops-copilot-result ${compact ? 'is-compact' : ''}`} aria-label="Incident and monitoring investigation">
        <header className="ops-copilot-result-header">
            <div><span className="ops-copilot-result-icon"><FiActivity /></span><div><small>Investigation briefing</small><h2>{investigation.target?.label}</h2><p>{investigation.summary}</p></div></div>
            <div className="ops-copilot-freshness"><FiClock /><span>Generated {formatDateTime(investigation.generatedAt)}</span><small>{formatDateTime(investigation.window?.start)} – {formatDateTime(investigation.window?.end)}</small></div>
        </header>

        {warnings.length ? <div className="ops-copilot-warnings" role="status">{warnings.map((warning) => <p key={warning.code}><FiAlertTriangle /> {warning.message}</p>)}</div> : null}

        <div className="ops-copilot-metrics" aria-label="Current impact">
            <div><span>Status</span><strong className={`tone-${impact.status}`}>{impact.status || 'unknown'}</strong></div>
            <div><span>Affected services</span><strong>{impact.affectedServices?.length || 0}</strong></div>
            <div><span>Alerts</span><strong>{impact.alertCount || 0}</strong></div>
            <div><span>Failed checks</span><strong>{impact.failedCheckCount || 0}</strong></div>
            <div><span>Trace errors</span><strong>{impact.traceErrorCount || 0}</strong></div>
            <div><span>Anomalies</span><strong>{impact.anomalyCount || 0}</strong></div>
        </div>

        <div className="ops-copilot-grid">
            <section className="ops-copilot-card">
                <div className="ops-copilot-section-heading"><span><FiTarget /></span><div><h3>Likely root causes</h3><p>Confidence comes from stored relationships and corroborating signal families.</p></div></div>
                {rootCauses.length ? <div className="ops-copilot-causes">{rootCauses.map((cause, index) => <article key={`${cause.title}-${index}`} className={`ops-copilot-cause is-${cause.confidence}`}>
                    <button type="button" aria-expanded={expandedCause === index} onClick={() => setExpandedCause(expandedCause === index ? -1 : index)}>
                        <span>{index + 1}</span><div><strong>{cause.title}</strong><small>{confidenceLabel(cause.confidence)}</small></div>
                    </button>
                    {expandedCause === index ? <div className="ops-copilot-cause-detail"><p>{cause.rationale}</p><EvidenceTimeline evidence={evidence} evidenceIds={cause.evidenceIds || []} /></div> : null}
                </article>)}</div> : <p className="ops-copilot-muted">There is not enough corroborating evidence to rank a root-cause hypothesis yet.</p>}
            </section>

            <section className="ops-copilot-card">
                <div className="ops-copilot-section-heading"><span><FiCheckCircle /></span><div><h3>Investigation steps</h3><p>Ordered checks to validate or eliminate the strongest hypotheses.</p></div></div>
                <ol className="ops-copilot-steps">{steps.map((step) => <li key={`${step.order}-${step.action}`}><span>{step.order}</span><div><strong>{step.action}</strong>{step.reason ? <p>{step.reason}</p> : null}</div></li>)}</ol>
            </section>
        </div>

        <section className="ops-copilot-card ops-copilot-signals">
            <div className="ops-copilot-section-heading"><span><FiActivity /></span><div><h3>Correlated signal timeline</h3><p>{evidence.length} redacted evidence item{evidence.length === 1 ? '' : 's'}, ordered by captured signal time.</p></div></div>
            <EvidenceTimeline evidence={evidence} />
        </section>

        <section className="ops-copilot-drafts-section">
            <div className="ops-copilot-section-heading"><span><FiFileText /></span><div><h3>Status update drafts</h3><p>Review before use. Copilot never saves or publishes these automatically.</p></div></div>
            <div className="ops-copilot-drafts">
                <DraftCard audience="internal" value={drafts.internal || ''} canInsert={investigation.target?.type === 'incident' && Boolean(onInsertDraft)} onInsert={onInsertDraft} />
                <DraftCard audience="public" value={drafts.public || ''} canInsert={investigation.target?.type === 'incident' && Boolean(onInsertDraft)} onInsert={onInsertDraft} />
            </div>
        </section>
    </section>;
};

export default OperationsInvestigation;
