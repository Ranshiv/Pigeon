// client/src/components/ReportsDashboard.js
import React, { useState, useEffect } from 'react';
import {
    FiBarChart3, FiDownload, FiCalendar, FiClock,
    FiTrendingUp, FiAlertCircle, FiCheckCircle,
    FiRefreshCw, FiMail
} from 'react-icons/fi';
import './ReportsDashboard.css';

const ReportsDashboard = () => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState('7d');
    const [reportType, setReportType] = useState('all');
    const [scheduledReports, setScheduledReports] = useState([]);
    const [showScheduleForm, setShowScheduleForm] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);

                // Fetch reports
                const reportsQueryParams = new URLSearchParams({
                    dateRange,
                    type: reportType
                });

                const reportsResponse = await fetch(`/api/monitoring/reports?${reportsQueryParams}`, {
                    credentials: 'include'
                });

                if (reportsResponse.ok) {
                    const reportsData = await reportsResponse.json();
                    setReports(reportsData);
                }

                // Fetch scheduled reports
                const scheduledResponse = await fetch('/api/monitoring/scheduled-reports', {
                    credentials: 'include'
                });

                if (scheduledResponse.ok) {
                    const scheduledData = await scheduledResponse.json();
                    setScheduledReports(scheduledData);
                }
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [dateRange, reportType]);

    const refetchReports = async () => {
        try {
            setLoading(true);
            const queryParams = new URLSearchParams({
                dateRange,
                type: reportType
            });

            const response = await fetch(`/api/monitoring/reports?${queryParams}`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                setReports(data);
            }
        } catch (error) {
            console.error('Error fetching reports:', error);
        } finally {
            setLoading(false);
        }
    };

    const refetchScheduledReports = async () => {
        try {
            const response = await fetch('/api/monitoring/scheduled-reports', {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                setScheduledReports(data);
            }
        } catch (error) {
            console.error('Error fetching scheduled reports:', error);
        }
    };

    const generateReport = async (type, format = 'pdf') => {
        try {
            const response = await fetch('/api/monitoring/generate-report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    type,
                    format,
                    dateRange,
                    filters: { reportType }
                })
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${type}-report-${Date.now()}.${format}`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }
        } catch (error) {
            console.error('Error generating report:', error);
        }
    };

    const scheduleReport = async (scheduleData) => {
        try {
            const response = await fetch('/api/monitoring/schedule-report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(scheduleData)
            });

            if (response.ok) {
                refetchScheduledReports();
                setShowScheduleForm(false);
            }
        } catch (error) {
            console.error('Error scheduling report:', error);
        }
    };

    const deleteScheduledReport = async (reportId) => {
        if (!window.confirm('Are you sure you want to delete this scheduled report?')) return;

        try {
            const response = await fetch(`/api/monitoring/scheduled-reports/${reportId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                refetchScheduledReports();
            }
        } catch (error) {
            console.error('Error deleting scheduled report:', error);
        }
    };

    if (loading) {
        return (
            <div className="reports-dashboard">
                <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>Loading reports...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="reports-dashboard">
            <div className="reports-header">
                <div className="header-info">
                    <h1><FiBarChart3 /> Reports & Analytics</h1>
                    <p>Monitor performance trends and generate comprehensive reports</p>
                </div>
                <div className="header-actions">
                    <button
                        className="btn-refresh"
                        onClick={refetchReports}
                        title="Refresh reports"
                    >
                        <FiRefreshCw />
                    </button>
                    <button
                        className="btn-secondary"
                        onClick={() => setShowScheduleForm(true)}
                    >
                        <FiCalendar /> Schedule Report
                    </button>
                </div>
            </div>

            <div className="reports-filters">
                <div className="filter-group">
                    <label>Date Range</label>
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="filter-select"
                    >
                        <option value="24h">Last 24 Hours</option>
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                        <option value="90d">Last 90 Days</option>
                        <option value="1y">Last Year</option>
                        <option value="custom">Custom Range</option>
                    </select>
                </div>

                <div className="filter-group">
                    <label>Report Type</label>
                    <select
                        value={reportType}
                        onChange={(e) => setReportType(e.target.value)}
                        className="filter-select"
                    >
                        <option value="all">All Reports</option>
                        <option value="uptime">Uptime Reports</option>
                        <option value="performance">Performance Reports</option>
                        <option value="incidents">Incident Reports</option>
                        <option value="sla">SLA Reports</option>
                    </select>
                </div>
            </div>

            <div className="reports-grid">
                {/* Quick Actions */}
                <div className="quick-actions-card">
                    <h3><FiDownload /> Quick Reports</h3>
                    <div className="quick-actions">
                        <button
                            className="action-card"
                            onClick={() => generateReport('uptime', 'pdf')}
                        >
                            <FiCheckCircle className="action-icon uptime" />
                            <div className="action-content">
                                <h4>Uptime Report</h4>
                                <p>Service availability summary</p>
                            </div>
                        </button>

                        <button
                            className="action-card"
                            onClick={() => generateReport('performance', 'pdf')}
                        >
                            <FiTrendingUp className="action-icon performance" />
                            <div className="action-content">
                                <h4>Performance Report</h4>
                                <p>Response time analysis</p>
                            </div>
                        </button>

                        <button
                            className="action-card"
                            onClick={() => generateReport('incidents', 'pdf')}
                        >
                            <FiAlertCircle className="action-icon incidents" />
                            <div className="action-content">
                                <h4>Incidents Report</h4>
                                <p>Incident summary & trends</p>
                            </div>
                        </button>

                        <button
                            className="action-card"
                            onClick={() => generateReport('sla', 'pdf')}
                        >
                            <FiClock className="action-icon sla" />
                            <div className="action-content">
                                <h4>SLA Report</h4>
                                <p>Service level compliance</p>
                            </div>
                        </button>
                    </div>

                    <div className="export-options">
                        <h4>Export Options</h4>
                        <div className="export-buttons">
                            <button
                                className="export-btn pdf"
                                onClick={() => generateReport('comprehensive', 'pdf')}
                            >
                                <FiDownload /> PDF Report
                            </button>
                            <button
                                className="export-btn csv"
                                onClick={() => generateReport('comprehensive', 'csv')}
                            >
                                <FiDownload /> CSV Data
                            </button>
                            <button
                                className="export-btn excel"
                                onClick={() => generateReport('comprehensive', 'xlsx')}
                            >
                                <FiDownload /> Excel Report
                            </button>
                        </div>
                    </div>
                </div>

                {/* Scheduled Reports */}
                <div className="scheduled-reports-card">
                    <h3><FiCalendar /> Scheduled Reports</h3>
                    <div className="scheduled-list">
                        {scheduledReports.length === 0 ? (
                            <div className="empty-scheduled">
                                <p>No scheduled reports configured</p>
                                <button
                                    className="btn-primary"
                                    onClick={() => setShowScheduleForm(true)}
                                >
                                    Create Schedule
                                </button>
                            </div>
                        ) : (
                            scheduledReports.map(report => (
                                <div key={report._id} className="scheduled-item">
                                    <div className="scheduled-info">
                                        <h4>{report.name}</h4>
                                        <p className="schedule-details">
                                            {report.frequency} • {report.format.toUpperCase()} •
                                            {report.recipients.length} recipient(s)
                                        </p>
                                        <p className="next-run">
                                            Next run: {new Date(report.nextRun).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="scheduled-actions">
                                        <button
                                            className="action-btn"
                                            onClick={() => deleteScheduledReport(report._id)}
                                            title="Delete schedule"
                                        >
                                            ×
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Analytics Overview */}
                <div className="analytics-overview-card">
                    <h3><FiBarChart3 /> Analytics Overview</h3>
                    <div className="analytics-metrics">
                        <div className="metric-card">
                            <div className="metric-value">99.8%</div>
                            <div className="metric-label">Avg Uptime</div>
                            <div className="metric-trend positive">+0.2%</div>
                        </div>
                        <div className="metric-card">
                            <div className="metric-value">235ms</div>
                            <div className="metric-label">Avg Response</div>
                            <div className="metric-trend negative">+15ms</div>
                        </div>
                        <div className="metric-card">
                            <div className="metric-value">3</div>
                            <div className="metric-label">Incidents</div>
                            <div className="metric-trend positive">-2</div>
                        </div>
                        <div className="metric-card">
                            <div className="metric-value">98.5%</div>
                            <div className="metric-label">SLA Compliance</div>
                            <div className="metric-trend positive">+1.2%</div>
                        </div>
                    </div>
                </div>

                {/* Recent Reports */}
                <div className="recent-reports-card">
                    <h3><FiClock /> Recent Reports</h3>
                    <div className="recent-list">
                        {reports.length === 0 ? (
                            <div className="empty-reports">
                                <p>No reports generated recently</p>
                            </div>
                        ) : (
                            reports.map(report => (
                                <div key={report._id} className="report-item">
                                    <div className="report-info">
                                        <h4>{report.name}</h4>
                                        <p className="report-details">
                                            {report.type} • {report.format.toUpperCase()} •
                                            {new Date(report.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="report-actions">
                                        <button
                                            className="download-btn"
                                            onClick={() => window.open(report.downloadUrl)}
                                            title="Download report"
                                        >
                                            <FiDownload />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {showScheduleForm && (
                <ScheduleReportForm
                    onSave={scheduleReport}
                    onClose={() => setShowScheduleForm(false)}
                />
            )}
        </div>
    );
};

const ScheduleReportForm = ({ onSave, onClose }) => {
    const [formData, setFormData] = useState({
        name: '',
        type: 'uptime',
        format: 'pdf',
        frequency: 'weekly',
        dayOfWeek: 1,
        dayOfMonth: 1,
        time: '09:00',
        recipients: [''],
        includeCharts: true,
        includeMetrics: true,
        includeIncidents: true
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        const cleanedData = {
            ...formData,
            recipients: formData.recipients.filter(email => email.trim())
        };
        onSave(cleanedData);
    };

    const addRecipient = () => {
        setFormData(prev => ({
            ...prev,
            recipients: [...prev.recipients, '']
        }));
    };

    const updateRecipient = (index, value) => {
        setFormData(prev => ({
            ...prev,
            recipients: prev.recipients.map((email, i) => i === index ? value : email)
        }));
    };

    const removeRecipient = (index) => {
        setFormData(prev => ({
            ...prev,
            recipients: prev.recipients.filter((_, i) => i !== index)
        }));
    };

    return (
        <div className="modal-overlay">
            <div className="schedule-form-modal">
                <div className="modal-header">
                    <h2><FiCalendar /> Schedule Report</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <form onSubmit={handleSubmit} className="schedule-form">
                    <div className="form-group">
                        <label>Report Name</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            required
                            placeholder="Monthly Performance Report"
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Report Type</label>
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                            >
                                <option value="uptime">Uptime Report</option>
                                <option value="performance">Performance Report</option>
                                <option value="incidents">Incidents Report</option>
                                <option value="sla">SLA Report</option>
                                <option value="comprehensive">Comprehensive Report</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Format</label>
                            <select
                                value={formData.format}
                                onChange={(e) => setFormData(prev => ({ ...prev, format: e.target.value }))}
                            >
                                <option value="pdf">PDF</option>
                                <option value="csv">CSV</option>
                                <option value="xlsx">Excel</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Frequency</label>
                            <select
                                value={formData.frequency}
                                onChange={(e) => setFormData(prev => ({ ...prev, frequency: e.target.value }))}
                            >
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Time</label>
                            <input
                                type="time"
                                value={formData.time}
                                onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                            />
                        </div>
                    </div>

                    {formData.frequency === 'weekly' && (
                        <div className="form-group">
                            <label>Day of Week</label>
                            <select
                                value={formData.dayOfWeek}
                                onChange={(e) => setFormData(prev => ({ ...prev, dayOfWeek: parseInt(e.target.value) }))}
                            >
                                <option value={1}>Monday</option>
                                <option value={2}>Tuesday</option>
                                <option value={3}>Wednesday</option>
                                <option value={4}>Thursday</option>
                                <option value={5}>Friday</option>
                                <option value={6}>Saturday</option>
                                <option value={0}>Sunday</option>
                            </select>
                        </div>
                    )}

                    {formData.frequency === 'monthly' && (
                        <div className="form-group">
                            <label>Day of Month</label>
                            <input
                                type="number"
                                min="1"
                                max="28"
                                value={formData.dayOfMonth}
                                onChange={(e) => setFormData(prev => ({ ...prev, dayOfMonth: parseInt(e.target.value) }))}
                            />
                        </div>
                    )}

                    <div className="form-group">
                        <label>Email Recipients</label>
                        {formData.recipients.map((email, index) => (
                            <div key={index} className="recipient-input">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => updateRecipient(index, e.target.value)}
                                    placeholder="user@example.com"
                                />
                                <button
                                    type="button"
                                    className="remove-recipient"
                                    onClick={() => removeRecipient(index)}
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                        <button
                            type="button"
                            className="add-recipient"
                            onClick={addRecipient}
                        >
                            + Add Recipient
                        </button>
                    </div>

                    <div className="form-group">
                        <label>Include in Report</label>
                        <div className="checkbox-group">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={formData.includeCharts}
                                    onChange={(e) => setFormData(prev => ({ ...prev, includeCharts: e.target.checked }))}
                                />
                                Charts and Graphs
                            </label>
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={formData.includeMetrics}
                                    onChange={(e) => setFormData(prev => ({ ...prev, includeMetrics: e.target.checked }))}
                                />
                                Detailed Metrics
                            </label>
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={formData.includeIncidents}
                                    onChange={(e) => setFormData(prev => ({ ...prev, includeIncidents: e.target.checked }))}
                                />
                                Incident Summary
                            </label>
                        </div>
                    </div>

                    <div className="form-actions">
                        <button type="button" className="btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-primary">
                            <FiMail /> Schedule Report
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ReportsDashboard;
