// client/src/components/SpotlightSection.js
import React from 'react';
import './SpotlightSection.css';
import { FiStar, FiActivity } from 'react-icons/fi';

const SpotlightSection = () => {
    // Mock featured APIs for demonstration
    const featuredApis = [
        {
            id: 'feat-1',
            name: 'Stripe GraphQL API',
            description: 'Integrate payments, subscriptions, and financial services into your application.',
            category: 'Finance',
            rating: 4.9,
            usage: '1.2M req/day'
        },
        {
            id: 'feat-2',
            name: 'Twilio Voice API',
            description: 'Make, receive, and monitor phone calls from your web or mobile app.',
            category: 'Communications',
            rating: 4.7,
            usage: '850K req/day'
        },
        {
            id: 'feat-3',
            name: 'GitHub REST API v3',
            description: 'Interact with GitHub repositories, issues, users, and workflows programmatically.',
            category: 'Developer Tools',
            rating: 4.8,
            usage: '3.4M req/day'
        },
        {
            id: 'feat-4',
            name: 'SendGrid SMS API',
            description: 'Deliver transactional and marketing emails at scale with high deliverability.',
            category: 'Communications',
            rating: 4.6,
            usage: '2.1M req/day'
        }
    ];

    return (
        <div className="spotlight-section">
            <header className="spotlight-header">
                <h2><FiStar className="header-icon" /> API Spotlight</h2>
                <p>Discover featured and trending APIs recommended for your workflow</p>
            </header>

            <div className="featured-apis">
                <h3>Featured APIs</h3>
                <div className="api-grid">
                    {featuredApis.map(api => (
                        <div key={api.id} className="api-card">
                            <div className="api-header">
                                <h4>{api.name}</h4>
                                <span className="category-badge">{api.category}</span>
                            </div>
                            <p className="api-description">{api.description}</p>
                            <div className="api-footer">
                                <div className="api-stats">
                                    <div className="api-rating">
                                        <FiStar className="star-icon" />
                                        <span>{api.rating}</span>
                                    </div>
                                    <div className="api-usage">
                                        <FiActivity className="usage-icon" />
                                        <span>{api.usage}</span>
                                    </div>
                                </div>
                                <button className="view-api-btn">View API</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="spotlight-community">
                <div className="community-content">
                    <h3>Community Favorites</h3>
                    <p>Explore the most starred and collected APIs by the developer community this month.</p>
                </div>
                <button className="explore-community-btn">Explore Community</button>
            </div>
        </div>
    );
};

export default SpotlightSection;