// models/Monitor.js
const mongoose = require('mongoose');

const monitorSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    url: {
        type: String,
        required: true,
        trim: true
    },
    method: {
        type: String,
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'],
        default: 'GET'
    },
    headers: [{
        key: String,
        value: String
    }],
    body: {
        type: String,
        default: ''
    },
    expectedStatusCode: {
        type: Number,
        default: 200
    },
    expectedResponseTime: {
        type: Number, // in milliseconds
        default: 5000
    },
    interval: {
        type: Number, // in minutes
        default: 5,
        min: 1
    },
    // Add priority-based intervals
    priority: {
        type: String,
        enum: ['critical', 'high', 'medium', 'low'],
        default: 'medium'
    },
    // Computed interval based on priority
    effectiveInterval: {
        type: Number,
        default: function () {
            switch (this.priority) {
                case 'critical': return 1; // 1 minute
                case 'high': return 3;     // 3 minutes  
                case 'medium': return 5;   // 5 minutes
                case 'low': return 15;     // 15 minutes
                default: return 5;
            }
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isPublic: {
        type: Boolean,
        default: false
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    workspaceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workspace'
    },
    tags: [{
        type: String,
        trim: true
    }],
    alertSettings: {
        emailEnabled: {
            type: Boolean,
            default: true
        },
        webhookUrl: {
            type: String,
            trim: true
        },
        slackWebhook: {
            type: String,
            trim: true
        },
        alertOnFailure: {
            type: Boolean,
            default: true
        },
        alertOnSlowResponse: {
            type: Boolean,
            default: true
        },
        alertOnRecovery: {
            type: Boolean,
            default: true
        },
        integrations: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Integration'
        }],
        escalationPolicy: {
            enabled: {
                type: Boolean,
                default: false
            },
            steps: [{
                waitMinutes: Number,
                integrations: [mongoose.Schema.Types.ObjectId]
            }]
        }
    },
    currentStatus: {
        type: String,
        enum: ['up', 'down', 'degraded', 'unknown'],
        default: 'unknown'
    },
    lastChecked: {
        type: Date
    },
    nextCheck: {
        type: Date
    },
    consecutiveFailures: {
        type: Number,
        default: 0
    },
    totalChecks: {
        type: Number,
        default: 0
    },
    totalFailures: {
        type: Number,
        default: 0
    },
    averageResponseTime: {
        type: Number,
        default: 0
    },
    // Enhanced monitoring capabilities
    monitoringType: {
        type: String,
        enum: ['http', 'ssl', 'domain', 'transaction'],
        default: 'http'
    },
    sslCheck: {
        enabled: {
            type: Boolean,
            default: false
        },
        warnDays: {
            type: Number,
            default: 30 // Warn when SSL expires in N days
        },
        expiryDate: Date,
        issuer: String
    },
    domainCheck: {
        enabled: {
            type: Boolean,
            default: false
        },
        warnDays: {
            type: Number,
            default: 30
        },
        expiryDate: Date,
        registrar: String
    },
    contentValidation: {
        enabled: {
            type: Boolean,
            default: false
        },
        expectedContent: String,
        contentType: {
            type: String,
            enum: ['text', 'json', 'xml'],
            default: 'text'
        }
    },
    multiLocation: {
        enabled: {
            type: Boolean,
            default: false
        },
        locations: [{
            name: String,
            region: String,
            enabled: {
                type: Boolean,
                default: true
            }
        }]
    },
    slaTargets: {
        uptimePercentage: {
            type: Number,
            default: 99.9
        },
        responseTime: {
            type: Number,
            default: 5000 // milliseconds
        }
    },
    // Team ownership
    teamId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team'
    }
}, {
    timestamps: true
});

// Index for efficient querying
monitorSchema.index({ userId: 1, isActive: 1 });
monitorSchema.index({ nextCheck: 1, isActive: 1 });
monitorSchema.index({ isPublic: 1, currentStatus: 1 });

// Calculate uptime percentage
monitorSchema.virtual('uptimePercentage').get(function () {
    if (this.totalChecks === 0) return 100;
    const successfulChecks = this.totalChecks - this.totalFailures;
    return ((successfulChecks / this.totalChecks) * 100).toFixed(2);
});

// Set next check time before saving
monitorSchema.pre('save', function (next) {
    if (this.isModified('interval') || this.isNew) {
        this.nextCheck = new Date(Date.now() + (this.interval * 60 * 1000));
    }
    next();
});

module.exports = mongoose.model('Monitor', monitorSchema);
