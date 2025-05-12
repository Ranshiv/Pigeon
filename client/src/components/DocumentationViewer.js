// client/src/components/DocumentationViewer.js
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiEdit, FiClock, FiExternalLink } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './DocumentationViewer.css';

const DocumentationViewer = ({ documentation, collection }) => {
    const [viewerReady, setViewerReady] = useState(false);

    useEffect(() => {
        // This simulates any initialization that might be needed
        // In a real implementation you might need to load syntax highlighter or other libs
        const timer = setTimeout(() => {
            setViewerReady(true);
        }, 100);

        return () => clearTimeout(timer);
    }, []);

    if (!documentation || !collection) {
        return (
            <div className="documentation-empty-state">
                <p>No documentation to display</p>
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
                    <div className="last-updated">
                        <FiClock className="icon" /> Last updated: {lastUpdated}
                    </div>
                    <Link
                        to={`/workspace/collections/${collection._id}/documentation`}
                        className="edit-documentation-link"
                    >
                        <FiEdit className="icon" /> Edit Documentation
                    </Link>
                    {documentation.isPublic && documentation.publicUrl && (
                        <a
                            href={documentation.publicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="view-public-link"
                        >
                            <FiExternalLink className="icon" /> View Public Version
                        </a>
                    )}
                </div>
            </div>
            <div className="documentation-content">
                {viewerReady ? (
                    <div className="markdown-content">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            children={documentation.content}
                            components={{
                                // Use custom renderers for certain elements
                                code({ node, inline, className, children, ...props }) {
                                    const match = /language-(\w+)/.exec(className || '');
                                    return !inline && match ? (
                                        <div className="code-block">
                                            <div className="code-header">
                                                <span className="code-language">{match[1]}</span>
                                            </div>
                                            <pre className={`language-${match[1]}`}>
                                                <code className={className} {...props}>
                                                    {children}
                                                </code>
                                            </pre>
                                        </div>
                                    ) : (
                                        <code className={className} {...props}>
                                            {children}
                                        </code>
                                    );
                                },
                                table({ node, className, children, ...props }) {
                                    return (
                                        <div className="table-container">
                                            <table className={className} {...props}>
                                                {children}
                                            </table>
                                        </div>
                                    );
                                }
                            }}
                        />
                    </div>
                ) : (
                    <div className="documentation-loading">
                        <div className="spinner"></div>
                        <p>Loading documentation viewer...</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DocumentationViewer;