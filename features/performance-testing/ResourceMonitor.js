// features/performance-testing/ResourceMonitor.js
const os = require('os');
const { monitorEventLoopDelay } = require('perf_hooks');

/**
 * Lightweight resource monitor for server-side metrics during a load test run.
 *
 * Note: this only monitors the machine running Pigeon (not the target API unless it's local).
 */
class ResourceMonitor {
    constructor(options = {}) {
        this.sampleIntervalMs = options.sampleIntervalMs || 1000;
        this._timer = null;
        this._samples = [];
        this._eventLoop = monitorEventLoopDelay({ resolution: 20 });
        this._lastCpu = process.cpuUsage();
        this._lastWall = process.hrtime.bigint();
    }

    start() {
        if (this._timer) return;
        this._eventLoop.enable();

        this._timer = setInterval(() => {
            this._samples.push(this._captureSample());
        }, this.sampleIntervalMs);

        // Don't keep the process alive just for monitoring.
        if (this._timer.unref) this._timer.unref();
    }

    stop() {
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
        try {
            this._eventLoop.disable();
        } catch {
            // ignore
        }
    }

    reset() {
        this._samples = [];
        this._lastCpu = process.cpuUsage();
        this._lastWall = process.hrtime.bigint();
        this._eventLoop.reset();
    }

    getSamples() {
        return this._samples;
    }

    _captureSample() {
        const now = Date.now();

        // CPU % estimation since last sample
        const cpu = process.cpuUsage(this._lastCpu);
        const wallNow = process.hrtime.bigint();
        const wallMicros = Number(wallNow - this._lastWall) / 1000;
        this._lastCpu = process.cpuUsage();
        this._lastWall = wallNow;

        const cpuUserPct = wallMicros > 0 ? (cpu.user / wallMicros) * 100 : 0;
        const cpuSystemPct = wallMicros > 0 ? (cpu.system / wallMicros) * 100 : 0;

        const mem = process.memoryUsage();

        // event loop delay stats (nanoseconds)
        const el = this._eventLoop;
        const elMeanMs = el.mean / 1e6;
        const elP99Ms = el.percentile(99) / 1e6;

        return {
            ts: now,
            cpu: {
                userPct: Number(cpuUserPct.toFixed(2)),
                systemPct: Number(cpuSystemPct.toFixed(2))
            },
            memory: {
                rss: mem.rss,
                heapUsed: mem.heapUsed,
                heapTotal: mem.heapTotal,
                external: mem.external
            },
            system: {
                loadavg: os.loadavg(),
                freemem: os.freemem(),
                totalmem: os.totalmem(),
                uptime: os.uptime()
            },
            eventLoopDelayMs: {
                mean: Number(elMeanMs.toFixed(3)),
                p99: Number(elP99Ms.toFixed(3))
            }
        };
    }
}

module.exports = ResourceMonitor;
