// features/api-monitoring/alerting/AlertRouter.js
const AlertPolicy = require('../../../models/AlertPolicy');
const OnCallSchedule = require('../../../models/OnCallSchedule');
const Team = require('../../../models/Team');
const User = require('../../../models/User');
const EventEmitter = require('events');

class AlertRouter extends EventEmitter {
    constructor(options = {}) {
        super();
        this.notificationService = options.notificationService;
        this.defaultChannels = options.defaultChannels || ['email'];
    }

    /**
     * Route an alert to appropriate targets
     */
    async route(alert, policy = null) {
        try {
            // Find applicable policy if not provided
            if (!policy) {
                policy = await this.findApplicablePolicy(alert);
            }

            if (!policy) {
                console.warn(`No routing policy found for alert ${alert._id}`);
                return await this.useDefaultRouting(alert);
            }

            // Check if policy is active now
            if (!policy.isActiveNow()) {
                console.log(`Policy ${policy.name} is not active at this time`);
                return { routed: false, reason: 'Policy not active' };
            }

            // Check rate limiting
            const withinLimit = await policy.isWithinRateLimit();
            if (!withinLimit) {
                console.log(`Alert rate limit exceeded for policy ${policy.name}`);
                return { routed: false, reason: 'Rate limit exceeded' };
            }

            // Get routing targets based on severity
            const targets = await this.getRoutingTargets(alert, policy);

            // Send notifications to all targets
            const notifications = [];
            for (const target of targets) {
                const result = await this.notifyTarget(alert, target, policy);
                notifications.push(result);
            }

            // Update alert with routing information
            alert.notificationChannels = notifications.map(n => ({
                type: n.channel,
                target: n.target,
                sentAt: new Date(),
                success: n.success,
                error: n.error
            }));

            await alert.save();

            // Update policy statistics
            policy.statistics.totalAlerts++;
            policy.statistics.lastTriggered = new Date();
            await policy.save();

            this.emit('alertRouted', {
                alert,
                policy,
                targets,
                notifications
            });

            return {
                routed: true,
                targets,
                notifications,
                policy: policy.name
            };
        } catch (error) {
            console.error('Error routing alert:', error);
            throw error;
        }
    }

    /**
     * Find applicable policy for an alert
     */
    async findApplicablePolicy(alert) {
        const policies = await AlertPolicy.find({
            workspaceId: alert.monitorId?.workspaceId,
            enabled: true,
            $or: [
                { monitorIds: alert.monitorId },
                { monitorIds: { $size: 0 } }
            ]
        }).sort({ priority: 1 });

        // Return first matching policy
        for (const policy of policies) {
            if (await this.policyMatchesAlert(policy, alert)) {
                return policy;
            }
        }

        return null;
    }

    /**
     * Check if policy conditions match alert
     */
    async policyMatchesAlert(policy, alert) {
        // Check if policy applies to this monitor
        if (policy.monitorIds.length > 0 && 
            !policy.monitorIds.some(id => id.toString() === alert.monitorId?.toString())) {
            return false;
        }

        // Check maintenance windows
        if (policy.maintenance.respectMaintenanceWindows) {
            const inMaintenance = await this.checkMaintenanceWindow(alert);
            if (inMaintenance) {
                return false;
            }
        }

        return true;
    }

    /**
     * Check if monitor is in maintenance window
     */
    async checkMaintenanceWindow(alert) {
        // This would check against MaintenanceWindow model
        // For now, returning false
        return false;
    }

    /**
     * Get routing targets based on severity
     */
    async getRoutingTargets(alert, policy) {
        const targets = [];
        const severityRouting = policy.severityRouting[alert.severity] || [];

        // Add severity-based routing
        for (const route of severityRouting) {
            const resolvedTarget = await this.resolveTarget(route);
            if (resolvedTarget) {
                targets.push({
                    ...resolvedTarget,
                    priority: route.priority,
                    channels: route.notificationChannels || this.defaultChannels
                });
            }
        }

        // Add on-call routing if configured
        if (policy.teamId) {
            const onCallTargets = await this.getOnCallTargets(policy.teamId);
            targets.push(...onCallTargets);
        }

        // Sort by priority
        targets.sort((a, b) => (a.priority || 99) - (b.priority || 99));

        return targets;
    }

