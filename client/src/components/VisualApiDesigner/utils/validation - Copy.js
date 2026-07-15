// Validation utilities for Visual API Designer

export const validateOpenAPISpec = (spec) => {
    const errors = [];
    const warnings = [];

    // Check required OpenAPI fields
    if (!spec.openapi) {
        errors.push('Missing required field: openapi');
    } else if (!spec.openapi.match(/^3\.\d+\.\d+$/)) {
        warnings.push('OpenAPI version should follow semantic versioning (3.x.x)');
    }

    if (!spec.info) {
        errors.push('Missing required field: info');
    } else {
        if (!spec.info.title) {
            errors.push('Missing required field: info.title');
        }
        if (!spec.info.version) {
            errors.push('Missing required field: info.version');
        }
    }

    // Validate paths
    if (spec.paths) {
        Object.entries(spec.paths).forEach(([path, pathItem]) => {
            // Validate path format
            if (!path.startsWith('/')) {
                errors.push(`Path "${path}" must start with /`);
            }

            // Check for path parameters
            const pathParams = (path.match(/{([^}]+)}/g) || []).map(p => p.slice(1, -1));

            Object.entries(pathItem).forEach(([method, operation]) => {
                if (typeof operation === 'object' && operation !== null) {
                    // Validate path parameters are defined
                    pathParams.forEach(param => {
                        const hasParam = operation.parameters?.some(p =>
                            p.name === param && p.in === 'path'
                        ) || operation.parameters?.some(p =>
                            p.$ref?.includes(`/${param}`)
                        );

                        if (!hasParam) {
                            warnings.push(`Path parameter "${param}" in "${method} ${path}" is not defined`);
                        }
                    });

                    // Validate responses
                    if (!operation.responses) {
                        warnings.push(`Operation "${method} ${path}" has no responses defined`);
                    } else {
                        const hasSuccessResponse = Object.keys(operation.responses).some(code =>
                            code.startsWith('2')
                        );
                        if (!hasSuccessResponse) {
                            warnings.push(`Operation "${method} ${path}" has no success response (2xx)`);
                        }
                    }
                }
            });
        });
    }

    // Validate components
    if (spec.components) {
        // Validate schema references
        if (spec.components.schemas) {
            Object.entries(spec.components.schemas).forEach(([name, schema]) => {
                validateSchema(schema, name, errors, warnings);
            });
        }

        // Validate parameter references
        if (spec.components.parameters) {
            Object.entries(spec.components.parameters).forEach(([name, param]) => {
                validateParameter(param, name, errors, warnings);
            });
        }
    }

    return { errors, warnings };
};

export const validateSchema = (schema, name, errors, warnings) => {
    if (!schema.type && !schema.$ref && !schema.allOf && !schema.oneOf && !schema.anyOf) {
        warnings.push(`Schema "${name}" has no type definition`);
    }

    if (schema.type === 'object' && schema.properties) {
        Object.entries(schema.properties).forEach(([propName, propSchema]) => {
            validateSchema(propSchema, `${name}.${propName}`, errors, warnings);
        });

        // Check if required fields exist in properties
        if (schema.required) {
            schema.required.forEach(requiredField => {
                if (!schema.properties[requiredField]) {
                    errors.push(`Required field "${requiredField}" not found in schema "${name}" properties`);
                }
            });
        }
    }

    if (schema.type === 'array' && !schema.items) {
        warnings.push(`Array schema "${name}" has no items definition`);
    }
};

export const validateParameter = (param, name, errors, warnings) => {
    if (!param.name) {
        errors.push(`Parameter "${name}" is missing name field`);
    }

    if (!param.in) {
        errors.push(`Parameter "${name}" is missing 'in' field`);
    } else if (!['query', 'header', 'path', 'cookie'].includes(param.in)) {
        errors.push(`Parameter "${name}" has invalid 'in' value: ${param.in}`);
    }

    if (param.in === 'path' && !param.required) {
        errors.push(`Path parameter "${name}" must be required`);
    }

    if (!param.schema && !param.content) {
        warnings.push(`Parameter "${name}" has no schema or content definition`);
    }
};

export const validateEndpointData = (endpoint) => {
    const errors = [];
    const warnings = [];

    if (!endpoint.path) {
        errors.push('Endpoint is missing path');
    } else {
        if (!endpoint.path.startsWith('/')) {
            errors.push('Endpoint path must start with /');
        }

        // Check for valid path format
        const pathRegex = /^\/([a-zA-Z0-9_\-{}])*$/;
        if (!pathRegex.test(endpoint.path)) {
            warnings.push('Endpoint path contains invalid characters');
        }
    }

    if (!endpoint.method) {
        errors.push('Endpoint is missing HTTP method');
    } else {
        const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
        if (!validMethods.includes(endpoint.method.toUpperCase())) {
            errors.push(`Invalid HTTP method: ${endpoint.method}`);
        }
    }

    if (!endpoint.summary && !endpoint.description) {
        warnings.push('Endpoint has no summary or description');
    }

    return { errors, warnings };
};

export const validateSchemaData = (schema) => {
    const errors = [];
    const warnings = [];

    if (!schema.name) {
        errors.push('Schema is missing name');
    }

    if (!schema.type) {
        warnings.push('Schema has no type specified, defaulting to object');
    }

    if (schema.type === 'object') {
        if (!schema.properties && !schema.additionalProperties) {
            warnings.push('Object schema has no properties defined');
        }

        if (schema.required && Array.isArray(schema.required)) {
            if (schema.properties) {
                schema.required.forEach(field => {
                    if (!schema.properties[field]) {
                        errors.push(`Required field "${field}" not found in properties`);
                    }
                });
            }
        }
    }

    if (schema.type === 'array' && !schema.items) {
        errors.push('Array schema must have items definition');
    }

    return { errors, warnings };
};

