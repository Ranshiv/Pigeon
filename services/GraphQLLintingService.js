// services/GraphQLLintingService.js
const graphqlLinter = require('../utils/graphql-linter');
const { GraphQLLinter } = require('../utils/graphql-linter');

/**
 * GraphQL Linting Service
 * Provides comprehensive linting, best practices validation, and optimization suggestions
 * Following 2025 GraphQL best practices
 */

class GraphQLLintingService {
    constructor() {
        // Default configuration presets
        this.presets = {
            relaxed: {
                maxDepth: 15,
                maxAliases: 25,
                maxComplexity: 2000,
                requireOperationName: false,
                enforceNamingConventions: false,
                allowIntrospection: true
            },
            standard: {
                maxDepth: 10,
                maxAliases: 15,
                maxComplexity: 1000,
                requireOperationName: true,
                enforceNamingConventions: true,
                allowIntrospection: true
            },
            strict: {
                maxDepth: 7,
                maxAliases: 10,
                maxComplexity: 500,
                requireOperationName: true,
                enforceNamingConventions: true,
                allowIntrospection: false,
                maxFieldsPerSelection: 50
            },
            production: {
                maxDepth: 5,
                maxAliases: 8,
                maxComplexity: 300,
                requireOperationName: true,
                enforceNamingConventions: true,
                allowIntrospection: false,
                maxFieldsPerSelection: 30
            }
        };

        // Best practices documentation
        this.bestPractices = this.initializeBestPractices();
    }

    /**
     * Lint a GraphQL query with configurable options (alias for lint)
     * @param {string} query - GraphQL query string
     * @param {string} schema - Optional schema string
     * @param {Object} options - Linting options
     * @returns {Object} - Linting results with categorized issues
     */
    lintQuery(query, schema, options = {}) {
        const results = this.lint(query, options);

        // The linter already returns errors, warnings, suggestions, info arrays
        // Just pass them through with the expected structure
        return {
            results: {
                score: results.score || 100,
                errors: results.errors || [],
                warnings: results.warnings || [],
                suggestions: results.suggestions || [],
                info: results.info || [],
                summary: {
                    totalIssues: results.summary?.totalIssues || 0,
                    errorCount: (results.errors || []).length,
                    warningCount: (results.warnings || []).length,
                    suggestionCount: (results.suggestions || []).length,
                    infoCount: (results.info || []).length
                },
                bestPractices: results.bestPractices || [],
                quickFixes: results.quickFixes || []
            }
        };
    }

    /**
     * Lint a GraphQL schema
     * @param {string} schema - GraphQL schema string
     * @param {Object} options - Linting options
     * @returns {Object} - Linting results
     */
    lintSchema(schema, options = {}) {
        // For now, return empty results - schema linting can be implemented later
        return {
            results: {
                score: 100,
                errors: [],
                warnings: [],
                suggestions: [],
                info: [],
                summary: {
                    totalIssues: 0
                }
            }
        };
    }

    /**
     * Get available rules
     * @returns {Object} - Available rules
     */
    getAvailableRules() {
        return graphqlLinter.getRules();
    }

    /**
     * Apply a fix to a query
     * @param {string} query - Original query
     * @param {Object} fix - Fix object with replacement info
     * @returns {string} - Fixed query
     */
    applyFix(query, fix) {
        if (!fix || !fix.replacement) return query;
        // Basic replacement - can be enhanced
        return query.replace(fix.target, fix.replacement);
    }

    /**
     * Lint a GraphQL query with configurable options
     * @param {string} query - GraphQL query string
     * @param {Object} options - Linting options
     * @returns {Object} - Linting results
     */
    lint(query, options = {}) {
        const preset = options.preset ? this.presets[options.preset] : null;
        const mergedOptions = { ...preset, ...options };

        const linter = new GraphQLLinter(mergedOptions);
        const results = linter.lint(query);

        // Add best practice recommendations
        results.bestPractices = this.getBestPracticeRecommendations(results);

        // Add quick fixes
        results.quickFixes = this.generateQuickFixes(results);

        return results;
    }

