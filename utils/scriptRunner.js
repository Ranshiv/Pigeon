// utils/scriptRunner.js
/**
 * Script Runner Utility for Pigeon API Testing
 * Provides functionality to execute pre-request and test scripts safely
 */

const vm = require('vm');
const crypto = require('crypto');

/**
 * Creates a sandbox environment for running scripts with controlled access
 * @param {Object} context - Variables to expose to the script
 * @returns {Object} - A secured sandbox context
 */
function createSandbox(context = {}) {
    // Base sandbox with allowed globals and utilities
    const sandbox = {
        // Standard JS objects that are safe to expose
        console: {
            log: console.log,
            info: console.info,
            warn: console.warn,
            error: console.error
        },
        setTimeout,
        clearTimeout,
        Date,
        Math,
        JSON,
        Number,
        String,
        Buffer,
        Array,
        Object,
        RegExp,
        Error,

        // Custom utility functions for scripts
        btoa: (str) => Buffer.from(str).toString('base64'),
        atob: (str) => Buffer.from(str, 'base64').toString(),

        // Advanced utilities
        crypto: {
            md5: (str) => crypto.createHash('md5').update(str).digest('hex'),
            sha1: (str) => crypto.createHash('sha1').update(str).digest('hex'),
            sha256: (str) => crypto.createHash('sha256').update(str).digest('hex'),
            randomBytes: (size) => crypto.randomBytes(size).toString('hex')
        },

        // JSON Schema validation utility
        validateSchema: (data, schema) => {
            // Basic implementation of JSON schema validation
            if (!data || !schema) return false;

            try {
                // Type validation
                if (schema.type) {
                    const jsType = typeof data;
                    if (schema.type === 'array' && !Array.isArray(data)) return false;
                    if (schema.type === 'object' && (jsType !== 'object' || Array.isArray(data))) return false;
                    if (schema.type === 'string' && jsType !== 'string') return false;
                    if (schema.type === 'number' && jsType !== 'number') return false;
                    if (schema.type === 'boolean' && jsType !== 'boolean') return false;
                    if (schema.type === 'null' && data !== null) return false;
                }

                // Object properties validation
                if (schema.type === 'object' && schema.properties) {
                    for (const [key, propSchema] of Object.entries(schema.properties)) {
                        if (data[key] !== undefined && !sandbox.validateSchema(data[key], propSchema)) {
                            return false;
                        }
                    }
                }

                // Array items validation
                if (schema.type === 'array' && schema.items && Array.isArray(data)) {
                    for (const item of data) {
                        if (!sandbox.validateSchema(item, schema.items)) {
                            return false;
                        }
                    }
                }

                // Required properties
                if (schema.required && Array.isArray(schema.required)) {
                    for (const req of schema.required) {
                        if (data[req] === undefined) return false;
                    }
                }

                // Enum validation
                if (schema.enum && Array.isArray(schema.enum)) {
                    if (!schema.enum.includes(data)) return false;
                }

                return true;
            } catch (error) {
                console.error('Schema validation error:', error);
                return false;
            }
        },

        // Add user-provided context variables
        ...context
    };

    return sandbox;
}

/**
 * Executes a pre-request script to modify the request before sending
 * @param {string} script - The pre-request script to execute
 * @param {Object} context - The context object with request and environment data
 * @param {Object} environment - Environment variables
 * @returns {Object} - The potentially modified request and any errors
 */
