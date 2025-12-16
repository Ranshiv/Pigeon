// features/api-monitoring/alerting/EscalationEngine.js
const EscalationPolicy = require('../../../models/EscalationPolicy');
const OnCallSchedule = require('../../../models/OnCallSchedule');
const Incident = require('../../../models/Incident');
const Alert = require('../../../models/Alert');
const EventEmitter = require('events');

class EscalationEngine extends EventEmitter {
    constructor(options = {}) {
        super();
        this.checkInterval = options.checkInterval || 60000; // 1 minute
        this.notificationService = options.notificationService;
    }

    /**
     * Start escalation monitoring
     */
    start() {
        this.intervalId = setInterval(() => {
            this.checkEscalations().catch(error => {
                console.error('Error checking escalations:', error);
            });
        }, this.checkInterval);

        console.log('Escalation engine started');
    }

    /**
     * Stop escalation monitoring
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('Escalation engine stopped');
        }
    }

    /**
     * Check for incidents needing escalation
     */
    async checkEscalations() {
        const now = new Date();

        // Find incidents that need escalation
        const incidents = await Incident.find({
            status: { $in: ['open', 'acknowledged'] },
            nextEscalationAt: { $lte: now, $ne: null }
        }).populate('teamId');

        for (const incident of incidents) {
            try {
                await this.escalateIncident(incident);
            } catch (error) {
                console.error(`Error escalating incident ${incident._id}:`, error);
                this.emit('escalationError', { incident, error });
            }
        }
    }

    /**
     * Escalate an incident to the next level
     */
    async escalateIncident(incident, options = {}) {
        try {
            // Find applicable escalation policies
            const policies = await EscalationPolicy.findApplicablePolicies(incident);

            if (policies.length === 0) {
                console.warn(`No escalation policy found for incident ${incident._id}`);
                incident.nextEscalationAt = null;
                await incident.save();
                return null;
            }

            // Use the first applicable policy (can be enhanced to support multiple)
            const policy = policies[0];
            const currentLevel = incident.escalationLevel || 0;
            const nextLevel = policy.getNextLevel(currentLevel);

            if (!nextLevel) {
                // No more escalation levels
                console.log(`Incident ${incident._id} reached max escalation level`);
                incident.nextEscalationAt = null;

                // Handle fallback policy if configured
                if (policy.fallbackPolicy.enabled && policy.fallbackPolicy.policyId) {
                    await this.applyFallbackPolicy(incident, policy.fallbackPolicy.policyId);
                }

                await incident.save();
                return null;
            }

            // Escalate to next level
            incident.escalationLevel = nextLevel.level;

            // Add timeline entry
            incident.timeline.push({
                type: 'escalation',
                message: `Auto-escalated to ${nextLevel.name}`,
                at: new Date(),
                data: {
                    level: nextLevel.level,
                    policyId: policy._id,
                    reason: options.reason || 'Automatic escalation'
                }
            });

            // Calculate next escalation time
            const nextLevelAfter = policy.getNextLevel(nextLevel.level);
            if (nextLevelAfter) {
                incident.nextEscalationAt = policy.calculateNextEscalationTime(
                    nextLevel.level,
                    new Date()
                );
            } else {
                incident.nextEscalationAt = null;
            }

            // Notify escalation targets
            await this.notifyEscalationTargets(incident, nextLevel, policy);

            // Update policy statistics
            policy.statistics.totalEscalations++;
            policy.statistics.lastUsed = new Date();
            await policy.save();

            await incident.save();

            this.emit('incidentEscalated', {
                incident,
                policy,
                level: nextLevel.level,
                levelName: nextLevel.name
            });

            return {
                incident,
                newLevel: nextLevel.level,
                nextEscalationAt: incident.nextEscalationAt
            };
        } catch (error) {
            console.error('Error in escalateIncident:', error);
            throw error;
        }
    }

    /**
     * Notify escalation targets
     */
    async notifyEscalationTargets(incident, level, policy) {
        const notifications = [];

        for (const target of level.targets) {
            try {
                const notification = await this.sendEscalationNotification(
                    incident,
                    target,
                    level,
                    policy
                );
                notifications.push(notification);
            } catch (error) {
                console.error(`Error notifying target ${target.targetId}:`, error);
                notifications.push({
                    target,
                    success: false,
                    error: error.message
                });
            }
        }

        // Handle repeat notifications if configured
        if (level.repeatNotifications.enabled) {
            this.scheduleRepeatNotifications(incident, level, policy);
        }

        return notifications;
    }

    /**
     * Send notification to a specific target
     */
    async sendEscalationNotification(incident, target, level, policy) {
        let recipients = [];

        // Resolve target to actual users/channels
        switch (target.type) {
            case 'user':
                recipients = [{ type: 'user', id: target.targetId }];
                break;

            case 'team':
                const team = await this.resolveTeamMembers(target.targetId);
                recipients = team.map(userId => ({ type: 'user', id: userId }));
                break;

            case 'schedule':
                const onCallUser = await this.resolveOnCallUser(target.targetId);
                if (onCallUser) {
                    recipients = [{ type: 'user', id: onCallUser }];
                }
                break;

            case 'webhook':
                recipients = [{ type: 'webhook', url: target.webhookUrl }];
                break;
        }

        // Send notifications via configured channels
        const results = [];
        for (const recipient of recipients) {
            for (const channel of target.notificationChannels) {
                const result = await this.sendNotification(
                    recipient,
                    channel,
                    incident,
                    level,
                    policy
                );
                results.push(result);
            }
        }

        return {
            target,
            recipients,
            results,
            success: results.every(r => r.success)
        };
    }

