// routes/documentation.js
const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const Collection = require('../models/Collection');
const Request = require('../models/Request');

// Get documentation for a specific collection
router.get('/:collectionId', ensureAuthenticated, async (req, res) => {
    try {
        const collectionId = req.params.collectionId;
        const userId = req.user.id;

        console.log(`[SERVER] Getting documentation for collection ${collectionId} for user ${userId}`);

        // Find the collection and check if user has access
        const collection = await Collection.findOne({
            _id: collectionId,
            $or: [
                { userId: userId },
                { collaborators: { $elemMatch: { userId: userId } } }
            ]
        });

        if (!collection) {
            console.log('[SERVER] Collection not found or access denied');
            return res.status(404).json({ message: 'Collection not found or access denied' });
        }

        console.log('[SERVER] Collection found, checking for documentation');

        // If no documentation exists or content is empty, return empty documentation object
        // This ensures client knows documentation exists but is empty
        if (!collection.documentation || !collection.documentation.content || collection.documentation.content.trim() === '') {
            console.log('[SERVER] No documentation found or empty content, returning empty template');
            return res.json({
                title: '',
                content: '',
                collectionId: collectionId,
                isNew: true
            });
        }

        console.log('[SERVER] Returning existing documentation');
        // Return the documentation directly
        res.json(collection.documentation);
    } catch (err) {
        console.error('Error fetching documentation:', err);
        res.status(500).json({ message: 'Error fetching documentation' });
    }
});

// Update documentation for a collection
router.put('/:collectionId', ensureAuthenticated, async (req, res) => {
    try {
        const collectionId = req.params.collectionId;
        const userId = req.user.id;
        const docData = req.body;

        if (!docData) {
            return res.status(400).json({ message: 'Documentation data is required' });
        }

        // Only check if the content field exists in the request, not if it's empty
        if (docData.content === undefined && docData.documentation === undefined) {
            return res.status(400).json({ message: 'Documentation must include content field (can be empty)' });
        }

        // Find the collection and check if user has access
        const collection = await Collection.findOne({
            _id: collectionId,
            $or: [
                { userId: userId },
                { collaborators: { $elemMatch: { userId: userId, role: { $in: ['editor', 'admin'] } } } }
            ]
        });

        if (!collection) {
            return res.status(404).json({ message: 'Collection not found or you do not have permission to edit' });
        }

        // Update the documentation - support both formats with careful handling of empty content
        const documentation = {
            title: docData.title || docData.documentation?.title || `${collection.name} Documentation`,
            // Ensure content is always a string, even if empty
            content: typeof docData.content === 'string' ? docData.content :
                typeof docData.documentation?.content === 'string' ? docData.documentation.content : '',
            collectionId: collectionId,
            updatedAt: new Date()
        };

        // Update the collection with documentation
        collection.documentation = documentation;
        collection.updatedAt = new Date();
        await collection.save();

        res.json({
            ...documentation,
            message: 'Documentation updated successfully'
        });
    } catch (err) {
        console.error('Error updating documentation:', err);
        res.status(500).json({ message: 'Error updating documentation' });
    }
});

// Create new documentation for a collection
router.post('/:collectionId', ensureAuthenticated, async (req, res) => {
    try {
        const collectionId = req.params.collectionId;
        const userId = req.user.id;
        // Extract all possible fields including isNew flag
        const { title, content, isNew } = req.body;

        console.log(`Saving documentation for collection ${collectionId}`, { title, contentLength: content?.length });

        // Allow any content value, including empty strings
        // Only check if the content field exists in the request
        if (req.body.content === undefined) {
            return res.status(400).json({ message: 'Documentation content field must be included in request' });
        }

        // Find the collection and check if user has access
        const collection = await Collection.findOne({
            _id: collectionId,
            $or: [
                { userId: userId },
                { collaborators: { $elemMatch: { userId: userId, role: { $in: ['editor', 'admin'] } } } }
            ]
        });

        if (!collection) {
            return res.status(404).json({ message: 'Collection not found or you do not have permission to edit' });
        }

        // Create or update the documentation
        const docData = {
            title: title || `${collection.name} Documentation`,
            // Explicitly ensure content is a string (empty string is valid)
            content: typeof content === 'string' ? content : '',
            collectionId: collectionId,
            updatedAt: new Date(),
            // If isNew was explicitly set to false, include it
            ...(isNew === false ? { isNew: false } : {})
        };

        console.log('Server creating documentation with data:', {
            titleLength: docData.title?.length,
            contentLength: docData.content?.length,
            contentType: typeof docData.content
        });

        // Update the collection with documentation
        if (!collection.documentation) {
            collection.documentation = {};
        }

        // Update each field individually to ensure they're properly set
        collection.documentation.title = docData.title;
        collection.documentation.content = docData.content;
        collection.documentation.collectionId = docData.collectionId;
        collection.documentation.updatedAt = docData.updatedAt;

        collection.markModified('documentation'); // Mark the documentation field as modified
        collection.updatedAt = new Date();

        console.log("Saving collection with updated documentation...");
        await collection.save();
        console.log("Collection saved successfully");

        // Return the updated documentation with success message
        res.json({
            ...collection.documentation.toObject ? collection.documentation.toObject() : collection.documentation,
            message: 'Documentation saved successfully',
            isNew: false // After saving, it's never considered new
        });
    } catch (err) {
        console.error('Error creating documentation:', err);
        res.status(500).json({ message: `Error creating documentation: ${err.message}` });
    }
});

