import React, { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Star, TrendingUp, ChevronDown, X, Play, BookOpen, Bookmark } from 'lucide-react';
import ApiDetailModal from './ApiDetailModal';
import './ExplorePage.css';

// Segmented sort. Backend must accept these `sort` keys; unknown keys fall back to default order.
const SORT_OPTIONS = [
    { value: 'popular', label: 'Popular' },
    { value: 'trending', label: 'Trending' },
    { value: 'newest', label: 'Newest' },
    { value: 'name', label: 'A–Z' }
];

const FAVORITES_KEY = 'exploreFavorites';

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
    const [favorites, setFavorites] = useState(() => {
        try { return new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]')); }
        catch { return new Set(); }
    });

    const toggleFavorite = (id) => {
        setFavorites(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
            return next;
        });
    };

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

    const formatRating = (r) => (r == null ? '—' : Number(r).toFixed(1));

    return (
        <div className="explore-page">
            {/* Header */}
            <div className="explore-header">
                <div className="header-content">
                    <span className="eyebrow">MARKETPLACE</span>
                    <h1>Explore APIs</h1>
                    <p>Discover, test, and integrate thousands of public APIs directly in your workspace</p>
                </div>
            </div>

            {/* Single sticky unit: toolbar row 1 (search + filters toggle + sort) + row 2 (chips) */}
            <div className="explore-sticky">
            <div className="explore-toolbar">
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

                <div className="sort-segmented" role="tablist" aria-label="Sort APIs">
                    {SORT_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            role="tab"
                            aria-selected={sortBy === opt.value}
                            className={`sort-segment ${sortBy === opt.value ? 'active' : ''}`}
                            onClick={() => { setSortBy(opt.value); setPage(1); }}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Row 2: category chips — reparented into sticky unit */}
            <div className="category-chips" role="tablist" aria-label="Filter by category">
                {categories.map(category => (
                    <button
                        key={category.name}
                        role="tab"
                        aria-selected={selectedCategory === category.name}
                        className={`category-chip ${selectedCategory === category.name ? 'active' : ''}`}
                        onClick={() => {
                            setSelectedCategory(category.name);
                            setPage(1);
                        }}
                    >
                        <span>{category.name}</span>
                        {category.count > 0 && <span className="chip-count">{category.count}</span>}
                    </button>
                ))}
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
                        <div className="apis-grid">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div className="api-card skeleton-card" key={i} style={{ '--i': i }}>
                                    <div className="sk sk-top">
                                        <div className="sk sk-avatar" />
                                        <div className="sk-lines">
                                            <div className="sk sk-line sk-line-lg" />
                                            <div className="sk sk-line sk-line-sm" />
                                        </div>
                                    </div>
                                    <div className="sk sk-line sk-body" />
                                    <div className="sk sk-line sk-body sk-body-short" />
                                    <div className="sk sk-footer">
                                        <div className="sk sk-pill" />
                                        <div className="sk sk-pill" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : apis.length === 0 ? (
                        <div className="empty">
                            <Search size={32} strokeWidth={1.5} className="empty-icon" />
                            <h3 className="empty-title">No APIs match your filters</h3>
                            <p className="empty-text">Try a different search term or clear the filters to see everything.</p>
                            <button className="empty-btn" onClick={clearFilters}>
                                Clear filters
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="apis-grid">
                                {apis.map((api, i) => (
                                    <div
                                        key={api.id}
                                        className="api-card"
                                        style={{ '--i': i % 12 }}
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

                                            {/* Meta row: badges + category pill, inline under title block */}
                                            <div className="api-meta-row">
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
                                                <span className="api-category-pill">{api.category}</span>
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
                                                    <span className="stat-value">{formatRating(api.ratingAverage)}</span>
                                                    <span className="stat-sub">({api.ratingCount})</span>
                                                </div>
                                            </div>

                                            <div className="tags-row">
                                                <span className="tech-badge">{api.authType}</span>
                                                <span className="tech-badge">{api.pricing}</span>
                                            </div>
                                        </div>

                                        {/* Hover action row */}
                                        <div className="api-card-actions">
                                            <button
                                                className="card-action card-action-primary"
                                                onClick={(e) => { e.stopPropagation(); openApiDetail(api); }}
                                            >
                                                <Play size={14} /> Try It
                                            </button>
                                            <button
                                                className="card-action"
                                                onClick={(e) => { e.stopPropagation(); openApiDetail(api); }}
                                            >
                                                <BookOpen size={14} /> Docs
                                            </button>
                                            <button
                                                className={`card-action card-action-icon ${favorites.has(api.id) ? 'saved' : ''}`}
                                                title={favorites.has(api.id) ? 'Saved' : 'Save'}
                                                aria-pressed={favorites.has(api.id)}
                                                onClick={(e) => { e.stopPropagation(); toggleFavorite(api.id); }}
                                            >
                                                <Bookmark size={14} fill={favorites.has(api.id) ? 'currentColor' : 'none'} />
                                            </button>
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
