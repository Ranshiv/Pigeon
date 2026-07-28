import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, useReducedMotion, useScroll, useSpring } from 'framer-motion';
import {
    FiActivity, FiArrowDown, FiArrowRight, FiBarChart2, FiCheck, FiChevronDown,
    FiCode, FiGithub, FiGlobe, FiLayers, FiPlay, FiSend, FiShield,
    FiSliders, FiUsers, FiZap
} from 'react-icons/fi';
import { getGoogleAuthUrl } from '../utils/apiBaseUrl';
import './PublicHome.css';

const REQUESTS = [
    { method: 'GET', name: 'List projects', url: 'https://api.pigeon.dev/v1/projects', status: '200 OK', time: '82 ms', response: '{\n  "projects": [\n    { "id": "prj_01", "name": "Checkout API", "status": "healthy" },\n    { "id": "prj_02", "name": "Mobile gateway", "status": "healthy" }\n  ]\n}' },
    { method: 'POST', name: 'Create deployment', url: 'https://api.pigeon.dev/v1/deployments', status: '201 Created', time: '124 ms', response: '{\n  "id": "dep_2391",\n  "environment": "production",\n  "state": "queued",\n  "createdAt": "2026-07-28T14:32:00Z"\n}' },
    { method: 'PUT', name: 'Update environment', url: 'https://api.pigeon.dev/v1/environments/prod', status: '200 OK', time: '96 ms', response: '{\n  "id": "env_production",\n  "name": "Production",\n  "variables": 12,\n  "updated": true\n}' },
    { method: 'DELETE', name: 'Remove test run', url: 'https://api.pigeon.dev/v1/test-runs/run_842', status: '204 No Content', time: '71 ms', response: '{\n  "success": true,\n  "message": "Test run removed"\n}' }
];

const FEATURES = [
    { icon: FiSend, title: 'A request workspace that stays out of your way', copy: 'Compose, replay, and compare every call in one focused surface.', type: 'wide' },
    { icon: FiActivity, title: 'Latency with context', copy: 'See what changed before your users feel it.', type: 'wide graph' },
    { icon: FiShield, title: 'Confidence built in', copy: 'Keep schemas, contracts, and checks close to every request.' },
    { icon: FiCheck, title: 'Tests that tell a story', copy: 'Turn known-good behavior into checks your team can trust.', type: 'tests' },
    { icon: FiUsers, title: 'Work together in the flow', copy: 'Review changes and leave the decision trail beside the API.' }
];

const WORKFLOW = [
    ['01', 'Send a request', 'Start with a saved request, a raw endpoint, or a shared collection.', 'POST', 'Create checkout'],
    ['02', 'Inspect the response', 'Read status, timing, headers, and payload as one clear signal.', '201', '124 ms'],
    ['03', 'Write tests', 'Capture expectations while the behavior is fresh and visible.', '3/3', 'checks passing'],
    ['04', 'Collaborate with your team', 'Bring reviews, decisions, and changes into the same workspace.', '4', 'active collaborators'],
    ['05', 'Observe in production', 'Connect real production signals back to the request that matters.', '99.98%', 'availability']
];

const TESTIMONIALS = [
    ['“Pigeon made the handoff between building an endpoint and trusting it in production feel like one conversation.”', 'Maya Chen', 'Staff Engineer', 'Northstar'],
    ['“Our team finally has the request, the test, and the incident context in the same place.”', 'David Okafor', 'Platform Lead', 'Arcade Cloud'],
    ['“It is the rare API tool that gets calmer as our system gets more complex.”', 'Elena Rossi', 'Developer Experience', 'Atelier']
];

const reveal = { hidden: { opacity: 0, y: 28 }, visible: { opacity: 1, y: 0 } };
const spring = { type: 'spring', stiffness: 180, damping: 22 };

