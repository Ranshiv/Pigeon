// routes/mockServers.js
const express = require('express');
const router = express.Router();
const MockServerService = require('../services/MockServerService');
const StateManager = require('../services/StateManager');
const TrafficRecorder = require('../services/TrafficRecorder');
const MockAnalyticsService = require('../services/MockAnalyticsService');
const { authenticateJWT } = require('../middleware/auth');

// =====================
// STATIC ROUTES (must come BEFORE parameterized routes)
// =====================

// Test endpoint to verify mock routes are working
router.get('/test-route', (req, res) => {
    res.json({ success: true, message: 'Mock server routes are working!' });
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

// =====================
// PARAMETERIZED ROUTES
// =====================

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

// Handle OPTIONS preflight requests for simulate endpoint
router.options('/:mockServerId/simulate/*', (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).send();
});

// Handle mock requests (this endpoint simulates API responses)
// NOTE: This endpoint does NOT require authentication so it can be used by external clients
router.all('/:mockServerId/simulate/*', async (req, res) => {
    try {
        const { mockServerId } = req.params;
        const path = '/' + req.params[0]; // Get the path after /simulate/
        const method = req.method;
        const query = req.query;
        const body = req.body;
        const headers = req.headers;

        console.log(`[Mock Request] ${method} ${path} for server ${mockServerId}`);

        const response = await MockServerService.handleMockRequest(
            mockServerId,
            path,
            method,
            query,
            body,
            headers
        );

        // Set CORS headers to allow access from anywhere
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        // Set response headers from mock configuration
        if (response.headers) {
            Object.entries(response.headers).forEach(([key, value]) => {
                res.set(key, value);
            });
        }

        console.log('[Mock Route] Sending response body:', JSON.stringify(response.body));
        res.status(response.status).json(response.body);
    } catch (error) {
        console.error('Error handling mock request:', error);
        console.error('Error type:', typeof error);
        console.error('Error constructor:', error?.constructor?.name);
        console.error('Error message:', error?.message);
        console.error('Error stack:', error?.stack);
        console.error('Error JSON:', JSON.stringify(error));
        res.status(500).json({
            error: String(error?.message || 'Mock server error'),
            message: String(error?.message || error || 'Unknown error')
        });
    }
});

// =====================
// SCENARIO MANAGEMENT
// =====================

// Create a new scenario
router.post('/:mockServerId/scenarios', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId } = req.params;
        const scenarioData = req.body;

        const mockServer = await MockServerService.addScenario(mockServerId, scenarioData);

        res.status(201).json({
            message: 'Scenario created successfully',
            scenarios: mockServer.scenarios
        });
    } catch (error) {
        console.error('Error creating scenario:', error);
        res.status(400).json({
            message: error.message || 'Failed to create scenario'
        });
    }
});

// Get all scenarios for a mock server
router.get('/:mockServerId/scenarios', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId } = req.params;

        const mockServer = await MockServerService.getMockServer(mockServerId);

        res.json({
            scenarios: mockServer.scenarios || [],
            total: (mockServer.scenarios || []).length
        });
    } catch (error) {
        console.error('Error getting scenarios:', error);
        res.status(404).json({
            message: error.message || 'Mock server not found'
        });
    }
});

// Update a scenario
router.put('/:mockServerId/scenarios/:scenarioId', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId, scenarioId } = req.params;
        const scenarioData = req.body;

        const mockServer = await MockServerService.updateScenario(mockServerId, scenarioId, scenarioData);

        res.json({
            message: 'Scenario updated successfully',
            scenarios: mockServer.scenarios
        });
    } catch (error) {
        console.error('Error updating scenario:', error);
        res.status(400).json({
            message: error.message || 'Failed to update scenario'
        });
    }
});

// Delete a scenario
router.delete('/:mockServerId/scenarios/:scenarioId', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId, scenarioId } = req.params;

        const mockServer = await MockServerService.deleteScenario(mockServerId, scenarioId);

        res.json({
            message: 'Scenario deleted successfully',
            scenarios: mockServer.scenarios
        });
    } catch (error) {
        console.error('Error deleting scenario:', error);
        res.status(400).json({
            message: error.message || 'Failed to delete scenario'
        });
    }
});

