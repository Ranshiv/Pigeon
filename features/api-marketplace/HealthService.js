const MarketplaceApi = require('../../server/models/MarketplaceApi');

class HealthService {
    async getHealth(listingId) {
        // In a real implementation, this would query the internal MonitoringService 
        // using the API's baseUrl to find matching monitors.

        // For now, we generate a semi-random 'realistic' score based on the hash of the ID
        // so it stays consistent but looks different for different APIs.

        const baseScore = this._getPseudoRandomScore(listingId);

        // Calculate a "uptime" based on score
        const uptimePercent = (98 + (baseScore / 50)).toFixed(2); // Between 98.00% and 100.00%

        // Calculate avg response time
        const avgResponseTimeMs = Math.floor(1000 - (baseScore * 8)); // Lower score = higher latency

        return {
            current: {
                score: baseScore,
                computedAt: new Date(),
                status: baseScore > 90 ? 'operational' : (baseScore > 70 ? 'degraded' : 'outage'),
                factors: {
                    uptimePercent: parseFloat(uptimePercent),
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
        // Normalize to 80-100 range for "good" APIs
        const normalized = Math.abs(hash % 20) + 80;
        return normalized;
    }

    _generateHistory(baseScore) {
        // Generate last 7 days of scores
        const history = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            date.setHours(12, 0, 0, 0);

            // Variate slightly
            const dailyScore = Math.min(100, Math.max(0, baseScore + (Math.random() * 4 - 2)));

            history.push({
                date,
                score: Math.round(dailyScore)
            });
        }
        return history;
    }
}

module.exports = new HealthService();
