// client/src/components/Home.js (Corrected)
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

const Home = () => {
    const navigate = useNavigate();

    return (
        <div className="home-container">
            <section className="home-section">
                <h2>Get Started Quickly</h2>
                <div className="home-options">
                    <div className="home-option" onClick={() => navigate('../../workspace/api-network/requests/new')}> {/* Corrected Navigation */}
                        <span>🚀</span>
                        <span>Send an API Request</span>
                    </div>
                    <div className="home-option" onClick={() => navigate('../api-network')}> {/* Also correct for API Network */}
                        <span>🔍</span>
                        <span>Explore APIs</span>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Home;