// routes/workspaces.js
const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { ensureAuthenticated, authenticateJWT } = require('../middleware/auth');
const { getDb } = require('../config/db');

// Compliance audit logging (who changed what)
const AuditLogger = require('../features/compliance/AuditLogger');

// In-memory store for backward compatibility
const workspacesStore = {};

// Get all workspaces
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        const userObjectId = ObjectId.isValid(userId) ? new ObjectId(userId) : null;
        const db = getDb();

        // Fetch workspaces from MongoDB (support both string and ObjectId owners/collaborators)
        let workspaces = await db.collection('workspaces')
            .find({
                $or: [
                    { owner: userId },
                    ...(userObjectId ? [{ owner: userObjectId }] : []),
                    { "collaborators.userId": userId },
                    ...(userObjectId ? [{ "collaborators.userId": userObjectId }] : [])
                ]
            })
            .toArray();

        // Fallback for dev mode: if nothing matched the current user, show all existing workspaces
        if (workspaces.length === 0 && process.env.NODE_ENV !== 'production') {
            workspaces = await db.collection('workspaces').find({}).limit(50).toArray();
        }

        // Separate into personal and team workspaces
        const personalWorkspaces = [];
        const teamWorkspaces = [];

        for (const workspace of workspaces) {
            // Convert MongoDB ObjectId to string for client use
            const wsWithStringId = {
                ...workspace,
                _id: workspace._id.toString(),
                owner: workspace.owner?.toString?.() || workspace.owner
            };

            // Add collection count information
            const collectionsCount = await db.collection('collections')
                .countDocuments({
                    $or: [
                        { workspaceId: workspace._id.toString() },
                        ...(workspace._id ? [{ workspaceId: workspace._id }] : [])
                    ]
                });

            wsWithStringId.collectionsCount = collectionsCount;
            wsWithStringId.collaboratorsCount = workspace.collaborators ? workspace.collaborators.length : 1;

            // Add to appropriate array
            if (workspace.isPersonal) {
                personalWorkspaces.push(wsWithStringId);
            } else {
                teamWorkspaces.push(wsWithStringId);
            }

            // For backward compatibility, also update the in-memory store
            workspacesStore[workspace._id.toString()] = {
                name: workspace.name,
                description: workspace.description || "",
                isPersonal: workspace.isPersonal || false,
                isPublic: workspace.isPublic || false
            };
        }

        // Add default workspace if none exist
        if (personalWorkspaces.length === 0 && teamWorkspaces.length === 0) {
            // Create a default workspace in MongoDB
            const defaultWorkspace = {
                name: "API Testing",
                description: "Workspace for API testing and documentation",
                isPersonal: true,
                isPublic: false,
                owner: userObjectId || userId,
                userRole: "admin",
                collaborators: [
                    {
                        userId: userObjectId || userId,
                        displayName: req.user.name || "User",
                        email: req.user.email,
                        role: "admin",
                        joinedAt: new Date()
                    }
                ],
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = await db.collection('workspaces').insertOne(defaultWorkspace);
            const newWorkspaceId = result.insertedId.toString();

            // Add to personal workspaces array
            personalWorkspaces.push({
                ...defaultWorkspace,
                _id: newWorkspaceId,
                owner: (defaultWorkspace.owner && defaultWorkspace.owner.toString) ? defaultWorkspace.owner.toString() : defaultWorkspace.owner,
                collectionsCount: 0,
                collaboratorsCount: 1
            });

            // Update the in-memory store
            workspacesStore[newWorkspaceId] = {
                name: defaultWorkspace.name,
                description: defaultWorkspace.description,
                isPersonal: defaultWorkspace.isPersonal,
                isPublic: defaultWorkspace.isPublic
            };
        }

        res.json({
            personal: personalWorkspaces,
            team: teamWorkspaces
        });
    } catch (err) {
        console.error("Error fetching workspaces:", err);
        res.status(500).json({ message: 'Error fetching workspaces' });
    }
});

// Get shared workspaces
router.get('/shared', ensureAuthenticated, async (req, res) => {
    try {
        // Mock shared workspaces data
        const sharedWorkspaces = {
            personal: [
                {
                    _id: "shared_ws1",
                    name: "Alex's Personal Workspace",
                    description: "Personal workspace shared by Alex",
                    isPersonal: true,
                    isPublic: false,
                    owner: "alex-user-id",
                    userRole: "Viewer",
                    createdAt: new Date(),
                    collaboratorsCount: 2,
                    collectionsCount: 3
                }
            ],
            team: [
                {
                    _id: "shared_ws2",
                    name: "Marketing Team",
                    description: "Workspace for our marketing initiatives",
                    isPersonal: false,
                    isPublic: false,
                    owner: "sarah-user-id",
                    userRole: "Editor",
                    createdAt: new Date(),
                    collaboratorsCount: 8,
                    collectionsCount: 12
                },
                {
                    _id: "shared_ws3",
                    name: "Product Development",
                    description: "Workspace for product development and testing",
                    isPersonal: false,
                    isPublic: false,
                    owner: "mike-user-id",
                    userRole: "Contributor",
                    createdAt: new Date(),
                    collaboratorsCount: 6,
                    collectionsCount: 15
                }
            ]
        };

        res.json(sharedWorkspaces);
    } catch (err) {
        console.error("Error fetching shared workspaces:", err);
        res.status(500).json({ message: 'Error fetching shared workspaces' });
    }
});

