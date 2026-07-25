// models/Environment.js
const mongoose = require('mongoose');

const variableSchema = new mongoose.Schema({
    key: { type: String, required: true },
    value: { type: String, required: true },
    description: { type: String, default: '' },
    isSecret: { type: Boolean, default: false },
    enabled: { type: Boolean, default: true },
    type: { type: String, enum: ['string', 'number', 'boolean', 'object'], default: 'string' }
});

const environmentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: '' },
    type: { type: String, enum: ['global', 'environment'], default: 'environment' },

    // User and workspace association
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    workspaceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workspace',
        required: false // Global environments may not belong to a specific workspace
    },

    // Variables storage
    variables: [variableSchema],

    // Environment metadata
    isActive: { type: Boolean, default: false }, // Whether this is the currently selected environment for the user
    isShared: { type: Boolean, default: false }, // Whether this environment is shared with team
    isReadOnly: { type: Boolean, default: false }, // Whether this environment can be edited

    // Collaboration
    collaborators: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        role: {
            type: String,
            enum: ['viewer', 'editor', 'admin'],
            default: 'viewer'
        },
        addedAt: { type: Date, default: Date.now }
    }],

    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    // Metadata
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Indexes for better query performance
environmentSchema.index({ userId: 1, workspaceId: 1 });
environmentSchema.index({ userId: 1, type: 1 });
environmentSchema.index({ name: 1, userId: 1 });

// Ensure unique environment names per user per workspace
environmentSchema.index({
    name: 1,
    userId: 1,
    workspaceId: 1
}, {
    unique: true
});

// Pre-save middleware to update timestamps
environmentSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('Environment', environmentSchema);
