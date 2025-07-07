// client/src/components/DocumentationManager.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FiBook, FiDownload, FiUpload, FiSettings, FiGlobe, FiClock, FiChevronLeft, FiEdit, FiFileText, FiGitBranch, FiGrid } from 'react-icons/fi';
import DocumentationEditor from './DocumentationEditor';
import DocumentationViewer from './DocumentationViewer';
import DocumentationSettingsVersionHistory from './DocumentationSettingsVersionHistory';
import DocumentationContentVersionHistory from './DocumentationContentVersionHistory';
import ApiVersionManager from './ApiVersionManager';
import VisualApiDesigner from './VisualApiDesigner/VisualApiDesigner';
import './DocumentationManager.css';

// Helper function to safely parse JSON
const safeJSONParse = (data, fallback = null) => {
    if (!data || typeof data !== 'string') {
        return fallback;
    }

    try {
        return JSON.parse(data);
    } catch (error) {
        console.error('JSON Parse Error:', error);
        console.error('Invalid data:', data);
        return fallback;
    }
};

// Helper to validate if a string is valid JSON
const isValidJSON = (str) => {
    if (!str || typeof str !== 'string') return false;
    try {
        JSON.parse(str);
        return true;
    } catch (e) {
        return false;
    }
};

const DocumentationManager = () => {
    const { collectionId } = useParams();
    const navigate = useNavigate(); const [collection, setCollection] = useState(null);
    const [documentation, setDocumentation] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [view, setView] = useState('edit'); // 'edit', 'view', 'swagger', 'settings', 'history', 'api-versions', 'visual-designer'
    const [currentSettings, setCurrentSettings] = useState(null);
    const [originalSettings, setOriginalSettings] = useState(null);
    const [settingsChanged, setSettingsChanged] = useState(false);
    const [versionHistoryTab, setVersionHistoryTab] = useState('settings'); // 'settings' or 'content'

    // Listen for view changes for debugging
    useEffect(() => {
        console.log('View state changed to:', view);
    }, [view]);

    // Special effect to handle edit mode transitions
    useEffect(() => {
        if (view === 'edit' && documentation) {
            console.log('Edit mode effect triggered with documentation:', documentation);
            // This effect ensures documentation is properly loaded when edit mode is active
            // and forces a re-render of the editor component
        }
    }, [view, documentation, documentation?._timestamp]);

    // Special effect to handle view mode transitions
    useEffect(() => {
        if (view === 'view' && documentation && documentation.content) {
            console.log('View mode effect triggered with documentation:', documentation);
            // This effect ensures documentation is properly loaded when view mode is active
        }
    }, [view, documentation]);

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
                        // Only set documentation with content if it exists and is non-empty
                        console.log('Documentation data received:', documentationData);
                        console.log('Documentation content type:', typeof documentationData?.content);
                        console.log('Documentation content value:', documentationData?.content);

                        // Validate content if it exists
                        if (documentationData?.content && typeof documentationData.content === 'string') {
                            if (!isValidJSON(documentationData.content) && documentationData.content.trim() !== '') {
                                console.warn('Documentation content is not valid JSON:', documentationData.content);
                                // Clean the content or provide a fallback
                                documentationData.content = '';
                            }
                        }

                        if (documentationData &&
                            ((documentationData.content && documentationData.content.trim() !== '') ||
                                (documentationData.documentation &&
                                    documentationData.documentation.content &&
                                    documentationData.documentation.content.trim() !== ''))) {
                            console.log('Setting documentation with content');
                            setDocumentation(documentationData);
                        } else if (documentationData && documentationData.isNew) {
                            // For explicitly empty documentation, set it but mark it as new
                            console.log('Setting explicitly empty documentation');
                            setDocumentation({ ...documentationData, isNew: true });
                        } else {
                            console.log('Documentation is empty, keeping editor blank');
                            // Set empty documentation structure to avoid errors when saving
                            setDocumentation({
                                title: '',
                                content: '',
                                collectionId: collectionId,
                                isNew: true
                            });
                        }
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
    }, [collectionId]);    // Initialize settings from documentation object
    useEffect(() => {
        if (documentation) {
            // Extract settings from the documentation object
            // Check both direct properties and nested settings object
            const docSettings = documentation.settings || {};
            const settings = {
                isPublic: documentation.isPublic ?? docSettings.isPublic ?? false,
                metaTitle: documentation.metaTitle || docSettings.metaTitle || '',
                metaDescription: documentation.metaDescription || docSettings.metaDescription || '',
                customDomain: documentation.customDomain || docSettings.customDomain || '',
                allowComments: documentation.allowComments ?? docSettings.allowComments ?? false,
                showLastUpdated: documentation.showLastUpdated ?? docSettings.showLastUpdated ?? true,
                enableSearch: documentation.enableSearch ?? docSettings.enableSearch ?? true,
                theme: documentation.theme || docSettings.theme || 'default',
                displayOptions: documentation.displayOptions || docSettings.displayOptions || {}
            };

            setCurrentSettings(settings);
            setOriginalSettings(JSON.parse(JSON.stringify(settings))); // Deep copy for comparison
            setSettingsChanged(false);
        }
    }, [documentation]);// Handle settings change
    const handleSettingsChange = (field, value) => {
        setCurrentSettings(prev => {
            // Create a proper deep copy to avoid reference issues
            const updated = JSON.parse(JSON.stringify(prev || {}));

            // Handle nested properties like 'displayOptions.showContributors'
            if (field.includes('.')) {
                const [parentKey, childKey] = field.split('.');

                // Initialize parent object if it doesn't exist
                if (!updated[parentKey]) {
                    updated[parentKey] = {};
                }

                // Set the nested property
                updated[parentKey][childKey] = value;

                // Log for debugging
                console.log(`Setting nested value: ${parentKey}.${childKey} =`, value);
            } else {
                // Set the direct property
                updated[field] = value;
                console.log(`Setting value: ${field} =`, value);
            }

            // Check if settings have changed from original
            const hasChanged = JSON.stringify(updated) !== JSON.stringify(originalSettings);
            setSettingsChanged(hasChanged);

            if (hasChanged) {
                console.log('Settings changed, differences detected');
            }

            return updated;
        });
    };    // Handle settings restore from version history
    const handleSettingsRestore = (restoredSettings) => {
        // Make a deep copy of restored settings to prevent reference issues
        const settingsCopy = JSON.parse(JSON.stringify(restoredSettings));

        // Ensure displayOptions are preserved properly
        if (!settingsCopy.displayOptions) {
            settingsCopy.displayOptions = {};
        }

        // Log the settings being restored for debugging
        console.log('Restoring settings:', settingsCopy);

        // Apply restored settings to current settings
        setCurrentSettings(settingsCopy);

        // Mark as changed to enable saving
        setSettingsChanged(true);

        // Show feedback
        alert("Settings restored from previous version. Click 'Save Settings' to apply changes.");
    };

    // Handle content restore from version history
    const handleContentRestore = (restoredContent) => {
        console.log('Restoring content:', restoredContent);

        // Update the documentation with the restored content
        setDocumentation(prev => ({
            ...prev,
            content: restoredContent,
            _timestamp: Date.now() // Add timestamp to force editor re-render
        }));

        // Switch to edit view to show the restored content
        setView('edit');

        // Show feedback
        alert("Content restored from previous version. The editor has been updated with the restored content.");
    };

    const handleSaveDocumentation = async (docData) => {
        try {
            setIsSaving(true);
            console.log("Saving documentation data:", docData);

            // Try a POST request instead of PUT
            const url = `/api/collections/${collectionId}/documentation`;
            console.log("Saving to URL:", url);

            // Make sure we have a well-formed document to save
            const documentToSave = {
                title: docData.title || '',
                // CRITICAL: Always explicitly set content as a string, even if empty
                content: docData.content === undefined ? '' :
                    typeof docData.content === 'string' ? docData.content : '',
                collectionId: collectionId,
                updatedAt: new Date().toISOString(),
                // After saving, it's no longer new
                isNew: false
            };

            // Log exactly what we're saving to help debug
            console.log("Preparing to save document with content:", {
                contentType: typeof documentToSave.content,
                contentLength: documentToSave.content.length,
                content: documentToSave.content.substring(0, 50) + '...'
            });

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(documentToSave)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Server response error:", response.status, errorText);

                // Check if this is our content validation error
                if (response.status === 400 && errorText.includes('content')) {
                    console.error("Content validation error - attempting workaround with non-empty content");

                    // Try again with a space character if empty content was rejected
                    const retryResponse = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        credentials: 'include',
                        body: JSON.stringify({
                            title: docData.title || '',
                            // Add a single space if content was empty
                            content: !docData.content || docData.content === '' ? ' ' : docData.content,
                            collectionId: collectionId,
                            updatedAt: new Date().toISOString(),
                            isNew: false
                        })
                    });

                    if (retryResponse.ok) {
                        const savedDoc = await retryResponse.json();
                        console.log("Documentation saved successfully with workaround:", savedDoc);

                        // Process the response and update state just like a normal save
                        if (savedDoc) {
                            const updatedDoc = savedDoc.documentation || savedDoc;

                            // First set to null to ensure a clean update
                            setDocumentation(null);

                            setTimeout(() => {
                                // Create a complete documentation object with all required fields
                                const completeDoc = {
                                    ...updatedDoc,
                                    // After saving, it should never be considered new
                                    isNew: false,
                                    // Ensure these fields always exist
                                    title: updatedDoc.title || (collection?.name ? `${collection.name} Documentation` : ''),
                                    content: updatedDoc.content || '',
                                    collectionId: collectionId,
                                    // Add timestamp to ensure React recognizes this as a new object
                                    _timestamp: new Date().getTime()
                                };

                                // Set documentation state with the updated object
                                setDocumentation(completeDoc);
                                console.log('Updated documentation state after retry save:', completeDoc);

                                // Show success message
                                alert('Documentation saved successfully');

                                // Navigate back to the same collection page
                                navigate(`/workspace/collections/${collectionId}`);
                            }, 50);

                            // Return early from this function
                            return;
                        }
                    }
                }

                throw new Error(`Failed to save documentation: ${response.status}${errorText ? ' - ' + errorText : ''}`);
            }

            const savedDoc = await response.json();
            console.log("Documentation saved successfully:", savedDoc);

            // Handle different response formats safely
            if (savedDoc) {
                const updatedDoc = savedDoc.documentation || savedDoc;

                // Force component remounting with completely new documentation object
                // First set to null to ensure React detects the change
                setDocumentation(null);

                // Wait a moment to ensure React processes the null state
                setTimeout(() => {
                    // Create a complete and properly structured documentation object with unique timestamp
                    const completeDoc = {
                        ...updatedDoc,
                        // After saving, it should never be considered new
                        isNew: false,
                        // Ensure these fields always exist
                        title: updatedDoc.title || (collection?.name ? `${collection.name} Documentation` : ''),
                        content: updatedDoc.content || '',
                        collectionId: collectionId,
                        // Add timestamp to force React to recognize this as a new object
                        _timestamp: new Date().getTime()
                    };

                    console.log('Setting documentation with new complete object:', completeDoc);

                    // Update state with the complete doc
                    setDocumentation(completeDoc);

                    // Show success message
                    alert('Documentation saved successfully');

                    // Navigate back to the same collection page
                    navigate(`/workspace/collections/${collectionId}`);
                }, 50);
            } else {
                throw new Error('Received empty response when saving documentation');
            }

        } catch (err) {
            console.error('Error saving documentation:', err);

            // Enhanced error logging for debugging
            console.error('Error details:', {
                message: err.message,
                stack: err.stack,
                responseText: err.responseText
            });

            // More user-friendly error message with troubleshooting suggestion
            alert(`Failed to save documentation: ${err.message}\n\nTry making a small change to the content before saving again.`);
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
            // For PDF generation, we'll use an approach that works in browsers
            // First, create a hidden iframe with the HTML content
            const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${documentation.title || 'API Documentation'}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; }
            h1 { border-bottom: 1px solid #ddd; padding-bottom: 10px; }
            pre { background-color: #f5f5f5; padding: 10px; border-radius: 5px; overflow-x: auto; }
            code { font-family: monospace; }
            table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; }
            th { background-color: #f5f5f5; }
            @media print {
              body { padding: 0; }
              pre { white-space: pre-wrap; }
              a { text-decoration: none; color: #000; }
            }
          </style>
        </head>
        <body>
          <h1>${documentation.title || 'API Documentation'}</h1>
          <div>${convertToHtml(documentation.content)}</div>
        </body>
        </html>
      `;

            const iframe = document.createElement('iframe');
            iframe.style.position = 'absolute';
            iframe.style.top = '-9999px';
            iframe.style.left = '-9999px';
            document.body.appendChild(iframe);

            iframe.contentDocument.open();
            iframe.contentDocument.write(htmlContent);
            iframe.contentDocument.close();

            // Wait a moment for content to load, then print
            setTimeout(() => {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();

                // Remove the iframe after some time
                setTimeout(() => {
                    document.body.removeChild(iframe);
                }, 1000);
            }, 500);
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
        } else if (format === 'json') {
            // Export as JSON
            const jsonData = {
                title: documentation.title || 'API Documentation',
                content: documentation.content,
                createdAt: documentation.createdAt,
                updatedAt: documentation.updatedAt,
                collectionId: documentation.collectionId,
                metadata: {
                    exportedAt: new Date().toISOString(),
                    exportFormat: 'json',
                    appName: 'Pigeon'
                }
            };

            const jsonString = JSON.stringify(jsonData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${documentation.title || 'api-documentation'}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else if (format === 'xml') {
            // Export as XML
            const escapeXml = (str) => {
                return str
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&apos;');
            };

            const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<documentation>
  <title>${escapeXml(documentation.title || 'API Documentation')}</title>
  <content><![CDATA[${documentation.content}]]></content>
  <metadata>
    <createdAt>${documentation.createdAt || new Date().toISOString()}</createdAt>
    <updatedAt>${documentation.updatedAt || new Date().toISOString()}</updatedAt>
    <collectionId>${documentation.collectionId}</collectionId>
    <exportedAt>${new Date().toISOString()}</exportedAt>
    <exportFormat>xml</exportFormat>
    <appName>Pigeon</appName>
  </metadata>
</documentation>`;

            const blob = new Blob([xmlContent], { type: 'application/xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${documentation.title || 'api-documentation'}.xml`;
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
                            // Parse JSON content with error handling
                            const specData = safeJSONParse(content, null);
                            if (!specData) {
                                throw new Error('Invalid JSON format in the uploaded file');
                            }

                            // Basic validation for OpenAPI spec
                            if (!specData.openapi && !specData.swagger) {
                                throw new Error('Invalid OpenAPI/Swagger specification');
                            }

                            // Ask user for import options
                            const createApiVersion = window.confirm(
                                'Would you like to create an API version from this OpenAPI specification?\n\n' +
                                'This will create a new API version that can be used for versioning and mock server features.'
                            );

                            let createMockServer = false;
                            if (createApiVersion) {
                                createMockServer = window.confirm(
                                    'Would you also like to create a mock server with endpoints from this OpenAPI spec?\n\n' +
                                    'This will automatically generate mock endpoints based on the API specification.'
                                );
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

                            // Create new documentation object with enhanced data
                            const newDocData = {
                                title: `${specData.info?.title || collection?.name} Documentation`,
                                content: docContent,
                                importedFrom: 'openapi',
                                openApiSpec: specData,
                                createApiVersion: createApiVersion,
                                createMockServer: createMockServer
                            };

                            // Use the specific import endpoint for OpenAPI/Swagger
                            setIsSaving(true);
                            console.log("Importing OpenAPI documentation with data:", newDocData);

                            const importResponse = await fetch(`/collections/${collectionId}/documentation/import/openapi`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                credentials: 'include',
                                body: JSON.stringify(newDocData)
                            });

                            if (!importResponse.ok) {
                                const errorText = await importResponse.text();
                                console.error("Server response error:", importResponse.status, errorText);
                                throw new Error(`Failed to import documentation: ${importResponse.status}${errorText ? ' - ' + errorText : ''}`);
                            }

                            const savedData = await importResponse.json();
                            console.log("Documentation imported successfully:", savedData);

                            // Extract documentation from response
                            const savedDoc = savedData.documentation || savedData;
                            setDocumentation(savedDoc);
                            setIsSaving(false);

                            // Build success message
                            let successMessage = 'OpenAPI documentation imported successfully!';
                            if (savedData.apiVersion) {
                                successMessage += `\n\nAPI Version "${savedData.apiVersion.version}" created successfully.`;
                            }
                            if (savedData.mockServer) {
                                successMessage += `\n\nMock server "${savedData.mockServer.name}" created with ${savedData.mockServer.endpoints?.length || 0} endpoints.`;
                            }
                            if (savedData.warnings && savedData.warnings.length > 0) {
                                successMessage += `\n\nWarnings:\n${savedData.warnings.join('\n')}`;
                            }

                            // Show success message
                            alert(successMessage);

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
            const response = await fetch(`/collections/${collectionId}/documentation/publish`, {
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
    }; const handleSaveSettings = async () => {
        if (!documentation) return;
        try {
            setIsSaving(true);

            // Deep clone the current settings to avoid reference issues
            const settingsToSave = JSON.parse(JSON.stringify(currentSettings));

            console.log('Current settings before save:', settingsToSave);

            // Prepare the settings payload, preserving all existing values from currentSettings
            // but providing defaults for missing properties
            const settingsPayload = {
                isPublic: typeof settingsToSave.isPublic === 'boolean' ? settingsToSave.isPublic : false,
                metaTitle: settingsToSave.metaTitle || '',
                metaDescription: settingsToSave.metaDescription || '',
                customDomain: settingsToSave.customDomain || '',
                allowComments: typeof settingsToSave.allowComments === 'boolean' ? settingsToSave.allowComments : false,
                showLastUpdated: typeof settingsToSave.showLastUpdated === 'boolean' ? settingsToSave.showLastUpdated : true,
                enableSearch: typeof settingsToSave.enableSearch === 'boolean' ? settingsToSave.enableSearch : true,
                theme: settingsToSave.theme || 'default',
                displayOptions: settingsToSave.displayOptions || {}
            };

            console.log('Settings payload being sent to server:', settingsPayload);

            // Send PUT request to save settings
            const response = await fetch(`/api/collections/${collectionId}/documentation/settings`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settingsPayload)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Failed to save settings: ${response.status} ${errText}`);
            }

            const result = await response.json();
            console.log('Settings saved successfully:', result);            // Update documentation with saved settings while preserving currentSettings
            if (result.documentation) {
                // Update documentation object with the saved settings
                setDocumentation(prev => ({
                    ...prev,
                    ...result.documentation,
                    // Ensure all settings are also available directly on the documentation object
                    isPublic: settingsPayload.isPublic,
                    metaTitle: settingsPayload.metaTitle,
                    metaDescription: settingsPayload.metaDescription,
                    customDomain: settingsPayload.customDomain,
                    allowComments: settingsPayload.allowComments,
                    showLastUpdated: settingsPayload.showLastUpdated,
                    enableSearch: settingsPayload.enableSearch,
                    theme: settingsPayload.theme,
                    displayOptions: settingsPayload.displayOptions
                }));

                // Update the original settings reference for comparison
                setOriginalSettings(JSON.parse(JSON.stringify(settingsPayload)));
                setSettingsChanged(false);
            }            // Give user feedback
            alert('Documentation settings saved successfully');

            // Set loading state to show loader during transition
            setIsLoading(true);

            // Use a short timeout to allow the loader to display before redirecting
            setTimeout(() => {
                setView('edit');
                // After a moment to render the edit view, turn off the loader
                setTimeout(() => {
                    setIsLoading(false);
                }, 300);
            }, 500);
        } catch (err) {
            console.error('Error saving documentation settings:', err);
            alert(`Failed to save documentation settings: ${err.message}`);
        } finally {
            setIsSaving(false);
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
                    <h2>{documentation && documentation.title ? documentation.title : `${collection?.name} Documentation`}</h2>
                    {documentation && documentation.updatedAt && (
                        <span className="last-updated">
                            <FiClock /> Last updated: {new Date(documentation.updatedAt).toLocaleString()}
                        </span>
                    )}
                </div>
                <div className="documentation-actions">

                    <div className="action-dropdown">
                        <button className="action-btn">
                            <FiDownload /> Export
                        </button>
                        <div className="dropdown-content">
                            <button onClick={() => handleExportDocumentation('html')}>HTML</button>
                            <button onClick={() => handleExportDocumentation('pdf')}>PDF</button>
                            <button onClick={() => handleExportDocumentation('markdown')}>Markdown</button>
                            <button onClick={() => handleExportDocumentation('json')}>JSON</button>
                            <button onClick={() => handleExportDocumentation('xml')}>XML</button>
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
                    </button>                    <button
                        className={`action-btn ${view === 'settings' ? 'active' : ''}`}
                        onClick={() => setView(view === 'settings' ? 'edit' : 'settings')}
                    >
                        <FiSettings /> Settings
                    </button>
                    <button
                        className={`action-btn ${view === 'api-versions' ? 'active' : ''}`}
                        onClick={() => setView(view === 'api-versions' ? 'edit' : 'api-versions')}
                    >
                        <FiGitBranch /> API Versions
                    </button>
                    <button
                        className={`action-btn ${view === 'visual-designer' ? 'active' : ''}`}
                        onClick={() => setView(view === 'visual-designer' ? 'edit' : 'visual-designer')}
                    >
                        <FiGrid /> Visual Designer
                    </button>
                </div>
            </div>

            <div className="documentation-content">
                {view === 'edit' && documentation && !isLoading && (
                    <>
                        {console.log('Rendering editor with documentation:', documentation)}
                        <DocumentationEditor
                            // Force unique key on each render to guarantee component remounting
                            key={`editor-${view}-${Date.now()}-${documentation._timestamp || Math.random().toString(36).substring(2, 15)}`}
                            documentation={{
                                ...(documentation || {}),
                                title: documentation?.title || (collection?.name ? `${collection.name} Documentation` : ''),
                                content: documentation?.content || '',
                                collectionId: collectionId,
                                isNew: !documentation || !documentation.content || documentation.content.trim() === ''
                            }}
                            collection={collection}
                            onSave={handleSaveDocumentation}
                            isSaving={isSaving}
                        />
                    </>
                )}

                {view === 'edit' && (isLoading || !documentation) && (
                    <div className="documentation-loading">
                        <div className="spinner"></div>
                        <p>Loading editor...</p>
                    </div>
                )}

                {view === 'view' && documentation && documentation.content && documentation.content.trim() !== '' ? (
                    <>
                        {console.log('Rendering viewer with documentation:', documentation)}
                        <DocumentationViewer
                            documentation={documentation}
                            collection={collection}
                        />
                    </>
                ) : view === 'view' && (
                    <div className="empty-documentation-message">
                        <FiFileText size={48} color="#ccc" />
                        <h3>No Documentation Yet</h3>
                        <p>Click "Create" to start writing documentation for this collection.</p>
                        <button className="action-btn" onClick={() => setView('edit')}>
                            <FiEdit /> Create Documentation
                        </button>
                    </div>
                )}                {view === 'settings' && (
                    <div className="documentation-settings">
                        <h3>Documentation Settings</h3>

                        <div className="settings-section">
                            <h4>Visibility</h4>
                            <div className="setting-option">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={currentSettings?.isPublic || false}
                                        onChange={(e) => handleSettingsChange('isPublic', e.target.checked)}
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
                                    value={currentSettings?.metaTitle || ''}
                                    onChange={(e) => handleSettingsChange('metaTitle', e.target.value)}
                                    placeholder="Meta title for search engines"
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="meta-description">Meta Description</label>
                                <textarea
                                    id="meta-description"
                                    value={currentSettings?.metaDescription || ''}
                                    onChange={(e) => handleSettingsChange('metaDescription', e.target.value)}
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
                                    value={currentSettings?.customDomain || ''}
                                    onChange={(e) => handleSettingsChange('customDomain', e.target.value)}
                                    placeholder="api.yourdomain.com"
                                />
                                <p className="setting-description">
                                    Requires a Professional or Team plan. Enter your custom domain to host your documentation.
                                </p>
                            </div>
                        </div>

                        <div className="settings-section">
                            <h4>Display Options</h4>
                            <div className="setting-option">
                                <label>                                    <input
                                    type="checkbox"
                                    checked={Boolean(currentSettings?.displayOptions?.showContributors)}
                                    onChange={(e) => handleSettingsChange('displayOptions.showContributors', e.target.checked)}
                                />
                                    Show Contributors
                                </label>
                                <p className="setting-description">Display the list of contributors on the documentation page.</p>
                            </div>
                            <div className="setting-option">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={Boolean(currentSettings?.displayOptions?.showLastUpdated)}
                                        onChange={(e) => handleSettingsChange('displayOptions.showLastUpdated', e.target.checked)}
                                    />
                                    Show Last Updated Timestamp
                                </label>
                                <p className="setting-description">Display when the documentation was last updated.</p>
                            </div>
                            <div className="setting-option">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={Boolean(currentSettings?.displayOptions?.showTableOfContents)}
                                        onChange={(e) => handleSettingsChange('displayOptions.showTableOfContents', e.target.checked)}
                                    />
                                    Show Table of Contents
                                </label>
                                <p className="setting-description">Automatically generate and display a table of contents.</p>
                            </div>
                        </div>                        {/* Version History Section - placed before actions */}
                        <div style={{ margin: '32px 0' }}>
                            <div className="version-history-section">
                                <h3>Version History</h3>
                                <div className="version-history-tabs">
                                    <button
                                        className={`tab-btn ${versionHistoryTab === 'settings' ? 'active' : ''}`}
                                        onClick={() => setVersionHistoryTab('settings')}
                                    >
                                        <FiSettings /> Settings History
                                    </button>
                                    <button
                                        className={`tab-btn ${versionHistoryTab === 'content' ? 'active' : ''}`}
                                        onClick={() => setVersionHistoryTab('content')}
                                    >
                                        <FiFileText /> Content History
                                    </button>
                                </div>
                                <div className="version-history-content">
                                    {versionHistoryTab === 'settings' ? (
                                        <DocumentationSettingsVersionHistory
                                            documentation={documentation}
                                            collectionId={collectionId}
                                            onSettingsRestore={handleSettingsRestore}
                                        />
                                    ) : (
                                        <DocumentationContentVersionHistory
                                            collectionId={collectionId}
                                            onContentRestore={handleContentRestore}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="settings-actions">                            <button className="cancel-btn" onClick={() => {
                            handleSettingsRestore(originalSettings); // Restore to original before cancelling
                            setView('edit');
                        }}>Cancel</button>
                            <button
                                className="save-btn"
                                onClick={handleSaveSettings}
                                disabled={!settingsChanged || isSaving}
                            >
                                {isSaving ? 'Saving...' : 'Save Settings'}
                            </button>
                        </div>
                    </div>
                )}

                {view === 'history' && (
                    <div className="documentation-history">
                        <div className="history-header">
                            <button className="back-btn" onClick={() => setView('settings')}>
                                <FiChevronLeft /> Back to Settings
                            </button>
                            <h3>Settings Version History</h3>
                        </div>

                        <DocumentationSettingsVersionHistory
                            documentation={documentation}
                            collectionId={collectionId}
                            onSettingsRestore={handleSettingsRestore}
                        />
                    </div>
                )}

                {view === 'api-versions' && (
                    <ApiVersionManager
                        collectionId={collectionId}
                        collection={collection}
                    />
                )}

                {view === 'swagger' && documentation && (
                    <div className="swagger-viewer">
                        <h3>API Documentation (Swagger)</h3>
                        <pre>{JSON.stringify(documentation, null, 2)}</pre>
                    </div>
                )}

                {view === 'version-history' && documentation && (
                    <div className="version-history-viewer">
                        <h3>Version History</h3>
                        <DocumentationSettingsVersionHistory
                            documentationId={documentation.id}
                            collectionId={collectionId}
                            onClose={() => setView('settings')}
                        />
                    </div>
                )}

                {view === 'visual-designer' && (
                    <VisualApiDesigner
                        collectionId={collectionId}
                        onSpecUpdate={(spec) => {
                            // Update the documentation with the generated OpenAPI spec
                            setDocumentation(prev => ({
                                ...prev,
                                content: JSON.stringify(spec, null, 2),
                                contentType: 'openapi'
                            }));
                        }}
                        initialSpec={(() => {
                            if (!documentation?.content) return null;

                            if (typeof documentation.content === 'string') {
                                return safeJSONParse(documentation.content, null);
                            }

                            return documentation.content;
                        })()}
                    />
                )}
            </div>
        </div>
    );
};

export default DocumentationManager;