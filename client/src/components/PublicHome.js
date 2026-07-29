import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useInView, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';
import {
    FiActivity, FiArrowDown, FiArrowRight, FiBarChart2, FiCheck,
    FiCode, FiGithub, FiGlobe, FiLayers, FiPlay, FiSend, FiShield,
    FiSliders, FiUsers, FiZap
} from 'react-icons/fi';
import { getApiBaseUrl, getGoogleAuthUrl } from '../utils/apiBaseUrl';
import AppSelect from './common/AppSelect/AppSelect';
import Ferrofluid from './Ferrofluid';
import './PublicHome.css';

const REQUESTS = [
    { method: 'GET', name: 'Get a post', url: 'https://jsonplaceholder.typicode.com/posts/1', body: '' },
    { method: 'POST', name: 'Create a post', url: 'https://jsonplaceholder.typicode.com/posts', body: '{\n  "title": "Ship the checkout flow",\n  "body": "A real request from the Pigeon landing page.",\n  "userId": 7\n}' },
    { method: 'PUT', name: 'Update a post', url: 'https://jsonplaceholder.typicode.com/posts/1', body: '{\n  "id": 1,\n  "title": "Checkout API",\n  "body": "Updated through Pigeon.",\n  "userId": 7\n}' },
    { method: 'PATCH', name: 'Patch a post', url: 'https://jsonplaceholder.typicode.com/posts/1', body: '{\n  "title": "Checkout API — patched",\n  "body": "Only the changed fields are sent."\n}' },
    { method: 'DELETE', name: 'Delete a post', url: 'https://jsonplaceholder.typicode.com/posts/1', body: '' }
];

const FEATURES = [
    { icon: FiSend, title: 'A request workspace that stays out of your way', copy: 'Compose, replay, and compare every call in one focused surface.', type: 'wide' },
    { icon: FiActivity, title: 'Latency with context', copy: 'See what changed before your users feel it.', type: 'wide graph' },
    { icon: FiShield, title: 'Confidence built in', copy: 'Keep schemas, contracts, and checks close to every request.' },
    { icon: FiCheck, title: 'Tests that tell a story', copy: 'Turn known-good behavior into checks your team can trust.', type: 'tests' },
    { icon: FiUsers, title: 'Work together in the flow', copy: 'Review changes and leave the decision trail beside the API.' }
];

const WORKFLOW = [
    { number: '01', title: 'Build in one request workspace', copy: 'Organize requests, variables, environments, and history in shared collections.', metric: 'Collections', label: 'Requests, variables & environments', features: ['Collections', 'Environments', 'History'], icon: FiLayers },
    { number: '02', title: 'Test every API shape', copy: 'Move from a response to repeatable confidence with schema, contract, and protocol testing.', metric: 'Test suite', label: 'REST, GraphQL & AsyncAPI', features: ['Schema tests', 'Contracts', 'Fuzzing'], icon: FiShield },
    { number: '03', title: 'Explore your API network', copy: 'Discover linked APIs, inspect GraphQL operations, and map the services your team depends on.', metric: 'API network', label: 'Connected service context', features: ['API Network', 'GraphQL', 'Mock servers'], icon: FiGlobe },
    { number: '04', title: 'Review and document together', copy: 'Keep decisions close to the request with collaboration, reviews, and living documentation.', metric: 'Team flow', label: 'Reviews, comments & docs', features: ['Reviews', 'Comments', 'Documentation'], icon: FiUsers },
    { number: '05', title: 'Monitor what ships', copy: 'Connect production behavior to the work behind it with health checks, alerts, and reports.', metric: 'Production', label: 'Signals that stay actionable', features: ['Monitoring', 'Alerts', 'Reports'], icon: FiActivity }
];

const TESTIMONIALS = [
    ['“Pigeon made the handoff between building an endpoint and trusting it in production feel like one conversation.”', 'Maya Chen', 'Staff Engineer', 'Northstar'],
    ['“Our team finally has the request, the test, and the incident context in the same place.”', 'David Okafor', 'Platform Lead', 'Arcade Cloud'],
    ['“It is the rare API tool that gets calmer as our system gets more complex.”', 'Elena Rossi', 'Developer Experience', 'Atelier']
];

