// client/src/components/MockAnalyticsDashboard.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    FiActivity, FiClock, FiCheck, FiTrendingUp, FiRefreshCw,
    FiBarChart2, FiDownload, FiFilter
} from 'react-icons/fi';
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
    Legend,
    Filler
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import './MockAnalyticsDashboard.css';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

const TIME_RANGES = [
    { value: '1h', label: 'Last Hour' },
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' }
];

const MockAnalyticsDashboard = ({ mockServerId, mockServerName }) => {
    const [timeRange, setTimeRange] = useState('24h');
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [analytics, setAnalytics] = useState(null);
    const [recentRequests, setRecentRequests] = useState([]);
    const refreshIntervalRef = useRef(null);

    const fetchAnalytics = useCallback(async () => {
        if (!mockServerId) return;

        try {
            setError(null);

            // Calculate hours based on time range
            const hoursMap = {
                '1h': 1,
                '24h': 24,
                '7d': 168,
                '30d': 720
            };
            const hours = hoursMap[timeRange] || 24;

            // Fetch main analytics summary with time range filter
            const summaryRes = await fetch(
                `/api/mock-servers/${mockServerId}/analytics?hours=${hours}`,
                { credentials: 'include' }
            );

            if (!summaryRes.ok) {
                throw new Error('Failed to fetch analytics');
            }

            const summaryData = await summaryRes.json();

            // Fetch time series data
            const timeseriesRes = await fetch(
                `/api/mock-servers/${mockServerId}/analytics/timeseries?hours=${hours}`,
                { credentials: 'include' }
            );

            const timeseriesData = timeseriesRes.ok ? await timeseriesRes.json() : [];

            // Fetch response time distribution
            const responseTimeRes = await fetch(
                `/api/mock-servers/${mockServerId}/analytics/response-times?hours=${hours}`,
                { credentials: 'include' }
            );

            const responseTimeData = responseTimeRes.ok ? await responseTimeRes.json() : [];

            // Fetch top endpoints
            const topEndpointsRes = await fetch(
                `/api/mock-servers/${mockServerId}/analytics/top-endpoints?limit=10&hours=${hours}`,
                { credentials: 'include' }
            );

            const topEndpointsData = topEndpointsRes.ok ? await topEndpointsRes.json() : [];

            // Fetch recent requests
            const recentRes = await fetch(
                `/api/mock-servers/${mockServerId}/analytics/requests?limit=20&hours=${hours}`,
                { credentials: 'include' }
            );

            const recentData = recentRes.ok ? await recentRes.json() : [];

            setAnalytics({
                summary: summaryData,
                requestsOverTime: timeseriesData,
                responseTimeDistribution: responseTimeData,
                topEndpoints: topEndpointsData,
                statusCodeDistribution: summaryData.statusCodes || []
            });
            setRecentRequests(recentData);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [mockServerId, timeRange]);

    // Initial fetch and auto-refresh
    useEffect(() => {
        fetchAnalytics();

        if (autoRefresh) {
            refreshIntervalRef.current = setInterval(fetchAnalytics, 30000); // 30 seconds
        }

        return () => {
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
            }
        };
    }, [fetchAnalytics, autoRefresh]);

    // Export analytics
    const exportAnalytics = () => {
        if (!analytics) return;

        const exportData = {
            mockServer: mockServerName,
            timeRange,
            exportedAt: new Date().toISOString(),
            summary: analytics.summary,
            requests: recentRequests
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mock-analytics-${mockServerId}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Format numbers
    const formatNumber = (num) => {
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num?.toString() || '0';
    };

    // Get status class
    const getStatusClass = (status) => {
        if (status >= 200 && status < 300) return 'status-2xx';
        if (status >= 300 && status < 400) return 'status-3xx';
        if (status >= 400 && status < 500) return 'status-4xx';
        return 'status-5xx';
    };

    // Chart configurations
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                backgroundColor: '#1e1e1e',
                titleColor: '#ffffff',
                bodyColor: '#d4d4d4',
                borderColor: '#333333',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 8
            }
        },
        scales: {
            x: {
                grid: {
                    display: false
                },
                ticks: {
                    color: '#666666',
                    font: { size: 11 }
                }
            },
            y: {
                grid: {
                    color: '#e5e5e5'
                },
                ticks: {
                    color: '#666666',
                    font: { size: 11 }
                }
            }
        }
    };

    // Generate chart data
    const getResponseTimeData = () => {
        if (!analytics?.responseTimeDistribution?.buckets) {
            return { labels: [], datasets: [] };
        }

        return {
            labels: analytics.responseTimeDistribution.buckets.map(d => d.range),
            datasets: [{
                label: 'Requests',
                data: analytics.responseTimeDistribution.buckets.map(d => d.count),
                backgroundColor: '#014C75',
                borderRadius: 4
            }]
        };
    };

    const getStatusCodeData = () => {
        if (!analytics?.summary?.distributions?.byStatus) {
            return { labels: [], datasets: [] };
        }

        const statusData = analytics.summary.distributions.byStatus;
        const labels = Object.keys(statusData);
        const data = Object.values(statusData);

        const colors = {
            '2xx': '#10b981',
            '3xx': '#3b82f6',
            '4xx': '#f59e0b',
            '5xx': '#ef4444'
        };

        // Map status codes to categories
        const getStatusCategory = (status) => {
            if (status.startsWith('2')) return '2xx';
            if (status.startsWith('3')) return '3xx';
            if (status.startsWith('4')) return '4xx';
            return '5xx';
        };

        return {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: labels.map(l => colors[getStatusCategory(l)] || '#6b7280'),
                borderWidth: 0
            }]
        };
    };

    const getTopEndpointsData = () => {
        if (!analytics?.topEndpoints?.topEndpoints) {
            return { labels: [], datasets: [] };
        }

        return {
            labels: analytics.topEndpoints.topEndpoints.map(d =>
                d.path.length > 25 ? d.path.slice(0, 25) + '...' : d.path
            ),
            datasets: [{
                label: 'Requests',
                data: analytics.topEndpoints.topEndpoints.map(d => d.totalRequests),
                backgroundColor: '#014C75',
                borderRadius: 4
            }]
        };
    };

    if (!mockServerId) {
        return (
            <div className="analytics-dashboard">
                <div className="analytics-empty">
                    <FiBarChart2 size={48} />
                    <h3>No Mock Server Selected</h3>
                    <p>Select a mock server to view analytics</p>
                </div>
            </div>
        );
    }

    return (
        <div className="analytics-dashboard">
            {/* Header */}
            <div className="analytics-header">
                <div className="header-title">
                    <h2>
                        <FiActivity size={20} />
                        Analytics
                    </h2>
                    {mockServerName && (
                        <span className="server-name">{mockServerName}</span>
                    )}
                </div>

                <div className="header-controls">
                    <div className="time-range-selector">
                        <FiClock size={14} />
                        <select
                            value={timeRange}
                            onChange={(e) => setTimeRange(e.target.value)}
                        >
                            {TIME_RANGES.map(range => (
                                <option key={range.value} value={range.value}>
                                    {range.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <label className={`auto-refresh-toggle ${autoRefresh ? 'active' : ''}`}>
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                        />
                        <span className="auto-refresh-indicator" aria-hidden="true"></span>
                        <span className="auto-refresh-text">Auto-refresh</span>
                    </label>

                    <button
                        className="btn-icon-text"
                        onClick={fetchAnalytics}
                        disabled={loading}
                    >
                        <FiRefreshCw size={14} className={loading ? 'spinning' : ''} />
                        Refresh
                    </button>

                    <button className="btn-icon-text" onClick={exportAnalytics}>
                        <FiDownload size={14} />
                        Export
                    </button>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="analytics-error">
                    <p>Error loading analytics: {error}</p>
                    <button onClick={fetchAnalytics}>Retry</button>
                </div>
            )}

            {/* Loading State */}
            {loading && !analytics ? (
                <div className="analytics-loading">
                    <div className="spinner" />
                    <p>Loading analytics...</p>
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="summary-cards">
                        <div className="summary-card">
                            <div className="card-icon requests">
                                <FiTrendingUp size={24} />
                            </div>
                            <div className="card-content">
                                <span className="card-value">
                                    {formatNumber(analytics?.summary?.summary?.totalRequests || 0)}
                                </span>
                                <span className="card-label">Total Requests</span>
                            </div>
                        </div>

                        <div className="summary-card">
                            <div className="card-icon response-time">
                                <FiClock size={24} />
                            </div>
                            <div className="card-content">
                                <span className="card-value">
                                    {analytics?.summary?.summary?.avgResponseTime?.toFixed(0) || 0}ms
                                </span>
                                <span className="card-label">Avg Response Time</span>
                            </div>
                        </div>

                        <div className="summary-card">
                            <div className="card-icon success-rate">
                                <FiCheck size={24} />
                            </div>
                            <div className="card-content">
                                <span className="card-value">
                                    {analytics?.summary?.summary?.successRate?.toFixed(1) ||
                                        (analytics?.summary?.errors?.total4xx === 0 && analytics?.summary?.errors?.total5xx === 0 ? '100.0' : '0')}%
                                </span>
                                <span className="card-label">Success Rate</span>
                            </div>
                        </div>

                        <div className="summary-card">
                            <div className="card-icon endpoints">
                                <FiActivity size={24} />
                            </div>
                            <div className="card-content">
                                <span className="card-value">
                                    {analytics?.topEndpoints?.topEndpoints?.length || 0}
                                </span>
                                <span className="card-label">Active Endpoints</span>
                            </div>
                        </div>
                    </div>

                    {/* Charts Grid */}
                    <div className="charts-grid">
                        {/* Response Time Distribution */}
                        <div className="chart-card">
                            <div className="chart-header">
                                <h3>Response Time Distribution</h3>
                            </div>
                            <div className="chart-container">
                                <Bar
                                    data={getResponseTimeData()}
                                    options={{
                                        ...chartOptions,
                                        indexAxis: 'y'
                                    }}
                                />
                            </div>
                        </div>

                        {/* Status Code Distribution */}
                        <div className="chart-card">
                            <div className="chart-header">
                                <h3>Status Code Distribution</h3>
                            </div>
                            <div className="chart-container doughnut">
                                <Doughnut
                                    data={getStatusCodeData()}
                                    options={{
                                        ...chartOptions,
                                        plugins: {
                                            ...chartOptions.plugins,
                                            legend: {
                                                display: true,
                                                position: 'right',
                                                labels: {
                                                    boxWidth: 12,
                                                    padding: 12,
                                                    font: { size: 12 }
                                                }
                                            }
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        {/* Top Endpoints */}
                        <div className="chart-card wide">
                            <div className="chart-header">
                                <h3>Top Endpoints</h3>
                            </div>
                            <div className="chart-container">
                                <Bar
                                    data={getTopEndpointsData()}
                                    options={chartOptions}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Recent Requests Table */}
                    <div className="recent-requests">
                        <div className="table-header">
                            <h3>Recent Requests</h3>
                            <div className="table-filters">
                                <FiFilter size={12} />
                                <span>Last 20 requests</span>
                            </div>
                        </div>

                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Timestamp</th>
                                        <th>Method</th>
                                        <th>Path</th>
                                        <th>Status</th>
                                        <th>Response Time</th>
                                        <th>Scenario</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentRequests?.requests?.length > 0 ? (
                                        recentRequests.requests.map((request, index) => (
                                            <tr key={request._id || index}>
                                                <td className="timestamp">
                                                    {new Date(request.timestamp).toLocaleString()}
                                                </td>
                                                <td>
                                                    <span className={`method ${request.method?.toLowerCase()}`}>
                                                        {request.method}
                                                    </span>
                                                </td>
                                                <td className="path" title={request.path}>
                                                    {request.path}
                                                </td>
                                                <td>
                                                    <span className={`status ${getStatusClass(request.statusCode)}`}>
                                                        {request.statusCode}
                                                    </span>
                                                </td>
                                                <td>{request.responseTime}ms</td>
                                                <td className="scenario">
                                                    {request.scenarioName || '—'}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="6" className="no-data">
                                                No requests recorded yet
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default MockAnalyticsDashboard;
