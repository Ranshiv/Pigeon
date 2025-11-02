// services/AnalyticsService.js
const Analytics = require('../models/Analytics');
const HealthCheck = require('../models/HealthCheck');
const Monitor = require('../models/Monitor');
const AnalyticsSLAConfig = require('../models/AnalyticsSLAConfig');

class AnalyticsService {

    /**
     * Aggregate health check data into analytics
     * @param {String} monitorId - Monitor ID
     * @param {String} period - Aggregation period (5m, 15m, 1h, 1d)
     * @returns {Object} Analytics document
     */
    async aggregateHealthCheckData(monitorId, period = '1h') {
        try {
            const monitor = await Monitor.findById(monitorId);
            if (!monitor) {
                throw new Error('Monitor not found');
            }

            const now = new Date();
            const periodStart = this.getPeriodStart(now, period);

            // Fetch health checks for the period
            const healthChecks = await HealthCheck.find({
                monitorId,
                checkedAt: { $gte: periodStart, $lte: now }
            }).sort({ checkedAt: 1 });

            if (healthChecks.length === 0) {
                return null;
            }

            // Calculate metrics
            const metrics = this.calculateMetrics(healthChecks, monitor);

            // Detect anomalies
            const anomalies = await this.detectAnomaliesForPeriod(monitorId, metrics, period);

            // Calculate trends
            const trends = await this.calculateTrends(monitorId, metrics, period);

            // Generate predictions
            const predictions = await this.generatePredictions(monitorId, period);

            // Create or update analytics document
            const analytics = await Analytics.findOneAndUpdate(
                {
                    monitorId,
                    timestamp: periodStart,
                    aggregationPeriod: period
                },
                {
                    $set: {
                        workspaceId: monitor.workspaceId,
                        metrics,
                        trends,
                        anomalies,
                        predictions
                    }
                },
                {
                    new: true,
                    upsert: true
                }
            );

            return analytics;
        } catch (error) {
            console.error('Error aggregating health check data:', error);
            throw error;
        }
    }

    /**
     * Calculate metrics from health checks
     */
    calculateMetrics(healthChecks, monitor) {
        const total = healthChecks.length;
        const successful = healthChecks.filter(hc => hc.status === 'success').length;
        const failed = healthChecks.filter(hc => hc.status === 'failure').length;

        const responseTimes = healthChecks
            .filter(hc => hc.status === 'success')
            .map(hc => hc.responseTime)
            .sort((a, b) => a - b);

        // Calculate response time percentiles
        const p50 = this.calculatePercentile(responseTimes, 50);
        const p95 = this.calculatePercentile(responseTimes, 95);
        const p99 = this.calculatePercentile(responseTimes, 99);

        const avgResponseTime = responseTimes.length > 0
            ? responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length
            : 0;

        const minResponseTime = responseTimes.length > 0 ? Math.min(...responseTimes) : 0;
        const maxResponseTime = responseTimes.length > 0 ? Math.max(...responseTimes) : 0;

        const uptimePercentage = (successful / total) * 100;
        const errorRate = (failed / total) * 100;

        // Calculate cost estimate (simplified - $0.0001 per request + $0.00001 per MB bandwidth)
        const avgBandwidth = 0.5; // Assume average 0.5 MB per request
        const totalBandwidth = total * avgBandwidth;
        const costEstimate = (total * 0.0001) + (totalBandwidth * 0.00001);
        const costPerRequest = total > 0 ? costEstimate / total : 0;

        // Calculate SLA compliance
        const slaTargets = monitor.slaTargets || {};
        let slaCompliance = 100;
        let slaBreaches = 0;

        if (slaTargets.uptimePercentage && uptimePercentage < slaTargets.uptimePercentage) {
            slaCompliance -= 30;
            slaBreaches++;
        }

        if (slaTargets.responseTime && avgResponseTime > slaTargets.responseTime) {
            slaCompliance -= 30;
            slaBreaches++;
        }

        if (errorRate > 5) {
            slaCompliance -= 20;
            slaBreaches++;
        }

        return {
            totalRequests: total,
            successfulRequests: successful,
            failedRequests: failed,
            avgResponseTime: Math.round(avgResponseTime),
            minResponseTime: Math.round(minResponseTime),
            maxResponseTime: Math.round(maxResponseTime),
            p50ResponseTime: Math.round(p50),
            p95ResponseTime: Math.round(p95),
            p99ResponseTime: Math.round(p99),
            uptimePercentage: Math.round(uptimePercentage * 100) / 100,
            errorRate: Math.round(errorRate * 100) / 100,
            costEstimate: Math.round(costEstimate * 10000) / 10000,
            costPerRequest: Math.round(costPerRequest * 1000000) / 1000000,
            bandwidthUsed: Math.round(totalBandwidth * 1024 * 1024), // Convert to bytes
            slaCompliance: Math.max(0, slaCompliance),
            slaBreaches
        };
    }

