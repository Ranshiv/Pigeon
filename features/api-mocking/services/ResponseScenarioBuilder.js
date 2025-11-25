// features/api-mocking/services/ResponseScenarioBuilder.js
const MockScenario = require('../../../models/MockScenario');
const MockState = require('../../../models/MockState');

class ResponseScenarioBuilder {
    /**
     * Evaluate scenario triggers against request
     */
    static async evaluateScenarioTriggers(mockServerId, request) {
        try {
            // Fetch active scenarios for this mock server, sorted by priority
            const scenarios = await MockScenario.find({
                mockServerId,
                isActive: true
            }).sort({ priority: -1 });

            if (scenarios.length === 0) {
                return null;
            }

            // Filter scenarios based on trigger conditions
            const eligibleScenarios = [];

            for (const scenario of scenarios) {
                const isEligible = await this.evaluateScenario(scenario, request, mockServerId);
                if (isEligible) {
                    eligibleScenarios.push(scenario);
                }
            }

            if (eligibleScenarios.length === 0) {
                return null;
            }

            // Return highest priority scenario
            return eligibleScenarios[0];
        } catch (error) {
            console.error('Error evaluating scenario triggers:', error);
            throw error;
        }
    }

    /**
     * Evaluate a single scenario
     */
    static async evaluateScenario(scenario, request, mockServerId) {
        try {
            switch (scenario.trigger.type) {
                case 'always':
                    return true;

                case 'header':
                    return this.evaluateConditions(
                        scenario.trigger.conditions,
                        request.headers
                    );

                case 'query':
                    return this.evaluateConditions(
                        scenario.trigger.conditions,
                        request.query
                    );

                case 'body':
                    return this.evaluateConditions(
                        scenario.trigger.conditions,
                        request.body
                    );

                case 'probability':
                    return Math.random() * 100 < (scenario.trigger.probability || 100);

                case 'sequential':
                    return await this.evaluateSequential(scenario, mockServerId);

                default:
                    return false;
            }
        } catch (error) {
            console.error('Error evaluating scenario:', error);
            return false;
        }
    }

    /**
     * Evaluate trigger conditions
     */
    static evaluateConditions(conditions, data) {
        if (!conditions || conditions.length === 0) {
            return true;
        }

        return conditions.every(condition => {
            const value = this.getNestedValue(data, condition.field);

            switch (condition.operator) {
                case 'equals':
                    return value == condition.value; // Loose equality

                case 'contains':
                    if (typeof value === 'string') {
                        return value.includes(String(condition.value));
                    }
                    if (Array.isArray(value)) {
                        return value.includes(condition.value);
                    }
                    return false;

                case 'matches':
                    try {
                        const regex = new RegExp(condition.value);
                        return regex.test(String(value));
                    } catch (e) {
                        return false;
                    }

                case 'gt':
                    return Number(value) > Number(condition.value);

                case 'lt':
                    return Number(value) < Number(condition.value);

                case 'gte':
                    return Number(value) >= Number(condition.value);

                case 'lte':
                    return Number(value) <= Number(condition.value);

                default:
                    return false;
            }
        });
    }

    /**
     * Get nested value from object using dot notation
     */
    static getNestedValue(obj, path) {
        if (!obj || !path) return undefined;

        const keys = path.split('.');
        let value = obj;

        for (const key of keys) {
            if (value === null || value === undefined) {
                return undefined;
            }
            value = value[key];
        }

        return value;
    }

    /**
     * Evaluate sequential scenario
     */
    static async evaluateSequential(scenario, mockServerId) {
        try {
            const StateManager = require('./StateManager');
            const counterKey = `scenario_${scenario._id}_sequential_index`;
            const currentIndex = await StateManager.getCounter(mockServerId, counterKey);
            
            return currentIndex === (scenario.trigger.sequenceIndex || 0);
        } catch (error) {
            console.error('Error evaluating sequential scenario:', error);
            return false;
        }
    }

