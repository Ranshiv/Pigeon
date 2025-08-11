/**
 * Visual API Designer Routes
 * Handles API endpoints for managing visual API designs
 */

const express = require('express');
const router = express.Router();
const { authenticateJWT, ensureAuthenticated } = require('../middleware/auth');
const Collection = require('../models/Collection');

/**
 * Save a visual design for a collection
 * POST /api/visual-designer/designs
 */
router.post('/designs', authenticateJWT, async (req, res) => {
    try {
        const { collectionId, designerState, openApiSpec } = req.body;

        if (!collectionId) {
            return res.status(400).json({
                success: false,
                message: 'Collection ID is required'
            });
        }

        // Find the collection
        const collection = await Collection.findById(collectionId);
        if (!collection) {
            return res.status(404).json({
                success: false,
                message: 'Collection not found'
            });
        }

        // Update the collection with the designer state and spec
        collection.metadata = collection.metadata || {};
        collection.metadata.visualDesigner = {
            lastUpdated: new Date(),
            designerState,
            openApiSpec
        };

        await collection.save();

        return res.status(200).json({
            success: true,
            message: 'Design saved successfully'
        });
    } catch (error) {
        console.error('Error saving visual design:', error);
        return res.status(500).json({
            success: false,
            message: 'Error saving design'
        });
    }
});

/**
 * Get a visual design for a collection
 * GET /api/visual-designer/designs/:collectionId
 */
router.get('/designs/:collectionId', authenticateJWT, async (req, res) => {
    try {
        const { collectionId } = req.params;

        // Find the collection
        const collection = await Collection.findById(collectionId);
        if (!collection) {
            return res.status(404).json({
                success: false,
                message: 'Collection not found'
            });
        }

        // Return the designer state
        const visualDesigner = collection.metadata?.visualDesigner || {
            designerState: { nodes: [], edges: [] },
            openApiSpec: null,
            lastUpdated: null
        };

        return res.status(200).json({
            success: true,
            data: visualDesigner
        });
    } catch (error) {
        console.error('Error fetching visual design:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching design'
        });
    }
});

module.exports = router;
