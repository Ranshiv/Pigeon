import { useState, useCallback, useEffect } from 'react';

const useSpecGeneration = (nodes, edges) => {
    const [generatedSpec, setGeneratedSpec] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState(null);
    const [validationErrors, setValidationErrors] = useState([]);

    const validateComponents = useCallback(() => {
        const errors = [];

        // Validate nodes
        nodes.forEach(node => {
            switch (node.type) {
                case 'endpoint':
                    if (!node.data?.path) {
                        errors.push(`Endpoint "${node.id}" is missing a path`);
                    } else if (!node.data.path.startsWith('/')) {
                        errors.push(`Endpoint "${node.id}" path must start with /`);
                    }

                    if (!node.data?.method) {
                        errors.push(`Endpoint "${node.id}" is missing a method`);
                    }
                    break;

                case 'schema':
                    if (!node.data?.name) {
                        errors.push(`Schema "${node.id}" is missing a name`);
                    }
                    break;

                case 'parameter':
                    if (!node.data?.name) {
                        errors.push(`Parameter "${node.id}" is missing a name`);
                    }
                    if (!node.data?.in) {
                        errors.push(`Parameter "${node.id}" is missing location (query, path, header, cookie)`);
                    }
                    break;

                default:
                    break;
            }
        });

        // Check for duplicate paths with same method
        const pathMethods = new Map();
        nodes.filter(n => n.type === 'endpoint').forEach(node => {
            const key = `${node.data?.method?.toUpperCase()}-${node.data?.path}`;
            if (pathMethods.has(key)) {
                errors.push(`Duplicate endpoint: ${node.data.method} ${node.data.path}`);
            }
            pathMethods.set(key, node.id);
        });

        // Check for duplicate schema names
        const schemaNames = new Set();
        nodes.filter(n => n.type === 'schema').forEach(node => {
            if (node.data?.name) {
                if (schemaNames.has(node.data.name)) {
                    errors.push(`Duplicate schema name: "${node.data.name}"`);
                }
                schemaNames.add(node.data.name);
            }
        });

        return errors;
    }, [nodes]);

    const generateOpenAPISpec = useCallback(async () => {
        setIsGenerating(true);
        setError(null);

        try {
            // Validate components first
            const errors = validateComponents();
            setValidationErrors(errors);

            if (errors.length > 0) {
                throw new Error(`Validation failed: ${errors.join(', ')}`);
            }

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
                    securitySchemes: {},
                    responses: {},
                    requestBodies: {}
                }
            };

            // Process API info if available
            const infoNode = nodes.find(n => n.type === 'info');
            if (infoNode?.data) {
                const { title, version, description, contact, license, termsOfService } = infoNode.data;
                if (title) spec.info.title = title;
                if (version) spec.info.version = version;
                if (description) spec.info.description = description;
                if (contact) spec.info.contact = contact;
                if (license) spec.info.license = license;
                if (termsOfService) spec.info.termsOfService = termsOfService;
            }

            // Process schemas
            const schemaNodes = nodes.filter(n => n.type === 'schema');
            schemaNodes.forEach(node => {
                const { name, type, description, required, properties, example } = node.data || {};

                if (name) {
                    spec.components.schemas[name] = {
                        type: type || 'object',
                        ...(description && { description }),
                        ...(required && { required }),
                        ...(properties && { properties }),
                        ...(example && { example })
                    };
                }
            });

            // Process parameters
            const parameterNodes = nodes.filter(n => n.type === 'parameter');
            parameterNodes.forEach(node => {
                const { name, in: paramIn, type, required, description, schema, example } = node.data || {};

                if (name) {
                    spec.components.parameters[name] = {
                        name,
                        in: paramIn || 'query',
                        required: required || false,
                        ...(description && { description }),
                        schema: schema || { type: type || 'string' },
                        ...(example && { example })
                    };
                }
            });

            // Process security schemes
            const securityNodes = nodes.filter(n => n.type === 'security');
            securityNodes.forEach(node => {
                const { name, type, scheme, bearerFormat, flows, openIdConnectUrl } = node.data || {};

                if (name) {
                    const securityScheme = {
                        type: type || 'http'
                    };

                    if (type === 'http') {
                        securityScheme.scheme = scheme || 'bearer';
                        if (bearerFormat) securityScheme.bearerFormat = bearerFormat;
                    } else if (type === 'oauth2' && flows) {
                        securityScheme.flows = flows;
                    } else if (type === 'openIdConnect' && openIdConnectUrl) {
                        securityScheme.openIdConnectUrl = openIdConnectUrl;
                    }

                    spec.components.securitySchemes[name] = securityScheme;
                }
            });

            // Process endpoints
            const endpointNodes = nodes.filter(n => n.type === 'endpoint');
            endpointNodes.forEach(node => {
                const {
                    path,
                    method,
                    summary,
                    description,
                    tags,
                    deprecated,
                    operationId
                    // parameters, requestBody, responses, security - handled via connections
                } = node.data || {};

                if (path && method) {
                    if (!spec.paths[path]) {
                        spec.paths[path] = {};
                    }

                    const operation = {
                        ...(summary && { summary }),
                        ...(description && { description }),
                        ...(tags && { tags }),
                        ...(deprecated && { deprecated }),
                        ...(operationId && { operationId }),
                        responses: {
                            '200': {
                                description: 'Successful response',
                                content: {
                                    'application/json': {
                                        schema: { type: 'object' }
                                    }
                                }
                            },
                            '400': {
                                description: 'Bad request'
                            },
                            '500': {
                                description: 'Internal server error'
                            }
                        }
                    };

                    // Add parameters from connections
                    const connectedParameters = edges
                        .filter(edge => edge.source === node.id)
                        .map(edge => nodes.find(n => n.id === edge.target))
                        .filter(n => n && n.type === 'parameter')
                        .map(paramNode => ({
                            $ref: `#/components/parameters/${paramNode.data.name}`
                        }));

                    if (connectedParameters.length > 0) {
                        operation.parameters = connectedParameters;
                    }

                    // Add request body if method supports it
                    if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
                        const connectedSchemas = edges
                            .filter(edge => edge.source === node.id && edge.type === 'request')
                            .map(edge => nodes.find(n => n.id === edge.target))
                            .filter(n => n && n.type === 'schema');

                        if (connectedSchemas.length > 0) {
                            operation.requestBody = {
                                required: true,
                                content: {
                                    'application/json': {
                                        schema: {
                                            $ref: `#/components/schemas/${connectedSchemas[0].data.name}`
                                        }
                                    }
                                }
                            };
                        }
                    }

                    // Add response schemas
                    const responseSchemas = edges
                        .filter(edge => edge.source === node.id && edge.type === 'response')
                        .map(edge => nodes.find(n => n.id === edge.target))
                        .filter(n => n && n.type === 'schema');

                    if (responseSchemas.length > 0) {
                        operation.responses['200'] = {
                            description: 'Successful response',
                            content: {
                                'application/json': {
                                    schema: {
                                        $ref: `#/components/schemas/${responseSchemas[0].data.name}`
                                    }
                                }
                            }
                        };
                    }

                    spec.paths[path][method.toLowerCase()] = operation;
                }
            });

            // Clean up empty components
            Object.keys(spec.components).forEach(key => {
                if (Object.keys(spec.components[key]).length === 0) {
                    delete spec.components[key];
                }
            });

            setGeneratedSpec(spec);
            return spec;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setIsGenerating(false);
        }
    }, [nodes, edges, validateComponents]);

    const convertToYAML = useCallback((obj) => {
        const lines = [];

        const addLine = (key, value, indent = 0) => {
            const spaces = '  '.repeat(indent);

            if (value === null || value === undefined) {
                lines.push(`${spaces}${key}: null`);
            } else if (Array.isArray(value)) {
                if (value.length === 0) {
                    lines.push(`${spaces}${key}: []`);
                } else {
                    lines.push(`${spaces}${key}:`);
                    value.forEach(item => {
                        if (typeof item === 'object') {
                            lines.push(`${spaces}  -`);
                            Object.entries(item).forEach(([k, v]) => {
                                addLine(k, v, indent + 2);
                            });
                        } else {
                            lines.push(`${spaces}  - ${typeof item === 'string' ? item : JSON.stringify(item)}`);
                        }
                    });
                }
            } else if (typeof value === 'object') {
                lines.push(`${spaces}${key}:`);
                Object.entries(value).forEach(([k, v]) => {
                    addLine(k, v, indent + 1);
                });
            } else {
                const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
                lines.push(`${spaces}${key}: ${stringValue}`);
            }
        };

        Object.entries(obj).forEach(([key, value]) => {
            addLine(key, value);
        });

        return lines.join('\n');
    }, []);

    const exportSpec = useCallback(async (format = 'json') => {
        if (!generatedSpec) {
            throw new Error('No specification available to export');
        }

        let content;
        let filename;
        let mimeType;

        switch (format.toLowerCase()) {
            case 'json':
                content = JSON.stringify(generatedSpec, null, 2);
                filename = 'openapi-spec.json';
                mimeType = 'application/json';
                break;

            case 'yaml':
            case 'yml':
                // Simple YAML conversion
                content = convertToYAML(generatedSpec);
                filename = 'openapi-spec.yaml';
                mimeType = 'application/x-yaml';
                break;

            default:
                throw new Error(`Unsupported export format: ${format}`);
        }

        // Create and trigger download
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return { content, filename, mimeType };
    }, [generatedSpec, convertToYAML]);

    const getSpecStats = useCallback(() => {
        if (!generatedSpec) {
            return {
                paths: 0,
                schemas: 0,
                parameters: 0,
                securitySchemes: 0
            };
        }

        return {
            paths: Object.keys(generatedSpec.paths || {}).length,
            operations: Object.values(generatedSpec.paths || {}).reduce((total, pathMethods) => {
                return total + Object.keys(pathMethods).length;
            }, 0),
            schemas: Object.keys(generatedSpec.components?.schemas || {}).length,
            parameters: Object.keys(generatedSpec.components?.parameters || {}).length,
            securitySchemes: Object.keys(generatedSpec.components?.securitySchemes || {}).length
        };
    }, [generatedSpec]);

    // Auto-generate spec when nodes or edges change
    useEffect(() => {
        if (nodes.length > 0) {
            generateOpenAPISpec().catch(() => {
                // Error is already handled in the function
            });
        } else {
            setGeneratedSpec(null);
            setValidationErrors([]);
        }
    }, [nodes, edges, generateOpenAPISpec]);

    return {
        generatedSpec,
        isGenerating,
        error,
        validationErrors,
        generateOpenAPISpec,
        exportSpec,
        getSpecStats,
        validateComponents
    };
};

export default useSpecGeneration;
