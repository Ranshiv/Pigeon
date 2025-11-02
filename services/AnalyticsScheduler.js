// services/AnalyticsScheduler.js
const cron = require('node-cron');
const AnalyticsService = require('./AnalyticsService');
const Workspace = require('../models/Workspace');

class AnalyticsScheduler {
    constructor() {
        this.jobs = new Map();
        this.isRunning = false;
    }

    /**
     * Start the analytics scheduler
     */
    start() {
        if (this.isRunning) {
            console.log('Analytics scheduler is already running');
            return;
        }

        console.log('Starting Analytics Scheduler...');
        this.isRunning = true;

        // Aggregate metrics every 5 minutes
        this.jobs.set('metrics-aggregation', cron.schedule('*/5 * * * *', async () => {
            await this.aggregateAllWorkspaceMetrics('5m');
        }));

        // Aggregate hourly metrics every hour
        this.jobs.set('hourly-aggregation', cron.schedule('0 * * * *', async () => {
            await this.aggregateAllWorkspaceMetrics('1h');
        }));

        // Aggregate daily metrics at midnight
        this.jobs.set('daily-aggregation', cron.schedule('0 0 * * *', async () => {
            await this.aggregateAllWorkspaceMetrics('1d');
        }));

        // Detect anomalies every 15 minutes
        this.jobs.set('anomaly-detection', cron.schedule('*/15 * * * *', async () => {
            await this.detectAllWorkspaceAnomalies();
        }));

        // Calculate SLA compliance hourly
        this.jobs.set('sla-calculation', cron.schedule('30 * * * *', async () => {
            await this.calculateAllSLACompliance();
        }));

        console.log('Analytics scheduler started successfully');
    }

    /**
     * Stop the analytics scheduler
     */
    stop() {
        if (!this.isRunning) {
            console.log('Analytics scheduler is not running');
            return;
        }

        console.log('Stopping Analytics Scheduler...');

        this.jobs.forEach((job, name) => {
            job.destroy();
            console.log(`Stopped job: ${name}`);
        });

        this.jobs.clear();
        this.isRunning = false;

        console.log('Analytics scheduler stopped');
    }

    /**
     * Aggregate metrics for all workspaces
     */
    async aggregateAllWorkspaceMetrics(interval) {
        try {
            console.log(`Running ${interval} metrics aggregation for all workspaces...`);

            const workspaces = await Workspace.find({ isActive: true }).lean();
            const endDate = new Date();
            const startDate = new Date(endDate.getTime() - this.getIntervalMillis(interval));

            let totalAggregated = 0;

            for (const workspace of workspaces) {
                try {
                    const metrics = await AnalyticsService.aggregateMetrics(
                        workspace._id.toString(),
                        startDate,
                        endDate,
                        interval
                    );
                    totalAggregated += metrics.length;
                } catch (error) {
                    console.error(`Error aggregating metrics for workspace ${workspace._id}:`, error.message);
                }
            }

            console.log(`Completed ${interval} aggregation: ${totalAggregated} metrics across ${workspaces.length} workspaces`);
        } catch (error) {
            console.error('Error in metrics aggregation job:', error);
        }
    }

    /**
     * Detect anomalies for all workspaces
     */
    async detectAllWorkspaceAnomalies() {
        try {
            console.log('Running anomaly detection for all workspaces...');

            const workspaces = await Workspace.find({ isActive: true }).lean();
            let totalAnomalies = 0;

            for (const workspace of workspaces) {
                try {
                    const anomalies = await AnalyticsService.detectAnomalies(
                        workspace._id.toString(),
                        {
                            startDate: new Date(Date.now() - 60 * 60 * 1000), // Last hour
                            endDate: new Date(),
                            sensitivity: 2.5,
                            baselinePeriod: 7
                        }
                    );
                    totalAnomalies += anomalies.length;

                    if (anomalies.length > 0) {
                        console.log(`Detected ${anomalies.length} anomalies for workspace ${workspace._id}`);
                    }
                } catch (error) {
                    console.error(`Error detecting anomalies for workspace ${workspace._id}:`, error.message);
                }
            }

            console.log(`Completed anomaly detection: ${totalAnomalies} anomalies detected`);
        } catch (error) {
            console.error('Error in anomaly detection job:', error);
        }
    }

    /**
     * Calculate SLA compliance for all active SLA configs
     */
    async calculateAllSLACompliance() {
        try {
            console.log('Calculating SLA compliance for all configurations...');

            const AnalyticsSLAConfig = require('../models/AnalyticsSLAConfig');
            const slaConfigs = await AnalyticsSLAConfig.find({ isActive: true }).lean();

            let totalCalculated = 0;

            for (const slaConfig of slaConfigs) {
                try {
                    await AnalyticsService.calculateSLACompliance(
                        slaConfig._id.toString(),
                        slaConfig.measurementPeriod
                    );
                    totalCalculated++;
                } catch (error) {
                    console.error(`Error calculating SLA compliance for ${slaConfig._id}:`, error.message);
                }
            }

            console.log(`Completed SLA calculation: ${totalCalculated} configurations processed`);
        } catch (error) {
            console.error('Error in SLA calculation job:', error);
        }
    }

    /**
     * Get interval in milliseconds
     */
    getIntervalMillis(interval) {
        switch (interval) {
            case '1m':
                return 60000;
            case '5m':
                return 300000;
            case '15m':
                return 900000;
            case '1h':
                return 3600000;
            case '1d':
                return 86400000;
            default:
                return 300000; // Default 5 minutes
        }
    }

    /**
     * Get scheduler status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            activeJobs: Array.from(this.jobs.keys()),
            jobCount: this.jobs.size
        };
    }

    /**
     * Manually trigger a specific job
     */
    async triggerJob(jobName) {
        console.log(`Manually triggering job: ${jobName}`);

        switch (jobName) {
            case 'metrics-aggregation':
                await this.aggregateAllWorkspaceMetrics('5m');
                break;
            case 'hourly-aggregation':
                await this.aggregateAllWorkspaceMetrics('1h');
                break;
            case 'daily-aggregation':
                await this.aggregateAllWorkspaceMetrics('1d');
                break;
            case 'anomaly-detection':
                await this.detectAllWorkspaceAnomalies();
                break;
            case 'sla-calculation':
                await this.calculateAllSLACompliance();
                break;
            default:
                throw new Error(`Unknown job: ${jobName}`);
        }

        console.log(`Completed manual trigger of: ${jobName}`);
    }
}

module.exports = new AnalyticsScheduler();
