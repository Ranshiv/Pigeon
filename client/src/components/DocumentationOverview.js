import React from 'react';
import { Link } from 'react-router-dom';
import './DocumentationOverview.css';
import {
    FiArrowRight,
    FiBarChart2,
    FiBookOpen,
    FiBriefcase,
    FiClipboard,
    FiCode,
    FiCpu,
    FiDatabase,
    FiFileText,
    FiFolder,
    FiGlobe,
    FiHome,
    FiMonitor,
    FiRefreshCw,
    FiSend,
    FiShield,
    FiTerminal,
    FiTool,
    FiUsers
} from 'react-icons/fi';

const documentationSections = [
    {
        title: 'Get started',
        description: 'Set up Pigeon and learn the essentials for making your first API call.',
        icon: FiHome,
        links: [
            ['Installation', '/documentation/getting-started/installation'],
            ['Your first request', '/documentation/getting-started/your-first-request'],
            ['Navigate the workspace', '/documentation/getting-started/pigeon-UI']
        ]
    },
    {
        title: 'Send requests',
        description: 'Build requests, work with responses, and authenticate against your APIs.',
        icon: FiSend,
        links: [
            ['Send API requests', '/documentation/requests/sending-requests'],
            ['Handle responses', '/documentation/requests/response-handling'],
            ['Authorization', '/documentation/requests/authorization']
        ]
    },
    {
        title: 'Write scripts',
        description: 'Use the Pigeon runtime to add dynamic behaviour before and after a request.',
        icon: FiCode,
        links: [
            ['Pre-request scripts', '/documentation/scripting/pre-request-scripts'],
            ['Test scripts', '/documentation/scripting/test-scripts'],
            ['Using variables', '/documentation/scripting/variables']
        ]
    },
    {
        title: 'Use collections',
        description: 'Organize related requests in a workspace, run them together, and share them.',
        icon: FiFolder,
        links: [
            ['Create collections', '/documentation/collections/creating-collections'],
            ['Run collections', '/documentation/collections/running-collections'],
            ['Share collections', '/documentation/collections/sharing']
        ]
    },
    {
        title: 'Build flows',
        description: 'Create visual API workflows and chain requests into reusable automations.',
        icon: FiRefreshCw,
        links: [
            ['Introduction to flows', '/documentation/flows/introduction'],
            ['Build workflows', '/documentation/flows/building-workflows'],
            ['Advanced flow features', '/documentation/flows/advanced-features']
        ]
    },
    {
        title: 'Use the Pigeon CLI',
        description: 'Run collections securely from the command line and integrate them with CI/CD.',
        icon: FiTerminal,
        links: [
            ['CLI installation', '/documentation/cli/installation'],
            ['Run collections', '/documentation/cli/running-collections'],
            ['CI/CD integration', '/documentation/cli/ci-cd-integration']
        ]
    },
    {
        title: 'Collaborate',
        description: 'Invite teammates, coordinate changes, and use version control in a workspace.',
        icon: FiUsers,
        links: [
            ['Team workspaces', '/documentation/collaboration/workspaces'],
            ['Real-time collaboration', '/documentation/collaboration/real-time'],
            ['Version control', '/documentation/collaboration/version-control']
        ]
    },
    {
        title: 'Design and develop APIs',
        description: 'Work API-first with specifications, the API Builder, and integrated testing.',
        icon: FiFileText,
        links: [
            ['API Builder', '/documentation/api-development/api-builder'],
            ['OpenAPI support', '/documentation/api-development/openapi-support'],
            ['API testing', '/documentation/api-development/api-testing']
        ]
    },
    {
        title: 'Document your API',
        description: 'Create, publish, and tailor clear documentation for every collection and API.',
        icon: FiClipboard,
        links: [
            ['Auto-documentation', '/documentation/api-documentation/auto-documentation'],
            ['Publish documentation', '/documentation/api-documentation/publishing'],
            ['Customize documentation', '/documentation/api-documentation/customization']
        ]
    },
    {
        title: 'Monitor your API',
        description: 'Track API health and performance, then act on alerts when something changes.',
        icon: FiMonitor,
        links: [
            ['Set up monitors', '/documentation/monitoring/setting-up'],
            ['Performance metrics', '/documentation/monitoring/performance-metrics'],
            ['Alerts and notifications', '/documentation/monitoring/alerts']
        ]
    },
    {
        title: 'Governance and security',
        description: 'Set standards, find weaknesses, and report on your API security posture.',
        icon: FiShield,
        links: [
            ['Governance rules', '/documentation/governance/rules'],
            ['Security testing', '/documentation/governance/security-testing'],
            ['Compliance reporting', '/documentation/governance/reporting']
        ]
    },
    {
        title: 'Administration',
        description: 'Manage your team, access controls, and the settings that shape your workspace.',
        icon: FiBriefcase,
        links: [
            ['Team management', '/documentation/admin/team-management'],
            ['Access control', '/documentation/admin/access-control'],
            ['Settings configuration', '/documentation/admin/settings']
        ]
    },
    {
        title: 'Use reports',
        description: 'Understand how your team uses Pigeon with usage, security, and API reports.',
        icon: FiBarChart2,
        links: [
            ['Usage reports', '/documentation/reports/usage-reports'],
            ['Security reports', '/documentation/reports/security-reports'],
            ['API metrics', '/documentation/reports/api-metrics']
        ]
    },
    {
        title: 'AI agent tools',
        description: 'Use Pigeon AI to accelerate testing, analyze APIs, and generate documentation.',
        icon: FiCpu,
        links: [
            ['Test generation', '/documentation/ai-tools/test-generation'],
            ['API analysis', '/documentation/ai-tools/api-analysis'],
            ['Auto-documentation', '/documentation/ai-tools/auto-documentation']
        ]
    },
    {
        title: 'Environments',
        description: 'Keep variables and secrets organized across local, staging, and production work.',
        icon: FiDatabase,
        links: [
            ['Set up environments', '/documentation/environments/setup'],
            ['Work with variables', '/documentation/environments/variables'],
            ['Manage secrets', '/documentation/environments/secrets']
        ]
    },
    {
        title: 'Developer resources',
        description: 'Connect Pigeon to your development workflow with APIs, SDKs, and extensions.',
        icon: FiTool,
        links: [
            ['Pigeon API reference', '/documentation/developer/api-reference'],
            ['SDK documentation', '/documentation/developer/sdk'],
            ['Create extensions', '/documentation/developer/extensions']
        ]
    },
    {
        title: 'Integrations',
        description: 'Connect the tools your team already uses to keep API work moving smoothly.',
        icon: FiGlobe,
        links: [
            ['GitHub', '/documentation/integrations/github'],
            ['Jenkins', '/documentation/integrations/jenkins'],
            ['Slack', '/documentation/integrations/slack']
        ]
    }
];

