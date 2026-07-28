import React from 'react';
import { FiArrowLeft, FiFileText, FiMail, FiShield } from 'react-icons/fi';
import { Link, useLocation } from 'react-router-dom';
import './LegalPage.css';

const LAST_UPDATED = 'July 28, 2026';

const privacySections = [
    {
        title: 'Information we collect',
        body: <>
            <p>We collect information needed to provide and secure Pigeon. This may include your name, email address, profile details, authentication information, workspace memberships, and preferences.</p>
            <p>When you use Pigeon, we also process the API content you choose to store or send through the service, including collections, requests, environments, variables, documentation, test results, comments, reviews, monitoring configuration, and audit activity.</p>
            <p>We collect technical information such as browser and device details, approximate location from your IP address, log data, and product usage events to operate, troubleshoot, and improve the platform.</p>
        </>
    },
    {
        title: 'How we use information',
        body: <>
            <p>We use information to authenticate users, provide workspaces and collaboration, execute and record API workflows, deliver monitoring and notifications, maintain security, respond to support requests, and improve Pigeon.</p>
            <p>We may use aggregated or de-identified information to understand product performance and usage. We do not use your private API content to advertise to you.</p>
        </>
    },
    {
        title: 'API content and sensitive values',
        body: <>
            <p>You remain responsible for the API content, credentials, tokens, secrets, and other data you add to Pigeon. Use environment variables and the security controls available in your workspace rather than placing secrets in shared collections or documentation.</p>
            <p>Some features, such as API requests, monitoring, imports, integrations, mock servers, and AI-assisted tools, require Pigeon to process the data needed to perform the action you request. Review the destination and permissions of connected services before enabling them.</p>
        </>
    },
    {
        title: 'Sharing and service providers',
        body: <>
            <p>Workspace owners and members can see information shared within their workspace according to the workspace’s permissions. Public documentation or status pages are visible to anyone who receives their public URL.</p>
            <p>We use service providers for hosting, databases, authentication, email, analytics, monitoring, and integrations. They may process information only to provide services to Pigeon and under appropriate confidentiality and security obligations.</p>
        </>
    },
    {
        title: 'Retention and deletion',
        body: <p>We retain account and workspace information while it is needed to provide the service, meet legal obligations, resolve disputes, and enforce agreements. You can request deletion of your account or personal information by contacting us. Workspace data may also be controlled by the workspace owner, and backups may persist for a limited period after deletion.</p>
    },
    {
        title: 'Your choices and rights',
        body: <p>Depending on where you live, you may have rights to access, correct, export, delete, or restrict the processing of your personal information. You can update certain profile and workspace settings in Pigeon. To make a privacy request, contact <a href="mailto:support@pigeonapp.io">support@pigeonapp.io</a>.</p>
    },
    {
        title: 'Security and changes',
        body: <>
            <p>We use technical and organizational safeguards designed to protect information. No online service can guarantee absolute security, so please report suspected vulnerabilities or account misuse promptly.</p>
            <p>We may update this policy as Pigeon changes. We will post the revised version here and update the date above. Material changes may also be communicated through the service or by email.</p>
        </>
    }
];

