// services/IncidentManagementService.js
const Incident = require('../models/Incident');
const Alert = require('../models/Alert');
const User = require('../models/User');
const Team = require('../models/Team');
const cron = require('node-cron');
const EventEmitter = require('events');

class IncidentManagementService extends EventEmitter {
    constructor() {
        super();
        this.correlationWindow = 10 * 60 * 1000; // 10 minutes
        this.correlationCache = new Map();
        this.mttrCache = new Map();

        // Start background tasks
        this.startEscalationMonitoring();
        this.startMetricsCalculation();
    }

    /**
     * Create incident from alert(s)
     */
    async createIncident(data, userId) {
        try {
            const severity = ['critical', 'high', 'medium', 'low', 'info'].includes(data.severity)
                ? data.severity
                : 'medium';
            const status = ['open', 'acknowledged', 'monitoring', 'snoozed', 'resolved', 'closed'].includes(data.status)
                ? data.status
                : 'open';

            const incident = new Incident({
                title: data.title,
                description: data.description,
                severity,
                priority: this.determinePriority(severity),
                workspaceId: data.workspaceId,
                teamId: data.teamId,
                status,
                detection: data.detection || 'manual',
                isPublic: typeof data.isPublic === 'boolean' ? data.isPublic : false,
                affectedServices: Array.isArray(data.affectedServices) ? data.affectedServices : [],
                metrics: {
                    firstAlertAt: new Date()
                }
            });

            // Link alerts if provided
            if (data.alertIds && data.alertIds.length > 0) {
                incident.alerts = data.alertIds;

                // Update alerts with incident reference
                await Alert.updateMany(
                    { _id: { $in: data.alertIds } },
                    {
                        $set: { incidentId: incident._id },
                        $push: {
                            notificationChannels: {
                                type: 'incident',
                                sentAt: new Date(),
                                success: true
                            }
                        }
                    }
                );

                // Get alert details for affected services
                const alerts = await Alert.find({ _id: { $in: data.alertIds } })
                    .populate('monitorId');

                incident.affectedServices = alerts.map(alert => ({
                    monitorId: alert.monitorId?._id,
                    serviceName: alert.monitorId?.name || 'Unknown Service',
                    component: alert.metadata?.component || 'default',
                    status: 'outage'
                }));
            }

            // Add initial timeline entry
            incident.timeline.push({
                type: 'status_change',
                message: 'Incident created',
                actor: userId,
                at: new Date(),
                data: { status }
            });

            // Determine routing targets
            if (data.routing) {
                incident.routingTargets = data.routing;
            } else {
                incident.routingTargets = await this.determineRouting(incident);
            }

            // Set escalation timer if needed
            if (incident.severity === 'critical' || incident.severity === 'high') {
                incident.nextEscalationAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
            }

            await incident.save();

            this.emit('incidentCreated', incident);

            return incident;
        } catch (error) {
            console.error('Error creating incident:', error);
            throw error;
        }
    }

    determinePriority(severity) {
        const priorityMap = {
            'critical': 'P1',
            'high': 'P2',
            'medium': 'P3',
            'low': 'P4',
            'info': 'P4'
        };
        return priorityMap[severity] || 'P3';
    }

    async determineRouting(incident) {
        const routing = [];

        // Route to team if specified
        if (incident.teamId) {
            routing.push({
                type: 'team',
                targetId: incident.teamId,
                priority: 1
            });
        }

        // Add on-call routing for critical/high severity
        if (incident.severity === 'critical' || incident.severity === 'high') {
            const onCallUser = await this.getOnCallUser(incident.teamId);
            if (onCallUser) {
                routing.push({
                    type: 'user',
                    targetId: onCallUser._id,
                    priority: 0
                });
            }
        }

        return routing;
    }

    async getOnCallUser(teamId) {
        // This would integrate with OnCallSchedule model
        // For now, returning null
        return null;
    }

    /**
     * Acknowledge incident
     */
    async acknowledgeIncident(incidentId, userId, notes = '') {
        try {
            const incident = await Incident.findById(incidentId);
            if (!incident) {
                throw new Error('Incident not found');
            }

            if (incident.status === 'acknowledged') {
                throw new Error('Incident already acknowledged');
            }

            const now = new Date();
            incident.status = 'acknowledged';
            incident.acknowledgedAt = now;
            incident.acknowledgedBy = userId;

            // Calculate MTTA (Mean Time To Acknowledge)
            const mtta = now - incident.createdAt;
            incident.metrics.mtta = mtta;

            // Add timeline entry
            incident.timeline.push({
                type: 'acknowledged',
                message: notes || 'Incident acknowledged',
                actor: userId,
                at: now,
                data: { mtta }
            });

            // Update linked alerts
            await Alert.updateMany(
                { _id: { $in: incident.alerts } },
                {
                    $set: {
                        status: 'acknowledged',
                        acknowledgedAt: now,
                        acknowledgedBy: userId
                    }
                }
            );

            await incident.save();

            this.emit('incidentAcknowledged', { incident, userId, mtta });

            return incident;
        } catch (error) {
            console.error('Error acknowledging incident:', error);
            throw error;
        }
    }

