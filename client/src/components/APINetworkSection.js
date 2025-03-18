// client/src/components/APINetworkSection.js
import React from 'react';
import './APINetworkSection.css'
import { Routes, Route, useNavigate } from 'react-router-dom';
import ExploreSection from './ExploreSection';
import SpotlightSection from './SpotlightSection';
import TrendingSection from './TrendingSection';
import AIAgentToolsSection from './AIAgentToolsSection';

const APINetworkSection = () => {
    const navigate = useNavigate();
    return (
        <div className="api-network-section">
            <div className='api-network-sidebar'>
                <div onClick={() => navigate('explore')}>Explore</div>
                <div onClick={() => navigate('spotlight')}>Spotlight</div>
                <div onClick={() => navigate('trending')}>Trending</div>
                <div onClick={() => navigate('ai-agent-tools')}>AI Agent Tools</div>
            </div>
            <div className='api-network-main-content'>
                <Routes>
                    <Route path="explore" element={<ExploreSection />} />
                    <Route path="spotlight" element={<SpotlightSection />} />
                    <Route path="trending" element={<TrendingSection />} />
                    <Route path="ai-agent-tools" element={<AIAgentToolsSection />} />
                </Routes>
            </div>
        </div>
    );
};

export default APINetworkSection;