import React, { useState } from 'react';
import './Marketplace.css';
import { MarketplaceApi } from './MarketplaceApi';

const MarketplaceSubmitListing = () => {
    const [name, setName] = useState('');
    const [apiBundleId, setApiBundleId] = useState('');
    const [tagline, setTagline] = useState('');
    const [description, setDescription] = useState('');
    const [websiteUrl, setWebsiteUrl] = useState('');
    const [documentationUrl, setDocumentationUrl] = useState('');
    const [status, setStatus] = useState(null);
    const [error, setError] = useState(null);

    const onSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setStatus('Submitting…');
        try {
            const listing = await MarketplaceApi.createListing({
                name,
                apiBundleId,
                tagline,
                description,
                websiteUrl,
                documentationUrl
            });
            setStatus('Created draft. Publishing…');
            await MarketplaceApi.publishListing(listing._id);
            setStatus('Published! Your listing is now visible.');
        } catch (e2) {
            setError(e2.message || 'Failed to submit');
            setStatus(null);
        }
    };

    return (
        <div className="marketplace-page">
            <header className="marketplace-header">
                <h1>Submit a listing</h1>
                <p>This is the MVP submission flow. You’ll need an existing <code>ApiBundle</code> id for now.</p>
            </header>

            <section className="marketplace-surface">
                <div className="marketplace-panel">
                    <form onSubmit={onSubmit} className="marketplace-card" aria-label="Submit listing">
                        <label>
                            Name
                            <input value={name} onChange={(e) => setName(e.target.value)} required />
                        </label>

                        <label>
                            ApiBundle ID
                            <input value={apiBundleId} onChange={(e) => setApiBundleId(e.target.value)} required />
                        </label>

                        <label>
                            Tagline
                            <input value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={140} />
                        </label>

                        <label>
                            Description
                            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} />
                        </label>

                        <label>
                            Website URL
                            <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
                        </label>

                        <label>
                            Documentation URL
                            <input value={documentationUrl} onChange={(e) => setDocumentationUrl(e.target.value)} />
                        </label>

                        {error && <div className="empty-state" style={{ color: 'var(--danger-text)' }}>{error}</div>}
                        {status && <div className="empty-state" style={{ padding: 0, textAlign: 'left' }}>{status}</div>}

                        <div className="marketplace-actions">
                            <button className="btn-primary-compact" type="submit">Create & publish</button>
                        </div>
                    </form>
                </div>
            </section>
        </div>
    );
};

export default MarketplaceSubmitListing;
