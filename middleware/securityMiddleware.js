// middleware/securityMiddleware.js
// Tier 1: security headers (helmet), gzip (compression), request logging (morgan),
// and a global 4-arg error handler that never leaks stack traces in production.
// Exported as a mount function so server.js and tests wire identically.
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

function mountSecurityMiddleware(app, { skipMorgan = false } = {}) {
    app.use(helmet());
    app.use(compression());
    if (!skipMorgan) {
        app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
    }
}

// Global error handler. Express only invokes a 4-arg handler when something throws
// or next(err) is called. In production we never echo the raw message/stack.
function globalErrorHandler(err, req, res, next) {
    if (res.headersSent) return next(err);
    const isProd = process.env.NODE_ENV === 'production';
    res.status(500).json({
        error: 'Internal server error',
        message: isProd ? undefined : err.message
    });
}

module.exports = { mountSecurityMiddleware, globalErrorHandler };