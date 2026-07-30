// middleware/rateLimiter.js
// Tier 1: per-IP rate limiting to protect the open /proxy (Try It) endpoint.
// ponytail: in-memory store; swap to express-rate-limit's RedisStore when running >1 node.
const rateLimit = require('express-rate-limit');

// Test-friendly threshold so the test can exhaust the window in one go.
const PROXY_MAX = Number.parseInt(process.env.PROXY_RATE_LIMIT_MAX || '5', 10);
const PROXY_WINDOW_MS = Number.parseInt(process.env.PROXY_RATE_LIMIT_WINDOW_MS || String(60 * 1000), 10);

const proxyLimiter = rateLimit({
    windowMs: Number.isFinite(PROXY_WINDOW_MS) && PROXY_WINDOW_MS > 0 ? PROXY_WINDOW_MS : 60 * 1000,
    max: Number.isFinite(PROXY_MAX) && PROXY_MAX > 0 ? PROXY_MAX : 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many proxy requests, please try again later.' }
});

function resetProxyLimiter(key = undefined) {
    // express-rate-limit keys by req.ip; supertest hits come from ::ffff:127.0.0.1.
    // Clear the common loopback keys so the test suite doesn't trip its own limiter.
    const keys = key ? [key] : ['127.0.0.1', '::ffff:127.0.0.1', '::1'];
    for (const k of keys) {
        if (proxyLimiter.resetKey) proxyLimiter.resetKey(k);
    }
}

module.exports = {
    proxyLimiter,
    resetProxyLimiter,
    __maxForTest: PROXY_MAX
};
