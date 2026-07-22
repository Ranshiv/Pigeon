// routes/environments.js
const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const Environment = require('../models/Environment');
const VariableResolver = require('../services/VariableResolver');
const { ensureAuthenticated } = require('../middleware/auth');

// GET /api/environments - Get all environments for current user
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const { workspaceId, type } = req.query;
        const userId = req.user.id;

        // Try MongoDB first
        try {
            let query = { userId };

            // Add workspace filter if provided
            if (workspaceId) {
                query.workspaceId = workspaceId;
            }

            // Add type filter if provided (global, environment)
            if (type) {
                query.type = type;
            }

            const environments = await Environment.find(query)
                .sort({ type: 1, name: 1 }) // Global first, then alphabetical
                .populate('collaborators.userId', 'displayName email');

            return res.json(environments);
        } catch (mongoError) {
            console.log(`MongoDB lookup failed for user ${userId}, returning mock environments...`);

            // Return mock environments for development/testing
            const mockEnvironments = [
                {
                    _id: "env1",
                    name: "Development",
                    description: "Development environment variables",
                    type: "environment",
                    userId: userId,
                    workspaceId: workspaceId || null,
                    variables: [
                        { key: "BASE_URL", value: "http://localhost:3000", description: "Development API base URL" },
                        { key: "API_KEY", value: "dev-api-key-123", description: "Development API key" }
                    ],
                    isShared: false,
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                {
                    _id: "env2",
                    name: "Staging",
                    description: "Staging environment variables",
                    type: "environment",
                    userId: userId,
                    workspaceId: workspaceId || null,
                    variables: [
                        { key: "BASE_URL", value: "https://staging-api.example.com", description: "Staging API base URL" },
                        { key: "API_KEY", value: "staging-api-key-456", description: "Staging API key" }
                    ],
                    isShared: true,
                    isActive: false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                {
                    _id: "env3",
                    name: "Production",
                    description: "Production environment variables",
                    type: "environment",
                    userId: userId,
                    workspaceId: workspaceId || null,
                    variables: [
                        { key: "BASE_URL", value: "https://api.example.com", description: "Production API base URL" },
                        { key: "API_KEY", value: "prod-api-key-789", description: "Production API key" }
                    ],
                    isShared: false,
                    isActive: false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                {
                    _id: "global1",
                    name: "Global Variables",
                    description: "Global variables shared across all environments",
                    type: "global",
                    userId: userId,
                    workspaceId: workspaceId || null,
                    variables: [
                        { key: "TIMEOUT", value: "30000", description: "Request timeout in milliseconds" },
                        { key: "USER_AGENT", value: "Pigeon-API-Client/1.0", description: "Default user agent string" }
                    ],
                    isShared: true,
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ];

            // Filter by type if specified
            let filteredEnvironments = mockEnvironments;
            if (type) {
                filteredEnvironments = mockEnvironments.filter(env => env.type === type);
            }

            return res.json(filteredEnvironments);
        }
    } catch (error) {
        console.error('Error fetching environments:', error);
        res.status(500).json({ error: 'Failed to fetch environments' });
    }
});

// GET /api/environments/active/:workspaceId? - Get active environment for workspace
// Must precede /:id or Express matches "active" as an id.
router.get('/active/:workspaceId?', ensureAuthenticated, async (req, res) => {
    try {
        const workspaceId = req.params.workspaceId === 'null' ? null : req.params.workspaceId;

        const activeEnvironment = await Environment.findOne({
            userId: req.user.id,
            workspaceId: workspaceId,
            type: 'environment',
            isActive: true
        });

        res.json(activeEnvironment);
    } catch (error) {
        console.error('Error fetching active environment:', error);
        res.status(500).json({ error: 'Failed to fetch active environment' });
    }
});

// GET /api/environments/:id - Get specific environment
router.get('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const environmentId = req.params.id;

        // Validate environmentId format FIRST, before database lookup
        if (ObjectId.isValid(environmentId)) {
            // Try MongoDB for valid ObjectIds
            try {
                const environment = await Environment.findById(environmentId)
                    .populate('collaborators.userId', 'displayName email');

                if (environment) {
                    // Check access permissions
                    if (!hasEnvironmentAccess(environment, req.user.id)) {
                        return res.status(403).json({ error: 'Access denied' });
                    }
                    return res.json(environment);
                }
            } catch (mongoError) {
                console.log(`MongoDB lookup failed for environment ${environmentId}, checking mock environments...`);
            }
        }

        // Check mock environments for development/testing
        const mockEnvironmentIds = ['env1', 'env2', 'env3', 'global1'];
        if (mockEnvironmentIds.includes(environmentId)) {
            const userId = req.user.id;
            const mockEnvironments = {
                env1: {
                    _id: "env1",
                    name: "Development",
                    description: "Development environment variables",
                    type: "environment",
                    userId: userId,
                    variables: [
                        { key: "BASE_URL", value: "http://localhost:3000", description: "Development API base URL" },
                        { key: "API_KEY", value: "dev-api-key-123", description: "Development API key" }
                    ],
                    isShared: false,
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                env2: {
                    _id: "env2",
                    name: "Staging",
                    description: "Staging environment variables",
                    type: "environment",
                    userId: userId,
                    variables: [
                        { key: "BASE_URL", value: "https://staging-api.example.com", description: "Staging API base URL" },
                        { key: "API_KEY", value: "staging-api-key-456", description: "Staging API key" }
                    ],
                    isShared: true,
                    isActive: false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                env3: {
                    _id: "env3",
                    name: "Production",
                    description: "Production environment variables",
                    type: "environment",
                    userId: userId,
                    variables: [
                        { key: "BASE_URL", value: "https://api.example.com", description: "Production API base URL" },
                        { key: "API_KEY", value: "prod-api-key-789", description: "Production API key" }
                    ],
                    isShared: false,
                    isActive: false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                global1: {
                    _id: "global1",
                    name: "Global Variables",
                    description: "Global variables shared across all environments",
                    type: "global",
                    userId: userId,
                    variables: [
                        { key: "TIMEOUT", value: "30000", description: "Request timeout in milliseconds" },
                        { key: "USER_AGENT", value: "Pigeon-API-Client/1.0", description: "Default user agent string" }
                    ],
                    isShared: true,
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            };

            return res.json(mockEnvironments[req.params.id]);
        }

        return res.status(404).json({ error: 'Environment not found' });
    } catch (error) {
        console.error('Error fetching environment:', error);
        res.status(500).json({ error: 'Failed to fetch environment' });
    }
});

// POST /api/environments - Create new environment
router.post('/', ensureAuthenticated, async (req, res) => {
    try {
        const {
            name,
            description,
            type = 'environment',
            workspaceId,
            variables = [],
            isShared = false
        } = req.body;

        // Validate required fields
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Environment name is required' });
        }

        // Try MongoDB first
        try {
            // Check for duplicate names
            const existingEnv = await Environment.findOne({
                name: name.trim(),
                userId: req.user.id,
                workspaceId: workspaceId || null
            });

            if (existingEnv) {
                return res.status(400).json({ error: 'Environment with this name already exists' });
            }

            // For global environments, ensure only one per user/workspace
            if (type === 'global') {
                const existingGlobal = await Environment.findOne({
                    type: 'global',
                    userId: req.user.id,
                    workspaceId: workspaceId || null
                });

                if (existingGlobal) {
                    return res.status(400).json({
                        error: 'Global environment already exists for this workspace'
                    });
                }
            }

            const environment = new Environment({
                name: name.trim(),
                description: description || '',
                type,
                userId: req.user.id,
                workspaceId: workspaceId || null,
                variables,
                isShared
            });

            await environment.save();
            return res.status(201).json(environment);
        } catch (mongoError) {
            console.log(`MongoDB operation failed for user ${req.user.id}, creating mock environment...`);

            // Return mock environment response for development
            const mockEnvironment = {
                _id: `env${Date.now()}`, // Generate unique ID
                name: name.trim(),
                description: description || '',
                type,
                userId: req.user.id,
                workspaceId: workspaceId || null,
                variables,
                isShared,
                isActive: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            return res.status(201).json(mockEnvironment);
        }
    } catch (error) {
        console.error('Error creating environment:', error);
        res.status(500).json({ error: 'Failed to create environment' });
    }
});

// PUT /api/environments/:id - Update environment
router.put('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const environmentId = req.params.id;

        // Validate environmentId format FIRST
        if (!ObjectId.isValid(environmentId)) {
            return res.status(400).json({
                error: 'Invalid environment ID format'
            });
        }

        const environment = await Environment.findById(environmentId);

        if (!environment) {
            return res.status(404).json({ error: 'Environment not found' });
        }

        // Check write permissions
        if (!hasEnvironmentAccess(environment, req.user.id, 'editor')) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const {
            name,
            description,
            variables,
            isShared,
            isActive
        } = req.body;

        // Update fields
        if (name !== undefined) environment.name = name.trim();
        if (description !== undefined) environment.description = description;
        if (variables !== undefined) environment.variables = variables;
        if (isShared !== undefined) environment.isShared = isShared;
        if (isActive !== undefined) {
            // If setting this environment as active, deactivate others
            if (isActive) {
                await Environment.updateMany(
                    {
                        userId: req.user.id,
                        workspaceId: environment.workspaceId,
                        type: environment.type,
                        _id: { $ne: environment._id }
                    },
                    { isActive: false }
                );
            }
            environment.isActive = isActive;
        }

        await environment.save();

        res.json(environment);
    } catch (error) {
        console.error('Error updating environment:', error);
        res.status(500).json({ error: 'Failed to update environment' });
    }
});

// DELETE /api/environments/:id - Delete environment
router.delete('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const environmentId = req.params.id;

        // Validate environmentId format FIRST
        if (!ObjectId.isValid(environmentId)) {
            return res.status(400).json({
                error: 'Invalid environment ID format'
            });
        }

        const environment = await Environment.findById(environmentId);

        if (!environment) {
            return res.status(404).json({ error: 'Environment not found' });
        }

        // Check permissions
        if (!hasEnvironmentAccess(environment, req.user.id, 'admin')) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        // Prevent deletion of global environments if they contain variables
        if (environment.type === 'global' && environment.variables.length > 0) {
            return res.status(400).json({
                error: 'Cannot delete global environment with variables. Clear variables first.'
            });
        }

        await Environment.findByIdAndDelete(req.params.id);

        res.json({ message: 'Environment deleted successfully' });
    } catch (error) {
        console.error('Error deleting environment:', error);
        res.status(500).json({ error: 'Failed to delete environment' });
    }
});

