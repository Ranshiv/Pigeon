// services/ContractDiffService.js
// Database-free contract diff service for CLI usage

class ContractDiffService {
    /**
     * Compare two OpenAPI specifications with advanced contract diff capabilities
     * @param {Object} baseSpec - Base OpenAPI specification
     * @param {Object} newSpec - New OpenAPI specification 
     * @param {Object} options - Comparison options
     * @returns {Object} Complete diff result with breaking changes analysis
     */
    static async compareSpecs(baseSpec, newSpec, options = {}) {
        try {
            const { format = 'json', includeNonBreaking = true, detectRenames = false } = options;

            // Handle null/undefined specs
            if (!baseSpec && !newSpec) {
                return {
                    diffResult: format === 'json' ? {} : '',
                    breakingChanges: [],
                    changelog: '# API Specification Diff Report\n\nNo changes detected.',
                    summary: {
                        breakingChanges: 0,
                        nonBreakingChanges: 0,
                        addedEndpoints: 0,
                        removedEndpoints: 0,
                        modifiedEndpoints: 0,
                        totalChanges: 0
                    },
                    format,
                    hasBreakingChanges: false
                };
            }

            // Handle identical specs
            if (baseSpec && newSpec && JSON.stringify(baseSpec) === JSON.stringify(newSpec)) {
                return {
                    diffResult: format === 'json' ? {} : '',
                    breakingChanges: [],
                    changelog: '# API Specification Diff Report\n\nNo changes detected.',
                    summary: {
                        breakingChanges: 0,
                        nonBreakingChanges: 0,
                        addedEndpoints: 0,
                        removedEndpoints: 0,
                        modifiedEndpoints: 0,
                        totalChanges: 0
                    },
                    format,
                    hasBreakingChanges: false
                };
            }

            // Generate diff using enhanced fallback implementation
            const diffData = this._compareDiff(baseSpec, newSpec);

            // Apply rename detection heuristic if enabled
            if (detectRenames && diffData.paths) {
                this._applyRenameDetection(diffData);
            }

            // Extract breaking changes
            const breakingChanges = this.extractBreakingChanges(diffData);

            // Generate summary
            const summary = this.generateDiffSummary(diffData, breakingChanges);

            // Generate changelog
            const changelog = this.generateChangelog(diffData, breakingChanges);

            // Format the result based on requested format
            let formattedResult;
            switch (format) {
                case 'html':
                    formattedResult = this._generateHtmlReport(diffData, breakingChanges, changelog, summary);
                    break;
                case 'markdown':
                    formattedResult = this._generateMarkdownReport(diffData, breakingChanges, changelog, summary);
                    break;
                default:
                    formattedResult = diffData;
            }

            return {
                diffResult: formattedResult,
                breakingChanges,
                changelog,
                summary,
                format,
                hasBreakingChanges: breakingChanges.length > 0
            };
        } catch (error) {
            throw new Error(`Failed to compare specifications: ${error.message}`);
        }
    }

