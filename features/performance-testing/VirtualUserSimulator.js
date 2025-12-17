// features/performance-testing/VirtualUserSimulator.js

/**
 * Translates a high-level load test scenario into autocannon-compatible phases.
 *
 * Supported scenario shape (initial implementation):
 * {
 *   targetUrl: string,
 *   method?: string,
 *   headers?: object,
 *   body?: string,
 *   timeoutSeconds?: number,
 *   phases: [{ durationSeconds: number, connections: number, pipelining?: number }]
 * }
 */
class VirtualUserSimulator {
    normalizeScenario(scenario) {
        if (!scenario || typeof scenario !== 'object') {
            throw new Error('Scenario is required');
        }
        if (!scenario.targetUrl) {
            throw new Error('scenario.targetUrl is required');
        }

        const phases = Array.isArray(scenario.phases) && scenario.phases.length > 0
            ? scenario.phases
            : [{ durationSeconds: 10, connections: 10, pipelining: 1 }];

        const normalizedPhases = phases.map((p, idx) => {
            if (!p || typeof p !== 'object') {
                throw new Error(`phase[${idx}] must be an object`);
            }
            const durationSeconds = Number(p.durationSeconds);
            const connections = Number(p.connections);
            const pipelining = p.pipelining === undefined ? 1 : Number(p.pipelining);

            if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
                throw new Error(`phase[${idx}].durationSeconds must be > 0`);
            }
            if (!Number.isFinite(connections) || connections <= 0) {
                throw new Error(`phase[${idx}].connections must be > 0`);
            }
            if (!Number.isFinite(pipelining) || pipelining <= 0) {
                throw new Error(`phase[${idx}].pipelining must be > 0`);
            }

            return { durationSeconds, connections, pipelining };
        });

        return {
            name: scenario.name || 'Load Test',
            targetUrl: scenario.targetUrl,
            method: (scenario.method || 'GET').toUpperCase(),
            headers: scenario.headers || {},
            body: scenario.body,
            timeoutSeconds: scenario.timeoutSeconds || 30,
            phases: normalizedPhases
        };
    }
}

module.exports = VirtualUserSimulator;
