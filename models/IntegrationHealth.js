
// models/IntegrationHealth.js
const mongoose = require('mongoose');

const integrationHealthSchema = new mongoose.Schema({
    integrationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Integration',
        required: true
    },
    status: {
        type: String,
        enum: ['healthy', 'degraded', 'failed', 'disabled'],
        default: 'healthy'
    },
    lastSuccessfulAlert: Date,
    lastFailedAlert: Date,
    consecutiveFailures: {
        type: Number,
        default: 0
    },
    failureRate: {
        type: Number,
        default: 0 // percentage
    },
    healthChecks: [{
        timestamp: Date,
        success: Boolean,
        responseTime: Number,
        errorMessage: String
    }],
    disabledReason: String,
    disabledAt: Date,
    alertsSentToday: {
        type: Number,
        default: 0
    },
    dailyResetTime: Date
}, {
    timestamps: true
});

integrationHealthSchema.index({ integrationId: 1 });
integrationHealthSchema.index({ status: 1 });

// Methods
integrationHealthSchema.methods.recordSuccess = function(responseTime) {
    this.consecutiveFailures = 0;
    this.lastSuccessfulAlert = new Date();
    this.status = 'healthy';
    
    this.healthChecks.push({
        timestamp: new Date(),
        success: true,
        responseTime: responseTime
    });
    
    // Keep only last 50 health checks
    if (this.healthChecks.length > 50) {
        this.healthChecks = this.healthChecks.slice(-50);
    }
    
    // Recalculate failure rate
    this.calculateFailureRate();
};

integrationHealthSchema.methods.recordFailure = function(errorMessage) {
    this.consecutiveFailures += 1;
    this.lastFailedAlert = new Date();
    
    this.healthChecks.push({
        timestamp: new Date(),
        success: false,
        errorMessage: errorMessage
    });
    
    // Keep only last 50 health checks
    if (this.healthChecks.length > 50) {
        this.healthChecks = this.healthChecks.slice(-50);
    }
    
    // Update status based on consecutive failures
    if (this.consecutiveFailures >= 10) {
        this.status = 'failed';
        this.disabledReason = 'Too many consecutive failures';
        this.disabledAt = new Date();
    } else if (this.consecutiveFailures >= 5) {
        this.status = 'degraded';
    }
    
    // Recalculate failure rate
    this.calculateFailureRate();
};

integrationHealthSchema.methods.calculateFailureRate = function() {
    if (this.healthChecks.length === 0) {
        this.failureRate = 0;
        return;
    }
    
    const failures = this.healthChecks.filter(check => !check.success).length;
    this.failureRate = Math.round((failures / this.healthChecks.length) * 100);
};

integrationHealthSchema.methods.canSendAlert = function() {
    // Check if integration is healthy enough to send alerts
    if (this.status === 'failed' || this.status === 'disabled') {
        return false;
    }
    
    // Check daily rate limit
    const now = new Date();
    if (!this.dailyResetTime || now.getDate() !== this.dailyResetTime.getDate()) {
        this.alertsSentToday = 0;
        this.dailyResetTime = now;
    }
    
    return this.alertsSentToday < 100; // Daily limit
};

integrationHealthSchema.methods.incrementAlertCount = function() {
    this.alertsSentToday += 1;
};

module.exports = mongoose.model('IntegrationHealth', integrationHealthSchema);