    /**
     * Extract breaking changes from diff result
     * @param {Object} diffResult - The diff result from comparison
     * @returns {Array} Array of normalized breaking changes
     */
    static extractBreakingChanges(diffResult) {
        if (!diffResult) return [];

        const breakingChanges = [];

        try {
            // Handle direct breaking changes array
            if (diffResult.breakingChanges && Array.isArray(diffResult.breakingChanges)) {
                diffResult.breakingChanges.forEach(change => {
                    breakingChanges.push({
                        type: 'breaking',
                        description: change.description || change.message || 'Breaking change detected',
                        location: change.location || change.path || 'Unknown',
                        severity: this.determineSeverity(change),
                        mitigationStrategy: change.mitigationStrategy || 'Review API documentation and update client code accordingly'
                    });
                });
            }

            // Analyze structural changes for breaking patterns
            if (diffResult.paths) {
                // Removed paths are breaking
                if (diffResult.paths.removed) {
                    Object.keys(diffResult.paths.removed).forEach(path => {
                        breakingChanges.push({
                            type: 'breaking',
                            description: `Endpoint ${path} was removed`,
                            location: `paths.${path}`,
                            severity: 'error',
                            mitigationStrategy: 'Remove calls to this endpoint or implement fallback logic'
                        });
                    });
                }

                // Modified paths might have breaking changes
                if (diffResult.paths.modified) {
                    Object.keys(diffResult.paths.modified).forEach(path => {
                        const pathChanges = diffResult.paths.modified[path];
                        if (pathChanges.breakingChanges) {
                            pathChanges.breakingChanges.forEach(change => {
                                breakingChanges.push({
                                    type: 'breaking',
                                    description: change.description,
                                    location: change.location,
                                    severity: this.determineSeverity(change),
                                    mitigationStrategy: change.mitigationStrategy || 'Update client code accordingly'
                                });
                            });
                        }
                    });
                }
            }

            // Check schema changes
            if (diffResult.schemas && diffResult.schemas.modified) {
                Object.keys(diffResult.schemas.modified).forEach(schemaName => {
                    const schemaChanges = diffResult.schemas.modified[schemaName];
                    if (schemaChanges.breakingChanges) {
                        schemaChanges.breakingChanges.forEach(change => {
                            breakingChanges.push({
                                type: 'breaking',
                                description: change.description,
                                location: change.location,
                                severity: this.determineSeverity(change),
                                mitigationStrategy: change.mitigationStrategy || 'Update client code to handle schema changes'
                            });
                        });
                    }
                });
            }

        } catch (error) {
            console.warn('Error extracting breaking changes:', error.message);
        }

        return breakingChanges;
    }

    /**
     * Determine severity level for a change
     * @param {Object} change - The change object
     * @returns {string} Severity level: 'error' or 'warning'
     */
    static determineSeverity(change) {
        if (!change) return 'warning';

        const { type, action, description } = change;

        // Breaking patterns that should be errors
        const errorPatterns = [
            /removed|deleted/i,
            /required.*added/i,
            /narrowed|restricted/i,
            /incompatible/i
        ];

        // Non-breaking patterns that should be warnings
        const warningPatterns = [
            /added.*optional/i,
            /description.*changed/i,
            /example.*updated/i,
            /deprecated/i
        ];

        const text = description || action || type || '';

        if (errorPatterns.some(pattern => pattern.test(text))) {
            return 'error';
        }

        if (warningPatterns.some(pattern => pattern.test(text))) {
            return 'warning';
        }

        // Default based on action/type
        if (type === 'removed' || action === 'delete') {
            return 'error';
        }

        if (type === 'added' || action === 'add') {
            return 'warning';
        }

        return 'warning';
    }

    /**
     * Generate human-readable changelog from diff result
     * @param {Object} diffResult - The diff result
     * @param {Array} breakingChanges - Array of breaking changes
     * @returns {string} Markdown formatted changelog
     */
    static generateChangelog(diffResult, breakingChanges) {
        let changelog = '# API Specification Diff Report\n\n';

        // Breaking Changes section
        if (breakingChanges.length > 0) {
            changelog += '## Breaking Changes\n\n';
            breakingChanges.forEach(change => {
                changelog += `- **${change.description}** (${change.location})\n`;
                if (change.mitigationStrategy) {
                    changelog += `  - *Mitigation:* ${change.mitigationStrategy}\n`;
                }
            });
            changelog += '\n';
        }

        // Other Changes section
        changelog += '## Other Changes\n\n';

        try {
            // Added endpoints
            if (diffResult.paths && diffResult.paths.added) {
                const added = Object.keys(diffResult.paths.added);
                if (added.length > 0) {
                    changelog += '### New Endpoints\n';
                    added.forEach(path => {
                        changelog += `- Added endpoint: \`${path}\`\n`;
                    });
                    changelog += '\n';
                }
            }

            // Modified endpoints
            if (diffResult.paths && diffResult.paths.modified) {
                const modified = Object.keys(diffResult.paths.modified);
                if (modified.length > 0) {
                    changelog += '### Modified Endpoints\n';
                    modified.forEach(path => {
                        changelog += `- Modified endpoint: \`${path}\`\n`;
                    });
                    changelog += '\n';
                }
            }

            // Non-breaking changes
            if (diffResult.nonBreakingChanges && Array.isArray(diffResult.nonBreakingChanges)) {
                if (diffResult.nonBreakingChanges.length > 0) {
                    changelog += '### Non-Breaking Changes\n';
                    diffResult.nonBreakingChanges.forEach(change => {
                        changelog += `- ${change.description || change.action || 'Change detected'}\n`;
                    });
                    changelog += '\n';
                }
            }

        } catch (error) {
            console.warn('Error generating changelog details:', error.message);
        }

        if (changelog === '# API Specification Diff Report\n\n## Other Changes\n\n') {
            changelog += 'No significant changes detected.\n';
        }

        return changelog;
    }

