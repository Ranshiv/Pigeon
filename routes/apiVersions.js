// routes/apiVersions.js
const express = require('express');
const router = express.Router();
const ApiVersioningService = require('../services/ApiVersioningService');
const MockServerService = require('../services/MockServerService');
const { authenticateJWT } = require('../middleware/auth');

// Create a new API version
router.post('/collections/:collectionId/versions', authenticateJWT, async (req, res) => {
    try {
        const { collectionId } = req.params;
        const userId = req.user.id;
        const versionData = req.body;

        const apiVersion = await ApiVersioningService.createVersion(collectionId, versionData, userId);

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

        const comparison = await ApiVersioningService.compareVersions(version1Id, version2Id);

        res.json(comparison);
    } catch (error) {
        console.error('Error comparing API versions:', error);
        res.status(500).json({
            message: error.message || 'Failed to compare API versions'
        });
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
