// client/src/components/Analytics/AlertAnalytics/AlertAnalyticsHub.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';
import './AlertAnalyticsHub.css';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend
);

const AlertAnalyticsHub = () => {
    const [timeRange, setTimeRange] = useState('7d');
    const [statistics, setStatistics] = useState(null);
    const [frequencyData, setFrequencyData] = useState([]);
    const [mttrData, setMttrData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAnalytics();
    }, [timeRange]);

    const fetchAnalytics = async () => {
        try {
            setLoading(true);

            // Fetch multiple analytics endpoints in parallel
            const [statsRes, freqRes] = await Promise.all([
                axios.get('/api/monitoring/alerts/statistics', {
                    params: { timeRange }
                }),
                axios.get('/api/monitoring/alerts/frequency', {
                    params: { timeRange, groupBy: 'day' }
                })
            ]);

            setStatistics(statsRes.data);
            setFrequencyData(freqRes.data);

            // Calculate MTTR trend from statistics
            if (statsRes.data.bySeverity) {
                const mttrByDay = statsRes.data.bySeverity.map(item => ({
                    severity: item._id,
                    mttr: item.mttr || 0,
                    count: item.count
                }));
                setMttrData(mttrByDay);
            }
        } catch (error) {
            console.error('Error fetching analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDuration = (ms) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m`;
        return `${seconds}s`;
    };

    // Alert Frequency Chart
    const frequencyChartData = {
        labels: frequencyData.map(item => {
            const date = new Date(item._id.year, item._id.month - 1, item._id.day);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }),
        datasets: [{
            label: 'Alert Count',
            data: frequencyData.map(item => item.count),
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.4,
            fill: true
        }]
    };

    // MTTR by Severity Chart
    const mttrChartData = {
        labels: mttrData.map(item => item.severity),
        datasets: [{
            label: 'MTTR (minutes)',
            data: mttrData.map(item => item.mttr / 60000), // Convert to minutes
            backgroundColor: [
                'rgba(220, 38, 38, 0.8)',   // critical - red
                'rgba(249, 115, 22, 0.8)',  // high - orange
                'rgba(234, 179, 8, 0.8)',   // medium - yellow
                'rgba(59, 130, 246, 0.8)',  // low - blue
                'rgba(156, 163, 175, 0.8)'  // info - gray
            ]
        }]
    };

    // Severity Distribution Chart
    const severityChartData = {
        labels: statistics?.bySeverity?.map(item => item._id) || [],
        datasets: [{
            data: statistics?.bySeverity?.map(item => item.count) || [],
            backgroundColor: [
                'rgba(220, 38, 38, 0.8)',
                'rgba(249, 115, 22, 0.8)',
                'rgba(234, 179, 8, 0.8)',
                'rgba(59, 130, 246, 0.8)',
                'rgba(156, 163, 175, 0.8)'
            ],
            borderWidth: 2,
            borderColor: '#ffffff'
        }]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'top'
            },
            tooltip: {
                mode: 'index',
                intersect: false
            }
        },
        scales: {
            y: {
                beginAtZero: true
            }
        }
    };

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'right'
            }
        }
    };

    return (
        <div className="alert-analytics-hub">
            <div className="analytics-header">
                <h1 className="text-3xl font-bold text-gray-900">Alert Analytics</h1>
                <div className="time-range-selector">
                    <button
                        onClick={() => setTimeRange('24h')}
                        className={timeRange === '24h' ? 'time-btn active' : 'time-btn'}
                    >
                        24H
                    </button>
                    <button
                        onClick={() => setTimeRange('7d')}
                        className={timeRange === '7d' ? 'time-btn active' : 'time-btn'}
                    >
                        7D
                    </button>
                    <button
                        onClick={() => setTimeRange('30d')}
                        className={timeRange === '30d' ? 'time-btn active' : 'time-btn'}
                    >
                        30D
                    </button>
                    <button
                        onClick={() => setTimeRange('90d')}
                        className={timeRange === '90d' ? 'time-btn active' : 'time-btn'}
                    >
                        90D
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading analytics...</p>
                </div>
            ) : (
                <>
                    {/* Key Metrics */}
                    <div className="metrics-grid">
                        <div className="metric-card">
                            <div className="metric-icon">📊</div>
                            <div className="metric-content">
                                <div className="metric-label">Total Alerts</div>
                                <div className="metric-value">{statistics?.totalAlerts || 0}</div>
                            </div>
                        </div>

                        <div className="metric-card">
                            <div className="metric-icon">⚡</div>
                            <div className="metric-content">
                                <div className="metric-label">MTTA</div>
                                <div className="metric-value">
                                    {formatDuration(statistics?.mtta || 0)}
                                </div>
                                <div className="metric-subtitle">Mean Time to Acknowledge</div>
                            </div>
                        </div>

                        <div className="metric-card">
                            <div className="metric-icon">🔧</div>
                            <div className="metric-content">
                                <div className="metric-label">MTTR</div>
                                <div className="metric-value">
                                    {formatDuration(statistics?.mttr || 0)}
                                </div>
                                <div className="metric-subtitle">Mean Time to Resolve</div>
                            </div>
                        </div>

                        <div className="metric-card">
                            <div className="metric-icon">🎯</div>
                            <div className="metric-content">
                                <div className="metric-label">Resolution Rate</div>
                                <div className="metric-value">
                                    {statistics?.resolutionRate
                                        ? `${(statistics.resolutionRate * 100).toFixed(1)}%`
                                        : '0%'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Charts Grid */}
                    <div className="charts-grid">
                        {/* Alert Frequency Trend */}
                        <div className="chart-card large">
                            <div className="chart-header">
                                <h3 className="chart-title">Alert Frequency Trend</h3>
                            </div>
                            <div className="chart-container">
                                <Line data={frequencyChartData} options={chartOptions} />
                            </div>
                        </div>

                        {/* MTTR by Severity */}
                        <div className="chart-card">
                            <div className="chart-header">
                                <h3 className="chart-title">MTTR by Severity</h3>
                            </div>
                            <div className="chart-container">
                                <Bar data={mttrChartData} options={chartOptions} />
                            </div>
                        </div>

                        {/* Severity Distribution */}
                        <div className="chart-card">
                            <div className="chart-header">
                                <h3 className="chart-title">Severity Distribution</h3>
                            </div>
                            <div className="chart-container">
                                <Doughnut data={severityChartData} options={doughnutOptions} />
                            </div>
                        </div>

                        {/* Top Monitors by Alerts */}
                        <div className="chart-card">
                            <div className="chart-header">
                                <h3 className="chart-title">Top Monitors by Alert Count</h3>
                            </div>
                            <div className="top-monitors-list">
                                {statistics?.byMonitor?.slice(0, 5).map((item, index) => (
                                    <div key={index} className="monitor-item">
                                        <div className="monitor-rank">{index + 1}</div>
                                        <div className="monitor-name">{item.monitorName || item._id}</div>
                                        <div className="monitor-count">{item.count} alerts</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Status Distribution */}
                        <div className="chart-card">
                            <div className="chart-header">
                                <h3 className="chart-title">Alert Status Distribution</h3>
                            </div>
                            <div className="status-breakdown">
                                {statistics?.byStatus?.map(item => (
                                    <div key={item._id} className="status-item">
                                        <div className={`status-badge status-${item._id}`}>
                                            {item._id}
                                        </div>
                                        <div className="status-count">{item.count}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default AlertAnalyticsHub;
