import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, Filter, Star, TrendingUp, ChevronDown, X, Play, BookOpen, Bookmark, Plus, ShieldCheck } from 'lucide-react';
import ApiDetailModal from './ApiDetailModal';
import { MarketplaceApi } from './MarketplaceApi';
import AppSelect from '../common/AppSelect/AppSelect';
import { debounce } from '../../utils/debounce';
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
    const [searchInput, setSearchInput] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedTags, setSelectedTags] = useState([]);
    const [sortBy, setSortBy] = useState('popular');
    const [apis, setApis] = useState([]);
    const [categories, setCategories] = useState([]);
    const [tags, setTags] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showFilters, setShowFilters] = useState(true);
    const [showAllCategories, setShowAllCategories] = useState(false);
    const [selectedApi, setSelectedApi] = useState(null);
    const [showApiModal, setShowApiModal] = useState(false);
    const [modalInitialTab, setModalInitialTab] = useState('overview');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [error, setError] = useState(null);
    const [user, setUser] = useState(null);
    const [favorites, setFavorites] = useState(() => {
        try { return new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]')); }
        catch { return new Set(); }
    });
    const [showSubmit, setShowSubmit] = useState(false);
    const [submitForm, setSubmitForm] = useState({
        name: '', provider: '', description: '', category: '', tags: '',
        authType: 'None', pricing: 'Free', baseUrl: ''
    });
    const [submitStatus, setSubmitStatus] = useState(null);
    const [submitError, setSubmitError] = useState(null);
    const abortRef = useRef(null);

    const setSubmitField = (key, value) => setSubmitForm(prev => ({ ...prev, [key]: value }));

    const resetSubmitForm = () => {
        setSubmitForm({ name: '', provider: '', description: '', category: '', tags: '', authType: 'None', pricing: 'Free', baseUrl: '' });
        setSubmitStatus(null);
        setSubmitError(null);
    };

    const closeSubmitOverlay = () => {
        setShowSubmit(false);
        resetSubmitForm();
    };

    const onSubmitListing = async (e) => {
        e.preventDefault();
        setSubmitError(null);
        setSubmitStatus('Submitting…');
        try {
            const payload = {
                ...submitForm,
                tags: submitForm.tags.split(',').map(t => t.trim()).filter(Boolean)
            };
            await MarketplaceApi.createListing(payload);
            setSubmitStatus('Submitted! An admin will review it shortly.');
            setTimeout(() => {
                closeSubmitOverlay();
                fetchApis();
            }, 1200);
        } catch (err) {
            setSubmitError(err.message || 'Failed to submit');
            setSubmitStatus(null);
        }
    };

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
        setError(null);
        if (abortRef.current) {
            abortRef.current.abort();
        }
        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const categoryParam = selectedCategory === 'All' ? '' : selectedCategory;
            const data = await MarketplaceApi.searchListings({
                query: searchQuery,
                category: categoryParam,
                tags: selectedTags.join(','),
                sort: sortBy,
                page,
                limit: 24,
                signal: controller.signal
            });

            setApis(data.results || []);
            setTotalPages(Math.max(1, data.totalPages || 1));
        } catch (err) {
            if (err.name === 'AbortError') return;
            console.error('Failed to fetch APIs:', err);
            setError(err.message || 'Failed to load APIs. Please try again.');
        } finally {
            if (abortRef.current === controller) {
                abortRef.current = null;
            }
            setLoading(false);
        }
    }, [searchQuery, selectedCategory, selectedTags, sortBy, page]);

    // Fetch categories, tags, and current user on mount
    useEffect(() => {
        fetchCategories();
        fetchTags();
        fetchUser();
    }, []);

    // Fetch APIs when search params change
    useEffect(() => {
        fetchApis();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [fetchApis]);

    const fetchCategories = async () => {
        try {
            const data = await MarketplaceApi.listCategories();
            const total = data.reduce((sum, c) => sum + (c.count || 0), 0);
            setCategories([{ name: 'All', count: total }, ...data]);
        } catch (error) {
            console.error('Failed to fetch categories:', error);
            setError(error.message || 'Failed to load categories.');
        }
    };

    const fetchTags = async () => {
        try {
            const data = await MarketplaceApi.listTags();
            setTags(data.slice(0, 20)); // Show top 20 tags
        } catch (error) {
            console.error('Failed to fetch tags:', error);
        }
    };

    const fetchUser = async () => {
        try {
            const res = await fetch('/api/auth/check', { credentials: 'include' });
            const data = await res.json();
            if (data.isAuthenticated) setUser(data.user);
        } catch (error) {
            console.error('Failed to fetch user:', error);
        }
    };

    const debouncedSetSearch = useCallback(
        debounce((value) => setSearchQuery(value), 250),
        []
    );

    const retry = () => {
        fetchApis();
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
        setSearchInput('');
        setSelectedCategory('All');
        setSelectedTags([]);
        setSortBy('popular');
        setPage(1);
        setError(null);
    };

    const openApiDetail = (api, tab = 'overview') => {
        setSelectedApi(api);
        setModalInitialTab(tab);
        setShowApiModal(true);
    };

    const closeApiModal = () => {
        setShowApiModal(false);
        setSelectedApi(null);
    };

    const formatRating = (r) => (r == null ? '—' : Number(r).toFixed(1));

    const visibleCategories = useMemo(() => {
        if (showAllCategories || categories.length <= 12) return categories;

        const selected = categories.find((category) => category.name === selectedCategory);
        const compact = categories.slice(0, 12);
        if (selected && !compact.some((category) => category.name === selected.name)) {
            return [...compact.slice(0, 11), selected];
        }
        return compact;
    }, [categories, selectedCategory, showAllCategories]);

    return (
        <div className="explore-page">
            {/* Header */}
            <div className="explore-header">
                <div className="header-content">
                    <span className="eyebrow">MARKETPLACE</span>
                    <h1>Explore APIs</h1>
                    <p>Discover, test, and integrate thousands of public APIs directly in your workspace</p>
                </div>
                <div className="explore-header-actions">
                    {user && (
                        <button className="submit-api-button" onClick={() => setShowSubmit(true)}>
                            <Plus size={16} /> Submit API
                        </button>
                    )}
                    {user?.role === 'admin' && (
                        <button className="btn-link" onClick={() => window.location.href = '/workspace/api-network/explore/moderate'}>
                            <ShieldCheck size={16} /> Moderate
                        </button>
                    )}
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
                            value={searchInput}
                            onChange={(e) => {
                                const value = e.target.value;
                                setSearchInput(value);
                                debouncedSetSearch(value);
                                setPage(1);
                            }}
                            className="search-input"
                        />
                        {searchInput && (
                            <button
                                className="clear-search"
                                onClick={() => {
                                    setSearchInput('');
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

            {/* Row 2: compact category strip */}
            <div className={`category-filter-bar ${showAllCategories ? 'is-expanded' : ''}`}>
                <div className="category-filter-heading">
                    <span>Categories</span>
                    {categories.length > 12 && (
                        <button
                            type="button"
                            className="category-expand-btn"
                            onClick={() => setShowAllCategories((visible) => !visible)}
                            aria-expanded={showAllCategories}
                        >
                            {showAllCategories ? 'Show less' : `All categories (${categories.length - 1})`}
                            <ChevronDown size={14} />
                        </button>
                    )}
                </div>
                <div className="category-chips" role="tablist" aria-label="Filter by category">
                    {visibleCategories.map(category => (
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
            </div>

            <div className="explore-body">
                {/* Sidebar Filters */}
                {showFilters && (
                    <aside className="filters-sidebar">
                        <div className="filter-section">
                            {/* Tags */}
                            <div className="filter-group">
                                <div className="filter-group-heading">
                                    <label className="filter-label">Tags</label>
                                    {(selectedCategory !== 'All' || selectedTags.length > 0) && (
                                        <button className="clear-filters-btn" onClick={clearFilters}>
                                            Clear all
                                        </button>
                                    )}
                                </div>
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
                                    <button onClick={() => { setSearchQuery(''); setSearchInput(''); setPage(1); }}>
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

                    {error && !loading && (
                        <div className="explore-error" role="alert">
                            <span>{error}</span>
                            <button className="empty-btn" onClick={retry}>Retry</button>
                        </div>
                    )}

                    {/* APIs Grid */}
                    {loading && page === 1 ? (
                        <div className="apis-grid">
                            {Array.from({ length: 24 }).map((_, i) => (
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
                                        style={{ '--i': i % 24 }}
                                        onClick={() => openApiDetail(api)}
                                    >
                                        {/* Card Top: Identity + rating chip */}
                                        <div className="api-card-head">
                                            <div className="api-icon">
                                                {api.logo ? (
                                                    <>
                                                        <img
                                                            src={api.logo}
                                                            alt={api.name}
                                                            onError={(e) => {
                                                                e.target.style.display = 'none';
                                                                e.target.nextSibling.style.display = 'flex';
                                                            }}
                                                        />
                                                        <div className="api-icon-placeholder" style={{ display: 'none' }}>
                                                            {api.name.charAt(0)}
                                                        </div>
                                                    </>
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
                                            <div className="api-rating" title={`${formatRating(api.ratingAverage)} from ${api.ratingCount} ratings`}>
                                                <Star size={13} className="star-icon" fill="currentColor" />
                                                <span className="api-rating-value">{formatRating(api.ratingAverage)}</span>
                                            </div>
                                        </div>

                                        {/* Badges + category */}
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

                                        {/* Description */}
                                        <p className="api-description">{api.description}</p>

                                        {/* Technical meta chips */}
                                        <div className="api-tech-row">
                                            <span className="tech-badge">{api.authType}</span>
                                            <span className="tech-badge">{api.pricing}</span>
                                            <span className="api-rating-count">{api.ratingCount?.toLocaleString?.() ?? api.ratingCount} uses</span>
                                        </div>

                                        {/* Action row */}
                                        <div className="api-card-actions">
                                            <button
                                                className="card-action card-action-primary"
                                                onClick={(e) => { e.stopPropagation(); openApiDetail(api, 'tryit'); }}
                                            >
                                                <Play size={14} /> Try It
                                            </button>
                                            <button
                                                className="card-action"
                                                onClick={(e) => { e.stopPropagation(); openApiDetail(api, 'endpoints'); }}
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

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="pagination">
                                    <button
                                        className="page-btn"
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1 || loading}
                                    >
                                        Prev
                                    </button>
                                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                                        .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                                        .reduce((acc, n, i, arr) => {
                                            if (i > 0 && n - arr[i - 1] > 1) acc.push('...' + n);
                                            acc.push(n);
                                            return acc;
                                        }, [])
                                        .map(n => typeof n === 'string' ? (
                                            <span key={n} className="page-ellipsis">…</span>
                                        ) : (
                                            <button
                                                key={n}
                                                className={`page-btn ${n === page ? 'active' : ''}`}
                                                onClick={() => setPage(n)}
                                                disabled={loading}
                                            >
                                                {n}
                                            </button>
                                        ))}
                                    <button
                                        className="page-btn"
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        disabled={page === totalPages || loading}
                                    >
                                        Next
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
                    initialTab={modalInitialTab}
                    onClose={closeApiModal}
                />
            )}

            {/* Submit API Overlay */}
            {showSubmit && (
                <div className="submit-overlay-backdrop" onClick={(e) => { if (e.target === e.currentTarget) closeSubmitOverlay(); }}>
                    <div className="submit-overlay-panel">
                        <div className="submit-overlay-header">
                            <h2>Submit an API</h2>
                            <button className="submit-overlay-close" onClick={closeSubmitOverlay} aria-label="Close">
                                <X size={20} />
                            </button>
                        </div>
                        <p className="submit-overlay-subtitle">Your submission will be reviewed by an admin before it appears in the marketplace.</p>
                        <form onSubmit={onSubmitListing} className="submit-overlay-form" aria-label="Submit listing">
                            <div className="form-row">
                                <label>Name<input value={submitForm.name} onChange={e => setSubmitField('name', e.target.value)} required placeholder="e.g. Weather API" /></label>
                                <label>Provider<input value={submitForm.provider} onChange={e => setSubmitField('provider', e.target.value)} required placeholder="e.g. OpenWeather" /></label>
                            </div>
                            <div className="form-row">
                                <label>Category<input value={submitForm.category} onChange={e => setSubmitField('category', e.target.value)} required placeholder="e.g. Weather" /></label>
                                <label>Base URL<input type="url" value={submitForm.baseUrl} onChange={e => setSubmitField('baseUrl', e.target.value)} required placeholder="https://api.example.com" /></label>
                            </div>
                            <div className="form-row">
                                <label>Auth type
                                    <AppSelect
                                        value={submitForm.authType}
                                        onChange={(v) => setSubmitField('authType', v)}
                                        options={[
                                            { value: 'None', label: 'None' },
                                            { value: 'API Key', label: 'API Key' },
                                            { value: 'OAuth2', label: 'OAuth2' },
                                            { value: 'Bearer', label: 'Bearer' }
                                        ]}
                                    />
                                </label>
                                <label>Pricing
                                    <AppSelect
                                        value={submitForm.pricing}
                                        onChange={(v) => setSubmitField('pricing', v)}
                                        options={[
                                            { value: 'Free', label: 'Free' },
                                            { value: 'Freemium', label: 'Freemium' },
                                            { value: 'Paid', label: 'Paid' }
                                        ]}
                                    />
                                </label>
                            </div>
                            <label>Tags (comma separated)<input value={submitForm.tags} onChange={e => setSubmitField('tags', e.target.value)} placeholder="rest, weather, public" /></label>
                            <label>Description<textarea value={submitForm.description} onChange={e => setSubmitField('description', e.target.value)} rows={4} required placeholder="Briefly describe what this API does" /></label>

                            {submitError && <div className="submit-overlay-error">{submitError}</div>}
                            {submitStatus && <div className="submit-overlay-status">{submitStatus}</div>}

                            <div className="submit-overlay-actions">
                                <button className="btn-primary" type="submit">Submit for review</button>
                                <button className="btn-link" type="button" onClick={closeSubmitOverlay}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExplorePage;
