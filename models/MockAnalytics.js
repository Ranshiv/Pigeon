// models/MockAnalytics.js
const mongoose = require('mongoose');

// Schema for individual request log entries
const requestLogSchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    method: {
        type: String,
        required: true
    },
    path: {
        type: String,
        required: true
    },
    statusCode: {
        type: Number,
        required: true
    },
    responseTime: {
        type: Number, // milliseconds
        default: 0
    },
    requestSize: {
        type: Number, // bytes
        default: 0
    },
    responseSize: {
        type: Number, // bytes
        default: 0
    },
    scenarioId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    scenarioName: {
        type: String,
        default: null
    },
    clientInfo: {
        ip: String,
        userAgent: String
    }
}, { _id: true });

// Schema for hourly aggregated metrics
const hourlyMetricsSchema = new mongoose.Schema({
    hour: {
        type: Date,
        required: true
    },
    requestCount: {
        type: Number,
        default: 0
    },
    avgResponseTime: {
        type: Number,
        default: 0
    },
    statusCounts: {
        type: Map,
        of: Number,
        default: new Map()
    },
    methodCounts: {
        type: Map,
        of: Number,
        default: new Map()
    },
    endpointCounts: {
        type: Map,
        of: Number,
        default: new Map()
    }
}, { _id: false });

// Schema for endpoint-specific metrics
const endpointMetricsSchema = new mongoose.Schema({
    path: {
        type: String,
        required: true
    },
    method: {
        type: String,
        required: true
    },
    totalRequests: {
        type: Number,
        default: 0
    },
    avgResponseTime: {
        type: Number,
        default: 0
    },
    minResponseTime: {
        type: Number,
        default: 0
    },
    maxResponseTime: {
        type: Number,
        default: 0
    },
    statusDistribution: {
        type: Map,
        of: Number,
        default: new Map()
    },
    lastRequestAt: {
        type: Date,
        default: null
    }
}, { _id: false });

const mockAnalyticsSchema = new mongoose.Schema({
    mockServerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MockServer',
        required: true,
        unique: true
    },
    // Overall statistics
    summary: {
        totalRequests: {
            type: Number,
            default: 0
        },
        totalResponseTime: {
            type: Number,
            default: 0
        },
        avgResponseTime: {
            type: Number,
            default: 0
        },
        minResponseTime: {
            type: Number,
            default: 0
        },
        maxResponseTime: {
            type: Number,
            default: 0
        },
        successRate: {
            type: Number, // Percentage of 2xx responses
            default: 100
        },
        firstRequestAt: {
            type: Date,
            default: null
        },
        lastRequestAt: {
            type: Date,
            default: null
        }
    },
    // Distribution statistics
    distributions: {
        byStatus: {
            type: Map,
            of: Number,
            default: new Map()
        },
        byMethod: {
            type: Map,
            of: Number,
            default: new Map()
        },
        byHour: {
            type: Map,
            of: Number,
            default: new Map()
        },
        byDayOfWeek: {
            type: Map,
            of: Number,
            default: new Map()
        }
    },
    // Per-endpoint metrics
    endpointMetrics: [endpointMetricsSchema],
    // Scenario trigger statistics
    scenarioMetrics: {
        type: Map,
        of: {
            triggerCount: Number,
            lastTriggeredAt: Date,
            avgResponseTime: Number
        },
        default: new Map()
    },
    // Recent request logs (rolling window)
    recentRequests: {
        type: [requestLogSchema],
        default: []
    },
    // Hourly aggregated data (last 24 hours)
    hourlyMetrics: [hourlyMetricsSchema],
    // Performance percentiles
    percentiles: {
        p50: { type: Number, default: 0 },
        p90: { type: Number, default: 0 },
        p95: { type: Number, default: 0 },
        p99: { type: Number, default: 0 }
    },
    // Error tracking
    errors: {
        total4xx: { type: Number, default: 0 },
        total5xx: { type: Number, default: 0 },
        recentErrors: [{
            timestamp: Date,
            path: String,
            method: String,
            statusCode: Number,
            message: String
        }]
    },
    // Analytics metadata
    lastAggregatedAt: {
        type: Date,
        default: null
    },
    retentionDays: {
        type: Number,
        default: 30
    }
}, { timestamps: true });

// Indexes for efficient querying
mockAnalyticsSchema.index({ mockServerId: 1 });
mockAnalyticsSchema.index({ 'recentRequests.timestamp': -1 });
mockAnalyticsSchema.index({ 'summary.lastRequestAt': -1 });

