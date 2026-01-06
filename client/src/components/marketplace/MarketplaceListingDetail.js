import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './Marketplace.css';
import { MarketplaceApi } from './MarketplaceApi';

function TabButton({ id, activeId, onActivate, children }) {
    return (
        <button
            className="marketplace-tab"
            role="tab"
            id={`tab-${id}`}
            aria-controls={`panel-${id}`}
            aria-selected={activeId === id}
            tabIndex={activeId === id ? 0 : -1}
            type="button"
            onClick={() => onActivate(id)}
        >
            {children}
        </button>
    );
}

const MarketplaceListingDetail = ({ basePath = '/marketplace' }) => {
    const navigate = useNavigate();
    const { listingId } = useParams();
    const [activeTab, setActiveTab] = useState('overview');
    const [listing, setListing] = useState(null);
    const [reviews, setReviews] = useState(null);
    const [examples, setExamples] = useState(null);
    const [guides, setGuides] = useState(null);
    const [health, setHealth] = useState(null);
    const [plans, setPlans] = useState(null);
    const [threads, setThreads] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    const tabs = useMemo(() => ([
        { id: 'overview', label: 'Overview' },
        { id: 'examples', label: 'Examples' },
        { id: 'guides', label: 'Guides' },
        { id: 'reviews', label: 'Reviews' },
        { id: 'health', label: 'Health' },
        { id: 'pricing', label: 'Pricing' },
        { id: 'forums', label: 'Forums' }
    ]), []);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                setLoading(true);
                setError(null);
                const l = await MarketplaceApi.getListing(listingId);
                if (!mounted) return;
                setListing(l);
            } catch (e) {
                if (!mounted) return;
                setError(e.message || 'Failed to load listing');
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, [listingId]);

    useEffect(() => {
        // Lazy-load tab data.
        let mounted = true;
        (async () => {
            if (!listingId) return;
            try {
                if (activeTab === 'reviews' && !reviews) setReviews(await MarketplaceApi.getReviews(listingId));
                if (activeTab === 'examples' && !examples) setExamples(await MarketplaceApi.getExamples(listingId));
                if (activeTab === 'guides' && !guides) setGuides(await MarketplaceApi.getGuides(listingId));
                if (activeTab === 'health' && !health) setHealth(await MarketplaceApi.getHealth(listingId));
                if (activeTab === 'pricing' && !plans) setPlans(await MarketplaceApi.getPlans(listingId));
                if (activeTab === 'forums' && !threads) setThreads(await MarketplaceApi.listThreads(listingId));
            } catch (e) {
                if (!mounted) return;
                setError(e.message || 'Failed to load data');
            }
        })();
        return () => { mounted = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, listingId]);

    if (loading) {
        return (
            <div className="marketplace-page">
                <div className="marketplace-surface">
                    <div className="empty-state">Loading…</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="marketplace-page">
                <div className="marketplace-surface">
                    <div className="empty-state">{error}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="marketplace-page">
            <header className="marketplace-header">
                <h1>{listing?.name || 'Listing'}</h1>
                <p>{listing?.tagline || listing?.description || '—'}</p>
                <div className="marketplace-meta">
                    <span className="pill"><strong>{(listing?.rating?.averageRating || 0).toFixed(1)}</strong> / 5</span>
                    <span className="pill"><strong>{listing?.rating?.totalRatings || 0}</strong> reviews</span>
                    {listing?.documentationUrl ? (
                        <a className="pill" href={listing.documentationUrl} target="_blank" rel="noreferrer">Docs</a>
                    ) : null}
                    {listing?.websiteUrl ? (
                        <a className="pill" href={listing.websiteUrl} target="_blank" rel="noreferrer">Website</a>
                    ) : null}
                </div>
            </header>

            <section className="marketplace-surface" aria-label="Listing details">
                <div className="marketplace-tabs" role="tablist" aria-label="Listing sections">
                    {tabs.map(t => (
                        <TabButton key={t.id} id={t.id} activeId={activeTab} onActivate={setActiveTab}>
                            {t.label}
                        </TabButton>
                    ))}
                </div>

                <div className="marketplace-panel" role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
                    {activeTab === 'overview' && (
                        <div>
                            <p style={{ color: 'var(--text-secondary)' }}>{listing?.description || 'No description provided.'}</p>
                            <div className="marketplace-actions" style={{ marginTop: 16 }}>
                                <button className="btn-link" type="button" onClick={() => navigate(`${basePath}`)}>Back</button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'examples' && (
                        <div>
                            {!examples ? (
                                <div className="empty-state">Loading examples…</div>
                            ) : examples.length === 0 ? (
                                <div className="empty-state">No examples yet.</div>
                            ) : (
                                examples.map(ex => (
                                    <div key={ex._id} className="marketplace-card" style={{ marginBottom: 12 }}>
                                        <h3>{ex.title}</h3>
                                        <p>{ex.description || ''}</p>
                                        <pre style={{ whiteSpace: 'pre-wrap', background: 'var(--hover-background)', border: '1px solid var(--border-color)', padding: 12, borderRadius: 10, overflowX: 'auto' }}>
                                            {ex.code}
                                        </pre>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'guides' && (
                        <div>
                            {!guides ? (
                                <div className="empty-state">Loading guides…</div>
                            ) : guides.length === 0 ? (
                                <div className="empty-state">No guides yet.</div>
                            ) : (
                                guides.map(g => (
                                    <div key={g._id} className="marketplace-card" style={{ marginBottom: 12 }}>
                                        <h3>{g.title}</h3>
                                        <p>{g.summary || ''}</p>
                                        <div style={{ color: 'var(--text-secondary)' }}>
                                            {g.contentMarkdown ? (
                                                <pre style={{ whiteSpace: 'pre-wrap', background: 'var(--hover-background)', border: '1px solid var(--border-color)', padding: 12, borderRadius: 10, overflowX: 'auto' }}>{g.contentMarkdown}</pre>
                                            ) : (
                                                <span>Guide content will appear here once published.</span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'reviews' && (
                        <div>
                            {!reviews ? (
                                <div className="empty-state">Loading reviews…</div>
                            ) : (
                                <>
                                    <div className="marketplace-meta" style={{ marginBottom: 12 }}>
                                        <span className="pill"><strong>{(reviews.aggregate?.averageRating || 0).toFixed(1)}</strong> average</span>
                                        <span className="pill"><strong>{reviews.aggregate?.totalRatings || 0}</strong> total</span>
                                    </div>
                                    {(reviews.items || []).map(r => (
                                        <div key={r._id} className="marketplace-card" style={{ marginBottom: 12 }}>
                                            <h3>{r.title || 'Review'}</h3>
                                            <div className="marketplace-meta">
                                                <span className="pill"><strong>{r.rating}</strong> / 5</span>
                                                <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <p>{r.body || ''}</p>
                                        </div>
                                    ))}
                                    {(reviews.items || []).length === 0 && <div className="empty-state">No reviews yet.</div>}
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === 'health' && (
                        <div>
                            {!health ? (
                                <div className="empty-state">Loading health…</div>
                            ) : (
                                <div className="marketplace-card">
                                    <h3>Health score</h3>
                                    <div className="marketplace-meta">
                                        <span className="pill"><strong>{health.current?.score ?? '—'}</strong> / 100</span>
                                        <span>Updated: {health.current?.computedAt ? new Date(health.current.computedAt).toLocaleString() : '—'}</span>
                                    </div>

                                    <div style={{ marginTop: 10, color: 'var(--text-secondary)' }}>
                                        <p><strong>Factors</strong></p>
                                        <ul>
                                            <li>Uptime: {health.current?.factors?.uptimePercent?.toFixed?.(2) ?? '—'}%</li>
                                            <li>Avg response time: {health.current?.factors?.avgResponseTimeMs?.toFixed?.(0) ?? '—'} ms</li>
                                            <li>Incidents (window): {health.current?.factors?.incidentsCount ?? '—'} (open: {health.current?.factors?.openIncidentsCount ?? '—'})</li>
                                        </ul>
                                        {health.current?.factors?.notes ? <p>Note: {health.current.factors.notes}</p> : null}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'pricing' && (
                        <div>
                            {!plans ? (
                                <div className="empty-state">Loading pricing…</div>
                            ) : (
                                <>
                                    <div className="marketplace-meta" style={{ marginBottom: 12 }}>
                                        <span className="pill"><strong>Monetization</strong> {plans.enabled ? 'enabled' : 'framework-only'}</span>
                                    </div>
                                    {(plans.plans || []).map(p => (
                                        <div key={p._id} className="marketplace-card" style={{ marginBottom: 12 }}>
                                            <h3>{p.name}</h3>
                                            <p>{p.description || ''}</p>
                                            <div className="marketplace-meta">
                                                <span className="pill"><strong>{p.isFree ? 'Free' : `${p.currency} ${p.pricePerMonth}/mo`}</strong></span>
                                                {p.requiresEntitlement ? <span className="pill"><strong>Entitlement required</strong></span> : null}
                                            </div>
                                        </div>
                                    ))}
                                    {(plans.plans || []).length === 0 && <div className="empty-state">No plans published.</div>}
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === 'forums' && (
                        <div>
                            {!threads ? (
                                <div className="empty-state">Loading threads…</div>
                            ) : (
                                <>
                                    <div className="marketplace-actions" style={{ marginBottom: 12 }}>
                                        <button
                                            className="btn-primary-compact"
                                            type="button"
                                            onClick={async () => {
                                                try {
                                                    const title = prompt('Thread title');
                                                    if (!title) return;
                                                    const body = prompt('Thread body');
                                                    if (!body) return;
                                                    await MarketplaceApi.createThread(listingId, { title, body });
                                                    setThreads(await MarketplaceApi.listThreads(listingId));
                                                } catch (e) {
                                                    alert(e.message || 'Failed to create thread');
                                                }
                                            }}
                                        >
                                            New thread
                                        </button>
                                    </div>

                                    {(threads.items || []).map(t => (
                                        <div key={t._id} className="marketplace-card" style={{ marginBottom: 12 }}>
                                            <h3>{t.title}</h3>
                                            <p>{t.body || ''}</p>
                                            <div className="marketplace-actions">
                                                <button
                                                    className="btn-link"
                                                    type="button"
                                                    onClick={() => navigate(`${basePath}/listing/${listingId}/forums/thread/${t._id}`)}
                                                >
                                                    Open
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {(threads.items || []).length === 0 && <div className="empty-state">No threads yet.</div>}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default MarketplaceListingDetail;
