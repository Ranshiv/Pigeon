// routes/apiVersions.js
const express = require('express');
const router = express.Router();
const ApiVersioningService = require('../services/ApiVersioningService');
const MockServerService = require('../services/MockServerService');
const IntegrationService = require('../services/IntegrationService');
const ApiVersion = require('../models/ApiVersion');
const { authenticateJWT } = require('../middleware/auth');
const { getDb } = require('../config/db');
const { findCollectionForUser } = require('../services/CollectionAccessService');
const ContractDiffService = require('../services/ContractDiffService');

// API-version routes historically authenticated callers without checking that
// the referenced collection belonged to them. Resolve the target once here so
// every existing and future handler inherits the same authorization policy.
router.use(authenticateJWT, async (req, res, next) => {
    try {
        const db = getDb();
        if (!db) return res.status(503).json({ message: 'Database is not ready.' });
        const collectionPath = req.path.match(/^\/collections?\/([^/]+)/);
        let collectionId = collectionPath?.[1] || req.body?.collectionId;
        const versionIds = Array.from(req.path.matchAll(/[0-9a-f]{24}/ig), (match) => match[0]);
        if (!collectionId && versionIds.length) {
            const versions = await ApiVersion.find({ _id: { $in: versionIds } }).select('collectionId').lean();
            if (versions.length !== new Set(versionIds).size || new Set(versions.map((item) => String(item.collectionId))).size !== 1) {
                return res.status(404).json({ message: 'API version not found.' });
            }
            collectionId = String(versions[0].collectionId);
        }
        if (!collectionId) return next();
        const collection = await findCollectionForUser(db, collectionId, req.user, req.method === 'GET' ? 'viewer' : 'editor');
        if (!collection) return res.status(404).json({ message: 'Collection or API version not found.' });
        req.apiVersionCollection = collection;
        return next();
    } catch (error) {
        return next(error);
    }
});

// Create a new API version
router.post('/collections/:collectionId/versions', authenticateJWT, async (req, res) => {
    try {
        const { collectionId } = req.params;
        const userId = req.user.id;
        const versionData = req.body;

        const apiVersion = await ApiVersioningService.createVersion(collectionId, versionData, userId);

        // Auto-lint if enabled and OpenAPI spec is provided
        if (apiVersion.openApiSpec && process.env.PIGEON_LINT_ENABLED !== 'false') {
            try {
                const integrationService = new IntegrationService();
                const lintResult = await integrationService.lintOpenApi(apiVersion.openApiSpec, {
                    apiVersionId: apiVersion._id
                });

                // Update the version with lint results
                await ApiVersion.findByIdAndUpdate(apiVersion._id, {
                    lintFindings: lintResult.findings,
                    lintScore: lintResult.score,
                    lintedAt: new Date(lintResult.lintedAt),
                    rulesetInfo: lintResult.rulesetInfo
                });

                apiVersion.lintFindings = lintResult.findings;
                apiVersion.lintScore = lintResult.score;
                apiVersion.lintedAt = new Date(lintResult.lintedAt);
                apiVersion.rulesetInfo = lintResult.rulesetInfo;

                console.log(`📋 Auto-lint completed for API version ${apiVersion._id}: score ${lintResult.score}/100`);
            } catch (lintError) {
                console.warn(`⚠️ Auto-lint failed for API version ${apiVersion._id}:`, lintError.message);
                // Don't fail the version creation if linting fails
            }
        }

        res.status(201).json({
            message: 'API version created successfully',
            apiVersion
        });
    } catch (error) {
        console.error('Error creating API version:', error);
        res.status(400).json({
            message: error.message || 'Failed to create API version'
        });
    }
});

// Get all versions for a collection
router.get('/collections/:collectionId/versions', authenticateJWT, async (req, res) => {
    try {
        const { collectionId } = req.params;

        const versions = await ApiVersioningService.getVersions(collectionId);

        res.json({
            versions,
            total: versions.length
        });
    } catch (error) {
        console.error('Error getting API versions:', error);
        res.status(500).json({
            message: error.message || 'Failed to get API versions'
        });
    }
});

