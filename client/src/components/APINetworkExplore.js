import React, { useState, useEffect } from 'react';
import './APINetworkExplore.css';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiStar, FiFolder, FiGlobe, FiLock, FiCheck, FiX, FiThumbsUp } from 'react-icons/fi';

const APINetworkExplore = () => {
    const navigate = useNavigate();
    const [recentRequests, setRecentRequests] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [collections, setCollections] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [userCollections, setUserCollections] = useState([]);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [apis, setApis] = useState([]);
    const [popularAPIs, setPopularAPIs] = useState([]);
    const [recommendedCollections, setRecommendedCollections] = useState([]);

    // Updated categories to match common API categories
    const categories = [
        { id: 'all', name: 'All' },
        { id: 'AI', name: 'AI' },
        { id: 'Finance', name: 'Finance' },
        { id: 'Science', name: 'Science' },
        { id: 'Entertainment', name: 'Entertainment' },
        { id: 'Games', name: 'Games' },
        { id: 'News', name: 'News' },
        { id: 'Lifestyle', name: 'Lifestyle' },
        { id: 'Data', name: 'Data' },
        { id: 'Sports', name: 'Sports' },
        { id: 'Weather', name: 'Weather' },
        { id: 'Cryptocurrency', name: 'Crypto' },
        { id: 'Tools', name: 'Tools' },
        { id: 'Social', name: 'Social' },
        { id: 'Marketing', name: 'Marketing' }
    ];

    // Featured collections similar to Postman
    const featuredCollections = [
        {
            id: 'collection-1',
            name: 'Twitter API Collection',
            description: 'Complete collection of Twitter API endpoints',
            author: 'Pigeon Team',
            stars: 245,
            category: 'rest'
        },
        {
            id: 'collection-2',
            name: 'GitHub GraphQL API',
            description: 'GitHub API v4 (GraphQL) endpoint collection',
            author: 'Pigeon Team',
            stars: 189,
            category: 'graphql'
        },
        {
            id: 'collection-3',
            name: 'Weather API Suite',
            description: 'Collection of popular weather API endpoints',
            author: 'Pigeon Community',
            stars: 156,
            category: 'rest'
        }
    ];

    // Fetch recent history on component mount
    useEffect(() => {
        fetchRecentHistory();
        fetchCollections();
        fetchUserCollections();
        fetchPopularAPIs();
        fetchRecommendedCollections();
    }, []);

    const fetchRecentHistory = async () => {
        try {
            const response = await fetch('http://localhost:5001/api/history', {
                credentials: 'include'
            });

            if (response.ok) {
                const historyData = await response.json();
                const recentItems = historyData.slice(0, 3).map(item => ({
                    id: item._id,
                    name: `${item.method} ${new URL(item.url).pathname}`,
                    url: item.url,
                    method: item.method,
                    timestamp: new Date(item.timestamp).toLocaleDateString()
                }));
                setRecentRequests(recentItems);
            }
        } catch (error) {
            console.error('Error fetching history:', error);
        }
    };

    const fetchCollections = async () => {
        try {
            setLoading(true);
            const response = await fetch('http://localhost:5001/api/collections', {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                setCollections(data);
            }
        } catch (err) {
            setError('Failed to fetch collections');
            console.error('Error fetching collections:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchUserCollections = async () => {
        try {
            const response = await fetch('http://localhost:5001/api/collections', {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                setUserCollections(data);
            }
        } catch (err) {
            console.error('Error fetching user collections:', err);
        }
    };

    const fetchPopularAPIs = async () => {
        try {
            const response = await fetch('/api/history/popular-apis', {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                setPopularAPIs(data);
            }
        } catch (err) {
            console.error('Error fetching popular APIs:', err);
        }
    };

    const fetchRecommendedCollections = async () => {
        try {
            const response = await fetch('/api/marketplace/recommended-collections', {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                setRecommendedCollections(data);
            }
        } catch (err) {
            console.error('Error fetching recommended collections:', err);
        }
    };

    const handleForkCollection = async (collectionId) => {
        try {
            setLoading(true);
            const response = await fetch(`http://localhost:5001/api/collections/${collectionId}/fork`, {
                method: 'POST',
                credentials: 'include'
            });

            if (response.ok) {
                const forkedCollection = await response.json();
                setCollections(prevCollections => [...prevCollections, forkedCollection]);
                // Show success message or notification here
                alert('Collection forked successfully!');
            } else {
                const error = await response.json();
                throw new Error(error.message);
            }
        } catch (err) {
            setError('Failed to fork collection');
            console.error('Error forking collection:', err);
            alert('Failed to fork collection. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        setSearchLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/search?query=${encodeURIComponent(searchQuery)}&category=${selectedCategory}`, {
                credentials: 'include'
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.isEmpty) {
                    setError('Please enter a search term to find APIs');
                    setApis([]); // Clear any previous results
                } else {
                    throw new Error(data.message || 'Search failed');
                }
            } else {
                setApis(data);
                if (data.length === 0 && searchQuery) {
                    setError('No APIs found matching your search.');
                }
            }
        } catch (err) {
            setError('Failed to search APIs');
            console.error('Error searching APIs:', err);
        } finally {
            setSearchLoading(false);
        }
    };

    const handleAddToCollection = async (api) => {
        try {
            setLoading(true);
            // First create a new request
            const newRequest = {
                name: api.name,
                url: api.url,
                method: 'GET', // Default to GET
                description: api.description,
                headers: [],
                body: '',
                bodyType: 'none'
            };

            const requestResponse = await fetch('/api/requests', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(newRequest)
            });

            if (!requestResponse.ok) {
                throw new Error('Failed to create request');
            }

            const savedRequest = await requestResponse.json();
            alert('API added successfully! You can now use it in your requests.');
            navigate(`/workspace/api-network/requests/${savedRequest._id}`);

        } catch (err) {
            setError('Failed to add API');
            console.error('Error adding API:', err);
            alert('Failed to add API. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const filteredCollections = featuredCollections
        .filter(collection =>
            (selectedCategory === 'all' || collection.category === selectedCategory) &&
            (searchQuery === '' || collection.name.toLowerCase().includes(searchQuery.toLowerCase()))
        );

    return (
        <>
            {/* Search Section */}
            <section className="search-section">
                <h1>Discover Public APIs</h1>
                <p className="search-description">Search from our curated collection of popular APIs</p>
                <form onSubmit={handleSearch} className="search-form">
                    <div className="search-input-container">
                        <FiSearch className="search-icon" />
                        <input
                            type="text"
                            placeholder="Try searching for 'weather', 'payment', or 'social'..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="search-input"
                        />
                    </div>
                    <button type="submit" className="search-button" disabled={searchLoading}>
                        {searchLoading ? 'Searching...' : 'Search'}
                    </button>
                </form>
            </section>

            {/* Quick Stats */}
            <div className="quick-stats">
                <div className="stat-card">
                    <FiThumbsUp className="stat-icon" />
                    <div className="stat-content">
                        <span className="stat-value">{popularAPIs.length}</span>
                        <span className="stat-label">Popular APIs</span>
                    </div>
                </div>
                <div className="stat-card">
                    <FiStar className="stat-icon" />
                    <div className="stat-content">
                        <span className="stat-value">{recommendedCollections.length}</span>
                        <span className="stat-label">Recommended</span>
                    </div>
                </div>
            </div>

            {/* Categories */}
            <section className="categories-section">
                <div className="category-tabs">
                    {categories.map(category => (
                        <button
                            key={category.id}
                            className={`category-tab ${selectedCategory === category.id ? 'active' : ''}`}
                            onClick={() => setSelectedCategory(category.id)}
                        >
                            {category.name}
                        </button>
                    ))}
                </div>
            </section>

            <section className="api-results-section">
                <h2><FiGlobe className="section-icon" /> Available APIs</h2>
                {searchLoading ? (
                    <div className="loading">Searching for APIs...</div>
                ) : error ? (
                    <div className="error-message">{error}</div>
                ) : (
                    <div className="api-grid">
                        {apis.map((api, index) => (
                            <div key={index} className="api-card">
                                <h3>{api.name}</h3>
                                <p className="api-description">{api.description}</p>
                                <div className="api-meta">
                                    <span className="category-tag">{api.category}</span>
                                    <div className="api-features">
                                        <span className={`feature pricing-${(api.pricing || 'Free').toLowerCase()}`} title="Pricing Model">
                                            {api.pricing || 'Free'}
                                        </span>
                                        <span className={`feature auth-${(api.authType || 'None').toLowerCase().replace(' ', '-')}`} title="Authentication Type">
                                            <FiLock /> {api.authType || 'No Auth'}
                                        </span>
                                        {api.ratingAverage && (
                                            <span className="feature rating" title="Average Rating">
                                                <FiStar /> {api.ratingAverage}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    className="add-api-button"
                                    onClick={() => handleAddToCollection(api)}
                                >
                                    Add to Requests
                                </button>
                            </div>
                        ))}
                        {apis.length === 0 && !searchLoading && (
                            <div className="no-results">
                                {searchQuery ? 'No APIs found matching your search.' : 'Start searching to discover APIs!'}
                            </div>
                        )}
                    </div>
                )}
            </section>

            {/* Popular on Pigeon this week */}
            <section className="popular-section">
                <h2><FiThumbsUp className="section-icon" /> Popular on Pigeon this week</h2>
                <div className="api-grid">
                    {popularAPIs.map((api, index) => (
                        <div key={index} className="api-card popular">
                            <div className="api-card-header">
                                <h3>{api._id.url}</h3>
                                <span className="usage-count">{api.count} uses this week</span>
                            </div>
                            <div className="api-meta">
                                <span className="method-tag">{api._id.method}</span>
                                <span className="last-used">Last used: {new Date(api.lastUsed).toLocaleDateString()}</span>
                            </div>
                            <button
                                className="add-api-button"
                                onClick={() => handleAddToCollection({
                                    name: api._id.url,
                                    url: api._id.url,
                                    method: api._id.method
                                })}
                            >
                                Add to Requests
                            </button>
                        </div>
                    ))}
                </div>
            </section>

            {/* Recommended Collections */}
            <section className="recommended-section">
                <h2><FiStar className="section-icon" /> Recommended for you</h2>
                <div className="collections-grid">
                    {recommendedCollections.map((collection) => (
                        <div key={collection._id} className="collection-card recommended">
                            <h3>{collection.name}</h3>
                            <p>{collection.description}</p>
                            <div className="collection-meta">
                                <span className="author">By {collection.author.displayName}</span>
                                <span className="stars">
                                    <FiStar /> {collection.stars}
                                </span>
                            </div>
                            <button
                                className="fork-button"
                                onClick={() => handleForkCollection(collection._id)}
                                disabled={loading}
                            >
                                {loading ? 'Forking...' : 'Fork Collection'}
                            </button>
                        </div>
                    ))}
                </div>
            </section>

            {/* Recent Activity */}
            <section className="recent-activity">
                <h2>Recent Activity</h2>
                <div className="request-list">
                    {recentRequests.length > 0 ? (
                        recentRequests.map(request => (
                            <div key={request.id} className="request-item">
                                <h3>{request.name}</h3>
                                <p><strong>URL:</strong> {request.url}</p>
                                <p><strong>Method:</strong> {request.method}</p>
                                <p className="timestamp"><strong>Date:</strong> {request.timestamp}</p>
                            </div>
                        ))
                    ) : (
                        <p>No recent activity</p>
                    )}
                </div>
            </section>
        </>
    );
};

export default APINetworkExplore;