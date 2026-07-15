import { useState, useCallback, useEffect, useMemo } from 'react';
import { validateOpenAPISpec } from '../utils/validation';

const useSpecGeneration = (nodes, edges) => {
    const [generatedSpec, setGeneratedSpec] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState(null);
    const [validationErrors, setValidationErrors] = useState([]);

    const validateComponents = useCallback(() => {
        const issues = [];

        const pushError = (message, extras = {}) => issues.push({ type: 'error', message, ...extras });
        const pushWarning = (message, extras = {}) => issues.push({ type: 'warning', message, ...extras });

        // Validate nodes
        nodes.forEach(node => {
            const d = node.data || {};
            switch (node.type) {
                case 'endpoint': {
                    if (!d.path) {
                        pushError(`Endpoint is missing a path`, { nodeId: node.id, path: 'paths' });
                    } else if (!String(d.path).startsWith('/')) {
                        pushError(`Endpoint path must start with /`, { nodeId: node.id, path: 'paths' });
                    }

                    if (!d.method) {
                        pushError(`Endpoint is missing an HTTP method`, { nodeId: node.id, path: 'paths' });
                    }
                    if (d.summary && d.summary.length > 120) {
                        pushWarning(`Endpoint summary is quite long`, { nodeId: node.id, path: 'paths' });
                    }
                    break;
                }

                case 'schema': {
                    if (!d.name) {
                        pushError(`Schema is missing a name`, { nodeId: node.id, path: 'components.schemas' });
                    }
                    break;
                }

                case 'parameter': {
                    if (!d.name) {
                        pushError(`Parameter is missing a name`, { nodeId: node.id, path: 'components.parameters' });
                    }
                    if (!d.in) {
                        pushError(`Parameter is missing location (query, path, header, cookie)`, { nodeId: node.id, path: 'components.parameters' });
                    }
                    break;
                }

                default:
                    break;
            }
        });

        // Check for duplicate paths with same method
        const pathMethods = new Map();
        nodes.filter(n => n.type === 'endpoint').forEach(node => {
            const key = `${(node.data?.method || '').toUpperCase()}-${node.data?.path || ''}`;
            if (pathMethods.has(key)) {
                pushError(`Duplicate endpoint: ${node.data?.method} ${node.data?.path}`, { nodeId: node.id, path: 'paths' });
            }
            pathMethods.set(key, node.id);
        });

        // Check for duplicate schema names
        const schemaNames = new Set();
        nodes.filter(n => n.type === 'schema').forEach(node => {
            if (node.data?.name) {
                if (schemaNames.has(node.data.name)) {
                    pushError(`Duplicate schema name: "${node.data.name}"`, { nodeId: node.id, path: 'components.schemas' });
                }
                schemaNames.add(node.data.name);
            }
        });

        return issues;
    }, [nodes]);

    const sortObjectKeys = (obj) => {
        return Object.keys(obj).sort().reduce((acc, key) => {
            acc[key] = obj[key];
            return acc;
        }, {});
    };

    const generateOpenAPISpec = useCallback(async () => {
        setIsGenerating(true);
        setError(null);

        try {
            // Validate components first (do not block generation)
            const issues = validateComponents();
            setValidationErrors(issues);

            // Debug logging for spec generation
            console.log('🔧 Generating OpenAPI spec from:', {
                nodeCount: nodes.length,
                edgeCount: edges.length,
                nodeTypes: nodes.map(n => n.type),
                endpointNodes: nodes.filter(n => n.type === 'endpoint').length,
                schemaNodes: nodes.filter(n => n.type === 'schema').length
            });

            // Log detailed node data for debugging
            nodes.forEach(node => {
                if (node.type === 'endpoint' && (!node.data?.path || !node.data?.method)) {
                    console.warn('⚠️ Endpoint node missing required data:', {
                        id: node.id,
                        data: node.data,
                        hasPath: !!node.data?.path,
                        hasMethod: !!node.data?.method
                    });
                }
                if (node.type === 'schema' && !node.data?.name) {
                    console.warn('⚠️ Schema node missing name:', {
                        id: node.id,
                        data: node.data
                    });
                }
            });

            // Build spec with deterministic top-level order
            const spec = {
                openapi: '3.0.0',
                info: {
                    title: 'Generated API',
                    version: '1.0.0',
                    description: 'API specification generated from visual designer'
                },
                servers: [
                    { url: (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000') }
                ],
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

            // Build quick lookup maps for performance
            const nodesById = new Map(nodes.map(n => [n.id, n]));
            const edgesBySource = new Map();
            edges.forEach(e => {
                const arr = edgesBySource.get(e.source) || [];
                arr.push(e);
                edgesBySource.set(e.source, arr);
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
                    const connectedParameters = (edgesBySource.get(node.id) || [])
                        .map(edge => nodesById.get(edge.target))
                        .filter(n => n && n.type === 'parameter')
                        .map(paramNode => ({ $ref: `#/components/parameters/${paramNode.data.name}` }));

                    if (connectedParameters.length > 0) {
                        operation.parameters = connectedParameters;
                    }

                    // Add request body if method supports it
                    if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
                        const connectedSchemas = (edgesBySource.get(node.id) || [])
                            .filter(edge => edge.type === 'request')
                            .map(edge => nodesById.get(edge.target))
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
                    const responseSchemas = (edgesBySource.get(node.id) || [])
                        .filter(edge => edge.type === 'response')
                        .map(edge => nodesById.get(edge.target))
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

            // Deterministic sorting of paths and components
            const sortedPaths = Object.keys(spec.paths)
                .sort()
                .reduce((acc, p) => {
                    const methods = spec.paths[p];
                    acc[p] = Object.keys(methods)
                        .sort()
                        .reduce((ma, m) => { ma[m] = methods[m]; return ma; }, {});
                    return acc;
                }, {});
            spec.paths = sortedPaths;

            if (spec.components?.schemas) {
                spec.components.schemas = sortObjectKeys(spec.components.schemas);
            }
            if (spec.components?.parameters) {
                spec.components.parameters = sortObjectKeys(spec.components.parameters);
            }

            // Run additional spec-level validation
            try {
                const vr = validateOpenAPISpec(spec);
                const vIssues = [
                    ...vr.errors.map(m => ({ type: 'error', message: m })),
                    ...vr.warnings.map(m => ({ type: 'warning', message: m }))
                ];
                // Merge unique issues by message
                const existing = new Set((issues || []).map(i => i.message || String(i)));
                const merged = [
                    ...(issues || []),
                    ...vIssues.filter(i => !existing.has(i.message))
                ];
                setValidationErrors(merged);
            } catch { /* ignore validation utility errors */ }

            setGeneratedSpec(spec);

            // Debug logging for generated spec
            console.log('✅ Generated OpenAPI spec:', {
                paths: Object.keys(spec.paths || {}).length,
                operations: Object.values(spec.paths || {}).reduce((total, pathMethods) => {
                    return total + Object.keys(pathMethods).length;
                }, 0),
                schemas: Object.keys(spec.components?.schemas || {}).length,
                parameters: Object.keys(spec.components?.parameters || {}).length,
                specSize: JSON.stringify(spec).length,
                spec: spec // Full spec for debugging
            });

            return spec;
        } catch (err) {
            // Keep preview usable; only set error message
            setError(err.message || 'Failed to generate specification');
            return null;
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

    // Create efficient dependency tracking for nodes and edges
    const nodesDependency = useMemo(() => {
        return nodes.map(n => ({
            id: n.id,
            type: n.type,
            name: n.data?.name,
            // Include other essential data that affects spec generation
            path: n.data?.path,
            method: n.data?.method,
            dataHash: n.data ? Object.keys(n.data).length : 0
        }));
    }, [nodes]);

    const edgesDependency = useMemo(() => {
        return edges.map(e => ({
            id: e.id,
            source: e.source,
            target: e.target,
            type: e.type
        }));
    }, [edges]);

    // Auto-generate spec when nodes or edges change with efficient dependency tracking
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (nodes.length > 0) {
                generateOpenAPISpec().catch(() => {
                    // Error is already handled in the function
                });
            } else {
                setGeneratedSpec(null);
                setValidationErrors([]);
            }
        }, 300); // 300ms debounce to prevent rapid successive updates

        return () => clearTimeout(timeoutId);
    }, [nodes.length, edges.length, nodesDependency, edgesDependency, generateOpenAPISpec]);

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
