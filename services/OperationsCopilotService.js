const { ObjectId } = require('mongodb');
const Incident = require('../models/Incident');
const Monitor = require('../models/Monitor');
const Alert = require('../models/Alert');
const HealthCheck = require('../models/HealthCheck');
const Analytics = require('../models/Analytics');
const Trace = require('../models/Trace');
const { getDb } = require('../config/db');
const copilot = require('./CopilotService');

const MAX_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const TIME_RANGES = Object.freeze({
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': MAX_WINDOW_MS
});
const SEVERITY_WEIGHT = Object.freeze({ info: 0, low: 1, medium: 2, high: 3, critical: 4 });

const oid = (value) => ObjectId.isValid(String(value || '')) ? new ObjectId(String(value)) : null;
const idOf = (value) => String(value?._id || value?.id || value || '');
const dateValue = (value) => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
};
const iso = (value) => dateValue(value)?.toISOString() || null;
const clean = (value, limit = 500) => copilot.redactText(String(value || ''), limit).replace(/\s+/g, ' ').trim();
const draftText = (value, limit = 2000) => {
    if (typeof value === 'string') return clean(value, limit);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
    const candidate = ['content', 'text', 'message', 'body', 'draft', 'update', 'summary']
        .map((key) => value[key])
        .find((item) => typeof item === 'string');
    return candidate ? clean(candidate, limit) : '';
};
const userValues = (user) => [idOf(user?.id || user?._id), oid(user?.id || user?._id)].filter(Boolean);
const workspaceAccessFilter = (user) => {
    const values = userValues(user);
    return { $or: [{ owner: { $in: values } }, { userId: { $in: values } }, { 'collaborators.userId': { $in: values } }] };
};

async function accessibleWorkspaceIds(user) {
    const rows = await getDb().collection('workspaces').find(workspaceAccessFilter(user)).project({ _id: 1 }).limit(250).toArray();
    return rows.map((row) => row._id);
}

async function canAccessWorkspace(workspaceId, user) {
    const id = oid(workspaceId);
    if (!id) return false;
    return Boolean(await getDb().collection('workspaces').findOne({ _id: id, ...workspaceAccessFilter(user) }, { projection: { _id: 1 } }));
}

async function loadTarget(target, user) {
    const id = oid(target?.id);
    if (!id || !['incident', 'monitor'].includes(target?.type)) return null;
    if (target.type === 'incident') {
        const incident = await Incident.findById(id).lean();
        if (!incident?.workspaceId || !(await canAccessWorkspace(incident.workspaceId, user))) return null;
        return { type: 'incident', record: incident, workspaceId: incident.workspaceId };
    }
    const monitor = await Monitor.findById(id).lean();
    if (!monitor) return null;
    const ownsLegacyMonitor = userValues(user).some((value) => idOf(value) === idOf(monitor.userId));
    if (monitor.workspaceId ? !(await canAccessWorkspace(monitor.workspaceId, user)) : !ownsLegacyMonitor) return null;
    return { type: 'monitor', record: monitor, workspaceId: monitor.workspaceId || null };
}

async function listTargets({ workspaceId } = {}, user) {
    const requestedWorkspace = oid(workspaceId);
    if (workspaceId && (!requestedWorkspace || !(await canAccessWorkspace(requestedWorkspace, user)))) {
        const error = new Error('You do not have access to this workspace.');
        error.status = 403;
        throw error;
    }
    const workspaceIds = requestedWorkspace ? [requestedWorkspace] : await accessibleWorkspaceIds(user);
    const monitorScope = requestedWorkspace
        ? { workspaceId: requestedWorkspace }
        : { $or: [{ workspaceId: { $in: workspaceIds } }, { workspaceId: null, userId: { $in: userValues(user) } }, { workspaceId: { $exists: false }, userId: { $in: userValues(user) } }] };
    const [incidents, monitors, workspaces] = await Promise.all([
        workspaceIds.length ? Incident.find({ workspaceId: { $in: workspaceIds } }).sort({ createdAt: -1 }).limit(100).lean() : [],
        Monitor.find(monitorScope).sort({ currentStatus: 1, updatedAt: -1 }).limit(150).lean(),
        workspaceIds.length ? getDb().collection('workspaces').find({ _id: { $in: workspaceIds } }).project({ name: 1 }).toArray() : []
    ]);
    const names = new Map(workspaces.map((workspace) => [idOf(workspace._id), workspace.name]));
    return {
        workspaces: workspaces.map((workspace) => ({ id: idOf(workspace._id), name: workspace.name })),
        incidents: incidents.map((incident) => ({
            type: 'incident', id: idOf(incident._id), workspaceId: idOf(incident.workspaceId), workspaceName: names.get(idOf(incident.workspaceId)) || 'Workspace',
            label: incident.title, detail: `${incident.severity || 'medium'} · ${incident.status || 'open'}`, status: incident.status, severity: incident.severity,
            updatedAt: iso(incident.updatedAt || incident.createdAt)
        })),
        monitors: monitors.map((monitor) => ({
            type: 'monitor', id: idOf(monitor._id), workspaceId: idOf(monitor.workspaceId), workspaceName: names.get(idOf(monitor.workspaceId)) || 'Personal',
            label: monitor.name, detail: `${monitor.currentStatus || 'unknown'} · ${clean(monitor.url, 140)}`, status: monitor.currentStatus,
            updatedAt: iso(monitor.updatedAt || monitor.lastChecked || monitor.createdAt)
        }))
    };
}