// Toggle scenario enabled status
router.patch('/:mockServerId/scenarios/:scenarioId/toggle', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId, scenarioId } = req.params;

        const mockServer = await MockServerService.toggleScenario(mockServerId, scenarioId);

        res.json({
            message: 'Scenario toggled successfully',
            scenarios: mockServer.scenarios
        });
    } catch (error) {
        console.error('Error toggling scenario:', error);
        res.status(400).json({
            message: error.message || 'Failed to toggle scenario'
        });
    }
});

// Reorder scenarios
router.put('/:mockServerId/scenarios/reorder', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId } = req.params;
        const { scenarioIds } = req.body;

        const mockServer = await MockServerService.reorderScenarios(mockServerId, scenarioIds);

        res.json({
            message: 'Scenarios reordered successfully',
            scenarios: mockServer.scenarios
        });
    } catch (error) {
        console.error('Error reordering scenarios:', error);
        res.status(400).json({
            message: error.message || 'Failed to reorder scenarios'
        });
    }
});

// =====================
// STATE MANAGEMENT
// =====================

// Get current state
router.get('/:mockServerId/state', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId } = req.params;

        const state = await StateManager.getState(mockServerId);

        res.json(state);
    } catch (error) {
        console.error('Error getting state:', error);
        res.status(400).json({
            message: error.message || 'Failed to get state'
        });
    }
});

// Reset state
router.post('/:mockServerId/state/reset', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId } = req.params;

        const result = await StateManager.resetState(mockServerId);

        res.json(result);
    } catch (error) {
        console.error('Error resetting state:', error);
        res.status(400).json({
            message: error.message || 'Failed to reset state'
        });
    }
});

// Set a variable
router.post('/:mockServerId/state/variables', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId } = req.params;
        const { key, value, ttl } = req.body;

        const result = await StateManager.setVariable(mockServerId, key, value, ttl);

        res.json(result);
    } catch (error) {
        console.error('Error setting variable:', error);
        res.status(400).json({
            message: error.message || 'Failed to set variable'
        });
    }
});

// Get a variable
router.get('/:mockServerId/state/variables/:key', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId, key } = req.params;

        const result = await StateManager.getVariable(mockServerId, key);

        res.json(result);
    } catch (error) {
        console.error('Error getting variable:', error);
        res.status(400).json({
            message: error.message || 'Failed to get variable'
        });
    }
});

// Delete a variable
router.delete('/:mockServerId/state/variables/:key', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId, key } = req.params;

        const result = await StateManager.deleteVariable(mockServerId, key);

        res.json(result);
    } catch (error) {
        console.error('Error deleting variable:', error);
        res.status(400).json({
            message: error.message || 'Failed to delete variable'
        });
    }
});

// Create/Set counter with initial value
router.post('/:mockServerId/state/counters', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId } = req.params;
        const { name, initialValue = 0 } = req.body;

        if (!name) {
            return res.status(400).json({ message: 'Counter name is required' });
        }

        const result = await StateManager.setCounter(mockServerId, name, initialValue);

        res.status(201).json(result);
    } catch (error) {
        console.error('Error creating counter:', error);
        res.status(400).json({
            message: error.message || 'Failed to create counter'
        });
    }
});

// Delete counter
router.delete('/:mockServerId/state/counters/:key', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId, key } = req.params;

        const result = await StateManager.deleteCounter(mockServerId, key);

        res.json(result);
    } catch (error) {
        console.error('Error deleting counter:', error);
        res.status(400).json({
            message: error.message || 'Failed to delete counter'
        });
    }
});

// Increment counter
router.post('/:mockServerId/state/counters/:key/increment', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId, key } = req.params;
        const { amount = 1 } = req.body;

        const result = await StateManager.incrementCounter(mockServerId, key, amount);

        res.json(result);
    } catch (error) {
        console.error('Error incrementing counter:', error);
        res.status(400).json({
            message: error.message || 'Failed to increment counter'
        });
    }
});