    /**
     * Generate numeric summary of changes
     * @param {Object} diffResult - The diff result
     * @param {Array} breakingChanges - Array of breaking changes
     * @returns {Object} Summary statistics
     */
    static generateDiffSummary(diffResult, breakingChanges) {
        const summary = {
            breakingChanges: breakingChanges.length,
            nonBreakingChanges: 0,
            addedEndpoints: 0,
            removedEndpoints: 0,
            modifiedEndpoints: 0,
            totalChanges: 0
        };

        try {
            if (diffResult.paths) {
                if (diffResult.paths.added) {
                    summary.addedEndpoints = Object.keys(diffResult.paths.added).length;
                }
                if (diffResult.paths.removed) {
                    summary.removedEndpoints = Object.keys(diffResult.paths.removed).length;
                }
                if (diffResult.paths.modified) {
                    summary.modifiedEndpoints = Object.keys(diffResult.paths.modified).length;
                }
            }

            // Count non-breaking changes
            if (diffResult.nonBreakingChanges && Array.isArray(diffResult.nonBreakingChanges)) {
                summary.nonBreakingChanges = diffResult.nonBreakingChanges.length;
            } else {
                // Estimate non-breaking changes from additions and non-removal modifications
                summary.nonBreakingChanges = summary.addedEndpoints + Math.max(0, summary.modifiedEndpoints - summary.breakingChanges);
            }

            summary.totalChanges = summary.breakingChanges + summary.nonBreakingChanges;

        } catch (error) {
            console.warn('Error calculating summary:', error.message);
        }

        return summary;
    }

    /**
     * Enhanced diff implementation for contract comparison
     * @private
     */
    static _compareDiff(baseSpec, newSpec) {
        const result = {
            paths: { added: {}, removed: {}, modified: {} },
            schemas: { added: {}, removed: {}, modified: {} },
            parameters: { added: [], removed: [] },
            responses: { added: [], removed: [] },
            nonBreakingChanges: [],
            breakingChanges: []
        };

        if (!baseSpec || !newSpec) {
            return this._generateNullSpecDiff(baseSpec, newSpec);
        }

        const basePaths = Object.keys(baseSpec.paths || {});
        const newPaths = Object.keys(newSpec.paths || {});

        // Find added and removed paths
        newPaths.forEach(path => {
            if (!basePaths.includes(path)) {
                result.paths.added[path] = newSpec.paths[path];
                result.nonBreakingChanges.push({
                    action: 'add',
                    description: `Added endpoint ${path}`,
                    location: `paths.${path}`
                });
            }
        });

        basePaths.forEach(path => {
            if (!newPaths.includes(path)) {
                result.paths.removed[path] = baseSpec.paths[path];
                result.breakingChanges.push({
                    type: 'removed',
                    description: `Removed endpoint ${path}`,
                    location: `paths.${path}`
                });
            }
        });

        // Find modified paths
        basePaths.forEach(path => {
            if (newPaths.includes(path)) {
                const pathChanges = this._comparePaths(baseSpec.paths[path], newSpec.paths[path], path);
                if (pathChanges.hasChanges) {
                    result.paths.modified[path] = pathChanges;
                    result.breakingChanges.push(...pathChanges.breakingChanges || []);
                    result.nonBreakingChanges.push(...pathChanges.nonBreakingChanges || []);
                }
            }
        });

        // Compare schemas if they exist
        if (baseSpec.components?.schemas || newSpec.components?.schemas) {
            const schemaChanges = this._compareSchemas(
                baseSpec.components?.schemas || {},
                newSpec.components?.schemas || {}
            );
            result.schemas = schemaChanges.schemas;
            result.breakingChanges.push(...schemaChanges.breakingChanges);
            result.nonBreakingChanges.push(...schemaChanges.nonBreakingChanges);
        }

        return result;
    }

