// routes/performanceTesting.js
const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const mongoose = require('mongoose');
const { ensureAuthenticated } = require('../middleware/auth');
const { getIO } = require('../utils/socket/socket-server');

const LoadTest = require('../models/LoadTest');
const LoadTestRun = require('../models/LoadTestRun');
const LoadTestRunner = require('../features/performance-testing/LoadTestRunner');
const PerformanceAnalyzer = require('../features/performance-testing/PerformanceAnalyzer');

// Single in-process runner (v1). In future, can be moved to a worker / queue.
const runner = new LoadTestRunner({ sampleIntervalMs: 1000 });
const analyzer = new PerformanceAnalyzer();

// Pipe live runner events to socket rooms: performance:run:<runId>
function broadcast(runId, event, payload) {
    try {
        const io = getIO && getIO();
        if (io) io.to(`performance:run:${runId}`).emit(event, payload);
    } catch { /* io not ready */ }
}
runner.on('tick', (d) => broadcast(d.runId, 'perf:tick', d));
runner.on('phase', (d) => broadcast(d.runId, 'perf:phase', d));
runner.on('done', (d) => broadcast(d.runId, 'perf:done', { runId: d.runId }));
runner.on('error', (d) => broadcast(d.runId, 'perf:error', d));

function toObjectId(id) {
    if (!id) return null;
    if (id instanceof mongoose.Types.ObjectId) return id;
    if (ObjectId.isValid(id)) return new mongoose.Types.ObjectId(id);
    return null;
}

function safeFileNamePart(v) {
    return String(v || '')
        .trim()
        .slice(0, 64)
        .replace(/[^a-z0-9-_]+/gi, '-');
}

function buildRunSummary(run) {
    return {
        _id: run._id.toString(),
        status: run.status,
        createdAt: run.createdAt,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        scenario: run.scenario ? {
            name: run.scenario.name,
            targetUrl: run.scenario.targetUrl,
            method: run.scenario.method
        } : null
    };
}