    /**
     * Resolve routing target to actual recipients
     */
    async resolveTarget(route) {
        switch (route.type) {
            case 'user':
                const user = await User.findById(route.targetId);
                return user ? {
                    type: 'user',
                    id: user._id,
                    email: user.email,
                    name: user.username
                } : null;

            case 'team':
                const team = await Team.findById(route.targetId).populate('members');
                return team ? {
                    type: 'team',
                    id: team._id,
                    name: team.name,
                    members: team.members.map(m => ({
                        id: m._id,
                        email: m.email,
                        name: m.username
                    }))
                } : null;

            case 'schedule':
                const schedule = await OnCallSchedule.findById(route.targetId);
                if (!schedule) return null;
                
                const onCallUserId = schedule.getCurrentOnCallUser();
                if (!onCallUserId) return null;

                const onCallUser = await User.findById(onCallUserId);
                return onCallUser ? {
                    type: 'schedule',
                    scheduleId: schedule._id,
                    scheduleName: schedule.name,
                    user: {
                        id: onCallUser._id,
                        email: onCallUser.email,
                        name: onCallUser.username
                    }
                } : null;

            case 'webhook':
                return {
                    type: 'webhook',
                    url: route.channel
                };

            case 'email':
                return {
                    type: 'email',
                    address: route.channel
                };

            case 'channel':
                return {
                    type: 'channel',
                    channelId: route.channel,
                    platform: route.metadata?.platform || 'slack'
                };

            default:
                return null;
        }
    }

    /**
     * Get on-call targets for a team
     */
    async getOnCallTargets(teamId) {
        const schedules = await OnCallSchedule.find({
            teamId,
            enabled: true
        });

        const targets = [];
        for (const schedule of schedules) {
            const userId = schedule.getCurrentOnCallUser();
            if (userId) {
                const user = await User.findById(userId);
                if (user) {
                    targets.push({
                        type: 'on-call',
                        scheduleId: schedule._id,
                        scheduleName: schedule.name,
                        user: {
                            id: user._id,
                            email: user.email,
                            name: user.username
                        },
                        priority: 0,
                        channels: ['email', 'sms', 'push']
                    });
                }
            }
        }

        return targets;
    }

    /**
     * Send notification to a target
     */
    async notifyTarget(alert, target, policy) {
        const notifications = [];

        // Get notification channels
        const channels = target.channels || this.defaultChannels;

        for (const channel of channels) {
            const notification = await this.sendNotification(
                alert,
                target,
                channel,
                policy
            );
            notifications.push(notification);
        }

        return {
            target: target.type,
            targetId: target.id,
            channels,
            notifications,
            success: notifications.every(n => n.success)
        };
    }

    /**
     * Send notification via specific channel
     */
    async sendNotification(alert, target, channel, policy) {
        try {
            const message = this.buildAlertMessage(alert, target, policy);

            // Emit event for notification (to be handled by notification service)
            this.emit('sendNotification', {
                alert,
                target,
                channel,
                message
            });

            // This would integrate with actual notification service
            if (this.notificationService) {
                await this.notificationService.send(channel, target, message);
            }

            return {
                channel,
                target: this.getTargetIdentifier(target, channel),
                success: true,
                sentAt: new Date()
            };
        } catch (error) {
            console.error(`Error sending ${channel} notification:`, error);
            return {
                channel,
                target: this.getTargetIdentifier(target, channel),
                success: false,
                error: error.message,
                sentAt: new Date()
            };
        }
    }

