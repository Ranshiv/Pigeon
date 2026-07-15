// client/src/components/MockServerWorkspace.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    FiServer, FiPlay, FiSquare, FiSettings, FiGitBranch, FiDatabase,
    FiActivity, FiBarChart2, FiPlus, FiRefreshCw, FiCopy, FiTrash2, FiX,
    FiAlertCircle, FiCheck, FiZap
} from 'react-icons/fi';
import MockScenarioBuilder from './MockScenarioBuilder';
import MockStateManager from './MockStateManager';
import MockTrafficRecorder from './MockTrafficRecorder';
import MockAnalyticsDashboard from './MockAnalyticsDashboard';
import MockEndpointEditor from './MockEndpointEditor';
import './MockServerWorkspace.css';

const SIDEBAR_SIZES = {
    MIN: 200,
    MAX: 420,
    DEFAULT: 240
};

const MockServerWorkspace = ({ collectionId, versionId, onClose }) => {
    const [activeTab, setActiveTab] = useState('endpoints');
    const [mockServers, setMockServers] = useState([]);
    const [selectedServer, setSelectedServer] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showScenarioBuilder, setShowScenarioBuilder] = useState(false);
    const [editingScenario, setEditingScenario] = useState(null);
    const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_SIZES.DEFAULT);
    const [isResizingSidebar, setIsResizingSidebar] = useState(false);
    const workspaceContentRef = useRef(null);

    const [createForm, setCreateForm] = useState({
        name: '',
        description: '',
        baseUrl: ''
    });

    const tabs = [
        { id: 'endpoints', label: 'Endpoints', icon: FiServer },
        { id: 'scenarios', label: 'Scenarios', icon: FiGitBranch },
        { id: 'state', label: 'State', icon: FiDatabase },
        { id: 'recording', label: 'Recording', icon: FiActivity },
        { id: 'analytics', label: 'Analytics', icon: FiBarChart2 }
    ];

    useEffect(() => {
        if (!isResizingSidebar) return;

        const handlePointerMove = (event) => {
            if (!workspaceContentRef.current) return;

            const clientX = event.touches?.[0]?.clientX ?? event.clientX;
            const { left } = workspaceContentRef.current.getBoundingClientRect();
            const proposedWidth = clientX - left;
            const safeWidth = Math.min(
                Math.max(proposedWidth, SIDEBAR_SIZES.MIN),
                SIDEBAR_SIZES.MAX
            );
            setSidebarWidth((prev) => (Math.abs(prev - safeWidth) < 0.5 ? prev : safeWidth));
        };

        const stopResizing = () => setIsResizingSidebar(false);

        window.addEventListener('mousemove', handlePointerMove);
        window.addEventListener('mouseup', stopResizing);
        window.addEventListener('touchmove', handlePointerMove);
        window.addEventListener('touchend', stopResizing);

        return () => {
            window.removeEventListener('mousemove', handlePointerMove);
            window.removeEventListener('mouseup', stopResizing);
            window.removeEventListener('touchmove', handlePointerMove);
            window.removeEventListener('touchend', stopResizing);
        };
    }, [isResizingSidebar]);

    const startSidebarResize = (event) => {
        event.preventDefault();
        setIsResizingSidebar(true);
    };

    const fetchMockServers = useCallback(async () => {
        if (!versionId) return;

        try {
            setIsLoading(true);
            const response = await fetch(
                `/api/mock-servers/collection/${collectionId}/version/${versionId}`,
                { credentials: 'include' }
            );

            if (!response.ok) throw new Error('Failed to fetch mock servers');

            const data = await response.json();
            const servers = data.mockServers || data || [];
            setMockServers(servers);

            if (servers.length > 0 && !selectedServer) {
                setSelectedServer(servers[0]);
            }
        } catch (err) {
            console.error('Error fetching mock servers:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [collectionId, versionId, selectedServer]);

    useEffect(() => {
        fetchMockServers();
    }, [fetchMockServers]);

    const createMockServer = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('/api/mock-servers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    ...createForm,
                    collectionId,
                    versionId,
                    baseUrl: createForm.baseUrl || `/mock/${versionId}`
                })
            });

            if (!response.ok) throw new Error('Failed to create mock server');

            const result = await response.json();
            setMockServers([result.mockServer, ...mockServers]);
            setSelectedServer(result.mockServer);
            setShowCreateModal(false);
            setCreateForm({ name: '', description: '', baseUrl: '' });
        } catch (err) {
            console.error('Error creating mock server:', err);
            setError(err.message);
        }
    };

    const deleteMockServer = async (serverId) => {
        if (!window.confirm('Delete this mock server and all its data?')) return;

        try {
            const response = await fetch(`/api/mock-servers/${serverId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Failed to delete mock server');

            setMockServers(mockServers.filter(s => s._id !== serverId));
            if (selectedServer?._id === serverId) {
                setSelectedServer(mockServers.find(s => s._id !== serverId) || null);
            }
        } catch (err) {
            console.error('Error deleting mock server:', err);
            setError(err.message);
        }
    };

    const toggleServerStatus = async () => {
        if (!selectedServer) return;

        try {
            const response = await fetch(`/api/mock-servers/${selectedServer._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ isActive: !selectedServer.isActive })
            });

            if (!response.ok) throw new Error('Failed to update server status');

            const result = await response.json();
            setSelectedServer(result.mockServer);
            setMockServers(mockServers.map(s =>
                s._id === result.mockServer._id ? result.mockServer : s
            ));
        } catch (err) {
            console.error('Error toggling server status:', err);
            setError(err.message);
        }
    };

    const copyServerUrl = () => {
        if (!selectedServer) return;
        // Use the backend URL directly (port 5001) instead of the React dev server port
        const backendUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';
        const url = `${backendUrl}/api/mock-servers/${selectedServer._id}/simulate`;
        navigator.clipboard.writeText(url);
    };

    const handleScenarioSave = async (scenarioData) => {
        if (!selectedServer) return;

        try {
            const url = editingScenario
                ? `/api/mock-servers/${selectedServer._id}/scenarios/${editingScenario._id}`
                : `/api/mock-servers/${selectedServer._id}/scenarios`;

            const response = await fetch(url, {
                method: editingScenario ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(scenarioData)
            });

            if (!response.ok) throw new Error('Failed to save scenario');

            await fetchMockServers();
            setShowScenarioBuilder(false);
            setEditingScenario(null);
        } catch (err) {
            console.error('Error saving scenario:', err);
            setError(err.message);
        }
    };

    const deleteScenario = async (scenarioId) => {
        if (!window.confirm('Delete this scenario?')) return;

        try {
            const response = await fetch(
                `/api/mock-servers/${selectedServer._id}/scenarios/${scenarioId}`,
                { method: 'DELETE', credentials: 'include' }
            );

            if (!response.ok) throw new Error('Failed to delete scenario');

            await fetchMockServers();
        } catch (err) {
            console.error('Error deleting scenario:', err);
            setError(err.message);
        }
    };

    const toggleScenario = async (scenarioId) => {
        try {
            const response = await fetch(
                `/api/mock-servers/${selectedServer._id}/scenarios/${scenarioId}/toggle`,
                { method: 'PATCH', credentials: 'include' }
            );

            if (!response.ok) throw new Error('Failed to toggle scenario');

            await fetchMockServers();
        } catch (err) {
            console.error('Error toggling scenario:', err);
            setError(err.message);
        }
    };

    const renderContent = () => {
        if (!selectedServer) {
            return (
                <div className="empty-content">
                    <FiServer size={48} />
                    <h3>No Mock Server Selected</h3>
                    <p>Select a mock server from the sidebar or create a new one</p>
                    <button
                        className="btn-primary"
                        onClick={() => setShowCreateModal(true)}
                    >
                        <FiPlus size={14} />
                        Create Mock Server
                    </button>
                </div>
            );
        }

        switch (activeTab) {
            case 'endpoints':
                return (
                    <MockEndpointEditor
                        mockServer={selectedServer}
                        onUpdate={(updatedServer) => {
                            setSelectedServer(updatedServer);
                            setMockServers(mockServers.map(s =>
                                s._id === updatedServer._id ? updatedServer : s
                            ));
                        }}
                    />
                );

            case 'scenarios':
                return (
                    <div className="scenarios-panel">
                        <div className="panel-header">
                            <h3>Scenarios</h3>
                            <button
                                className="btn-add"
                                onClick={() => {
                                    setEditingScenario(null);
                                    setShowScenarioBuilder(true);
                                }}
                            >
                                <FiPlus size={14} />
                                Add Scenario
                            </button>
                        </div>

                        {selectedServer.scenarios?.length > 0 ? (
                            <div className="scenarios-list">
                                {selectedServer.scenarios.map((scenario) => (
                                    <div
                                        key={scenario._id}
                                        className={`scenario-card ${scenario.isActive ? 'active' : 'inactive'}`}
                                    >
                                        <div className="scenario-header">
                                            <div className="scenario-info">
                                                <span className="scenario-name">{scenario.name}</span>
                                                <div className="scenario-meta">
                                                    <span className={`method ${scenario.endpointMethod?.toLowerCase()}`}>
                                                        {scenario.endpointMethod || '*'}
                                                    </span>
                                                    <span className="path">{scenario.endpointPath || '*'}</span>
                                                    <span className="priority">Priority: {scenario.priority || 0}</span>
                                                </div>
                                            </div>
                                            <div className="scenario-actions">
                                                <button
                                                    className={`btn-toggle ${scenario.isActive ? 'active' : ''}`}
                                                    onClick={() => toggleScenario(scenario._id)}
                                                    title={scenario.isActive ? 'Disable' : 'Enable'}
                                                >
                                                    {scenario.isActive ? <FiCheck size={14} /> : <FiX size={14} />}
                                                </button>
                                                <button
                                                    className="btn-icon"
                                                    onClick={() => {
                                                        setEditingScenario(scenario);
                                                        setShowScenarioBuilder(true);
                                                    }}
                                                    title="Edit"
                                                >
                                                    <FiSettings size={14} />
                                                </button>
                                                <button
                                                    className="btn-icon danger"
                                                    onClick={() => deleteScenario(scenario._id)}
                                                    title="Delete"
                                                >
                                                    <FiTrash2 size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        {scenario.description && (
                                            <p className="scenario-description">{scenario.description}</p>
                                        )}

                                        <div className="scenario-details">
                                            <div className="detail-item">
                                                <FiZap size={12} />
                                                <span>
                                                    {scenario.triggerConditions?.length || 0} conditions
                                                </span>
                                            </div>
                                            <div className="detail-item">
                                                <FiGitBranch size={12} />
                                                <span>
                                                    {scenario.responses?.length || 0} responses
                                                </span>
                                            </div>
                                            {scenario.useWeightedResponses && (
                                                <span className="badge">Weighted</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="empty-scenarios">
                                <FiGitBranch size={32} />
                                <p>No scenarios configured</p>
                                <span>Create scenarios to define conditional responses</span>
                            </div>
                        )}
                    </div>
                );

            case 'state':
                return (
                    <MockStateManager
                        mockServerId={selectedServer._id}
                        serverName={selectedServer.name}
                    />
                );

            case 'recording':
                return (
                    <MockTrafficRecorder
                        mockServerId={selectedServer._id}
                        serverName={selectedServer.name}
                    />
                );

            case 'analytics':
                return (
                    <MockAnalyticsDashboard
                        mockServerId={selectedServer._id}
                        serverName={selectedServer.name}
                    />
                );

            default:
                return null;
        }
    };

    if (isLoading && !mockServers.length) {
        return (
            <div className="mock-workspace loading">
                <div className="spinner"></div>
                <p>Loading mock servers...</p>
            </div>
        );
    }

    return (
        <div className="mock-workspace">
            {/* Header */}
            <div className="workspace-header">
                <div className="header-left">
                    <FiServer className="header-icon" />
                    <div className="header-info">
                        <h2>API Virtualization</h2>
                        <span className="server-count">{mockServers.length} mock servers</span>
                    </div>
                </div>
                <div className="header-right">
                    <button
                        className="btn-icon-text"
                        onClick={fetchMockServers}
                        disabled={isLoading}
                    >
                        <FiRefreshCw size={14} className={isLoading ? 'spinning' : ''} />
                        Refresh
                    </button>
                    <button
                        className="btn-primary"
                        onClick={() => setShowCreateModal(true)}
                    >
                        <FiPlus size={14} />
                        New Mock Server
                    </button>
                    {onClose && (
                        <button className="btn-close" onClick={onClose}>
                            <FiX size={18} />
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div className="error-banner">
                    <FiAlertCircle size={16} />
                    <span>{error}</span>
                    <button onClick={() => setError(null)}>Dismiss</button>
                </div>
            )}

            <div
                className={`workspace-content${isResizingSidebar ? ' resizing' : ''}`}
                ref={workspaceContentRef}
            >
                {/* Sidebar */}
                <div
                    className={`workspace-sidebar${isResizingSidebar ? ' dragging' : ''}`}
                    style={{ width: `${sidebarWidth}px` }}
                >
                    <div className="servers-list">
                        {mockServers.map((server) => (
                            <div
                                key={server._id}
                                className={`server-item ${selectedServer?._id === server._id ? 'selected' : ''}`}
                                onClick={() => setSelectedServer(server)}
                            >
                                <div className="server-icon">
                                    <FiServer size={16} />
                                </div>
                                <div className="server-info">
                                    <span className="server-name">{server.name}</span>
                                    <span className={`server-status ${server.isActive ? 'active' : 'inactive'}`}>
                                        {server.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                <button
                                    className="btn-icon small danger"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        deleteMockServer(server._id);
                                    }}
                                >
                                    <FiTrash2 size={12} />
                                </button>
                            </div>
                        ))}

                        {mockServers.length === 0 && (
                            <div className="empty-servers">
                                <p>No mock servers</p>
                            </div>
                        )}
                    </div>
                </div>

                <div
                    className="sidebar-resizer"
                    onMouseDown={startSidebarResize}
                    onTouchStart={startSidebarResize}
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize mock server sidebar"
                    aria-valuemin={SIDEBAR_SIZES.MIN}
                    aria-valuemax={SIDEBAR_SIZES.MAX}
                    aria-valuenow={Math.round(sidebarWidth)}
                ></div>

                {/* Main Content */}
                <div className="workspace-main">
                    {selectedServer && (
                        <>
                            {/* Server Info Bar */}
                            <div className="server-info-bar">
                                <div className="info-left">
                                    <h3>{selectedServer.name}</h3>
                                    <button
                                        className="btn-copy"
                                        onClick={copyServerUrl}
                                        title="Copy mock server URL"
                                    >
                                        <FiCopy size={12} />
                                        Copy URL
                                    </button>
                                </div>
                                <div className="info-right">
                                    <div className="stat-item">
                                        <span className="stat-value">
                                            {selectedServer.mockEndpoints?.length || 0}
                                        </span>
                                        <span className="stat-label">Endpoints</span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-value">
                                            {selectedServer.scenarios?.length || 0}
                                        </span>
                                        <span className="stat-label">Scenarios</span>
                                    </div>
                                    <button
                                        className={`btn-status ${selectedServer.isActive ? 'active' : 'inactive'}`}
                                        onClick={toggleServerStatus}
                                    >
                                        {selectedServer.isActive ? (
                                            <>
                                                <FiSquare size={12} />
                                                Stop Server
                                            </>
                                        ) : (
                                            <>
                                                <FiPlay size={12} />
                                                Start Server
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Tabs */}
                            <div className="tabs-container">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                                        onClick={() => setActiveTab(tab.id)}
                                    >
                                        <tab.icon size={14} />
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    {/* Tab Content */}
                    <div className="tab-content">
                        {renderContent()}
                    </div>
                </div>
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="create-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Create Mock Server</h3>
                            <button
                                className="btn-close"
                                onClick={() => setShowCreateModal(false)}
                            >
                                <FiX size={18} />
                            </button>
                        </div>
                        <form onSubmit={createMockServer}>
                            <div className="form-group">
                                <label>Name</label>
                                <input
                                    type="text"
                                    placeholder="My Mock Server"
                                    value={createForm.name}
                                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Description</label>
                                <textarea
                                    placeholder="What does this mock server simulate?"
                                    value={createForm.description}
                                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                                    rows={3}
                                />
                            </div>
                            <div className="form-group">
                                <label>Base URL (optional)</label>
                                <input
                                    type="text"
                                    placeholder={`/mock/${versionId}`}
                                    value={createForm.baseUrl}
                                    onChange={(e) => setCreateForm({ ...createForm, baseUrl: e.target.value })}
                                />
                            </div>
                            <div className="form-actions">
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => setShowCreateModal(false)}
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary">
                                    Create Server
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Scenario Builder Modal */}
            {showScenarioBuilder && (
                <MockScenarioBuilder
                    mockServer={selectedServer}
                    scenario={editingScenario}
                    onSave={handleScenarioSave}
                    onClose={() => {
                        setShowScenarioBuilder(false);
                        setEditingScenario(null);
                    }}
                />
            )}
        </div>
    );
};

export default MockServerWorkspace;
