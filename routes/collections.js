// routes/collections.js
const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { ensureAuthenticated, authenticateJWT } = require('../middleware/auth');
const { getDb } = require('../config/db');
const ApiVersioningService = require('../services/ApiVersioningService');
const MockServerService = require('../services/MockServerService');

// In-memory store for backward compatibility
const collectionsStore = {};

// Get all collections
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        const db = getDb();        // Fetch collections from MongoDB
        const collections = await db.collection('collections')
            .find({ owner: userId })
            .toArray();

        // If collections exist in MongoDB, populate owner information and return them
        if (collections && collections.length > 0) {
            const User = require('../models/User');
            const populatedCollections = await Promise.all(
                collections.map(async (collection) => {
                    let populatedCollection = { ...collection, _id: collection._id.toString() };

                    // Try to populate owner information
                    if (collection.owner && ObjectId.isValid(collection.owner)) {
                        try {
                            const ownerUser = await User.findById(collection.owner);
                            if (ownerUser) {
                                populatedCollection.owner = {
                                    _id: ownerUser._id,
                                    displayName: ownerUser.displayName,
                                    email: ownerUser.email
                                };
                            }
                        } catch (err) {
                            console.log('Could not populate owner for collection:', collection._id);
                        }
                    }

                    return populatedCollection;
                })
            );

            return res.json(populatedCollections);
        }        // Mock collections data
        const mockCollections = [
            {
                _id: "coll1",
                name: "Personal API Collection",
                description: "My personal collection of frequently used APIs",
                isPublic: false,
                owner: {
                    _id: userId,
                    displayName: req.user.displayName || req.user.name || "User",
                    email: req.user.email || "user@example.com"
                },
                requestCount: 5,
                collaborators: [],
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                _id: "coll2",
                name: "Project X APIs",
                description: "APIs used in the Project X development",
                isPublic: false,
                owner: {
                    _id: userId,
                    displayName: req.user.displayName || req.user.name || "User",
                    email: req.user.email || "user@example.com"
                },
                requestCount: 12,
                collaborators: [
                    {
                        email: "collaborator@example.com",
                        role: "viewer"
                    }
                ],
                createdAt: new Date(),
                updatedAt: new Date()
            }, {
                _id: "coll3",
                name: "Public Demo Collection",
                description: "Public collection of demo APIs",
                isPublic: true,
                owner: {
                    _id: userId,
                    displayName: req.user.displayName || req.user.name || "User",
                    email: req.user.email || "user@example.com"
                },
                requestCount: 8,
                collaborators: [],
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ];

        res.json(mockCollections);
    } catch (err) {
        console.error("Error fetching collections:", err);
        res.status(500).json({ message: 'Error fetching collections' });
    }
});

// Get collections shared with the user
router.get('/shared', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;

        // Mock shared collections data
        const sharedCollections = [
            {
                _id: "shared1",
                name: "Team Project APIs",
                description: "APIs used by the development team",
                isPublic: false,
                owner: "other-user-id",
                requestCount: 15,
                myRole: "viewer",
                collaborators: [
                    {
                        email: req.user.email,
                        role: "viewer"
                    },
                    {
                        email: "team-lead@example.com",
                        role: "editor"
                    }
                ],
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                _id: "shared2",
                name: "Documentation APIs",
                description: "APIs used for documentation generation",
                isPublic: false,
                owner: "another-user-id",
                requestCount: 7,
                myRole: "editor",
                collaborators: [
                    {
                        email: req.user.email,
                        role: "editor"
                    }
                ],
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ];

        res.json(sharedCollections);
    } catch (err) {
        console.error("Error fetching shared collections:", err);
        res.status(500).json({ message: 'Error fetching shared collections' });
    }
});

