// client/src/components/Home.js
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import './Home.css';
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

                    // Update stats
                    setStats(prev => ({
                        ...prev,
                        workspaces: allWorkspaces.length
                    }));

                    // Fetch all collections (global view) to populate stats and recent cards.
                    // The backend already returns all collections in dev when user filtering finds none.
                    const allCollectionsResponse = await fetch(
                        '/api/collections',
                        { credentials: 'include' }
                    );

                    if (allCollectionsResponse.ok) {
                        const allCollections = await allCollectionsResponse.json();

                        // Recent collections (global)
                        setRecentCollections(allCollections.slice(0, 4));

                        // Stats: collections count and total requests
                        setStats(prev => ({
                            ...prev,
                            collections: allCollections.length,
                            requests: allCollections.reduce(
                                (sum, collection) => sum + (collection.requestsCount || 0), 0
                            )
                        }));
                    }

                    // If we have workspaces, also fetch workspace-specific data for the first workspace (activity/merges)
                    if (allWorkspaces.length > 0) {
                        const collectionsResponse = await fetch(
                            `/api/workspaces/${allWorkspaces[0]._id}/collections`,
                            { credentials: 'include' }
                        );

                        if (collectionsResponse.ok) {
                            const collectionsData = await collectionsResponse.json();

                            // If global collections call failed or returned empty, fall back to these
                            setRecentCollections(prev => prev && prev.length > 0 ? prev : collectionsData.slice(0, 4));

                            // Update stats only if not already populated
                            setStats(prev => ({
                                ...prev,
                                collections: prev.collections || collectionsData.length,
                                requests: prev.requests || collectionsData.reduce(
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

            {/* Main Dashboard Content */}
            <div className="pgh-grid">
                {/* Left Column - Stats and Recent Activity */}
                <div className="pgh-col">
                    {/* Stats Overview */}
                    <section className="pgh-card">
                        <h2 className="pgh-card-title"><FiActivity /> Stats Overview</h2>
                        <div className="pgh-stats">
                            <div className="pgh-stat">
                                <div className="pgh-stat-icon pgh-stat-icon--collections">
                                    <FiPackage />
                                </div>
                                <div className="pgh-stat-info">
                                    <span className="pgh-stat-value">{stats.collections}</span>
                                    <span className="pgh-stat-label">Collections</span>
                                </div>
                            </div>
                            <div className="pgh-stat">
                                <div className="pgh-stat-icon pgh-stat-icon--workspaces">
                                    <FiGrid />
                                </div>
                                <div className="pgh-stat-info">
                                    <span className="pgh-stat-value">{stats.workspaces}</span>
                                    <span className="pgh-stat-label">Workspaces</span>
                                </div>
                            </div>
                            <div className="pgh-stat">
                                <div className="pgh-stat-icon pgh-stat-icon--requests">
                                    <FiSend />
                                </div>
                                <div className="pgh-stat-info">
                                    <span className="pgh-stat-value">{stats.requests}</span>
                                    <span className="pgh-stat-label">Requests</span>
                                </div>
                            </div>
                            <div className="pgh-stat">
                                <div className="pgh-stat-icon pgh-stat-icon--pending">
                                    <FiGitPullRequest />
                                </div>
                                <div className="pgh-stat-info">
                                    <span className="pgh-stat-value">{stats.pendingMergeRequests}</span>
                                    <span className="pgh-stat-label">Pending Merges</span>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Recent Activity */}
                    <section className="pgh-card">
                        <div className="pgh-card-header">
                            <h2 className="pgh-card-title"><FiClock /> Recent Activity</h2>
                            <button className="pgh-link-btn" onClick={() => navigate('../workspaces')}>
                                View All
                            </button>
                        </div>
                        <div className="pgh-list">
                            {loading ? (
                                <div className="pgh-loading">Loading recent activity...</div>
                            ) : recentActivity.length === 0 ? (
                                <div className="pgh-empty">
                                    <p>No recent activity to display. Start by creating collections or sending requests.</p>
                                </div>
                            ) : (
                                recentActivity.map((activity) => (
                                    <div key={activity._id} className="pgh-activity-row">
                                        <div className="pgh-activity-icon">
                                            {getActivityIcon(activity.type)}
                                        </div>
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
                </div>

                {/* Right Column - Workspaces and Collections */}
                <div className="pgh-col">
                    {/* Recent Workspaces */}
                    <section className="pgh-card">
                        <div className="pgh-card-header">
                            <h2 className="pgh-card-title"><FiGrid /> Recent Workspaces</h2>
                            <button className="pgh-link-btn" onClick={() => navigate('../workspaces')}>
                                View All
                            </button>
                        </div>
                        <div className="pgh-list">
                            {loading ? (
                                <div className="pgh-loading">Loading workspaces...</div>
                            ) : recentWorkspaces.length === 0 ? (
                                <div className="pgh-empty">
                                    <p>You have no workspaces yet. Create your first workspace to get started.</p>
                                    <button className="pgh-empty-btn" onClick={() => navigate('../workspaces?create=true')}>
                                        <FiPlus /> Create Workspace
                                    </button>
                                </div>
                            ) : (
                                recentWorkspaces.map((workspace) => (
                                    <div
                                        key={workspace._id}
                                        className="pgh-row"
                                        onClick={() => navigate(`../workspaces/${workspace._id}`)}
                                    >
                                        <div className="pgh-row-icon">
                                            {workspace.isPersonal ? (
                                                <FiStar />
                                            ) : (
                                                <FiUsers />
                                            )}
                                        </div>
                                        <div className="pgh-row-info">
                                            <h3>{workspace.name}</h3>
                                            <p>
                                                {workspace.isPersonal ? "Personal" : "Team"} ·
                                                {" "}{workspace.collectionsCount || 0} collections
                                            </p>
                                        </div>
                                        <FiArrowRight className="pgh-row-arrow" />
                                    </div>
                                ))
                            )}
                        </div>
                    </section>

                    {/* Recent Collections */}
                    <section className="pgh-card">
                        <div className="pgh-card-header">
                            <h2 className="pgh-card-title"><FiPackage /> Recent Collections</h2>
                            <button className="pgh-link-btn" onClick={() => navigate('../collections')}>
                                View All
                            </button>
                        </div>
                        <div className="pgh-collections">
                            {loading ? (
                                <div className="pgh-loading">Loading collections...</div>
                            ) : recentCollections.length === 0 ? (
                                <div className="pgh-empty">
                                    <p>You have no collections yet. Create your first collection to get started.</p>
                                    <button className="pgh-empty-btn" onClick={() => navigate('../collections/new')}>
                                        <FiPlus /> Create Collection
                                    </button>
                                </div>
                            ) : (
                                recentCollections.map((collection) => (
                                    <div
                                        key={collection._id}
                                        className="pgh-collection-card"
                                        onClick={() => navigate(`../collections/${collection._id}`)}
                                    >
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
                </div>
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