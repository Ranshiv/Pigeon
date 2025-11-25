// client/src/components/Home.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
                const wsResponse = await fetch('http://localhost:5001/api/workspaces', {
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

                    // If we have workspaces, fetch collections for the first workspace
                    if (allWorkspaces.length > 0) {
                        const collectionsResponse = await fetch(
                            `http://localhost:5001/api/workspaces/${allWorkspaces[0]._id}/collections`,
                            { credentials: 'include' }
                        );

                        if (collectionsResponse.ok) {
                            const collectionsData = await collectionsResponse.json();
                            setRecentCollections(collectionsData.slice(0, 4));

                            // Update stats
                            setStats(prev => ({
                                ...prev,
                                collections: collectionsData.length
                            }));

                            // Count requests across collections
                            const totalRequests = collectionsData.reduce(
                                (sum, collection) => sum + (collection.requestsCount || 0), 0
                            );

                            setStats(prev => ({
                                ...prev,
                                requests: totalRequests
                            }));
                        }

                        // Fetch activity for the first workspace
                        const activityResponse = await fetch(
                            `http://localhost:5001/api/workspaces/${allWorkspaces[0]._id}/activity`,
                            { credentials: 'include' }
                        );

                        if (activityResponse.ok) {
                            const activityData = await activityResponse.json();
                            setRecentActivity(activityData.slice(0, 5));
                        }

                        // Fetch pending merge requests
                        const mergeRequestsResponse = await fetch(
                            `http://localhost:5001/api/workspaces/${allWorkspaces[0]._id}/merge-requests?status=pending`,
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
        <div className="dashboard-container">
            {/* Welcome Section */}
            <section className="welcome-section">
                <div className="welcome-content">
                    <h1>Welcome{userData?.displayName ? `, ${userData.displayName}` : ''}!</h1>
                    <p>Manage your APIs, collaborate with your team, and streamline your development workflow.</p>
                </div>
                <div className="quick-actions">
                    <button className="quick-action-btn primary" onClick={() => navigate('../../workspace/api-network/requests/new')}>
                        <FiSend className="action-icon" />
                        <span>New Request</span>
                    </button>
                    <button className="quick-action-btn" onClick={() => navigate('../graphql')}>
                        <FiCode className="action-icon" />
                        <span>GraphQL</span>
                    </button>
                    <button className="quick-action-btn" onClick={() => navigate('../collections/new')}>
                        <FiPackage className="action-icon" />
                        <span>New Collection</span>
                    </button>
                    <button className="quick-action-btn" onClick={() => navigate('../workspaces?create=true')}>
                        <FiGrid className="action-icon" />
                        <span>New Workspace</span>
                    </button>
                </div>
            </section>

            {/* Main Dashboard Content */}
            <div className="dashboard-content">
                {/* Left Column - Stats and Recent Activity */}
                <div className="dashboard-column">
                    {/* Stats Overview */}
                    <section className="dashboard-section stats-section">
                        <h2><FiActivity /> Stats Overview</h2>
                        <div className="stats-grid">
                            <div className="stat-card">
                                <div className="stat-icon collections">
                                    <FiPackage />
                                </div>
                                <div className="stat-info">
                                    <span className="stat-value">{stats.collections}</span>
                                    <span className="stat-label">Collections</span>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon workspaces">
                                    <FiGrid />
                                </div>
                                <div className="stat-info">
                                    <span className="stat-value">{stats.workspaces}</span>
                                    <span className="stat-label">Workspaces</span>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon requests">
                                    <FiSend />
                                </div>
                                <div className="stat-info">
                                    <span className="stat-value">{stats.requests}</span>
                                    <span className="stat-label">Requests</span>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon pending">
                                    <FiGitPullRequest />
                                </div>
                                <div className="stat-info">
                                    <span className="stat-value">{stats.pendingMergeRequests}</span>
                                    <span className="stat-label">Pending Merges</span>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Recent Activity */}
                    <section className="dashboard-section activity-section">
                        <div className="section-header">
                            <h2><FiClock /> Recent Activity</h2>
                            <button
                                className="view-all-btn"
                                onClick={() => navigate('../workspaces')}
                            >
                                View All
                            </button>
                        </div>
                        <div className="activity-list">
                            {loading ? (
                                <div className="loading">Loading recent activity...</div>
                            ) : recentActivity.length === 0 ? (
                                <div className="empty-state">
                                    <p>No recent activity to display. Start by creating collections or sending requests.</p>
                                </div>
                            ) : (
                                recentActivity.map((activity) => (
                                    <div key={activity._id} className="activity-item">
                                        <div className="activity-icon">
                                            {getActivityIcon(activity.type)}
                                        </div>
                                        <div className="activity-content">
                                            <div className="activity-header">
                                                <span className="user">{activity.user?.displayName || 'A user'}</span>
                                                <span className="time">{formatDate(activity.timestamp)}</span>
                                            </div>
                                            <p className="activity-message">{activity.message}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>
                </div>

                {/* Right Column - Workspaces and Collections */}
                <div className="dashboard-column">
                    {/* Recent Workspaces */}
                    <section className="dashboard-section workspaces-section">
                        <div className="section-header">
                            <h2><FiGrid /> Recent Workspaces</h2>
                            <button
                                className="view-all-btn"
                                onClick={() => navigate('../workspaces')}
                            >
                                View All
                            </button>
                        </div>
                        <div className="workspaces-list">
                            {loading ? (
                                <div className="loading">Loading workspaces...</div>
                            ) : recentWorkspaces.length === 0 ? (
                                <div className="empty-state">
                                    <p>You have no workspaces yet. Create your first workspace to get started.</p>
                                    <button
                                        className="empty-state-btn"
                                        onClick={() => navigate('../workspaces?create=true')}
                                    >
                                        <FiPlus /> Create Workspace
                                    </button>
                                </div>
                            ) : (
                                recentWorkspaces.map((workspace) => (
                                    <div
                                        key={workspace._id}
                                        className="workspace-card"
                                        onClick={() => navigate(`../workspaces/${workspace._id}`)}
                                    >
                                        <div className="workspace-icon">
                                            {workspace.isPersonal ? (
                                                <FiStar />
                                            ) : (
                                                <FiUsers />
                                            )}
                                        </div>
                                        <div className="workspace-info">
                                            <h3>{workspace.name}</h3>
                                            <p>
                                                {workspace.isPersonal ? "Personal" : "Team"} ·
                                                {" "}{workspace.collectionsCount || 0} collections
                                            </p>
                                        </div>
                                        <FiArrowRight className="view-arrow" />
                                    </div>
                                ))
                            )}
                        </div>
                    </section>

                    {/* Recent Collections */}
                    <section className="dashboard-section collections-section">
                        <div className="section-header">
                            <h2><FiPackage /> Recent Collections</h2>
                            <button
                                className="view-all-btn"
                                onClick={() => navigate('../collections')}
                            >
                                View All
                            </button>
                        </div>
                        <div className="collections-grid">
                            {loading ? (
                                <div className="loading">Loading collections...</div>
                            ) : recentCollections.length === 0 ? (
                                <div className="empty-state">
                                    <p>You have no collections yet. Create your first collection to get started.</p>
                                    <button
                                        className="empty-state-btn"
                                        onClick={() => navigate('../collections/new')}
                                    >
                                        <FiPlus /> Create Collection
                                    </button>
                                </div>
                            ) : (
                                recentCollections.map((collection) => (
                                    <div
                                        key={collection._id}
                                        className="collection-card"
                                        onClick={() => navigate(`../collections/${collection._id}`)}
                                    >
                                        <h3>{collection.name}</h3>
                                        <p>{collection.description || 'No description'}</p>
                                        <div className="collection-meta">
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
            <section className="dashboard-section quick-links-section">
                <h2><FiBookOpen /> Resource Links</h2>
                <div className="quick-links">
                    <a href="/documentation" className="quick-link">
                        <FiBookOpen className="quick-link-icon" />
                        <div className="quick-link-content">
                            <h3>Documentation</h3>
                            <p>Learn how to use all features of Pigeon</p>
                        </div>
                    </a>
                    <a href="../api-network/explore" className="quick-link">
                        <FiSearch className="quick-link-icon" />
                        <div className="quick-link-content">
                            <h3>Explore APIs</h3>
                            <p>Discover trending and popular APIs</p>
                        </div>
                    </a>
                    <a href="https://github.com/your-org/pigeon" target="_blank" rel="noopener noreferrer" className="quick-link">
                        <FiCode className="quick-link-icon" />
                        <div className="quick-link-content">
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