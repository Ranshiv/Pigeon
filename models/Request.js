// models/Request.js
const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
    name: { type: String, required: true }, // Name of the request configuration
    url: { type: String, required: true },
    method: { type: String, required: true, enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'] },
    headers: [{ name: String, value: String }],
    body: { type: String, default: '' }, // Store the request body as a string
    bodyType: { type: String, enum: ['none', 'json', 'form-data', 'x-www-form-urlencoded', 'raw'], default: 'none' }, // Type of request body
    // Add fields for pre-request script and test script
    preRequestScript: { type: String, default: '' },
    testScript: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});


module.exports = mongoose.model('Request', requestSchema);