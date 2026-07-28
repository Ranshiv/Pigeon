// services/GovernanceScoringService.js
// Pure scoring helpers for the API Inventory & Governance Scorecard.
// No DB access here so the maths stays testable and reusable by routes/governance.js.

const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

// Category weights sum to 100 so the final score is already a percentage.
const CATEGORY_WEIGHTS = {
    documentation: 25,
    security: 20,
    requestQuality: 20,
    monitoring: 15,
    versioning: 10,
    compliance: 10
};

const CATEGORY_LABELS = {
    documentation: 'Documentation completeness',
    security: 'Security / authentication',
    requestQuality: 'Request configuration quality',
    monitoring: 'Monitoring / uptime coverage',
    versioning: 'Version / change tracking',
    compliance: 'Compliance signals'
};

const VARIABLE_PATTERN = /\{\{\s*[\w.-]+\s*\}\}/;

function pct(part, whole) {
    if (!whole) return 0;
    return Math.max(0, Math.min(100, Math.round((part / whole) * 100)));
}

function isNonEmpty(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function hostOf(url) {
    if (!isNonEmpty(url)) return '';
    // Strip {{vars}} first so a templated base URL still yields a host when possible.
    const cleaned = url.replace(/\{\{[^}]*\}\}/g, '');
    const match = cleaned.match(/^[a-zA-Z][\w+.-]*:\/\/([^/?#:]+)/);
    return match ? match[1].toLowerCase() : '';
}

function enabledEntries(list) {
    if (!Array.isArray(list)) return [];
    return list.filter((entry) => entry && entry.enabled !== false);
}

function hasAuth(request) {
    const cfg = request?.authConfig;
    if (cfg && typeof cfg === 'object') {
        const type = cfg.type || cfg.authType;
        if (isNonEmpty(type) && type.toLowerCase() !== 'none' && type.toLowerCase() !== 'noauth') {
            return true;
        }
        // Some imported collections store credentials without a type field.
        if (Object.keys(cfg).some((k) => isNonEmpty(cfg[k]))) return true;
    }
    return enabledEntries(request?.headers).some((h) => {
        const name = String(h.key || h.name || '').toLowerCase();
        return name === 'authorization' || name === 'x-api-key' || name === 'api-key';
    });
}

function usesVariables(request) {
    const parts = [
        request?.url,
        ...enabledEntries(request?.headers).map((h) => h.value),
        ...enabledEntries(request?.params).map((p) => p.value),
        request?.body
    ];
    return parts.some((p) => isNonEmpty(p) && VARIABLE_PATTERN.test(p));
}

function isWrite(request) {
    return WRITE_METHODS.includes(String(request?.method || '').toUpperCase());
}

/**
 * Raw, transparent per-collection metrics. Everything downstream reads these,
 * so the UI can show the same numbers the score was derived from.
 */
function computeMetrics(collection, context = {}) {
    const requests = Array.isArray(collection?.requests) ? collection.requests : [];
    const total = requests.length;

    const documented = requests.filter((r) => isNonEmpty(r?.description)).length;
    const writeRequests = requests.filter(isWrite);
    const authed = requests.filter(hasAuth);
    const authedWrites = writeRequests.filter(hasAuth);
    const varUsing = requests.filter(usesVariables);
    const tested = requests.filter((r) => isNonEmpty(r?.testScript) || isNonEmpty(r?.tests));
    const namedUrls = requests.filter((r) => isNonEmpty(r?.name) && isNonEmpty(r?.url));

    const monitors = Array.isArray(context.monitors) ? context.monitors : [];
    const collectionHosts = new Set(requests.map((r) => hostOf(r?.url)).filter(Boolean));
    const collectionId = String(collection?._id || '');
    const collectionName = String(collection?.name || '').trim().toLowerCase();
    // ponytail: monitors have no collection FK, so they are linked by explicit
    // collectionId/tag, then by request host. Collections whose URLs are fully
    // templated ({{baseUrl}}/x) have no resolvable host — tag the monitor with
    // the collection id or name to link those. Add a real FK if this gets noisy.
    const linkedMonitors = monitors.filter((m) => {
        const tags = Array.isArray(m?.tags) ? m.tags.map((t) => String(t).trim().toLowerCase()) : [];
        if (collectionId && tags.includes(collectionId.toLowerCase())) return true;
        if (collectionName && tags.includes(collectionName)) return true;
        if (m?.collectionId && String(m.collectionId) === collectionId) return true;
        const host = hostOf(m?.url);
        return Boolean(host) && collectionHosts.has(host);
    });
    const activeMonitors = linkedMonitors.filter((m) => m?.isActive !== false);
    const upMonitors = activeMonitors.filter((m) => m?.currentStatus === 'up');

    const environments = Array.isArray(context.environments) ? context.environments : [];
    const versions = Array.isArray(context.versions) ? context.versions : [];
    const auditEventCount = Number(context.auditEventCount || 0);

    const docContent = collection?.documentation?.content;
    const variables = Array.isArray(collection?.variables) ? collection.variables : [];
    const secretsMarked = variables.filter((v) => v?.isSecret).length;
    const secretLooking = variables.filter((v) => /secret|token|key|password|pwd/i.test(String(v?.key || ''))).length;

    return {
        requestCount: total,
        documentedCount: documented,
        documentedPercent: pct(documented, total),
        hasCollectionDocs: isNonEmpty(docContent),
        hasDescription: isNonEmpty(collection?.description),

        writeRequestCount: writeRequests.length,
        authedCount: authed.length,
        authCoveragePercent: pct(authed.length, total),
        unauthenticatedWriteCount: writeRequests.length - authedWrites.length,

        variableUsageCount: varUsing.length,
        variableUsagePercent: pct(varUsing.length, total),
        testedCount: tested.length,
        wellFormedCount: namedUrls.length,

        environmentCount: environments.length,
        environmentNames: environments.map((e) => e?.name).filter(Boolean),

        monitorCount: linkedMonitors.length,
        activeMonitorCount: activeMonitors.length,
        upMonitorCount: upMonitors.length,
        monitoringStatus: linkedMonitors.length === 0
            ? 'none'
            : activeMonitors.length === 0
                ? 'paused'
                : upMonitors.length === activeMonitors.length
                    ? 'up'
                    : upMonitors.length === 0 ? 'down' : 'degraded',

        versionCount: versions.length,
        deprecatedVersionCount: versions.filter((v) => v?.isDeprecated).length,
        collectionVersion: collection?.version || '',
        auditEventCount,
        secretVariablesMarked: secretsMarked,
        secretVariablesUnmarked: Math.max(0, secretLooking - secretsMarked),

        lastUpdated: collection?.updatedAt || collection?.createdAt || null
    };
}

function scoreCategories(m) {
    // Documentation — endpoint descriptions dominate, collection-level docs top it up.
    const documentation = m.requestCount === 0
        ? (m.hasCollectionDocs ? 40 : 0)
        : Math.round(
            m.documentedPercent * 0.7 +
            (m.hasCollectionDocs ? 20 : 0) +
            (m.hasDescription ? 10 : 0)
        );

    // Security — overall auth coverage, with unauthenticated writes penalised hard.
    const writePenalty = m.writeRequestCount === 0
        ? 0
        : Math.round((m.unauthenticatedWriteCount / m.writeRequestCount) * 40);
    const security = m.requestCount === 0
        ? 0
        : Math.max(0, Math.round(m.authCoveragePercent * 0.7 + 30) - writePenalty - (m.secretVariablesUnmarked > 0 ? 10 : 0));

    // Request configuration quality — variables instead of hardcoded values, tests, complete requests.
    const requestQuality = m.requestCount === 0
        ? 0
        : Math.round(
            m.variableUsagePercent * 0.4 +
            pct(m.testedCount, m.requestCount) * 0.3 +
            pct(m.wellFormedCount, m.requestCount) * 0.2 +
            Math.min(m.environmentCount, 2) * 5
        );

    // Monitoring — any coverage is worth a lot; healthy coverage is worth full marks.
    let monitoring = 0;
    if (m.activeMonitorCount > 0) {
        monitoring = 60 + Math.round(pct(m.upMonitorCount, m.activeMonitorCount) * 0.4);
    } else if (m.monitorCount > 0) {
        monitoring = 30;
    }

    // Versioning / change tracking.
    const versioning = Math.min(100,
        (m.versionCount > 0 ? 55 : 0) +
        (m.versionCount > 1 ? 20 : 0) +
        (isNonEmpty(m.collectionVersion) ? 15 : 0) +
        (m.deprecatedVersionCount > 0 ? 10 : 0)
    );

    // Compliance signals — audit trail activity and secret hygiene.
    const compliance = Math.min(100,
        (m.auditEventCount > 0 ? 40 : 0) +
        (m.auditEventCount >= 5 ? 20 : 0) +
        (m.secretVariablesUnmarked === 0 ? 25 : 0) +
        (m.environmentCount > 0 ? 15 : 0)
    );

    const clamp = (n) => Math.max(0, Math.min(100, Math.round(n) || 0));

    return {
        documentation: clamp(documentation),
        security: clamp(security),
        requestQuality: clamp(requestQuality),
        monitoring: clamp(monitoring),
        versioning: clamp(versioning),
        compliance: clamp(compliance)
    };
}

function overallScore(categories) {
    const total = Object.entries(CATEGORY_WEIGHTS)
        .reduce((sum, [key, weight]) => sum + (categories[key] || 0) * weight, 0);
    return Math.round(total / 100);
}

function buildRecommendations(m, categories) {
    const recs = [];
    const undocumented = m.requestCount - m.documentedCount;

    if (undocumented > 0) {
        recs.push({
            category: 'documentation',
            severity: undocumented > m.requestCount / 2 ? 'high' : 'medium',
            message: `Add documentation for ${undocumented} endpoint${undocumented === 1 ? '' : 's'}`
        });
    }
    if (!m.hasCollectionDocs) {
        recs.push({ category: 'documentation', severity: 'medium', message: 'Write collection-level documentation' });
    }
    if (m.unauthenticatedWriteCount > 0) {
        recs.push({
            category: 'security',
            severity: 'high',
            message: `Configure authentication for ${m.unauthenticatedWriteCount} write request${m.unauthenticatedWriteCount === 1 ? '' : 's'}`
        });
    }
    if (m.secretVariablesUnmarked > 0) {
        recs.push({
            category: 'security',
            severity: 'high',
            message: `Mark ${m.secretVariablesUnmarked} credential-like variable${m.secretVariablesUnmarked === 1 ? '' : 's'} as secret`
        });
    }
    if (m.environmentCount === 0) {
        recs.push({ category: 'requestQuality', severity: 'medium', message: 'Add a test environment' });
    }
    if (m.requestCount > 0 && m.variableUsagePercent < 50) {
        recs.push({
            category: 'requestQuality',
            severity: 'medium',
            message: `Replace hardcoded values with environment variables in ${m.requestCount - m.variableUsageCount} request${m.requestCount - m.variableUsageCount === 1 ? '' : 's'}`
        });
    }
    if (m.requestCount > 0 && m.testedCount === 0) {
        recs.push({ category: 'requestQuality', severity: 'medium', message: 'Add test scripts to validate responses' });
    }
    if (m.monitorCount === 0) {
        recs.push({ category: 'monitoring', severity: 'high', message: 'Enable monitoring' });
    } else if (m.activeMonitorCount === 0) {
        recs.push({ category: 'monitoring', severity: 'medium', message: 'Reactivate paused monitors' });
    } else if (m.upMonitorCount < m.activeMonitorCount) {
        recs.push({
            category: 'monitoring',
            severity: 'high',
            message: `Investigate ${m.activeMonitorCount - m.upMonitorCount} failing monitor${m.activeMonitorCount - m.upMonitorCount === 1 ? '' : 's'}`
        });
    }
    if (m.versionCount === 0) {
        recs.push({ category: 'versioning', severity: 'medium', message: 'Publish an API version to track changes' });
    }
    if (categories.compliance < 50) {
        recs.push({ category: 'compliance', severity: 'low', message: 'No recent audit activity recorded for this API' });
    }

    const order = { high: 0, medium: 1, low: 2 };
    return recs.sort((a, b) => order[a.severity] - order[b.severity]);
}

/**
 * @param {object} collection Raw collection document (with embedded requests).
 * @param {object} context { monitors, environments, versions, auditEventCount, workspaceName, ownerName }
 */
function scoreCollection(collection, context = {}) {
    const metrics = computeMetrics(collection, context);
    const categories = scoreCategories(metrics);
    const score = overallScore(categories);

    return {
        collectionId: String(collection?._id || ''),
        name: collection?.name || 'Untitled collection',
        workspaceId: context.workspaceId ? String(context.workspaceId) : (collection?.workspaceId ? String(collection.workspaceId) : null),
        workspaceName: context.workspaceName || 'Unassigned',
        ownerId: context.ownerId ? String(context.ownerId) : null,
        ownerName: context.ownerName || 'Unknown',
        score,
        grade: score >= 80 ? 'good' : score >= 50 ? 'fair' : 'poor',
        categories,
        metrics,
        recommendations: buildRecommendations(metrics, categories)
    };
}

/**
 * AsyncAPI coverage metrics — channel-documentation, server/environment,
 * message-schema, scenario/test, latest-test health. Returned as the
 * `metrics` object of scoreAsyncApiDocument. Pure, additive — does not touch
 * the existing collection path.
 */
function computeAsyncApiMetrics(doc, context = {}) {
    const servers = Array.isArray(doc?.servers) ? doc.servers : [];
    const channels = Array.isArray(doc?.channels) ? doc.channels : [];
    const messages = Array.isArray(doc?.messages) ? doc.messages : [];
    const operations = Array.isArray(doc?.operations) ? doc.operations : [];
    const scenarios = Array.isArray(context.scenarios) ? context.scenarios : [];
    const runs = Array.isArray(context.runs) ? context.runs : [];

    const documentedChannels = channels.filter((c) => isNonEmpty((c && c.description) || (c && c.name))).length;
    const documentedMessages = messages.filter((m) => isNonEmpty((m && (m.description || m.title)))).length;
    const schemaMessages = messages.filter((m) => m && m.payloadSchema && typeof m.payloadSchema === 'object' && Object.keys(m.payloadSchema).length > 0).length;
    const documentedOps = operations.filter((o) => isNonEmpty(o?.summary)).length;

    const hasServerEnv = servers.some((s) => s && /\{\{.*\}\}/.test(String(s.url || '')));
    const serverCount = servers.length;
    const lastRun = doc?.lastRun && doc.lastRun.result ? doc.lastRun : (runs.length ? { result: runs[0]?.status, ranAt: runs[0]?.createdAt } : null);
    const lastRunPassed = lastRun && (lastRun.result === 'passed');
    const lastRunFailed = lastRun && (lastRun.result === 'failed' || lastRun.result === 'error');
    const scenariosCount = scenarios.length;

    return {
        // Compatibility fields keep the shared governance table and summary
        // meaningful for AsyncAPI records as well as REST collections.
        requestCount: operations.length || channels.length || messages.length,
        documentedCount: documentedOps || documentedChannels || documentedMessages,
        documentedPercent: operations.length > 0
            ? pct(documentedOps, operations.length)
            : channels.length > 0 ? pct(documentedChannels, channels.length) : pct(documentedMessages, messages.length),
        authCoveragePercent: messageSchemaPercent,
        variableUsagePercent: hasServerEnv ? 100 : 0,
        monitorCount: runs.length > 0 || Boolean(lastRun) ? 1 : 0,
        monitoringStatus: !lastRun ? 'none' : lastRunFailed ? 'down' : lastRunPassed ? 'up' : 'degraded',
        lastUpdated: doc?.updatedAt || doc?.createdAt || null,
        channelCount: channels.length,
        messageCount: messages.length,
        operationCount: operations.length,
        documentedChannelCount: documentedChannels,
        documentedOperationCount: documentedOps,
        documentedMessageCount: documentedMessages,
        schemaMessageCount: schemaMessages,
        channelDocumentationPercent: pct(documentedChannels, channels.length),
        messageDocumentationPercent: pct(documentedMessages, messages.length),
        messageSchemaPercent: pct(schemaMessages, messages.length),
        operationDocumentationPercent: pct(documentedOps, operations.length),
        environmentCount: Number(context.environmentCount || 0),
        serverCount,
        usesEnvVariables: hasServerEnv,
        scenariosCount,
        hasRuns: runs.length > 0 || Boolean(lastRun),
        lastRunResult: lastRun?.result || null
    };
}

function scoreAsyncApiCategories(m) {
    const documentation = m.channelCount === 0 && m.messageCount === 0
        ? 0
        : Math.round(
            m.channelDocumentationPercent * 0.35 +
            m.messageDocumentationPercent * 0.2 +
            m.operationDocumentationPercent * 0.25 +
            m.messageSchemaPercent * 0.2
        );
    const security = m.channelCount === 0
        ? 0
        : Math.round(m.messageSchemaPercent * 0.4 + (m.usesEnvVariables ? 30 : 0) + Math.min(m.environmentCount, 2) * 5);
    const monitoring = m.hasRuns ? (m.lastRunResult === 'passed' ? 100 : m.lastRunResult === 'failed' ? 50 : 30) : 0;
    const versioning = 0; // AsyncAPI docs don't carry api-versions here yet.
    const requestQuality = Math.round(
        Math.min(m.scenariosCount, 5) * 12 +
        Math.min(m.messageSchemaPercent, 70) / 2
    );
    const compliance = m.usesEnvVariables ? 60 : 20;
    const clamp = (n) => Math.max(0, Math.min(100, Math.round(n) || 0));
    return {
        documentation: clamp(documentation),
        security: clamp(security),
        requestQuality: clamp(Math.min(100, requestQuality)),
        monitoring: clamp(monitoring),
        versioning: clamp(versioning),
        compliance: clamp(compliance)
    };
}

function buildAsyncApiRecommendations(m, categories) {
    const recs = [];
    if (m.channelCount > 0 && m.channelDocumentationPercent < 100) {
        recs.push({ category: 'documentation', severity: m.channelDocumentationPercent < 50 ? 'high' : 'medium',
            message: `Document ${m.channelCount - m.documentedChannelCount} channel${(m.channelCount - m.documentedChannelCount) === 1 ? '' : 's'}` });
    }
    if (m.messageCount > 0 && m.messageSchemaPercent < 100) {
        recs.push({ category: 'security', severity: 'high',
            message: `Add payload schemas to ${m.messageCount - m.schemaMessageCount} message${(m.messageCount - m.schemaMessageCount) === 1 ? '' : 's'}` });
    }
    if (!m.usesEnvVariables && m.serverCount > 0) {
        recs.push({ category: 'security', severity: 'medium',
            message: 'Replace hardcoded server URLs/secrets with environment variables' });
    }
    if (m.scenariosCount === 0) {
        recs.push({ category: 'requestQuality', severity: 'medium', message: 'Add a test scenario per channel' });
    }
    if (!m.hasRuns) {
        recs.push({ category: 'monitoring', severity: 'high', message: 'Run at least one AsyncAPI test' });
    } else if (m.lastRunResult === 'failed' || m.lastRunResult === 'error') {
        recs.push({ category: 'monitoring', severity: 'high', message: `Latest AsyncAPI test ${m.lastRunResult} — investigate` });
    }
    const order = { high: 0, medium: 1, low: 2 };
    return recs.sort((a, b) => order[a.severity] - order[b.severity]);
}

/**
 * Score an AsyncApiDocument. Shape parallels scoreCollection's return, but
 * carries a `type: 'asyncapi'` discriminant so consumers can tell REST
 * collections apart from event-driven specs in the same items[] array.
 */
function scoreAsyncApiDocument(doc, context = {}) {
    const metrics = computeAsyncApiMetrics(doc, context);
    const categories = scoreAsyncApiCategories(metrics);
    const score = overallScore(categories);
    return {
        type: 'asyncapi',
        collectionId: String(doc?._id || ''),
        documentId: String(doc?._id || ''),
        name: doc?.name || 'Untitled AsyncAPI document',
        workspaceId: context.workspaceId ? String(context.workspaceId) : (doc?.workspaceId ? String(doc.workspaceId) : null),
        workspaceName: context.workspaceName || 'Unassigned',
        ownerId: context.ownerId ? String(context.ownerId) : (doc?.owner ? String(doc.owner) : null),
        ownerName: context.ownerName || 'Unknown',
        score,
        grade: score >= 80 ? 'good' : score >= 50 ? 'fair' : 'poor',
        // The existing REST UI reads `categories` + `metrics`; keep both names.
        categories,
        metrics,
        recommendations: buildAsyncApiRecommendations(metrics, categories)
    };
}

module.exports = {
    CATEGORY_WEIGHTS,
    CATEGORY_LABELS,
    computeMetrics,
    scoreCategories,
    overallScore,
    buildRecommendations,
    scoreCollection,
    // AsyncAPI scoring — additive, new functions only.
    computeAsyncApiMetrics,
    scoreAsyncApiCategories,
    buildAsyncApiRecommendations,
    scoreAsyncApiDocument
};
