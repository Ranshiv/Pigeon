// services/VariableResolver.js
/**
 * Variable Resolver Service
 * 
 * Handles variable resolution with proper scoping:
 * 1. Request-local variables (highest priority)
 * 2. Environment variables
 * 3. Collection variables  
 * 4. Global variables (lowest priority)
 */

const Environment = require('../models/Environment');
const Collection = require('../models/Collection');

class VariableResolver {
    constructor() {
        this.contexts = new Map(); // Store contexts by contextId
    }

    /**
     * Create a new variable context for a request execution
     * @param {string} contextId - Unique identifier for this context
     * @param {Object} options - Configuration options
     * @returns {Object} - Context object
     */
    async createContext(contextId, options = {}) {
        const {
            userId,
            workspaceId,
            environmentId,
            collectionId,
            requestLocalVariables = {}
        } = options;

        // Load global variables
        const globalVariables = await this.loadGlobalVariables(userId, workspaceId);

        // Load collection variables
        const collectionVariables = collectionId ?
            await this.loadCollectionVariables(collectionId, userId) : {};

        // Load environment variables
        const environmentVariables = environmentId ?
            await this.loadEnvironmentVariables(environmentId, userId) : {};

        const context = {
            contextId,
            userId,
            workspaceId,
            environmentId,
            collectionId,
            // Variable layers (in resolution order)
            layers: {
                request: { ...requestLocalVariables },
                environment: { ...environmentVariables },
                collection: { ...collectionVariables },
                global: { ...globalVariables }
            },
            // Metadata
            createdAt: new Date(),
            lastAccessed: new Date()
        };

        this.contexts.set(contextId, context);
        return context;
    }

    /**
     * Get a variable value with proper scope resolution
     * @param {string} contextId - Context identifier
     * @param {string} key - Variable key
     * @returns {any} - Variable value or undefined
     */
    getVariable(contextId, key) {
        const context = this.contexts.get(contextId);
        if (!context) {
            throw new Error(`Variable context ${contextId} not found`);
        }

        context.lastAccessed = new Date();

        // Check each layer in priority order
        const layers = ['request', 'environment', 'collection', 'global'];

        for (const layer of layers) {
            const value = context.layers[layer][key];
            if (value !== undefined) {
                return {
                    value,
                    source: layer,
                    key
                };
            }
        }

        return {
            value: undefined,
            source: null,
            key
        };
    }

    /**
     * Set a variable in a specific scope
     * @param {string} contextId - Context identifier
     * @param {string} scope - Variable scope (request, environment, collection, global)
     * @param {string} key - Variable key
     * @param {any} value - Variable value
     * @returns {boolean} - Success status
     */
    setVariable(contextId, scope, key, value) {
        const context = this.contexts.get(contextId);
        if (!context) {
            throw new Error(`Variable context ${contextId} not found`);
        }

        if (!context.layers[scope]) {
            throw new Error(`Invalid scope: ${scope}`);
        }

        context.layers[scope][key] = value;
        context.lastAccessed = new Date();

        return true;
    }

    /**
     * Remove a variable from a specific scope
     * @param {string} contextId - Context identifier
     * @param {string} scope - Variable scope
     * @param {string} key - Variable key
     * @returns {boolean} - Success status
     */
    unsetVariable(contextId, scope, key) {
        const context = this.contexts.get(contextId);
        if (!context) {
            throw new Error(`Variable context ${contextId} not found`);
        }

        if (!context.layers[scope]) {
            throw new Error(`Invalid scope: ${scope}`);
        }

        delete context.layers[scope][key];
        context.lastAccessed = new Date();

        return true;
    }

    /**
     * Get all variables with their sources
     * @param {string} contextId - Context identifier
     * @returns {Object} - All variables with metadata
     */
    getAllVariables(contextId) {
        const context = this.contexts.get(contextId);
        if (!context) {
            throw new Error(`Variable context ${contextId} not found`);
        }

        const allVariables = {};
        const layers = ['global', 'collection', 'environment', 'request']; // Reverse order for final values

        // Merge all layers, with later layers overriding earlier ones
        for (const layer of layers) {
            for (const [key, value] of Object.entries(context.layers[layer])) {
                allVariables[key] = {
                    value,
                    source: layer,
                    overridden: allVariables[key] ? true : false
                };
            }
        }

        return allVariables;
    }

    /**
     * Replace variables in a template string
     * @param {string} contextId - Context identifier
     * @param {string} template - Template string with {{variable}} placeholders
     * @returns {string} - String with variables replaced
     */
    replaceVariables(contextId, template) {
        if (!template || typeof template !== 'string') {
            return template;
        }

        const context = this.contexts.get(contextId);
        if (!context) {
            throw new Error(`Variable context ${contextId} not found`);
        }

        // Match patterns like {{VARIABLE_NAME}} with optional spaces inside
        const regex = /\{\{\s*([^{}]+?)\s*\}\}/g;

        return template.replace(regex, (match, varName) => {
            const key = varName.trim();
            const result = this.getVariable(contextId, key);

            if (result.value !== undefined) {
                return String(result.value);
            }

            // Return the original placeholder if variable not found
            console.warn(`Variable '${key}' not found in context ${contextId}`);
            return match;
        });
    }

    /**
     * Update environment variables in the context
     * @param {string} contextId - Context identifier
     * @param {Object} newEnvironmentVariables - New environment variables
     */
    updateEnvironmentVariables(contextId, newEnvironmentVariables) {
        const context = this.contexts.get(contextId);
        if (!context) {
            throw new Error(`Variable context ${contextId} not found`);
        }

        context.layers.environment = { ...newEnvironmentVariables };
        context.lastAccessed = new Date();
    }