    /**
     * Calculate percentile value
     */
    calculatePercentile(sortedArray, percentile) {
        if (sortedArray.length === 0) return 0;

        const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
        return sortedArray[Math.max(0, index)];
    }

    /**
     * Calculate health score (0-100)
     * @param {Number} uptime - Uptime percentage (0-100)
     * @param {Number} errorRate - Error rate percentage (0-100)
     * @param {Number} slaBreaches - Number of SLA breaches
     * @param {Number} unresolvedAnomalies - Number of unresolved anomalies
     * @param {Number} criticalAnomalies - Number of critical anomalies
     * @returns {Number} Health score (0-100)
     */
    calculateHealthScore(uptime, errorRate, slaBreaches, unresolvedAnomalies, criticalAnomalies) {
        let score = 100;

        // Penalize for downtime (uptime below 100% reduces score)
        score -= (100 - uptime) * 2;

        // Penalize for error rate (each 1% error reduces score by 10 points)
        score -= errorRate * 10;

        // Penalize for SLA breaches (5 points each)
        score -= slaBreaches * 5;

        // Penalize for unresolved anomalies (3 points each)
        score -= unresolvedAnomalies * 3;

        // Extra penalty for critical anomalies (10 points each)
        score -= criticalAnomalies * 10;

        // Clamp between 0 and 100
        return Math.max(0, Math.min(100, Math.round(score)));
    }

    /**
     * Calculate slope for linear regression (simple trend)
     * @param {Array} values - Array of numeric values
     * @returns {Number} Slope value
     */
    calculateSlope(values) {
        if (values.length < 2) return 0;

        const n = values.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

        for (let i = 0; i < n; i++) {
            sumX += i;
            sumY += values[i];
            sumXY += i * values[i];
            sumX2 += i * i;
        }

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        return slope;
    }

    /**
     * Detect anomalies using Z-score method
     */
    async detectAnomaliesForPeriod(monitorId, currentMetrics, period) {
        try {
            // Get historical data for baseline (last 7 periods)
            const historicalAnalytics = await Analytics.find({
                monitorId,
                aggregationPeriod: period,
                timestamp: {
                    $gte: new Date(Date.now() - this.getPeriodMillis(period) * 7),
                    $lt: new Date()
                }
            }).sort({ timestamp: -1 }).limit(7);

            if (historicalAnalytics.length < 3) {
                return []; // Not enough data for anomaly detection
            }

            const anomalies = [];

            // Check response time anomaly
            const responseTimeAnomaly = this.detectZScoreAnomaly(
                currentMetrics.avgResponseTime,
                historicalAnalytics.map(a => a.metrics.avgResponseTime),
                'response_time',
                'Average response time is abnormally high'
            );
            if (responseTimeAnomaly) anomalies.push(responseTimeAnomaly);

            // Check error rate anomaly
            const errorRateAnomaly = this.detectZScoreAnomaly(
                currentMetrics.errorRate,
                historicalAnalytics.map(a => a.metrics.errorRate),
                'error_rate',
                'Error rate is abnormally high'
            );
            if (errorRateAnomaly) anomalies.push(errorRateAnomaly);

            // Check throughput anomaly
            const throughputAnomaly = this.detectZScoreAnomaly(
                currentMetrics.totalRequests,
                historicalAnalytics.map(a => a.metrics.totalRequests),
                'throughput',
                'Request throughput is abnormal',
                2.0 // Lower threshold for throughput
            );
            if (throughputAnomaly) anomalies.push(throughputAnomaly);

            // Check downtime
            if (currentMetrics.uptimePercentage < 95) {
                anomalies.push({
                    type: 'downtime',
                    severity: currentMetrics.uptimePercentage < 90 ? 'critical' : 'high',
                    value: currentMetrics.uptimePercentage,
                    expectedValue: 99.9,
                    zScore: 0,
                    description: 'Significant downtime detected',
                    detectedAt: new Date(),
                    resolved: false
                });
            }

            return anomalies;
        } catch (error) {
            console.error('Error detecting anomalies:', error);
            return [];
        }
    }

