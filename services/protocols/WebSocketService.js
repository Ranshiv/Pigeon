// services/protocols/WebSocketService.js
const WebSocket = require('ws');
const BaseProtocol = require('./BaseProtocol');

/**
 * WebSocket Protocol Service
 * Handles WebSocket connections for real-time bidirectional communication
 * Supports both text and binary message formats
 */
class WebSocketService extends BaseProtocol {
    constructor(options = {}) {
        super(options);

        this.protocolName = 'websocket';
        this.protocolVersion = '1.0.0';

        // WebSocket specific
        this.ws = null;
        this.url = null;
        this.subProtocol = options.subProtocol || null;
        this.pingInterval = options.pingInterval || 25000;
        this.pongTimeout = options.pongTimeout || 10000;

        // Connection tracking
        this.connections = new Map();
        this.activeConnection = null;

        // Ping/pong tracking
        this.pingTimer = null;
        this.pongTimer = null;
        this.lastPingTime = null;
    }

    /**
     * Get protocol capabilities
     * @returns {Object} - WebSocket capabilities
     */
    getCapabilities() {
        return {
            bidirectional: true,
            streaming: true,
            binarySupport: true,
            compression: true,
            encryption: true, // wss://
            authentication: true,
            subscriptions: false,
            requestResponse: false,
            pubSub: true
        };
    }

    /**
     * Connect to a WebSocket endpoint
     * @param {string} url - WebSocket URL (ws:// or wss://)
     * @param {Object} options - Connection options
     * @returns {Promise<Object>} - Connection result
     */
    async connect(url, options = {}) {
        return new Promise((resolve, reject) => {
            try {
                // Validate URL
                const parsedUrl = this.parseUrl(url, ['ws', 'wss']);
                if (!parsedUrl.valid) {
                    throw new Error(`Invalid WebSocket URL: ${parsedUrl.error}`);
                }

                this.url = url;
                this.connectionId = this.generateConnectionId();
                this.updateConnectionState('connecting');

                // Prepare WebSocket options
                const wsOptions = {
                    headers: options.headers || {},
                    handshakeTimeout: options.timeout || this.options.timeout,
                    perMessageDeflate: options.compression !== false,
                    maxPayload: options.maxPayload || 100 * 1024 * 1024 // 100MB default
                };

                // Add sub-protocol if specified
                const protocols = options.subProtocol ? [options.subProtocol] : [];

                // Create WebSocket connection
                this.ws = new WebSocket(url, protocols, wsOptions);

                // Set binary type
                this.ws.binaryType = options.binaryType || 'arraybuffer';

                // Connection opened
                this.ws.on('open', () => {
                    this.retryCount = 0;
                    this.updateConnectionState('connected');
                    this.startPingPong();

                    // Store connection
                    this.connections.set(this.connectionId, {
                        id: this.connectionId,
                        url,
                        ws: this.ws,
                        createdAt: new Date(),
                        options
                    });
                    this.activeConnection = this.connectionId;

                    resolve({
                        success: true,
                        connectionId: this.connectionId,
                        protocol: this.ws.protocol || null,
                        extensions: this.ws.extensions || '',
                        url: this.url
                    });
                });

                // Handle incoming messages
                this.ws.on('message', (data, isBinary) => {
                    this.handleIncomingMessage(data, isBinary);
                });

                // Handle pong responses
                this.ws.on('pong', (data) => {
                    this.handlePong(data);
                });

                // Handle ping from server
                this.ws.on('ping', (data) => {
                    this.handlePing(data);
                });

                // Handle errors
                this.ws.on('error', (error) => {
                    this.emit('error', {
                        type: 'websocket',
                        message: error.message,
                        code: error.code,
                        timestamp: new Date()
                    });

                    if (this.connectionState === 'connecting') {
                        reject(new Error(`WebSocket connection failed: ${error.message}`));
                    } else {
                        this.handleConnectionError(error);
                    }
                });

                // Handle close
                this.ws.on('close', (code, reason) => {
                    this.handleClose(code, reason.toString());
                });

                // Handle unexpected response (for debugging)
                this.ws.on('unexpected-response', (req, res) => {
                    this.emit('unexpectedResponse', {
                        statusCode: res.statusCode,
                        statusMessage: res.statusMessage,
                        headers: res.headers
                    });
                });

            } catch (error) {
                this.updateConnectionState('error', { error: error.message });
                reject(error);
            }
        });
    }