// GET /api/environments/:id/variables - Get environment variables
router.get('/:id/variables', ensureAuthenticated, async (req, res) => {
    try {
        const environmentId = req.params.id;

        // Validate environmentId format FIRST, before authentication/database lookup
        if (!ObjectId.isValid(environmentId)) {
            return res.status(400).json({
                message: 'Invalid environment ID format',
                variables: []
            });
        }

        const environment = await Environment.findById(environmentId);

        if (!environment) {
            return res.status(404).json({
                message: 'Environment not found',
                variables: []
            });
        }

        if (!hasEnvironmentAccess(environment, req.user.id)) {
            return res.status(403).json({
                message: 'Access denied',
                variables: []
            });
        }

        res.json({ variables: environment.variables || [] });
    } catch (error) {
        console.error('Error fetching environment variables:', error);
        res.status(500).json({
            message: 'Error fetching environment variables',
            variables: []
        });
    }
});

// POST /api/environments/:id/variables - Add/Update variable in environment
router.post('/:id/variables', ensureAuthenticated, async (req, res) => {
    try {
        const environmentId = req.params.id;

        // Validate environmentId format FIRST
        if (!ObjectId.isValid(environmentId)) {
            return res.status(400).json({
                error: 'Invalid environment ID format'
            });
        }

        const environment = await Environment.findById(environmentId);

        if (!environment) {
            return res.status(404).json({ error: 'Environment not found' });
        }

        if (!hasEnvironmentAccess(environment, req.user.id, 'editor')) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const { key, value, description, isSecret, type } = req.body;

        if (!key || !key.trim()) {
            return res.status(400).json({ error: 'Variable key is required' });
        }

        // Check if variable already exists
        const existingIndex = environment.variables.findIndex(v => v.key === key.trim());

        const variableData = {
            key: key.trim(),
            value: value || '',
            description: description || '',
            isSecret: isSecret || false,
            type: type || 'string'
        };

        if (existingIndex >= 0) {
            // Update existing variable
            environment.variables[existingIndex] = variableData;
        } else {
            // Add new variable
            environment.variables.push(variableData);
        }

        await environment.save();

        res.json(environment);
    } catch (error) {
        console.error('Error updating variable:', error);
        res.status(500).json({ error: 'Failed to update variable' });
    }
});

