// models/HealthCheck.js
const mongoose = require('mongoose');

const healthCheckSchema = new mongoose.Schema({
    monitorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Monitor',
        required: true
    },
    status: {
        type: String,
        enum: ['success', 'failure', 'timeout'],
        required: true
    },
    responseTime: {
        type: Number, // in milliseconds
        required: true
    },
    statusCode: {
        type: Number
    },
    errorMessage: {
        type: String
    },
    responseHeaders: {
        type: Map,
        of: String
    },
    responseBody: {
        type: String
    },
    checkedAt: {
        type: Date,
        default: Date.now
    },
    location: {
        type: String,
        default: 'server' // Could be extended for multiple locations
    },
    alertSent: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Index for efficient querying
healthCheckSchema.index({ monitorId: 1, checkedAt: -1 });
healthCheckSchema.index({ checkedAt: -1 });
healthCheckSchema.index({ status: 1, checkedAt: -1 });

// TTL index to automatically delete old health checks after 90 days
healthCheckSchema.index({ checkedAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

module.exports = mongoose.model('HealthCheck', healthCheckSchema);
