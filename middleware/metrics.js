// middleware/metrics.js
// Tier 4: Prometheus instrumentation via prom-client (already a dep, was unused).
// Exposes default Node metrics + custom counters for marketplace activity.
// /metrics endpoint is registered in routes/index.js (or server.js).
const promClient = require('prom-client');

const Registry = new promClient.Registry();
promClient.collectDefaultMetrics({ register: Registry });

const proxyCallsTotal = new promClient.Counter({
    name: 'marketplace_proxy_calls_total',
    help: 'Total marketplace Try-It proxy calls',
    registers: [Registry]
});

const reviewSubmissionsTotal = new promClient.Counter({
    name: 'marketplace_review_submissions_total',
    help: 'Total marketplace review submissions',
    registers: [Registry]
});

// express middleware to count a proxy call.
function incProxyCall() { proxyCallsTotal.inc(); }
function incReviewSubmission() { reviewSubmissionsTotal.inc(); }

// Metrics endpoint handler — returns Prometheus exposition format.
async function metricsHandler(req, res) {
    res.set('Content-Type', Registry.contentType);
    res.end(await Registry.metrics());
}

module.exports = {
    metricsHandler,
    incProxyCall,
    incReviewSubmission
};