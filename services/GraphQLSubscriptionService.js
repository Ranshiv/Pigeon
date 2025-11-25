// services/GraphQLSubscriptionService.js
const { createClient } = require('graphql-ws');
const WebSocket = require('ws');
const graphqlValidator = require('../utils/graphql-validator');

/**
 * GraphQL Subscription Service
 * Manages WebSocket connections for GraphQL subscriptions
 * Supports the graphql-ws protocol (2025 standard)
 */

class GraphQLSubscriptionService {
    constructor() {
        this.connections = new Map(); // Active connections by ID
        this.subscriptions = new Map(); // Active subscriptions by ID
    }

    /**
     * Create a WebSocket connection to a GraphQL endpoint
     * @param {string} url - WebSocket URL (ws:// or wss://)
     * @param {Object} options - Connection options
     * @returns {Object} - Connection object with methods
     */
    createConnection(url, options = {}) {
        const connectionId = this.generateConnectionId();

        try {
            // Validate WebSocket URL
            if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
                throw new Error('Invalid WebSocket URL. Must start with ws:// or wss://');
            }

            // Create client using graphql-ws protocol
            const client = createClient({
                url,
                webSocketImpl: WebSocket,
                connectionParams: options.connectionParams || {},
                keepAlive: 10000, // Send ping every 10 seconds
                retryAttempts: 5,
                retryWait: (retries) => {
                    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
                    return Math.min(1000 * Math.pow(2, retries), 16000);
                },
                on: {
                    connected: () => {
                        if (options.onConnected) {
                            options.onConnected(connectionId);
                        }
                    },
                    closed: () => {
                        this.cleanupConnection(connectionId);
                        if (options.onClosed) {
                            options.onClosed(connectionId);
                        }
                    },
                    error: (error) => {
                        if (options.onError) {
                            options.onError(error);
                        }
                    }
                }
            });

            // Store connection
            this.connections.set(connectionId, {
                client,
                url,
                createdAt: new Date(),
                subscriptions: new Set()
            });

            return {
                connectionId,
                client,
                subscribe: (query, variables, handlers) =>
                    this.subscribe(connectionId, query, variables, handlers),
                unsubscribe: (subscriptionId) =>
                    this.unsubscribe(subscriptionId),
                close: () =>
                    this.closeConnection(connectionId)
            };
        } catch (error) {
            throw new Error(`Failed to create connection: ${error.message}`);
        }
    }

    /**
     * Subscribe to a GraphQL subscription
     * @param {string} connectionId - Connection ID
     * @param {string} query - GraphQL subscription query
     * @param {Object} variables - Query variables
     * @param {Object} handlers - Event handlers (onNext, onError, onComplete)
     * @returns {string} - Subscription ID
     */
    subscribe(connectionId, query, variables = {}, handlers = {}) {
        const connection = this.connections.get(connectionId);

        if (!connection) {
            throw new Error('Connection not found');
        }

        // Validate subscription query
        const validation = graphqlValidator.validate(query);
        if (!validation.valid) {
            throw new Error(`Invalid subscription query: ${validation.errors[0]?.message}`);
        }

        // Check if it's actually a subscription operation
        const operationInfo = graphqlValidator.extractOperationInfo(query);
        const isSubscription = operationInfo.operations.some(op => op.type === 'subscription');

        if (!isSubscription) {
            throw new Error('Query must be a subscription operation');
        }

        const subscriptionId = this.generateSubscriptionId();

        try {
            // Create subscription
            const unsubscribe = connection.client.subscribe(
                {
                    query,
                    variables
                },
                {
                    next: (data) => {
                        if (handlers.onNext) {
                            handlers.onNext({
                                subscriptionId,
                                data: data.data,
                                errors: data.errors,
                                timestamp: new Date()
                            });
                        }
                    },
                    error: (error) => {
                        if (handlers.onError) {
                            handlers.onError({
                                subscriptionId,
                                error: error.message || error,
                                timestamp: new Date()
                            });
                        }
                        this.cleanupSubscription(subscriptionId);
                    },
                    complete: () => {
                        if (handlers.onComplete) {
                            handlers.onComplete({
                                subscriptionId,
                                timestamp: new Date()
                            });
                        }
                        this.cleanupSubscription(subscriptionId);
                    }
                }
            );

            // Store subscription
            this.subscriptions.set(subscriptionId, {
                connectionId,
                query,
                variables,
                unsubscribe,
                createdAt: new Date(),
                messageCount: 0
            });

            connection.subscriptions.add(subscriptionId);

            return subscriptionId;
        } catch (error) {
            throw new Error(`Failed to subscribe: ${error.message}`);
        }
    }

    /**
     * Unsubscribe from a subscription
     * @param {string} subscriptionId - Subscription ID
     */
    unsubscribe(subscriptionId) {
        const subscription = this.subscriptions.get(subscriptionId);

        if (!subscription) {
            return false;
        }

        try {
            // Call the unsubscribe function provided by graphql-ws
            subscription.unsubscribe();
            this.cleanupSubscription(subscriptionId);
            return true;
        } catch (error) {
            console.error('Error unsubscribing:', error);
            return false;
        }
    }

    /**
     * Close a WebSocket connection
     * @param {string} connectionId - Connection ID
     */
    closeConnection(connectionId) {
        const connection = this.connections.get(connectionId);

        if (!connection) {
            return false;
        }

        try {
            // Unsubscribe all subscriptions for this connection
            connection.subscriptions.forEach(subId => {
                this.unsubscribe(subId);
            });

            // Close the client
            connection.client.dispose();

            this.cleanupConnection(connectionId);
            return true;
        } catch (error) {
            console.error('Error closing connection:', error);
            return false;
        }
    }

    /**
     * Get connection status
     * @param {string} connectionId - Connection ID
     * @returns {Object} - Connection status
     */
    getConnectionStatus(connectionId) {
        const connection = this.connections.get(connectionId);

        if (!connection) {
            return {
                exists: false,
                status: 'not_found'
            };
        }

        return {
            exists: true,
            url: connection.url,
            createdAt: connection.createdAt,
            subscriptionCount: connection.subscriptions.size,
            subscriptions: Array.from(connection.subscriptions)
        };
    }

    /**
     * Get subscription status
     * @param {string} subscriptionId - Subscription ID
     * @returns {Object} - Subscription status
     */
    getSubscriptionStatus(subscriptionId) {
        const subscription = this.subscriptions.get(subscriptionId);

        if (!subscription) {
            return {
                exists: false,
                status: 'not_found'
            };
        }

        return {
            exists: true,
            connectionId: subscription.connectionId,
            query: subscription.query,
            variables: subscription.variables,
            createdAt: subscription.createdAt,
            messageCount: subscription.messageCount
        };
    }

    /**
     * Get all active connections
     * @returns {Array} - List of connection info
     */
    getAllConnections() {
        const connections = [];

        this.connections.forEach((conn, id) => {
            connections.push({
                connectionId: id,
                url: conn.url,
                createdAt: conn.createdAt,
                subscriptionCount: conn.subscriptions.size
            });
        });

        return connections;
    }

    /**
     * Get all active subscriptions
     * @returns {Array} - List of subscription info
     */
    getAllSubscriptions() {
        const subscriptions = [];

        this.subscriptions.forEach((sub, id) => {
            subscriptions.push({
                subscriptionId: id,
                connectionId: sub.connectionId,
                createdAt: sub.createdAt,
                messageCount: sub.messageCount
            });
        });

        return subscriptions;
    }

    /**
     * Cleanup subscription
     * @param {string} subscriptionId - Subscription ID
     */
    cleanupSubscription(subscriptionId) {
        const subscription = this.subscriptions.get(subscriptionId);

        if (subscription) {
            const connection = this.connections.get(subscription.connectionId);
            if (connection) {
                connection.subscriptions.delete(subscriptionId);
            }
            this.subscriptions.delete(subscriptionId);
        }
    }

    /**
     * Cleanup connection
     * @param {string} connectionId - Connection ID
     */
    cleanupConnection(connectionId) {
        this.connections.delete(connectionId);
    }

    /**
     * Close all connections and subscriptions
     */
    closeAll() {
        this.connections.forEach((conn, id) => {
            this.closeConnection(id);
        });
    }

    /**
     * Generate unique connection ID
     * @returns {string} - Connection ID
     */
    generateConnectionId() {
        return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Generate unique subscription ID
     * @returns {string} - Subscription ID
     */
    generateSubscriptionId() {
        return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

module.exports = new GraphQLSubscriptionService();
