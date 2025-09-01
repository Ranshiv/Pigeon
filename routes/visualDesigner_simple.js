/**
 * Simplified Visual API Designer Routes for Testing
 * Handles API endpoints for managing visual API designs
 */

const express = require('express');
const router = express.Router();

// Simplified middleware for testing
const simpleAuth = (req, res, next) => {
    req.user = { id: 'test-user', _id: 'test-user' };
    next();
};

/**
 * Simple save endpoint for testing
 * POST /api/visual-designer/designs
 */
router.post('/designs', simpleAuth, async (req, res) => {
    try {
        console.log('📝 Visual Designer Save Request:', {
            collectionId: req.body.collectionId,
            nodeCount: req.body.designerState?.nodes?.length || 0,
            edgeCount: req.body.designerState?.edges?.length || 0
        });

        const { collectionId, designerState, openApiSpec, name, description } = req.body;
        const userId = req.user._id || req.user.id;

        if (!collectionId) {
            return res.status(400).json({
                success: false,
                message: 'Collection ID is required'
            });
        }

        if (!designerState || !designerState.nodes) {
            return res.status(400).json({
                success: false,
                message: 'Designer state with nodes is required'
            });
        }

        // For now, just simulate saving to database
        // TODO: Actually save to VisualDesign model once DB connection is working

        return res.status(200).json({
            success: true,
            message: 'Design saved successfully (simulated)',
            data: {
                id: 'simulated-id',
                nodeCount: designerState.nodes?.length || 0,
                edgeCount: designerState.edges?.length || 0,
                lastUpdated: new Date()
            }
        });
    } catch (error) {
        console.error('Error saving visual design:', error);
        return res.status(500).json({
            success: false,
            message: 'Error saving design',
            error: error.message
        });
    }
});

/**
 * Simple get endpoint for testing
 * GET /api/visual-designer/designs/:collectionId
 */
router.get('/designs/:collectionId', simpleAuth, async (req, res) => {
    try {
        console.log('📖 Visual Designer Load Request:', {
            collectionId: req.params.collectionId
        });

        const { collectionId } = req.params;

        // For now, just return empty design state
        // TODO: Actually load from VisualDesign model once DB connection is working

        return res.status(200).json({
            success: true,
            data: {
                designerState: {
                    nodes: [],
                    edges: [],
                    viewport: { x: 0, y: 0, zoom: 1 }
                },
                openApiSpec: null,
                lastUpdated: null,
                name: 'Visual Design',
                description: 'Visual API design'
            }
        });
    } catch (error) {
        console.error('Error fetching visual design:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching design',
            error: error.message
        });
    }
});

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'visual-designer',
        timestamp: new Date()
    });
});

module.exports = router;
