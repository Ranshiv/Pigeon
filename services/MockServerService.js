// services/MockServerService.js
const MockServer = require('../models/MockServer');
const ApiVersion = require('../models/ApiVersion');
const MockAnalytics = require('../models/MockAnalytics');
const MockRecording = require('../models/MockRecording');
const MockFaultEvent = require('../models/MockFaultEvent');
const variableResolver = require('./VariableResolver');
const { getIO } = require('../utils/socket/socket-server');

const MAX_FAULT_EVENTS_PER_SERVER = 500;

class MockServerService {
    /**
     * Match a request path against an endpoint pattern with dynamic parameters
     * @param {string} pattern - Endpoint pattern like /api/products/:id
     * @param {string} requestPath - Actual request path like /api/products/123
     * @returns {Object|null} - Matched params or null if no match
     */
    static matchPath(pattern, requestPath) {
        const patternParts = pattern.split('/').filter(Boolean);
        const pathParts = requestPath.split('/').filter(Boolean);

        if (patternParts.length !== pathParts.length) {
            return null;
        }

        const params = {};

        for (let i = 0; i < patternParts.length; i++) {
            const patternPart = patternParts[i];
            const pathPart = pathParts[i];

            if (patternPart.startsWith(':')) {
                // Dynamic parameter - extract the value
                const paramName = patternPart.substring(1);
                params[paramName] = pathPart;
            } else if (patternPart !== pathPart) {
                // Static part doesn't match
                return null;
            }
        }

        return params;
    }

    /**
     * Find matching endpoint with support for dynamic path parameters
     * @param {Array} endpoints - Array of endpoint definitions
     * @param {string} path - Request path
     * @param {string} method - HTTP method
     * @returns {Object|null} - Matched endpoint with extracted params, or null
     */
    static findMatchingEndpoint(endpoints, path, method) {
        // First try exact match
        const exactMatch = endpoints.find(
            ep => ep.path === path && ep.method.toUpperCase() === method.toUpperCase()
        );
        if (exactMatch) {
            return { endpoint: exactMatch, params: {} };
        }

        // Then try pattern matching for dynamic routes
        for (const ep of endpoints) {
            if (ep.method.toUpperCase() !== method.toUpperCase()) {
                continue;
            }

            // Check if endpoint has dynamic parameters
            if (ep.path.includes(':')) {
                const params = this.matchPath(ep.path, path);
                if (params) {
                    return { endpoint: ep, params };
                }
            }
        }

        return null;
    }

    /**
     * Evaluate scenario trigger conditions against a request
     * @param {Object} scenario - The scenario to evaluate
     * @param {Object} request - The incoming request
     * @param {Object} mockServer - The mock server for state access
     * @returns {boolean} - Whether the scenario should trigger
     */
    static evaluateScenarioConditions(scenario, request, mockServer) {
        if (!scenario.triggerConditions || scenario.triggerConditions.length === 0) {
            return true; // No conditions means always trigger
        }

        let result = null;

        for (let i = 0; i < scenario.triggerConditions.length; i++) {
            const condition = scenario.triggerConditions[i];
            const conditionResult = this.evaluateSingleCondition(condition, request, mockServer);

            if (i === 0) {
                result = conditionResult;
            } else {
                if (condition.logic === 'AND') {
                    result = result && conditionResult;
                } else {
                    result = result || conditionResult;
                }
            }
        }

        return result === true;
    }

    /**
     * Evaluate a single trigger condition
     */
    static evaluateSingleCondition(condition, request, mockServer) {
        const { type, key, operator, value } = condition;
        let actualValue;

        switch (type) {
            case 'header':
                actualValue = request.headers?.[key?.toLowerCase()] || request.headers?.[key];
                break;
            case 'query':
                actualValue = request.query?.[key];
                break;
            case 'body':
                actualValue = this.getNestedValue(request.body, key);
                break;
            case 'method':
                actualValue = request.method?.toUpperCase();
                break;
            case 'path':
                actualValue = request.path;
                break;
            case 'probability':
                // Random probability check
                const probability = parseFloat(value) / 100;
                return Math.random() < probability;
            case 'counter':
                // Check counter value from state
                const counterValue = mockServer.state?.counters?.get(key) || 0;
                actualValue = counterValue;
                break;
            case 'sequential':
                // Always true for sequential - handled by response selection
                return true;
            default:
                return false;
        }

        return this.compareValues(actualValue, operator, value);
    }

    /**
     * Compare values based on operator
     */
    static compareValues(actualValue, operator, expectedValue) {
        const actual = String(actualValue ?? '');
        const expected = String(expectedValue ?? '');

        switch (operator) {
            case 'equals':
                return actual === expected;
            case 'not_equals':
                return actual !== expected;
            case 'contains':
                return actual.includes(expected);
            case 'not_contains':
                return !actual.includes(expected);
            case 'starts_with':
                return actual.startsWith(expected);
            case 'ends_with':
                return actual.endsWith(expected);
            case 'matches':
                try {
                    const regex = new RegExp(expected);
                    return regex.test(actual);
                } catch {
                    return false;
                }
            case 'exists':
                return actualValue !== undefined && actualValue !== null;
            case 'not_exists':
                return actualValue === undefined || actualValue === null;
            case 'greater_than':
                return parseFloat(actual) > parseFloat(expected);
            case 'less_than':
                return parseFloat(actual) < parseFloat(expected);
            default:
                return false;
        }
    }

