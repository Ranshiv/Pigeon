// services/protocols/MqttService.js
const BaseProtocol = require('./BaseProtocol');
const mqtt = require('mqtt');

/**
 * MQTT Protocol Service
 * Handles MQTT connections for IoT and messaging scenarios
 * Supports MQTT 3.1, 3.1.1, and 5.0 protocols
 */
class MqttService extends BaseProtocol {
    constructor(options = {}) {
        super(options);

        this.protocolName = 'mqtt';
        this.protocolVersion = '1.0.0';

        // MQTT specific
        this.client = null;
        this.subscriptions = new Map();
        this.topicMessages = new Map();
        this.clientId = options.clientId || `pigeon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // QoS levels
        this.QOS = {
            AT_MOST_ONCE: 0,
            AT_LEAST_ONCE: 1,
            EXACTLY_ONCE: 2
        };
    }

    /**
     * Get protocol capabilities
     * @returns {Object} - MQTT capabilities
     */
    getCapabilities() {
        return {
            bidirectional: true,
            streaming: false,
            binarySupport: true,
            compression: false,
            encryption: true, // mqtts://
            authentication: true,
            subscriptions: true,
            requestResponse: false,
            pubSub: true
        };
    }

    /**
     * Connect to MQTT broker
     * @param {string} url - Broker URL (mqtt:// or mqtts://)
     * @param {Object} options - Connection options
     * @returns {Promise<Object>} - Connection result
     */
    async connect(url, options = {}) {
        return new Promise((resolve, reject) => {
            try {
                this.connectionId = this.generateConnectionId();
                this.updateConnectionState('connecting');

                // Validate URL
                const parsedUrl = this.parseUrl(url, ['mqtt', 'mqtts', 'ws', 'wss']);
                if (!parsedUrl.valid) {
                    throw new Error(`Invalid MQTT URL: ${parsedUrl.error}`);
                }

                // Prepare connection options
                const connectOptions = {
                    clientId: options.clientId || this.clientId,
                    clean: options.clean !== false,
                    keepalive: options.keepalive || 60,
                    reconnectPeriod: options.reconnectPeriod || 1000,
                    connectTimeout: options.timeout || 30000,
                    protocolVersion: options.protocolVersion || 4, // MQTT 3.1.1

                    // Authentication
                    username: options.username,
                    password: options.password,

                    // TLS options
                    rejectUnauthorized: options.rejectUnauthorized !== false,
                    ca: options.ca,
                    cert: options.cert,
                    key: options.key,

                    // Will message
                    will: options.will ? {
                        topic: options.will.topic,
                        payload: options.will.payload,
                        qos: options.will.qos || 0,
                        retain: options.will.retain || false
                    } : undefined,

                    // MQTT 5 specific
                    properties: options.properties
                };

                // Create MQTT client
                this.client = mqtt.connect(url, connectOptions);

                // Handle connect
                this.client.on('connect', (connack) => {
                    this.retryCount = 0;
                    this.updateConnectionState('connected');

                    resolve({
                        success: true,
                        connectionId: this.connectionId,
                        url,
                        clientId: connectOptions.clientId,
                        sessionPresent: connack.sessionPresent,
                        returnCode: connack.returnCode
                    });
                });

                // Handle messages
                this.client.on('message', (topic, message, packet) => {
                    this.handleIncomingMessage(topic, message, packet);
                });

                // Handle errors
                this.client.on('error', (error) => {
                    this.metrics.errors++;
                    this.emit('error', {
                        type: 'mqtt',
                        message: error.message,
                        code: error.code,
                        timestamp: new Date()
                    });

                    if (this.connectionState === 'connecting') {
                        reject(new Error(`MQTT connection failed: ${error.message}`));
                    }
                });

                // Handle close
                this.client.on('close', () => {
                    this.updateConnectionState('disconnected');
                    this.emit('close', { timestamp: new Date() });
                });

                // Handle offline
                this.client.on('offline', () => {
                    this.emit('offline', { timestamp: new Date() });
                });

                // Handle reconnect
                this.client.on('reconnect', () => {
                    this.metrics.reconnects++;
                    this.emit('reconnect', {
                        attempt: this.metrics.reconnects,
                        timestamp: new Date()
                    });
                });

                // Handle packetsend (for debugging)
                this.client.on('packetsend', (packet) => {
                    this.emit('packetsend', { packet, timestamp: new Date() });
                });

                // Handle packetreceive (for debugging)
                this.client.on('packetreceive', (packet) => {
                    this.emit('packetreceive', { packet, timestamp: new Date() });
                });

            } catch (error) {
                this.updateConnectionState('error', { error: error.message });
                reject(error);
            }
        });
    }

    /**
     * Handle incoming MQTT message
     * @param {string} topic - Message topic
     * @param {Buffer} message - Message payload
     * @param {Object} packet - Full MQTT packet
     */
    handleIncomingMessage(topic, message, packet) {
        this.trackReceivedMessage(message);

        // Parse message content
        let parsedMessage = message.toString();
        try {
            parsedMessage = JSON.parse(parsedMessage);
        } catch {
            // Keep as string if not valid JSON
        }

        const messageData = {
            id: this.generateMessageId(),
            topic,
            payload: parsedMessage,
            raw: message,
            qos: packet.qos,
            retain: packet.retain,
            dup: packet.dup,
            size: message.length,
            timestamp: new Date()
        };

        // Store message by topic
        if (!this.topicMessages.has(topic)) {
            this.topicMessages.set(topic, []);
        }
        const topicMsgs = this.topicMessages.get(topic);
        topicMsgs.push(messageData);

        // Keep only last 100 messages per topic
        if (topicMsgs.length > 100) {
            topicMsgs.shift();
        }

        // Emit message event
        this.emit('message', messageData);

        // Emit topic-specific event
        this.emit(`message:${topic}`, messageData);
    }

    /**
     * Subscribe to a topic
     * @param {string|string[]} topics - Topic(s) to subscribe to
     * @param {Object} options - Subscription options
     * @returns {Promise<Object>} - Subscription result
     */
    async subscribe(topics, options = {}) {
        return new Promise((resolve, reject) => {
            if (!this.client || !this.client.connected) {
                reject(new Error('Not connected to MQTT broker'));
                return;
            }

            const topicArray = Array.isArray(topics) ? topics : [topics];
            const qos = options.qos !== undefined ? options.qos : 0;

            // Build subscription map
            const subscriptionMap = {};
            topicArray.forEach(topic => {
                subscriptionMap[topic] = { qos, ...options };
            });

            this.client.subscribe(subscriptionMap, (error, granted) => {
                if (error) {
                    this.metrics.errors++;
                    reject(new Error(`Subscription failed: ${error.message}`));
                    return;
                }

                // Store subscriptions
                granted.forEach(g => {
                    this.subscriptions.set(g.topic, {
                        topic: g.topic,
                        qos: g.qos,
                        subscribedAt: new Date()
                    });
                });

                resolve({
                    success: true,
                    subscriptions: granted,
                    timestamp: new Date()
                });
            });
        });
    }

    /**
     * Unsubscribe from a topic
     * @param {string|string[]} topics - Topic(s) to unsubscribe from
     * @returns {Promise<Object>} - Unsubscription result
     */
    async unsubscribe(topics) {
        return new Promise((resolve, reject) => {
            if (!this.client || !this.client.connected) {
                reject(new Error('Not connected to MQTT broker'));
                return;
            }

            const topicArray = Array.isArray(topics) ? topics : [topics];

            this.client.unsubscribe(topicArray, (error) => {
                if (error) {
                    this.metrics.errors++;
                    reject(new Error(`Unsubscribe failed: ${error.message}`));
                    return;
                }

                // Remove from subscriptions
                topicArray.forEach(topic => {
                    this.subscriptions.delete(topic);
                });

                resolve({
                    success: true,
                    topics: topicArray,
                    timestamp: new Date()
                });
            });
        });
    }

    /**
     * Publish a message to a topic
     * @param {string} topic - Topic to publish to
     * @param {*} message - Message payload
     * @param {Object} options - Publish options
     * @returns {Promise<Object>} - Publish result
     */
    async publish(topic, message, options = {}) {
        return new Promise((resolve, reject) => {
            if (!this.client || !this.client.connected) {
                reject(new Error('Not connected to MQTT broker'));
                return;
            }

            const startTime = Date.now();

            // Serialize message
            let payload = message;
            if (typeof message === 'object' && !Buffer.isBuffer(message)) {
                payload = JSON.stringify(message);
            }

            const publishOptions = {
                qos: options.qos !== undefined ? options.qos : 0,
                retain: options.retain || false,
                dup: options.dup || false,
                properties: options.properties // MQTT 5 properties
            };

            this.client.publish(topic, payload, publishOptions, (error) => {
                const latency = Date.now() - startTime;
                this.recordLatency(latency);

                if (error) {
                    this.metrics.errors++;
                    reject(new Error(`Publish failed: ${error.message}`));
                    return;
                }

                const messageId = this.trackSentMessage(payload);

                resolve({
                    success: true,
                    messageId,
                    topic,
                    qos: publishOptions.qos,
                    retain: publishOptions.retain,
                    size: this.calculateMessageSize(payload),
                    latency,
                    timestamp: new Date()
                });
            });
        });
    }

    /**
     * Send message (alias for publish)
     * @param {Object} message - Message containing topic and payload
     * @param {Object} options - Publish options
     * @returns {Promise<Object>} - Publish result
     */
    async send(message, options = {}) {
        const { topic, payload } = message;
        return this.publish(topic, payload, options);
    }

    /**
     * Disconnect from MQTT broker
     * @param {boolean} force - Force disconnect
     * @returns {Promise<void>}
     */
    async disconnect(force = false) {
        return new Promise((resolve) => {
            if (!this.client) {
                this.updateConnectionState('disconnected');
                resolve();
                return;
            }

            this.client.end(force, {}, () => {
                this.subscriptions.clear();
                this.topicMessages.clear();
                this.updateConnectionState('disconnected');
                resolve();
            });
        });
    }

    /**
     * Check if connected
     * @returns {boolean}
     */
    isConnected() {
        return this.client && this.client.connected;
    }

    /**
     * Get active subscriptions
     * @returns {Array} - List of subscriptions
     */
    getSubscriptions() {
        return Array.from(this.subscriptions.values());
    }

    /**
     * Get messages for a topic
     * @param {string} topic - Topic name
     * @param {number} limit - Max messages to return
     * @returns {Array} - Messages
     */
    getTopicMessages(topic, limit = 100) {
        const messages = this.topicMessages.get(topic) || [];
        return messages.slice(-limit);
    }

    /**
     * Get all topics with messages
     * @returns {Array} - Topics with message counts
     */
    getTopicsWithMessages() {
        return Array.from(this.topicMessages.entries()).map(([topic, messages]) => ({
            topic,
            messageCount: messages.length,
            lastMessage: messages[messages.length - 1]?.timestamp
        }));
    }

    /**
     * Clear messages for a topic
     * @param {string} topic - Topic name (optional, clears all if not provided)
     */
    clearMessages(topic = null) {
        if (topic) {
            this.topicMessages.delete(topic);
        } else {
            this.topicMessages.clear();
        }
    }

    /**
     * Get broker info
     * @returns {Object} - Broker information
     */
    getInfo() {
        return {
            ...this.getProtocolInfo(),
            connected: this.isConnected(),
            clientId: this.clientId,
            subscriptions: this.subscriptions.size,
            topics: this.topicMessages.size
        };
    }

    /**
     * Clean up resources
     */
    async cleanup() {
        await this.disconnect(true);
        this.subscriptions.clear();
        this.topicMessages.clear();
        await super.cleanup();
    }
}

// Export singleton instance
module.exports = new MqttService();
module.exports.MqttService = MqttService;