    /**
     * Lint with a specific preset
     * @param {string} query - GraphQL query string
     * @param {string} presetName - Preset name (relaxed, standard, strict, production)
     * @returns {Object} - Linting results
     */
    lintWithPreset(query, presetName) {
        const preset = this.presets[presetName];
        if (!preset) {
            throw new Error(`Unknown preset: ${presetName}. Available: ${Object.keys(this.presets).join(', ')}`);
        }

        return this.lint(query, { preset: presetName });
    }

    /**
     * Get comprehensive analysis with all checks
     * @param {string} query - GraphQL query string
     * @param {Object} options - Analysis options
     * @returns {Object} - Comprehensive analysis
     */
    analyze(query, options = {}) {
        const lintResults = this.lint(query, options);

        const analysis = {
            lint: lintResults,
            metrics: this.calculateMetrics(query),
            suggestions: this.generateOptimizationSuggestions(query, lintResults),
            documentation: this.generateDocumentation(query),
            grade: this.calculateGrade(lintResults)
        };

        return analysis;
    }

    /**
     * Calculate query metrics
     * @param {string} query - GraphQL query
     * @returns {Object} - Query metrics
     */
    calculateMetrics(query) {
        try {
            const { parse, visit, Kind } = require('graphql');
            const ast = parse(query);

            const metrics = {
                operations: 0,
                fragments: 0,
                fields: 0,
                aliases: 0,
                arguments: 0,
                variables: 0,
                directives: 0,
                depth: 0,
                complexity: 0,
                characters: query.length,
                lines: query.split('\n').length
            };

            visit(ast, {
                OperationDefinition() { metrics.operations++; },
                FragmentDefinition() { metrics.fragments++; },
                Field() { metrics.fields++; },
                Argument() { metrics.arguments++; },
                Variable() { metrics.variables++; },
                Directive() { metrics.directives++; },
                Field(node) {
                    if (node.alias) metrics.aliases++;
                }
            });

            // Calculate depth
            metrics.depth = this.calculateDepth(ast);

            // Calculate complexity
            metrics.complexity = metrics.fields +
                (metrics.fragments * 2) +
                (metrics.aliases * 0.5) +
                (metrics.directives * 0.5);

            return metrics;
        } catch (error) {
            return {
                error: error.message,
                characters: query.length,
                lines: query.split('\n').length
            };
        }
    }

    /**
     * Calculate query depth
     */
    calculateDepth(ast) {
        const { visit, Kind } = require('graphql');
        let maxDepth = 0;

        const calculateSelectionDepth = (selectionSet, depth = 0) => {
            if (!selectionSet) return depth;

            maxDepth = Math.max(maxDepth, depth);

            for (const selection of selectionSet.selections) {
                if (selection.kind === Kind.FIELD && selection.selectionSet) {
                    calculateSelectionDepth(selection.selectionSet, depth + 1);
                }
            }
        };

        visit(ast, {
            OperationDefinition(node) {
                calculateSelectionDepth(node.selectionSet, 1);
            }
        });

        return maxDepth;
    }

