// client/src/components/AIAgentToolsSection.js
// Replaces the static AI Agent Tools page with the entry point for the
// collection-scoped AI-agent evaluation product. Lists the user's collections
// and links each into its "Agent Evaluation" tab.
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiTarget, FiCpu, FiCheckCircle, FiList, FiArrowRight } from 'react-icons/fi';
import './AIAgentToolsSection.css';

const AIAgentToolsSection = () => {
    const [collections, setCollections] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        fetch('/api/collections', { credentials: 'include' })
            .then((res) => (res.ok ? res.json() : []))
            .then((data) => { if (active) { setCollections(Array.isArray(data) ? data : []); setLoading(false); } })
            .catch(() => { if (active) { setCollections([]); setLoading(false); } });
        return () => { active = false; };
    }, []);

    return (
        <div className="ai-agent-tools-section">
            <div className="ai-tools-section">
                <header className="ai-tools-header">
                    <h2><FiCpu className="header-icon" /> AI Agent Evaluation</h2>
                    <p>Deterministically score agent tool-call transcripts against a collection's MCP tool contract — did the agent use the right tools, avoid the forbidden ones, and call them with the right arguments?</p>
                </header>

                <div className="ai-tools-grid">
                    <div className="ai-tool-card">
                        <div className="ai-tool-header">
                            <div className="ai-tool-icon"><FiTarget /></div>
                            <div className="ai-tool-title">
                                <h3>Evaluation Suites</h3>
                                <span className="ai-tool-category">Scoring</span>
                            </div>
                        </div>
                        <p className="ai-tool-description">Attach ordered scenarios to a collection. Each scenario declares required and forbidden tool calls, argument assertions, and an optional max call count.</p>
                    </div>
                    <div className="ai-tool-card">
                        <div className="ai-tool-header">
                            <div className="ai-tool-icon"><FiCheckCircle /></div>
                            <div className="ai-tool-title">
                                <h3>Deterministic Scoring</h3>
                                <span className="ai-tool-category">Validation</span>
                            </div>
                        </div>
                        <p className="ai-tool-description">Submit a transcript; the engine checks every rule without invoking an LLM or running an agent. Sensitive argument values are redacted before storage.</p>
                    </div>
                    <div className="ai-tool-card">
                        <div className="ai-tool-header">
                            <div className="ai-tool-icon"><FiList /></div>
                            <div className="ai-tool-title">
                                <h3>Run History</h3>
                                <span className="ai-tool-category">Audit</span>
                            </div>
                        </div>
                        <p className="ai-tool-description">Every run stores the full, redacted transcript and per-rule results so you can audit exactly which rule failed and why.</p>
                    </div>
                </div>

                <div className="custom-agent-section">
                    <div className="custom-agent-content">
                        <h3>Your Collections</h3>
                        <p>Open a collection's Agent Evaluation tab to create suites and score transcripts.</p>
                        {loading && <p className="ai-tool-description">Loading collections…</p>}
                        {!loading && collections.length === 0 && <p className="ai-tool-description">No collections found. Create a collection first.</p>}
                        {!loading && collections.length > 0 && (
                            <ul className="eval-collections-list">
                                {collections.map((c) => (
                                    <li key={c._id} className="eval-collection-row">
                                        <Link className="use-tool-btn" to={`/workspace/collections/${c._id}?tab=evaluation`}>
                                            {c.name || 'Untitled collection'} <FiArrowRight />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div className="custom-agent-image">
                        <div className="image-placeholder">
                            <FiCpu size={56} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIAgentToolsSection;