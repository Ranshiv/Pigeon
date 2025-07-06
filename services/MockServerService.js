// services/MockServerService.js
const MockServer = require('../models/MockServer');
const ApiVersion = require('../models/ApiVersion');

class MockServerService {
    /**
     * Create a new mock server for an API version
     */
    static async createMockServer(mockServerData, userId) {
        try {
            // Validate that the API version exists
            const apiVersion = await ApiVersion.findById(mockServerData.versionId);
            if (!apiVersion) {
                throw new Error('API version not found');
            }

            const mockServer = new MockServer({
                collectionId: mockServerData.collectionId,
                versionId: mockServerData.versionId,
                name: mockServerData.name,
                description: mockServerData.description || '',
                baseUrl: mockServerData.baseUrl,
                port: mockServerData.port || null,
                mockEndpoints: mockServerData.mockEndpoints || [],
                globalConfig: mockServerData.globalConfig || {},
                createdBy: userId
            });

            await mockServer.save();
            return mockServer;
        } catch (error) {
            throw new Error(`Failed to create mock server: ${error.message}`);
        }
    }

    /**
     * Generate mock endpoints from OpenAPI specification
     */
    static generateMockEndpointsFromSpec(openApiSpec) {
        if (!openApiSpec || !openApiSpec.paths) {
            return [];
        }

        const mockEndpoints = [];

        Object.entries(openApiSpec.paths).forEach(([path, pathData]) => {
            Object.entries(pathData).forEach(([method, operation]) => {
                if (['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(method.toLowerCase())) {
                    const mockEndpoint = {
                        path,
                        method: method.toUpperCase(),
                        statusCode: 200,
                        responseHeaders: new Map([
                            ['Content-Type', 'application/json'],
                            ['Access-Control-Allow-Origin', '*']
                        ]),
                        responseBody: this.generateMockResponse(operation),
                        responseDelay: 0,
                        isCustomizable: true
                    };

                    mockEndpoints.push(mockEndpoint);
                }
            });
        });

        return mockEndpoints;
    }

    /**
     * Generate mock response based on OpenAPI operation
     */
    static generateMockResponse(operation) {
        if (!operation.responses) {
            return { message: 'Mock response' };
        }

        // Get the first successful response (200, 201, etc.)
        const successResponse = Object.entries(operation.responses)
            .find(([code, response]) => code.startsWith('2'));

        if (!successResponse) {
            return { message: 'Mock response' };
        }

        const [statusCode, responseData] = successResponse;

        if (responseData.content && responseData.content['application/json']) {
            const schema = responseData.content['application/json'].schema;
            return this.generateMockFromSchema(schema);
        }

        return { message: 'Mock response', statusCode: parseInt(statusCode) };
    }

    /**
     * Generate mock data from JSON schema
     */
    static generateMockFromSchema(schema) {
        if (!schema) {
            return { message: 'Mock response' };
        }

        switch (schema.type) {
            case 'object':
                const mockObject = {};
                if (schema.properties) {
                    Object.entries(schema.properties).forEach(([key, propSchema]) => {
                        mockObject[key] = this.generateMockFromSchema(propSchema);
                    });
                }
                return mockObject;

            case 'array':
                const itemSchema = schema.items;
                return [this.generateMockFromSchema(itemSchema)];

            case 'string':
                if (schema.enum) {
                    return schema.enum[0];
                }
                if (schema.format === 'email') {
                    return 'example@email.com';
                }
                if (schema.format === 'date-time') {
                    return new Date().toISOString();
                }
                if (schema.format === 'uuid') {
                    return '123e4567-e89b-12d3-a456-426614174000';
                }
                return schema.example || 'string value';

            case 'number':
            case 'integer':
                return schema.example || 42;

            case 'boolean':
                return schema.example !== undefined ? schema.example : true;

            default:
                return schema.example || null;
        }
    }

    /**
     * Get mock server by ID
     */
    static async getMockServer(mockServerId) {
        try {
            const mockServer = await MockServer.findById(mockServerId)
                .populate('collectionId', 'name description')
                .populate('versionId', 'version name')
                .populate('createdBy', 'displayName email');

            if (!mockServer) {
                throw new Error('Mock server not found');
            }

            return mockServer;
        } catch (error) {
            throw new Error(`Failed to get mock server: ${error.message}`);
        }
    }

    /**
     * Get all mock servers for a collection
     */
    static async getMockServers(collectionId, versionId = null) {
        try {
            const query = { collectionId };
            if (versionId) {
                query.versionId = versionId;
            }

            const mockServers = await MockServer.find(query)
                .populate('versionId', 'version name')
                .populate('createdBy', 'displayName email')
                .sort({ createdAt: -1 });

            return mockServers;
        } catch (error) {
            throw new Error(`Failed to get mock servers: ${error.message}`);
        }
    }

    /**
     * Update mock server
     */
    static async updateMockServer(mockServerId, updateData, userId) {
        try {
            const mockServer = await MockServer.findById(mockServerId);

            if (!mockServer) {
                throw new Error('Mock server not found');
            }

            // Update allowed fields
            const allowedFields = [
                'name', 'description', 'isActive', 'baseUrl', 'port',
                'mockEndpoints', 'globalConfig'
            ];

            allowedFields.forEach(field => {
                if (updateData[field] !== undefined) {
                    mockServer[field] = updateData[field];
                }
            });

            await mockServer.save();
            return mockServer;
        } catch (error) {
            throw new Error(`Failed to update mock server: ${error.message}`);
        }
    }

    /**
     * Add or update mock endpoint
     */
    static async updateMockEndpoint(mockServerId, endpointData, userId) {
        try {
            const mockServer = await MockServer.findById(mockServerId);

            if (!mockServer) {
                throw new Error('Mock server not found');
            }

            const existingEndpointIndex = mockServer.mockEndpoints.findIndex(
                endpoint => endpoint.path === endpointData.path &&
                    endpoint.method === endpointData.method
            );

            if (existingEndpointIndex >= 0) {
                // Update existing endpoint
                mockServer.mockEndpoints[existingEndpointIndex] = endpointData;
            } else {
                // Add new endpoint
                mockServer.mockEndpoints.push(endpointData);
            }

            await mockServer.save();
            return mockServer;
        } catch (error) {
            throw new Error(`Failed to update mock endpoint: ${error.message}`);
        }
    }

    /**
     * Handle mock request (this would be used by the proxy endpoint)
     */
    static async handleMockRequest(mockServerId, path, method, query, body, headers) {
        try {
            const mockServer = await MockServer.findById(mockServerId);

            if (!mockServer || !mockServer.isActive) {
                throw new Error('Mock server not found or inactive');
            }

            // Find matching endpoint
            const endpoint = mockServer.mockEndpoints.find(
                ep => ep.path === path && ep.method.toUpperCase() === method.toUpperCase()
            );

            if (!endpoint) {
                return {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' },
                    body: { error: 'Endpoint not found', path, method }
                };
            }

            // Apply response delay if configured
            if (endpoint.responseDelay > 0) {
                await new Promise(resolve => setTimeout(resolve, endpoint.responseDelay));
            }

            // Convert response headers Map to object
            const responseHeaders = {};
            if (endpoint.responseHeaders) {
                endpoint.responseHeaders.forEach((value, key) => {
                    responseHeaders[key] = value;
                });
            }

            return {
                status: endpoint.statusCode,
                headers: responseHeaders,
                body: endpoint.responseBody
            };
        } catch (error) {
            throw new Error(`Failed to handle mock request: ${error.message}`);
        }
    }

    /**
     * Delete mock server
     */
    static async deleteMockServer(mockServerId, userId) {
        try {
            const mockServer = await MockServer.findById(mockServerId);

            if (!mockServer) {
                throw new Error('Mock server not found');
            }

            await MockServer.findByIdAndDelete(mockServerId);
            return { message: 'Mock server deleted successfully' };
        } catch (error) {
            throw new Error(`Failed to delete mock server: ${error.message}`);
        }
    }

    /**
     * Generate mock server configuration from OpenAPI spec
     */
    static async createMockServerFromSpec(collectionId, versionId, openApiSpec, userId) {
        try {
            const apiVersion = await ApiVersion.findById(versionId);
            if (!apiVersion) {
                throw new Error('API version not found');
            }

            const mockEndpoints = this.generateMockEndpointsFromSpec(openApiSpec);

            const mockServerData = {
                collectionId,
                versionId,
                name: `Mock Server for ${apiVersion.name}`,
                description: `Auto-generated mock server from OpenAPI specification`,
                baseUrl: `/mock/${versionId}`,
                mockEndpoints,
                globalConfig: {
                    defaultDelay: 0,
                    corsEnabled: true,
                    corsOrigins: ['*'],
                    rateLimit: {
                        enabled: false,
                        requests: 100,
                        windowMs: 15 * 60 * 1000
                    }
                }
            };

            return await this.createMockServer(mockServerData, userId);
        } catch (error) {
            throw new Error(`Failed to create mock server from spec: ${error.message}`);
        }
    }
}

module.exports = MockServerService;