// Get a specific API version
router.get('/versions/:versionId', authenticateJWT, async (req, res) => {
    try {
        const { versionId } = req.params;

        const version = await ApiVersioningService.getVersion(versionId);

        res.json(version);
    } catch (error) {
        console.error('Error getting API version:', error);
        res.status(404).json({
            message: error.message || 'API version not found'
        });
    }
});

// Update an API version
router.put('/versions/:versionId', authenticateJWT, async (req, res) => {
    try {
        const { versionId } = req.params;
        const userId = req.user.id;
        const updateData = req.body;

        const version = await ApiVersioningService.updateVersion(versionId, updateData, userId);

        // Auto-lint if enabled and OpenAPI spec was updated
        if (updateData.openApiSpec && process.env.PIGEON_LINT_ENABLED !== 'false') {
            try {
                const integrationService = new IntegrationService();
                const lintResult = await integrationService.lintOpenApi(updateData.openApiSpec, {
                    apiVersionId: version._id
                });

                // Update the version with lint results
                await ApiVersion.findByIdAndUpdate(version._id, {
                    lintFindings: lintResult.findings,
                    lintScore: lintResult.score,
                    lintedAt: new Date(lintResult.lintedAt),
                    rulesetInfo: lintResult.rulesetInfo
                });

                version.lintFindings = lintResult.findings;
                version.lintScore = lintResult.score;
                version.lintedAt = new Date(lintResult.lintedAt);
                version.rulesetInfo = lintResult.rulesetInfo;

                console.log(`📋 Auto-lint completed for updated API version ${version._id}: score ${lintResult.score}/100`);
            } catch (lintError) {
                console.warn(`⚠️ Auto-lint failed for updated API version ${version._id}:`, lintError.message);
                // Don't fail the version update if linting fails
            }
        }

        res.json({
            message: 'API version updated successfully',
            version
        });
    } catch (error) {
        console.error('Error updating API version:', error);
        res.status(400).json({
            message: error.message || 'Failed to update API version'
        });
    }
});

// Deprecate an API version
router.post('/versions/:versionId/deprecate', authenticateJWT, async (req, res) => {
    try {
        const { versionId } = req.params;
        const userId = req.user.id;
        const deprecationInfo = req.body;

        const version = await ApiVersioningService.deprecateVersion(versionId, deprecationInfo, userId);

        res.json({
            message: 'API version deprecated successfully',
            version
        });
    } catch (error) {
        console.error('Error deprecating API version:', error);
        res.status(400).json({
            message: error.message || 'Failed to deprecate API version'
        });
    }
});

// Generate compatibility report
router.get('/collections/:collectionId/compatibility-report', authenticateJWT, async (req, res) => {
    try {
        const { collectionId } = req.params;

        const report = await ApiVersioningService.generateCompatibilityReport(collectionId);

        res.json(report);
    } catch (error) {
        console.error('Error generating compatibility report:', error);
        res.status(500).json({
            message: error.message || 'Failed to generate compatibility report'
        });
    }
});

