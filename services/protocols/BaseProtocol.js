// services/protocols/BaseProtocol.js
const EventEmitter = require('events');

/**
 * Base Protocol Class
 * Abstract base class for all protocol implementations
 * Provides common interface and utilities for protocol handlers
 */
class BaseProtocol extends EventEmitter {
    constructor(options = {}) {
        super();

        // Protocol identification
        this.protocolName = 'base';
        this.protocolVersion = '1.0.0';

        // Connection state
        this.connectionState = 'disconnected'; // disconnected, connecting, connected, error
        this.connectionId = null;
        this.connectionStartTime = null;

        // Configuration
        this.options = {
            timeout: options.timeout || 30000,
            retryAttempts: options.retryAttempts || 3,
            retryDelay: options.retryDelay || 1000,
            keepAlive: options.keepAlive || true,
            keepAliveInterval: options.keepAliveInterval || 30000,
            ...options
        };

        // Message tracking
        this.messageQueue = [];
        this.sentMessages = new Map();
        this.receivedMessages = [];
        this.messageCounter = 0;

        // Metrics
        this.metrics = {
            messagesSent: 0,
            messagesReceived: 0,
            bytesIn: 0,
            bytesOut: 0,
            errors: 0,
            reconnects: 0,
            latency: []
        };

        // Retry state
        this.retryCount = 0;
        this.retryTimer = null;

        // Add default error handler to prevent unhandled error crashes
        this.on('error', (err) => {
            const errorMsg = err?.message || err?.error || JSON.stringify(err);
            console.error(`[${this.protocolName}] Error:`, errorMsg);
        });

        // Keep-alive timer
        this.keepAliveTimer = null;
    }