// Get workspace by ID
router.get('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const workspaceId = req.params.id;
        const userId = req.user.id;
        const userObjectId = ObjectId.isValid(userId) ? new ObjectId(userId) : null;
        const db = getDb();

        // Special handling for "my-workspace" - create the first personal workspace if none exists
        if (workspaceId === 'my-workspace') {
            // Check if the user has a personal workspace
            const personalWorkspace = await db.collection('workspaces')
                .findOne({ owner: userId, isPersonal: true });

            if (personalWorkspace) {
                // Return the user's personal workspace
                const workspace = {
                    _id: personalWorkspace._id.toString(),
                    name: personalWorkspace.name,
                    description: personalWorkspace.description || "",
                    isPersonal: true,
                    isPublic: personalWorkspace.isPublic || false,
                    owner: userId,
                    userRole: "admin",
                    memberCount: personalWorkspace.collaborators ? personalWorkspace.collaborators.length : 1,
                    collectionCount: await db.collection('collections').countDocuments({ workspaceId: personalWorkspace._id.toString() }),
                    collaborators: personalWorkspace.collaborators || [
                        {
                            userId: userId,
                            displayName: req.user.name || "User",
                            email: req.user.email,
                            role: "admin",
                            joinedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                        }
                    ],
                    createdAt: personalWorkspace.createdAt,
                    updatedAt: personalWorkspace.updatedAt
                };

                return res.json(workspace);
            } else {
                // Create a new personal workspace
                const defaultWorkspace = {
                    name: "API Testing",
                    description: "Workspace for API testing and documentation",
                    isPersonal: true,
                    isPublic: false,
                    owner: userId,
                    userRole: "admin",
                    memberCount: 1,
                    collectionCount: 2,
                    collaborators: [
                        {
                            userId: userId,
                            displayName: req.user.name || "User",
                            email: req.user.email,
                            role: "admin",
                            joinedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                        }
                    ],
                    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    updatedAt: new Date()
                };

                return res.json(defaultWorkspace);
            }
        }

        // Continue with normal workspace lookup for other workspace IDs
        // Check if this is a workspace we've seen before
        let workspace;

        // Try to find the workspace in MongoDB first
        const mongoWorkspace = ObjectId.isValid(workspaceId)
            ? await db.collection('workspaces').findOne({ _id: new ObjectId(workspaceId) })
            : null;

        if (mongoWorkspace) {
            workspace = {
                _id: mongoWorkspace._id.toString(),
                name: mongoWorkspace.name,
                description: mongoWorkspace.description || "",
                isPersonal: mongoWorkspace.isPersonal || false,
                isPublic: mongoWorkspace.isPublic || false,
                owner: mongoWorkspace.owner?.toString?.() || mongoWorkspace.owner,
                userRole: "admin", // This should be determined based on the user's actual role
                memberCount: mongoWorkspace.collaborators ? mongoWorkspace.collaborators.length : 1,
                collectionCount: await db.collection('collections').countDocuments({
                    $or: [
                        { workspaceId: mongoWorkspace._id.toString() },
                        ...(mongoWorkspace._id ? [{ workspaceId: mongoWorkspace._id }] : [])
                    ]
                }),
                collaborators: mongoWorkspace.collaborators || [],
                createdAt: mongoWorkspace.createdAt,
                updatedAt: mongoWorkspace.updatedAt
            };
        } else if (workspacesStore[workspaceId]) {
            // Use the stored name and description
            const storedWorkspace = workspacesStore[workspaceId];

            workspace = {
                _id: workspaceId,
                name: storedWorkspace.name,
                description: storedWorkspace.description,
                isPersonal: storedWorkspace.isPersonal,
                isPublic: storedWorkspace.isPublic,
                owner: userId,
                userRole: "admin", // Assuming the requester is the admin/owner
                memberCount: workspaceId === "ws1" ? 1 : 5,
                collectionCount: workspaceId === "ws1" ? 2 : 4,
                collaborators: [
                    {
                        userId: userId,
                        displayName: req.user.name || "User",
                        email: req.user.email,
                        role: "admin",
                        joinedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
                    }
                ],
                createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
                updatedAt: new Date()
            };
        } else {
            // This is a new workspace - provide default values
            return res.status(404).json({ message: 'Workspace not found' });
        }

        res.json(workspace);
    } catch (err) {
        console.error("Error fetching workspace:", err);
        res.status(500).json({ message: 'Error fetching workspace' });
    }
});