// Compare two API versions
router.get('/versions/:version1Id/compare/:version2Id', authenticateJWT, async (req, res) => {
    try {
        const { version1Id, version2Id } = req.params;

        // Get both versions first
        const [version1, version2] = await Promise.all([
            ApiVersioningService.getVersion(version1Id),
            ApiVersioningService.getVersion(version2Id)
        ]);

        if (!version1 || !version2) {
            return res.status(404).json({
                message: 'One or both versions not found'
            });
        }

        // Use the newer compareSpecs method for better diff detection
        const specComparison = await ApiVersioningService.compareSpecs(
            version1.openApiSpec,
            version2.openApiSpec,
            { includeNonBreaking: true }
        );

        // Transform the result to match frontend expectations
        const changes = [];

        if (specComparison.breakingChanges) {
            specComparison.breakingChanges.forEach(change => {
                changes.push({
                    path: change.path || change.endpoint || '',
                    description: change.description || change.message || change.change || 'Breaking change detected',
                    breaking: true,
                    type: change.type || 'breaking'
                });
            });
        }

        // Add non-breaking changes from summary
        const summary = specComparison.summary || {};
        const nonBreakingCount = summary.nonBreakingChanges || 0;
        const addedEndpoints = summary.addedEndpoints || 0;
        const modifiedEndpoints = summary.modifiedEndpoints || 0;

        // Create placeholder non-breaking changes based on summary
        if (addedEndpoints > 0) {
            changes.push({
                path: 'endpoints',
                description: `${addedEndpoints} new endpoint(s) added`,
                breaking: false,
                type: 'addition'
            });
        }

        if (modifiedEndpoints > 0 && !specComparison.hasBreakingChanges) {
            changes.push({
                path: 'endpoints',
                description: `${modifiedEndpoints} endpoint(s) modified (non-breaking)`,
                breaking: false,
                type: 'modification'
            });
        }

        // Calculate compatibility score
        const totalChanges = summary.totalChanges || 0;
        const breakingChanges = summary.breakingChanges || 0;
        let compatibilityScore = 100;

        if (totalChanges > 0) {
            // Reduce score based on breaking changes (more weight) and total changes
            const breakingPenalty = breakingChanges * 20; // 20 points per breaking change
            const totalPenalty = Math.min(breakingPenalty, 80); // Cap at 80% reduction
            compatibilityScore = Math.max(20, 100 - totalPenalty);
        }

        // Build response in format expected by frontend
        const comparison = {
            changes: changes,
            compatibilityScore: compatibilityScore,
            summary: {
                totalChanges: totalChanges,
                breakingChanges: breakingChanges,
                nonBreakingChanges: nonBreakingCount,
                addedEndpoints: addedEndpoints,
                removedEndpoints: summary.removedEndpoints || 0,
                modifiedEndpoints: modifiedEndpoints
            },
            versions: {
                from: version1.version,
                to: version2.version
            },
            hasBreakingChanges: specComparison.hasBreakingChanges || false,
            changelog: specComparison.changelog || '',
            // Include raw spec comparison for debugging
            _debug: {
                rawSpecComparison: specComparison
            }
        };

        res.json(comparison);
    } catch (error) {
        console.error('Error comparing API versions:', error);
        res.status(500).json({
            message: error.message || 'Failed to compare API versions'
        });
    }
});

// Standards-oriented release notes for the documentation manager. The
// contract diff remains deterministic; AI may improve wording later but may
// never introduce changes that are absent from this result.
router.get('/:fromId/compare/:toId/changelog', async (req, res) => {
    try {
        const [fromVersion, toVersion] = await Promise.all([
            ApiVersion.findById(req.params.fromId).lean(),
            ApiVersion.findById(req.params.toId).lean()
        ]);
        if (!fromVersion || !toVersion || String(fromVersion.collectionId) !== String(toVersion.collectionId)) {
            return res.status(404).json({ message: 'Both API versions must exist in the same collection.' });
        }
        const collection = await findCollectionForUser(getDb(), String(fromVersion.collectionId), req.user, 'viewer');
        if (!collection) return res.status(404).json({ message: 'API versions not found.' });
        const comparison = await ContractDiffService.compareSpecs(fromVersion.openApiSpec, toVersion.openApiSpec);
        const diff = comparison.diffResult || {};
        const added = Object.keys(diff.paths?.added || {});
        const removed = Object.keys(diff.paths?.removed || {});
        const changed = Object.keys(diff.paths?.modified || {});
        const lines = [`# Changelog`, '', `## ${toVersion.version}`, ''];
        if (added.length) lines.push('### Added', '', ...added.map((item) => `- \`${item}\``), '');
        if (changed.length) lines.push('### Changed', '', ...changed.map((item) => `- \`${item}\``), '');
        if (removed.length) lines.push('### Removed', '', ...removed.map((item) => `- \`${item}\``), '');
        if (comparison.breakingChanges.length) lines.push('### Migration notes', '', ...comparison.breakingChanges.map((item) => `- ${item.description}${item.mitigationStrategy ? ` — ${item.mitigationStrategy}` : ''}`), '');
        if (!added.length && !removed.length && !changed.length && !comparison.breakingChanges.length) lines.push('- No externally visible contract changes detected.', '');
        const semverSuggestion = comparison.breakingChanges.length || removed.length ? 'major' : added.length ? 'minor' : 'patch';
        return res.json({
            from: fromVersion.version, to: toVersion.version,
            summary: comparison.summary, breakingChanges: comparison.breakingChanges,
            changes: { added, changed, removed }, semverSuggestion,
            changelog: lines.join('\n').trim(), migrationGuide: comparison.breakingChanges.map((item) => item.mitigationStrategy).filter(Boolean).join('\n')
        });
    } catch (error) {
        console.error('Error generating API changelog:', error);
        return res.status(500).json({ message: error.message || 'Failed to generate changelog.' });
    }
});