function buildJsonReport({ run, analysis }) {
    const metrics = run.metrics || null;
    const statusCodes = metrics?.http?.statusCodes && typeof metrics.http.statusCodes === 'object'
        ? metrics.http.statusCodes
        : {};
    const statusCodeRows = Object.entries(statusCodes)
        .map(([code, count]) => ({ code, count: Number(count) }))
        .filter(r => Number.isFinite(r.count))
        .sort((a, b) => b.count - a.count);

    return {
        generatedAt: new Date().toISOString(),
        run: buildRunSummary(run),
        scenario: run.scenario || null,
        metrics,
        analysis,
        statusCodes: statusCodeRows
    };
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function buildHtmlReport({ report }) {
    const k = report?.analysis?.kpis || {};
    const errs = report?.analysis?.errors || {};
    const rs = report?.analysis?.resourcesSummary || null;
    const insights = Array.isArray(report?.analysis?.insights) ? report.analysis.insights : [];

    const statusRows = Array.isArray(report?.statusCodes) ? report.statusCodes : [];

    const row = (label, value) => `
                <tr><td class="k">${escapeHtml(label)}</td><td class="v">${escapeHtml(value ?? '—')}</td></tr>
        `;

    const fmtPct = (n) => (typeof n === 'number' ? `${(n * 100).toFixed(2)}%` : '—');
    const fmtNum = (n, d = 2) => (typeof n === 'number' ? Number(n).toFixed(d) : '—');

    const title = `Performance Test Report - ${report?.run?._id?.slice(0, 8) || ''}`;

    return `<!doctype html>
<html>
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
        body { font-family: Inter, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 24px; color: #111; }
        h1 { margin: 0 0 8px 0; font-size: 22px; }
        .sub { color: #555; margin-bottom: 18px; }
        .card { border: 1px solid #ddd; border-radius: 10px; padding: 14px; margin: 12px 0; }
        .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        @media (max-width: 800px) { .grid { grid-template-columns: 1fr; } }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 8px 10px; border-bottom: 1px solid #eee; vertical-align: top; }
        td.k { width: 45%; color: #555; }
        td.v { font-weight: 600; }
        .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; border: 1px solid #ddd; font-size: 12px; color: #333; }
        .muted { color: #666; }
        .list { margin: 8px 0 0 0; padding-left: 18px; }
        .code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    </style>
</head>
<body>
    <h1>${escapeHtml(title)}</h1>
    <div class="sub">
        <span class="pill">${escapeHtml(report?.scenario?.method || 'GET')}</span>
        <span class="code">${escapeHtml(report?.scenario?.targetUrl || '')}</span>
        <div class="muted">Generated at ${escapeHtml(report?.generatedAt)}</div>
    </div>

    <div class="grid">
        <div class="card">
            <h2 style="margin:0 0 8px 0; font-size:16px;">KPIs</h2>
            <table>
                ${row('Avg RPS', fmtNum(k.avgRps, 1))}
                ${row('Total requests', k.totalRequests ?? '—')}
                ${row('P95 latency (ms)', fmtNum(k.p95LatencyMs, 2))}
                ${row('P99 latency (ms)', fmtNum(k.p99LatencyMs, 2))}
                ${row('Error rate', fmtPct(k.errorRate))}
                ${row('Throughput avg (bytes/s)', fmtNum(k.throughputAvgBytes, 0))}
            </table>
        </div>

        <div class="card">
            <h2 style="margin:0 0 8px 0; font-size:16px;">Errors</h2>
            <table>
                ${row('Errors', errs.errors ?? 0)}
                ${row('Timeouts', errs.timeouts ?? 0)}
                ${row('Non-2xx', errs.non2xx ?? 0)}
            </table>
        </div>
    </div>

    <div class="card">
        <h2 style="margin:0 0 8px 0; font-size:16px;">Resource summary (server running Pigeon)</h2>
        ${rs ? `
            <table>
                ${row('CPU user avg (%)', fmtNum(rs.cpu?.userAvgPct, 2))}
                ${row('CPU system avg (%)', fmtNum(rs.cpu?.systemAvgPct, 2))}
                ${row('RSS max (MB)', fmtNum(rs.memory?.rssMaxMb, 2))}
                ${row('Event loop p99 max (ms)', fmtNum(rs.eventLoopDelayMs?.p99MaxMs, 3))}
            </table>
        ` : '<div class="muted">No resource samples captured.</div>'}
    </div>

    <div class="card">
        <h2 style="margin:0 0 8px 0; font-size:16px;">Bottleneck hints</h2>
        ${insights.length > 0 ? `
            <ul class="list">
                ${insights.map(i => `<li><strong>${escapeHtml(i.type)}</strong> (${escapeHtml(i.severity)}): ${escapeHtml(i.message)}</li>`).join('')}
            </ul>
        ` : '<div class="muted">No strong bottleneck signals detected.</div>'}
    </div>

    <div class="card">
        <h2 style="margin:0 0 8px 0; font-size:16px;">Status codes</h2>
        ${statusRows.length > 0 ? `
            <table>
                ${statusRows.slice(0, 20).map(r => row(String(r.code), String(r.count))).join('')}
            </table>
        ` : '<div class="muted">No status code histogram available for this run.</div>'}
    </div>
</body>
</html>`;
}

// List load tests
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const ownerId = toObjectId(req.user.id);
        const tests = await LoadTest.find({ owner: ownerId }).sort({ createdAt: -1 }).lean();
        res.json(tests.map(t => ({ ...t, _id: t._id.toString(), owner: t.owner.toString() })));
    } catch (err) {
        console.error('List load tests error:', err);
        res.status(500).json({ message: 'Failed to list load tests' });
    }
});

// Create load test
router.post('/', ensureAuthenticated, async (req, res) => {
    try {
        const ownerId = toObjectId(req.user.id);
        const {
            name,
            description,
            targetUrl,
            method,
            headers,
            body,
            timeoutSeconds,
            phases,
            thresholds
        } = req.body || {};

        if (!name) return res.status(400).json({ message: 'name is required' });
        if (!targetUrl) return res.status(400).json({ message: 'targetUrl is required' });

        const test = await LoadTest.create({
            name,
            description: description || '',
            owner: ownerId,
            targetUrl,
            method: method || 'GET',
            headers: headers || {},
            body,
            timeoutSeconds: timeoutSeconds || 30,
            phases: Array.isArray(phases) ? phases : [],
            thresholds: thresholds || {}
        });

        res.status(201).json({ ...test.toObject(), _id: test._id.toString(), owner: test.owner.toString() });
    } catch (err) {
        console.error('Create load test error:', err);
        res.status(500).json({ message: 'Failed to create load test' });
    }
});

