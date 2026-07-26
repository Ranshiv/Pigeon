// routes/documentation.js
const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const Collection = require('../models/Collection');
const Request = require('../models/Request');

// Helper function to find collection with proper user access check
const findUserCollection = async (collectionId, userId, requireEdit = false) => {
    console.log(`[DEBUG] findUserCollection: collectionId=${collectionId}, userId=${userId}, requireEdit=${requireEdit}`);

    const baseQuery = {
        _id: collectionId,
        $or: [
            { userId: userId },
            { owner: userId } // Handle legacy field name
        ]
    };

    if (requireEdit) {
        baseQuery.$or.push({ collaborators: { $elemMatch: { userId: userId, role: { $in: ['editor', 'admin'] } } } });
    } else {
        baseQuery.$or.push({ collaborators: { $elemMatch: { userId: userId } } });
    }

    console.log(`[DEBUG] Query:`, JSON.stringify(baseQuery, null, 2));

    const result = await Collection.findOne(baseQuery);
    console.log(`[DEBUG] Query result:`, result ? 'Found collection' : 'No collection found');

    return result;
};

// Debug middleware to log all requests to documentation routes
router.use((req, res, next) => {
    console.log(`[DEBUG] Documentation route: ${req.method} ${req.url}`);
    console.log(`[DEBUG] Full path: ${req.baseUrl}${req.url}`);
    next();
});

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
                { owner: userId }, // Handle legacy field name
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

// Update documentation settings
router.put('/:collectionId/settings', ensureAuthenticated, async (req, res) => {
    try {
        console.log(`[DEBUG] PUT /documentation/${req.params.collectionId}/settings called`);
        console.log('[DEBUG] Request body:', req.body);
        console.log('[DEBUG] User ID:', req.user?.id);

        const collectionId = req.params.collectionId;
        const userId = req.user.id;
        const settingsData = req.body;

        if (!settingsData) {
            return res.status(400).json({ message: 'Settings data is required' });
        }

        // Find the collection and check if user has access
        const collection = await findUserCollection(collectionId, userId, true);

        if (!collection) {
            return res.status(404).json({ message: 'Collection not found or you do not have permission to edit' });
        }

        // Initialize documentation if it doesn't exist
        if (!collection.documentation) {
            collection.documentation = {};
        }

        // Update documentation settings
        collection.documentation.isPublic = settingsData.isPublic;
        collection.documentation.metaTitle = settingsData.metaTitle;
        collection.documentation.metaDescription = settingsData.metaDescription;
        collection.documentation.customDomain = settingsData.customDomain;
        collection.documentation.allowComments = settingsData.allowComments;
        collection.documentation.showLastUpdated = settingsData.showLastUpdated;
        collection.documentation.enableSearch = settingsData.enableSearch;
        collection.documentation.theme = settingsData.theme || 'default';

        // Handle displayOptions as a nested object
        if (settingsData.displayOptions) {
            collection.documentation.displayOptions = settingsData.displayOptions;
        }

        // Update timestamps
        collection.documentation.updatedAt = new Date();
        collection.updatedAt = new Date();

        await collection.save();

        res.json({
            message: 'Documentation settings updated successfully',
            documentation: collection.documentation
        });
    } catch (err) {
        console.error('Error updating documentation settings:', err);
        res.status(500).json({ message: 'Error updating documentation settings' });
    }
});

// ------------------------------------------------------------------- AsyncAPI

/**
 * POST /documentation/asyncapi/:documentId
 * Generates a readable markdown doc from an AsyncAPI document and (when a
 * target collectionId is provided) saves it under that collection's
 * documentation object — mirroring the import/openapi handler's save pattern.
 * Access check: workspace owner/collaborator via the document's workspaceId.
 */