function analysisWindow(loaded, timeRange) {
    const now = new Date();
    if (loaded.type === 'monitor') {
        const duration = TIME_RANGES[timeRange] || TIME_RANGES['24h'];
        return { start: new Date(now.getTime() - duration), end: now, timeRange: TIME_RANGES[timeRange] ? timeRange : '24h', retentionLimited: false };
    }
    const incident = loaded.record;
    const end = dateValue(incident.resolvedAt) || now;
    const detected = [dateValue(incident.metrics?.firstAlertAt), dateValue(incident.createdAt)].filter(Boolean).sort((a, b) => a - b)[0] || end;
    const requestedStart = new Date(detected.getTime() - 30 * 60 * 1000);
    const retentionStart = new Date(end.getTime() - MAX_WINDOW_MS);
    return { start: requestedStart < retentionStart ? retentionStart : requestedStart, end, timeRange: 'incident', retentionLimited: requestedStart < retentionStart };
}

const monitorTokens = (monitor) => {
    let host = '';
    let path = '';
    try { const parsed = new URL(monitor.url); host = parsed.hostname; path = parsed.pathname; } catch (_) { /* Invalid legacy URL. */ }
    return {
        names: new Set([monitor.name, ...(monitor.tags || [])].map((value) => clean(value, 160).toLowerCase()).filter(Boolean)),
        host: host.toLowerCase(),
        path: path.replace(/\/$/, '').toLowerCase()
    };
};

function traceMatchesMonitor(trace, monitor) {
    const tokens = monitorTokens(monitor);
    const services = new Set([trace.rootServiceName, ...(trace.services || [])].map((value) => clean(value, 160).toLowerCase()).filter(Boolean));
    const serviceMatch = [...tokens.names].some((name) => services.has(name));
    const spans = trace.spans || [];
    const routeMatch = Boolean(tokens.path && tokens.path !== '/' && spans.some((span) => String(span.route || span.url || '').toLowerCase().includes(tokens.path)));
    const hostMatch = Boolean(tokens.host && spans.some((span) => String(span.url || '').toLowerCase().includes(tokens.host)));
    return { matches: serviceMatch || routeMatch || hostMatch, reasons: [serviceMatch && 'service name', routeMatch && 'route', hostMatch && 'host'].filter(Boolean) };
}

const evidenceId = (family, sourceId, suffix = '') => `${family}:${sourceId}${suffix ? `:${suffix}` : ''}`.replace(/[^a-zA-Z0-9:_-]/g, '-').slice(0, 180);
function makeEvidence({ family, sourceType, sourceId, label, summary, detail, status = 'info', relation = 'inferred', confidenceReason = '', deepLink = '', timestamp = null, suffix = '' }) {
    return {
        id: evidenceId(family, sourceId, suffix), family, sourceType, sourceId: idOf(sourceId), label: clean(label, 180), summary: clean(summary, 300), detail: clean(detail, 600),
        status, relation, confidenceReason: clean(confidenceReason, 260), deepLink, timestamp: iso(timestamp)
    };
}