// Create mock server from OpenAPI spec
router.post('/versions/:versionId/mock-server', authenticateJWT, async (req, res) => {
    try {
        const { versionId } = req.params;
        const userId = req.user.id;
        const { openApiSpec } = req.body;

        // Get the version to find collection ID
        const version = await ApiVersioningService.getVersion(versionId);

        const mockServer = await MockServerService.createMockServerFromSpec(
            version.collectionId,
            versionId,
            openApiSpec,
            userId
        );

        res.status(201).json({
            message: 'Mock server created successfully',
            mockServer
        });
    } catch (error) {
        console.error('Error creating mock server:', error);
        res.status(400).json({
            message: error.message || 'Failed to create mock server'
        });
    }
});

// Get mock servers for a version
router.get('/versions/:versionId/mock-servers', authenticateJWT, async (req, res) => {
    try {
        const { versionId } = req.params;

        // Get the version to find collection ID
        const version = await ApiVersioningService.getVersion(versionId);

        const mockServers = await MockServerService.getMockServers(version.collectionId, versionId);

        res.json({
            mockServers,
            total: mockServers.length
        });
    } catch (error) {
        console.error('Error getting mock servers:', error);
        res.status(500).json({
            message: error.message || 'Failed to get mock servers'
        });
    }
});

// Generate versioned URL
router.post('/versions/:versionId/generate-url', authenticateJWT, async (req, res) => {
    try {
        const { versionId } = req.params;
        const { baseUrl, strategy, config } = req.body;

        const version = await ApiVersioningService.getVersion(versionId);

        const versionedUrl = ApiVersioningService.getVersionedUrl(
            baseUrl,
            version.version,
            strategy || version.versioningStrategy,
            config || version.versioningConfig
        );

        const headers = ApiVersioningService.getVersionHeaders(
            version.version,
            strategy || version.versioningStrategy,
            config || version.versioningConfig
        );

        res.json({
            originalUrl: baseUrl,
            versionedUrl,
            headers,
            version: version.version,
            strategy: strategy || version.versioningStrategy
        });
    } catch (error) {
        console.error('Error generating versioned URL:', error);
        res.status(500).json({
            message: error.message || 'Failed to generate versioned URL'
        });
    }
});

// OpenAPI Linting endpoints

// Re-run lint on an API version
router.post('/versions/:versionId/lint', authenticateJWT, async (req, res) => {
    try {
        const { versionId } = req.params;
        const { rulesetPath, timeoutMs = 10000, maxSizeMB = 20 } = req.body;

        // Get the API version
        const version = await ApiVersioningService.getVersion(versionId);
        if (!version) {
            return res.status(404).json({
                message: 'API version not found'
            });
        }

        if (!version.openApiSpec) {
            return res.status(400).json({
                message: 'No OpenAPI specification found for this version'
            });
        }

        // Validate security: ensure rulesetPath is safe
        if (rulesetPath && (rulesetPath.includes('..') || require('path').isAbsolute(rulesetPath))) {
            return res.status(400).json({
                message: 'Invalid ruleset path: must be relative and cannot contain ".."'
            });
        }

        // Run linting
        const integrationService = new IntegrationService();
        const lintResult = await integrationService.lintOpenApi(version.openApiSpec, {
            rulesetPath,
            timeoutMs,
            maxSizeMB,
            apiVersionId: versionId
        });

        // Update the version with lint results
        await ApiVersion.findByIdAndUpdate(versionId, {
            lintFindings: lintResult.findings,
            lintScore: lintResult.score,
            lintedAt: new Date(lintResult.lintedAt),
            rulesetInfo: lintResult.rulesetInfo
        });

        res.json({
            message: 'Linting completed successfully',
            summary: {
                score: lintResult.score,
                counts: lintResult.counts,
                rulesetInfo: lintResult.rulesetInfo,
                lintedAt: lintResult.lintedAt
            },
            findings: lintResult.findings
        });

    } catch (error) {
        console.error('Error running lint:', error);
        res.status(500).json({
            message: error.message || 'Failed to run linting'
        });
    }
});

