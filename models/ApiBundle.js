// models/ApiBundle.js
const mongoose = require('mongoose');

const apiBundleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: ''
    },
    collections: [{
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
        included: {
            type: Boolean,
            default: true
        }
    }],
    pricing: {
        tier: {
            type: String,
            enum: ['free', 'basic', 'pro', 'enterprise'],
            default: 'free'
        },
        pricePerMonth: {
            type: Number,
            default: 0
        },
        pricePerRequest: {
            type: Number,
            default: 0
        }
    },
    rateLimits: {
        requestsPerMinute: {
            type: Number,
            default: 60
        },
        requestsPerHour: {
            type: Number,
            default: 1000
        },
        requestsPerDay: {
            type: Number,
            default: 10000
        },
        burstLimit: {
            type: Number,
            default: 10
        }
    },
    features: [{
        name: String,
        description: String,
        enabled: Boolean
    }],
    documentation: {
        overview: String,
        gettingStarted: String,
        examples: String,
        faq: String
    },
    isPublic: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    tags: [String],
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

// Index for searching
apiBundleSchema.index({ name: 'text', description: 'text', tags: 'text' });

// Middleware to update updatedAt
apiBundleSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('ApiBundle', apiBundleSchema);
