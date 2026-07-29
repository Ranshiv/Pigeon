// client/src/components/Home.js
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import './Home.css';
import PageLoader from './common/PageLoader/PageLoader';
import {
    FiSend, FiSearch, FiGrid, FiPackage, FiActivity,
    FiUsers, FiGitPullRequest, FiStar, FiClock,
    FiPlus, FiArrowRight, FiCode, FiBookOpen, FiTrendingUp, FiLink, FiBarChart2,
    FiCheckCircle, FiAlertTriangle, FiAlertCircle, FiChevronRight
} from 'react-icons/fi';

const Home = () => {
    const navigate = useNavigate();
    const [recentWorkspaces, setRecentWorkspaces] = useState([]);
    const [recentCollections, setRecentCollections] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);
    const [stats, setStats] = useState({
        collections: 0,
        workspaces: 0,
        requests: 0,
        pendingMergeRequests: 0
    });
    const [loading, setLoading] = useState(true);
    const [userData, setUserData] = useState(null);
    const [health, setHealth] = useState({ monitors: [], alerts: [], incidents: [], loading: true });
    const [recentPerformance, setRecentPerformance] = useState({ items: [], loading: true });
    const primaryWorkspaceId = recentWorkspaces[0]?._id;
    const primaryWorkspaceCollectionsPath = primaryWorkspaceId
        ? `/workspace/workspaces/${primaryWorkspaceId}?tab=collections`
        : '/workspace/workspaces';

    const openRecentCollection = (collection) => {
        const workspaceId = collection.workspaceId || primaryWorkspaceId;
        const returnTo = workspaceId
            ? `/workspace/workspaces/${workspaceId}?tab=collections`
            : '/workspace/workspaces';

        navigate(`/workspace/collections/${collection._id}`, {
            state: workspaceId ? { workspaceId, returnTo } : undefined
        });
    };

    // Draggable dashboard cards. Flat order maps row-major into the 2-col grid:
    // [0]=top-left, [1]=top-right, [2]=bottom-left, [3]=bottom-right.
    const DEFAULT_CARDS = ['health', 'performance', 'stats', 'workspaces', 'activity', 'collections'];
    const [cardOrder, setCardOrder] = useState(() => {
        try {
            const s = JSON.parse(localStorage.getItem('pghCardOrder'));
            if (Array.isArray(s) && s.length === DEFAULT_CARDS.length && DEFAULT_CARDS.every(c => s.includes(c))) return s;
        } catch { /* fall through */ }
        return DEFAULT_CARDS;
    });
    const dragCard = React.useRef(null);

    const handleCardDragOver = (index) => {
        const from = dragCard.current;
        if (from === null || from === index) return;
        setCardOrder(prev => {
            const next = [...prev];
            const [moved] = next.splice(from, 1);
            next.splice(index, 0, moved);
            return next;
        });
        dragCard.current = index;
    };
    const persistCardOrder = () => {
        dragCard.current = null;
        setCardOrder(prev => { localStorage.setItem('pghCardOrder', JSON.stringify(prev)); return prev; });
    };

    // Fetch dashboard data on component mount
    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                setLoading(true);

                // Get user data
                const userResponse = await fetch('/api/auth/check', {
                    credentials: 'include'
                });

                if (userResponse.ok) {
                    const userData = await userResponse.json();
                    if (userData.user) {
                        setUserData(userData.user);
                    }
                }

                // Fetch workspaces
                const wsResponse = await fetch('/api/workspaces', {
                    credentials: 'include'
                });

                if (wsResponse.ok) {
                    const data = await wsResponse.json();
                    // Process and combine workspace data
                    let allWorkspaces = [];
                    if (data.personal) allWorkspaces = [...allWorkspaces, ...data.personal];
                    if (data.team) allWorkspaces = [...allWorkspaces, ...data.team];

                    // Sort by last accessed/updated
                    allWorkspaces.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
                    setRecentWorkspaces(allWorkspaces.slice(0, 3));

                    // Update stats. Collections count sums per-workspace collectionsCount
                    // (same value shown on workspace cards/detail), so dashboard matches.
                    setStats(prev => ({
                        ...prev,
                        workspaces: allWorkspaces.length,
                        collections: allWorkspaces.reduce(
                            (sum, ws) => sum + (ws.collectionsCount || 0), 0
                        )
                    }));

                    // If we have workspaces, fetch workspace-specific data for recent cards and activity
                    if (allWorkspaces.length > 0) {
                        const workspaceCollections = await Promise.all(allWorkspaces.map(async (workspace) => {
                            const response = await fetch(
                                `/api/workspaces/${workspace._id}/collections`,
                                { credentials: 'include' }
                            );
                            return response.ok ? response.json() : [];
                        }));
                        const primaryCollections = Array.isArray(workspaceCollections[0]) ? workspaceCollections[0] : [];

                        // Recent collections come from the primary workspace, while
                        // the request total reflects every workspace the user can access.
                        setRecentCollections(primaryCollections.slice(0, 4));
                        const requestCount = workspaceCollections.flat().reduce(
                            (sum, collection) => sum + getCollectionRequestCount(collection), 0
                        );
                        setStats(prev => ({ ...prev, requests: requestCount }));

                        // Fetch activity for the first workspace
                        const activityResponse = await fetch(
                            `/api/workspaces/${allWorkspaces[0]._id}/activity`,
                            { credentials: 'include' }
                        );

                        if (activityResponse.ok) {
                            const activityData = await activityResponse.json();
                            setRecentActivity(activityData.slice(0, 5));
                        }

                        // Pending merges belong to a workspace, so aggregate them
                        // across all accessible workspaces instead of only the first.
                        const mergeRequests = await Promise.all(allWorkspaces.map(async (workspace) => {
                            const response = await fetch(
                                `/api/workspaces/${workspace._id}/merge-requests?status=pending`,
                                { credentials: 'include' }
                            );
                            return response.ok ? response.json() : [];
                        }));
                        const pendingMergeRequests = mergeRequests.reduce(
                            (total, requests) => total + (Array.isArray(requests) ? requests.length : 0), 0
                        );
                        setStats(prev => ({ ...prev, pendingMergeRequests }));
                    }
                }
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    // Keep a lightweight operational snapshot on the dashboard. These endpoints
    // already power the monitoring workspace, so the dashboard stays consistent
    // with the detailed alert and incident views.
    useEffect(() => {
        const fetchWorkspaceHealth = async () => {
            try {
                const [monitorsResponse, alertsResponse, incidentsResponse] = await Promise.all([
                    fetch('/api/monitoring/monitors', { credentials: 'include' }),
                    fetch('/api/alerts?limit=20', { credentials: 'include' }),
                    fetch('/api/incidents?limit=20', { credentials: 'include' })
                ]);

                const monitors = monitorsResponse.ok ? await monitorsResponse.json() : [];
                const alerts = alertsResponse.ok ? await alertsResponse.json() : [];
                const incidentsPayload = incidentsResponse.ok ? await incidentsResponse.json() : { incidents: [] };
                const incidents = Array.isArray(incidentsPayload) ? incidentsPayload : incidentsPayload.incidents || [];

                setHealth({
                    monitors: Array.isArray(monitors) ? monitors : [],
                    alerts: Array.isArray(alerts) ? alerts : [],
                    incidents,
                    loading: false
                });
            } catch (error) {
                console.error('Error fetching workspace health:', error);
                setHealth(previous => ({ ...previous, loading: false }));
            }
        };

        fetchWorkspaceHealth();
    }, []);

    useEffect(() => {
        const fetchRecentPerformance = async () => {
            try {
                const response = await fetch('/api/history', { credentials: 'include' });
                const history = response.ok ? await response.json() : [];
                setRecentPerformance({ items: Array.isArray(history) ? history.slice(0, 5) : [], loading: false });
            } catch (error) {
                console.error('Error fetching recent request performance:', error);
                setRecentPerformance(previous => ({ ...previous, loading: false }));
            }
        };

        fetchRecentPerformance();
    }, []);

    // Helper function to format dates
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return 'Today';
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else {
            return date.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
            });
        }
    };

    // Function to get activity icon based on activity type
    const getActivityIcon = (activityType) => {
        switch (activityType) {
            case 'collection_created': return <FiPlus />;
            case 'request_added': return <FiSend />;
            case 'merge_requested': return <FiGitPullRequest />;
            case 'user_added': return <FiUsers />;
            default: return <FiActivity />;
        }
    };

    const activeAlerts = health.alerts.filter(alert => ['triggered', 'acknowledged', 'firing'].includes(String(alert.status).toLowerCase()));
    const activeIncidents = health.incidents.filter(incident => !['resolved', 'closed'].includes(String(incident.status).toLowerCase()));
    const downMonitors = health.monitors.filter(monitor => ['down', 'failed', 'critical', 'degraded'].includes(String(monitor.currentStatus || monitor.status).toLowerCase()));
    const healthyMonitors = health.monitors.length - downMonitors.length;
    const formatDuration = (duration) => {
        if (duration === undefined || duration === null || duration === '') return '—';
        const value = Number(duration);
        return Number.isFinite(value) ? `${Math.round(value)}ms` : '—';
    };
    const getCollectionRequestCount = (collection = {}) => {
        const storedCount = collection.stats?.requestCount ?? collection.requestCount ?? collection.requestsCount;
        const actualCount = Array.isArray(collection.requests) ? collection.requests.length : storedCount;
        return Number.isFinite(Number(actualCount)) ? Number(actualCount) : 0;
    };

    // Card content by id — rendered into draggable wrappers below.
    const cardContent = {
        health: (
            <section className="pgh-card pgh-health-card" aria-labelledby="workspace-health-heading">
                <div className="pgh-card-header">
                    <div>
                        <h2 className="pgh-card-title" id="workspace-health-heading"><FiActivity /> Workspace Health</h2>
                        <p className="pgh-health-subtitle">A quick view of monitors, alerts, and incidents across your account.</p>
                    </div>
                    <button className="pgh-link-btn" onClick={() => navigate('../monitoring')}>Open Monitoring <FiChevronRight aria-hidden="true" /></button>
                </div>
                {health.loading ? (
                    <PageLoader label="Loading workspace health..." />
                ) : (
                    <div className="pgh-health-grid">
                        <div className={`pgh-health-status ${downMonitors.length > 0 ? 'is-warning' : 'is-healthy'}`}>
                            {downMonitors.length > 0 ? <FiAlertTriangle aria-hidden="true" /> : <FiCheckCircle aria-hidden="true" />}
                            <div><strong>{health.monitors.length === 0 ? 'Monitoring not configured' : downMonitors.length > 0 ? 'Attention needed' : 'All monitors healthy'}</strong><span>{health.monitors.length === 0 ? 'Create a monitor to start tracking API health.' : `${healthyMonitors} of ${health.monitors.length} monitors operational`}</span></div>
                        </div>
                        <button className="pgh-health-metric" onClick={() => navigate('../monitoring/alerts')}>
                            <span className="pgh-health-metric-icon pgh-health-metric-icon--alerts"><FiAlertCircle aria-hidden="true" /></span>
                            <span><strong>{activeAlerts.length}</strong><small>Active alerts</small></span>
                            <FiChevronRight aria-hidden="true" />
                        </button>
                        <button className="pgh-health-metric" onClick={() => navigate('../monitoring/incidents')}>
                            <span className="pgh-health-metric-icon pgh-health-metric-icon--incidents"><FiAlertTriangle aria-hidden="true" /></span>
                            <span><strong>{activeIncidents.length}</strong><small>Open incidents</small></span>
                            <FiChevronRight aria-hidden="true" />
                        </button>
                    </div>
                )}
            </section>
        ),
        performance: (
            <section className="pgh-card pgh-performance-card" aria-labelledby="recent-performance-heading">
                <div className="pgh-card-header">
                    <div>
                        <h2 className="pgh-card-title" id="recent-performance-heading"><FiClock /> Recent Request Performance</h2>
                        <p className="pgh-health-subtitle">Response times and status codes from your latest requests.</p>
                    </div>
                    <button className="pgh-link-btn" onClick={() => navigate('../history')}>View History <FiChevronRight aria-hidden="true" /></button>
                </div>
                {recentPerformance.loading ? (
                    <PageLoader label="Loading request performance..." />
                ) : recentPerformance.items.length === 0 ? (
                    <div className="pgh-empty pgh-performance-empty">
                        <p>No request history yet. Send a request to start tracking performance.</p>
                        <button className="pgh-empty-btn" onClick={() => navigate('../api-network/requests/new')}><FiSend /> New Request</button>
                    </div>
                ) : (
                    <div className="pgh-performance-list">
                        {recentPerformance.items.map((item) => {
                            const status = Number(item.responseStatus);
                            const statusClass = status >= 200 && status < 400 ? 'is-success' : status >= 400 ? 'is-error' : 'is-neutral';
                            return (
                                <Link className="pgh-performance-row" to={`/workspace/history/${item._id}`} key={item._id}>
                                    <span className={`pgh-performance-method method-${String(item.method || 'GET').toLowerCase()}`}>{item.method || 'GET'}</span>
                                    <span className="pgh-performance-url" title={item.url}>{item.url || 'Unknown endpoint'}</span>
                                    <span className={`pgh-performance-status ${statusClass}`}>{item.responseStatus || '—'}</span>
                                    <span className="pgh-performance-duration">{formatDuration(item.duration)}</span>
                                    <FiChevronRight aria-hidden="true" />
                                </Link>
                            );
                        })}
                    </div>
                )}
            </section>
        ),
        stats: (
            <section className="pgh-card">
                <h2 className="pgh-card-title"><FiActivity /> Stats Overview</h2>
                <div className="pgh-stats">
                    <div className="pgh-stat">
                        <div className="pgh-stat-icon pgh-stat-icon--collections"><FiPackage /></div>
                        <div className="pgh-stat-info">
                            <span className="pgh-stat-value">{stats.collections}</span>
                            <span className="pgh-stat-label">Collections</span>
                        </div>
                    </div>
                    <div className="pgh-stat">
                        <div className="pgh-stat-icon pgh-stat-icon--workspaces"><FiGrid /></div>
                        <div className="pgh-stat-info">
                            <span className="pgh-stat-value">{stats.workspaces}</span>
                            <span className="pgh-stat-label">Workspaces</span>
                        </div>
                    </div>
                    <div className="pgh-stat">
                        <div className="pgh-stat-icon pgh-stat-icon--requests"><FiSend /></div>
                        <div className="pgh-stat-info">
                            <span className="pgh-stat-value">{stats.requests}</span>
                            <span className="pgh-stat-label">Requests</span>
                        </div>
                    </div>
                    <div className="pgh-stat">
                        <div className="pgh-stat-icon pgh-stat-icon--pending"><FiGitPullRequest /></div>
                        <div className="pgh-stat-info">
                            <span className="pgh-stat-value">{stats.pendingMergeRequests}</span>
                            <span className="pgh-stat-label">Pending Merges</span>
                        </div>
                    </div>
                </div>
            </section>
        ),
        activity: (
            <section className="pgh-card">
                <div className="pgh-card-header">
                    <h2 className="pgh-card-title"><FiClock /> Recent Activity</h2>
                    <button className="pgh-link-btn" onClick={() => navigate('../workspaces')}>View All</button>
                </div>
                <div className="pgh-list">
                    {loading ? (
                        <PageLoader label="Loading recent activity..." />
                    ) : recentActivity.length === 0 ? (
                        <div className="pgh-empty">
                            <p>No recent activity to display. Start by creating collections or sending requests.</p>
                        </div>
                    ) : (
                        recentActivity.map((activity) => (
                            <div key={activity._id} className="pgh-activity-row">
                                <div className="pgh-activity-icon">{getActivityIcon(activity.type)}</div>
                                <div className="pgh-activity-body">
                                    <div className="pgh-activity-top">
                                        <span className="pgh-activity-user">{activity.user?.displayName || 'A user'}</span>
                                        <span className="pgh-activity-time">{formatDate(activity.timestamp)}</span>
                                    </div>
                                    <p className="pgh-activity-message">{activity.message}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </section>
        ),
        workspaces: (
            <section className="pgh-card">
                <div className="pgh-card-header">
                    <h2 className="pgh-card-title"><FiGrid /> Recent Workspaces</h2>
                    <button className="pgh-link-btn" onClick={() => navigate('../workspaces')}>View All</button>
                </div>
                <div className="pgh-list">
                    {loading ? (
                        <PageLoader label="Loading workspaces..." />
                    ) : recentWorkspaces.length === 0 ? (
                        <div className="pgh-empty">
                            <p>You have no workspaces yet. Create your first workspace to get started.</p>
                            <button className="pgh-empty-btn" onClick={() => navigate('../workspaces?create=true')}>
                                <FiPlus /> Create Workspace
                            </button>
                        </div>
                    ) : (
                        recentWorkspaces.map((workspace) => (
                            <div key={workspace._id} className="pgh-row" onClick={() => navigate(`../workspaces/${workspace._id}`)}>
                                <div className="pgh-row-icon">{workspace.isPersonal ? <FiStar /> : <FiUsers />}</div>
                                <div className="pgh-row-info">
                                    <h3>{workspace.name}</h3>
                                    <p>{workspace.isPersonal ? "Personal" : "Team"} · {workspace.collectionsCount || 0} collections</p>
                                </div>
                                <FiArrowRight className="pgh-row-arrow" />
                            </div>
                        ))
                    )}
                </div>
            </section>
        ),
        collections: (
            <section className="pgh-card">
                <div className="pgh-card-header">
                    <h2 className="pgh-card-title"><FiPackage /> Recent Collections</h2>
                    <button className="pgh-link-btn" onClick={() => navigate(primaryWorkspaceCollectionsPath)}>View All</button>
                </div>
                <div className="pgh-collections">
                    {loading ? (
                        <PageLoader label="Loading collections..." />
                    ) : recentCollections.length === 0 ? (
                        <div className="pgh-empty">
                            <p>You have no collections yet. Create your first collection to get started.</p>
                            <button className="pgh-empty-btn" onClick={() => navigate(primaryWorkspaceCollectionsPath)}>
                                <FiPlus /> Create Collection
                            </button>
                        </div>
                    ) : (
                        recentCollections.map((collection) => (
                            <div key={collection._id} className="pgh-collection-card" onClick={() => openRecentCollection(collection)}>
                                <h3>{collection.name}</h3>
                                <p>{collection.description || 'No description'}</p>
                                <div className="pgh-collection-meta">
                                    <span>{getCollectionRequestCount(collection)} requests</span>
                                    <span>Updated {formatDate(collection.updatedAt)}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </section>
        ),
    };

    return (
        <div className="pgh-root">
            {/* Welcome Section */}
            <section className="pgh-hero">
                <div className="pgh-hero-text">
                    <h1>Welcome{userData?.displayName ? `, ${userData.displayName}` : ''}!</h1>
                    <p>Manage your APIs, collaborate with your team, and streamline your development workflow.</p>
                    <p className="pgh-kbd-hint">Press <kbd>Ctrl</kbd>+<kbd>K</kbd> to jump anywhere</p>
                </div>
                <div className="pgh-actions">
                    <button className="pgh-action-btn pgh-action-btn--primary" onClick={() => { toast.info('Opening new request…'); navigate('../../workspace/api-network/requests/new'); }}>
                        <FiSend className="pgh-action-icon" />
                        <span>New Request</span>
                    </button>
                    <button className="pgh-action-btn" onClick={() => navigate('../graphql')}>
                        <FiCode className="pgh-action-icon" />
                        <span>GraphQL</span>
                    </button>
                    <button className="pgh-action-btn" onClick={() => navigate(primaryWorkspaceCollectionsPath)}>
                        <FiPackage className="pgh-action-icon" />
                        <span>New Collection</span>
                    </button>
                    <button className="pgh-action-btn" onClick={() => navigate('../workspaces?create=true')}>
                        <FiGrid className="pgh-action-icon" />
                        <span>New Workspace</span>
                    </button>
                </div>
            </section>

            {/* Main Dashboard Content — drag cards to reorder */}
            <div className="pgh-grid">
                {cardOrder.map((id, index) => (
                    <div
                        key={id}
                        className="pgh-card-drag"
                        title="Drag to rearrange"
                        draggable
                        onDragStart={() => { dragCard.current = index; }}
                        onDragOver={(e) => { e.preventDefault(); handleCardDragOver(index); }}
                        onDragEnd={persistCardOrder}
                        onDrop={(e) => e.preventDefault()}
                    >
                        {cardContent[id]}
                    </div>
                ))}
            </div>

            {/* Quick Links Section */}
            <section className="pgh-card">
                <h2 className="pgh-card-title"><FiBookOpen /> Resource Links</h2>
                <div className="pgh-quick-links">
                    <Link to="/documentation" className="pgh-quick-link">
                        <FiBookOpen className="pgh-quick-link-icon" />
                        <div className="pgh-quick-link-body">
                            <h3>Documentation</h3>
                            <p>Learn how to use all features of Pigeon</p>
                        </div>
                    </Link>
                    <Link to="/workspace/api-network/explore" className="pgh-quick-link">
                        <FiSearch className="pgh-quick-link-icon" />
                        <div className="pgh-quick-link-body">
                            <h3>Explore Public APIs</h3>
                            <p>Discover and test popular public APIs</p>
                        </div>
                    </Link>
                    <Link to="/workspace/monitoring" className="pgh-quick-link">
                        <FiTrendingUp className="pgh-quick-link-icon" />
                        <div className="pgh-quick-link-body">
                            <h3>Monitoring</h3>
                            <p>Track API health, alerts, and incidents</p>
                        </div>
                    </Link>
                    <Link to="/workspace/protocols" className="pgh-quick-link">
                        <FiLink className="pgh-quick-link-icon" />
                        <div className="pgh-quick-link-body">
                            <h3>Protocol Testing</h3>
                            <p>Test WebSocket, gRPC, SOAP, MQTT, and SSE APIs</p>
                        </div>
                    </Link>
                    <Link to="/workspace/performance-tests" className="pgh-quick-link">
                        <FiBarChart2 className="pgh-quick-link-icon" />
                        <div className="pgh-quick-link-body">
                            <h3>Performance Testing</h3>
                            <p>Measure API behavior under load</p>
                        </div>
                    </Link>
                    <a href="https://github.com/Ranshiv/Pigeon" target="_blank" rel="noopener noreferrer" className="pgh-quick-link">
                        <FiCode className="pgh-quick-link-icon" />
                        <div className="pgh-quick-link-body">
                            <h3>GitHub</h3>
                            <p>View source code and contribute</p>
                        </div>
                    </a>
                </div>
            </section>

        </div>
    );
};

export default Home;
