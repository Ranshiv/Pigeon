// client/src/components/DocumentationViewer.js
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FiEdit, FiClock, FiExternalLink, FiFileText, FiList, FiUsers, FiSearch, FiX } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './DocumentationViewer.css';
import './DocumentationTheme.css';

const slugify = (value = '') => String(value).toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const textFromChildren = (children) => React.Children.toArray(children)
    .map((child) => typeof child === 'string' || typeof child === 'number'
        ? child
        : textFromChildren(child?.props?.children || ''))
    .join('');

const DocumentationViewer = ({ documentation, collection, readOnly = false }) => {
    const [viewerReady, setViewerReady] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const navigate = useNavigate();
    const location = useLocation();
    const workspaceId = location.state?.workspaceId || collection?.workspaceId?._id || collection?.workspaceId;
    const returnTo = location.state?.returnTo || (workspaceId
        ? `/workspace/workspaces/${workspaceId}?tab=collections`
        : '/workspace/workspaces');
    const collectionRouteState = workspaceId ? { workspaceId, returnTo } : location.state;
    const settings = documentation?.settings || {};
    const displayOptions = { ...(documentation?.displayOptions || {}), ...(settings.displayOptions || {}) };
    const shouldShowLastUpdated = displayOptions.showLastUpdated ?? settings.showLastUpdated ?? documentation?.showLastUpdated ?? true;
    const shouldShowContributors = Boolean(displayOptions.showContributors);
    const shouldShowTableOfContents = readOnly || Boolean(displayOptions.showTableOfContents);
    const shouldEnableSearch = readOnly && displayOptions.enableSearch !== false && settings.enableSearch !== false && documentation?.enableSearch !== false;
    const contributors = collection?.contributors || collection?.collaborators || [];

    const tableOfContents = useMemo(() => {
        const seenIds = new Map();
        const lines = (documentation?.content || '').split('\n');
        return lines
        .map((line, lineIndex) => {
            const match = /^(#{1,3})\s+(.+?)\s*$/.exec(line);
            if (!match) return null;
            const baseId = slugify(match[2]);
            const count = seenIds.get(baseId) || 0;
            seenIds.set(baseId, count + 1);
            return { level: match[1].length, title: match[2], lineIndex, id: count ? `${baseId}-${count + 1}` : baseId };
        })
        .filter(Boolean);
    }, [documentation?.content]);
    const searchMatches = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return [];
        const lines = (documentation?.content || '').split('\n');
        return tableOfContents.filter((heading, index) => {
            const nextHeading = tableOfContents[index + 1]?.lineIndex ?? lines.length;
            return lines.slice(heading.lineIndex, nextHeading).join(' ').toLowerCase().includes(query);
        }).slice(0, 8);
    }, [documentation?.content, searchQuery, tableOfContents]);
    const scrollToHeading = (id) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    useEffect(() => {
        // This simulates any initialization that might be needed
        // In a real implementation you might need to load syntax highlighter or other libs
        const timer = setTimeout(() => {
            setViewerReady(true);
        }, 100);

        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const previousTitle = document.title;
        const metaDescription = document.querySelector('meta[name="description"]');
        const previousDescription = metaDescription?.getAttribute('content') || '';
        const title = settings.metaTitle || documentation?.metaTitle || documentation?.title || collection?.name;
        const description = settings.metaDescription || documentation?.metaDescription;

        if (title) document.title = title;
        if (description) {
            const meta = metaDescription || document.createElement('meta');
            meta.name = 'description';
            meta.content = description;
            if (!metaDescription) document.head.appendChild(meta);
        }

        return () => {
            document.title = previousTitle;
            if (metaDescription) metaDescription.content = previousDescription;
        };
    }, [collection?.name, documentation?.metaDescription, documentation?.title, settings.metaDescription, settings.metaTitle]);

    // Handler for clicking the Edit button
    const handleEditClick = (e) => {
        e.preventDefault();

        // Navigate to the documentation page with edit mode
        if (collection && collection._id) {
            navigate(`/workspace/collections/${collection._id}/documentation`, { state: collectionRouteState });
        } else {
            console.error('Cannot navigate to edit page: missing collection ID');
        }
    };

    if (!documentation || !collection) {
        return (
            <div className="documentation-empty-state">
                <p>No documentation to display</p>
                <div className="documentation-actions">
                    <Link to={`/workspace/collections/${collection?._id}/documentation`} state={collectionRouteState} className="create-doc-link">
                        <FiEdit /> Create Documentation
                    </Link>
                </div>
            </div>
        );
    }

    const lastUpdated = documentation.updatedAt
        ? new Date(documentation.updatedAt).toLocaleString()
        : 'Unknown';

    return (
        <div className="documentation-viewer">
            <div className="documentation-header">
                <h2>{documentation.title || `${collection.name} Documentation`}</h2>
                <div className="documentation-actions">
                    {shouldShowLastUpdated && <div className="last-updated">
                        <FiClock className="icon" /> Last updated: {lastUpdated}
                    </div>}
                    <div className="collection-name">
                        <FiFileText className="icon" /> Collection: {collection.name}
                    </div>
                    {!readOnly && <button
                        className="edit-documentation-link"
                        onClick={handleEditClick}
                    >
                        <FiEdit className="icon" /> Edit Documentation
                    </button>}
                    {!readOnly && settings.isPublic && (
                        <a
                            href={`/docs/${collection._id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="view-public-link"
                        >
                            <FiExternalLink className="icon" /> View Public Version
                        </a>
                    )}
                    {shouldEnableSearch && (
                        <label className="documentation-search">
                            <FiSearch aria-hidden="true" />
                            <span className="sr-only">Search public documentation</span>
                            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search docs" aria-label="Search public documentation" />
                            {searchQuery && <button type="button" aria-label="Clear documentation search" onClick={() => setSearchQuery('')}><FiX /></button>}
                        </label>
                    )}
                </div>
            </div>

            <div className="documentation-content">
                {shouldEnableSearch && searchQuery.trim() && (
                    <div className="documentation-search-results" role="status">
                        <strong>{searchMatches.length ? 'Matching sections' : 'No matching sections'}</strong>
                        {searchMatches.map((heading) => <button type="button" key={heading.id} onClick={() => scrollToHeading(heading.id)}>{heading.title}</button>)}
                    </div>
                )}
                {viewerReady && (
                    <div className={`documentation-body${shouldShowTableOfContents && tableOfContents.length ? ' has-toc' : ''}`}>
                        {shouldShowTableOfContents && tableOfContents.length > 0 && (
                            <aside className="documentation-toc" aria-label="Table of contents">
                                <p><FiList /> On this page</p>
                                {tableOfContents.map((heading, index) => (
                                    <a key={`${heading.id}-${index}`} className={`toc-level-${heading.level}`} href={`#${heading.id}`}>{heading.title}</a>
                                ))}
                            </aside>
                        )}
                    <div className="markdown-content">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                h1: ({ children }) => <h1 id={tableOfContents.find((heading) => heading.title === textFromChildren(children))?.id || slugify(textFromChildren(children))}>{children}</h1>,
                                h2: ({ children }) => <h2 id={tableOfContents.find((heading) => heading.title === textFromChildren(children))?.id || slugify(textFromChildren(children))}>{children}</h2>,
                                h3: ({ children }) => <h3 id={tableOfContents.find((heading) => heading.title === textFromChildren(children))?.id || slugify(textFromChildren(children))}>{children}</h3>
                            }}
                            children={documentation.content || ''}
                        />
                        {shouldShowContributors && contributors.length > 0 && (
                            <section className="documentation-contributors">
                                <h3><FiUsers /> Contributors</h3>
                                <div>{contributors.map((contributor, index) => <span key={`${contributor}-${index}`}>{typeof contributor === 'string' ? contributor : contributor.displayName || contributor.name || contributor.email || 'Contributor'}</span>)}</div>
                            </section>
                        )}
                    </div>
                    </div>
                )}

                {!viewerReady && (
                    <div className="documentation-loading">
                        <div className="spinner"></div>
                        <p>Loading documentation...</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DocumentationViewer;
