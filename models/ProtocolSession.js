// models/ProtocolSession.js
const mongoose = require('mongoose');

/**
 * ProtocolSession Model
 * 
 * Tracks persistent connection states for long-lived protocol connections
 * (WebSocket, gRPC streams, MQTT subscriptions, SSE connections).
 * 
 * This model enables:
 * - Session resumption after page refresh/reconnection
 * - Connection history and analytics
 * - Multi-device synchronization
 * - Debugging and troubleshooting
 */

const messageSchema = new mongoose.Schema({
    id: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    direction: { type: String, enum: ['incoming', 'outgoing'], required: true },
    type: { type: String, default: 'text' }, // text, binary, json, event, etc.
    content: { type: mongoose.Schema.Types.Mixed }, // Message content
    size: { type: Number, default: 0 }, // Size in bytes
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} } // Protocol-specific metadata
}, { _id: false });

const eventSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    type: { type: String, required: true }, // connected, disconnected, error, reconnecting, etc.
    details: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { _id: false });

const protocolSessionSchema = new mongoose.Schema({
    // Reference to the request that created this session
    requestId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Request',
        index: true
    },

    // User who owns this session
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },

    // Workspace context
    workspaceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workspace',
        index: true
    },

    // Session identification
    sessionId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    // Protocol type
    protocol: {
        type: String,
        enum: ['websocket', 'grpc', 'mqtt', 'sse'],
        required: true,
        index: true
    },

    // Connection URL/endpoint
    endpoint: { type: String, required: true },

    // Session name for user reference
    name: { type: String, default: '' },

    // Connection state
    state: {
        type: String,
        enum: ['connecting', 'connected', 'disconnected', 'reconnecting', 'error', 'closed'],
        default: 'disconnected',
        index: true
    },

    // Last known error
    lastError: {
        message: { type: String, default: '' },
        code: { type: String, default: '' },
        timestamp: { type: Date }
    },

    // Connection statistics
    stats: {
        connectedAt: { type: Date },
        disconnectedAt: { type: Date },
        totalConnections: { type: Number, default: 0 },
        totalDisconnections: { type: Number, default: 0 },
        totalMessagesSent: { type: Number, default: 0 },
        totalMessagesReceived: { type: Number, default: 0 },
        totalBytesSent: { type: Number, default: 0 },
        totalBytesReceived: { type: Number, default: 0 },
        averageLatency: { type: Number, default: 0 }, // in ms
        lastLatency: { type: Number, default: 0 },
        uptime: { type: Number, default: 0 }, // Total uptime in ms
        lastActiveAt: { type: Date, default: Date.now }
    },

    // Message history (limited to recent messages)
    messages: {
        type: [messageSchema],
        default: []
    },

    // Connection events log
    events: {
        type: [eventSchema],
        default: []
    },

    // WebSocket-specific session data
    websocket: {
        subprotocol: { type: String, default: '' },
        extensions: [{ type: String }],
        readyState: { type: Number, default: 3 }, // 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED
        bufferedAmount: { type: Number, default: 0 },
        binaryType: { type: String, default: 'arraybuffer' }
    },

    // gRPC-specific session data
    grpc: {
        serviceName: { type: String, default: '' },
        methodName: { type: String, default: '' },
        methodType: {
            type: String,
            enum: ['unary', 'server_streaming', 'client_streaming', 'bidi_streaming', ''],
            default: ''
        },
        streamId: { type: String, default: '' },
        metadata: [{ name: String, value: String }],
        trailers: [{ name: String, value: String }],
        status: {
            code: { type: Number },
            message: { type: String, default: '' }
        }
    },

    // MQTT-specific session data
    mqtt: {
        clientId: { type: String, default: '' },
        broker: { type: String, default: '' },
        cleanSession: { type: Boolean, default: true },
        keepAlive: { type: Number, default: 60 },
        subscriptions: [{
            topic: { type: String },
            qos: { type: Number, enum: [0, 1, 2], default: 0 },
            subscribedAt: { type: Date, default: Date.now }
        }],
        pendingMessages: { type: Number, default: 0 }, // Messages awaiting ACK
        lastPingReq: { type: Date },
        lastPingResp: { type: Date }
    },

    // SSE-specific session data
    sse: {
        lastEventId: { type: String, default: '' },
        eventTypes: [{ type: String }],
        reconnectTime: { type: Number, default: 3000 },
        eventCounts: { type: Map, of: Number, default: {} } // Count per event type
    },

    // Pinned/saved messages for easy reference
    pinnedMessages: [{
        messageId: { type: String },
        note: { type: String, default: '' },
        pinnedAt: { type: Date, default: Date.now }
    }],

    // Filters applied to this session
    filters: {
        messageTypes: [{ type: String }],
        searchQuery: { type: String, default: '' },
        direction: { type: String, enum: ['all', 'incoming', 'outgoing'], default: 'all' },
        dateRange: {
            start: { type: Date },
            end: { type: Date }
        }
    },

    // Session settings
    settings: {
        autoReconnect: { type: Boolean, default: true },
        maxReconnectAttempts: { type: Number, default: 5 },
        reconnectDelay: { type: Number, default: 1000 },
        messageLimit: { type: Number, default: 1000 }, // Max messages to store
        recordMessages: { type: Boolean, default: true },
        recordEvents: { type: Boolean, default: true }
    },

    // Tags for organization
    tags: [{ type: String }],

    // Whether session should persist across browser sessions
    persistent: { type: Boolean, default: false },

    // Whether this session is shared with team
    shared: { type: Boolean, default: false },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date } // Optional TTL for auto-cleanup
});

