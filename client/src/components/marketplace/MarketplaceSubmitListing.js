import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Marketplace.css';
import { MarketplaceApi } from './MarketplaceApi';

const MarketplaceSubmitListing = () => {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        name: '', provider: '', description: '', category: '', tags: '',
        authType: 'None', pricing: 'Free', baseUrl: ''
    });
    const [status, setStatus] = useState(null);
    const [error, setError] = useState(null);

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const onSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setStatus('Submitting…');
        try {
            const payload = {
                ...form,
                tags: form.tags.split(',').map(t => t.trim()).filter(Boolean)
            };
            await MarketplaceApi.createListing(payload);
            setStatus('Submitted! An admin will review it shortly.');
            setTimeout(() => navigate('/workspace/api-network/explore'), 1500);
        } catch (e2) {
            setError(e2.message || 'Failed to submit');
            setStatus(null);
        }
    };

    return (
        <div className="marketplace-page">
            <header className="marketplace-header">
                <h1>Submit an API</h1>
                <p>Your submission will be reviewed by an admin before it appears in the marketplace.</p>
            </header>

            <section className="marketplace-surface">
                <div className="marketplace-panel">
                    <form onSubmit={onSubmit} className="marketplace-card" aria-label="Submit listing">
                        <label>Name<input value={form.name} onChange={e => setField('name', e.target.value)} required /></label>
                        <label>Provider<input value={form.provider} onChange={e => setField('provider', e.target.value)} required /></label>
                        <label>Category<input value={form.category} onChange={e => setField('category', e.target.value)} required /></label>
                        <label>Base URL<input type="url" value={form.baseUrl} onChange={e => setField('baseUrl', e.target.value)} required placeholder="https://api.example.com" /></label>
                        <label>Auth type
                            <select value={form.authType} onChange={e => setField('authType', e.target.value)}>
                                <option>None</option><option>API Key</option><option>OAuth2</option><option>Bearer</option>
                            </select>
                        </label>
                        <label>Pricing
                            <select value={form.pricing} onChange={e => setField('pricing', e.target.value)}>
                                <option>Free</option><option>Freemium</option><option>Paid</option>
                            </select>
                        </label>
                        <label>Tags (comma separated)<input value={form.tags} onChange={e => setField('tags', e.target.value)} placeholder="rest, weather, public" /></label>
                        <label>Description<textarea value={form.description} onChange={e => setField('description', e.target.value)} rows={5} required /></label>

                        {error && <div className="empty-state" style={{ color: 'var(--danger-text)' }}>{error}</div>}
                        {status && <div className="empty-state" style={{ padding: 0, textAlign: 'left' }}>{status}</div>}

                        <div className="marketplace-actions">
                            <button className="btn-primary-compact" type="submit">Submit for review</button>
                            <button className="btn-link" type="button" onClick={() => navigate('/workspace/api-network/explore')}>Cancel</button>
                        </div>
                    </form>
                </div>
            </section>
        </div>
    );
};

export default MarketplaceSubmitListing;
