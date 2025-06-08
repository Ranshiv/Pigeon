// models/Workspace.js
const mongoose = require('mongoose');

const variableSchema = new mongoose.Schema({
    key: { type: String, required: true },
    value: { type: String, required: true },
    description: { type: String, default: '' },
    isSecret: { type: Boolean, default: false },
    type: { type: String, enum: ['string', 'number', 'boolean', 'object'], default: 'string' }
});

const workspaceSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: '' },

    // Owner
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

    // Global variables for this workspace
    globalVariables: [variableSchema],

    // Workspace settings
    isPublic: { type: Boolean, default: false },
    settings: {
        theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'auto' },
        defaultEnvironment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Environment',
            default: null
        },
        allowGuestAccess: { type: Boolean, default: false },
        requireApprovalForJoin: { type: Boolean, default: true }
    },

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
        permissions: {
            canCreateCollections: { type: Boolean, default: true },
            canCreateEnvironments: { type: Boolean, default: true },
            canManageGlobalVariables: { type: Boolean, default: false },
            canInviteMembers: { type: Boolean, default: false },
            canManageWorkspace: { type: Boolean, default: false }
        },
        joinedAt: { type: Date, default: Date.now }
    }],

    // Statistics
    stats: {
        totalCollections: { type: Number, default: 0 },
        totalRequests: { type: Number, default: 0 },
        totalEnvironments: { type: Number, default: 0 },
        lastActivity: { type: Date, default: Date.now }
    },

    // Metadata
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Indexes
workspaceSchema.index({ userId: 1 });
workspaceSchema.index({ 'collaborators.userId': 1 });
workspaceSchema.index({ isPublic: 1 });
workspaceSchema.index({ createdAt: -1 });

// Pre-save middleware to update timestamps
workspaceSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

// Virtual for checking if user is owner
workspaceSchema.virtual('isOwner').get(function () {
    return this.userId && this.userId.toString() === this.owner.toString();
});

// Method to check user permissions
workspaceSchema.methods.getUserRole = function (userId) {
    if (this.owner.toString() === userId.toString()) {
        return 'owner';
    }

    const collaborator = this.collaborators.find(c =>
        c.userId && c.userId.toString() === userId.toString()
    );

    return collaborator ? collaborator.role : null;
};

// Method to check specific permissions
workspaceSchema.methods.hasPermission = function (userId, permission) {
    const role = this.getUserRole(userId);

    if (role === 'owner') return true;
    if (!role) return false;

    const collaborator = this.collaborators.find(c =>
        c.userId && c.userId.toString() === userId.toString()
    );

    if (!collaborator) return false;

    // Admin role has all permissions
    if (collaborator.role === 'admin') return true;

    // Check specific permission
    return collaborator.permissions && collaborator.permissions[permission] === true;
};

// Method to add or update collaborator
workspaceSchema.methods.addCollaborator = function (userId, email, displayName, role = 'viewer', permissions = {}) {
    const existingIndex = this.collaborators.findIndex(c =>
        c.userId && c.userId.toString() === userId.toString()
    );

    const defaultPermissions = {
        canCreateCollections: role === 'editor' || role === 'admin',
        canCreateEnvironments: role === 'editor' || role === 'admin',
        canManageGlobalVariables: role === 'admin',
        canInviteMembers: role === 'admin',
        canManageWorkspace: role === 'admin'
    };

    const collaborator = {
        userId,
        email,
        displayName,
        role,
        permissions: { ...defaultPermissions, ...permissions },
        joinedAt: new Date()
    };

    if (existingIndex >= 0) {
        this.collaborators[existingIndex] = collaborator;
    } else {
        this.collaborators.push(collaborator);
    }
};

// Method to remove collaborator
workspaceSchema.methods.removeCollaborator = function (userId) {
    this.collaborators = this.collaborators.filter(c =>
        !c.userId || c.userId.toString() !== userId.toString()
    );
};

// Method to get global variable by key
workspaceSchema.methods.getGlobalVariable = function (key) {
    return this.globalVariables.find(v => v.key === key);
};

// Method to set global variable
workspaceSchema.methods.setGlobalVariable = function (key, value, description = '', isSecret = false, type = 'string') {
    const existingIndex = this.globalVariables.findIndex(v => v.key === key);

    const variable = {
        key,
        value,
        description,
        isSecret,
        type
    };

    if (existingIndex >= 0) {
        this.globalVariables[existingIndex] = variable;
    } else {
        this.globalVariables.push(variable);
    }
};

// Method to remove global variable
workspaceSchema.methods.removeGlobalVariable = function (key) {
    this.globalVariables = this.globalVariables.filter(v => v.key !== key);
};

// Method to update stats
workspaceSchema.methods.updateStats = function (stats) {
    Object.assign(this.stats, stats);
    this.stats.lastActivity = new Date();
};

module.exports = mongoose.model('Workspace', workspaceSchema);