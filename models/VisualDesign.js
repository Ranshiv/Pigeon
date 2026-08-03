// models/VisualDesign.js
const mongoose = require('mongoose');

// Node schema for visual design elements
const nodeSchema = new mongoose.Schema({
    id: { type: String, required: true },
    type: {
        type: String,
        required: true,
        enum: ['endpoint', 'schema', 'parameter', 'info', 'security', 'resource']
    },
    position: {
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 }
    },
    dimensions: {
        width: { type: Number, default: 240 },
        height: { type: Number, default: 128 }
    },
    data: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
});

// Edge/Connection schema for relationships between nodes
const edgeSchema = new mongoose.Schema({
    id: { type: String, required: true },
    source: { type: String, required: true },
    target: { type: String, required: true },
    type: {
        type: String,
        default: 'default',
        enum: ['default', 'orthogonal', 'bezier', 'step']
    },
    data: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
});

// Main Visual Design schema
const visualDesignSchema = new mongoose.Schema({
    // Association with collection
    collectionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Collection',
        required: true,
        index: true
    },

    // Owner information
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Design metadata
    name: {
        type: String,
        default: 'Untitled Design'
    },
    description: {
        type: String,
        default: ''
    },

    // Design state
    nodes: [nodeSchema],
    edges: [edgeSchema],

    // Viewport settings
    viewport: {
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 },
        zoom: { type: Number, default: 1 }
    },

    // Generated OpenAPI specification
    openApiSpec: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },

    // Version control
    version: {
        type: String,
        default: '1.0.0'
    },
    branch: {
        type: String,
        default: 'main'
    },

    // Collaboration
    collaborators: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        role: {
            type: String,
            enum: ['viewer', 'editor', 'owner'],
            default: 'viewer'
        },
        joinedAt: { type: Date, default: Date.now }
    }],

    // Status
    isPublic: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['draft', 'published', 'archived'],
        default: 'draft'
    },

    // Metadata
    tags: [{ type: String }],
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    // Timestamps
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Indexes for better query performance
visualDesignSchema.index({ collectionId: 1, userId: 1 });
visualDesignSchema.index({ status: 1 });
visualDesignSchema.index({ isPublic: 1 });
visualDesignSchema.index({ 'collaborators.userId': 1 });

// Pre-save middleware to update timestamps
visualDesignSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

// Virtual for getting node count
visualDesignSchema.virtual('nodeCount').get(function () {
    return this.nodes ? this.nodes.length : 0;
});

// Virtual for getting edge count
visualDesignSchema.virtual('edgeCount').get(function () {
    return this.edges ? this.edges.length : 0;
});

// Method to check if user has access to design
visualDesignSchema.methods.hasAccess = function (userId, requiredRole = 'viewer') {
    // Owner always has access
    if (this.userId.toString() === userId) {
        return true;
    }

    // Check collaborators
    const collaborator = this.collaborators.find(
        collab => collab.userId.toString() === userId
    );

    if (!collaborator) {
        return this.isPublic && requiredRole === 'viewer';
    }

    // Role hierarchy: viewer < editor < owner
    const roles = ['viewer', 'editor', 'owner'];
    const userRoleIndex = roles.indexOf(collaborator.role);
    const requiredRoleIndex = roles.indexOf(requiredRole);

    return userRoleIndex >= requiredRoleIndex;
};

// Method to add or update collaborator
visualDesignSchema.methods.addCollaborator = function (userId, role = 'viewer') {
    const existingIndex = this.collaborators.findIndex(
        collab => collab.userId.toString() === userId
    );

    const collaboratorData = {
        userId,
        role,
        joinedAt: new Date()
    };

    if (existingIndex >= 0) {
        this.collaborators[existingIndex] = collaboratorData;
    } else {
        this.collaborators.push(collaboratorData);
    }

    return this.save();
};

// Static method to find by collection and user
visualDesignSchema.statics.findByCollectionAndUser = function (collectionId, userId) {
    return this.findOne({
        collectionId: collectionId,
        userId: userId
    });
};

module.exports = mongoose.model('VisualDesign', visualDesignSchema);