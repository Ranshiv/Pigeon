// features/performance-testing/LoadTestRunner.js
const autocannon = require('autocannon');
const VirtualUserSimulator = require('./VirtualUserSimulator');
const ResourceMonitor = require('./ResourceMonitor');
const MetricsCollector = require('./MetricsCollector');
const PerformanceAnalyzer = require('./PerformanceAnalyzer');

/**
 * Runs a load test scenario using autocannon.
 *
 * Initial implementation:
 * - sequential phases (ramp patterns)
 * - collects server resource samples during the run
 */
class LoadTestRunner {
    constructor(options = {}) {
        this.simulator = new VirtualUserSimulator();
        this.resourceMonitor = new ResourceMonitor({
            sampleIntervalMs: options.sampleIntervalMs || 1000
        });
        this.metricsCollector = new MetricsCollector({ resourceMonitor: this.resourceMonitor });
        this.analyzer = new PerformanceAnalyzer();

        this._runs = new Map(); // runId -> { status, result }
    }

    getRun(runId) {
        return this._runs.get(runId) || null;
    }

    async runScenario(runId, scenarioInput) {
        const scenario = this.simulator.normalizeScenario(scenarioInput);

        this.metricsCollector.reset();
        this.metricsCollector.start();

        this._runs.set(runId, { status: 'running', startedAt: new Date(), scenario });

        try {
            // Run each phase sequentially and merge results.
            const phaseResults = [];
            for (const phase of scenario.phases) {
                const res = await this._runPhase(scenario, phase);
                phaseResults.push(res);
            }

            const merged = this._mergeAutocannonResults(phaseResults);
            const metrics = this.metricsCollector.buildMetrics({ autocannonResult: merged });
            const analysis = this.analyzer.analyze(metrics);

            const finalResult = {
                scenario,
                metrics,
                analysis,
                phases: phaseResults
            };

            this._runs.set(runId, { status: 'completed', finishedAt: new Date(), scenario, result: finalResult });
            return finalResult;
        } catch (err) {
            this._runs.set(runId, { status: 'failed', finishedAt: new Date(), scenario, error: err?.message || String(err) });
            throw err;
        } finally {
            this.metricsCollector.stop();
        }
    }

    _runPhase(scenario, phase) {
        const timeout = (scenario.timeoutSeconds || 30) * 1000;

        // Autocannon expects:
        //  - url
        //  - connections
        //  - duration (seconds)
        //  - pipelining
        //  - method/headers/body for requests
        const options = {
            url: scenario.targetUrl,
            connections: phase.connections,
            duration: phase.durationSeconds,
            pipelining: phase.pipelining,
            timeout,
            method: scenario.method,
            headers: scenario.headers,
            // Collect status code histogram (e.g. {"200": 1200, "302": 50, "403": 10})
            trackStatusCodes: true
        };

        if (scenario.body !== undefined) {
            options.body = scenario.body;
        }

        return new Promise((resolve, reject) => {
            autocannon(options, (err, result) => {
                if (err) return reject(err);
                return resolve(result);
            });
        });
    }

    _mergeAutocannonResults(results) {
        if (!results || results.length === 0) return {};
        if (results.length === 1) return results[0];

        // Conservative merge strategy: sum totals, average averages weighted by total requests.
        const merged = {
            start: results[0].start,
            finish: results[results.length - 1].finish,
            duration: results.reduce((s, r) => s + (r.duration || 0), 0),
            connections: Math.max(...results.map(r => r.connections || 0)),
            pipelining: Math.max(...results.map(r => r.pipelining || 0)),
            errors: results.reduce((s, r) => s + (r.errors || 0), 0),
            timeouts: results.reduce((s, r) => s + (r.timeouts || 0), 0),
            mismatches: results.reduce((s, r) => s + (r.mismatches || 0), 0),
            non2xx: results.reduce((s, r) => s + (r.non2xx || 0), 0),
            resets: results.reduce((s, r) => s + (r.resets || 0), 0)
        };

        // Status codes histogram
        const statusCodes = {};
        for (const r of results) {
            const map = r?.statusCodes;
            if (!map || typeof map !== 'object') continue;
            for (const [code, count] of Object.entries(map)) {
                const n = Number(count);
                if (!Number.isFinite(n)) continue;
                statusCodes[code] = (statusCodes[code] || 0) + n;
            }
        }
        if (Object.keys(statusCodes).length > 0) {
            merged.statusCodes = statusCodes;
        }

        const totalRequests = results.reduce((s, r) => s + (r.requests?.total || 0), 0);

        const weightedAvg = (path) => {
            if (!totalRequests) return null;
            let acc = 0;
            for (const r of results) {
                const w = r.requests?.total || 0;
                const v = path(r);
                if (typeof v === 'number') acc += v * w;
            }
            return acc / totalRequests;
        };

        // Requests
        merged.requests = {
            total: totalRequests,
            average: weightedAvg(r => r.requests?.average),
            mean: weightedAvg(r => r.requests?.mean),
            stddev: weightedAvg(r => r.requests?.stddev),
            min: Math.min(...results.map(r => r.requests?.min ?? Number.POSITIVE_INFINITY)),
            max: Math.max(...results.map(r => r.requests?.max ?? 0)),
            p50: weightedAvg(r => r.requests?.p50),
            p75: weightedAvg(r => r.requests?.p75),
            p90: weightedAvg(r => r.requests?.p90),
            p95: weightedAvg(r => r.requests?.p95),
            p99: weightedAvg(r => r.requests?.p99)
        };

        // Latency (ms)
        merged.latency = {
            average: weightedAvg(r => r.latency?.average),
            mean: weightedAvg(r => r.latency?.mean),
            stddev: weightedAvg(r => r.latency?.stddev),
            min: Math.min(...results.map(r => r.latency?.min ?? Number.POSITIVE_INFINITY)),
            max: Math.max(...results.map(r => r.latency?.max ?? 0)),
            p50: weightedAvg(r => r.latency?.p50),
            p75: weightedAvg(r => r.latency?.p75),
            p90: weightedAvg(r => r.latency?.p90),
            p95: weightedAvg(r => r.latency?.p95),
            p99: weightedAvg(r => r.latency?.p99)
        };

        // Throughput (bytes/sec)
        merged.throughput = {
            average: weightedAvg(r => r.throughput?.average),
            mean: weightedAvg(r => r.throughput?.mean),
            stddev: weightedAvg(r => r.throughput?.stddev),
            min: Math.min(...results.map(r => r.throughput?.min ?? Number.POSITIVE_INFINITY)),
            max: Math.max(...results.map(r => r.throughput?.max ?? 0)),
            p50: weightedAvg(r => r.throughput?.p50),
            p75: weightedAvg(r => r.throughput?.p75),
            p90: weightedAvg(r => r.throughput?.p90),
            p95: weightedAvg(r => r.throughput?.p95),
            p99: weightedAvg(r => r.throughput?.p99)
        };

        return merged;
    }
}

module.exports = LoadTestRunner;
