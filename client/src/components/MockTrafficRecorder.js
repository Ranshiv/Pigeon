// client/src/components/MockTrafficRecorder.js
import React, { useState, useEffect, useCallback } from 'react';
import {
    FiPlay, FiSquare, FiRefreshCw, FiDownload, FiUpload, FiTrash2,
    FiClock, FiActivity, FiEye, FiFilter, FiChevronDown, FiChevronUp,
    FiFastForward, FiPause, FiCopy, FiCheck, FiInbox, FiAlertCircle
} from 'react-icons/fi';
import AppSelect from './common/AppSelect/AppSelect';
import './MockTrafficRecorder.css';

const REPLAY_SPEED_OPTIONS = [
    { value: 0.5, label: '0.5x' },
    { value: 1, label: '1x' },
    { value: 2, label: '2x' },
    { value: 5, label: '5x' },
    { value: 10, label: '10x' }
];

const METHOD_FILTER_OPTIONS = [
    { value: '', label: 'All Methods' },
    { value: 'GET', label: 'GET' },
    { value: 'POST', label: 'POST' },
    { value: 'PUT', label: 'PUT' },
    { value: 'DELETE', label: 'DELETE' },
    { value: 'PATCH', label: 'PATCH' }
];

const STATUS_FILTER_OPTIONS = [
    { value: '', label: 'All Status' },
    { value: '2xx', label: '2xx Success' },
    { value: '4xx', label: '4xx Client Error' },
    { value: '5xx', label: '5xx Server Error' }
];

