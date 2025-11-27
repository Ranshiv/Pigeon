// services/protocols/SseService.js
const BaseProtocol = require('./BaseProtocol');
const EventSource = require('eventsource');
const https = require('https');
const http = require('http');

/**
 * Server-Sent Events (SSE) Protocol Service
 * Handles SSE connections for real-time event streaming
 * Supports auto-reconnect and custom event types
 */
class SseService extends BaseProtocol {
    constructor(options = {}) {
        super(options);

        this.protocolName = 'sse';
        this.protocolVersion = '1.0.0';

        // SSE specific
        this.eventSource = null;
        this.url = null;
        this.eventHandlers = new Map();
        this.receivedEvents = [];
        this.lastEventId = null;

        // Auto-reconnect settings
        this.autoReconnect = options.autoReconnect !== false;
        this.reconnectInterval = options.reconnectInterval || 3000;
        this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
    }

    /**
     * Get protocol capabilities
     * @returns {Object} - SSE capabilities
     */
    getCapabilities() {
        return {
            bidirectional: false, // SSE is server-to-client only
            streaming: true,
            binarySupport: false, // Text only
            compression: true,
            encryption: true, // https://
            authentication: true,
            subscriptions: true,
            requestResponse: false,
            pubSub: false
        };
    }

    /**
     * Connect to an SSE endpoint
     * @param {string} url - SSE endpoint URL
     * @param {Object} options - Connection options
     * @returns {Promise<Object>} - Connection result
     */
    async connect(url, options = {}) {
        return new Promise((resolve, reject) => {
            try {
                // Validate URL
                const parsedUrl = this.parseUrl(url, ['http', 'https']);
                if (!parsedUrl.valid) {
                    throw new Error(`Invalid SSE URL: ${parsedUrl.error}`);
                }

                this.url = url;
                this.connectionId = this.generateConnectionId();
                this.updateConnectionState('connecting');

                // Prepare EventSource options
                const eventSourceOptions = {
                    headers: options.headers || {},
                    withCredentials: options.withCredentials || false,
                    https: options.secure ? {
                        rejectUnauthorized: options.rejectUnauthorized !== false,
                        ca: options.ca,
                        cert: options.cert,
                        key: options.key
                    } : undefined
                };

                // Add Last-Event-ID if resuming
                if (options.lastEventId) {
                    eventSourceOptions.headers['Last-Event-ID'] = options.lastEventId;
                    this.lastEventId = options.lastEventId;
                }

                // Create EventSource
                this.eventSource = new EventSource(url, eventSourceOptions);

                // Handle open
                this.eventSource.onopen = () => {
                    this.retryCount = 0;
                    this.updateConnectionState('connected');

                    resolve({
                        success: true,
                        connectionId: this.connectionId,
                        url: this.url
                    });
                };

                // Handle default message event
                this.eventSource.onmessage = (event) => {
                    this.handleEvent('message', event);
                };

                // Handle errors
                this.eventSource.onerror = (error) => {
                    const errorInfo = {
                        type: 'sse',
                        message: error.message || 'SSE connection error',
                        status: error.status,
                        timestamp: new Date()
                    };

                    this.metrics.errors++;
                    this.emit('error', errorInfo);

                    if (this.connectionState === 'connecting') {
                        reject(new Error(`SSE connection failed: ${errorInfo.message}`));
                    } else if (this.autoReconnect && this.retryCount < this.maxReconnectAttempts) {
                        this.handleReconnect();
                    } else if (this.retryCount >= this.maxReconnectAttempts) {
                        this.updateConnectionState('error', { error: 'Max reconnect attempts reached' });
                        this.emit('maxRetriesReached', {
                            attempts: this.retryCount,
                            error: errorInfo.message
                        });
                    }
                };

                // Set up custom event listeners from handlers
                if (options.eventTypes) {
                    options.eventTypes.forEach(eventType => {
                        this.addEventListener(eventType);
                    });
                }

            } catch (error) {
                this.updateConnectionState('error', { error: error.message });
                reject(error);
            }
        });
    }

    /**
     * Handle incoming SSE event
     * @param {string} eventType - Event type
     * @param {MessageEvent} event - SSE event object
     */
    handleEvent(eventType, event) {
        this.trackReceivedMessage(event.data || '');

        // Parse data
        let parsedData = event.data;
        try {
            parsedData = JSON.parse(event.data);
        } catch {
            // Keep as string if not valid JSON
        }

        const eventData = {
            id: event.lastEventId || this.generateMessageId(),
            type: eventType,
            data: parsedData,
            raw: event.data,
            origin: event.origin,
            lastEventId: event.lastEventId,
            timestamp: new Date()
        };

        // Track last event ID
        if (event.lastEventId) {
            this.lastEventId = event.lastEventId;
        }

        // Store event
        this.receivedEvents.push(eventData);

        // Keep only last 1000 events
        if (this.receivedEvents.length > 1000) {
            this.receivedEvents.shift();
        }

        // Emit events
        this.emit('event', eventData);
        this.emit(`event:${eventType}`, eventData);

        // Call registered handler if exists
        const handler = this.eventHandlers.get(eventType);
        if (handler) {
            handler(eventData);
        }
    }