function executePreRequestScript(script, context, environment = {}) {
    if (!script || typeof script !== 'string' || script.trim() === '') {
        return { request: context.request, error: null, environment };
    }

    // Make sure we have request object
    const request = context.request || {};

    // Create a variables collection for the request
    request.variables = {
        values: {},
        set: function (key, value) {
            this.values[key] = value;
        },
        get: function (key) {
            // Check request variables first, then environment
            return this.values[key] !== undefined ? this.values[key] : environment[key];
        },
        unset: function (key) {
            delete this.values[key];
        }
    };

    // Add environment utilities
    const env = {
        set: function (key, value) {
            environment[key] = value;
            return true;
        },
        get: function (key) {
            return environment[key];
        },
        has: function (key) {
            return environment[key] !== undefined;
        },
        unset: function (key) {
            delete environment[key];
            return true;
        }
    };

    // Add utility methods for common pre-request tasks
    request.utils = {
        // Generate UUID v4
        uuid: function () {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                const r = Math.random() * 16 | 0,
                    v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        },
        // Parse URL and get components
        parseUrl: function (url) {
            try {
                const parsed = new URL(url);
                return {
                    protocol: parsed.protocol,
                    host: parsed.host,
                    hostname: parsed.hostname,
                    port: parsed.port,
                    pathname: parsed.pathname,
                    search: parsed.search,
                    hash: parsed.hash,
                    origin: parsed.origin
                };
            } catch (e) {
                console.error('URL parsing error:', e);
                return null;
            }
        },
        // Convert object to query string
        toQueryString: function (obj) {
            return Object.entries(obj)
                .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
                .join('&');
        },
        // Replace variables in a string
        replaceVariables: function (template, variableGetter) {
            return template.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
                const trimmedName = varName.trim();
                const value = variableGetter(trimmedName);
                return value !== undefined ? value : match;
            });
        }
    };

    // Create the sandbox with the request object and environment access
    const sandbox = createSandbox({
        request,
        environment: env, // Provide environment interface instead of raw object
        console: console // Make sure console.log works for debugging
    });

    try {
        // Execute the script with a timeout
        const wrappedScript = `
            try {
                ${script}
            } catch (e) {
                console.error('Script error:', e.message);
                throw e;
            }
        `;
        vm.runInNewContext(wrappedScript, sandbox, { timeout: 5001 });

        // Apply variable interpolation to URL and headers
        if (sandbox.request.url) {
            sandbox.request.url = sandbox.request.utils.replaceVariables(
                sandbox.request.url,
                (name) => sandbox.request.variables.get(name)
            );
        }

        // Apply variable interpolation to headers
        if (sandbox.request.headers) {
            for (const header of sandbox.request.headers) {
                if (typeof header.value === 'string') {
                    header.value = sandbox.request.utils.replaceVariables(
                        header.value,
                        (name) => sandbox.request.variables.get(name)
                    );
                }
            }
        }

        // Apply variable interpolation to body if it's a string
        if (typeof sandbox.request.body === 'string') {
            sandbox.request.body = sandbox.request.utils.replaceVariables(
                sandbox.request.body,
                (name) => sandbox.request.variables.get(name)
            );
        }

        return {
            request: sandbox.request,
            error: null,
            environment // Return potentially modified environment
        };
    } catch (error) {
        return {
            request,
            error: {
                message: `Pre-request script error: ${error.message}`,
                stack: error.stack
            },
            environment
        };
    }
}

/**
 * Executes a test script to validate the response
 * @param {string} script - The test script to execute
 * @param {Object} response - The response object to test
 * @param {Object} environment - Environment variables
 * @returns {Object} - Test results and any errors
 */
