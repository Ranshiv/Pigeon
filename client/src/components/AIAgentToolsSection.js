// client/src/components/AIAgentToolsSection.js
// Replaces the static AI Agent Tools page with the entry point for the
// collection-scoped AI-agent evaluation product. Lists the user's collections
// and links each into its "Agent Evaluation" tab.
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiTarget, FiCpu, FiCheckCircle, FiList, FiArrowRight, FiBox, FiSearch } from 'react-icons/fi';
import './AIAgentToolsSection.css';

const AIAgentToolsSection = () => {
    const [collections, setCollections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const filteredCollections = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return collections;
        return collections.filter((collection) => (collection.name || 'Untitled collection').toLowerCase().includes(query));
    }, [collections, search]);

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

                <section className="collections-panel" aria-labelledby="collections-heading">
                    <div className="collections-panel-header">
                        <div className="custom-agent-content">
                            <div className="section-eyebrow"><FiBox /> Evaluation workspace</div>
                            <h3 id="collections-heading">Your Collections <span>{collections.length}</span></h3>
                            <p>Choose a collection to create evaluation suites and score agent transcripts.</p>
                        </div>
                        {!loading && collections.length > 0 && (
                            <label className="collections-search">
                                <FiSearch aria-hidden="true" />
                                <span className="sr-only">Search collections</span>
                                <input
                                    type="search"
                                    placeholder="Search collections"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                />
                            </label>
                        )}
                    </div>
                        {loading && <p className="ai-tool-description">Loading collections…</p>}
                        {!loading && collections.length === 0 && <p className="ai-tool-description">No collections found. Create a collection first.</p>}
                        {!loading && collections.length > 0 && filteredCollections.length > 0 && (
                            <ul className="eval-collections-list">
                                {filteredCollections.map((c) => (
                                    <li key={c._id} className="eval-collection-row">
                                        <Link className="use-tool-btn" to={`/workspace/collections/${c._id}?tab=evaluation`}>
                                            <span className="collection-card-icon"><FiBox /></span>
                                            <span className="collection-card-copy">
                                                <strong>{c.name || 'Untitled collection'}</strong>
                                                <small>Open Agent Evaluation</small>
                                            </span>
                                            <FiArrowRight className="collection-card-arrow" aria-hidden="true" />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {!loading && collections.length > 0 && filteredCollections.length === 0 && (
                            <p className="collections-no-results">No collections match “{search}”.</p>
                        )}
                </section>
            </div>
        </div>
    );
};

export default AIAgentToolsSection;
