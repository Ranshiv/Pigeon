// features/performance-testing/PerformanceAnalyzer.js

/**
 * Basic performance analysis utilities.
 *
 * Autocannon already provides latency/throughput percentiles.
 * This class standardizes a report and supports comparing runs.
 */
class PerformanceAnalyzer {
    analyze(metrics, thresholds = null) {
        const http = metrics?.http || {};
        const latency = http.latency || {};
        const requests = http.requests || {};
        const throughput = http.throughput || {};
        const resources = Array.isArray(metrics?.resources) ? metrics.resources : [];

        const avgRps = requests.average || null;
        const p99Latency = latency.p99 || latency['99'] || null;
        const p95Latency = latency.p95 || latency['95'] || null;

        const errorCount = http.errors || 0;
        const timeoutCount = http.timeouts || 0;
        const non2xx = http.non2xx || 0;

        const totalRequests = requests.total || null;
        const errorRate = totalRequests ? (errorCount + timeoutCount + non2xx) / totalRequests : null;

        const resourcesSummary = this._summarizeResources(resources);
        const insights = this._bottleneckInsights({
            kpis: {
                avgRps,
                totalRequests,
                p95LatencyMs: p95Latency,
                p99LatencyMs: p99Latency,
                avgLatencyMs: latency.average || null,
                maxLatencyMs: latency.max || null,
                throughputAvgBytes: throughput.average || null,
                throughputMaxBytes: throughput.max || null,
                errorRate
            },
            errors: { errors: errorCount, timeouts: timeoutCount, non2xx },
            resourcesSummary
        });

        // SLO / Quality gates: evaluate thresholds if provided.
        const gates = thresholds ? this._evaluateGates({ p95Latency, p99Latency, errorRate, avgRps }, thresholds) : null;
        const apdexScore = this._apdex(latency, metrics);

        return {
            kpis: {
                avgRps,
                totalRequests,
                p95LatencyMs: p95Latency,
                p99LatencyMs: p99Latency,
                avgLatencyMs: latency.average || null,
                maxLatencyMs: latency.max || null,
                throughputAvgBytes: throughput.average || null,
                throughputMaxBytes: throughput.max || null,
                errorRate,
                apdexScore
            },
            errors: {
                errors: errorCount,
                timeouts: timeoutCount,
                non2xx
            },
            resourcesSummary,
            insights,
            gates,
            passedGates: gates ? gates.every(g => g.passed) : null,
            raw: {
                requests,
                latency,
                throughput
            }
        };
    }

    /**
     * SLO evaluation. thresholds shape (per LoadTest schema):
     * { p95LatencyMs, p99LatencyMs, errorRate, minRps }
     * A gate passes when the metric is within its limit.
     */
    _evaluateGates(measured, thresholds) {
        const gates = [];
        const checks = [
            { key: 'p95LatencyMs', op: 'max', value: measured.p95LatencyMs, label: 'P95 latency ≤' },
            { key: 'p99LatencyMs', op: 'max', value: measured.p99LatencyMs, label: 'P99 latency ≤' },
            { key: 'errorRate', op: 'max', value: measured.errorRate, label: 'Error rate ≤' },
            { key: 'minRps', op: 'min', value: measured.avgRps, label: 'Avg RPS ≥' }
        ];

        for (const c of checks) {
            const limit = thresholds?.[c.key];
            if (limit === null || limit === undefined) continue;
            if (c.value === null || c.value === undefined) {
                gates.push({ metric: c.key, label: c.label, limit, value: null, passed: false, reason: 'no_data' });
                continue;
            }
            const passed = c.op === 'max' ? c.value <= limit : c.value >= limit;
            gates.push({ metric: c.key, label: c.label, limit, value: c.value, passed });
        }
        return gates;
    }

    /**
     * Apdex (Application Performance Index): satisfying = T, tolerable = 4T, frustrating = >4T.
     * T defaults to 100ms (p95-latency-oriented). Uses latency histogram if available.
     * ponytail: no latency histogram per-bucket counts available, so approximate via distribution
     * skew. Add actual histogram at metrics.http.histogram to make this exact.
     */
    _apdex(latency, metrics, T = 100) {
        const p50 = latency?.p50 ?? latency?.average ?? null;
        const p95 = latency?.p95 ?? null;
        const p99 = latency?.p99 ?? null;
        if (p50 === null) return null;
        // Estimate: satisfied share = p50 node, tolerable = (p95 - p50), frustrated = (p99 - p95).
        const s = Math.max(0, 1 - (p95 !== null ? (p95 - p50) / Math.max(p50, 1) : 0));
        const f = (p99 !== null && p99 > 4 * T) ? Math.max(0, Math.min(1, (p99 - 4 * T) / Math.max(p99, 1))) : 0;
        const score = Number(Math.max(0, Math.min(1, s - f / 2)).toFixed(3));
        return score;
    }

    compare(a, b) {
        const A = this.analyze(a);
        const B = this.analyze(b);

        return {
            a: A,
            b: B,
            delta: {
                avgRps: this._delta(A.kpis.avgRps, B.kpis.avgRps),
                p95LatencyMs: this._delta(A.kpis.p95LatencyMs, B.kpis.p95LatencyMs),
                p99LatencyMs: this._delta(A.kpis.p99LatencyMs, B.kpis.p99LatencyMs),
                throughputAvgBytes: this._delta(A.kpis.throughputAvgBytes, B.kpis.throughputAvgBytes),
                errorRate: this._delta(A.kpis.errorRate, B.kpis.errorRate),
                resources: {
                    cpuUserAvgPct: this._delta(A.resourcesSummary?.cpu?.userAvgPct, B.resourcesSummary?.cpu?.userAvgPct),
                    cpuSystemAvgPct: this._delta(A.resourcesSummary?.cpu?.systemAvgPct, B.resourcesSummary?.cpu?.systemAvgPct),
                    rssMaxMb: this._delta(A.resourcesSummary?.memory?.rssMaxMb, B.resourcesSummary?.memory?.rssMaxMb),
                    eventLoopP99MaxMs: this._delta(A.resourcesSummary?.eventLoopDelayMs?.p99MaxMs, B.resourcesSummary?.eventLoopDelayMs?.p99MaxMs)
                }
            }
        };
    }

    _summarizeResources(resources) {
        if (!Array.isArray(resources) || resources.length === 0) return null;

        const nums = (arr) => arr.filter(v => typeof v === 'number' && Number.isFinite(v));
        const avg = (arr) => {
            const n = nums(arr);
            if (n.length === 0) return null;
            return n.reduce((s, v) => s + v, 0) / n.length;
        };
        const max = (arr) => {
            const n = nums(arr);
            if (n.length === 0) return null;
            return Math.max(...n);
        };

        const cpuUser = resources.map(s => s?.cpu?.userPct);
        const cpuSystem = resources.map(s => s?.cpu?.systemPct);
        const rssMb = resources.map(s => (typeof s?.memory?.rss === 'number' ? s.memory.rss / (1024 * 1024) : null));
        const heapUsedMb = resources.map(s => (typeof s?.memory?.heapUsed === 'number' ? s.memory.heapUsed / (1024 * 1024) : null));
        const elMean = resources.map(s => s?.eventLoopDelayMs?.mean);
        const elP99 = resources.map(s => s?.eventLoopDelayMs?.p99);

        return {
            samples: resources.length,
            cpu: {
                userAvgPct: avg(cpuUser) === null ? null : Number(avg(cpuUser).toFixed(2)),
                userMaxPct: max(cpuUser) === null ? null : Number(max(cpuUser).toFixed(2)),
                systemAvgPct: avg(cpuSystem) === null ? null : Number(avg(cpuSystem).toFixed(2)),
                systemMaxPct: max(cpuSystem) === null ? null : Number(max(cpuSystem).toFixed(2))
            },
            memory: {
                rssMaxMb: max(rssMb) === null ? null : Number(max(rssMb).toFixed(2)),
                heapUsedMaxMb: max(heapUsedMb) === null ? null : Number(max(heapUsedMb).toFixed(2))
            },
            eventLoopDelayMs: {
                meanAvgMs: avg(elMean) === null ? null : Number(avg(elMean).toFixed(3)),
                p99MaxMs: max(elP99) === null ? null : Number(max(elP99).toFixed(3))
            }
        };
    }

    _bottleneckInsights({ kpis, errors, resourcesSummary }) {
        const insights = [];

        if (!resourcesSummary) return insights;

        const cpuTotalAvg = (resourcesSummary.cpu?.userAvgPct ?? 0) + (resourcesSummary.cpu?.systemAvgPct ?? 0);
        const elP99 = resourcesSummary.eventLoopDelayMs?.p99MaxMs;
        const rssMax = resourcesSummary.memory?.rssMaxMb;

        // Heuristics (v1): keep these conservative to avoid false positives.
        if (Number.isFinite(cpuTotalAvg) && cpuTotalAvg >= 80) {
            insights.push({
                type: 'cpu_saturation',
                severity: cpuTotalAvg >= 95 ? 'high' : 'medium',
                message: 'High average CPU usage during the run. The server may be CPU-saturated.',
                evidence: { cpuUserAvgPct: resourcesSummary.cpu?.userAvgPct, cpuSystemAvgPct: resourcesSummary.cpu?.systemAvgPct }
            });
        }

        if (Number.isFinite(elP99) && elP99 >= 100) {
            insights.push({
                type: 'event_loop_delay',
                severity: elP99 >= 250 ? 'high' : 'medium',
                message: 'High event loop delay observed. This often indicates synchronous work, GC pressure, or I/O backpressure.',
                evidence: { eventLoopP99MaxMs: elP99 }
            });
        }

        // If error rate is notable, call it out.
        if (typeof kpis?.errorRate === 'number' && kpis.errorRate >= 0.01) {
            insights.push({
                type: 'error_rate',
                severity: kpis.errorRate >= 0.05 ? 'high' : 'medium',
                message: 'Non-trivial error rate detected (errors + timeouts + non-2xx). Investigate status code breakdown and logs.',
                evidence: { errorRate: kpis.errorRate, ...errors }
            });
        }

        // Memory pressure indicator (very rough): if RSS is high and latency p99 is high.
        if (Number.isFinite(rssMax) && typeof kpis?.p99LatencyMs === 'number' && kpis.p99LatencyMs >= 1500 && rssMax >= 512) {
            insights.push({
                type: 'memory_pressure',
                severity: 'medium',
                message: 'High RSS alongside high tail latency. Potential GC pressure, memory growth, or large payloads.',
                evidence: { rssMaxMb: rssMax, p99LatencyMs: kpis.p99LatencyMs }
            });
        }

        return insights;
    }

    _delta(a, b) {
        if (a === null || a === undefined || b === null || b === undefined) return null;
        if (typeof a !== 'number' || typeof b !== 'number') return null;
        const abs = b - a;
        const pct = a !== 0 ? (abs / a) * 100 : null;
        return { abs, pct };
    }
}

module.exports = PerformanceAnalyzer;