// Decrement counter
router.post('/:mockServerId/state/counters/:key/decrement', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId, key } = req.params;
        const { amount = 1 } = req.body;

        const result = await StateManager.decrementCounter(mockServerId, key, amount);

        res.json(result);
    } catch (error) {
        console.error('Error decrementing counter:', error);
        res.status(400).json({
            message: error.message || 'Failed to decrement counter'
        });
    }
});

// Get counter value
router.get('/:mockServerId/state/counters/:key', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId, key } = req.params;

        const result = await StateManager.getCounter(mockServerId, key);

        res.json(result);
    } catch (error) {
        console.error('Error getting counter:', error);
        res.status(400).json({
            message: error.message || 'Failed to get counter'
        });
    }
});

// Reset a specific counter
router.post('/:mockServerId/state/counters/:key/reset', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId, key } = req.params;

        const result = await StateManager.resetCounter(mockServerId, key);

        res.json(result);
    } catch (error) {
        console.error('Error resetting counter:', error);
        res.status(400).json({
            message: error.message || 'Failed to reset counter'
        });
    }
});

// Create session
router.post('/:mockServerId/state/sessions', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId } = req.params;
        const { sessionId, data, ttl } = req.body;

        const result = await StateManager.createSession(mockServerId, sessionId, data, ttl);

        res.status(201).json(result);
    } catch (error) {
        console.error('Error creating session:', error);
        res.status(400).json({
            message: error.message || 'Failed to create session'
        });
    }
});

// Get session
router.get('/:mockServerId/state/sessions/:sessionId', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId, sessionId } = req.params;

        const result = await StateManager.getSession(mockServerId, sessionId);

        res.json(result);
    } catch (error) {
        console.error('Error getting session:', error);
        res.status(404).json({
            message: error.message || 'Session not found'
        });
    }
});

// Update session
router.put('/:mockServerId/state/sessions/:sessionId', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId, sessionId } = req.params;
        const { data, extendTtl } = req.body;

        const result = await StateManager.updateSession(mockServerId, sessionId, data, extendTtl);

        res.json(result);
    } catch (error) {
        console.error('Error updating session:', error);
        res.status(400).json({
            message: error.message || 'Failed to update session'
        });
    }
});

// Delete session
router.delete('/:mockServerId/state/sessions/:sessionId', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId, sessionId } = req.params;

        const result = await StateManager.deleteSession(mockServerId, sessionId);

        res.json(result);
    } catch (error) {
        console.error('Error deleting session:', error);
        res.status(400).json({
            message: error.message || 'Failed to delete session'
        });
    }
});

// =====================
// TRAFFIC RECORDING
// =====================

// Start recording
router.post('/:mockServerId/recording/start', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId } = req.params;
        const { name, ...options } = req.body;
        const userId = req.user.id;

        const result = await TrafficRecorder.startRecording(mockServerId, userId, { name, ...options });

        res.status(201).json(result);
    } catch (error) {
        console.error('Error starting recording:', error);
        res.status(400).json({
            message: error.message || 'Failed to start recording'
        });
    }
});

// Stop recording
router.post('/:mockServerId/recording/stop', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId } = req.params;
        const { force } = req.body;

        const result = await TrafficRecorder.stopRecording(mockServerId, force);

        res.json(result);
    } catch (error) {
        console.error('Error stopping recording:', error);
        res.status(400).json({
            message: error.message || 'Failed to stop recording'
        });
    }
});

// Force clear recording state (for fixing stuck recordings)
router.post('/:mockServerId/recording/clear', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId } = req.params;

        const result = await TrafficRecorder.stopRecording(mockServerId, true);

        res.json({ message: 'Recording state cleared', ...result });
    } catch (error) {
        console.error('Error clearing recording state:', error);
        res.status(400).json({
            message: error.message || 'Failed to clear recording state'
        });
    }
});

