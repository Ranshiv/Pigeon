// services/MockAnalyticsService.js
const MockAnalytics = require('../models/MockAnalytics');
const MockServer = require('../models/MockServer');
const { getIO } = require('../utils/socket/socket-server');

/**
 * MockAnalyticsService
 * Handles analytics aggregation and retrieval for mock servers
 */
class MockAnalyticsService {
    /**
     * Get analytics summary for a mock server with optional time range filter
     * @param {string} mockServerId - The mock server ID
     * @param {number} hours - Number of hours to look back (optional, default: all time)
     */
    static async getAnalyticsSummary(mockServerId, hours = null) {
        try {
            const analytics = await MockAnalytics.getOrCreateForServer(mockServerId);

            // If hours is specified, calculate stats from recent requests within the time range
            if (hours && analytics.recentRequests?.length > 0) {
                const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
                const filteredRequests = analytics.recentRequests.filter(
                    r => new Date(r.timestamp) >= cutoffTime
                );

                // Calculate filtered summary
                const totalRequests = filteredRequests.length;
                const successfulRequests = filteredRequests.filter(r => r.statusCode >= 200 && r.statusCode < 400).length;
                const failedRequests = filteredRequests.filter(r => r.statusCode >= 400).length;
                const responseTimes = filteredRequests.map(r => r.responseTime).filter(t => t != null);
                const avgResponseTime = responseTimes.length > 0
                    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
                    : 0;

                // Calculate status distribution for filtered requests
                const statusDistribution = {};
                filteredRequests.forEach(r => {
                    const statusGroup = `${Math.floor(r.statusCode / 100)}xx`;
                    statusDistribution[statusGroup] = (statusDistribution[statusGroup] || 0) + 1;
                });

                // Calculate method distribution for filtered requests
                const methodDistribution = {};
                filteredRequests.forEach(r => {
                    methodDistribution[r.method] = (methodDistribution[r.method] || 0) + 1;
                });

                return {
                    summary: {
                        totalRequests,
                        successfulRequests,
                        failedRequests,
                        avgResponseTime: Math.round(avgResponseTime * 100) / 100,
                        successRate: totalRequests > 0 ? Math.round((successfulRequests / totalRequests) * 100) : 0
                    },
                    percentiles: analytics.percentiles,
                    distributions: {
                        byStatus: statusDistribution,
                        byMethod: methodDistribution,
                        byHour: Object.fromEntries(analytics.distributions.byHour || new Map()),
                        byDayOfWeek: Object.fromEntries(analytics.distributions.byDayOfWeek || new Map())
                    },
                    errors: {
                        total4xx: filteredRequests.filter(r => r.statusCode >= 400 && r.statusCode < 500).length,
                        total5xx: filteredRequests.filter(r => r.statusCode >= 500).length
                    },
                    timeRange: {
                        hours,
                        from: cutoffTime.toISOString(),
                        to: new Date().toISOString()
                    }
                };
            }

            // Calculate percentiles if we have recent requests (all-time data)
            if (analytics.recentRequests?.length > 0) {
                analytics.calculatePercentiles();
                await analytics.save();
            }

            return {
                summary: analytics.summary,
                percentiles: analytics.percentiles,
                distributions: {
                    byStatus: Object.fromEntries(analytics.distributions.byStatus || new Map()),
                    byMethod: Object.fromEntries(analytics.distributions.byMethod || new Map()),
                    byHour: Object.fromEntries(analytics.distributions.byHour || new Map()),
                    byDayOfWeek: Object.fromEntries(analytics.distributions.byDayOfWeek || new Map())
                },
                errors: {
                    total4xx: analytics.errors.total4xx,
                    total5xx: analytics.errors.total5xx
                }
            };
        } catch (error) {
            throw new Error(`Failed to get analytics summary: ${error.message}`);
        }
    }

