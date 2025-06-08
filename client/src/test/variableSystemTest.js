// Test script for variable management system
// This demonstrates the variable system functionality

// Example variables for testing
const testVariables = {
    global: {
        baseUrl: 'https://api.example.com',
        apiKey: 'global-key-123'
    },
    environment: {
        apiKey: 'env-key-456',
        version: 'v1'
    },
    collection: {
        endpoint: 'users'
    },
    request: {
        userId: '12345'
    }
};

// Example request with variables
const testRequest = {
    method: 'GET',
    url: '{{baseUrl}}/{{version}}/{{endpoint}}/{{userId}}',
    headers: [
        { enabled: true, key: 'Authorization', value: 'Bearer {{apiKey}}' },
        { enabled: true, key: 'Content-Type', value: 'application/json' }
    ],
    params: [
        { enabled: true, key: 'include', value: '{{includeFields}}' }
    ],
    body: JSON.stringify({
        action: 'get_user',
        userId: '{{userId}}',
        includeProfile: true
    })
};

console.log('=== Variable Management System Test ===');
console.log('\nTest Variables:');
console.log('Global:', testVariables.global);
console.log('Environment:', testVariables.environment);
console.log('Collection:', testVariables.collection);
console.log('Request:', testVariables.request);

console.log('\nOriginal Request:');
console.log(JSON.stringify(testRequest, null, 2));

// Simulate the variable resolution process
const { resolveVariables, interpolateRequest, validateVariables } = require('../utils/variableInterpolation');

// Resolve variables with precedence: Request > Environment > Collection > Global
const resolved = resolveVariables(
    testVariables.request,
    testVariables.environment,
    testVariables.collection,
    testVariables.global
);

console.log('\nResolved Variables (with precedence):');
console.log(resolved);

// Validate the request
const validation = validateVariables(testRequest, resolved);
console.log('\nValidation Result:');
console.log('Valid:', validation.isValid);
console.log('Missing Variables:', validation.missingVariables);

// Interpolate the request
const interpolated = interpolateRequest(testRequest, resolved);
console.log('\nInterpolated Request:');
console.log(JSON.stringify(interpolated, null, 2));

console.log('\n=== Expected Results ===');
console.log('URL should be: https://api.example.com/v1/users/12345');
console.log('Authorization header should use env-key-456 (environment overrides global)');
console.log('Missing variable: includeFields (should show in validation)');