// Get recording status
router.get('/:mockServerId/recording/status', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId } = req.params;

        const status = await TrafficRecorder.getRecordingStatus(mockServerId);

        res.json(status);
    } catch (error) {
        console.error('Error getting recording status:', error);
        res.status(400).json({
            message: error.message || 'Failed to get recording status'
        });
    }
});

// Get all recordings
router.get('/:mockServerId/recordings', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId } = req.params;
        const { limit = 20, skip = 0, status } = req.query;

        const recordings = await TrafficRecorder.getRecordings(mockServerId, {
            limit: parseInt(limit),
            skip: parseInt(skip),
            status
        });

        // Also get active recording status
        const recordingStatus = await TrafficRecorder.getRecordingStatus(mockServerId);

        res.json({
            ...recordings,
            activeRecording: recordingStatus.isRecording ? recordingStatus : null
        });
    } catch (error) {
        console.error('Error getting recordings:', error);
        res.status(400).json({
            message: error.message || 'Failed to get recordings'
        });
    }
});

// Get a specific recording
router.get('/:mockServerId/recordings/:recordingId', authenticateJWT, async (req, res) => {
    try {
        const { recordingId } = req.params;

        const recording = await TrafficRecorder.getRecording(recordingId);

        res.json(recording);
    } catch (error) {
        console.error('Error getting recording:', error);
        res.status(404).json({
            message: error.message || 'Recording not found'
        });
    }
});

// Delete a recording
router.delete('/:mockServerId/recordings/:recordingId', authenticateJWT, async (req, res) => {
    try {
        const { recordingId } = req.params;

        const result = await TrafficRecorder.deleteRecording(recordingId);

        res.json(result);
    } catch (error) {
        console.error('Error deleting recording:', error);
        res.status(400).json({
            message: error.message || 'Failed to delete recording'
        });
    }
});

// Replay a recording
router.post('/:mockServerId/recordings/:recordingId/replay', authenticateJWT, async (req, res) => {
    try {
        const { recordingId } = req.params;
        const { options } = req.body;

        const result = await TrafficRecorder.replayRecording(recordingId, options);

        res.json(result);
    } catch (error) {
        console.error('Error replaying recording:', error);
        res.status(400).json({
            message: error.message || 'Failed to replay recording'
        });
    }
});

