// client/src/components/HistoryDetailsSection.js
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams, Link } from 'react-router-dom';
import HistorySection from './HistorySection';
import ResponseDisplay from './ResponseDisplay';
import { FiClock, FiChevronLeft, FiShare2, FiTrash2, FiRepeat, FiDownload } from 'react-icons/fi';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import PageLoader from './common/PageLoader/PageLoader';
import './HistoryDetailsSection.css';

const HistoryDetailsSection = () => {
    const [history, setHistory] = useState([]);
    const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const navigate = useNavigate();
    const params = useParams();
    const urlParamId = params['*'] || params.id || '';

    useEffect(() => {
        fetchHistory();
    }, []);

    useEffect(() => {
        if (urlParamId && selectedHistoryItem?._id !== urlParamId) {
            fetchHistoryById(urlParamId);
        }
    }, [urlParamId]);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch('/api/history', { credentials: 'include' });
            if (!response.ok) {
                throw new Error(`Error: ${response.status} ${response.statusText}`);
            }
            const historyData = await response.json();
            const sortedHistory = historyData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            setHistory(sortedHistory);

            if (urlParamId) {
                const selectedItem = historyData.find(item => item._id === urlParamId);
                if (selectedItem) {
                    setSelectedHistoryItem(selectedItem);
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
            const response = await fetch(`/api/history/${id}`, { credentials: 'include' });
            if (response.status === 404) {
                setSelectedHistoryItem(null);
                return;
            }
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
        if (!window.confirm("Are you sure you want to delete this API request history?")) {
            return;
        }

        try {
            setDeletingId(id);
            const response = await fetch(`/api/history/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Error: ${response.status} ${response.statusText}`);
            }

            setHistory(history.filter(item => item._id !== id));

            if (selectedHistoryItem && selectedHistoryItem._id === id) {
                setSelectedHistoryItem(null);
                navigate('/workspace/history');
            }
        } catch (error) {
            console.error('Error deleting history item:', error);
        } finally {
            setDeletingId(null);
        }
    };

    const handleReplayRequest = (request) => {
        if (request) {
            localStorage.setItem('replayRequest', JSON.stringify({
                url: request.url,
                method: request.method,
                headers: request.requestHeaders ? JSON.parse(request.requestHeaders) : {},
                body: request.requestBody
            }));
            navigate('/workspace/api-network/explore');
        }
    };

    const handleExportToPDF = async () => {
        if (!selectedHistoryItem) return;

        try {
            const exportContent = document.createElement('div');
            exportContent.style.cssText = "font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; width: 800px; padding: 30px; background: white; color: #000; line-height: 1.6;";

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
                    </div>` : ''}
                </div>
                <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e1e4e8; color: #666; font-size: 12px;">
                    <p>Generated by Pigeon API Testing Tool</p>
                </div>
            `;

            document.body.appendChild(exportContent);

            const canvas = await html2canvas(exportContent, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff'
            });

            document.body.removeChild(exportContent);

            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const imgData = canvas.toDataURL('image/png');
            const imgWidth = 210;
            const pageHeight = 295;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `pigeon-api-history-${selectedHistoryItem.method}-${timestamp}.pdf`;
            pdf.save(filename);
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Failed to generate PDF. Please try again.');
        }
    };

    const getMethodColor = (method) => {
        const colors = {
            'GET': '#28a745', 'POST': '#007bff', 'PUT': '#fd7e14',
            'DELETE': '#dc3545', 'PATCH': '#6f42c1', 'HEAD': '#6c757d',
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

    const prepareResponseData = (historyItem) => {
        if (!historyItem) return null;

        let responseBody;
        try {
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
            responseHeaders = historyItem.responseHeaders ? JSON.parse(historyItem.responseHeaders) : {};
        } catch (error) {
            console.error('Error parsing response headers:', error);
            responseHeaders = {};
        }

        let testResults = null;
        if (historyItem.testResults) {
            if (Array.isArray(historyItem.testResults)) {
                testResults = historyItem.testResults;
            } else if (typeof historyItem.testResults === 'string') {
                try {
                    const parsedTests = JSON.parse(historyItem.testResults);
                    testResults = Array.isArray(parsedTests) ? parsedTests : Object.values(parsedTests);
                } catch (error) {
                    console.error('Error parsing test results:', error);
                }
            } else if (typeof historyItem.testResults === 'object') {
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

    const getStatusColorClass = (status) => {
        if (!status) return '';
        if (status >= 200 && status < 300) return 'status-success';
        if (status >= 300 && status < 400) return 'status-redirect';
        if (status >= 400 && status < 500) return 'status-client-error';
        if (status >= 500) return 'status-server-error';
        return '';
    };

    return (
        <div className="hst-layout">
            {loading && history.length === 0 ? (
                <div className="hst-loading-fullscreen">
                    <PageLoader size="lg" label="Fetching your request history..." />
                </div>
            ) : (
                <>
                    <div className="hst-sidebar">
                        <HistorySection
                            history={history}
                            onSelectHistory={handleSelectHistory}
                            selectedId={selectedHistoryItem?._id}
                            loading={false}
                        />
                    </div>

                    <div className="hst-detail-content">
                        <Routes>
                            <Route path="/" element={
                                <div className="hst-prompt">
                                    <div className="hst-prompt-icon">
                                        <FiClock size={64} />
                                    </div>
                                    <h2 className="hst-prompt-title">Request History</h2>
                                    <p className="hst-prompt-text">Select a request from the list to view its details.</p>
                                    {error && <div className="hst-error-banner">{error}</div>}
                                </div>
                            } />
                            <Route path=":id" element={
                                loading ? (
                                    <div className="hst-loading-container">
                                        <PageLoader size="lg" label="Please wait while we fetch the request information..." />
                                    </div>
                                ) : error ? (
                                    <div className="hst-error-container">
                                        <div className="hst-error-content">
                                            <div className="hst-error-icon">⚠️</div>
                                            <h3 className="hst-error-title">Unable to Load Request</h3>
                                            <div className="hst-error-banner">{error}</div>
                                            <Link to="/workspace/history" className="hst-btn hst-btn--ghost">
                                                <FiChevronLeft /> Back to History
                                            </Link>
                                        </div>
                                    </div>
                                ) : selectedHistoryItem ? (
                                    <div className="hst-detail-view">
                                        <div className="hst-detail-header-card">
                                            <div className="hst-nav">
                                                <Link to="/workspace/history" className="hst-btn hst-btn--ghost hst-back-btn">
                                                    <FiChevronLeft /> Back to History
                                                </Link>
                                            </div>
                                            <div className="hst-detail-meta">
                                                <h2 className="hst-detail-url-container">
                                                    <span className={`hst-method-badge hst-method-badge--${selectedHistoryItem.method?.toLowerCase()}`}>
                                                        {selectedHistoryItem.method}
                                                    </span>
                                                    <span className="hst-detail-url">{selectedHistoryItem.url}</span>
                                                </h2>
                                                <div className="hst-detail-info">
                                                    <span className={`hst-status-indicator hst-status-indicator--${getStatusColorClass(selectedHistoryItem.responseStatus)}`}>
                                                        {selectedHistoryItem.responseStatus} {selectedHistoryItem.responseStatusText}
                                                    </span>
                                                    <span className="hst-detail-timestamp">
                                                        {new Date(selectedHistoryItem.timestamp).toLocaleString()}
                                                    </span>
                                                    {selectedHistoryItem.duration && (
                                                        <span className="hst-detail-duration">
                                                            {selectedHistoryItem.duration} ms
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="hst-detail-actions">
                                                <button
                                                    className="hst-btn hst-btn--primary hst-action-btn"
                                                    onClick={() => handleReplayRequest(selectedHistoryItem)}
                                                    title="Replay this request"
                                                >
                                                    <FiRepeat /> Replay
                                                </button>
                                                <button
                                                    className="hst-btn hst-btn--ghost hst-action-btn"
                                                    title="Share this request"
                                                >
                                                    <FiShare2 /> Share
                                                </button>
                                                <button
                                                    className="hst-btn hst-btn--ghost hst-action-btn"
                                                    onClick={handleExportToPDF}
                                                    title="Export as PDF"
                                                >
                                                    <FiDownload /> Export PDF
                                                </button>
                                                <button
                                                    className="hst-btn hst-btn--ghost hst-action-btn hst-delete-btn"
                                                    onClick={() => handleDeleteRequest(selectedHistoryItem._id)}
                                                    disabled={deletingId === selectedHistoryItem._id}
                                                    title="Delete this request history"
                                                >
                                                    <FiTrash2 /> {deletingId === selectedHistoryItem._id ? 'Deleting...' : 'Delete'}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="hst-detail-card">
                                            <h3 className="hst-card-title">Request</h3>
                                            <div className="hst-card-content">
                                                <div className="hst-kv">
                                                    <span className="hst-k">URL:</span>
                                                    <span className="hst-v hst-v--mono">{selectedHistoryItem.url}</span>

                                                    <span className="hst-k">Method:</span>
                                                    <span className="hst-v">{selectedHistoryItem.method}</span>

                                                    {selectedHistoryItem.requestHeaders && (
                                                        <>
                                                            <span className="hst-k">Headers:</span>
                                                            <span className="hst-v hst-v--mono">
                                                                <pre className="hst-code-block">{JSON.stringify(JSON.parse(selectedHistoryItem.requestHeaders || '{}'), null, 2)}</pre>
                                                            </span>
                                                        </>
                                                    )}

                                                    {selectedHistoryItem.requestBody && (
                                                        <>
                                                            <span className="hst-k">Body:</span>
                                                            <span className="hst-v hst-v--mono">
                                                                <pre className="hst-code-block">{typeof selectedHistoryItem.requestBody === 'string' ? selectedHistoryItem.requestBody : JSON.stringify(selectedHistoryItem.requestBody, null, 2)}</pre>
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="hst-detail-card">
                                            <h3 className="hst-card-title">Response</h3>
                                            <div className="hst-response-content">
                                                <ResponseDisplay responseData={prepareResponseData(selectedHistoryItem)} />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="hst-prompt">
                                        <div className="hst-prompt-icon">
                                            <FiClock size={64} />
                                        </div>
                                        <h2 className="hst-prompt-title">Request Not Found</h2>
                                        <p className="hst-prompt-text">The requested history item could not be found or is still loading...</p>
                                        <Link to="/workspace/history" className="hst-btn hst-btn--primary">
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
