// client/src/components/TestScriptEditor.js
import React, { useState, useEffect } from 'react';
import './TestScriptEditor.css';

/**
 * Component for editing test scripts
 * Enables users to write JavaScript code that will be executed after receiving API responses
 */
const TestScriptEditor = ({ script, onChange, scriptType }) => {
    const [currentScript, setCurrentScript] = useState('');
    const [showSnippets, setShowSnippets] = useState(false);
    const [selectedSnippet, setSelectedSnippet] = useState(null);

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

    // Advanced sample test script with more assertions and JSON schema validation
    const advancedTestScript = `// Advanced Test Script Example
// Validate status codes
tests["Success status code"] = response.status >= 200 && response.status < 300;

// Check headers
tests["Content-Type is present"] = response.headers["content-type"] !== undefined;
tests["Content-Type is JSON"] = response.headers["content-type"].includes("application/json");

// Validate response structure
const data = response.body;
tests["Has required fields"] = data && data.id && data.name;

// Test response time
tests["Response time under 500ms"] = response.duration < 500;

// JSON Schema validation example
const schema = {
  type: "object",
  required: ["id", "name"],
  properties: {
    id: { type: "number" },
    name: { type: "string" }
  }
};

function validateSchema(data, schema) {
  // Basic schema validation
  if (schema.type === "object" && typeof data !== "object") return false;
  
  // Check required fields
  if (schema.required) {
    for (const field of schema.required) {
      if (data[field] === undefined) return false;
    }
  }
  
  // Check property types
  if (schema.properties) {
    for (const [key, prop] of Object.entries(schema.properties)) {
      if (data[key] !== undefined) {
        if (prop.type === "number" && typeof data[key] !== "number") return false;
        if (prop.type === "string" && typeof data[key] !== "string") return false;
      }
    }
  }
  
  return true;
}

tests["Validates against schema"] = validateSchema(data, schema);`;

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

    // Advanced pre-request script with more functionalities
    const advancedPreRequestScript = `// Advanced Pre-Request Script Example
// Generate a UUID for request tracking
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Set request ID
const requestId = generateUUID();
request.variables.set("requestId", requestId);

// Add authentication header (example for bearer token)
request.headers["Authorization"] = "Bearer " + request.variables.get("accessToken");

// Add timestamp header for request signing
const timestamp = Date.now();
request.headers["X-Timestamp"] = timestamp.toString();

// Create a digital signature (example)
function createSignature(data, secret) {
  // In a real implementation, you would use a proper crypto library
  // This is just a simplified example
  return btoa(JSON.stringify(data) + secret);
}

// Add signature header
const signature = createSignature({
  method: request.method,
  url: request.url,
  timestamp: timestamp
}, "your-secret-key");

request.headers["X-Signature"] = signature;

// Modify JSON body with additional data
if (request.body && request.bodyType === 'json') {
  try {
    const bodyObj = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    bodyObj.metadata = {
      clientId: "my-client-app",
      timestamp: new Date().toISOString(),
      requestId: requestId
    };
    request.body = JSON.stringify(bodyObj);
  } catch (e) {
    console.error("Failed to parse JSON body", e);
  }
}

console.log("Pre-request script executed successfully");`;

    // Code snippets that users can insert
    const codeSnippets = {
        test: [
            {
                name: "Status Code Check",
                code: `// Check for successful status code\ntests["Status code is 200"] = response.status === 200;\n`
            },
            {
                name: "Response Time Check",
                code: `// Verify response time is acceptable\ntests["Fast response time"] = response.duration < 500; // 500ms\n`
            },
            {
                name: "JSON Content Check",
                code: `// Verify response is valid JSON\ntests["Valid JSON response"] = typeof response.body === "object";\n`
            },
            {
                name: "Header Check",
                code: `// Check for specific header\ntests["Content-Type is present"] = response.headers["content-type"] !== undefined;\n`
            }
        ],
        preRequest: [
            {
                name: "Add Timestamp Header",
                code: `// Add current timestamp as header\nrequest.headers["X-Timestamp"] = Date.now().toString();\n`
            },
            {
                name: "Generate Random ID",
                code: `// Generate and store a random ID\nconst randomId = Math.floor(Math.random() * 10000);\nrequest.variables.set("randomId", randomId);\n`
            },
            {
                name: "Add Auth Header",
                code: `// Add authentication header\nrequest.headers["Authorization"] = "Bearer " + request.variables.get("authToken");\n`
            },
            {
                name: "Modify JSON Body",
                code: `// Add fields to JSON body\nif (request.body && request.bodyType === 'json') {\n  try {\n    const bodyObj = JSON.parse(request.body);\n    bodyObj.timestamp = new Date().toISOString();\n    request.body = JSON.stringify(bodyObj);\n  } catch (e) {\n    console.error("Failed to parse JSON body", e);\n  }\n}\n`
            }
        ]
    };

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

    const loadAdvancedSample = () => {
        const advancedScript = scriptType === 'test' ? advancedTestScript : advancedPreRequestScript;
        setCurrentScript(advancedScript);
        onChange(advancedScript);
    };

    const insertSnippet = (snippet) => {
        // Insert snippet at cursor position or at the end
        const textarea = document.querySelector('.script-editor');
        const cursorPosition = textarea?.selectionStart || currentScript.length;

        const newScript =
            currentScript.substring(0, cursorPosition) +
            snippet.code +
            currentScript.substring(cursorPosition);

        setCurrentScript(newScript);
        onChange(newScript);
        setShowSnippets(false);
    };

    return (
        <div className="test-script-editor">
            <div className="script-header">
                <h3>{scriptType === 'test' ? 'Test Script' : 'Pre-request Script'}</h3>
                <div className="editor-actions">
                    <button
                        type="button"
                        className="snippet-button"
                        onClick={() => setShowSnippets(!showSnippets)}
                    >
                        Insert Snippet
                    </button>
                    <button type="button" onClick={clearScript}>Clear</button>
                    <button type="button" onClick={resetToSample}>Basic Sample</button>
                    <button type="button" onClick={loadAdvancedSample}>Advanced Sample</button>
                </div>
            </div>
            <div className="script-info">
                {scriptType === 'test' ? (
                    <p>Write JavaScript to test response data, validate status codes, and check headers</p>
                ) : (
                    <p>Write JavaScript to modify your request before it is sent</p>
                )}
            </div>

            {showSnippets && (
                <div className="snippet-menu">
                    <h4>Code Snippets</h4>
                    <div className="snippet-list">
                        {codeSnippets[scriptType === 'test' ? 'test' : 'preRequest'].map((snippet, index) => (
                            <div
                                key={index}
                                className="snippet-item"
                                onClick={() => insertSnippet(snippet)}
                            >
                                {snippet.name}
                            </div>
                        ))}
                    </div>
                    <button
                        className="close-snippets"
                        onClick={() => setShowSnippets(false)}
                    >
                        Close
                    </button>
                </div>
            )}

            <textarea
                value={currentScript}
                onChange={handleScriptChange}
                className="script-editor"
                placeholder={`Write your ${scriptType === 'test' ? 'test' : 'pre-request'} script here...`}
                spellCheck="false"
            />
            <div className="script-footer">
                <span className="script-hint">Press Ctrl+Space for autocomplete (coming soon)</span>
                <span className="script-length">{currentScript.length} characters</span>
            </div>
        </div>
    );
};

export default TestScriptEditor;