// Get workspace collections
router.get('/:id/collections', ensureAuthenticated, async (req, res) => {
    try {
        let workspaceId = req.params.id;
        const userId = req.user.id;
        const userObjectId = ObjectId.isValid(userId) ? new ObjectId(userId) : null;
        const db = getDb();

        // Support the "my-workspace" alias by resolving it to the user's personal workspace _id.
        if (workspaceId === 'my-workspace') {
            const personalWorkspace = await db.collection('workspaces').findOne({
                isPersonal: true,
                $or: [
                    { owner: userId },
                    ...(userObjectId ? [{ owner: userObjectId }] : [])
                ]
            });

            if (personalWorkspace?._id) {
                workspaceId = personalWorkspace._id.toString();
            }
        }

        const workspaceObjectId = ObjectId.isValid(workspaceId) ? new ObjectId(workspaceId) : null;

        // Determine if this is the user's personal workspace. If so, include unassigned collections (workspaceId:null)
        // owned by the user, since older flows could create collections without a workspaceId.
        let isPersonalWorkspace = false;
        if (workspaceObjectId) {
            try {
                const wsDoc = await db.collection('workspaces').findOne({ _id: workspaceObjectId });
                isPersonalWorkspace = !!wsDoc?.isPersonal;
            } catch (err) {
                console.log(`Non-fatal: failed to read workspace ${workspaceId} for collections: ${err.message}`);
            }
        }

        const ownerOr = [
            { owner: userId },
            ...(userObjectId ? [{ owner: userObjectId }] : [])
        ];

        const collectionOr = [
            { workspaceId: workspaceId },
            ...(workspaceObjectId ? [{ workspaceId: workspaceObjectId }] : [])
        ];

        if (isPersonalWorkspace) {
            collectionOr.push({
                $and: [
                    { workspaceId: null },
                    { $or: ownerOr }
                ]
            });
        }

        // Fetch collections from MongoDB
        const collections = await db.collection('collections')
            .find({
                $or: collectionOr
            })
            .toArray();

        // If collections exist in MongoDB, return them
        if (collections && collections.length > 0) {
            const collectionsWithStringIds = collections.map(collection => ({
                ...collection,
                _id: collection._id.toString(),
                workspaceId: collection.workspaceId?.toString?.() || collection.workspaceId
            }));

            return res.json(collectionsWithStringIds);
        }

        // Mock collections data based on workspace ID
        let mockCollections = [];

        switch (workspaceId) {
            case "ws1":
                mockCollections = [
                    {
                        _id: "coll1",
                        name: "Personal API Collection",
                        description: "My personal collection of frequently used APIs",
                        workspaceId: "ws1",
                        owner: userId,
                        isPublic: false,
                        requestsCount: 5,
                        createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), // 25 days ago
                        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)  // 1 day ago
                    },
                    {
                        _id: "coll2",
                        name: "Project X APIs",
                        description: "APIs used in the Project X development",
                        workspaceId: "ws1",
                        owner: userId,
                        isPublic: false,
                        requestsCount: 12,
                        createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), // 25 days ago
                        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)  // 1 day ago
                    },
                    {
                        _id: "coll3",
                        name: "Public Demo Collection",
                        description: "Public collection of demo APIs",
                        workspaceId: "ws1",
                        owner: userId,
                        isPublic: true,
                        requestsCount: 8,
                        createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
                        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)  // 2 days ago
                    }
                ];
                break;
            case "ws2":
                mockCollections = [
                    {
                        _id: "coll4",
                        name: "API Testing Collection",
                        description: "APIs for testing our services",
                        workspaceId: "ws2",
                        owner: "other-user-id",
                        isPublic: false,
                        requestsCount: 15,
                        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
                        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)  // 1 day ago
                    },
                    {
                        _id: "coll5",
                        name: "Authentication APIs",
                        description: "All authentication-related API endpoints",
                        workspaceId: "ws2",
                        owner: "other-user-id",
                        isPublic: false,
                        requestsCount: 7,
                        createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000), // 12 days ago
                        updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)  // 3 days ago
                    },
                    {
                        _id: "coll6",
                        name: "User Management APIs",
                        description: "User creation, updates, and management endpoints",
                        workspaceId: "ws2",
                        owner: "member3",
                        isPublic: false,
                        requestsCount: 10,
                        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
                        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)  // 2 days ago
                    }
                ];
                break;
            case "ws3":
                mockCollections = [
                    {
                        _id: "coll7",
                        name: "Public API Documentation",
                        description: "Public endpoints documentation",
                        workspaceId: "ws3",
                        owner: "another-user-id",
                        isPublic: true,
                        requestsCount: 12,
                        createdAt: new Date(Date.now() - 58 * 24 * 60 * 60 * 1000), // 58 days ago
                        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)  // 2 days ago
                    }
                ];
                break;
            default:
                mockCollections = [];
        }

        res.json(mockCollections);
    } catch (err) {
        console.error("Error fetching workspace collections:", err);
        res.status(500).json({ message: 'Error fetching workspace collections' });
    }
});