function Reveal({ children, className = '', delay = 0 }) {
    const reduced = useReducedMotion();
    const ref = useRef(null);
    const inView = useInView(ref, { once: true, amount: 0.2 });
    return <motion.div ref={ref} className={className} variants={reveal} initial="hidden" animate={inView || reduced ? 'visible' : 'hidden'} transition={{ ...spring, delay: reduced ? 0 : delay }}>{children}</motion.div>;
}

function MarketingButton({ children, secondary = false, ...props }) {
    return <motion.a className={`pigeon-button${secondary ? ' pigeon-button--secondary' : ''}`} whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }} transition={spring} {...props}>{children}</motion.a>;
}

function ProductDemo() {
    const [selected, setSelected] = useState(1);
    const [tab, setTab] = useState('Body');
    const [sending, setSending] = useState(false);
    const [typed, setTyped] = useState('');
    const [editorTyped, setEditorTyped] = useState('');
    const reduced = useReducedMotion();
    const request = REQUESTS[selected];
    const editorContent = tab === 'Body'
        ? '{\n  "project": "checkout",\n  "environment": "production",\n  "notify": true\n}'
        : tab === 'Headers'
            ? 'Authorization: Bearer ••••••••\nContent-Type: application/json\nX-Pigeon-Source: workspace'
            : 'region=us-east-1\ninclude=health\nexpand=owner';
    useEffect(() => { setTyped(''); setSending(false); }, [selected]);
    useEffect(() => {
        if (reduced) { setEditorTyped(editorContent); return undefined; }
        setEditorTyped('');
        let index = 0;
        const intervalId = window.setInterval(() => {
            index += 1;
            setEditorTyped(editorContent.slice(0, index));
            if (index >= editorContent.length) window.clearInterval(intervalId);
        }, 18);
        return () => window.clearInterval(intervalId);
    }, [editorContent, reduced, selected, tab]);
    useEffect(() => {
        if (!sending) return undefined;
        let index = 0;
        let intervalId;
        const starter = window.setTimeout(() => {
            intervalId = window.setInterval(() => {
                index += 2;
                setTyped(request.response.slice(0, index));
                if (index >= request.response.length) { window.clearInterval(intervalId); setSending(false); }
            }, 12);
        }, 420);
        return () => {
            window.clearTimeout(starter);
            if (intervalId) window.clearInterval(intervalId);
        };
    }, [sending, request.response]);
    const send = () => { setTyped(''); setSending(true); };
    return <section className="pigeon-section pigeon-demo-section" id="product" aria-labelledby="product-title"><Reveal className="pigeon-section-heading pigeon-centered-heading"><p className="pigeon-kicker">A workspace in motion</p><h2 id="product-title">Every request gets a <em>clearer path.</em></h2><p>Explore a Pigeon workspace without leaving the page.</p></Reveal><Reveal delay={0.08}><div className="pigeon-demo" aria-label="Interactive simulated API request workspace"><aside className="pigeon-demo-sidebar"><div className="pigeon-demo-sidebar-title"><FiLayers /> Checkout service <span>4 requests</span></div>{REQUESTS.map((item, index) => <button type="button" key={item.name} className={selected === index ? 'is-active' : ''} onClick={() => setSelected(index)}><b className={`method-${item.method.toLowerCase()}`}>{item.method}</b><span>{item.name}</span><i /></button>)}<div className="pigeon-demo-sidebar-footer"><span /> Production</div></aside><div className="pigeon-demo-main"><div className="pigeon-demo-windowbar"><span><i /><i /><i /></span><b>requests / checkout-service</b><small>Saved just now</small></div><div className="pigeon-demo-topbar"><button type="button" className={`pigeon-method-select method-${request.method.toLowerCase()}`}>{request.method} <FiChevronDown /></button><input aria-label="Request URL" value={request.url} readOnly /><button type="button" className="pigeon-send" onClick={send} disabled={sending}>{sending ? <i className="pigeon-spinner" /> : <FiSend />} {sending ? 'Sending…' : 'Send'}</button></div><div className="pigeon-demo-tabs" role="tablist">{['Body', 'Headers', 'Params'].map((item) => <button type="button" role="tab" aria-selected={tab === item} className={tab === item ? 'is-active' : ''} key={item} onClick={() => setTab(item)}>{item}</button>)}</div><div className="pigeon-demo-editor"><div className="pigeon-editor-gutter">{editorContent.split('\n').map((_, index) => <span key={index}>{String(index + 1).padStart(2, '0')}</span>)}</div><pre aria-live="polite">{editorTyped}<i className="pigeon-type-cursor" aria-hidden="true" /></pre><span className="pigeon-editor-hint"><FiZap /> Typing request body</span></div><div className={`pigeon-response${sending ? ' is-sending' : ''}`}><div className="pigeon-response-heading"><span>Response</span>{sending ? <span className="pigeon-sending"><i /> Sending request</span> : typed ? <motion.b initial={{ scale: 0.75, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring}><FiCheck /> {request.status}</motion.b> : <small>Ready to send</small>}<small>{typed && request.time}</small></div><pre>{typed || (sending ? 'Connecting to production…' : '// Send a request to inspect its response')}</pre>{!typed && !sending ? <div className="pigeon-response-empty"><span><FiActivity /></span><p>Run the request to stream its response here.</p></div> : null}</div></div></div></Reveal></section>;
}

function FeatureVisual({ type }) {
    if (type === 'wide graph') return <div className="pigeon-latency-graph" aria-hidden="true"><span>p95 latency</span><svg viewBox="0 0 300 76" preserveAspectRatio="none"><path d="M0 57 C32 48 38 61 68 43 S104 53 131 29 S174 45 204 25 S246 36 300 10" /><circle cx="204" cy="25" r="4" /></svg><small>84 ms <FiArrowRight /> 62 ms</small></div>;
    if (type === 'tests') return <div className="pigeon-test-runner" aria-hidden="true">{['status is 201', 'schema matches', 'latency under 200ms'].map((item, index) => <span key={item} style={{ '--test-delay': `${index * 0.4}s` }}><FiCheck /> {item}</span>)}</div>;
    return null;
}

function Features() { return <section className="pigeon-section" id="features" aria-labelledby="features-title"><Reveal className="pigeon-section-heading"><p className="pigeon-kicker">Built for the whole journey</p><h2 id="features-title">Less switching. <em>More signal.</em></h2></Reveal><div className="pigeon-feature-grid">{FEATURES.map((feature, index) => { const Icon = feature.icon; return <Reveal key={feature.title} className={`pigeon-feature-card ${feature.type || ''}`} delay={index * 0.06}><motion.div whileHover={{ y: -7 }} transition={spring}><Icon className="pigeon-feature-icon" /><h3>{feature.title}</h3><p>{feature.copy}</p><FeatureVisual type={feature.type} /></motion.div></Reveal>; })}</div></section>; }

function Workflow() { const { scrollYProgress } = useScroll(); const progress = useSpring(scrollYProgress, { stiffness: 110, damping: 30 }); return <section className="pigeon-section pigeon-workflow" id="workflow" aria-labelledby="workflow-title"><Reveal className="pigeon-section-heading"><p className="pigeon-kicker">One connected workflow</p><h2 id="workflow-title">Follow the request. <em>Keep the context.</em></h2></Reveal><div className="pigeon-workflow-list"><motion.i className="pigeon-workflow-line" style={{ scaleY: progress }} aria-hidden="true" />{WORKFLOW.map(([number, title, copy, metric, label], index) => <Reveal key={title} className="pigeon-workflow-step" delay={index * 0.05}><div className="pigeon-workflow-copy"><span>{number}</span><h3>{title}</h3><p>{copy}</p></div><div className="pigeon-workflow-card"><b>{metric}</b><small>{label}</small><i /><i /><i /></div></Reveal>)}</div></section>; }

function MarketingFooter() { const groups = [['Product', [['Workspace', '/workspace'], ['API Network', '/workspace/api-network'], ['Monitoring', '/workspace/monitoring']]], ['Developers', [['Documentation', '/documentation'], ['GitHub', 'https://github.com/Ranshiv/Pigeon'], ['Workflow', '#workflow']]], ['Company', [['About Pigeon', '#top'], ['Customer stories', '#testimonials'], ['Contact', 'mailto:support@pigeonapp.io']]], ['Legal', [['Privacy', '/privacy'], ['Terms', '/terms']]]]; return <footer className="pigeon-marketing-footer"><div className="pigeon-footer-grid"><div><a className="pigeon-wordmark" href="#top"><span>P</span> Pigeon</a><p>One focused home for building, testing, and operating APIs.</p><a className="pigeon-social" href="https://github.com/Ranshiv/Pigeon" target="_blank" rel="noreferrer"><FiGithub /> GitHub</a></div>{groups.map(([title, links]) => <div key={title}><h3>{title}</h3>{links.map(([label, href]) => href.startsWith('/') ? <Link key={label} to={href}>{label}</Link> : <a key={label} href={href}>{label}</a>)}</div>)}</div><div className="pigeon-footer-bottom"><span>© {new Date().getFullYear()} Pigeon. All rights reserved.</span><span>Built for APIs that keep moving.</span></div></footer>; }

function PublicHome() {
    const reduced = useReducedMotion();
    const trusted = useMemo(() => ['northstar', 'vanta', 'arcade', 'linear', 'relay', 'fathom'], []);
    useEffect(() => {
        document.body.classList.add('pigeon-marketing-body');
        return () => document.body.classList.remove('pigeon-marketing-body');
    }, []);
    return <div className="pigeon-marketing" id="top"><main><section className="pigeon-hero" aria-labelledby="hero-title"><motion.div className="pigeon-hero-copy" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: reduced ? 0 : 0.1 } } }}><motion.a href="#product" className="pigeon-announcement" variants={reveal} transition={spring}><span>What’s new</span><b>v1.0 <FiArrowRight /></b></motion.a><motion.h1 id="hero-title" variants={reveal} transition={spring}>The API workspace<br />that keeps every signal<br /><em>in one flight path.</em></motion.h1><motion.p variants={reveal} transition={spring}>Pigeon brings requests, tests, collaboration, and production context into one focused flow.</motion.p><motion.div className="pigeon-hero-actions" variants={reveal} transition={spring}><MarketingButton href={getGoogleAuthUrl()}>Start building free <FiArrowRight /></MarketingButton><MarketingButton secondary href="#product"><FiPlay /> Watch the workspace</MarketingButton></motion.div></motion.div><motion.div className="pigeon-trusted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduced ? 0 : 0.55 }}><span>Trusted by teams building</span><div><div>{[...trusted, ...trusted].map((name, index) => <b key={`${name}-${index}`}>{name}</b>)}</div></div></motion.div><a className="pigeon-scroll-cue" href="#product">Scroll to explore <FiArrowDown /></a></section><ProductDemo /><Features /><Workflow /><section className="pigeon-section pigeon-testimonials" id="testimonials" aria-labelledby="stories-title"><Reveal className="pigeon-section-heading pigeon-centered-heading"><p className="pigeon-kicker">From teams in the flow</p><h2 id="stories-title">Built for people who <em>ship together.</em></h2></Reveal><div className="pigeon-quote-grid">{TESTIMONIALS.map(([quote, name, role, company], index) => <Reveal key={name} delay={index * 0.08}><figure><blockquote>{quote}</blockquote><figcaption><span>{name}<small>{role}</small></span><b>{company}</b></figcaption></figure></Reveal>)}</div></section><section className="pigeon-final-cta"><Reveal><div><p className="pigeon-kicker">Your next request starts here</p><h2>Give every API a <em>place to land.</em></h2><p>One workspace for the work that turns an API into a reliable product.</p><div className="pigeon-hero-actions"><MarketingButton href={getGoogleAuthUrl()}>Start with Pigeon <FiArrowRight /></MarketingButton><MarketingButton secondary href="/documentation">Read the docs <FiCode /></MarketingButton></div></div></Reveal></section></main><MarketingFooter /></div>;
}

export default PublicHome;
