// client/src/components/HistoryDetailsSection.js
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import HistorySection from './HistorySection';
import ResponseDisplay from './ResponseDisplay';
import './HistoryDetailsSection.css';

const HistoryDetailsSection = () => {
    const [history, setHistory] = useState([]);
    const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
    const [loading, setLoading] = useState(false);
    const [debug, setDebug] = useState(null); // For debugging
    const navigate = useNavigate();

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/history', {
                credentials: 'include'
            });
            if (response.ok) {
                const historyData = await response.json();
                setHistory(historyData);

                // If we have an ID in the URL, select that history item
                const pathParts = window.location.pathname.split('/');
                const historyId = pathParts[pathParts.length - 1];
                if (historyId && historyId !== 'history') {
                    const selectedItem = historyData.find(item => item._id === historyId);
                    if (selectedItem) {
                        setSelectedHistoryItem(selectedItem);

                        // Debug: Log test results format
                        if (selectedItem.testResults) {
                            console.log('Test results type:', typeof selectedItem.testResults);
                            console.log('Test results value:', selectedItem.testResults);
                            setDebug({
                                type: typeof selectedItem.testResults,
                                value: JSON.stringify(selectedItem.testResults, null, 2)
                            });
                        }
                    }
                }
            } else {
                console.error('Failed to fetch history:', response.statusText);
            }
        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectHistory = (historyItem) => {
        setSelectedHistoryItem(historyItem);

        // Debug: Log test results format when selecting history item
        if (historyItem.testResults) {
            console.log('Selecting item with test results:', historyItem.testResults);
            setDebug({
                type: typeof historyItem.testResults,
                value: JSON.stringify(historyItem.testResults, null, 2)
            });
        } else {
            setDebug(null);
        }

        navigate(`/workspace/history/${historyItem._id}`);
    };

    // Transform history item into format expected by ResponseDisplay
    const prepareResponseData = (historyItem) => {
        if (!historyItem) return null;

        let responseBody;
        try {
            // If it was JSON, parse it back from string
            if (historyItem.isJson && historyItem.responseBody) {
                responseBody = JSON.parse(historyItem.responseBody);
            } else {
                responseBody = historyItem.responseBody;
            }
        } catch (error) {
            console.error('Error parsing response body:', error);
            responseBody = historyItem.responseBody;
        }

        let responseHeaders;
        try {
            // Parse headers from string back to object
            responseHeaders = historyItem.responseHeaders ? JSON.parse(historyItem.responseHeaders) : {};
        } catch (error) {
            console.error('Error parsing response headers:', error);
            responseHeaders = {};
        }

        // Process test results data properly
        let testResults = null;
        if (historyItem.testResults) {
            // If it's already an array, use it directly
            if (Array.isArray(historyItem.testResults)) {
                testResults = historyItem.testResults;
            }
            // If it's a string (from JSON), parse it
            else if (typeof historyItem.testResults === 'string') {
                try {
                    const parsedTests = JSON.parse(historyItem.testResults);
                    testResults = Array.isArray(parsedTests) ? parsedTests : Object.values(parsedTests);
                } catch (error) {
                    console.error('Error parsing test results:', error);
                }
            }
            // If it's an object (already parsed JSON), convert to array if needed
            else if (typeof historyItem.testResults === 'object') {
                testResults = Object.values(historyItem.testResults);
            }
        }

        // Debug: Log what we're passing to ResponseDisplay
        if (testResults) {
            console.log('Prepared test results:', testResults);
        }

        return {
            status: historyItem.responseStatus,
            statusText: historyItem.responseStatusText,
            headers: responseHeaders,
            body: responseBody,
            duration: historyItem.duration,
            size: historyItem.size,
            isJson: historyItem.isJson,
            testResults: testResults
        };
    };

    return (
        <div className="history-details-section">
            <div className="history-sidebar">
                <h2>Request History</h2>
                {loading ? (
                    <p>Loading history...</p>
                ) : (
                    <HistorySection
                        history={history}
                        onSelectHistory={handleSelectHistory}
                    />
                )}
            </div>

            <div className="history-detail-content">
                <Routes>
                    <Route path="/" element={
                        <div className="select-history-prompt">
                            <h2>Request History</h2>
                            <p>Select a history item from the list to view its details.</p>
                        </div>
                    } />
                    <Route path=":id" element={
                        selectedHistoryItem ? (
                            <div className="history-item-detail">
                                <div className="history-meta">
                                    <h2>
                                        <span className={`method-badge method-${selectedHistoryItem.method?.toLowerCase()}`}>
                                            {selectedHistoryItem.method}
                                        </span>
                                        {selectedHistoryItem.url}
                                    </h2>
                                    <p className="history-timestamp">
                                        {new Date(selectedHistoryItem.timestamp).toLocaleString()}
                                    </p>
                                </div>

                                {/* Debug info - will only show during development */}
                                {debug && process.env.NODE_ENV !== 'production' && (
                                    <div className="debug-info">
                                        <h3>Debug: Test Results</h3>
                                        <p>Type: {debug.type}</p>
                                        <pre>{debug.value}</pre>
                                    </div>
                                )}

                                <ResponseDisplay response={prepareResponseData(selectedHistoryItem)} />
                            </div>
                        ) : (
                            <p>Loading history details...</p>
                        )
                    } />
                </Routes>
            </div>
        </div>
    );
};

export default HistoryDetailsSection;