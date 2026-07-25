// client/src/components/Home.js
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import './Home.css';
import PageLoader from './common/PageLoader/PageLoader';
import {
    FiSend, FiSearch, FiGrid, FiPackage, FiActivity,
    FiUsers, FiGitPullRequest, FiStar, FiClock,
    FiPlus, FiArrowRight, FiCode, FiBookOpen
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

    // Draggable dashboard cards. Flat order maps row-major into the 2-col grid:
    // [0]=top-left, [1]=top-right, [2]=bottom-left, [3]=bottom-right.
    const DEFAULT_CARDS = ['stats', 'workspaces', 'activity', 'collections'];
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
                        const collectionsResponse = await fetch(
                            `/api/workspaces/${allWorkspaces[0]._id}/collections`,
                            { credentials: 'include' }
                        );

                        if (collectionsResponse.ok) {
                            const collectionsData = await collectionsResponse.json();

                            // Recent collections from primary workspace
                            setRecentCollections(collectionsData.slice(0, 4));

                            // Requests stat sums across primary workspace collections
                            setStats(prev => ({
                                ...prev,
                                requests: collectionsData.reduce(
                                    (sum, collection) => sum + (collection.requestsCount || 0), 0
                                )
                            }));
                        }

                        // Fetch activity for the first workspace
                        const activityResponse = await fetch(
                            `/api/workspaces/${allWorkspaces[0]._id}/activity`,
                            { credentials: 'include' }
                        );

                        if (activityResponse.ok) {
                            const activityData = await activityResponse.json();
                            setRecentActivity(activityData.slice(0, 5));
                        }

                        // Fetch pending merge requests
                        const mergeRequestsResponse = await fetch(
                            `/api/workspaces/${allWorkspaces[0]._id}/merge-requests?status=pending`,
                            { credentials: 'include' }
                        );

                        if (mergeRequestsResponse.ok) {
                            const mergeRequestsData = await mergeRequestsResponse.json();
                            setStats(prev => ({
                                ...prev,
                                pendingMergeRequests: mergeRequestsData.length
                            }));
                        }
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

    // Command palette (Cmd/Ctrl+K) — 2026 pro-tool pattern.
    // Routes to key pages; lightweight, no new component.
    const handleCommandShortcut = useCallback((e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            const commands = [
                { label: 'New Request', path: '../api-network/requests/new' },
                { label: 'GraphQL', path: '../graphql' },
                { label: 'New Collection', path: '../collections/new' },
                { label: 'Monitoring', path: '../monitoring' },
                { label: 'Workspaces', path: '../workspaces' },
                { label: 'Settings', path: '../settings' }
            ];
            const choice = window.prompt(
                'Command palette — jump to:\n' + commands.map((c, i) => `${i + 1}. ${c.label}`).join('\n'),
                '1'
            );
            const idx = parseInt(choice, 10) - 1;
            if (idx >= 0 && idx < commands.length) {
                navigate(commands[idx].path);
            }
        }
    }, [navigate]);

    useEffect(() => {
        window.addEventListener('keydown', handleCommandShortcut);
        return () => window.removeEventListener('keydown', handleCommandShortcut);
    }, [handleCommandShortcut]);

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

    // Card content by id — rendered into draggable wrappers below.
    const cardContent = {
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
                    <button className="pgh-link-btn" onClick={() => navigate('../collections')}>View All</button>
                </div>
                <div className="pgh-collections">
                    {loading ? (
                        <PageLoader label="Loading collections..." />
                    ) : recentCollections.length === 0 ? (
                        <div className="pgh-empty">
                            <p>You have no collections yet. Create your first collection to get started.</p>
                            <button className="pgh-empty-btn" onClick={() => navigate('../collections/new')}>
                                <FiPlus /> Create Collection
                            </button>
                        </div>
                    ) : (
                        recentCollections.map((collection) => (
                            <div key={collection._id} className="pgh-collection-card" onClick={() => navigate(`../collections/${collection._id}`)}>
                                <h3>{collection.name}</h3>
                                <p>{collection.description || 'No description'}</p>
                                <div className="pgh-collection-meta">
                                    <span>{collection.requestsCount || 0} requests</span>
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
                    <button className="pgh-action-btn" onClick={() => navigate('../collections/new')}>
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
                    <a href="/documentation" className="pgh-quick-link">
                        <FiBookOpen className="pgh-quick-link-icon" />
                        <div className="pgh-quick-link-body">
                            <h3>Documentation</h3>
                            <p>Learn how to use all features of Pigeon</p>
                        </div>
                    </a>
                    <a href="/workspace/api-network/explore" className="pgh-quick-link">
                        <FiSearch className="pgh-quick-link-icon" />
                        <div className="pgh-quick-link-body">
                            <h3>Explore Public APIs</h3>
                            <p>Discover and test popular public APIs</p>
                        </div>
                    </a>
                    <a href="https://github.com/your-org/pigeon" target="_blank" rel="noopener noreferrer" className="pgh-quick-link">
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