// Get workspace activity
router.get('/:id/activity', ensureAuthenticated, async (req, res) => {
    try {
        let workspaceId = req.params.id;
        const db = getDb();
        const userId = req.user.id;
        const userObjectId = ObjectId.isValid(userId) ? new ObjectId(userId) : null;

        // Support the "my-workspace" alias.
        if (workspaceId === 'my-workspace') {
            const personalWorkspace = await db.collection('workspaces').findOne({
                isPersonal: true,
                $or: [
                    { owner: userId },
                    ...(userObjectId ? [{ owner: userObjectId }] : [])
                ]
            });

            if (personalWorkspace?._id) {
                workspaceId = personalWorkspace._id.toString();
            }
        }

        const workspaceObjectId = ObjectId.isValid(workspaceId) ? new ObjectId(workspaceId) : null;

        // 1) Prefer persisted activity logs if present.
        try {
            const persisted = await db.collection('workspaceActivity')
                .find({
                    $or: [
                        { workspaceId: workspaceId },
                        ...(workspaceObjectId ? [{ workspaceId: workspaceObjectId }] : [])
                    ]
                })
                .sort({ timestamp: -1 })
                .limit(25)
                .toArray();

            if (persisted && persisted.length > 0) {
                return res.json(
                    persisted.map(a => ({
                        ...a,
                        _id: a._id?.toString?.() || a._id,
                        workspaceId: a.workspaceId?.toString?.() || a.workspaceId
                    }))
                );
            }
        } catch (err) {
            // Non-fatal: if the collection doesn't exist or query fails, fall back below.
            console.log(`workspaceActivity lookup failed for workspace ${workspaceId}: ${err.message}`);
        }

        // 2) Fallback: synthesize activity from recent collections in this workspace.
        try {
            const ownerOr = [
                { owner: userId },
                ...(userObjectId ? [{ owner: userObjectId }] : [])
            ];

            const collectionOr = [
                { workspaceId: workspaceId },
                ...(workspaceObjectId ? [{ workspaceId: workspaceObjectId }] : [])
            ];

            if (isPersonalWorkspace) {
                collectionOr.push({
                    $and: [
                        { workspaceId: null },
                        { $or: ownerOr }
                    ]
                });
            }

            const recentCollections = await db.collection('collections')
                .find({
                    $or: collectionOr
                })
                .sort({ createdAt: -1 })
                .limit(10)
                .toArray();

            if (recentCollections && recentCollections.length > 0) {
                const synthesized = recentCollections.map((c) => ({
                    _id: `synth-${c._id.toString()}-created`,
                    type: 'collection_created',
                    message: `Created collection '${c.name || 'Untitled'}'`,
                    user: {
                        userId: req.user.id,
                        displayName: req.user.displayName || req.user.name || 'User',
                        email: req.user.email
                    },
                    timestamp: c.createdAt || c.updatedAt || new Date(),
                    details: {
                        collectionId: c._id.toString(),
                        workspaceId: workspaceId
                    }
                }));

                return res.json(synthesized);
            }
        } catch (err) {
            console.log(`collections fallback for activity failed for workspace ${workspaceId}: ${err.message}`);
        }

        // Mock activity data based on workspace ID
        let activities = [];

        switch (workspaceId) {
            case "ws1":
                activities = [
                    {
                        _id: "act1",
                        type: "collection_created",
                        message: "Created collection 'Personal API Collection'",
                        user: {
                            userId: req.user.id,
                            displayName: req.user.name || "User",
                            email: req.user.email
                        },
                        timestamp: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000) // 25 days ago
                    },
                    {
                        _id: "act2",
                        type: "collection_created",
                        message: "Created collection 'Public Demo Collection'",
                        user: {
                            userId: req.user.id,
                            displayName: req.user.name || "User",
                            email: req.user.email
                        },
                        timestamp: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000) // 20 days ago
                    },
                    {
                        _id: "act3",
                        type: "request_added",
                        message: "Added 3 requests to 'Personal API Collection'",
                        user: {
                            userId: req.user.id,
                            displayName: req.user.name || "User",
                            email: req.user.email
                        },
                        timestamp: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000) // 18 days ago
                    },
                    {
                        _id: "act4",
                        type: "request_sent",
                        message: "Executed GET request to 'api.example.com/users'",
                        user: {
                            userId: req.user.id,
                            displayName: req.user.name || "User",
                            email: req.user.email
                        },
                        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
                    }
                ];
                break;
            case "ws2":
                activities = [
                    {
                        _id: "act5",
                        type: "collection_created",
                        message: "Created collection 'API Testing Collection'",
                        user: {
                            userId: "other-user-id",
                            displayName: "Team Lead",
                            email: "team.lead@example.com"
                        },
                        timestamp: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) // 14 days ago
                    },
                    {
                        _id: "act6",
                        type: "user_added",
                        message: `Added ${req.user.name || "User"} to the workspace`,
                        user: {
                            userId: "other-user-id",
                            displayName: "Team Lead",
                            email: "team.lead@example.com"
                        },
                        timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) // 10 days ago
                    },
                    {
                        _id: "act7",
                        type: "merge_requested",
                        message: "Created merge request 'Update Authentication APIs'",
                        user: {
                            userId: "member1",
                            displayName: "Team Member 1",
                            email: "member1@example.com"
                        },
                        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
                    }
                ];
                break;
            case "ws3":
                activities = [
                    {
                        _id: "act8",
                        type: "collection_created",
                        message: "Created collection 'Public API Documentation'",
                        user: {
                            userId: "another-user-id",
                            displayName: "Documentation Manager",
                            email: "docs.manager@example.com"
                        },
                        timestamp: new Date(Date.now() - 58 * 24 * 60 * 60 * 1000) // 58 days ago
                    },
                    {
                        _id: "act9",
                        type: "user_added",
                        message: `Added ${req.user.name || "User"} to the workspace`,
                        user: {
                            userId: "another-user-id",
                            displayName: "Documentation Manager",
                            email: "docs.manager@example.com"
                        },
                        timestamp: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000) // 20 days ago
                    }
                ];
                break;
            default:
                activities = [];
        }

        res.json(activities);
    } catch (err) {
        console.error("Error fetching workspace activity:", err);
        res.status(500).json({ message: 'Error fetching workspace activity' });
    }
});

