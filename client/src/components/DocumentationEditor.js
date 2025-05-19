// client/src/components/DocumentationEditor.js
import React, { useState, useEffect } from 'react';
import { FiSave, FiCode, FiLink, FiImage, FiTable, FiX } from 'react-icons/fi';
import './DocumentationEditor.css';

const DocumentationEditor = ({ documentation, collection, onSave, isSaving }) => {
    const [content, setContent] = useState('');
    const [title, setTitle] = useState('');
    const [isPreview, setIsPreview] = useState(false);
    const [endpoints, setEndpoints] = useState([]);

    // Add state for image modal
    const [showImageModal, setShowImageModal] = useState(false);
    const [imageAlt, setImageAlt] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [imageWidth, setImageWidth] = useState('');
    const [imageHeight, setImageHeight] = useState('');
    const [imageAlign, setImageAlign] = useState('none');
    const [imageBorderRadius, setImageBorderRadius] = useState('0');
    const [imageSelectionStart, setImageSelectionStart] = useState(0);
    const [imageSelectionEnd, setImageSelectionEnd] = useState(0);

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

    // Enhanced function to handle image insertion
    const handleImageButtonClick = () => {
        const textarea = document.getElementById('documentation-textarea');
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = content.substring(start, end);

        // Save current cursor position for later insertion
        setImageSelectionStart(start);
        setImageSelectionEnd(end);
        setImageAlt(selectedText || 'image description');
        setImageUrl('');
        setImageWidth('');
        setImageHeight('');
        setImageAlign('none');
        setImageBorderRadius('0');
        setShowImageModal(true);
    };

    // Insert image with attributes
    const insertCustomImage = () => {
        const textarea = document.getElementById('documentation-textarea');
        if (!textarea) return;

        const before = content.substring(0, imageSelectionStart);
        const after = content.substring(imageSelectionEnd);

        // Build image markdown with custom attributes
        let imageMarkdown = `![${imageAlt}](${imageUrl}`;

        // Add custom attributes if provided
        const attributes = [];
        if (imageWidth) attributes.push(`width=${imageWidth}`);
        if (imageHeight) attributes.push(`height=${imageHeight}`);
        if (imageAlign !== 'none') attributes.push(`align=${imageAlign}`);
        if (imageBorderRadius !== '0') attributes.push(`border-radius=${imageBorderRadius}`);

        if (attributes.length > 0) {
            imageMarkdown += ` "${attributes.join(' ')}"`;
        }

        imageMarkdown += ')';

        const newText = `${before}${imageMarkdown}${after}`;
        setContent(newText);
        setShowImageModal(false);

        // Reset focus and selection
        setTimeout(() => {
            textarea.focus();
            const newPosition = imageSelectionStart + imageMarkdown.length;
            textarea.setSelectionRange(newPosition, newPosition);
        }, 0);
    };

    // Insert markdown syntax for formatting
    const insertMarkdown = (syntax, placeholder = '') => {
        // Special handling for image
        if (syntax === 'image') {
            handleImageButtonClick();
            return;
        }

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

    // Enhanced markdown to HTML converter that handles image attributes
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

        // Enhanced image replacement with attributes support
        html = html.replace(/!\[(.*?)\]\((.*?)(?:\s+"(.*?)")?\)/gim, (match, alt, src, attributes) => {
            let imgTag = `<img alt="${alt}" src="${src}"`;

            if (attributes) {
                // Parse attributes
                const attrList = attributes.split(' ');
                attrList.forEach(attr => {
                    if (attr.includes('=')) {
                        const [key, value] = attr.split('=');
                        imgTag += ` ${key}="${value}"`;
                    }
                });
            }

            imgTag += ' />';
            return imgTag;
        });

        // Convert links
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

    // Image modal component
    const renderImageModal = () => {
        if (!showImageModal) return null;

        return (
            <div className="image-modal-overlay">
                <div className="image-modal">
                    <div className="image-modal-header">
                        <h3>Insert Image</h3>
                        <button className="close-btn" onClick={() => setShowImageModal(false)}>
                            <FiX />
                        </button>
                    </div>
                    <div className="image-modal-content">
                        <div className="form-group">
                            <label htmlFor="imageAlt">Alt Text</label>
                            <input
                                type="text"
                                id="imageAlt"
                                value={imageAlt}
                                onChange={(e) => setImageAlt(e.target.value)}
                                placeholder="Image description"
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="imageUrl">Image URL</label>
                            <input
                                type="text"
                                id="imageUrl"
                                value={imageUrl}
                                onChange={(e) => setImageUrl(e.target.value)}
                                placeholder="https://example.com/image.jpg"
                            />
                        </div>
                        <div className="form-row">
                            <div className="form-group half">
                                <label htmlFor="imageWidth">Width (px)</label>
                                <input
                                    type="text"
                                    id="imageWidth"
                                    value={imageWidth}
                                    onChange={(e) => setImageWidth(e.target.value)}
                                    placeholder="e.g. 300"
                                />
                            </div>
                            <div className="form-group half">
                                <label htmlFor="imageHeight">Height (px)</label>
                                <input
                                    type="text"
                                    id="imageHeight"
                                    value={imageHeight}
                                    onChange={(e) => setImageHeight(e.target.value)}
                                    placeholder="e.g. 200"
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label htmlFor="imageAlign">Alignment</label>
                            <select
                                id="imageAlign"
                                value={imageAlign}
                                onChange={(e) => setImageAlign(e.target.value)}
                            >
                                <option value="none">None</option>
                                <option value="left">Left</option>
                                <option value="center">Center</option>
                                <option value="right">Right</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="imageBorderRadius">Border Radius (px)</label>
                            <input
                                type="text"
                                id="imageBorderRadius"
                                value={imageBorderRadius}
                                onChange={(e) => setImageBorderRadius(e.target.value)}
                                placeholder="e.g. 5 for slightly rounded, 50% for circle"
                            />
                        </div>

                        {imageUrl && (
                            <div className="image-preview">
                                <h4>Preview</h4>
                                <img
                                    src={imageUrl}
                                    alt={imageAlt}
                                    style={{
                                        width: imageWidth ? `${imageWidth}px` : 'auto',
                                        height: imageHeight ? `${imageHeight}px` : 'auto',
                                        borderRadius: `${imageBorderRadius}${imageBorderRadius.includes('%') ? '' : 'px'}`,
                                        display: 'block',
                                        marginLeft: imageAlign === 'left' ? '0' : imageAlign === 'right' ? 'auto' : imageAlign === 'center' ? 'auto' : null,
                                        marginRight: imageAlign === 'right' ? '0' : imageAlign === 'left' ? 'auto' : imageAlign === 'center' ? 'auto' : null
                                    }}
                                />
                            </div>
                        )}
                    </div>
                    <div className="image-modal-actions">
                        <button className="cancel-btn" onClick={() => setShowImageModal(false)}>Cancel</button>
                        <button
                            className="insert-btn"
                            onClick={insertCustomImage}
                            disabled={!imageUrl}
                        >
                            Insert Image
                        </button>
                    </div>
                </div>
            </div>
        );
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

            {/* Render the image modal */}
            {renderImageModal()}
        </div>
    );
};

export default DocumentationEditor;