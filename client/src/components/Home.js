// client/src/components/Home.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

const Home = () => {
    const navigate = useNavigate();

    return (
        <section className="home-section">
            <h2>Get Started Quickly</h2>
            <div className="home-options">
                <div className="home-option" onClick={() => navigate('../../workspace/api-network/requests/new')}>
                    <span>🚀</span>
                    <span>Send an API Request</span>
                </div>
                <div className="home-option" onClick={() => navigate('../api-network')}>
                    <span>🔍</span>
                    <span>Explore APIs</span>
                </div>
            </div>
        </section>
    );
};

export default Home;