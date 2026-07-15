import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import './Marketplace.css';
import { MarketplaceApi } from './MarketplaceApi';

const MarketplaceCategoryResults = ({ basePath = '/marketplace', mode = 'category' }) => {
    const navigate = useNavigate();
    const params = useParams();
    const [searchParams] = useSearchParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const id = mode === 'tag' ? params.tagId : params.categoryId;
    const q = searchParams.get('q') || '';

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                setLoading(true);
                setError(null);
                const res = await MarketplaceApi.browseListings({
                    query: q,
                    category: mode === 'category' ? id : '',
                    tag: mode === 'tag' ? id : '',
                    page: 1,
                    limit: 30
                });
                if (!mounted) return;
                setData(res);
            } catch (e) {
                if (!mounted) return;
                setError(e.message || 'Failed to load results');
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, [id, q, mode]);

    return (
        <div className="marketplace-page">
            <header className="marketplace-header">
                <h1>{mode === 'tag' ? 'Tag results' : 'Category results'}</h1>
                <p>Browse matching listings. Use search to narrow down.</p>
            </header>

            <section className="marketplace-surface">
                {loading ? (
                    <div className="empty-state">Loading…</div>
                ) : error ? (
                    <div className="empty-state">{error}</div>
                ) : (
                    <div className="marketplace-grid">
                        {(data?.items || []).map(l => (
                            <div key={l._id} className="marketplace-card" role="article">
                                <h3>{l.name}</h3>
                                <p>{l.tagline || l.description || '—'}</p>
                                <div className="marketplace-meta">
                                    <span className="pill"><strong>{(l.rating?.averageRating || 0).toFixed(1)}</strong> / 5</span>
                                    <span className="pill"><strong>{l.rating?.totalRatings || 0}</strong> reviews</span>
                                </div>
                                <div className="marketplace-actions">
                                    <button className="btn-primary-compact" onClick={() => navigate(`${basePath}/listing/${l._id}`)} type="button">View</button>
                                </div>
                            </div>
                        ))}

                        {(!data?.items || data.items.length === 0) && (
                            <div className="empty-state">No listings found.</div>
                        )}
                    </div>
                )}
            </section>
        </div>
    );
};

export default MarketplaceCategoryResults;