const termsSections = [
    {
        title: 'Using Pigeon',
        body: <p>Pigeon provides tools for building, testing, documenting, monitoring, and collaborating on APIs. You may use the service only if you can form a binding agreement and only in compliance with applicable laws and the rules in these Terms.</p>
    },
    {
        title: 'Your account and workspace',
        body: <p>You are responsible for keeping your account credentials secure and for activity performed through your account. Workspace owners and administrators control membership, permissions, shared content, integrations, and retention settings for their workspaces. Tell us promptly if you believe your account has been compromised.</p>
    },
    {
        title: 'Your content',
        body: <p>You retain ownership of the collections, API definitions, requests, documentation, code, test data, and other content you submit to Pigeon. You grant Pigeon the limited rights needed to host, process, display, transmit, and back up that content to provide the features you use. You must have the rights and permissions required to submit and share it.</p>
    },
    {
        title: 'Acceptable use',
        body: <>
            <p>You may not use Pigeon to:</p>
            <ul>
                <li>break the law, violate another person’s rights, or access systems without authorization;</li>
                <li>distribute malware, abuse APIs, conduct attacks, or interfere with the service;</li>
                <li>misuse credentials, secrets, monitoring, load testing, fuzz testing, or mock services;</li>
                <li>reverse engineer, resell, or reproduce Pigeon except as permitted by law; or</li>
                <li>circumvent usage limits, security controls, or access restrictions.</li>
            </ul>
            <p>We may suspend or restrict access when reasonably necessary to protect Pigeon, users, connected systems, or the public.</p>
        </>
    },
    {
        title: 'Third-party services and integrations',
        body: <p>Pigeon can connect to third-party services and external APIs. Those services are governed by their own terms and privacy policies. You authorize Pigeon to make the requests and exchange data required by an integration you configure, and you are responsible for the permissions and activity of that connection.</p>
    },
    {
        title: 'Availability and changes',
        body: <p>We work to keep Pigeon reliable, but the service may change, be interrupted, or include errors. We may add, modify, or remove features and may perform maintenance. We do not guarantee that every API, integration, request, monitor, or test will be available or successful.</p>
    },
    {
        title: 'Disclaimers and liability',
        body: <p>To the extent permitted by law, Pigeon is provided “as is” and “as available,” without warranties not expressly stated in these Terms. To the extent permitted by law, Pigeon and its providers will not be liable for indirect, incidental, special, consequential, or punitive damages, or for loss of data, revenue, or profits arising from your use of the service.</p>
    },
    {
        title: 'Termination and contact',
        body: <p>You may stop using Pigeon at any time. We may suspend or terminate access for a material breach, security risk, legal requirement, or service discontinuation. Provisions that should reasonably survive termination will continue to apply. Questions about these Terms can be sent to <a href="mailto:support@pigeonapp.io">support@pigeonapp.io</a>.</p>
    }
];

const LegalPage = () => {
    const location = useLocation();
    const isTerms = location.pathname === '/terms';
    const title = isTerms ? 'Terms of Service' : 'Privacy Policy';
    const intro = isTerms
        ? 'The rules for using Pigeon to build, test, monitor, and collaborate on APIs.'
        : 'How Pigeon handles account, workspace, API, and product information.';
    const sections = isTerms ? termsSections : privacySections;
    const Icon = isTerms ? FiFileText : FiShield;

    return (
        <main className="legal-page">
            <div className="legal-page-shell">
                <Link className="legal-back-link" to="/"><FiArrowLeft aria-hidden="true" /> Back to Pigeon</Link>
                <header className="legal-hero">
                    <div className="legal-eyebrow"><Icon aria-hidden="true" /> Pigeon legal</div>
                    <h1>{title}</h1>
                    <p>{intro}</p>
                    <div className="legal-meta">Last updated {LAST_UPDATED}</div>
                </header>

                <div className="legal-layout">
                    <aside className="legal-toc" aria-label="On this page">
                        <span>On this page</span>
                        {sections.map((section, index) => <a key={section.title} href={`#legal-section-${index + 1}`}>{section.title}</a>)}
                    </aside>
                    <article className="legal-content">
                        <div className="legal-callout"><FiMail aria-hidden="true" /><span>Questions or requests? <a href="mailto:support@pigeonapp.io">Contact support@pigeonapp.io</a>.</span></div>
                        {sections.map((section, index) => <section className="legal-section" id={`legal-section-${index + 1}`} key={section.title}><h2>{index + 1}. {section.title}</h2>{section.body}</section>)}
                    </article>
                </div>
            </div>
        </main>
    );
};

export default LegalPage;
