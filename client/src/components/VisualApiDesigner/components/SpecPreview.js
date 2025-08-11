import React, { useState, useEffect, useCallback } from 'react';
import VisualizationTab from './VisualizationTab';
import {
    FiFileText,
    FiDownload,
    FiAlertTriangle,
    FiLoader,
    FiCode,
    FiCheckCircle,
    FiBarChart2
} from 'react-icons/fi';

const SpecPreview = ({
    nodes = [],
    edges = [],
    spec = null,
    validationErrors = [],
    onExport,
    apiResponse = null,
    visualizationContext = null
}) => {
    const [previewMode, setPreviewMode] = useState('json'); // 'json', 'yaml', 'visualization'
    const [generatedSpec, setGeneratedSpec] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState(null);
    const [isExporting, setIsExporting] = useState(false);
    const [exportSuccess, setExportSuccess] = useState(false);

    // Switch to visualization tab when visualization context is provided
    useEffect(() => {
        if (visualizationContext) {
            setPreviewMode('visualization');
        }
    }, [visualizationContext]);

    const generateOpenAPISpec = useCallback(async (nodes, edges) => {
        const spec = {
            openapi: '3.0.0',
            info: {
                title: 'Generated API',
                version: '1.0.0',
                description: 'API specification generated from visual designer'
            },
            paths: {},
            components: {
                schemas: {},
                parameters: {},
                securitySchemes: {}
            }
        };

        // Process nodes to build spec
        nodes.forEach(node => {
            switch (node.type) {
                case 'endpoint':
                    const { path, method, summary, description, tags, deprecated } = node.data || {};
                    if (path && method) {
                        if (!spec.paths[path]) {
                            spec.paths[path] = {};
                        }
                        spec.paths[path][method.toLowerCase()] = {
                            summary: summary || '',
                            description: description || '',
                            tags: tags || [],
                            deprecated: deprecated || false,
                            responses: {
                                '200': {
                                    description: 'Successful response',
                                    content: {
                                        'application/json': {
                                            schema: { type: 'object' }
                                        }
                                    }
                                }
                            }
                        };
                    }
                    break;

                case 'schema':
                    const schemaData = node.data || {};
                    if (schemaData.name) {
                        spec.components.schemas[schemaData.name] = {
                            type: schemaData.type || 'object',
                            description: schemaData.description || '',
                            ...(schemaData.required && { required: schemaData.required }),
                            ...(schemaData.properties && { properties: schemaData.properties })
                        };
                    }
                    break;

                case 'parameter':
                    const paramData = node.data || {};
                    if (paramData.name) {
                        spec.components.parameters[paramData.name] = {
                            name: paramData.name,
                            in: paramData.in || 'query',
                            required: paramData.required || false,
                            description: paramData.description || '',
                            schema: {
                                type: paramData.type || 'string'
                            }
                        };
                    }
                    break;

                default:
                    break;
            }
        });

        return spec;
    }, []);

    useEffect(() => {
        const generateSpecAsync = async () => {
            setIsGenerating(true);
            setError(null);

            try {
                const spec = await generateOpenAPISpec(nodes, edges);
                setGeneratedSpec(spec);
            } catch (err) {
                setError(err.message);
                setGeneratedSpec(null);
            } finally {
                setIsGenerating(false);
            }
        };

        generateSpecAsync();
    }, [nodes, edges, generateOpenAPISpec]);

    const formatJson = (obj) => {
        return JSON.stringify(obj, null, 2);
    };

    const formatYaml = (obj) => {
        // Simple YAML formatter with better error handling
        const yamlLines = [];

        const addLine = (key, value, indent = 0) => {
            const spaces = '  '.repeat(indent);

            if (value === null || value === undefined) {
                yamlLines.push(`${spaces}${key}: null`);
            } else if (Array.isArray(value)) {
                if (value.length === 0) {
                    yamlLines.push(`${spaces}${key}: []`);
                } else {
                    yamlLines.push(`${spaces}${key}:`);
                    value.forEach(item => {
                        if (typeof item === 'object' && item !== null) {
                            yamlLines.push(`${spaces}  -`);
                            Object.entries(item).forEach(([k, v]) => {
                                addLine(k, v, indent + 2);
                            });
                        } else {
                            const itemStr = typeof item === 'string' ? item : JSON.stringify(item);
                            yamlLines.push(`${spaces}  - ${itemStr}`);
                        }
                    });
                }
            } else if (typeof value === 'object' && value !== null) {
                yamlLines.push(`${spaces}${key}:`);
                Object.entries(value).forEach(([k, v]) => {
                    addLine(k, v, indent + 1);
                });
            } else {
                const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
                yamlLines.push(`${spaces}${key}: ${valueStr}`);
            }
        };

        try {
            Object.entries(obj).forEach(([key, value]) => {
                addLine(key, value);
            });
            return yamlLines.join('\n');
        } catch (error) {
            console.error('YAML formatting error:', error);
            return `# Error formatting YAML: ${error.message}\n# Falling back to JSON\n${JSON.stringify(obj, null, 2)}`;
        }
    };

    const handleExport = async (format) => {
        if (!generatedSpec) {
            console.error('No generated spec available for export');
            setError('No specification available to export');
            return;
        }

        setIsExporting(format); // Track which format is being exported
        setError(null);

        try {
            let content;
            let filename;
            let mimeType;

            switch (format) {
                case 'json':
                    content = formatJson(generatedSpec);
                    filename = 'api-spec.json';
                    mimeType = 'application/json';
                    break;
                case 'yaml':
                    content = formatYaml(generatedSpec);
                    filename = 'api-spec.yaml';
                    mimeType = 'application/x-yaml';
                    break;
                default:
                    throw new Error(`Unsupported format: ${format}`);
            }

            console.log('Exporting spec:', { format, filename, contentLength: content.length });

            // Create blob and download
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);

            // Create download link
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.style.display = 'none';

            // Add to DOM, click, and remove
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // Clean up
            URL.revokeObjectURL(url);

            console.log('Export completed successfully');

            // Show success state for the specific format
            setExportSuccess(format);

            if (onExport) {
                onExport(generatedSpec, format);
            }
        } catch (err) {
            console.error('Export failed:', err);
            setError(`Export failed: ${err.message}`);
        } finally {
            setIsExporting(false);
        }
    };

    // Debug function to check spec state
    const debugSpecState = () => {
        console.log('=== SpecPreview Debug Info ===');
        console.log('Generated spec:', generatedSpec);
        console.log('Nodes:', nodes);
        console.log('Edges:', edges);
        console.log('Is generating:', isGenerating);
        console.log('Error:', error);
        console.log('Preview mode:', previewMode);
        console.log('=============================');
    };

    // Add debug button in development
    const isDevelopment = process.env.NODE_ENV === 'development';

    const renderPreview = () => {
        if (isGenerating) {
            return (
                <div className="preview-loading">
                    <div className="spinner-container">
                        <FiLoader className="spinner" aria-hidden="true" />
                    </div>
                    <p>Generating specification...</p>
                    <span className="loading-subtitle">Analyzing API structure</span>
                </div>
            );
        }

        if (error) {
            return (
                <div className="preview-error">
                    <div className="error-icon-large">
                        <FiAlertTriangle aria-hidden="true" />
                    </div>
                    <h4>Generation Error</h4>
                    <p>{error}</p>
                    <button
                        className="retry-button"
                        onClick={() => {
                            setIsGenerating(true);
                            setError(null);
                            setTimeout(() => {
                                const generateSpecAsync = async () => {
                                    try {
                                        const spec = await generateOpenAPISpec(nodes, edges);
                                        setGeneratedSpec(spec);
                                    } catch (err) {
                                        setError(err.message);
                                        setGeneratedSpec(null);
                                    } finally {
                                        setIsGenerating(false);
                                    }
                                };
                                generateSpecAsync();
                            }, 500);
                        }}
                    >
                        Try Again
                    </button>
                </div>
            );
        }

        if (!generatedSpec) {
            return (
                <div className="preview-empty">
                    <div className="empty-icon">
                        <FiCode aria-hidden="true" />
                    </div>
                    <p className="empty-title">No API Specification Available</p>
                    <p className="empty-description">
                        Add endpoints, schemas, or parameters to the canvas to generate a specification
                    </p>
                </div>
            );
        }

        if (previewMode === 'visualization') {
            return (
                <VisualizationTab
                    apiResponse={visualizationContext?.responseData || apiResponse}
                    nodes={nodes}
                    visualizationContext={visualizationContext}
                    onVisualizationUpdate={(viz) => {
                        console.log('Visualization created:', viz);
                        // Could emit events here for parent components
                    }}
                />
            );
        }

        const content = previewMode === 'json'
            ? formatJson(generatedSpec)
            : formatYaml(generatedSpec);

        return (
            <div className="spec-content-container">
                <pre className="spec-content">
                    <code>{content}</code>
                </pre>
                <div className="spec-actions">
                    <button
                        className="copy-btn"
                        onClick={() => {
                            navigator.clipboard.writeText(content)
                                .then(() => {
                                    const copyBtn = document.querySelector('.copy-btn');
                                    copyBtn.innerHTML = '<span>Copied!</span>';
                                    setTimeout(() => {
                                        copyBtn.innerHTML = '<span>Copy</span>';
                                    }, 2000);
                                })
                                .catch(err => {
                                    console.error('Copy failed:', err);
                                });
                        }}
                        title="Copy to clipboard"
                        aria-label="Copy specification to clipboard"
                    >
                        <span>Copy</span>
                    </button>
                </div>
            </div>
        );
    };

    // Handle export success feedback
    useEffect(() => {
        if (exportSuccess) {
            const timer = setTimeout(() => {
                setExportSuccess(false);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [exportSuccess]);

    // Modified export handler with success feedback
    const handleExportWithFeedback = async (format) => {
        await handleExport(format);
        setExportSuccess(true); // Show success state after successful export
    };

    return (
        <div className="spec-preview modern">
            <div className="preview-header glass-effect">
                <h3>
                    <FiCode className="header-icon" aria-hidden="true" />
                    Specification Preview
                </h3>

                <div className="preview-controls">
                    <div
                        className="format-toggle"
                        role="tablist"
                        aria-label="Format options"
                    >
                        <button
                            className={`format-btn ${previewMode === 'json' ? 'active' : ''}`}
                            onClick={() => setPreviewMode('json')}
                            role="tab"
                            aria-selected={previewMode === 'json'}
                            aria-controls="spec-preview-content"
                            title="View specification in JSON format"
                            aria-label="JSON format"
                        >
                            <FiFileText className="btn-icon" aria-hidden="true" />
                            <span>JSON</span>
                        </button>
                        <button
                            className={`format-btn ${previewMode === 'yaml' ? 'active' : ''}`}
                            onClick={() => setPreviewMode('yaml')}
                            role="tab"
                            aria-selected={previewMode === 'yaml'}
                            aria-controls="spec-preview-content"
                            title="View specification in YAML format"
                            aria-label="YAML format"
                        >
                            <FiCode className="btn-icon" aria-hidden="true" />
                            <span>YAML</span>
                        </button>
                        <button
                            className={`format-btn ${previewMode === 'visualization' ? 'active' : ''}`}
                            onClick={() => setPreviewMode('visualization')}
                            role="tab"
                            aria-selected={previewMode === 'visualization'}
                            aria-controls="spec-preview-content"
                            title="View interactive data visualizations"
                            aria-label="Visualizations view"
                        >
                            <FiBarChart2 className="btn-icon" aria-hidden="true" />
                            <span>Visualizations</span>
                        </button>
                    </div>

                    <div
                        className="export-buttons"
                        role="group"
                        aria-label="Export options"
                    >
                        {isDevelopment && (
                            <button
                                className="debug-btn"
                                onClick={debugSpecState}
                                title="Debug specification state"
                                aria-label="Debug specification"
                            >
                                <FiCode className="btn-icon" aria-hidden="true" />
                                <span>Debug</span>
                            </button>
                        )}
                        <button
                            className={`export-btn ${exportSuccess === 'json' ? 'success' : ''}`}
                            onClick={() => handleExportWithFeedback('json')}
                            disabled={!generatedSpec || isExporting}
                            title="Export specification as JSON file"
                            aria-label="Export as JSON"
                        >
                            {isExporting === 'json' ? (
                                <><FiLoader className="btn-icon spinning" aria-hidden="true" /> Exporting...</>
                            ) : exportSuccess === 'json' ? (
                                <><FiCheckCircle className="btn-icon" aria-hidden="true" /> Exported</>
                            ) : (
                                <><FiDownload className="btn-icon" aria-hidden="true" /> JSON</>
                            )}
                        </button>
                        <button
                            className={`export-btn ${exportSuccess === 'yaml' ? 'success' : ''}`}
                            onClick={() => handleExportWithFeedback('yaml')}
                            disabled={!generatedSpec || isExporting}
                            title="Export specification as YAML file"
                            aria-label="Export as YAML"
                        >
                            {isExporting === 'yaml' ? (
                                <><FiLoader className="btn-icon spinning" aria-hidden="true" /> Exporting...</>
                            ) : exportSuccess === 'yaml' ? (
                                <><FiCheckCircle className="btn-icon" aria-hidden="true" /> Exported</>
                            ) : (
                                <><FiDownload className="btn-icon" aria-hidden="true" /> YAML</>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {error && (
                <div className="preview-error-banner">
                    <div className="error-icon">
                        <FiAlertTriangle aria-hidden="true" />
                    </div>
                    <span className="error-message">{error}</span>
                    <button
                        className="error-dismiss"
                        onClick={() => setError(null)}
                        title="Dismiss error"
                        aria-label="Dismiss error"
                    >
                        <span aria-hidden="true">×</span>
                    </button>
                </div>
            )}

            <div
                className="preview-content"
                id="spec-preview-content"
                role="tabpanel"
                aria-live="polite"
                aria-label={`Specification preview in ${previewMode} format`}
            >
                {renderPreview()}
            </div>

            {generatedSpec && (
                <div className="preview-stats glass-effect">
                    <div className="stat-card">
                        <div className="stat-icon">
                            <FiCode aria-hidden="true" />
                        </div>
                        <div className="stat-content">
                            <span className="stat-label">Paths</span>
                            <span className="stat-value">{Object.keys(generatedSpec.paths || {}).length}</span>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">
                            <FiFileText aria-hidden="true" />
                        </div>
                        <div className="stat-content">
                            <span className="stat-label">Schemas</span>
                            <span className="stat-value">{Object.keys(generatedSpec.components?.schemas || {}).length}</span>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">
                            <FiBarChart2 aria-hidden="true" />
                        </div>
                        <div className="stat-content">
                            <span className="stat-label">Parameters</span>
                            <span className="stat-value">{Object.keys(generatedSpec.components?.parameters || {}).length}</span>
                        </div>
                    </div>
                </div>
            )}

            {isDevelopment && (
                <div className="debug-info">
                    <h4>Debug Info</h4>
                    <button
                        className="debug-btn"
                        onClick={debugSpecState}
                        title="Debug spec state"
                        aria-label="Debug specification state"
                    >
                        <FiCode className="btn-icon" aria-hidden="true" />
                        <span>Debug Spec State</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default SpecPreview;
