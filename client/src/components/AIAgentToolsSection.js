// client/src/components/AIAgentToolsSection.js
import React from 'react';
import './AIAgentToolsSection.css';
import { FiCpu, FiCode, FiPackage, FiArrowRight, FiPlus } from 'react-icons/fi';

const AIAgentToolsSection = () => {
    // Mock AI tools data
    const aiTools = [
        {
            id: 'ai-tool-1',
            name: 'API Request Generator',
            description: 'Generate API requests from natural language descriptions',
            category: 'Generation',
            isPremium: false
        },
        {
            id: 'ai-tool-2',
            name: 'API Response Analyzer',
            description: 'Get insights and explanations from complex API responses',
            category: 'Analysis',
            isPremium: true
        },
        {
            id: 'ai-tool-3',
            name: 'Test Case Generator',
            description: 'Create comprehensive test cases for your API endpoints',
            category: 'Testing',
            isPremium: false
        },
        {
            id: 'ai-tool-4',
            name: 'Schema Validator',
            description: 'Validate and suggest improvements for your API schemas',
            category: 'Validation',
            isPremium: true
        }
    ];

    return (
        <div className="ai-tools-section">
            <header className="ai-tools-header">
                <h2><FiCpu className="header-icon" /> AI Agent Tools</h2>
                <p>Advanced AI-powered tools to enhance your API development workflow</p>
            </header>

            <div className="ai-tools-grid">
                {aiTools.map(tool => (
                    <div key={tool.id} className="ai-tool-card">
                        <div className="ai-tool-header">
                            <div className="ai-tool-icon">
                                <FiCode />
                            </div>
                            <div className="ai-tool-title">
                                <h3>{tool.name}</h3>
                                <span className="ai-tool-category">{tool.category}</span>
                            </div>
                            {tool.isPremium && (
                                <span className="premium-badge">Premium</span>
                            )}
                        </div>
                        <p className="ai-tool-description">{tool.description}</p>
                        <button className="use-tool-btn">
                            Use Tool <FiArrowRight />
                        </button>
                    </div>
                ))}
            </div>

            <div className="custom-agent-section">
                <div className="custom-agent-content">
                    <h3>Build Custom AI Agents</h3>
                    <p>Create specialized AI agents tailored to your API workflows and business needs.</p>
                    <ul className="agent-benefits">
                        <li>Automate repetitive API tasks</li>
                        <li>Create custom data transformation pipelines</li>
                        <li>Build intelligent monitoring systems</li>
                    </ul>
                    <button className="create-agent-btn">
                        <FiPlus /> Create Custom Agent
                    </button>
                </div>
                <div className="custom-agent-image">
                    {/* Placeholder for an illustration or image */}
                    <div className="image-placeholder">
                        <FiCpu size={64} />
                    </div>
                </div>
            </div>

            <div className="ai-tools-insights">
                <h3>AI Tool Insights</h3>
                <div className="insights-stats">
                    <div className="stat-item">
                        <span className="stat-value">87%</span>
                        <span className="stat-label">Time saved in API testing</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-value">3.5x</span>
                        <span className="stat-label">Faster API debugging</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-value">92%</span>
                        <span className="stat-label">User satisfaction</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIAgentToolsSection;