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
        console.log('📝 Visual Designer Save Request:', {
            collectionId: req.body.collectionId,
            nodeCount: req.body.designerState?.nodes?.length || 0,
            edgeCount: req.body.designerState?.edges?.length || 0,
            userId: req.user?._id || req.user?.id
        });

        const { collectionId, designerState, openApiSpec, arazzoWorkflow, name, description } = req.body;

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

        // Validate collectionId format
        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(collectionId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid collection ID format'
            });
        }

        // Read only the persisted designer state. Loading and saving the complete
        // collection would revalidate every embedded request, including legacy
        // request records unrelated to the visual design.
        const collection = await Collection.findById(collectionId)
            .select({ metadata: 1 })
            .lean();

        if (!collection) {
            return res.status(404).json({
                success: false,
                message: 'Collection not found'
            });
        }

        const visualDesigner = {
            lastUpdated: new Date(),
            designerState: {
                nodes: designerState.nodes || [],
                edges: designerState.edges || [],
                viewport: designerState.viewport || { x: 0, y: 0, zoom: 1 }
            },
            openApiSpec: openApiSpec || null,
            arazzoWorkflow: Object.prototype.hasOwnProperty.call(req.body, 'arazzoWorkflow')
                ? arazzoWorkflow
                : collection.metadata?.visualDesigner?.arazzoWorkflow || null,
            name: name || 'Visual Design',
            description: description || 'Visual API design'
        };

        console.log('💾 Updating visual design only:', {
            collectionId: collection._id,
            nodeCount: visualDesigner.designerState.nodes.length,
            edgeCount: visualDesigner.designerState.edges.length
        });

        const updateResult = await Collection.updateOne(
            { _id: collectionId },
            { $set: { 'metadata.visualDesigner': visualDesigner } },
            { runValidators: false }
        );

        if (updateResult.matchedCount !== 1) {
            return res.status(404).json({ success: false, message: 'Collection not found' });
        }

        return res.status(200).json({
            success: true,
            message: 'Design saved successfully',
            data: {
                id: collection._id,
                nodeCount: visualDesigner.designerState.nodes.length,
                edgeCount: visualDesigner.designerState.edges.length,
                lastUpdated: visualDesigner.lastUpdated
            }
        });
    } catch (error) {
        console.error('❌ Error saving visual design:', error);
        return res.status(500).json({
            success: false,
            message: 'Error saving design',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * Get a visual design for a collection
 * GET /api/visual-designer/designs/:collectionId
 */
router.get('/designs/:collectionId', authenticateJWT, async (req, res) => {
    try {
        console.log('📖 Visual Designer Load Request:', {
            collectionId: req.params.collectionId,
            userId: req.user?._id || req.user?.id
        });

        const { collectionId } = req.params;

        // Validate collectionId format
        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(collectionId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid collection ID format'
            });
        }

        // Find the collection
        const collection = await Collection.findById(collectionId)
            .select({ metadata: 1 })
            .lean();

        console.log('🔍 Collection lookup result:', {
            found: !!collection,
            id: collection?._id,
            hasMetadata: !!collection?.metadata,
            hasVisualDesigner: !!collection?.metadata?.visualDesigner,
            nodeCount: collection?.metadata?.visualDesigner?.designerState?.nodes?.length || 0
        });

        if (!collection) {
            // Return empty design state if collection not found
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
        }

        // Return the designer state
        const visualDesigner = collection.metadata?.visualDesigner || {
            designerState: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
            openApiSpec: null,
            arazzoWorkflow: null,
            lastUpdated: null,
            name: 'Visual Design',
            description: 'Visual API design'
        };

        console.log('✅ Visual design loaded successfully:', {
            nodeCount: visualDesigner.designerState?.nodes?.length || 0,
            edgeCount: visualDesigner.designerState?.edges?.length || 0,
            lastUpdated: visualDesigner.lastUpdated
        });

        return res.status(200).json({
            success: true,
            data: visualDesigner
        });
    } catch (error) {
        console.error('❌ Error fetching visual design:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching design',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
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

/**
 * Debug endpoint to check database state
 */
router.get('/debug/:collectionId', authenticateJWT, async (req, res) => {
    try {
        const { collectionId } = req.params;
        console.log('🔧 Debug request for collection:', collectionId);

        const collection = await Collection.findById(collectionId);

        if (!collection) {
            return res.json({
                debug: true,
                found: false,
                collectionId,
                message: 'Collection not found in database'
            });
        }

        const debugInfo = {
            debug: true,
            found: true,
            collectionId: collection._id,
            collectionName: collection.name,
            hasMetadata: !!collection.metadata,
            hasVisualDesigner: !!collection.metadata?.visualDesigner,
            visualDesignerData: collection.metadata?.visualDesigner || null,
            lastUpdated: collection.updatedAt,
            createdAt: collection.createdAt
        };

        console.log('🔧 Debug info:', debugInfo);

        res.json(debugInfo);
    } catch (error) {
        console.error('🔧 Debug error:', error);
        res.status(500).json({
            debug: true,
            error: error.message,
            stack: error.stack
        });
    }
});

module.exports = router;
