// client/src/components/Analytics/AnalyticsDashboard.js
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    FiActivity, FiTrendingUp, FiTrendingDown, FiAlertCircle,
    FiRefreshCw, FiDownload, FiCalendar,
    FiZap, FiCheckCircle, FiClock, FiBarChart2, FiTarget
} from 'react-icons/fi';
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
    Legend,
    Filler
} from 'chart.js';
import './AnalyticsDashboard.css';
import PageLoader from '../common/PageLoader/PageLoader';

// Register ChartJS components
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

const AnalyticsDashboard = () => {
    const navigate = useNavigate();
    const { id: monitorId } = useParams();

    const [dashboardData, setDashboardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [timeRange, setTimeRange] = useState('24h');
    const [activeTab, setActiveTab] = useState('overview');

    // Fetch dashboard data
    const fetchDashboardData = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch(
                `/api/analytics/dashboard/${monitorId}?timeRange=${timeRange}`,
                { credentials: 'include' }
            );

            if (!response.ok) {
                throw new Error('Failed to fetch analytics data');
            }

            const data = await response.json();
            setDashboardData(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [monitorId, timeRange]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchDashboardData();
    };

    const handleExport = async () => {
        try {
            const response = await fetch(
                `/api/analytics/export/${monitorId}?format=csv&timeRange=${timeRange}`,
                { credentials: 'include' }
            );

            if (!response.ok) throw new Error('Export failed');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `analytics-${monitorId}-${Date.now()}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            console.error('Export error:', err);
        }
    };

    // Chart configuration
    const getChartOptions = (title) => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            title: {
                display: false
            },
            tooltip: {
                backgroundColor: 'rgba(0, 34, 52, 0.95)',
                titleColor: '#ffffff',
                bodyColor: '#E5F3FF',
                borderColor: '#014C75',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 8,
                displayColors: false
            }
        },
        scales: {
            x: {
                grid: {
                    display: false
                },
                ticks: {
                    color: 'var(--text-secondary)',
                    font: {
                        size: 11
                    }
                }
            },
            y: {
                grid: {
                    color: 'rgba(1, 76, 117, 0.1)',
                    drawBorder: false
                },
                ticks: {
                    color: 'var(--text-secondary)',
                    font: {
                        size: 11
                    }
                }
            }
        }
    });

    // Doughnut chart configuration (no scales)
    const getDoughnutChartOptions = () => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'bottom',
                labels: {
                    color: 'var(--text-primary)',
                    padding: 15,
                    font: {
                        size: 12
                    },
                    usePointStyle: true,
                    pointStyle: 'circle'
                }
            },
            title: {
                display: false
            },
            tooltip: {
                backgroundColor: 'rgba(0, 34, 52, 0.95)',
                titleColor: '#ffffff',
                bodyColor: '#E5F3FF',
                borderColor: '#014C75',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 8,
                displayColors: true,
                callbacks: {
                    label: function (context) {
                        const label = context.label || '';
                        const value = context.parsed || 0;
                        return `${label}: ${value.toFixed(2)}%`;
                    }
                }
            }
        }
    });

    // Prepare chart data
    const preparePerformanceChartData = () => {
        if (!dashboardData || !dashboardData.timeSeries) return null;

        return {
            labels: dashboardData.timeSeries.map(item =>
                new Date(item.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                })
            ),
            datasets: [
                {
                    label: 'Response Time (ms)',
                    data: dashboardData.timeSeries.map(item => item.responseTime),
                    borderColor: '#014C75',
                    backgroundColor: 'rgba(1, 76, 117, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 2,
                    pointHoverRadius: 5,
                    pointBackgroundColor: '#014C75',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }
            ]
        };
    };

    const prepareUptimeChartData = () => {
        if (!dashboardData || !dashboardData.timeSeries) return null;

        const uptime = dashboardData.summary.avgUptime;
        const downtime = 100 - uptime;

        return {
            labels: ['Uptime', 'Downtime'],
            datasets: [
                {
                    data: [uptime, downtime],
                    backgroundColor: [
                        '#10b981',
                        '#ef4444'
                    ],
                    borderWidth: 0
                }
            ]
        };
    };

    const prepareErrorChartData = () => {
        if (!dashboardData || !dashboardData.timeSeries) return null;

        return {
            labels: dashboardData.timeSeries.map(item =>
                new Date(item.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                })
            ),
            datasets: [
                {
                    label: 'Error Rate (%)',
                    data: dashboardData.timeSeries.map(item => item.errorRate),
                    backgroundColor: 'rgba(239, 68, 68, 0.7)',
                    borderColor: '#ef4444',
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        };
    };

    // Get health score color and status
    const getHealthScoreInfo = (score) => {
        if (score >= 90) return { color: 'var(--success)', status: 'Excellent', icon: <FiCheckCircle /> };
        if (score >= 70) return { color: 'var(--success)', status: 'Good', icon: <FiCheckCircle /> };
        if (score >= 50) return { color: 'var(--warning)', status: 'Fair', icon: <FiAlertCircle /> };
        return { color: '#ef4444', status: 'Poor', icon: <FiAlertCircle /> };
    };

    if (loading && !dashboardData) {
        return (
            <div className="analytics-dashboard">
                <PageLoader label="Loading analytics..." />
            </div>
        );
    }

    if (error) {
        return (
            <div className="analytics-dashboard">
                <div className="error-state">
                    <FiAlertCircle className="error-icon" />
                    <h3>Error Loading Analytics</h3>
                    <p>{error}</p>
                    <button onClick={fetchDashboardData} className="btn-primary">
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    if (!dashboardData) return null;

    const healthInfo = getHealthScoreInfo(dashboardData.summary.healthScore);

    return (
        <div className="analytics-dashboard">
            {/* Header */}
            <div className="dashboard-header">
                <div className="header-content">
                    <button
                        className="back-btn"
                        onClick={() => navigate('/workspace/monitoring')}
                    >
                        ← Back
                    </button>
                    <div className="header-info">
                        <h1>
                            <FiBarChart2 /> Analytics Dashboard
                        </h1>
                        <p className="monitor-name">{dashboardData.monitor.name}</p>
                        <p className="monitor-url">{dashboardData.monitor.url}</p>
                    </div>
                </div>
                <div className="header-actions">
                    <div className="time-range-selector">
                        <FiCalendar />
                        <select
                            value={timeRange}
                            onChange={(e) => setTimeRange(e.target.value)}
                        >
                            <option value="1h">Last Hour</option>
                            <option value="24h">Last 24 Hours</option>
                            <option value="7d">Last 7 Days</option>
                        </select>
                    </div>
                    <button
                        className={`refresh-btn ${refreshing ? 'refreshing' : ''}`}
                        onClick={handleRefresh}
                        disabled={refreshing}
                    >
                        <FiRefreshCw /> Refresh
                    </button>
                    <button
                        className="export-btn"
                        onClick={handleExport}
                    >
                        <FiDownload /> Export
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="summary-cards">
                <div className="summary-card health-score">
                    <div className="card-icon" style={{ color: healthInfo.color }}>
                        {healthInfo.icon}
                    </div>
                    <div className="card-content">
                        <div className="card-label">Health Score</div>
                        <div className="card-value" style={{ color: healthInfo.color }}>
                            {dashboardData.summary.healthScore}
                        </div>
                        <div className="card-status" style={{ color: healthInfo.color }}>
                            {healthInfo.status}
                        </div>
                    </div>
                    <div
                        className="card-progress"
                        style={{
                            background: `conic-gradient(${healthInfo.color} ${dashboardData.summary.healthScore * 3.6}deg, var(--border-color) 0deg)`
                        }}
                    >
                        <div className="progress-inner"></div>
                    </div>
                </div>

                <div className="summary-card">
                    <div className="card-icon" style={{ color: 'var(--success)' }}>
                        <FiCheckCircle />
                    </div>
                    <div className="card-content">
                        <div className="card-label">Uptime</div>
                        <div className="card-value">
                            {dashboardData.summary.avgUptime.toFixed(2)}%
                        </div>
                        <div className="card-trend positive">
                            <FiTrendingUp /> Excellent
                        </div>
                    </div>
                </div>

                <div className="summary-card">
                    <div className="card-icon" style={{ color: 'var(--accent-color)' }}>
                        <FiZap />
                    </div>
                    <div className="card-content">
                        <div className="card-label">Avg Response Time</div>
                        <div className="card-value">
                            {dashboardData.summary.avgResponseTime}ms
                        </div>
                        {dashboardData.predictions && (
                            <div className="card-prediction">
                                Next: {dashboardData.predictions.nextHourResponseTime}ms
                            </div>
                        )}
                    </div>
                </div>

                <div className="summary-card">
                    <div className="card-icon" style={{ color: 'var(--warning)' }}>
                        <FiActivity />
                    </div>
                    <div className="card-content">
                        <div className="card-label">Total Requests</div>
                        <div className="card-value">
                            {dashboardData.summary.totalRequests.toLocaleString()}
                        </div>
                        <div className="card-meta">
                            {dashboardData.summary.totalErrors} errors
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="analytics-tabs">
                <button
                    className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    <FiActivity /> Overview
                </button>
                <button
                    className={`tab-btn ${activeTab === 'performance' ? 'active' : ''}`}
                    onClick={() => setActiveTab('performance')}
                >
                    <FiTrendingUp /> Performance
                </button>
                <button
                    className={`tab-btn ${activeTab === 'anomalies' ? 'active' : ''}`}
                    onClick={() => setActiveTab('anomalies')}
                >
                    <FiAlertCircle /> Anomalies {dashboardData.anomalies.length > 0 && (
                        <span className="badge">{dashboardData.anomalies.length}</span>
                    )}
                </button>
                <button
                    className={`tab-btn ${activeTab === 'predictions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('predictions')}
                >
                    <FiTarget /> Predictions
                </button>
            </div>

            {/* Tab Content */}
            <div className="tab-content">
                {activeTab === 'overview' && (
                    <div className="overview-content">
                        <div className="charts-grid">
                            {/* Performance Trend Chart */}
                            <div className="chart-card">
                                <div className="chart-header">
                                    <h3><FiTrendingUp /> Response Time Trend</h3>
                                    <span className="chart-subtitle">Average response time over {timeRange}</span>
                                </div>
                                <div className="chart-container">
                                    {preparePerformanceChartData() && (
                                        <Line
                                            data={preparePerformanceChartData()}
                                            options={getChartOptions('Response Time')}
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Uptime Chart */}
                            <div className="chart-card">
                                <div className="chart-header">
                                    <h3><FiCheckCircle /> Uptime Distribution</h3>
                                    <span className="chart-subtitle">Overall uptime percentage</span>
                                </div>
                                <div className="chart-container donut">
                                    {prepareUptimeChartData() && (
                                        <Doughnut
                                            data={prepareUptimeChartData()}
                                            options={{
                                                ...getDoughnutChartOptions(),
                                                cutout: '70%'
                                            }}
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Error Rate Chart */}
                            <div className="chart-card full-width">
                                <div className="chart-header">
                                    <h3><FiAlertCircle /> Error Rate Over Time</h3>
                                    <span className="chart-subtitle">Percentage of failed requests</span>
                                </div>
                                <div className="chart-container">
                                    {prepareErrorChartData() && (
                                        <Bar
                                            data={prepareErrorChartData()}
                                            options={getChartOptions('Error Rate')}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'performance' && (
                    <div className="performance-content">
                        <div className="metrics-grid">
                            <div className="metric-card">
                                <div className="metric-icon">
                                    <FiClock />
                                </div>
                                <div className="metric-content">
                                    <div className="metric-label">P50 Response Time</div>
                                    <div className="metric-value">
                                        {dashboardData.currentMetrics?.p50ResponseTime || 0}ms
                                    </div>
                                </div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-icon">
                                    <FiClock />
                                </div>
                                <div className="metric-content">
                                    <div className="metric-label">P95 Response Time</div>
                                    <div className="metric-value">
                                        {dashboardData.currentMetrics?.p95ResponseTime || 0}ms
                                    </div>
                                </div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-icon">
                                    <FiClock />
                                </div>
                                <div className="metric-content">
                                    <div className="metric-label">P99 Response Time</div>
                                    <div className="metric-value">
                                        {dashboardData.currentMetrics?.p99ResponseTime || 0}ms
                                    </div>
                                </div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-icon">
                                    <FiActivity />
                                </div>
                                <div className="metric-content">
                                    <div className="metric-label">Error Rate</div>
                                    <div className="metric-value">
                                        {dashboardData.currentMetrics?.errorRate.toFixed(2) || 0}%
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="performance-details">
                            <h3>Performance Details</h3>
                            <div className="details-grid">
                                <div className="detail-row">
                                    <span className="detail-label">Min Response Time:</span>
                                    <span className="detail-value">
                                        {dashboardData.currentMetrics?.minResponseTime || 0}ms
                                    </span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Max Response Time:</span>
                                    <span className="detail-value">
                                        {dashboardData.currentMetrics?.maxResponseTime || 0}ms
                                    </span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Successful Requests:</span>
                                    <span className="detail-value success">
                                        {dashboardData.currentMetrics?.successfulRequests.toLocaleString() || 0}
                                    </span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Failed Requests:</span>
                                    <span className="detail-value error">
                                        {dashboardData.currentMetrics?.failedRequests.toLocaleString() || 0}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'anomalies' && (
                    <div className="anomalies-content">
                        {dashboardData.anomalies.length === 0 ? (
                            <div className="empty-state">
                                <FiCheckCircle className="empty-icon" />
                                <h3>No Anomalies Detected</h3>
                                <p>Your API is performing normally with no unusual patterns detected.</p>
                            </div>
                        ) : (
                            <div className="anomalies-list">
                                {dashboardData.anomalies.map((anomaly, index) => (
                                    <div
                                        key={index}
                                        className={`anomaly-card severity-${anomaly.severity}`}
                                    >
                                        <div className="anomaly-header">
                                            <div className="anomaly-icon">
                                                <FiAlertCircle />
                                            </div>
                                            <div className="anomaly-info">
                                                <h4>{anomaly.description}</h4>
                                                <span className={`severity-badge ${anomaly.severity}`}>
                                                    {anomaly.severity.toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="anomaly-timestamp">
                                                {new Date(anomaly.timestamp).toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="anomaly-details">
                                            <div className="detail-item">
                                                <span className="label">Type:</span>
                                                <span className="value">{anomaly.type.replace('_', ' ')}</span>
                                            </div>
                                            <div className="detail-item">
                                                <span className="label">Actual Value:</span>
                                                <span className="value">{anomaly.value}</span>
                                            </div>
                                            <div className="detail-item">
                                                <span className="label">Expected Value:</span>
                                                <span className="value">{anomaly.expectedValue}</span>
                                            </div>
                                            <div className="detail-item">
                                                <span className="label">Z-Score:</span>
                                                <span className="value">{anomaly.zScore}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'predictions' && (
                    <div className="predictions-content">
                        {!dashboardData.predictions ? (
                            <div className="empty-state">
                                <FiTarget className="empty-icon" />
                                <h3>Not Enough Data</h3>
                                <p>Predictions will be available once we have sufficient historical data.</p>
                            </div>
                        ) : (
                            <div className="predictions-grid">
                                <div className="prediction-card">
                                    <div className="prediction-icon">
                                        <FiZap />
                                    </div>
                                    <div className="prediction-content">
                                        <h4>Next Hour Response Time</h4>
                                        <div className="prediction-value">
                                            {dashboardData.predictions.nextHourResponseTime}ms
                                        </div>
                                        <div className="prediction-trend">
                                            {dashboardData.predictions.trendDirection === 'up' && (
                                                <span className="trend improving">
                                                    <FiTrendingUp /> Improving
                                                </span>
                                            )}
                                            {dashboardData.predictions.trendDirection === 'down' && (
                                                <span className="trend degrading">
                                                    <FiTrendingDown /> Degrading
                                                </span>
                                            )}
                                            {dashboardData.predictions.trendDirection === 'stable' && (
                                                <span className="trend stable">
                                                    Stable
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="prediction-card">
                                    <div className="prediction-icon">
                                        <FiAlertCircle />
                                    </div>
                                    <div className="prediction-content">
                                        <h4>Next Hour Error Rate</h4>
                                        <div className="prediction-value">
                                            {dashboardData.predictions.nextHourErrorRate}%
                                        </div>
                                    </div>
                                </div>

                                <div className="prediction-card">
                                    <div className="prediction-icon">
                                        <FiCheckCircle />
                                    </div>
                                    <div className="prediction-content">
                                        <h4>Predicted Uptime (Next Day)</h4>
                                        <div className="prediction-value">
                                            {dashboardData.predictions.nextDayUptime.toFixed(2)}%
                                        </div>
                                    </div>
                                </div>

                                <div className="confidence-card">
                                    <h4>Prediction Confidence</h4>
                                    <div className="confidence-bar">
                                        <div
                                            className="confidence-fill"
                                            style={{ width: `${dashboardData.predictions.confidence}%` }}
                                        >
                                            <span>{dashboardData.predictions.confidence}%</span>
                                        </div>
                                    </div>
                                    <p className="confidence-note">
                                        Based on {timeRange} of historical data
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AnalyticsDashboard;