    /**
     * Detect anomaly using Z-score method
     */
    detectZScoreAnomaly(value, historicalValues, type, description, threshold = 2.5) {
        const mean = historicalValues.reduce((sum, v) => sum + v, 0) / historicalValues.length;
        const variance = historicalValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / historicalValues.length;
        const stdDev = Math.sqrt(variance);

        if (stdDev === 0) return null;

        const zScore = Math.abs((value - mean) / stdDev);

        if (zScore > threshold) {
            let severity;
            if (zScore > 3.5) severity = 'critical';
            else if (zScore > 3.0) severity = 'high';
            else if (zScore > 2.5) severity = 'medium';
            else severity = 'low';

            return {
                type,
                severity,
                value: Math.round(value * 100) / 100,
                expectedValue: Math.round(mean * 100) / 100,
                zScore: Math.round(zScore * 100) / 100,
                description,
                detectedAt: new Date(),
                resolved: false
            };
        }

        return null;
    }

    /**
     * Calculate trends
     */
    async calculateTrends(monitorId, currentMetrics, period) {
        try {
            // Get last 5 periods for trend analysis
            const historicalAnalytics = await Analytics.find({
                monitorId,
                aggregationPeriod: period,
                timestamp: {
                    $gte: new Date(Date.now() - this.getPeriodMillis(period) * 5)
                }
            }).sort({ timestamp: 1 }).limit(5);

            if (historicalAnalytics.length < 2) {
                return {
                    responseTimeTrend: 'stable',
                    errorRateTrend: 'stable',
                    throughputTrend: 'stable',
                    trendConfidence: 0
                };
            }

            // Calculate linear trends
            const responseTimeTrend = this.calculateTrendDirection(
                historicalAnalytics.map(a => a.metrics.avgResponseTime),
                'inverse' // Lower is better
            );

            const errorRateTrend = this.calculateTrendDirection(
                historicalAnalytics.map(a => a.metrics.errorRate),
                'inverse' // Lower is better
            );

            const throughputTrend = this.calculateTrendDirection(
                historicalAnalytics.map(a => a.metrics.totalRequests),
                'normal' // Higher is normal
            );

            // Calculate confidence based on data consistency
            const confidence = this.calculateTrendConfidence(historicalAnalytics);

            return {
                responseTimeTrend,
                errorRateTrend,
                throughputTrend,
                trendConfidence: confidence
            };
        } catch (error) {
            console.error('Error calculating trends:', error);
            return {
                responseTimeTrend: 'stable',
                errorRateTrend: 'stable',
                throughputTrend: 'stable',
                trendConfidence: 0
            };
        }
    }

    /**
     * Calculate trend direction using linear regression
     */
    calculateTrendDirection(values, type = 'normal') {
        if (values.length < 2) return 'stable';

        const n = values.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

        values.forEach((value, index) => {
            sumX += index;
            sumY += value;
            sumXY += index * value;
            sumX2 += index * index;
        });

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

        // Threshold for detecting significant trend (5% change)
        const avgValue = sumY / n;
        const threshold = avgValue * 0.05;

        if (type === 'inverse') {
            // For metrics where lower is better (response time, error rate)
            if (slope < -threshold) return 'improving';
            if (slope > threshold) return 'degrading';
        } else {
            // For metrics where higher is normal (throughput)
            if (slope > threshold) return 'increasing';
            if (slope < -threshold) return 'decreasing';
        }

        return 'stable';
    }

    /**
     * Calculate trend confidence score
     */
    calculateTrendConfidence(analyticsData) {
        if (analyticsData.length < 3) return 30;

        // More data points = higher confidence
        const dataConfidence = Math.min((analyticsData.length / 10) * 50, 50);

        // Less variance = higher confidence
        const responseTimes = analyticsData.map(a => a.metrics.avgResponseTime);
        const mean = responseTimes.reduce((sum, v) => sum + v, 0) / responseTimes.length;
        const variance = responseTimes.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / responseTimes.length;
        const cv = Math.sqrt(variance) / mean; // Coefficient of variation

        const varianceConfidence = Math.max(0, 50 - (cv * 100));

        return Math.round(dataConfidence + varianceConfidence);
    }