// Invite user to workspace
router.post('/:id/invite', ensureAuthenticated, async (req, res) => {
    try {
        const workspaceId = req.params.id;
        const { email, role } = req.body;

        // Validate inputs
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        if (!['admin', 'editor', 'viewer'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role. Must be either "admin", "editor", or "viewer"' });
        }

        // Mock response with the newly invited user
        const invitedUser = {
            userId: `user-${Date.now()}`,
            email: email,
            displayName: email.split('@')[0], // Simple mock name from email
            role: role,
            status: 'pending',
            invitedBy: req.user.id,
            invitedAt: new Date()
        };

        res.status(201).json(invitedUser);
    } catch (err) {
        console.error("Error inviting user:", err);
        res.status(500).json({ message: 'Error inviting user to workspace' });
    }
});

// Delete collaborator from workspace
router.delete('/:id/collaborators/:userId', ensureAuthenticated, async (req, res) => {
    try {
        const workspaceId = req.params.id;
        const collaboratorId = req.params.userId;

        // Best-effort audit log (this route is currently a stub)
        try {
            await AuditLogger.log({
                req,
                actorId: req.user.id,
                workspaceId,
                action: 'workspace.collaborator.remove',
                targetType: 'workspace',
                targetId: workspaceId,
                metadata: { collaboratorId }
            });
        } catch (e) {
            console.warn('Audit log failed (workspace collaborator remove):', e.message);
        }

        // Return success response
        res.json({
            message: 'Collaborator removed successfully',
            workspaceId,
            collaboratorId
        });
    } catch (err) {
        console.error("Error removing collaborator:", err);
        res.status(500).json({ message: 'Error removing collaborator' });
    }
});

// Create workspace
router.post('/', ensureAuthenticated, async (req, res) => {
    try {
        const { name, description, isPersonal, isPublic } = req.body;
        const userId = req.user.id;
        const userObjectId = ObjectId.isValid(userId) ? new ObjectId(userId) : null;
        const db = getDb();

        // Validate input
        if (!name) {
            return res.status(400).json({ message: 'Workspace name is required' });
        }

        // Create a new workspace document for MongoDB
        const newWorkspace = {
            name: name,
            description: description || "",
            isPersonal: isPersonal || false,
            isPublic: isPublic || false,
            owner: userObjectId || userId,
            userRole: "admin",
            collaborators: [
                {
                    userId: userObjectId || userId,
                    displayName: req.user.name || "User",
                    email: req.user.email,
                    role: "admin",
                    joinedAt: new Date()
                }
            ],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Store the workspace in MongoDB
        const result = await db.collection('workspaces').insertOne(newWorkspace);
        const workspaceId = result.insertedId.toString();

        // Audit log: workspace created
        try {
            await AuditLogger.log({
                req,
                actorId: req.user.id,
                workspaceId,
                action: 'workspace.create',
                targetType: 'workspace',
                targetId: workspaceId,
                metadata: {
                    name: newWorkspace.name,
                    isPersonal: newWorkspace.isPersonal,
                    isPublic: newWorkspace.isPublic
                }
            });
        } catch (e) {
            console.warn('Audit log failed (workspace create):', e.message);
        }

        // Also update our in-memory store
        workspacesStore[workspaceId] = {
            name,
            description: description || "",
            isPersonal: isPersonal || false,
            isPublic: isPublic || false
        };

        // Return the created workspace with its ID
        res.status(201).json({
            ...newWorkspace,
            _id: workspaceId,
            owner: (newWorkspace.owner && newWorkspace.owner.toString) ? newWorkspace.owner.toString() : newWorkspace.owner
        });
    } catch (err) {
        console.error("Error creating workspace:", err);
        res.status(500).json({ message: 'Error creating workspace' });
    }
});

// Update workspace
router.put('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const workspaceId = req.params.id;
        const { name, description, isPublic } = req.body;
        const db = getDb();

        // Log to help with debugging
        console.log(`Updating workspace ${workspaceId} with:`, { name, description, isPublic });

        // Special handling for "my-workspace" - map to personal workspace
        let actualWorkspaceId = workspaceId;
        if (workspaceId === 'my-workspace') {
            // Find the user's personal workspace
            const personalWorkspace = await db.collection('workspaces')
                .findOne({ owner: req.user.id, isPersonal: true });

            if (personalWorkspace) {
                actualWorkspaceId = personalWorkspace._id.toString();
                console.log(`Mapped "my-workspace" to personal workspace ID: ${actualWorkspaceId}`);
            } else {
                return res.status(404).json({ message: 'Personal workspace not found' });
            }
        }

        // Validate input
        if (!name) {
            return res.status(400).json({ message: 'Workspace name is required' });
        }

        if (!ObjectId.isValid(actualWorkspaceId)) {
            return res.status(400).json({ message: 'Invalid workspace id' });
        }

        // Check if the workspace exists
        const workspace = await db.collection('workspaces')
            .findOne({ _id: new ObjectId(actualWorkspaceId) });

        if (!workspace) {
            // Try the in-memory store
            if (!workspacesStore[actualWorkspaceId]) {
                return res.status(404).json({ message: 'Workspace not found' });
            }
        }

        // Update MongoDB if available
        if (workspace) {
            await db.collection('workspaces').updateOne(
                { _id: new ObjectId(actualWorkspaceId) },
                {
                    $set: {
                        name,
                        description: description || workspace.description,
                        isPublic: isPublic !== undefined ? isPublic : workspace.isPublic,
                        updatedAt: new Date()
                    }
                }
            );
        }

        // Also update the in-memory store
        if (workspacesStore[actualWorkspaceId]) {
            workspacesStore[actualWorkspaceId] = {
                name,
                description: description || workspacesStore[actualWorkspaceId].description,
                isPersonal: workspacesStore[actualWorkspaceId].isPersonal,
                isPublic: isPublic !== undefined ? isPublic : workspacesStore[actualWorkspaceId].isPublic
            };
        }

        // Return the updated workspace
        const updatedWorkspace = {
            _id: actualWorkspaceId,
            name,
            description: description || (workspace ? workspace.description : workspacesStore[actualWorkspaceId].description),
            isPersonal: workspace ? workspace.isPersonal : workspacesStore[actualWorkspaceId].isPersonal,
            isPublic: isPublic !== undefined ? isPublic : (workspace ? workspace.isPublic : workspacesStore[actualWorkspaceId].isPublic),
            owner: req.user.id,
            userRole: "admin",
            updatedAt: new Date()
        };

        // Audit log: workspace updated
        try {
            await AuditLogger.log({
                req,
                actorId: req.user.id,
                workspaceId: actualWorkspaceId,
                action: 'workspace.update',
                targetType: 'workspace',
                targetId: actualWorkspaceId,
                metadata: {
                    fields: {
                        name,
                        description,
                        isPublic
                    }
                }
            });
        } catch (e) {
            console.warn('Audit log failed (workspace update):', e.message);
        }

        res.json(updatedWorkspace);
    } catch (err) {
        console.error("Error updating workspace:", err);
        res.status(500).json({ message: 'Error updating workspace' });
    }
});

