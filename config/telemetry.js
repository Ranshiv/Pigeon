const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-proto');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const {
    ATTR_SERVICE_NAME,
    ATTR_SERVICE_VERSION,
    ATTR_DEPLOYMENT_ENVIRONMENT_NAME
} = require('@opentelemetry/semantic-conventions');

let sdk;

function parseHeaders(value = process.env.OTEL_EXPORTER_OTLP_HEADERS) {
    if (!value) return undefined;
    const headers = {};
    for (const item of value.split(',')) {
        const separator = item.indexOf('=');
        if (separator <= 0) continue;
        const key = item.slice(0, separator).trim();
        const headerValue = item.slice(separator + 1).trim();
        if (key && headerValue) headers[key] = headerValue;
    }
    return Object.keys(headers).length ? headers : undefined;
}

function getTraceEndpoint() {
    const configured = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    if (!configured) return null;
    if (configured.endsWith('/v1/traces')) return configured;
    return `${configured.replace(/\/$/, '')}/v1/traces`;
}

function startTelemetry() {
    const endpoint = getTraceEndpoint();
    if (!endpoint) return null;

    sdk = new NodeSDK({
        resource: resourceFromAttributes({
            [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'pigeon-api',
            [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
            [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: process.env.NODE_ENV || 'development'
        }),
        traceExporter: new OTLPTraceExporter({
            url: endpoint,
            headers: parseHeaders()
        }),
        instrumentations: [getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-fs': { enabled: false }
        })]
    });

    sdk.start();
    return sdk;
}

function getTelemetryStatus() {
    return {
        enabled: Boolean(sdk),
        traces: Boolean(getTraceEndpoint()),
        serviceName: process.env.OTEL_SERVICE_NAME || 'pigeon-api',
        endpointConfigured: Boolean(getTraceEndpoint())
    };
}

async function stopTelemetry() {
    if (sdk) await sdk.shutdown();
}

module.exports = { getTraceEndpoint, parseHeaders, startTelemetry, stopTelemetry, getTelemetryStatus };
