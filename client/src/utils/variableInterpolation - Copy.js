// client/src/utils/variableInterpolation.js
/**
 * Variable interpolation utility for the frontend
 * Handles variable replacement in URLs, headers, and body content
 */

/**
 * Replace variable placeholders in a string with actual values
 * @param {string} template - The template string with {{variable}} placeholders
 * @param {Object} variables - Variable values object
 * @returns {string} - The interpolated string
 */
export function interpolateString(template, variables = {}) {
    if (!template || typeof template !== 'string') {
        return template;
    }

    return template.replace(/\{\{([^}]+)\}\}/g, (match, variableName) => {
        const trimmedName = variableName.trim();

        // Return the variable value if it exists, otherwise return the original placeholder
        return variables.hasOwnProperty(trimmedName) ? String(variables[trimmedName]) : match;
    });
}

/**
 * Interpolate variables in request headers
 * @param {Array} headers - Array of header objects {key, value, enabled}
 * @param {Object} variables - Variable values object
 * @returns {Array} - Headers with interpolated values
 */
export function interpolateHeaders(headers = [], variables = {}) {
    return headers.map(header => ({
        ...header,
        key: interpolateString(header.key, variables),
        value: interpolateString(header.value, variables)
    }));
}

/**
 * Interpolate variables in request parameters
 * @param {Array} params - Array of parameter objects {key, value, enabled}
 * @param {Object} variables - Variable values object
 * @returns {Array} - Parameters with interpolated values
 */
export function interpolateParams(params = [], variables = {}) {
    return params.map(param => ({
        ...param,
        key: interpolateString(param.key, variables),
        value: interpolateString(param.value, variables)
    }));
}

/**
 * Interpolate variables in request body
 * @param {string} body - Request body content
 * @param {Object} variables - Variable values object
 * @returns {string} - Body with interpolated variables
 */
export function interpolateBody(body, variables = {}) {
    return interpolateString(body, variables);
}

/**
 * Interpolate variables in request URL
 * @param {string} url - Request URL
 * @param {Object} variables - Variable values object
 * @returns {string} - URL with interpolated variables
 */
export function interpolateUrl(url, variables = {}) {
    return interpolateString(url, variables);
}

/**
 * Resolve variables according to precedence: Request > Environment > Collection > Global
 * @param {Object} requestVariables - Request-level variables
 * @param {Object} environmentVariables - Environment variables
 * @param {Object} collectionVariables - Collection variables
 * @param {Object} globalVariables - Global workspace variables
 * @returns {Object} - Merged variables object with proper precedence
 */
export function resolveVariables(requestVariables = {}, environmentVariables = {}, collectionVariables = {}, globalVariables = {}) {
    // Convert array format to object format if needed
    const normalizeVariables = (vars) => {
        if (Array.isArray(vars)) {
            return vars.reduce((acc, variable) => {
                if (variable.key) {
                    acc[variable.key] = variable.value;
                }
                return acc;
            }, {});
        }
        return vars || {};
    };

    const normalizedRequest = normalizeVariables(requestVariables);
    const normalizedEnvironment = normalizeVariables(environmentVariables);
    const normalizedCollection = normalizeVariables(collectionVariables);
    const normalizedGlobal = normalizeVariables(globalVariables);

    // Merge with precedence: Request > Environment > Collection > Global
    return {
        ...normalizedGlobal,
        ...normalizedCollection,
        ...normalizedEnvironment,
        ...normalizedRequest
    };
}

/**
 * Interpolate all request data with resolved variables
 * @param {Object} requestData - Complete request data object
 * @param {Object} resolvedVariables - Resolved variables object
 * @returns {Object} - Request data with interpolated values
 */
export function interpolateRequest(requestData, resolvedVariables = {}) {
    return {
        ...requestData,
        url: interpolateUrl(requestData.url, resolvedVariables),
        headers: interpolateHeaders(requestData.headers, resolvedVariables),
        params: interpolateParams(requestData.params, resolvedVariables),
        body: interpolateBody(requestData.body, resolvedVariables)
    };
}

/**
 * Extract variables from a template string
 * @param {string} template - Template string with {{variable}} placeholders
 * @returns {Array} - Array of variable names found in the template
 */
export function extractVariables(template) {
    if (!template || typeof template !== 'string') {
        return [];
    }

    const matches = template.match(/\{\{([^}]+)\}\}/g);
    if (!matches) {
        return [];
    }

    return matches.map(match => match.replace(/\{\{|\}\}/g, '').trim());
}

/**
 * Find all variables used in a request
 * @param {Object} requestData - Request data object
 * @returns {Object} - Object containing arrays of variables found in each section
 */
export function findRequestVariables(requestData) {
    const urlVariables = extractVariables(requestData.url);

    const headerVariables = (requestData.headers || []).reduce((acc, header) => {
        acc.push(...extractVariables(header.key));
        acc.push(...extractVariables(header.value));
        return acc;
    }, []);

    const paramVariables = (requestData.params || []).reduce((acc, param) => {
        acc.push(...extractVariables(param.key));
        acc.push(...extractVariables(param.value));
        return acc;
    }, []);

    const bodyVariables = extractVariables(requestData.body);

    // Get unique variables
    const allVariables = [...new Set([
        ...urlVariables,
        ...headerVariables,
        ...paramVariables,
        ...bodyVariables
    ])];

    return {
        url: urlVariables,
        headers: headerVariables,
        params: paramVariables,
        body: bodyVariables,
        all: allVariables
    };
}

/**
 * Validate that all required variables are available
 * @param {Object} requestData - Request data object
 * @param {Object} resolvedVariables - Available variables
 * @returns {Object} - Validation result with missing variables
 */
export function validateVariables(requestData, resolvedVariables = {}) {
    const usedVariables = findRequestVariables(requestData);
    const missingVariables = usedVariables.all.filter(varName =>
        !resolvedVariables.hasOwnProperty(varName)
    );

    return {
        isValid: missingVariables.length === 0,
        missingVariables,
        usedVariables: usedVariables.all
    };
}

/**
 * Preview interpolated request for display purposes
 * @param {Object} requestData - Request data object
 * @param {Object} resolvedVariables - Available variables
 * @returns {Object} - Preview object with interpolated and missing variables
 */
export function previewInterpolation(requestData, resolvedVariables = {}) {
    const validation = validateVariables(requestData, resolvedVariables);
    const interpolated = interpolateRequest(requestData, resolvedVariables);

    return {
        ...validation,
        interpolated,
        preview: {
            url: interpolated.url,
            headers: interpolated.headers.filter(h => h.enabled),
            params: interpolated.params.filter(p => p.enabled),
            body: interpolated.body
        }
    };
}
