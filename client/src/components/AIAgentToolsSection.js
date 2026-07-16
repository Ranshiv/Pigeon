// client/src/components/AIAgentToolsSection.js
import React from 'react';
import './AIAgentToolsSection.css';
import { FiCpu, FiCode, FiFileText, FiCheckCircle, FiActivity, FiArrowRight, FiPlus } from 'react-icons/fi';

const AIAgentToolsSection = () => {
    const aiTools = [
        {
            id: 'ai-tool-1',
            name: 'API Request Generator',
            description: 'Generate accurate, parameterized API requests from natural language prompts.',
            category: 'Generation',
            icon: <FiCode />,
            isPremium: false
        },
        {
            id: 'ai-tool-2',
            name: 'Response Analyzer',
            description: 'Extract insights, detect anomalies, and parse complex API payloads automatically.',
            category: 'Analysis',
            icon: <FiActivity />,
            isPremium: true
        },
        {
            id: 'ai-tool-3',
            name: 'Test Case Builder',
            description: 'Auto-generate comprehensive test suites covering edge cases and error states.',
            category: 'Testing',
            icon: <FiFileText />,
            isPremium: false
        },
        {
            id: 'ai-tool-4',
            name: 'Schema Validator',
            description: 'Validate OpenAPI/GraphQL schemas and suggest structural improvements.',
            category: 'Validation',
            icon: <FiCheckCircle />,
            isPremium: true
        }
    ];

    return (
        <div className="ai-agent-tools-section">
            <div className="ai-tools-section">
                <header className="ai-tools-header">
                    <h2><FiCpu className="header-icon" /> AI Agent Tools</h2>
                    <p>Advanced AI-powered tools to accelerate your API development, testing, and monitoring workflows.</p>
                </header>

                <div className="ai-tools-grid">
                    {aiTools.map(tool => (
                        <div key={tool.id} className="ai-tool-card">
                            <div className="ai-tool-header">
                                <div className="ai-tool-icon">
                                    {tool.icon}
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
                        <h3>Build Custom Agents</h3>
                        <p>Create specialized AI agents tailored to your specific API workflows, authorization schemes, and business rules.</p>
                        <ul className="agent-benefits">
                            <li>Automate repetitive manual API tasks</li>
                            <li>Create custom data transformation pipelines</li>
                            <li>Deploy intelligent monitoring & alerting</li>
                        </ul>
                        <button className="create-agent-btn">
                            <FiPlus /> Create Custom Agent
                        </button>
                    </div>
                    <div className="custom-agent-image">
                        <div className="image-placeholder">
                            <FiCpu size={56} />
                        </div>
                    </div>
                </div>

                <div className="ai-tools-insights">
                    <h3>Impact Metrics</h3>
                    <div className="insights-stats">
                        <div className="stat-item">
                            <span className="stat-value">87%</span>
                            <span className="stat-label">Reduction in test authoring time</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value">3.5x</span>
                            <span className="stat-label">Faster root-cause debugging</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value">10k+</span>
                            <span className="stat-label">Requests generated daily</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIAgentToolsSection;
