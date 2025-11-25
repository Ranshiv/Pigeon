// utils/graphql-linter.js
const { parse, visit, Kind, getLocation } = require('graphql');

/**
 * GraphQL Linter
 * Comprehensive linting rules for GraphQL queries following 2025 best practices
 * Validates queries against common anti-patterns and suggests improvements
 */

class GraphQLLinter {
    constructor(options = {}) {
        this.options = {
            maxDepth: options.maxDepth || 10,
            maxAliases: options.maxAliases || 15,
            maxComplexity: options.maxComplexity || 1000,
            maxDirectives: options.maxDirectives || 50,
            maxFieldsPerSelection: options.maxFieldsPerSelection || 100,
            enforceNamingConventions: options.enforceNamingConventions !== false,
            requireOperationName: options.requireOperationName !== false,
            requireDescriptions: options.requireDescriptions || false,
            allowIntrospection: options.allowIntrospection !== false,
            ...options
        };

        // Define all linting rules
        this.rules = this.initializeRules();
    }

    /**
     * Initialize all linting rules
     * @returns {Array} - Array of rule definitions
     */
    initializeRules() {
        return [
            // === Naming Convention Rules ===
            {
                id: 'naming/operation-name-required',
                name: 'Operation Name Required',
                severity: 'warning',
                category: 'naming',
                description: 'Named operations make debugging easier',
                check: this.checkOperationNameRequired.bind(this)
            },
            {
                id: 'naming/operation-name-pascalcase',
                name: 'Operation Name PascalCase',
                severity: 'suggestion',
                category: 'naming',
                description: 'Operation names should be in PascalCase',
                check: this.checkOperationNamePascalCase.bind(this)
            },
            {
                id: 'naming/field-name-camelcase',
                name: 'Field Name camelCase',
                severity: 'suggestion',
                category: 'naming',
                description: 'Field names should be in camelCase',
                check: this.checkFieldNameCamelCase.bind(this)
            },
            {
                id: 'naming/alias-name-camelcase',
                name: 'Alias Name camelCase',
                severity: 'suggestion',
                category: 'naming',
                description: 'Alias names should be in camelCase',
                check: this.checkAliasNameCamelCase.bind(this)
            },
            {
                id: 'naming/fragment-name-pascalcase',
                name: 'Fragment Name PascalCase',
                severity: 'suggestion',
                category: 'naming',
                description: 'Fragment names should be in PascalCase',
                check: this.checkFragmentNamePascalCase.bind(this)
            },

            // === Security Rules ===
            {
                id: 'security/no-introspection-in-production',
                name: 'No Introspection in Production',
                severity: 'warning',
                category: 'security',
                description: 'Introspection queries may expose sensitive schema information',
                check: this.checkIntrospection.bind(this)
            },
            {
                id: 'security/depth-limit',
                name: 'Query Depth Limit',
                severity: 'error',
                category: 'security',
                description: `Query depth should not exceed ${this.options.maxDepth} levels`,
                check: this.checkDepthLimit.bind(this)
            },
            {
                id: 'security/alias-limit',
                name: 'Alias Limit',
                severity: 'warning',
                category: 'security',
                description: `Number of aliases should not exceed ${this.options.maxAliases}`,
                check: this.checkAliasLimit.bind(this)
            },
            {
                id: 'security/complexity-limit',
                name: 'Query Complexity Limit',
                severity: 'error',
                category: 'security',
                description: `Query complexity should not exceed ${this.options.maxComplexity}`,
                check: this.checkComplexityLimit.bind(this)
            },
            {
                id: 'security/batch-query-limit',
                name: 'Batch Query Limit',
                severity: 'warning',
                category: 'security',
                description: 'Avoid sending too many operations in a single request',
                check: this.checkBatchQueryLimit.bind(this)
            },

            // === Performance Rules ===
            {
                id: 'performance/no-unused-fragments',
                name: 'No Unused Fragments',
                severity: 'warning',
                category: 'performance',
                description: 'Remove unused fragment definitions',
                check: this.checkUnusedFragments.bind(this)
            },
            {
                id: 'performance/no-duplicate-fields',
                name: 'No Duplicate Fields',
                severity: 'warning',
                category: 'performance',
                description: 'Avoid requesting the same field multiple times without aliases',
                check: this.checkDuplicateFields.bind(this)
            },
            {
                id: 'performance/selection-set-depth',
                name: 'Selection Set Depth',
                severity: 'info',
                category: 'performance',
                description: 'Consider using fragments for deeply nested selections',
                check: this.checkSelectionSetDepth.bind(this)
            },
            {
                id: 'performance/avoid-over-fetching',
                name: 'Avoid Over-fetching',
                severity: 'info',
                category: 'performance',
                description: `Consider limiting fields per selection (max: ${this.options.maxFieldsPerSelection})`,
                check: this.checkOverFetching.bind(this)
            },

            // === Best Practices Rules ===
            {
                id: 'best-practices/use-variables',
                name: 'Use Variables for Dynamic Values',
                severity: 'suggestion',
                category: 'best-practices',
                description: 'Use variables instead of inline values for dynamic data',
                check: this.checkUseVariables.bind(this)
            },
            {
                id: 'best-practices/unique-operation-names',
                name: 'Unique Operation Names',
                severity: 'error',
                category: 'best-practices',
                description: 'Operation names must be unique within a document',
                check: this.checkUniqueOperationNames.bind(this)
            },
            {
                id: 'best-practices/unique-fragment-names',
                name: 'Unique Fragment Names',
                severity: 'error',
                category: 'best-practices',
                description: 'Fragment names must be unique within a document',
                check: this.checkUniqueFragmentNames.bind(this)
            },
            {
                id: 'best-practices/no-empty-selections',
                name: 'No Empty Selections',
                severity: 'error',
                category: 'best-practices',
                description: 'Selection sets must not be empty',
                check: this.checkEmptySelections.bind(this)
            },
            {
                id: 'best-practices/prefer-fragment-spread',
                name: 'Prefer Fragment Spread',
                severity: 'suggestion',
                category: 'best-practices',
                description: 'Consider using named fragments instead of inline fragments for reusability',
                check: this.checkPreferFragmentSpread.bind(this)
            },

            // === Schema Validation Rules ===
            {
                id: 'schema/required-fields',
                name: 'Required Fields Present',
                severity: 'info',
                category: 'schema',
                description: 'Consider always requesting id/ID fields for caching',
                check: this.checkRequiredFields.bind(this)
            },

            // === Deprecation Rules ===
            {
                id: 'deprecation/no-deprecated-fields',
                name: 'No Deprecated Fields',
                severity: 'warning',
                category: 'deprecation',
                description: 'Avoid using deprecated fields',
                check: this.checkDeprecatedFields.bind(this)
            }
        ];
    }

