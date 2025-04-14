// client/src/components/TestResultsDisplay.js
import React from 'react';
import './TestResultsDisplay.css';

/**
 * Component for displaying test results from API test scripts
 * Shows passed/failed tests with details and timing information
 */
const TestResultsDisplay = ({ testResults }) => {
    console.log('TestResultsDisplay received:', testResults);

    // Enhanced validation for test results
    if (!testResults) {
        return (
            <div className="test-results-empty">
                <p>No test results available. Run tests to see results here.</p>
            </div>
        );
    }

    // Ensure we're working with an array
    const resultsArray = Array.isArray(testResults)
        ? testResults
        : (typeof testResults === 'object' ? Object.values(testResults) : []);

    if (resultsArray.length === 0) {
        return (
            <div className="test-results-empty">
                <p>No test results available. Run tests to see results here.</p>
            </div>
        );
    }

    // Make sure each test has a name and passed property
    const normalizedResults = resultsArray.map((test, idx) => {
        if (typeof test !== 'object' || test === null) {
            return {
                name: `Test ${idx + 1}`,
                passed: false,
                error: 'Invalid test result format'
            };
        }

        return {
            name: test.name || `Test ${idx + 1}`,
            passed: !!test.passed,
            error: test.error || (test.passed ? null : 'Test failed'),
            duration: test.duration
        };
    });

    // Calculate summary counts
    const totalTests = normalizedResults.length;
    const passedTests = normalizedResults.filter(test => test.passed).length;
    const failedTests = totalTests - passedTests;
    const successRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

    return (
        <div className="test-results-display">
            <div className="test-summary">
                <h3>Test Results Summary</h3>
                <div className="summary-stats">
                    <div className="stat-item">
                        <span className="stat-value">{totalTests}</span>
                        <span className="stat-label">Total Tests</span>
                    </div>
                    <div className="stat-item passed">
                        <span className="stat-value">{passedTests}</span>
                        <span className="stat-label">Passed</span>
                    </div>
                    <div className="stat-item failed">
                        <span className="stat-value">{failedTests}</span>
                        <span className="stat-label">Failed</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-value">{successRate}%</span>
                        <span className="stat-label">Success Rate</span>
                    </div>
                </div>
                <div className="progress-bar">
                    <div
                        className="progress"
                        style={{ width: `${successRate}%`, backgroundColor: successRate === 100 ? '#28a745' : '#ffc107' }}
                    ></div>
                </div>
            </div>

            <div className="test-details">
                <h3>Test Details</h3>
                <div className="test-list">
                    {normalizedResults.map((test, index) => (
                        <div key={index} className={`test-item ${test.passed ? 'passed' : 'failed'}`}>
                            <div className="test-status">
                                <span className={`status-icon ${test.passed ? 'passed' : 'failed'}`}>
                                    {test.passed ? '✓' : '✗'}
                                </span>
                            </div>
                            <div className="test-info">
                                <div className="test-name">{test.name}</div>
                                {!test.passed && test.error && (
                                    <div className="test-error">{test.error}</div>
                                )}
                                {test.duration !== undefined && (
                                    <div className="test-duration">{test.duration} ms</div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TestResultsDisplay;