    /**
     * Compare two path objects
     * @private
     */
    static _comparePaths(basePath, newPath, pathName) {
        const result = {
            hasChanges: false,
            operations: { added: [], removed: [], modified: {} },
            breakingChanges: [],
            nonBreakingChanges: []
        };

        const baseMethods = Object.keys(basePath || {});
        const newMethods = Object.keys(newPath || {});

        // Find added operations
        newMethods.forEach(method => {
            if (!baseMethods.includes(method)) {
                result.operations.added.push(method);
                result.nonBreakingChanges.push({
                    action: 'add',
                    description: `Added ${method.toUpperCase()} operation to ${pathName}`,
                    location: `paths.${pathName}.${method}`
                });
                result.hasChanges = true;
            }
        });

        // Find removed operations
        baseMethods.forEach(method => {
            if (!newMethods.includes(method)) {
                result.operations.removed.push(method);
                result.breakingChanges.push({
                    type: 'removed',
                    description: `Removed ${method.toUpperCase()} operation from ${pathName}`,
                    location: `paths.${pathName}.${method}`
                });
                result.hasChanges = true;
            }
        });

        // Find modified operations
        baseMethods.forEach(method => {
            if (newMethods.includes(method)) {
                const opChanges = this._compareOperations(basePath[method], newPath[method], pathName, method);
                if (opChanges.hasChanges) {
                    result.operations.modified[method] = opChanges;
                    result.breakingChanges.push(...opChanges.breakingChanges || []);
                    result.nonBreakingChanges.push(...opChanges.nonBreakingChanges || []);
                    result.hasChanges = true;
                }
            }
        });

        return result;
    }

    /**
     * Compare two operation objects
     * @private
     */
    static _compareOperations(baseOp, newOp, pathName, method) {
        const result = {
            hasChanges: false,
            breakingChanges: [],
            nonBreakingChanges: []
        };

        // Compare parameters
        const baseParams = baseOp.parameters || [];
        const newParams = newOp.parameters || [];

        // Check for new required parameters (breaking)
        newParams.forEach(newParam => {
            const existing = baseParams.find(p => p.name === newParam.name && p.in === newParam.in);
            if (!existing && newParam.required) {
                result.breakingChanges.push({
                    type: 'parameter-required-added',
                    description: `Required parameter '${newParam.name}' added to ${method.toUpperCase()} ${pathName}`,
                    location: `paths.${pathName}.${method}.parameters`
                });
                result.hasChanges = true;
            } else if (!existing && !newParam.required) {
                result.nonBreakingChanges.push({
                    action: 'parameter-optional-added',
                    description: `Optional parameter '${newParam.name}' added to ${method.toUpperCase()} ${pathName}`,
                    location: `paths.${pathName}.${method}.parameters`
                });
                result.hasChanges = true;
            }
        });

        // Check for removed parameters (breaking)
        baseParams.forEach(baseParam => {
            const existing = newParams.find(p => p.name === baseParam.name && p.in === baseParam.in);
            if (!existing) {
                result.breakingChanges.push({
                    type: 'parameter-removed',
                    description: `Parameter '${baseParam.name}' removed from ${method.toUpperCase()} ${pathName}`,
                    location: `paths.${pathName}.${method}.parameters`
                });
                result.hasChanges = true;
            }
        });

        // Compare responses
        const baseResponses = Object.keys(baseOp.responses || {});
        const newResponses = Object.keys(newOp.responses || {});

        // Removed response status codes are breaking
        baseResponses.forEach(status => {
            if (!newResponses.includes(status)) {
                result.breakingChanges.push({
                    type: 'response-removed',
                    description: `Response status ${status} removed from ${method.toUpperCase()} ${pathName}`,
                    location: `paths.${pathName}.${method}.responses.${status}`
                });
                result.hasChanges = true;
            }
        });

        // Added response status codes are non-breaking
        newResponses.forEach(status => {
            if (!baseResponses.includes(status)) {
                result.nonBreakingChanges.push({
                    action: 'response-added',
                    description: `Response status ${status} added to ${method.toUpperCase()} ${pathName}`,
                    location: `paths.${pathName}.${method}.responses.${status}`
                });
                result.hasChanges = true;
            }
        });

        return result;
    }