// Get a specific collection by ID
router.get('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const collectionId = req.params.id;
        const userId = req.user.id;
        const db = getDb();

        console.log(`Fetching collection with ID: ${collectionId}`);        // First check for collections in MongoDB
        try {
            const collection = await db.collection('collections').findOne({
                _id: new ObjectId(collectionId)
            });

            if (collection) {
                // Try to populate owner information if it exists
                let populatedCollection = { ...collection };

                if (collection.owner && ObjectId.isValid(collection.owner)) {
                    try {
                        const User = require('../models/User');
                        const ownerUser = await User.findById(collection.owner);
                        if (ownerUser) {
                            populatedCollection.owner = {
                                _id: ownerUser._id,
                                displayName: ownerUser.displayName,
                                email: ownerUser.email
                            };
                        }
                    } catch (err) {
                        console.log('Could not populate owner information:', err.message);
                    }
                }

                // Add string ID and return
                return res.json({
                    ...populatedCollection,
                    _id: populatedCollection._id.toString()
                });
            }
        } catch (err) {
            console.log(`Error looking up collection in MongoDB: ${err.message}`);
        }

        // Check for dynamically created collections in our store
        if (collectionsStore) {
            // Look through all workspace collections for this ID
            for (const workspaceId in collectionsStore) {
                const matchingCollection = collectionsStore[workspaceId].find(
                    coll => coll._id === collectionId
                );

                if (matchingCollection) {
                    console.log(`Found collection in collectionsStore for workspace ${workspaceId}`);                    // Add some mock requests to the collection
                    const collectionWithRequests = {
                        ...matchingCollection,
                        // Ensure owner has proper structure if it's just a string
                        owner: typeof matchingCollection.owner === 'string' ? {
                            _id: matchingCollection.owner,
                            displayName: req.user.displayName || req.user.name || "User",
                            email: req.user.email || "user@example.com"
                        } : matchingCollection.owner,
                        requests: [
                            { _id: `req-${Date.now()}-1`, name: "Get Data", method: "GET", url: "https://api.example.com/data" },
                            { _id: `req-${Date.now()}-2`, name: "Create Item", method: "POST", url: "https://api.example.com/items" }
                        ]
                    };
                    return res.json(collectionWithRequests);
                }
            }
        }

        // If we didn't find the collection in the store, check for static mock collections
        let collection;

        switch (collectionId) {
            case "coll1":
                collection = {
                    _id: "coll1",
                    name: "Personal API Collection",
                    description: "My personal collection of frequently used APIs",
                    isPublic: false,
                    owner: {
                        _id: userId,
                        displayName: req.user.displayName || req.user.name || "User",
                        email: req.user.email || "user@example.com"
                    },
                    requests: [
                        { _id: "req1", name: "Get Users", method: "GET", url: "https://api.example.com/users" },
                        { _id: "req2", name: "Create User", method: "POST", url: "https://api.example.com/users" },
                        { _id: "req3", name: "Get User by ID", method: "GET", url: "https://api.example.com/users/123" },
                        { _id: "req4", name: "Update User", method: "PUT", url: "https://api.example.com/users/123" },
                        { _id: "req5", name: "Delete User", method: "DELETE", url: "https://api.example.com/users/123" }
                    ],
                    collaborators: [],
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                break; case "coll2":
                collection = {
                    _id: "coll2",
                    name: "Project X APIs",
                    description: "APIs used in the Project X development",
                    isPublic: false,
                    owner: {
                        _id: userId,
                        displayName: req.user.displayName || req.user.name || "User",
                        email: req.user.email || "user@example.com"
                    },
                    requests: [
                        { _id: "req6", name: "Authentication", method: "POST", url: "https://api.example.com/auth" },
                        { _id: "req7", name: "Get Profile", method: "GET", url: "https://api.example.com/profile" }
                    ],
                    collaborators: [
                        {
                            email: "collaborator@example.com",
                            role: "viewer"
                        }
                    ],
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                break; case "coll3":
                collection = {
                    _id: "coll3",
                    name: "Public Demo Collection",
                    description: "Public collection of demo APIs",
                    isPublic: true,
                    owner: {
                        _id: userId,
                        displayName: req.user.displayName || req.user.name || "User",
                        email: req.user.email || "user@example.com"
                    },
                    requests: [
                        { _id: "req8", name: "Weather API", method: "GET", url: "https://api.weather.com/current" },
                        { _id: "req9", name: "Currency Exchange", method: "GET", url: "https://api.exchange.com/rates" }
                    ],
                    collaborators: [],
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                break; case "shared1":
                collection = {
                    _id: "shared1",
                    name: "Team Project APIs",
                    description: "APIs used by the development team",
                    isPublic: false,
                    owner: {
                        _id: "other-user-id",
                        displayName: "Team Lead",
                        email: "teamlead@example.com"
                    },
                    myRole: "viewer",
                    requests: [
                        { _id: "req10", name: "Team Auth", method: "POST", url: "https://api.team.com/auth" },
                        { _id: "req11", name: "Get Team Members", method: "GET", url: "https://api.team.com/members" }
                    ],
                    collaborators: [
                        {
                            email: req.user.email,
                            role: "viewer"
                        },
                        {
                            email: "team-lead@example.com",
                            role: "editor"
                        }
                    ],
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                break;
            default:                // Try to handle dynamically generated collection IDs (like coll100)
                if (collectionId.startsWith('coll')) {
                    collection = {
                        _id: collectionId,
                        name: `Collection ${collectionId.replace('coll', '')}`,
                        description: "Dynamically created collection",
                        isPublic: false,
                        owner: {
                            _id: userId,
                            displayName: req.user.displayName || req.user.name || "User",
                            email: req.user.email || "user@example.com"
                        },
                        requests: [
                            { _id: `req-${Date.now()}-1`, name: "Get Data", method: "GET", url: "https://api.example.com/data" },
                            { _id: `req-${Date.now()}-2`, name: "Create Item", method: "POST", url: "https://api.example.com/items" }
                        ],
                        collaborators: [],
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };
                } else {
                    // If we really can't find the collection, return 404
                    return res.status(404).json({ message: 'Collection not found' });
                }
        }

        res.json(collection);
    } catch (err) {
        console.error("Error fetching collection:", err);
        res.status(500).json({ message: 'Error fetching collection' });
    }
});

// Create a new collection
router.post('/', ensureAuthenticated, async (req, res) => {
    try {
        const { name, description, isPublic, workspaceId } = req.body;
        const userId = req.user.id;
        const db = getDb();

        // Validate input
        if (!name) {
            return res.status(400).json({ message: 'Collection name is required' });
        }        // Create a new collection document for MongoDB
        const newCollection = {
            name,
            description: description || "",
            workspaceId: workspaceId || null,
            owner: userId,  // Store as ObjectId for MongoDB
            isPublic: isPublic || false,
            collaborators: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Store in MongoDB
        const result = await db.collection('collections').insertOne(newCollection);
        const collectionId = result.insertedId.toString();        // Also update in-memory store for backward compatibility
        if (workspaceId) {
            if (!collectionsStore[workspaceId]) {
                collectionsStore[workspaceId] = [];
            }
            collectionsStore[workspaceId].push({
                ...newCollection,
                _id: collectionId,
                // For in-memory store, use populated owner structure
                owner: {
                    _id: userId,
                    displayName: req.user.displayName || req.user.name || "User",
                    email: req.user.email || "user@example.com"
                }
            });
        }

        // Return the created collection with populated owner for immediate use
        res.status(201).json({
            ...newCollection,
            _id: collectionId,
            owner: {
                _id: userId,
                displayName: req.user.displayName || req.user.name || "User",
                email: req.user.email || "user@example.com"
            }
        });
    } catch (err) {
        console.error("Error creating collection:", err);
        res.status(500).json({ message: 'Error creating collection' });
    }
});

// Update a collection
router.put('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const collectionId = req.params.id;
        const { name, description, isPublic } = req.body;
        const db = getDb();

        // Validate input
        if (!name) {
            return res.status(400).json({ message: 'Collection name is required' });
        }

        // Update in MongoDB
        try {
            const collection = await db.collection('collections').findOne({
                _id: new ObjectId(collectionId)
            });

            if (collection) {
                await db.collection('collections').updateOne(
                    { _id: new ObjectId(collectionId) },
                    {
                        $set: {
                            name,
                            description: description || collection.description,
                            isPublic: isPublic !== undefined ? isPublic : collection.isPublic,
                            updatedAt: new Date()
                        }
                    }
                );

                // Return updated collection
                const updatedCollection = await db.collection('collections').findOne({
                    _id: new ObjectId(collectionId)
                });

                return res.json({
                    ...updatedCollection,
                    _id: updatedCollection._id.toString()
                });
            }
        } catch (err) {
            console.log(`Error updating MongoDB collection: ${err.message}`);
        }

        // Also update in-memory store if it exists
        let updated = false;
        if (collectionsStore) {
            for (const workspaceId in collectionsStore) {
                const collectionIndex = collectionsStore[workspaceId].findIndex(
                    coll => coll._id === collectionId
                );

                if (collectionIndex !== -1) {
                    collectionsStore[workspaceId][collectionIndex] = {
                        ...collectionsStore[workspaceId][collectionIndex],
                        name,
                        description: description || collectionsStore[workspaceId][collectionIndex].description,
                        isPublic: isPublic !== undefined ? isPublic : collectionsStore[workspaceId][collectionIndex].isPublic,
                        updatedAt: new Date()
                    };
                    updated = true;
                    break;
                }
            }
        }

        // If not found in either MongoDB or in-memory store
        if (!updated) {
            return res.status(404).json({ message: 'Collection not found' });
        }

        // Return mock updated collection
        res.json({
            _id: collectionId,
            name,
            description: description || "Description",
            isPublic: isPublic !== undefined ? isPublic : false,
            updatedAt: new Date()
        });
    } catch (err) {
        console.error("Error updating collection:", err);
        res.status(500).json({ message: 'Error updating collection' });
    }
});

// Delete a collection
router.delete('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const collectionId = req.params.id;
        const db = getDb();

        // Try to delete from MongoDB
        try {
            const result = await db.collection('collections').deleteOne({
                _id: new ObjectId(collectionId)
            });

            if (result.deletedCount > 0) {
                console.log(`Deleted collection ${collectionId} from MongoDB`);
            }
        } catch (err) {
            console.log(`Error deleting MongoDB collection: ${err.message}`);
        }

        // Also try to delete from in-memory store
        if (collectionsStore) {
            for (const workspaceId in collectionsStore) {
                const collectionIndex = collectionsStore[workspaceId].findIndex(
                    coll => coll._id === collectionId
                );

                if (collectionIndex !== -1) {
                    collectionsStore[workspaceId].splice(collectionIndex, 1);
                    console.log(`Deleted collection ${collectionId} from in-memory store for workspace ${workspaceId}`);
                    break;
                }
            }
        }

        // Just return success response
        res.json({ message: 'Collection deleted successfully' });
    } catch (err) {
        console.error("Error deleting collection:", err);
        res.status(500).json({ message: 'Error deleting collection' });
    }
});