function uniqueEvidence(values) {
    const seen = new Set();
    return values.filter((item) => item?.id && !seen.has(item.id) && seen.add(item.id)).slice(0, 80);
}

function statusForSeverity(severity) {
    return ['critical', 'high'].includes(severity) ? 'error' : severity === 'medium' ? 'warning' : 'info';
}

function evidenceFromData({ alerts, checks, analytics, traces, monitors, incident }) {
    const directAlertIds = new Set((incident?.alerts || []).map(idOf));
    const values = [];
    alerts.forEach((alert) => {
        const direct = directAlertIds.has(idOf(alert._id)) || idOf(alert.incidentId) === idOf(incident?._id);
        values.push(makeEvidence({
            family: 'alert', sourceType: 'alert', sourceId: alert._id, label: alert.title, summary: alert.description || alert.title,
            detail: `${alert.severity || 'medium'} · ${alert.status || 'triggered'} · ${alert.checkResult?.statusCode || alert.checkResult?.errorMessage || 'monitor signal'}`,
            status: statusForSeverity(alert.severity), relation: direct ? 'confirmed' : 'inferred',
            confidenceReason: direct ? 'The alert stores a direct incident relationship.' : 'The alert shares the affected monitor and investigation window.',
            deepLink: '/workspace/monitoring/alerts', timestamp: alert.triggeredAt
        }));
    });
    checks.filter((check) => check.status !== 'success' || Number(check.statusCode) >= 400).slice(0, 24).forEach((check) => {
        const monitor = monitors.find((item) => idOf(item._id) === idOf(check.monitorId));
        values.push(makeEvidence({
            family: 'check', sourceType: 'monitor', sourceId: check.monitorId, suffix: idOf(check._id), label: monitor?.name || 'Monitor check',
            summary: check.errorMessage || `Monitor returned HTTP ${check.statusCode || 'failure'}`,
            detail: `${check.status || 'failure'} · ${Math.round(Number(check.responseTime) || 0)} ms${check.location ? ` · ${check.location}` : ''}`,
            status: 'error', relation: 'confirmed', confidenceReason: 'Stored health-check result for an affected monitor.',
            deepLink: `/workspace/monitoring/${check.monitorId}/history`, timestamp: check.checkedAt
        }));
    });
    analytics.slice(0, 20).forEach((row) => {
        (row.anomalies || []).filter((anomaly) => !anomaly.resolved).slice(0, 5).forEach((anomaly, index) => values.push(makeEvidence({
            family: 'analytics', sourceType: 'analytics', sourceId: row._id, suffix: index, label: `${anomaly.type || 'Monitoring'} anomaly`,
            summary: anomaly.description || `${anomaly.type} deviated from its expected value`,
            detail: `Observed ${anomaly.value}; expected ${anomaly.expectedValue}${Number.isFinite(anomaly.zScore) ? ` · z-score ${anomaly.zScore}` : ''}`,
            status: statusForSeverity(anomaly.severity), relation: 'confirmed', confidenceReason: 'Stored analytics anomaly for an affected monitor.',
            deepLink: `/workspace/monitoring/${row.monitorId}/analytics`, timestamp: anomaly.detectedAt || row.timestamp
        })));
    });
    traces.slice(0, 30).forEach((entry) => {
        const trace = entry.trace || entry;
        const match = entry.match || { reasons: ['workspace and time window'] };
        if (!trace.hasError && !(trace.spans || []).some((span) => span.status === 'error' || Number(span.httpStatusCode) >= 500)) return;
        const failedSpan = (trace.spans || []).find((span) => span.status === 'error' || Number(span.httpStatusCode) >= 500);
        values.push(makeEvidence({
            family: 'trace', sourceType: 'trace', sourceId: trace.traceId, label: `${trace.rootServiceName || 'Trace'} · ${trace.route || trace.rootSpanName || trace.traceId}`,
            summary: trace.errorMessage || failedSpan?.statusMessage || `${trace.errorCount || 1} error span(s)`,
            detail: `${failedSpan?.serviceName || trace.rootServiceName || 'service'} · ${failedSpan?.name || trace.rootSpanName || 'failed request'}${trace.deploymentVersion ? ` · version ${trace.deploymentVersion}` : ''}`,
            status: 'error', relation: 'inferred', confidenceReason: `Trace matched the affected monitor by ${match.reasons.join(', ')} within the investigation window.`,
            deepLink: `/workspace/trace-to-test?workspaceId=${trace.workspaceId}&traceId=${encodeURIComponent(trace.traceId)}`, timestamp: trace.startTime
        }));
    });
    return uniqueEvidence(values).sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')));
}

