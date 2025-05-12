// client/src/components/DocumentationManager.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FiBook, FiCode, FiDownload, FiUpload, FiSettings, FiGlobe, FiClock, FiChevronLeft, FiEdit, FiEye } from 'react-icons/fi';
import DocumentationEditor from './DocumentationEditor';
import DocumentationViewer from './DocumentationViewer';
import './DocumentationManager.css';

const DocumentationManager = () => {
    const { collectionId } = useParams();
    const navigate = useNavigate();

    const [collection, setCollection] = useState(null);
    const [documentation, setDocumentation] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [view, setView] = useState('edit'); // 'edit', 'view', 'settings'

    useEffect(() => {
        const fetchData = async () => {
            if (!collectionId) {
                setError('No collection ID provided');
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);

                // Fetch collection data
                const collectionResponse = await fetch(`/api/collections/${collectionId}`, {
                    credentials: 'include'
                });

                if (!collectionResponse.ok) {
                    throw new Error(`Failed to fetch collection: ${collectionResponse.status}`);
                }

                const collectionData = await collectionResponse.json();
                setCollection(collectionData);

                // Fetch documentation if it exists
                try {
                    const documentationResponse = await fetch(`/api/collections/${collectionId}/documentation`, {
                        credentials: 'include'
                    });

                    if (documentationResponse.ok) {
                        const documentationData = await documentationResponse.json();
                        setDocumentation(documentationData);
                    }
                } catch (docError) {
                    console.error('Error fetching documentation, may not exist yet:', docError);
                    // No need to set error state, documentation might not exist yet
                }

            } catch (err) {
                console.error('Error fetching data:', err);
                setError(err.message || 'Failed to load documentation');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [collectionId]);

    const handleSaveDocumentation = async (docData) => {
        try {
            setIsSaving(true);

            const url = documentation
                ? `/api/collections/${collectionId}/documentation/${documentation._id}`
                : `/api/collections/${collectionId}/documentation`;

            const method = documentation ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(docData)
            });

            if (!response.ok) {
                throw new Error(`Failed to save documentation: ${response.status}`);
            }

            const savedDoc = await response.json();
            setDocumentation(savedDoc);

            // Show success message
            alert('Documentation saved successfully');

        } catch (err) {
            console.error('Error saving documentation:', err);
            alert(`Failed to save documentation: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleExportDocumentation = (format) => {
        if (!documentation) {
            alert('No documentation to export');
            return;
        }

        if (format === 'html') {
            // Create a simple HTML document with the documentation content
            const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${documentation.title || 'API Documentation'}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; }
            h1 { border-bottom: 1px solid #ddd; padding-bottom: 10px; }
            pre { background-color: #f5f5f5; padding: 10px; border-radius: 5px; }
            code { font-family: monospace; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; }
            th { background-color: #f5f5f5; }
          </style>
        </head>
        <body>
          <h1>${documentation.title || 'API Documentation'}</h1>
          <div>${convertToHtml(documentation.content)}</div>
        </body>
        </html>
      `;

            // Create a blob and download it
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${documentation.title || 'api-documentation'}.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else if (format === 'pdf') {
            alert('PDF export feature coming soon!');
        } else if (format === 'markdown') {
            // Create a blob and download the markdown content
            const blob = new Blob([documentation.content], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${documentation.title || 'api-documentation'}.md`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };

    const handleImportOpenAPI = () => {
        // Create a file input and trigger it
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json,.yaml,.yml';
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        // For simplicity, assume it's JSON format
                        const content = event.target.result;

                        try {
                            // Parse JSON content
                            const specData = JSON.parse(content);

                            // Basic validation for OpenAPI spec
                            if (!specData.openapi && !specData.swagger) {
                                throw new Error('Invalid OpenAPI/Swagger specification');
                            }

                            // Generate documentation from OpenAPI spec
                            let docContent = `# ${specData.info?.title || 'API Documentation'}\n\n`;

                            // Add API description
                            if (specData.info?.description) {
                                docContent += `${specData.info.description}\n\n`;
                            }

                            // Add version info
                            if (specData.info?.version) {
                                docContent += `**Version:** ${specData.info.version}\n\n`;
                            }

                            // Add server information
                            if (specData.servers && specData.servers.length) {
                                docContent += `## Servers\n\n`;
                                specData.servers.forEach(server => {
                                    docContent += `* ${server.url} - ${server.description || ''}\n`;
                                });
                                docContent += `\n`;
                            }

                            // Add endpoints
                            docContent += `## Endpoints\n\n`;

                            // Process paths
                            if (specData.paths) {
                                Object.entries(specData.paths).forEach(([path, methods]) => {
                                    Object.entries(methods).forEach(([method, operation]) => {
                                        // Create section for each endpoint
                                        docContent += `### ${operation.summary || `${method.toUpperCase()} ${path}`}\n\n`;
                                        if (operation.description) {
                                            docContent += `${operation.description}\n\n`;
                                        }

                                        docContent += `\`${method.toUpperCase()} ${path}\`\n\n`;

                                        // Parameters
                                        if (operation.parameters && operation.parameters.length) {
                                            docContent += `#### Parameters\n\n`;
                                            docContent += `| Name | In | Type | Required | Description |\n`;
                                            docContent += `|------|----|----|----------|-------------|\n`;

                                            operation.parameters.forEach(param => {
                                                docContent += `| ${param.name} | ${param.in} | ${param.schema?.type || 'object'} | ${param.required ? 'Yes' : 'No'} | ${param.description || ''} |\n`;
                                            });

                                            docContent += `\n`;
                                        }

                                        // Request body
                                        if (operation.requestBody) {
                                            docContent += `#### Request Body\n\n`;

                                            if (operation.requestBody.description) {
                                                docContent += `${operation.requestBody.description}\n\n`;
                                            }

                                            if (operation.requestBody.content) {
                                                const contentType = Object.keys(operation.requestBody.content)[0];
                                                const schema = operation.requestBody.content[contentType].schema;

                                                docContent += `Content Type: \`${contentType}\`\n\n`;

                                                if (schema?.$ref) {
                                                    const schemaName = schema.$ref.split('/').pop();
                                                    docContent += `Schema: ${schemaName}\n\n`;
                                                } else if (schema) {
                                                    docContent += `\`\`\`json\n${JSON.stringify(schema, null, 2)}\n\`\`\`\n\n`;
                                                }
                                            }
                                        }

                                        // Responses
                                        if (operation.responses) {
                                            docContent += `#### Responses\n\n`;

                                            Object.entries(operation.responses).forEach(([code, response]) => {
                                                docContent += `**Status Code ${code}**: ${response.description || ''}\n\n`;

                                                if (response.content) {
                                                    const contentType = Object.keys(response.content)[0];
                                                    const schema = response.content[contentType].schema;

                                                    docContent += `Content Type: \`${contentType}\`\n\n`;

                                                    if (schema?.$ref) {
                                                        const schemaName = schema.$ref.split('/').pop();
                                                        docContent += `Schema: ${schemaName}\n\n`;
                                                    } else if (schema) {
                                                        docContent += `\`\`\`json\n${JSON.stringify(schema, null, 2)}\n\`\`\`\n\n`;
                                                    }
                                                }
                                            });
                                        }
                                    });
                                });
                            }

                            // Create new documentation object
                            const newDocData = {
                                title: `${specData.info?.title || collection?.name} Documentation`,
                                content: docContent,
                                collectionId: collectionId,
                                updatedAt: new Date().toISOString(),
                                importedFrom: 'openapi'
                            };

                            // Save the generated documentation
                            await handleSaveDocumentation(newDocData);

                            // Switch to view mode to see the imported documentation
                            setView('view');

                        } catch (parseError) {
                            console.error('Error parsing OpenAPI spec:', parseError);
                            alert(`Failed to parse OpenAPI spec: ${parseError.message}`);
                        }
                    } catch (err) {
                        console.error('Error processing OpenAPI spec:', err);
                        alert(`Failed to process OpenAPI spec: ${err.message}`);
                    }
                };

                reader.readAsText(file);
            } catch (err) {
                console.error('Error reading file:', err);
                alert(`Failed to read file: ${err.message}`);
            }
        };

        fileInput.click();
    };

    const handlePublishDocumentation = async () => {
        if (!documentation) {
            alert('No documentation to publish');
            return;
        }

        try {
            const response = await fetch(`/api/collections/${collectionId}/documentation/publish`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ isPublic: true })
            });

            if (!response.ok) {
                throw new Error(`Failed to publish documentation: ${response.status}`);
            }

            const publishData = await response.json();

            alert(`Documentation published successfully! Public URL: ${publishData.publicUrl}`);
        } catch (err) {
            console.error('Error publishing documentation:', err);
            alert(`Failed to publish documentation: ${err.message}`);
        }
    };

    // Simple helper to convert markdown to HTML for export
    // In a real implementation, you'd use a proper markdown library
    const convertToHtml = (markdown) => {
        if (!markdown) return '';

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

    if (isLoading) {
        return (
            <div className="documentation-loading">
                <div className="spinner"></div>
                <p>Loading documentation...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="documentation-error">
                <h3>Error</h3>
                <p>{error}</p>
                <button onClick={() => navigate('/workspace/collections')}>Go Back to Collections</button>
            </div>
        );
    }

    return (
        <div className="documentation-manager">
            <div className="documentation-header">
                <div className="documentation-nav">
                    <Link to={`/workspace/collections/${collectionId}`} className="back-link">
                        <FiChevronLeft /> Back to Collection
                    </Link>
                </div>
                <div className="documentation-title">
                    <FiBook className="doc-icon" />
                    <h2>{collection?.name} Documentation</h2>
                    {documentation && documentation.updatedAt && (
                        <span className="last-updated">
                            <FiClock /> Last updated: {new Date(documentation.updatedAt).toLocaleString()}
                        </span>
                    )}
                </div>
                <div className="documentation-actions">
                    <div className="view-mode-toggle">
                        <button
                            className={`view-btn ${view === 'edit' ? 'active' : ''}`}
                            onClick={() => setView('edit')}
                        >
                            <FiEdit /> Edit
                        </button>
                        <button
                            className={`view-btn ${view === 'view' ? 'active' : ''}`}
                            onClick={() => setView('view')}
                        >
                            <FiEye /> Preview
                        </button>
                    </div>
                    <div className="action-dropdown">
                        <button className="action-btn">
                            <FiDownload /> Export
                        </button>
                        <div className="dropdown-content">
                            <button onClick={() => handleExportDocumentation('html')}>HTML</button>
                            <button onClick={() => handleExportDocumentation('pdf')}>PDF</button>
                            <button onClick={() => handleExportDocumentation('markdown')}>Markdown</button>
                        </div>
                    </div>
                    <div className="action-dropdown">
                        <button className="action-btn">
                            <FiUpload /> Import
                        </button>
                        <div className="dropdown-content">
                            <button onClick={handleImportOpenAPI}>OpenAPI/Swagger</button>
                        </div>
                    </div>
                    <button className="action-btn publish-btn" onClick={handlePublishDocumentation}>
                        <FiGlobe /> Publish
                    </button>
                    <button
                        className={`action-btn ${view === 'settings' ? 'active' : ''}`}
                        onClick={() => setView(view === 'settings' ? (documentation ? 'view' : 'edit') : 'settings')}
                    >
                        <FiSettings /> Settings
                    </button>
                </div>
            </div>

            <div className="documentation-content">
                {view === 'edit' && (
                    <DocumentationEditor
                        documentation={documentation}
                        collection={collection}
                        onSave={handleSaveDocumentation}
                        isSaving={isSaving}
                    />
                )}

                {view === 'view' && documentation && (
                    <DocumentationViewer
                        documentation={documentation}
                        collection={collection}
                    />
                )}

                {view === 'settings' && (
                    <div className="documentation-settings">
                        <h3>Documentation Settings</h3>

                        <div className="settings-section">
                            <h4>Visibility</h4>
                            <div className="setting-option">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={documentation?.isPublic || false}
                                        onChange={() => alert('Settings changes coming soon!')}
                                    />
                                    Make documentation public
                                </label>
                                <p className="setting-description">
                                    When enabled, your documentation will be accessible to anyone with the link.
                                </p>
                            </div>
                        </div>

                        <div className="settings-section">
                            <h4>SEO Settings</h4>
                            <div className="form-group">
                                <label htmlFor="meta-title">Meta Title</label>
                                <input
                                    type="text"
                                    id="meta-title"
                                    value={documentation?.metaTitle || ''}
                                    onChange={() => alert('Settings changes coming soon!')}
                                    placeholder="Meta title for search engines"
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="meta-description">Meta Description</label>
                                <textarea
                                    id="meta-description"
                                    value={documentation?.metaDescription || ''}
                                    onChange={() => alert('Settings changes coming soon!')}
                                    placeholder="Meta description for search engines"
                                    rows={3}
                                ></textarea>
                            </div>
                        </div>

                        <div className="settings-section">
                            <h4>Custom Domain</h4>
                            <div className="form-group">
                                <label htmlFor="custom-domain">Custom Domain</label>
                                <input
                                    type="text"
                                    id="custom-domain"
                                    value={documentation?.customDomain || ''}
                                    onChange={() => alert('Settings changes coming soon!')}
                                    placeholder="api.yourdomain.com"
                                />
                                <p className="setting-description">
                                    Requires a Professional or Team plan. Enter your custom domain to host your documentation.
                                </p>
                            </div>
                        </div>

                        <div className="settings-actions">
                            <button className="cancel-btn" onClick={() => setView(documentation ? 'view' : 'edit')}>Cancel</button>
                            <button className="save-btn" onClick={() => alert('Settings changes coming soon!')}>Save Settings</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DocumentationManager;