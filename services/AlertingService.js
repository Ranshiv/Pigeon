// services/AlertingService.js
const Alert = require('../models/Alert');
const Monitor = require('../models/Monitor');
const cron = require('node-cron');
const EventEmitter = require('events');

class AlertingService extends EventEmitter {
    constructor() {
        super();
        this.alertGroups = new Map(); // In-memory cache for active alert groups
        this.alertHistory = new Map(); // Historical data for trend analysis
        this.evaluationCache = new Map(); // Cache for formula evaluations
        this.groupingWindow = 5 * 60 * 1000; // 5 minutes
        this.maxHistorySize = 1000;

        // Track background cron jobs so we can stop them if needed.
        this._jobs = [];
        this._backgroundTasksStarted = false;

        // Start background tasks (disabled in Jest/tests to avoid open handles).
        if (!this._shouldDisableBackgroundTasks()) {
            this.startBackgroundTasks();
        }
    }

    _shouldDisableBackgroundTasks() {
        return process.env.NODE_ENV === 'test' || process.env.DISABLE_ALERTING_SCHEDULER === 'true';
    }

    startBackgroundTasks() {
        if (this._backgroundTasksStarted) return;
        this._backgroundTasksStarted = true;

        this.startAlertProcessing();
        this.startTrendAnalysis();
        this.startSnoozeMonitoring();
    }

    stopBackgroundTasks() {
        for (const job of this._jobs) {
            try {
                if (typeof job.stop === 'function') job.stop();
                if (typeof job.destroy === 'function') job.destroy();
            } catch (err) {
                // Best-effort cleanup
            }
        }
        this._jobs = [];
        this._backgroundTasksStarted = false;
    }

    /**
     * Intelligent alert grouping based on similarity
     */
    async groupAlert(alert) {
        try {
            const groupKey = this.generateGroupKey(alert);
            alert.groupKey = groupKey;

            // Check if this alert should be grouped with existing alerts
            const existingGroup = this.alertGroups.get(groupKey);

            if (existingGroup && existingGroup.alerts.length > 0) {
                // Add to existing group
                existingGroup.alerts.push(alert);
                existingGroup.count++;
                existingGroup.lastTriggered = new Date();

                // Update severity to highest in group
                const severities = ['info', 'low', 'medium', 'high', 'critical'];
                const maxSeverity = existingGroup.alerts.reduce((max, a) => {
                    return severities.indexOf(a.severity) > severities.indexOf(max) ? a.severity : max;
                }, 'info');

                existingGroup.severity = maxSeverity;

                // Emit group update event
                this.emit('alertGroupUpdated', {
                    groupKey: groupKey,
                    count: existingGroup.count,
                    severity: maxSeverity,
                    alerts: existingGroup.alerts
                });

                return { grouped: true, groupKey, count: existingGroup.count };
            } else {
                // Create new group
                const newGroup = {
                    groupKey,
                    alerts: [alert],
                    count: 1,
                    firstTriggered: new Date(),
                    lastTriggered: new Date(),
                    severity: alert.severity
                };

                this.alertGroups.set(groupKey, newGroup);

                this.emit('alertGroupCreated', newGroup);

                return { grouped: false, groupKey, count: 1 };
            }
        } catch (error) {
            console.error('Error grouping alert:', error);
            throw error;
        }
    }

    /**
     * Generate a grouping key based on alert characteristics
     */
    generateGroupKey(alert) {
        const components = [
            alert.monitorId?.toString() || 'unknown',
            alert.severity,
            this.normalizeTitle(alert.title)
        ];

        return components.join('::');
    }