// Delete workspace
router.delete('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const workspaceId = req.params.id;
        const db = getDb();

        // Don't allow deleting personal workspace
        if (workspaceId === "ws1") {
            return res.status(400).json({ message: 'Cannot delete personal workspace' });
        }

        // Try to delete from MongoDB if it exists
        const workspace = await db.collection('workspaces')
            .findOne({ _id: new ObjectId(workspaceId) });

        if (workspace && workspace.isPersonal) {
            return res.status(400).json({ message: 'Cannot delete personal workspace' });
        }

        if (workspace) {
            await db.collection('workspaces').deleteOne({ _id: new ObjectId(workspaceId) });
        }

        // Audit log: workspace deleted
        try {
            await AuditLogger.log({
                req,
                actorId: req.user.id,
                workspaceId,
                action: 'workspace.delete',
                targetType: 'workspace',
                targetId: workspaceId,
                metadata: { isPersonal: workspace?.isPersonal || false }
            });
        } catch (e) {
            console.warn('Audit log failed (workspace delete):', e.message);
        }

        // Also remove from in-memory store if it exists
        if (workspacesStore[workspaceId]) {
            delete workspacesStore[workspaceId];
        }

        // Return success response
        res.json({ message: 'Workspace deleted successfully' });
    } catch (err) {
        console.error("Error deleting workspace:", err);
        res.status(500).json({ message: 'Error deleting workspace' });
    }
});

