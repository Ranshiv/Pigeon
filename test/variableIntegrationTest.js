// Integration test for variable management system
// Tests both CLI and API functionality

const path = require('path');
const fs = require('fs');

// Test the CLI variable management
console.log('=== CLI Variable System Test ===');

// Test data
const testEnvironment = {
    name: 'test-env',
    variables: {
        baseUrl: 'https://api.test.com',
        apiKey: 'test-key-123',
        version: 'v1'
    }
};

const testRequest = {
    method: 'GET',
    url: '{{baseUrl}}/{{version}}/users/{{userId}}',
    headers: {
        'Authorization': 'Bearer {{apiKey}}',
        'Content-Type': 'application/json'
    },
    params: {
        include: '{{includeFields}}'
    }
};

// Test variable resolution (using the existing CLI logic)
const variableResolver = require('../services/VariableResolver');

console.log('\n1. Testing Variable Resolution Service...');

// variableResolver is an instance, not a class

// Test precedence order with context
const globalVars = { baseUrl: 'https://global.api.com', apiKey: 'global-key' };
const envVars = { apiKey: 'env-key', version: 'v1' };
const collectionVars = { endpoint: 'users' };
const requestVars = { userId: '12345' };

// Create a test context
const contextId = 'test-context-' + Date.now();

// Test the context creation and variable resolution
async function testVariableResolution() {
    try {
        // Create context with all variable layers
        const context = await variableResolver.createContext(contextId, {
            requestLocalVariables: requestVars,
            environmentVariables: envVars,
            collectionVariables: collectionVars,
            globalVariables: globalVars
        });

        console.log('Context created successfully');

        // Get all variables
        const allVariables = variableResolver.getAllVariables(contextId);
        console.log('All variables:', allVariables);

        // Test individual variable resolution
        const apiKeyResult = variableResolver.getVariable(contextId, 'apiKey');
        console.log('API Key resolution:', apiKeyResult);
        console.log('Expected: apiKey should be "env-key" (environment overrides global)');

        // Test string interpolation
        console.log('\n2. Testing String Interpolation...');

        const originalUrl = '{{baseUrl}}/{{version}}/users/{{userId}}';
        const interpolatedUrl = variableResolver.replaceVariables(contextId, originalUrl);
        console.log('Original URL:', originalUrl);
        console.log('Interpolated URL:', interpolatedUrl);

        // Test missing variables
        console.log('\n3. Testing Missing Variable Detection...');

        const requestWithMissingVars = '{{baseUrl}}/{{version}}/{{missingEndpoint}}/{{userId}}';
        const interpolatedWithMissing = variableResolver.replaceVariables(contextId, requestWithMissingVars);
        console.log('Request with missing vars:', requestWithMissingVars);
        console.log('Interpolated (should show placeholders for missing):', interpolatedWithMissing);

        // Test setting new variables
        console.log('\n4. Testing Variable Setting...');

        variableResolver.setVariable(contextId, 'request', 'testVar', 'testValue');
        const testVarResult = variableResolver.getVariable(contextId, 'testVar');
        console.log('Set testVar and retrieved:', testVarResult);

        // Cleanup
        variableResolver.destroyContext(contextId);
        console.log('\nContext cleaned up');

    } catch (error) {
        console.error('Test error:', error);
    }
}

// Run the test
testVariableResolution().then(() => {

    console.log('\n=== Testing Complete ===');
    console.log('Next: Run API server and test web UI integration');
}).catch(err => {
    console.error('Test failed:', err);
});
