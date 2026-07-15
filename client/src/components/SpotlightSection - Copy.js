// client/src/components/SpotlightSection.js
import React from 'react';
import './SpotlightSection.css';
import { FiStar, FiActivity } from 'react-icons/fi';

const SpotlightSection = () => {
    // Mock featured APIs for demonstration
    const featuredApis = [
        {
            id: 'api-1',
            name: 'GitHub REST API',
            description: 'Access GitHub data and functionality',
            category: 'Development',
            rating: 4.8,
            usage: 12450
        },
        {
            id: 'api-2',
            name: 'Weather API',
            description: 'Get weather forecasts and historical data',
            category: 'Weather',
            rating: 4.7,
            usage: 8920
        },
        {
            id: 'api-3',
            name: 'Stripe API',
            description: 'Process payments and manage subscriptions',
            category: 'Finance',
            rating: 4.9,
            usage: 15300
        }
    ];

    return (
        <div className="spotlight-section">
            <header className="spotlight-header">
                <h2><FiStar className="header-icon" /> API Spotlight</h2>
                <p>Discover featured and trending APIs recommended for you</p>
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
                                        <span>{api.rating.toFixed(1)}</span>
                                    </div>
                                    <div className="api-usage">
                                        <FiActivity className="usage-icon" />
                                        <span>{api.usage.toLocaleString()} users</span>
                                    </div>
                                </div>
                                <button className="view-api-btn">View details</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="spotlight-community">
                <h3>Community Highlights</h3>
                <div className="community-content">
                    <p>This section will show community-created collections and API recommendations.</p>
                    <button className="explore-community-btn">Explore Community</button>
                </div>
            </div>
        </div>
    );
};

export default SpotlightSection;