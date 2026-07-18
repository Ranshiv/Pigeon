import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ExternalLink, BookOpen, Code, Play, Copy, Check, Star, TrendingUp, MessageSquare, Book, Activity, Users, ArrowLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import TryItConsole from './TryItConsole';
import { MarketplaceApi } from './MarketplaceApi';
import './ApiDetailModal.css';

const TAB_ORDER = ['overview', 'tryit', 'endpoints', 'reviews', 'forums', 'guides', 'health'];

const ApiDetailModal = ({ api, onClose }) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [selectedEndpoint, setSelectedEndpoint] = useState(api.endpoints[0] || null);
    const [copied, setCopied] = useState(false);

    // Data states for new tabs
    const [reviews, setReviews] = useState(null);
    const [threads, setThreads] = useState(null);
    const [guides, setGuides] = useState(null);
    const [selectedGuide, setSelectedGuide] = useState(null);
    const [health, setHealth] = useState(null);
    const [tabLoading, setTabLoading] = useState({});
    const [tabError, setTabError] = useState({});
    const [showThreadForm, setShowThreadForm] = useState(false);
    const [reviewRating, setReviewRating] = useState(5);
    const [hoverRating, setHoverRating] = useState(0);

    const modalRef = useRef(null);
    const closeBtnRef = useRef(null);
    const lastFocusedRef = useRef(document.activeElement);

    const setLoading = useCallback((tab, loading) => {
        setTabLoading(prev => ({ ...prev, [tab]: loading }));
    }, []);
    const setError = useCallback((tab, err) => {
        setTabError(prev => ({ ...prev, [tab]: err?.message || String(err) }));
    }, []);

    // Focus trap helpers
    const getFocusable = () => {
        const node = modalRef.current;
        if (!node) return [];
        return Array.from(node.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )).filter(el => el.offsetParent !== null && !el.disabled);
    };

    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
            return;
        }
        if (e.key === 'Tab' && modalRef.current) {
            const focusable = getFocusable();
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }, [onClose]);

    useEffect(() => {
        lastFocusedRef.current = document.activeElement;
        closeBtnRef.current?.focus();
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            lastFocusedRef.current?.focus?.();
        };
    }, [handleKeyDown]);

    // Fetch data when tab changes
    useEffect(() => {
        const fetchData = async () => {
            const handlers = {
                reviews: async () => setReviews(await MarketplaceApi.getReviews(api.id)),
                forums: async () => setThreads(await MarketplaceApi.listThreads(api.id)),
                guides: async () => setGuides(await MarketplaceApi.getGuides(api.id)),
                health: async () => setHealth(await MarketplaceApi.getHealth(api.id))
            };
            const fetcher = handlers[activeTab];
            if (!fetcher) return;
            setLoading(activeTab, true);
            setError(activeTab, null);
            try {
                await fetcher();
            } catch (e) {
                console.error(e);
                setError(activeTab, e);
            } finally {
                setLoading(activeTab, false);
            }
        };
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, api.id]);

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSaveRequest = async (requestData) => {
        try {
            const res = await fetch('/api/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    name: `${api.name} - ${requestData.method} ${requestData.path}`,
                    method: requestData.method,
                    url: requestData.url,
                    headers: requestData.headers,
                    body: requestData.body,
                    queryParams: requestData.queryParams,
                    description: `${api.name} API request`,
                    collection: null
                })
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.message || `Failed to save request (${res.status})`);
            }
            alert('Request saved successfully!');
        } catch (error) {
            console.error('Save request error:', error);
            alert(error.message || 'Failed to save request. Please try again.');
        }
    };

    const titleId = `api-detail-title-${api.id}`;

    return (
        <div className="modal-overlay" onClick={onClose} role="presentation">
            <div
                ref={modalRef}
                className="api-detail-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Tab rail — sits left of the form */}
                <nav className="modal-tabs-vertical" role="tablist" aria-label="API details">
                    <div className="tabs-wrapper-vertical">
                        {TAB_ORDER.map(tab => {
                            const Icon = {
                                overview: BookOpen,
                                tryit: Play,
                                endpoints: Code,
                                reviews: Star,
                                forums: Users,
                                guides: Book,
                                health: Activity
                            }[tab];
                            const label = {
                                overview: 'Overview',
                                tryit: 'Try It',
                                endpoints: 'Endpoints',
                                reviews: 'Reviews',
                                forums: 'Forums',
                                guides: 'Guides',
                                health: 'Health'
                            }[tab];
                            const isActive = activeTab === tab;
                            return (
                                <button
                                    key={tab}
                                    className={`tab-btn-vertical ${isActive ? 'active' : ''}`}
                                    role="tab"
                                    aria-selected={isActive}
                                    aria-controls={`api-tabpanel-${tab}`}
                                    id={`api-tab-${tab}`}
                                    title={label}
                                    aria-label={label}
                                    onClick={() => setActiveTab(tab)}
                                >
                                    <Icon size={20} />
                                    {isActive && <span className="tab-label">{label}</span>}
                                </button>
                            );
                        })}
                    </div>
                </nav>

                {/* Form column: header + body */}
                <div className="modal-form">
                {/* Modal Header */}
                <div className="modal-header">
                    <div className="header-main-content">
                        <div className="api-icon-large">
                            {api.logo ? (
                                <img src={api.logo} alt={api.name} />
                            ) : (
                                <div className="api-icon-placeholder-large">
                                    {api.name.charAt(0)}
                                </div>
                            )}
                        </div>
                        <div className="header-details">
                            <div className="title-row">
                                <h2 id={titleId}>{api.name}</h2>
                                <div className="badges-wrapper">
                                    {api.featured && (
                                        <span className="badge badge-featured">
                                            <Star size={12} fill="currentColor" />
                                            Featured
                                        </span>
                                    )}
                                    {api.trending && (
                                        <span className="badge badge-trending">
                                            <TrendingUp size={12} />
                                            Trending
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="meta-row">
                                <span className="provider-info">by <strong>{api.provider}</strong></span>
                                <span className="dot-divider">•</span>
                                <div className="meta-stats">
                                    <span className="stat-pill rating-stat">
                                        <Star size={14} fill="var(--warning-color)" color="var(--warning-color)" />
                                        <span>{api.ratingAverage}</span>
                                        <span className="stat-sub">({api.ratingCount})</span>
                                    </span>
                                    <span className="stat-pill">
                                        {(api.usageCount ?? 0).toLocaleString()} uses
                                    </span>
                                    <span className="stat-pill category-pill">
                                        {api.category}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <button ref={closeBtnRef} className="close-btn" onClick={onClose} aria-label="Close modal">
                        <X size={24} />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="modal-body">
                    {/* Overview Tab */}
                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <div
                            className="overview-tab"
                            role="tabpanel"
                            id="api-tabpanel-overview"
                            aria-labelledby="api-tab-overview"
                        >
                            <div className="overview-main">
                                <section className="overview-card description-card">
                                    <h3>About this API</h3>
                                    <p>{api.description}</p>

                                    {api.documentation && (
                                        <div className="doc-section">
                                            <a
                                                href={api.documentation}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="doc-link"
                                            >
                                                View Official Documentation
                                                <ExternalLink size={16} />
                                            </a>
                                        </div>
                                    )}
                                </section>

                                <section className="overview-card endpoints-preview-card">
                                    <div className="card-header-row">
                                        <h3>Popular Endpoints</h3>
                                        <button
                                            className="view-all-btn"
                                            onClick={() => setActiveTab('endpoints')}
                                        >
                                            View All
                                        </button>
                                    </div>
                                    <div className="mini-endpoints-list">
                                        {api.endpoints.slice(0, 3).map((ep, i) => (
                                            <div key={i} className="mini-endpoint-item">
                                                <span className={`method-badge-mini method-${ep.method.toLowerCase()}`}>
                                                    {ep.method}
                                                </span>
                                                <code className="mini-path">{ep.path}</code>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </div>

                            <aside className="overview-sidebar">
                                <section className="overview-card info-card">
                                    <h3>API Details</h3>
                                    <div className="info-list">
                                        <div className="info-row">
                                            <span className="info-label">Base URL</span>
                                            <div className="url-copy-row">
                                                <code title={api.baseUrl}>{api.baseUrl}</code>
                                                <button
                                                    className="icon-btn-small"
                                                    onClick={() => copyToClipboard(api.baseUrl)}
                                                    title="Copy base URL"
                                                >
                                                    {copied ? <Check size={14} /> : <Copy size={14} />}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="separator" />

                                        <div className="info-row">
                                            <span className="info-label">Authentication</span>
                                            <span className="info-badge-outline" style={{
                                                borderColor: getAuthColor(api.authType),
                                                color: getAuthColor(api.authType)
                                            }}>
                                                {api.authType}
                                            </span>
                                        </div>

                                        <div className="info-row">
                                            <span className="info-label">Pricing</span>
                                            <span className="info-badge-outline" style={{
                                                borderColor: getPricingColor(api.pricing),
                                                color: getPricingColor(api.pricing)
                                            }}>
                                                {api.pricing}
                                            </span>
                                        </div>

                                        <div className="info-row">
                                            <span className="info-label">Category</span>
                                            <span className="info-text">{api.category}</span>
                                        </div>

                                        <div className="info-row">
                                            <span className="info-label">Rating</span>
                                            <span className="rating-row">
                                                <Star size={14} style={{ fill: 'var(--warning-color)', color: 'var(--warning-color)' }} />
                                                <span>{api.ratingAverage ?? '—'}</span>
                                                <span className="rating-count">({api.ratingCount ?? 0})</span>
                                            </span>
                                        </div>
                                    </div>
                                </section>

                                <section className="overview-card tags-card">
                                    <h3>Tags</h3>
                                    <div className="tags-cloud">
                                        {api.tags.map(tag => (
                                            <span key={tag} className="tag-pill-modern">{tag}</span>
                                        ))}
                                    </div>
                                </section>
                            </aside>
                        </div>
                    )}

                    {/* Try It Tab */}
                    {activeTab === 'tryit' && (
                        <div
                            className="tryit-tab"
                            role="tabpanel"
                            id="api-tabpanel-tryit"
                            aria-labelledby="api-tab-tryit"
                        >
                            <TryItConsole
                                api={api}
                                selectedEndpoint={selectedEndpoint}
                                onEndpointChange={setSelectedEndpoint}
                                onSaveRequest={handleSaveRequest}
                            />
                        </div>
                    )}

                    {/* Endpoints Tab */}
                    {activeTab === 'endpoints' && (
                        <div
                            className="endpoints-tab"
                            role="tabpanel"
                            id="api-tabpanel-endpoints"
                            aria-labelledby="api-tab-endpoints"
                        >
                            <div className="endpoints-header-row">
                                <h3>Available Endpoints</h3>
                                <span className="endpoint-count">{api.endpoints.length} endpoints</span>
                            </div>

                            <div className="endpoints-list">
                                {api.endpoints.map((endpoint, index) => (
                                    <div key={index} className="endpoint-card-modern">
                                        <div className="endpoint-primary-row">
                                            <div className="endpoint-info-group">
                                                <span className={`method-badge-large method-${endpoint.method.toLowerCase()}`}>
                                                    {endpoint.method}
                                                </span>
                                                <div className="path-container">
                                                    <code className="endpoint-path-large">{endpoint.path}</code>
                                                    <span className="endpoint-summary">{endpoint.description}</span>
                                                </div>
                                            </div>
                                            <button
                                                className="btn-try-modern"
                                                onClick={() => {
                                                    setSelectedEndpoint(endpoint);
                                                    setActiveTab('tryit');
                                                }}
                                            >
                                                <Play size={16} fill="currentColor" />
                                                <span>Try It</span>
                                            </button>
                                        </div>

                                        {(endpoint.parameters?.length > 0 || endpoint.body) && (
                                            <div className="endpoint-details-modern">
                                                {endpoint.parameters?.length > 0 && (
                                                    <div className="params-section-modern">
                                                        <h4>Parameters</h4>
                                                        <div className="params-table">
                                                            <div className="params-header">
                                                                <span>Name</span>
                                                                <span>Type</span>
                                                                <span>Description</span>
                                                            </div>
                                                            {endpoint.parameters.map((param, idx) => (
                                                                <div key={idx} className="params-row-modern">
                                                                    <div className="param-cell-name">
                                                                        <code className="param-name-code">{param.name}</code>
                                                                        {param.required && <span className="req-dot" title="Required">•</span>}
                                                                    </div>
                                                                    <div className="param-cell-type">
                                                                        <span className="type-badge">{param.type}</span>
                                                                    </div>
                                                                    <div className="param-cell-desc">
                                                                        {param.description || '-'}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {endpoint.body && (
                                                    <div className="body-section-modern">
                                                        <h4>Request Body</h4>
                                                        <div className="body-snippet">
                                                            <pre>{JSON.stringify(endpoint.body, null, 2)}</pre>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Reviews Tab */}
                    {activeTab === 'reviews' && (
                        <div
                            className="reviews-tab"
                            role="tabpanel"
                            id="api-tabpanel-reviews"
                            aria-labelledby="api-tab-reviews"
                        >
                            <div className="write-review-section">
                                <h3>Write a Review</h3>
                                <form onSubmit={async (e) => {
                                    e.preventDefault();
                                    const form = e.target;
                                    const rating = reviewRating;
                                    const title = form.title.value;
                                    const body = form.body.value;
                                    try {
                                        await MarketplaceApi.submitReview(api.id, { rating: parseInt(rating), title, body });
                                        setReviews(await MarketplaceApi.getReviews(api.id)); // Refresh
                                        form.reset();
                                        setReviewRating(5);
                                    } catch (err) { alert(err.message || 'Error'); }
                                }}>
                                    <div className="review-form-grid">
                                        <div className="form-group">
                                            <label>Rating</label>
                                            <div className="star-rating-input">
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <button
                                                        type="button"
                                                        key={star}
                                                        className="star-btn"
                                                        onClick={() => setReviewRating(star)}
                                                        onMouseEnter={() => setHoverRating(star)}
                                                        onMouseLeave={() => setHoverRating(0)}
                                                    >
                                                        <Star
                                                            size={28}
                                                            fill={star <= (hoverRating || reviewRating) ? "#FFB02E" : "none"}
                                                            color={star <= (hoverRating || reviewRating) ? "#FFB02E" : "var(--text-muted)"}
                                                            strokeWidth={1.5}
                                                        />
                                                    </button>
                                                ))}
                                                <span className="rating-label-text">
                                                    {(hoverRating || reviewRating) === 1 ? 'Terrible' :
                                                        (hoverRating || reviewRating) === 2 ? 'Poor' :
                                                            (hoverRating || reviewRating) === 3 ? 'Average' :
                                                                (hoverRating || reviewRating) === 4 ? 'Very Good' : 'Excellent'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label>Title</label>
                                            <input name="title" placeholder="Summarize your experience" required className="modal-input review-input" />
                                        </div>
                                        <div className="form-group full-width">
                                            <label>Review</label>
                                            <textarea name="body" placeholder="What did you like or dislike? How was the API performance?" rows={4} required className="modal-input review-textarea" />
                                        </div>
                                        <div className="form-actions">
                                            <button type="submit" className="btn-primary-compact">Submit Review</button>
                                        </div>
                                    </div>
                                </form>
                            </div>

                            {tabLoading.reviews ? <div className="loading-state">Loading reviews...</div> : tabError.reviews ? <div className="empty-state">{tabError.reviews}</div> : !reviews ? <div className="empty-state">No reviews loaded.</div> : (
                                <div className="reviews-list-container">

                                    <div className="reviews-list">
                                        {(!reviews.items || reviews.items.length === 0) ? (
                                            <div className="empty-reviews-placeholder">
                                                <MessageSquare size={32} />
                                                <p>No reviews yet. Be the first to share your experience!</p>
                                            </div>
                                        ) : (
                                            reviews.items.map(r => (
                                                <div key={r._id} className="review-card-modern">
                                                    <div className="review-header">
                                                        <div className="reviewer-info">
                                                            <div className="reviewer-avatar-placeholder">
                                                                {(r.userId?.displayName || 'U')[0].toUpperCase()}
                                                            </div>
                                                            <div className="reviewer-details">
                                                                <strong>{r.userId?.displayName || 'User'}</strong>
                                                                <span className="review-date">{new Date(r.createdAt).toLocaleDateString()}</span>
                                                            </div>
                                                        </div>
                                                        <div className="review-rating-badge">
                                                            <Star size={12} fill="#FFB02E" color="#FFB02E" />
                                                            <span>{r.rating}.0</span>
                                                        </div>
                                                    </div>
                                                    <h4 className="review-title-text">{r.title}</h4>
                                                    <p className="review-body-text">{r.body}</p>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Forums Tab */}
                    {activeTab === 'forums' && (
                        <div
                            className="forums-tab"
                            role="tabpanel"
                            id="api-tabpanel-forums"
                            aria-labelledby="api-tab-forums"
                        >
                            {!showThreadForm ? (
                                <div className="marketplace-card" style={{ marginBottom: 20 }}>
                                    <button className="btn-primary-compact" onClick={() => setShowThreadForm(true)}>
                                        + Start New Thread
                                    </button>
                                </div>
                            ) : (
                                <div className="write-review-section">
                                    <h3>Start a New Thread</h3>
                                    <form onSubmit={async (e) => {
                                        e.preventDefault();
                                        const form = e.target;
                                        const title = form.title.value;
                                        const body = form.body.value;

                                        try {
                                            await MarketplaceApi.createThread(api.id, { title, body });
                                            setThreads(await MarketplaceApi.listThreads(api.id));
                                            setShowThreadForm(false);
                                        } catch (e) { alert(e.message); }
                                    }}>
                                        <div className="review-form-grid">
                                            <div className="form-group full-width">
                                                <label>Thread Title</label>
                                                <input name="title" placeholder="What is this discussion about?" required className="modal-input review-input" />
                                            </div>
                                            <div className="form-group full-width">
                                                <label>Initial Post</label>
                                                <textarea name="body" placeholder="Describe your question or topic..." rows={5} required className="modal-input review-textarea" />
                                            </div>
                                            <div className="form-actions" style={{ gap: '12px' }}>
                                                <button type="button" className="btn-secondary-compact" onClick={() => setShowThreadForm(false)}>Cancel</button>
                                                <button type="submit" className="btn-primary-compact">Post Thread</button>
                                            </div>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {tabLoading.forums ? <div>Loading...</div> : tabError.forums ? <div>{tabError.forums}</div> : !threads ? <div>No forums loaded.</div> : (
                                <div className="threads-list">
                                    {(threads.items || []).map(t => (
                                        <div key={t._id} className="thread-card-modern">
                                            <div className="thread-main">
                                                <h4>{t.title}</h4>
                                                <p>{t.body}</p>
                                            </div>
                                            <div className="thread-stats">
                                                <span>{t.replyCount} replies</span>
                                                <span>{t.views} views</span>
                                            </div>
                                        </div>
                                    ))}
                                    {(threads.items || []).length === 0 && <div className="empty-text">No threads yet.</div>}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Guides Tab */}
                    {activeTab === 'guides' && (
                        <div
                            className="guides-tab"
                            role="tabpanel"
                            id="api-tabpanel-guides"
                            aria-labelledby="api-tab-guides"
                        >
                            {tabLoading.guides ? <div>Loading...</div> : tabError.guides ? <div>{tabError.guides}</div> : !guides ? <div>No guides loaded.</div> : (
                                <>
                                    {!selectedGuide ? (
                                        <div className="guides-list">
                                            {guides.length === 0 ? <div className="empty-text">No guides available.</div> : (
                                                guides.map(g => (
                                                    <div key={g._id} className="guide-card-modern">
                                                        <h4>{g.title}</h4>
                                                        <p>{g.summary}</p>
                                                        <button
                                                            className="btn-secondary-compact"
                                                            onClick={async () => {
                                                                setLoading('guideDetail', true);
                                                                setError('guideDetail', null);
                                                                try {
                                                                    const fullGuide = await MarketplaceApi.getGuide(api.id, g.slug);
                                                                    setSelectedGuide(fullGuide);
                                                                } catch (err) {
                                                                    console.error(err);
                                                                    setError('guideDetail', err.message || 'Failed to load guide details');
                                                                }
                                                                setLoading('guideDetail', false);
                                                            }}
                                                        >
                                                            Read Guide
                                                        </button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    ) : (
                                        <div className="guide-detail-view">
                                            <button
                                                className="btn-text-back"
                                                onClick={() => setSelectedGuide(null)}
                                            >
                                                <ArrowLeft size={16} />
                                                Back to Guides
                                            </button>
                                            <div className="guide-content-wrapper">
                                                <h1 className="guide-title">{selectedGuide.title}</h1>
                                                <div className="guide-meta">
                                                    <span>Last updated: {new Date(selectedGuide.updatedAt || selectedGuide.createdAt).toLocaleDateString()}</span>
                                                </div>
                                                <div className="markdown-body">
                                                    {tabError.guideDetail ? <div className="empty-text">{tabError.guideDetail}</div> : (
                                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                            {selectedGuide.contentMarkdown}
                                                        </ReactMarkdown>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* Health Tab */}
                    {activeTab === 'health' && (
                        <div
                            className="health-tab"
                            role="tabpanel"
                            id="api-tabpanel-health"
                            aria-labelledby="api-tab-health"
                        >
                            {tabLoading.health ? <div>Loading...</div> : tabError.health ? <div>{tabError.health}</div> : !health ? <div>Health data unavailable.</div> : (
                                <div className="health-dashboard">
                                    <div className="health-score-card">
                                        <div className="score-circle" style={{ borderColor: health.current?.status === 'operational' ? 'var(--success-color)' : 'var(--warning-color)' }}>
                                            <span className="score-val">{health.current?.score}</span>
                                            <span className="score-label">Score</span>
                                        </div>
                                        <div className="score-details">
                                            <div className="score-row">
                                                <span>Status:</span>
                                                <span className={`status-badge status-${health.current?.status}`}>
                                                    {health.current?.status}
                                                </span>
                                            </div>
                                            <div className="score-row">
                                                <span>Uptime:</span>
                                                <strong>{health.current?.factors?.uptimePercent}%</strong>
                                            </div>
                                            <div className="score-row">
                                                <span>Latency:</span>
                                                <strong>{health.current?.factors?.avgResponseTimeMs}ms</strong>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="health-history-graph">
                                        <h4>7-Day History</h4>
                                        <div className="history-bars">
                                            {health.history?.map((day, i) => (
                                                <div key={i} className="history-bar-col" title={`${new Date(day.date).toLocaleDateString()}: ${day.score}`}>
                                                    <div
                                                        className="history-bar"
                                                        style={{ height: `${day.score}%`, background: day.score > 90 ? 'var(--success-color)' : 'var(--warning-color)' }}
                                                    />
                                                    <span className="history-date">{new Date(day.date).getDate()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    </div>{/* /.modal-body */}
                </div>{/* /.modal-form */}
            </div>
        </div>
    );
};

// Helper functions
const getAuthColor = (authType) => {
    switch (authType) {
        case 'None': return 'var(--success-color)';
        case 'API Key': return 'var(--info-color)';
        case 'OAuth 2.0': return 'var(--warning-color)';
        default: return 'var(--text-secondary)';
    }
};

const getPricingColor = (pricing) => {
    switch (pricing) {
        case 'Free': return 'var(--success-color)';
        case 'Freemium': return 'var(--info-color)';
        case 'Paid': return 'var(--warning-color)';
        default: return 'var(--text-secondary)';
    }
};

export default ApiDetailModal;
