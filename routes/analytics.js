// routes/analytics.js
const express = require('express');
const router = express.Router();
const AnalyticsService = require('../services/AnalyticsService');
const Analytics = require('../models/Analytics');
const Monitor = require('../models/Monitor');
const { ensureAuthenticated: auth } = require('../middleware/auth');

/**
 * @route   GET /api/analytics/dashboard/:monitorId
 * @desc    Get comprehensive analytics dashboard data
 * @access  Private
 */
router.get('/dashboard/:monitorId', auth, async (req, res) => {
    try {
        const { monitorId } = req.params;
        const { timeRange = '24h' } = req.query;

        // Verify monitor ownership
        const monitor = await Monitor.findById(monitorId);
        if (!monitor) {
            return res.status(404).json({ message: 'Monitor not found' });
        }

        if (monitor.userId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const dashboardData = await AnalyticsService.generateDashboard(monitorId, timeRange);

        res.json(dashboardData);
    } catch (error) {
        console.error('Error fetching dashboard:', error);
        res.status(500).json({
            message: 'Error fetching analytics dashboard',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/analytics/trends/:monitorId
 * @desc    Get trend analysis for a monitor
 * @access  Private
 */
router.get('/trends/:monitorId', auth, async (req, res) => {
    try {
        const { monitorId } = req.params;
        const { period = 'hourly', timeRange = '7d' } = req.query;

        const monitor = await Monitor.findById(monitorId);
        if (!monitor || monitor.userId.toString() !== req.user.id) {
            return res.status(404).json({ message: 'Monitor not found' });
        }

        const endDate = new Date();
        const startDate = new Date();

        // Set start date based on time range
        if (timeRange === '24h') startDate.setHours(startDate.getHours() - 24);
        else if (timeRange === '7d') startDate.setDate(startDate.getDate() - 7);
        else if (timeRange === '30d') startDate.setDate(startDate.getDate() - 30);
        else if (timeRange === '90d') startDate.setDate(startDate.getDate() - 90);

        const analytics = await Analytics.find({
            monitorId,
            aggregationPeriod: period,
            timestamp: { $gte: startDate, $lte: endDate }
        })
            .sort({ timestamp: 1 })
            .select('timestamp metrics trends');

        res.json({
            monitorId,
            period,
            timeRange,
            startDate,
            endDate,
            data: analytics
        });
    } catch (error) {
        console.error('Error fetching trends:', error);
        res.status(500).json({
            message: 'Error fetching trend data',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/analytics/anomalies/:monitorId
 * @desc    Get detected anomalies
 * @access  Private
 */
router.get('/anomalies/:monitorId', auth, async (req, res) => {
    try {
        const { monitorId } = req.params;
        const { severity, resolved = 'false', limit = 50 } = req.query;

        const monitor = await Monitor.findById(monitorId);
        if (!monitor || monitor.userId.toString() !== req.user.id) {
            return res.status(404).json({ message: 'Monitor not found' });
        }

        const query = { monitorId };

        // Filter by anomaly criteria
        if (resolved === 'false') {
            query['anomalies.resolved'] = false;
        }

        if (severity) {
            query['anomalies.severity'] = severity;
        }

        const analytics = await Analytics.find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .select('timestamp anomalies');

        // Flatten anomalies array
        const anomalies = analytics.flatMap(a =>
            a.anomalies
                .filter(an => {
                    if (resolved === 'false' && an.resolved) return false;
                    if (severity && an.severity !== severity) return false;
                    return true;
                })
                .map(an => ({
                    ...an.toObject(),
                    timestamp: a.timestamp
                }))
        );

        res.json({
            monitorId,
            filters: { severity, resolved },
            count: anomalies.length,
            anomalies
        });
    } catch (error) {
        console.error('Error fetching anomalies:', error);
        res.status(500).json({
            message: 'Error fetching anomalies',
            error: error.message
        });
    }
});

/**
 * @route   PATCH /api/analytics/anomalies/:monitorId/:anomalyId/resolve
 * @desc    Mark an anomaly as resolved
 * @access  Private
 */
router.patch('/anomalies/:monitorId/:timestamp/resolve', auth, async (req, res) => {
    try {
        const { monitorId, timestamp } = req.params;
        const { anomalyType } = req.body;

        const monitor = await Monitor.findById(monitorId);
        if (!monitor || monitor.userId.toString() !== req.user.id) {
            return res.status(404).json({ message: 'Monitor not found' });
        }

        const analytics = await Analytics.findOne({
            monitorId,
            timestamp: new Date(timestamp)
        });

        if (!analytics) {
            return res.status(404).json({ message: 'Analytics record not found' });
        }

        // Find and resolve the anomaly
        const anomaly = analytics.anomalies.find(a => a.type === anomalyType && !a.resolved);
        if (anomaly) {
            anomaly.resolved = true;
            await analytics.save();
        }

        res.json({
            message: 'Anomaly marked as resolved',
            anomaly
        });
    } catch (error) {
        console.error('Error resolving anomaly:', error);
        res.status(500).json({
            message: 'Error resolving anomaly',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/analytics/costs/:monitorId
 * @desc    Get cost analysis
 * @access  Private
 */
router.get('/costs/:monitorId', auth, async (req, res) => {
    try {
        const { monitorId } = req.params;
        const { timeRange = '30d' } = req.query;

        const monitor = await Monitor.findById(monitorId);
        if (!monitor || monitor.userId.toString() !== req.user.id) {
            return res.status(404).json({ message: 'Monitor not found' });
        }

        const endDate = new Date();
        const startDate = new Date();
        if (timeRange === '7d') startDate.setDate(startDate.getDate() - 7);
        else if (timeRange === '30d') startDate.setDate(startDate.getDate() - 30);
        else if (timeRange === '90d') startDate.setDate(startDate.getDate() - 90);

        const analytics = await Analytics.find({
            monitorId,
            timestamp: { $gte: startDate, $lte: endDate }
        })
            .sort({ timestamp: 1 })
            .select('timestamp metrics.costEstimate metrics.costPerRequest metrics.totalRequests');

        const totalCost = analytics.reduce((sum, a) => sum + a.metrics.costEstimate, 0);
        const totalRequests = analytics.reduce((sum, a) => sum + a.metrics.totalRequests, 0);
        const avgCostPerRequest = totalRequests > 0 ? totalCost / totalRequests : 0;

        // Project future cost based on trend
        const recentCosts = analytics.slice(-7).map(a => a.metrics.costEstimate);
        const avgRecentDailyCost = recentCosts.length > 0
            ? recentCosts.reduce((a, b) => a + b, 0) / recentCosts.length
            : 0;

        const projectedMonthlyCost = avgRecentDailyCost * 30;

        res.json({
            monitorId,
            timeRange,
            startDate,
            endDate,
            summary: {
                totalCost: totalCost.toFixed(4),
                totalRequests,
                avgCostPerRequest: avgCostPerRequest.toFixed(6),
                projectedMonthlyCost: projectedMonthlyCost.toFixed(2)
            },
            timeSeries: analytics.map(a => ({
                timestamp: a.timestamp,
                cost: a.metrics.costEstimate,
                requests: a.metrics.totalRequests,
                costPerRequest: a.metrics.costPerRequest
            }))
        });
    } catch (error) {
        console.error('Error fetching cost data:', error);
        res.status(500).json({
            message: 'Error fetching cost analysis',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/analytics/sla/:monitorId
 * @desc    Get SLA compliance tracking
 * @access  Private
 */
router.get('/sla/:monitorId', auth, async (req, res) => {
    try {
        const { monitorId } = req.params;
        const { timeRange = '30d' } = req.query;

        const monitor = await Monitor.findById(monitorId);
        if (!monitor || monitor.userId.toString() !== req.user.id) {
            return res.status(404).json({ message: 'Monitor not found' });
        }

        const endDate = new Date();
        const startDate = new Date();
        if (timeRange === '7d') startDate.setDate(startDate.getDate() - 7);
        else if (timeRange === '30d') startDate.setDate(startDate.getDate() - 30);
        else if (timeRange === '90d') startDate.setDate(startDate.getDate() - 90);

        const analytics = await Analytics.find({
            monitorId,
            timestamp: { $gte: startDate, $lte: endDate }
        })
            .sort({ timestamp: 1 })
            .select('timestamp metrics.slaCompliance metrics.slaBreaches metrics.uptimePercentage metrics.avgResponseTime');

        const avgCompliance = analytics.length > 0
            ? analytics.reduce((sum, a) => sum + a.metrics.slaCompliance, 0) / analytics.length
            : 100;

        const totalBreaches = analytics.reduce((sum, a) => sum + a.metrics.slaBreaches, 0);

        // Calculate compliance status
        let status = 'excellent';
        if (avgCompliance < 99) status = 'good';
        if (avgCompliance < 95) status = 'warning';
        if (avgCompliance < 90) status = 'critical';

        res.json({
            monitorId,
            timeRange,
            startDate,
            endDate,
            slaTargets: monitor.slaTargets || {},
            summary: {
                avgCompliance: avgCompliance.toFixed(2),
                totalBreaches,
                status
            },
            timeSeries: analytics.map(a => ({
                timestamp: a.timestamp,
                compliance: a.metrics.slaCompliance,
                breaches: a.metrics.slaBreaches,
                uptime: a.metrics.uptimePercentage,
                avgResponseTime: a.metrics.avgResponseTime
            }))
        });
    } catch (error) {
        console.error('Error fetching SLA data:', error);
        res.status(500).json({
            message: 'Error fetching SLA compliance',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/analytics/predictions/:monitorId
 * @desc    Get predictive analytics
 * @access  Private
 */
router.get('/predictions/:monitorId', auth, async (req, res) => {
    try {
        const { monitorId } = req.params;

        const monitor = await Monitor.findById(monitorId);
        if (!monitor || monitor.userId.toString() !== req.user.id) {
            return res.status(404).json({ message: 'Monitor not found' });
        }

        const latest = await Analytics.getLatest(monitorId, 'hourly');

        if (!latest || !latest.predictions) {
            return res.json({
                monitorId,
                predictions: null,
                message: 'Not enough data for predictions'
            });
        }

        res.json({
            monitorId,
            predictions: latest.predictions,
            calculatedAt: latest.predictions.calculatedAt,
            basedOnData: {
                period: latest.aggregationPeriod,
                timestamp: latest.timestamp
            }
        });
    } catch (error) {
        console.error('Error fetching predictions:', error);
        res.status(500).json({
            message: 'Error fetching predictions',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/analytics/compare
 * @desc    Compare multiple monitors, environments, or time periods
 * @access  Private
 */
router.post('/compare', auth, async (req, res) => {
    try {
        const { monitorIds, metricType = 'performance', timeRange = '24h' } = req.body;

        if (!monitorIds || !Array.isArray(monitorIds) || monitorIds.length < 2) {
            return res.status(400).json({
                message: 'Please provide at least 2 monitor IDs to compare'
            });
        }

        // Verify all monitors belong to the user
        const monitors = await Monitor.find({
            _id: { $in: monitorIds },
            userId: req.user.id
        });

        if (monitors.length !== monitorIds.length) {
            return res.status(403).json({
                message: 'Access denied to one or more monitors'
            });
        }

        const comparison = await AnalyticsService.compareMonitors(monitorIds, metricType, timeRange);

        res.json(comparison);
    } catch (error) {
        console.error('Error comparing monitors:', error);
        res.status(500).json({
            message: 'Error comparing monitors',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/analytics/export/:monitorId
 * @desc    Export analytics data
 * @access  Private
 */
router.get('/export/:monitorId', auth, async (req, res) => {
    try {
        const { monitorId } = req.params;
        const { format = 'json', timeRange = '30d' } = req.query;

        const monitor = await Monitor.findById(monitorId);
        if (!monitor || monitor.userId.toString() !== req.user.id) {
            return res.status(404).json({ message: 'Monitor not found' });
        }

        const data = await AnalyticsService.exportData(monitorId, format, timeRange);

        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=analytics-${monitorId}-${Date.now()}.csv`);
            return res.send(data);
        }

        res.json(data);
    } catch (error) {
        console.error('Error exporting data:', error);
        res.status(500).json({
            message: 'Error exporting analytics data',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/analytics/aggregate
 * @desc    Manually trigger analytics aggregation
 * @access  Private
 */
router.post('/aggregate', auth, async (req, res) => {
    try {
        const { monitorId, period = 'hourly' } = req.body;

        if (!monitorId) {
            return res.status(400).json({ message: 'Monitor ID is required' });
        }

        const monitor = await Monitor.findById(monitorId);
        if (!monitor || monitor.userId.toString() !== req.user.id) {
            return res.status(404).json({ message: 'Monitor not found' });
        }

        const result = await AnalyticsService.aggregateHealthCheckData(monitorId, period);

        if (!result) {
            return res.status(404).json({
                message: 'No health check data available for aggregation'
            });
        }

        res.json({
            message: 'Analytics aggregation completed',
            data: result
        });
    } catch (error) {
        console.error('Error triggering aggregation:', error);
        res.status(500).json({
            message: 'Error triggering aggregation',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/analytics/health-score/:monitorId
 * @desc    Get current health score
 * @access  Private
 */
router.get('/health-score/:monitorId', auth, async (req, res) => {
    try {
        const { monitorId } = req.params;

        const monitor = await Monitor.findById(monitorId);
        if (!monitor || monitor.userId.toString() !== req.user.id) {
            return res.status(404).json({ message: 'Monitor not found' });
        }

        const latest = await Analytics.getLatest(monitorId, 'hourly');

        if (!latest) {
            return res.json({
                monitorId,
                healthScore: 100,
                message: 'No analytics data available yet'
            });
        }

        res.json({
            monitorId,
            healthScore: latest.healthScore,
            timestamp: latest.timestamp,
            factors: {
                uptime: latest.metrics.uptimePercentage,
                errorRate: latest.metrics.errorRate,
                slaBreaches: latest.metrics.slaBreaches,
                criticalAnomalies: latest.criticalAnomaliesCount
            }
        });
    } catch (error) {
        console.error('Error fetching health score:', error);
        res.status(500).json({
            message: 'Error fetching health score',
            error: error.message
        });
    }
});

module.exports = router;
