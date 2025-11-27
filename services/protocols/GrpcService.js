// services/protocols/GrpcService.js
const BaseProtocol = require('./BaseProtocol');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const fs = require('fs').promises;
const path = require('path');

/**
 * gRPC Protocol Service
 * Handles gRPC connections with support for proto file loading,
 * unary calls, server/client/bidirectional streaming
 */
class GrpcService extends BaseProtocol {
    constructor(options = {}) {
        super(options);
        
        this.protocolName = 'grpc';
        this.protocolVersion = '1.0.0';
        
        // gRPC specific
        this.clients = new Map();
        this.loadedProtos = new Map();
        this.activeStreams = new Map();
        this.metadata = new grpc.Metadata();
        
        // Proto loader options
        this.protoLoaderOptions = {
            keepCase: true,
            longs: String,
            enums: String,
            defaults: true,
            oneofs: true,
            includeDirs: options.includeDirs || []
        };
    }

    /**
     * Get protocol capabilities
     * @returns {Object} - gRPC capabilities
     */
    getCapabilities() {
        return {
            bidirectional: true,
            streaming: true,
            binarySupport: true,
            compression: true,
            encryption: true,
            authentication: true,
            subscriptions: false,
            requestResponse: true,
            pubSub: false
        };
    }

    /**
     * Load and parse a proto file
     * @param {string} protoPath - Path to .proto file
     * @param {Object} options - Loader options
     * @returns {Promise<Object>} - Proto definition
     */
    async loadProto(protoPath, options = {}) {
        try {
            // Check if already loaded
            if (this.loadedProtos.has(protoPath)) {
                return this.loadedProtos.get(protoPath);
            }

            // Resolve path
            const resolvedPath = path.resolve(protoPath);
            
            // Check file exists
            await fs.access(resolvedPath);

            // Load proto definition
            const packageDefinition = await protoLoader.load(resolvedPath, {
                ...this.protoLoaderOptions,
                ...options
            });

            // Create gRPC object
            const proto = grpc.loadPackageDefinition(packageDefinition);

            // Extract service information
            const services = this.extractServices(proto);
            
            const protoInfo = {
                path: resolvedPath,
                proto,
                packageDefinition,
                services,
                loadedAt: new Date()
            };

            this.loadedProtos.set(protoPath, protoInfo);
            
            return {
                success: true,
                path: resolvedPath,
                services
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Load proto from string content
     * @param {string} protoContent - Proto file content
     * @param {string} fileName - Temporary file name
     * @returns {Promise<Object>} - Proto definition
     */
    async loadProtoFromString(protoContent, fileName = 'temp.proto') {
        try {
            // Write to temp file
            const tempDir = path.join(process.cwd(), '.tmp', 'protos');
            await fs.mkdir(tempDir, { recursive: true });
            
            const tempPath = path.join(tempDir, fileName);
            await fs.writeFile(tempPath, protoContent, 'utf8');

            // Load the proto
            const result = await this.loadProto(tempPath);

            return result;
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Extract service definitions from proto
     * @param {Object} proto - Proto object
     * @param {string} prefix - Package prefix
     * @returns {Array} - Service definitions
     */
    extractServices(proto, prefix = '') {
        const services = [];

        for (const [key, value] of Object.entries(proto)) {
            const fullName = prefix ? `${prefix}.${key}` : key;

            if (value && typeof value === 'function' && value.service) {
                // This is a service
                const methods = this.extractMethods(value.service);
                services.push({
                    name: key,
                    fullName,
                    methods,
                    service: value
                });
            } else if (value && typeof value === 'object') {
                // Recurse into nested packages
                const nestedServices = this.extractServices(value, fullName);
                services.push(...nestedServices);
            }
        }

        return services;
    }

    /**
     * Extract method definitions from service
     * @param {Object} service - Service definition
     * @returns {Array} - Method definitions
     */
    extractMethods(service) {
        const methods = [];

        for (const [methodName, methodDef] of Object.entries(service)) {
            methods.push({
                name: methodName,
                requestType: methodDef.requestType?.type?.name || 'Unknown',
                responseType: methodDef.responseType?.type?.name || 'Unknown',
                requestStream: methodDef.requestStream || false,
                responseStream: methodDef.responseStream || false,
                path: methodDef.path
            });
        }

        return methods;
    }

    /**
     * Connect to a gRPC server
     * @param {string} url - Server URL (host:port)
     * @param {Object} options - Connection options
     * @returns {Promise<Object>} - Connection result
     */
    async connect(url, options = {}) {
        try {
            this.connectionId = this.generateConnectionId();
            this.updateConnectionState('connecting');

            // Parse URL
            let host = url;
            if (url.startsWith('grpc://')) {
                host = url.replace('grpc://', '');
            } else if (url.startsWith('grpcs://')) {
                host = url.replace('grpcs://', '');
            }

            // Determine credentials
            let credentials;
            if (options.secure || url.startsWith('grpcs://')) {
                if (options.rootCert) {
                    const rootCert = Buffer.from(options.rootCert);
                    const privateKey = options.privateKey ? Buffer.from(options.privateKey) : null;
                    const certChain = options.certChain ? Buffer.from(options.certChain) : null;
                    credentials = grpc.credentials.createSsl(rootCert, privateKey, certChain);
                } else {
                    credentials = grpc.credentials.createSsl();
                }
            } else {
                credentials = grpc.credentials.createInsecure();
            }

            // Set up channel options
            const channelOptions = {
                'grpc.max_receive_message_length': options.maxReceiveSize || 4 * 1024 * 1024,
                'grpc.max_send_message_length': options.maxSendSize || 4 * 1024 * 1024,
                'grpc.keepalive_time_ms': options.keepaliveTime || 10000,
                'grpc.keepalive_timeout_ms': options.keepaliveTimeout || 5000,
                ...options.channelOptions
            };

            // Store connection info
            this.clients.set(this.connectionId, {
                host,
                credentials,
                channelOptions,
                options,
                createdAt: new Date(),
                services: new Map()
            });

            // Set metadata
            if (options.metadata) {
                for (const [key, value] of Object.entries(options.metadata)) {
                    this.metadata.set(key, value);
                }
            }

            this.updateConnectionState('connected');

            return {
                success: true,
                connectionId: this.connectionId,
                host,
                secure: !!options.secure || url.startsWith('grpcs://')
            };
        } catch (error) {
            this.updateConnectionState('error', { error: error.message });
            throw error;
        }
    }

    /**
     * Create a service client
     * @param {string} serviceName - Full service name
     * @param {string} protoPath - Path to proto file
     * @returns {Promise<Object>} - Service client
     */
    async createClient(serviceName, protoPath) {
        try {
            const connection = this.clients.get(this.connectionId);
            if (!connection) {
                throw new Error('Not connected to a gRPC server');
            }

            // Load proto if not already loaded
            let protoInfo = this.loadedProtos.get(protoPath);
            if (!protoInfo) {
                const loadResult = await this.loadProto(protoPath);
                if (!loadResult.success) {
                    throw new Error(`Failed to load proto: ${loadResult.error}`);
                }
                protoInfo = this.loadedProtos.get(protoPath);
            }

            // Find service
            const service = protoInfo.services.find(s => 
                s.name === serviceName || s.fullName === serviceName
            );

            if (!service) {
                throw new Error(`Service ${serviceName} not found in proto`);
            }

            // Create client
            const client = new service.service(
                connection.host,
                connection.credentials,
                connection.channelOptions
            );

            // Store client
            connection.services.set(serviceName, {
                client,
                service,
                protoPath
            });

            return {
                success: true,
                serviceName,
                methods: service.methods
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Invoke a unary gRPC method
     * @param {string} serviceName - Service name
     * @param {string} methodName - Method name
     * @param {Object} request - Request payload
     * @param {Object} options - Call options
     * @returns {Promise<Object>} - Response
     */
    async invokeUnary(serviceName, methodName, request, options = {}) {
        return new Promise((resolve, reject) => {
            try {
                const connection = this.clients.get(this.connectionId);
                if (!connection) {
                    throw new Error('Not connected to a gRPC server');
                }

                const serviceInfo = connection.services.get(serviceName);
                if (!serviceInfo) {
                    throw new Error(`Service ${serviceName} not initialized`);
                }

                const client = serviceInfo.client;
                const method = client[methodName];

                if (!method) {
                    throw new Error(`Method ${methodName} not found in service ${serviceName}`);
                }

                // Prepare metadata
                const metadata = new grpc.Metadata();
                if (options.metadata) {
                    for (const [key, value] of Object.entries(options.metadata)) {
                        metadata.set(key, value);
                    }
                }

                // Add default metadata
                for (const [key, value] of this.metadata.entries()) {
                    if (!metadata.get(key)) {
                        metadata.set(key, value);
                    }
                }

                // Set deadline
                const deadline = options.timeout 
                    ? new Date(Date.now() + options.timeout)
                    : undefined;

                const startTime = Date.now();

                // Make the call
                method.call(client, request, metadata, { deadline }, (error, response) => {
                    const latency = Date.now() - startTime;
                    this.recordLatency(latency);

                    if (error) {
                        this.metrics.errors++;
                        resolve({
                            success: false,
                            error: {
                                code: error.code,
                                message: error.message,
                                details: error.details
                            },
                            latency
                        });
                    } else {
                        this.metrics.messagesReceived++;
                        resolve({
                            success: true,
                            data: response,
                            latency,
                            timestamp: new Date()
                        });
                    }
                });

                this.metrics.messagesSent++;
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Invoke a server streaming method
     * @param {string} serviceName - Service name
     * @param {string} methodName - Method name
     * @param {Object} request - Request payload
     * @param {Object} options - Call options
     * @returns {Object} - Stream object with event handling
     */
    invokeServerStreaming(serviceName, methodName, request, options = {}) {
        const connection = this.clients.get(this.connectionId);
        if (!connection) {
            throw new Error('Not connected to a gRPC server');
        }

        const serviceInfo = connection.services.get(serviceName);
        if (!serviceInfo) {
            throw new Error(`Service ${serviceName} not initialized`);
        }

        const client = serviceInfo.client;
        const method = client[methodName];

        if (!method) {
            throw new Error(`Method ${methodName} not found`);
        }

        // Prepare metadata
        const metadata = new grpc.Metadata();
        if (options.metadata) {
            for (const [key, value] of Object.entries(options.metadata)) {
                metadata.set(key, value);
            }
        }

        const streamId = this.generateMessageId();
        const call = method.call(client, request, metadata);

        // Store stream
        this.activeStreams.set(streamId, {
            call,
            type: 'serverStreaming',
            serviceName,
            methodName,
            createdAt: new Date()
        });

        // Wrap stream with events
        call.on('data', (data) => {
            this.metrics.messagesReceived++;
            this.emit('streamData', {
                streamId,
                data,
                timestamp: new Date()
            });
        });

        call.on('end', () => {
            this.activeStreams.delete(streamId);
            this.emit('streamEnd', { streamId });
        });

        call.on('error', (error) => {
            this.metrics.errors++;
            this.activeStreams.delete(streamId);
            this.emit('streamError', {
                streamId,
                error: {
                    code: error.code,
                    message: error.message
                }
            });
        });

        call.on('status', (status) => {
            this.emit('streamStatus', { streamId, status });
        });

        this.metrics.messagesSent++;

        return {
            streamId,
            cancel: () => {
                call.cancel();
                this.activeStreams.delete(streamId);
            }
        };
    }

    /**
     * Invoke a client streaming method
     * @param {string} serviceName - Service name
     * @param {string} methodName - Method name
     * @param {Object} options - Call options
     * @returns {Object} - Stream writer object
     */
    invokeClientStreaming(serviceName, methodName, options = {}) {
        const connection = this.clients.get(this.connectionId);
        if (!connection) {
            throw new Error('Not connected to a gRPC server');
        }

        const serviceInfo = connection.services.get(serviceName);
        if (!serviceInfo) {
            throw new Error(`Service ${serviceName} not initialized`);
        }

        const client = serviceInfo.client;
        const method = client[methodName];

        // Prepare metadata
        const metadata = new grpc.Metadata();
        if (options.metadata) {
            for (const [key, value] of Object.entries(options.metadata)) {
                metadata.set(key, value);
            }
        }

        const streamId = this.generateMessageId();
        
        return new Promise((resolve, reject) => {
            const call = method.call(client, metadata, (error, response) => {
                this.activeStreams.delete(streamId);
                
                if (error) {
                    this.metrics.errors++;
                    reject(error);
                } else {
                    this.metrics.messagesReceived++;
                    resolve({
                        success: true,
                        data: response,
                        timestamp: new Date()
                    });
                }
            });

            this.activeStreams.set(streamId, {
                call,
                type: 'clientStreaming',
                serviceName,
                methodName,
                createdAt: new Date()
            });

            // Return stream writer
            resolve({
                streamId,
                write: (data) => {
                    call.write(data);
                    this.metrics.messagesSent++;
                },
                end: () => {
                    call.end();
                },
                cancel: () => {
                    call.cancel();
                    this.activeStreams.delete(streamId);
                }
            });
        });
    }

    /**
     * Invoke a bidirectional streaming method
     * @param {string} serviceName - Service name
     * @param {string} methodName - Method name
     * @param {Object} options - Call options
     * @returns {Object} - Bidirectional stream object
     */
    invokeBidiStreaming(serviceName, methodName, options = {}) {
        const connection = this.clients.get(this.connectionId);
        if (!connection) {
            throw new Error('Not connected to a gRPC server');
        }

        const serviceInfo = connection.services.get(serviceName);
        if (!serviceInfo) {
            throw new Error(`Service ${serviceName} not initialized`);
        }

        const client = serviceInfo.client;
        const method = client[methodName];

        // Prepare metadata
        const metadata = new grpc.Metadata();
        if (options.metadata) {
            for (const [key, value] of Object.entries(options.metadata)) {
                metadata.set(key, value);
            }
        }

        const streamId = this.generateMessageId();
        const call = method.call(client, metadata);

        this.activeStreams.set(streamId, {
            call,
            type: 'bidiStreaming',
            serviceName,
            methodName,
            createdAt: new Date()
        });

        // Set up listeners
        call.on('data', (data) => {
            this.metrics.messagesReceived++;
            this.emit('streamData', {
                streamId,
                data,
                timestamp: new Date()
            });
        });

        call.on('end', () => {
            this.activeStreams.delete(streamId);
            this.emit('streamEnd', { streamId });
        });

        call.on('error', (error) => {
            this.metrics.errors++;
            this.activeStreams.delete(streamId);
            this.emit('streamError', {
                streamId,
                error: {
                    code: error.code,
                    message: error.message
                }
            });
        });

        return {
            streamId,
            write: (data) => {
                call.write(data);
                this.metrics.messagesSent++;
            },
            end: () => {
                call.end();
            },
            cancel: () => {
                call.cancel();
                this.activeStreams.delete(streamId);
            }
        };
    }

    /**
     * Send message (alias for invokeUnary)
     * @param {Object} message - Message containing service, method, and data
     * @param {Object} options - Call options
     * @returns {Promise<Object>} - Response
     */
    async send(message, options = {}) {
        const { service, method, data } = message;
        return this.invokeUnary(service, method, data, options);
    }

    /**
     * Disconnect from gRPC server
     */
    async disconnect() {
        // Cancel all active streams
        for (const [streamId, stream] of this.activeStreams) {
            try {
                stream.call.cancel();
            } catch {
                // Ignore cancel errors
            }
        }
        this.activeStreams.clear();

        // Close all clients
        const connection = this.clients.get(this.connectionId);
        if (connection) {
            for (const [, serviceInfo] of connection.services) {
                try {
                    grpc.closeClient(serviceInfo.client);
                } catch {
                    // Ignore close errors
                }
            }
        }

        this.clients.delete(this.connectionId);
        this.updateConnectionState('disconnected');
    }

    /**
     * Get loaded services
     * @returns {Array} - List of loaded services
     */
    getLoadedServices() {
        const services = [];
        for (const [path, protoInfo] of this.loadedProtos) {
            services.push({
                path,
                services: protoInfo.services.map(s => ({
                    name: s.name,
                    fullName: s.fullName,
                    methods: s.methods
                })),
                loadedAt: protoInfo.loadedAt
            });
        }
        return services;
    }

    /**
     * Get active streams
     * @returns {Array} - Active stream info
     */
    getActiveStreams() {
        return Array.from(this.activeStreams.entries()).map(([id, stream]) => ({
            id,
            type: stream.type,
            serviceName: stream.serviceName,
            methodName: stream.methodName,
            createdAt: stream.createdAt
        }));
    }

    /**
     * Clean up resources
     */
    async cleanup() {
        await this.disconnect();
        this.loadedProtos.clear();
        await super.cleanup();
    }
}

// Export singleton instance
module.exports = new GrpcService();
module.exports.GrpcService = GrpcService;
