// middleware/securityMiddleware.js
// Tier 1: security headers (helmet), gzip (compression), request logging (morgan),
// and a global 4-arg error handler that never leaks stack traces in production.
// Exported as a mount function so server.js and tests wire identically.
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const { mountStructuredLogger } = require('./structuredLogger');

function mountSecurityMiddleware(app, { skipMorgan = false } = {}) {
    app.use(helmet());
    app.use(compression());
    if (!skipMorgan && process.env.STRUCTURED_LOGGING !== 'false') mountStructuredLogger(app);
    if (!skipMorgan && process.env.STRUCTURED_LOGGING === 'false') app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Global error handler. Express only invokes a 4-arg handler when something throws
// or next(err) is called. In production we never echo the raw message/stack.
function globalErrorHandler(err, req, res, next) {
    if (res.headersSent) return next(err);
    const isProd = process.env.NODE_ENV === 'production';
    if (req.log) req.log.error({ err, requestId: req.requestId }, 'Unhandled request error');

    // Express body-parser errors are safe to expose and should be actionable to
    // API clients. Use RFC 9457's problem-details media type for all errors
    // handled here while retaining the legacy `error` field for compatibility.
    const isPayloadTooLarge = err?.type === 'entity.too.large';
    const isMalformedJson = err instanceof SyntaxError && err?.status === 400 && 'body' in err;
    const status = isPayloadTooLarge ? 413 : isMalformedJson ? 400 : 500;
    const title = isPayloadTooLarge ? 'Payload Too Large' : isMalformedJson ? 'Malformed JSON' : 'Internal Server Error';
    const detail = isPayloadTooLarge
        ? 'The request body exceeds the configured size limit.'
        : isMalformedJson
            ? 'The request body contains invalid JSON.'
            : (isProd ? undefined : err.message);

    res.status(status)
        .type('application/problem+json')
        .json({
            type: `https://httpstatuses.com/${status}`,
            title,
            status,
            ...(detail ? { detail } : {}),
            error: status === 500 ? 'Internal server error' : title,
            requestId: req.requestId
        });
}

module.exports = { mountSecurityMiddleware, globalErrorHandler };
