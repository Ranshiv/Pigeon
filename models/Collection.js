// models/Collection.js
const mongoose = require('mongoose');

const variableSchema = new mongoose.Schema({
    key: { type: String, required: true },
    value: { type: String, required: true },
    description: { type: String, default: '' },
    type: { type: String, enum: ['string', 'number', 'boolean', 'object'], default: 'string' },
    isSecret: { type: Boolean, default: false },
    enabled: { type: Boolean, default: true }
});

const requestSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: '' },
    url: { type: String, required: true },
    method: { type: String, required: true, enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD', 'GRAPHQL'] },
    protocol: { type: String, enum: ['http', 'websocket', 'grpc', 'soap', 'mqtt', 'sse', 'graphql'], default: 'http' },
    headers: [{ name: String, key: String, value: String, description: String, enabled: { type: Boolean, default: true } }],
    params: [{ name: String, key: String, value: String, description: String, enabled: { type: Boolean, default: true } }],
    body: { type: String, default: '' },
    bodyType: { type: String, enum: ['none', 'json', 'form-data', 'x-www-form-urlencoded', 'raw', 'binary', 'graphql'], default: 'none' },
    bodyFormData: [{
        key: String,
        name: String,
        value: String,
        description: String,
        enabled: { type: Boolean, default: true },
        type: { type: String, default: 'text' },
        src: { type: mongoose.Schema.Types.Mixed, default: null }
    }],

    // GraphQL-specific fields
    graphql: {
        query: { type: String, default: '' },
        variables: { type: mongoose.Schema.Types.Mixed, default: {} },
        operationType: { type: String, enum: ['query', 'mutation', 'subscription', ''], default: '' },
        operationName: { type: String, default: '' },
        schema: { type: String, default: '' },
        schemaUrl: { type: String, default: '' },
    },

    preRequestScript: { type: String, default: '' },
    testScript: { type: String, default: '' },
    tests: { type: String, default: '' },
    authConfig: { type: mongoose.Schema.Types.Mixed, default: {} },
    sslConfig: { type: mongoose.Schema.Types.Mixed, default: {} },
    folderPath: [{ type: String }],
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    order: { type: Number, default: 0 }, // For ordering requests within collection
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const documentationSchema = new mongoose.Schema({
    title: { type: String, default: '' },
    content: { type: String, default: '' },
    settings: {
        isPublic: { type: Boolean, default: false },
        metaTitle: { type: String, default: '' },
        metaDescription: { type: String, default: '' },
        customCSS: { type: String, default: '' },
        customJS: { type: String, default: '' },
        theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'light' },
        showRequestResponses: { type: Boolean, default: true },
        showTOC: { type: Boolean, default: true }
    },
    lastModifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    lastModifiedAt: { type: Date, default: Date.now }
});

const collectionSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: '' },

    // Workspace association
    workspaceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workspace',
        required: false
    },

    // Owner and permissions
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // Collection-level variables
    variables: [variableSchema],

    // Collection content
    requests: [requestSchema],

    // Documentation
    documentation: documentationSchema,

    // Settings
    isPublic: { type: Boolean, default: false },

    // Collaboration
    collaborators: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        email: { type: String },
        displayName: { type: String },
        role: {
            type: String,
            enum: ['viewer', 'editor', 'admin'],
            default: 'viewer'
        },
        joinedAt: { type: Date, default: Date.now }
    }],

    // Version control
    version: { type: String, default: '1.0.0' },
    branch: { type: String, default: 'main' },

    // Fork information
    forkedFrom: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Collection',
        required: false
    },
    forkHistory: [{
        sourceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Collection'
        },
        forkedAt: { type: Date, default: Date.now },
        forkedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }],

    // Statistics
    stats: {
        requestCount: { type: Number, default: 0 },
        totalRuns: { type: Number, default: 0 },
        lastRun: { type: Date },
        successRate: { type: Number, default: 0 }
    },

    // Metadata
    tags: [{ type: String }],
    category: { type: String },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Indexes for better query performance
collectionSchema.index({ userId: 1, workspaceId: 1 });
collectionSchema.index({ owner: 1 });
collectionSchema.index({ name: 1, userId: 1 });
collectionSchema.index({ isPublic: 1 });
collectionSchema.index({ 'collaborators.userId': 1 });

// Pre-save middleware to update timestamps and stats
collectionSchema.pre('validate', function (next) {
    if (this.requests && Array.isArray(this.requests)) {
        this.requests.forEach((request) => {
            ['headers', 'params', 'bodyFormData'].forEach((field) => {
                (request[field] || []).forEach((item) => {
                    if (item?._id && !mongoose.isValidObjectId(item._id)) item._id = undefined;
                });
            });
        });
    }
    next();
});

collectionSchema.pre('save', function (next) {
    this.updatedAt = new Date();

    // Update request count
    if (this.requests && Array.isArray(this.requests)) {
        this.stats.requestCount = this.requests.length;
    }

    // Ensure owner and userId are consistent
    if (!this.owner && this.userId) {
        this.owner = this.userId;
    }

    next();
});

// Virtual for getting total collaborators count
collectionSchema.virtual('collaboratorsCount').get(function () {
    return this.collaborators ? this.collaborators.length : 0;
});

// Method to check if user has access to collection
collectionSchema.methods.hasAccess = function (userId, requiredRole = 'viewer') {
    // Owner always has access
    if (this.userId.toString() === userId || this.owner.toString() === userId) {
        return true;
    }

    // Check collaborators
    const collaborator = this.collaborators.find(
        collab => collab.userId.toString() === userId
    );

    if (!collaborator) {
        return this.isPublic && requiredRole === 'viewer';
    }

    // Role hierarchy: viewer < editor < admin
    const roles = ['viewer', 'editor', 'admin'];
    const userRoleIndex = roles.indexOf(collaborator.role);
    const requiredRoleIndex = roles.indexOf(requiredRole);

    return userRoleIndex >= requiredRoleIndex;
};

// Method to add or update collaborator
collectionSchema.methods.addCollaborator = function (userId, email, displayName, role = 'viewer') {
    const existingIndex = this.collaborators.findIndex(
        collab => collab.userId.toString() === userId
    );

    const collaboratorData = {
        userId,
        email,
        displayName,
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

module.exports = mongoose.model('Collection', collectionSchema);