    /**
     * Generate optimization suggestions
     * @param {string} query - GraphQL query
     * @param {Object} lintResults - Linting results
     * @returns {Array} - Optimization suggestions
     */
    generateOptimizationSuggestions(query, lintResults) {
        const suggestions = [];
        const metrics = this.calculateMetrics(query);

        // Suggest fragments for repeated selections
        if (metrics.fields > 20 && metrics.fragments === 0) {
            suggestions.push({
                type: 'fragments',
                priority: 'medium',
                title: 'Consider Using Fragments',
                description: 'Your query has many fields. Using fragments can improve readability and enable reuse.',
                example: `fragment UserFields on User {
  id
  name
  email
}`
            });
        }

        // Suggest pagination for large lists
        if (query.includes('first:') || query.includes('last:') ||
            query.includes('limit:') || query.includes('take:')) {
            // Already using pagination, good!
        } else if (metrics.depth > 3) {
            suggestions.push({
                type: 'pagination',
                priority: 'high',
                title: 'Consider Pagination',
                description: 'For lists, consider using pagination (first/after, last/before) to limit data transfer.',
                example: `users(first: 10, after: $cursor) {
  edges {
    node { id name }
    cursor
  }
  pageInfo { hasNextPage endCursor }
}`
            });
        }

        // Suggest aliases for clarity
        if (metrics.fields > 10 && metrics.aliases === 0) {
            suggestions.push({
                type: 'aliases',
                priority: 'low',
                title: 'Consider Using Aliases',
                description: 'Aliases can make response data easier to work with in your application.',
                example: `activeUsers: users(status: ACTIVE) { id }
inactiveUsers: users(status: INACTIVE) { id }`
            });
        }

        // Suggest variables for hardcoded values
        const hardcodedValuesCount = (query.match(/:\s*"[^"]+"/g) || []).length;
        if (hardcodedValuesCount > 2) {
            suggestions.push({
                type: 'variables',
                priority: 'medium',
                title: 'Use Variables for Dynamic Values',
                description: 'Variables make queries reusable and prevent injection attacks.',
                example: `query GetUser($id: ID!) {
  user(id: $id) { name }
}`
            });
        }

        // Suggest field selection optimization
        if (lintResults.score < 70 && lintResults.warnings.length > 3) {
            suggestions.push({
                type: 'optimization',
                priority: 'high',
                title: 'Optimize Field Selection',
                description: 'Select only the fields you need. Over-fetching can impact performance.',
                tips: [
                    'Remove unused fields from selections',
                    'Use fragments to share common field selections',
                    'Consider separate queries for different use cases'
                ]
            });
        }

        return suggestions;
    }

    /**
     * Generate best practice recommendations based on lint results
     */
    getBestPracticeRecommendations(lintResults) {
        const recommendations = [];
        const categories = Object.keys(lintResults.summary.byCategory);

        for (const category of categories) {
            const count = lintResults.summary.byCategory[category];
            if (count > 0) {
                const practices = this.bestPractices.filter(bp => bp.category === category);
                recommendations.push(...practices.slice(0, 2));
            }
        }

        return recommendations;
    }

    /**
     * Generate quick fixes for issues
     */
    generateQuickFixes(lintResults) {
        const fixes = [];

        // Collect all issues with fixes
        const allIssues = [
            ...lintResults.errors,
            ...lintResults.warnings,
            ...lintResults.suggestions
        ];

        for (const issue of allIssues) {
            if (issue.fix) {
                fixes.push({
                    ruleId: issue.ruleId,
                    line: issue.line,
                    column: issue.column,
                    fix: issue.fix,
                    description: issue.message
                });
            }
        }

        return fixes;
    }

    /**
     * Generate documentation for a query
     */
    generateDocumentation(query) {
        try {
            const { parse, visit, Kind } = require('graphql');
            const ast = parse(query);

            const docs = {
                operations: [],
                fragments: [],
                variables: []
            };

            visit(ast, {
                OperationDefinition(node) {
                    docs.operations.push({
                        type: node.operation,
                        name: node.name?.value || 'anonymous',
                        variables: (node.variableDefinitions || []).map(v => ({
                            name: v.variable.name.value,
                            type: printType(v.type),
                            hasDefault: !!v.defaultValue
                        }))
                    });
                },
                FragmentDefinition(node) {
                    docs.fragments.push({
                        name: node.name.value,
                        onType: node.typeCondition.name.value,
                        fieldsCount: node.selectionSet.selections.length
                    });
                }
            });

            return docs;
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Calculate a letter grade based on lint score
     */
    calculateGrade(lintResults) {
        const score = lintResults.score;

        if (score >= 90) return { letter: 'A', description: 'Excellent - Follows best practices' };
        if (score >= 80) return { letter: 'B', description: 'Good - Minor improvements possible' };
        if (score >= 70) return { letter: 'C', description: 'Fair - Several issues to address' };
        if (score >= 60) return { letter: 'D', description: 'Poor - Needs significant improvement' };
        return { letter: 'F', description: 'Critical - Major issues detected' };
    }

    /**
     * Initialize best practices documentation
     */
    initializeBestPractices() {
        return [
            // Naming
            {
                id: 'bp-naming-1',
                category: 'naming',
                title: 'Use Descriptive Operation Names',
                description: 'Name your operations descriptively to make debugging easier.',
                example: 'query GetUserProfile($id: ID!) { ... }',
                link: 'https://graphql.org/learn/queries/#operation-name'
            },
            {
                id: 'bp-naming-2',
                category: 'naming',
                title: 'Use PascalCase for Types and Operations',
                description: 'Type names and operation names should use PascalCase.',
                example: 'query GetActiveUsers { ... }'
            },
            // Security
            {
                id: 'bp-security-1',
                category: 'security',
                title: 'Limit Query Depth',
                description: 'Prevent deeply nested queries that could cause performance issues.',
                recommendation: 'Set max depth to 7-10 levels'
            },
            {
                id: 'bp-security-2',
                category: 'security',
                title: 'Implement Query Complexity Analysis',
                description: 'Calculate and limit the complexity of incoming queries.',
                recommendation: 'Set complexity limits based on your server capacity'
            },
            {
                id: 'bp-security-3',
                category: 'security',
                title: 'Disable Introspection in Production',
                description: 'Introspection queries can expose your entire schema.',
                recommendation: 'Disable __schema and __type queries in production'
            },
            // Performance
            {
                id: 'bp-performance-1',
                category: 'performance',
                title: 'Use Fragments for Repeated Selections',
                description: 'Fragments improve query readability and can be reused.',
                example: 'fragment UserBasic on User { id name email }'
            },
            {
                id: 'bp-performance-2',
                category: 'performance',
                title: 'Request Only Needed Fields',
                description: 'Over-fetching data wastes bandwidth and server resources.',
                recommendation: 'Select only the fields your UI actually uses'
            },
            {
                id: 'bp-performance-3',
                category: 'performance',
                title: 'Use Pagination for Lists',
                description: 'Always paginate list queries to prevent large data transfers.',
                example: 'users(first: 10, after: $cursor) { ... }'
            },
            // Best Practices
            {
                id: 'bp-general-1',
                category: 'best-practices',
                title: 'Use Variables for Dynamic Values',
                description: 'Variables make queries reusable and prevent injection.',
                example: 'query GetUser($id: ID!) { user(id: $id) { ... } }'
            },
            {
                id: 'bp-general-2',
                category: 'best-practices',
                title: 'Include ID Fields for Caching',
                description: 'Always request id fields to enable client-side caching.',
                recommendation: 'Include id in every object selection'
            }
        ];
    }

    /**
     * Get available presets
     */
    getPresets() {
        return Object.keys(this.presets).map(name => ({
            name,
            description: this.getPresetDescription(name),
            options: this.presets[name]
        }));
    }

    /**
     * Get preset description
     */
    getPresetDescription(name) {
        const descriptions = {
            relaxed: 'Minimal restrictions, suitable for development',
            standard: 'Balanced rules for most applications',
            strict: 'Stricter rules for production-ready code',
            production: 'Most restrictive, optimized for production environments'
        };
        return descriptions[name] || '';
    }

    /**
     * Get all available rules
     */
    getRules() {
        return graphqlLinter.getRules();
    }

    /**
     * Get rules by category
     */
    getRulesByCategory(category) {
        return graphqlLinter.getRulesByCategory(category);
    }

    /**
     * Get all best practices
     */
    getBestPractices() {
        return this.bestPractices;
    }

    /**
     * Get best practices guide (alias for getBestPractices)
     */
    getBestPracticesGuide() {
        return this.bestPractices;
    }
}

// Helper function to print GraphQL type
function printType(typeNode) {
    if (typeNode.kind === 'NonNullType') {
        return `${printType(typeNode.type)}!`;
    }
    if (typeNode.kind === 'ListType') {
        return `[${printType(typeNode.type)}]`;
    }
    return typeNode.name.value;
}

module.exports = new GraphQLLintingService();
