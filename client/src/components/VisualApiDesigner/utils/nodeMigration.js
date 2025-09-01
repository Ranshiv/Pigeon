// Node Migration Utility
// This utility helps migrate existing nodes to have proper data structure for spec generation

/**
 * Migrates a single node to ensure it has proper data structure
 */
export const migrateNodeData = (node) => {
    if (!node.data) {
        node.data = {};
    }

    // Migrate endpoint nodes
    if (node.type === 'endpoint') {
        const data = node.data;
        if (!data.path) data.path = '/api/resource';
        if (!data.method) data.method = 'GET';
        if (!data.summary) data.summary = data.name || 'New API Endpoint';
        if (!data.description) data.description = 'Describe what this endpoint does';
        if (!data.tags) data.tags = [];
        if (data.deprecated === undefined) data.deprecated = false;
        if (!data.operationId) data.operationId = '';
        if (!data.parameters) data.parameters = [];
        if (!data.responses) {
            data.responses = {
                '200': {
                    description: 'Successful response',
                    content: {
                        'application/json': {
                            schema: { type: 'object' }
                        }
                    }
                }
            };
        }
    }

    // Migrate schema nodes
    if (node.type === 'schema') {
        const data = node.data;
        if (!data.name) data.name = data.name || 'NewSchema';
        if (!data.type) data.type = 'object';
        if (!data.description) data.description = 'Define data structure';
        if (!data.required) data.required = [];
        if (!data.properties) {
            data.properties = {
                id: { type: 'string', description: 'Unique identifier' },
                name: { type: 'string', description: 'Name field' }
            };
        }
        if (!data.example) {
            data.example = {
                id: 'example-id',
                name: 'Example Name'
            };
        }
    }

    // Migrate parameter nodes
    if (node.type === 'parameter') {
        const data = node.data;
        if (!data.name) data.name = 'newParameter';
        if (!data.in) data.in = 'query';
        if (!data.type) data.type = 'string';
        if (data.required === undefined) data.required = false;
        if (!data.description) data.description = 'Parameter description';
        if (!data.schema) data.schema = { type: data.type || 'string' };
        if (!data.example) data.example = 'example-value';
    }

    // Migrate security nodes
    if (node.type === 'security') {
        const data = node.data;
        if (!data.name) data.name = 'bearerAuth';
        if (!data.type) data.type = 'http';
        if (!data.scheme) data.scheme = 'bearer';
        if (!data.bearerFormat) data.bearerFormat = 'JWT';
        if (!data.description) data.description = 'Bearer token authentication';
    }

    // Migrate info nodes
    if (node.type === 'info') {
        const data = node.data;
        if (!data.title) data.title = 'API Title';
        if (!data.version) data.version = '1.0.0';
        if (!data.description) data.description = 'API description';
        if (!data.contact) {
            data.contact = {
                name: 'API Support',
                email: 'support@example.com'
            };
        }
        if (!data.license) {
            data.license = {
                name: 'MIT',
                url: 'https://opensource.org/licenses/MIT'
            };
        }
    }

    // Migrate resource nodes
    if (node.type === 'resource') {
        const data = node.data;
        if (!data.name) data.name = 'Resource Group';
        if (!data.description) data.description = 'Group of related endpoints';
        if (!data.tags) data.tags = [];
    }

    return node;
};

/**
 * Migrates an array of nodes
 */
export const migrateNodes = (nodes) => {
    return nodes.map(migrateNodeData);
};

/**
 * Console utility to migrate existing nodes in the visual designer
 * Can be called from browser console: window.migrateExistingNodes()
 */
export const migrateExistingNodes = () => {
    if (typeof window !== 'undefined' && window.visualDesignerNodes) {
        const migratedNodes = migrateNodes(window.visualDesignerNodes);
        console.log('🔄 Migrated nodes:', migratedNodes);
        return migratedNodes;
    } else {
        console.warn('No nodes found. Make sure you are on the visual designer page.');
        return [];
    }
};

// Make migration function available globally for debugging
if (typeof window !== 'undefined') {
    window.migrateExistingNodes = migrateExistingNodes;
}