    normalizeTitle(title) {
        // Remove timestamps, numbers, and normalize text
        return title
            .replace(/\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}/g, 'TIMESTAMP')
            .replace(/\d+/g, 'NUM')
            .toLowerCase()
            .trim();
    }

    /**
     * Evaluate custom alert conditions with formula support
     */
    async evaluateCondition(condition, metrics) {
        try {
            const cacheKey = `${condition.formula}-${JSON.stringify(metrics)}`;

            // Check cache first
            if (this.evaluationCache.has(cacheKey)) {
                const cached = this.evaluationCache.get(cacheKey);
                if (Date.now() - cached.timestamp < 60000) { // 1 minute cache
                    return cached.result;
                }
            }

            let result = false;

            switch (condition.type) {
                case 'threshold':
                    result = this.evaluateThreshold(condition, metrics);
                    break;
                case 'formula':
                    result = this.evaluateFormula(condition.formula, metrics);
                    break;
                case 'anomaly':
                    result = await this.evaluateAnomaly(condition, metrics);
                    break;
                case 'composite':
                    result = await this.evaluateComposite(condition, metrics);
                    break;
                default:
                    result = false;
            }

            // Cache result
            this.evaluationCache.set(cacheKey, {
                result,
                timestamp: Date.now()
            });

            // Clean cache if too large
            if (this.evaluationCache.size > 10000) {
                const oldest = Array.from(this.evaluationCache.entries())
                    .sort((a, b) => a[1].timestamp - b[1].timestamp)
                    .slice(0, 5000);
                oldest.forEach(([key]) => this.evaluationCache.delete(key));
            }

            return result;
        } catch (error) {
            console.error('Error evaluating condition:', error);
            return false;
        }
    }

    evaluateThreshold(condition, metrics) {
        const value = this.getMetricValue(metrics, condition.metric);
        const threshold = parseFloat(condition.threshold);

        switch (condition.operator) {
            case 'gt': return value > threshold;
            case 'gte': return value >= threshold;
            case 'lt': return value < threshold;
            case 'lte': return value <= threshold;
            case 'eq': return value === threshold;
            case 'neq': return value !== threshold;
            default: return false;
        }
    }

    evaluateFormula(formula, metrics) {
        try {
            // Safe formula evaluation with limited scope
            const safeMetrics = { ...metrics };
            const allowedMath = {
                abs: Math.abs,
                ceil: Math.ceil,
                floor: Math.floor,
                round: Math.round,
                max: Math.max,
                min: Math.min,
                sqrt: Math.sqrt,
                pow: Math.pow
            };

            // Create a safe evaluation context
            const context = {
                ...safeMetrics,
                Math: allowedMath
            };

            // Replace variable names in formula
            let safeFormula = formula;
            Object.keys(metrics).forEach(key => {
                const regex = new RegExp(`\\b${key}\\b`, 'g');
                safeFormula = safeFormula.replace(regex, `metrics.${key}`);
            });

            // Use Function constructor for controlled evaluation
            const evaluator = new Function('metrics', 'Math', `
                "use strict";
                return ${safeFormula};
            `);

            return evaluator(metrics, allowedMath);
        } catch (error) {
            console.error('Formula evaluation error:', error);
            return false;
        }
    }

    async evaluateAnomaly(condition, metrics) {
        const value = this.getMetricValue(metrics, condition.metric);
        const history = this.alertHistory.get(condition.metric) || [];

        if (history.length < condition.minDataPoints || 10) {
            return false; // Need more data
        }

        // Calculate mean and standard deviation
        const mean = history.reduce((sum, v) => sum + v, 0) / history.length;
        const variance = history.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / history.length;
        const stdDev = Math.sqrt(variance);

        // Z-score anomaly detection
        const zScore = Math.abs((value - mean) / stdDev);
        const threshold = condition.sensitivityThreshold || 3; // 3 standard deviations

        return zScore > threshold;
    }

    async evaluateComposite(condition, metrics) {
        const results = [];

        for (const subCondition of condition.conditions) {
            const result = await this.evaluateCondition(subCondition, metrics);
            results.push(result);
        }

        // Apply logical operator
        switch (condition.operator) {
            case 'AND':
                return results.every(r => r);
            case 'OR':
                return results.some(r => r);
            case 'NOT':
                return !results[0];
            default:
                return false;
        }
    }

    getMetricValue(metrics, path) {
        return path.split('.').reduce((obj, key) => obj?.[key], metrics);
    }

    /**
     * Predictive alerting using trend analysis
     */
    async analyzeTrends(monitorId, metricName) {
        try {
            // Get historical data for the monitor
            const history = await this.getMetricHistory(monitorId, metricName, 100);

            if (history.length < 10) {
                return null; // Not enough data for prediction
            }

            // Simple linear regression for trend analysis
            const trend = this.calculateTrend(history);
            const projection = this.projectFutureValue(history, trend, 10); // 10 time periods ahead

            // Check if projected value will breach threshold
            const monitor = await Monitor.findById(monitorId);
            const alertThreshold = monitor?.alertThreshold || {};

            if (alertThreshold.enabled && projection.value > alertThreshold.value) {
                return {
                    isPredictive: true,
                    currentValue: history[history.length - 1].value,
                    projectedValue: projection.value,
                    trend: trend.slope,
                    confidence: projection.confidence,
                    estimatedTime: projection.timeToThreshold
                };
            }

            return null;
        } catch (error) {
            console.error('Error analyzing trends:', error);
            return null;
        }
    }

    calculateTrend(data) {
        const n = data.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

        data.forEach((point, index) => {
            const x = index;
            const y = point.value;
            sumX += x;
            sumY += y;
            sumXY += x * y;
            sumX2 += x * x;
        });

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        // Calculate R-squared for confidence
        const yMean = sumY / n;
        let ssTotal = 0, ssResidual = 0;

        data.forEach((point, index) => {
            const predicted = slope * index + intercept;
            ssTotal += Math.pow(point.value - yMean, 2);
            ssResidual += Math.pow(point.value - predicted, 2);
        });

        const rSquared = 1 - (ssResidual / ssTotal);

        return { slope, intercept, rSquared };
    }

    projectFutureValue(data, trend, periodsAhead) {
        const lastIndex = data.length - 1;
        const futureIndex = lastIndex + periodsAhead;
        const projectedValue = trend.slope * futureIndex + trend.intercept;

        return {
            value: projectedValue,
            confidence: trend.rSquared,
            periodsAhead
        };
    }

    async getMetricHistory(monitorId, metricName, limit = 100) {
        // This would query your health check history
        // For now, returning a placeholder
        return [];
    }

    /**
     * Route alerts based on severity, type, and policies
     */
    async routeAlert(alert, policy) {
        try {
            const routes = [];

            // Determine routing based on severity
            const severityRouting = this.getSeverityRouting(alert.severity, policy);
            routes.push(...severityRouting);

            // Add time-based routing (on-call schedules)
            const onCallRouting = await this.getOnCallRouting(alert, policy);
            if (onCallRouting) {
                routes.push(onCallRouting);
            }

            // Add team-based routing
            if (policy.teamRouting) {
                routes.push({
                    type: 'team',
                    targetId: policy.teamId,
                    priority: 1
                });
            }

            // Add escalation routing if critical
            if (alert.severity === 'critical' && policy.escalationPolicyId) {
                routes.push({
                    type: 'escalation',
                    targetId: policy.escalationPolicyId,
                    priority: 0
                });
            }

            return routes;
        } catch (error) {
            console.error('Error routing alert:', error);
            return [];
        }
    }

    getSeverityRouting(severity, policy) {
        const routes = [];
        const severityMap = policy.severityRouting || {};

        if (severityMap[severity]) {
            severityMap[severity].forEach(target => {
                routes.push({
                    type: target.type,
                    targetId: target.targetId,
                    channel: target.channel,
                    priority: target.priority || 2
                });
            });
        }

        return routes;
    }

    async getOnCallRouting(alert, policy) {
        // This would integrate with OnCallSchedule model
        // For now, returning null
        return null;
    }

    /**
     * Background task for alert processing
     */
    startAlertProcessing() {
        // Process alerts every minute
        const job = cron.schedule('* * * * *', async () => {
            try {
                await this.processActiveAlerts();
            } catch (error) {
                console.error('Error in alert processing:', error);
            }
        });

        this._jobs.push(job);
        return job;
    }

    async processActiveAlerts() {
        // Get all triggered alerts
        const alerts = await Alert.find({
            status: { $in: ['triggered', 'acknowledged'] }
        }).populate('monitorId policyId');

        // Group similar alerts
        for (const alert of alerts) {
            await this.groupAlert(alert);
        }

        // Clean up old groups
        this.cleanupOldGroups();
    }

    cleanupOldGroups() {
        const now = Date.now();
        for (const [groupKey, group] of this.alertGroups.entries()) {
            if (now - group.lastTriggered > this.groupingWindow) {
                this.alertGroups.delete(groupKey);
            }
        }
    }

    /**
     * Background task for trend analysis
     */
    startTrendAnalysis() {
        // Analyze trends every 5 minutes
        const job = cron.schedule('*/5 * * * *', async () => {
            try {
                await this.performTrendAnalysis();
            } catch (error) {
                console.error('Error in trend analysis:', error);
            }
        });

        this._jobs.push(job);
        return job;
    }

    async performTrendAnalysis() {
        // Get all active monitors with predictive alerting enabled
        const monitors = await Monitor.find({
            'predictiveAlerts.enabled': true,
            currentStatus: 'active'
        });

        for (const monitor of monitors) {
            const prediction = await this.analyzeTrends(monitor._id, 'responseTime');

            if (prediction) {
                // Create predictive alert
                await this.createPredictiveAlert(monitor, prediction);
            }
        }
    }

    async createPredictiveAlert(monitor, prediction) {
        const alert = new Alert({
            monitorId: monitor._id,
            title: `Predictive Alert: ${monitor.name}`,
            description: `Projected to breach threshold in approximately ${prediction.estimatedTime || 'soon'}. Current: ${prediction.currentValue}, Projected: ${prediction.projectedValue}`,
            severity: 'medium',
            status: 'triggered',
            isPredictive: true,
            predictionData: {
                projectedValue: prediction.projectedValue,
                currentTrend: prediction.trend,
                confidence: prediction.confidence,
                forecastedAt: new Date()
            }
        });

        await alert.save();
        this.emit('predictiveAlertCreated', alert);
    }

    /**
     * Monitor snoozed alerts
     */
    startSnoozeMonitoring() {
        // Check snoozed alerts every minute
        const job = cron.schedule('* * * * *', async () => {
            try {
                await this.checkSnoozedAlerts();
            } catch (error) {
                console.error('Error checking snoozed alerts:', error);
            }
        });

        this._jobs.push(job);
        return job;
    }

    async checkSnoozedAlerts() {
        const now = new Date();
        const alerts = await Alert.find({
            status: 'snoozed',
            snoozedUntil: { $lte: now }
        });

        for (const alert of alerts) {
            alert.status = 'triggered';
            alert.snoozedUntil = null;
            await alert.save();

            this.emit('alertUnsnoozed', alert);
        }
    }

    /**
     * Get alert statistics
     */
    async getAlertStatistics(filters = {}) {
        const pipeline = [
            { $match: filters },
            {
                $group: {
                    _id: '$severity',
                    count: { $sum: 1 },
                    avgResolutionTime: {
                        $avg: {
                            $cond: [
                                { $and: ['$resolvedAt', '$triggeredAt'] },
                                { $subtract: ['$resolvedAt', '$triggeredAt'] },
                                null
                            ]
                        }
                    }
                }
            }
        ];

        const stats = await Alert.aggregate(pipeline);

        // Calculate MTTA (Mean Time To Acknowledge)
        const mttaPipeline = [
            { $match: { ...filters, acknowledgedAt: { $exists: true } } },
            {
                $group: {
                    _id: null,
                    mtta: {
                        $avg: { $subtract: ['$acknowledgedAt', '$triggeredAt'] }
                    }
                }
            }
        ];

        const mttaResult = await Alert.aggregate(mttaPipeline);
        const mtta = mttaResult.length > 0 ? mttaResult[0].mtta : 0;

        return {
            bySeverity: stats,
            mtta,
            totalAlerts: stats.reduce((sum, s) => sum + s.count, 0)
        };
    }

    /**
     * Get alert frequency for heatmap
     */
    async getAlertFrequency(startDate, endDate, groupBy = 'hour') {
        const pipeline = [
            {
                $match: {
                    triggeredAt: {
                        $gte: new Date(startDate),
                        $lte: new Date(endDate)
                    }
                }
            },
            {
                $group: {
                    _id: {
                        $dateTrunc: {
                            date: '$triggeredAt',
                            unit: groupBy
                        }
                    },
                    count: { $sum: 1 },
                    severity: { $push: '$severity' }
                }
            },
            { $sort: { _id: 1 } }
        ];

        return Alert.aggregate(pipeline);
    }
}

module.exports = new AlertingService();
