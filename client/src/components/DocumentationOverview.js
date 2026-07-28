import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    FiArrowLeft, FiArrowRight, FiBookOpen, FiCheckCircle, FiChevronRight,
    FiCode, FiDatabase, FiFileText, FiGlobe, FiHome, FiMonitor, FiRadio,
    FiSearch, FiSend, FiServer, FiShield, FiUsers, FiBarChart2, FiCheck,
    FiClock, FiCopy, FiThumbsDown, FiThumbsUp, FiTerminal, FiPrinter, FiLink as FiLinkIcon
} from 'react-icons/fi';
import { documentationGuides, documentationSections, getGuide, learningPaths } from './documentationContent';
import { markDocumentationGuideComplete, readDocumentationProgress, trackDocumentationEvent } from './documentationAnalytics';
import AppSelect from './common/AppSelect/AppSelect';
import './DocumentationOverview.css';
import './DocumentationTheme.css';

const icons = {
    home: FiHome, send: FiSend, database: FiDatabase, code: FiCode, file: FiFileText,
    globe: FiGlobe, check: FiCheckCircle, radio: FiRadio, server: FiServer,
    monitor: FiMonitor, users: FiUsers, shield: FiShield, chart: FiBarChart2, terminal: FiTerminal
};

const guidePath = (guide) => `/documentation/${guide.category}/${guide.id}`;
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const highlightText = (value, query) => {
    if (!query) return value;
    return value.split(new RegExp(`(${escapeRegExp(query)})`, 'ig')).map((part, index) => part.toLowerCase() === query.toLowerCase() ? <mark key={`${part}-${index}`}>{part}</mark> : part);
};

