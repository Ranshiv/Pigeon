const Sentry = require('@sentry/node');

const environment = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';
const enabled = Boolean(process.env.SENTRY_DSN) &&
    process.env.NODE_ENV === 'production' &&
    environment === 'production';

const SENSITIVE_KEY = /(authorization|cookie|set-cookie|api[-_ ]?key|x[-_]api[-_]key|access[-_ ]?token|refresh[-_ ]?token|id[-_ ]?token|\btoken\b|password|passwd|secret|credential|private[-_ ]?key|session[-_ ]?id|x[-_]auth|client[-_ ]?secret|signature)/i;

function scrubObject(value) {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(scrubObject);

    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
        key,
        SENSITIVE_KEY.test(key) ? '[Filtered]' : scrubObject(item)
    ]));
}

function scrubEvent(event) {
    if (!event) return event;

    if (event.request) {
        const request = { ...event.request };
        if (request.headers) request.headers = scrubObject(request.headers);
        if (request.data) request.data = '[Filtered]';
        if (request.cookies) request.cookies = '[Filtered]';
        if (request.query) request.query = scrubObject(request.query);
        event.request = request;
    }

    if (event.extra) event.extra = scrubObject(event.extra);
    if (event.contexts) event.contexts = scrubObject(event.contexts);
    if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => ({
            ...breadcrumb,
            data: breadcrumb.data ? scrubObject(breadcrumb.data) : breadcrumb.data
        }));
    }

    return event;
}

Sentry.init({
    dsn: process.env.SENTRY_DSN,
    enabled,
    environment,
    release: process.env.SENTRY_RELEASE || undefined,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend: scrubEvent
});

module.exports = { Sentry, enabled, environment, scrubEvent };
