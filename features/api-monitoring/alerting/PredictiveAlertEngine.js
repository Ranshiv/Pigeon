// features/api-monitoring/alerting/PredictiveAlertEngine.js
const HealthCheck = require('../../../models/HealthCheck');
const Monitor = require('../../../models/Monitor');
const Alert = require('../../../models/Alert');
const EventEmitter = require('events');

class PredictiveAlertEngine extends EventEmitter {
    constructor(options = {}) {
        super();
        this.predictionWindow = options.predictionWindow || 30; // minutes ahead
        this.minDataPoints = options.minDataPoints || 20;
        this.confidenceThreshold = options.confidenceThreshold || 0.75;
        this.anomalyThreshold = options.anomalyThreshold || 3; // standard deviations
    }

    /**
     * Analyze monitor metrics and predict potential issues
     */
    async analyzeTrends(monitorId) {
        try {
            const monitor = await Monitor.findById(monitorId);
            if (!monitor || !monitor.predictiveAlerts?.enabled) {
                return null;
            }

            // Get historical health check data
            const healthChecks = await this.getRecentHealthChecks(monitorId, 100);
            
            if (healthChecks.length < this.minDataPoints) {
                return { status: 'insufficient_data', required: this.minDataPoints };
            }

            // Analyze different metrics
            const predictions = {
                responseTime: await this.predictMetric(healthChecks, 'responseTime', monitor.alertThreshold?.responseTime),
                errorRate: await this.predictMetric(healthChecks, 'statusCode', null, (data) => {
                    const errors = data.filter(d => d.value >= 400).length;
                    return (errors / data.length) * 100;
                }),
                availability: await this.predictAvailability(healthChecks)
            };

            // Generate alert if any metric is predicted to breach
            const criticalPredictions = Object.entries(predictions)
                .filter(([_, pred]) => pred && pred.willBreach);

            if (criticalPredictions.length > 0) {
                return await this.createPredictiveAlert(monitor, predictions);
            }

            return { status: 'healthy', predictions };
        } catch (error) {
            console.error('Error analyzing trends:', error);
            throw error;
        }
    }

    /**
     * Predict future value of a metric
     */
    async predictMetric(healthChecks, metricName, threshold, transformer = null) {
        // Extract time series data
        let timeSeries = healthChecks
            .map((hc, index) => ({
                x: index,
                y: hc[metricName],
                timestamp: hc.checkedAt
            }))
            .filter(point => point.y !== null && point.y !== undefined);

        // Apply transformer if provided
        if (transformer) {
            const transformedValue = transformer(timeSeries);
            timeSeries = [{ x: 0, y: transformedValue, timestamp: new Date() }];
        }

        if (timeSeries.length < this.minDataPoints) {
            return null;
        }

        // Perform linear regression
        const regression = this.performLinearRegression(timeSeries);
        
        // Calculate prediction for future time point
        const futureIndex = timeSeries.length + this.predictionWindow;
        const predictedValue = regression.slope * futureIndex + regression.intercept;

        // Calculate confidence based on R-squared
        const confidence = regression.rSquared;

        // Check if predicted value will breach threshold
        const willBreach = threshold && predictedValue > threshold && confidence > this.confidenceThreshold;

        // Detect anomalies in recent data
        const recentAnomaly = this.detectAnomaly(timeSeries);

        return {
            currentValue: timeSeries[timeSeries.length - 1].y,
            predictedValue,
            trend: regression.slope > 0 ? 'increasing' : 'decreasing',
            confidence,
            willBreach,
            threshold,
            timeToThreshold: willBreach ? this.calculateTimeToThreshold(regression, threshold, timeSeries.length) : null,
            anomalyDetected: recentAnomaly.detected,
            anomalyScore: recentAnomaly.score
        };
    }

    /**
     * Perform linear regression on time series data
     */
    performLinearRegression(data) {
        const n = data.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

        data.forEach(point => {
            sumX += point.x;
            sumY += point.y;
            sumXY += point.x * point.y;
            sumX2 += point.x * point.x;
        });

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        // Calculate R-squared
        const yMean = sumY / n;
        let ssTotal = 0, ssResidual = 0;

        data.forEach(point => {
            const predicted = slope * point.x + intercept;
            ssTotal += Math.pow(point.y - yMean, 2);
            ssResidual += Math.pow(point.y - predicted, 2);
        });

        const rSquared = 1 - (ssResidual / ssTotal);

        return { slope, intercept, rSquared };
    }

    /**
     * Detect anomalies using statistical methods
     */
    detectAnomaly(timeSeries) {
        if (timeSeries.length < 10) {
            return { detected: false, score: 0 };
        }

        // Calculate mean and standard deviation
        const values = timeSeries.map(p => p.y);
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);

        // Check recent values for anomalies
        const recentValues = values.slice(-5);
        const anomalies = recentValues.filter(v => {
            const zScore = Math.abs((v - mean) / stdDev);
            return zScore > this.anomalyThreshold;
        });

        const maxZScore = Math.max(...recentValues.map(v => Math.abs((v - mean) / stdDev)));

