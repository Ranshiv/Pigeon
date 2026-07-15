import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './Marketplace.css';
import { MarketplaceApi } from './MarketplaceApi';

const MarketplaceThreadDetail = ({ basePath = '/marketplace' }) => {
    const navigate = useNavigate();
    const { listingId, threadId } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [reply, setReply] = useState('');

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                setLoading(true);
                setError(null);
                const d = await MarketplaceApi.getThread(threadId);
                if (!mounted) return;
                setData(d);
            } catch (e) {
                if (!mounted) return;
                setError(e.message || 'Failed to load thread');
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, [threadId]);

    const onReply = async (e) => {
        e.preventDefault();
        try {
            await MarketplaceApi.createPost(threadId, { listingId, body: reply });
            setReply('');
            setData(await MarketplaceApi.getThread(threadId));
        } catch (e2) {
            alert(e2.message || 'Failed to post');
        }
    };

    return (
        <div className="marketplace-page">
            <header className="marketplace-header">
                <h1>Forum thread</h1>
                <p>Community Q&A for this API.</p>
            </header>

            <section className="marketplace-surface">
                <div className="marketplace-panel">
                    <div className="marketplace-actions" style={{ marginBottom: 12 }}>
                        <button className="btn-link" type="button" onClick={() => navigate(`${basePath}/listing/${listingId}`)}>Back to listing</button>
                    </div>

                    {loading ? (
                        <div className="empty-state">Loading…</div>
                    ) : error ? (
                        <div className="empty-state">{error}</div>
                    ) : (
                        <>
                            <div className="marketplace-card" style={{ marginBottom: 12 }}>
                                <h3>{data?.thread?.title}</h3>
                                <p>{data?.thread?.body}</p>
                            </div>

                            {(data?.posts || []).map(p => (
                                <div key={p._id} className="marketplace-card" style={{ marginBottom: 12 }}>
                                    <div className="marketplace-meta">
                                        <span>{new Date(p.createdAt).toLocaleString()}</span>
                                    </div>
                                    <p>{p.body}</p>
                                </div>
                            ))}

                            <form onSubmit={onReply} className="marketplace-card" aria-label="Reply">
                                <h3>Reply</h3>
                                <textarea
                                    value={reply}
                                    onChange={(e) => setReply(e.target.value)}
                                    rows={4}
                                    placeholder="Write a reply…"
                                    aria-label="Reply text"
                                />
                                <div className="marketplace-actions">
                                    <button className="btn-primary-compact" type="submit">Post reply</button>
                                </div>
                            </form>
                        </>
                    )}
                </div>
            </section>
        </div>
    );
};

export default MarketplaceThreadDetail;