const resourceGroups = [
    {
        title: 'Collection templates',
        links: [
            ['Integration testing', '/templates/integration-testing'],
            ['REST API basics', '/templates/rest-api-basics'],
            ['API documentation', '/templates/api-documentation']
        ]
    },
    {
        title: 'Flow templates',
        links: [
            ['Data transformation', '/flow-templates/data-transformation'],
            ['API chaining', '/flow-templates/api-chaining'],
            ['Webhook processing', '/flow-templates/webhook-processing']
        ]
    },
    {
        title: 'Popular videos',
        links: [
            ['Build API applications with flows', 'https://youtube.com/pigeon/flows-tutorial'],
            ['API basics', 'https://youtube.com/pigeon/api-basics'],
            ['API testing fundamentals', 'https://youtube.com/pigeon/testing-tutorial']
        ]
    }
];

const communityLinks = [
    ['GitHub', 'https://github.com/pigeon-api'],
    ['Twitter', 'https://twitter.com/pigeonapi'],
    ['Discord', 'https://discord.gg/pigeon'],
    ['Forum', 'https://forum.pigeon.io']
];

const DocumentationOverview = () => (
    <main className="docs-hub">
        <header className="docs-hub-hero">
            <div className="docs-hub-hero-copy">
                <span className="docs-hub-eyebrow"><FiBookOpen /> Documentation hub</span>
                <h1>Everything you need to build with Pigeon.</h1>
                <p>Guides for sending requests, collaborating in workspaces, testing APIs, and building dependable API workflows.</p>
            </div>
            <div className="docs-hub-hero-meta" aria-label="Documentation overview">
                <div><strong>{documentationSections.length}</strong><span>product guides</span></div>
                <div><strong>3</strong><span>resources per guide</span></div>
            </div>
        </header>

        <section className="docs-hub-catalog" aria-labelledby="docs-catalog-heading">
            <div className="docs-hub-section-heading">
                <div>
                    <span className="docs-hub-kicker">Explore</span>
                    <h2 id="docs-catalog-heading">Find the right guide for your workflow</h2>
                </div>
                <p>Start with the basics or jump directly to the capability you need.</p>
            </div>

            <div className="docs-hub-grid">
                {documentationSections.map(({ title, description, icon: Icon, links }) => (
                    <article className="docs-hub-topic" key={title}>
                        <div className="docs-hub-topic-icon" aria-hidden="true"><Icon /></div>
                        <h3>{title}</h3>
                        <p>{description}</p>
                        <ul>
                            {links.map(([label, to]) => (
                                <li key={to}>
                                    <Link to={to}>{label}<FiArrowRight aria-hidden="true" /></Link>
                                </li>
                            ))}
                        </ul>
                    </article>
                ))}
            </div>
        </section>

        <section className="docs-hub-resources" aria-labelledby="docs-resources-heading">
            <div className="docs-hub-section-heading">
                <div>
                    <span className="docs-hub-kicker">More resources</span>
                    <h2 id="docs-resources-heading">Take a shortcut</h2>
                </div>
                <p>Ready-to-use starting points and practical learning resources.</p>
            </div>

            <div className="docs-hub-resource-grid">
                {resourceGroups.map(({ title, links }) => (
                    <article className="docs-hub-resource-card" key={title}>
                        <h3>{title}</h3>
                        <ul>
                            {links.map(([label, href]) => (
                                <li key={href}>
                                    {href.startsWith('http') ? (
                                        <a href={href} target="_blank" rel="noopener noreferrer">{label}<FiArrowRight aria-hidden="true" /></a>
                                    ) : (
                                        <Link to={href}>{label}<FiArrowRight aria-hidden="true" /></Link>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </article>
                ))}
            </div>
        </section>

        <aside className="docs-hub-community">
            <div>
                <span className="docs-hub-kicker">Community</span>
                <h2>Keep learning with the Pigeon community.</h2>
            </div>
            <nav aria-label="Pigeon community links">
                {communityLinks.map(([label, href]) => (
                    <a key={href} href={href} target="_blank" rel="noopener noreferrer">{label}<FiArrowRight aria-hidden="true" /></a>
                ))}
            </nav>
        </aside>
    </main>
);

export default DocumentationOverview;