// DELETE /api/environments/:id/variables/:key - Delete variable from environment
router.delete('/:id/variables/:key', ensureAuthenticated, async (req, res) => {
    try {
        const environmentId = req.params.id;

        // Validate environmentId format FIRST
        if (!ObjectId.isValid(environmentId)) {
            return res.status(400).json({
                error: 'Invalid environment ID format'
            });
        }

        const environment = await Environment.findById(environmentId);

        if (!environment) {
            return res.status(404).json({ error: 'Environment not found' });
        }

        if (!hasEnvironmentAccess(environment, req.user.id, 'editor')) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const variableKey = decodeURIComponent(req.params.key);

        // Remove variable
        environment.variables = environment.variables.filter(v => v.key !== variableKey);

        await environment.save();

        res.json(environment);
    } catch (error) {
        console.error('Error deleting variable:', error);
        res.status(500).json({ error: 'Failed to delete variable' });
    }
});

// POST /api/environments/:id/collaborators - Add collaborator
router.post('/:id/collaborators', ensureAuthenticated, async (req, res) => {
    try {
        const environment = await Environment.findById(req.params.id);

        if (!environment) {
            return res.status(404).json({ error: 'Environment not found' });
        }

        if (!hasEnvironmentAccess(environment, req.user.id, 'admin')) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const { userId, role = 'viewer' } = req.body;

        // Check if user is already a collaborator
        const existingIndex = environment.collaborators.findIndex(
            c => c.userId.toString() === userId
        );

        if (existingIndex >= 0) {
            // Update existing collaborator role
            environment.collaborators[existingIndex].role = role;
        } else {
            // Add new collaborator
            environment.collaborators.push({
                userId,
                role,
                addedAt: new Date()
            });
        }

        await environment.save();

        // Populate and return updated environment
        await environment.populate('collaborators.userId', 'displayName email');

        res.json(environment);
    } catch (error) {
        console.error('Error adding collaborator:', error);
        res.status(500).json({ error: 'Failed to add collaborator' });
    }
});

