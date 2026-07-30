const pino = require('pino');
const pinoHttp = require('pino-http');

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    redact: {
        paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["set-cookie"]',
            'req.headers["x-api-key"]',
            'req.headers["x-auth-token"]',
            'req.headers["x-csrf-token"]',
            'res.headers["set-cookie"]',
            'password',
            'secret',
            'token',
            'accessToken',
            'refreshToken'
        ],
        censor: '[REDACTED]'
    },
    base: { service: 'pigeon-api' },
    timestamp: pino.stdTimeFunctions.isoTime
});

function mountStructuredLogger(app) {
    app.use(pinoHttp({
        logger,
        genReqId: (req) => req.requestId,
        customLogLevel: (_req, res, error) => {
            if (error || res.statusCode >= 500) return 'error';
            if (res.statusCode >= 400) return 'warn';
            return 'info';
        },
        customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
        customErrorMessage: (req, res, error) => `${req.method} ${req.url} ${res.statusCode}: ${error.message}`,
        autoLogging: { ignore: (req) => req.url === '/health/live' }
    }));
}

module.exports = { logger, mountStructuredLogger };
