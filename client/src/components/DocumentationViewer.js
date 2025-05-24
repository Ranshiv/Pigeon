// client/src/components/DocumentationViewer.js
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiEdit, FiClock, FiExternalLink, FiFileText } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './DocumentationViewer.css';

const DocumentationViewer = ({ documentation, collection }) => {
    const [viewerReady, setViewerReady] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        // This simulates any initialization that might be needed
        // In a real implementation you might need to load syntax highlighter or other libs
        const timer = setTimeout(() => {
            setViewerReady(true);
        }, 100);

        return () => clearTimeout(timer);
    }, []);

    // Handler for clicking the Edit button
    const handleEditClick = (e) => {
        e.preventDefault();

        // Navigate to the documentation page with edit mode
        if (collection && collection._id) {
            navigate(`/workspace/collections/${collection._id}/documentation`);
        } else {
            console.error('Cannot navigate to edit page: missing collection ID');
        }
    };

    if (!documentation || !collection) {
        return (
            <div className="documentation-empty-state">
                <p>No documentation to display</p>
                <div className="documentation-actions">
                    <Link to={`/workspace/collections/${collection?._id}/documentation`} className="create-doc-link">
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
                    <div className="last-updated">
                        <FiClock className="icon" /> Last updated: {lastUpdated}
                    </div>
                    <div className="collection-name">
                        <FiFileText className="icon" /> Collection: {collection.name}
                    </div>
                    <button
                        className="edit-documentation-link"
                        onClick={handleEditClick}
                    >
                        <FiEdit className="icon" /> Edit Documentation
                    </button>
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
                {viewerReady && (
                    <div className="markdown-content">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            children={documentation.content || ''}
                        />
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