const reveal = { hidden: { opacity: 0, y: 28 }, visible: { opacity: 1, y: 0 } };
const spring = { type: 'spring', stiffness: 180, damping: 22 };
const HERO_FERRO_COLORS = ['#ff7e17', '#ffb56a', '#fff0e2'];
const HERO_ROTATING_WORDS = ['signal', 'context', 'insight'];
const CAPABILITIES = ['REST', 'GraphQL', 'gRPC', 'MQTT', 'WebSocket', 'AsyncAPI', 'OpenAPI', 'Postman import'];
const PRODUCT_VIEWS = [
    { id: 'workspace', label: 'Workspace', eyebrow: 'Build with context', title: 'Every request, properly organized.', copy: 'Collections, environments, variables, and request history keep your team’s API work in one place.', icon: FiLayers, badge: 'Checkout service', items: ['Collections', 'Environments', 'Request history'] },
    { id: 'network', label: 'API Network', eyebrow: 'Explore the landscape', title: 'See how your APIs connect.', copy: 'Discover public APIs, work with GraphQL and AsyncAPI, and run mock servers from the same network.', icon: FiGlobe, badge: 'Connected services', items: ['API Network', 'GraphQL', 'Mock servers'] },
    { id: 'testing', label: 'Testing', eyebrow: 'Ship with confidence', title: 'Turn known behavior into proof.', copy: 'Run schema fuzzing, consumer contracts, performance tests, and trace-to-test workflows before release.', icon: FiShield, badge: 'Quality suite', items: ['Consumer contracts', 'Schema fuzzing', 'Performance tests'] },
    { id: 'monitoring', label: 'Monitoring', eyebrow: 'Stay close to production', title: 'Keep every signal actionable.', copy: 'Health checks, alerts, reports, traces, and status pages connect production behavior back to the request.', icon: FiActivity, badge: 'Production signals', items: ['Health checks', 'Alerts', 'Status pages'] }
];
const COVERAGE_GROUPS = [
    { title: 'Build across protocols', copy: 'Work with the API styles your systems already use.', icon: FiGlobe, items: ['REST', 'GraphQL', 'gRPC', 'MQTT', 'WebSocket', 'AsyncAPI'] },
    { title: 'Connect your source of truth', copy: 'Start from the definitions and collections your team already trusts.', icon: FiLayers, items: ['OpenAPI import', 'Postman import', 'Git collections', 'OAuth', 'MCP Workbench'] },
    { title: 'Assure, govern, operate', copy: 'Keep quality and production context connected to each API change.', icon: FiShield, items: ['Consumer contracts', 'Schema fuzzing', 'Performance tests', 'Monitoring', 'Alerts', 'Reports'] }
];

function Reveal({ children, className = '', delay = 0, direction = 'up' }) {
    const reduced = useReducedMotion();
    const ref = useRef(null);
    const inView = useInView(ref, { once: true, amount: 0.15, margin: '0px 0px -8% 0px' });
    const offset = direction === 'left' ? { x: -24 } : direction === 'right' ? { x: 24 } : { y: 28 };
    const variants = { hidden: { opacity: 0, scale: 0.985, filter: 'blur(7px)', ...offset }, visible: { opacity: 1, scale: 1, filter: 'blur(0px)', x: 0, y: 0 } };
    return <motion.div ref={ref} className={className} variants={variants} initial="hidden" animate={inView || reduced ? 'visible' : 'hidden'} transition={reduced ? { duration: 0 } : { ...spring, delay }}>{children}</motion.div>;
}

function ScrollParallax({ children, className = '' }) {
    const reduced = useReducedMotion();
    const ref = useRef(null);
    const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
    const y = useSpring(useTransform(scrollYProgress, [0, 1], [24, -24]), { stiffness: 120, damping: 28, restDelta: 0.001 });
    const scale = useSpring(useTransform(scrollYProgress, [0, 0.5, 1], [0.985, 1, 0.985]), { stiffness: 120, damping: 28, restDelta: 0.001 });
    return <motion.div ref={ref} className={className} style={reduced ? undefined : { y, scale }}>{children}</motion.div>;
}