function classifyCause(evidence) {
    const text = `${evidence.summary} ${evidence.detail}`.toLowerCase();
    if (/enotfound|getaddrinfo|dns/.test(text)) return { key: 'dns', title: 'DNS resolution failure' };
    if (/certificate|tls|ssl/.test(text)) return { key: 'tls', title: 'TLS or certificate failure' };
    if (/timeout|timed out|econnreset|socket hang up/.test(text)) return { key: 'timeout', title: 'Dependency or network timeout' };
    if (/\b5\d\d\b|internal server|bad gateway|service unavailable/.test(text)) return { key: 'server', title: 'Upstream service failure' };
    if (/latency|slow|response time|duration/.test(text)) return { key: 'latency', title: 'Latency regression or saturation' };
    if (/deployment|version|release/.test(text)) return { key: 'deployment', title: 'Recent deployment regression' };
    return { key: evidence.family, title: evidence.family === 'trace' ? 'Application or dependency error' : 'Monitoring signal regression' };
}

function deterministicCauses(evidence, incident) {
    const resolvedRootCause = (incident?.timeline || []).find((entry) => entry.type === 'resolved' && entry.data?.rootCause)?.data?.rootCause;
    if (resolvedRootCause) return [{
        title: clean(resolvedRootCause, 220), confidence: 'confirmed', score: 100,
        rationale: 'This root cause was recorded when the incident was resolved.', evidenceIds: evidence.filter((item) => item.relation === 'confirmed').slice(0, 4).map((item) => item.id)
    }];
    const groups = new Map();
    evidence.forEach((item) => {
        if (!['error', 'warning'].includes(item.status)) return;
        const classification = classifyCause(item);
        const group = groups.get(classification.key) || { ...classification, evidence: [] };
        group.evidence.push(item);
        groups.set(classification.key, group);
    });
    return [...groups.values()].map((group) => {
        const families = new Set(group.evidence.map((item) => item.family));
        const direct = group.evidence.filter((item) => item.relation === 'confirmed').length;
        const score = Math.min(10, direct * 3 + (group.evidence.length - direct) * 2 + Math.max(0, families.size - 1));
        const confidence = score >= 6 && families.size >= 2 ? 'high' : score >= 3 ? 'medium' : 'low';
        return {
            title: group.title, confidence, score,
            rationale: `${group.evidence.length} related signal${group.evidence.length === 1 ? '' : 's'} across ${families.size} evidence source${families.size === 1 ? '' : 's'}.`,
            evidenceIds: group.evidence.slice(0, 6).map((item) => item.id)
        };
    }).sort((a, b) => b.score - a.score).slice(0, 5);
}

function deterministicSteps(causes, target) {
    const steps = [];
    const add = (action, reason) => { if (!steps.some((step) => step.action === action)) steps.push({ order: steps.length + 1, action, reason }); };
    add('Confirm the current monitor state and reproduce the latest failed check.', 'Separate an active failure from a recovered or transient signal.');
    causes.forEach((cause) => {
        const text = cause.title.toLowerCase();
        if (text.includes('dns')) add('Resolve the monitored hostname from each failing location and verify recent DNS changes.', 'DNS failures can affect every downstream request before application code runs.');
        else if (/tls|certificate/.test(text)) add('Inspect certificate validity, trust chain, SNI, and renewal history.', 'TLS failures often appear simultaneously across otherwise healthy endpoints.');
        else if (/timeout|latency|saturation/.test(text)) add('Inspect the slowest trace spans and compare dependency latency with the last healthy interval.', 'This identifies the service contributing most of the response-time regression.');
        else if (/deployment|version/.test(text)) add('Compare the failing deployment version with the last healthy trace and deployment window.', 'A version boundary can strengthen or eliminate the deployment hypothesis.');
        else add('Inspect the first failing trace and its upstream and downstream spans.', 'The earliest error path is usually less affected by cascading failures.');
    });
    add('Validate recovery with consecutive successful checks before resolving the incident.', `The ${target.type} should show sustained recovery rather than one successful sample.`);
    return steps.slice(0, 7);
}

