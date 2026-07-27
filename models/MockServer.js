// models/MockServer.js
const mongoose = require('mongoose');

// Schema for scenario trigger conditions
const triggerConditionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['header', 'query', 'body', 'method', 'path', 'probability', 'counter', 'sequential'],
        required: true
    },
    key: {
        type: String,
        default: ''
    },
    operator: {
        type: String,
        enum: ['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', 'matches', 'exists', 'not_exists', 'greater_than', 'less_than'],
        default: 'equals'
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        default: ''
    },
    logic: {
        type: String,
        enum: ['AND', 'OR'],
        default: 'AND'
    }
}, { _id: false });

// Schema for scenario responses
const scenarioResponseSchema = new mongoose.Schema({
    name: {
        type: String,
        default: 'Default Response'
    },
    statusCode: {
        type: Number,
        default: 200
    },
    headers: {
        type: Map,
        of: String,
        default: new Map([['Content-Type', 'application/json']])
    },
    body: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    delay: {
        type: Number,
        default: 0
    },
    weight: {
        type: Number,
        default: 100, // Percentage weight for weighted responses
        min: 0,
        max: 100
    }
}, { _id: true });

// Schema for mock scenarios
const mockScenarioSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: ''
    },
    endpointPath: {
        type: String,
        required: true
    },
    endpointMethod: {
        type: String,
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD', '*'],
        default: '*'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    priority: {
        type: Number,
        default: 0 // Higher priority scenarios are evaluated first
    },
    triggerConditions: [triggerConditionSchema],
    responses: [scenarioResponseSchema],
    useWeightedResponses: {
        type: Boolean,
        default: false
    },
    sequentialIndex: {
        type: Number,
        default: 0 // For sequential response cycling
    }
}, { timestamps: true });

// Fault profiles are deliberately embedded in their mock server so a server can be
// exported, cloned and deleted without leaving an orphaned experiment behind.
const faultProfileSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: '', maxlength: 500 },
    isActive: { type: Boolean, default: true },
    priority: { type: Number, default: 0 },
    target: {
        method: { type: String, default: '*' },
        path: { type: String, default: '*' }
    },
    probability: { type: Number, default: 100, min: 0, max: 100 },
    schedule: {
        mode: { type: String, enum: ['continuous', 'burst'], default: 'continuous' },
        startAt: { type: Date, default: Date.now },
        intervalMs: { type: Number, default: 60000, min: 1000, max: 86400000 },
        durationMs: { type: Number, default: 10000, min: 100, max: 86400000 }
    },
    fault: {
        type: {
            type: String,
            enum: ['latency', 'status', 'abort', 'throttle', 'malformed_json', 'truncate'],
            required: true
        },
        delayMinMs: { type: Number, default: 0, min: 0, max: 120000 },
        delayMaxMs: { type: Number, default: 0, min: 0, max: 120000 },
        statusCode: { type: Number, default: 500, min: 100, max: 599 },
        responseBody: { type: mongoose.Schema.Types.Mixed, default: null },
        abortPhase: { type: String, enum: ['before_headers', 'after_headers'], default: 'before_headers' },
        bytesPerSecond: { type: Number, default: 1024, min: 64, max: 10485760 },
        chunkSize: { type: Number, default: 256, min: 16, max: 65536 },
        truncateMode: { type: String, enum: ['bytes', 'percent'], default: 'percent' },
        truncateValue: { type: Number, default: 50, min: 1, max: 10485760 }
    }
}, { _id: true, timestamps: true });

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
    // New: Scenarios array for advanced mock behavior
    scenarios: [mockScenarioSchema],
    // New: State management configuration
    state: {
        counters: {
            type: Map,
            of: Number,
            default: new Map()
        },
        variables: {
            type: Map,
            of: mongoose.Schema.Types.Mixed,
            default: new Map()
        },
        sessions: [{
            sessionId: String,
            data: mongoose.Schema.Types.Mixed,
            createdAt: { type: Date, default: Date.now },
            expiresAt: Date
        }],
        lastResetAt: {
            type: Date,
            default: Date.now
        }
    },
    // New: Analytics sub-document
    analytics: {
        totalRequests: {
            type: Number,
            default: 0
        },
        requestsByEndpoint: {
            type: Map,
            of: Number,
            default: new Map()
        },
        requestsByMethod: {
            type: Map,
            of: Number,
            default: new Map()
        },
        requestsByStatus: {
            type: Map,
            of: Number,
            default: new Map()
        },
        averageResponseTime: {
            type: Number,
            default: 0
        },
        scenarioTriggerCounts: {
            type: Map,
            of: Number,
            default: new Map()
        },
        lastRequestAt: {
            type: Date,
            default: null
        }
    },
    // New: Recording configuration
    recording: {
        isRecording: {
            type: Boolean,
            default: false
        },
        recordingStartedAt: {
            type: Date,
            default: null
        },
        currentSessionId: {
            type: String,
            default: null
        }
    },
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
        },
        // New: Chaos engineering options
        chaos: {
            globalEnabled: {
                type: Boolean,
                default: false
            },
            profiles: {
                type: [faultProfileSchema],
                default: []
            },
            legacyMigratedAt: {
                type: Date,
                default: null
            },
            enabled: {
                type: Boolean,
                default: false
            },
            randomFailureRate: {
                type: Number,
                default: 0, // Percentage
                min: 0,
                max: 100
            },
            randomDelayRange: {
                min: { type: Number, default: 0 },
                max: { type: Number, default: 0 }
            }
        },
        // New: Variable resolution in responses
        enableVariableResolution: {
            type: Boolean,
            default: true
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