    /**
     * Send notification via specific channel
     */
    async sendNotification(recipient, channel, incident, level, policy) {
        if (!this.notificationService) {
            console.warn('No notification service configured');
            return { success: false, error: 'No notification service' };
        }

        const message = this.buildEscalationMessage(incident, level, policy);

        try {
            // This would integrate with your notification service
            // For now, just emit an event
            this.emit('notificationSent', {
                recipient,
                channel,
                incident,
                level,
                message
            });

            return { success: true, channel, recipient };
        } catch (error) {
            return { success: false, channel, recipient, error: error.message };
        }
    }

    /**
     * Build escalation notification message
     */
    buildEscalationMessage(incident, level, policy) {
        return {
            subject: `🚨 Escalation: ${incident.title}`,
            body: `
Incident has been escalated to ${level.name}

Incident: ${incident.title}
Severity: ${incident.severity}
Status: ${incident.status}
Escalation Level: ${level.level}
Policy: ${policy.name}

Description:
${incident.description}

Time since creation: ${this.formatDuration(Date.now() - incident.createdAt)}

Please take action immediately.
            `.trim(),
            data: {
                incidentId: incident._id,
                escalationLevel: level.level,
                policyId: policy._id
            }
        };
    }

    /**
     * Resolve team members
     */
    async resolveTeamMembers(teamId) {
        const Team = require('../../../models/Team');
        const team = await Team.findById(teamId).populate('members');
        return team ? team.members.map(m => m._id) : [];
    }

    /**
     * Resolve on-call user from schedule
     */
    async resolveOnCallUser(scheduleId) {
        const schedule = await OnCallSchedule.findById(scheduleId);
        return schedule ? schedule.getCurrentOnCallUser() : null;
    }

    /**
     * Schedule repeat notifications
     */
    scheduleRepeatNotifications(incident, level, policy) {
        let repeatCount = 0;
        const maxRepeats = level.repeatNotifications.maxRepeats;
        const intervalMs = level.repeatNotifications.intervalMinutes * 60 * 1000;

        const repeatId = setInterval(async () => {
            repeatCount++;

            // Check if incident is still active
            const currentIncident = await Incident.findById(incident._id);
            if (!currentIncident || !['open', 'acknowledged'].includes(currentIncident.status)) {
                clearInterval(repeatId);
                return;
            }

            // Check if max repeats reached
            if (repeatCount >= maxRepeats) {
                clearInterval(repeatId);
                return;
            }

            // Send repeat notifications
            await this.notifyEscalationTargets(currentIncident, level, policy);

            this.emit('repeatNotificationSent', {
                incident: currentIncident,
                level,
                repeatCount
            });
        }, intervalMs);
    }

    /**
     * Apply fallback escalation policy
     */
    async applyFallbackPolicy(incident, fallbackPolicyId) {
        const fallbackPolicy = await EscalationPolicy.findById(fallbackPolicyId);

        if (!fallbackPolicy || !fallbackPolicy.enabled) {
            return;
        }

        // Reset escalation level and apply first level of fallback policy
        incident.escalationLevel = 0;
        const firstLevel = fallbackPolicy.getLevel(0);

        if (firstLevel) {
            await this.notifyEscalationTargets(incident, firstLevel, fallbackPolicy);

            const nextLevel = fallbackPolicy.getNextLevel(0);
            if (nextLevel) {
                incident.nextEscalationAt = fallbackPolicy.calculateNextEscalationTime(0, new Date());
            }

            incident.timeline.push({
                type: 'escalation',
                message: `Fallback policy applied: ${fallbackPolicy.name}`,
                at: new Date(),
                data: {
                    policyId: fallbackPolicy._id,
                    level: 0
                }
            });
        }
    }

    /**
     * Manually trigger escalation
     */
    async triggerManualEscalation(incidentId, userId, options = {}) {
        const incident = await Incident.findById(incidentId);

        if (!incident) {
            throw new Error('Incident not found');
        }

        // Add manual escalation to timeline
        incident.timeline.push({
            type: 'escalation',
            message: options.reason || 'Manual escalation',
            actor: userId,
            at: new Date(),
            data: {
                manual: true,
                targetLevel: options.targetLevel
            }
        });

        // If target level specified, jump to that level
        if (options.targetLevel !== undefined) {
            incident.escalationLevel = options.targetLevel - 1; // Will be incremented by escalateIncident
        }

        return await this.escalateIncident(incident, { reason: options.reason });
    }

    /**
     * Get escalation statistics
     */
    async getEscalationStatistics(filters = {}) {
        const pipeline = [
            {
                $match: {
                    'timeline.type': 'escalation',
                    ...filters
                }
            },
            {
                $project: {
                    escalationLevels: {
                        $filter: {
                            input: '$timeline',
                            as: 'entry',
                            cond: { $eq: ['$$entry.type', 'escalation'] }
                        }
                    },
                    severity: 1,
                    createdAt: 1,
                    resolvedAt: 1
                }
            },
            {
                $group: {
                    _id: '$severity',
                    totalEscalations: { $sum: { $size: '$escalationLevels' } },
                    incidents: { $sum: 1 },
                    avgEscalations: { $avg: { $size: '$escalationLevels' } }
                }
            }
        ];

        return Incident.aggregate(pipeline);
    }

    /**
     * Format duration in human-readable format
     */
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }
}

module.exports = EscalationEngine;