    /**
     * Lint a GraphQL query
     * @param {string} query - GraphQL query string
     * @param {Object} schema - Optional schema for validation
     * @returns {Object} - Linting results
     */
    lint(query, schema = null) {
        const results = {
            valid: true,
            errors: [],
            warnings: [],
            suggestions: [],
            info: [],
            score: 100,
            summary: {
                totalIssues: 0,
                byCategory: {},
                bySeverity: {
                    error: 0,
                    warning: 0,
                    suggestion: 0,
                    info: 0
                }
            }
        };

        if (!query || typeof query !== 'string' || query.trim() === '') {
            results.errors.push({
                ruleId: 'syntax/empty-query',
                message: 'Query cannot be empty',
                severity: 'error',
                category: 'syntax'
            });
            results.valid = false;
            results.score = 0;
            return results;
        }

        let ast;
        try {
            ast = parse(query);
        } catch (parseError) {
            results.errors.push({
                ruleId: 'syntax/parse-error',
                message: parseError.message,
                severity: 'error',
                category: 'syntax',
                locations: parseError.locations,
                line: parseError.locations?.[0]?.line,
                column: parseError.locations?.[0]?.column
            });
            results.valid = false;
            results.score = 0;
            return results;
        }

        // Run all rules
        for (const rule of this.rules) {
            try {
                const issues = rule.check(ast, query, schema);

                if (issues && issues.length > 0) {
                    for (const issue of issues) {
                        const lintIssue = {
                            ruleId: rule.id,
                            ruleName: rule.name,
                            message: issue.message || rule.description,
                            severity: issue.severity || rule.severity,
                            category: rule.category,
                            line: issue.line,
                            column: issue.column,
                            node: issue.node,
                            fix: issue.fix
                        };

                        // Categorize by severity
                        switch (lintIssue.severity) {
                            case 'error':
                                results.errors.push(lintIssue);
                                results.valid = false;
                                results.summary.bySeverity.error++;
                                break;
                            case 'warning':
                                results.warnings.push(lintIssue);
                                results.summary.bySeverity.warning++;
                                break;
                            case 'suggestion':
                                results.suggestions.push(lintIssue);
                                results.summary.bySeverity.suggestion++;
                                break;
                            case 'info':
                                results.info.push(lintIssue);
                                results.summary.bySeverity.info++;
                                break;
                        }

                        // Track by category
                        if (!results.summary.byCategory[rule.category]) {
                            results.summary.byCategory[rule.category] = 0;
                        }
                        results.summary.byCategory[rule.category]++;
                    }
                }
            } catch (ruleError) {
                console.error(`Error running rule ${rule.id}:`, ruleError);
            }
        }

        // Calculate score
        results.summary.totalIssues =
            results.errors.length +
            results.warnings.length +
            results.suggestions.length +
            results.info.length;

        results.score = this.calculateScore(results);

        return results;
    }

