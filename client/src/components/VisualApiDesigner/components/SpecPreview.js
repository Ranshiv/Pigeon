import React, { useState, useEffect, useCallback } from 'react';
import VisualizationTab from './VisualizationTab';

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
        // Simple YAML formatter
        const yamlLines = [];

        const addLine = (key, value, indent = 0) => {
            const spaces = '  '.repeat(indent);
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                yamlLines.push(`${spaces}${key}:`);
                Object.entries(value).forEach(([k, v]) => {
                    addLine(k, v, indent + 1);
                });
            } else {
                yamlLines.push(`${spaces}${key}: ${JSON.stringify(value)}`);
            }
        };

        Object.entries(obj).forEach(([key, value]) => {
            addLine(key, value);
        });

        return yamlLines.join('\n');
    };

    const handleExport = async (format) => {
        if (!generatedSpec) return;

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
                    throw new Error('Unsupported format');
            }

            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            if (onExport) {
                onExport(generatedSpec, format);
            }
        } catch (err) {
            setError(`Export failed: ${err.message}`);
        }
    };

    const renderPreview = () => {
        if (isGenerating) {
            return (
                <div className="preview-loading">
                    <div className="spinner"></div>
                    <p>Generating specification...</p>
                </div>
            );
        }

        if (error) {
            return (
                <div className="preview-error">
                    <h4>Generation Error</h4>
                    <p>{error}</p>
                </div>
            );
        }

        if (!generatedSpec) {
            return (
                <div className="preview-empty">
                    <p>Add components to the canvas to generate specification</p>
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
            <pre className="spec-content">
                <code>{content}</code>
            </pre>
        );
    };

    return (
        <div className="spec-preview">
            <div className="preview-header">
                <h3>Specification Preview</h3>

                <div className="preview-controls">
                    <div className="format-toggle" role="tablist" aria-label="Format options">
                        <button
                            className={previewMode === 'json' ? 'active' : ''}
                            onClick={() => setPreviewMode('json')}
                            role="tab"
                            aria-selected={previewMode === 'json'}
                            aria-controls="spec-preview-content"
                            title="View specification in JSON format"
                        >
                            📋 JSON
                        </button>
                        <button
                            className={previewMode === 'yaml' ? 'active' : ''}
                            onClick={() => setPreviewMode('yaml')}
                            role="tab"
                            aria-selected={previewMode === 'yaml'}
                            aria-controls="spec-preview-content"
                            title="View specification in YAML format"
                        >
                            📝 YAML
                        </button>
                        <button
                            className={previewMode === 'visualization' ? 'active' : ''}
                            onClick={() => setPreviewMode('visualization')}
                            role="tab"
                            aria-selected={previewMode === 'visualization'}
                            aria-controls="spec-preview-content"
                            title="View interactive data visualizations"
                        >
                            📊 Visualizations
                        </button>
                    </div>

                    <div className="export-buttons" role="group" aria-label="Export options">
                        <button
                            onClick={() => handleExport('json')}
                            disabled={!generatedSpec}
                            title="Export specification as JSON file"
                            aria-label="Export as JSON"
                        >
                            � JSON
                        </button>
                        <button
                            onClick={() => handleExport('yaml')}
                            disabled={!generatedSpec}
                            title="Export specification as YAML file"
                            aria-label="Export as YAML"
                        >
                            � YAML
                        </button>
                    </div>
                </div>
            </div>

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
                <div className="preview-stats">
                    <div className="stat">
                        <span>Paths:</span>
                        <span>{Object.keys(generatedSpec.paths || {}).length}</span>
                    </div>
                    <div className="stat">
                        <span>Schemas:</span>
                        <span>{Object.keys(generatedSpec.components?.schemas || {}).length}</span>
                    </div>
                    <div className="stat">
                        <span>Parameters:</span>
                        <span>{Object.keys(generatedSpec.components?.parameters || {}).length}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SpecPreview;