// Indexes for efficient queries
protocolSessionSchema.index({ userId: 1, protocol: 1 });
protocolSessionSchema.index({ workspaceId: 1, state: 1 });
protocolSessionSchema.index({ endpoint: 1, protocol: 1 });
protocolSessionSchema.index({ 'stats.lastActiveAt': -1 });
protocolSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Instance methods
protocolSessionSchema.methods.addMessage = function (message) {
    const msg = {
        id: message.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: message.timestamp || new Date(),
        direction: message.direction,
        type: message.type || 'text',
        content: message.content,
        size: message.size || (typeof message.content === 'string' ? message.content.length : 0),
        metadata: message.metadata || {}
    };

    this.messages.push(msg);

    // Enforce message limit
    if (this.messages.length > this.settings.messageLimit) {
        this.messages.shift();
    }

    // Update stats
    if (message.direction === 'outgoing') {
        this.stats.totalMessagesSent++;
        this.stats.totalBytesSent += msg.size;
    } else {
        this.stats.totalMessagesReceived++;
        this.stats.totalBytesReceived += msg.size;
    }

    this.stats.lastActiveAt = new Date();
    this.updatedAt = new Date();

    return msg;
};

protocolSessionSchema.methods.addEvent = function (type, details = {}) {
    const event = {
        timestamp: new Date(),
        type,
        details
    };

    this.events.push(event);

    // Keep only last 100 events
    if (this.events.length > 100) {
        this.events.shift();
    }

    this.updatedAt = new Date();
    return event;
};

protocolSessionSchema.methods.updateState = function (newState, errorInfo = null) {
    const previousState = this.state;
    this.state = newState;

    if (newState === 'connected') {
        this.stats.connectedAt = new Date();
        this.stats.totalConnections++;
        this.lastError = { message: '', code: '', timestamp: null };
    } else if (newState === 'disconnected' || newState === 'closed') {
        if (this.stats.connectedAt) {
            const sessionDuration = Date.now() - this.stats.connectedAt.getTime();
            this.stats.uptime += sessionDuration;
        }
        this.stats.disconnectedAt = new Date();
        this.stats.totalDisconnections++;
    } else if (newState === 'error' && errorInfo) {
        this.lastError = {
            message: errorInfo.message || '',
            code: errorInfo.code || '',
            timestamp: new Date()
        };
    }

    this.addEvent('state_change', { from: previousState, to: newState, error: errorInfo });
    this.updatedAt = new Date();
};