    /**
     * Compare schemas
     * @private
     */
    static _compareSchemas(baseSchemas, newSchemas) {
        const result = {
            schemas: { added: {}, removed: {}, modified: {} },
            breakingChanges: [],
            nonBreakingChanges: []
        };

        const baseSchemaNames = Object.keys(baseSchemas);
        const newSchemaNames = Object.keys(newSchemas);

        // Added schemas
        newSchemaNames.forEach(name => {
            if (!baseSchemaNames.includes(name)) {
                result.schemas.added[name] = newSchemas[name];
                result.nonBreakingChanges.push({
                    action: 'schema-added',
                    description: `Schema '${name}' was added`,
                    location: `components.schemas.${name}`
                });
            }
        });

        // Removed schemas
        baseSchemaNames.forEach(name => {
            if (!newSchemaNames.includes(name)) {
                result.schemas.removed[name] = baseSchemas[name];
                result.breakingChanges.push({
                    type: 'schema-removed',
                    description: `Schema '${name}' was removed`,
                    location: `components.schemas.${name}`
                });
            }
        });

        // Modified schemas
        baseSchemaNames.forEach(name => {
            if (newSchemaNames.includes(name)) {
                const schemaChanges = this._compareSchemaProperties(baseSchemas[name], newSchemas[name], name);
                if (schemaChanges.hasChanges) {
                    result.schemas.modified[name] = schemaChanges;
                    result.breakingChanges.push(...schemaChanges.breakingChanges || []);
                    result.nonBreakingChanges.push(...schemaChanges.nonBreakingChanges || []);
                }
            }
        });

        return result;
    }

    /**
     * Compare schema properties
     * @private
     */
    static _compareSchemaProperties(baseSchema, newSchema, schemaName) {
        const result = {
            hasChanges: false,
            properties: { added: [], removed: [] },
            breakingChanges: [],
            nonBreakingChanges: []
        };

        const baseProps = Object.keys(baseSchema.properties || {});
        const newProps = Object.keys(newSchema.properties || {});
        const baseRequired = baseSchema.required || [];
        const newRequired = newSchema.required || [];

        // Removed properties are breaking
        baseProps.forEach(prop => {
            if (!newProps.includes(prop)) {
                result.properties.removed.push(prop);
                result.breakingChanges.push({
                    type: 'property-removed',
                    description: `Property '${prop}' was removed from schema '${schemaName}'`,
                    location: `components.schemas.${schemaName}.properties.${prop}`
                });
                result.hasChanges = true;
            }
        });

        // Added properties are non-breaking
        newProps.forEach(prop => {
            if (!baseProps.includes(prop)) {
                result.properties.added.push(prop);
                result.nonBreakingChanges.push({
                    action: 'property-added',
                    description: `Property '${prop}' was added to schema '${schemaName}'`,
                    location: `components.schemas.${schemaName}.properties.${prop}`
                });
                result.hasChanges = true;
            }
        });

        // Check for new required fields (breaking)
        newRequired.forEach(prop => {
            if (!baseRequired.includes(prop)) {
                result.breakingChanges.push({
                    type: 'property-required-added',
                    description: `Property '${prop}' became required in schema '${schemaName}'`,
                    location: `components.schemas.${schemaName}.required`
                });
                result.hasChanges = true;
            }
        });

        return result;
    }

    /**
     * Generate diff for null specs
     * @private
     */
    static _generateNullSpecDiff(baseSpec, newSpec) {
        if (!baseSpec && newSpec) {
            // All of newSpec is added
            const paths = newSpec.paths || {};
            return {
                paths: {
                    added: paths,
                    removed: {},
                    modified: {}
                },
                nonBreakingChanges: Object.keys(paths).map(path => ({
                    action: 'add',
                    description: `Added endpoint ${path}`
                }))
            };
        }

        if (baseSpec && !newSpec) {
            // All of baseSpec is removed
            const paths = baseSpec.paths || {};
            return {
                paths: {
                    added: {},
                    removed: paths,
                    modified: {}
                },
                breakingChanges: Object.keys(paths).map(path => ({
                    type: 'removed',
                    description: `Removed endpoint ${path}`,
                    location: `paths.${path}`
                }))
            };
        }

        return {};
    }

    /**
     * Apply rename detection heuristic
     * @private
     */
    static _applyRenameDetection(diffData) {
        // Simplified rename detection - can be enhanced
        const removed = Object.keys(diffData.paths?.removed || {});
        const added = Object.keys(diffData.paths?.added || {});

        // Look for similar paths that might be renames
        removed.forEach(removedPath => {
            added.forEach(addedPath => {
                const similarity = this._calculatePathSimilarity(removedPath, addedPath);
                if (similarity > 0.7) { // 70% similarity threshold
                    // Mark as potential rename rather than remove + add
                    console.log(`Potential rename detected: ${removedPath} -> ${addedPath}`);
                }
            });
        });

        return diffData;
    }

    /**
     * Calculate path similarity for rename detection
     * @private
     */
    static _calculatePathSimilarity(path1, path2) {
        // Simple similarity calculation based on common segments
        const segments1 = path1.split('/').filter(s => s);
        const segments2 = path2.split('/').filter(s => s);

        const maxLength = Math.max(segments1.length, segments2.length);
        if (maxLength === 0) return 1;

        let matches = 0;
        const minLength = Math.min(segments1.length, segments2.length);

        for (let i = 0; i < minLength; i++) {
            if (segments1[i] === segments2[i] ||
                (segments1[i].startsWith('{') && segments2[i].startsWith('{'))) {
                matches++;
            }
        }

        return matches / maxLength;
    }

    /**
     * Generate HTML report
     * @private
     */
    static _generateHtmlReport(diffResult, breakingChanges, changelog, summary) {
        const title = 'API Specification Diff Report';
        const markdownContent = changelog.replace(/^# /, '').replace(/^## /gm, '<h2>').replace(/^### /gm, '<h3>').replace(/^\- /gm, '<li>').replace(/\n/g, '</li>\n');

        return `<!DOCTYPE html>
<html>
<head>
    <title>${title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .breaking { color: #d73a49; }
        .non-breaking { color: #28a745; }
        .warning { color: #ffc107; }
        ul { list-style-type: none; padding-left: 0; }
        li { margin: 5px 0; }
    </style>
</head>
<body>
    <h1>${title}</h1>
    <div class="summary">
        <h2>Summary</h2>
        <p><span class="breaking">Breaking Changes: ${summary.breakingChanges}</span></p>
        <p><span class="non-breaking">Non-Breaking Changes: ${summary.nonBreakingChanges}</span></p>
        <p>Total Changes: ${summary.totalChanges}</p>
    </div>
    ${markdownContent}
</body>
</html>`;
    }

    /**
     * Generate Markdown report
     * @private
     */
    static _generateMarkdownReport(diffResult, breakingChanges, changelog, summary) {
        return changelog;
    }
}

module.exports = ContractDiffService;
