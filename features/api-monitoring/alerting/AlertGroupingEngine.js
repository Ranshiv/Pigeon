// features/api-monitoring/alerting/AlertGroupingEngine.js
const Alert = require('../../../models/Alert');
const EventEmitter = require('events');

class AlertGroupingEngine extends EventEmitter {
    constructor(options = {}) {
        super();
        this.windowSize = options.windowSize || 5 * 60 * 1000; // 5 minutes
        this.groupingStrategies = options.strategies || ['monitorId', 'severity', 'pattern'];
        this.activeGroups = new Map();
        this.similarityThreshold = options.similarityThreshold || 0.7;
    }

    /**
     * Group an alert with existing alerts
     */
    async group(alert) {
        const groupKey = this.generateGroupKey(alert);
        const existingGroup = this.activeGroups.get(groupKey);

        if (existingGroup) {
            return await this.addToExistingGroup(alert, existingGroup);
        } else {
            return await this.createNewGroup(alert, groupKey);
        }
    }

    /**
     * Generate a grouping key based on strategies
     */
    generateGroupKey(alert) {
        const components = [];

        if (this.groupingStrategies.includes('monitorId')) {
            components.push(`monitor:${alert.monitorId || 'unknown'}`);
        }

        if (this.groupingStrategies.includes('severity')) {
            components.push(`severity:${alert.severity}`);
        }

        if (this.groupingStrategies.includes('pattern')) {
            components.push(`pattern:${this.extractPattern(alert.title)}`);
        }

        if (this.groupingStrategies.includes('component')) {
            components.push(`component:${alert.metadata?.component || 'default'}`);
        }

        return components.join('::');
    }

    /**
     * Extract pattern from alert title
     */
    extractPattern(title) {
        // Normalize by removing timestamps, IPs, numbers
        return title
            .replace(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g, 'IP')
            .replace(/\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}/g, 'TIMESTAMP')
            .replace(/\d+(\.\d+)?/g, 'NUM')
            .toLowerCase()
            .trim();
    }

    /**
     * Add alert to existing group
     */
    async addToExistingGroup(alert, group) {
        group.alerts.push(alert._id);
        group.count++;
        group.lastUpdated = new Date();

        // Update severity to highest
        const severities = ['info', 'low', 'medium', 'high', 'critical'];
        if (severities.indexOf(alert.severity) > severities.indexOf(group.severity)) {
            group.severity = alert.severity;
        }

        // Update representative alert if needed
        if (alert.triggeredAt < group.firstTriggeredAt) {
            group.firstTriggeredAt = alert.triggeredAt;
        }

        this.emit('alertGrouped', {
            groupKey: group.key,
            alert,
            group
        });

        return {
            grouped: true,
            groupKey: group.key,
            groupSize: group.count
        };
    }

    /**
     * Create a new alert group
     */
    async createNewGroup(alert, groupKey) {
        const group = {
            key: groupKey,
            alerts: [alert._id],
            count: 1,
            severity: alert.severity,
            firstTriggeredAt: alert.triggeredAt,
            lastUpdated: new Date(),
            metadata: {
                monitorId: alert.monitorId,
                pattern: this.extractPattern(alert.title)
            }
        };

        this.activeGroups.set(groupKey, group);

        // Schedule cleanup
        this.scheduleGroupCleanup(groupKey);

        this.emit('groupCreated', { groupKey, group });

        return {
            grouped: false,
            groupKey,
            groupSize: 1
        };
    }

    /**
     * Get grouped alerts for display
     */
    async getGroupedAlerts(filters = {}) {
        const pipeline = [
            {
                $match: {
                    status: { $in: ['triggered', 'acknowledged'] },
                    ...filters
                }
            },
            {
                $group: {
                    _id: '$groupKey',
                    count: { $sum: 1 },
                    severity: { $max: '$severity' },
                    firstTriggered: { $min: '$triggeredAt' },
                    lastTriggered: { $max: '$triggeredAt' },
                    monitorId: { $first: '$monitorId' },
                    title: { $first: '$title' },
                    alerts: {
                        $push: {
                            _id: '$_id',
                            title: '$title',
                            triggeredAt: '$triggeredAt',
                            status: '$status'
                        }
                    }
                }
            },
            {
                $sort: { lastTriggered: -1 }
            }
        ];

        return Alert.aggregate(pipeline);
    }

    /**
     * Calculate similarity between two alerts
     */
    calculateSimilarity(alert1, alert2) {
        let score = 0;
        let maxScore = 0;

        // Monitor ID match (high weight)
        maxScore += 3;
        if (alert1.monitorId?.toString() === alert2.monitorId?.toString()) {
            score += 3;
        }

        // Severity match
        maxScore += 1;
        if (alert1.severity === alert2.severity) {
            score += 1;
        }

        // Pattern similarity (using Levenshtein distance)
        maxScore += 2;
        const pattern1 = this.extractPattern(alert1.title);
        const pattern2 = this.extractPattern(alert2.title);
        const patternSimilarity = this.calculateLevenshteinSimilarity(pattern1, pattern2);
        score += patternSimilarity * 2;

        // Time proximity
        maxScore += 1;
        const timeDiff = Math.abs(alert1.triggeredAt - alert2.triggeredAt);
        if (timeDiff < this.windowSize) {
            score += 1 - (timeDiff / this.windowSize);
        }

        return score / maxScore;
    }

    /**
     * Calculate Levenshtein similarity
     */
    calculateLevenshteinSimilarity(str1, str2) {
        const distance = this.levenshteinDistance(str1, str2);
        const maxLength = Math.max(str1.length, str2.length);
        return maxLength === 0 ? 1 : 1 - (distance / maxLength);
    }

    levenshteinDistance(str1, str2) {
        const matrix = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }

    /**
     * Find similar alerts using machine learning-like approach
     */
    async findSimilarAlerts(alert, limit = 10) {
        const recentAlerts = await Alert.find({
            _id: { $ne: alert._id },
            triggeredAt: {
                $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            }
        }).limit(100);

        const similarities = recentAlerts.map(otherAlert => ({
            alert: otherAlert,
            similarity: this.calculateSimilarity(alert, otherAlert)
        }));

        return similarities
            .filter(s => s.similarity >= this.similarityThreshold)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);
    }

    /**
     * Schedule cleanup of old groups
     */
    scheduleGroupCleanup(groupKey) {
        setTimeout(() => {
            const group = this.activeGroups.get(groupKey);
            if (group && Date.now() - group.lastUpdated > this.windowSize) {
                this.activeGroups.delete(groupKey);
                this.emit('groupExpired', { groupKey, group });
            }
        }, this.windowSize);
    }

    /**
     * Get grouping statistics
     */
    getStatistics() {
        const groups = Array.from(this.activeGroups.values());

        return {
            totalGroups: groups.length,
            totalAlerts: groups.reduce((sum, g) => sum + g.count, 0),
            averageGroupSize: groups.length > 0
                ? groups.reduce((sum, g) => sum + g.count, 0) / groups.length
                : 0,
            severityBreakdown: {
                critical: groups.filter(g => g.severity === 'critical').length,
                high: groups.filter(g => g.severity === 'high').length,
                medium: groups.filter(g => g.severity === 'medium').length,
                low: groups.filter(g => g.severity === 'low').length,
                info: groups.filter(g => g.severity === 'info').length
            }
        };
    }

    /**
     * Clear all groups (useful for testing)
     */
    clearGroups() {
        this.activeGroups.clear();
        this.emit('groupsCleared');
    }
}

module.exports = AlertGroupingEngine;