// Get workspace version history
router.get('/:id/versions', authenticateJWT, async (req, res) => {
    try {
        const workspaceId = req.params.id;

        // In a real implementation, this would query from MongoDB
        // For now, we'll return mock version history data
        const versionHistory = [
            {
                id: `v-${Date.now()}-1`,
                entityType: 'workspace',
                entityId: workspaceId,
                userId: req.user.id,
                userName: req.user.name || 'Anonymous User',
                timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
                message: 'Updated workspace settings',
                type: 'commit',
                changes: {
                    modified: [
                        {
                            field: 'name',
                            oldValue: 'Old Workspace Name',
                            newValue: 'New Workspace Name'
                        },
                        {
                            field: 'description',
                            oldValue: 'Old description',
                            newValue: 'Updated description for the workspace'
                        }
                    ]
                }
            },
            {
                id: `v-${Date.now()}-2`,
                entityType: 'workspace',
                entityId: workspaceId,
                userId: req.user.id,
                userName: req.user.name || 'Anonymous User',
                timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
                message: 'Added new collaborator',
                type: 'commit',
                changes: {
                    added: [
                        {
                            field: 'collaborators',
                            value: {
                                userId: 'user-123',
                                displayName: 'Jane Smith',
                                email: 'jane@example.com',
                                role: 'editor'
                            }
                        }
                    ]
                }
            }
        ];

        res.json(versionHistory);
    } catch (err) {
        console.error("Error fetching workspace version history:", err);
        res.status(500).json({ message: 'Error fetching workspace version history' });
    }
});