    /**
     * Persist environment variable changes back to database
     * @param {string} contextId - Context identifier
     * @returns {Promise<boolean>} - Success status
     */
    async persistEnvironmentChanges(contextId) {
        const context = this.contexts.get(contextId);
        if (!context || !context.environmentId) {
            return false;
        }

        try {
            const environment = await Environment.findById(context.environmentId);
            if (!environment) {
                return false;
            }

            // Update environment variables
            environment.variables = Object.entries(context.layers.environment).map(([key, value]) => ({
                key,
                value: String(value),
                type: this.detectType(value)
            }));

            await environment.save();
            return true;
        } catch (error) {
            console.error('Error persisting environment changes:', error);
            return false;
        }
    }

    /**
     * Clean up a context to free memory
     * @param {string} contextId - Context identifier
     */
    destroyContext(contextId) {
        this.contexts.delete(contextId);
    }

    /**
     * Clean up old contexts (older than 1 hour)
     */
    cleanupOldContexts() {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        for (const [contextId, context] of this.contexts.entries()) {
            if (context.lastAccessed < oneHourAgo) {
                this.contexts.delete(contextId);
            }
        }
    }

    // Private helper methods

    /**
     * Load global variables for a user/workspace
     */
    async loadGlobalVariables(userId, workspaceId = null) {
        try {
            const globalEnv = await Environment.findOne({
                userId,
                workspaceId,
                type: 'global'
            });

            if (!globalEnv) {
                return {};
            }

            const variables = {};
            globalEnv.variables.forEach(variable => {
                variables[variable.key] = this.parseValue(variable.value, variable.type);
            });

            return variables;
        } catch (error) {
            console.error('Error loading global variables:', error);
            return {};
        }
    }

    /**
     * Load collection variables
     */
    async loadCollectionVariables(collectionId, userId) {
        try {
            const collection = await Collection.findOne({
                _id: collectionId,
                $or: [
                    { userId },
                    { owner: userId },
                    { 'collaborators.userId': userId }
                ]
            });

            if (!collection) {
                return {};
            }

            const variables = {};
            if (collection.variables) {
                collection.variables.forEach(variable => {
                    variables[variable.key] = this.parseValue(variable.value, variable.type);
                });
            }

            return variables;
        } catch (error) {
            console.error('Error loading collection variables:', error);
            return {};
        }
    }

    /**
     * Load environment variables
     */
    async loadEnvironmentVariables(environmentId, userId) {
        try {
            const environment = await Environment.findOne({
                _id: environmentId,
                $or: [
                    { userId },
                    { 'collaborators.userId': userId }
                ]
            });

            if (!environment) {
                return {};
            }

            const variables = {};
            environment.variables.forEach(variable => {
                variables[variable.key] = this.parseValue(variable.value, variable.type);
            });

            return variables;
        } catch (error) {
            console.error('Error loading environment variables:', error);
            return {};
        }
    }

    /**
     * Parse a variable value based on its type
     */
    parseValue(value, type) {
        if (type === 'number') {
            const parsed = Number(value);
            return isNaN(parsed) ? value : parsed;
        }

        if (type === 'boolean') {
            return value === 'true' || value === true;
        }

        if (type === 'object') {
            try {
                return JSON.parse(value);
            } catch {
                return value;
            }
        }

        return value; // string
    }

    /**
     * Detect the type of a value
     */
    detectType(value) {
        if (typeof value === 'number') return 'number';
        if (typeof value === 'boolean') return 'boolean';
        if (typeof value === 'object') return 'object';
        return 'string';
    }

    /**
     * Create a script sandbox with variable access
     * @param {string} contextId - Context identifier
     * @returns {Object} - Sandbox object with variable interfaces
     */
    createScriptSandbox(contextId) {
        const self = this;

        return {
            // Environment interface (for backward compatibility)
            environment: {
                get: (key) => {
                    const result = self.getVariable(contextId, key);
                    return result.value;
                },
                set: (key, value) => {
                    return self.setVariable(contextId, 'environment', key, value);
                },
                has: (key) => {
                    const result = self.getVariable(contextId, key);
                    return result.value !== undefined;
                },
                unset: (key) => {
                    return self.unsetVariable(contextId, 'environment', key);
                }
            },

            // Global variables interface
            globals: {
                get: (key) => {
                    const context = self.contexts.get(contextId);
                    return context ? context.layers.global[key] : undefined;
                },
                // Global variables are typically read-only in scripts
                // But we can allow setting for advanced use cases
                set: (key, value) => {
                    return self.setVariable(contextId, 'global', key, value);
                }
            },

            // Collection variables interface (read-only)
            collection: {
                get: (key) => {
                    const context = self.contexts.get(contextId);
                    return context ? context.layers.collection[key] : undefined;
                }
            },

            // Request variables interface
            request: {
                variables: {
                    get: (key) => {
                        const context = self.contexts.get(contextId);
                        return context ? context.layers.request[key] : undefined;
                    },
                    set: (key, value) => {
                        return self.setVariable(contextId, 'request', key, value);
                    },
                    unset: (key) => {
                        return self.unsetVariable(contextId, 'request', key);
                    },
                    values: (() => {
                        const context = self.contexts.get(contextId);
                        return context ? context.layers.request : {};
                    })()
                }
            }
        };
    }
}

// Singleton instance
const variableResolver = new VariableResolver();

// Periodic cleanup of old contexts
setInterval(() => {
    variableResolver.cleanupOldContexts();
}, 10 * 60 * 1000); // Every 10 minutes

module.exports = variableResolver;