protocolSessionSchema.methods.updateLatency = function (latencyMs) {
    this.stats.lastLatency = latencyMs;

    // Running average calculation
    const totalMessages = this.stats.totalMessagesSent + this.stats.totalMessagesReceived;
    if (totalMessages === 0) {
        this.stats.averageLatency = latencyMs;
    } else {
        this.stats.averageLatency = (
            (this.stats.averageLatency * (totalMessages - 1) + latencyMs) / totalMessages
        );
    }
};

protocolSessionSchema.methods.pinMessage = function (messageId, note = '') {
    const existingPin = this.pinnedMessages.find(p => p.messageId === messageId);
    if (!existingPin) {
        this.pinnedMessages.push({
            messageId,
            note,
            pinnedAt: new Date()
        });
    }
    return this.pinnedMessages;
};

protocolSessionSchema.methods.unpinMessage = function (messageId) {
    this.pinnedMessages = this.pinnedMessages.filter(p => p.messageId !== messageId);
    return this.pinnedMessages;
};

protocolSessionSchema.methods.clearMessages = function () {
    this.messages = [];
    this.updatedAt = new Date();
};

protocolSessionSchema.methods.getRecentMessages = function (count = 50) {
    return this.messages.slice(-count);
};

protocolSessionSchema.methods.searchMessages = function (query) {
    const lowerQuery = query.toLowerCase();
    return this.messages.filter(msg => {
        if (typeof msg.content === 'string') {
            return msg.content.toLowerCase().includes(lowerQuery);
        }
        if (typeof msg.content === 'object') {
            return JSON.stringify(msg.content).toLowerCase().includes(lowerQuery);
        }
        return false;
    });
};

// Static methods
protocolSessionSchema.statics.findActiveSessions = function (userId) {
    return this.find({
        userId,
        state: { $in: ['connected', 'connecting', 'reconnecting'] }
    }).sort({ 'stats.lastActiveAt': -1 });
};

protocolSessionSchema.statics.findByProtocol = function (userId, protocol) {
    return this.find({
        userId,
        protocol
    }).sort({ updatedAt: -1 });
};

protocolSessionSchema.statics.findRecentSessions = function (userId, limit = 10) {
    return this.find({ userId })
        .sort({ 'stats.lastActiveAt': -1 })
        .limit(limit);
};

protocolSessionSchema.statics.cleanupExpiredSessions = async function () {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
    return this.deleteMany({
        persistent: false,
        state: { $in: ['disconnected', 'closed'] },
        updatedAt: { $lt: cutoff }
    });
};

protocolSessionSchema.statics.getSessionStats = async function (userId) {
    const stats = await this.aggregate([
        { $match: { userId: mongoose.Types.ObjectId(userId) } },
        {
            $group: {
                _id: '$protocol',
                totalSessions: { $sum: 1 },
                activeSessions: {
                    $sum: {
                        $cond: [{ $in: ['$state', ['connected', 'connecting']] }, 1, 0]
                    }
                },
                totalMessages: {
                    $sum: { $add: ['$stats.totalMessagesSent', '$stats.totalMessagesReceived'] }
                },
                totalBytes: {
                    $sum: { $add: ['$stats.totalBytesSent', '$stats.totalBytesReceived'] }
                }
            }
        }
    ]);

    return stats;
};

// Pre-save middleware
protocolSessionSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

// Virtual for formatted uptime
protocolSessionSchema.virtual('formattedUptime').get(function () {
    const totalMs = this.stats.uptime;
    const seconds = Math.floor(totalMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
});

// Virtual for connection duration
protocolSessionSchema.virtual('connectionDuration').get(function () {
    if (this.state !== 'connected' || !this.stats.connectedAt) {
        return 0;
    }
    return Date.now() - this.stats.connectedAt.getTime();
});

// Ensure virtuals are serialized
protocolSessionSchema.set('toJSON', { virtuals: true });
protocolSessionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ProtocolSession', protocolSessionSchema);
