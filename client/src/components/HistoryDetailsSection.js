// client/src/components/HistoryDetailsSection.js
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams, Link } from 'react-router-dom';
import HistorySection from './HistorySection';
import ResponseDisplay from './ResponseDisplay';
import { FiClock, FiChevronLeft, FiShare2, FiTrash2, FiRepeat, FiDownload } from 'react-icons/fi';
import './HistoryDetailsSection.css';

const HistoryDetailsSection = () => {
    const [history, setHistory] = useState([]);
    const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const navigate = useNavigate();
    const { id: urlParamId } = useParams();

    useEffect(() => {
        fetchHistory();
    }, []);

    // Re-fetch when URL param changes
    useEffect(() => {
        if (urlParamId && !selectedHistoryItem) {
            fetchHistoryById(urlParamId);
        }
    }, [urlParamId]);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch('http://localhost:5001/api/history', {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Error: ${response.status} ${response.statusText}`);
            }

            const historyData = await response.json();
            setHistory(historyData);

            // If we have an ID in the URL, select that history item
            if (urlParamId) {
                const selectedItem = historyData.find(item => item._id === urlParamId);
                if (selectedItem) {
                    setSelectedHistoryItem(selectedItem);
                } else {
                    setError(`Request with ID ${urlParamId} not found`);
                }
            }
        } catch (error) {
            console.error('Error fetching history:', error);
            setError(`Failed to load history: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const fetchHistoryById = async (id) => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch(`http://localhost:5001/api/history/${id}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Error: ${response.status} ${response.statusText}`);
            }

            const historyItem = await response.json();
            setSelectedHistoryItem(historyItem);
        } catch (error) {
            console.error('Error fetching history item:', error);
            setError(`Failed to load request: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectHistory = (historyItem) => {
        setSelectedHistoryItem(historyItem);
        navigate(`/workspace/history/${historyItem._id}`);
    };

    const handleDeleteRequest = async (id) => {
        // Ask for confirmation before deleting
        if (!window.confirm("Are you sure you want to delete this API request history?")) {
            return;
        }

        try {
            setDeletingId(id);
            const response = await fetch(`http://localhost:5001/api/history/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Error: ${response.status} ${response.statusText}`);
            }

            // Remove the deleted item from state
            setHistory(history.filter(item => item._id !== id));

            // If we just deleted the selected item, navigate back to history root
            if (selectedHistoryItem && selectedHistoryItem._id === id) {
                setSelectedHistoryItem(null);
                navigate('/workspace/history');
            }

            // Show success toast or notification here if you have one
        } catch (error) {
            console.error('Error deleting history item:', error);
            // Show error toast or notification here if you have one
        } finally {
            setDeletingId(null);
        }
    };

    const handleReplayRequest = (request) => {
        // Implementation for replaying the request in a new tab
        // This should pass the request data to your request form component
        if (request) {
            // Store request data in localStorage to avoid complex state management
            localStorage.setItem('replayRequest', JSON.stringify({
                url: request.url,
                method: request.method,
                headers: request.requestHeaders ? JSON.parse(request.requestHeaders) : {},
                body: request.requestBody
            }));

            // Navigate to the request form page
            navigate('/workspace');
        }
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

    // Helper function to get response status color class
    const getStatusColorClass = (status) => {
        if (!status) return '';

        if (status >= 200 && status < 300) return 'status-success';
        if (status >= 300 && status < 400) return 'status-redirect';
        if (status >= 400 && status < 500) return 'status-client-error';
        if (status >= 500) return 'status-server-error';

        return '';
    };

    return (
        <div className="history-details-section">
            <div className="history-sidebar">
                <HistorySection
                    history={history}
                    onSelectHistory={handleSelectHistory}
                />
            </div>

            <div className="history-detail-content">
                <Routes>
                    <Route path="/" element={
                        <div className="select-history-prompt">
                            <div className="empty-state-icon">
                                <FiClock size={48} />
                            </div>
                            <h2>Request History</h2>
                            <p>Select a request from the list to view its details.</p>
                            {error && <div className="error-message">{error}</div>}
                        </div>
                    } />
                    <Route path=":id" element={
                        loading ? (
                            <div className="loading-container">
                                <div className="loading-spinner"></div>
                                <p>Loading request details...</p>
                            </div>
                        ) : error ? (
                            <div className="error-container">
                                <div className="error-message">{error}</div>
                                <Link to="/workspace/history" className="back-button">
                                    <FiChevronLeft /> Back to History
                                </Link>
                            </div>
                        ) : selectedHistoryItem ? (
                            <div className="history-item-detail">
                                <div className="history-detail-header">
                                    <div className="history-nav">
                                        <Link to="/workspace/history" className="back-button">
                                            <FiChevronLeft /> Back to History
                                        </Link>
                                    </div>
                                    <div className="history-meta">
                                        <h2>
                                            <span className={`method-badge method-${selectedHistoryItem.method?.toLowerCase()}`}>
                                                {selectedHistoryItem.method}
                                            </span>
                                            <span className="history-url">{selectedHistoryItem.url}</span>
                                        </h2>
                                        <div className="history-info">
                                            <span className={`status-indicator ${getStatusColorClass(selectedHistoryItem.responseStatus)}`}>
                                                {selectedHistoryItem.responseStatus} {selectedHistoryItem.responseStatusText}
                                            </span>
                                            <span className="history-timestamp">
                                                {new Date(selectedHistoryItem.timestamp).toLocaleString()}
                                            </span>
                                            {selectedHistoryItem.duration && (
                                                <span className="history-duration">
                                                    {selectedHistoryItem.duration} ms
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="history-actions">
                                        <button
                                            className="action-button replay-button"
                                            onClick={() => handleReplayRequest(selectedHistoryItem)}
                                            title="Replay this request"
                                        >
                                            <FiRepeat /> Replay
                                        </button>
                                        <button
                                            className="action-button share-button"
                                            title="Share this request"
                                        >
                                            <FiShare2 /> Share
                                        </button>
                                        <button
                                            className="action-button download-button"
                                            title="Download as HAR file"
                                        >
                                            <FiDownload /> Export
                                        </button>
                                        <button
                                            className="action-button delete-button"
                                            onClick={() => handleDeleteRequest(selectedHistoryItem._id)}
                                            disabled={deletingId === selectedHistoryItem._id}
                                            title="Delete this request history"
                                        >
                                            <FiTrash2 /> {deletingId === selectedHistoryItem._id ? 'Deleting...' : 'Delete'}
                                        </button>
                                    </div>
                                </div>

                                {/* Request Details Section */}
                                <div className="request-details-section">
                                    <h3>Request</h3>
                                    <div className="request-details-content">
                                        {/* URL */}
                                        <div className="detail-group">
                                            <div className="detail-label">URL:</div>
                                            <div className="detail-value url-value">
                                                {selectedHistoryItem.url}
                                            </div>
                                        </div>

                                        {/* Method */}
                                        <div className="detail-group">
                                            <div className="detail-label">Method:</div>
                                            <div className="detail-value">
                                                {selectedHistoryItem.method}
                                            </div>
                                        </div>

                                        {/* Request Headers */}
                                        {selectedHistoryItem.requestHeaders && (
                                            <div className="detail-group">
                                                <div className="detail-label">Headers:</div>
                                                <div className="detail-value">
                                                    <pre>{JSON.stringify(JSON.parse(selectedHistoryItem.requestHeaders || '{}'), null, 2)}</pre>
                                                </div>
                                            </div>
                                        )}

                                        {/* Request Body */}
                                        {selectedHistoryItem.requestBody && (
                                            <div className="detail-group">
                                                <div className="detail-label">Body:</div>
                                                <div className="detail-value">
                                                    <pre>{typeof selectedHistoryItem.requestBody === 'string' ? selectedHistoryItem.requestBody : JSON.stringify(selectedHistoryItem.requestBody, null, 2)}</pre>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Response Section */}
                                <div className="response-section">
                                    <h3>Response</h3>
                                    <ResponseDisplay response={prepareResponseData(selectedHistoryItem)} />
                                </div>
                            </div>
                        ) : (
                            <div className="select-history-prompt">
                                <p>Request not found or still loading...</p>
                                <Link to="/workspace/history" className="back-button">
                                    <FiChevronLeft /> Back to History
                                </Link>
                            </div>
                        )
                    } />
                </Routes>
            </div>
        </div>
    );
};

export default HistoryDetailsSection;