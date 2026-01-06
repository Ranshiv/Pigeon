import React, { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Star, TrendingUp, Zap, ChevronDown, X } from 'lucide-react';
import ApiDetailModal from './ApiDetailModal';
import './ExplorePage.css';

const ExplorePage = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedTags, setSelectedTags] = useState([]);
    const [sortBy, setSortBy] = useState('popular');
    const [apis, setApis] = useState([]);
    const [categories, setCategories] = useState([]);
    const [tags, setTags] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showFilters, setShowFilters] = useState(true);
    const [selectedApi, setSelectedApi] = useState(null);
    const [showApiModal, setShowApiModal] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    const fetchApis = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                query: searchQuery,
                category: selectedCategory,
                tags: selectedTags.join(','),
                sort: sortBy,
                page: page.toString(),
                limit: '12'
            });

            const response = await fetch(`http://localhost:5001/api/marketplace/search?${params}`);
            const data = await response.json();

            if (page === 1) {
                setApis(data.results);
            } else {
                setApis(prev => [...prev, ...data.results]);
            }

            setHasMore(data.hasMore);
        } catch (error) {
            console.error('Failed to fetch APIs:', error);
        } finally {
            setLoading(false);
        }
    }, [searchQuery, selectedCategory, selectedTags, sortBy, page]);

    // Fetch categories and tags on mount
    useEffect(() => {
        fetchCategories();
        fetchTags();
    }, []);

    // Fetch APIs when search params change
    useEffect(() => {
        fetchApis();
    }, [fetchApis]);

    const fetchCategories = async () => {
        try {
            const response = await fetch('http://localhost:5001/api/marketplace/categories');
            const data = await response.json();
            setCategories([{ name: 'All', count: 0 }, ...data]);
        } catch (error) {
            console.error('Failed to fetch categories:', error);
        }
    };

    const fetchTags = async () => {
        try {
            const response = await fetch('http://localhost:5001/api/marketplace/tags');
            const data = await response.json();
            setTags(data.slice(0, 20)); // Show top 20 tags
        } catch (error) {
            console.error('Failed to fetch tags:', error);
        }
    };

    const toggleTag = (tagName) => {
        setSelectedTags(prev => {
            if (prev.includes(tagName)) {
                return prev.filter(t => t !== tagName);
            } else {
                return [...prev, tagName];
            }
        });
        setPage(1); // Reset to first page when filters change
    };

    const clearFilters = () => {
        setSearchQuery('');
        setSelectedCategory('All');
        setSelectedTags([]);
        setSortBy('popular');
        setPage(1);
    };

    const openApiDetail = (api) => {
        setSelectedApi(api);
        setShowApiModal(true);
    };

    const closeApiModal = () => {
        setShowApiModal(false);
        setSelectedApi(null);
    };

    const getAuthBadgeColor = (authType) => {
        switch (authType) {
            case 'None': return 'var(--success-color)';
            case 'API Key': return 'var(--info-color)';
            case 'OAuth 2.0': return 'var(--warning-color)';
            default: return 'var(--text-muted)';
        }
    };

    const getPricingBadgeColor = (pricing) => {
        switch (pricing) {
            case 'Free': return 'var(--success-color)';
            case 'Freemium': return 'var(--info-color)';
            case 'Paid': return 'var(--warning-color)';
            default: return 'var(--text-muted)';
        }
    };

    return (
        <div className="explore-page">
            {/* Header */}
            <div className="explore-header">
                <div className="header-content">
                    <h1>
                        <Zap size={32} style={{ color: 'var(--primary-color)' }} />
                        Explore Public APIs
                    </h1>
                    <p>Discover, test, and integrate thousands of public APIs directly in your workspace</p>
                </div>

                {/* Search Bar */}
                <div className="search-section">
                    <div className="search-input-wrapper">
                        <Search size={20} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search APIs by name, category, or tag..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setPage(1);
                            }}
                            className="search-input"
                        />
                        {searchQuery && (
                            <button
                                className="clear-search"
                                onClick={() => {
                                    setSearchQuery('');
                                    setPage(1);
                                }}
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    <button
                        className="filter-toggle"
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        <Filter size={18} />
                        Filters
                        <ChevronDown
                            size={16}
                            style={{
                                transform: showFilters ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 0.2s'
                            }}
                        />
                    </button>
                </div>
            </div>

            <div className="explore-body">
                {/* Sidebar Filters */}
                {showFilters && (
                    <aside className="filters-sidebar">
                        <div className="filter-section">
                            {(selectedCategory !== 'All' || selectedTags.length > 0) && (
                                <div className="filter-header">
                                    <button className="clear-filters-btn" onClick={clearFilters}>
                                        Clear All
                                    </button>
                                </div>
                            )}

                            {/* Sort By */}
                            <div className="filter-group">
                                <label className="filter-label">Sort By</label>
                                <select
                                    value={sortBy}
                                    onChange={(e) => {
                                        setSortBy(e.target.value);
                                        setPage(1);
                                    }}
                                    className="filter-select"
                                >
                                    <option value="popular">Most Popular</option>
                                    <option value="rating">Highest Rated</option>
                                    <option value="name">Name (A-Z)</option>
                                </select>
                            </div>

                            {/* Categories */}
                            <div className="filter-group">
                                <label className="filter-label">Category</label>
                                <div className="category-list">
                                    {categories.map(category => (
                                        <button
                                            key={category.name}
                                            className={`category-btn ${selectedCategory === category.name ? 'active' : ''}`}
                                            onClick={() => {
                                                setSelectedCategory(category.name);
                                                setPage(1);
                                            }}
                                        >
                                            <span>{category.name}</span>
                                            {category.count > 0 && <span className="count">{category.count}</span>}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Tags */}
                            <div className="filter-group">
                                <label className="filter-label">Tags</label>
                                <div className="tags-list">
                                    {tags.map(tag => (
                                        <button
                                            key={tag.name}
                                            className={`tag-btn ${selectedTags.includes(tag.name) ? 'active' : ''}`}
                                            onClick={() => toggleTag(tag.name)}
                                        >
                                            {tag.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </aside>
                )}

                {/* Main Content */}
                <main className="explore-content">
                    {/* Active Filters */}
                    {(selectedCategory !== 'All' || selectedTags.length > 0 || searchQuery) && (
                        <div className="active-filters">
                            <span className="active-filters-label">Active filters:</span>
                            {searchQuery && (
                                <span className="filter-chip">
                                    Search: "{searchQuery}"
                                    <button onClick={() => { setSearchQuery(''); setPage(1); }}>
                                        <X size={14} />
                                    </button>
                                </span>
                            )}
                            {selectedCategory !== 'All' && (
                                <span className="filter-chip">
                                    {selectedCategory}
                                    <button onClick={() => { setSelectedCategory('All'); setPage(1); }}>
                                        <X size={14} />
                                    </button>
                                </span>
                            )}
                            {selectedTags.map(tag => (
                                <span key={tag} className="filter-chip">
                                    {tag}
                                    <button onClick={() => toggleTag(tag)}>
                                        <X size={14} />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}

                    {/* APIs Grid */}
                    {loading && page === 1 ? (
                        <div className="loading-state">
                            <div className="spinner"></div>
                            <p>Loading APIs...</p>
                        </div>
                    ) : apis.length === 0 ? (
                        <div className="empty-state">
                            <Search size={48} style={{ color: 'var(--text-muted)' }} />
                            <h3>No APIs found</h3>
                            <p>Try adjusting your search or filters</p>
                            <button className="btn-primary" onClick={clearFilters}>
                                Clear Filters
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="apis-grid">
                                {apis.map(api => (
                                    <div
                                        key={api.id}
                                        className="api-card"
                                        onClick={() => openApiDetail(api)}
                                    >
                                        {/* Card Top: Identity & Badges */}
                                        <div className="api-card-top">
                                            <div className="api-identity">
                                                <div className="api-icon">
                                                    {api.logo ? (
                                                        <img src={api.logo} alt={api.name} />
                                                    ) : (
                                                        <div className="api-icon-placeholder">
                                                            {api.name.charAt(0)}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="api-title-block">
                                                    <h3 className="api-name">{api.name}</h3>
                                                    <span className="api-provider">by {api.provider}</span>
                                                </div>
                                            </div>

                                            {/* Badges - positioned top right */}
                                            <div className="api-badges">
                                                {api.featured && (
                                                    <span className="badge badge-featured" title="Featured">
                                                        <Star size={10} fill="currentColor" />
                                                        <span>Featured</span>
                                                    </span>
                                                )}
                                                {api.trending && (
                                                    <span className="badge badge-trending" title="Trending">
                                                        <TrendingUp size={10} />
                                                        <span>Trending</span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Description */}
                                        <div className="api-card-body">
                                            <p className="api-description">{api.description}</p>
                                        </div>

                                        {/* Footer: Stats & Technical Tags */}
                                        <div className="api-card-footer">
                                            <div className="stats-row">
                                                <div className="stat-item" title="Rating">
                                                    <Star size={14} className="star-icon" fill="currentColor" />
                                                    <span className="stat-value">{api.ratingAverage}</span>
                                                    <span className="stat-sub">({api.ratingCount})</span>
                                                </div>
                                            </div>

                                            <div className="tags-row">
                                                <span
                                                    className="tech-badge"
                                                    style={{ borderColor: getAuthBadgeColor(api.authType), color: getAuthBadgeColor(api.authType) }}
                                                >
                                                    {api.authType}
                                                </span>
                                                <span
                                                    className="tech-badge"
                                                    style={{ borderColor: getPricingBadgeColor(api.pricing), color: getPricingBadgeColor(api.pricing) }}
                                                >
                                                    {api.pricing}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Load More */}
                            {hasMore && (
                                <div className="load-more-section">
                                    <button
                                        className="btn-secondary"
                                        onClick={() => setPage(prev => prev + 1)}
                                        disabled={loading}
                                    >
                                        {loading ? 'Loading...' : 'Load More'}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </main>
            </div>

            {/* API Detail Modal */}
            {showApiModal && selectedApi && (
                <ApiDetailModal
                    api={selectedApi}
                    onClose={closeApiModal}
                />
            )}
        </div>
    );
};

export default ExplorePage;
