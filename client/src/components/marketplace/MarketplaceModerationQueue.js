import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Marketplace.css';
import { MarketplaceApi } from './MarketplaceApi';

const MarketplaceModerationQueue = () => {
    const navigate = useNavigate();
    const [pending, setPending] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchPending = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await MarketplaceApi.listPendingListings();
            setPending(Array.isArray(data) ? data : data.results || []);
        } catch (e) {
            setError(e.message || 'Failed to load pending submissions');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPending();
    }, []);

    const moderate = async (id, action) => {
        try {
            await MarketplaceApi.moderateListing(id, action);
            setPending(prev => prev.filter(item => item.id !== id && item._id !== id));
        } catch (e) {
            setError(e.message || `Failed to ${action}`);
        }
    };

    if (loading) return <div className="marketplace-page"><div className="empty-state">Loading moderation queue…</div></div>;

    return (
        <div className="marketplace-page">
            <header className="marketplace-header">
                <h1>Moderation queue</h1>
                <p>Review pending API submissions and approve or reject them.</p>
            </header>

            <section className="marketplace-surface">
                {error && <div className="empty-state" style={{ color: 'var(--danger-text)' }}>{error}</div>}
                {pending.length === 0 ? (
                    <div className="empty-state">No pending submissions.</div>
                ) : (
                    <div className="marketplace-grid">
                        {pending.map(item => (
                            <div key={item.id || item._id} className="marketplace-card">
                                <h3>{item.name}</h3>
                                <p><strong>Provider:</strong> {item.provider}</p>
                                <p><strong>Category:</strong> {item.category}</p>
                                <p><strong>Base URL:</strong> {item.baseUrl}</p>
                                <p>{item.description}</p>
                                <div className="marketplace-actions">
                                    <button className="btn-primary-compact" onClick={() => moderate(item.id || item._id, 'approve')}>Approve</button>
                                    <button className="btn-link" style={{ color: 'var(--danger-text)' }} onClick={() => moderate(item.id || item._id, 'reject')}>Reject</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                <div className="marketplace-actions" style={{ padding: 16 }}>
                    <button className="btn-link" onClick={() => navigate('/workspace/api-network/explore')}>Back to explore</button>
                </div>
            </section>
        </div>
    );
};

export default MarketplaceModerationQueue;
