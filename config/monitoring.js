// config/monitoring.js
module.exports = {
    // Interval settings (in minutes)
    intervals: {
        critical: 1,   // Critical systems - every minute
        high: 3,       // Important systems - every 3 minutes  
        medium: 5,     // Standard systems - every 5 minutes
        low: 15        // Non-critical systems - every 15 minutes
    },

    // Performance settings
    performance: {
        maxConcurrentChecks: 10,    // Max monitors to check simultaneously
        batchSize: 3,               // How many monitors to process in each batch
        batchDelay: 100,            // Delay between batches (ms)
        checkFrequency: 30,         // How often to run the scheduler (seconds)
        requestTimeout: 10000       // HTTP request timeout (ms)
    },

    // Database settings
    database: {
        healthCheckRetentionDays: 30,  // How long to keep health check records
        cleanupSchedule: '0 2 * * *'   // When to run cleanup (daily at 2 AM)
    },

    // Alert settings
    alerts: {
        enableRealTimeUpdates: true,   // Enable socket.io updates
        enableBatchAlerts: false,      // Batch alerts instead of individual
        alertCooldownMinutes: 15       // Minimum time between duplicate alerts
    }
};
