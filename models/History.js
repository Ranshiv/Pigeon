// models/History.js
const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
    // Link to the user who made the request
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true // Assuming users must be logged in to send requests
    },
    // Original request details (can be denormalized for history)
    url: { type: String, required: true },
    method: { type: String, required: true },
    requestHeaders: { type: String }, // Store as stringified JSON
    requestBody: { type: String },    // Store as string
    requestBodyType: { type: String }, // Store body type

    // Response details
    responseStatus: { type: Number },
    responseStatusText: { type: String },
    responseHeaders: { type: String }, // Store as stringified JSON
    responseBody: { type: String }, // Consider truncating or alternative storage for large bodies
    isJson: { type: Boolean, default: false }, // Flag if response body was JSON

    // Metadata
    timestamp: { type: Date, default: Date.now }, // When the request was initiated
    duration: { type: Number }, // Request duration in ms
    size: { type: Number }, // Response size in bytes (approx)

    // Test Results
    testResults: { type: String }, // Store test results as stringified JSON

    // UPDATED: Allow string IDs for collection requests
    originalRequestId: {
        type: mongoose.Schema.Types.Mixed, // Changed from ObjectId to Mixed to support both ObjectId and string IDs
        required: false
    },

    // Add fields to track collection requests
    collectionId: {
        type: String,
        required: false
    },
    collectionRequestId: {
        type: String,
        required: false
    }
});

// Index for faster querying by user and timestamp
historySchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('History', historySchema);