function operationsFollowUpAnswer(prompt, investigation, history = []) {
    if (!investigation?.target || !Array.isArray(investigation.steps) || !investigation.steps.length) return null;
    const text = String(prompt || '').trim().toLowerCase();
    const asksForRemediation = /\b(?:how (?:do|can|should) (?:i|we) (?:fix|resolve|remediate)|how to (?:fix|resolve|remediate)|fix (?:it|this|that)|what (?:is|are) the (?:fix|remediation|next steps?)|what should (?:i|we) do|next steps?|remediation steps?|resolve (?:it|this|that))\b/.test(text);
    const asksForCause = /\b(?:what|which)[^?.!]*(?:cause|causing|root cause|reason)|\b(?:cause|root cause)\b[^?.!]*(?:issue|problem|failure)/.test(text);
    const asksForDetail = /\b(?:detailed?|explain(?:ed|ation)?|why)\b/.test(text);
    const asksForBullets = /\b(?:bullet(?:ed)?(?:\s+points?)?|in\s+points?|list(?:\s+these|\s+the|\s+it|\s+them)?)\b/.test(text);
    const asksForClarification = /^(?:\?{1,4}|what\??|how\??|please (?:explain|continue|be specific))$/.test(text);
    const asksForNextStep = /^(?:then|and then|after that|afterwards|next|continue|go on|what(?:'s| is)? next|what should (?:i|we) do next)\s*[?.!]*$/.test(text);
    const previousAssistant = [...history].reverse().find((message) => message?.role === 'assistant');
    const previousWasIncomplete = /(?:following|these|next) steps\s*:?\s*$/i.test(String(previousAssistant?.content || '').trim());
    if (!asksForRemediation && !asksForCause && !asksForDetail && !asksForBullets && !asksForNextStep && !(asksForClarification && previousWasIncomplete)) return null;

    const cause = (investigation.rootCauses || [])[0];
    const confidence = cause?.confidence === 'confirmed' ? 'confirmed' : `${cause?.confidence || 'low'} confidence`;
    const causeLine = cause
        ? `The strongest supported hypothesis is **${cause.title}** (${confidence}).${cause.rationale ? ` ${cause.rationale}` : ''}`
        : 'The retained evidence does not support a specific root cause yet.';
    const steps = investigation.steps.map((step, index) => {
        const reason = step.reason ? ` ${step.reason}` : '';
        return `${index + 1}. **${step.action}**${reason}`;
    }).join('\n');
    const currentState = investigation.target.type === 'monitor' && investigation.impact?.status
        ? ` The monitor is currently **${investigation.impact.status}**, so start by determining whether the failures are active or historical.`
        : '';

    const evidence = (investigation.evidence || []).filter((item) => item.summary || item.detail).slice(0, 6);
    const evidenceIds = [...new Set([...(cause?.evidenceIds || []), ...evidence.map((item) => item.id).filter(Boolean)])].slice(0, 8);
    const evidenceLines = evidence.map((item) => `- **${item.family || 'signal'}:** ${item.summary || item.detail}`).join('\n');
    if (asksForNextStep) {
        const completedFollowUps = history.filter((message) => message?.role === 'user'
            && /^(?:then|and then|after that|afterwards|next|continue|go on|what(?:'s| is)? next|what should (?:i|we) do next)\s*[?.!]*$/i.test(String(message.content || '').trim().toLowerCase())).length;
        const nextStep = investigation.steps[completedFollowUps + 1];
        if (!nextStep) {
            return {
                answer: `There are no further evidence-backed steps in this briefing. Do not resolve the incident yet. ${evidence.length ? 'Refresh the briefing after the next check or alert so it can evaluate the new evidence.' : 'Run the affected monitor, link any resulting alert or trace to the incident, and refresh the briefing so the next action can be evidence-based.'}`,
                evidenceIds
            };
        }
        return {
            answer: `Next, complete **step ${completedFollowUps + 2}: ${nextStep.action}**${nextStep.reason ? ` ${nextStep.reason}` : ''}${evidence.length ? '\n\nRecord the result before continuing, then ask “Then?” for the next step.' : '\n\nNo alert, failed check, or trace evidence is retained yet. Record the monitor result and link any resulting alert before moving to resolution.'}`,
            evidenceIds
        };
    }
    const bulletAnswer = [
        `- **Likely cause:** ${cause?.title || 'No single root cause is confirmed.'}`,
        `- **Confidence:** ${confidence}. ${cause?.rationale || 'The retained evidence is not sufficient to confirm one cause.'}`,
        `- **Current state:** ${investigation.impact?.status || investigation.target.status || 'unknown'}${investigation.impact?.failedCheckCount !== undefined ? `, with ${investigation.impact.failedCheckCount} failed checks in the selected window` : ''}.`,
        evidence.length ? `- **Supporting evidence:**\n${evidenceLines}` : '- **Supporting evidence:** No detailed evidence item was retained for this snapshot.',
        '- **Next checks:**',
        steps
    ].join('\n');
    const detailedAnswer = `${causeLine}${currentState}\n\nThe evidence snapshot contains ${evidence.length || 0} retained signal${evidence.length === 1 ? '' : 's'}. The strongest signals are:\n\n${evidenceLines || '- No detailed evidence item was retained for this snapshot.'}\n\nThe recommended validation sequence is:\n\n${steps}`;
    const remediationAnswer = `${causeLine}${currentState}\n\nUse this investigation and remediation sequence:\n\n${steps}\n\nDo not close the incident or treat the hypothesis as proven until the validation steps identify the failing dependency and recovery is sustained.`;
    return {
        answer: asksForBullets ? bulletAnswer : asksForDetail ? detailedAnswer : asksForRemediation || (asksForClarification && previousWasIncomplete) ? remediationAnswer : causeLine,
        evidenceIds
    };
}

function impactFromData({ loaded, monitors, alerts, checks, analytics, evidence, window }) {
    const failedChecks = checks.filter((check) => check.status !== 'success' || Number(check.statusCode) >= 400);
    const affected = monitors.map((monitor) => ({ id: idOf(monitor._id), name: monitor.name, status: monitor.currentStatus || 'unknown' }));
    const highest = alerts.reduce((current, alert) => SEVERITY_WEIGHT[alert.severity] > SEVERITY_WEIGHT[current] ? alert.severity : current, loaded.record.severity || 'info');
    const firstSignal = evidence.find((item) => item.timestamp)?.timestamp || iso(window.start);
    const lastSignal = [...evidence].reverse().find((item) => item.timestamp)?.timestamp || iso(window.end);
    const status = loaded.type === 'incident' ? loaded.record.status : loaded.record.currentStatus;
    const headline = loaded.type === 'incident'
        ? affected.length
            ? `${loaded.record.title} is ${status || 'open'} with ${affected.length} affected service${affected.length === 1 ? '' : 's'}.`
            : `${loaded.record.title} is ${status || 'open'} with no linked affected services.`
        : `${loaded.record.name} is ${status || 'unknown'} with ${failedChecks.length} failed check${failedChecks.length === 1 ? '' : 's'} in the selected window.`;
    return {
        headline, status: status || 'unknown', severity: highest || 'info', affectedServices: affected,
        alertCount: alerts.length, failedCheckCount: failedChecks.length,
        traceErrorCount: evidence.filter((item) => item.family === 'trace').length,
        anomalyCount: analytics.reduce((sum, row) => sum + (row.anomalies || []).filter((anomaly) => !anomaly.resolved).length, 0),
        firstSignal, lastSignal
    };
}

function deterministicDrafts(loaded, impact) {
    const targetName = clean(loaded.record.title || loaded.record.name, 180);
    const services = impact.affectedServices.map((service) => service.name).filter(Boolean).slice(0, 4);
    const serviceText = services.length ? services.join(', ') : targetName;
    const stamp = new Date().toISOString();
    return {
        internal: `[${stamp}] ${targetName}: ${impact.headline} Signals currently include ${impact.alertCount} alert(s), ${impact.failedCheckCount} failed check(s), ${impact.traceErrorCount} trace error(s), and ${impact.anomalyCount} analytics anomaly/anomalies. Investigation is focused on the highest-confidence correlated evidence.`,
        public: `We are investigating an issue affecting ${serviceText}. The team is reviewing current monitoring data and working to restore normal service. We will provide another update as soon as more information is confirmed.`
    };
}

function safePublicDraft(value, fallback) {
    const text = clean(value, 1800);
    if (!text || /https?:\/\/|\b(?:trace|span)[-_ ]?id\b|authorization|stack trace|\b(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/i.test(text)) return fallback;
    return text;
}

function parseProviderJson(value) {
    const source = String(value || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try { return JSON.parse(source); } catch (_) { return null; }
}

async function enrichWithModel(base, profile, nim) {
    if (!profile || !nim) return { ...base, warnings: [...base.warnings, { code: 'ai-unavailable', message: 'AI enrichment is unavailable; showing deterministic analysis.' }] };
    const evidenceIds = new Set(base.evidence.map((item) => item.id));
    const payload = {
        target: base.target, window: base.window, impact: base.impact,
        rootCauses: base.rootCauses, steps: base.steps,
        evidence: base.evidence.map(({ id, family, summary, detail, relation, confidenceReason, timestamp }) => ({ id, family, summary, detail, relation, confidenceReason, timestamp }))
    };
    const messages = [
        { role: 'system', content: 'You are an incident-response copilot. Use only the supplied redacted evidence. Return compact JSON with keys summary, rootCauses, steps, internalDraft, publicDraft. Every root cause must include title, rationale, and evidenceIds copied exactly from the input. Do not call a hypothesis confirmed. Do not include internal URLs, IDs, raw error bodies, or unconfirmed root causes in publicDraft.' },
        { role: 'user', content: `Produce an evidence-grounded investigation briefing from this data:\n${JSON.stringify(payload).slice(0, 26000)}` }
    ];
    try {
        const parsed = parseProviderJson(await nim.complete(profile, messages));
        if (!parsed) throw new Error('The model returned an unreadable investigation.');
        const modelCauses = (Array.isArray(parsed.rootCauses) ? parsed.rootCauses : []).map((cause) => {
            const ids = (Array.isArray(cause?.evidenceIds) ? cause.evidenceIds : []).filter((id) => evidenceIds.has(id));
            if (!ids.length) return null;
            const deterministic = base.rootCauses.find((item) => item.evidenceIds.some((id) => ids.includes(id)));
            return {
                title: clean(cause.title, 220) || deterministic?.title || 'Likely contributing factor',
                rationale: clean(cause.rationale, 700) || deterministic?.rationale || '',
                evidenceIds: ids.slice(0, 6), confidence: deterministic?.confidence || 'low', score: deterministic?.score || 1
            };
        }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 5);
        const modelSteps = (Array.isArray(parsed.steps) ? parsed.steps : []).map((step, index) => ({
            order: index + 1, action: clean(step?.action || step, 400), reason: clean(step?.reason, 500)
        })).filter((step) => step.action).slice(0, 7);
        return {
            ...base,
            summary: clean(parsed.summary, 1400) || base.summary,
            rootCauses: modelCauses.length ? modelCauses : base.rootCauses,
            steps: modelSteps.length ? modelSteps : base.steps,
            drafts: {
                internal: draftText(parsed.internalDraft) || base.drafts.internal,
                public: safePublicDraft(draftText(parsed.publicDraft), base.drafts.public)
            },
            enrichment: { status: 'complete', profileId: profile.id }
        };
    } catch (_) {
        return { ...base, warnings: [...base.warnings, { code: 'ai-unavailable', message: 'AI enrichment could not complete; showing deterministic analysis.' }], enrichment: { status: 'fallback', profileId: profile.id } };
    }
}

async function generateInvestigation({ target, timeRange, profile, nim }, user) {
    const loaded = await loadTarget(target, user);
    if (!loaded) {
        const error = new Error('Investigation target was not found or is not accessible.');
        error.status = 404;
        throw error;
    }
    const window = analysisWindow(loaded, timeRange);
    const incident = loaded.type === 'incident' ? loaded.record : null;
    const initialMonitorIds = loaded.type === 'monitor'
        ? [loaded.record._id]
        : (incident.affectedServices || []).map((service) => service.monitorId).filter(Boolean);
    const directAlertFilter = loaded.type === 'incident'
        ? { $or: [{ _id: { $in: incident.alerts || [] } }, { incidentId: incident._id }] }
        : { monitorId: loaded.record._id, triggeredAt: { $gte: window.start, $lte: window.end } };
    const [directAlerts, initialMonitors] = await Promise.all([
        Alert.find(directAlertFilter).sort({ triggeredAt: 1 }).limit(200).lean(),
        initialMonitorIds.length ? Monitor.find({ _id: { $in: initialMonitorIds } }).lean() : []
    ]);
    const monitorIds = [...new Set([...initialMonitorIds, ...directAlerts.map((alert) => alert.monitorId)].filter(Boolean).map(idOf))].map(oid).filter(Boolean);
    const monitors = loaded.type === 'monitor'
        ? [loaded.record]
        : await Monitor.find({ _id: { $in: monitorIds } }).lean();
    const [relatedAlerts, checks, analytics, traceRows] = await Promise.all([
        monitorIds.length ? Alert.find({ monitorId: { $in: monitorIds }, triggeredAt: { $gte: window.start, $lte: window.end } }).sort({ triggeredAt: 1 }).limit(200).lean() : [],
        monitorIds.length ? HealthCheck.find({ monitorId: { $in: monitorIds }, checkedAt: { $gte: window.start, $lte: window.end } }).sort({ checkedAt: -1 }).limit(240).lean() : [],
        monitorIds.length ? Analytics.find({ monitorId: { $in: monitorIds }, timestamp: { $gte: window.start, $lte: window.end } }).sort({ timestamp: -1 }).limit(100).lean() : [],
        loaded.workspaceId ? Trace.find({ workspaceId: loaded.workspaceId, startTime: { $gte: window.start, $lte: window.end } }).sort({ startTime: -1 }).limit(200).lean() : []
    ]);
    const alerts = [...new Map([...directAlerts, ...relatedAlerts].map((alert) => [idOf(alert._id), alert])).values()];
    const traces = traceRows.map((trace) => {
        const matches = monitors.map((monitor) => traceMatchesMonitor(trace, monitor)).filter((match) => match.matches);
        return matches.length ? { trace, match: { reasons: [...new Set(matches.flatMap((match) => match.reasons))] } } : null;
    }).filter(Boolean);
    const evidence = evidenceFromData({ alerts, checks, analytics, traces, monitors, incident });
    const rootCauses = deterministicCauses(evidence, incident);
    const impact = impactFromData({ loaded, monitors, alerts, checks, analytics, evidence, window });
    const targetValue = {
        type: loaded.type, id: idOf(loaded.record._id), workspaceId: idOf(loaded.workspaceId),
        label: clean(loaded.record.title || loaded.record.name, 180), status: impact.status, severity: impact.severity,
        deepLink: loaded.type === 'incident' ? `/workspace/monitoring/incidents?incident=${loaded.record._id}` : `/workspace/monitoring/${loaded.record._id}/history`
    };
    const base = {
        generatedAt: new Date().toISOString(),
        target: targetValue,
        window: { start: window.start.toISOString(), end: window.end.toISOString(), timeRange: window.timeRange, retentionLimited: window.retentionLimited },
        summary: impact.headline, impact, evidence, rootCauses,
        steps: deterministicSteps(rootCauses, targetValue), drafts: deterministicDrafts(loaded, impact),
        warnings: [
            ...(loaded.type === 'incident' && !monitors.length && !alerts.length
                ? [{ code: 'no-linked-signals', message: 'This incident has no linked monitors or alerts, so the briefing cannot correlate live operational signals yet.' }]
                : []),
            ...(window.retentionLimited
                ? [{ code: 'retention-limited', message: 'The incident exceeds the 30-day trace retention window; older diagnostic evidence is unavailable.' }]
                : [])
        ],
        enrichment: { status: 'deterministic', profileId: profile?.id || null }
    };
    return enrichWithModel(base, profile, nim);
}

function investigationMarkdown(investigation) {
    const causes = investigation.rootCauses.slice(0, 3).map((cause) => `- **${cause.title}** (${cause.confidence}): ${cause.rationale}`).join('\n');
    const steps = investigation.steps.map((step) => `${step.order}. ${step.action}`).join('\n');
    return `${investigation.summary}\n\n### Likely root causes\n${causes || '- No supported hypothesis yet.'}\n\n### Investigation steps\n${steps}`;
}

module.exports = {
    TIME_RANGES,
    listTargets,
    loadTarget,
    analysisWindow,
    traceMatchesMonitor,
    deterministicCauses,
    operationsFollowUpAnswer,
    safePublicDraft,
    generateInvestigation,
    investigationMarkdown
};