    /**
     * Get nested value from object using dot notation
     */
    static getNestedValue(obj, path) {
        if (!obj || !path) return undefined;
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    /**
     * Select response from scenario based on weights or sequence
     */
    static selectScenarioResponse(scenario, mockServer) {
        if (!scenario.responses || scenario.responses.length === 0) {
            return null;
        }

        if (scenario.responses.length === 1) {
            return scenario.responses[0];
        }

        // Sequential response selection
        if (!scenario.useWeightedResponses) {
            const index = (scenario.sequentialIndex || 0) % scenario.responses.length;
            // Note: sequentialIndex should be incremented after selection
            return scenario.responses[index];
        }

        // Weighted random selection
        const totalWeight = scenario.responses.reduce((sum, r) => sum + (r.weight || 100), 0);
        let random = Math.random() * totalWeight;

        for (const response of scenario.responses) {
            random -= (response.weight || 100);
            if (random <= 0) {
                return response;
            }
        }

        return scenario.responses[0];
    }

    /**
     * Resolve variables in response body
     */
    static async resolveResponseVariables(responseBody, request, mockServer, contextId = null) {
        // Convert Map/Mongoose objects to plain objects first
        let body = responseBody;
        if (responseBody instanceof Map) {
            body = Object.fromEntries(responseBody);
        } else if (responseBody && typeof responseBody === 'object' && responseBody.toJSON) {
            body = responseBody.toJSON();
        } else if (responseBody && typeof responseBody === 'object') {
            // Deep clone to ensure it's a plain object
            try {
                body = JSON.parse(JSON.stringify(responseBody));
            } catch (e) {
                body = responseBody;
            }
        }

        if (!mockServer.globalConfig?.enableVariableResolution) {
            return body;
        }

        if (typeof body === 'string') {
            // Simple variable replacement for string responses
            return responseBody.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
                const trimmedName = varName.trim();

                // Check mock server state variables (with state. prefix)
                if (trimmedName.startsWith('state.')) {
                    const stateVarName = trimmedName.substring(6); // Remove 'state.' prefix
                    if (mockServer.state?.variables?.has(stateVarName)) {
                        return mockServer.state.variables.get(stateVarName);
                    }
                }

                // Check mock server state first (without prefix for backward compatibility)
                if (mockServer.state?.variables?.has(trimmedName)) {
                    return mockServer.state.variables.get(trimmedName);
                }

                // Check request data
                if (trimmedName.startsWith('request.')) {
                    const path = trimmedName.substring(8);
                    if (path === 'method') return request.method;
                    if (path === 'path') return request.path;
                    if (path.startsWith('headers.')) {
                        return request.headers?.[path.substring(8)] || match;
                    }
                    if (path.startsWith('query.')) {
                        return request.query?.[path.substring(6)] || match;
                    }
                    if (path.startsWith('body.')) {
                        return this.getNestedValue(request.body, path.substring(5)) || match;
                    }
                }

                // Check path parameters (e.g., {{params.id}})
                if (trimmedName.startsWith('params.')) {
                    const paramName = trimmedName.substring(7);
                    return request.params?.[paramName] || match;
                }

                // Check counters
                if (trimmedName.startsWith('counter.')) {
                    const counterName = trimmedName.substring(8);
                    return mockServer.state?.counters?.get(counterName) || 0;
                }

                // Built-in variables
                if (trimmedName === 'timestamp') return new Date().toISOString();
                if (trimmedName === 'randomUUID') return require('crypto').randomUUID();
                if (trimmedName === 'randomInt') return Math.floor(Math.random() * 1000000);

                return match;
            });
        }

        if (typeof responseBody === 'object' && responseBody !== null) {
            // Deep clone and resolve variables in object
            const resolved = JSON.parse(JSON.stringify(responseBody));
            return await this.resolveObjectVariables(resolved, request, mockServer);
        }