    /**
     * Generate predictions using simple linear regression
     */
    async generatePredictions(monitorId, period) {
        try {
            const historicalAnalytics = await Analytics.find({
                monitorId,
                aggregationPeriod: period,
                timestamp: {
                    $gte: new Date(Date.now() - this.getPeriodMillis(period) * 10)
                }
            }).sort({ timestamp: 1 }).limit(10);

            if (historicalAnalytics.length < 5) {
                return null; // Not enough data for predictions
            }

            // Predict next hour response time
            const responseTimes = historicalAnalytics.map(a => a.metrics.avgResponseTime);
            const nextHourResponseTime = this.predictNextValue(responseTimes);

            // Predict next hour error rate
            const errorRates = historicalAnalytics.map(a => a.metrics.errorRate);
            const nextHourErrorRate = this.predictNextValue(errorRates);

            // Predict next day uptime
            const uptimes = historicalAnalytics.map(a => a.metrics.uptimePercentage);
            const nextDayUptime = this.predictNextValue(uptimes);

            // Determine trend direction
            const latestMetrics = historicalAnalytics[historicalAnalytics.length - 1].metrics;
            const previousMetrics = historicalAnalytics[historicalAnalytics.length - 2].metrics;

            let trendDirection = 'stable';
            if (latestMetrics.avgResponseTime > previousMetrics.avgResponseTime * 1.1) {
                trendDirection = 'down'; // Performance degrading
            } else if (latestMetrics.avgResponseTime < previousMetrics.avgResponseTime * 0.9) {
                trendDirection = 'up'; // Performance improving
            }

            // Calculate confidence based on data consistency
            const confidence = this.calculatePredictionConfidence(historicalAnalytics);

            return {
                nextHourResponseTime: Math.round(nextHourResponseTime),
                nextHourErrorRate: Math.round(nextHourErrorRate * 100) / 100,
                nextDayUptime: Math.round(nextDayUptime * 100) / 100,
                trendDirection,
                confidence,
                calculatedAt: new Date()
            };
        } catch (error) {
            console.error('Error generating predictions:', error);
            return null;
        }
    }

    /**
     * Predict next value using linear regression
     */
    predictNextValue(values) {
        const n = values.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

        values.forEach((value, index) => {
            sumX += index;
            sumY += value;
            sumXY += index * value;
            sumX2 += index * index;
        });

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        return slope * n + intercept;
    }

    /**
     * Calculate prediction confidence
     */
    calculatePredictionConfidence(analyticsData) {
        if (analyticsData.length < 5) return 40;
        if (analyticsData.length < 7) return 60;
        if (analyticsData.length >= 10) return 85;
        return 70;
    }

    /**
     * Aggregate metrics for a workspace
     */
    async aggregateMetrics(workspaceId, startDate, endDate, interval = '1h') {
        try {
            const monitors = await Monitor.find({ workspaceId, isActive: true });
            const results = [];

            for (const monitor of monitors) {
                const analytics = await this.aggregateHealthCheckData(monitor._id.toString(), interval);
                if (analytics) {
                    results.push(analytics);
                }
            }

            return results;
        } catch (error) {
            console.error('Error aggregating workspace metrics:', error);
            throw error;
        }
    }

    /**
     * Detect anomalies for a workspace
     */
    async detectAnomalies(workspaceId, options = {}) {
        try {
            const {
                startDate = new Date(Date.now() - 3600000),
                endDate = new Date(),
                sensitivity = 2.5,
                baselinePeriod = 7
            } = options;

            const analytics = await Analytics.find({
                workspaceId,
                timestamp: { $gte: startDate, $lte: endDate },
                'anomalies.0': { $exists: true } // Has at least one anomaly
            }).populate('monitorId', 'name url');

            const allAnomalies = [];

            analytics.forEach(analytic => {
                analytic.anomalies.forEach(anomaly => {
                    if (!anomaly.resolved) {
                        allAnomalies.push({
                            ...anomaly.toObject(),
                            monitor: analytic.monitorId,
                            timestamp: analytic.timestamp
                        });
                    }
                });
            });

            return allAnomalies;
        } catch (error) {
            console.error('Error detecting workspace anomalies:', error);
            throw error;
        }
    }

