import React from 'react';
import DocumentationViewer from './DocumentationViewer';
import './DocumentationPage.css';
import { FiHome, FiFileText } from 'react-icons/fi';

/**
 * DocumentationPage component serves as a container for the DocumentationViewer
 * and provides navigation context with breadcrumbs.
 */
const DocumentationPage = () => {
    return (
        <div className="documentation-page">
            <div className="documentation-page-container">
                <nav className="documentation-breadcrumbs">
                    <a href="/workspace/home" className="breadcrumb-link">
                        <FiHome className="breadcrumb-icon" />
                        Home
                    </a>
                    <span className="breadcrumb-separator">/</span>
                    <span className="breadcrumb-current">
                        <FiFileText className="breadcrumb-icon" />
                        Documentation
                    </span>
                </nav>

                <header className="documentation-page-header">
                    <h1 className="documentation-page-title">
                        API Documentation
                    </h1>

                    <p className="documentation-page-subtitle">
                        This documentation is automatically generated from your API requests. Use the interactive
                        documentation below to explore your API endpoints, parameters, and response formats.
                    </p>
                </header>

                <div className="documentation-viewer-container">
                    <DocumentationViewer />
                </div>
            </div>
        </div>
    );
};

export default DocumentationPage;