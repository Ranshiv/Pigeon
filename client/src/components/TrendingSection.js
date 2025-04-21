//client/src/components/TrendingSection.js

import React from 'react';
import './TrendingSection.css';
import { FiTrendingUp, FiArrowUpRight, FiClock, FiUser } from 'react-icons/fi';

const TrendingSection = () => {
    // Mock trending APIs data
    const trendingApis = [
        {
            id: 'trend-1',
            name: 'OpenAI API',
            description: 'Access AI models like GPT-4 for natural language processing and generation',
            growthPercent: 182,
            category: 'AI',
            timeframe: 'This week'
        },
        {
            id: 'trend-2',
            name: 'Notion API',
            description: 'Build integrations with Notion workspaces, databases and more',
            growthPercent: 145,
            category: 'Productivity',
            timeframe: 'This month'
        },
        {
            id: 'trend-3',
            name: 'Shopify Storefront API',
            description: 'Build custom shopping experiences for Shopify stores',
            growthPercent: 98,
            category: 'E-commerce',
            timeframe: 'This week'
        },
        {
            id: 'trend-4',
            name: 'Mapbox Navigation API',
            description: 'Add turn-by-turn navigation to your applications',
            growthPercent: 74,
            category: 'Maps',
            timeframe: 'This month'
        },
        {
            id: 'trend-5',
            name: 'Midjourney API',
            description: 'Generate images with AI text-to-image technology',
            growthPercent: 167,
            category: 'AI',
            timeframe: 'This week'
        }
    ];

    return (
        <div className="trending-section">
            <header className="trending-header">
                <h2><FiTrendingUp className="header-icon" /> Trending APIs</h2>
                <p>Discover what's popular in the API ecosystem right now</p>
            </header>

            <div className="trending-filters">
                <div className="filter-group">
                    <span className="filter-label">Timeframe:</span>
                    <select className="filter-select">
                        <option>This week</option>
                        <option>This month</option>
                        <option>This year</option>
                    </select>
                </div>

                <div className="filter-group">
                    <span className="filter-label">Category:</span>
                    <select className="filter-select">
                        <option>All Categories</option>
                        <option>AI</option>
                        <option>Data</option>
                        <option>E-commerce</option>
                        <option>Finance</option>
                        <option>Productivity</option>
                    </select>
                </div>
            </div>

            <div className="trending-list">
                {trendingApis.map(api => (
                    <div key={api.id} className="trending-card">
                        <div className="trending-main">
                            <div className="trending-title-area">
                                <h3>{api.name}</h3>
                                <div className="growth-tag">
                                    <FiArrowUpRight />
                                    <span>{api.growthPercent}%</span>
                                </div>
                            </div>
                            <p className="trending-description">{api.description}</p>
                            <div className="trending-meta">
                                <div className="meta-item">
                                    <FiClock className="meta-icon" />
                                    <span>{api.timeframe}</span>
                                </div>
                                <div className="meta-category">
                                    <span>{api.category}</span>
                                </div>
                            </div>
                        </div>
                        <div className="trending-actions">
                            <button className="view-api-btn">View API</button>
                            <button className="add-to-collection-btn">Add to collection</button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="trending-insights">
                <h3>API Trends Insights</h3>
                <div className="insights-content">
                    <p>AI and Machine Learning APIs continue to dominate the growth charts this month, with a 243% increase in usage across the platform.</p>
                    <button className="view-insights-btn">View Full Report</button>
                </div>
            </div>
        </div>
    );
};

export default TrendingSection;