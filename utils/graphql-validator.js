// utils/graphql-validator.js
const { parse, validate, buildSchema, getIntrospectionQuery, GraphQLError } = require('graphql');

/**
 * GraphQL Validator Utility
 * Provides comprehensive validation and security checks for GraphQL operations
 * Following 2025 best practices for GraphQL security
 */

class GraphQLValidator {
    constructor() {
        // Security limits (configurable)
        this.config = {
            maxDepth: 10, // Maximum query depth
            maxAliases: 15, // Maximum number of aliases
            maxDirectives: 50, // Maximum directives per query
            maxComplexity: 1000, // Maximum query complexity score
            maxTokens: 10000, // Maximum tokens in query
        };
    }

    /**
     * Validate GraphQL query syntax
     * @param {string} query - GraphQL query string
     * @returns {Object} - { valid: boolean, errors: array }
     */
    validateSyntax(query) {
        if (!query || typeof query !== 'string') {
            return {
                valid: false,
                errors: [{ message: 'Query must be a non-empty string' }]
            };
        }

        try {
            parse(query);
            return {
                valid: true,
                errors: []
            };
        } catch (error) {
            return {
                valid: false,
                errors: [{
                    message: error.message,
                    locations: error.locations,
                    line: error.locations?.[0]?.line,
                    column: error.locations?.[0]?.column
                }]
            };
        }
    }

    /**
     * Validate query against a schema
     * @param {string} query - GraphQL query string
     * @param {string} schemaSDL - Schema definition in SDL format
     * @returns {Object} - { valid: boolean, errors: array }
     */
    validateAgainstSchema(query, schemaSDL) {
        if (!schemaSDL) {
            return {
                valid: false,
                errors: [{ message: 'Schema is required for validation' }]
            };
        }

        try {
            const schema = buildSchema(schemaSDL);
            const documentAST = parse(query);
            const validationErrors = validate(schema, documentAST);

            if (validationErrors.length > 0) {
                return {
                    valid: false,
                    errors: validationErrors.map(err => ({
                        message: err.message,
                        locations: err.locations,
                        path: err.path
                    }))
                };
            }

            return {
                valid: true,
                errors: []
            };
        } catch (error) {
            return {
                valid: false,
                errors: [{ message: `Schema validation error: ${error.message}` }]
            };
        }
    }

    /**
     * Calculate query depth to prevent deeply nested attacks
     * @param {Object} selectionSet - AST selection set
     * @param {number} currentDepth - Current depth level
     * @returns {number} - Maximum depth found
     */
    calculateDepth(selectionSet, currentDepth = 0) {
        if (!selectionSet || !selectionSet.selections) {
            return currentDepth;
        }

        let maxDepth = currentDepth;

        for (const selection of selectionSet.selections) {
            if (selection.kind === 'Field') {
                const depth = this.calculateDepth(selection.selectionSet, currentDepth + 1);
                maxDepth = Math.max(maxDepth, depth);
            } else if (selection.kind === 'InlineFragment' || selection.kind === 'FragmentSpread') {
                const depth = this.calculateDepth(selection.selectionSet, currentDepth);
                maxDepth = Math.max(maxDepth, depth);
            }
        }

        return maxDepth;
    }

    /**
     * Check query depth limit for security
     * @param {string} query - GraphQL query string
     * @returns {Object} - { valid: boolean, depth: number, errors: array }
     */
    checkDepthLimit(query) {
        try {
            const documentAST = parse(query);
            let maxDepth = 0;

            for (const definition of documentAST.definitions) {
                if (definition.kind === 'OperationDefinition') {
                    const depth = this.calculateDepth(definition.selectionSet, 0);
                    maxDepth = Math.max(maxDepth, depth);
                }
            }

            if (maxDepth > this.config.maxDepth) {
                return {
                    valid: false,
                    depth: maxDepth,
                    errors: [{
                        message: `Query depth ${maxDepth} exceeds maximum allowed depth of ${this.config.maxDepth}`,
                        type: 'DEPTH_LIMIT_EXCEEDED'
                    }]
                };
            }

            return {
                valid: true,
                depth: maxDepth,
                errors: []
            };
        } catch (error) {
            return {
                valid: false,
                errors: [{ message: error.message }]
            };
        }
    }

    /**
     * Calculate query complexity score
     * @param {string} query - GraphQL query string
     * @returns {Object} - { complexity: number, breakdown: object }
     */
    calculateComplexity(query) {
        try {
            const documentAST = parse(query);
            let complexity = 0;
            const breakdown = {
                fields: 0,
                aliases: 0,
                fragments: 0,
                directives: 0
            };

            const countNodes = (node) => {
                if (!node) return;

                if (node.kind === 'Field') {
                    complexity += 1;
                    breakdown.fields += 1;

                    if (node.alias) {
                        complexity += 0.5;
                        breakdown.aliases += 1;
                    }
                }

                if (node.kind === 'FragmentDefinition' || node.kind === 'InlineFragment') {
                    complexity += 2;
                    breakdown.fragments += 1;
                }

                if (node.directives && node.directives.length > 0) {
                    complexity += node.directives.length * 0.5;
                    breakdown.directives += node.directives.length;
                }

                // Recursively process children
                if (node.selectionSet) {
                    node.selectionSet.selections.forEach(countNodes);
                }

                if (node.definitions) {
                    node.definitions.forEach(countNodes);
                }
            };

            documentAST.definitions.forEach(countNodes);

            return {
                complexity,
                breakdown,
                withinLimit: complexity <= this.config.maxComplexity
            };
        } catch (error) {
            return {
                complexity: 0,
                breakdown: {},
                error: error.message
            };
        }
    }

