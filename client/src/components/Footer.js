// client/src/components/Footer.js
import React from 'react';
import './Footer.css';
import { Link } from 'react-router-dom';

const Footer = () => {
    return (
        <footer className="footer">
            <div className="footer-container">
                <div className="footer-main">
                    {/* Brand Section */}
                    <div className="footer-brand-section">
                        <h3>Pigeon</h3>
                        <p className="footer-tagline">The ultimate API development platform</p>
                        <div className="footer-social">
                            <a href="https://github.com/Ranshiv/Pigeon" className="social-icon" target="_blank" rel="noopener noreferrer" aria-label="Pigeon on GitHub">
                                <svg viewBox="0 0 24 24" width="20" height="20">
                                    <path fill="currentColor" d="M12 0a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2 0 1.9 1.2 1.9 1.2 1 1.8 2.8 1.3 3.4 1 0-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.1-.4-.6-1.6.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17 4.7 18 5 18 5c.7 1.6.2 2.9.1 3.2.8.8 1.3 1.9 1.3 3.2 0 4.6-2.9 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 0z" />
                                </svg>
                            </a>
                        </div>
                    </div>

                    {/* Product Section */}
                    <div className="footer-links-section">
                        <h4>Product</h4>
                        <ul className="footer-links">
                            <li>
                                <Link to="/workspace/api-network">
                                    <svg viewBox="0 0 24 24" className="footer-icon" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                                    </svg> API Network
                                </Link>
                            </li>
                            <li>
                                <Link to="/workspace/workspaces">
                                    <svg viewBox="0 0 24 24" className="footer-icon" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M16 18l6-6-6-6"></path>
                                        <path d="M8 6l-6 6 6 6"></path>
                                    </svg> Workspaces
                                </Link>
                            </li>
                            <li>
                                <Link to="/workspace/monitoring">
                                    <svg viewBox="0 0 24 24" className="footer-icon" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                                    </svg> Monitoring
                                </Link>
                            </li>
                            <li>
                                <Link to="/workspace/protocols">
                                    <svg viewBox="0 0 24 24" className="footer-icon" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M4 4h16v16H4z"></path>
                                        <path d="M8 8h8M8 12h8M8 16h5"></path>
                                    </svg> Protocol Testing
                                </Link>
                            </li>
                            <li>
                                <Link to="/workspace/graphql">
                                    <svg viewBox="0 0 24 24" className="footer-icon" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="2"></circle>
                                        <path d="M5.2 7.2 12 4l6.8 3.2v9.6L12 20l-6.8-3.2z"></path>
                                        <path d="m12 4 6.8 12.8M12 4 5.2 16.8M5.2 7.2h13.6M5.2 16.8h13.6"></path>
                                    </svg> GraphQL
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Workflows Section */}
                    <div className="footer-links-section">
                        <h4>Workflows</h4>
                        <ul className="footer-links">
                            <li>
                                <Link to="/workspace/performance-tests">
                                    <svg viewBox="0 0 24 24" className="footer-icon" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 3v18h18"></path>
                                        <path d="m7 16 4-5 3 3 5-7"></path>
                                    </svg> Performance Testing
                                </Link>
                            </li>
                            <li>
                                <Link to="/workspace/consumer-contracts">
                                    <svg viewBox="0 0 24 24" className="footer-icon" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M8 6h13M8 12h13M8 18h13"></path>
                                        <path d="M3 6h.01M3 12h.01M3 18h.01"></path>
                                    </svg> Consumer Contracts
                                </Link>
                            </li>
                            <li>
                                <Link to="/workspace/asyncapi">
                                    <svg viewBox="0 0 24 24" className="footer-icon" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M4 4h16v16H4z"></path>
                                        <path d="M8 12h8M12 8v8"></path>
                                    </svg> AsyncAPI
                                </Link>
                            </li>
                            <li>
                                <Link to="/workspace/trace-to-test">
                                    <svg viewBox="0 0 24 24" className="footer-icon" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="9"></circle>
                                        <path d="M8 12h8M12 8v8"></path>
                                    </svg> Trace to Test
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Resources Section */}
                    <div className="footer-links-section">
                        <h4>Resources</h4>
                        <ul className="footer-links">
                            <li>
                                <Link to="/documentation">
                                    <svg viewBox="0 0 24 24" className="footer-icon" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                        <polyline points="14 2 14 8 20 8"></polyline>
                                        <line x1="16" y1="13" x2="8" y2="13"></line>
                                        <line x1="16" y1="17" x2="8" y2="17"></line>
                                        <polyline points="10 9 9 9 8 9"></polyline>
                                    </svg> Documentation
                                </Link>
                            </li>
                            <li>
                                <Link to="/workspace/history">
                                    <svg viewBox="0 0 24 24" className="footer-icon" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <polyline points="12 6 12 12 16 14"></polyline>
                                    </svg> History
                                </Link>
                            </li>
                            <li>
                                <Link to="/workspace/compliance">
                                    <svg viewBox="0 0 24 24" className="footer-icon" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 3 4 6v5c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6z"></path>
                                        <path d="m8 12 2.5 2.5L16 9"></path>
                                    </svg> Compliance
                                </Link>
                            </li>
                            <li>
                                <Link to="/workspace/governance">
                                    <svg viewBox="0 0 24 24" className="footer-icon" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 2 4 5v6c0 5.5 3.4 9.7 8 11 4.6-1.3 8-5.5 8-11V5z"></path>
                                        <path d="M8 12h8M12 8v8"></path>
                                    </svg> Governance
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Contact Us Section */}
                    <div className="footer-contact-section">
                        <h4>Contact Us</h4>
                        <a href="mailto:support@pigeonapp.io" className="contact-email">
                            <svg viewBox="0 0 24 24" className="footer-icon" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                <polyline points="22,6 12,13 2,6"></polyline>
                            </svg> support@pigeonapp.io
                        </a>
                        <p className="contact-message">
                            Have questions or feedback? We'd love to hear from you!
                        </p>
                    </div>
                </div>

                <div className="footer-bottom">
                    <div className="copyright">
                        © {new Date().getFullYear()} Pigeon. All rights reserved.
                    </div>
                    <div className="footer-legal-links">
                        <Link to="/privacy">Privacy</Link>
                        <Link to="/terms">Terms</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
