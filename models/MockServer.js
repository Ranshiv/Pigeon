// models/MockServer.js
const mongoose = require('mongoose');

const mockServerSchema = new mongoose.Schema({
    collectionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Collection',
        required: true
    },
    versionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ApiVersion',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: ''
    },
    isActive: {
        type: Boolean,
        default: true
    },
    baseUrl: {
        type: String,
        required: true
    },
    port: {
        type: Number,
        default: null
    },
    mockEndpoints: [{
        path: {
            type: String,
            required: true
        },
        method: {
            type: String,
            enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
            required: true
        },
        statusCode: {
            type: Number,
            default: 200
        },
        responseHeaders: {
            type: Map,
            of: String,
            default: new Map()
        },
        responseBody: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        responseDelay: {
            type: Number,
            default: 0
        },
        isCustomizable: {
            type: Boolean,
            default: true
        }
    }],
    globalConfig: {
        defaultDelay: {
            type: Number,
            default: 0
        },
        corsEnabled: {
            type: Boolean,
            default: true
        },
        corsOrigins: [{
            type: String
        }],
        rateLimit: {
            enabled: {
                type: Boolean,
                default: false
            },
            requests: {
                type: Number,
                default: 100
            },
            windowMs: {
                type: Number,
                default: 15 * 60 * 1000 // 15 minutes
            }
        }
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Index for efficient querying
mockServerSchema.index({ collectionId: 1, versionId: 1 });

// Middleware to update updatedAt
mockServerSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('MockServer', mockServerSchema);
