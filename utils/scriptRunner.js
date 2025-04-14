// utils/scriptRunner.js
/**
 * Script Runner Utility for Pigeon API Testing
 * Provides functionality to execute pre-request and test scripts safely
 */

const vm = require('vm');

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

        // Add user-provided context variables
        ...context
    };

    return sandbox;
}

/**
 * Executes a pre-request script to modify the request before sending
 * @param {string} script - The pre-request script to execute
 * @param {Object} request - The request object that can be modified
 * @returns {Object} - The potentially modified request and any errors
 */
function executePreRequestScript(script, request) {
    if (!script || typeof script !== 'string' || script.trim() === '') {
        return { request, error: null };
    }

    // Create a variables collection for the request
    request.variables = {
        values: {},
        set: function (key, value) {
            this.values[key] = value;
        },
        get: function (key) {
            return this.values[key];
        },
        unset: function (key) {
            delete this.values[key];
        }
    };

    // Create the sandbox with the request object
    const sandbox = createSandbox({ request });

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
        vm.runInNewContext(wrappedScript, sandbox, { timeout: 5000 });
        return { request: sandbox.request, error: null };
    } catch (error) {
        return {
            request,
            error: {
                message: `Pre-request script error: ${error.message}`,
                stack: error.stack
            }
        };
    }
}

/**
 * Executes a test script to validate the response
 * @param {string} script - The test script to execute
 * @param {Object} response - The response object to test
 * @returns {Object} - Test results and any errors
 */
function executeTestScript(script, response) {
    if (!script || typeof script !== 'string' || script.trim() === '') {
        return { results: [], error: null };
    }

    // Tests object to store test assertions
    const tests = {};

    // Create the sandbox with the response and tests objects
    const sandbox = createSandbox({
        response,
        tests
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
        vm.runInNewContext(wrappedScript, sandbox, { timeout: 5000 });

        // Convert test results to an array format
        const results = Object.entries(sandbox.tests).map(([name, passed]) => ({
            name,
            passed,
            error: passed ? null : 'Assertion failed',
            // Add timestamp for chronological ordering
            timestamp: Date.now()
        }));

        return { results, error: null };
    } catch (error) {
        return {
            results: [],
            error: {
                message: `Test script error: ${error.message}`,
                stack: error.stack
            }
        };
    }
}

module.exports = {
    executePreRequestScript,
    executeTestScript
};