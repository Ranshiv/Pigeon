// client/src/components/HistoryDetailsSection.js
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams, Link } from 'react-router-dom';
import HistorySection from './HistorySection';
import ResponseDisplay from './ResponseDisplay';
import { FiClock, FiChevronLeft, FiShare2, FiTrash2, FiRepeat, FiDownload } from 'react-icons/fi';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
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

    const handleExportToPDF = async () => {
        if (!selectedHistoryItem) return;

        try {
            // Create a clean version of the content for PDF
            const exportContent = document.createElement('div');
            exportContent.style.cssText = `
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                width: 800px;
                padding: 30px;
                background: white;
                color: #000;
                line-height: 1.6;
            `;

            // Add content to the export div
            exportContent.innerHTML = `
                <div style="text-align: center; margin-bottom: 40px; border-bottom: 2px solid #014C75; padding-bottom: 20px;">
                    <h1 style="color: #014C75; margin: 0; font-size: 28px;">API Request History</h1>
                    <p style="color: #666; margin: 10px 0 0 0; font-size: 16px;">Generated on ${new Date().toLocaleString()}</p>
                </div>

                <div style="margin-bottom: 30px;">
                    <h2 style="color: #014C75; font-size: 22px; margin-bottom: 15px; display: flex; align-items: center;">
                        <span style="background: ${getMethodColor(selectedHistoryItem.method)}; color: white; padding: 4px 12px; border-radius: 4px; font-size: 14px; margin-right: 12px;">${selectedHistoryItem.method}</span>
                        ${selectedHistoryItem.url}
                    </h2>
                    <div style="display: flex; gap: 20px; margin-bottom: 20px;">
                        <span style="background: ${getStatusBgColor(selectedHistoryItem.responseStatus)}; color: white; padding: 6px 12px; border-radius: 6px; font-weight: bold;">
                            Status: ${selectedHistoryItem.responseStatus} ${selectedHistoryItem.responseStatusText}
                        </span>
                        <span style="background: #f8f9fa; padding: 6px 12px; border-radius: 6px; color: #333;">
                            Time: ${new Date(selectedHistoryItem.timestamp).toLocaleString()}
                        </span>
                        ${selectedHistoryItem.duration ? `
                        <span style="background: #e3f2fd; padding: 6px 12px; border-radius: 6px; color: #1976d2;">
                            Duration: ${selectedHistoryItem.duration}ms
                        </span>` : ''}
                    </div>
                </div>

                <div style="margin-bottom: 30px;">
                    <h3 style="color: #014C75; font-size: 18px; margin-bottom: 15px; border-bottom: 1px solid #e1e4e8; padding-bottom: 8px;">Request Details</h3>
                    
                    <div style="margin-bottom: 20px;">
                        <h4 style="color: #333; margin-bottom: 8px; font-size: 14px; font-weight: 600;">URL:</h4>
                        <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; font-family: 'Courier New', monospace; word-break: break-all; border-left: 4px solid #014C75;">
                            ${selectedHistoryItem.url}
                        </div>
                    </div>

                    <div style="margin-bottom: 20px;">
                        <h4 style="color: #333; margin-bottom: 8px; font-size: 14px; font-weight: 600;">Method:</h4>
                        <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; font-family: 'Courier New', monospace;">
                            ${selectedHistoryItem.method}
                        </div>
                    </div>

                    ${selectedHistoryItem.requestHeaders ? `
                    <div style="margin-bottom: 20px;">
                        <h4 style="color: #333; margin-bottom: 8px; font-size: 14px; font-weight: 600;">Headers:</h4>
                        <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; font-family: 'Courier New', monospace; font-size: 12px; max-height: 200px; overflow-y: auto;">
                            <pre style="margin: 0; white-space: pre-wrap;">${JSON.stringify(JSON.parse(selectedHistoryItem.requestHeaders || '{}'), null, 2)}</pre>
                        </div>
                    </div>` : ''}

                    ${selectedHistoryItem.requestBody ? `
                    <div style="margin-bottom: 20px;">
                        <h4 style="color: #333; margin-bottom: 8px; font-size: 14px; font-weight: 600;">Request Body:</h4>
                        <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; font-family: 'Courier New', monospace; font-size: 12px; max-height: 300px; overflow-y: auto;">
                            <pre style="margin: 0; white-space: pre-wrap;">${typeof selectedHistoryItem.requestBody === 'string' ? selectedHistoryItem.requestBody : JSON.stringify(selectedHistoryItem.requestBody, null, 2)}</pre>
                        </div>
                    </div>` : ''}
                </div>

                <div style="margin-bottom: 30px;">
                    <h3 style="color: #014C75; font-size: 18px; margin-bottom: 15px; border-bottom: 1px solid #e1e4e8; padding-bottom: 8px;">Response Details</h3>
                    
                    <div style="margin-bottom: 20px;">
                        <h4 style="color: #333; margin-bottom: 8px; font-size: 14px; font-weight: 600;">Status:</h4>
                        <div style="background: ${getStatusBgColor(selectedHistoryItem.responseStatus)}; color: white; padding: 12px; border-radius: 6px; font-weight: bold;">
                            ${selectedHistoryItem.responseStatus} ${selectedHistoryItem.responseStatusText}
                        </div>
                    </div>

                    ${selectedHistoryItem.responseHeaders ? `
                    <div style="margin-bottom: 20px;">
                        <h4 style="color: #333; margin-bottom: 8px; font-size: 14px; font-weight: 600;">Response Headers:</h4>
                        <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; font-family: 'Courier New', monospace; font-size: 12px; max-height: 200px; overflow-y: auto;">
                            <pre style="margin: 0; white-space: pre-wrap;">${JSON.stringify(JSON.parse(selectedHistoryItem.responseHeaders || '{}'), null, 2)}</pre>
                        </div>
                    </div>` : ''}

                    ${selectedHistoryItem.responseBody ? `
                    <div style="margin-bottom: 20px;">
                        <h4 style="color: #333; margin-bottom: 8px; font-size: 14px; font-weight: 600;">Response Body:</h4>
                        <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; font-family: 'Courier New', monospace; font-size: 12px; max-height: 400px; overflow-y: auto; border-left: 4px solid #28a745;">
                            <pre style="margin: 0; white-space: pre-wrap;">${selectedHistoryItem.isJson ? JSON.stringify(JSON.parse(selectedHistoryItem.responseBody), null, 2) : selectedHistoryItem.responseBody}</pre>
                        </div>
                    </div>` : ''}

                    ${selectedHistoryItem.size ? `
                    <div style="display: flex; gap: 20px; margin-top: 20px;">
                        <span style="background: #f0f8ff; padding: 8px 12px; border-radius: 6px; color: #1976d2;">
                            Response Size: ${selectedHistoryItem.size} bytes
                        </span>
                        ${selectedHistoryItem.duration ? `
                        <span style="background: #f0f8ff; padding: 8px 12px; border-radius: 6px; color: #1976d2;">
                            Response Time: ${selectedHistoryItem.duration}ms
                        </span>` : ''}
                    </div>` : ''}
                </div>

                <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e1e4e8; color: #666; font-size: 12px;">
                    <p>Generated by Pigeon API Testing Tool</p>
                </div>
            `;

            // Temporarily add to DOM for rendering
            document.body.appendChild(exportContent);

            // Generate PDF using html2canvas and jsPDF
            const canvas = await html2canvas(exportContent, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff'
            });

            // Remove the temporary element
            document.body.removeChild(exportContent);

            // Create PDF
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const imgData = canvas.toDataURL('image/png');
            const imgWidth = 210; // A4 width in mm
            const pageHeight = 295; // A4 height in mm
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;

            let position = 0;

            // Add first page
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            // Add additional pages if needed
            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            // Save the PDF
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `pigeon-api-history-${selectedHistoryItem.method}-${timestamp}.pdf`;
            pdf.save(filename);

        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Failed to generate PDF. Please try again.');
        }
    };

    // Helper functions for PDF styling
    const getMethodColor = (method) => {
        const colors = {
            'GET': '#28a745',
            'POST': '#007bff',
            'PUT': '#fd7e14',
            'DELETE': '#dc3545',
            'PATCH': '#6f42c1',
            'HEAD': '#6c757d',
            'OPTIONS': '#17a2b8'
        };
        return colors[method?.toUpperCase()] || '#6c757d';
    };

    const getStatusBgColor = (status) => {
        if (!status) return '#6c757d';
        if (status >= 200 && status < 300) return '#28a745';
        if (status >= 300 && status < 400) return '#17a2b8';
        if (status >= 400 && status < 500) return '#fd7e14';
        if (status >= 500) return '#dc3545';
        return '#6c757d';
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
            {loading && history.length === 0 ? (
                // Show loading in full screen when initially loading
                <div className="history-loading-fullscreen">
                    <div className="loading-content">
                        <div className="loading-spinner"></div>
                        <h3>Loading History</h3>
                        <p>Fetching your request history...</p>
                    </div>
                </div>
            ) : (
                <>
                    <div className="history-sidebar">
                        <HistorySection
                            history={history}
                            onSelectHistory={handleSelectHistory}
                            selectedId={selectedHistoryItem?._id}
                            loading={false}
                        />
                    </div>

                    <div className="history-detail-content">
                        <Routes>
                            <Route path="/" element={
                                <div className="select-history-prompt">
                                    <div className="empty-state-icon">
                                        <FiClock size={64} />
                                    </div>
                                    <h2>Request History</h2>
                                    <p>Select a request from the list to view its details.</p>
                                    {error && <div className="error-message">{error}</div>}
                                </div>
                            } />
                            <Route path=":id" element={
                                loading ? (
                                    <div className="loading-container">
                                        <div className="loading-content">
                                            <div className="loading-spinner"></div>
                                            <h3>Loading Request Details</h3>
                                            <p>Please wait while we fetch the request information...</p>
                                        </div>
                                    </div>
                                ) : error ? (
                                    <div className="error-container">
                                        <div className="error-content">
                                            <div className="error-icon">⚠️</div>
                                            <h3>Unable to Load Request</h3>
                                            <div className="error-message">{error}</div>
                                            <Link to="/workspace/history" className="back-button">
                                                <FiChevronLeft /> Back to History
                                            </Link>
                                        </div>
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
                                                    onClick={handleExportToPDF}
                                                    title="Export as PDF"
                                                >
                                                    <FiDownload /> Export PDF
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
                                            <ResponseDisplay responseData={prepareResponseData(selectedHistoryItem)} />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="select-history-prompt">
                                        <div className="empty-state-icon">
                                            <FiClock size={64} />
                                        </div>
                                        <h2>Request Not Found</h2>
                                        <p>The requested history item could not be found or is still loading...</p>
                                        <Link to="/workspace/history" className="back-button-primary">
                                            <FiChevronLeft /> Back to History
                                        </Link>
                                    </div>
                                )
                            } />
                        </Routes>
                    </div>
                </>
            )}
        </div>
    );
};

export default HistoryDetailsSection;