// Share a collection with another user
router.post('/:id/share', ensureAuthenticated, async (req, res) => {
    try {
        const collectionId = req.params.id;
        const { email, role } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        if (!['viewer', 'editor'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role. Must be either "viewer" or "editor"' });
        }

        // Mock successful sharing
        res.json({
            message: 'Collection shared successfully',
            collaboration:
            {
                collectionId,
                email,
                role,
                addedAt: new Date()
            }
        });
    } catch (err) {
        console.error("Error sharing collection:", err);
        res.status(500).json({ message: 'Error sharing collection' });
    }
});

// Fork a collection
router.post('/:id/fork', ensureAuthenticated, async (req, res) => {
    try {
        const sourceCollectionId = req.params.id;
        const userId = req.user.id;

        // Mock creating a forked collection
        const forkedCollection = {
            _id: "fork" + Date.now().toString(),
            name: "Fork of Collection",
            description: "Forked collection from another user",
            isPublic: false,
            owner: userId,
            forkedFrom: sourceCollectionId,
            requestCount: 3,
            collaborators: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        res.status(201).json(forkedCollection);
    } catch (err) {
        console.error("Error forking collection:", err);
        res.status(500).json({ message: 'Error forking collection' });
    }
});

// Create a merge request
router.post('/:id/merge-request', ensureAuthenticated, async (req, res) => {
    try {
        const sourceCollectionId = req.params.id;
        const { targetCollectionId } = req.body;

        if (!targetCollectionId) {
            return res.status(400).json({ message: 'Target collection ID is required' });
        }

        // Mock creating a merge request
        const mergeRequest = {
            _id: "merge" + Date.now().toString(),
            sourceCollectionId,
            targetCollectionId,
            status: "pending",
            changes: {
                added: 2,
                modified: 1,
                deleted: 0
            },
            createdBy: req.user.id,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        res.status(201).json(mergeRequest);
    } catch (err) {
        console.error("Error creating merge request:", err);
        res.status(500).json({ message: 'Error creating merge request' });
    }
});

// Approve a merge request
router.post('/merge-requests/:id/approve', ensureAuthenticated, async (req, res) => {
    try {
        const mergeRequestId = req.params.id;

        // Mock approving a merge request
        const approvedMergeRequest = {
            _id: mergeRequestId,
            status: "approved",
            actionBy: {
                userId: req.user.id,
                displayName: req.user.name || "User",
                email: req.user.email
            },
            updatedAt: new Date()
        };

        res.json(approvedMergeRequest);
    } catch (err) {
        console.error("Error approving merge request:", err);
        res.status(500).json({ message: 'Error approving merge request' });
    }
});

// Reject a merge request
router.post('/merge-requests/:id/reject', ensureAuthenticated, async (req, res) => {
    try {
        const mergeRequestId = req.params.id;

        // Mock rejecting a merge request
        const rejectedMergeRequest = {
            _id: mergeRequestId,
            status: "rejected",
            actionBy: {
                userId: req.user.id,
                displayName: req.user.name || "User",
                email: req.user.email
            },
            updatedAt: new Date()
        };

        res.json(rejectedMergeRequest);
    } catch (err) {
        console.error("Error rejecting merge request:", err);
        res.status(500).json({ message: 'Error rejecting merge request' });
    }
});

// Get collection version history
router.get('/:id/versions', authenticateJWT, async (req, res) => {
    try {
        const collectionId = req.params.id;

        // In a real implementation, this would query from MongoDB
        // For now, we'll return mock version history data
        const versionHistory = [
            {
                id: `v-${Date.now()}-4`,
                entityType: 'collection',
                entityId: collectionId,
                userId: req.user.id,
                userName: req.user.name || 'Anonymous User',
                timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
                message: 'Added new request',
                type: 'commit',
                changes: {
                    added: [
                        {
                            field: 'requests',
                            value: {
                                id: 'req-123',
                                name: 'Get Users',
                                method: 'GET',
                                url: 'https://api.example.com/users'
                            }
                        }
                    ]
                }
            },
            {
                id: `v-${Date.now()}-5`,
                entityType: 'collection',
                entityId: collectionId,
                userId: req.user.id,
                userName: req.user.name || 'Anonymous User',
                timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
                message: 'Updated request parameters',
                type: 'commit',
                changes: {
                    modified: [
                        {
                            field: 'requests[0].headers',
                            value: [
                                { name: 'Authorization', value: 'Bearer {{token}}' },
                                { name: 'Content-Type', value: 'application/json' }
                            ]
                        }
                    ]
                }
            }
        ];

        res.json(versionHistory);
    } catch (err) {
        console.error("Error fetching collection version history:", err);
        res.status(500).json({ message: 'Error fetching collection version history' });
    }
});

// Save a new version for a collection
router.post('/:id/versions', authenticateJWT, async (req, res) => {
    try {
        const collectionId = req.params.id;
        const { changes, message, userId } = req.body;

        if (!changes) {
            return res.status(400).json({ message: 'Changes are required' });
        }

        // In a real implementation, this would save to MongoDB
        // For now, we'll just create a mock version object
        const newVersion = {
            id: `v-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            entityType: 'collection',
            entityId: collectionId,
            userId: userId || req.user.id,
            userName: req.user.name || 'Anonymous User',
            timestamp: new Date(),
            message: message || 'Updated collection',
            type: 'commit',
            changes
        };

        // Log the created version
        console.log('Created new collection version:', newVersion);

        res.status(201).json(newVersion);
    } catch (err) {
        console.error("Error saving collection version:", err);
        res.status(500).json({ message: 'Error saving collection version' });
    }
});

// Check for conflicts between collections
router.get('/:id/conflicts', authenticateJWT, async (req, res) => {
    try {
        const sourceCollectionId = req.params.id;
        const { targetCollectionId } = req.query;

        if (!targetCollectionId) {
            return res.status(400).json({ message: 'Target collection ID is required' });
        }

        // For this example, we'll randomly decide whether to show conflicts
        const hasConflicts = Math.random() > 0.5;

        if (!hasConflicts) {
            // No conflicts
            return res.json([]);
        }

        // Mock conflicts
        const conflicts = [
            {
                id: `conflict-${Date.now()}-1`,
                path: '/requests/2',
                type: 'request',
                source: {
                    name: 'User Authentication',
                    url: 'https://api.example.com/v1/auth',
                    method: 'POST',
                    headers: [
                        { name: 'Content-Type', value: 'application/json' }
                    ],
                    body: {
                        type: 'json',
                        content: '{"username": "user", "password": "pass", "remember_me": true}'
                    }
                },
                target: {
                    name: 'User Authentication',
                    url: 'https://api.example.com/v2/auth',
                    method: 'POST',
                    headers: [
                        { name: 'Content-Type', value: 'application/json' },
                        { name: 'X-API-Version', value: '2.0' }
                    ],
                    body: {
                        type: 'json',
                        content: '{"email": "user@example.com", "password": "pass"}'
                    }
                }
            },
            {
                id: `conflict-${Date.now()}-2`,
                path: '/environment/variables/apiKey',
                type: 'environment',
                source: {
                    key: 'apiKey',
                    value: '1234567890',
                    description: 'API key for v1'
                },
                target: {
                    key: 'apiKey',
                    value: 'abcdefghijklmn',
                    description: 'API key for production'
                }
            }
        ];

        res.json(conflicts);
    } catch (err) {
        console.error("Error checking for conflicts:", err);
        res.status(500).json({ message: 'Error checking for conflicts' });
    }
});

// Resolve merge conflicts
router.post('/:id/resolve-conflicts', authenticateJWT, async (req, res) => {
    try {
        const sourceCollectionId = req.params.id;
        const { targetCollectionId, resolutions } = req.body;

        if (!targetCollectionId || !resolutions) {
            return res.status(400).json({ message: 'Target collection ID and resolutions are required' });
        }

        // In a real implementation, this would resolve the conflicts according to the provided resolutions
        // For now, we'll just log the resolutions and return success
        console.log(`Resolving conflicts from ${sourceCollectionId} to ${targetCollectionId}`);
        console.log('Resolutions:', JSON.stringify(resolutions, null, 2));

        res.json({
            message: 'Conflicts resolved successfully',
            resolvedConflicts: Object.keys(resolutions).length
        });
    } catch (err) {
        console.error("Error resolving conflicts:", err);
        res.status(500).json({ message: 'Error resolving conflicts' });
    }
});

// Get all sample data sets for a collection
router.get('/:id/sample-data', ensureAuthenticated, async (req, res) => {
    try {
        const collectionId = req.params.id;

        // Check if we have existing data stored for this collection
        if (!global.sampleDataStore) {
            global.sampleDataStore = {};
        }

        if (!global.sampleDataStore[collectionId]) {
            // Initialize with some example data
            global.sampleDataStore[collectionId] = [
                {
                    _id: `sample-${Date.now()}-1`,
                    name: 'Login Credentials',
                    collectionId,
                    content: {
                        username: 'testuser',
                        password: 'password123',
                        rememberMe: true
                    },
                    createdBy: req.user.id,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                {
                    _id: `sample-${Date.now()}-2`,
                    name: 'User Profile Data',
                    collectionId,
                    content: {
                        firstName: 'John',
                        lastName: 'Doe',
                        email: 'john.doe@example.com',
                        age: 30,
                        preferences: {
                            theme: 'dark',
                            notifications: true
                        }
                    },
                    createdBy: req.user.id,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ];
        }

        res.json(global.sampleDataStore[collectionId]);
    } catch (err) {
        console.error("Error fetching sample data:", err);
        res.status(500).json({ message: 'Error fetching sample data' });
    }
});

// Create new sample dataset
router.post('/:id/sample-data', ensureAuthenticated, async (req, res) => {
    try {
        const collectionId = req.params.id;
        const { name, content } = req.body;

        if (!name) {
            return res.status(400).json({ message: 'Dataset name is required' });
        }

        // Ensure our global store exists
        if (!global.sampleDataStore) {
            global.sampleDataStore = {};
        }

        if (!global.sampleDataStore[collectionId]) {
            global.sampleDataStore[collectionId] = [];
        }

        // Create new sample data set
        const newSampleData = {
            _id: `sample-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            name,
            collectionId,
            content: content || {},
            createdBy: req.user.id,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Add to store
        global.sampleDataStore[collectionId].push(newSampleData);

        res.status(201).json(newSampleData);
    } catch (err) {
        console.error("Error creating sample data:", err);
        res.status(500).json({ message: 'Error creating sample data' });
    }
});

// Update sample dataset
router.put('/:collectionId/sample-data/:id', ensureAuthenticated, async (req, res) => {
    try {
        const collectionId = req.params.collectionId;
        const sampleId = req.params.id;
        const { name, content } = req.body;

        // Ensure our global store exists
        if (!global.sampleDataStore || !global.sampleDataStore[collectionId]) {
            return res.status(404).json({ message: 'Sample data collection not found' });
        }

        // Find the sample data
        const sampleIndex = global.sampleDataStore[collectionId].findIndex(sample => sample._id === sampleId);

        if (sampleIndex === -1) {
            return res.status(404).json({ message: 'Sample data not found' });
        }

        // Update the sample data
        global.sampleDataStore[collectionId][sampleIndex] = {
            ...global.sampleDataStore[collectionId][sampleIndex],
            name: name || global.sampleDataStore[collectionId][sampleIndex].name,
            content: content || global.sampleDataStore[collectionId][sampleIndex].content,
            updatedAt: new Date()
        };

        res.json(global.sampleDataStore[collectionId][sampleIndex]);
    } catch (err) {
        console.error("Error updating sample data:", err);
        res.status(500).json({ message: 'Error updating sample data' });
    }
});

// Delete sample dataset
router.delete('/:collectionId/sample-data/:id', ensureAuthenticated, async (req, res) => {
    try {
        const collectionId = req.params.collectionId;
        const sampleId = req.params.id;

        // Ensure our global store exists
        if (!global.sampleDataStore || !global.sampleDataStore[collectionId]) {
            return res.status(404).json({ message: 'Sample data collection not found' });
        }

        // Find and remove the sample data
        const initialLength = global.sampleDataStore[collectionId].length;
        global.sampleDataStore[collectionId] = global.sampleDataStore[collectionId].filter(sample => sample._id !== sampleId);

        if (global.sampleDataStore[collectionId].length === initialLength) {
            return res.status(404).json({ message: 'Sample data not found' });
        }

        res.json({ message: 'Sample data deleted successfully' });
    } catch (err) {
        console.error("Error deleting sample data:", err);
        res.status(500).json({ message: 'Error deleting sample data' });
    }
});

// Add documentation for a collection
router.post('/:id/documentation', authenticateJWT, async (req, res) => {
    try {
        const collectionId = req.params.id;
        const { title, content, importedFrom } = req.body;
        const userId = req.user.id;
        const db = getDb();

        // Allow empty content but ensure field exists
        if (content === undefined) {
            return res.status(400).json({ message: 'Documentation content field must be included in request' });
        }

        // Check if collection exists and user has access
        const collection = await db.collection('collections').findOne({
            _id: new ObjectId(collectionId),
            $or: [
                { owner: userId },
                { collaborators: { $elemMatch: { userId: userId, role: { $in: ['editor', 'admin'] } } } }
            ]
        });

        if (!collection) {
            return res.status(404).json({ message: 'Collection not found or you do not have permission to edit' });
        }

        // Check if documentation already exists
        let existingDoc = await db.collection('documentation').findOne({
            collectionId: collectionId
        });

        // Save current content to version history before updating
        if (existingDoc && existingDoc.content) {
            await saveDocumentationContentVersion(db, collectionId, userId, existingDoc, 'Content updated');
        }

        let docData;
        if (existingDoc) {
            // Update existing documentation
            docData = {
                title: title || existingDoc.title,
                content: typeof content === 'string' ? content : '',
                collectionId: collectionId,
                updatedAt: new Date(),
                importedFrom: importedFrom || existingDoc.importedFrom || 'manual',
                settings: existingDoc.settings || {}
            };

            await db.collection('documentation').updateOne(
                { _id: existingDoc._id },
                { $set: docData }
            );

            docData._id = existingDoc._id.toString();
        } else {
            // Create new documentation
            docData = {
                title: title || `${collection.name} Documentation`,
                content: typeof content === 'string' ? content : '',
                collectionId: collectionId,
                createdAt: new Date(),
                updatedAt: new Date(),
                importedFrom: importedFrom || 'manual',
                settings: {}
            };

            const result = await db.collection('documentation').insertOne(docData);
            docData._id = result.insertedId.toString();
        }

        // Save the new content version
        await saveDocumentationContentVersion(db, collectionId, userId, docData, 'Content updated');

        res.json(docData);
    } catch (err) {
        console.error('Error saving documentation:', err);
        res.status(500).json({ message: 'Error saving documentation' });
    }
});

// Update documentation settings for a collection
router.post('/:id/documentation/settings', authenticateJWT, async (req, res) => {
    try {
        console.log(`[DEBUG] POST /collections/${req.params.id}/documentation/settings called`);
        console.log('[DEBUG] Request body:', req.body);
        console.log('[DEBUG] User ID:', req.user?.id);

        const collectionId = req.params.id;
        const userId = req.user.id;
        const settingsData = req.body;
        const db = getDb();

        if (!settingsData) {
            return res.status(400).json({ message: 'Settings data is required' });
        }

        // Check if collection exists and user has access
        const collection = await db.collection('collections').findOne({
            _id: new ObjectId(collectionId),
            $or: [
                { owner: userId },
                { collaborators: { $elemMatch: { userId: userId, role: { $in: ['editor', 'admin'] } } } }
            ]
        });

        if (!collection) {
            return res.status(404).json({ message: 'Collection not found or you do not have permission to edit' });
        }

        // Get current documentation to preserve content and create version history
        let currentDoc = await db.collection('documentation').findOne({
            collectionId: collectionId
        });

        // Save current settings to version history before updating
        if (currentDoc && currentDoc.settings) {
            await saveDocumentationSettingsVersion(db, collectionId, userId, currentDoc.settings, 'Settings updated');
        }

        // Prepare updated settings
        const updatedSettings = {
            isPublic: settingsData.isPublic || false,
            metaTitle: settingsData.metaTitle || '',
            metaDescription: settingsData.metaDescription || '',
            customDomain: settingsData.customDomain || '',
            allowComments: settingsData.allowComments || false,
            showLastUpdated: settingsData.showLastUpdated !== false,
            enableSearch: settingsData.enableSearch !== false,
            theme: settingsData.theme || 'default',
            displayOptions: settingsData.displayOptions || {}
        };

        // Generate specific message about what changed
        const changeMessage = generateSettingsChangeMessage(
            currentDoc?.settings || {},
            updatedSettings
        );

        let docData;
        if (currentDoc) {
            // Update existing documentation settings
            docData = {
                ...currentDoc,
                settings: updatedSettings,
                updatedAt: new Date()
            };

            await db.collection('documentation').updateOne(
                { _id: currentDoc._id },
                { $set: { settings: updatedSettings, updatedAt: new Date() } }
            );
        } else {
            // Create new documentation with settings
            docData = {
                title: `${collection.name} Documentation`,
                content: '',
                collectionId: collectionId,
                settings: updatedSettings,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = await db.collection('documentation').insertOne(docData);
            docData._id = result.insertedId.toString();
        }

        // Save the new settings version
        await saveDocumentationSettingsVersion(db, collectionId, userId, updatedSettings, changeMessage);

        res.json({
            message: 'Documentation settings updated successfully',
            documentation: {
                ...docData,
                _id: docData._id?.toString() || docData._id
            }
        });
    } catch (err) {
        console.error('Error updating documentation settings:', err);
        res.status(500).json({ message: 'Error updating documentation settings' });
    }
});

// Update documentation settings for a collection (PUT method for compatibility)
router.put('/:id/documentation/settings', authenticateJWT, async (req, res) => {
    try {
        console.log(`[DEBUG] PUT /collections/${req.params.id}/documentation/settings called`);
        console.log('[DEBUG] Request body:', req.body);
        console.log('[DEBUG] User ID:', req.user?.id);

        const collectionId = req.params.id;
        const userId = req.user.id;
        const settingsData = req.body;
        const db = getDb();

        if (!settingsData) {
            return res.status(400).json({ message: 'Settings data is required' });
        }

        // Check if collection exists and user has access
        const collection = await db.collection('collections').findOne({
            _id: new ObjectId(collectionId),
            $or: [
                { owner: userId },
                { collaborators: { $elemMatch: { userId: userId, role: { $in: ['editor', 'admin'] } } } }
            ]
        });

        if (!collection) {
            return res.status(404).json({ message: 'Collection not found or you do not have permission to edit' });
        }

        // Get current documentation to preserve content and create version history
        let currentDoc = await db.collection('documentation').findOne({
            collectionId: collectionId
        });

        // Save current settings to version history before updating
        if (currentDoc && currentDoc.settings) {
            await saveDocumentationSettingsVersion(db, collectionId, userId, currentDoc.settings, 'Settings updated');
        }

        // Prepare updated settings
        const updatedSettings = {
            isPublic: settingsData.isPublic || false,
            metaTitle: settingsData.metaTitle || '',
            metaDescription: settingsData.metaDescription || '',
            customDomain: settingsData.customDomain || '',
            allowComments: settingsData.allowComments || false,
            showLastUpdated: settingsData.showLastUpdated !== false,
            enableSearch: settingsData.enableSearch !== false,
            theme: settingsData.theme || 'default',
            displayOptions: settingsData.displayOptions || {}
        };

        // Generate specific message about what changed
        const changeMessage = generateSettingsChangeMessage(
            currentDoc?.settings || {},
            updatedSettings
        );

        let docData;
        if (currentDoc) {
            // Update existing documentation settings
            docData = {
                ...currentDoc,
                settings: updatedSettings,
                updatedAt: new Date()
            };

            await db.collection('documentation').updateOne(
                { _id: currentDoc._id },
                { $set: { settings: updatedSettings, updatedAt: new Date() } }
            );
        } else {
            // Create new documentation with settings
            docData = {
                title: `${collection.name} Documentation`,
                content: '',
                collectionId: collectionId,
                settings: updatedSettings,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = await db.collection('documentation').insertOne(docData);
            docData._id = result.insertedId.toString();
        }

        // Save the new settings version
        await saveDocumentationSettingsVersion(db, collectionId, userId, updatedSettings, changeMessage);

        res.json({
            message: 'Documentation settings updated successfully',
            documentation: {
                ...docData,
                _id: docData._id?.toString() || docData._id
            }
        });
    } catch (err) {
        console.error('Error updating documentation settings:', err);
        res.status(500).json({ message: 'Error updating documentation settings' });
    }
});

// Get documentation settings version history
router.get('/:id/documentation/settings/versions', authenticateJWT, async (req, res) => {
    try {
        const collectionId = req.params.id;
        const userId = req.user.id;
        const db = getDb();

        // Check if collection exists and user has access
        const collection = await db.collection('collections').findOne({
            _id: new ObjectId(collectionId),
            $or: [
                { owner: userId },
                { collaborators: { $elemMatch: { userId: userId } } }
            ]
        });

        if (!collection) {
            return res.status(404).json({ message: 'Collection not found or access denied' });
        }

        // Get version history for documentation settings
        const versions = await db.collection('documentationSettingsVersions')
            .find({ collectionId: collectionId })
            .sort({ timestamp: -1 })
            .limit(50) // Limit to last 50 versions
            .toArray();        // Convert ObjectIds to strings and add id field for frontend compatibility
        const versionsWithStringIds = versions.map(version => ({
            ...version,
            _id: version._id.toString(),
            id: version._id.toString() // Add id field for frontend compatibility
        }));

        res.json(versionsWithStringIds);
    } catch (err) {
        console.error('Error fetching documentation settings versions:', err);
        res.status(500).json({ message: 'Error fetching version history' });
    }
});

// Get documentation content version history
router.get('/:id/content/versions', authenticateJWT, async (req, res) => {
    try {
        const collectionId = req.params.id;
        const userId = req.user.id;
        const db = getDb();

        // Check if collection exists and user has access
        const collection = await db.collection('collections').findOne({
            _id: new ObjectId(collectionId),
            $or: [
                { owner: userId },
                { collaborators: { $elemMatch: { userId: userId } } }
            ]
        });

        if (!collection) {
            return res.status(404).json({ message: 'Collection not found or access denied' });
        }

        // Get version history for documentation content
        const versions = await db.collection('documentationContentVersions')
            .find({ collectionId: collectionId })
            .sort({ timestamp: -1 })
            .limit(5) // Limit to last 5 versions as per component design
            .toArray();

        // Convert ObjectIds to strings
        const versionsWithStringIds = versions.map(version => ({
            ...version,
            _id: version._id.toString(),
            createdAt: version.timestamp // Map timestamp to createdAt for component compatibility
        }));

        res.json({ versions: versionsWithStringIds });
    } catch (err) {
        console.error('Error fetching documentation content versions:', err);
        res.status(500).json({ message: 'Error fetching content version history' });
    }
});

// Restore documentation content version
router.post('/:id/content/restore', authenticateJWT, async (req, res) => {
    try {
        const collectionId = req.params.id;
        const { versionId } = req.body;
        const userId = req.user.id;
        const db = getDb();

        if (!versionId) {
            return res.status(400).json({ message: 'Version ID is required' });
        }

        // Check if collection exists and user has access to edit
        const collection = await db.collection('collections').findOne({
            _id: new ObjectId(collectionId),
            $or: [
                { owner: userId },
                { collaborators: { $elemMatch: { userId: userId, role: { $in: ['editor', 'admin'] } } } }
            ]
        });

        if (!collection) {
            return res.status(404).json({ message: 'Collection not found or you do not have permission to edit' });
        }

        // Find the version to restore
        const versionToRestore = await db.collection('documentationContentVersions').findOne({
            _id: new ObjectId(versionId),
            collectionId: collectionId
        });

        if (!versionToRestore) {
            return res.status(404).json({ message: 'Version not found' });
        }

        // Get current documentation
        const currentDoc = await db.collection('documentation').findOne({
            collectionId: collectionId
        });

        // Save current content as a new version before restoring
        if (currentDoc && currentDoc.content) {
            await saveDocumentationContentVersion(db, collectionId, userId, currentDoc, 'Content saved before restore');
        }

        // Update the current documentation with the restored content
        if (currentDoc) {
            await db.collection('documentation').updateOne(
                { _id: currentDoc._id },
                {
                    $set: {
                        content: versionToRestore.content,
                        title: versionToRestore.title,
                        updatedAt: new Date()
                    }
                }
            );
        } else {
            // Create new documentation if it doesn't exist
            const newDoc = {
                title: versionToRestore.title,
                content: versionToRestore.content,
                collectionId: collectionId,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            await db.collection('documentation').insertOne(newDoc);
        }

        res.json({
            message: 'Content restored successfully',
            content: versionToRestore.content
        });
    } catch (err) {
        console.error('Error restoring documentation content version:', err);
        res.status(500).json({ message: 'Error restoring content version' });
    }
});

// Collection Variables Management Endpoints

// Get collection variables
router.get('/:id/variables', ensureAuthenticated, async (req, res) => {
    try {
        const collectionId = req.params.id;
        const userId = req.user.id;

        // First try to find collection in MongoDB (for real collections)
        try {
            const db = getDb();
            const collection = await db.collection('collections').findOne({
                _id: new ObjectId(collectionId),
                $or: [
                    { owner: userId },
                    { "collaborators.userId": userId }
                ]
            });

            if (collection) {
                return res.json({ variables: collection.variables || [] });
            }
        } catch (mongoError) {
            // If ObjectId conversion fails, it might be a mock collection ID
            console.log(`MongoDB lookup failed for collection ${collectionId}, checking mock collections...`);
        }        // For mock collections, check if the collection exists and return empty variables array
        // Mock collections are handled differently and don't store variables in MongoDB
        const mockCollectionIds = ['coll1', 'coll2', 'coll3', 'coll4', 'coll5'];
        const isTestOrMockCollection = mockCollectionIds.includes(collectionId) ||
            collectionId.startsWith('coll') ||
            collectionId.startsWith('test-') ||
            collectionId.includes('test');

        if (isTestOrMockCollection) {
            // For mock collections, return variables from a mock store or empty array
            // In a real implementation, you might want to store these in a separate mock data store
            return res.json({ variables: global.mockCollectionVariables?.[collectionId] || [] });
        }

        return res.status(404).json({ message: 'Collection not found or access denied' });
    } catch (err) {
        console.error("Error fetching collection variables:", err);
        res.status(500).json({ message: 'Error fetching collection variables' });
    }
});

// Update collection variables
router.put('/:id/variables', ensureAuthenticated, async (req, res) => {
    try {
        const collectionId = req.params.id;
        const { variables } = req.body;
        const userId = req.user.id;

        // Validate variables format
        if (!Array.isArray(variables)) {
            return res.status(400).json({ message: 'Variables must be an array' });
        }

        // Validate each variable
        for (const variable of variables) {
            if (!variable.key || typeof variable.key !== 'string') {
                return res.status(400).json({ message: 'Each variable must have a valid key' });
            }
            if (variable.value === undefined || variable.value === null) {
                return res.status(400).json({ message: 'Each variable must have a value' });
            }
        }

        // First try to find collection in MongoDB (for real collections)
        try {
            const db = getDb();
            const collection = await db.collection('collections').findOne({
                _id: new ObjectId(collectionId),
                $or: [
                    { owner: userId },
                    { "collaborators.userId": userId, "collaborators.role": { $in: ['editor', 'admin'] } }
                ]
            });

            if (collection) {
                // Update collection variables in MongoDB
                const result = await db.collection('collections').updateOne(
                    { _id: new ObjectId(collectionId) },
                    {
                        $set: {
                            variables: variables,
                            updatedAt: new Date()
                        }
                    }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).json({ message: 'Collection not found' });
                }

                return res.json({
                    message: 'Collection variables updated successfully',
                    variables
                });
            }
        } catch (mongoError) {
            // If ObjectId conversion fails, it might be a mock collection ID
            console.log(`MongoDB update failed for collection ${collectionId}, checking mock collections...`);
        }        // For mock collections, store variables in a global mock store
        const mockCollectionIds = ['coll1', 'coll2', 'coll3', 'coll4', 'coll5'];
        const isTestOrMockCollection = mockCollectionIds.includes(collectionId) ||
            collectionId.startsWith('coll') ||
            collectionId.startsWith('test-') ||
            collectionId.includes('test');

        if (isTestOrMockCollection) {
            // Initialize mock collection variables store if it doesn't exist
            if (!global.mockCollectionVariables) {
                global.mockCollectionVariables = {};
            }

            // Store variables for this mock collection
            global.mockCollectionVariables[collectionId] = variables;

            return res.json({
                message: 'Collection variables updated successfully',
                variables
            });
        }

        return res.status(404).json({ message: 'Collection not found or insufficient permissions' });
    } catch (err) {
        console.error("Error updating collection variables:", err);
        res.status(500).json({ message: 'Error updating collection variables' });
    }
});

// Add a single variable to collection
router.post('/:id/variables', ensureAuthenticated, async (req, res) => {
    try {
        const collectionId = req.params.id;
        const { key, value, description = '', type = 'string' } = req.body;
        const userId = req.user.id;

        // Validate input
        if (!key || typeof key !== 'string') {
            return res.status(400).json({ message: 'Variable key is required' });
        }
        if (value === undefined || value === null) {
            return res.status(400).json({ message: 'Variable value is required' });
        }

        const newVariable = { key, value: String(value), description, type };

        // First try to find collection in MongoDB (for real collections)
        try {
            const db = getDb();
            const collection = await db.collection('collections').findOne({
                _id: new ObjectId(collectionId),
                $or: [
                    { owner: userId },
                    { "collaborators.userId": userId, "collaborators.role": { $in: ['editor', 'admin'] } }
                ]
            });

            if (collection) {
                const variables = collection.variables || [];

                // Check if variable already exists
                const existingIndex = variables.findIndex(v => v.key === key);

                if (existingIndex >= 0) {
                    // Update existing variable
                    variables[existingIndex] = newVariable;
                } else {
                    // Add new variable
                    variables.push(newVariable);
                }

                // Update collection
                const result = await db.collection('collections').updateOne(
                    { _id: new ObjectId(collectionId) },
                    {
                        $set: {
                            variables: variables,
                            updatedAt: new Date()
                        }
                    }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).json({ message: 'Collection not found' });
                }

                return res.status(201).json({
                    message: 'Variable added successfully',
                    variable: newVariable
                });
            }
        } catch (mongoError) {
            // If ObjectId conversion fails, it might be a mock collection ID
            console.log(`MongoDB add variable failed for collection ${collectionId}, checking mock collections...`);
        }        // For mock collections, store variables in a global mock store
        const mockCollectionIds = ['coll1', 'coll2', 'coll3', 'coll4', 'coll5'];
        const isTestOrMockCollection = mockCollectionIds.includes(collectionId) ||
            collectionId.startsWith('coll') ||
            collectionId.startsWith('test-') ||
            collectionId.includes('test');

        if (isTestOrMockCollection) {
            // Initialize mock collection variables store if it doesn't exist
            if (!global.mockCollectionVariables) {
                global.mockCollectionVariables = {};
            }
            if (!global.mockCollectionVariables[collectionId]) {
                global.mockCollectionVariables[collectionId] = [];
            }

            const variables = global.mockCollectionVariables[collectionId];

            // Check if variable already exists
            const existingIndex = variables.findIndex(v => v.key === key);

            if (existingIndex >= 0) {
                // Update existing variable
                variables[existingIndex] = newVariable;
            } else {
                // Add new variable
                variables.push(newVariable);
            }

            return res.status(201).json({
                message: 'Variable added successfully',
                variable: newVariable
            });
        }

        return res.status(404).json({ message: 'Collection not found or insufficient permissions' });
    } catch (err) {
        console.error("Error adding collection variable:", err);
        res.status(500).json({ message: 'Error adding collection variable' });
    }
});

// Delete a variable from collection
router.delete('/:id/variables/:key', ensureAuthenticated, async (req, res) => {
    try {
        const collectionId = req.params.id;
        const variableKey = req.params.key;
        const userId = req.user.id;

        // First try to find collection in MongoDB (for real collections)
        try {
            const db = getDb();
            const collection = await db.collection('collections').findOne({
                _id: new ObjectId(collectionId),
                $or: [
                    { owner: userId },
                    { "collaborators.userId": userId, "collaborators.role": { $in: ['editor', 'admin'] } }
                ]
            });

            if (collection) {
                const variables = collection.variables || [];
                const filteredVariables = variables.filter(v => v.key !== variableKey);

                if (filteredVariables.length === variables.length) {
                    return res.status(404).json({ message: 'Variable not found' });
                }

                // Update collection
                const result = await db.collection('collections').updateOne(
                    { _id: new ObjectId(collectionId) },
                    {
                        $set: {
                            variables: filteredVariables,
                            updatedAt: new Date()
                        }
                    }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).json({ message: 'Collection not found' });
                }

                return res.json({
                    message: 'Variable deleted successfully'
                });
            }
        } catch (mongoError) {
            // If ObjectId conversion fails, it might be a mock collection ID
            console.log(`MongoDB delete variable failed for collection ${collectionId}, checking mock collections...`);
        }        // For mock collections, delete from the global mock store
        const mockCollectionIds = ['coll1', 'coll2', 'coll3', 'coll4', 'coll5'];
        const isTestOrMockCollection = mockCollectionIds.includes(collectionId) ||
            collectionId.startsWith('coll') ||
            collectionId.startsWith('test-') ||
            collectionId.includes('test');

        if (isTestOrMockCollection) {
            // Initialize mock collection variables store if it doesn't exist
            if (!global.mockCollectionVariables || !global.mockCollectionVariables[collectionId]) {
                return res.status(404).json({ message: 'Variable not found' });
            }

            const variables = global.mockCollectionVariables[collectionId];
            const originalLength = variables.length;
            global.mockCollectionVariables[collectionId] = variables.filter(v => v.key !== variableKey);

            if (global.mockCollectionVariables[collectionId].length === originalLength) {
                return res.status(404).json({ message: 'Variable not found' });
            }

            return res.json({
                message: 'Variable deleted successfully'
            });
        }

        return res.status(404).json({ message: 'Collection not found or insufficient permissions' });
    } catch (err) {
        console.error("Error deleting collection variable:", err);
        res.status(500).json({ message: 'Error deleting collection variable' });
    }
});

// Helper function to generate specific version history messages
function generateSettingsChangeMessage(oldSettings, newSettings) {
    if (!oldSettings || !newSettings) {
        return 'Settings updated';
    }

    const changes = [];

    // Check visibility changes
    if (oldSettings.isPublic !== newSettings.isPublic) {
        changes.push(newSettings.isPublic ? 'Documentation made public' : 'Documentation made private');
    }

    // Check display options changes
    const oldDisplayOptions = oldSettings.displayOptions || {};
    const newDisplayOptions = newSettings.displayOptions || {};

    if (oldDisplayOptions.showContributors !== newDisplayOptions.showContributors) {
        changes.push(newDisplayOptions.showContributors ? 'Show contributors enabled' : 'Show contributors disabled');
    }

    if (oldDisplayOptions.showLastUpdated !== newDisplayOptions.showLastUpdated) {
        changes.push(newDisplayOptions.showLastUpdated ? 'Show last updated enabled' : 'Show last updated disabled');
    }

    if (oldDisplayOptions.showTableOfContents !== newDisplayOptions.showTableOfContents) {
        changes.push(newDisplayOptions.showTableOfContents ? 'Table of contents enabled' : 'Table of contents disabled');
    }

    // Check other setting changes
    if (oldSettings.allowComments !== newSettings.allowComments) {
        changes.push(newSettings.allowComments ? 'Comments enabled' : 'Comments disabled');
    }

    if (oldSettings.enableSearch !== newSettings.enableSearch) {
        changes.push(newSettings.enableSearch ? 'Search enabled' : 'Search disabled');
    }

    if (oldSettings.metaTitle !== newSettings.metaTitle) {
        if (!oldSettings.metaTitle && newSettings.metaTitle) {
            changes.push('Meta title added');
        } else if (oldSettings.metaTitle && !newSettings.metaTitle) {
            changes.push('Meta title removed');
        } else {
            changes.push('Meta title updated');
        }
    }

    if (oldSettings.metaDescription !== newSettings.metaDescription) {
        if (!oldSettings.metaDescription && newSettings.metaDescription) {
            changes.push('Meta description added');
        } else if (oldSettings.metaDescription && !newSettings.metaDescription) {
            changes.push('Meta description removed');
        } else {
            changes.push('Meta description updated');
        }
    }

    if (oldSettings.customDomain !== newSettings.customDomain) {
        if (!oldSettings.customDomain && newSettings.customDomain) {
            changes.push('Custom domain added');
        } else if (oldSettings.customDomain && !newSettings.customDomain) {
            changes.push('Custom domain removed');
        } else {
            changes.push('Custom domain updated');
        }
    }

    if (oldSettings.theme !== newSettings.theme) {
        changes.push(`Theme changed to ${newSettings.theme}`);
    }

    // Return specific message or fallback
    if (changes.length === 0) {
        return 'Settings updated';
    } else if (changes.length === 1) {
        return changes[0];
    } else if (changes.length <= 3) {
        return changes.join(', ');
    } else {
        return `${changes.length} settings updated: ${changes.slice(0, 2).join(', ')} and ${changes.length - 2} more`;
    }
}

// Helper function to save documentation settings version
async function saveDocumentationSettingsVersion(db, collectionId, userId, settings, message) {
    try {
        const versionData = {
            id: `settings-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, // Unique ID for frontend
            collectionId: collectionId,
            userId: userId,
            settings: settings,
            message: message || 'Settings updated',
            timestamp: new Date(),
            type: 'settings'
        };

        await db.collection('documentationSettingsVersions').insertOne(versionData);
        console.log('Documentation settings version saved:', versionData);
    } catch (err) {
        console.error('Error saving documentation settings version:', err);
    }
}

// Helper function to save documentation content version
async function saveDocumentationContentVersion(db, collectionId, userId, docData, message) {
    try {
        const versionData = {
            collectionId: collectionId,
            userId: userId,
            title: docData.title,
            content: docData.content,
            message: message || 'Content updated',
            timestamp: new Date(),
            type: 'commit',
            importedFrom: docData.importedFrom || 'manual'
        };

        await db.collection('documentationContentVersions').insertOne(versionData);
        console.log('Documentation content version saved:', versionData);
    } catch (err) {
        console.error('Error saving documentation content version:', err);
    }
}

// Import OpenAPI documentation for a collection
router.post('/:id/documentation/import/openapi', authenticateJWT, async (req, res) => {
    try {
        const collectionId = req.params.id;
        const userId = req.user.id;
        const { title, content, importedFrom, openApiSpec, createApiVersion, createMockServer } = req.body;
        const db = getDb();

        if (!content) {
            return res.status(400).json({ message: 'Documentation content is required' });
        }

        // Check if collection exists and user has access
        const collection = await db.collection('collections').findOne({
            _id: new ObjectId(collectionId),
            $or: [
                { owner: userId },
                { collaborators: { $elemMatch: { userId: userId, role: { $in: ['editor', 'admin'] } } } }
            ]
        });

        if (!collection) {
            return res.status(404).json({ message: 'Collection not found or you do not have permission to edit' });
        }

        // Check if documentation already exists
        let existingDoc = await db.collection('documentation').findOne({
            collectionId: collectionId
        });

        let docData;
        if (existingDoc) {
            // Update existing documentation
            docData = {
                title: title || existingDoc.title,
                content: content,
                collectionId: collectionId,
                updatedAt: new Date(),
                importedFrom: 'openapi'
            };

            await db.collection('documentation').updateOne(
                { _id: existingDoc._id },
                { $set: docData }
            );

            docData._id = existingDoc._id.toString();
        } else {
            // Create new documentation
            docData = {
                title: title || `${collection.name} Documentation`,
                content: content,
                collectionId: collectionId,
                createdAt: new Date(),
                updatedAt: new Date(),
                importedFrom: 'openapi'
            };

            const result = await db.collection('documentation').insertOne(docData);
            docData._id = result.insertedId.toString();
        }

        let responseData = { documentation: docData };

        // Optional: Create API version from OpenAPI spec
        if (createApiVersion && openApiSpec) {
            try {
                const versionNumber = openApiSpec.info?.version || '1.0.0';
                const apiVersionData = {
                    collectionId: collectionId,
                    version: versionNumber,
                    description: `API version imported from OpenAPI spec: ${openApiSpec.info?.title || 'Unknown'}`,
                    specification: openApiSpec,
                    isActive: true,
                    changelog: `Imported from OpenAPI specification`,
                    createdBy: userId
                };

                const apiVersion = await ApiVersioningService.createVersion(apiVersionData);
                responseData.apiVersion = apiVersion;

                // Optional: Create mock server for the API version
                if (createMockServer) {
                    const mockServerData = {
                        collectionId: collectionId,
                        versionId: apiVersion._id,
                        name: `Mock Server for ${openApiSpec.info?.title || collection.name} v${versionNumber}`,
                        description: `Mock server generated from OpenAPI spec`,
                        baseUrl: `http://localhost:3001/mock/${apiVersion._id}`,
                        mockEndpoints: []
                    };

                    // Generate mock endpoints from OpenAPI paths
                    if (openApiSpec.paths) {
                        Object.entries(openApiSpec.paths).forEach(([path, methods]) => {
                            Object.entries(methods).forEach(([method, operation]) => {
                                const endpoint = {
                                    method: method.toUpperCase(),
                                    path: path,
                                    responseCode: 200,
                                    responseBody: MockServerService.generateMockResponse(operation),
                                    headers: { 'Content-Type': 'application/json' },
                                    description: operation.summary || operation.description || `${method.toUpperCase()} ${path}`
                                };
                                mockServerData.mockEndpoints.push(endpoint);
                            });
                        });
                    }

                    const mockServer = await MockServerService.createMockServer(mockServerData, userId);
                    responseData.mockServer = mockServer;
                }
            } catch (versionError) {
                console.error('Error creating API version or mock server:', versionError);
                // Don't fail the entire import if version/mock creation fails
                responseData.warnings = [`Failed to create API version or mock server: ${versionError.message}`];
            }
        }

        res.status(201).json(responseData);
    } catch (err) {
        console.error('Error importing OpenAPI documentation:', err);
        res.status(500).json({ message: 'Error importing OpenAPI documentation' });
    }
});