    /**
     * Calculate SLA compliance
     */
    async calculateSLACompliance(slaConfigId, measurementPeriod = 'monthly') {
        try {
            const slaConfig = await AnalyticsSLAConfig.findById(slaConfigId);
            if (!slaConfig) {
                throw new Error('SLA configuration not found');
            }

            const { start, end } = this.getMeasurementPeriod(measurementPeriod);

            // Get analytics for the period
            const analytics = await Analytics.find({
                monitorId: slaConfig.monitorId,
                timestamp: { $gte: start, $lte: end }
            });

            if (analytics.length === 0) {
                return null;
            }

            // Calculate aggregate metrics
            const avgUptime = analytics.reduce((sum, a) => sum + a.metrics.uptimePercentage, 0) / analytics.length;
            const avgResponseTime = analytics.reduce((sum, a) => sum + a.metrics.avgResponseTime, 0) / analytics.length;
            const avgErrorRate = analytics.reduce((sum, a) => sum + a.metrics.errorRate, 0) / analytics.length;
            const totalDowntime = analytics.reduce((sum, a) => sum + (100 - a.metrics.uptimePercentage), 0);

            const metrics = {
                uptime: avgUptime,
                avgResponseTime,
                errorRate: avgErrorRate,
                downtimeMinutes: (totalDowntime / 100) * this.getPeriodMillis(measurementPeriod) / 60000
            };

            // Calculate compliance
            const compliance = slaConfig.calculateComplianceScore(metrics);
            const breaches = slaConfig.identifyBreaches(metrics);

            // Update SLA config
            slaConfig.currentStatus = {
                compliance,
                lastCalculated: new Date(),
                inCompliance: breaches.length === 0,
                breachCount: breaches.length,
                consecutiveBreach: breaches.length > 0 && slaConfig.currentStatus.breachCount > 0
            };

            // Add to history
            slaConfig.complianceHistory.push({
                period: { start, end },
                compliance,
                breaches,
                metrics
            });

            // Keep only last 12 periods in history
            if (slaConfig.complianceHistory.length > 12) {
                slaConfig.complianceHistory = slaConfig.complianceHistory.slice(-12);
            }

            await slaConfig.save();

            return slaConfig;
        } catch (error) {
            console.error('Error calculating SLA compliance:', error);
            throw error;
        }
    }

    /**
     * Compare multiple monitors
     */
    async compareMonitors(monitorIds, metricType = 'performance', timeRange = '24h') {
        try {
            const { start, end } = this.getTimeRange(timeRange);

            const comparisons = [];

            for (const monitorId of monitorIds) {
                const monitor = await Monitor.findById(monitorId);
                if (!monitor) continue;

                const analytics = await Analytics.find({
                    monitorId,
                    timestamp: { $gte: start, $lte: end }
                }).sort({ timestamp: 1 });

                if (analytics.length === 0) continue;

                // Calculate aggregate metrics for comparison
                const avgResponseTime = analytics.reduce((sum, a) => sum + a.metrics.avgResponseTime, 0) / analytics.length;
                const avgUptime = analytics.reduce((sum, a) => sum + a.metrics.uptimePercentage, 0) / analytics.length;
                const avgErrorRate = analytics.reduce((sum, a) => sum + a.metrics.errorRate, 0) / analytics.length;
                const totalCost = analytics.reduce((sum, a) => sum + a.metrics.costEstimate, 0);

                comparisons.push({
                    monitorId,
                    name: monitor.name,
                    url: monitor.url,
                    metrics: {
                        avgResponseTime: Math.round(avgResponseTime),
                        avgUptime: Math.round(avgUptime * 100) / 100,
                        avgErrorRate: Math.round(avgErrorRate * 100) / 100,
                        totalCost: Math.round(totalCost * 10000) / 10000
                    },
                    timeSeries: analytics.map(a => ({
                        timestamp: a.timestamp,
                        responseTime: a.metrics.avgResponseTime,
                        uptime: a.metrics.uptimePercentage,
                        errorRate: a.metrics.errorRate
                    }))
                });
            }

            return {
                timeRange,
                metricType,
                startDate: start,
                endDate: end,
                comparisons
            };
        } catch (error) {
            console.error('Error comparing monitors:', error);
            throw error;
        }
    }