    /**
     * Detect potential security issues
     * @param {string} query - GraphQL query string
     * @returns {Object} - { issues: array, severity: string }
     */
    detectSecurityIssues(query) {
        const issues = [];

        try {
            const documentAST = parse(query);

            // Check for introspection queries (can be security risk in production)
            if (query.includes('__schema') || query.includes('__type')) {
                issues.push({
                    type: 'INTROSPECTION_QUERY',
                    severity: 'medium',
                    message: 'Query contains introspection which may expose schema details'
                });
            }

            // Check for batch queries that might cause DoS
            if (documentAST.definitions.length > 5) {
                issues.push({
                    type: 'BATCH_QUERY',
                    severity: 'high',
                    message: `Query contains ${documentAST.definitions.length} operations which may impact performance`
                });
            }

            // Check depth
            const depthCheck = this.checkDepthLimit(query);
            if (!depthCheck.valid) {
                issues.push({
                    type: 'EXCESSIVE_DEPTH',
                    severity: 'high',
                    message: depthCheck.errors[0].message
                });
            }

            // Check complexity
            const complexityCheck = this.calculateComplexity(query);
            if (!complexityCheck.withinLimit) {
                issues.push({
                    type: 'HIGH_COMPLEXITY',
                    severity: 'high',
                    message: `Query complexity ${complexityCheck.complexity} exceeds limit of ${this.config.maxComplexity}`
                });
            }

            // Determine overall severity
            const severities = issues.map(i => i.severity);
            const overallSeverity = severities.includes('high') ? 'high' :
                severities.includes('medium') ? 'medium' : 'low';

            return {
                issues,
                severity: overallSeverity,
                safe: issues.length === 0
            };
        } catch (error) {
            return {
                issues: [{ type: 'VALIDATION_ERROR', severity: 'high', message: error.message }],
                severity: 'high',
                safe: false
            };
        }
    }

    /**
     * Extract operation information from query
     * @param {string} query - GraphQL query string
     * @returns {Object} - Operation details
     */
    extractOperationInfo(query) {
        try {
            const documentAST = parse(query);
            const operations = [];

            for (const definition of documentAST.definitions) {
                if (definition.kind === 'OperationDefinition') {
                    operations.push({
                        type: definition.operation, // query, mutation, subscription
                        name: definition.name?.value || 'anonymous',
                        variableDefinitions: definition.variableDefinitions?.map(v => ({
                            name: v.variable.name.value,
                            type: this.typeToString(v.type),
                            defaultValue: v.defaultValue
                        })) || []
                    });
                }
            }

            return {
                operations,
                hasMultipleOperations: operations.length > 1,
                primaryOperation: operations[0] || null
            };
        } catch (error) {
            return {
                operations: [],
                error: error.message
            };
        }
    }

    /**
     * Convert AST type node to string
     * @param {Object} typeNode - Type AST node
     * @returns {string} - Type as string
     */
    typeToString(typeNode) {
        if (typeNode.kind === 'NonNullType') {
            return `${this.typeToString(typeNode.type)}!`;
        }
        if (typeNode.kind === 'ListType') {
            return `[${this.typeToString(typeNode.type)}]`;
        }
        return typeNode.name.value;
    }

    /**
     * Comprehensive validation combining all checks
     * @param {string} query - GraphQL query string
     * @param {string} schemaSDL - Optional schema for validation
     * @returns {Object} - Complete validation report
     */
    validate(query, schemaSDL = null) {
        const report = {
            valid: true,
            errors: [],
            warnings: [],
            info: {}
        };

        // 1. Syntax validation
        const syntaxCheck = this.validateSyntax(query);
        if (!syntaxCheck.valid) {
            report.valid = false;
            report.errors.push(...syntaxCheck.errors);
            return report; // Stop if syntax is invalid
        }

        // 2. Schema validation (if schema provided)
        if (schemaSDL) {
            const schemaCheck = this.validateAgainstSchema(query, schemaSDL);
            if (!schemaCheck.valid) {
                report.valid = false;
                report.errors.push(...schemaCheck.errors);
            }
        }

        // 3. Security checks
        const securityCheck = this.detectSecurityIssues(query);
        if (!securityCheck.safe) {
            const highSeverityIssues = securityCheck.issues.filter(i => i.severity === 'high');
            if (highSeverityIssues.length > 0) {
                report.valid = false;
                report.errors.push(...highSeverityIssues);
            }

            const mediumSeverityIssues = securityCheck.issues.filter(i => i.severity === 'medium');
            report.warnings.push(...mediumSeverityIssues);
        }

        // 4. Extract operation info
        const operationInfo = this.extractOperationInfo(query);
        report.info.operations = operationInfo;

        // 5. Complexity analysis
        const complexityInfo = this.calculateComplexity(query);
        report.info.complexity = complexityInfo;

        return report;
    }

    /**
     * Generate introspection query
     * @returns {string} - Standard GraphQL introspection query
     */
    getIntrospectionQuery() {
        return getIntrospectionQuery();
    }
}

module.exports = new GraphQLValidator();
