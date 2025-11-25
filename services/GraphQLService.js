// services/GraphQLService.js
const { graphql, buildSchema, introspectionFromSchema, printSchema } = require('graphql');
const axios = require('axios');
const graphqlValidator = require('../utils/graphql-validator');

/**
 * GraphQL Service
 * Handles GraphQL query execution, schema introspection, and operation management
 * Supports modern GraphQL features as of 2025
 */

class GraphQLService {
    constructor() {
        this.schemaCache = new Map(); // Cache schemas by URL
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Execute a GraphQL operation
     * @param {Object} options - Execution options
     * @returns {Object} - Execution result
     */
    async executeOperation({ url, query, variables = {}, operationName = null, headers = {} }) {
        try {
            // Validate query first
            const validation = graphqlValidator.validate(query);
            if (!validation.valid) {
                return {
                    success: false,
                    errors: validation.errors,
                    data: null
                };
            }

            // Add security warnings if any
            const warnings = validation.warnings.length > 0 ? validation.warnings : undefined;

            // Prepare request body
            const requestBody = {
                query,
                variables,
                operationName
            };

            // Set default headers
            const requestHeaders = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...headers
            };

            // Execute HTTP request
            const startTime = Date.now();
            const response = await axios.post(url, requestBody, {
                headers: requestHeaders,
                timeout: 30000, // 30 second timeout
                validateStatus: () => true // Don't throw on any status
            });
            const executionTime = Date.now() - startTime;

            // Parse response
            const result = {
                success: response.status === 200 && !response.data.errors,
                data: response.data.data || null,
                errors: response.data.errors || [],
                extensions: response.data.extensions || {},
                statusCode: response.status,
                executionTime,
                warnings
            };

            // Add complexity info
            if (validation.info?.complexity) {
                result.complexity = validation.info.complexity;
            }

            return result;
        } catch (error) {
            return {
                success: false,
                errors: [{
                    message: error.message,
                    type: 'NETWORK_ERROR',
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                }],
                data: null
            };
        }
    }

    /**
     * Fetch schema from a GraphQL endpoint using introspection
     * @param {string} url - GraphQL endpoint URL
     * @param {Object} headers - Request headers
     * @returns {Object} - Schema information
     */
    async introspectSchema(url, headers = {}) {
        try {
            // Check cache first
            const cacheKey = `${url}-${JSON.stringify(headers)}`;
            const cached = this.schemaCache.get(cacheKey);

            if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
                return {
                    success: true,
                    schema: cached.schema,
                    sdl: cached.sdl,
                    cached: true
                };
            }

            // Get introspection query
            const introspectionQuery = graphqlValidator.getIntrospectionQuery();

            // Execute introspection
            const response = await axios.post(url, {
                query: introspectionQuery
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                },
                timeout: 30000
            });

            if (response.data.errors) {
                return {
                    success: false,
                    errors: response.data.errors,
                    message: 'Introspection query failed'
                };
            }

            const introspectionResult = response.data.data;

            // Build schema from introspection
            const schema = introspectionResult.__schema;

            // Convert to SDL (Schema Definition Language)
            const sdl = this.introspectionToSDL(schema);

            // Cache the result
            this.schemaCache.set(cacheKey, {
                schema: introspectionResult,
                sdl,
                timestamp: Date.now()
            });