// Export recording as HAR
router.get('/:mockServerId/recordings/:recordingId/export', authenticateJWT, async (req, res) => {
    try {
        const { recordingId } = req.params;

        const har = await TrafficRecorder.exportToHAR(recordingId);

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="recording-${recordingId}.har"`);
        res.json(har);
    } catch (error) {
        console.error('Error exporting recording:', error);
        res.status(400).json({
            message: error.message || 'Failed to export recording'
        });
    }
});

// Import HAR file
router.post('/:mockServerId/recordings/import', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId } = req.params;
        const { harData, name } = req.body;
        const userId = req.user.id;

        const result = await TrafficRecorder.importHAR(mockServerId, harData, name, userId);

        res.status(201).json(result);
    } catch (error) {
        console.error('Error importing HAR:', error);
        res.status(400).json({
            message: error.message || 'Failed to import HAR file'
        });
    }
});

// Convert recording to scenarios
router.post('/:mockServerId/recordings/:recordingId/to-scenarios', authenticateJWT, async (req, res) => {
    try {
        const { recordingId } = req.params;
        const { options } = req.body;

        const result = await TrafficRecorder.convertToScenarios(recordingId, options);

        res.json(result);
    } catch (error) {
        console.error('Error converting recording to scenarios:', error);
        res.status(400).json({
            message: error.message || 'Failed to convert recording to scenarios'
        });
    }
});

// =====================
// ANALYTICS
// =====================

// Get analytics summary
router.get('/:mockServerId/analytics', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId } = req.params;
        const { hours } = req.query;

        const analytics = await MockAnalyticsService.getAnalyticsSummary(
            mockServerId,
            hours ? parseInt(hours) : null
        );

        res.json(analytics);
    } catch (error) {
        console.error('Error getting analytics:', error);
        res.status(400).json({
            message: error.message || 'Failed to get analytics'
        });
    }
});

// Get endpoint metrics
router.get('/:mockServerId/analytics/endpoints', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId } = req.params;

        const metrics = await MockAnalyticsService.getEndpointMetrics(mockServerId);

        res.json(metrics);
    } catch (error) {
        console.error('Error getting endpoint metrics:', error);
        res.status(400).json({
            message: error.message || 'Failed to get endpoint metrics'
        });
    }
});

// Get scenario metrics
router.get('/:mockServerId/analytics/scenarios', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId } = req.params;

        const metrics = await MockAnalyticsService.getScenarioMetrics(mockServerId);

        res.json(metrics);
    } catch (error) {
        console.error('Error getting scenario metrics:', error);
        res.status(400).json({
            message: error.message || 'Failed to get scenario metrics'
        });
    }
});

// Get recent requests
router.get('/:mockServerId/analytics/requests', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId } = req.params;
        const { limit, method, statusCode, path, hours } = req.query;

        const requests = await MockAnalyticsService.getRecentRequests(mockServerId, {
            limit: limit ? parseInt(limit) : undefined,
            method,
            statusCode,
            path,
            hours: hours ? parseInt(hours) : undefined
        });

        res.json(requests);
    } catch (error) {
        console.error('Error getting recent requests:', error);
        res.status(400).json({
            message: error.message || 'Failed to get recent requests'
        });
    }
});

// Get time series data
router.get('/:mockServerId/analytics/timeseries', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId } = req.params;
        const { hours = 24 } = req.query;

        const data = await MockAnalyticsService.getTimeSeriesData(mockServerId, parseInt(hours));

        res.json(data);
    } catch (error) {
        console.error('Error getting time series data:', error);
        res.status(400).json({
            message: error.message || 'Failed to get time series data'
        });
    }
});

// Get response time distribution
router.get('/:mockServerId/analytics/response-times', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId } = req.params;

        const distribution = await MockAnalyticsService.getResponseTimeDistribution(mockServerId);

        res.json(distribution);
    } catch (error) {
        console.error('Error getting response time distribution:', error);
        res.status(400).json({
            message: error.message || 'Failed to get response time distribution'
        });
    }
});

// Get recent errors
router.get('/:mockServerId/analytics/errors', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId } = req.params;
        const { limit = 20 } = req.query;

        const errors = await MockAnalyticsService.getRecentErrors(mockServerId, parseInt(limit));

        res.json(errors);
    } catch (error) {
        console.error('Error getting recent errors:', error);
        res.status(400).json({
            message: error.message || 'Failed to get recent errors'
        });
    }
});

// Get top endpoints
router.get('/:mockServerId/analytics/top-endpoints', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId } = req.params;
        const { limit = 10, hours } = req.query;

        const topEndpoints = await MockAnalyticsService.getTopEndpoints(
            mockServerId,
            parseInt(limit),
            hours ? parseInt(hours) : undefined
        );

        res.json(topEndpoints);
    } catch (error) {
        console.error('Error getting top endpoints:', error);
        res.status(400).json({
            message: error.message || 'Failed to get top endpoints'
        });
    }
});

// Reset analytics
router.post('/:mockServerId/analytics/reset', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId } = req.params;

        const result = await MockAnalyticsService.resetAnalytics(mockServerId);

        res.json(result);
    } catch (error) {
        console.error('Error resetting analytics:', error);
        res.status(400).json({
            message: error.message || 'Failed to reset analytics'
        });
    }
});

// Export analytics
router.get('/:mockServerId/analytics/export', authenticateJWT, async (req, res) => {
    try {
        const { mockServerId } = req.params;

        const analytics = await MockAnalyticsService.exportAnalytics(mockServerId);

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="analytics-${mockServerId}.json"`);
        res.json(analytics);
    } catch (error) {
        console.error('Error exporting analytics:', error);
        res.status(400).json({
            message: error.message || 'Failed to export analytics'
        });
    }
});

module.exports = router;