    /**
     * Export analytics data
     */
    async exportData(monitorId, format = 'json', timeRange = '30d') {
        try {
            const { start, end } = this.getTimeRange(timeRange);

            const monitor = await Monitor.findById(monitorId);
            if (!monitor) {
                throw new Error('Monitor not found');
            }

            let analytics = await Analytics.find({
                monitorId,
                timestamp: { $gte: start, $lte: end }
            }).sort({ timestamp: 1 });

            // If no analytics exist, generate from health checks
            if (analytics.length === 0) {
                const healthChecks = await HealthCheck.find({
                    monitorId,
                    checkedAt: { $gte: start, $lte: end }
                }).sort({ checkedAt: 1 });

                if (healthChecks.length > 0) {
                    // Group health checks by hour
                    const timeSeriesMap = new Map();
                    healthChecks.forEach(hc => {
                        const hourKey = new Date(hc.checkedAt).setMinutes(0, 0, 0);
                        if (!timeSeriesMap.has(hourKey)) {
                            timeSeriesMap.set(hourKey, []);
                        }
                        timeSeriesMap.get(hourKey).push(hc);
                    });

                    // Create analytics-like objects from health check data
                    analytics = Array.from(timeSeriesMap.entries()).map(([timestamp, checks]) => {
                        const successful = checks.filter(c => c.status === 'success');
                        const failed = checks.length - successful.length;
                        const responseTimes = successful.map(c => c.responseTime);
                        const avgResponseTime = responseTimes.length > 0
                            ? responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length
                            : 0;
                        const uptimePercentage = (successful.length / checks.length) * 100;
                        const errorRate = (failed / checks.length) * 100;

                        return {
                            timestamp: new Date(timestamp),
                            metrics: {
                                totalRequests: checks.length,
                                successfulRequests: successful.length,
                                failedRequests: failed,
                                avgResponseTime: Math.round(avgResponseTime),
                                uptimePercentage: Math.round(uptimePercentage * 100) / 100,
                                errorRate: Math.round(errorRate * 100) / 100,
                                costEstimate: (checks.length * 0.0001).toFixed(4),
                                slaCompliance: uptimePercentage >= 99 ? 100 : Math.max(0, 100 - ((100 - uptimePercentage) * 10))
                            }
                        };
                    });
                }
            }

            if (format === 'csv') {
                return this.convertToCSV(analytics);
            }

            return analytics;
        } catch (error) {
            console.error('Error exporting data:', error);
            throw error;
        }
    }

