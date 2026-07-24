// services/monitoring/MonitoringService.js
const cron = require('node-cron');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const Monitor = require('../../models/Monitor');
const HealthCheck = require('../../models/HealthCheck');
const AlertPolicy = require('../../models/AlertPolicy');
const EmailService = require('../EmailService');
const IntegrationService = require('../IntegrationService');
const { emitToWorkspaceMembers, emitWorkspaceNotification } = require('../../utils/socket/socket-server');

class MonitoringService {
    constructor() {
        this.activeJobs = new Map();
        this.isRunning = false;
        this.emailService = new EmailService();
        this.integrationService = new IntegrationService();

        // Rate limiting for alerts
        this.alertRateLimit = new Map(); // integrationId -> { count, resetTime, lastAlert }
        this.maxAlertsPerHour = 10;
        this.alertCooldown = 5 * 60 * 1000; // 5 minutes cooldown between duplicate alerts
    }

    // Start the monitoring service
    start() {
        if (this.isRunning) {
            console.log('Monitoring service is already running');
            return;
        }

        console.log('Starting API Monitoring Service...');
        this.isRunning = true;
        this.startTime = Date.now();

        // Schedule health checks every 30 seconds instead of every minute
        // This reduces database query frequency while maintaining responsiveness
        this.schedulerJob = cron.schedule('*/30 * * * * *', async () => {
            await this.runScheduledChecks();
        }, {
            scheduled: true
        });

        // Cleanup old health checks daily at 2 AM
        this.cleanupJob = cron.schedule('0 2 * * *', async () => {
            await this.cleanupOldHealthChecks();
        }, {
            scheduled: true
        });

        console.log('Monitoring service started successfully');
    }

    // Stop the monitoring service
    stop() {
        if (!this.isRunning) {
            console.log('Monitoring service is not running');
            return;
        }

        console.log('Stopping API Monitoring Service...');

        if (this.schedulerJob) {
            this.schedulerJob.destroy();
        }

        if (this.cleanupJob) {
            this.cleanupJob.destroy();
        }

        this.activeJobs.clear();
        this.isRunning = false;

        console.log('Monitoring service stopped');
    }

