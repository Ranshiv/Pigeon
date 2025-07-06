// models/ApiVersion.js
const mongoose = require('mongoose');

const apiVersionSchema = new mongoose.Schema({
    collectionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Collection',
        required: true
    },
    version: {
        type: String,
        required: true,
        match: /^v?\d+(\.\d+){0,2}$/  // Supports v1, v1.0, v1.0.0, 1, 1.0, 1.0.0
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
    isDeprecated: {
        type: Boolean,
        default: false
    },
    deprecationDate: {
        type: Date,
        default: null
    },
    sunsetDate: {
        type: Date,
        default: null
    },
    versioningStrategy: {
        type: String,
        enum: ['url', 'header', 'query', 'accept'],
        default: 'url'
    },
    versioningConfig: {
        headerName: {
            type: String,
            default: 'API-Version'
        },
        queryParam: {
            type: String,
            default: 'version'
        },
        urlPattern: {
            type: String,
            default: '/api/v{version}'
        },
        acceptPattern: {
            type: String,
            default: 'application/vnd.api+json;version={version}'
        }
    },
    openApiSpec: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    changelog: {
        type: String,
        default: ''
    },
    migrationGuide: {
        type: String,
        default: ''
    },
    backwardCompatible: {
        type: Boolean,
        default: true
    },
    breakingChanges: [{
        change: String,
        description: String,
        mitigationStrategy: String
    }],
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

// Compound index to ensure unique versions per collection
apiVersionSchema.index({ collectionId: 1, version: 1 }, { unique: true });

// Middleware to update updatedAt
apiVersionSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('ApiVersion', apiVersionSchema);