    /**
     * Select response from scenario (weighted random, sequential, etc.)
     */
    static async selectResponse(scenario, mockServerId) {
        const responses = scenario.responses;

        if (!responses || responses.length === 0) {
            return null;
        }

        if (responses.length === 1) {
            return responses[0];
        }

        // Weighted random selection
        const totalWeight = responses.reduce((sum, r) => sum + (r.weight || 1), 0);
        let random = Math.random() * totalWeight;

        for (const response of responses) {
            random -= (response.weight || 1);
            if (random <= 0) {
                return response;
            }
        }

        return responses[0];
    }

    /**
     * Build dynamic response with variable substitution
     */
    static async buildDynamicResponse(response, request, mockServerId) {
        try {
            const StateManager = require('./StateManager');
            const mockState = await StateManager.getState(mockServerId);

            // Deep clone response to avoid mutation
            const dynamicResponse = JSON.parse(JSON.stringify(response));

            // Substitute variables in response body
            dynamicResponse.body = await this.substituteVariables(
                dynamicResponse.body,
                request,
                mockState
            );

            // Substitute in headers
            if (dynamicResponse.headers) {
                const headersObj = dynamicResponse.headers instanceof Map 
                    ? Object.fromEntries(dynamicResponse.headers)
                    : dynamicResponse.headers;

                for (const [key, value] of Object.entries(headersObj)) {
                    headersObj[key] = await this.substituteVariables(
                        value,
                        request,
                        mockState
                    );
                }

                dynamicResponse.headers = headersObj;
            }

            return dynamicResponse;
        } catch (error) {
            console.error('Error building dynamic response:', error);
            return response;
        }
    }

    /**
     * Substitute variables in response
     */
    static async substituteVariables(obj, request, mockState) {
        if (typeof obj === 'string') {
            return obj.replace(/\{\{([^}]+)\}\}/g, (match, expr) => {
                return this.evaluateExpression(expr.trim(), request, mockState);
            });
        }

        if (Array.isArray(obj)) {
            return Promise.all(
                obj.map(item => this.substituteVariables(item, request, mockState))
            );
        }

        if (typeof obj === 'object' && obj !== null) {
            const result = {};
            for (const [key, value] of Object.entries(obj)) {
                result[key] = await this.substituteVariables(value, request, mockState);
            }
            return result;
        }

        return obj;
    }

    /**
     * Evaluate expression in template
     */
    static evaluateExpression(expr, request, mockState) {
        try {
            // Request variables
            if (expr.startsWith('request.')) {
                const path = expr.substring(8); // Remove 'request.'
                return this.getNestedValue(request, path) || '';
            }

            // State variables
            if (expr.startsWith('state.')) {
                const varName = expr.substring(6); // Remove 'state.'
                const value = mockState?.variables?.get(varName);
                return value !== undefined ? value : '';
            }

            // Counters
            if (expr.startsWith('counter.')) {
                const counterName = expr.substring(8); // Remove 'counter.'
                const value = mockState?.counters?.get(counterName);
                return value !== undefined ? value : 0;
            }

            // Functions
            if (expr === 'timestamp') {
                return Date.now();
            }

            if (expr === 'datetime') {
                return new Date().toISOString();
            }

            if (expr === 'uuid') {
                return this.generateUUID();
            }

            if (expr.startsWith('random.')) {
                const type = expr.substring(7);
                if (type === 'int') {
                    return Math.floor(Math.random() * 1000);
                }
                if (type === 'float') {
                    return Math.random();
                }
            }

            // If no match, return as-is
            return `{{${expr}}}`;
        } catch (error) {
            console.error('Error evaluating expression:', error);
            return `{{${expr}}}`;
        }
    }

    /**
     * Generate UUID v4
     */
    static generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Record scenario trigger
     */
    static async recordScenarioTrigger(scenarioId) {
        try {
            const scenario = await MockScenario.findById(scenarioId);
            if (scenario) {
                await scenario.recordTrigger();
            }
        } catch (error) {
            console.error('Error recording scenario trigger:', error);
        }
    }
}

module.exports = ResponseScenarioBuilder;