            return {
                success: true,
                schema: introspectionResult,
                sdl,
                types: schema.types.filter(t => !t.name.startsWith('__')).map(t => ({
                    name: t.name,
                    kind: t.kind,
                    description: t.description
                })),
                cached: false
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: 'Failed to introspect schema'
            };
        }
    }

    /**
     * Convert introspection result to SDL
     * @param {Object} schema - Introspection schema
     * @returns {string} - SDL representation
     */
    introspectionToSDL(schema) {
        let sdl = '';

        // Add query type
        if (schema.queryType) {
            const queryType = schema.types.find(t => t.name === schema.queryType.name);
            if (queryType) {
                sdl += this.typeToSDL(queryType) + '\n\n';
            }
        }

        // Add mutation type
        if (schema.mutationType) {
            const mutationType = schema.types.find(t => t.name === schema.mutationType.name);
            if (mutationType) {
                sdl += this.typeToSDL(mutationType) + '\n\n';
            }
        }

        // Add subscription type
        if (schema.subscriptionType) {
            const subscriptionType = schema.types.find(t => t.name === schema.subscriptionType.name);
            if (subscriptionType) {
                sdl += this.typeToSDL(subscriptionType) + '\n\n';
            }
        }

        // Add other types (excluding built-ins)
        schema.types
            .filter(t => !t.name.startsWith('__') &&
                t.name !== schema.queryType?.name &&
                t.name !== schema.mutationType?.name &&
                t.name !== schema.subscriptionType?.name)
            .forEach(type => {
                sdl += this.typeToSDL(type) + '\n\n';
            });

        return sdl.trim();
    }

    /**
     * Convert a type to SDL representation
     * @param {Object} type - Type object from introspection
     * @returns {string} - SDL string
     */
    typeToSDL(type) {
        if (!type) return '';

        let sdl = type.description ? `"""${type.description}"""\n` : '';

        switch (type.kind) {
            case 'OBJECT':
                sdl += `type ${type.name}`;
                if (type.interfaces && type.interfaces.length > 0) {
                    sdl += ` implements ${type.interfaces.map(i => i.name).join(' & ')}`;
                }
                sdl += ' {\n';
                if (type.fields) {
                    type.fields.forEach(field => {
                        sdl += `  ${field.name}`;
                        if (field.args && field.args.length > 0) {
                            sdl += '(';
                            sdl += field.args.map(arg =>
                                `${arg.name}: ${this.typeRefToString(arg.type)}`
                            ).join(', ');
                            sdl += ')';
                        }
                        sdl += `: ${this.typeRefToString(field.type)}\n`;
                    });
                }
                sdl += '}';
                break;

            case 'INPUT_OBJECT':
                sdl += `input ${type.name} {\n`;
                if (type.inputFields) {
                    type.inputFields.forEach(field => {
                        sdl += `  ${field.name}: ${this.typeRefToString(field.type)}\n`;
                    });
                }
                sdl += '}';
                break;

            case 'INTERFACE':
                sdl += `interface ${type.name} {\n`;
                if (type.fields) {
                    type.fields.forEach(field => {
                        sdl += `  ${field.name}: ${this.typeRefToString(field.type)}\n`;
                    });
                }
                sdl += '}';
                break;

            case 'ENUM':
                sdl += `enum ${type.name} {\n`;
                if (type.enumValues) {
                    type.enumValues.forEach(value => {
                        if (value.description) {
                            sdl += `  """${value.description}"""\n`;
                        }
                        sdl += `  ${value.name}\n`;
                    });
                }
                sdl += '}';
                break;

            case 'UNION':
                sdl += `union ${type.name} = ${type.possibleTypes.map(t => t.name).join(' | ')}`;
                break;

            case 'SCALAR':
                sdl += `scalar ${type.name}`;
                break;

            default:
                sdl += `# Unknown type kind: ${type.kind}`;
        }

        return sdl;
    }

    /**
     * Convert type reference to string
     * @param {Object} typeRef - Type reference object
     * @returns {string} - Type string
     */
    typeRefToString(typeRef) {
        if (typeRef.kind === 'NON_NULL') {
            return `${this.typeRefToString(typeRef.ofType)}!`;
        }
        if (typeRef.kind === 'LIST') {
            return `[${this.typeRefToString(typeRef.ofType)}]`;
        }
        return typeRef.name;
    }

    /**
     * Validate a query against a schema
     * @param {string} query - GraphQL query
     * @param {string} schemaSDL - Schema in SDL format
     * @returns {Object} - Validation result
     */
    validateQuery(query, schemaSDL) {
        return graphqlValidator.validateAgainstSchema(query, schemaSDL);
    }

    /**
     * Analyze query complexity and provide optimization suggestions
     * @param {string} query - GraphQL query
     * @returns {Object} - Analysis result with suggestions
     */
    analyzeQuery(query) {
        const validation = graphqlValidator.validate(query);
        const complexity = graphqlValidator.calculateComplexity(query);
        const depthCheck = graphqlValidator.checkDepthLimit(query);
        const operationInfo = graphqlValidator.extractOperationInfo(query);

        const suggestions = [];

        // Depth suggestions
        if (depthCheck.depth > 7) {
            suggestions.push({
                type: 'depth',
                severity: 'warning',
                message: 'Consider reducing query depth by using fragments or multiple queries',
                current: depthCheck.depth,
                recommended: 7
            });
        }

        // Complexity suggestions
        if (complexity.complexity > 500) {
            suggestions.push({
                type: 'complexity',
                severity: 'warning',
                message: 'High complexity query. Consider splitting into multiple queries or using pagination',
                current: complexity.complexity,
                recommended: 500
            });
        }

        // Alias suggestions
        if (complexity.breakdown.aliases > 10) {
            suggestions.push({
                type: 'aliases',
                severity: 'info',
                message: 'Many aliases detected. Ensure they are necessary for your use case',
                count: complexity.breakdown.aliases
            });
        }

        return {
            valid: validation.valid,
            complexity,
            depth: depthCheck.depth,
            operations: operationInfo.operations,
            suggestions,
            score: this.calculateHealthScore(complexity, depthCheck, validation)
        };
    }

    /**
     * Calculate health score for a query (0-100)
     * @param {Object} complexity - Complexity analysis
     * @param {Object} depthCheck - Depth check result
     * @param {Object} validation - Validation result
     * @returns {number} - Health score
     */
    calculateHealthScore(complexity, depthCheck, validation) {
        let score = 100;

        // Penalize for errors
        if (!validation.valid) {
            score -= 50;
        }

        // Penalize for complexity
        if (complexity.complexity > 1000) {
            score -= 30;
        } else if (complexity.complexity > 500) {
            score -= 15;
        }

        // Penalize for depth
        if (depthCheck.depth > 10) {
            score -= 20;
        } else if (depthCheck.depth > 7) {
            score -= 10;
        }

        // Penalize for warnings
        score -= validation.warnings.length * 5;

        return Math.max(0, score);
    }

    /**
     * Clear schema cache
     */
    clearCache() {
        this.schemaCache.clear();
    }
}

module.exports = new GraphQLService();
