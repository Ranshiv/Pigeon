// Test script to verify export preview functionality
// This can be run in the browser console when the RequestForm is open

// Sample request data for testing
const testRequestData = {
    method: 'POST',
    url: 'https://api.example.com/users',
    headers: [
        { key: 'Content-Type', value: 'application/json', enabled: true },
        { key: 'Authorization', value: 'Bearer token123', enabled: true }
    ],
    body: JSON.stringify({
        name: 'John Doe',
        email: 'john@example.com',
        age: 30
    }, null, 2),
    name: 'Create User'
};

// Test functions
function testPostmanPreview() {
    const postmanCollection = {
        info: {
            name: 'Pigeon API Collection',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
        },
        item: [{
            name: testRequestData.name,
            request: {
                method: testRequestData.method,
                url: testRequestData.url,
                header: testRequestData.headers.map(h => ({
                    key: h.key,
                    value: h.value,
                    enabled: h.enabled !== false
                })),
                body: testRequestData.body ? {
                    mode: 'raw',
                    raw: testRequestData.body
                } : undefined
            }
        }]
    };

    console.log('Postman Collection Test:');
    console.log(JSON.stringify(postmanCollection, null, 2));
    return postmanCollection;
}

function testCurlPreview() {
    let curlCommand = `curl -X ${testRequestData.method} "${testRequestData.url}"`;

    // Add headers
    testRequestData.headers.forEach(header => {
        if (header.key && header.value) {
            curlCommand += ` \\\n  -H "${header.key}: ${header.value}"`;
        }
    });

    // Add body
    if (testRequestData.body && testRequestData.body.trim()) {
        curlCommand += ` \\\n  -d '${testRequestData.body.replace(/'/g, `'"'"'`)}'`;
    }

    console.log('cURL Command Test:');
    console.log(curlCommand);
    return curlCommand;
}

function testOpenApiPreview() {
    const urlObj = new URL(testRequestData.url);
    const path = urlObj.pathname;

    const openApiSpec = {
        openapi: '3.0.0',
        info: {
            title: 'API Documentation',
            version: '1.0.0'
        },
        servers: [{
            url: `${urlObj.protocol}//${urlObj.host}`
        }],
        paths: {
            [path]: {
                [testRequestData.method.toLowerCase()]: {
                    summary: `${testRequestData.method} ${path}`,
                    parameters: testRequestData.headers.map(h => ({
                        name: h.key,
                        in: 'header',
                        required: false,
                        schema: { type: 'string' }
                    })),
                    requestBody: testRequestData.body ? {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { type: 'object' }
                            }
                        }
                    } : undefined,
                    responses: {
                        '200': {
                            description: 'Success',
                            content: {
                                'application/json': {
                                    schema: { type: 'object' }
                                }
                            }
                        }
                    }
                }
            }
        }
    };

    console.log('OpenAPI Specification Test:');
    console.log(JSON.stringify(openApiSpec, null, 2));
    return openApiSpec;
}

function testShareLinkPreview() {
    const shareData = {
        method: testRequestData.method,
        url: testRequestData.url,
        headers: testRequestData.headers,
        body: testRequestData.body
    };

    const shareUrl = `${window.location.origin}/share?data=${encodeURIComponent(btoa(JSON.stringify(shareData)))}`;

    console.log('Share Link Test:');
    console.log(shareUrl);
    return shareUrl;
}

// Run all tests
function runAllTests() {
    console.log('=== Export Preview Tests ===');

    try {
        testPostmanPreview();
        console.log('✅ Postman preview test passed');
    } catch (error) {
        console.error('❌ Postman preview test failed:', error);
    }

    try {
        testCurlPreview();
        console.log('✅ cURL preview test passed');
    } catch (error) {
        console.error('❌ cURL preview test failed:', error);
    }

    try {
        testOpenApiPreview();
        console.log('✅ OpenAPI preview test passed');
    } catch (error) {
        console.error('❌ OpenAPI preview test failed:', error);
    }

    try {
        testShareLinkPreview();
        console.log('✅ Share link preview test passed');
    } catch (error) {
        console.error('❌ Share link preview test failed:', error);
    }

    console.log('=== Tests Complete ===');
}

// Export functions for manual testing
window.exportPreviewTests = {
    runAllTests,
    testPostmanPreview,
    testCurlPreview,
    testOpenApiPreview,
    testShareLinkPreview,
    testRequestData
};

// Auto-run tests if this script is executed
if (typeof window !== 'undefined') {
    console.log('Export preview test functions loaded. Run exportPreviewTests.runAllTests() to test all formats.');
}
