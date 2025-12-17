# Performance Testing & Load Generation (Initial Implementation)

This module adds **server-side** performance testing utilities using [`autocannon`](https://github.com/mcollina/autocannon).

## What’s implemented (so far)

- **Load test runner** (`LoadTestRunner.js`) that runs a scenario with multiple phases.
- **Virtual user simulation config** (`VirtualUserSimulator.js`) that validates/normalizes a scenario.
- **Resource monitoring** (`ResourceMonitor.js`) capturing:
  - process CPU% estimates
  - memory usage
  - event loop delay mean/p99
  - host load average / memory
- **Metrics aggregation** (`MetricsCollector.js`) merging load results and resource samples.
- **Performance analysis** (`PerformanceAnalyzer.js`) for basic KPIs and run comparisons.

## What is NOT implemented yet

- Visual Load Test Designer UI
- Distributed load testing (multi-region agents)
- Threshold alerts + alerting routes/UI
- Persistent storage + history/report pages (a basic persistence API is added separately in routes)

## Scenario format

```json
{
  "name": "My Test",
  "targetUrl": "https://example.com/api/health",
  "method": "GET",
  "headers": { "Authorization": "Bearer ..." },
  "timeoutSeconds": 30,
  "phases": [
    { "durationSeconds": 10, "connections": 10, "pipelining": 1 },
    { "durationSeconds": 20, "connections": 50, "pipelining": 1 }
  ]
}
```

## Notes

- Resource monitoring measures the machine running **Pigeon**, not necessarily the target service.
- For remote targets, add proper timeouts and consider rate limits.
