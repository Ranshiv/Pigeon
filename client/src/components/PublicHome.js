// client/src/components/PublicHome.js (Improved)
import React from 'react';
import './PublicHome.css'; // We'll update this CSS file
import { FiZap, FiSearch, FiSave, FiCheckCircle, FiArrowRight } from 'react-icons/fi'; // Added FiArrowRight
import { FaGithub, FaTwitter, FaLinkedin } from 'react-icons/fa'; // Import social icons

const PublicHome = () => {
    // Suggestion: Find a more relevant illustration for API testing/development
    const heroImageUrl = 'https://images.unsplash.com/photo-1587620962725-abab7fe55159?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1000&q=80'; // Example relevant image

    return (
        <div className="public-home-container">
            {/* Hero Section */}
            <section className="hero-section-public"> {/* Renamed class */}
                <div className="hero-content-public">
                    <h1>Your Reliable API Testing Companion</h1>
                    <p className="hero-subtitle-public">
                        Build, test, and manage your APIs efficiently. Streamline your development workflow with Pigeon.
                    </p>
                    <a href="http://localhost:5000/auth/google" className="button primary-button hero-button-public">Get Started Free</a>
                </div>
                <div className="hero-image-public">
                    <img src={heroImageUrl} alt="API Development Illustration" />
                </div>
            </section>

            {/* Features Section */}
            <section className="features-section-public">
                <h2>Key Features</h2>
                <div className="features-grid-public">
                    <div className="feature-card-public">
                        <FiZap size={30} className="feature-icon-public" />
                        <h3>Effortless Requesting</h3>
                        <p>Quickly create and send any type of HTTP request with an intuitive UI.</p>
                    </div>
                    <div className="feature-card-public">
                        <FiSearch size={30} className="feature-icon-public" />
                        <h3>Detailed Inspection</h3>
                        <p>Analyze responses, headers, cookies, and performance metrics with ease.</p>
                    </div>
                    <div className="feature-card-public">
                        <FiSave size={30} className="feature-icon-public" />
                        <h3>Save & Organize</h3>
                        <p>Save your requests, organize them into collections, and sync across devices (future).</p>
                    </div>
                </div>
            </section>

            {/* Benefits Section - Redesigned with modern cards */}
            <section className="benefits-section-public">
                <h2>Why Choose Pigeon?</h2>

                <div className="benefits-cards-container">
                    {/* Card 1 */}
                    <div className="benefit-card">
                        <div className="benefit-card-content">
                            <div className="benefit-card-front">
                                <div className="benefit-icon-wrapper">
                                    <FiCheckCircle className="benefit-card-icon" />
                                </div>
                                <h3>Intuitive Interface</h3>
                                <p>Easy to learn and use, even for beginners</p>
                            </div>
                            <div className="benefit-card-back">
                                <p>Our clean, modern interface helps you focus on what matters - testing your APIs without distractions.</p>
                                <a href="http://localhost:5000/auth/google" className="benefit-card-cta">
                                    Try it now <FiArrowRight />
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Card 2 */}
                    <div className="benefit-card">
                        <div className="benefit-card-content">
                            <div className="benefit-card-front">
                                <div className="benefit-icon-wrapper">
                                    <FiCheckCircle className="benefit-card-icon" />
                                </div>
                                <h3>Core Functionality</h3>
                                <p>Everything you need for effective API testing</p>
                            </div>
                            <div className="benefit-card-back">
                                <p>We focus on the essential features that developers need daily, without unnecessary complexity.</p>
                                <a href="http://localhost:5000/auth/google" className="benefit-card-cta">
                                    Get started <FiArrowRight />
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Card 3 */}
                    <div className="benefit-card">
                        <div className="benefit-card-content">
                            <div className="benefit-card-front">
                                <div className="benefit-icon-wrapper">
                                    <FiCheckCircle className="benefit-card-icon" />
                                </div>
                                <h3>Streamlined Workflow</h3>
                                <p>Save time and reduce errors</p>
                            </div>
                            <div className="benefit-card-back">
                                <p>Pigeon helps you build a more efficient workflow with saved requests, collections, and quick responses.</p>
                                <a href="http://localhost:5000/auth/google" className="benefit-card-cta">
                                    Explore more <FiArrowRight />
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Card 4 */}
                    <div className="benefit-card">
                        <div className="benefit-card-content">
                            <div className="benefit-card-front">
                                <div className="benefit-icon-wrapper">
                                    <FiCheckCircle className="benefit-card-icon" />
                                </div>
                                <h3>Free to Use</h3>
                                <p>Get started without any cost</p>
                            </div>
                            <div className="benefit-card-back">
                                <p>Pigeon is 100% free to use with all core features available to everyone, no hidden limitations.</p>
                                <a href="http://localhost:5000/auth/google" className="benefit-card-cta">
                                    Sign up free <FiArrowRight />
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Call to Action Section */}
            <section className="cta-section-public">
                <h2>Ready to Boost Your API Development?</h2>
                <p>Sign up with Google and start testing your APIs in minutes.</p>
                <a href="http://localhost:5000/auth/google" className="button secondary-button cta-button-public">Sign Up Now</a>
            </section>
        </div>
    );
};

export default PublicHome;