    /**
     * Escalate incident
     */
    async escalateIncident(incidentId, userId, escalationData) {
        try {
            const incident = await Incident.findById(incidentId);
            if (!incident) {
                throw new Error('Incident not found');
            }

            incident.escalationLevel = (incident.escalationLevel || 0) + 1;
            incident.nextEscalationAt = null; // Clear automatic escalation

            // Add escalation timeline entry
            incident.timeline.push({
                type: 'escalation',
                message: escalationData.reason || `Escalated to level ${incident.escalationLevel}`,
                actor: userId,
                at: new Date(),
                data: {
                    level: incident.escalationLevel,
                    targetTeam: escalationData.targetTeam,
                    targetUser: escalationData.targetUser
                }
            });

            // Add new routing target
            if (escalationData.targetTeam) {
                incident.routingTargets.push({
                    type: 'team',
                    targetId: escalationData.targetTeam,
                    priority: incident.escalationLevel,
                    metadata: { escalated: true }
                });
            }

            if (escalationData.targetUser) {
                incident.routingTargets.push({
                    type: 'user',
                    targetId: escalationData.targetUser,
                    priority: incident.escalationLevel,
                    metadata: { escalated: true }
                });
            }

            // Increase severity if needed
            if (incident.escalationLevel >= 2 && incident.severity !== 'critical') {
                const oldSeverity = incident.severity;
                incident.severity = 'high';
                incident.timeline.push({
                    type: 'status_change',
                    message: `Severity increased from ${oldSeverity} to high due to escalation`,
                    actor: userId,
                    at: new Date(),
                    data: { oldSeverity, newSeverity: 'high' }
                });
            }

            await incident.save();

            this.emit('incidentEscalated', { incident, userId, level: incident.escalationLevel });

            return incident;
        } catch (error) {
            console.error('Error escalating incident:', error);
            throw error;
        }
    }

    /**
     * Resolve incident
     */
    async resolveIncident(incidentId, userId, resolutionData) {
        try {
            const incident = await Incident.findById(incidentId);
            if (!incident) {
                throw new Error('Incident not found');
            }

            const now = new Date();
            incident.status = 'resolved';
            incident.resolvedAt = now;
            incident.resolvedBy = userId;

            // Calculate MTTR (Mean Time To Resolution)
            const mttr = now - incident.createdAt;
            incident.metrics.mttr = mttr;

            // Add resolution to timeline
            incident.timeline.push({
                type: 'resolved',
                message: resolutionData.notes || 'Incident resolved',
                actor: userId,
                at: now,
                data: {
                    mttr,
                    rootCause: resolutionData.rootCause,
                    solution: resolutionData.solution
                }
            });

            // Add resolution note as update
            incident.addUpdate(
                resolutionData.notes || 'Incident resolved',
                'resolved',
                userId,
                {
                    rootCause: resolutionData.rootCause,
                    solution: resolutionData.solution
                }
            );

            // Resolve linked alerts
            await Alert.updateMany(
                { _id: { $in: incident.alerts } },
                {
                    $set: {
                        status: 'resolved',
                        resolvedAt: now,
                        resolvedBy: userId
                    }
                }
            );

            // Update affected services status
            incident.affectedServices.forEach(service => {
                service.status = 'operational';
            });

            await incident.save();

            this.emit('incidentResolved', { incident, userId, mttr });

            // Generate post-mortem if critical
            if (incident.severity === 'critical') {
                await this.generatePostMortem(incident);
            }

            return incident;
        } catch (error) {
            console.error('Error resolving incident:', error);
            throw error;
        }
    }

