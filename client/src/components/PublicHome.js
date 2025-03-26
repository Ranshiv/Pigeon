// client/src/components/PublicHome.js
import React from 'react';
import './PublicHome.css';

const PublicHome = () => {
    return (
        <div className="public-home-container">
            <section className="hero">
                <div className="hero-content">
                    <h1>Welcome to Pigeon - Your API Testing Companion</h1>
                    <p className="hero-subtitle">
                        Simplify your API development and testing workflow with Pigeon.
                    </p>
                    {/* Use the ABSOLUTE backend URL for Google Sign-In */}
                    <a href="http://localhost:5000/auth/google" className="hero-button">Sign Up with Google</a>
                </div>
                <div className="hero-image">
                    <img src="https://via.placeholder.com/600x400?text=API+Testing" alt="API Testing Illustration" />
                </div>
            </section>

            <section className="features">
                <h2>Key Features</h2>
                <div className="features-grid">
                    {/* ... feature divs ... */}
                    <div className="feature">
                        <div className="feature-icon">🚀</div>
                        <h3>Easy Request Creation</h3>
                        <p>Quickly create and configure API requests.</p>
                    </div>
                    <div className="feature">
                        <div className="feature-icon">🔍</div>
                        <h3>Response Inspection</h3>
                        <p>Thoroughly inspect API responses.</p>
                    </div>
                    <div className="feature">
                        <div className="feature-icon">💾</div>
                        <h3>Save and Organize</h3>
                        <p>Organize your requests for easy reuse.</p>
                    </div>
                </div>
            </section>

            <section className="benefits">
                <h2>Why Choose Pigeon?</h2>
                {/* ... benefits list ... */}
                <ul>
                    <li><strong>Intuitive Interface:</strong>  Easy to learn and use, even for beginners.</li>
                    <li><strong>Powerful Features:</strong>  Everything you need for basic to advanced API testing.</li>
                    <li><strong>Streamlined Workflow:</strong>  Save time and effort in your API development.</li>
                    <li><strong>Free to Get Started:</strong>  Sign up and start testing immediately!</li>
                </ul>
            </section>

            <section className="cta">
                <h2>Ready to Get Started?</h2>
                {/* Use the ABSOLUTE backend URL for Google Sign-In */}
                <a href="http://localhost:5000/auth/google" className="cta-button">Sign Up Now</a>
            </section>
        </div>
    );
};

export default PublicHome;