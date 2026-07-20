import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
// import ExploreSection from './ExploreSection';
import SpotlightSection from './SpotlightSection';
import AIAgentToolsSection from './AIAgentToolsSection';
import RequestForm from './RequestForm';
import ResponseDisplay from './ResponseDisplay';
import HistorySection from './HistorySection';
import ExplorePage from './marketplace/ExplorePage';
import MarketplaceModerationQueue from './marketplace/MarketplaceModerationQueue';
import { toast } from 'react-toastify';
import { FiPlus, FiFileText, FiSearch, FiChevronRight, FiGrid, FiClock, FiSidebar, FiChevronsLeft } from 'react-icons/fi';
import MainShell from './common/MainShell/MainShell';
import Footer from './Footer';
// ponytail: RequestWorkspaceNew never created; RequestForm is the 2026 redesign replacement.
// Revert to real import when ./request/RequestWorkspaceNew lands.
import RequestWorkspaceNew from './RequestForm';
import './APINetworkSection.css';

const APINetworkSection = () => {
    const [requests, setRequests] = useState([]);
    const [history, setHistory] = useState([]);
    const [isLoadingRequests, setIsLoadingRequests] = useState(true);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [response, setResponse] = useState(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [sidebarBtnCorner, setSidebarBtnCorner] = useState(() => {
        const c = localStorage.getItem('sidebarBtnCorner');
        return c === 'bottom-left' ? c : 'top-left'; // left side only
    });
    const [dragPos, setDragPos] = useState(null); // {top,left} while dragging, else null
    const dragState = useRef({ moved: false });
    const navigate = useNavigate();

    // Drag the "Show Sidebar" button; it snaps to the nearest corner on release.
    // Click still opens the sidebar unless the button was dragged.
    const startDragSidebarBtn = useCallback((e) => {
        e.preventDefault();
        // Button is position:fixed, so drag/snap math is in viewport coords (navbar = 60px tall).
        const NAV = 60;
        const vh = window.innerHeight, vw = window.innerWidth;
        const startX = e.clientX, startY = e.clientY;
        dragState.current.moved = false;

        const onMove = (ev) => {
            const left = ev.clientX - 16;
            const top = ev.clientY - 16;
            if (Math.abs(ev.clientX - startX) > 3 || Math.abs(ev.clientY - startY) > 3) dragState.current.moved = true;
            setDragPos({
                top: Math.max(NAV + 16, Math.min(vh - 48, top)),
                left: Math.max(16, Math.min(vw / 2 - 32, left)), // left side only
            });
        };
        const onUp = (ev) => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            if (dragState.current.moved) {
                // Left side only: snap to top-left or bottom-left by vertical midpoint of viewport.
                const corner = ev.clientY < vh / 2 ? 'top-left' : 'bottom-left';
                setSidebarBtnCorner(corner);
                localStorage.setItem('sidebarBtnCorner', corner);
            }
            setDragPos(null);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    }, []);

    useEffect(() => {
        fetchRequests();
        fetchHistory();
    }, []);

    const fetchRequests = async () => {
        setIsLoadingRequests(true);
        try {
            const res = await fetch('/api/requests', { credentials: 'include' });
            const data = await res.json();
            setRequests(data);
        } catch (err) {
            console.error('Error fetching requests:', err);
        } finally {
            setIsLoadingRequests(false);
        }
    };

    const fetchHistory = async () => {
        setIsLoadingHistory(true);
        try {
            const res = await fetch('/api/history', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setHistory(data);
            }
        } catch (err) {
            console.error('Error fetching history:', err);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const handleRequestSend = async (request) => {
        try {
            const res = await fetch(`/api/requests/${request._id}/send`, {
                method: 'POST',
            });
            const data = await res.json();
            setResponse(data);
            // Removed navigation to stay on the same page
        } catch (err) {
            console.error('Error sending request:', err);
        }
    };

    const handleRequestCreate = async (newRequestData) => {
        try {
            const res = await fetch('/api/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newRequestData),
            });
            if (res.ok) {
                const savedRequest = await res.json();
                setRequests([...requests, savedRequest]);
                toast.success('Request saved successfully');
                navigate(`requests/${savedRequest._id}`);
            } else {
                const errorData = await res.json();
                toast.error('Failed to save request');
                console.error('Failed to create', errorData);
            }
        } catch (err) {
            console.error('Error creating request:', err);
        }
    };

    const handleRequestUpdate = async (updatedRequestData) => {
        try {
            const res = await fetch(`/api/requests/${updatedRequestData._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedRequestData),
            });
            if (res.ok) {
                const updatedRequest = await res.json();
                const updatedRequests = requests.map(req =>
                    req._id === updatedRequest._id ? updatedRequest : req
                );
                setRequests(updatedRequests);
                toast.success('Changes saved');
                navigate(`requests/${updatedRequest._id}`);
            } else {
                const errorData = await res.json();
                toast.error('Failed to update request');
                console.error("Failed to update", errorData);
            }
        } catch (err) {
            console.error('Error updating request:', err);
        }
    };

    const handleRequestDelete = async (requestId) => {
        try {
            const res = await fetch(`/api/requests/${requestId}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                setRequests(requests.filter((req) => req._id !== requestId));
                toast.success('Request deleted');
                navigate('explore');
            } else {
                const errorData = await res.json();
                toast.error('Failed to delete request');
                console.error("Failed to delete", errorData);
            }
        } catch (err) {
            console.error('Error deleting request:', err);
        }
    };

    // Direct request send handler for the unified workspace
    const handleDirectRequest = async (requestData) => {
        setResponse(null); // Clear previous response

        try {
            // Construct headers object
            const headers = {};
            requestData.headers.forEach(h => {
                if (h.enabled && h.key) {
                    headers[h.key] = h.value;
                }
            });

            // Prepare request body
            let requestBody = null;
            if (requestData.method !== 'GET' && requestData.method !== 'HEAD') {
                if (requestData.bodyType === 'raw' && requestData.body) {
                    requestBody = requestData.body;
                }
            }

            console.log(`Sending proxy request to ${requestData.url}`);

            // Use proxy endpoint instead of direct request
            const response = await fetch('/api/proxy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    url: requestData.url,
                    method: requestData.method,
                    headers,
                    body: requestBody,
                    timeout: 30000
                }),
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Server responded with status ${response.status}`);
            }

            const responseData = await response.json();

            setResponse(responseData);
            // Refresh history after a successful request
            fetchHistory();
        } catch (err) {
            console.error('Error making direct request:', err);
            setResponse({
                status: 0,
                statusText: 'Error',
                headers: {},
                body: err.message,
                error: true
            });
        }
    };

    return (
        <div className="api-network-section">
            <aside className={`api-network-sidebar ${!isSidebarOpen ? 'collapsed' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-title">
                        <FiGrid className="title-icon" />
                        <span>Workspaces</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            className="sidebar-add-btn"
                            onClick={() => navigate('requests/new')}
                            title="New Request"
                        >
                            <FiPlus />
                        </button>
                        <button
                            className="sidebar-toggle-btn"
                            onClick={() => setIsSidebarOpen(false)}
                            title="Hide Sidebar"
                        >
                            <FiChevronsLeft />
                        </button>
                    </div>
                </div>

                <div className="sidebar-search">
                    <FiSearch className="search-icon" />
                    <input type="text" placeholder="Filter requests..." className="sidebar-filter-input" />
                </div>

                <div className="sidebar-nav">
                    <div className="nav-header">Personal Workspace</div>
                    <div className="nav-items">
                        <div
                            className={`nav-item ${window.location.pathname.includes('/explore') ? 'active' : ''}`}
                            onClick={() => {
                                navigate('explore');
                                fetchRequests();
                            }}
                        >
                            <FiSearch className="nav-icon" />
                            <span>Explore Marketplace</span>
                        </div>

                        <div
                            className={`nav-item ${window.location.pathname.includes('/history') ? 'active' : ''}`}
                            onClick={() => {
                                navigate('/workspace/history');
                                fetchHistory();
                            }}
                        >
                            <FiClock className="nav-icon" />
                            <span>Request History</span>
                        </div>
                        <div className="nav-group-title">My Saved Requests</div>
                        {isLoadingRequests ? (
                            <div className="sidebar-loading">
                                <div className="spinner-small"></div>
                                <span>Syncing...</span>
                            </div>
                        ) : requests.length === 0 ? (
                            <div className="sidebar-empty">
                                <p>No saved requests</p>
                            </div>
                        ) : (
                            requests.map(req => {
                                const isActive = window.location.pathname.includes(`/requests/${req._id}`);
                                return (
                                    <div
                                        key={req._id}
                                        className={`nav-item request-item ${isActive ? 'active' : ''}`}
                                        onClick={() => navigate(`requests/${req._id}`)}
                                    >
                                        <div className="method-indicator" data-method={req.method}>{req.method}</div>
                                        <span className="request-name">{req.name || 'Untitled'}</span>
                                        <FiChevronRight className="item-arrow" />
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </aside >

            <div className="api-network-main-content">
                {!isSidebarOpen && (
                    <button
                        className={`sidebar-open-btn corner-${sidebarBtnCorner}`}
                        style={dragPos ? { top: dragPos.top, left: dragPos.left, right: 'auto', bottom: 'auto' } : undefined}
                        onPointerDown={startDragSidebarBtn}
                        onClick={() => { if (!dragState.current.moved) setIsSidebarOpen(true); }}
                        title="Show Sidebar (drag to a corner)"
                    >
                        <FiSidebar size={32} />
                    </button>
                )}
                <Routes>
                    <Route index element={<Navigate to="explore" />} />
                    <Route path="explore" element={
                        <MainShell>
                            <ExplorePage />
                        </MainShell>
                    } />
                    <Route path="explore/moderate" element={
                        <MainShell>
                            <MarketplaceModerationQueue />
                        </MainShell>
                    } />
                    <Route path="history" element={<Navigate to="/workspace/history" replace />} />
<Route path="spotlight" element={<SpotlightSection />} />
                    <Route path="ai-agent-tools" element={<AIAgentToolsSection />} />
                    <Route
                        path="requests/new"
                        element={<RequestWorkspaceNew onSave={handleRequestCreate} onSend={fetchHistory} />}
                    />
                    <Route
                        path="requests/edit/:id"
                        element={<EditRequestWorkspace requests={requests} onSave={handleRequestUpdate} isLoadingRequests={isLoadingRequests} />}
                    />
                    <Route
                        path="requests/:id"
                        element={<RequestDetails requests={requests} onSave={handleRequestUpdate} isLoadingRequests={isLoadingRequests} fetchHistory={fetchHistory} />}
                    />
                </Routes>
                <Footer />
            </div>
        </div >
    );
};

// New component that integrates request form and response display on the same page
const UnifiedRequestWorkspace = ({ onSendRequest, response, onCreateRequest }) => {
    // ... existing implementation ...
    // Default request with GET method
    const defaultRequest = {
        name: 'New Request',
        method: 'GET',
        url: '',
        params: [{ enabled: true, key: '', value: '', description: '' }],
        headers: [],
        bodyType: 'none',
        body: '',
        preRequestScript: '',
        tests: '',
        isNew: true
    };

    const containerRef = useRef(null);
    const [splitRatio, setSplitRatio] = useState(0.5);
    const draggingRef = useRef(false);

    const onDragMove = useCallback((e) => {
        if (!draggingRef.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const ratio = (e.clientY - rect.top) / rect.height;
        setSplitRatio(Math.min(0.85, Math.max(0.15, ratio)));
    }, []);

    const onDragEnd = useCallback(() => {
        if (!draggingRef.current) return;
        draggingRef.current = false;
        document.body.classList.remove('workspace-resizing');
        window.removeEventListener('mousemove', onDragMove);
        window.removeEventListener('mouseup', onDragEnd);
    }, [onDragMove]);

    const startDrag = useCallback((e) => {
        e.preventDefault();
        draggingRef.current = true;
        document.body.classList.add('workspace-resizing');
        window.addEventListener('mousemove', onDragMove);
        window.addEventListener('mouseup', onDragEnd);
    }, [onDragMove, onDragEnd]);

    const topPct = `${(splitRatio * 100).toFixed(2)}%`;

    return (
        <div className="unified-request-workspace">
            <div className="workspace-header-placeholder"></div>
            <div className="request-response-container" ref={containerRef}>
                <div className="request-form-section" style={{ flex: `0 0 ${topPct}` }}>
                    <RequestForm
                        request={defaultRequest}
                        onSendRequest={onSendRequest}
                        onSave={onCreateRequest}
                    />
                </div>

                <div className="split-pane-divider" onMouseDown={startDrag} role="separator" aria-orientation="horizontal" aria-label="Resize request and response" tabIndex={0} />

                <div className="response-section" style={{ flex: '1 1 0%' }}>
                    <h3>Response</h3>
                    {response ? (
                        <ResponseDisplay responseData={response} />
                    ) : (
                        <div className="empty-response-message">
                            <p>Send a request to see the response</p>
                        </div>
                    )}
                </div>


            </div>
        </div>
    );
}

const RequestDetails = ({ requests, onSave, isLoadingRequests, fetchHistory }) => {
    const { id } = useParams();
    const [localRequest, setLocalRequest] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [response, setResponse] = useState(null);
    const [responseLoading, setResponseLoading] = useState(false);
    const [responseError, setResponseError] = useState(null);
    const [splitRatio, setSplitRatio] = useState(0.5);
    const containerRef = useRef(null);
    const draggingRef = useRef(false);

    useEffect(() => {
        const foundRequest = requests.find((r) => r._id === id);
        if (foundRequest) {
            setLocalRequest(foundRequest);
            setIsLoading(false);
        } else if (!isLoadingRequests) {
            // Not found in list and list is not loading, try fetching specifically
            fetchRequestDetails();
        }
    }, [id, requests, isLoadingRequests]);

    const fetchRequestDetails = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/requests/${id}`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setLocalRequest(data);
            } else {
                console.error('Request not found even on direct fetch');
            }
        } catch (err) {
            console.error('Error fetching direct request details:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const onDragMove = useCallback((e) => {
        if (!draggingRef.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const ratio = (e.clientY - rect.top) / rect.height;
        setSplitRatio(Math.min(0.85, Math.max(0.15, ratio)));
    }, []);

    const onDragEnd = useCallback(() => {
        if (!draggingRef.current) return;
        draggingRef.current = false;
        document.body.classList.remove('workspace-resizing');
        window.removeEventListener('mousemove', onDragMove);
        window.removeEventListener('mouseup', onDragEnd);
    }, [onDragMove]);

    const startDrag = useCallback((e) => {
        e.preventDefault();
        draggingRef.current = true;
        document.body.classList.add('workspace-resizing');
        window.addEventListener('mousemove', onDragMove);
        window.addEventListener('mouseup', onDragEnd);
    }, [onDragMove, onDragEnd]);

    const handleResponse = useCallback((data, loading, error) => {
        setResponse(data);
        setResponseLoading(loading);
        setResponseError(error);
    }, []);

    if (isLoading || (isLoadingRequests && !localRequest)) {
        return (
            <div className="empty-state h-full" style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500 mb-4"></div>
                <span>Loading request details...</span>
            </div>
        );
    }

    if (!localRequest) {
        return (
            <div className="empty-state h-full" style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                <div className="text-4xl mb-2">🔍</div>
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-color)' }}>Request Not Found</h3>
                <p className="text-sm mt-1">We couldn't find the request you're looking for.</p>
                <button
                    onClick={() => window.location.href = '/workspace/api-network/explore'}
                    className="mt-6 px-4 py-2 rounded-md text-sm transition-colors"
                    style={{ background: 'var(--primary-color)', color: '#fff' }}
                >
                    Back to Explore
                </button>
            </div>
        );
    }

    const topPct = `${(splitRatio * 100).toFixed(2)}%`;

    return (
        <div className="unified-request-workspace">
            <div className="workspace-header-placeholder"></div>
            <div className="request-response-container" ref={containerRef}>
                <div className="request-form-section" style={{ flex: `0 0 ${topPct}` }}>
                    <RequestWorkspaceNew
                        initialRequest={localRequest}
                        onSave={(updatedRequest) => onSave(updatedRequest)}
                        onSend={fetchHistory}
                        onResponse={handleResponse}
                        hideResponse
                        title={localRequest.name || 'Request'}
                    />
                </div>

                <div
                    className="split-pane-divider"
                    onMouseDown={startDrag}
                    role="separator"
                    aria-orientation="horizontal"
                    aria-label="Resize request and response"
                    tabIndex={0}
                />

                <div className="response-section" style={{ flex: '1 1 0%' }}>
                    <h3>Response</h3>
                    {responseLoading ? (
                        <div className="empty-response-message"><p>Sending request…</p></div>
                    ) : responseError ? (
                        <div className="empty-response-message"><p>{responseError}</p></div>
                    ) : response ? (
                        <ResponseDisplay responseData={response} />
                    ) : (
                        <div className="empty-response-message">
                            <p>Send a request to see the response</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const EditRequestWorkspace = ({ requests, onSave, isLoadingRequests }) => {
    const { id } = useParams();
    const request = requests.find((r) => r._id === id);
    const navigate = useNavigate();
    const [response, setResponse] = useState(null);
    const [responseLoading, setResponseLoading] = useState(false);
    const [responseError, setResponseError] = useState(null);
    const [splitRatio, setSplitRatio] = useState(0.5);
    const containerRef = useRef(null);
    const draggingRef = useRef(false);

    const onDragMove = useCallback((e) => {
        if (!draggingRef.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const ratio = (e.clientY - rect.top) / rect.height;
        setSplitRatio(Math.min(0.85, Math.max(0.15, ratio)));
    }, []);

    const onDragEnd = useCallback(() => {
        if (!draggingRef.current) return;
        draggingRef.current = false;
        document.body.classList.remove('workspace-resizing');
        window.removeEventListener('mousemove', onDragMove);
        window.removeEventListener('mouseup', onDragEnd);
    }, [onDragMove]);

    const startDrag = useCallback((e) => {
        e.preventDefault();
        draggingRef.current = true;
        document.body.classList.add('workspace-resizing');
        window.addEventListener('mousemove', onDragMove);
        window.addEventListener('mouseup', onDragEnd);
    }, [onDragMove, onDragEnd]);

    const handleResponse = useCallback((data, loading, error) => {
        setResponse(data);
        setResponseLoading(loading);
        setResponseError(error);
    }, []);

    if (isLoadingRequests && !request) {
        return (
            <div className="empty-state h-full" style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500 mb-4"></div>
                <span>Loading request details...</span>
            </div>
        );
    }

    if (!request) {
        return (
            <div className="empty-state h-full" style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                <div className="text-4xl mb-2">🔍</div>
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-color)' }}>Request Not Found</h3>
                <p className="text-sm mt-1">We couldn't find the request you're looking for.</p>
                <button
                    onClick={() => window.location.href = '/workspace/api-network/explore'}
                    className="mt-6 px-4 py-2 rounded-md text-sm transition-colors"
                    style={{ background: 'var(--primary-color)', color: '#fff' }}
                >
                    Back to Explore
                </button>
            </div>
        );
    }

    const handleSave = (savedRequest) => {
        onSave(savedRequest);
        navigate(`../requests/${id}`);
    };

    const topPct = `${(splitRatio * 100).toFixed(2)}%`;

    return (
        <div className="unified-request-workspace">
            <div className="workspace-header-placeholder"></div>
            <div className="request-response-container" ref={containerRef}>
                <div className="request-form-section" style={{ flex: `0 0 ${topPct}` }}>
                    <RequestWorkspaceNew
                        initialRequest={request}
                        onSave={handleSave}
                        onResponse={handleResponse}
                        hideResponse
                        title={request.name || 'Edit Request'}
                    />
                </div>

                <div
                    className="split-pane-divider"
                    onMouseDown={startDrag}
                    role="separator"
                    aria-orientation="horizontal"
                    aria-label="Resize request and response"
                    tabIndex={0}
                />

                <div className="response-section" style={{ flex: '1 1 0%' }}>
                    <h3>Response</h3>
                    {responseLoading ? (
                        <div className="empty-response-message"><p>Sending request…</p></div>
                    ) : responseError ? (
                        <div className="empty-response-message"><p>{responseError}</p></div>
                    ) : response ? (
                        <ResponseDisplay responseData={response} />
                    ) : (
                        <div className="empty-response-message">
                            <p>Send a request to see the response</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default APINetworkSection;