    /**
     * Generate unique connection ID
     * @returns {string} - Connection ID
     */
    generateConnectionId() {
        return `${this.protocolName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Generate unique message ID
     * @returns {string} - Message ID
     */
    generateMessageId() {
        this.messageCounter++;
        return `msg_${this.connectionId}_${this.messageCounter}_${Date.now()}`;
    }

    /**
     * Connect to the protocol endpoint
     * MUST be overridden by subclasses
     * @param {string} url - Endpoint URL
     * @param {Object} options - Connection options
     * @returns {Promise<Object>} - Connection result
     */
    async connect(url, options = {}) {
        throw new Error('connect() must be implemented by subclass');
    }

    /**
     * Disconnect from the protocol endpoint
     * MUST be overridden by subclasses
     * @returns {Promise<void>}
     */
    async disconnect() {
        throw new Error('disconnect() must be implemented by subclass');
    }

    /**
     * Send a message through the protocol
     * MUST be overridden by subclasses
     * @param {*} message - Message to send
     * @param {Object} options - Send options
     * @returns {Promise<Object>} - Send result
     */
    async send(message, options = {}) {
        throw new Error('send() must be implemented by subclass');
    }

    /**
     * Handle incoming messages
     * SHOULD be overridden by subclasses
     * @param {*} message - Received message
     */
    onMessage(message) {
        this.metrics.messagesReceived++;
        this.receivedMessages.push({
            id: this.generateMessageId(),
            data: message,
            timestamp: new Date(),
            size: this.calculateMessageSize(message)
        });
        this.emit('message', message);
    }

    /**
     * Update connection state and emit event
     * @param {string} state - New connection state
     * @param {Object} details - Additional details
     */
    updateConnectionState(state, details = {}) {
        const previousState = this.connectionState;
        this.connectionState = state;

        this.emit('stateChange', {
            previousState,
            currentState: state,
            timestamp: new Date(),
            ...details
        });

        if (state === 'connected') {
            this.connectionStartTime = new Date();
            this.startKeepAlive();
        } else if (state === 'disconnected' || state === 'error') {
            this.stopKeepAlive();
        }
    }

    /**
     * Start keep-alive mechanism
     */
    startKeepAlive() {
        if (!this.options.keepAlive) return;

        this.stopKeepAlive();
        this.keepAliveTimer = setInterval(() => {
            this.sendKeepAlive();
        }, this.options.keepAliveInterval);
    }

    /**
     * Stop keep-alive mechanism
     */
    stopKeepAlive() {
        if (this.keepAliveTimer) {
            clearInterval(this.keepAliveTimer);
            this.keepAliveTimer = null;
        }
    }

    /**
     * Send keep-alive ping
     * CAN be overridden by subclasses
     */
    async sendKeepAlive() {
        // Default implementation - subclasses should override
        this.emit('keepAlive', { timestamp: new Date() });
    }

    /**
     * Handle connection error with retry logic
     * @param {Error} error - Error object
     */
    async handleConnectionError(error) {
        this.metrics.errors++;
        this.updateConnectionState('error', { error: error.message });

        this.emit('error', {
            type: 'connection',
            message: error.message,
            timestamp: new Date(),
            retryCount: this.retryCount
        });

        // Attempt retry if within limits
        if (this.retryCount < this.options.retryAttempts) {
            this.retryCount++;
            this.metrics.reconnects++;

            this.emit('reconnecting', {
                attempt: this.retryCount,
                maxAttempts: this.options.retryAttempts,
                delay: this.options.retryDelay * this.retryCount
            });

            await this.delay(this.options.retryDelay * this.retryCount);
            return this.reconnect();
        }

        this.emit('maxRetriesReached', {
            attempts: this.retryCount,
            error: error.message
        });
    }

    /**
     * Attempt to reconnect
     * CAN be overridden by subclasses
     */
    async reconnect() {
        // Default implementation - subclasses should override
        throw new Error('reconnect() should be implemented by subclass');
    }

    /**
     * Calculate message size in bytes
     * @param {*} message - Message to measure
     * @returns {number} - Size in bytes
     */
    calculateMessageSize(message) {
        if (typeof message === 'string') {
            return Buffer.byteLength(message, 'utf8');
        }
        if (Buffer.isBuffer(message)) {
            return message.length;
        }
        if (typeof message === 'object') {
            return Buffer.byteLength(JSON.stringify(message), 'utf8');
        }
        return 0;
    }

    /**
     * Track sent message for metrics
     * @param {*} message - Message sent
     */
    trackSentMessage(message) {
        const size = this.calculateMessageSize(message);
        this.metrics.messagesSent++;
        this.metrics.bytesOut += size;

        const messageId = this.generateMessageId();
        this.sentMessages.set(messageId, {
            id: messageId,
            data: message,
            timestamp: new Date(),
            size
        });

        return messageId;
    }

    /**
     * Track received message for metrics
     * @param {*} message - Message received
     */
    trackReceivedMessage(message) {
        const size = this.calculateMessageSize(message);
        this.metrics.messagesReceived++;
        this.metrics.bytesIn += size;
    }

    /**
     * Record latency measurement
     * @param {number} latencyMs - Latency in milliseconds
     */
    recordLatency(latencyMs) {
        this.metrics.latency.push({
            value: latencyMs,
            timestamp: new Date()
        });

        // Keep only last 100 measurements
        if (this.metrics.latency.length > 100) {
            this.metrics.latency.shift();
        }
    }

    /**
     * Get average latency
     * @returns {number} - Average latency in ms
     */
    getAverageLatency() {
        if (this.metrics.latency.length === 0) return 0;
        const sum = this.metrics.latency.reduce((acc, curr) => acc + curr.value, 0);
        return Math.round(sum / this.metrics.latency.length);
    }

    /**
     * Get connection duration
     * @returns {number} - Duration in milliseconds
     */
    getConnectionDuration() {
        if (!this.connectionStartTime) return 0;
        return Date.now() - this.connectionStartTime.getTime();
    }

    /**
     * Get current metrics snapshot
     * @returns {Object} - Metrics object
     */
    getMetrics() {
        return {
            ...this.metrics,
            connectionState: this.connectionState,
            connectionDuration: this.getConnectionDuration(),
            averageLatency: this.getAverageLatency(),
            queuedMessages: this.messageQueue.length
        };
    }

    /**
     * Reset metrics
     */
    resetMetrics() {
        this.metrics = {
            messagesSent: 0,
            messagesReceived: 0,
            bytesIn: 0,
            bytesOut: 0,
            errors: 0,
            reconnects: 0,
            latency: []
        };
    }

    /**
     * Utility delay function
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise<void>}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Parse URL and validate protocol
     * @param {string} url - URL to parse
     * @param {string[]} allowedProtocols - Allowed protocol schemes
     * @returns {Object} - Parsed URL info
     */
    parseUrl(url, allowedProtocols = []) {
        try {
            const parsed = new URL(url);

            if (allowedProtocols.length > 0) {
                const protocol = parsed.protocol.replace(':', '');
                if (!allowedProtocols.includes(protocol)) {
                    throw new Error(`Invalid protocol. Expected: ${allowedProtocols.join(', ')}`);
                }
            }

            return {
                valid: true,
                protocol: parsed.protocol.replace(':', ''),
                hostname: parsed.hostname,
                port: parsed.port || this.getDefaultPort(parsed.protocol),
                pathname: parsed.pathname,
                search: parsed.search,
                hash: parsed.hash,
                origin: parsed.origin,
                href: parsed.href
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    }

    /**
     * Get default port for protocol
     * @param {string} protocol - Protocol scheme
     * @returns {string} - Default port
     */
    getDefaultPort(protocol) {
        const defaults = {
            'http:': '80',
            'https:': '443',
            'ws:': '80',
            'wss:': '443',
            'mqtt:': '1883',
            'mqtts:': '8883',
            'amqp:': '5672',
            'amqps:': '5671'
        };
        return defaults[protocol] || '';
    }

    /**
     * Serialize message for sending
     * @param {*} message - Message to serialize
     * @param {string} format - Output format (json, text, binary)
     * @returns {*} - Serialized message
     */
    serializeMessage(message, format = 'json') {
        switch (format) {
            case 'json':
                return typeof message === 'string' ? message : JSON.stringify(message);
            case 'text':
                return String(message);
            case 'binary':
                if (Buffer.isBuffer(message)) return message;
                return Buffer.from(typeof message === 'string' ? message : JSON.stringify(message));
            default:
                return message;
        }
    }

    /**
     * Deserialize received message
     * @param {*} message - Message to deserialize
     * @param {string} format - Input format
     * @returns {*} - Deserialized message
     */
    deserializeMessage(message, format = 'json') {
        try {
            switch (format) {
                case 'json':
                    return typeof message === 'string' ? JSON.parse(message) : message;
                case 'text':
                    return Buffer.isBuffer(message) ? message.toString('utf8') : String(message);
                case 'binary':
                    return Buffer.isBuffer(message) ? message : Buffer.from(message);
                default:
                    return message;
            }
        } catch {
            return message; // Return original if parsing fails
        }
    }

    /**
     * Validate message against schema
     * CAN be overridden by subclasses
     * @param {*} message - Message to validate
     * @param {Object} schema - Validation schema
     * @returns {Object} - Validation result
     */
    validateMessage(message, schema = {}) {
        return {
            valid: true,
            errors: []
        };
    }

    /**
     * Clean up resources
     */
    async cleanup() {
        this.stopKeepAlive();

        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
            this.retryTimer = null;
        }

        this.messageQueue = [];
        this.sentMessages.clear();
        this.receivedMessages = [];

        this.removeAllListeners();
    }

    /**
     * Get protocol info
     * @returns {Object} - Protocol information
     */
    getProtocolInfo() {
        return {
            name: this.protocolName,
            version: this.protocolVersion,
            connectionId: this.connectionId,
            state: this.connectionState,
            capabilities: this.getCapabilities()
        };
    }

    /**
     * Get protocol capabilities
     * SHOULD be overridden by subclasses
     * @returns {Object} - Capabilities
     */
    getCapabilities() {
        return {
            bidirectional: false,
            streaming: false,
            binarySupport: false,
            compression: false,
            encryption: false,
            authentication: false,
            subscriptions: false,
            requestResponse: false,
            pubSub: false
        };
    }
}

module.exports = BaseProtocol;