    /**
     * Calculate lint score (0-100)
     */
    calculateScore(results) {
        let score = 100;

        // Deduct points for each issue type
        score -= results.errors.length * 20;
        score -= results.warnings.length * 10;
        score -= results.suggestions.length * 3;
        score -= results.info.length * 1;

        return Math.max(0, Math.min(100, score));
    }

    // === Rule Implementation Methods ===

    checkOperationNameRequired(ast) {
        const issues = [];

        if (!this.options.requireOperationName) return issues;

        visit(ast, {
            OperationDefinition(node) {
                if (!node.name) {
                    issues.push({
                        message: `${node.operation} operation should have a name`,
                        line: node.loc?.startToken?.line,
                        column: node.loc?.startToken?.column,
                        severity: 'warning'
                    });
                }
            }
        });

        return issues;
    }

    checkOperationNamePascalCase(ast) {
        const issues = [];

        if (!this.options.enforceNamingConventions) return issues;

        visit(ast, {
            OperationDefinition(node) {
                if (node.name) {
                    const name = node.name.value;
                    if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
                        issues.push({
                            message: `Operation name "${name}" should be in PascalCase`,
                            line: node.name.loc?.startToken?.line,
                            column: node.name.loc?.startToken?.column,
                            fix: { type: 'rename', value: this.toPascalCase(name) }
                        });
                    }
                }
            }
        });