// Method to log a new request
mockAnalyticsSchema.methods.logRequest = function (requestData) {
    const {
        method,
        path,
        statusCode,
        responseTime,
        requestSize = 0,
        responseSize = 0,
        scenarioId = null,
        scenarioName = null,
        clientInfo = {}
    } = requestData;

    const now = new Date();

    // Add to recent requests (keep last 1000)
    this.recentRequests.unshift({
        timestamp: now,
        method,
        path,
        statusCode,
        responseTime,
        requestSize,
        responseSize,
        scenarioId,
        scenarioName,
        clientInfo
    });

    if (this.recentRequests.length > 1000) {
        this.recentRequests = this.recentRequests.slice(0, 1000);
    }

    // Update summary statistics
    this.summary.totalRequests++;
    this.summary.totalResponseTime += responseTime;
    this.summary.avgResponseTime = this.summary.totalResponseTime / this.summary.totalRequests;

    if (!this.summary.firstRequestAt) {
        this.summary.firstRequestAt = now;
    }
    this.summary.lastRequestAt = now;

    if (responseTime < this.summary.minResponseTime || this.summary.minResponseTime === 0) {
        this.summary.minResponseTime = responseTime;
    }
    if (responseTime > this.summary.maxResponseTime) {
        this.summary.maxResponseTime = responseTime;
    }

    // Update distributions
    const statusGroup = Math.floor(statusCode / 100) * 100;
    const currentStatusCount = this.distributions.byStatus.get(String(statusGroup)) || 0;
    this.distributions.byStatus.set(String(statusGroup), currentStatusCount + 1);

    const currentMethodCount = this.distributions.byMethod.get(method) || 0;
    this.distributions.byMethod.set(method, currentMethodCount + 1);

    const hour = now.getHours();
    const currentHourCount = this.distributions.byHour.get(String(hour)) || 0;
    this.distributions.byHour.set(String(hour), currentHourCount + 1);

    const dayOfWeek = now.getDay();
    const currentDayCount = this.distributions.byDayOfWeek.get(String(dayOfWeek)) || 0;
    this.distributions.byDayOfWeek.set(String(dayOfWeek), currentDayCount + 1);

    // Calculate success rate
    const successCount = (this.distributions.byStatus.get('200') || 0);
    this.summary.successRate = (successCount / this.summary.totalRequests) * 100;

    // Update endpoint metrics
    const endpointKey = `${method}:${path}`;
    let endpointMetric = this.endpointMetrics.find(e => e.path === path && e.method === method);

    if (!endpointMetric) {
        endpointMetric = {
            path,
            method,
            totalRequests: 0,
            avgResponseTime: 0,
            minResponseTime: responseTime,
            maxResponseTime: responseTime,
            statusDistribution: new Map(),
            lastRequestAt: now
        };
        this.endpointMetrics.push(endpointMetric);
    }

    endpointMetric.totalRequests++;
    endpointMetric.avgResponseTime = ((endpointMetric.avgResponseTime * (endpointMetric.totalRequests - 1)) + responseTime) / endpointMetric.totalRequests;
    endpointMetric.minResponseTime = Math.min(endpointMetric.minResponseTime, responseTime);
    endpointMetric.maxResponseTime = Math.max(endpointMetric.maxResponseTime, responseTime);
    endpointMetric.lastRequestAt = now;

    const statusCount = endpointMetric.statusDistribution.get(String(statusCode)) || 0;
    endpointMetric.statusDistribution.set(String(statusCode), statusCount + 1);

    // Update scenario metrics
    if (scenarioId) {
        const scenarioKey = scenarioId.toString();
        let scenarioMetric = this.scenarioMetrics.get(scenarioKey) || {
            triggerCount: 0,
            lastTriggeredAt: null,
            avgResponseTime: 0
        };

        scenarioMetric.triggerCount++;
        scenarioMetric.lastTriggeredAt = now;
        scenarioMetric.avgResponseTime = ((scenarioMetric.avgResponseTime * (scenarioMetric.triggerCount - 1)) + responseTime) / scenarioMetric.triggerCount;

        this.scenarioMetrics.set(scenarioKey, scenarioMetric);
    }

    // Track errors
    if (statusCode >= 400 && statusCode < 500) {
        this.errors.total4xx++;
    } else if (statusCode >= 500) {
        this.errors.total5xx++;
    }

    if (statusCode >= 400) {
        this.errors.recentErrors.unshift({
            timestamp: now,
            path,
            method,
            statusCode,
            message: `${method} ${path} returned ${statusCode}`
        });

        if (this.errors.recentErrors.length > 50) {
            this.errors.recentErrors = this.errors.recentErrors.slice(0, 50);
        }
    }

    return this;
};

// Static method to get or create analytics for a mock server
mockAnalyticsSchema.statics.getOrCreateForServer = async function (mockServerId) {
    let analytics = await this.findOne({ mockServerId });

    if (!analytics) {
        analytics = new this({ mockServerId });
        await analytics.save();
    }

    return analytics;
};

// Method to calculate percentiles
mockAnalyticsSchema.methods.calculatePercentiles = function () {
    const responseTimes = this.recentRequests
        .map(r => r.responseTime)
        .sort((a, b) => a - b);

    const len = responseTimes.length;
    if (len === 0) return;

    this.percentiles.p50 = responseTimes[Math.floor(len * 0.5)] || 0;
    this.percentiles.p90 = responseTimes[Math.floor(len * 0.9)] || 0;
    this.percentiles.p95 = responseTimes[Math.floor(len * 0.95)] || 0;
    this.percentiles.p99 = responseTimes[Math.floor(len * 0.99)] || 0;

    return this;
};

// Method to get time-series data for charts
mockAnalyticsSchema.methods.getTimeSeriesData = function (hours = 24) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const relevantRequests = this.recentRequests.filter(r => r.timestamp >= cutoff);

    const hourlyData = new Map();

    relevantRequests.forEach(req => {
        const hour = new Date(req.timestamp);
        hour.setMinutes(0, 0, 0);
        const key = hour.toISOString();

        if (!hourlyData.has(key)) {
            hourlyData.set(key, {
                hour: hour,
                count: 0,
                totalResponseTime: 0,
                statusCounts: {}
            });
        }

        const data = hourlyData.get(key);
        data.count++;
        data.totalResponseTime += req.responseTime;
        data.statusCounts[req.statusCode] = (data.statusCounts[req.statusCode] || 0) + 1;
    });

    return Array.from(hourlyData.values()).map(d => ({
        hour: d.hour,
        count: d.count,
        avgResponseTime: d.count > 0 ? d.totalResponseTime / d.count : 0,
        statusCounts: d.statusCounts
    })).sort((a, b) => a.hour - b.hour);
};

module.exports = mongoose.model('MockAnalytics', mockAnalyticsSchema);
