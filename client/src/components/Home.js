// client/src/components/Home.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css'; // We'll combine the CSS too

const Home = () => {
    const navigate = useNavigate();

    const handleGetStartedClick = () => {
        navigate('/workspace/home'); // Navigate to the Workspace Home
    };

    return (
        <div className="home-container">
            <section className="hero">
                <div className="hero-content">
                    <h1>Build, Test, and Manage APIs with Pigeon</h1>
                    <p className="hero-subtitle">The intuitive API platform for developers.</p>
                    <button className="hero-button" onClick={handleGetStartedClick}>
                        Get Started
                    </button>
                </div>
                <div className="hero-image">
                    {/* Placeholder image - Replace with your actual image */}
                    <img
                        src="https://via.placeholder.com/600x400?text=API+Illustration"
                        alt="API Illustration"
                    />
                </div>
            </section>

            <section className="features">
                <h2>Key Features</h2>
                <div className="features-grid">
                    <div className="feature">
                        <div className="feature-icon">🚀</div>
                        <h3>Easy Request Creation</h3>
                        <p>
                            Quickly create and configure API requests with a user-friendly interface.
                        </p>
                    </div>
                    <div className="feature">
                        <div className="feature-icon">🔍</div>
                        <h3>Response Inspection</h3>
                        <p>
                            Thoroughly inspect API responses, including headers, body, and status
                            codes.
                        </p>
                    </div>
                    <div className="feature">
                        <div className="feature-icon">💾</div>
                        <h3>Save and Organize</h3>
                        <p>Save and organize your API requests for easy reuse and management.</p>
                    </div>
                </div>
            </section>

            <section className="trusted-by">
                <h2>Trusted By Developers Everywhere</h2>
                <div className="logos">
                    {/* Replace with actual logos */}
                    <div className="logo">Logo 1</div>
                    <div className="logo">Logo 2</div>
                    <div className="logo">Logo 3</div>
                </div>
            </section>

            <section className="cta">
                <h2>Ready to Simplify Your API Workflow?</h2>
                <button className="cta-button" onClick={handleGetStartedClick}>
                    Try Pigeon Now
                </button>
            </section>

            {/* Get Started Section (from HomeSection) */}
            <section className="home-section">
                <h2>Get Started Quickly</h2>
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
            </section>
        </div>
    );
};

export default Home;