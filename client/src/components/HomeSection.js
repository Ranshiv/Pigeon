// client/src/components/HomeSection.js
import React from 'react';
import './HomeSection.css';
import { useNavigate } from 'react-router-dom';

const HomeSection = () => {
    const navigate = useNavigate();
    return (
        <div className="home-section">
            <h2>Get Started</h2>
            <div className="home-options">
                <div className="home-option" onClick={() => navigate('/workspace/workspaces/requests/new')}>
                    <span>🚀</span>
                    <span>Send an API Request</span>
                </div>
                <div className="home-option" onClick={() => navigate('/workspace/api-network')}>
                    <span>🔍</span>
                    <span>Explore APIs</span>
                </div>
            </div>
        </div>
    );
};

export default HomeSection;