    /**
     * Convert analytics data to CSV
     */
    convertToCSV(analytics) {
        const headers = [
            'Timestamp',
            'Total Requests',
            'Successful Requests',
            'Failed Requests',
            'Avg Response Time',
            'Uptime %',
            'Error Rate %',
            'Cost Estimate',
            'SLA Compliance'
        ];

        const rows = analytics.map(a => [
            a.timestamp.toISOString(),
            a.metrics.totalRequests,
            a.metrics.successfulRequests,
            a.metrics.failedRequests,
            a.metrics.avgResponseTime,
            a.metrics.uptimePercentage,
            a.metrics.errorRate,
            a.metrics.costEstimate,
            a.metrics.slaCompliance
        ]);

        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    /**
     * Generate dashboard data
     */
    async generateDashboard(monitorId, timeRange = '24h') {
        try {
            const { start, end } = this.getTimeRange(timeRange);

            const monitor = await Monitor.findById(monitorId);
            if (!monitor) {
                throw new Error('Monitor not found');
            }

            // Calculate lifetime uptime from monitor's totalChecks and totalFailures
            const lifetimeUptime = monitor.totalChecks > 0
                ? ((monitor.totalChecks - monitor.totalFailures) / monitor.totalChecks) * 100
                : 100;

            // Try to get analytics first
            let analytics = await Analytics.find({
                monitorId,
                timestamp: { $gte: start, $lte: end }
            }).sort({ timestamp: 1 });

            // If no analytics exist, calculate from raw health checks
            if (analytics.length === 0) {
                const healthChecks = await HealthCheck.find({
                    monitorId,
                    checkedAt: { $gte: start, $lte: end }
                }).sort({ checkedAt: 1 });

                if (healthChecks.length > 0) {
                    // Calculate metrics from health checks directly
                    const metrics = this.calculateMetrics(healthChecks, monitor);

                    // Calculate lifetime error rate
                    const lifetimeErrorRate = 100 - lifetimeUptime;

                    // Calculate health score based on lifetime stats
                    const healthScore = this.calculateHealthScore(
                        lifetimeUptime,
                        lifetimeErrorRate,
                        metrics.slaBreaches || 0,
                        0, // no anomalies yet
                        0  // no critical anomalies
                    );

                    // Group health checks by hour for time series
                    const timeSeriesMap = new Map();
                    healthChecks.forEach(hc => {
                        const hourKey = new Date(hc.checkedAt).setMinutes(0, 0, 0);
                        if (!timeSeriesMap.has(hourKey)) {
                            timeSeriesMap.set(hourKey, []);
                        }
                        timeSeriesMap.get(hourKey).push(hc);
                    });

                    const timeSeries = Array.from(timeSeriesMap.entries()).map(([timestamp, checks]) => {
                        const successful = checks.filter(c => c.status === 'success');
                        const avgResponseTime = successful.length > 0
                            ? successful.reduce((sum, c) => sum + c.responseTime, 0) / successful.length
                            : 0;
                        const uptime = (successful.length / checks.length) * 100;
                        const errorRate = ((checks.length - successful.length) / checks.length) * 100;

                        return {
                            timestamp: new Date(timestamp),
                            responseTime: avgResponseTime,
                            uptime,
                            errorRate,
                            requests: checks.length
                        };
                    });

                    // Generate predictions from health check time series
                    let predictions = null;
                    if (timeSeries.length >= 5) {
                        const responseTimes = timeSeries.map(ts => ts.responseTime);
                        const errorRates = timeSeries.map(ts => ts.errorRate);
                        const uptimes = timeSeries.map(ts => ts.uptime);

                        // Simple linear regression for next hour prediction
                        const rtSlope = this.calculateSlope(responseTimes);
                        const erSlope = this.calculateSlope(errorRates);
                        const nextHourResponseTime = Math.max(0, Math.round(responseTimes[responseTimes.length - 1] + rtSlope));
                        const nextHourErrorRate = Math.max(0, Math.min(100, errorRates[errorRates.length - 1] + erSlope));
                        const nextDayUptime = Math.max(0, Math.min(100, uptimes[uptimes.length - 1]));

                        predictions = {
                            nextHourResponseTime,
                            nextHourErrorRate: parseFloat(nextHourErrorRate.toFixed(2)),
                            nextDayUptime: parseFloat(nextDayUptime.toFixed(2)),
                            trendDirection: rtSlope > 5 ? 'down' : (rtSlope < -5 ? 'up' : 'stable'),
                            confidence: Math.min(85, 40 + (timeSeries.length * 5))
                        };
                    }

                    // Detect anomalies from health check data
                    const anomalies = [];
                    if (timeSeries.length >= 10) {
                        const responseTimes = timeSeries.map(ts => ts.responseTime);
                        const mean = responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length;
                        const variance = responseTimes.reduce((sum, rt) => sum + Math.pow(rt - mean, 2), 0) / responseTimes.length;
                        const stdDev = Math.sqrt(variance);

                        timeSeries.forEach((ts, index) => {
                            if (stdDev > 0) {
                                const zScore = (ts.responseTime - mean) / stdDev;
                                if (Math.abs(zScore) > 2.5) {
                                    anomalies.push({
                                        type: 'response_time',
                                        description: `Unusual response time detected: ${Math.round(ts.responseTime)}ms`,
                                        severity: Math.abs(zScore) > 3.5 ? 'critical' : (Math.abs(zScore) > 3.0 ? 'high' : 'medium'),
                                        timestamp: ts.timestamp,
                                        value: Math.round(ts.responseTime),
                                        expectedValue: Math.round(mean),
                                        zScore: zScore.toFixed(2),
                                        resolved: false
                                    });
                                }
                            }
                        });
                    }

                    return {
                        monitor: {
                            id: monitor._id,
                            name: monitor.name,
                            url: monitor.url,
                            status: monitor.currentStatus,
                            lifetimeUptime: parseFloat(lifetimeUptime.toFixed(2)),
                            lifetimeAvgResponseTime: monitor.averageResponseTime || 0
                        },
                        timeRange: {
                            start,
                            end,
                            range: timeRange
                        },
                        summary: {
                            avgResponseTime: Math.round(metrics.avgResponseTime),
                            avgUptime: parseFloat(lifetimeUptime.toFixed(2)),
                            totalRequests: metrics.totalRequests,
                            totalErrors: metrics.failedRequests,
                            healthScore
                        },
                        currentMetrics: metrics,
                        predictions,
                        anomalies,
                        timeSeries
                    };
                }
            }

            const latest = analytics.length > 0 ? analytics[analytics.length - 1] : null;

            // Calculate dashboard metrics from analytics
            const avgResponseTime = analytics.length > 0
                ? analytics.reduce((sum, a) => sum + a.metrics.avgResponseTime, 0) / analytics.length
                : 0;

            const avgUptime = analytics.length > 0
                ? analytics.reduce((sum, a) => sum + a.metrics.uptimePercentage, 0) / analytics.length
                : 100;

            const totalRequests = analytics.reduce((sum, a) => sum + a.metrics.totalRequests, 0);
            const totalErrors = analytics.reduce((sum, a) => sum + a.metrics.failedRequests, 0);

            // Calculate health score based on lifetime uptime
            const lifetimeErrorRate = 100 - lifetimeUptime;
            const healthScore = latest
                ? latest.healthScore
                : this.calculateHealthScore(
                    lifetimeUptime,
                    lifetimeErrorRate,
                    0,
                    0,
                    0
                );

            // Get unresolved anomalies
            const unresolvedAnomalies = [];
            analytics.forEach(a => {
                a.anomalies.forEach(anomaly => {
                    if (!anomaly.resolved) {
                        unresolvedAnomalies.push({
                            ...anomaly.toObject(),
                            timestamp: a.timestamp
                        });
                    }
                });
            });

            return {
                monitor: {
                    id: monitor._id,
                    name: monitor.name,
                    url: monitor.url,
                    status: monitor.currentStatus,
                    lifetimeUptime: parseFloat(lifetimeUptime.toFixed(2)),
                    lifetimeAvgResponseTime: monitor.averageResponseTime || 0
                },
                timeRange: {
                    start,
                    end,
                    range: timeRange
                },
                summary: {
                    avgResponseTime: Math.round(avgResponseTime),
                    avgUptime: parseFloat(lifetimeUptime.toFixed(2)),
                    totalRequests,
                    totalErrors,
                    healthScore
                },
                currentMetrics: latest ? latest.metrics : null,
                predictions: latest ? latest.predictions : null,
                anomalies: unresolvedAnomalies,
                timeSeries: analytics.map(a => ({
                    timestamp: a.timestamp,
                    responseTime: a.metrics.avgResponseTime,
                    uptime: a.metrics.uptimePercentage,
                    errorRate: a.metrics.errorRate,
                    requests: a.metrics.totalRequests
                }))
            };
        } catch (error) {
            console.error('Error generating dashboard:', error);
            throw error;
        }
    }

    /**
     * Helper: Get period start time
     */
    getPeriodStart(date, period) {
        const d = new Date(date);
        const millis = this.getPeriodMillis(period);
        const timestamp = Math.floor(d.getTime() / millis) * millis;
        return new Date(timestamp);
    }

    /**
     * Helper: Get period in milliseconds
     */
    getPeriodMillis(period) {
        switch (period) {
            case '5m': return 300000;
            case '15m': return 900000;
            case '1h': return 3600000;
            case '1d': return 86400000;
            default: return 3600000;
        }
    }

    /**
     * Helper: Get measurement period dates
     */
    getMeasurementPeriod(period) {
        const end = new Date();
        const start = new Date();

        switch (period) {
            case 'daily':
                start.setDate(start.getDate() - 1);
                break;
            case 'weekly':
                start.setDate(start.getDate() - 7);
                break;
            case 'monthly':
                start.setMonth(start.getMonth() - 1);
                break;
            case 'quarterly':
                start.setMonth(start.getMonth() - 3);
                break;
            case 'yearly':
                start.setFullYear(start.getFullYear() - 1);
                break;
        }

        return { start, end };
    }

    /**
     * Helper: Get time range dates
     */
    getTimeRange(range) {
        const end = new Date();
        const start = new Date();

        switch (range) {
            case '1h':
                start.setHours(start.getHours() - 1);
                break;
            case '24h':
                start.setDate(start.getDate() - 1);
                break;
            case '7d':
                start.setDate(start.getDate() - 7);
                break;
            case '30d':
                start.setDate(start.getDate() - 30);
                break;
            case '90d':
                start.setDate(start.getDate() - 90);
                break;
        }

        return { start, end };
    }
}

module.exports = new AnalyticsService();
