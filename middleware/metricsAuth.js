const crypto = require('crypto');

function metricsAuth(req, res, next) {
    const expected = process.env.METRICS_TOKEN;
    if (!expected) {
        return process.env.NODE_ENV === 'production'
            ? res.status(503).json({ error: 'Metrics authentication is not configured' })
            : next();
    }

    const authorization = req.get('authorization') || '';
    const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    const matches = supplied.length === expected.length && crypto.timingSafeEqual(
        Buffer.from(supplied),
        Buffer.from(expected)
    );
    if (!matches) return res.status(401).json({ error: 'Metrics authentication required' });
    next();
}

module.exports = { metricsAuth };