// Save a new version for a workspace
router.post('/:id/versions', authenticateJWT, async (req, res) => {
    try {
        const workspaceId = req.params.id;
        const { changes, message, userId } = req.body;

        if (!changes) {
            return res.status(400).json({ message: 'Changes are required' });
        }

        // In a real implementation, this would save to MongoDB
        // For now, we'll just create a mock version object
        const newVersion = {
            id: `v-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            entityType: 'workspace',
            entityId: workspaceId,
            userId: userId || req.user.id,
            userName: req.user.name || 'Anonymous User',
            timestamp: new Date(),
            message: message || 'Updated workspace',
            type: 'commit',
            changes
        };

        // Log the created version
        console.log('Created new workspace version:', newVersion);

        res.status(201).json(newVersion);
    } catch (err) {
        console.error("Error saving workspace version:", err);
        res.status(500).json({ message: 'Error saving workspace version' });
    }
});

// Get workspace merge requests
router.get('/:id/merge-requests', ensureAuthenticated, async (req, res) => {
    try {
        const workspaceId = req.params.id;

        // Mock merge requests data based on workspace ID
        let mergeRequests = [];

        switch (workspaceId) {
            case "ws1":
                mergeRequests = [];
                break;
            case "ws2":
                mergeRequests = [
                    {
                        _id: "mr1",
                        title: "Update Authentication APIs",
                        description: "Adding new OAuth2 endpoints",
                        sourceCollection: {
                            _id: "coll9",
                            name: "OAuth2 Implementation"
                        },
                        targetCollection: {
                            _id: "coll5",
                            name: "Authentication APIs"
                        },
                        status: "pending",
                        createdBy: {
                            userId: "member1",
                            displayName: "Team Member 1",
                            email: "member1@example.com"
                        },
                        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
                        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)  // 1 day ago
                    },
                    {
                        _id: "mr2",
                        title: "New User API Endpoints",
                        description: "Adding subscription management endpoints",
                        sourceCollection: {
                            _id: "coll10",
                            name: "Subscription APIs"
                        },
                        targetCollection: {
                            _id: "coll6",
                            name: "User Management APIs"
                        },
                        status: "approved",
                        createdBy: {
                            userId: "member3",
                            displayName: "Team Member 3",
                            email: "member3@example.com"
                        },
                        actionBy: {
                            userId: "other-user-id",
                            displayName: "Team Lead",
                            email: "team.lead@example.com"
                        },
                        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
                        updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)  // 4 days ago
                    },
                    {
                        _id: "mr3",
                        title: "Deprecated API Removal",
                        description: "Removing old v1 endpoints",
                        sourceCollection: {
                            _id: "coll11",
                            name: "API Cleanup"
                        },
                        targetCollection: {
                            _id: "coll4",
                            name: "API Testing Collection"
                        },
                        status: "rejected",
                        createdBy: {
                            userId: "member2",
                            displayName: "Team Member 2",
                            email: "member2@example.com"
                        },
                        actionBy: {
                            userId: "other-user-id",
                            displayName: "Team Lead",
                            email: "team.lead@example.com"
                        },
                        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
                        updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)  // 7 days ago
                    }
                ];
                break;
            case "ws3":
                mergeRequests = [
                    {
                        _id: "mr4",
                        title: "Add Payment API Documentation",
                        description: "New payment gateway documentation",
                        sourceCollection: {
                            _id: "coll12",
                            name: "Payment APIs"
                        },
                        targetCollection: {
                            _id: "coll7",
                            name: "Public API Documentation"
                        },
                        status: "pending",
                        createdBy: {
                            userId: "contributor1",
                            displayName: "Contributor 1",
                            email: "contributor1@example.com"
                        },
                        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
                        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)  // 2 days ago
                    }
                ];
                break;
            default:
                mergeRequests = [];
        }

        res.json(mergeRequests);
    } catch (err) {
        console.error("Error fetching workspace merge requests:", err);
        res.status(500).json({ message: 'Error fetching workspace merge requests' });
    }
});

// Get global variables for a workspace
router.get('/:workspaceId/global-variables', async (req, res) => {
    try {
        const { workspaceId } = req.params;

        // Validate workspaceId format FIRST, before authentication
        if (!ObjectId.isValid(workspaceId)) {
            return res.status(400).json({
                message: 'Invalid workspace ID format',
                variables: []
            });
        }

        // Now check authentication
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const userId = req.user.id;
        const db = getDb();

        // Check if user has access to workspace
        const workspace = await db.collection('workspaces').findOne({
            _id: new ObjectId(workspaceId),
            $or: [
                { owner: userId },
                { "collaborators.userId": userId }
            ]
        });

        if (!workspace) {
            return res.status(404).json({ message: 'Workspace not found' });
        }

        res.json({ variables: workspace.globalVariables || [] });
    } catch (err) {
        console.error("Error fetching global variables:", err);
        res.status(500).json({ message: 'Error fetching global variables' });
    }
});

// Update global variables for a workspace
router.put('/:workspaceId/global-variables', async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const { variables } = req.body;

        // Validate workspaceId format FIRST, before authentication
        if (!ObjectId.isValid(workspaceId)) {
            return res.status(400).json({
                message: 'Invalid workspace ID format'
            });
        }

        // Now check authentication
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const userId = req.user.id;
        const db = getDb();

        // Check if user has access to workspace
        const workspace = await db.collection('workspaces').findOne({
            _id: new ObjectId(workspaceId),
            $or: [
                { owner: userId },
                { "collaborators.userId": userId }
            ]
        });

        if (!workspace) {
            return res.status(404).json({ message: 'Workspace not found' });
        }

        // Check if user has write permissions
        const isOwner = workspace.owner === userId;
        const collaborator = workspace.collaborators?.find(c => c.userId === userId);
        const canWrite = isOwner || (collaborator && ['admin', 'editor'].includes(collaborator.role));

        if (!canWrite) {
            return res.status(403).json({ message: 'Insufficient permissions' });
        }

        // Validate variables format
        if (!Array.isArray(variables)) {
            return res.status(400).json({ message: 'Variables must be an array' });
        }

        // Update workspace with new global variables
        const result = await db.collection('workspaces').updateOne(
            { _id: new ObjectId(workspaceId) },
            {
                $set: {
                    globalVariables: variables,
                    updatedAt: new Date()
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Workspace not found' });
        }

        res.json({
            message: 'Global variables updated successfully',
            variables
        });
    } catch (err) {
        console.error("Error updating global variables:", err);
        res.status(500).json({ message: 'Error updating global variables' });
    }
});

module.exports = router;