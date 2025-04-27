// client/src/components/ResponseDisplay.js
import React, { useState, useEffect } from 'react';
import './ResponseDisplay.css';
import TestResultsDisplay from './TestResultsDisplay';
import { FiCheckCircle, FiAlertCircle, FiClock, FiFileText, FiCode } from 'react-icons/fi';

const ResponseDisplay = ({ requestId }) => {
    const [response, setResponse] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('body');

    // Fetch response data when requestId changes
    useEffect(() => {
        if (requestId) {
            fetchResponse(requestId);
        } else {
            // Clear response if no requestId
            setResponse(null);
        }
    }, [requestId]);

    const fetchResponse = async (id) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`http://localhost:5001/api/requests/${id}/response`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch response: ${response.statusText}`);
            }

            const data = await response.json();
            setResponse(data);
        } catch (err) {
            console.error('Error fetching response:', err);
            setError(err.message || 'Failed to load response data');
        } finally {
            setLoading(false);
        }
    };

    const formatBytes = (bytes, decimals = 2) => {
        if (!bytes && bytes !== 0) return '';
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        const safeIndex = Math.min(i, sizes.length - 1);
        return parseFloat((bytes / Math.pow(k, safeIndex)).toFixed(dm)) + ' ' + sizes[safeIndex];
    };

    // Renders the response body
    const renderBody = () => {
        if (!response || !response.body) {
            return <div className="empty-body">No response body available</div>;
        }

        let formattedBody;
        let language = 'text';

        // Determine content type and try to format accordingly
        const contentType = response.headers && response.headers['content-type'];

        try {
            if (contentType && contentType.includes('application/json')) {
                // Format JSON
                language = 'json';
                if (typeof response.body === 'string') {
                    formattedBody = JSON.stringify(JSON.parse(response.body), null, 2);
                } else {
                    formattedBody = JSON.stringify(response.body, null, 2);
                }
            } else if (contentType && (contentType.includes('text/html') || contentType.includes('application/xml'))) {
                // Format HTML/XML
                language = contentType.includes('text/html') ? 'html' : 'xml';
                formattedBody = typeof response.body === 'string' ? response.body : String(response.body);
            } else {
                // Default text formatting
                formattedBody = typeof response.body === 'string' ? response.body : JSON.stringify(response.body, null, 2);
            }
        } catch (err) {
            console.warn('Error formatting response body:', err);
            formattedBody = String(response.body);
        }

        return (
            <pre className={`response-body-content language-${language}`}>
                {formattedBody}
            </pre>
        );
    };

    // Renders the response headers
    const renderHeaders = () => {
        if (!response || !response.headers || Object.keys(response.headers).length === 0) {
            return <div className="empty-headers">No headers received</div>;
        }

        return (
            <table className="response-headers-table">
                <thead>
                    <tr>
                        <th>Key</th>
                        <th>Value</th>
                    </tr>
                </thead>
                <tbody>
                    {Object.entries(response.headers).map(([key, value], index) => (
                        <tr key={index}>
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
        if (!response || !response.testResults ||
            (Array.isArray(response.testResults) && response.testResults.length === 0) ||
            (!Array.isArray(response.testResults) && Object.keys(response.testResults).length === 0)) {
            return <div className="empty-tests">No test results available</div>;
        }

        // Ensure testResults is an array
        const testResultsArray = Array.isArray(response.testResults)
            ? response.testResults
            : Object.values(response.testResults);

        return <TestResultsDisplay testResults={testResultsArray} />;
    };

    if (loading) {
        return (
            <div className="response-area loading">
                <div className="response-header">
                    <div className="loading-spinner"></div>
                    <span>Loading response...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="response-area error">
                <div className="response-header">
                    <div className="response-status error">
                        <FiAlertCircle className="status-icon" />
                        <span>Error</span>
                    </div>
                </div>
                <div className="response-body error-body">
                    {error}
                </div>
            </div>
        );
    }

    if (!response) {
        return (
            <div className="response-area no-response">
                <div className="response-header">
                    <div className="no-response-message">
                        Send a request to see the response
                    </div>
                </div>
            </div>
        );
    }

    // Get status code class (2xx, 4xx, etc)
    const statusClass = response.status ? `status-${Math.floor(response.status / 100)}xx` : '';
    const isSuccess = response.status >= 200 && response.status < 300;

    return (
        <div className="response-area">
            <div className="response-header">
                <div className={`response-status ${statusClass}`}>
                    {isSuccess ? (
                        <FiCheckCircle className="status-icon success" />
                    ) : (
                        <FiAlertCircle className="status-icon error" />
                    )}
                    <span className="status-code">{response.status}</span>
                    <span className="status-text">{response.statusText}</span>
                </div>
                <div className="response-meta">
                    {response.duration !== undefined && (
                        <span className="response-time">
                            <FiClock className="meta-icon" />
                            {response.duration} ms
                        </span>
                    )}
                    {response.size !== undefined && (
                        <span className="response-size">
                            <FiFileText className="meta-icon" />
                            {formatBytes(response.size)}
                        </span>
                    )}
                </div>
            </div>

            <div className="response-section-tabs">
                <div
                    className={`response-section-tab ${activeTab === 'body' ? 'active' : ''}`}
                    onClick={() => setActiveTab('body')}
                >
                    Body
                </div>
                <div
                    className={`response-section-tab ${activeTab === 'headers' ? 'active' : ''}`}
                    onClick={() => setActiveTab('headers')}
                >
                    Headers
                </div>
                <div
                    className={`response-section-tab ${activeTab === 'tests' ? 'active' : ''}`}
                    onClick={() => setActiveTab('tests')}
                >
                    Tests
                    {response.testResults && (
                        <span className="test-badge">
                            {Array.isArray(response.testResults)
                                ? `${response.testResults.filter(t => t.passed).length}/${response.testResults.length}`
                                : ''}
                        </span>
                    )}
                </div>
            </div>

            <div className="response-body">
                {activeTab === 'body' && renderBody()}
                {activeTab === 'headers' && renderHeaders()}
                {activeTab === 'tests' && renderTestResults()}
            </div>
        </div>
    );
};

export default ResponseDisplay;