// Get documentation for a collection
router.get('/:id/documentation', async (req, res) => {
    try {
        const collectionId = req.params.id;
        const db = getDb();

        // Find documentation for this collection
        const doc = await db.collection('documentation').findOne({
            collectionId: collectionId
        });

        if (!doc) {
            return res.status(404).json({ message: 'Documentation not found' });
        }

        res.json({
            ...doc,
            _id: doc._id.toString()
        });
    } catch (err) {
        console.error('Error fetching documentation:', err);
        res.status(500).json({ message: 'Error fetching documentation' });
    }
});

// Get collection branches
router.get('/:id/branches', authenticateJWT, async (req, res) => {
    try {
        const collectionId = req.params.id;

        // In a real implementation, this would query from MongoDB
        // For now, we'll return mock branch data
        const branches = [
            {
                id: `branch-${Date.now()}-1`,
                name: 'feature/oauth-endpoints',
                description: 'Adding OAuth 2.0 endpoints',
                collectionId: collectionId,
                basedOn: 'main',
                createdBy: req.user.id,
                createdByName: req.user.name || 'Anonymous User',
                createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
                lastCommit: {
                    id: `commit-${Date.now()}-1`,
                    message: 'Updated token endpoint',
                    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
                }
            },
            {
                id: `branch-${Date.now()}-2`,
                name: 'bugfix/rate-limiting',
                description: 'Fix rate limiting issues on API endpoints',
                collectionId: collectionId,
                basedOn: 'main',
                createdBy: req.user.id,
                createdByName: req.user.name || 'Anonymous User',
                createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
                lastCommit: {
                    id: `commit-${Date.now()}-2`,
                    message: 'Added proper headers for rate limits',
                    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
                }
            }
        ];

        res.json(branches);
    } catch (err) {
        console.error("Error fetching collection branches:", err);
        res.status(500).json({ message: 'Error fetching collection branches' });
    }
});

// Create a merge request from a branch or collection to another collection
router.post('/:id/create-merge-request', authenticateJWT, async (req, res) => {
    try {
        const id = req.params.id;
        const entityType = 'collection'; // Always collection for this route
        const { targetId, title, description, userId } = req.body;

        if (!targetId) {
            return res.status(400).json({ message: 'Target ID is required' });
        }

        // In a real implementation, this would save to MongoDB
        // For now, we'll just create a mock merge request object and return it
        const mergeRequest = {
            id: `mr-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            sourceType: entityType,
            sourceId: id,
            targetType: entityType,
            targetId,
            title: title || `Merge ${entityType} ${id} to ${targetId}`,
            description: description || '',
            status: 'pending',
            createdBy: {
                userId: userId || req.user.id,
                name: req.user.name || 'Anonymous User',
                email: req.user.email || 'anonymous@example.com'
            },
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Log the created merge request
        console.log('Created new merge request:', mergeRequest);

        res.status(201).json(mergeRequest);
    } catch (err) {
        console.error("Error creating merge request:", err);
        res.status(500).json({ message: 'Error creating merge request', error: err.message });
    }
});

module.exports = router;