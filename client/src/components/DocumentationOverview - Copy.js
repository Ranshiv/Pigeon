import React from 'react';
import { Link } from 'react-router-dom';
import './DocumentationOverview.css';
import {
    FiHome,
    FiSend,
    FiCode,
    FiFolder,
    FiRefreshCw,
    FiShield,
    FiServer,
    FiDatabase,
    FiFileText,
    FiMonitor,
    FiUsers,
    FiTool,
    FiTerminal,
    FiGrid,
    FiCpu,
    FiLock,
    FiBarChart2,
    FiGlobe,
    FiBriefcase,
    FiClipboard
} from 'react-icons/fi';

const DocumentationOverview = () => {
    return (
        <div className="documentation-overview">
            <div className="documentation-header">
                <h1>Pigeon Documentation</h1>
                <p className="documentation-intro">
                    Welcome to the Pigeon Docs! This is the place to find official information on how to use Pigeon in your API projects.
                    If you're learning to carry out a specific task or workflow in Pigeon, check out the following topics to find resources:
                </p>
            </div>

            <div className="documentation-grid">
                <section className="documentation-section">
                    <h2><FiHome /> Get Started</h2>
                    <p>To get started using Pigeon, check out the Get Started section.</p>
                    <div className="documentation-links">
                        <Link to="/documentation/getting-started/installation">Installation</Link>
                        <Link to="/documentation/getting-started/your-first-request">Your First Request</Link>
                        <Link to="/documentation/getting-started/pigeon-UI">Navigating the UI</Link>
                    </div>
                </section>

                <section className="documentation-section">
                    <h2><FiSend /> Send Requests</h2>
                    <p>You can send requests in Pigeon to connect to APIs you are working with.</p>
                    <div className="documentation-links">
                        <Link to="/documentation/requests/sending-requests">Send API Requests</Link>
                        <Link to="/documentation/requests/response-handling">Handling Responses</Link>
                        <Link to="/documentation/requests/authorization">Authorization</Link>
                    </div>
                </section>

                <section className="documentation-section">
                    <h2><FiCode /> Write Scripts</h2>
                    <p>Pigeon has a powerful runtime based on Node.js that enables you to add dynamic behavior to requests and collections.</p>
                    <div className="documentation-links">
                        <Link to="/documentation/scripting/pre-request-scripts">Pre-request Scripts</Link>
                        <Link to="/documentation/scripting/test-scripts">Test Scripts</Link>
                        <Link to="/documentation/scripting/variables">Using Variables</Link>
                    </div>
                </section>

                <section className="documentation-section">
                    <h2><FiFolder /> Use Collections</h2>
                    <p>Pigeon Collections are groups of saved requests that can be organized and run together.</p>
                    <div className="documentation-links">
                        <Link to="/documentation/collections/creating-collections">Create Collections</Link>
                        <Link to="/documentation/collections/running-collections">Run Collections</Link>
                        <Link to="/documentation/collections/sharing">Share Collections</Link>
                    </div>
                </section>

                <section className="documentation-section">
                    <h2><FiRefreshCw /> Use Pigeon Flows</h2>
                    <p>Pigeon Flows is a visual tool for creating API workflows and chaining requests.</p>
                    <div className="documentation-links">
                        <Link to="/documentation/flows/introduction">Introduction to Flows</Link>
                        <Link to="/documentation/flows/building-workflows">Building Workflows</Link>
                        <Link to="/documentation/flows/advanced-features">Advanced Features</Link>
                    </div>
                </section>

                <section className="documentation-section">
                    <h2><FiTerminal /> Use the Pigeon CLI</h2>
                    <p>The Pigeon CLI is a secure command-line companion for Pigeon to run collections and integrate with CI/CD pipelines.</p>
                    <div className="documentation-links">
                        <Link to="/documentation/cli/installation">CLI Installation</Link>
                        <Link to="/documentation/cli/running-collections">Running Collections</Link>
                        <Link to="/documentation/cli/ci-cd-integration">CI/CD Integration</Link>
                    </div>
                </section>

                <section className="documentation-section">
                    <h2><FiUsers /> Collaborate in Pigeon</h2>
                    <p>Pigeon provides tools to enable and enhance collaboration within your team.</p>
                    <div className="documentation-links">
                        <Link to="/documentation/collaboration/workspaces">Team Workspaces</Link>
                        <Link to="/documentation/collaboration/real-time">Real-time Collaboration</Link>
                        <Link to="/documentation/collaboration/version-control">Version Control</Link>
                    </div>
                </section>

                <section className="documentation-section">
                    <h2><FiFileText /> Design and Develop your API</h2>
                    <p>Pigeon supports API-first development with API specifications and the API Builder.</p>
                    <div className="documentation-links">
                        <Link to="/documentation/api-development/api-builder">API Builder</Link>
                        <Link to="/documentation/api-development/openapi-support">OpenAPI Support</Link>
                        <Link to="/documentation/api-development/api-testing">API Testing</Link>
                    </div>
                </section>

                <section className="documentation-section">
                    <h2><FiClipboard /> Document your API</h2>
                    <p>Documentation is an important part of any collection or API to help others understand how it works.</p>
                    <div className="documentation-links">
                        <Link to="/documentation/api-documentation/auto-documentation">Auto-Documentation</Link>
                        <Link to="/documentation/api-documentation/publishing">Publishing Documentation</Link>
                        <Link to="/documentation/api-documentation/customization">Customizing Documentation</Link>
                    </div>
                </section>

                <section className="documentation-section">
                    <h2><FiMonitor /> Monitor your API</h2>
                    <p>Pigeon Monitors give you continuous visibility into the health and performance of your APIs.</p>
                    <div className="documentation-links">
                        <Link to="/documentation/monitoring/setting-up">Setting Up Monitors</Link>
                        <Link to="/documentation/monitoring/performance-metrics">Performance Metrics</Link>
                        <Link to="/documentation/monitoring/alerts">Alerts and Notifications</Link>
                    </div>
                </section>

                <section className="documentation-section">
                    <h2><FiShield /> API Governance and API Security</h2>
                    <p>Pigeon's governance and security features identify inconsistencies or weaknesses in your APIs.</p>
                    <div className="documentation-links">
                        <Link to="/documentation/governance/rules">Governance Rules</Link>
                        <Link to="/documentation/governance/security-testing">Security Testing</Link>
                        <Link to="/documentation/governance/reporting">Compliance Reporting</Link>
                    </div>
                </section>

                <section className="documentation-section">
                    <h2><FiBriefcase /> Administration</h2>
                    <p>Pigeon provides options to customize your team's experience, from setup to ongoing team management.</p>
                    <div className="documentation-links">
                        <Link to="/documentation/admin/team-management">Team Management</Link>
                        <Link to="/documentation/admin/access-control">Access Control</Link>
                        <Link to="/documentation/admin/settings">Settings Configuration</Link>
                    </div>
                </section>

                <section className="documentation-section">
                    <h2><FiBarChart2 /> Use Reports</h2>
                    <p>Pigeon generates reports that enable you to visualize data for how your team uses Pigeon.</p>
                    <div className="documentation-links">
                        <Link to="/documentation/reports/usage-reports">Usage Reports</Link>
                        <Link to="/documentation/reports/security-reports">Security Reports</Link>
                        <Link to="/documentation/reports/api-metrics">API Metrics</Link>
                    </div>
                </section>

                <section className="documentation-section">
                    <h2><FiCpu /> AI Agent Tools</h2>
                    <p>Leverage Pigeon's AI capabilities to enhance your API development and testing workflow.</p>
                    <div className="documentation-links">
                        <Link to="/documentation/ai-tools/test-generation">Test Generation</Link>
                        <Link to="/documentation/ai-tools/api-analysis">API Analysis</Link>
                        <Link to="/documentation/ai-tools/auto-documentation">Auto-Documentation</Link>
                    </div>
                </section>

                <section className="documentation-section">
                    <h2><FiDatabase /> Environments</h2>
                    <p>Use environments to store and manage variables across different development stages.</p>
                    <div className="documentation-links">
                        <Link to="/documentation/environments/setup">Setting Up Environments</Link>
                        <Link to="/documentation/environments/variables">Working with Variables</Link>
                        <Link to="/documentation/environments/secrets">Managing Secrets</Link>
                    </div>
                </section>

                <section className="documentation-section">
                    <h2><FiTool /> Developer Resources</h2>
                    <p>If you're integrating Pigeon with your CI/CD workflow or developing with Pigeon APIs, check out these resources.</p>
                    <div className="documentation-links">
                        <Link to="/documentation/developer/api-reference">Pigeon API Reference</Link>
                        <Link to="/documentation/developer/sdk">SDK Documentation</Link>
                        <Link to="/documentation/developer/extensions">Creating Extensions</Link>
                    </div>
                </section>

                <section className="documentation-section">
                    <h2><FiGlobe /> Integrations</h2>
                    <p>Connect Pigeon to your API workflows with integrations for popular third-party solutions.</p>
                    <div className="documentation-links">
                        <Link to="/documentation/integrations/github">GitHub</Link>
                        <Link to="/documentation/integrations/jenkins">Jenkins</Link>
                        <Link to="/documentation/integrations/slack">Slack</Link>
                    </div>
                </section>
            </div>

            <div className="documentation-footer">
                <h3>Additional Resources</h3>
                <div className="resource-grid">
                    <div className="resource-card">
                        <h4>Collection Templates</h4>
                        <ul>
                            <li><Link to="/templates/integration-testing">Integration Testing</Link></li>
                            <li><Link to="/templates/rest-api-basics">REST API Basics</Link></li>
                            <li><Link to="/templates/api-documentation">API Documentation</Link></li>
                        </ul>
                    </div>

                    <div className="resource-card">
                        <h4>Flow Templates</h4>
                        <ul>
                            <li><Link to="/flow-templates/data-transformation">Data Transformation</Link></li>
                            <li><Link to="/flow-templates/api-chaining">API Chaining</Link></li>
                            <li><Link to="/flow-templates/webhook-processing">Webhook Processing</Link></li>
                        </ul>
                    </div>

                    <div className="resource-card">
                        <h4>Popular Videos</h4>
                        <ul>
                            <li><a href="https://youtube.com/pigeon/flows-tutorial">Pigeon Flows: Build API Applications</a></li>
                            <li><a href="https://youtube.com/pigeon/api-basics">API Basics: What is an API?</a></li>
                            <li><a href="https://youtube.com/pigeon/testing-tutorial">API Testing Fundamentals</a></li>
                        </ul>
                    </div>
                </div>

                <div className="join-community">
                    <h3>Join the Pigeon Community</h3>
                    <div className="community-links">
                        <a href="https://github.com/pigeon-api" target="_blank" rel="noopener noreferrer">GitHub</a>
                        <a href="https://twitter.com/pigeonapi" target="_blank" rel="noopener noreferrer">Twitter</a>
                        <a href="https://discord.gg/pigeon" target="_blank" rel="noopener noreferrer">Discord</a>
                        <a href="https://forum.pigeon.io" target="_blank" rel="noopener noreferrer">Forum</a>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default DocumentationOverview;