    /**
     * Get endpoint-specific metrics
     */
    static async getEndpointMetrics(mockServerId) {
        try {
            const analytics = await MockAnalytics.getOrCreateForServer(mockServerId);

            return {
                endpoints: analytics.endpointMetrics.map(em => ({
                    path: em.path,
                    method: em.method,
                    totalRequests: em.totalRequests,
                    avgResponseTime: Math.round(em.avgResponseTime * 100) / 100,
                    minResponseTime: em.minResponseTime,
                    maxResponseTime: em.maxResponseTime,
                    statusDistribution: Object.fromEntries(em.statusDistribution || new Map()),
                    lastRequestAt: em.lastRequestAt
                })),
                totalEndpoints: analytics.endpointMetrics.length
            };
        } catch (error) {
            throw new Error(`Failed to get endpoint metrics: ${error.message}`);
        }
    }

    /**
     * Get scenario metrics
     */
    static async getScenarioMetrics(mockServerId) {
        try {
            const analytics = await MockAnalytics.getOrCreateForServer(mockServerId);
            const mockServer = await MockServer.findById(mockServerId).select('scenarios');

            const scenarioMetrics = [];

            for (const [scenarioId, metrics] of analytics.scenarioMetrics || new Map()) {
                const scenario = mockServer?.scenarios?.find(s => s._id.toString() === scenarioId);
                scenarioMetrics.push({
                    scenarioId,
                    scenarioName: scenario?.name || 'Unknown Scenario',
                    triggerCount: metrics.triggerCount,
                    lastTriggeredAt: metrics.lastTriggeredAt,
                    avgResponseTime: Math.round(metrics.avgResponseTime * 100) / 100
                });
            }

            return {
                scenarios: scenarioMetrics.sort((a, b) => b.triggerCount - a.triggerCount),
                totalTriggered: scenarioMetrics.reduce((sum, s) => sum + s.triggerCount, 0)
            };
        } catch (error) {
            throw new Error(`Failed to get scenario metrics: ${error.message}`);
        }
    }

    /**
     * Get recent requests
     */
    static async getRecentRequests(mockServerId, options = {}) {
        try {
            const { limit = 50, method, statusCode, path, hours } = options;

            const analytics = await MockAnalytics.getOrCreateForServer(mockServerId);

            let requests = analytics.recentRequests || [];

            // Filter by time range if hours is specified
            if (hours) {
                const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
                requests = requests.filter(r => new Date(r.timestamp) >= cutoffTime);
            }

            // Apply filters
            if (method) {
                requests = requests.filter(r => r.method.toUpperCase() === method.toUpperCase());
            }
            if (statusCode) {
                requests = requests.filter(r => r.statusCode === parseInt(statusCode));
            }
            if (path) {
                requests = requests.filter(r => r.path.includes(path));
            }

            // Limit results
            requests = requests.slice(0, limit);

            return {
                requests: requests.map(r => ({
                    timestamp: r.timestamp,
                    method: r.method,
                    path: r.path,
                    statusCode: r.statusCode,
                    responseTime: r.responseTime,
                    scenarioName: r.scenarioName
                })),
                total: requests.length,
                filters: { method, statusCode, path, limit, hours }
            };
        } catch (error) {
            throw new Error(`Failed to get recent requests: ${error.message}`);
        }
    }

    /**
     * Get time series data for charts
     */
    static async getTimeSeriesData(mockServerId, hours = 24) {
        try {
            const analytics = await MockAnalytics.getOrCreateForServer(mockServerId);
            const timeSeriesData = analytics.getTimeSeriesData(hours);

            return {
                data: timeSeriesData,
                hours,
                dataPoints: timeSeriesData.length
            };
        } catch (error) {
            throw new Error(`Failed to get time series data: ${error.message}`);
        }
    }

