import React, { useState, useEffect } from 'react';
import './PublicHome.css';
import { FiZap, FiSearch, FiSave, FiCheckCircle, FiArrowRight, FiUsers, FiGitMerge, FiCalendar, FiMessageCircle, FiFileText, FiInbox } from 'react-icons/fi';
import { FaGithub, FaSlack, FaTwitter, FaLinkedin } from 'react-icons/fa';

const PublicHome = () => {
    // State to control intro visibility
    const [showIntroOnly, setShowIntroOnly] = useState(true);

    // Modern API developer workspace illustration
    const heroImageUrl = 'https://images.unsplash.com/photo-1587620962725-abab7fe55159?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1000&q=80';

    // Team collaboration image
    const collaborationImageUrl = 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';

    // Knowledge management image
    const knowledgeImageUrl = 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';

    // Function to handle "Learn More" button click
    const handleLearnMoreClick = (e) => {
        e.preventDefault();
        setShowIntroOnly(false);

        // Scroll to features section
        const featuresSection = document.getElementById('features');
        if (featuresSection) {
            featuresSection.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <div className={`public-home-container ${showIntroOnly ? 'intro-active' : ''}`}>

            <div className="intro-section-full-width">
                <div className="intro-section-container">
                    <div className="intro-content">
                        <h1 className="intro-heading">Everything App for Your API Development</h1>
                        <p className="intro-description">
                            Pigeon is an all-in-one platform for building, testing, and managing APIs.
                            Streamline your development workflow with powerful collaboration tools.
                        </p>
                        <div className="intro-buttons">
                            <a href="http://localhost:5000/auth/google" className="button primary-button hero-button-public">Try It Free</a>
                            <a href="#features" className="button secondary-button hero-button-secondary" onClick={handleLearnMoreClick}>Learn More</a>
                        </div>
                    </div>
                    <div className="intro-image-container">
                        <img src={heroImageUrl} alt="API Development Workspace" className="intro-image" />
                    </div>
                </div>
                <div className="intro-background-element left"></div>
                <div className="intro-background-element right"></div>
            </div>

            {/* Productivity Section */}
            <section id="features" className="productivity-section">
                <div className="section-header">
                    <h2>Unmatched Productivity</h2>
                    <p className="section-subtitle">Pigeon is a process, project, and API management platform that provides amazing collaboration opportunities for developers and product teams alike.</p>
                </div>

                <div className="productivity-features-grid">
                    <div className="productivity-feature-card">
                        <div className="feature-icon-container">
                            <FiZap className="feature-icon" />
                        </div>
                        <h3>Keyboard Shortcuts</h3>
                        <p>Work efficiently with instant access to common actions.</p>
                    </div>
                    <div className="productivity-feature-card">
                        <div className="feature-icon-container">
                            <FiCalendar className="feature-icon" />
                        </div>
                        <h3>Team Planner</h3>
                        <p>Keep track of the bigger picture by viewing all API endpoints in one centralized dashboard.</p>
                    </div>
                    <div className="productivity-feature-card">
                        <div className="feature-icon-container">
                            <FiInbox className="feature-icon" />
                        </div>
                        <h3>Notifications</h3>
                        <p>Keep up to date with any API changes by receiving instant notifications.</p>
                    </div>
                    <div className="productivity-feature-card">
                        <div className="feature-icon-container">
                            <FiSearch className="feature-icon" />
                        </div>
                        <h3>Advanced Filtering</h3>
                        <p>Precise API search with advanced filtering capabilities.</p>
                    </div>
                </div>
            </section>

            {/* Collaboration Section with Image */}
            <section className="collaboration-section">
                <div className="collaboration-content">
                    <h2>Work Together. Like in the Office.</h2>
                    <p className="collaboration-description">
                        Create customized virtual workspace for any team working with APIs. Collaborate with remote teams seamlessly through real-time communication within your workspace.
                    </p>
                    <div className="collaboration-features">
                        <div className="collab-feature-item">
                            <div className="collab-feature-icon">
                                <FiUsers className="icon" />
                            </div>
                            <div className="collab-feature-text">
                                <h3>Team Collaboration</h3>
                                <p>Connect with your team instantly to monitor progress and track API updates.</p>
                            </div>
                        </div>
                        <div className="collab-feature-item">
                            <div className="collab-feature-icon">
                                <FiMessageCircle className="icon" />
                            </div>
                            <div className="collab-feature-text">
                                <h3>Chat with Team</h3>
                                <p>Send DMs and create group chats directly within your API workspace.</p>
                            </div>
                        </div>
                        <div className="collab-feature-item">
                            <div className="collab-feature-icon">
                                <FiGitMerge className="icon" />
                            </div>
                            <div className="collab-feature-text">
                                <h3>Version History</h3>
                                <p>Track every edit effortlessly, and never lose a single API change.</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="collaboration-image">
                    <img src={collaborationImageUrl} alt="Team Collaboration" />
                </div>
            </section>

            {/* Knowledge Management Section with Image */}
            <section className="knowledge-section">
                <div className="knowledge-image">
                    <img src={knowledgeImageUrl} alt="Knowledge Management" />
                </div>
                <div className="knowledge-content">
                    <h2>Knowledge at Your Fingertips</h2>
                    <p className="knowledge-description">
                        Pigeon offers a wide range of features to create and manage your API documentation. Our suite of collaborative editing tools boosts team efficiency.
                    </p>
                    <div className="document-features">
                        <div className="document-feature-item">
                            <FiFileText className="document-feature-icon" />
                            <p>Documents in Pigeon can be used for sharing API reference materials, collaborating on plans, and storing implementation details.</p>
                        </div>
                        <div className="document-feature-item">
                            <FiUsers className="document-feature-icon" />
                            <p>With real-time collaboration, remote teams can work together on API documentation with features like tagging users and linking to endpoints.</p>
                        </div>
                    </div>
                    <a href="http://localhost:5000/auth/google" className="knowledge-cta">
                        Start Documentation <FiArrowRight />
                    </a>
                </div>
            </section>

            {/* Features Section */}
            <section className="features-section-public">
                <h2>Key Features</h2>
                <div className="features-grid-public">
                    <div className="feature-card-public">
                        <div className="feature-icon-wrapper">
                            <FiZap className="feature-icon-public" />
                        </div>
                        <h3>Effortless Requesting</h3>
                        <p>Quickly create and send any type of HTTP request with an intuitive UI.</p>
                    </div>
                    <div className="feature-card-public">
                        <div className="feature-icon-wrapper">
                            <FiSearch className="feature-icon-public" />
                        </div>
                        <h3>Detailed Inspection</h3>
                        <p>Analyze responses, headers, cookies, and performance metrics with ease.</p>
                    </div>
                    <div className="feature-card-public">
                        <div className="feature-icon-wrapper">
                            <FiSave className="feature-icon-public" />
                        </div>
                        <h3>Save & Organize</h3>
                        <p>Save your requests, organize them into collections, and sync across devices.</p>
                    </div>
                </div>
            </section>

            {/* GitHub Integration Section */}
            <section className="github-section">
                <h2>Sync with GitHub. Both Ways.</h2>
                <p className="github-subtitle">Manage your API tasks efficiently with Pigeon's bidirectional GitHub synchronization. Use Pigeon as an advanced front-end for GitHub Issues.</p>

                <div className="github-features-grid">
                    <div className="github-feature-card">
                        <div className="github-feature-icon">
                            <FiGitMerge />
                        </div>
                        <h3>Two-way Synchronization</h3>
                        <p>Integrate your API tracker with GitHub to sync changes instantly.</p>
                    </div>
                    <div className="github-feature-card">
                        <div className="github-feature-icon">
                            <FiUsers />
                        </div>
                        <h3>Multiple Repositories</h3>
                        <p>Organize multiple projects for more effective planning and collaboration.</p>
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
                <h2>Ready to Transform Your API Development?</h2>
                <p>Join thousands of developers building better APIs with Pigeon.</p>
                <div className="cta-buttons-container">
                    <a href="http://localhost:5000/auth/google" className="button primary-button cta-button-public">Try It Free</a>
                    <div className="social-links">
                        <a href="https://github.com" target="_blank" rel="noopener noreferrer" aria-label="GitHub"><FaGithub /></a>
                        <a href="https://slack.com" target="_blank" rel="noopener noreferrer" aria-label="Slack"><FaSlack /></a>
                        <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter"><FaTwitter /></a>
                    </div>
                </div>
                <p className="made-with">Made with passion by the Pigeon team</p>
            </section>
        </div>
    );
};

export default PublicHome;