const MarketplaceApi = require('../../server/models/MarketplaceApi');
const Monitor = require('../../models/Monitor');

class HealthService {
    async getHealth(listingId) {
        const listing = await MarketplaceApi.findOne({ id: listingId }).lean();
        const listingHost = listing?.baseUrl ? new URL(listing.baseUrl).hostname : null;

        // Tier 4: use the internal MonitoringService data when a Monitor exists
        // for the same host as the listing's baseUrl. Otherwise fall back to a
        // deterministic synthetic score, clearly marked synthetic: true.
        if (listingHost) {
            const monitor = await Monitor.findOne({
                url: { $regex: new RegExp('^https?://[^/]*' + escapeRegex(listingHost) + '(/|$)', 'i') }
            }).sort({ updatedAt: -1 }).lean();

            if (monitor) {
                const uptimePercent = monitor.totalChecks
                    ? parseFloat((((monitor.totalChecks - monitor.totalFailures) / monitor.totalChecks) * 100).toFixed(2))
                    : 100;
                const score = this._statusToScore(monitor.currentStatus, uptimePercent);
                return {
                    synthetic: false,
                    monitorId: monitor._id,
                    current: {
                        score,
                        computedAt: new Date(),
                        status: this._mapMonitorStatus(monitor.currentStatus),
                        factors: {
                            uptimePercent,
                            avgResponseTimeMs: monitor.averageResponseTime || 0,
                            incidentsCount: monitor.totalFailures || 0,
                            openIncidentsCount: monitor.currentStatus === 'down' ? 1 : 0,
                            notes: `Based on internal monitor: ${monitor.name}`
                        }
                    },
                    history: this._generateHistory(score)
                };
            }
        }

        return this._syntheticHealth(listingId);
    }

    _mapMonitorStatus(currentStatus) {
        switch (currentStatus) {
            case 'up': return 'operational';
            case 'degraded': return 'degraded';
            case 'down': return 'outage';
            default: return 'unknown';
        }
    }

    _statusToScore(status, uptimePercent) {
        if (status === 'down') return Math.min(50, Math.round(uptimePercent / 2));
        if (status === 'degraded') return Math.round(70 + (uptimePercent / 10));
        return Math.round(90 + Math.min(10, (uptimePercent - 99) * 10));
    }

    _syntheticHealth(listingId) {
        const baseScore = this._getPseudoRandomScore(listingId);
        const uptimePercent = (98 + (baseScore / 50));
        const avgResponseTimeMs = Math.floor(1000 - (baseScore * 8));

        return {
            synthetic: true,
            current: {
                score: baseScore,
                computedAt: new Date(),
                status: baseScore > 90 ? 'operational' : (baseScore > 70 ? 'degraded' : 'outage'),
                factors: {
                    uptimePercent: parseFloat(uptimePercent.toFixed(2)),
                    avgResponseTimeMs,
                    incidentsCount: baseScore > 95 ? 0 : 1,
                    openIncidentsCount: 0,
                    notes: baseScore > 90 ? 'All systems operational' : 'Minor latency observed'
                }
            },
            history: this._generateHistory(baseScore)
        };
    }

    _getPseudoRandomScore(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const normalized = Math.abs(hash % 20) + 80;
        return normalized;
    }

    _generateHistory(baseScore) {
        const history = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            date.setHours(12, 0, 0, 0);
            const dailyScore = Math.min(100, Math.max(0, baseScore + (Math.random() * 4 - 2)));
            history.push({ date, score: Math.round(dailyScore) });
        }
        return history;
    }
}

function escapeRegex(string) {
    return String(string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = new HealthService();
