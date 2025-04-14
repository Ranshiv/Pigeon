// client/src/components/ResponseDisplay.js (Updated renderHeaders)
import React, { useState } from 'react';
// Removed SyntaxHighlighter imports as per user's last request to pause new features
import './ResponseDisplay.css'; // Make sure CSS is imported
import TestResultsDisplay from './TestResultsDisplay';

const ResponseDisplay = ({ response }) => {
    const [activeTab, setActiveTab] = useState('body');

    if (!response) {
        return null;
    }

    // Display error message if present
    if (response.error) {
        return (
            <div className="response-display error-display">
                <h3>Error</h3>
                <pre>{response.error}</pre>
                {response.duration !== undefined && <p>Time: {response.duration} ms</p>}
            </div>
        );
    }

    const formatBytes = (bytes, decimals = 2) => {
        if (!bytes && bytes !== 0) return ''; // Handle undefined/null
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        const safeIndex = Math.min(i, sizes.length - 1); // Ensure index is valid
        return parseFloat((bytes / Math.pow(k, safeIndex)).toFixed(dm)) + ' ' + sizes[safeIndex];
    };

    // Ensure testResults is an array
    const ensureTestResultsArray = () => {
        if (!response.testResults) {
            return null;
        }

        // If testResults is already an array, return it
        if (Array.isArray(response.testResults)) {
            return response.testResults;
        }

        // If testResults is an object with numeric keys (like from JSON), convert to array
        if (typeof response.testResults === 'object') {
            try {
                // Attempt to convert object to array
                const testArray = Object.values(response.testResults);
                if (testArray.length > 0) {
                    return testArray;
                }
            } catch (err) {
                console.error("Error converting test results to array:", err);
            }
        }

        return [];
    };

    // Get properly formatted test results array
    const testResultsArray = ensureTestResultsArray();

    // Renders the response body
    const renderBody = () => {
        // Basic text display for now
        return <pre>{typeof response.body === 'object' ? JSON.stringify(response.body, null, 2) : String(response.body)}</pre>;
    };

    // Renders the response headers
    const renderHeaders = () => {
        // Check if headers exist and are an object with keys
        if (!response.headers || typeof response.headers !== 'object' || Object.keys(response.headers).length === 0) {
            return <p>No headers received.</p>;
        }

        return (
            <table className="headers-table">
                <thead>
                    <tr>
                        <th>Header Name</th>
                        <th>Header Value</th>
                    </tr>
                </thead>
                <tbody>
                    {/* Map over the header key-value pairs */}
                    {Object.entries(response.headers).map(([key, value]) => (
                        <tr key={key}>
                            <td>{key}</td>
                            <td>{value}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    };

    // Renders the test results tab
    const renderTestResults = () => {
        if (!testResultsArray || testResultsArray.length === 0) {
            return (
                <div className="no-tests-message">
                    <p>No test results available. Add tests to your request to see results here.</p>
                </div>
            );
        }

        return <TestResultsDisplay testResults={testResultsArray} />;
    };

    return (
        <div className="response-display">
            {/* Meta information bar */}
            <div className="response-meta">
                <span className={`status-indicator status-${String(response.status).charAt(0)}xx`}>
                    {response.status} {response.statusText}
                </span>
                {/* Safely access duration and size */}
                {response.duration !== undefined && <span className="meta-item">Time: {response.duration} ms</span>}
                {response.size !== undefined && <span className="meta-item">Size: {formatBytes(response.size)}</span>}
            </div>

            {/* Tabs */}
            <div className="response-tabs">
                <button onClick={() => setActiveTab('body')} className={activeTab === 'body' ? 'active' : ''}>Body</button>
                <button onClick={() => setActiveTab('headers')} className={activeTab === 'headers' ? 'active' : ''}>Headers</button>
                <button onClick={() => setActiveTab('tests')} className={activeTab === 'tests' ? 'active' : ''}>
                    Tests
                    {testResultsArray && testResultsArray.length > 0 && (
                        <span className="test-result-badge">
                            {testResultsArray.filter(test => test.passed).length}/{testResultsArray.length}
                        </span>
                    )}
                </button>
            </div>

            {/* Content based on active tab */}
            <div className="response-content">
                {activeTab === 'body' && renderBody()}
                {activeTab === 'headers' && renderHeaders()}
                {activeTab === 'tests' && renderTestResults()}
            </div>
        </div>
    );
};

export default ResponseDisplay;