    /**
     * Handle incoming WebSocket message
     * @param {*} data - Message data
     * @param {boolean} isBinary - Whether message is binary
     */
    handleIncomingMessage(data, isBinary) {
        const size = this.calculateMessageSize(data);
        this.trackReceivedMessage(data);

        let parsedData = data;

        // Try to parse as JSON if text
        if (!isBinary && typeof data === 'string') {
            try {
                parsedData = JSON.parse(data);
            } catch {
                // Keep as string if not valid JSON
            }
        }

        const message = {
            id: this.generateMessageId(),
            data: parsedData,
            raw: data,
            isBinary,
            size,
            timestamp: new Date()
        };

        this.receivedMessages.push(message);

        // Keep only last 1000 messages
        if (this.receivedMessages.length > 1000) {
            this.receivedMessages.shift();
        }

        this.emit('message', message);
    }

    /**
     * Send a message through WebSocket
     * @param {*} message - Message to send
     * @param {Object} options - Send options
     * @returns {Promise<Object>} - Send result
     */
    async send(message, options = {}) {
        return new Promise((resolve, reject) => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                reject(new Error('WebSocket is not connected'));
                return;
            }

            try {
                const startTime = Date.now();

                // Determine if binary
                const isBinary = options.binary || Buffer.isBuffer(message);

                // Serialize message
                let data = message;
                if (!isBinary && typeof message === 'object') {
                    data = JSON.stringify(message);
                }

                // Send message
                this.ws.send(data, { binary: isBinary, compress: options.compress }, (error) => {
                    if (error) {
                        this.metrics.errors++;
                        reject(new Error(`Failed to send message: ${error.message}`));
                        return;
                    }

                    const messageId = this.trackSentMessage(data);
                    const latency = Date.now() - startTime;
                    this.recordLatency(latency);

                    resolve({
                        success: true,
                        messageId,
                        size: this.calculateMessageSize(data),
                        latency,
                        timestamp: new Date()
                    });
                });
            } catch (error) {
                this.metrics.errors++;
                reject(error);
            }
        });
    }

    /**
     * Send a ping frame
     * @param {*} data - Optional ping data
     */
    sendPing(data = '') {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.lastPingTime = Date.now();
            this.ws.ping(data);

            // Set pong timeout
            this.pongTimer = setTimeout(() => {
                this.emit('pongTimeout', {
                    lastPingTime: this.lastPingTime,
                    timeout: this.pongTimeout
                });
                // Close connection on pong timeout
                this.ws.terminate();
            }, this.pongTimeout);
        }
    }

    /**
     * Handle ping from server
     * @param {*} data - Ping data
     */
    handlePing(data) {
        this.emit('ping', { data, timestamp: new Date() });
        // Pong is sent automatically by ws library
    }

    /**
     * Handle pong response
     * @param {*} data - Pong data
     */
    handlePong(data) {
        if (this.pongTimer) {
            clearTimeout(this.pongTimer);
            this.pongTimer = null;
        }

        if (this.lastPingTime) {
            const latency = Date.now() - this.lastPingTime;
            this.recordLatency(latency);

            this.emit('pong', {
                data,
                latency,
                timestamp: new Date()
            });
        }
    }

    /**
     * Start ping/pong heartbeat
     */
    startPingPong() {
        this.stopPingPong();

        this.pingTimer = setInterval(() => {
            this.sendPing();
        }, this.pingInterval);
    }

    /**
     * Stop ping/pong heartbeat
     */
    stopPingPong() {
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
        if (this.pongTimer) {
            clearTimeout(this.pongTimer);
            this.pongTimer = null;
        }
    }

    /**
     * Handle WebSocket close
     * @param {number} code - Close code
     * @param {string} reason - Close reason
     */
    handleClose(code, reason) {
        this.stopPingPong();

        const closeInfo = {
            code,
            reason,
            wasClean: code === 1000,
            timestamp: new Date()
        };

        this.updateConnectionState('disconnected', closeInfo);
        this.emit('close', closeInfo);

        // Remove from connections
        if (this.activeConnection) {
            this.connections.delete(this.activeConnection);
            this.activeConnection = null;
        }

        // Attempt reconnect if not clean close
        if (code !== 1000 && code !== 1001) {
            this.handleConnectionError(new Error(`Connection closed: ${reason || 'Unknown reason'}`));
        }
    }

    /**
     * Disconnect from WebSocket
     * @param {number} code - Close code (default: 1000 - normal)
     * @param {string} reason - Close reason
     * @returns {Promise<void>}
     */
    async disconnect(code = 1000, reason = 'Client initiated close') {
        return new Promise((resolve) => {
            this.stopPingPong();

            if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
                this.updateConnectionState('disconnected');
                resolve();
                return;
            }

            // Wait for close event
            this.ws.once('close', () => {
                resolve();
            });

            // Initiate close
            try {
                this.ws.close(code, reason);
            } catch {
                this.ws.terminate();
                resolve();
            }

            // Force terminate after timeout
            setTimeout(() => {
                if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
                    this.ws.terminate();
                }
                resolve();
            }, 5000);
        });
    }

    /**
     * Reconnect to WebSocket
     */
    async reconnect() {
        if (this.url) {
            const lastConnection = this.connections.get(this.activeConnection);
            await this.connect(this.url, lastConnection?.options || {});
        }
    }

    /**
     * Get connection state
     * @returns {string} - Ready state string
     */
    getReadyState() {
        if (!this.ws) return 'CLOSED';

        const states = {
            [WebSocket.CONNECTING]: 'CONNECTING',
            [WebSocket.OPEN]: 'OPEN',
            [WebSocket.CLOSING]: 'CLOSING',
            [WebSocket.CLOSED]: 'CLOSED'
        };

        return states[this.ws.readyState] || 'UNKNOWN';
    }

    /**
     * Check if connected
     * @returns {boolean}
     */
    isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }

    /**
     * Get all active connections
     * @returns {Array} - Active connections
     */
    getActiveConnections() {
        return Array.from(this.connections.values()).map(conn => ({
            id: conn.id,
            url: conn.url,
            createdAt: conn.createdAt,
            readyState: conn.ws ? conn.ws.readyState : WebSocket.CLOSED
        }));
    }

    /**
     * Get message history
     * @param {number} limit - Max messages to return
     * @returns {Array} - Message history
     */
    getMessageHistory(limit = 100) {
        return this.receivedMessages.slice(-limit);
    }

    /**
     * Clear message history
     */
    clearHistory() {
        this.receivedMessages = [];
        this.sentMessages.clear();
    }

    /**
     * Get WebSocket info
     * @returns {Object} - WebSocket information
     */
    getInfo() {
        return {
            ...this.getProtocolInfo(),
            url: this.url,
            readyState: this.getReadyState(),
            protocol: this.ws?.protocol || null,
            extensions: this.ws?.extensions || '',
            bufferedAmount: this.ws?.bufferedAmount || 0,
            activeConnections: this.connections.size,
            messageHistory: this.receivedMessages.length
        };
    }

    /**
     * Clean up resources
     */
    async cleanup() {
        await this.disconnect();

        for (const [id, conn] of this.connections) {
            if (conn.ws) {
                conn.ws.terminate();
            }
        }
        this.connections.clear();

        await super.cleanup();
    }
}

// Export singleton instance
module.exports = new WebSocketService();
module.exports.WebSocketService = WebSocketService;