// POST /api/environments/resolve - Resolve variables for a context
router.post('/resolve', ensureAuthenticated, async (req, res) => {
    try {
        const {
            environmentId,
            collectionId,
            workspaceId,
            requestLocalVariables = {}
        } = req.body;

        const resolver = new VariableResolver();

        const contextId = `resolve-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const context = await resolver.createContext(contextId, {
            userId: req.user.id,
            workspaceId,
            environmentId,
            collectionId,
            requestLocalVariables
        });

        // Return the resolved context layers
        res.json({
            contextId,
            layers: context.layers,
            resolution: {
                global: Object.keys(context.layers.global).length,
                collection: Object.keys(context.layers.collection).length,
                environment: Object.keys(context.layers.environment).length,
                request: Object.keys(context.layers.request).length
            }
        });
    } catch (error) {
        console.error('Error resolving variables:', error);
        res.status(500).json({ error: 'Failed to resolve variables' });
    }
});

// Utility function to check environment access
function hasEnvironmentAccess(environment, userId, requiredRole = 'viewer') {
    // Owner always has access
    if (environment.userId.toString() === userId) {
        return true;
    }

    // Check collaborators
    const collaborator = environment.collaborators.find(
        c => c.userId.toString() === userId
    );

    if (!collaborator) {
        return environment.isShared && requiredRole === 'viewer';
    }

    // Role hierarchy: viewer < editor < admin
    const roles = ['viewer', 'editor', 'admin'];
    const userRoleIndex = roles.indexOf(collaborator.role);
    const requiredRoleIndex = roles.indexOf(requiredRole);

    return userRoleIndex >= requiredRoleIndex;
}

module.exports = router;
