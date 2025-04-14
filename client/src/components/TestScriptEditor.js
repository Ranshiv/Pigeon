// client/src/components/TestScriptEditor.js
import React, { useState, useEffect } from 'react';
import './TestScriptEditor.css';

/**
 * Component for editing test scripts
 * Enables users to write JavaScript code that will be executed after receiving API responses
 */
const TestScriptEditor = ({ script, onChange, scriptType }) => {
    const [currentScript, setCurrentScript] = useState('');

    // Sample test scripts to help users get started
    const sampleAssertionScript = `// Example Test Script
// Available variables:
// - response: The HTTP response object
// - tests: Object to store test results

// Check status code
tests["Status code is 200"] = response.status === 200;

// Verify response contains expected data
const jsonData = response.body;
tests["Response has data"] = jsonData && Object.keys(jsonData).length > 0;

// Verify specific values
if (jsonData) {
  tests["Contains correct ID"] = jsonData.id !== undefined;
  
  // Check response time
  tests["Response time is acceptable"] = response.duration < 1000;
}`;

    const samplePreRequestScript = `// Example Pre-Request Script
// Use this to prepare data before the request is sent
// Available variables:
// - request: The HTTP request object

// Set dynamic variables
const timestamp = Date.now();
request.variables.set("timestamp", timestamp);

// Generate random data
const randomId = Math.floor(Math.random() * 1000);
request.variables.set("randomId", randomId);

// Add or modify headers
request.headers["X-Custom-Header"] = "my-value-" + timestamp;

// Modify request body (for POST/PUT/PATCH)
if (request.body && typeof request.body === 'object') {
  request.body.customField = "Generated at " + new Date().toISOString();
}`;

    useEffect(() => {
        // Initialize with the provided script or a sample if blank
        if (script) {
            setCurrentScript(script);
        } else {
            // Set appropriate sample based on script type
            setCurrentScript(scriptType === 'test' ? sampleAssertionScript : samplePreRequestScript);
        }
    }, [script, scriptType]);

    const handleScriptChange = (e) => {
        const newScript = e.target.value;
        setCurrentScript(newScript);
        onChange(newScript);
    };

    const clearScript = () => {
        setCurrentScript('');
        onChange('');
    };

    const resetToSample = () => {
        const sampleScript = scriptType === 'test' ? sampleAssertionScript : samplePreRequestScript;
        setCurrentScript(sampleScript);
        onChange(sampleScript);
    };

    return (
        <div className="test-script-editor">
            <div className="script-header">
                <h3>{scriptType === 'test' ? 'Test Script' : 'Pre-request Script'}</h3>
                <div className="editor-actions">
                    <button type="button" onClick={clearScript}>Clear</button>
                    <button type="button" onClick={resetToSample}>Reset to Sample</button>
                </div>
            </div>
            <div className="script-info">
                {scriptType === 'test' ? (
                    <p>Write JavaScript to test response data, validate status codes, and check headers</p>
                ) : (
                    <p>Write JavaScript to execute before the request is sent (set variables, modify params, etc.)</p>
                )}
            </div>
            <textarea
                value={currentScript}
                onChange={handleScriptChange}
                className="script-textarea"
                placeholder={`Enter your ${scriptType === 'test' ? 'test' : 'pre-request'} script here...`}
                spellCheck="false"
            />
        </div>
    );
};

export default TestScriptEditor;