    /**
     * Snooze incident
     */
    async snoozeIncident(incidentId, userId, snoozeDuration) {
        try {
            const incident = await Incident.findById(incidentId);
            if (!incident) {
                throw new Error('Incident not found');
            }

            const snoozedUntil = new Date(Date.now() + snoozeDuration);
            incident.status = 'snoozed';
            incident.snoozedUntil = snoozedUntil;

            incident.timeline.push({
                type: 'snoozed',
                message: `Incident snoozed until ${snoozedUntil.toISOString()}`,
                actor: userId,
                at: new Date(),
                data: { snoozedUntil }
            });

            // Snooze linked alerts
            await Alert.updateMany(
                { _id: { $in: incident.alerts } },
                {
                    $set: {
                        status: 'snoozed',
                        snoozedUntil
                    }
                }
            );

            await incident.save();

            this.emit('incidentSnoozed', { incident, userId, snoozedUntil });

            return incident;
        } catch (error) {
            console.error('Error snoozing incident:', error);
            throw error;
        }
    }

    /**
     * Correlate alerts to identify related incidents
     */
    async correlateAlerts(alerts) {
        try {
            const correlatedGroups = [];
            const processed = new Set();

            for (const alert of alerts) {
                if (processed.has(alert._id.toString())) {
                    continue;
                }

                const correlationKey = this.generateCorrelationKey(alert);
                const relatedAlerts = alerts.filter(a => {
                    if (processed.has(a._id.toString())) {
                        return false;
                    }
                    return this.areAlertsRelated(alert, a);
                });

                if (relatedAlerts.length > 1) {
                    correlatedGroups.push({
                        key: correlationKey,
                        alerts: relatedAlerts,
                        severity: this.getHighestSeverity(relatedAlerts),
                        suggestedIncident: {
                            title: this.generateIncidentTitle(relatedAlerts),
                            description: this.generateIncidentDescription(relatedAlerts)
                        }
                    });

                    relatedAlerts.forEach(a => processed.add(a._id.toString()));
                }
            }

            return correlatedGroups;
        } catch (error) {
            console.error('Error correlating alerts:', error);
            return [];
        }
    }

    generateCorrelationKey(alert) {
        return `${alert.monitorId}_${alert.severity}_${alert.groupKey}`;
    }

    areAlertsRelated(alert1, alert2) {
        // Check temporal proximity
        const timeDiff = Math.abs(alert1.triggeredAt - alert2.triggeredAt);
        if (timeDiff > this.correlationWindow) {
            return false;
        }

        // Check if same monitor or group
        if (alert1.monitorId?.toString() === alert2.monitorId?.toString()) {
            return true;
        }

        if (alert1.groupKey === alert2.groupKey) {
            return true;
        }

        // Check metadata similarity
        if (alert1.metadata?.component === alert2.metadata?.component) {
            return true;
        }

        return false;
    }

    getHighestSeverity(alerts) {
        const severities = ['info', 'low', 'medium', 'high', 'critical'];
        let maxSeverity = 'info';

        alerts.forEach(alert => {
            if (severities.indexOf(alert.severity) > severities.indexOf(maxSeverity)) {
                maxSeverity = alert.severity;
            }
        });

        return maxSeverity;
    }

    generateIncidentTitle(alerts) {
        const monitors = [...new Set(alerts.map(a => a.monitorId?.name).filter(Boolean))];
        if (monitors.length === 1) {
            return `Multiple alerts for ${monitors[0]}`;
        }
        return `Multiple service alerts (${monitors.length} services affected)`;
    }

    generateIncidentDescription(alerts) {
        const descriptions = alerts.map(a => `- ${a.title}: ${a.description}`).join('\n');
        return `Correlated alerts:\n${descriptions}`;
    }

    /**
     * Automatically create incidents from grouped alerts
     */
    async autoCreateIncidents() {
        try {
            // Get triggered alerts without incidents
            const alerts = await Alert.find({
                status: { $in: ['triggered', 'acknowledged'] },
                incidentId: { $exists: false }
            }).populate('monitorId').sort({ triggeredAt: -1 }).limit(100);

            if (alerts.length === 0) {
                return;
            }

            // Correlate alerts
            const correlatedGroups = await this.correlateAlerts(alerts);

            // Create incidents for correlated groups
            for (const group of correlatedGroups) {
                if (group.alerts.length >= 3) { // Threshold for auto-incident creation
                    const incidentData = {
                        title: group.suggestedIncident.title,
                        description: group.suggestedIncident.description,
                        severity: group.severity,
                        alertIds: group.alerts.map(a => a._id),
                        workspaceId: group.alerts[0].monitorId?.workspaceId,
                        detection: 'monitoring'
                    };

                    await this.createIncident(incidentData, null);
                }
            }
        } catch (error) {
            console.error('Error auto-creating incidents:', error);
        }
    }

