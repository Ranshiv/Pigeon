import React, { useState } from 'react';
import { X, ExternalLink, BookOpen, Code, Play, Copy, Check, Star, TrendingUp } from 'lucide-react';
import TryItConsole from './TryItConsole';
import './ApiDetailModal.css';

const ApiDetailModal = ({ api, onClose }) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [selectedEndpoint, setSelectedEndpoint] = useState(api.endpoints[0] || null);
    const [copied, setCopied] = useState(false);

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSaveRequest = async (requestData) => {
        try {
            const response = await fetch('http://localhost:5001/api/requests', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
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

            if (response.ok) {
                alert('Request saved successfully!');
            } else {
                throw new Error('Failed to save request');
            }
        } catch (error) {
            console.error('Save request error:', error);
            alert('Failed to save request. Please try again.');
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="api-detail-modal" onClick={(e) => e.stopPropagation()}>
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
                                <h2>{api.name}</h2>
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
                                        {api.usageCount.toLocaleString()} uses
                                    </span>
                                    <span className="stat-pill category-pill">
                                        {api.category}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <button className="close-btn" onClick={onClose} aria-label="Close modal">
                        <X size={24} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="modal-tabs">
                    <div className="tabs-wrapper">
                        <button
                            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                            onClick={() => setActiveTab('overview')}
                        >
                            <BookOpen size={18} />
                            Overview
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'tryit' ? 'active' : ''}`}
                            onClick={() => setActiveTab('tryit')}
                        >
                            <Play size={18} />
                            Try It
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'endpoints' ? 'active' : ''}`}
                            onClick={() => setActiveTab('endpoints')}
                        >
                            <Code size={18} />
                            Endpoints
                        </button>
                    </div>
                </div>

                {/* Modal Body */}
                <div className="modal-body">
                    {/* Overview Tab */}
                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <div className="overview-tab">
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
                                                <span>{api.ratingAverage}</span>
                                                <span className="rating-count">({api.ratingCount})</span>
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
                        <div className="tryit-tab">
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
                        <div className="endpoints-tab">
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
                </div>
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