const MockTrafficRecorder = ({ mockServerId, serverName }) => {
    const [recordings, setRecordings] = useState([]);
    const [activeRecording, setActiveRecording] = useState(null);
    const [selectedRecording, setSelectedRecording] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedRequest, setExpandedRequest] = useState(null);
    const [replaySpeed, setReplaySpeed] = useState(1);
    const [isReplaying, setIsReplaying] = useState(false);
    const [filter, setFilter] = useState({ method: '', status: '' });
    const [copiedCard, setCopiedCard] = useState(null);

    const fetchRecordings = useCallback(async () => {
        if (!mockServerId) return;

        try {
            setIsLoading(true);
            const response = await fetch(`/api/mock-servers/${mockServerId}/recordings`, {
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Failed to fetch recordings');

            const data = await response.json();
            setRecordings(data.recordings || []);
            setActiveRecording(data.activeRecording);
            setError(null);
        } catch (err) {
            console.error('Error fetching recordings:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [mockServerId]);

    useEffect(() => {
        fetchRecordings();
    }, [fetchRecordings]);

    // Polling for active recording status
    useEffect(() => {
        if (activeRecording) {
            const interval = setInterval(fetchRecordings, 5000);
            return () => clearInterval(interval);
        }
    }, [activeRecording, fetchRecordings]);

    const startRecording = async () => {
        try {
            const response = await fetch(`/api/mock-servers/${mockServerId}/recording/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    name: `Recording ${new Date().toLocaleString()}`
                })
            });

            if (!response.ok) throw new Error('Failed to start recording');

            const data = await response.json();
            setActiveRecording(data.recording);
        } catch (err) {
            console.error('Error starting recording:', err);
            setError(err.message);
        }
    };

    const stopRecording = async () => {
        try {
            const response = await fetch(`/api/mock-servers/${mockServerId}/recording/stop`, {
                method: 'POST',
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Failed to stop recording');

            setActiveRecording(null);
            await fetchRecordings();
        } catch (err) {
            console.error('Error stopping recording:', err);
            setError(err.message);
        }
    };

    const deleteRecording = async (recordingId) => {
        if (!window.confirm('Delete this recording?')) return;

        try {
            const response = await fetch(
                `/api/mock-servers/${mockServerId}/recordings/${recordingId}`,
                {
                    method: 'DELETE',
                    credentials: 'include'
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to delete recording');
            }

            if (selectedRecording?._id === recordingId) {
                setSelectedRecording(null);
            }
            await fetchRecordings();
        } catch (err) {
            console.error('Error deleting recording:', err);
            setError(err.message);
        }
    };

    const exportRecording = async (recordingId, format = 'har') => {
        try {
            const response = await fetch(
                `/api/mock-servers/${mockServerId}/recordings/${recordingId}/export?format=${format}`,
                { credentials: 'include' }
            );

            if (!response.ok) throw new Error('Failed to export recording');

            const data = await response.json();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `recording-${recordingId}.${format}.json`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Error exporting recording:', err);
            setError(err.message);
        }
    };

    const importRecording = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const content = await file.text();
            const harData = JSON.parse(content);

            const response = await fetch(`/api/mock-servers/${mockServerId}/recordings/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(harData)
            });

            if (!response.ok) throw new Error('Failed to import recording');

            await fetchRecordings();
            event.target.value = ''; // Reset file input
        } catch (err) {
            console.error('Error importing recording:', err);
            setError(err.message);
        }
    };

    const replayRecording = async (recordingId) => {
        setIsReplaying(true);
        try {
            const response = await fetch(
                `/api/mock-servers/${mockServerId}/recordings/${recordingId}/replay`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ speed: replaySpeed })
                }
            );

            if (!response.ok) throw new Error('Failed to replay recording');

            // Replay started successfully
        } catch (err) {
            console.error('Error replaying recording:', err);
            setError(err.message);
        } finally {
            setIsReplaying(false);
        }
    };

    const viewRecording = async (recordingId) => {
        try {
            const response = await fetch(
                `/api/mock-servers/${mockServerId}/recordings/${recordingId}`,
                { credentials: 'include' }
            );

            if (!response.ok) throw new Error('Failed to fetch recording details');

            const data = await response.json();
            setSelectedRecording(data);
        } catch (err) {
            console.error('Error fetching recording:', err);
            setError(err.message);
        }
    };

    const getResponseStatus = (request) => request.response?.statusCode ?? request.response?.status;

    const filteredRequests = selectedRecording?.requests?.filter(req => {
        if (filter.method && req.method !== filter.method) return false;
        if (filter.status) {
            const status = getResponseStatus(req);
            const statusMatch = filter.status === '2xx' ? status >= 200 && status < 300 :
                filter.status === '4xx' ? status >= 400 && status < 500 :
                    filter.status === '5xx' ? status >= 500 : true;
            if (!statusMatch) return false;
        }
        return true;
    });

    const formatDuration = (ms) => {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    };

    const formatRecordingDate = (value) => {
        if (!value) return 'Not available';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString();
    };

    const getRecordingDuration = (recording) => {
        if (Number.isFinite(recording?.stats?.totalDuration)) return recording.stats.totalDuration;
        if (recording?.startedAt && recording?.endedAt) {
            return Math.max(0, new Date(recording.endedAt) - new Date(recording.startedAt));
        }
        return 0;
    };

    const copyToClipboard = async (content, cardId) => {
        try {
            const textToCopy = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
            await navigator.clipboard.writeText(textToCopy);
            setCopiedCard(cardId);
            setTimeout(() => setCopiedCard(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    if (!mockServerId) {
        return (
            <div className="traffic-recorder-empty">
                <FiActivity size={48} />
                <h3>Select a Mock Server</h3>
                <p>Choose a mock server to record and replay traffic</p>
            </div>
        );
    }

    return (
        <div className="traffic-recorder">
            {/* Header */}
            <div className="recorder-header">
                <div className="header-title">
                    <h2>
                        <FiActivity size={20} />
                        Traffic Recorder
                    </h2>
                    {serverName && <span className="server-name">{serverName}</span>}
                </div>
                <div className="header-actions">
                    {activeRecording ? (
                        <button className="btn-recording stop" onClick={stopRecording}>
                            <FiSquare size={14} />
                            Stop Recording
                            <span className="recording-indicator"></span>
                        </button>
                    ) : (
                        <button className="btn-recording start" onClick={startRecording}>
                            <FiPlay size={14} />
                            Start Recording
                        </button>
                    )}
                    <label className="btn-import">
                        <FiUpload size={14} />
                        Import HAR
                        <input
                            type="file"
                            accept=".har,.json"
                            onChange={importRecording}
                            hidden
                        />
                    </label>
                    <button
                        className="btn-icon-text"
                        onClick={fetchRecordings}
                        disabled={isLoading}
                    >
                        <FiRefreshCw size={14} className={isLoading ? 'spinning' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            {error && (
                <div className="recorder-error" role="alert">
                    <FiAlertCircle size={17} aria-hidden="true" />
                    <span className="recorder-error-message">{error}</span>
                    <button type="button" onClick={() => setError(null)}>Dismiss</button>
                </div>
            )}

            {/* Active Recording Banner */}
            {activeRecording && (
                <div className="active-recording-banner">
                    <div className="recording-status">
                        <span className="recording-dot"></span>
                        <strong>Recording in progress</strong>
                        {activeRecording.recordingName && (
                            <span className="recording-name">: {activeRecording.recordingName}</span>
                        )}
                    </div>
                    <div className="recording-stats">
                        <span>{activeRecording.requestCount || 0} requests captured</span>
                        <span>Started {new Date(activeRecording.startedAt).toLocaleTimeString()}</span>
                    </div>
                </div>
            )}

            <div className="recorder-content">
                {/* Recordings List */}
                <div className="recordings-panel">
                    <h3>Recordings</h3>
                    {isLoading && !recordings.length ? (
                        <div className="loading-state">
                            <div className="spinner"></div>
                            <p>Loading recordings...</p>
                        </div>
                    ) : recordings.length > 0 ? (
                        <div className="recordings-list">
                            {recordings.map((recording) => (
                                <div
                                    key={recording._id}
                                    className={`recording-item ${selectedRecording?._id === recording._id ? 'selected' : ''}`}
                                    onClick={() => viewRecording(recording._id)}
                                >
                                    <div className="recording-info">
                                        <span className="recording-name">{recording.name}</span>
                                        <div className="recording-meta">
                                            <span>
                                                <FiClock size={12} />
                                                {new Date(recording.createdAt).toLocaleDateString()}
                                            </span>
                                            <span>
                                                <FiActivity size={12} />
                                                {recording.requestCount || 0} requests
                                            </span>
                                        </div>
                                    </div>
                                    <div className="recording-actions">
                                        <button
                                            className="btn-icon"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                exportRecording(recording._id);
                                            }}
                                            title="Export as HAR"
                                        >
                                            <FiDownload size={14} />
                                        </button>
                                        <button
                                            className="btn-icon danger"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteRecording(recording._id);
                                            }}
                                            title="Delete"
                                        >
                                            <FiTrash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <p>No recordings yet</p>
                            <span>Start recording to capture traffic</span>
                        </div>
                    )}
                </div>

                {/* Recording Details */}
                <div className={`recording-details-panel ${selectedRecording ? '' : 'is-empty'}`}>
                    {selectedRecording ? (
                        <>
                            <div className="details-header">
                                <h3>{selectedRecording.name}</h3>
                                <div className="details-actions">
                                    <div className="replay-controls">
                                        <label>Speed:</label>
                                        <AppSelect
                                            className="replay-speed-select"
                                            value={replaySpeed}
                                            onChange={setReplaySpeed}
                                            options={REPLAY_SPEED_OPTIONS}
                                        />
                                        <button
                                            className="btn-replay"
                                            onClick={() => replayRecording(selectedRecording._id)}
                                            disabled={isReplaying}
                                        >
                                            {isReplaying ? (
                                                <>
                                                    <FiPause size={14} />
                                                    Replaying...
                                                </>
                                            ) : (
                                                <>
                                                    <FiFastForward size={14} />
                                                    Replay
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Recording Summary */}
                                <div className="recording-summary">
                                    <div className="summary-item">
                                        <span className="summary-value">{selectedRecording.stats?.totalRequests ?? selectedRecording.requests?.length ?? 0}</span>
                                    <span className="summary-label">Total Requests</span>
                                </div>
                                <div className="summary-item">
                                    <span className="summary-value">
                                        {formatDuration(getRecordingDuration(selectedRecording))}
                                    </span>
                                    <span className="summary-label">Duration</span>
                                </div>
                                <div className="summary-item">
                                    <span className="summary-value">
                                        {formatRecordingDate(selectedRecording.startedAt || selectedRecording.createdAt)}
                                    </span>
                                    <span className="summary-label">Recorded At</span>
                                </div>
                            </div>

                            {/* Filters */}
                            <div className="request-filters">
                                <FiFilter size={14} />
                                <AppSelect
                                    className="recorder-filter-select"
                                    value={filter.method}
                                    onChange={(method) => setFilter(prev => ({ ...prev, method }))}
                                    options={METHOD_FILTER_OPTIONS}
                                />
                                <AppSelect
                                    className="recorder-filter-select"
                                    value={filter.status}
                                    onChange={(status) => setFilter(prev => ({ ...prev, status }))}
                                    options={STATUS_FILTER_OPTIONS}
                                />
                            </div>

                            <div className="requests-panel">
                                <div className="requests-panel-header">
                                    <div>
                                        <p className="requests-panel-label">Requests</p>
                                        <p className="requests-count">{filteredRequests?.length || 0} requests</p>
                                    </div>
                                    {filteredRequests?.length > 0 && (
                                        <div className="status-legend" aria-label="Response status legend">
                                            <span className="legend-dot legend-2xx"><i aria-hidden="true" />2xx</span>
                                            <span className="legend-dot legend-4xx"><i aria-hidden="true" />4xx</span>
                                            <span className="legend-dot legend-5xx"><i aria-hidden="true" />5xx</span>
                                        </div>
                                    )}
                                </div>

                                <div className="requests-list">
                                    {filteredRequests?.length > 0 ? (
                                        filteredRequests.map((req, index) => (
                                            <div
                                                key={`${req.method}-${req.path}-${index}`}
                                                className={`request-card ${expandedRequest === index ? 'expanded' : ''}`}
                                            >
                                                <button
                                                    className="request-card-header"
                                                    onClick={() => setExpandedRequest(expandedRequest === index ? null : index)}
                                                    type="button"
                                                >
                                                    <div className="request-card-main">
                                                        <span className={`method-tag ${req.method?.toLowerCase()}`}>
                                                            {req.method}
                                                        </span>
                                                        <div className="request-path-group">
                                                            <span className="request-path">{req.path}</span>
                                                        </div>
                                                    </div>
                                                    <div className="request-card-meta">
                                                        {getResponseStatus(req) && (
                                                            <span className={`status-chip status-${Math.floor(getResponseStatus(req) / 100)}xx`}>
                                                                {getResponseStatus(req)}
                                                            </span>
                                                        )}
                                                        <span className="timing">{req.timing ?? req.response?.duration ?? 0}ms</span>
                                                        <span className="timestamp">
                                                            {req.timestamp ? new Date(req.timestamp).toLocaleTimeString() : ''}
                                                        </span>
                                                        {expandedRequest === index ? (
                                                            <FiChevronUp size={18} />
                                                        ) : (
                                                            <FiChevronDown size={18} />
                                                        )}
                                                    </div>
                                                </button>

                                                {expandedRequest === index && (
                                                    <div className="request-card-body">
                                                        <div className="detail-grid">
                                                            <div className="detail-card">
                                                                <div className="detail-card-title-row">
                                                                    <p className="detail-card-title">Request Headers</p>
                                                                    <button
                                                                        className="btn-copy-detail"
                                                                        onClick={() => copyToClipboard(req.headers || {}, `req-headers-${index}`)}
                                                                        title="Copy to clipboard"
                                                                    >
                                                                        {copiedCard === `req-headers-${index}` ? (
                                                                            <FiCheck size={14} />
                                                                        ) : (
                                                                            <FiCopy size={14} />
                                                                        )}
                                                                    </button>
                                                                </div>
                                                                <pre>{JSON.stringify(req.headers || {}, null, 2)}</pre>
                                                            </div>
                                                            {req.response && (
                                                                <div className="detail-card">
                                                                    <div className="detail-card-title-row">
                                                                        <p className="detail-card-title">Response Headers</p>
                                                                        <button
                                                                            className="btn-copy-detail"
                                                                            onClick={() => copyToClipboard(req.response.headers || {}, `res-headers-${index}`)}
                                                                            title="Copy to clipboard"
                                                                        >
                                                                            {copiedCard === `res-headers-${index}` ? (
                                                                                <FiCheck size={14} />
                                                                            ) : (
                                                                                <FiCopy size={14} />
                                                                            )}
                                                                        </button>
                                                                    </div>
                                                                    <pre>{JSON.stringify(req.response.headers || {}, null, 2)}</pre>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {req.body && (
                                                            <div className="detail-card full-width">
                                                                <div className="detail-card-title-row">
                                                                    <p className="detail-card-title">Request Body</p>
                                                                    <button
                                                                        className="btn-copy-detail"
                                                                        onClick={() => copyToClipboard(req.body, `req-body-${index}`)}
                                                                        title="Copy to clipboard"
                                                                    >
                                                                        {copiedCard === `req-body-${index}` ? (
                                                                            <FiCheck size={14} />
                                                                        ) : (
                                                                            <FiCopy size={14} />
                                                                        )}
                                                                    </button>
                                                                </div>
                                                                <pre>{typeof req.body === 'string' ? req.body : JSON.stringify(req.body, null, 2)}</pre>
                                                            </div>
                                                        )}
                                                        {req.response?.body && (
                                                            <div className="detail-card full-width">
                                                                <div className="detail-card-title-row">
                                                                    <p className="detail-card-title">Response Body</p>
                                                                    <button
                                                                        className="btn-copy-detail"
                                                                        onClick={() => copyToClipboard(req.response.body, `res-body-${index}`)}
                                                                        title="Copy to clipboard"
                                                                    >
                                                                        {copiedCard === `res-body-${index}` ? (
                                                                            <FiCheck size={14} />
                                                                        ) : (
                                                                            <FiCopy size={14} />
                                                                        )}
                                                                    </button>
                                                                </div>
                                                                <pre>{typeof req.response.body === 'string'
                                                                    ? req.response.body
                                                                    : JSON.stringify(req.response.body, null, 2)}
                                                                </pre>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="requests-empty-state">
                                            <div className="requests-empty-icon">
                                                <FiInbox size={28} />
                                            </div>
                                            <div className="requests-empty-content">
                                                <p className="requests-empty-title">No requests match your filters</p>
                                                <p className="requests-empty-subtitle">
                                                    Adjust the filters or start recording to see traffic here.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="recording-empty-state">
                            <div className="recording-empty-icon">
                                <FiEye size={28} />
                            </div>
                            <div className="recording-empty-content">
                                <h3>Select a recording to review</h3>
                                <p>Choose any recording from the left panel to see captured requests, responses, and metadata.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MockTrafficRecorder;