function executeTestScript(script, response, environment = {}) {
    if (!script || typeof script !== 'string' || script.trim() === '') {
        return { results: [], error: null };
    }

    // Tests object to store test assertions
    const tests = {};

    // Add schema validation utility
    const jsonSchemaValidation = {
        validate: (data, schema) => {
            try {
                return validateJsonSchema(data, schema);
            } catch (error) {
                return false;
            }
        },
        // Add common schemas
        schemas: {
            email: {
                type: 'string',
                pattern: '^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$'
            },
            uuid: {
                type: 'string',
                pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            },
            url: {
                type: 'string',
                pattern: '^https?:\\/\\/[\\w\\.-]+(?:\\.[a-z]{2,})+[\\/\\w\\.-]*$'
            }
        }
    };

    // Add environment access
    const env = {
        get: (key) => environment[key],
        set: (key, value) => {
            environment[key] = value;
            return true;
        },
        has: (key) => environment[key] !== undefined
    };

    // Add assertions library
    const assert = {
        equal: (actual, expected, message) => {
            const passed = actual === expected;
            const testName = message || `Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`;
            tests[testName] = passed;
            return passed;
        },
        notEqual: (actual, expected, message) => {
            const passed = actual !== expected;
            const testName = message || `Expected ${JSON.stringify(actual)} to not equal ${JSON.stringify(expected)}`;
            tests[testName] = passed;
            return passed;
        },
        contains: (haystack, needle, message) => {
            const passed = typeof haystack === 'string' && haystack.includes(needle);
            const testName = message || `Expected string to contain "${needle}"`;
            tests[testName] = passed;
            return passed;
        },
        greaterThan: (actual, expected, message) => {
            const passed = actual > expected;
            const testName = message || `Expected ${actual} to be greater than ${expected}`;
            tests[testName] = passed;
            return passed;
        },
        lessThan: (actual, expected, message) => {
            const passed = actual < expected;
            const testName = message || `Expected ${actual} to be less than ${expected}`;
            tests[testName] = passed;
            return passed;
        },
        true: (actual, message) => {
            const passed = actual === true;
            const testName = message || `Expected value to be true`;
            tests[testName] = passed;
            return passed;
        },
        false: (actual, message) => {
            const passed = actual === false;
            const testName = message || `Expected value to be false`;
            tests[testName] = passed;
            return passed;
        },
        isNull: (actual, message) => {
            const passed = actual === null;
            const testName = message || `Expected value to be null`;
            tests[testName] = passed;
            return passed;
        },
        isNotNull: (actual, message) => {
            const passed = actual !== null;
            const testName = message || `Expected value to not be null`;
            tests[testName] = passed;
            return passed;
        },
        isDefined: (actual, message) => {
            const passed = actual !== undefined;
            const testName = message || `Expected value to be defined`;
            tests[testName] = passed;
            return passed;
        }
    };

    // Create the sandbox with the response and tests objects
    const sandbox = createSandbox({
        response,
        tests,
        assert,
        jsonSchema: jsonSchemaValidation,
        environment: env
    });

    try {
        // Execute the script with a timeout
        const wrappedScript = `
            try {
                ${script}
            } catch (e) {
                console.error('Script error:', e.message);
                throw e;
            }
        `;
        vm.runInNewContext(wrappedScript, sandbox, { timeout: 5001 });

        // Convert test results to an array format with additional metadata
        const results = Object.entries(sandbox.tests).map(([name, passed]) => ({
            name,
            passed,
            error: passed ? null : 'Assertion failed',
            timestamp: Date.now()
        }));

        return {
            results,
            error: null,
            environment
        };
    } catch (error) {
        return {
            results: [],
            error: {
                message: `Test script error: ${error.message}`,
                stack: error.stack
            },
            environment
        };
    }
}

/**
 * Simple JSON schema validation function 
 * @param {any} data - Data to validate
 * @param {Object} schema - Schema definition
 * @returns {boolean} - Whether data conforms to schema
 */
function validateJsonSchema(data, schema) {
    // Type validation
    if (schema.type) {
        const jsType = typeof data;
        if (schema.type === 'array' && !Array.isArray(data)) return false;
        if (schema.type === 'object' && (jsType !== 'object' || Array.isArray(data))) return false;
        if (schema.type === 'string' && jsType !== 'string') return false;
        if (schema.type === 'number' && jsType !== 'number') return false;
        if (schema.type === 'boolean' && jsType !== 'boolean') return false;
        if (schema.type === 'null' && data !== null) return false;
    }

    // Object property validation
    if (schema.properties && typeof data === 'object' && !Array.isArray(data)) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
            if (data[key] !== undefined && !validateJsonSchema(data[key], propSchema)) {
                return false;
            }
        }
    }

    // Array items validation
    if (schema.items && Array.isArray(data)) {
        for (const item of data) {
            if (!validateJsonSchema(item, schema.items)) {
                return false;
            }
        }
    }

    // Required properties
    if (schema.required && Array.isArray(schema.required) && typeof data === 'object') {
        for (const req of schema.required) {
            if (data[req] === undefined) return false;
        }
    }

    // Pattern validation
    if (schema.pattern && typeof data === 'string') {
        const regex = new RegExp(schema.pattern);
        if (!regex.test(data)) return false;
    }

    // Enum validation
    if (schema.enum && Array.isArray(schema.enum)) {
        if (!schema.enum.includes(data)) return false;
    }

    // Min and max for numbers
    if (typeof data === 'number') {
        if (schema.minimum !== undefined && data < schema.minimum) return false;
        if (schema.maximum !== undefined && data > schema.maximum) return false;
    }

    // Min and max length for strings
    if (typeof data === 'string') {
        if (schema.minLength !== undefined && data.length < schema.minLength) return false;
        if (schema.maxLength !== undefined && data.length > schema.maxLength) return false;
    }

    // Min and max items for arrays
    if (Array.isArray(data)) {
        if (schema.minItems !== undefined && data.length < schema.minItems) return false;
        if (schema.maxItems !== undefined && data.length > schema.maxItems) return false;
    }

    return true;
}

module.exports = {
    executePreRequestScript,
    executeTestScript,
    validateJsonSchema
};