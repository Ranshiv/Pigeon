// models/Request.js
const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
    name: { type: String, required: true }, // Name of the request configuration
    url: { type: String, required: true },
    method: { type: String, required: true, enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD', 'GRAPHQL'] },
    headers: [{ name: String, value: String }],
    body: { type: String, default: '' }, // Store the request body as a string
    bodyType: { type: String, enum: ['none', 'json', 'form-data', 'x-www-form-urlencoded', 'raw', 'graphql'], default: 'none' }, // Type of request body

    // GraphQL-specific fields
    graphql: {
        query: { type: String, default: '' }, // GraphQL query/mutation/subscription
        variables: { type: mongoose.Schema.Types.Mixed, default: {} }, // GraphQL variables as JSON
        operationType: { type: String, enum: ['query', 'mutation', 'subscription', ''], default: '' }, // Type of GraphQL operation
        operationName: { type: String, default: '' }, // Named operation
        schema: { type: String, default: '' }, // GraphQL schema (SDL format)
        schemaUrl: { type: String, default: '' }, // URL for schema introspection
    },

    // Add fields for pre-request script and test script
    preRequestScript: { type: String, default: '' },
    testScript: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});


module.exports = mongoose.model('Request', requestSchema);