        return responseBody;
    }

    /**
     * Recursively resolve variables in an object
     */
    static async resolveObjectVariables(obj, request, mockServer) {
        if (typeof obj === 'string') {
            return await this.resolveResponseVariables(obj, request, mockServer);
        }

        if (Array.isArray(obj)) {
            return await Promise.all(obj.map(item => this.resolveObjectVariables(item, request, mockServer)));
        }

        if (typeof obj === 'object' && obj !== null) {
            const resolved = {};
            for (const [key, value] of Object.entries(obj)) {
                resolved[key] = await this.resolveObjectVariables(value, request, mockServer);
            }
            return resolved;
        }

        return obj;
    }

    static migrateLegacyChaos(mockServer) {
        const chaos = mockServer.globalConfig?.chaos;
        if (!chaos || chaos.legacyMigratedAt || !chaos.enabled) return false;

        const failureRate = Math.max(0, Math.min(100, Number(chaos.randomFailureRate || 0)));
        const delayMinMs = Math.max(0, Number(chaos.randomDelayRange?.min || 0));
        const delayMaxMs = Math.max(delayMinMs, Number(chaos.randomDelayRange?.max || 0));
        const profiles = chaos.profiles || [];
        const maxPriority = profiles.reduce((max, profile) => Math.max(max, Number(profile.priority || 0)), 0);

        // A legacy failure had its delay applied as well. The status profile
        // therefore carries the same delay, while the latency profile covers
        // successful calls when the failure probability does not match.
        if (failureRate > 0) {
            profiles.push({
                name: 'Migrated random failure',
                description: 'Created from the previous mock-server chaos configuration.',
                isActive: true,
                priority: maxPriority + 2,
                target: { method: '*', path: '*' },
                probability: failureRate,
                schedule: { mode: 'continuous', startAt: new Date(), intervalMs: 60000, durationMs: 10000 },
                fault: { type: 'status', statusCode: 500, delayMinMs, delayMaxMs }
            });
        }
        if (delayMaxMs > 0) {
            profiles.push({
                name: 'Migrated random delay',
                description: 'Created from the previous mock-server chaos configuration.',
                isActive: true,
                priority: maxPriority + 1,
                target: { method: '*', path: '*' },
                probability: 100,
                schedule: { mode: 'continuous', startAt: new Date(), intervalMs: 60000, durationMs: 10000 },
                fault: { type: 'latency', delayMinMs, delayMaxMs }
            });
        }

        chaos.profiles = profiles;
        chaos.globalEnabled = Boolean(chaos.globalEnabled || chaos.enabled);
        chaos.enabled = false;
        chaos.randomFailureRate = 0;
        chaos.randomDelayRange = { min: 0, max: 0 };
        chaos.legacyMigratedAt = new Date();
        return true;
    }

    /**
     * Apply legacy chaos engineering effects. New servers use Fault Lab
     * profiles; this remains only for records that have not been loaded yet.
     */
    static applyChaosEffects(mockServer) {
        const chaos = mockServer.globalConfig?.chaos;
        if (!chaos?.enabled) {
            return { shouldFail: false, extraDelay: 0 };
        }

        // Random failure
        const shouldFail = Math.random() * 100 < (chaos.randomFailureRate || 0);

        // Random delay
        let extraDelay = 0;
        if (chaos.randomDelayRange?.max > 0) {
            const min = chaos.randomDelayRange.min || 0;
            const max = chaos.randomDelayRange.max;
            extraDelay = Math.floor(Math.random() * (max - min + 1)) + min;
        }

        return { shouldFail, extraDelay };
    }

    static isFaultProfileActive(profile, request, now = new Date()) {
        if (!profile?.isActive || !profile.fault?.type) return false;
        const targetMethod = String(profile.target?.method || '*').toUpperCase();
        const targetPath = profile.target?.path || '*';
        if (targetMethod !== '*' && targetMethod !== String(request.method).toUpperCase()) return false;
        if (targetPath !== '*' && !this.matchPath(targetPath, request.path) && targetPath !== request.path) return false;

        const schedule = profile.schedule || {};
        if (schedule.mode !== 'burst') return true;
        const startAt = new Date(schedule.startAt || 0).getTime();
        const interval = Number(schedule.intervalMs || 0);
        const duration = Number(schedule.durationMs || 0);
        if (!startAt || interval <= 0 || duration <= 0 || now.getTime() < startAt) return false;
        return ((now.getTime() - startAt) % interval) < Math.min(duration, interval);
    }

    static selectFaultProfile(mockServer, request, now = new Date()) {
        const chaos = mockServer.globalConfig?.chaos;
        if (!chaos?.globalEnabled) return null;
        const profiles = (chaos.profiles || [])
            .filter(profile => this.isFaultProfileActive(profile, request, now))
            .sort((a, b) => (b.priority || 0) - (a.priority || 0));
        return profiles.find(profile => Math.random() * 100 < Number(profile.probability ?? 100)) || null;
    }

    static serializeFaultBody(body) {
        return typeof body === 'string' ? body : JSON.stringify(body === undefined ? null : body);
    }

    static buildFaultEffect(profile, response) {
        if (!profile) return { response, delayMs: 0, transport: null };
        const fault = profile.fault || {};
        const min = Math.max(0, Number(fault.delayMinMs || 0));
        const max = Math.max(min, Number(fault.delayMaxMs ?? min));
        const randomizedDelay = Math.floor(Math.random() * (max - min + 1)) + min;
        const base = { ...response, headers: { ...(response.headers || {}), 'X-Pigeon-Fault': fault.type } };

        switch (fault.type) {
            case 'latency':
                return { response: base, delayMs: randomizedDelay, transport: null, detail: { delayMs: randomizedDelay } };
            case 'status':
                return {
                    response: {
                        ...base,
                        status: Number(fault.statusCode || 500),
                        body: fault.responseBody === null || fault.responseBody === undefined ? base.body : fault.responseBody
                    },
                    delayMs: randomizedDelay,
                    transport: null,
                    detail: { statusCode: Number(fault.statusCode || 500), delayMs: randomizedDelay }
                };
            case 'abort':
                return {
                    response: base,
                    delayMs: randomizedDelay,
                    transport: { type: 'abort', phase: fault.abortPhase || 'before_headers' },
                    detail: { phase: fault.abortPhase || 'before_headers', delayMs: randomizedDelay }
                };
            case 'throttle':
                return {
                    response: base,
                    delayMs: randomizedDelay,
                    transport: {
                        type: 'throttle',
                        rawBody: this.serializeFaultBody(base.body),
                        bytesPerSecond: Number(fault.bytesPerSecond || 1024),
                        chunkSize: Number(fault.chunkSize || 256)
                    },
                    detail: { bytesPerSecond: Number(fault.bytesPerSecond || 1024), chunkSize: Number(fault.chunkSize || 256), delayMs: randomizedDelay }
                };
            case 'malformed_json': {
                const rawBody = this.serializeFaultBody(base.body);
                return {
                    response: base,
                    delayMs: randomizedDelay,
                    transport: { type: 'raw', rawBody: rawBody.length > 1 ? rawBody.slice(0, -1) : '{' },
                    detail: { delayMs: randomizedDelay }
                };
            }
            case 'truncate': {
                const rawBody = this.serializeFaultBody(base.body);
                const count = fault.truncateMode === 'bytes'
                    ? Number(fault.truncateValue || 1)
                    : Math.max(1, Math.floor(rawBody.length * (Number(fault.truncateValue || 50) / 100)));
                return {
                    response: base,
                    delayMs: randomizedDelay,
                    transport: { type: 'raw', rawBody: rawBody.slice(0, Math.min(count, rawBody.length)) },
                    detail: { bytesSent: Math.min(count, rawBody.length), delayMs: randomizedDelay }
                };
            }
            default:
                return { response, delayMs: 0, transport: null };
        }
    }

    static async recordFaultEvent(mockServerId, profile, request, response, detail = {}) {
        if (!profile?._id) return;
        await MockFaultEvent.create({
            mockServerId,
            profileId: profile._id,
            profileName: profile.name,
            faultType: profile.fault.type,
            method: request.method,
            path: request.path,
            statusCode: response.status || 0,
            detail
        });
        const overflow = await MockFaultEvent.find({ mockServerId })
            .sort({ createdAt: -1 })
            .skip(MAX_FAULT_EVENTS_PER_SERVER)
            .select('_id')
            .lean();
        if (overflow.length) await MockFaultEvent.deleteMany({ _id: { $in: overflow.map(event => event._id) } });
    }

    /**
     * Emit real-time updates via Socket.IO
     */
    static emitMockEvent(eventName, data) {
        try {
            const io = getIO();
            if (io) {
                io.emit(eventName, {
                    ...data,
                    timestamp: new Date()
                });
            }
        } catch (error) {
            console.error('Error emitting mock event:', error);
        }
    }
    /**
     * Create a new mock server for an API version
     */
    static async createMockServer(mockServerData, userId) {
        try {
            // Log the incoming data for debugging
            console.log('Creating mock server with data:', mockServerData);
            console.log('User ID:', userId);

            // Validate required fields
            if (!mockServerData.name) {
                throw new Error('Mock server name is required');
            }

            if (!mockServerData.collectionId) {
                throw new Error('Collection ID is required');
            }

            if (!mockServerData.versionId) {
                throw new Error('Version ID is required');
            }

            // Optionally validate that the API version exists (make this non-blocking)
            const apiVersion = await ApiVersion.findById(mockServerData.versionId);
            if (!apiVersion) {
                console.warn(`API version ${mockServerData.versionId} not found, but proceeding with mock server creation`);
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
            console.log('Mock server created successfully:', mockServer._id);
            return mockServer;
        } catch (error) {
            console.error('Error in createMockServer:', error);
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
     * Enhanced with scenario evaluation, state management, and analytics
     */
    static async handleMockRequest(mockServerId, path, method, query, body, headers) {
        const startTime = Date.now();

        try {
            const mockServer = await MockServer.findById(mockServerId);

            if (!mockServer || !mockServer.isActive) {
                throw new Error('Mock server not found or inactive');
            }

            // Persist the one-time conversion before processing so old chaos
            // settings never combine with the new profile engine.
            if (this.migrateLegacyChaos(mockServer)) await mockServer.save();

            // Increment request counter in state
            const requestCounterKey = 'total_requests';
            const currentCount = mockServer.state?.counters?.get(requestCounterKey) || 0;
            if (!mockServer.state) mockServer.state = { counters: new Map(), variables: new Map() };
            if (!mockServer.state.counters) mockServer.state.counters = new Map();
            mockServer.state.counters.set(requestCounterKey, currentCount + 1);

            // Build request object for evaluation
            const request = {
                path,
                method: method.toUpperCase(),
                query,
                body,
                headers
            };
            const faultProfile = this.selectFaultProfile(mockServer, request);

            // Apply chaos engineering effects
            const chaosEffects = this.applyChaosEffects(mockServer);
            if (chaosEffects.shouldFail) {
                const responseTime = Date.now() - startTime + chaosEffects.extraDelay;
                await this.logRequestToAnalytics(mockServerId, request, 500, responseTime);

                if (chaosEffects.extraDelay > 0) {
                    await new Promise(resolve => setTimeout(resolve, chaosEffects.extraDelay));
                }

                // Emit event for chaos failure
                this.emitMockEvent('mock:chaos:triggered', {
                    mockServerId,
                    path,
                    method,
                    type: 'random_failure'
                });

                return {
                    status: 500,
                    headers: { 'Content-Type': 'application/json', 'X-Mock-Chaos': 'true' },
                    body: { error: 'Chaos engineering: Random failure triggered' }
                };
            }

            // Find matching scenarios (sorted by priority)
            const matchingScenarios = (mockServer.scenarios || [])
                .filter(s => s.isActive &&
                    (s.endpointPath === path || s.endpointPath === '*') &&
                    (s.endpointMethod === method.toUpperCase() || s.endpointMethod === '*'))
                .sort((a, b) => (b.priority || 0) - (a.priority || 0));

            // Evaluate scenarios to find a match
            let matchedScenario = null;
            let selectedResponse = null;

            for (const scenario of matchingScenarios) {
                if (this.evaluateScenarioConditions(scenario, request, mockServer)) {
                    matchedScenario = scenario;
                    selectedResponse = this.selectScenarioResponse(scenario, mockServer);

                    // Update sequential index if needed
                    if (!scenario.useWeightedResponses && scenario.responses?.length > 1) {
                        const scenarioIndex = mockServer.scenarios.findIndex(s => s._id.equals(scenario._id));
                        if (scenarioIndex >= 0) {
                            mockServer.scenarios[scenarioIndex].sequentialIndex =
                                ((scenario.sequentialIndex || 0) + 1) % scenario.responses.length;
                        }
                    }

                    break;
                }
            }

            let response;

            if (selectedResponse) {
                // Convert selectedResponse.body to plain JavaScript object
                // Mongoose Mixed type can cause serialization issues
                let responseBodyData = selectedResponse.body;
                if (responseBodyData && typeof responseBodyData === 'object') {
                    if (responseBodyData.toJSON) {
                        responseBodyData = responseBodyData.toJSON();
                    } else if (responseBodyData._doc) {
                        responseBodyData = responseBodyData._doc;
                    } else {
                        // Deep clone to ensure plain object
                        try {
                            responseBodyData = JSON.parse(JSON.stringify(responseBodyData));
                        } catch (e) {
                            console.error('Failed to serialize response body:', e);
                        }
                    }
                }

                console.log('[Mock Debug] selectedResponse.body raw:', selectedResponse.body);
                console.log('[Mock Debug] selectedResponse.body type:', typeof selectedResponse.body);
                console.log('[Mock Debug] responseBodyData after conversion:', responseBodyData);

                // Build response from scenario
                const resolvedBody = await this.resolveResponseVariables(
                    responseBodyData,
                    request,
                    mockServer
                );

                const totalDelay = (selectedResponse.delay || 0) +
                    (mockServer.globalConfig?.defaultDelay || 0) +
                    chaosEffects.extraDelay;

                if (totalDelay > 0) {
                    await new Promise(resolve => setTimeout(resolve, totalDelay));
                }

                // Convert headers to object
                const responseHeaders = {};
                if (selectedResponse.headers) {
                    selectedResponse.headers.forEach((value, key) => {
                        responseHeaders[key] = value;
                    });
                }

                response = {
                    status: selectedResponse.statusCode || 200,
                    headers: {
                        'Content-Type': 'application/json',
                        ...responseHeaders,
                        'X-Mock-Scenario': matchedScenario.name,
                        'X-Mock-Response': selectedResponse.name || 'default'
                    },
                    body: resolvedBody
                };

                // Emit scenario triggered event
                this.emitMockEvent('mock:scenario:triggered', {
                    mockServerId,
                    scenarioId: matchedScenario._id,
                    scenarioName: matchedScenario.name,
                    responseName: selectedResponse.name,
                    path,
                    method
                });
            } else {
                // Fall back to basic endpoint matching with dynamic path support
                const match = this.findMatchingEndpoint(mockServer.mockEndpoints, path, method);

                if (!match) {
                    const responseTime = Date.now() - startTime;
                    await this.logRequestToAnalytics(mockServerId, request, 404, responseTime);

                    return {
                        status: 404,
                        headers: { 'Content-Type': 'application/json' },
                        body: { error: 'Endpoint not found', path, method }
                    };
                }

                const { endpoint, params } = match;

                // Add params to request for variable resolution
                request.params = params;

                // Apply response delay if configured
                const totalDelay = (endpoint.responseDelay || 0) +
                    (mockServer.globalConfig?.defaultDelay || 0) +
                    chaosEffects.extraDelay;

                if (totalDelay > 0) {
                    await new Promise(resolve => setTimeout(resolve, totalDelay));
                }

                // Resolve variables in response body
                const resolvedBody = await this.resolveResponseVariables(
                    endpoint.responseBody,
                    request,
                    mockServer
                );

                // Convert response headers Map to object
                const responseHeaders = {};
                if (endpoint.responseHeaders) {
                    endpoint.responseHeaders.forEach((value, key) => {
                        responseHeaders[key] = value;
                    });
                }

                response = {
                    status: endpoint.statusCode,
                    headers: responseHeaders,
                    body: resolvedBody
                };
            }

            // Apply the selected Fault Lab profile after the normal mock response
            // has been resolved, so every scenario and endpoint can be exercised.
            let faultEffect = null;
            if (faultProfile) {
                faultEffect = this.buildFaultEffect(faultProfile, response);
                response = faultEffect.response;
                if (faultEffect.delayMs > 0) {
                    await new Promise(resolve => setTimeout(resolve, faultEffect.delayMs));
                }
                if (faultEffect.transport) response.transport = faultEffect.transport;
            }

            // Calculate response time
            const responseTime = Date.now() - startTime;

            // Log to analytics
            await this.logRequestToAnalytics(
                mockServerId,
                request,
                response.status,
                responseTime,
                matchedScenario
            );

            if (faultProfile) {
                await this.recordFaultEvent(mockServerId, faultProfile, request, response, faultEffect?.detail);
                this.emitMockEvent('mock:fault:triggered', {
                    mockServerId,
                    profileId: faultProfile._id,
                    profileName: faultProfile.name,
                    type: faultProfile.fault.type,
                    path,
                    method
                });
            }

            // Record traffic if recording is active
            if (mockServer.recording?.isRecording && mockServer.recording?.currentSessionId) {
                await this.recordTraffic(mockServer, request, response, responseTime);
            }

            // Update mock server analytics
            mockServer.analytics = mockServer.analytics || {};
            mockServer.analytics.totalRequests = (mockServer.analytics.totalRequests || 0) + 1;
            mockServer.analytics.lastRequestAt = new Date();

            // Update endpoint request count
            const endpointKey = `${method.toUpperCase()}:${path}`;
            if (!mockServer.analytics.requestsByEndpoint) {
                mockServer.analytics.requestsByEndpoint = new Map();
            }
            const endpointCount = mockServer.analytics.requestsByEndpoint.get(endpointKey) || 0;
            mockServer.analytics.requestsByEndpoint.set(endpointKey, endpointCount + 1);

            await mockServer.save();

            // Emit request received event
            this.emitMockEvent('mock:request:received', {
                mockServerId,
                path,
                method,
                statusCode: response.status,
                responseTime,
                scenarioName: matchedScenario?.name
            });

            return response;
        } catch (error) {
            throw new Error(`Failed to handle mock request: ${error.message}`);
        }
    }

    /**
     * Log request to analytics collection
     */
    static async logRequestToAnalytics(mockServerId, request, statusCode, responseTime, scenario = null) {
        try {
            const analytics = await MockAnalytics.getOrCreateForServer(mockServerId);
            await analytics.logRequest({
                method: request.method,
                path: request.path,
                statusCode,
                responseTime,
                requestSize: JSON.stringify(request.body || '').length,
                responseSize: 0, // Would need actual response to calculate
                scenarioId: scenario?._id,
                scenarioName: scenario?.name,
                clientInfo: {
                    userAgent: request.headers?.['user-agent'],
                    ip: request.headers?.['x-forwarded-for'] || request.headers?.['x-real-ip']
                }
            });
            await analytics.save();
        } catch (error) {
            console.error('Error logging to analytics:', error);
        }
    }

    /**
     * Record traffic for replay
     */
    static async recordTraffic(mockServer, request, response, responseTime) {
        try {
            const recording = await MockRecording.findOne({
                sessionId: mockServer.recording.currentSessionId,
                status: 'recording'
            });

            if (recording) {
                await recording.addRequest({
                    timestamp: new Date(),
                    method: request.method,
                    path: request.path,
                    headers: request.headers,
                    queryParams: request.query,
                    body: request.body,
                    response: {
                        status: response.status,
                        headers: response.headers,
                        body: response.body,
                        duration: responseTime
                    }
                });
                await recording.save();

                // Emit recording update event
                this.emitMockEvent('mock:recording:updated', {
                    mockServerId: mockServer._id,
                    sessionId: mockServer.recording.currentSessionId,
                    requestCount: recording.requests.length
                });
            }
        } catch (error) {
            console.error('Error recording traffic:', error);
        }
    }

    // =====================
    // FAULT LAB MANAGEMENT
    // =====================

    static validateFaultProfile(profile = {}) {
        const fault = profile.fault || {};
        const supported = ['latency', 'status', 'abort', 'throttle', 'malformed_json', 'truncate'];
        if (!profile.name || !String(profile.name).trim()) throw new Error('Fault profile name is required');
        if (!supported.includes(fault.type)) throw new Error('Choose a supported fault type');
        const probability = Number(profile.probability ?? 100);
        if (!Number.isFinite(probability) || probability < 0 || probability > 100) throw new Error('Probability must be between 0 and 100');
        const delayMin = Number(fault.delayMinMs || 0);
        const delayMax = Number(fault.delayMaxMs ?? delayMin);
        if (delayMin < 0 || delayMax < delayMin || delayMax > 120000) throw new Error('Delay range is invalid');
        if (profile.schedule?.mode === 'burst') {
            if (Number(profile.schedule.intervalMs) < 1000 || Number(profile.schedule.durationMs) <= 0) {
                throw new Error('Burst interval and duration are required');
            }
        }
        if (fault.type === 'status' && (Number(fault.statusCode) < 100 || Number(fault.statusCode) > 599)) {
            throw new Error('Status code must be between 100 and 599');
        }
        if (fault.type === 'throttle' && Number(fault.bytesPerSecond) < 64) {
            throw new Error('Bandwidth must be at least 64 bytes per second');
        }
    }

    static async getFaultLab(mockServerId, eventLimit = 30) {
        const mockServer = await this.getMockServer(mockServerId);
        if (this.migrateLegacyChaos(mockServer)) await mockServer.save();
        const chaos = mockServer.globalConfig?.chaos || {};
        const events = await MockFaultEvent.find({ mockServerId }).sort({ createdAt: -1 }).limit(Math.min(Number(eventLimit) || 30, 100)).lean();
        const summary = events.reduce((result, event) => {
            result.total++;
            result.byType[event.faultType] = (result.byType[event.faultType] || 0) + 1;
            if (event.faultType === 'abort') result.aborts++;
            result.totalAddedDelay += Number(event.detail?.delayMs || 0);
            return result;
        }, { total: 0, aborts: 0, totalAddedDelay: 0, byType: {} });
        return {
            enabled: Boolean(chaos.globalEnabled),
            profiles: (chaos.profiles || []).sort((a, b) => (b.priority || 0) - (a.priority || 0)),
            events,
            summary: { ...summary, averageAddedDelay: summary.total ? Math.round(summary.totalAddedDelay / summary.total) : 0 }
        };
    }

    static async updateFaultLab(mockServerId, settings = {}) {
        const mockServer = await this.getMockServer(mockServerId);
        mockServer.globalConfig = mockServer.globalConfig || {};
        mockServer.globalConfig.chaos = mockServer.globalConfig.chaos || {};
        if (settings.enabled !== undefined) mockServer.globalConfig.chaos.globalEnabled = Boolean(settings.enabled);
        await mockServer.save();
        return this.getFaultLab(mockServerId);
    }

    static async addFaultProfile(mockServerId, profile) {
        this.validateFaultProfile(profile);
        const mockServer = await this.getMockServer(mockServerId);
        mockServer.globalConfig = mockServer.globalConfig || {};
        mockServer.globalConfig.chaos = mockServer.globalConfig.chaos || {};
        mockServer.globalConfig.chaos.profiles = mockServer.globalConfig.chaos.profiles || [];
        const maxPriority = mockServer.globalConfig.chaos.profiles.reduce((max, item) => Math.max(max, item.priority || 0), 0);
        mockServer.globalConfig.chaos.profiles.push({
            ...profile,
            priority: profile.priority ?? maxPriority + 1,
            target: { method: '*', path: '*', ...(profile.target || {}) },
            schedule: { mode: 'continuous', startAt: new Date(), intervalMs: 60000, durationMs: 10000, ...(profile.schedule || {}) }
        });
        await mockServer.save();
        return this.getFaultLab(mockServerId);
    }

    static async updateFaultProfile(mockServerId, profileId, update) {
        this.validateFaultProfile(update);
        const mockServer = await this.getMockServer(mockServerId);
        const profile = mockServer.globalConfig?.chaos?.profiles?.id(profileId);
        if (!profile) throw new Error('Fault profile not found');
        profile.set({
            ...update,
            target: { method: '*', path: '*', ...(update.target || {}) },
            schedule: { mode: 'continuous', startAt: new Date(), intervalMs: 60000, durationMs: 10000, ...(update.schedule || {}) }
        });
        await mockServer.save();
        return this.getFaultLab(mockServerId);
    }

    static async toggleFaultProfile(mockServerId, profileId) {
        const mockServer = await this.getMockServer(mockServerId);
        const profile = mockServer.globalConfig?.chaos?.profiles?.id(profileId);
        if (!profile) throw new Error('Fault profile not found');
        profile.isActive = !profile.isActive;
        await mockServer.save();
        return this.getFaultLab(mockServerId);
    }

    static async deleteFaultProfile(mockServerId, profileId) {
        const mockServer = await this.getMockServer(mockServerId);
        const profiles = mockServer.globalConfig?.chaos?.profiles;
        const profile = profiles?.id(profileId);
        if (!profile) throw new Error('Fault profile not found');
        profile.deleteOne();
        await mockServer.save();
        return this.getFaultLab(mockServerId);
    }

    static async clearFaultEvents(mockServerId) {
        await MockFaultEvent.deleteMany({ mockServerId });
        return { cleared: true };
    }

    static async previewFaultProfile(mockServerId, profileId) {
        const mockServer = await this.getMockServer(mockServerId);
        const profile = mockServer.globalConfig?.chaos?.profiles?.id(profileId);
        if (!profile) throw new Error('Fault profile not found');
        const effect = this.buildFaultEffect(profile, {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: { preview: true, message: 'This is a safe Fault Lab preview.' }
        });
        return {
            profileId: String(profile._id),
            profileName: profile.name,
            faultType: profile.fault.type,
            activeNow: this.isFaultProfileActive(profile, { method: profile.target?.method === '*' ? 'GET' : profile.target?.method, path: profile.target?.path === '*' ? '/preview' : profile.target?.path }),
            delayMs: effect.delayMs,
            statusCode: effect.response.status,
            transport: effect.transport?.type || null,
            detail: effect.detail || {}
        };
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

            // Also delete associated analytics and recordings
            await MockAnalytics.findOneAndDelete({ mockServerId });
            await MockRecording.deleteMany({ mockServerId });

            await MockServer.findByIdAndDelete(mockServerId);
            return { message: 'Mock server deleted successfully' };
        } catch (error) {
            throw new Error(`Failed to delete mock server: ${error.message}`);
        }
    }

    // =====================
    // SCENARIO MANAGEMENT
    // =====================

    /**
     * Add a new scenario to a mock server
     */
    static async addScenario(mockServerId, scenarioData) {
        try {
            const mockServer = await MockServer.findById(mockServerId);

            if (!mockServer) {
                throw new Error('Mock server not found');
            }

            // Initialize scenarios array if it doesn't exist
            if (!mockServer.scenarios) {
                mockServer.scenarios = [];
            }

            // Set priority based on existing scenarios
            const maxPriority = mockServer.scenarios.reduce(
                (max, s) => Math.max(max, s.priority || 0), 0
            );
            scenarioData.priority = scenarioData.priority ?? maxPriority + 1;
            scenarioData.sequentialIndex = 0;

            mockServer.scenarios.push(scenarioData);
            await mockServer.save();

            // Emit scenario added event
            this.emitMockEvent('mock:scenario:added', {
                mockServerId,
                scenarioName: scenarioData.name
            });

            return mockServer;
        } catch (error) {
            throw new Error(`Failed to add scenario: ${error.message}`);
        }
    }

    /**
     * Update an existing scenario
     */
    static async updateScenario(mockServerId, scenarioId, scenarioData) {
        try {
            const mockServer = await MockServer.findById(mockServerId);

            if (!mockServer) {
                throw new Error('Mock server not found');
            }

            const scenarioIndex = mockServer.scenarios?.findIndex(
                s => s._id.toString() === scenarioId
            );

            if (scenarioIndex === -1 || scenarioIndex === undefined) {
                throw new Error('Scenario not found');
            }

            // Preserve certain fields
            const preservedFields = ['_id', 'sequentialIndex', 'createdAt'];
            const existingScenario = mockServer.scenarios[scenarioIndex];

            // Update scenario while preserving certain fields
            mockServer.scenarios[scenarioIndex] = {
                ...existingScenario.toObject(),
                ...scenarioData,
                _id: existingScenario._id,
                sequentialIndex: existingScenario.sequentialIndex,
                updatedAt: new Date()
            };

            await mockServer.save();

            // Emit scenario updated event
            this.emitMockEvent('mock:scenario:updated', {
                mockServerId,
                scenarioId,
                scenarioName: scenarioData.name || existingScenario.name
            });

            return mockServer;
        } catch (error) {
            throw new Error(`Failed to update scenario: ${error.message}`);
        }
    }

    /**
     * Delete a scenario
     */
    static async deleteScenario(mockServerId, scenarioId) {
        try {
            const mockServer = await MockServer.findById(mockServerId);

            if (!mockServer) {
                throw new Error('Mock server not found');
            }

            const scenarioIndex = mockServer.scenarios?.findIndex(
                s => s._id.toString() === scenarioId
            );

            if (scenarioIndex === -1 || scenarioIndex === undefined) {
                throw new Error('Scenario not found');
            }

            const deletedScenario = mockServer.scenarios[scenarioIndex];
            mockServer.scenarios.splice(scenarioIndex, 1);
            await mockServer.save();

            // Emit scenario deleted event
            this.emitMockEvent('mock:scenario:deleted', {
                mockServerId,
                scenarioId,
                scenarioName: deletedScenario.name
            });

            return mockServer;
        } catch (error) {
            throw new Error(`Failed to delete scenario: ${error.message}`);
        }
    }

    /**
     * Toggle scenario enabled status
     */
    static async toggleScenario(mockServerId, scenarioId) {
        try {
            const mockServer = await MockServer.findById(mockServerId);

            if (!mockServer) {
                throw new Error('Mock server not found');
            }

            const scenario = mockServer.scenarios?.find(
                s => s._id.toString() === scenarioId
            );

            if (!scenario) {
                throw new Error('Scenario not found');
            }

            scenario.isActive = !scenario.isActive;
            await mockServer.save();

            // Emit scenario toggled event
            this.emitMockEvent('mock:scenario:toggled', {
                mockServerId,
                scenarioId,
                scenarioName: scenario.name,
                isActive: scenario.isActive
            });

            return mockServer;
        } catch (error) {
            throw new Error(`Failed to toggle scenario: ${error.message}`);
        }
    }

    /**
     * Reorder scenarios (affects priority)
     */
    static async reorderScenarios(mockServerId, scenarioIds) {
        try {
            const mockServer = await MockServer.findById(mockServerId);

            if (!mockServer) {
                throw new Error('Mock server not found');
            }

            if (!mockServer.scenarios || mockServer.scenarios.length === 0) {
                throw new Error('No scenarios to reorder');
            }

            // Validate that all scenario IDs are present
            const existingIds = mockServer.scenarios.map(s => s._id.toString());
            const allIdsValid = scenarioIds.every(id => existingIds.includes(id));

            if (!allIdsValid) {
                throw new Error('Invalid scenario IDs provided');
            }

            // Reorder scenarios based on the provided order
            const reorderedScenarios = [];
            let priority = scenarioIds.length;

            for (const id of scenarioIds) {
                const scenario = mockServer.scenarios.find(s => s._id.toString() === id);
                if (scenario) {
                    scenario.priority = priority--;
                    reorderedScenarios.push(scenario);
                }
            }

            // Add any scenarios not in the list (shouldn't happen, but just in case)
            for (const scenario of mockServer.scenarios) {
                if (!scenarioIds.includes(scenario._id.toString())) {
                    scenario.priority = priority--;
                    reorderedScenarios.push(scenario);
                }
            }

            mockServer.scenarios = reorderedScenarios;
            await mockServer.save();

            // Emit scenarios reordered event
            this.emitMockEvent('mock:scenarios:reordered', {
                mockServerId,
                scenarioCount: reorderedScenarios.length
            });

            return mockServer;
        } catch (error) {
            throw new Error(`Failed to reorder scenarios: ${error.message}`);
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
