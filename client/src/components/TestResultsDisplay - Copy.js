// client/src/components/TestResultsDisplay.js
import React, { useState } from 'react';
import './TestResultsDisplay.css';
import { FiCheck, FiX, FiChevronRight, FiChevronDown, FiDownload } from 'react-icons/fi';

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
            <div className="tr-empty">
                <p>No test results available. Run tests to see results here.</p>
                <p className="tr-tip">
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
            <div className="tr-empty">
                <p>No test results available. Run tests to see results here.</p>
                <p className="tr-tip">
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

    // Progress bar variant by threshold
    const progressVariant = successRate === 100 ? 'ok' : successRate >= 80 ? 'warn' : 'fail';

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

    const stats = [
        { value: totalTests, label: 'Total' },
        { value: passedTests, label: 'Passed', modifier: 'passed' },
        { value: failedTests, label: 'Failed', modifier: 'failed' },
        { value: `${successRate}%`, label: 'Success Rate' }
    ];

    const filters = [
        { key: 'all', label: `All (${totalTests})` },
        { key: 'passed', label: `Passed (${passedTests})` },
        { key: 'failed', label: `Failed (${failedTests})` }
    ];

    return (
        <div className="tr-shell">
            <div className="tr-summary">
                <div className="tr-summary-head">
                    <h3 className="tr-h3">Test Results Summary</h3>
                    <button className="tr-export-btn" onClick={exportTestResults} title="Export results as JSON">
                        <FiDownload /> Export
                    </button>
                </div>
                <div className="tr-stats">
                    {stats.map(s => (
                        <div key={s.label} className={`tr-stat ${s.modifier ? `tr-stat--${s.modifier}` : ''}`}>
                            <span className="tr-stat-value">{s.value}</span>
                            <span className="tr-stat-label">{s.label}</span>
                        </div>
                    ))}
                </div>
                <div className="tr-progress">
                    <div className={`tr-progress-fill tr-progress-fill--${progressVariant}`} style={{ width: `${successRate}%` }} />
                </div>
            </div>

            <div className="tr-details">
                <div className="tr-details-head">
                    <h3 className="tr-h3">Test Details</h3>
                    <div className="tr-filters">
                        {filters.map(f => (
                            <button
                                key={f.key}
                                className={`tr-filter ${filterStatus === f.key ? 'tr-filter--active' : ''}`}
                                onClick={() => setFilterStatus(f.key)}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="tr-list">
                    {filteredResults.length === 0 ? (
                        <div className="tr-no-results">No test results match the current filter.</div>
                    ) : (
                        filteredResults.map((test, index) => (
                            <div
                                key={index}
                                className={`tr-item ${test.passed ? 'tr-item--passed' : 'tr-item--failed'} ${expandedItems[index] ? 'tr-item--expanded' : ''}`}
                                role="button"
                                aria-expanded={!!expandedItems[index]}
                                tabIndex={0}
                                onClick={() => toggleExpandItem(index)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpandItem(index); } }}
                            >
                                <div className="tr-item-head">
                                    <span className={`tr-glyph ${test.passed ? 'tr-glyph--passed' : 'tr-glyph--failed'}`}>
                                        {test.passed ? <FiCheck /> : <FiX />}
                                    </span>
                                    <div className="tr-item-info">
                                        <div className="tr-name">{test.name}</div>
                                        <div className="tr-meta">
                                            {test.duration !== undefined && (
                                                <span className="tr-duration">{test.duration} ms</span>
                                            )}
                                            <span className="tr-timestamp">
                                                {new Date(test.timestamp).toLocaleTimeString()}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="tr-chevron">
                                        {expandedItems[index] ? <FiChevronDown /> : <FiChevronRight />}
                                    </span>
                                </div>

                                {expandedItems[index] && (
                                    <div className="tr-item-body">
                                        <pre className="tr-code">
                                            {test.passed
                                                ? `Test Passed: "${test.name}"\nResult: ${test.passed}\nTime: ${new Date(test.timestamp).toLocaleString()}`
                                                : `Test Failed: "${test.name}"\nError: ${test.error || 'Assertion failed'}\nTime: ${new Date(test.timestamp).toLocaleString()}`
                                            }
                                        </pre>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="tr-cicd">
                <h4 className="tr-cicd-h4">CI/CD Integration</h4>
                <p>These test results can be exported for use in CI/CD pipelines. Use the CLI runner to automate these tests.</p>
                <pre className="tr-cicd-cmd">
                    pigeon run --collection "my-collection" --environment "production" --reporter junit
                </pre>
                <p className="tr-small-note">See documentation for more CI/CD integration options.</p>
            </div>
        </div>
    );
};

export default TestResultsDisplay;
