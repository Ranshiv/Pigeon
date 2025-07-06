// routes/mockServers.js
const express = require('express');
const router = express.Router();
const MockServerService = require('../services/MockServerService');
const { authenticateJWT } = require('../middleware/auth');

// Create a mock server
router.post('/', authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.id;
        const mockServerData = req.body;

        const mockServer = await MockServerService.createMockServer(mockServerData, userId);

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

// Get mock server by ID
router.get('/:mockServerId', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId } = req.params;

        const mockServer = await MockServerService.getMockServer(mockServerId);

        res.json(mockServer);
    } catch (error) {
        console.error('Error getting mock server:', error);
        res.status(404).json({
            message: error.message || 'Mock server not found'
        });
    }
});

// Update mock server
router.put('/:mockServerId', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId } = req.params;
        const userId = req.user.id;
        const updateData = req.body;

        const mockServer = await MockServerService.updateMockServer(mockServerId, updateData, userId);

        res.json({
            message: 'Mock server updated successfully',
            mockServer
        });
    } catch (error) {
        console.error('Error updating mock server:', error);
        res.status(400).json({
            message: error.message || 'Failed to update mock server'
        });
    }
});

// Update or add mock endpoint
router.put('/:mockServerId/endpoints', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId } = req.params;
        const userId = req.user.id;
        const endpointData = req.body;

        const mockServer = await MockServerService.updateMockEndpoint(mockServerId, endpointData, userId);

        res.json({
            message: 'Mock endpoint updated successfully',
            mockServer
        });
    } catch (error) {
        console.error('Error updating mock endpoint:', error);
        res.status(400).json({
            message: error.message || 'Failed to update mock endpoint'
        });
    }
});

// Delete mock server
router.delete('/:mockServerId', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId } = req.params;
        const userId = req.user.id;

        await MockServerService.deleteMockServer(mockServerId, userId);

        res.json({
            message: 'Mock server deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting mock server:', error);
        res.status(400).json({
            message: error.message || 'Failed to delete mock server'
        });
    }
});

// Handle mock requests (this endpoint simulates API responses)
router.all('/:mockServerId/simulate/*', async (req, res) => {
    try {
        const { mockServerId } = req.params;
        const path = '/' + req.params[0]; // Get the path after /simulate/
        const method = req.method;
        const query = req.query;
        const body = req.body;
        const headers = req.headers;

        const response = await MockServerService.handleMockRequest(
            mockServerId,
            path,
            method,
            query,
            body,
            headers
        );

        // Set response headers
        Object.entries(response.headers).forEach(([key, value]) => {
            res.set(key, value);
        });

        res.status(response.status).json(response.body);
    } catch (error) {
        console.error('Error handling mock request:', error);
        res.status(500).json({
            error: 'Mock server error',
            message: error.message
        });
    }
});

// Generate mock endpoints from OpenAPI spec
router.post('/generate-from-spec', authenticateJWT, async (req, res) => {
    try {
        const { openApiSpec } = req.body;

        const mockEndpoints = MockServerService.generateMockEndpointsFromSpec(openApiSpec);

        res.json({
            message: 'Mock endpoints generated successfully',
            endpoints: mockEndpoints,
            total: mockEndpoints.length
        });
    } catch (error) {
        console.error('Error generating mock endpoints:', error);
        res.status(400).json({
            message: error.message || 'Failed to generate mock endpoints'
        });
    }
});

// Get mock servers for a collection and version
router.get('/collection/:collectionId/version/:versionId', authenticateJWT, async (req, res) => {
    try {
        const { collectionId, versionId } = req.params;

        const mockServers = await MockServerService.getMockServers(collectionId, versionId);

        res.json(mockServers);
    } catch (error) {
        console.error('Error getting mock servers:', error);
        res.status(404).json({
            message: error.message || 'Mock servers not found'
        });
    }
});

// Get all mock servers for a collection
router.get('/collection/:collectionId', authenticateJWT, async (req, res) => {
    try {
        const { collectionId } = req.params;

        const mockServers = await MockServerService.getMockServers(collectionId);

        res.json(mockServers);
    } catch (error) {
        console.error('Error getting mock servers:', error);
        res.status(404).json({
            message: error.message || 'Mock servers not found'
        });
    }
});

module.exports = router;
