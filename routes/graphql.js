// routes/graphql.js
const express = require('express');
const router = express.Router();
const GraphQLService = require('../services/GraphQLService');
const GraphQLSubscriptionService = require('../services/GraphQLSubscriptionService');
const graphqlValidator = require('../utils/graphql-validator');
const GraphQLLintingService = require('../services/GraphQLLintingService');

/**
 * GraphQL Routes
 * Provides endpoints for GraphQL operations, schema introspection, and subscription management
 */

/**
 * POST /api/graphql/execute
 * Execute a GraphQL query, mutation, or subscription operation
 */
router.post('/execute', async (req, res) => {
    try {
        const { url, query, variables, operationName, headers } = req.body;

        // Validation
        if (!url || !query) {
            return res.status(400).json({
                success: false,
                error: 'URL and query are required'
            });
        }

        // Execute the operation
        const result = await GraphQLService.executeOperation({
            url,
            query,
            variables: variables || {},
            operationName,
            headers: headers || {}
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * POST /api/graphql/introspect
 * Introspect a GraphQL schema from an endpoint
 */
router.post('/introspect', async (req, res) => {
    try {
        const { url, headers } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL is required'
            });
        }

        const result = await GraphQLService.introspectSchema(url, headers || {});
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/graphql/validate
 * Validate a GraphQL query
 */
router.post('/validate', async (req, res) => {
    try {
        const { query, schema } = req.body;

        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Query is required'
            });
        }

        let result;
        if (schema) {
            // Validate against schema
            result = graphqlValidator.validateAgainstSchema(query, schema);
        } else {
            // Just syntax validation
            result = graphqlValidator.validateSyntax(query);
        }

        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/graphql/analyze
 * Analyze a GraphQL query for complexity, depth, and optimization suggestions
 */
router.post('/analyze', async (req, res) => {
    try {
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Query is required'
            });
        }

        const analysis = GraphQLService.analyzeQuery(query);
        res.json({
            success: true,
            analysis
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/graphql/security-check
 * Check a query for potential security issues
 */
router.post('/security-check', async (req, res) => {
    try {
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Query is required'
            });
        }

        const securityCheck = graphqlValidator.detectSecurityIssues(query);
        res.json({
            success: true,
            ...securityCheck
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/graphql/subscription/connect
 * Create a WebSocket connection for subscriptions
 */
router.post('/subscription/connect', async (req, res) => {
    try {
        const { url, connectionParams, headers } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'WebSocket URL is required'
            });
        }

        // Note: In a real-world scenario, this would be managed per-user session
        // For now, we'll return the connection details to be managed client-side
        res.json({
            success: true,
            message: 'Use WebSocket client library to connect',
            url,
            protocol: 'graphql-ws',
            recommendation: 'Use GraphQL Subscription Service on the client side'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/graphql/subscription/status
 * Get status of all active subscriptions (server-side managed)
 */
router.get('/subscription/status', async (req, res) => {
    try {
        const connections = GraphQLSubscriptionService.getAllConnections();
        const subscriptions = GraphQLSubscriptionService.getAllSubscriptions();

        res.json({
            success: true,
            connections,
            subscriptions,
            totalConnections: connections.length,
            totalSubscriptions: subscriptions.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/graphql/introspection-query
 * Get the standard introspection query
 */
router.get('/introspection-query', (req, res) => {
    try {
        const introspectionQuery = graphqlValidator.getIntrospectionQuery();
        res.json({
            success: true,
            query: introspectionQuery
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/graphql/cache
 * Clear the schema cache
 */
router.delete('/cache', async (req, res) => {
    try {
        GraphQLService.clearCache();
        res.json({
            success: true,
            message: 'Schema cache cleared'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/graphql/format
 * Format/prettify a GraphQL query
 */
router.post('/format', async (req, res) => {
    try {
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Query is required'
            });
        }

        // Parse and stringify to format
        const { parse, print } = require('graphql');
        const ast = parse(query);
        const formatted = print(ast);

        res.json({
            success: true,
            formatted
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: 'Invalid GraphQL syntax',
            message: error.message
        });
    }
});

/**
 * POST /api/graphql/lint
 * Lint a GraphQL query for best practices and potential issues
 */
router.post('/lint', async (req, res) => {
    try {
        const { query, schema, options, preset } = req.body;

        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Query is required'
            });
        }

        // Merge preset into options
        const lintOptions = { ...options, preset: preset || options?.preset || 'standard' };
        const result = GraphQLLintingService.lintQuery(query, schema, lintOptions);
        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/graphql/lint/schema
 * Lint a GraphQL schema for best practices
 */
router.post('/lint/schema', async (req, res) => {
    try {
        const { schema, options } = req.body;

        if (!schema) {
            return res.status(400).json({
                success: false,
                error: 'Schema is required'
            });
        }

        const result = GraphQLLintingService.lintSchema(schema, options || {});
        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/graphql/lint/fix
 * Apply auto-fix suggestions to a GraphQL query
 */
router.post('/lint/fix', async (req, res) => {
    try {
        const { query, issueId, schema } = req.body;

        if (!query || !issueId) {
            return res.status(400).json({
                success: false,
                error: 'Query and issueId are required'
            });
        }

        // First lint the query to find the issue
        const lintResult = GraphQLLintingService.lintQuery(query, schema);
        const issue = lintResult.issues.find(i => i.id === issueId);

        if (!issue) {
            return res.status(404).json({
                success: false,
                error: 'Issue not found'
            });
        }

        if (!issue.fix) {
            return res.status(400).json({
                success: false,
                error: 'This issue does not have an auto-fix available'
            });
        }

        // Apply the fix
        const fixedQuery = GraphQLLintingService.applyFix(query, issue.fix);

        res.json({
            success: true,
            fixedQuery,
            appliedFix: issue.fix
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/graphql/lint/rules
 * Get available linting rules and their configurations
 */
router.get('/lint/rules', (req, res) => {
    try {
        const rules = GraphQLLintingService.getAvailableRules();
        res.json({
            success: true,
            rules
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/graphql/lint/presets
 * Get available linting presets
 */
router.get('/lint/presets', (req, res) => {
    try {
        const presets = GraphQLLintingService.getPresets ?
            GraphQLLintingService.getPresets() :
            ['relaxed', 'standard', 'strict', 'production'];
        res.json({
            success: true,
            presets
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/graphql/lint/best-practices
 * Get GraphQL best practices guide
 */
router.get('/lint/best-practices', (req, res) => {
    try {
        const guide = GraphQLLintingService.getBestPracticesGuide();
        res.json({
            success: true,
            guide
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/graphql/lint/report
 * Generate a comprehensive linting report
 */
router.post('/lint/report', async (req, res) => {
    try {
        const { queries, schema, options } = req.body;

        if (!queries || !Array.isArray(queries) || queries.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Queries array is required'
            });
        }

        const report = GraphQLLintingService.generateReport(queries, schema, options || {});
        res.json({
            success: true,
            ...report
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