const DocumentationOverview = () => {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState('all');
    const [progress, setProgress] = useState(() => readDocumentationProgress());
    const [codeLanguage, setCodeLanguage] = useState('all');
    const [searchFocused, setSearchFocused] = useState(false);
    const [activeResult, setActiveResult] = useState(-1);
    const [recentSearches, setRecentSearches] = useState(() => {
        try {
            return JSON.parse(window.localStorage.getItem('pigeon-doc-recent-searches') || '[]').slice(0, 5);
        } catch (error) {
            return [];
        }
    });
    const searchRef = useRef(null);
    const normalizedQuery = query.trim().toLowerCase();
    const queryTerms = normalizedQuery.split(/\s+/).filter(Boolean);
    const visibleSections = useMemo(() => documentationSections.map((section) => ({
        ...section,
        guides: section.guides
            .map(([title]) => documentationGuides.find((guide) => guide.category === section.id && guide.title === title))
            .filter(Boolean)
            .filter((guide) => category === 'all' || guide.category === category)
            .filter((guide) => codeLanguage === 'all' || guide.example[1] === codeLanguage)
            .filter((guide) => !queryTerms.length || queryTerms.every((term) => guide.keywords.some((keyword) => keyword.includes(term))))
    })).filter((section) => section.guides.length > 0), [category, codeLanguage, queryTerms.join('|')]);
    const visibleGuides = visibleSections.flatMap((section) => section.guides);
    const suggestions = useMemo(() => {
        if (!normalizedQuery) return [];
        return documentationGuides.filter((guide) => `${guide.title} ${guide.categoryTitle} ${guide.example[1]}`.toLowerCase().includes(normalizedQuery)).slice(0, 6);
    }, [normalizedQuery]);
    const rememberSearch = (value = query) => {
        const search = value.trim();
        if (!search) return;
        const next = [search, ...recentSearches.filter((item) => item.toLowerCase() !== search.toLowerCase())].slice(0, 5);
        setRecentSearches(next);
        window.localStorage.setItem('pigeon-doc-recent-searches', JSON.stringify(next));
        trackDocumentationEvent('docs_search', { query: search, resultCount: visibleGuides.length });
    };
    const handleSearchKeyDown = (event) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveResult((current) => Math.min(current + 1, visibleGuides.length - 1));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveResult((current) => Math.max(current - 1, 0));
        } else if (event.key === 'Enter') {
            rememberSearch();
            const selected = visibleGuides[activeResult];
            if (selected) navigate(guidePath(selected));
        } else if (event.key === 'Escape') {
            setSearchFocused(false);
            searchRef.current?.blur();
        }
    };
    const chooseSuggestion = (value) => {
        trackDocumentationEvent('search_suggestion_selected', { query: value });
        setQuery(value);
        setActiveResult(-1);
        searchRef.current?.focus();
    };

    useEffect(() => {
        const onProgress = () => setProgress(readDocumentationProgress());
        window.addEventListener('pigeon-doc-progress', onProgress);
        trackDocumentationEvent('docs_hub_viewed', { guideCount: documentationGuides.length });
        return () => window.removeEventListener('pigeon-doc-progress', onProgress);
    }, []);

    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
                event.preventDefault();
                searchRef.current?.focus();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    return (
        <main className="docs-hub">
            <header className="docs-hub-hero">
                <div className="docs-hub-hero-copy">
                    <span className="docs-hub-eyebrow"><FiBookOpen /> Documentation hub</span>
                    <h1>Everything you need to build with Pigeon.</h1>
                    <p>Simple guides for building, testing, documenting, monitoring, and collaborating on APIs.</p>
                </div>
                <div className="docs-hub-hero-meta" aria-label="Documentation overview">
                    <div><strong>{documentationGuides.length}</strong><span>feature guides</span></div>
                    <div><strong>{documentationSections.length}</strong><span>categories</span></div>
                </div>
            </header>

            <section className="docs-hub-catalog" aria-labelledby="docs-catalog-heading">
                <div className="docs-hub-section-heading">
                    <div>
                        <span className="docs-hub-kicker">Explore</span>
                        <h2 id="docs-catalog-heading">Find the right guide for your workflow</h2>
                    </div>
                    <p>Search the complete feature guide or browse by category.</p>
                </div>
                <div className="docs-hub-controls">
                    <label className="docs-hub-search" onFocus={() => setSearchFocused(true)} onBlur={() => window.setTimeout(() => { if (!searchRef.current?.closest('.docs-hub-search')?.contains(document.activeElement)) setSearchFocused(false); }, 120)}>
                        <FiSearch aria-hidden="true" />
                        <span className="sr-only">Search documentation</span>
                        <input ref={searchRef} value={query} onChange={(event) => { setQuery(event.target.value); setActiveResult(-1); }} onKeyDown={handleSearchKeyDown} placeholder="Search guides..." aria-label="Search guides" aria-controls="docs-search-results" aria-activedescendant={activeResult >= 0 ? `docs-result-${activeResult}` : undefined} autoComplete="off" />
                        <kbd>/</kbd>
                        {searchFocused && (normalizedQuery || recentSearches.length > 0) && <div className="docs-search-popover" role="listbox" id="docs-search-results">
                            {normalizedQuery && suggestions.length > 0 && <><span className="docs-search-popover-label">Suggestions</span>{suggestions.map((suggestion) => <button type="button" key={suggestion.id} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseSuggestion(suggestion.title)}><FiSearch />{suggestion.title}<small>{suggestion.categoryTitle}</small></button>)}</>}
                            {!normalizedQuery && recentSearches.length > 0 && <><span className="docs-search-popover-label">Recent searches</span>{recentSearches.map((recent) => <button type="button" key={recent} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseSuggestion(recent)}><FiClock />{recent}</button>)}</>}
                        </div>}
                    </label>
                    <div className="docs-hub-filter">
                        <label className="sr-only" htmlFor="docs-category-filter">Filter by category</label>
                        <AppSelect id="docs-category-filter" value={category} onChange={setCategory} options={[{ value: 'all', label: 'All categories' }, ...documentationSections.map((section) => ({ value: section.id, label: section.title }))]} className="docs-filter-select" />
                    </div>
                    <div className="docs-hub-filter">
                        <label className="sr-only" htmlFor="docs-language-filter">Filter by example language</label>
                        <AppSelect id="docs-language-filter" value={codeLanguage} onChange={setCodeLanguage} options={[{ value: 'all', label: 'All examples' }, { value: 'http', label: 'HTTP' }, { value: 'javascript', label: 'JavaScript' }, { value: 'graphql', label: 'GraphQL' }, { value: 'yaml', label: 'YAML' }, { value: 'json', label: 'JSON' }, { value: 'bash', label: 'CLI / Bash' }, { value: 'text', label: 'Configuration' }]} className="docs-filter-select" />
                    </div>
                    <span className="docs-version-badge"><FiClock /> Pigeon docs · 2026.07</span>
                </div>

                <section className="docs-learning-paths" aria-labelledby="learning-paths-heading">
                    <div className="docs-hub-section-heading docs-learning-heading"><div><span className="docs-hub-kicker">Start here</span><h2 id="learning-paths-heading">Choose a learning path</h2></div><p>Follow a short sequence instead of deciding what to read first.</p></div>
                    <div className="docs-learning-grid">{learningPaths.map((path) => { const completed = path.guides.filter((title) => { const guide = documentationGuides.find((item) => item.title === title); return guide && progress[guide.id]; }).length; const percentage = Math.round((completed / path.guides.length) * 100); return <div className="docs-learning-card" key={path.id}><strong>{path.title}</strong><p>{path.description}</p><div className="docs-learning-progress"><span style={{ width: `${percentage}%` }} /><small>{completed}/{path.guides.length} complete</small></div><div>{path.guides.map((title, index) => { const guide = documentationGuides.find((item) => item.title === title); return guide ? <React.Fragment key={guide.id}><Link to={guidePath(guide)} onClick={() => trackDocumentationEvent('learning_path_guide_opened', { pathId: path.id, guideId: guide.id })}>{index + 1}. {title}</Link>{index < path.guides.length - 1 && <FiChevronRight aria-hidden="true" />}</React.Fragment> : null; })}</div></div>; })}</div>
                </section>

                {visibleSections.length > 0 ? visibleSections.map(({ id, title, description, icon, guides }) => {
                    const Icon = icons[icon] || FiBookOpen;
                    return <section className="docs-hub-category" key={id} aria-labelledby={`docs-category-${id}`}>
                        <div className="docs-hub-category-heading">
                            <div className="docs-hub-topic-icon" aria-hidden="true"><Icon /></div>
                            <div><h3 id={`docs-category-${id}`}>{title}</h3><p>{description}</p></div>
                            <span className="docs-hub-category-count">{guides.length} {guides.length === 1 ? 'guide' : 'guides'}</span>
                        </div>
                        <div className="docs-hub-guide-grid">
                            {guides.map((guide) => { const resultIndex = visibleGuides.findIndex((item) => item.id === guide.id); return <Link className={`docs-hub-guide-card ${activeResult === resultIndex ? 'is-keyboard-active' : ''}`} id={`docs-result-${resultIndex}`} to={guidePath(guide)} key={guide.id} onClick={() => rememberSearch()}>
                                <span><strong>{highlightText(guide.title, normalizedQuery)}</strong><small>{highlightText(guide.summary, normalizedQuery)}</small></span><FiArrowRight aria-hidden="true" />
                            </Link>; })}
                        </div>
                    </section>;
                }) : <div className="docs-hub-empty"><FiSearch /><h3>No guides found</h3><p>Try another search term or browse all categories.</p><button type="button" onClick={() => { setQuery(''); setCategory('all'); }}>Clear filters</button></div>}
            </section>
        </main>
    );
};

