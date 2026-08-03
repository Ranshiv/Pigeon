// models/MockRecording.js
const mongoose = require('mongoose');

// Schema for recorded request metadata
const recordedRequestSchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        default: Date.now
    },
    method: {
        type: String,
        required: true
    },
    path: {
        type: String,
        required: true
    },
    fullUrl: {
        type: String,
        default: ''
    },
    headers: {
        type: Map,
        of: String,
        default: new Map()
    },
    queryParams: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: new Map()
    },
    body: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    // Response data
    response: {
        status: {
            type: Number,
            default: 200
        },
        statusText: {
            type: String,
            default: 'OK'
        },
        headers: {
            type: Map,
            of: String,
            default: new Map()
        },
        body: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },
        duration: {
            type: Number, // Response time in milliseconds
            default: 0
        }
    },
    // Scenario that was triggered (if any)
    triggeredScenario: {
        scenarioId: mongoose.Schema.Types.ObjectId,
        scenarioName: String
    },
    // Request metadata
    metadata: {
        clientIp: String,
        userAgent: String,
        requestSize: Number,
        responseSize: Number
    }
}, { _id: true });

const mockRecordingSchema = new mongoose.Schema({
    mockServerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MockServer',
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
    sessionId: {
        type: String,
        required: true,
        unique: true
    },
    // Recording status
    status: {
        type: String,
        enum: ['recording', 'completed', 'paused'],
        default: 'completed'
    },
    // Recording timestamps
    startedAt: {
        type: Date,
        required: true
    },
    endedAt: {
        type: Date,
        default: null
    },
    // Recorded requests
    requests: [recordedRequestSchema],
    // Recording statistics
    stats: {
        totalRequests: {
            type: Number,
            default: 0
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
        totalDuration: {
            type: Number, // Total recording duration in milliseconds
            default: 0
        }
    },
    // Replay configuration
    replay: {
        lastReplayedAt: {
            type: Date,
            default: null
        },
        replayCount: {
            type: Number,
            default: 0
        }
    },
    // Tags for organization
    tags: [{
        type: String
    }],
    // Creator info
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, { timestamps: true });

// Indexes for efficient querying
mockRecordingSchema.index({ mockServerId: 1, createdAt: -1 });
mockRecordingSchema.index({ status: 1 });
mockRecordingSchema.index({ tags: 1 });

// Virtual for duration calculation
mockRecordingSchema.virtual('duration').get(function () {
    if (this.startedAt && this.endedAt) {
        return this.endedAt - this.startedAt;
    }
    return this.stats?.totalDuration || 0;
});

// Method to add a request to the recording
mockRecordingSchema.methods.addRequest = function (requestData) {
    this.requests.push(requestData);
    this.stats.totalRequests = this.requests.length;

    // Update method counts
    const method = requestData.method.toUpperCase();
    const currentMethodCount = this.stats.requestsByMethod.get(method) || 0;
    this.stats.requestsByMethod.set(method, currentMethodCount + 1);

    // Update status counts
    const statusGroup = Math.floor(requestData.response?.status / 100) + 'xx';
    const currentStatusCount = this.stats.requestsByStatus.get(statusGroup) || 0;
    this.stats.requestsByStatus.set(statusGroup, currentStatusCount + 1);

    // Update average response time
    const durations = this.requests.map(r => r.response?.duration || 0);
    this.stats.averageResponseTime = durations.reduce((a, b) => a + b, 0) / durations.length;

    return this;
};

// Method to export to HAR format
mockRecordingSchema.methods.toHAR = function () {
    const entries = this.requests.map(req => ({
        startedDateTime: req.timestamp.toISOString(),
        time: req.response?.duration || 0,
        request: {
            method: req.method,
            url: req.fullUrl || req.path,
            httpVersion: 'HTTP/1.1',
            headers: Array.from(req.headers?.entries() || []).map(([name, value]) => ({ name, value })),
            queryString: Array.from(req.queryParams?.entries() || []).map(([name, value]) => ({ name, value: String(value) })),
            postData: req.body ? {
                mimeType: 'application/json',
                text: typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
            } : undefined,
            headersSize: -1,
            bodySize: -1
        },
        response: {
            status: req.response?.status || 0,
            statusText: req.response?.statusText || '',
            httpVersion: 'HTTP/1.1',
            headers: Array.from(req.response?.headers?.entries() || []).map(([name, value]) => ({ name, value })),
            content: {
                size: req.metadata?.responseSize || 0,
                mimeType: 'application/json',
                text: req.response?.body ? JSON.stringify(req.response.body) : ''
            },
            redirectURL: '',
            headersSize: -1,
            bodySize: -1
        },
        cache: {},
        timings: {
            send: 0,
            wait: req.response?.duration || 0,
            receive: 0
        }
    }));

    return {
        log: {
            version: '1.2',
            creator: {
                name: 'Pigeon Mock Server',
                version: '1.0'
            },
            entries
        }
    };
};

module.exports = mongoose.model('MockRecording', mockRecordingSchema);