        return {
            detected: anomalies.length > 0,
            score: maxZScore,
            threshold: this.anomalyThreshold
        };
    }

    /**
     * Calculate time until threshold breach
     */
    calculateTimeToThreshold(regression, threshold, currentIndex) {
        // Solve for x when y = threshold
        // y = slope * x + intercept
        // threshold = slope * x + intercept
        // x = (threshold - intercept) / slope

        if (regression.slope <= 0) {
            return null; // Not trending toward threshold
        }

        const breachIndex = (threshold - regression.intercept) / regression.slope;
        const periodsUntilBreach = breachIndex - currentIndex;

        // Assuming each period is ~1 minute (based on health check frequency)
        const minutesUntilBreach = Math.max(0, periodsUntilBreach);

        return {
            minutes: minutesUntilBreach,
            estimatedTime: new Date(Date.now() + minutesUntilBreach * 60 * 1000)
        };
    }

    /**
     * Predict availability based on recent patterns
     */
    async predictAvailability(healthChecks) {
        const recentChecks = healthChecks.slice(-20);
        const successCount = recentChecks.filter(hc => 
            hc.status === 'success' && hc.statusCode >= 200 && hc.statusCode < 400
        ).length;

        const currentAvailability = (successCount / recentChecks.length) * 100;

        // Calculate trend
        const midpoint = Math.floor(recentChecks.length / 2);
        const firstHalf = recentChecks.slice(0, midpoint);
        const secondHalf = recentChecks.slice(midpoint);

        const firstHalfAvailability = (firstHalf.filter(hc => hc.status === 'success').length / firstHalf.length) * 100;
        const secondHalfAvailability = (secondHalf.filter(hc => hc.status === 'success').length / secondHalf.length) * 100;

        const trend = secondHalfAvailability - firstHalfAvailability;

        return {
            currentAvailability,
            trend: trend > 0 ? 'improving' : trend < 0 ? 'degrading' : 'stable',
            trendValue: trend,
            predictedAvailability: Math.max(0, Math.min(100, currentAvailability + trend)),
            willBreach: currentAvailability < 95 && trend < -5,
            confidence: 0.85
        };
    }

    /**
     * Create predictive alert
     */
    async createPredictiveAlert(monitor, predictions) {
        const criticalMetrics = Object.entries(predictions)
            .filter(([_, pred]) => pred && pred.willBreach)
            .map(([metric, pred]) => `${metric}: ${pred.currentValue} → ${pred.predictedValue.toFixed(2)}`);

        const alert = new Alert({
            monitorId: monitor._id,
            title: `Predictive Alert: ${monitor.name}`,
            description: `Predicted threshold breach in ${this.predictionWindow} minutes.\n${criticalMetrics.join('\n')}`,
            severity: this.determineSeverity(predictions),
            status: 'triggered',
            isPredictive: true,
            predictionData: {
                predictions: Object.entries(predictions).reduce((acc, [key, value]) => {
                    if (value) {
                        acc[key] = {
                            current: value.currentValue,
                            predicted: value.predictedValue,
                            confidence: value.confidence,
                            trend: value.trend
                        };
                    }
                    return acc;
                }, {}),
                forecastedAt: new Date(),
                windowMinutes: this.predictionWindow
            },
            groupKey: `predictive-${monitor._id}`
        });

        await alert.save();
        
        this.emit('predictiveAlertCreated', { alert, monitor, predictions });
        
        return alert;
    }

    /**
     * Determine severity based on predictions
     */
    determineSeverity(predictions) {
        const breachingMetrics = Object.values(predictions).filter(p => p && p.willBreach);
        
        if (breachingMetrics.length === 0) {
            return 'info';
        }

        const avgConfidence = breachingMetrics.reduce((sum, p) => sum + p.confidence, 0) / breachingMetrics.length;
        const minTimeToThreshold = Math.min(...breachingMetrics
            .filter(p => p.timeToThreshold)
            .map(p => p.timeToThreshold.minutes));

        if (avgConfidence > 0.9 && minTimeToThreshold < 15) {
            return 'critical';
        } else if (avgConfidence > 0.8 && minTimeToThreshold < 30) {
            return 'high';
        } else {
            return 'medium';
        }
    }

    /**
     * Get recent health checks for analysis
     */
    async getRecentHealthChecks(monitorId, limit = 100) {
        return HealthCheck.find({ monitorId })
            .sort({ checkedAt: -1 })
            .limit(limit)
            .lean()
            .then(checks => checks.reverse()); // Oldest first for time series
    }

    /**
     * Batch analyze multiple monitors
     */
    async batchAnalyze(monitorIds) {
        const results = [];
        
        for (const monitorId of monitorIds) {
            try {
                const prediction = await this.analyzeTrends(monitorId);
                if (prediction) {
                    results.push({ monitorId, prediction });
                }
            } catch (error) {
                console.error(`Error analyzing monitor ${monitorId}:`, error);
                results.push({ monitorId, error: error.message });
            }
        }

        return results;
    }

    /**
     * Get prediction accuracy metrics
     */
    async evaluateAccuracy(timeRange = 7) {
        const startDate = new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000);
        
        const predictiveAlerts = await Alert.find({
            isPredictive: true,
            triggeredAt: { $gte: startDate }
        });

        let truePositives = 0;
        let falsePositives = 0;

        for (const alert of predictiveAlerts) {
            // Check if actual breach occurred within predicted window
            const actualAlerts = await Alert.find({
                monitorId: alert.monitorId,
                isPredictive: false,
                triggeredAt: {
                    $gte: alert.triggeredAt,
                    $lte: new Date(alert.triggeredAt.getTime() + this.predictionWindow * 60 * 1000)
                }
            });

            if (actualAlerts.length > 0) {
                truePositives++;
            } else {
                falsePositives++;
            }
        }

        const accuracy = predictiveAlerts.length > 0 
            ? (truePositives / predictiveAlerts.length) * 100 
            : 0;

        return {
            totalPredictions: predictiveAlerts.length,
            truePositives,
            falsePositives,
            accuracy: accuracy.toFixed(2) + '%'
        };
    }
}

module.exports = PredictiveAlertEngine;