export const validateParameterData = (parameter) => {
    const errors = [];
    const warnings = [];

    if (!parameter.name) {
        errors.push('Parameter is missing name');
    }

    if (!parameter.in) {
        errors.push('Parameter is missing location (in)');
    } else {
        const validLocations = ['query', 'header', 'path', 'cookie'];
        if (!validLocations.includes(parameter.in)) {
            errors.push(`Invalid parameter location: ${parameter.in}`);
        }
    }

    if (parameter.in === 'path' && !parameter.required) {
        errors.push('Path parameters must be required');
    }

    if (!parameter.type && !parameter.schema) {
        warnings.push('Parameter has no type or schema defined');
    }

    return { errors, warnings };
};

export const validateDesignerState = (nodes, edges) => {
    const errors = [];
    const warnings = [];

    // Validate nodes
    nodes.forEach(node => {
        switch (node.type) {
            case 'endpoint':
                const endpointValidation = validateEndpointData(node.data || {});
                errors.push(...endpointValidation.errors.map(e => `Endpoint ${node.id}: ${e}`));
                warnings.push(...endpointValidation.warnings.map(w => `Endpoint ${node.id}: ${w}`));
                break;

            case 'schema':
                const schemaValidation = validateSchemaData(node.data || {});
                errors.push(...schemaValidation.errors.map(e => `Schema ${node.id}: ${e}`));
                warnings.push(...schemaValidation.warnings.map(w => `Schema ${node.id}: ${w}`));
                break;

            case 'parameter':
                const paramValidation = validateParameterData(node.data || {});
                errors.push(...paramValidation.errors.map(e => `Parameter ${node.id}: ${e}`));
                warnings.push(...paramValidation.warnings.map(w => `Parameter ${node.id}: ${w}`));
                break;

            default:
                break;
        }
    });

    // Check for orphaned nodes
    const connectedNodeIds = new Set();
    edges.forEach(edge => {
        connectedNodeIds.add(edge.source);
        connectedNodeIds.add(edge.target);
    });

    nodes.forEach(node => {
        if (!connectedNodeIds.has(node.id) && nodes.length > 1) {
            warnings.push(`Node ${node.id} is not connected to any other nodes`);
        }
    });

    // Check for invalid edge connections
    edges.forEach(edge => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);

        if (!sourceNode) {
            errors.push(`Edge ${edge.id} references non-existent source node: ${edge.source}`);
        }

        if (!targetNode) {
            errors.push(`Edge ${edge.id} references non-existent target node: ${edge.target}`);
        }

        if (sourceNode && targetNode) {
            // Validate connection types
            const validConnections = {
                'endpoint': ['schema', 'parameter', 'security'],
                'schema': ['schema'],
                'parameter': [],
                'security': []
            };

            const validTargets = validConnections[sourceNode.type] || [];
            if (!validTargets.includes(targetNode.type)) {
                warnings.push(`Invalid connection from ${sourceNode.type} to ${targetNode.type}`);
            }
        }
    });

    // Check for duplicate names
    const endpointPaths = new Map();
    const schemaNames = new Set();
    const parameterNames = new Set();

    nodes.forEach(node => {
        switch (node.type) {
            case 'endpoint':
                const key = `${node.data?.method?.toUpperCase()} ${node.data?.path}`;
                if (endpointPaths.has(key)) {
                    errors.push(`Duplicate endpoint: ${key}`);
                }
                endpointPaths.set(key, node.id);
                break;

            case 'schema':
                if (node.data?.name) {
                    if (schemaNames.has(node.data.name)) {
                        errors.push(`Duplicate schema name: ${node.data.name}`);
                    }
                    schemaNames.add(node.data.name);
                }
                break;

            case 'parameter':
                if (node.data?.name) {
                    if (parameterNames.has(node.data.name)) {
                        warnings.push(`Duplicate parameter name: ${node.data.name}`);
                    }
                    parameterNames.add(node.data.name);
                }
                break;

            default:
                break;
        }
    });

    return { errors, warnings };
};

export const validateNodeData = (nodeType, data) => {
    switch (nodeType) {
        case 'endpoint':
            return validateEndpointData(data);
        case 'schema':
            return validateSchemaData(data);
        case 'parameter':
            return validateParameterData(data);
        default:
            return { errors: [], warnings: [] };
    }
};

export const isValidOpenAPIPath = (path) => {
    if (!path || typeof path !== 'string') {
        return false;
    }

    // Must start with /
    if (!path.startsWith('/')) {
        return false;
    }

    // Basic path validation regex
    const pathRegex = /^\/[a-zA-Z0-9_\-{}]*$/;
    return pathRegex.test(path);
};

export const isValidHttpMethod = (method) => {
    if (!method || typeof method !== 'string') {
        return false;
    }

    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
    return validMethods.includes(method.toUpperCase());
};

export const isValidParameterLocation = (location) => {
    if (!location || typeof location !== 'string') {
        return false;
    }

    const validLocations = ['query', 'header', 'path', 'cookie'];
    return validLocations.includes(location.toLowerCase());
};

export const isValidSchemaType = (type) => {
    if (!type || typeof type !== 'string') {
        return false;
    }

    const validTypes = ['string', 'number', 'integer', 'boolean', 'array', 'object'];
    return validTypes.includes(type.toLowerCase());
};