    // Run scheduled health checks
    async runScheduledChecks() {
        try {
            const now = new Date();
            const monitorsToCheck = await Monitor.find({
                isActive: true,
                nextCheck: { $lte: now }
            }).limit(10); // Limit concurrent checks to prevent overload

            console.log(`Found ${monitorsToCheck.length} monitors to check`);

            if (monitorsToCheck.length === 0) {
                return; // Early return if no monitors to check
            }

            // Process monitors in batches to prevent overwhelming the system
            const batchSize = 3;
            for (let i = 0; i < monitorsToCheck.length; i += batchSize) {
                const batch = monitorsToCheck.slice(i, i + batchSize);

                // Run batch in parallel but limit concurrency
                const batchPromises = batch.map(monitor =>
                    this.performHealthCheck(monitor).catch(err => {
                        console.error(`Error checking monitor ${monitor._id}:`, err);
                        return null; // Continue with other monitors
                    })
                );

                await Promise.all(batchPromises);

                // Small delay between batches to prevent overwhelming
                if (i + batchSize < monitorsToCheck.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
        } catch (error) {
            console.error('Error in runScheduledChecks:', error);
        }
    }

    // Perform a single health check
    async performHealthCheck(monitor) {
        const startTime = Date.now();
        let healthCheck = {
            monitorId: monitor._id,
            checkedAt: new Date(),
            status: 'failure',
            responseTime: 0,
            errorMessage: null,
            statusCode: null,
            responseHeaders: {},
            responseBody: null
        };

        try {
            // Prepare fetch options
            const options = {
                method: monitor.method,
                timeout: monitor.expectedResponseTime || 30000,
                headers: {}
            };

            // Add custom headers
            if (monitor.headers && monitor.headers.length > 0) {
                monitor.headers.forEach(header => {
                    if (header.key && header.value) {
                        options.headers[header.key] = header.value;
                    }
                });
            }

            // Add body for POST/PUT/PATCH requests
            if (['POST', 'PUT', 'PATCH'].includes(monitor.method) && monitor.body) {
                options.body = monitor.body;
                if (!options.headers['Content-Type']) {
                    options.headers['Content-Type'] = 'application/json';
                }
            }

            // Perform the HTTP request
            const response = await fetch(monitor.url, options);
            const endTime = Date.now();
            const responseTime = endTime - startTime;

            // Get response details
            const responseHeaders = {};
            response.headers.forEach((value, key) => {
                responseHeaders[key] = value;
            });

            let responseBody = '';
            try {
                responseBody = await response.text();
                // Limit response body size for storage
                if (responseBody.length > 10000) {
                    responseBody = responseBody.substring(0, 10000) + '... [truncated]';
                }
            } catch (e) {
                responseBody = 'Failed to read response body';
            }

            // Update health check data
            healthCheck = {
                ...healthCheck,
                responseTime,
                statusCode: response.status,
                responseHeaders,
                responseBody,
                status: this.determineStatus(response.status, responseTime, monitor),
                errorMessage: response.ok ? null : `HTTP ${response.status}: ${response.statusText}`
            };

        } catch (error) {
            const endTime = Date.now();
            healthCheck = {
                ...healthCheck,
                responseTime: endTime - startTime,
                errorMessage: error.message,
                status: error.name === 'AbortError' ? 'timeout' : 'failure'
            };
        }

        // Save health check result
        const savedHealthCheck = await HealthCheck.create(healthCheck);

        // Update monitor statistics
        await this.updateMonitorStats(monitor, healthCheck);

        // Send alerts if necessary
        await this.checkAndSendAlerts(monitor, healthCheck);

        // Emit real-time update via socket
        this.emitHealthCheckUpdate(monitor, healthCheck);

        return savedHealthCheck;
    }

    // Determine status based on response
    determineStatus(statusCode, responseTime, monitor) {
        if (statusCode !== monitor.expectedStatusCode) {
            return 'failure';
        }

        if (responseTime > monitor.expectedResponseTime) {
            return 'timeout';
        }

        return 'success';
    }

    // Update monitor statistics
    async updateMonitorStats(monitor, healthCheck) {
        const isFailure = healthCheck.status !== 'success';

        const updateData = {
            lastChecked: healthCheck.checkedAt,
            nextCheck: new Date(Date.now() + (monitor.interval * 60 * 1000)),
            currentStatus: this.mapHealthCheckStatusToMonitorStatus(healthCheck.status),
            totalChecks: monitor.totalChecks + 1,
            consecutiveFailures: isFailure ? monitor.consecutiveFailures + 1 : 0
        };

        if (isFailure) {
            updateData.totalFailures = monitor.totalFailures + 1;
        }

        // Update average response time
        const newTotalTime = (monitor.averageResponseTime * monitor.totalChecks) + healthCheck.responseTime;
        updateData.averageResponseTime = Math.round(newTotalTime / updateData.totalChecks);

        await Monitor.findByIdAndUpdate(monitor._id, updateData);
    }

    // Map health check status to monitor status
    mapHealthCheckStatusToMonitorStatus(healthCheckStatus) {
        switch (healthCheckStatus) {
            case 'success':
                return 'up';
            case 'timeout':
                return 'degraded';
            case 'failure':
                return 'down';
            default:
                return 'unknown';
        }
    }

    // Check and send alerts with rate limiting
    async checkAndSendAlerts(monitor, healthCheck) {
        try {
            const shouldAlert = this.shouldSendAlert(monitor, healthCheck);

            // Allow alert policies to enable email channel even if monitor-level email is off.
            // This makes the "Email" option in the Alert Policy editor functional.
            const policyEmailEnabled = shouldAlert ? await this.isPolicyEmailEnabled(monitor) : false;

            if (shouldAlert) {
                const alertSettings = monitor.alertSettings || {};
                const alertData = {
                    monitor,
                    healthCheck,
                    alertType: this.getAlertType(monitor, healthCheck)
                };

                let alertResults = {
                    email: { attempted: false, success: false },
                    webhook: { attempted: false, success: false },
                    slack: { attempted: false, success: false },
                    integrations: { attempted: false, success: false }
                };

                // Send email alert with error handling
                if (alertSettings.emailEnabled !== false || policyEmailEnabled) {
                    alertResults.email.attempted = true;
                    try {
                        const emailResult = await this.emailService.sendMonitorAlert(alertData);
                        alertResults.email.success = emailResult?.success || emailResult?.skipped || false;

                        if (emailResult?.skipped) {
                            console.warn(`📧 Email alert skipped for ${monitor.name}: ${emailResult.reason || 'unknown reason'}`);
                        }

                        if (emailResult?.requiresAction) {
                            console.warn('⚠️  Email alerts require configuration. Continuing with other alert methods...');
                            if (emailResult?.error) {
                                console.warn(`   ↳ ${emailResult.error}`);
                            }
                        }
                    } catch (error) {
                        console.error('❌ Email alert failed (non-fatal):', error.message);
                        alertResults.email.error = error.message;
                    }
                }

                // Send webhook alert with error handling
                if (alertSettings.webhookUrl) {
                    alertResults.webhook.attempted = true;
                    try {
                        await this.sendWebhookAlert(alertSettings.webhookUrl, alertData);
                        alertResults.webhook.success = true;
                    } catch (error) {
                        console.error('❌ Webhook alert failed (non-fatal):', error.message);
                        alertResults.webhook.error = error.message;
                    }
                }

                // Send Slack alert with error handling
                if (alertSettings.slackWebhook) {
                    alertResults.slack.attempted = true;
                    try {
                        await this.sendSlackAlert(alertSettings.slackWebhook, alertData);
                        alertResults.slack.success = true;
                    } catch (error) {
                        console.error('❌ Slack alert failed (non-fatal):', error.message);
                        alertResults.slack.error = error.message;
                    }
                }

                // Send integration alerts with rate limiting and error handling
                alertResults.integrations.attempted = true;
                try {
                    await this.sendIntegrationAlerts(monitor, alertData);
                    alertResults.integrations.success = true;
                } catch (error) {
                    console.error('❌ Integration alerts failed (non-fatal):', error.message);
                    alertResults.integrations.error = error.message;
                }

                // Log alert summary
                const successfulAlerts = Object.values(alertResults).filter(r => r.success).length;
                const attemptedAlerts = Object.values(alertResults).filter(r => r.attempted).length;

                if (successfulAlerts > 0) {
                    console.log(`✅ Sent ${successfulAlerts}/${attemptedAlerts} alerts for ${monitor.name}`);
                } else if (attemptedAlerts > 0) {
                    console.warn(`⚠️  All ${attemptedAlerts} alert methods failed for ${monitor.name}`);
                } else {
                    console.log(`ℹ️  No alert methods configured for ${monitor.name}`);
                }

                // Mark alert as sent even if some methods failed (at least attempted)
                if (attemptedAlerts > 0) {
                    await HealthCheck.findByIdAndUpdate(healthCheck._id || healthCheck.monitorId, {
                        alertSent: true,
                        alertResults: alertResults
                    });
                }
            }
        } catch (error) {
            console.error('❌ Critical error in alert system:', error);
            // Don't throw - we want monitoring to continue even if alerts fail
        }
    }

    async isPolicyEmailEnabled(monitor) {
        try {
            if (!monitor?._id || !monitor?.userId) return false;

            // Some deployments may not have Alert model registered yet; register it defensively.
            // (Used by policy utilities elsewhere; safe to require here.)
            try {
                require('../../models/Alert');
            } catch {
                // Ignore registration errors; we don't rely on it here.
            }

            const query = {
                createdBy: monitor.userId,
                enabled: true,
                $or: [
                    { monitorIds: monitor._id },
                    { monitorIds: { $size: 0 } }
                ]
            };

            const policies = await AlertPolicy.find(query)
                .select('enabled schedule notificationChannels')
                .sort({ createdAt: -1 });

            for (const policy of policies) {
                if (typeof policy.isActiveNow === 'function' && !policy.isActiveNow()) continue;

                const channels = Array.isArray(policy.notificationChannels) ? policy.notificationChannels : [];
                const emailChannel = channels.find((c) => c && c.type === 'email');
                if (emailChannel && emailChannel.enabled !== false) {
                    return true;
                }
            }

            return false;
        } catch (error) {
            console.error('Error checking policy email enablement:', error.message);
            return false;
        }
    }

    // Send alerts to configured integrations with rate limiting
    async sendIntegrationAlerts(monitor, alertData) {
        try {
            // Get active integrations for the workspace
            const Integration = require('../../models/Integration');
            const integrations = await Integration.find({
                workspaceId: monitor.workspaceId,
                isActive: true,
                'configuration.enabledEvents': {
                    $in: [
                        'monitor_down',
                        'monitor_up',
                        'monitor_degraded'
                    ]
                }
            });

            const alertPromises = integrations.map(async (integration) => {
                // Check rate limits
                if (!this.canSendAlert(integration._id, alertData)) {
                    console.log(`Rate limit exceeded for integration ${integration.name} (${integration.type})`);
                    return;
                }

                try {
                    await this.integrationService.sendAlertWithRetry(integration, alertData);
                    this.updateAlertRateLimit(integration._id);
                } catch (error) {
                    console.error(`Failed to send alert via ${integration.type}:`, error);
                }
            });

            await Promise.allSettled(alertPromises);
        } catch (error) {
            console.error('Error sending integration alerts:', error);
        }
    }

    // Check if alert can be sent based on rate limits
    canSendAlert(integrationId, alertData) {
        const now = Date.now();
        const rateInfo = this.alertRateLimit.get(integrationId.toString());

        if (!rateInfo) {
            return true; // No previous alerts, allow
        }

        // Reset hourly counter if needed
        if (now > rateInfo.resetTime) {
            rateInfo.count = 0;
            rateInfo.resetTime = now + (60 * 60 * 1000); // Reset in 1 hour
        }

        // Check hourly limit
        if (rateInfo.count >= this.maxAlertsPerHour) {
            return false;
        }

        // Check cooldown for duplicate alerts
        if (rateInfo.lastAlert &&
            (now - rateInfo.lastAlert) < this.alertCooldown &&
            rateInfo.lastAlertType === alertData.alertType) {
            return false;
        }

        return true;
    }

    // Update rate limit tracking
    updateAlertRateLimit(integrationId) {
        const now = Date.now();
        const key = integrationId.toString();
        const existing = this.alertRateLimit.get(key) || {
            count: 0,
            resetTime: now + (60 * 60 * 1000)
        };

        this.alertRateLimit.set(key, {
            count: existing.count + 1,
            resetTime: existing.resetTime,
            lastAlert: now,
            lastAlertType: 'monitor_alert'
        });
    }

    // Determine if alert should be sent
    shouldSendAlert(monitor, healthCheck) {
        // Backwards compatibility: older monitor docs may not have alertSettings.
        // Apply safe defaults so alerts still work.
        const alertSettings = monitor.alertSettings || {};
        const alertOnFailure = alertSettings.alertOnFailure !== false;
        const alertOnSlowResponse = alertSettings.alertOnSlowResponse !== false;
        const alertOnRecovery = alertSettings.alertOnRecovery !== false;

        // Alert on failure
        if (alertOnFailure && healthCheck.status === 'failure') {
            return true;
        }

        // Alert on slow response
        if (alertOnSlowResponse && healthCheck.status === 'timeout') {
            return true;
        }

        // Alert on recovery (first success after failures)
        if (alertOnRecovery &&
            healthCheck.status === 'success' &&
            monitor.consecutiveFailures > 0) {
            return true;
        }

        return false;
    }

    // Get alert type
    getAlertType(monitor, healthCheck) {
        if (healthCheck.status === 'success' && monitor.consecutiveFailures > 0) {
            return 'recovery';
        } else if (healthCheck.status === 'timeout') {
            return 'slow_response';
        } else if (healthCheck.status === 'failure') {
            return 'failure';
        }
        return 'unknown';
    }

    // Send webhook alert
    async sendWebhookAlert(webhookUrl, alertData) {
        try {
            await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: 'monitor_alert',
                    timestamp: new Date().toISOString(),
                    monitor: {
                        id: alertData.monitor._id,
                        name: alertData.monitor.name,
                        url: alertData.monitor.url,
                        status: alertData.monitor.currentStatus
                    },
                    healthCheck: {
                        status: alertData.healthCheck.status,
                        responseTime: alertData.healthCheck.responseTime,
                        statusCode: alertData.healthCheck.statusCode,
                        errorMessage: alertData.healthCheck.errorMessage
                    },
                    alertType: alertData.alertType
                })
            });
        } catch (error) {
            console.error('Failed to send webhook alert:', error);
        }
    }

    // Send Slack alert
    async sendSlackAlert(slackWebhook, alertData) {
        try {
            const { monitor, healthCheck, alertType } = alertData;
            const color = alertType === 'recovery' ? 'good' :
                alertType === 'slow_response' ? 'warning' : 'danger';

            const message = {
                text: `Monitor Alert: ${monitor.name}`,
                attachments: [{
                    color,
                    fields: [
                        {
                            title: 'Monitor',
                            value: monitor.name,
                            short: true
                        },
                        {
                            title: 'URL',
                            value: monitor.url,
                            short: true
                        },
                        {
                            title: 'Status',
                            value: healthCheck.status.toUpperCase(),
                            short: true
                        },
                        {
                            title: 'Response Time',
                            value: `${healthCheck.responseTime}ms`,
                            short: true
                        }
                    ],
                    footer: 'Pigeon API Monitor',
                    ts: Math.floor(Date.now() / 1000)
                }]
            };

            if (healthCheck.errorMessage) {
                message.attachments[0].fields.push({
                    title: 'Error',
                    value: healthCheck.errorMessage,
                    short: false
                });
            }

            await fetch(slackWebhook, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(message)
            });
        } catch (error) {
            console.error('Failed to send Slack alert:', error);
        }
    }

    // Emit real-time updates via socket
    emitHealthCheckUpdate(monitor, healthCheck) {
        try {
            const nextStatus = this.mapHealthCheckStatusToMonitorStatus(healthCheck.status);
            void emitToWorkspaceMembers(monitor.workspaceId, 'monitor_update', {
                monitorId: monitor._id,
                monitorName: monitor.name,
                status: healthCheck.status,
                responseTime: healthCheck.responseTime,
                timestamp: healthCheck.checkedAt,
                currentStatus: nextStatus
            });
            if (monitor.currentStatus !== nextStatus) {
                emitWorkspaceNotification(monitor.workspaceId, {
                    type: 'monitor_status',
                    category: 'monitoring',
                    severity: nextStatus === 'down' ? 'error' : nextStatus === 'degraded' ? 'warning' : 'info',
                    message: `${monitor.name} is now ${nextStatus}`
                });
            }
            console.log(`Emitted monitor update for ${monitor.name}: ${healthCheck.status}`);
        } catch (error) {
            console.error('Failed to emit socket update:', error);
        }
    }

    // Cleanup old health checks
    async cleanupOldHealthChecks() {
        try {
            const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
            const result = await HealthCheck.deleteMany({
                checkedAt: { $lt: thirtyDaysAgo }
            });
            console.log(`Cleaned up ${result.deletedCount} old health check records`);
        } catch (error) {
            console.error('Error cleaning up old health checks:', error);
        }
    }

    // Manual health check trigger
    async runManualCheck(monitorId) {
        try {
            const monitor = await Monitor.findById(monitorId);
            if (!monitor) {
                throw new Error('Monitor not found');
            }

            return await this.performHealthCheck(monitor);
        } catch (error) {
            console.error('Error in manual health check:', error);
            throw error;
        }
    }

    // Get service status
    getStatus() {
        return {
            isRunning: this.isRunning,
            activeJobs: this.activeJobs.size,
            uptime: this.isRunning ? Date.now() - this.startTime : 0
        };
    }
}

module.exports = new MonitoringService();