// Get request-specific documentation
router.get('/request/:requestId', ensureAuthenticated, async (req, res) => {
    try {
        const requestId = req.params.requestId;
        const userId = req.user.id;

        // Find the request with proper access control
        const request = await Request.findOne({ _id: requestId })
            .populate({
                path: 'collectionId',
                match: {
                    $or: [
                        { userId: userId },
                        { collaborators: { $elemMatch: { userId: userId } } }
                    ]
                }
            });

        if (!request || !request.collectionId) {
            return res.status(404).json({ message: 'Request not found or access denied' });
        }

        // Return the request documentation
        res.json({
            documentation: request.documentation || '',
            updatedAt: request.updatedAt
        });
    } catch (err) {
        console.error('Error fetching request documentation:', err);
        res.status(500).json({ message: 'Error fetching request documentation' });
    }
});

// Update request-specific documentation
router.put('/request/:requestId', ensureAuthenticated, async (req, res) => {
    try {
        const requestId = req.params.requestId;
        const userId = req.user.id;
        const { documentation } = req.body;

        if (documentation === undefined) {
            return res.status(400).json({ message: 'Documentation content is required' });
        }

        // Find the request with proper access control
        const request = await Request.findOne({ _id: requestId })
            .populate({
                path: 'collectionId',
                match: {
                    $or: [
                        { userId: userId },
                        { collaborators: { $elemMatch: { userId: userId, role: { $in: ['editor', 'admin'] } } } }
                    ]
                }
            });

        if (!request || !request.collectionId) {
            return res.status(404).json({ message: 'Request not found or you do not have permission to edit' });
        }

        // Update the documentation
        request.documentation = documentation;
        request.updatedAt = new Date();
        await request.save();

        res.json({
            message: 'Request documentation updated successfully',
            updatedAt: request.updatedAt
        });
    } catch (err) {
        console.error('Error updating request documentation:', err);
        res.status(500).json({ message: 'Error updating request documentation' });
    }
});

// Import OpenAPI documentation for a collection
router.post('/:collectionId/import/openapi', ensureAuthenticated, async (req, res) => {
    try {
        const collectionId = req.params.collectionId;
        const userId = req.user.id;
        const { title, content, importedFrom } = req.body;

        if (!content) {
            return res.status(400).json({ message: 'Documentation content is required' });
        }

        // Find the collection and check if user has access
        const collection = await Collection.findOne({
            _id: collectionId,
            $or: [
                { userId: userId },
                { collaborators: { $elemMatch: { userId: userId, role: { $in: ['editor', 'admin'] } } } }
            ]
        });

        if (!collection) {
            return res.status(404).json({ message: 'Collection not found or you do not have permission to edit' });
        }

        // Create or update the documentation
        const documentation = {
            title: title || `${collection.name} Documentation`,
            content,
            collectionId,
            importedFrom,
            updatedAt: new Date()
        };

        // Update the collection with documentation
        collection.documentation = documentation;
        collection.updatedAt = new Date();
        await collection.save();

        res.status(201).json(documentation);
    } catch (err) {
        console.error('Error importing OpenAPI documentation:', err);
        res.status(500).json({ message: 'Error importing OpenAPI documentation' });
    }
});

module.exports = router;