function MarketingButton({ children, secondary = false, ...props }) {
    return <motion.a className={`pigeon-button${secondary ? ' pigeon-button--secondary' : ''}`} whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }} transition={spring} {...props}>{children}</motion.a>;
}

function LandingScrollProgress() {
    const reduced = useReducedMotion();
    const { scrollYProgress } = useScroll();
    const smoothedProgress = useSpring(scrollYProgress, { stiffness: 180, damping: 30, restDelta: 0.001 });
    return <div className="pigeon-scroll-progress" aria-hidden="true"><motion.div style={{ scaleX: reduced ? scrollYProgress : smoothedProgress }} /></div>;
}

function HeroRotatingWord() {
    const reduced = useReducedMotion();
    const [wordIndex, setWordIndex] = useState(0);
    const word = HERO_ROTATING_WORDS[wordIndex];

    useEffect(() => {
        const interval = window.setInterval(() => {
            if (!document.hidden) {
                setWordIndex((currentIndex) => (currentIndex + 1) % HERO_ROTATING_WORDS.length);
            }
        }, 3800);

        return () => window.clearInterval(interval);
    }, []);

    return <>
        <span className="pigeon-hero-changing-line" aria-hidden="true">
            Keep every <span className="pigeon-hero-changing-word">
                <span className="pigeon-hero-changing-word-sizer" aria-hidden="true">context.</span>
                <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                        key={word}
                        initial={reduced ? { opacity: 1 } : { opacity: 0, y: '0.35em' }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduced ? { opacity: 1 } : { opacity: 0, y: '-0.35em' }}
                        transition={reduced ? { duration: 0 } : { duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                    >{word}.</motion.span>
                </AnimatePresence>
            </span>
        </span>
        <span className="pigeon-sr-only">Keep every signal.</span>
    </>;
}

function CapabilityStrip() {
    return <section className="pigeon-capability-strip" aria-label="Supported API technologies"><Reveal><p>Built for the API stack you actually run</p><div>{CAPABILITIES.map((capability) => <span key={capability}>{capability}</span>)}</div></Reveal></section>;
}

function ProductPreview({ view }) {
    const Icon = view.icon;
    if (view.id === 'network') return <div className="pigeon-product-preview pigeon-product-preview--network" aria-label="API Network preview"><div className="pigeon-preview-topbar"><span><Icon /> {view.badge}</span><b><i className="pigeon-live-dot" /> 12 services mapped</b></div><div className="pigeon-network-map" aria-hidden="true"><svg viewBox="0 0 520 220" preserveAspectRatio="none"><path d="M258 110 L108 48 M258 110 L410 48 M258 110 L420 174 M258 110 L115 174" /><path className="is-active" d="M258 110 L410 48" /></svg><span className="node node--main"><i />API Gateway<small>9 routes</small></span><span className="node node--one"><i />GraphQL<small>schema</small></span><span className="node node--two"><i />Billing<small>REST</small></span><span className="node node--three"><i />AsyncAPI<small>events</small></span><span className="node node--four"><i />Identity<small>OAuth</small></span><div className="pigeon-network-legend"><span><i /> Healthy</span><span>4 live connections</span></div></div><div className="pigeon-preview-chips">{view.items.map((item) => <span key={item}>{item}</span>)}</div></div>;
    if (view.id === 'testing') return <div className="pigeon-product-preview pigeon-product-preview--testing" aria-label="Testing preview"><div className="pigeon-preview-topbar"><span><Icon /> {view.badge}</span><b>Release gate</b></div><div className="pigeon-check-list">{[['Consumer contract', 'Passed'], ['Schema fuzzing', '42 cases'], ['Performance test', 'p95 84 ms']].map(([name, value]) => <div key={name}><span><FiCheck /> {name}</span><b>{value}</b></div>)}</div><div className="pigeon-preview-chips">{view.items.map((item) => <span key={item}>{item}</span>)}</div></div>;
    if (view.id === 'monitoring') return <div className="pigeon-product-preview pigeon-product-preview--monitoring" aria-label="Monitoring preview"><div className="pigeon-preview-topbar"><span><Icon /> {view.badge}</span><b className="is-live"><i className="pigeon-live-dot" /> Live</b></div><div className="pigeon-monitor-service"><span><i className="pigeon-live-dot" /> Checkout API</span><small>All systems operational</small><b>Last check: 18s ago</b></div><div className="pigeon-monitor-grid"><div className="is-healthy"><small>Availability</small><b>99.98%</b><span>↑ 0.02%</span><svg viewBox="0 0 100 28" preserveAspectRatio="none"><path d="M0 21 L14 19 L29 20 L43 13 L56 16 L72 9 L86 11 L100 5" /></svg></div><div><small>p95 latency</small><b>84 <em>ms</em></b><span>↓ 18 ms</span><svg viewBox="0 0 100 28" preserveAspectRatio="none"><path d="M0 7 L15 12 L30 10 L45 18 L59 15 L74 20 L88 17 L100 22" /></svg></div><div className="is-alert"><small>Open alerts</small><b>02</b><span>1 needs review</span><svg viewBox="0 0 100 28" preserveAspectRatio="none"><path d="M0 22 L14 22 L28 18 L43 22 L57 7 L72 22 L86 15 L100 17" /></svg></div></div><div className="pigeon-monitor-event"><i className="pigeon-live-dot" /><span><b>Latency recovered</b><small>checkout-api / production · 2m ago</small></span><em>Resolved</em></div><div className="pigeon-preview-chips">{view.items.map((item) => <span key={item}>{item}</span>)}</div></div>;
    return <div className="pigeon-product-preview pigeon-product-preview--workspace" aria-label="Workspace preview"><div className="pigeon-preview-topbar"><span><Icon /> {view.badge}</span><b>Production</b></div><div className="pigeon-workspace-preview"><aside><small>Collections</small><b className="is-selected">Checkout service</b><b>Identity API</b><b>Notifications</b></aside><div><small>POST /deployments</small><pre>{'{\n  "environment": "production",\n  "notify": true\n}'}</pre><span><FiCheck /> Saved to collection</span></div></div><div className="pigeon-preview-chips">{view.items.map((item) => <span key={item}>{item}</span>)}</div></div>;
}

function ProductExplorer() {
    const [activeId, setActiveId] = useState(PRODUCT_VIEWS[0].id);
    const reduced = useReducedMotion();
    const activeIndex = PRODUCT_VIEWS.findIndex((view) => view.id === activeId);
    const activeView = PRODUCT_VIEWS[activeIndex];
    const selectTab = (index) => {
        const nextIndex = (index + PRODUCT_VIEWS.length) % PRODUCT_VIEWS.length;
        setActiveId(PRODUCT_VIEWS[nextIndex].id);
        document.getElementById(`pigeon-product-tab-${PRODUCT_VIEWS[nextIndex].id}`)?.focus();
    };
    const onTabKeyDown = (event, index) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); selectTab(index + 1); }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); selectTab(index - 1); }
        if (event.key === 'Home') { event.preventDefault(); selectTab(0); }
        if (event.key === 'End') { event.preventDefault(); selectTab(PRODUCT_VIEWS.length - 1); }
    };
    const ActiveIcon = activeView.icon;
    return <section className="pigeon-section pigeon-explorer" id="explore" aria-labelledby="explore-title"><Reveal className="pigeon-section-heading pigeon-centered-heading"><p className="pigeon-kicker">More than a request client</p><h2 id="explore-title">Explore every part of the <em>API lifecycle.</em></h2><p>Switch views to see how Pigeon connects the work before and after every request.</p></Reveal><Reveal delay={0.08}><div className="pigeon-product-explorer"><div className="pigeon-product-tabs" role="tablist" aria-label="Pigeon product areas">{PRODUCT_VIEWS.map((view, index) => { const Icon = view.icon; const selected = view.id === activeId; return <button type="button" id={`pigeon-product-tab-${view.id}`} key={view.id} role="tab" aria-selected={selected} aria-controls="pigeon-product-panel" tabIndex={selected ? 0 : -1} className={selected ? 'is-active' : ''} onClick={() => setActiveId(view.id)} onKeyDown={(event) => onTabKeyDown(event, index)}><Icon /> {view.label}</button>; })}</div><AnimatePresence mode="wait" initial={false}><motion.div key={activeId} id="pigeon-product-panel" role="tabpanel" aria-labelledby={`pigeon-product-tab-${activeId}`} className="pigeon-product-panel" initial={reduced ? { opacity: 1 } : { opacity: 0, y: 12, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={reduced ? { opacity: 1 } : { opacity: 0, y: -8, filter: 'blur(3px)' }} transition={reduced ? { duration: 0 } : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }}><div className="pigeon-product-copy"><span><ActiveIcon /> {activeView.eyebrow}</span><h3>{activeView.title}</h3><p>{activeView.copy}</p><div>{activeView.items.map((item) => <b key={item}><FiCheck /> {item}</b>)}</div></div><ProductPreview view={activeView} /></motion.div></AnimatePresence></div></Reveal></section>;
}