    /**
     * Generate post-mortem report
     */
    async generatePostMortem(incident) {
        try {
            const postMortem = {
                incidentId: incident._id,
                title: incident.title,
                summary: incident.description,
                timeline: incident.timeline.map(entry => ({
                    timestamp: entry.at,
                    type: entry.type,
                    description: entry.message
                })),
                impact: {
                    severity: incident.severity,
                    duration: incident.resolvedAt - incident.createdAt,
                    affectedServices: incident.affectedServices.length,
                    alertCount: incident.alerts.length
                },
                metrics: {
                    mtta: incident.metrics.mtta,
                    mttr: incident.metrics.mttr,
                    escalations: incident.escalationLevel
                },
                rootCause: this.extractRootCause(incident),
                resolution: this.extractResolution(incident),
                lessons: [],
                actionItems: [],
                generatedAt: new Date()
            };

            // Store post-mortem in incident metadata
            incident.metadata = incident.metadata || {};
            incident.metadata.postMortem = postMortem;
            await incident.save();

            this.emit('postMortemGenerated', { incident, postMortem });

            return postMortem;
        } catch (error) {
            console.error('Error generating post-mortem:', error);
            return null;
        }
    }

    extractRootCause(incident) {
        const resolutionEntry = incident.timeline.find(e => e.type === 'resolved');
        return resolutionEntry?.data?.rootCause || 'To be determined';
    }

    extractResolution(incident) {
        const resolutionEntry = incident.timeline.find(e => e.type === 'resolved');
        return resolutionEntry?.data?.solution || 'To be determined';
    }

    /**
     * Monitor escalation timers
     */
    startEscalationMonitoring() {
        cron.schedule('* * * * *', async () => {
            try {
                await this.checkEscalationTimers();
            } catch (error) {
                console.error('Error checking escalation timers:', error);
            }
        });
    }

    async checkEscalationTimers() {
        const now = new Date();
        const incidents = await Incident.find({
            status: { $in: ['open', 'acknowledged'] },
            nextEscalationAt: { $lte: now }
        });

        for (const incident of incidents) {
            await this.escalateIncident(incident._id, null, {
                reason: 'Automatic escalation due to timeout'
            });
        }
    }

    /**
     * Calculate and cache MTTR/MTTA metrics
     */
    startMetricsCalculation() {
        cron.schedule('*/5 * * * *', async () => {
            try {
                await this.calculateMetrics();
            } catch (error) {
                console.error('Error calculating metrics:', error);
            }
        });
    }

    async calculateMetrics() {
        const timeRanges = ['1h', '24h', '7d', '30d'];

        for (const range of timeRanges) {
            const startDate = this.getStartDate(range);

            const metrics = await Incident.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate },
                        status: { $in: ['resolved', 'closed'] }
                    }
                },
                {
                    $group: {
                        _id: null,
                        avgMTTR: { $avg: '$metrics.mttr' },
                        avgMTTA: { $avg: '$metrics.mtta' },
                        totalIncidents: { $sum: 1 },
                        criticalIncidents: {
                            $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] }
                        }
                    }
                }
            ]);

            if (metrics.length > 0) {
                this.mttrCache.set(range, metrics[0]);
            }
        }
    }

    getStartDate(range) {
        const now = Date.now();
        switch (range) {
            case '1h': return new Date(now - 60 * 60 * 1000);
            case '24h': return new Date(now - 24 * 60 * 60 * 1000);
            case '7d': return new Date(now - 7 * 24 * 60 * 60 * 1000);
            case '30d': return new Date(now - 30 * 24 * 60 * 60 * 1000);
            default: return new Date(now - 24 * 60 * 60 * 1000);
        }
    }

    /**
     * Get incident resolution patterns
     */
    async getResolutionPatterns(filters = {}) {
        const pipeline = [
            {
                $match: {
                    status: { $in: ['resolved', 'closed'] },
                    ...filters
                }
            },
            {
                $group: {
                    _id: {
                        severity: '$severity',
                        rootCause: '$timeline.data.rootCause'
                    },
                    count: { $sum: 1 },
                    avgMTTR: { $avg: '$metrics.mttr' },
                    avgMTTA: { $avg: '$metrics.mtta' }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 20 }
        ];

        return Incident.aggregate(pipeline);
    }

    /**
     * Get cached metrics
     */
    getMetrics(range = '24h') {
        return this.mttrCache.get(range) || {
            avgMTTR: 0,
            avgMTTA: 0,
            totalIncidents: 0,
            criticalIncidents: 0
        };
    }
}

module.exports = new IncidentManagementService();