    /**
     * Build alert notification message
     */
    buildAlertMessage(alert, target, policy) {
        const severityEmojis = {
            critical: '🔴',
            high: '🟠',
            medium: '🟡',
            low: '🔵',
            info: '⚪'
        };

        return {
            subject: `${severityEmojis[alert.severity]} ${alert.title}`,
            body: `
${alert.isPredictive ? '📊 PREDICTIVE ALERT' : '⚠️ ALERT'}

Monitor: ${alert.monitorId?.name || 'Unknown'}
Severity: ${alert.severity.toUpperCase()}
Status: ${alert.status}

Description:
${alert.description}

${alert.isPredictive ? `
Prediction Details:
- Current Value: ${alert.predictionData?.currentValue || 'N/A'}
- Projected Value: ${alert.predictionData?.projectedValue || 'N/A'}
- Confidence: ${(alert.predictionData?.confidence * 100)?.toFixed(0) || 0}%
- Trend: ${alert.predictionData?.trend || 'N/A'}
` : ''}

Triggered: ${alert.triggeredAt.toISOString()}
Policy: ${policy?.name || 'Default'}

${this.getActionLinks(alert)}
            `.trim(),
            data: {
                alertId: alert._id,
                monitorId: alert.monitorId,
                severity: alert.severity,
                isPredictive: alert.isPredictive,
                triggeredAt: alert.triggeredAt
            }
        };
    }

    /**
     * Get action links for alert
     */
    getActionLinks(alert) {
        const baseUrl = process.env.APP_URL || 'http://localhost:3000';
        return `
Actions:
- View Alert: ${baseUrl}/alerts/${alert._id}
- Acknowledge: ${baseUrl}/alerts/${alert._id}/acknowledge
- Snooze: ${baseUrl}/alerts/${alert._id}/snooze
        `.trim();
    }

    /**
     * Get target identifier for notification
     */
    getTargetIdentifier(target, channel) {
        switch (channel) {
            case 'email':
                return target.email || target.user?.email || target.address;
            case 'sms':
                return target.phone || target.user?.phone;
            case 'slack':
            case 'msteams':
                return target.channelId || target.channel;
            case 'webhook':
                return target.url;
            default:
                return target.id || target.user?.id;
        }
    }

    /**
     * Use default routing when no policy found
     */
    async useDefaultRouting(alert) {
        // Route to monitor owner or workspace admin
        const targets = [];

        if (alert.monitorId?.userId) {
            const user = await User.findById(alert.monitorId.userId);
            if (user) {
                targets.push({
                    type: 'user',
                    id: user._id,
                    email: user.email,
                    name: user.username,
                    channels: ['email']
                });
            }
        }

        if (targets.length === 0) {
            return { routed: false, reason: 'No default targets found' };
        }

        const notifications = [];
        for (const target of targets) {
            const result = await this.notifyTarget(alert, target, null);
            notifications.push(result);
        }

        return {
            routed: true,
            targets,
            notifications,
            policy: 'default'
        };
    }

    /**
     * Get routing statistics
     */
    async getRoutingStatistics(filters = {}) {
        const Alert = require('../../../models/Alert');
        
        const pipeline = [
            { $match: filters },
            { $unwind: '$notificationChannels' },
            {
                $group: {
                    _id: '$notificationChannels.type',
                    total: { $sum: 1 },
                    successful: {
                        $sum: { $cond: ['$notificationChannels.success', 1, 0] }
                    },
                    failed: {
                        $sum: { $cond: ['$notificationChannels.success', 0, 1] }
                    }
                }
            }
        ];

        return Alert.aggregate(pipeline);
    }

    /**
     * Batch route multiple alerts
     */
    async batchRoute(alerts) {
        const results = [];
        
        for (const alert of alerts) {
            try {
                const result = await this.route(alert);
                results.push({ alertId: alert._id, result });
            } catch (error) {
                results.push({ alertId: alert._id, error: error.message });
            }
        }

        return results;
    }
}

module.exports = AlertRouter;