router.post('/asyncapi/:documentId', ensureAuthenticated, async (req, res) => {
    try {
        const AsyncApiDocument = require('../models/AsyncApiDocument');
        const Workspace = require('../models/Workspace');
        const mongoose = require('mongoose');

        const doc = await AsyncApiDocument.findById(req.params.documentId);
        if (!doc) return res.status(404).json({ message: 'AsyncAPI document not found' });

        const wsId = doc.workspaceId;
        const userId = req.user.id;
        const userOid = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null;
        const ids = userOid ? [userId, userOid] : [userId];
        const ws = await Workspace.findOne({
            _id: wsId,
            $or: [{ owner: { $in: ids } }, { userId: { $in: ids } }, { 'collaborators.userId': { $in: ids } }]
        }).select('_id');
        if (!ws) return res.status(403).json({ message: 'You do not have access to this workspace' });

        const content = generateAsyncApiMarkdown(doc);

        // Optional target collection — mirror the import/openapi save pattern.
        const collectionId = req.body?.collectionId;
        let savedDocumentation = null;
        if (collectionId) {
            const collection = await Collection.findOne({
                _id: collectionId,
                $or: [
                    { userId },
                    { owner: userId },
                    { collaborators: { $elemMatch: { userId, role: { $in: ['editor', 'admin'] } } } }
                ]
            });
            if (!collection) return res.status(404).json({ message: 'Collection not found or no edit permission' });
            const documentation = {
                title: req.body?.title || `${doc.name} (AsyncAPI)`,
                content,
                collectionId,
                importedFrom: 'asyncapi',
                updatedAt: new Date()
            };
            collection.documentation = documentation;
            collection.updatedAt = new Date();
            await collection.save();
            savedDocumentation = documentation;
            res.status(201).json({ documentation: savedDocumentation, content });
        } else {
            // No target collection: just return the generated markdown so the
            // UI can show it / hand off to the Documentation section.
            res.status(200).json({ documentation: { title: `${doc.name} (AsyncAPI)`, content, importedFrom: 'asyncapi' }, content });
        }
    } catch (err) {
        console.error('Error generating AsyncAPI documentation:', err);
        res.status(500).json({ message: 'Error generating AsyncAPI documentation' });
    }
});

function escapeMd(text) {
    return String(text || '').replace(/[\n]+/g, ' ').trim();
}

function generateAsyncApiMarkdown(doc) {
    const lines = [];
    lines.push(`# ${doc.name || 'Untitled AsyncAPI'}`);
    lines.push('');
    lines.push(`**AsyncAPI version:** ${doc.asyncApiVersion || '2.6.0'}  `);
    lines.push(`**Document version:** ${doc.version || '1.0.0'}  `);
    if (doc.description) lines.push(`  \n${doc.description}`);
    if (Array.isArray(doc.tags) && doc.tags.length) {
        lines.push(`  \n**Tags:** ${doc.tags.map((t) => `\`${t}\``).join(', ')}`);
    }
    lines.push('');
    lines.push('## Servers');
    if (Array.isArray(doc.servers) && doc.servers.length) {
        lines.push('| Name | URL | Protocol | Security |');
        lines.push('|------|-----|----------|----------|');
        for (const s of doc.servers) {
            lines.push(`| ${escapeMd(s.name)} | \`${escapeMd(s.url)}\` | ${escapeMd(s.protocol)} |${s.security ? ` ${escapeMd(s.security)}` : ' —'} |`);
        }
    } else {
        lines.push('_No servers defined._');
    }
    lines.push('');
    lines.push('## Channels');
    if (Array.isArray(doc.channels) && doc.channels.length) {
        for (const c of doc.channels) {
            lines.push(`### \`${c.address || c.name || ''}\``);
            if (c.description) lines.push(c.description);
            const ops = (doc.operations || []).filter((o) => o.channelName === c.name || o.channelName === c.address);
            if (ops.length) {
                lines.push('');
                lines.push('**Operations:**');
                for (const op of ops) {
                    lines.push(`- **${op.action}**${op.messageName ? ` → message \`${op.messageName}\`` : ''}${op.summary ? ` — ${op.summary}` : ''}`);
                }
            }
            lines.push('');
        }
    } else {
        lines.push('_No channels defined._');
    }
    lines.push('## Messages');
    if (Array.isArray(doc.messages) && doc.messages.length) {
        for (const m of doc.messages) {
            lines.push(`### \`${m.name}\``);
            if (m.title) lines.push(`**Title:** ${m.title}  `);
            if (m.description) lines.push(`  \n${m.description}`);
            lines.push(`  \n**Content-Type:** ${m.contentType || 'application/json'}`);
            if (m.payloadSchema && Object.keys(m.payloadSchema).length) {
                lines.push('  \n**Payload schema:**');
                lines.push('```json');
                lines.push(JSON.stringify(m.payloadSchema, null, 2));
                lines.push('```');
            }
            if (m.payloadExample) {
                lines.push('  \n**Payload example:**');
                lines.push('```json');
                lines.push(m.payloadExample);
                lines.push('```');
            }
            lines.push('');
        }
    } else {
        lines.push('_No messages defined._');
    }
    if (Array.isArray(doc.importWarnings) && doc.importWarnings.length) {
        lines.push('## Import notes');
        for (const w of doc.importWarnings) lines.push(`- ${w}`);
    }
    return lines.join('\n');
}

module.exports = router;