    /**
     * Add event listener for specific event type
     * @param {string} eventType - Event type to listen for
     * @param {Function} handler - Optional handler function
     */
    addEventListener(eventType, handler = null) {
        if (!this.eventSource) {
            throw new Error('Not connected to SSE endpoint');
        }

        // Store handler
        if (handler) {
            this.eventHandlers.set(eventType, handler);
        }

        // Add listener to EventSource
        this.eventSource.addEventListener(eventType, (event) => {
            this.handleEvent(eventType, event);
        });
    }

    /**
     * Remove event listener
     * @param {string} eventType - Event type
     */
    removeEventListener(eventType) {
        this.eventHandlers.delete(eventType);
        // Note: EventSource doesn't support removing listeners directly
        // The handler will no longer be called as it's removed from our map
    }

    /**
     * Handle reconnection
     */
    handleReconnect() {
        this.retryCount++;
        this.metrics.reconnects++;
        this.updateConnectionState('connecting');

        this.emit('reconnecting', {
            attempt: this.retryCount,
            maxAttempts: this.maxReconnectAttempts,
            delay: this.reconnectInterval
        });

        // EventSource handles reconnection automatically
        // We just track the state here
    }

    /**
     * SSE is receive-only, so send throws an error
     * @throws {Error} - Always throws as SSE doesn't support sending
     */
    async send() {
        throw new Error('SSE is a receive-only protocol. Use HTTP requests to send data to the server.');
    }

    /**
     * Disconnect from SSE endpoint
     */
    async disconnect() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }

        this.eventHandlers.clear();
        this.updateConnectionState('disconnected');
    }

    /**
     * Check if connected
     * @returns {boolean}
     */
    isConnected() {
        return this.eventSource && this.eventSource.readyState === EventSource.OPEN;
    }

    /**
     * Get ready state
     * @returns {string}
     */
    getReadyState() {
        if (!this.eventSource) return 'CLOSED';

        const states = {
            [EventSource.CONNECTING]: 'CONNECTING',
            [EventSource.OPEN]: 'OPEN',
            [EventSource.CLOSED]: 'CLOSED'
        };

        return states[this.eventSource.readyState] || 'UNKNOWN';
    }

    /**
     * Get event history
     * @param {string} eventType - Optional filter by event type
     * @param {number} limit - Max events to return
     * @returns {Array} - Event history
     */
    getEventHistory(eventType = null, limit = 100) {
        let events = this.receivedEvents;

        if (eventType) {
            events = events.filter(e => e.type === eventType);
        }

        return events.slice(-limit);
    }

    /**
     * Get registered event types
     * @returns {Array} - List of event types
     */
    getRegisteredEventTypes() {
        return Array.from(this.eventHandlers.keys());
    }

    /**
     * Clear event history
     */
    clearHistory() {
        this.receivedEvents = [];
    }

    /**
     * Get SSE info
     * @returns {Object} - SSE connection information
     */
    getInfo() {
        return {
            ...this.getProtocolInfo(),
            url: this.url,
            readyState: this.getReadyState(),
            lastEventId: this.lastEventId,
            registeredEvents: this.getRegisteredEventTypes(),
            eventCount: this.receivedEvents.length,
            autoReconnect: this.autoReconnect,
            reconnectAttempts: this.retryCount
        };
    }

    /**
     * Create a custom SSE stream for testing
     * Useful for mocking SSE responses
     * @param {Object} options - Stream options
     * @returns {Object} - Stream control object
     */
    static createMockStream(options = {}) {
        const events = [];
        let intervalId = null;

        const stream = {
            addEvent: (eventType, data, id = null) => {
                events.push({
                    type: eventType,
                    data: typeof data === 'object' ? JSON.stringify(data) : data,
                    id
                });
            },

            start: (interval = 1000, callback) => {
                let index = 0;
                intervalId = setInterval(() => {
                    if (index < events.length) {
                        callback(events[index]);
                        index++;
                    } else if (options.loop) {
                        index = 0;
                    } else {
                        stream.stop();
                    }
                }, interval);
            },

            stop: () => {
                if (intervalId) {
                    clearInterval(intervalId);
                    intervalId = null;
                }
            },

            formatAsSSE: () => {
                return events.map(e => {
                    let sse = '';
                    if (e.id) sse += `id: ${e.id}\n`;
                    if (e.type && e.type !== 'message') sse += `event: ${e.type}\n`;
                    sse += `data: ${e.data}\n\n`;
                    return sse;
                }).join('');
            }
        };

        return stream;
    }

    /**
     * Clean up resources
     */
    async cleanup() {
        await this.disconnect();
        this.receivedEvents = [];
        this.eventHandlers.clear();
        await super.cleanup();
    }
}

// Export singleton instance
module.exports = new SseService();
module.exports.SseService = SseService;