    /**
     * Get recent errors
     */
    static async getRecentErrors(mockServerId, limit = 20) {
        try {
            const analytics = await MockAnalytics.getOrCreateForServer(mockServerId);

            return {
                errors: (analytics.errors.recentErrors || []).slice(0, limit),
                total4xx: analytics.errors.total4xx,
                total5xx: analytics.errors.total5xx
            };
        } catch (error) {
            throw new Error(`Failed to get recent errors: ${error.message}`);
        }
    }

    /**
     * Reset analytics for a mock server
     */
    static async resetAnalytics(mockServerId) {
        try {
            await MockAnalytics.findOneAndDelete({ mockServerId });

            // Also reset the inline analytics on the mock server
            const mockServer = await MockServer.findById(mockServerId);
            if (mockServer) {
                mockServer.analytics = {
                    totalRequests: 0,
                    requestsByEndpoint: new Map(),
                    requestsByMethod: new Map(),
                    requestsByStatus: new Map(),
                    averageResponseTime: 0,
                    scenarioTriggerCounts: new Map(),
                    lastRequestAt: null
                };
                await mockServer.save();
            }

            // Emit analytics reset event
            this.emitAnalyticsEvent('mock:analytics:reset', { mockServerId });

            return { message: 'Analytics reset successfully' };
        } catch (error) {
            throw new Error(`Failed to reset analytics: ${error.message}`);
        }
    }

    /**
     * Export analytics to JSON
     */
    static async exportAnalytics(mockServerId) {
        try {
            const [analytics, mockServer] = await Promise.all([
                MockAnalytics.getOrCreateForServer(mockServerId),
                MockServer.findById(mockServerId).select('name scenarios')
            ]);

            return {
                exportedAt: new Date(),
                mockServer: {
                    id: mockServerId,
                    name: mockServer?.name
                },
                summary: analytics.summary,
                percentiles: analytics.percentiles,
                distributions: {
                    byStatus: Object.fromEntries(analytics.distributions.byStatus || new Map()),
                    byMethod: Object.fromEntries(analytics.distributions.byMethod || new Map()),
                    byHour: Object.fromEntries(analytics.distributions.byHour || new Map()),
                    byDayOfWeek: Object.fromEntries(analytics.distributions.byDayOfWeek || new Map())
                },
                endpointMetrics: analytics.endpointMetrics,
                scenarioMetrics: Object.fromEntries(analytics.scenarioMetrics || new Map()),
                errors: {
                    total4xx: analytics.errors.total4xx,
                    total5xx: analytics.errors.total5xx,
                    recentErrors: analytics.errors.recentErrors
                }
            };
        } catch (error) {
            throw new Error(`Failed to export analytics: ${error.message}`);
        }
    }

    /**
     * Get top endpoints by request count
     */
    static async getTopEndpoints(mockServerId, limit = 10, hours = null) {
        try {
            const analytics = await MockAnalytics.getOrCreateForServer(mockServerId);

            // If hours specified, calculate from recent requests
            if (hours && analytics.recentRequests?.length > 0) {
                const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
                const filteredRequests = analytics.recentRequests.filter(
                    r => new Date(r.timestamp) >= cutoffTime
                );

                // Aggregate by endpoint
                const endpointCounts = {};
                filteredRequests.forEach(r => {
                    const key = `${r.method}:${r.path}`;
                    if (!endpointCounts[key]) {
                        endpointCounts[key] = {
                            path: r.path,
                            method: r.method,
                            totalRequests: 0,
                            totalResponseTime: 0
                        };
                    }
                    endpointCounts[key].totalRequests++;
                    endpointCounts[key].totalResponseTime += r.responseTime || 0;
                });

                const topEndpoints = Object.values(endpointCounts)
                    .map(ep => ({
                        path: ep.path,
                        method: ep.method,
                        totalRequests: ep.totalRequests,
                        avgResponseTime: ep.totalRequests > 0
                            ? Math.round((ep.totalResponseTime / ep.totalRequests) * 100) / 100
                            : 0
                    }))
                    .sort((a, b) => b.totalRequests - a.totalRequests)
                    .slice(0, limit);

                return { topEndpoints };
            }

            // Default: use all-time endpoint metrics
            const topEndpoints = analytics.endpointMetrics
                .sort((a, b) => b.totalRequests - a.totalRequests)
                .slice(0, limit)
                .map(ep => ({
                    path: ep.path,
                    method: ep.method,
                    totalRequests: ep.totalRequests,
                    avgResponseTime: Math.round(ep.avgResponseTime * 100) / 100
                }));

            return { topEndpoints };
        } catch (error) {
            throw new Error(`Failed to get top endpoints: ${error.message}`);
        }
    }