// Get load test
router.get('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const ownerId = toObjectId(req.user.id);
        const id = toObjectId(req.params.id);
        if (!id) return res.status(400).json({ message: 'Invalid id' });

        const test = await LoadTest.findOne({ _id: id, owner: ownerId }).lean();
        if (!test) return res.status(404).json({ message: 'Load test not found' });

        res.json({ ...test, _id: test._id.toString(), owner: test.owner.toString() });
    } catch (err) {
        console.error('Get load test error:', err);
        res.status(500).json({ message: 'Failed to fetch load test' });
    }
});

// Run a load test (async)
router.post('/:id/run', ensureAuthenticated, async (req, res) => {
    try {
        const ownerId = toObjectId(req.user.id);
        const id = toObjectId(req.params.id);
        if (!id) return res.status(400).json({ message: 'Invalid id' });

        const test = await LoadTest.findOne({ _id: id, owner: ownerId });
        if (!test) return res.status(404).json({ message: 'Load test not found' });

        const run = await LoadTestRun.create({
            loadTestId: test._id,
            owner: ownerId,
            status: 'queued',
            scenario: {
                name: test.name,
                targetUrl: test.targetUrl,
                method: test.method,
                headers: test.headers,
                body: test.body,
                timeoutSeconds: test.timeoutSeconds,
                phases: test.phases
            },
            thresholds: test.thresholds || {}
        });

        // Fire-and-forget execution
        (async () => {
            try {
                await LoadTestRun.updateOne(
                    { _id: run._id },
                    { $set: { status: 'running', startedAt: new Date() } }
                );

                const thresholds = test.thresholds || null;
                const result = await runner.runScenario(run._id.toString(), run.scenario);
                const analysis = analyzer.analyze(result.metrics, thresholds);

                await LoadTestRun.updateOne(
                    { _id: run._id },
                    {
                        $set: {
                            status: 'completed',
                            finishedAt: new Date(),
                            metrics: result.metrics,
                            analysis,
                            error: null
                        }
                    }
                );
            } catch (e) {
                await LoadTestRun.updateOne(
                    { _id: run._id },
                    {
                        $set: {
                            status: 'failed',
                            finishedAt: new Date(),
                            error: e?.message || String(e)
                        }
                    }
                );
            }
        })();

        res.status(202).json({ runId: run._id.toString(), status: 'queued' });
    } catch (err) {
        console.error('Run load test error:', err);
        res.status(500).json({ message: 'Failed to start load test run' });
    }
});

// Compare two runs (benchmarking)
// GET /api/performance-tests/runs/compare?baselineRunId=...&candidateRunId=...
router.get('/runs/compare', ensureAuthenticated, async (req, res) => {
    try {
        const ownerId = toObjectId(req.user.id);
        const baselineRunId = toObjectId(req.query.baselineRunId);
        const candidateRunId = toObjectId(req.query.candidateRunId);

        if (!baselineRunId || !candidateRunId) {
            return res.status(400).json({ message: 'baselineRunId and candidateRunId are required' });
        }

        const [baseline, candidate] = await Promise.all([
            LoadTestRun.findOne({ _id: baselineRunId, owner: ownerId }).lean(),
            LoadTestRun.findOne({ _id: candidateRunId, owner: ownerId }).lean()
        ]);

        if (!baseline || !candidate) return res.status(404).json({ message: 'Run not found' });
        if (!baseline.metrics || !candidate.metrics) {
            return res.status(400).json({ message: 'Both runs must have metrics to compare' });
        }

        const comparison = analyzer.compare(baseline.metrics, candidate.metrics);
        res.json({
            baseline: buildRunSummary(baseline),
            candidate: buildRunSummary(candidate),
            comparison
        });
    } catch (err) {
        console.error('Compare runs error:', err);
        res.status(500).json({ message: 'Failed to compare runs' });
    }
});

