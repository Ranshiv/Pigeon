// client/src/components/TrendingSection.js

import React from 'react';
import './TrendingSection.css';
import { FiTrendingUp, FiArrowUpRight, FiClock } from 'react-icons/fi';
import AppSelect from './common/AppSelect/AppSelect';

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

    // Placeholder state for AppSelect
    const [timeframe, setTimeframe] = React.useState('this-week');
    const [category, setCategory] = React.useState('all');

    return (
        <div className="trending-section">
            <header className="trending-header">
                <h2><FiTrendingUp className="header-icon" /> Trending APIs</h2>
                <p>Discover what's popular in the API ecosystem right now</p>
            </header>

            <div className="trending-filters">
                <div className="filter-group">
                    <span className="filter-label">Timeframe</span>
                    <div className="filter-select">
                        <AppSelect
                            value={timeframe}
                            onChange={setTimeframe}
                            options={[
                                { value: 'this-week', label: 'This week' },
                                { value: 'this-month', label: 'This month' },
                                { value: 'this-year', label: 'This year' }
                            ]}
                        />
                    </div>
                </div>

                <div className="filter-group">
                    <span className="filter-label">Category</span>
                    <div className="filter-select">
                        <AppSelect
                            value={category}
                            onChange={setCategory}
                            options={[
                                { value: 'all', label: 'All Categories' },
                                { value: 'ai', label: 'AI' },
                                { value: 'data', label: 'Data' },
                                { value: 'ecommerce', label: 'E-commerce' },
                                { value: 'finance', label: 'Finance' },
                                { value: 'productivity', label: 'Productivity' }
                            ]}
                        />
                    </div>
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
                                <div className="trending-meta-item">
                                    <FiClock className="trending-meta-icon" />
                                    <span>{api.timeframe}</span>
                                </div>
                                <div className="meta-category">
                                    {api.category}
                                </div>
                            </div>
                        </div>
                        <div className="trending-actions">
                            <button className="view-api-btn" onClick={() => console.log('View', api.id)}>View API</button>
                            <button className="add-to-collection-btn" onClick={() => console.log('Add', api.id)}>Add to collection</button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="trending-insights">
                <div className="insights-content">
                    <h3>API Trends Insights</h3>
                    <p>AI and Machine Learning APIs continue to dominate the growth charts this month, with a 243% increase in usage across the platform.</p>
                </div>
                <button className="view-insights-btn">View Full Report</button>
            </div>
        </div>
    );
};

export default TrendingSection;