    /**
     * Get response time distribution
     */
    static async getResponseTimeDistribution(mockServerId) {
        try {
            const analytics = await MockAnalytics.getOrCreateForServer(mockServerId);

            const responseTimes = (analytics.recentRequests || []).map(r => r.responseTime);

            if (responseTimes.length === 0) {
                return {
                    buckets: [],
                    percentiles: analytics.percentiles
                };
            }

            // Create buckets: 0-50ms, 50-100ms, 100-200ms, 200-500ms, 500ms+
            const buckets = [
                { range: '0-50ms', count: 0 },
                { range: '50-100ms', count: 0 },
                { range: '100-200ms', count: 0 },
                { range: '200-500ms', count: 0 },
                { range: '500ms+', count: 0 }
            ];

            responseTimes.forEach(rt => {
                if (rt < 50) buckets[0].count++;
                else if (rt < 100) buckets[1].count++;
                else if (rt < 200) buckets[2].count++;
                else if (rt < 500) buckets[3].count++;
                else buckets[4].count++;
            });

            return {
                buckets,
                percentiles: analytics.percentiles,
                totalSamples: responseTimes.length
            };
        } catch (error) {
            throw new Error(`Failed to get response time distribution: ${error.message}`);
        }
    }

    /**
     * Emit analytics event via Socket.IO
     */
    static emitAnalyticsEvent(eventName, data) {
        try {
            const io = getIO();
            if (io) {
                io.emit(eventName, {
                    ...data,
                    timestamp: new Date()
                });
            }
        } catch (error) {
            console.error('Error emitting analytics event:', error);
        }
    }

    /**
     * Schedule periodic analytics aggregation (called by scheduler)
     */
    static async aggregateAnalytics(mockServerId) {
        try {
            const analytics = await MockAnalytics.getOrCreateForServer(mockServerId);

            // Calculate percentiles
            analytics.calculatePercentiles();

            // Update last aggregated timestamp
            analytics.lastAggregatedAt = new Date();

            await analytics.save();

            return { message: 'Analytics aggregated successfully' };
        } catch (error) {
            console.error(`Error aggregating analytics for ${mockServerId}:`, error);
        }
    }

    /**
     * Clean up old analytics data based on retention policy
     */
    static async cleanupOldData(mockServerId) {
        try {
            const analytics = await MockAnalytics.findOne({ mockServerId });
            if (!analytics) return;

            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - (analytics.retentionDays || 30));

            // Remove old requests
            analytics.recentRequests = (analytics.recentRequests || []).filter(
                r => new Date(r.timestamp) > cutoffDate
            );

            // Remove old errors
            analytics.errors.recentErrors = (analytics.errors.recentErrors || []).filter(
                e => new Date(e.timestamp) > cutoffDate
            );

            // Remove old hourly metrics
            analytics.hourlyMetrics = (analytics.hourlyMetrics || []).filter(
                h => new Date(h.hour) > cutoffDate
            );

            await analytics.save();

            return { message: 'Old analytics data cleaned up' };
        } catch (error) {
            console.error(`Error cleaning up analytics for ${mockServerId}:`, error);
        }
    }
}

module.exports = MockAnalyticsService;
