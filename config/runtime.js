const { z } = require('zod');

const runtimeSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(5001),
    FRONTEND_URL: z.string().url().default('http://localhost:3000'),
    CORS_ORIGIN: z.string().optional(),
    COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
    SESSION_SECRET: z.string().optional(),
    JWT_SECRET: z.string().optional(),
    METRICS_TOKEN: z.string().optional(),
    API_BODY_LIMIT: z.string().regex(/^\d+(?:\.\d+)?\s*(?:kb|mb|gb|b)$/i).default('1mb'),
    MONGODB_URI: z.string().optional(),
    DATABASE_URL: z.string().optional(),
    REDIS_URL: z.string().optional()
}).passthrough();

function parseRuntimeConfig(source = process.env) {
    const result = runtimeSchema.safeParse(source);
    if (!result.success) {
        const details = result.error.issues.map(({ path, message }) => `${path.join('.') || 'environment'}: ${message}`);
        throw new Error(`Invalid runtime configuration: ${details.join('; ')}`);
    }
    return result.data;
}

function validateProductionConfig(config = parseRuntimeConfig()) {
    if (config.NODE_ENV !== 'production') return config;

    const missing = [];
    if (!config.SESSION_SECRET || config.SESSION_SECRET.length < 32) missing.push('SESSION_SECRET (minimum 32 characters)');
    if (!config.JWT_SECRET || config.JWT_SECRET.length < 32) missing.push('JWT_SECRET (minimum 32 characters)');
    if (config.COOKIE_SECURE !== 'true') missing.push('COOKIE_SECURE=true');
    if (!config.METRICS_TOKEN || config.METRICS_TOKEN.length < 24) missing.push('METRICS_TOKEN (minimum 24 characters)');
    if (!config.FRONTEND_URL.startsWith('https://')) missing.push('FRONTEND_URL (must use HTTPS)');

    if (missing.length) {
        throw new Error(`Production configuration is incomplete: ${missing.join(', ')}`);
    }
    return config;
}

module.exports = { runtimeSchema, parseRuntimeConfig, validateProductionConfig };