export const DocumentationArticle = () => {
    const { category, guide: guideId } = useParams();
    const guide = getGuide(category, guideId);
    const [copied, setCopied] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const [completed, setCompleted] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);
    const guideIndex = documentationGuides.findIndex((item) => item.id === guide?.id);
    const previousGuide = guideIndex > 0 ? documentationGuides[guideIndex - 1] : null;
    const nextGuide = guideIndex >= 0 ? documentationGuides[guideIndex + 1] : null;
    const guidePaths = learningPaths.filter((path) => path.guides.includes(guide?.title));
    useEffect(() => {
        if (guide) {
            setFeedback(window.localStorage.getItem(`pigeon-doc-feedback:${guide.id}`));
            setCompleted(Boolean(readDocumentationProgress()[guide.id]));
            trackDocumentationEvent('guide_viewed', { guideId: guide.id, category: guide.category });
        }
        const openedAt = Date.now();
        return () => {
            if (guide) trackDocumentationEvent('guide_read_duration', { guideId: guide.id, seconds: Math.round((Date.now() - openedAt) / 1000) });
        };
    }, [guide]);
    const saveFeedback = (value) => {
        setFeedback(value);
        if (guide) {
            window.localStorage.setItem(`pigeon-doc-feedback:${guide.id}`, value);
            trackDocumentationEvent('guide_feedback', { guideId: guide.id, value });
        }
    };
    const completeGuide = () => {
        if (!guide) return;
        markDocumentationGuideComplete(guide.id);
        setCompleted(true);
    };
    const copyArticleLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setLinkCopied(true);
            trackDocumentationEvent('article_link_copied', { guideId: guide.id });
            window.setTimeout(() => setLinkCopied(false), 1800);
        } catch (error) {
            setLinkCopied(false);
        }
    };
    const copyExample = async () => {
        try {
            await navigator.clipboard.writeText(guide.example[2]);
            setCopied(true);
            trackDocumentationEvent('example_copied', { guideId: guide.id, language: guide.example[1] });
            window.setTimeout(() => setCopied(false), 1800);
        } catch (error) {
            setCopied(false);
        }
    };
    if (!guide) return <main className="docs-article docs-article-empty"><FiBookOpen /><h1>Guide not found</h1><p>This documentation page does not exist.</p><Link className="docs-article-back" to="/documentation"><FiArrowLeft /> Back to documentation</Link></main>;
    return <main className="docs-article">
        <Link className="docs-article-back" to="/documentation"><FiArrowLeft /> Documentation</Link>
        <div className="docs-article-layout">
            <article>
                <div className="docs-article-breadcrumb"><Link to="/documentation">Documentation</Link><FiChevronRight /><Link to={`/documentation#docs-category-${guide.category}`}>{guide.categoryTitle}</Link><FiChevronRight /><span>Guide</span></div>
                <div className="docs-article-updated"><FiClock /> Updated {guide.lastUpdated} <span>·</span> 5 min read</div>
                <h1>{guide.title}</h1><p className="docs-article-summary">{guide.summary}</p>
                <div className="docs-article-tools"><button type="button" onClick={copyArticleLink}>{linkCopied ? <><FiCheck /> Link copied</> : <><FiLinkIcon /> Copy link</>}</button><button type="button" onClick={() => { window.print(); trackDocumentationEvent('article_printed', { guideId: guide.id }); }}><FiPrinter /> Print</button></div>
                <div id="overview" className="docs-article-callout"><FiBookOpen /><span><strong>What this guide covers:</strong> {guide.summary} Follow the workflow below, then open the feature in Pigeon to try it with your own API.</span></div>
                <div className="docs-article-meta"><div><strong>Before you start</strong><p>{guide.prerequisites}</p></div><div><strong>What you will learn</strong><p>{guide.summary}</p></div></div>
                <section id="steps"><h2>How to use it</h2><ol>{guide.steps.map(([stepTitle, detail], index) => <li key={stepTitle}><span>{index + 1}</span><div><strong>{stepTitle}</strong><p>{detail}</p></div></li>)}</ol></section>
                <section id="example" className="docs-article-example"><div className="docs-example-heading"><div><span className="docs-hub-kicker">Example</span><h2>{guide.example[0]}</h2></div><span className="docs-code-language">{guide.example[1]}</span></div><div className="docs-code-wrap"><pre><code>{guide.example[2]}</code></pre><button type="button" onClick={copyExample} className="docs-copy-button" aria-label="Copy example">{copied ? <><FiCheck /> Copied</> : <><FiCopy /> Copy</>}</button></div></section>
                <section id="workflow" className="docs-detailed-example"><span className="docs-hub-kicker">Detailed example</span><h2>Input, output, and failure behavior</h2><p className="docs-detail-intro">Use this as a concrete check while following the guide. Replace the sample values with your own workspace data.</p><div className="docs-detail-grid"><div className="docs-detail-card"><div className="docs-detail-card-heading"><strong>{guide.inputLabel}</strong><span>{guide.inputLanguage}</span></div><pre><code>{guide.input}</code></pre></div><div className="docs-detail-card docs-detail-card-success"><div className="docs-detail-card-heading"><strong>{guide.outputLabel}</strong><span>{guide.outputLanguage}</span></div><pre><code>{guide.output}</code></pre></div><div className="docs-detail-card docs-detail-card-failure"><div className="docs-detail-card-heading"><strong>{guide.failureLabel}</strong><span>{guide.failureLanguage}</span></div><pre><code>{guide.failure}</code></pre></div></div><div className="docs-success-criteria"><strong>Success criteria</strong><p>{guide.success}</p></div></section>
                {guide.reference && <section id="reference" className="docs-reference"><span className="docs-hub-kicker">Reference</span><h2>Supported operations</h2><div className="docs-reference-table" role="table" aria-label={`${guide.title} reference`}><div className="docs-reference-row docs-reference-header" role="row"><strong>Operation</strong><strong>Path or value</strong><strong>Purpose</strong></div>{guide.reference.map(([operation, path, purpose]) => <div className="docs-reference-row" role="row" key={`${operation}-${path}`}><code>{operation}</code><code>{path}</code><span>{purpose}</span></div>)}</div></section>}
                <section id="tips" className="docs-article-tips"><h2>Practical tips</h2><ul>{guide.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul></section>
                <section id="troubleshooting" className="docs-article-troubleshooting"><h2>When something goes wrong</h2><ul>{guide.troubleshooting.map((item) => <li key={item.text}><Link to={item.to}>{item.text}<FiArrowRight aria-hidden="true" /></Link></li>)}</ul></section>
                <Link className="docs-article-action" to={guide.openTo}>Open in Pigeon <FiArrowRight /></Link>
                <section className={`docs-article-completion ${completed ? 'is-complete' : ''}`}><div><strong>{completed ? 'Guide completed' : 'Finished this guide?'}</strong><p>{completed ? 'Your progress is saved on this device.' : 'Mark it complete to track your learning path progress.'}</p></div><button type="button" onClick={completeGuide} disabled={completed}>{completed ? <><FiCheck /> Completed</> : 'Mark complete'}</button></section>
                <section id="feedback" className="docs-article-feedback"><strong>Was this guide helpful?</strong><div>{feedback ? <span className="docs-feedback-thanks"><FiCheck /> Thanks for your feedback.</span> : <><button type="button" onClick={() => saveFeedback('yes')}><FiThumbsUp /> Yes</button><button type="button" onClick={() => saveFeedback('no')}><FiThumbsDown /> No</button></>}</div></section>
                {guidePaths.length > 0 && <section className="docs-article-learning"><span className="docs-hub-kicker">Learning path</span><p>This guide is part of {guidePaths.map((path) => path.title).join(' and ')}.</p><Link to="/documentation#learning-paths-heading">Back to learning paths <FiArrowRight /></Link></section>}
                <nav className="docs-article-pagination" aria-label="Guide navigation"><div>{previousGuide && <Link to={guidePath(previousGuide)}><small>Previous guide</small><strong><FiArrowLeft /> {previousGuide.title}</strong></Link>}</div><div>{nextGuide && <Link to={guidePath(nextGuide)}><small>Next guide</small><strong>{nextGuide.title} <FiArrowRight /></strong></Link>}</div></nav>
            </article>
            <aside className="docs-article-aside"><span className="docs-hub-kicker">On this page</span><a href="#overview">Overview</a><a href="#steps">How to use it</a><a href="#example">Example</a><a href="#workflow">Detailed behavior</a>{guide.reference && <a href="#reference">Reference</a>}<a href="#tips">Practical tips</a><a href="#troubleshooting">Troubleshooting</a><a href="#feedback">Feedback</a><span className="docs-hub-kicker docs-related-label">Related guides</span>{guide.related.map((related) => <Link key={related.id} to={`/documentation/${guide.category}/${related.id}`}>{related.title}<FiArrowRight /></Link>)}<Link className="docs-article-all" to="/documentation">Browse all guides</Link></aside>
        </div>
    </main>;
};

export default DocumentationOverview;