// Export a run report
// GET /api/performance-tests/runs/:runId/report?format=json|html
router.get('/runs/:runId/report', ensureAuthenticated, async (req, res) => {
    try {
        const ownerId = toObjectId(req.user.id);
        const runId = toObjectId(req.params.runId);
        if (!runId) return res.status(400).json({ message: 'Invalid runId' });

        const run = await LoadTestRun.findOne({ _id: runId, owner: ownerId }).lean();
        if (!run) return res.status(404).json({ message: 'Run not found' });

        const analysis = run.metrics ? analyzer.analyze(run.metrics) : (run.analysis || null);
        const report = buildJsonReport({ run, analysis });

        const format = String(req.query.format || 'json').toLowerCase();
        const baseName = safeFileNamePart(run.scenario?.name || 'load-test');
        const short = run._id.toString().slice(0, 8);

        if (format === 'html') {
            const html = buildHtmlReport({ report });
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${baseName}-${short}.html"`);
            return res.status(200).send(html);
        }

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${baseName}-${short}.json"`);
        return res.status(200).json(report);
    } catch (err) {
        console.error('Export report error:', err);
        res.status(500).json({ message: 'Failed to export report' });
    }
});

// Get run status/result
router.get('/runs/:runId', ensureAuthenticated, async (req, res) => {
    try {
        const ownerId = toObjectId(req.user.id);
        const runId = toObjectId(req.params.runId);
        if (!runId) return res.status(400).json({ message: 'Invalid runId' });

        const run = await LoadTestRun.findOne({ _id: runId, owner: ownerId }).lean();
        if (!run) return res.status(404).json({ message: 'Run not found' });

        res.json({
            ...run,
            _id: run._id.toString(),
            owner: run.owner.toString(),
            loadTestId: run.loadTestId.toString()
        });
    } catch (err) {
        console.error('Get run error:', err);
        res.status(500).json({ message: 'Failed to fetch run' });
    }
});

// List runs for a test
router.get('/:id/runs', ensureAuthenticated, async (req, res) => {
    try {
        const ownerId = toObjectId(req.user.id);
        const id = toObjectId(req.params.id);
        if (!id) return res.status(400).json({ message: 'Invalid id' });

        const runs = await LoadTestRun.find({ loadTestId: id, owner: ownerId }).sort({ createdAt: -1 }).limit(50).lean();
        res.json(runs.map(r => ({
            ...r,
            _id: r._id.toString(),
            owner: r.owner.toString(),
            loadTestId: r.loadTestId.toString()
        })));
    } catch (err) {
        console.error('List runs error:', err);
        res.status(500).json({ message: 'Failed to list runs' });
    }
});

// Historical trend: aggregated KPIs for the last N completed runs of a test (oldest → newest)
// GET /api/performance-tests/:id/trend?limit=20
router.get('/:id/trend', ensureAuthenticated, async (req, res) => {
    try {
        const ownerId = toObjectId(req.user.id);
        const id = toObjectId(req.params.id);
        if (!id) return res.status(400).json({ message: 'Invalid id' });

        const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
        const runs = await LoadTestRun
            .find({ loadTestId: id, owner: ownerId, status: 'completed', metrics: { $ne: null } })
            .sort({ createdAt: 1 }) // chronological
            .limit(limit)
            .lean();

        const points = runs.map(r => {
            const a = analyzer.analyze(r.metrics, r.thresholds || null);
            return {
                runId: r._id.toString(),
                createdAt: r.createdAt,
                p95LatencyMs: a.kpis.p95LatencyMs,
                p99LatencyMs: a.kpis.p99LatencyMs,
                avgRps: a.kpis.avgRps,
                errorRate: a.kpis.errorRate,
                apdexScore: a.kpis.apdexScore,
                passedGates: a.passedGates
            };
        });

        res.json({ testId: id.toString(), points });
    } catch (err) {
        console.error('Trend error:', err);
        res.status(500).json({ message: 'Failed to fetch trend' });
    }
});

