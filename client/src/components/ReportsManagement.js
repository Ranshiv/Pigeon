// client/src/components/ReportsManagement.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FiFileText, FiPlus, FiEdit, FiTrash2, FiDownload,
    FiClock, FiMail, FiCalendar, FiBarChart, FiTrendingUp,
    FiSettings, FiActivity, FiUsers, FiTool, FiCheckCircle, FiEye, FiBell
} from 'react-icons/fi';
import './ReportsManagement.css';

const ReportsManagement = () => {
    const navigate = useNavigate();
    const [reports, setReports] = useState([]);
    const [selectedReport, setSelectedReport] = useState(null);
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingReport, setEditingReport] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        type: 'uptime',
        schedule: {
            frequency: 'weekly',
            dayOfWeek: 1,
            dayOfMonth: 1,
            time: '09:00',
            timezone: 'UTC'
        },
        filters: {
            monitorIds: [],
            tags: [],
            dateRange: '30d'
        },
        recipients: [],
        template: {
            includeExecutiveSummary: true,
            includeUptimeCharts: true,
            includePerformanceMetrics: true,
            includeIncidentSummary: true,
            includeSLACompliance: false
        },
        isActive: true
    });

    useEffect(() => {
        const initializeData = async () => {
            await fetchReports();
            await fetchTemplates();
        };
        initializeData();
    }, []);

    const fetchReports = async () => {
        try {
            const response = await fetch('/api/reports', {
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

    const fetchTemplates = async () => {
        try {
            const response = await fetch('/api/reports/templates/list', {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                setTemplates(data);
            } else {
                // Fallback to default templates if API fails
                setDefaultTemplates();
            }
        } catch (error) {
            console.error('Error fetching templates:', error);
            // Fallback to default templates if API fails
            setDefaultTemplates();
        }
    };

    const setDefaultTemplates = () => {
        const defaultTemplates = [
            {
                id: 'weekly-uptime',
                name: 'Weekly Uptime Report',
                description: 'Weekly summary of uptime and performance metrics',
                type: 'uptime',
                schedule: {
                    frequency: 'weekly',
                    dayOfWeek: 1,
                    time: '09:00'
                },
                template: {
                    includeExecutiveSummary: true,
                    includeUptimeCharts: true,
                    includePerformanceMetrics: true,
                    includeIncidentSummary: true,
                    includeSLACompliance: false
                }
            },
            {
                id: 'monthly-sla',
                name: 'Monthly SLA Report',
                description: 'Monthly SLA compliance and performance report',
                type: 'sla',
                schedule: {
                    frequency: 'monthly',
                    dayOfMonth: 1,
                    time: '08:00'
                },
                template: {
                    includeExecutiveSummary: true,
                    includeUptimeCharts: true,
                    includePerformanceMetrics: true,
                    includeIncidentSummary: true,
                    includeSLACompliance: true
                }
            }
        ];
        setTemplates(defaultTemplates);
    };

    const handleCreateReport = () => {
        setEditingReport(null);
        setFormData({
            name: '',
            type: 'uptime',
            schedule: {
                frequency: 'weekly',
                dayOfWeek: 1,
                dayOfMonth: 1,
                time: '09:00',
                timezone: 'UTC'
            },
            filters: {
                monitorIds: [],
                tags: [],
                dateRange: '30d'
            },
            recipients: [],
            template: {
                includeExecutiveSummary: true,
                includeUptimeCharts: true,
                includePerformanceMetrics: true,
                includeIncidentSummary: true,
                includeSLACompliance: false
            },
            isActive: true
        });
        setShowCreateForm(true);
    };

    const handleEditReport = (report) => {
        setEditingReport(report);
        setFormData(report);
        setShowCreateForm(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const url = editingReport ? `/api/reports/${editingReport._id}` : '/api/reports';
            const method = editingReport ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                await fetchReports();
                setShowCreateForm(false);
                setEditingReport(null);
            } else {
                const error = await response.json();
                alert(`Error: ${error.message}`);
            }
        } catch (error) {
            console.error('Error saving report:', error);
            alert('Error saving report. Please try again.');
        }
    };

    const handleDeleteReport = async (reportId) => {
        if (!window.confirm('Are you sure you want to delete this report?')) {
            return;
        }

        try {
            const response = await fetch(`/api/reports/${reportId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                await fetchReports();
            } else {
                const error = await response.json();
                alert(`Error: ${error.message}`);
            }
        } catch (error) {
            console.error('Error deleting report:', error);
            alert('Error deleting report. Please try again.');
        }
    };

    const handleGenerateReport = async (reportId) => {
        try {
            const response = await fetch(`/api/reports/${reportId}/generate`, {
                method: 'POST',
                credentials: 'include'
            });

            if (response.ok) {
                const result = await response.json();
                alert(result.message);
            } else {
                const error = await response.json();
                alert(`Error: ${error.message}`);
            }
        } catch (error) {
            console.error('Error generating report:', error);
            alert('Error generating report. Please try again.');
        }
    };

    const handleUseTemplate = (template) => {
        setFormData({
            ...formData,
            name: template.name,
            type: template.type,
            schedule: template.schedule,
            template: template.template
        });
        setShowCreateForm(true);
    };

    const addRecipient = () => {
        setFormData({
            ...formData,
            recipients: [
                ...formData.recipients,
                { email: '', format: 'pdf' }
            ]
        });
    };

    const removeRecipient = (index) => {
        const newRecipients = formData.recipients.filter((_, i) => i !== index);
        setFormData({ ...formData, recipients: newRecipients });
    };

    const updateRecipient = (index, field, value) => {
        const newRecipients = [...formData.recipients];
        newRecipients[index] = { ...newRecipients[index], [field]: value };
        setFormData({ ...formData, recipients: newRecipients });
    };

    const getReportTypeIcon = (type) => {
        switch (type) {
            case 'uptime': return <FiBarChart />;
            case 'performance': return <FiTrendingUp />;
            case 'sla': return <FiSettings />;
            default: return <FiFileText />;
        }
    };

    const getFrequencyLabel = (frequency) => {
        switch (frequency) {
            case 'daily': return 'Daily';
            case 'weekly': return 'Weekly';
            case 'monthly': return 'Monthly';
            default: return frequency;
        }
    };

    if (loading) {
        return (
            <div className="reports-management loading">
                <div className="loading-content">
                    <FiFileText className="loading-icon" />
                    <p>Loading reports...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="reports-management">
            <div className="reports-header">
                <div className="header-info">
                    <h1><FiFileText /> Reports & Analytics</h1>
                    <p>Create and manage automated monitoring reports with advanced scheduling and customization</p>
                </div>
                <button
                    className="btn-primary"
                    onClick={handleCreateReport}
                >
                    <FiPlus /> Create Report
                </button>
            </div>

            {/* Navigation Tabs */}
            <div className="monitoring-nav">
                <button
                    className="nav-btn"
                    onClick={() => navigate('/workspace/monitoring')}
                >
                    <FiActivity /> Dashboard
                </button>
                <button
                    className="nav-btn"
                    onClick={() => navigate('/alerts/policies')}
                >
                    <FiBell /> Alerts & Policies
                </button>
                <button
                    className="nav-btn active"
                    onClick={() => navigate('/workspace/monitoring/reports')}
                >
                    <FiBarChart /> Reports
                </button>
                <button
                    className="nav-btn"
                    onClick={() => navigate('/workspace/monitoring/teams')}
                >
                    <FiUsers /> Teams
                </button>
                <button
                    className="nav-btn"
                    onClick={() => navigate('/workspace/monitoring/integrations')}
                >
                    <FiSettings /> Integrations
                </button>
                <button
                    className="nav-btn"
                    onClick={() => navigate('/workspace/monitoring/maintenance')}
                >
                    <FiTool /> Maintenance
                </button>
            </div>

            {/* Quick Start Templates */}
            {templates.length > 0 && (
                <div className="templates-section">
                    <h3>Quick Start Templates</h3>
                    <div className="templates-grid">
                        {templates.map(template => (
                            <div key={template.id} className="template-card">
                                <div className="template-icon">
                                    {getReportTypeIcon(template.type)}
                                </div>
                                <div className="template-content">
                                    <h4>{template.name}</h4>
                                    <p>{template.description}</p>
                                    <div className="template-meta">
                                        <span>{getFrequencyLabel(template.schedule.frequency)}</span>
                                        <span>{template.type}</span>
                                    </div>
                                </div>
                                <button
                                    className="btn-secondary"
                                    onClick={() => handleUseTemplate(template)}
                                >
                                    Use Template
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="reports-layout">
                <div className="reports-list">
                    <div className="list-header">
                        <h3>Reports</h3>
                        <span className="count">{reports.length} total</span>
                    </div>

                    <div className="items-list">
                        {reports.length === 0 ? (
                            <div className="empty-state">
                                <FiFileText className="empty-icon" />
                                <h3>No reports created yet</h3>
                                <p>Create your first automated monitoring report to get insights delivered to your inbox regularly</p>
                                <button className="btn-primary" onClick={handleCreateReport}>
                                    <FiPlus /> Create Your First Report
                                </button>
                            </div>
                        ) : (
                            reports.map(report => (
                                <div
                                    key={report._id}
                                    className={`item ${selectedReport?._id === report._id ? 'active' : ''}`}
                                    onClick={() => setSelectedReport(report)}
                                >
                                    <div className="item-header">
                                        <h4>{report.name}</h4>
                                        <span className={`status-badge ${report.isActive ? 'active' : 'inactive'}`}>
                                            {report.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                    <div className="item-meta">
                                        <div className="meta-item">
                                            <FiClock />
                                            <span>{getFrequencyLabel(report.schedule.frequency)}</span>
                                        </div>
                                        <div className="meta-item">
                                            <FiMail />
                                            <span>{report.recipients.length} recipient{report.recipients.length !== 1 ? 's' : ''}</span>
                                        </div>
                                        <div className="meta-item">
                                            <FiBarChart />
                                            <span>{report.type}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="report-details">
                    {selectedReport ? (
                        <div className="detail-content">
                            <div className="detail-header">
                                <div className="detail-info">
                                    <h2>{selectedReport.name}</h2>
                                    <span className={`status-badge ${selectedReport.isActive ? 'active' : 'inactive'}`}>
                                        {selectedReport.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                <div className="detail-actions">
                                    <button
                                        className="btn-secondary"
                                        onClick={() => handleGenerateReport(selectedReport._id)}
                                        title="Generate Now"
                                    >
                                        <FiDownload /> Generate
                                    </button>
                                    <button
                                        className="btn-secondary"
                                        onClick={() => handleEditReport(selectedReport)}
                                    >
                                        <FiEdit /> Edit
                                    </button>
                                    <button
                                        className="btn-secondary delete"
                                        onClick={() => handleDeleteReport(selectedReport._id)}
                                    >
                                        <FiTrash2 /> Delete
                                    </button>
                                </div>
                            </div>

                            <div className="detail-body">
                                <div className="info-section">
                                    <h3>Details</h3>
                                    <div className="info-grid">
                                        <div className="info-item">
                                            <label>Report Type</label>
                                            <span>{selectedReport.type}</span>
                                        </div>
                                        <div className="info-item">
                                            <label>Frequency</label>
                                            <span>{getFrequencyLabel(selectedReport.schedule.frequency)} at {selectedReport.schedule.time}</span>
                                        </div>
                                        <div className="info-item">
                                            <label>Recipients</label>
                                            <span>{selectedReport.recipients.length} recipient{selectedReport.recipients.length !== 1 ? 's' : ''}</span>
                                        </div>
                                        <div className="info-item">
                                            <label>Last Generated</label>
                                            <span>
                                                {selectedReport.lastGenerated
                                                    ? new Date(selectedReport.lastGenerated).toLocaleDateString()
                                                    : 'Never generated'
                                                }
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {selectedReport.nextScheduled && (
                                    <div className="info-section">
                                        <h3>Next Run</h3>
                                        <p>{new Date(selectedReport.nextScheduled).toLocaleString()}</p>
                                    </div>
                                )}

                                <div className="info-section">
                                    <h3>Recipients</h3>
                                    <div className="recipients-list">
                                        {selectedReport.recipients.map((recipient, index) => (
                                            <div key={index} className="recipient-item">
                                                <div className="recipient-info">
                                                    <span className="email">{recipient.email}</span>
                                                    <span className="format">{recipient.format?.toUpperCase()}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="info-section">
                                    <h3>Report Content</h3>
                                    <div className="content-options">
                                        {selectedReport.template?.includeExecutiveSummary && (
                                            <div className="content-item enabled">
                                                <FiCheckCircle />
                                                <span>Executive Summary</span>
                                            </div>
                                        )}
                                        {selectedReport.template?.includeUptimeCharts && (
                                            <div className="content-item enabled">
                                                <FiCheckCircle />
                                                <span>Uptime Charts</span>
                                            </div>
                                        )}
                                        {selectedReport.template?.includePerformanceMetrics && (
                                            <div className="content-item enabled">
                                                <FiCheckCircle />
                                                <span>Performance Metrics</span>
                                            </div>
                                        )}
                                        {selectedReport.template?.includeIncidentSummary && (
                                            <div className="content-item enabled">
                                                <FiCheckCircle />
                                                <span>Incident Summary</span>
                                            </div>
                                        )}
                                        {selectedReport.template?.includeSLACompliance && (
                                            <div className="content-item enabled">
                                                <FiCheckCircle />
                                                <span>SLA Compliance</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="no-selection">
                            <FiEye className="empty-icon" />
                            <h3>Select a Report</h3>
                            <p>Choose a report from the list to view details and manage settings</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Create/Edit Report Modal */}
            {showCreateForm && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>
                                {editingReport ? 'Edit Report' : 'Create New Report'}
                            </h3>
                            <button
                                className="close-btn"
                                onClick={() => setShowCreateForm(false)}
                            >
                                ×
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="report-form">
                            {/* Basic Info */}
                            <div className="form-section">
                                <h4>Basic Information</h4>
                                <div className="form-group">
                                    <label>Report Name</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                        placeholder="e.g., Weekly Uptime Report"
                                    />
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Report Type</label>
                                        <select
                                            value={formData.type}
                                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                        >
                                            <option value="uptime">Uptime Report</option>
                                            <option value="performance">Performance Report</option>
                                            <option value="sla">SLA Report</option>
                                            <option value="custom">Custom Report</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Date Range</label>
                                        <select
                                            value={formData.filters.dateRange}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                filters: { ...formData.filters, dateRange: e.target.value }
                                            })}
                                        >
                                            <option value="7d">Last 7 days</option>
                                            <option value="30d">Last 30 days</option>
                                            <option value="90d">Last 90 days</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Schedule */}
                            <div className="form-section">
                                <h4>Schedule</h4>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Frequency</label>
                                        <select
                                            value={formData.schedule.frequency}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                schedule: { ...formData.schedule, frequency: e.target.value }
                                            })}
                                        >
                                            <option value="daily">Daily</option>
                                            <option value="weekly">Weekly</option>
                                            <option value="monthly">Monthly</option>
                                        </select>
                                    </div>

                                    {formData.schedule.frequency === 'weekly' && (
                                        <div className="form-group">
                                            <label>Day of Week</label>
                                            <select
                                                value={formData.schedule.dayOfWeek}
                                                onChange={(e) => setFormData({
                                                    ...formData,
                                                    schedule: { ...formData.schedule, dayOfWeek: parseInt(e.target.value) }
                                                })}
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

                                    {formData.schedule.frequency === 'monthly' && (
                                        <div className="form-group">
                                            <label>Day of Month</label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="31"
                                                value={formData.schedule.dayOfMonth}
                                                onChange={(e) => setFormData({
                                                    ...formData,
                                                    schedule: { ...formData.schedule, dayOfMonth: parseInt(e.target.value) }
                                                })}
                                            />
                                        </div>
                                    )}

                                    <div className="form-group">
                                        <label>Time</label>
                                        <input
                                            type="time"
                                            value={formData.schedule.time}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                schedule: { ...formData.schedule, time: e.target.value }
                                            })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Recipients */}
                            <div className="form-section">
                                <h4>Recipients</h4>
                                {formData.recipients.map((recipient, index) => (
                                    <div key={index} className="recipient-row">
                                        <input
                                            type="email"
                                            placeholder="Email address"
                                            value={recipient.email}
                                            onChange={(e) => updateRecipient(index, 'email', e.target.value)}
                                            required
                                        />
                                        <select
                                            value={recipient.format}
                                            onChange={(e) => updateRecipient(index, 'format', e.target.value)}
                                        >
                                            <option value="pdf">PDF</option>
                                            <option value="html">HTML</option>
                                            <option value="csv">CSV</option>
                                        </select>
                                        <button
                                            type="button"
                                            className="remove-btn"
                                            onClick={() => removeRecipient(index)}
                                        >
                                            <FiTrash2 />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    className="add-recipient-btn"
                                    onClick={addRecipient}
                                >
                                    <FiPlus /> Add Recipient
                                </button>
                            </div>

                            {/* Template Options */}
                            <div className="form-section">
                                <h4>Report Content</h4>
                                <div className="checkbox-group">
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={formData.template.includeExecutiveSummary}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                template: { ...formData.template, includeExecutiveSummary: e.target.checked }
                                            })}
                                        />
                                        Executive Summary
                                    </label>
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={formData.template.includeUptimeCharts}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                template: { ...formData.template, includeUptimeCharts: e.target.checked }
                                            })}
                                        />
                                        Uptime Charts
                                    </label>
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={formData.template.includePerformanceMetrics}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                template: { ...formData.template, includePerformanceMetrics: e.target.checked }
                                            })}
                                        />
                                        Performance Metrics
                                    </label>
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={formData.template.includeIncidentSummary}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                template: { ...formData.template, includeIncidentSummary: e.target.checked }
                                            })}
                                        />
                                        Incident Summary
                                    </label>
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={formData.template.includeSLACompliance}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                template: { ...formData.template, includeSLACompliance: e.target.checked }
                                            })}
                                        />
                                        SLA Compliance
                                    </label>
                                </div>
                            </div>

                            <div className="form-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowCreateForm(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary">
                                    {editingReport ? 'Update Report' : 'Create Report'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportsManagement;
