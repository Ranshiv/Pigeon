// client/src/components/DocumentationEditor.js
import React, { useState, useEffect } from 'react';
import { FiSave, FiCode, FiLink, FiImage, FiTable } from 'react-icons/fi';
import './DocumentationEditor.css';

const DocumentationEditor = ({ documentation, collection, onSave, isSaving }) => {
    const [content, setContent] = useState('');
    const [title, setTitle] = useState('');
    const [isPreview, setIsPreview] = useState(false);
    const [endpoints, setEndpoints] = useState([]);

    // Initialize editor with existing documentation or template
    useEffect(() => {
        if (documentation) {
            setContent(documentation.content || '');
            setTitle(documentation.title || `${collection?.name || ''} Documentation`);
        } else {
            // Create a template if no documentation exists
            const template = generateDocumentationTemplate(collection);
            setContent(template);
            setTitle(`${collection?.name || ''} Documentation`);
        }

        // Extract endpoints from collection
        if (collection && collection.requests) {
            const extractedEndpoints = collection.requests.map(req => ({
                id: req._id || req.id,
                name: req.name,
                method: req.method,
                url: req.url
            }));
            setEndpoints(extractedEndpoints);
        }
    }, [documentation, collection]);

    // Generate documentation template based on collection data
    const generateDocumentationTemplate = (collection) => {
        if (!collection) return '';

        let template = `# ${collection.name} Documentation\n\n`;
        template += `${collection.description || 'Welcome to the API documentation for this collection.'}\n\n`;
        template += `## Overview\n\n`;
        template += `This documentation provides information about using the ${collection.name} API.\n\n`;

        if (collection.requests && collection.requests.length > 0) {
            template += `## Endpoints\n\n`;

            collection.requests.forEach(req => {
                template += `### ${req.name}\n\n`;
                template += `\`${req.method} ${req.url}\`\n\n`;
                template += `**Description:** Add a description of this endpoint.\n\n`;
                template += `#### Request Parameters\n\n`;
                template += `| Parameter | Type | Required | Description |\n`;
                template += `|-----------|------|----------|-------------|\n`;
                template += `| param1    | string | Yes    | Description of parameter |\n\n`;
                template += `#### Response\n\n`;
                template += `\`\`\`json\n{\n  "status": "success",\n  "data": {}\n}\n\`\`\`\n\n`;
            });
        }

        return template;
    };

    // Handle saving documentation
    const handleSave = () => {
        const docData = {
            title,
            content,
            collectionId: collection?._id,
            updatedAt: new Date().toISOString(),
            ...(documentation || {}) // Preserve other properties if they exist
        };

        onSave(docData);
    };

    // Insert markdown syntax for formatting
    const insertMarkdown = (syntax, placeholder = '') => {
        const textarea = document.getElementById('documentation-textarea');
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = content.substring(start, end);
        const before = content.substring(0, start);
        const after = content.substring(end);
        const textToInsert = selectedText || placeholder;

        let newText;

        switch (syntax) {
            case 'bold':
                newText = `${before}**${textToInsert}**${after}`;
                break;
            case 'italic':
                newText = `${before}_${textToInsert}_${after}`;
                break;
            case 'code':
                newText = `${before}\`\`\`\n${textToInsert}\n\`\`\`${after}`;
                break;
            case 'link':
                newText = `${before}[${textToInsert}](url)${after}`;
                break;
            case 'image':
                newText = `${before}![${textToInsert}](image-url)${after}`;
                break;
            case 'header':
                newText = `${before}## ${textToInsert}${after}`;
                break;
            case 'table':
                newText = `${before}| Column 1 | Column 2 | Column 3 |\n|----------|----------|----------|\n| Row 1    | Data     | Data     |\n| Row 2    | Data     | Data     |${after}`;
                break;
            default:
                return;
        }

        setContent(newText);

        // Reset focus and selection
        setTimeout(() => {
            textarea.focus();
            const newPosition = start + newText.length - after.length;
            textarea.setSelectionRange(newPosition, newPosition);
        }, 0);
    };

    // Insert endpoint reference
    const insertEndpoint = (endpoint) => {
        const textarea = document.getElementById('documentation-textarea');
        if (!textarea) return;

        const start = textarea.selectionStart;
        const before = content.substring(0, start);
        const after = content.substring(start);

        const endpointMarkdown = `\n### ${endpoint.name}\n\n\`${endpoint.method} ${endpoint.url}\`\n\n**Description:** Add a description of this endpoint.\n\n`;

        setContent(`${before}${endpointMarkdown}${after}`);

        // Reset focus
        setTimeout(() => {
            textarea.focus();
            const newPosition = start + endpointMarkdown.length;
            textarea.setSelectionRange(newPosition, newPosition);
        }, 0);
    };

    // Simple markdown to HTML converter for preview
    // In a production app, you would use a proper markdown library
    const convertMarkdownToHtml = (markdown) => {
        let html = markdown;

        // Convert headers
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

        // Convert bold and italic
        html = html.replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>');
        html = html.replace(/_(.*?)_/gim, '<em>$1</em>');

        // Convert code blocks
        html = html.replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>');
        html = html.replace(/`([^`]+)`/gim, '<code>$1</code>');

        // Convert links and images
        html = html.replace(/!\[(.*?)\]\((.*?)\)/gim, '<img alt="$1" src="$2" />');
        html = html.replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2">$1</a>');

        // Convert lists
        html = html.replace(/^\s*\*\s(.*)/gim, '<ul><li>$1</li></ul>');
        html = html.replace(/^\s*\d\.\s(.*)/gim, '<ol><li>$1</li></ol>');

        // Fix combined lists
        html = html.replace(/<\/ul>\s*<ul>/gim, '');
        html = html.replace(/<\/ol>\s*<ol>/gim, '');

        // Convert paragraphs
        html = html.replace(/^(?!<[^>]*>)([^<].*)/gim, '<p>$1</p>');

        // Fix spacing and multiple paragraphs
        html = html.replace(/<\/p>\s*<p>/gim, '</p>\n<p>');

        return html;
    };

    return (
        <div className="documentation-editor">
            <div className="editor-header">
                <div className="editor-title-section">
                    <input
                        type="text"
                        className="title-input"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Documentation Title"
                    />
                </div>
                <div className="editor-actions">
                    <button
                        className={`view-toggle ${!isPreview ? 'active' : ''}`}
                        onClick={() => setIsPreview(false)}
                    >
                        Edit
                    </button>
                    <button
                        className={`view-toggle ${isPreview ? 'active' : ''}`}
                        onClick={() => setIsPreview(true)}
                    >
                        Preview
                    </button>
                    <button
                        className="save-button"
                        onClick={handleSave}
                        disabled={isSaving}
                    >
                        <FiSave /> {isSaving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>

            <div className="editor-main">
                <div className="editor-sidebar">
                    <div className="editor-tools">
                        <h4>Formatting</h4>
                        <button onClick={() => insertMarkdown('bold', 'bold text')}>
                            <strong>B</strong> Bold
                        </button>
                        <button onClick={() => insertMarkdown('italic', 'italic text')}>
                            <em>I</em> Italic
                        </button>
                        <button onClick={() => insertMarkdown('header', 'Heading')}>
                            H Heading
                        </button>
                        <button onClick={() => insertMarkdown('code', 'code')}>
                            <FiCode /> Code Block
                        </button>
                        <button onClick={() => insertMarkdown('link', 'link text')}>
                            <FiLink /> Link
                        </button>
                        <button onClick={() => insertMarkdown('image', 'image description')}>
                            <FiImage /> Image
                        </button>
                        <button onClick={() => insertMarkdown('table')}>
                            <FiTable /> Table
                        </button>
                    </div>

                    {endpoints.length > 0 && (
                        <div className="endpoints-list">
                            <h4>Endpoints</h4>
                            <p className="help-text">Click to insert endpoint documentation</p>
                            {endpoints.map((endpoint) => (
                                <div
                                    key={endpoint.id}
                                    className="endpoint-item"
                                    onClick={() => insertEndpoint(endpoint)}
                                >
                                    <span className={`method-badge method-${endpoint.method?.toLowerCase()}`}>
                                        {endpoint.method}
                                    </span>
                                    <span className="endpoint-name">{endpoint.name}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="editor-content">
                    {isPreview ? (
                        <div
                            className="documentation-preview"
                            dangerouslySetInnerHTML={{ __html: convertMarkdownToHtml(content) }}
                        />
                    ) : (
                        <textarea
                            id="documentation-textarea"
                            className="documentation-textarea"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Write your documentation here using Markdown..."
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default DocumentationEditor;