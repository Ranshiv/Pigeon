// client/src/components/TestResultsDisplay.js
import React, { useState } from 'react';
import './TestResultsDisplay.css';

/**
 * Component for displaying test results from API test scripts
 * Shows passed/failed tests with details and timing information
 */
const TestResultsDisplay = ({ testResults }) => {
    const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'passed', 'failed'
    const [expandedItems, setExpandedItems] = useState({});

    // Enhanced validation for test results
    if (!testResults) {
        return (
            <div className="test-results-empty">
                <p>No test results available. Run tests to see results here.</p>
                <p className="test-tip">
                    Write test scripts to validate your API responses, check status codes,
                    and verify expected data.
                </p>
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
                <p className="test-tip">
                    Write test scripts to validate your API responses, check status codes,
                    and verify expected data.
                </p>
            </div>
        );
    }

    // Make sure each test has a name and passed property
    const normalizedResults = resultsArray.map((test, idx) => {
        if (typeof test !== 'object' || test === null) {
            return {
                name: `Test ${idx + 1}`,
                passed: false,
                error: 'Invalid test result format',
                timestamp: Date.now()
            };
        }

        return {
            name: test.name || `Test ${idx + 1}`,
            passed: !!test.passed,
            error: test.error || (test.passed ? null : 'Test failed'),
            duration: test.duration,
            timestamp: test.timestamp || Date.now()
        };
    });

    // Calculate summary counts
    const totalTests = normalizedResults.length;
    const passedTests = normalizedResults.filter(test => test.passed).length;
    const failedTests = totalTests - passedTests;
    const successRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

    // Apply filtering
    const filteredResults = normalizedResults.filter(test => {
        if (filterStatus === 'all') return true;
        if (filterStatus === 'passed') return test.passed;
        if (filterStatus === 'failed') return !test.passed;
        return true;
    });

    const toggleExpandItem = (index) => {
        setExpandedItems(prev => ({
            ...prev,
            [index]: !prev[index]
        }));
    };

    const exportTestResults = () => {
        // Create exportable test report
        const report = {
            summary: {
                total: totalTests,
                passed: passedTests,
                failed: failedTests,
                successRate: successRate
            },
            timestamp: new Date().toISOString(),
            results: normalizedResults
        };
        
        // Convert to JSON
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Create download link
        const a = document.createElement('a');
        a.href = url;
        a.download = `test-results-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="test-results-display">
            <div className="test-summary">
                <div className="summary-header">
                    <h3>Test Results Summary</h3>
                    <div className="test-actions">
                        <button className="export-button" onClick={exportTestResults} title="Export results as JSON">
                            Export Results
                        </button>
                    </div>
                </div>
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
                        style={{ 
                            width: `${successRate}%`, 
                            backgroundColor: successRate === 100 
                                ? '#28a745' 
                                : successRate >= 80 
                                    ? '#ffc107' 
                                    : '#dc3545' 
                        }}
                    ></div>
                </div>
            </div>

            <div className="test-details">
                <div className="test-details-header">
                    <h3>Test Details</h3>
                    <div className="test-filters">
                        <button 
                            className={`filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
                            onClick={() => setFilterStatus('all')}
                        >
                            All ({totalTests})
                        </button>
                        <button 
                            className={`filter-btn ${filterStatus === 'passed' ? 'active' : ''}`}
                            onClick={() => setFilterStatus('passed')}
                        >
                            Passed ({passedTests})
                        </button>
                        <button 
                            className={`filter-btn ${filterStatus === 'failed' ? 'active' : ''}`}
                            onClick={() => setFilterStatus('failed')}
                        >
                            Failed ({failedTests})
                        </button>
                    </div>
                </div>
                <div className="test-list">
                    {filteredResults.length === 0 ? (
                        <div className="no-results-message">
                            No test results match the current filter.
                        </div>
                    ) : (
                        filteredResults.map((test, index) => (
                            <div 
                                key={index} 
                                className={`test-item ${test.passed ? 'passed' : 'failed'} ${expandedItems[index] ? 'expanded' : ''}`}
                                onClick={() => toggleExpandItem(index)}
                            >
                                <div className="test-header">
                                    <div className="test-status">
                                        <span className={`status-icon ${test.passed ? 'passed' : 'failed'}`}>
                                            {test.passed ? '✓' : '✗'}
                                        </span>
                                    </div>
                                    <div className="test-info">
                                        <div className="test-name">{test.name}</div>
                                        <div className="test-meta">
                                            {test.duration !== undefined && (
                                                <span className="test-duration">{test.duration} ms</span>
                                            )}
                                            <span className="test-timestamp">
                                                {new Date(test.timestamp).toLocaleTimeString()}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="expand-icon">
                                        {expandedItems[index] ? '▼' : '▶'}
                                    </div>
                                </div>
                                
                                {expandedItems[index] && (
                                    <div className="test-details-content">
                                        <div className="test-result-code">
                                            <pre className="test-code-block">
                                                {test.passed
                                                    ? `Test Passed: "${test.name}"\n` +
                                                      `Result: ${test.passed}\n` +
                                                      `Time: ${new Date(test.timestamp).toLocaleString()}`
                                                    : `Test Failed: "${test.name}"\n` +
                                                      `Error: ${test.error || 'Assertion failed'}\n` +
                                                      `Time: ${new Date(test.timestamp).toLocaleString()}`
                                                }
                                            </pre>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
            
            <div className="ci-cd-tips">
                <h4>CI/CD Integration</h4>
                <p>These test results can be exported for use in CI/CD pipelines. Use the CLI runner to automate these tests.</p>
                <pre className="ci-cd-command">
                    pigeon run --collection "my-collection" --environment "production" --reporter junit
                </pre>
                <p className="small-note">See documentation for more CI/CD integration options.</p>
            </div>
        </div>
    );
};

export default TestResultsDisplay;