        return issues;
    }

    checkFieldNameCamelCase(ast) {
        const issues = [];

        if (!this.options.enforceNamingConventions) return issues;

        visit(ast, {
            Field(node) {
                const name = node.name.value;
                // Allow __typename and other introspection fields
                if (name.startsWith('__')) return;

                if (!/^[a-z][a-zA-Z0-9]*$/.test(name) && !name.includes('_')) {
                    // Don't flag snake_case as it might be from the schema
                    if (/^[A-Z]/.test(name)) {
                        issues.push({
                            message: `Field name "${name}" should be in camelCase`,
                            line: node.name.loc?.startToken?.line,
                            column: node.name.loc?.startToken?.column,
                            severity: 'suggestion'
                        });
                    }
                }
            }
        });

        return issues;
    }

    checkAliasNameCamelCase(ast) {
        const issues = [];

        if (!this.options.enforceNamingConventions) return issues;

        visit(ast, {
            Field(node) {
                if (node.alias) {
                    const name = node.alias.value;
                    if (!/^[a-z][a-zA-Z0-9]*$/.test(name)) {
                        issues.push({
                            message: `Alias "${name}" should be in camelCase`,
                            line: node.alias.loc?.startToken?.line,
                            column: node.alias.loc?.startToken?.column,
                            severity: 'suggestion'
                        });
                    }
                }
            }
        });

        return issues;
    }

    checkFragmentNamePascalCase(ast) {
        const issues = [];

        if (!this.options.enforceNamingConventions) return issues;

        visit(ast, {
            FragmentDefinition(node) {
                const name = node.name.value;
                if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
                    issues.push({
                        message: `Fragment name "${name}" should be in PascalCase`,
                        line: node.name.loc?.startToken?.line,
                        column: node.name.loc?.startToken?.column,
                        severity: 'suggestion'
                    });
                }
            }
        });

        return issues;
    }

    checkIntrospection(ast, query) {
        const issues = [];

        if (this.options.allowIntrospection) return issues;

        if (query.includes('__schema') || query.includes('__type')) {
            issues.push({
                message: 'Introspection queries should be disabled in production environments',
                severity: 'warning'
            });
        }

        return issues;
    }

    checkDepthLimit(ast) {
        const issues = [];
        const maxDepth = this.calculateQueryDepth(ast);

        if (maxDepth > this.options.maxDepth) {
            issues.push({
                message: `Query depth (${maxDepth}) exceeds maximum allowed (${this.options.maxDepth})`,
                severity: 'error'
            });
        } else if (maxDepth > this.options.maxDepth * 0.7) {
            issues.push({
                message: `Query depth (${maxDepth}) is approaching the limit (${this.options.maxDepth})`,
                severity: 'warning'
            });
        }

        return issues;
    }

    checkAliasLimit(ast) {
        const issues = [];
        let aliasCount = 0;

        visit(ast, {
            Field(node) {
                if (node.alias) {
                    aliasCount++;
                }
            }
        });

        if (aliasCount > this.options.maxAliases) {
            issues.push({
                message: `Number of aliases (${aliasCount}) exceeds maximum allowed (${this.options.maxAliases})`,
                severity: 'warning'
            });
        }

        return issues;
    }

    checkComplexityLimit(ast) {
        const issues = [];
        const complexity = this.calculateComplexity(ast);

        if (complexity > this.options.maxComplexity) {
            issues.push({
                message: `Query complexity (${complexity}) exceeds maximum allowed (${this.options.maxComplexity})`,
                severity: 'error'
            });
        }

        return issues;
    }

    checkBatchQueryLimit(ast) {
        const issues = [];
        let operationCount = 0;

        visit(ast, {
            OperationDefinition() {
                operationCount++;
            }
        });

        if (operationCount > 5) {
            issues.push({
                message: `Too many operations in a single request (${operationCount}). Consider splitting into multiple requests.`,
                severity: 'warning'
            });
        }

        return issues;
    }

    checkUnusedFragments(ast) {
        const issues = [];
        const definedFragments = new Set();
        const usedFragments = new Set();

        visit(ast, {
            FragmentDefinition(node) {
                definedFragments.add(node.name.value);
            },
            FragmentSpread(node) {
                usedFragments.add(node.name.value);
            }
        });

        for (const fragment of definedFragments) {
            if (!usedFragments.has(fragment)) {
                issues.push({
                    message: `Fragment "${fragment}" is defined but never used`,
                    severity: 'warning'
                });
            }
        }

        return issues;
    }

    checkDuplicateFields(ast) {
        const issues = [];

        visit(ast, {
            SelectionSet(node) {
                const fieldNames = new Map();

                for (const selection of node.selections) {
                    if (selection.kind === Kind.FIELD) {
                        const key = selection.alias?.value || selection.name.value;

                        if (fieldNames.has(key)) {
                            issues.push({
                                message: `Duplicate field "${key}" in selection set. Use aliases if you need the same field multiple times.`,
                                line: selection.loc?.startToken?.line,
                                column: selection.loc?.startToken?.column,
                                severity: 'warning'
                            });
                        } else {
                            fieldNames.set(key, selection);
                        }
                    }
                }
            }
        });

        return issues;
    }

    checkSelectionSetDepth(ast) {
        const issues = [];
        const depth = this.calculateQueryDepth(ast);

        if (depth > 5 && depth <= this.options.maxDepth) {
            issues.push({
                message: `Query depth is ${depth}. Consider using fragments to organize deeply nested queries.`,
                severity: 'info'
            });
        }

        return issues;
    }

    checkOverFetching(ast) {
        const issues = [];
        const maxFields = this.options.maxFieldsPerSelection || 50;

        visit(ast, {
            SelectionSet(node) {
                const fieldCount = node.selections.filter(s => s.kind === Kind.FIELD).length;

                if (fieldCount > maxFields) {
                    issues.push({
                        message: `Selection set has ${fieldCount} fields. Consider selecting only needed fields.`,
                        severity: 'info'
                    });
                }
            }
        });

        return issues;
    }

    checkUseVariables(ast, query) {
        const issues = [];

        // Check for hardcoded IDs or values that look like they should be variables
        visit(ast, {
            Argument(node) {
                if (node.value.kind === Kind.STRING) {
                    const value = node.value.value;
                    // Check for UUID-like patterns or numeric IDs
                    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ||
                        /^\d{5,}$/.test(value)) {
                        issues.push({
                            message: `Consider using a variable for "${node.name.value}" instead of hardcoded value`,
                            line: node.loc?.startToken?.line,
                            column: node.loc?.startToken?.column,
                            severity: 'suggestion'
                        });
                    }
                }
            }
        });

        return issues;
    }

    checkUniqueOperationNames(ast) {
        const issues = [];
        const operationNames = new Map();

        visit(ast, {
            OperationDefinition(node) {
                if (node.name) {
                    const name = node.name.value;
                    if (operationNames.has(name)) {
                        issues.push({
                            message: `Duplicate operation name "${name}"`,
                            line: node.name.loc?.startToken?.line,
                            column: node.name.loc?.startToken?.column,
                            severity: 'error'
                        });
                    } else {
                        operationNames.set(name, node);
                    }
                }
            }
        });

        return issues;
    }

    checkUniqueFragmentNames(ast) {
        const issues = [];
        const fragmentNames = new Map();

        visit(ast, {
            FragmentDefinition(node) {
                const name = node.name.value;
                if (fragmentNames.has(name)) {
                    issues.push({
                        message: `Duplicate fragment name "${name}"`,
                        line: node.name.loc?.startToken?.line,
                        column: node.name.loc?.startToken?.column,
                        severity: 'error'
                    });
                } else {
                    fragmentNames.set(name, node);
                }
            }
        });

        return issues;
    }

    checkEmptySelections(ast) {
        const issues = [];

        visit(ast, {
            SelectionSet(node) {
                if (node.selections.length === 0) {
                    issues.push({
                        message: 'Empty selection set is not allowed',
                        line: node.loc?.startToken?.line,
                        column: node.loc?.startToken?.column,
                        severity: 'error'
                    });
                }
            }
        });

        return issues;
    }

    checkPreferFragmentSpread(ast) {
        const issues = [];
        let inlineFragmentCount = 0;

        visit(ast, {
            InlineFragment(node) {
                inlineFragmentCount++;
                if (inlineFragmentCount > 3) {
                    issues.push({
                        message: 'Consider using named fragments instead of inline fragments for better reusability',
                        line: node.loc?.startToken?.line,
                        column: node.loc?.startToken?.column,
                        severity: 'suggestion'
                    });
                }
            }
        });

        return issues;
    }

    checkRequiredFields(ast) {
        const issues = [];
        const selectionsWithoutId = [];

        visit(ast, {
            SelectionSet(node, key, parent) {
                // Only check object type selections
                if (parent && (parent.kind === Kind.FIELD || parent.kind === Kind.OPERATION_DEFINITION)) {
                    const hasIdField = node.selections.some(s =>
                        s.kind === Kind.FIELD &&
                        (s.name.value === 'id' || s.name.value === 'ID' || s.name.value === '_id')
                    );

                    // Only flag if there are multiple fields but no id
                    if (!hasIdField && node.selections.length > 2) {
                        const parentName = parent.kind === Kind.FIELD ? parent.name.value : 'query';
                        selectionsWithoutId.push(parentName);
                    }
                }
            }
        });

        if (selectionsWithoutId.length > 0) {
            issues.push({
                message: `Consider including 'id' field in selections for better caching: ${selectionsWithoutId.slice(0, 3).join(', ')}${selectionsWithoutId.length > 3 ? '...' : ''}`,
                severity: 'info'
            });
        }

        return issues;
    }

    checkDeprecatedFields(ast, query, schema) {
        // This would require schema information to check
        // For now, return empty - can be enhanced with schema validation
        return [];
    }

    // === Helper Methods ===

    calculateQueryDepth(ast, selectionSet = null, currentDepth = 0) {
        if (!ast && !selectionSet) return 0;

        let maxDepth = currentDepth;

        const processSelectionSet = (set, depth) => {
            if (!set || !set.selections) return depth;

            for (const selection of set.selections) {
                if (selection.kind === Kind.FIELD) {
                    const fieldDepth = this.calculateQueryDepth(null, selection.selectionSet, depth + 1);
                    maxDepth = Math.max(maxDepth, fieldDepth);
                } else if (selection.kind === Kind.INLINE_FRAGMENT || selection.kind === Kind.FRAGMENT_SPREAD) {
                    const fragmentDepth = this.calculateQueryDepth(null, selection.selectionSet, depth);
                    maxDepth = Math.max(maxDepth, fragmentDepth);
                }
            }

            return maxDepth;
        };

        if (selectionSet) {
            return processSelectionSet(selectionSet, currentDepth);
        }

        visit(ast, {
            OperationDefinition(node) {
                const depth = processSelectionSet(node.selectionSet, 0);
                maxDepth = Math.max(maxDepth, depth);
            }
        });

        return maxDepth;
    }

    calculateComplexity(ast) {
        let complexity = 0;

        visit(ast, {
            Field() { complexity += 1; },
            FragmentSpread() { complexity += 2; },
            InlineFragment() { complexity += 2; },
            Directive() { complexity += 0.5; }
        });

        return Math.round(complexity);
    }

    toPascalCase(str) {
        return str
            .replace(/[-_](.)/g, (_, char) => char.toUpperCase())
            .replace(/^(.)/, (_, char) => char.toUpperCase());
    }

    toCamelCase(str) {
        return str
            .replace(/[-_](.)/g, (_, char) => char.toUpperCase())
            .replace(/^(.)/, (_, char) => char.toLowerCase());
    }

    /**
     * Get all available rules
     * @returns {Array} - List of rule definitions
     */
    getRules() {
        return this.rules.map(rule => ({
            id: rule.id,
            name: rule.name,
            severity: rule.severity,
            category: rule.category,
            description: rule.description
        }));
    }

    /**
     * Get rules by category
     * @param {string} category - Category name
     * @returns {Array} - Filtered rules
     */
    getRulesByCategory(category) {
        return this.rules
            .filter(rule => rule.category === category)
            .map(rule => ({
                id: rule.id,
                name: rule.name,
                severity: rule.severity,
                description: rule.description
            }));
    }

    /**
     * Update linter options
     * @param {Object} newOptions - New options to merge
     */
    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
    }
}

// Export singleton instance and class
const linterInstance = new GraphQLLinter();
module.exports = linterInstance;
module.exports.GraphQLLinter = GraphQLLinter;
