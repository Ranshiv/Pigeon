// client/src/components/DocumentationEditor.js
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FiSave, FiCode, FiLink, FiImage, FiTable, FiX, FiEdit3, FiEye, FiColumns } from 'react-icons/fi';
import './DocumentationEditor.css';
import { buildApiReference, buildEndpointReference } from './documentationReference';

const DOCUMENTATION_TEMPLATES = [
    { id: 'quickstart', label: 'Quick start', content: '# Getting started\n\n## Base URL\n\n`https://api.example.com`\n\n## Authentication\n\nExplain how to authenticate requests.\n\n## Make your first request\n\n```bash\ncurl https://api.example.com/health\n```\n' },
    { id: 'reference', label: 'API reference', content: '# API reference\n\n## Authentication\n\nDescribe the required headers and credentials.\n\n## Endpoints\n\nAdd endpoint details, parameters, and responses here.\n' },
    { id: 'changelog', label: 'Changelog', content: '# Changelog\n\n## Unreleased\n\n### Added\n\n- Describe new capabilities.\n\n### Changed\n\n- Describe changes.\n\n### Fixed\n\n- Describe fixes.\n' }
];

const DocumentationEditor = ({ documentation, collection, onSave, onAutoSave, isSaving }) => {
    // Initialize with empty strings to ensure blank editor by default
    const [content, setContent] = useState('');
    const [title, setTitle] = useState('');
    const [viewMode, setViewMode] = useState('edit');
    const [endpoints, setEndpoints] = useState([]);
    const [autoSaveStatus, setAutoSaveStatus] = useState('Manual save');
    const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
    const [showFind, setShowFind] = useState(false);
    const [findText, setFindText] = useState('');
    const [replaceText, setReplaceText] = useState('');
    const [commentText, setCommentText] = useState('');
    const [comments, setComments] = useState([]);
    const autoSaveTimerRef = useRef(null);
    const skipAutoSaveRef = useRef(true);
    const tableOfContents = useMemo(() => Array.from(content.matchAll(/^(#{1,3})\s+(.+)$/gm)).map((match) => ({ level: match[1].length, title: match[2], index: match.index })), [content]);

    // Debug log for initial render
    console.log('DocumentationEditor initial render:', {
        hasDocumentation: !!documentation,
        hasContent: !!documentation?.content,
        contentEmpty: documentation?.content === '',
        isNewDoc: documentation?.isNew
    });

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

    // Initialize editor with existing documentation or blank
    useEffect(() => {
        // CRITICAL FIX: Log the documentation details for debugging
        console.log('DocumentationEditor MOUNT/UPDATE - Got documentation:', {
            docExists: !!documentation,
            content: documentation?.content,
            contentLength: documentation?.content?.length,
            title: documentation?.title,
            isNew: documentation?.isNew,
            isObject: typeof documentation === 'object',
            collection: collection?.name,
            timestamp: new Date().toISOString(),
            componentKey: document.querySelector('.documentation-editor')?.getAttribute('data-key') || 'unknown'
        });

        // Always update local state from props unconditionally
        // Force refresh the content no matter what
        const docContent = documentation?.content !== undefined ? documentation.content : '';
        const docTitle = documentation?.title || (collection?.name ? `${collection.name} Documentation` : '');

        console.log(`SETTING EDITOR CONTENT: "${docContent.substring(0, 50)}..."`, {
            contentLength: docContent.length,
            isContentEmpty: docContent === '',
            isContentWhitespace: docContent.trim() === ''
        });

        console.log(`SETTING EDITOR TITLE: "${docTitle}"`);

        // Set the state with the values - force a clean replacement to prevent stale state issues
        setContent('');
        setTitle('');

        // Small delay before setting actual content to ensure clean re-render
        setTimeout(() => {
            skipAutoSaveRef.current = true;
            setContent(docContent);
            setTitle(docTitle);
        }, 10);

        // Extract endpoints from collection
        if (collection && collection.requests) {
            const extractedEndpoints = collection.requests.map(req => ({ ...req,
                id: req._id || req.id
            }));
            setEndpoints(extractedEndpoints);
        }
    }, [documentation, collection]);

    useEffect(() => {
        clearTimeout(autoSaveTimerRef.current);
        if (!autoSaveEnabled || !onAutoSave) return undefined;
        if (skipAutoSaveRef.current) {
            skipAutoSaveRef.current = false;
            return undefined;
        }

        setAutoSaveStatus('Unsaved changes');
        autoSaveTimerRef.current = setTimeout(async () => {
            setAutoSaveStatus('Saving…');
            try {
                await onAutoSave({
                    title: title || (collection?.name ? `${collection.name} Documentation` : ''),
                    content: content || ' ',
                    collectionId: collection?._id,
                    isAutoSave: true
                });
                setAutoSaveStatus('Saved just now');
            } catch {
                setAutoSaveStatus('Save failed');
            }
        }, 1200);

        return () => clearTimeout(autoSaveTimerRef.current);
    }, [autoSaveEnabled, content, title, collection, onAutoSave]);

    const handleAutoSaveToggle = (enabled) => {
        setAutoSaveEnabled(enabled);
        if (!enabled) {
            clearTimeout(autoSaveTimerRef.current);
            setAutoSaveStatus('Manual save');
        } else {
            setAutoSaveStatus('Autosave enabled');
        }
    };

    // Generate documentation template based on collection data
    // This function should only be called when the user explicitly requests it
    const generateDocumentationTemplate = (collection) => {
        console.log('generateDocumentationTemplate called manually by user');
        if (!collection) return '';

        // Example Swagger documentation template
        let template = `# ${collection.name} API Documentation\n\n`;
        template += `Welcome to the API documentation for ${collection.name}. This is a sample documentation template in Swagger/OpenAPI style.\n\n`;
        template += `## Overview\n\n`;
        template += `This is a sample server for ${collection.name}. You can find out more about Swagger at [http://swagger.io](http://swagger.io).\n\n`;
        template += `**Version:** 1.0.0\n\n`;

        template += `## Endpoints\n\n`;

        // Add some sample endpoints from collection or use generic ones
        if (collection.requests && collection.requests.length > 0) {
            collection.requests.forEach(req => {
                template += `### ${req.name}\n\n`;
                template += `\`${req.method} ${req.url}\`\n\n`;
                template += `**Description:** ${req.description || 'API endpoint description'}\n\n`;
                template += `#### Request Parameters\n\n`;
                template += `| Parameter | Type | Required | Description |\n`;
                template += `|-----------|------|----------|-------------|\n`;
                template += `| api_key | string | Yes | API key to authorize requests |\n`;
                template += `| param1 | string | Yes | Description of parameter |\n\n`;
                template += `#### Response\n\n`;
                template += `\`\`\`json\n{\n  "status": "success",\n  "data": {\n    "id": 1,\n    "name": "Sample response",\n    "category": {\n      "id": 1,\n      "name": "Example"\n    }\n  }\n}\n\`\`\`\n\n`;
            });
        } else {
            // Add generic endpoint examples if collection has no requests
            template += `### Get Item by ID\n\n`;
            template += `\`GET /api/items/{id}\`\n\n`;
            template += `**Description:** Returns a single item by ID\n\n`;
            template += `#### Request Parameters\n\n`;
            template += `| Parameter | Type | Required | Description |\n`;
            template += `|-----------|------|----------|-------------|\n`;
            template += `| id | integer | Yes | ID of item to return |\n\n`;
            template += `#### Response\n\n`;
            template += `\`\`\`json\n{\n  "id": 1,\n  "name": "Item name",\n  "status": "available"\n}\n\`\`\`\n\n`;

            template += `### Create New Item\n\n`;
            template += `\`POST /api/items\`\n\n`;
            template += `**Description:** Create a new item in the system\n\n`;
            template += `#### Request Body\n\n`;
            template += `\`\`\`json\n{\n  "name": "Item name",\n  "status": "pending"\n}\n\`\`\`\n\n`;
            template += `#### Response\n\n`;
            template += `\`\`\`json\n{\n  "id": 1,\n  "name": "Item name",\n  "status": "pending"\n}\n\`\`\`\n\n`;
        }

        template += `## Authentication\n\n`;
        template += `All API requests require the use of an API key. You can find your API key in your Account Settings.\n\n`;
        template += `Authentication to the API is performed via \`Authorization\` header with your API key as value.\n\n`;

        return template;
    };

    // Handle saving documentation
    const handleSave = () => {
        // CRITICAL: Ensure content is always explicitly a string, even when empty
        let currentContent = typeof content === 'string' ? content : '';

        // If content is completely empty, add a space to avoid server validation issues
        // This ensures the server doesn't reject empty content
        if (currentContent === '') {
            console.log('Empty content detected, adding a space to avoid server validation issues');
            currentContent = ' ';
        }

        // Ensure we have a valid structure even when saving empty content
        const docData = {
            title: title || (collection?.name ? `${collection.name} Documentation` : ''),
            content: currentContent, // Use the possibly modified content
            collectionId: collection?._id,
            updatedAt: new Date().toISOString(),
            // Only include other properties selectively to avoid potential issues
            // with properties that might conflict with our content setting
            id: documentation?.id,
            _id: documentation?._id,
            createdAt: documentation?.createdAt,
            isNew: false, // After saving, it's no longer new
            // Add a flag to indicate we should redirect to view mode after saving
            redirectToView: true
        };

        console.log('Saving documentation with data:', docData);
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

    const handleImageFileUpload = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { alert('Choose an image file.'); return; }
        const reader = new FileReader();
        reader.onload = () => {
            setImageUrl(String(reader.result));
            if (!imageAlt) setImageAlt(file.name.replace(/\.[^.]+$/, ''));
        };
        reader.readAsDataURL(file);
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

        const endpointMarkdown = `\n${buildEndpointReference(endpoint)}\n`;

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
                        <div className="form-group">
                            <label htmlFor="imageFile">Or upload an image</label>
                            <input id="imageFile" type="file" accept="image/*" onChange={handleImageFileUpload} />
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

    // Function to explicitly insert the template only when requested by user
    const handleInsertTemplate = () => {
        console.log('handleInsertTemplate called by user clicking button');

        // Confirm with the user before overwriting any existing content
        if (content && content.trim() !== '') {
            if (!window.confirm('This will replace your current documentation with a Swagger example. Continue?')) {
                return;
            }
        }

        // Generate the Swagger template and set it
        const template = generateDocumentationTemplate(collection);
        console.log('Generated template length:', template.length);

        setContent(template);
        setTitle(`${collection?.name || ''} API Documentation`);

        // Switch from the read-only preview so the inserted template is visible.
        if (viewMode === 'preview') {
            setViewMode('edit');
        }

        // Let the user know template was inserted
        console.log('Swagger example template inserted successfully');
        alert('Swagger example template has been inserted.');
    };

    const applyTemplate = (template) => {
        if (content.trim() && !window.confirm(`Replace the current documentation with the ${template.label} template?`)) return;
        setContent(template.content);
        setTitle(title || `${collection?.name || 'API'} Documentation`);
        setViewMode('edit');
    };
    const replaceAll = () => { if (findText) setContent(content.split(findText).join(replaceText)); };
    const syncEndpoints = () => {
        const missing = (collection?.requests || []).filter((request) => !content.includes(`### ${request.name}`));
        if (!missing.length) { alert('Documentation is already in sync with the collection endpoints.'); return; }
        const blocks = missing.map(buildEndpointReference).join('\n\n');
        setContent(`${content.trim()}\n\n## API reference\n\n${blocks}\n`);
        setViewMode('edit');
    };
    const generateApiReference = () => {
        const reference = buildApiReference(collection);
        if (!reference) { alert('This collection has no requests to document yet.'); return; }
        if (content.includes('## API reference') && !window.confirm('Replace the existing API reference section?')) return;
        const withoutReference = content.replace(/\n## API reference[\s\S]*$/i, '').trim();
        setContent(`${withoutReference}${withoutReference ? '\n\n' : ''}${reference}`);
        setViewMode('edit');
    };
    const postComment = async () => { if (!commentText.trim() || !collection?._id) return; const response = await fetch('/api/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ resourceId: String(collection._id), resourceType: 'documentation', content: commentText }) }); if (response.ok) { setComments([...comments, await response.json()]); setCommentText(''); } };

    return (
        <div className="documentation-editor" data-key={`editor-instance-${Date.now()}`}>
            <div className="doc-editor-header">
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
                    <span className={`autosave-status ${autoSaveStatus === 'Save failed' ? 'error' : ''}`} aria-live="polite">{autoSaveStatus}</span>
                    <label className="autosave-toggle" title="Save edits automatically">
                        <input
                            type="checkbox"
                            checked={autoSaveEnabled}
                            onChange={(event) => handleAutoSaveToggle(event.target.checked)}
                        />
                        <span>Autosave</span>
                    </label>
                    <button type="button" className="editor-find-toggle" onClick={() => setShowFind(!showFind)}>Find</button>
                    <div className="view-toggle-group">
                        <button
                            type="button"
                            className={`view-toggle-btn ${viewMode === 'edit' ? 'active' : ''}`}
                            onClick={() => setViewMode('edit')}
                        >
                            <FiEdit3 /> Edit
                        </button>
                        <button
                            type="button"
                            className={`view-toggle-btn ${viewMode === 'split' ? 'active' : ''}`}
                            onClick={() => setViewMode('split')}
                        >
                            <FiColumns /> Split
                        </button>
                        <button
                            type="button"
                            className={`view-toggle-btn ${viewMode === 'preview' ? 'active' : ''}`}
                            onClick={() => setViewMode('preview')}
                        >
                            <FiEye /> Preview
                        </button>
                    </div>
                    <button
                        className="save-button"
                        onClick={handleSave}
                        disabled={isSaving || autoSaveEnabled}
                    >
                        <FiSave /> {isSaving ? 'Saving...' : autoSaveEnabled ? 'Autosave on' : 'Save'}
                    </button>
                </div>
            </div>
            {showFind ? <div className="editor-findbar"><input value={findText} onChange={(e) => setFindText(e.target.value)} placeholder="Find" /><input value={replaceText} onChange={(e) => setReplaceText(e.target.value)} placeholder="Replace with" /><span>{findText ? content.split(findText).length - 1 : 0} matches</span><button type="button" onClick={replaceAll}>Replace all</button></div> : null}

            <div className="editor-main">
                <div className="editor-sidebar">
                    <button className="insert-template-btn" onClick={handleInsertTemplate}>
                        <FiCode /> Try Swagger Example
                    </button>
                    <div className="doc-template-picker">
                        <span>Start from a template</span>
                        <div>
                            {DOCUMENTATION_TEMPLATES.map((template) => (
                                <button type="button" key={template.id} onClick={() => applyTemplate(template)}>{template.label}</button>
                            ))}
                        </div>
                    </div>
                    <div className="editor-tools">
                        <h4>Formatting</h4>
                        <button onClick={() => insertMarkdown('bold', 'bold text')}>
                            <strong>B</strong> Bold
                        </button>
                        <button onClick={() => insertMarkdown('italic', 'italic text')}>
                            <em>I</em> Italic
                        </button>
                        <button onClick={() => insertMarkdown('header', 'Heading')}>
                            <span style={{ fontWeight: 'bold', fontSize: '16px' }}>H</span> Heading
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
                            <button type="button" className="sync-endpoints-btn" onClick={generateApiReference}>Generate API reference</button>
                            <button type="button" className="sync-endpoints-btn" onClick={syncEndpoints}>Sync endpoints</button>
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
                    {tableOfContents.length > 0 && (
                        <nav className="doc-toc" aria-label="Document outline">
                            <h4>On this page</h4>
                            {tableOfContents.map((heading) => (
                                <button type="button" key={`${heading.index}-${heading.title}`} style={{ paddingLeft: `${(heading.level - 1) * 10 + 8}px` }} onClick={() => {
                                    setViewMode('edit');
                                    setTimeout(() => { const editor = document.getElementById('documentation-textarea'); if (editor) { editor.focus(); editor.setSelectionRange(heading.index, heading.index); editor.scrollTop = Math.max(0, editor.value.slice(0, heading.index).split('\n').length * 25 - 80); } }, 0);
                                }}>{heading.title}</button>
                            ))}
                        </nav>
                    )}
                    <section className="doc-comments"><h4>Comments</h4><div>{comments.map((comment) => <p key={comment._id}>{comment.content}</p>)}</div><textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Leave feedback" /><button type="button" onClick={postComment}>Comment</button></section>
                </div>

                <div className={`editor-content editor-content--${viewMode}`}>
                    {viewMode !== 'preview' ? (
                        <textarea
                            id="documentation-textarea"
                            className="documentation-textarea"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Write your documentation here..."
                        />
                    ) : null}
                    {viewMode !== 'edit' ? (
                        <div
                            className="documentation-preview"
                            dangerouslySetInnerHTML={{ __html: convertMarkdownToHtml(content) }}
                        />
                    ) : null}
                </div>
            </div>

            {/* Render the image modal */}
            {renderImageModal()}
        </div>
    );
};

export default DocumentationEditor;

// NOTE: If you still see default documentation, check the parent component (e.g., DocumentationManager) to ensure it passes documentation={null} or documentation={undefined} for new docs. If it passes a default object with content/title, the editor will show that content.