function ProductDemoContent() {
    const [selected, setSelected] = useState(1);
    const [method, setMethod] = useState(REQUESTS[1].method);
    const [url, setUrl] = useState(REQUESTS[1].url);
    const [body, setBody] = useState(REQUESTS[1].body);
    const [sending, setSending] = useState(false);
    const [response, setResponse] = useState(null);
    const [error, setError] = useState('');
    const [isPresetTyping, setIsPresetTyping] = useState(false);
    const typingTimerRef = useRef(null);
    useEffect(() => () => {
        if (typingTimerRef.current) window.clearInterval(typingTimerRef.current);
    }, []);
    const cancelPresetTyping = () => {
        if (typingTimerRef.current) {
            window.clearInterval(typingTimerRef.current);
            typingTimerRef.current = null;
        }
        setIsPresetTyping(false);
    };
    const selectPreset = (index) => {
        const preset = REQUESTS[index];
        cancelPresetTyping();
        setSelected(index);
        setMethod(preset.method);
        setResponse(null);
        setError('');
        setUrl('');
        setBody('');
        setIsPresetTyping(true);
        let urlIndex = 0;
        let bodyIndex = 0;
        let ticks = 0;
        const typeNextCharacters = () => {
            ticks += 1;
            urlIndex = Math.min(preset.url.length, urlIndex + (ticks > 5 ? 2 : 1));
            if (ticks > 7) bodyIndex = Math.min(preset.body.length, bodyIndex + 3);
            setUrl(preset.url.slice(0, urlIndex));
            setBody(preset.body.slice(0, bodyIndex));
            if (urlIndex === preset.url.length && bodyIndex === preset.body.length && (ticks > 7 || !preset.body.length)) {
                window.clearInterval(typingTimerRef.current);
                typingTimerRef.current = null;
                setIsPresetTyping(false);
            }
        };
        typingTimerRef.current = window.setInterval(typeNextCharacters, 18);
        typeNextCharacters();
    };
    const selectMethod = (nextMethod) => {
        const presetIndex = REQUESTS.findIndex((preset) => preset.method === nextMethod);
        if (presetIndex >= 0) selectPreset(presetIndex);
    };
    const updateUrl = (event) => {
        cancelPresetTyping();
        setUrl(event.target.value);
    };
    const updateBody = (event) => {
        cancelPresetTyping();
        setBody(event.target.value);
    };
    const send = async () => {
        if (isPresetTyping) return;
        let parsedBody;
        if (body.trim()) {
            try { parsedBody = JSON.parse(body); } catch { setError('Body must contain valid JSON before it can be sent.'); return; }
        }
        setSending(true);
        setResponse(null);
        setError('');
        try {
            const result = await fetch(`${getApiBaseUrl()}/api/public-demo/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ url, method, ...(parsedBody !== undefined ? { body: parsedBody } : {}) })
            });
            const data = await result.json();
            if (!result.ok) throw new Error(data.message || 'The request could not be completed.');
            setResponse(data);
        } catch (requestError) {
            setError(requestError.message || 'The request could not be completed.');
        } finally {
            setSending(false);
        }
    };
    const responseText = response ? JSON.stringify(response.body, null, 2) : '';
    return <section className="pigeon-section pigeon-demo-section" id="product" aria-label="Interactive API request demo"><Reveal delay={0.08}><ScrollParallax className="pigeon-demo-scroll-stage"><div className="pigeon-demo pigeon-demo--live" aria-label="Interactive API request demo"><aside className="pigeon-demo-sidebar"><div className="pigeon-demo-sidebar-title"><FiLayers /> Public API demo <span>{REQUESTS.length} presets</span></div>{REQUESTS.map((item, index) => <button type="button" key={item.name} className={selected === index ? 'is-active' : ''} onClick={() => selectPreset(index)}><b className={`method-${item.method.toLowerCase()}`}>{item.method}</b><span>{item.name}</span><i /></button>)}<div className="pigeon-demo-sidebar-footer"><span /> Real request</div></aside><div className="pigeon-demo-main"><div className="pigeon-demo-windowbar"><span><i /><i /><i /></span><b>try-it / jsonplaceholder</b><small>Editable public demo</small></div><div className="pigeon-demo-topbar"><AppSelect id="pigeon-http-method" value={method} onChange={selectMethod} options={['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((item) => ({ value: item, label: item }))} className="pigeon-method-picker" menuClassName="pigeon-method-menu" /><input aria-label="Request URL" value={url} onChange={updateUrl} className={isPresetTyping ? 'is-typing' : ''} spellCheck="false" /><button type="button" className="pigeon-send" onClick={send} disabled={sending || isPresetTyping}>{sending || isPresetTyping ? <i className="pigeon-spinner" /> : <FiSend />} {sending ? 'Sending…' : isPresetTyping ? 'Loading…' : 'Send request'}</button></div><div className="pigeon-demo-tabs"><span>JSON body</span><small className={isPresetTyping ? 'pigeon-preset-typing' : ''}>{isPresetTyping ? 'Loading preset…' : 'Allowed: jsonplaceholder.typicode.com, httpbin.org'}</small></div><div className="pigeon-demo-editor pigeon-demo-editor--live"><textarea aria-label="JSON request body" value={body} onChange={updateBody} className={isPresetTyping ? 'is-typing' : ''} spellCheck="false" placeholder={'{\n  "key": "value"\n}'} /><span className="pigeon-editor-hint">{isPresetTyping ? 'Typing curated request…' : <><FiZap /> Your request is sent through Pigeon</>}</span></div>{error ? <p className="pigeon-demo-error" role="alert">{error}</p> : null}<div className={`pigeon-response${sending ? ' is-sending' : ''}`}><div className="pigeon-response-heading"><span>Response</span>{sending ? <span className="pigeon-sending"><i /> Sending request</span> : response ? <b className={response.status >= 400 ? 'is-error' : ''}><FiCheck /> {response.status} {response.statusText}</b> : <small>Ready to send</small>}<small>{response ? `${response.duration} ms · ${response.size} B` : null}</small></div><pre aria-live="polite">{responseText || (sending ? 'Contacting the curated demo API…' : '// Edit the URL or JSON body, then send a real request.')}</pre>{!response && !sending ? <div className="pigeon-response-empty"><span><FiActivity /></span><p>Try one of the presets or edit this request. Demo hosts are intentionally limited for safety.</p></div> : null}</div></div></div></ScrollParallax></Reveal></section>;
}

function ProductDemo() { return <><LandingScrollProgress /><ProductExplorer /><CapabilityStrip /></>; }

function FeatureVisual({ type }) {
    if (type === 'wide graph') return <div className="pigeon-latency-graph" aria-hidden="true"><span>p95 latency</span><svg viewBox="0 0 300 76" preserveAspectRatio="none"><path d="M0 57 C32 48 38 61 68 43 S104 53 131 29 S174 45 204 25 S246 36 300 10" /><circle cx="204" cy="25" r="4" /></svg><small>84 ms <FiArrowRight /> 62 ms</small></div>;
    if (type === 'tests') return <div className="pigeon-test-runner" aria-hidden="true">{['status is 201', 'schema matches', 'latency under 200ms'].map((item, index) => <span key={item} style={{ '--test-delay': `${index * 0.4}s` }}><FiCheck /> {item}</span>)}</div>;
    return null;
}

function Features() { return <section className="pigeon-section" id="features" aria-labelledby="features-title"><Reveal className="pigeon-section-heading"><p className="pigeon-kicker">Built for the whole journey</p><h2 id="features-title">Less switching. <em>More signal.</em></h2></Reveal><div className="pigeon-feature-grid">{FEATURES.map((feature, index) => { const Icon = feature.icon; return <Reveal key={feature.title} className={`pigeon-feature-card ${feature.type || ''}`} direction={index % 2 ? 'right' : 'left'} delay={index * 0.06}><motion.div whileHover={{ y: -7 }} transition={spring}><Icon className="pigeon-feature-icon" /><h3>{feature.title}</h3><p>{feature.copy}</p><FeatureVisual type={feature.type} /></motion.div></Reveal>; })}</div></section>; }

function WorkflowTimeline() { const { scrollYProgress } = useScroll(); const progress = useSpring(scrollYProgress, { stiffness: 110, damping: 30 }); return <section className="pigeon-section pigeon-workflow" id="workflow" aria-labelledby="workflow-title"><Reveal className="pigeon-section-heading"><p className="pigeon-kicker">One connected workflow</p><h2 id="workflow-title">Follow the request. <em>Keep the context.</em></h2></Reveal><div className="pigeon-workflow-list"><motion.i className="pigeon-workflow-line" style={{ scaleY: progress }} aria-hidden="true" />{WORKFLOW.map(({ number, title, copy, metric, label, features, icon: Icon }, index) => <Reveal key={title} className="pigeon-workflow-step" direction={index % 2 ? 'right' : 'left'} delay={index * 0.05}><div className="pigeon-workflow-copy"><span>{number}</span><h3>{title}</h3><p>{copy}</p></div><div className="pigeon-workflow-card"><div className="pigeon-workflow-card-top"><span><Icon /></span><small>{label}</small></div><b>{metric}</b><div className="pigeon-workflow-features">{features.map((feature) => <span key={feature}>{feature}</span>)}</div></div></Reveal>)}</div></section>; }

function CapabilityCoverage() { return <section className="pigeon-section pigeon-coverage" aria-labelledby="coverage-title"><Reveal className="pigeon-section-heading pigeon-centered-heading"><p className="pigeon-kicker">One home for API work</p><h2 id="coverage-title">Bring the stack together. <em>Keep the signal.</em></h2><p>From an imported collection to a monitored production API, Pigeon keeps the important context close.</p></Reveal><div className="pigeon-coverage-grid">{COVERAGE_GROUPS.map(({ title, copy, icon: Icon, items }, index) => <Reveal key={title} direction={index === 1 ? 'up' : index === 0 ? 'left' : 'right'} delay={index * 0.07}><article><span><Icon /></span><h3>{title}</h3><p>{copy}</p><div>{items.map((item) => <b key={item}>{item}</b>)}</div></article></Reveal>)}</div></section>; }

function Workflow() { return <><WorkflowTimeline /><CapabilityCoverage /></>; }

function MarketingFooter() { const groups = [['Product', [['Workspace', '/workspace'], ['API Network', '/workspace/api-network'], ['Monitoring', '/workspace/monitoring']]], ['Developers', [['Documentation', '/documentation'], ['GitHub', 'https://github.com/Ranshiv/Pigeon'], ['Workflow', '#workflow']]], ['Company', [['About Pigeon', '#top'], ['Customer stories', '#testimonials'], ['Contact', 'mailto:support@pigeonapp.io']]], ['Legal', [['Privacy', '/privacy'], ['Terms', '/terms']]]]; return <footer className="pigeon-marketing-footer"><div className="pigeon-footer-grid"><div><a className="pigeon-wordmark" href="#top"><span>P</span> Pigeon</a><p>One focused home for building, testing, and operating APIs.</p><a className="pigeon-social" href="https://github.com/Ranshiv/Pigeon" target="_blank" rel="noreferrer"><FiGithub /> GitHub</a></div>{groups.map(([title, links]) => <div key={title}><h3>{title}</h3>{links.map(([label, href]) => href.startsWith('/') ? <Link key={label} to={href}>{label}</Link> : <a key={label} href={href}>{label}</a>)}</div>)}</div><div className="pigeon-footer-bottom"><span>© {new Date().getFullYear()} Pigeon. All rights reserved.</span><span>Built for APIs that keep moving.</span></div></footer>; }

function PublicHome() {
    const reduced = useReducedMotion();
    const trusted = useMemo(() => ['northstar', 'vanta', 'arcade', 'linear', 'relay', 'fathom'], []);
    const heroRef = useRef(null);
    const heroInView = useInView(heroRef, { amount: 0.01 });
    useEffect(() => {
        document.body.classList.add('pigeon-marketing-body');
        return () => document.body.classList.remove('pigeon-marketing-body');
    }, []);
    return <div className="pigeon-marketing" id="top"><main><section ref={heroRef} className="pigeon-hero" aria-labelledby="hero-title"><div className="pigeon-hero-fluid" aria-hidden="true"><Ferrofluid eventTargetRef={heroRef} paused={reduced || !heroInView} colors={HERO_FERRO_COLORS} speed={0.12} scale={1.8} turbulence={0.2} fluidity={0.12} rimWidth={0.17} sharpness={1.55} shimmer={1.15} glow={1.4} flowDirection="down" opacity={0.46} mouseInteraction mouseStrength={0.55} mouseRadius={0.25} mouseDampening={0.18} mixBlendMode="screen" /></div><div className="pigeon-hero-content"><motion.div className="pigeon-hero-copy" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: reduced ? 0 : 0.1 } } }}><motion.a href="#product" className="pigeon-announcement" variants={reveal} transition={spring}><span>What’s new</span><b>v1.0 <FiArrowRight /></b></motion.a><motion.h1 id="hero-title" variants={reveal} transition={spring}>Build APIs.<br /><em><HeroRotatingWord /></em></motion.h1><motion.p variants={reveal} transition={spring}>Pigeon brings requests, tests, collaboration, and production context into one focused flow.</motion.p><motion.div className="pigeon-hero-actions" variants={reveal} transition={spring}><MarketingButton href={getGoogleAuthUrl()}>Start building free <FiArrowRight /></MarketingButton><MarketingButton secondary href="#product"><FiPlay /> Watch the workspace</MarketingButton></motion.div></motion.div><ProductDemoContent /></div><motion.div className="pigeon-trusted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduced ? 0 : 0.55 }}><span>Trusted by teams building</span><div><div>{[...trusted, ...trusted].map((name, index) => <b key={`${name}-${index}`}>{name}</b>)}</div></div></motion.div><a className="pigeon-scroll-cue" href="#product">Scroll to explore <FiArrowDown /></a></section><ProductDemo /><Features /><Workflow /><section className="pigeon-section pigeon-testimonials" id="testimonials" aria-labelledby="stories-title"><Reveal className="pigeon-section-heading pigeon-centered-heading"><p className="pigeon-kicker">From teams in the flow</p><h2 id="stories-title">Built for people who <em>ship together.</em></h2></Reveal><div className="pigeon-quote-grid">{TESTIMONIALS.map(([quote, name, role, company], index) => <Reveal key={name} delay={index * 0.08}><figure><blockquote>{quote}</blockquote><figcaption><span>{name}<small>{role}</small></span><b>{company}</b></figcaption></figure></Reveal>)}</div></section><section className="pigeon-final-cta"><Reveal><div><p className="pigeon-kicker">Your next request starts here</p><h2>Give every API a <em>place to land.</em></h2><p>One workspace for the work that turns an API into a reliable product.</p><div className="pigeon-hero-actions"><MarketingButton href={getGoogleAuthUrl()}>Start with Pigeon <FiArrowRight /></MarketingButton><MarketingButton secondary href="/documentation">Read the docs <FiCode /></MarketingButton></div></div></Reveal></section></main><MarketingFooter /></div>;
}

export default PublicHome;