// AI-style Root Cause Analysis (deterministic synthesis from analysis insights + KPIs)
// GET /api/performance-tests/runs/:runId/rca
router.get('/runs/:runId/rca', ensureAuthenticated, async (req, res) => {
    try {
        const ownerId = toObjectId(req.user.id);
        const runId = toObjectId(req.params.runId);
        if (!runId) return res.status(400).json({ message: 'Invalid runId' });

        const run = await LoadTestRun.findOne({ _id: runId, owner: ownerId }).lean();
        if (!run) return res.status(404).json({ message: 'Run not found' });

        if (run.status !== 'completed' || !run.metrics) {
            return res.status(400).json({ message: 'Run has no completed metrics to analyze' });
        }

        const analysis = analyzer.analyze(run.metrics, run.thresholds || null);
        const rca = buildRca(run, analysis);

        res.json({ runId: run._id.toString(), rca });
    } catch (err) {
        console.error('RCA error:', err);
        res.status(500).json({ message: 'Failed to generate RCA' });
    }
});

/**
 * Deterministic RCA synthesis. No external LLM — composes a structured,
 * honest summary from measured KPIs + analyzer insights. Marked so nobody
 * mistakes it for a generative-AI call.
 */
function buildRca(run, analysis) {
    const k = analysis.kpis || {};
    const insights = Array.isArray(analysis.insights) ? analysis.insights : [];
    const gates = Array.isArray(analysis.gates) ? analysis.gates : [];
    const rs = analysis.resourcesSummary || null;

    const verdict = (() => {
        if (gates.length === 0) return 'n/a';
        return analysis.passedGates ? 'pass' : 'fail';
    })();

    const lines = [];
    lines.push(`**Verdict:** ${verdict === 'pass' ? 'SLO gates passed' : verdict === 'fail' ? 'SLO gates failed' : 'No SLO gates configured'}.`);

    lines.push('**KPI snapshot:** '
        + `avg RPS ${fmtOrNull(k.avgRps, 1)}, `
        + `P95 ${fmtOrNull(k.p95LatencyMs, 0)} ms, `
        + `P99 ${fmtOrNull(k.p99LatencyMs, 0)} ms, `
        + `error rate ${fmtPct(k.errorRate)}, `
        + `Apdex ${fmtOrNull(k.apdexScore, 2)}.`);

    if (gates.length) {
        const failed = gates.filter(g => !g.passed);
        if (failed.length) {
            lines.push('**Gate failures:** ' + failed.map(g => `${g.label} ${g.limit} (got ${fmtOrNull(g.value, g.value < 1 ? 4 : 1)})`).join('; ') + '.');
        }
    }

    if (insights.length) {
        lines.push('**Likely causes:**');
        for (const i of insights) {
            lines.push(`- ${i.message}`);
        }
    } else if (k.errorRate !== null && k.errorRate > 0.01) {
        lines.push('- Elevated error rate with no single resource signal — inspect status-code breakdown and application logs.');
    } else {
        lines.push('No strong bottleneck signals detected from resource metrics during this run.');
    }

    if (rs) {
        const cpu = (rs.cpu?.userAvgPct ?? 0) + (rs.cpu?.systemAvgPct ?? 0);
        lines.push(`**Resources:** CPU avg ${fmtOrNull(cpu, 1)}%, RSS max ${fmtOrNull(rs.memory?.rssMaxMb, 0)} MB, event-loop p99 max ${fmtOrNull(rs.eventLoopDelayMs?.p99MaxMs, 2)} ms.`);
    }

    return { verdict, summary: lines.join('\n\n'), kpis: k, gates, insights, resourcesSummary: rs, generatedBy: 'deterministic' };
}

function fmtOrNull(n, d = 2) {
    return typeof n === 'number' && Number.isFinite(n) ? n.toFixed(d) : '—';
}
function fmtPct(n) {
    return typeof n === 'number' && Number.isFinite(n) ? `${(n * 100).toFixed(2)}%` : '—';
}

module.exports = router;
