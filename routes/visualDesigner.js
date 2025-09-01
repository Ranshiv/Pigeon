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

        // Validate collectionId format
        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(collectionId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid collection ID format'
            });
        }

        // Find the collection
        let collection = await Collection.findById(collectionId);

        if (!collection) {
            // Create a new collection with the specified ID
            console.log('Creating new collection with ID:', collectionId);
            collection = new Collection({
                _id: collectionId, // Use the specific ID that was requested
                name: name || 'Visual Design Collection',
                description: description || 'Collection for visual API design',
                userId: userId,
                owner: userId,
                requests: [],
                metadata: {}
            });

            collection = await collection.save();
            console.log('✅ New collection created with requested ID:', collection._id);
        }

        // Ensure metadata object exists
        if (!collection.metadata) {
            collection.metadata = {};
        }

        // Update the collection with the designer state and spec
        collection.metadata.visualDesigner = {
            lastUpdated: new Date(),
            designerState: {
                nodes: designerState.nodes || [],
                edges: designerState.edges || [],
                viewport: designerState.viewport || { x: 0, y: 0, zoom: 1 }
            },
            openApiSpec: openApiSpec || null,
            name: name || 'Visual Design',
            description: description || 'Visual API design'
        };

        // Mark the metadata field as modified to ensure Mongoose saves it
        collection.markModified('metadata');

        console.log('💾 About to save collection:', {
            collectionId: collection._id,
            hasMetadata: !!collection.metadata,
            hasVisualDesigner: !!collection.metadata.visualDesigner,
            nodeCount: collection.metadata.visualDesigner.designerState.nodes.length,
            edgeCount: collection.metadata.visualDesigner.designerState.edges.length
        });

        const saveResult = await collection.save();

        console.log('✅ Collection save completed:', {
            savedId: saveResult._id,
            requestedId: collectionId,
            idsMatch: saveResult._id.toString() === collectionId,
            lastModified: saveResult.updatedAt,
            metadataExists: !!saveResult.metadata?.visualDesigner,
            nodeCount: saveResult.metadata?.visualDesigner?.designerState?.nodes?.length || 0
        });

        // Verify the save actually worked by querying the database
        const verifyCollection = await Collection.findById(collectionId);
        console.log('🔍 Save verification:', {
            foundAfterSave: !!verifyCollection,
            hasVisualDesigner: !!verifyCollection?.metadata?.visualDesigner,
            nodeCount: verifyCollection?.metadata?.visualDesigner?.designerState?.nodes?.length || 0
        });

        return res.status(200).json({
            success: true,
            message: 'Design saved successfully',
            data: {
                id: collection._id,
                nodeCount: collection.metadata.visualDesigner.designerState.nodes.length,
                edgeCount: collection.metadata.visualDesigner.designerState.edges.length,
                lastUpdated: collection.metadata.visualDesigner.lastUpdated
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
        const userId = req.user._id || req.user.id;

        // Validate collectionId format
        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(collectionId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid collection ID format'
            });
        }

        // Find the collection
        const collection = await Collection.findById(collectionId);

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