// Get lint results for an API version
router.get('/versions/:versionId/lint', authenticateJWT, async (req, res) => {
    try {
        const { versionId } = req.params;

        const version = await ApiVersioningService.getVersion(versionId);
        if (!version) {
            return res.status(404).json({
                message: 'API version not found'
            });
        }

        // Return persisted lint results
        if (!version.lintedAt) {
            return res.json({
                message: 'No lint results available',
                summary: {
                    score: null,
                    counts: { errors: 0, warnings: 0, infos: 0, hints: 0 },
                    rulesetInfo: null,
                    lintedAt: null
                },
                findings: []
            });
        }

        res.json({
            summary: {
                score: version.lintScore,
                counts: {
                    errors: version.lintFindings.filter(f => f.severity === 'error').length,
                    warnings: version.lintFindings.filter(f => f.severity === 'warn').length,
                    infos: version.lintFindings.filter(f => f.severity === 'info').length,
                    hints: version.lintFindings.filter(f => f.severity === 'hint').length
                },
                rulesetInfo: version.rulesetInfo,
                lintedAt: version.lintedAt
            },
            findings: version.lintFindings || []
        });

    } catch (error) {
        console.error('Error getting lint results:', error);
        res.status(500).json({
            message: error.message || 'Failed to get lint results'
        });
    }
});

// Simplified routes for easier frontend integration

// Create a new API version (simplified)
router.post('/', authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.id;
        const versionData = req.body;
        const { collectionId } = versionData;

        console.log('Creating API version with data:', JSON.stringify(versionData, null, 2));

        if (!collectionId) {
            console.log('Missing collectionId in request');
            return res.status(400).json({
                message: 'Collection ID is required'
            });
        }

        const apiVersion = await ApiVersioningService.createVersion(collectionId, versionData, userId);

        res.status(201).json(apiVersion);
    } catch (error) {
        console.error('Error creating API version:', error);
        res.status(400).json({
            message: error.message || 'Failed to create API version'
        });
    }
});

// Get all versions for a collection (simplified)
router.get('/collection/:collectionId', authenticateJWT, async (req, res) => {
    try {
        const { collectionId } = req.params;

        const versions = await ApiVersioningService.getVersions(collectionId);

        // Return the versions array directly (not wrapped in an object)
        res.json(versions);
    } catch (error) {
        console.error('Error getting API versions:', error);
        res.status(500).json({
            message: error.message || 'Failed to get API versions'
        });
    }
});

// Deprecate a version (simplified)
router.post('/:versionId/deprecate', authenticateJWT, async (req, res) => {
    try {
        const { versionId } = req.params;
        const userId = req.user.id;
        const { deprecationDate, migrationGuide } = req.body;

        const apiVersion = await ApiVersioningService.deprecateVersion(versionId, {
            deprecationDate,
            migrationGuide
        }, userId);

        res.json({
            message: 'API version deprecated successfully',
            apiVersion
        });
    } catch (error) {
        console.error('Error deprecating API version:', error);
        res.status(400).json({
            message: error.message || 'Failed to deprecate API version'
        });
    }
});

// Delete a version (simplified)
router.delete('/:versionId', authenticateJWT, async (req, res) => {
    try {
        const { versionId } = req.params;
        const userId = req.user.id;

        await ApiVersioningService.deleteVersion(versionId, userId);

        res.json({
            message: 'API version deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting API version:', error);
        res.status(400).json({
            message: error.message || 'Failed to delete API version'
        });
    }
});

module.exports = router;
