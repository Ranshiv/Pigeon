// features/performance-testing/MetricsCollector.js

/**
 * Aggregates load test result metrics and resource monitor samples.
 */
class MetricsCollector {
    constructor(options = {}) {
        this.resourceMonitor = options.resourceMonitor;
    }

    start() {
        if (this.resourceMonitor) this.resourceMonitor.start();
    }

    stop() {
        if (this.resourceMonitor) this.resourceMonitor.stop();
    }

    reset() {
        if (this.resourceMonitor) this.resourceMonitor.reset();
    }

    buildMetrics({ autocannonResult }) {
        const resources = this.resourceMonitor ? this.resourceMonitor.getSamples() : [];

        const statusCodes = autocannonResult?.statusCodes && typeof autocannonResult.statusCodes === 'object'
            ? autocannonResult.statusCodes
            : {};

        return {
            summary: {
                start: autocannonResult?.start || null,
                finish: autocannonResult?.finish || null,
                durationSeconds: autocannonResult?.duration || null,
                connections: autocannonResult?.connections || null,
                pipelining: autocannonResult?.pipelining || null
            },
            http: {
                requests: autocannonResult?.requests || {},
                latency: autocannonResult?.latency || {},
                throughput: autocannonResult?.throughput || {},
                errors: autocannonResult?.errors || 0,
                timeouts: autocannonResult?.timeouts || 0,
                mismatches: autocannonResult?.mismatches || 0,
                non2xx: autocannonResult?.non2xx || 0,
                resets: autocannonResult?.resets || 0,
                statusCodes
            },
            resources
        };
    }
}

module.exports = MetricsCollector;
