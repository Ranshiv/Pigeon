const normalizeOrigin = (value) => String(value || '').trim().replace(/\/$/, '');

const isPrivateIpv4 = (hostname) => (
    /^10\./.test(hostname)
    || /^192\.168\./.test(hostname)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
);

function isLocalDevelopmentOrigin(origin, ports) {
    try {
        const parsed = new URL(origin);
        if (!['http:', 'https:'].includes(parsed.protocol)) return false;
        const hostname = parsed.hostname.toLowerCase();
        const isLocalHost = hostname === 'localhost'
            || hostname.endsWith('.localhost')
            || hostname === '127.0.0.1'
            || hostname === '0.0.0.0'
            || hostname === '[::1]'
            || isPrivateIpv4(hostname);
        const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
        return isLocalHost && ports.has(port);
    } catch {
        return false;
    }
}

function createOriginChecker({ configuredOrigins, nodeEnv, frontendUrl, apiPort }) {
    const allowed = new Set((configuredOrigins || []).map(normalizeOrigin).filter(Boolean));
    const developmentPorts = new Set(['3000', String(apiPort || '5001')]);
    try {
        const configuredFrontend = new URL(frontendUrl || 'http://localhost:3000');
        developmentPorts.add(configuredFrontend.port || (configuredFrontend.protocol === 'https:' ? '443' : '80'));
    } catch { /* The exact configured origin remains available through `allowed`. */ }

    return (origin) => {
        if (!origin) return true;
        const normalized = normalizeOrigin(origin);
        if (allowed.has(normalized)) return true;
        return nodeEnv !== 'production' && isLocalDevelopmentOrigin(normalized, developmentPorts);
    };
}

module.exports = { createOriginChecker, isLocalDevelopmentOrigin, normalizeOrigin };
