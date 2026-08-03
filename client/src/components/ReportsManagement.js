// client/src/components/ReportsManagement.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FiFileText, FiPlus, FiEdit, FiTrash2, FiDownload,
    FiClock, FiMail, FiCalendar, FiBarChart, FiTrendingUp,
    FiSettings, FiActivity, FiUsers, FiTool, FiCheckCircle, FiEye, FiBell,
    FiSave, FiX, FiAlertTriangle
} from 'react-icons/fi';
import { Sparkles } from 'lucide-react';
import './ReportsManagement.css';
import AppSelect from './common/AppSelect/AppSelect';
import PageLoader from './common/PageLoader/PageLoader';

const REPORT_TYPES = [
    { value: 'uptime', label: 'Uptime Report' },
    { value: 'performance', label: 'Performance Report' },
    { value: 'sla', label: 'SLA Report' },
    { value: 'custom', label: 'Custom Report' }
];

const DATE_RANGES = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' }
];

const FREQUENCIES = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' }
];

const DAYS_OF_WEEK = [
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
    { value: 0, label: 'Sunday' }
];

const RECIPIENT_FORMATS = [
    { value: 'pdf', label: 'PDF' },
    { value: 'html', label: 'HTML' },
    { value: 'csv', label: 'CSV' }
];

const CONTENT_OPTIONS = [
    { key: 'includeExecutiveSummary', label: 'Executive Summary' },
    { key: 'includeUptimeCharts', label: 'Uptime Charts' },
    { key: 'includePerformanceMetrics', label: 'Performance Metrics' },
    { key: 'includeIncidentSummary', label: 'Incident Summary' },
    { key: 'includeSLACompliance', label: 'SLA Compliance' },
];

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
        schedule: { frequency: 'weekly', dayOfWeek: 1, dayOfMonth: 1, time: '09:00', timezone: 'UTC' },
        filters: { monitorIds: [], tags: [], dateRange: '30d' },
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
            const response = await fetch('/api/reports', { credentials: 'include' });
            if (response.ok) setReports(await response.json());
        } catch (error) {
            console.error('Error fetching reports:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchTemplates = async () => {
        try {
            const response = await fetch('/api/reports/templates/list', { credentials: 'include' });
            if (response.ok) setTemplates(await response.json());
            else setDefaultTemplates();
        } catch (error) {
            console.error('Error fetching templates:', error);
            setDefaultTemplates();
        }
    };

    const setDefaultTemplates = () => {
        setTemplates([
            {
                id: 'weekly-uptime', name: 'Weekly Uptime Report',
                description: 'Weekly summary of uptime and performance metrics', type: 'uptime',
                schedule: { frequency: 'weekly', dayOfWeek: 1, time: '09:00' },
                template: { includeExecutiveSummary: true, includeUptimeCharts: true, includePerformanceMetrics: true, includeIncidentSummary: true, includeSLACompliance: false }
            },
            {
                id: 'monthly-sla', name: 'Monthly SLA Report',
                description: 'Monthly SLA compliance and performance report', type: 'sla',
                schedule: { frequency: 'monthly', dayOfMonth: 1, time: '08:00' },
                template: { includeExecutiveSummary: true, includeUptimeCharts: true, includePerformanceMetrics: true, includeIncidentSummary: true, includeSLACompliance: true }
            }
        ]);
    };

    const handleCreateReport = () => {
        setEditingReport(null);
        setFormData({
            name: '', type: 'uptime',
            schedule: { frequency: 'weekly', dayOfWeek: 1, dayOfMonth: 1, time: '09:00', timezone: 'UTC' },
            filters: { monitorIds: [], tags: [], dateRange: '30d' },
            recipients: [],
            template: { includeExecutiveSummary: true, includeUptimeCharts: true, includePerformanceMetrics: true, includeIncidentSummary: true, includeSLACompliance: false },
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
                method, headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                body: JSON.stringify(formData)
            });
            if (response.ok) { await fetchReports(); setShowCreateForm(false); setEditingReport(null); }
            else { const error = await response.json(); alert(`Error: ${error.message}`); }
        } catch (error) {
            console.error('Error saving report:', error);
            alert('Error saving report. Please try again.');
        }
    };

    const handleDeleteReport = async (reportId) => {
        if (!window.confirm('Are you sure you want to delete this report?')) return;
        try {
            const response = await fetch(`/api/reports/${reportId}`, { method: 'DELETE', credentials: 'include' });
            if (response.ok) await fetchReports();
            else { const error = await response.json(); alert(`Error: ${error.message}`); }
        } catch (error) {
            console.error('Error deleting report:', error);
            alert('Error deleting report. Please try again.');
        }
    };

    const handleGenerateReport = async (reportId) => {
        try {
            const response = await fetch(`/api/reports/${reportId}/generate`, { method: 'POST', credentials: 'include' });
            if (response.ok) { const result = await response.json(); alert(result.message); }
            else { const error = await response.json(); alert(`Error: ${error.message}`); }
        } catch (error) {
            console.error('Error generating report:', error);
            alert('Error generating report. Please try again.');
        }
    };

    const handleUseTemplate = (template) => {
        setFormData({
            ...formData,
            name: template.name, type: template.type,
            schedule: template.schedule, template: template.template
        });
        setShowCreateForm(true);
    };

    const addRecipient = () => {
        setFormData({ ...formData, recipients: [...formData.recipients, { email: '', format: 'pdf' }] });
    };

    const removeRecipient = (index) => {
        setFormData({ ...formData, recipients: formData.recipients.filter((_, i) => i !== index) });
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

    const getStatusBadge = (isActive) => (
        <span className={`rpt-badge ${isActive ? 'active' : 'inactive'}`}>
            {isActive ? 'Active' : 'Inactive'}
        </span>
    );

    if (loading) {
        return (
            <div className="rpt-root rpt-loading">
                <PageLoader label="Loading reports..." />
            </div>
        );
    }

    return (
        <div className="rpt-root">
            {/* Header */}
            <div className="rpt-header">
                <div className="rpt-header-left">
                    <div className="rpt-header-icon" aria-hidden="true"><FiFileText /></div>
                    <div className="rpt-header-info">
                        <h1>Reports & Analytics</h1>
                        <p>Create and manage automated monitoring reports with advanced scheduling and customization</p>
                    </div>
                </div>
                <button className="rpt-btn-primary" onClick={handleCreateReport}>
                    <FiPlus /> Create Report
                </button>
            </div>

            {/* Navigation Tabs */}
            <div className="rpt-nav">
                <button className="rpt-nav-btn" onClick={() => navigate('/workspace/monitoring/copilot')}>
                    <Sparkles /> Operations Copilot
                </button>
                <button className="rpt-nav-btn" onClick={() => navigate('/workspace/monitoring')}>
                    <FiActivity /> Dashboard
                </button>
                <button className="rpt-nav-btn" onClick={() => navigate('/workspace/monitoring/policies')}>
                    <FiBell /> Alerts & Policies
                </button>
                <button className="rpt-nav-btn" onClick={() => navigate('/workspace/monitoring/incidents')}>
                    <FiAlertTriangle /> Incidents
                </button>
                <button className="rpt-nav-btn active" onClick={() => navigate('/workspace/monitoring/reports')}>
                    <FiBarChart /> Reports
                </button>
                <button className="rpt-nav-btn" onClick={() => navigate('/workspace/monitoring/teams')}>
                    <FiUsers /> Teams
                </button>
                <button className="rpt-nav-btn" onClick={() => navigate('/workspace/monitoring/integrations')}>
                    <FiSettings /> Integrations
                </button>
                <button className="rpt-nav-btn" onClick={() => navigate('/workspace/monitoring/maintenance')}>
                    <FiTool /> Maintenance
                </button>
            </div>

            {/* Quick Start Templates */}
            {templates.length > 0 && (
                <div className="rpt-templates">
                    <h3>Quick Start Templates</h3>
                    <div className="rpt-templates-grid">
                        {templates.map(template => (
                            <div key={template.id} className="rpt-template-card">
                                <div className="rpt-template-icon">
                                    {getReportTypeIcon(template.type)}
                                </div>
                                <div className="rpt-template-content">
                                    <h4>{template.name}</h4>
                                    <p>{template.description}</p>
                                    <div className="rpt-template-meta">
                                        <span>{getFrequencyLabel(template.schedule.frequency)}</span>
                                        <span>{template.type}</span>
                                    </div>
                                </div>
                                <button className="rpt-btn-secondary" onClick={() => handleUseTemplate(template)}>
                                    Use Template
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Layout */}
            <div className="rpt-layout">
                {/* List Panel */}
                <div className="rpt-list-panel">
                    <div className="rpt-list-head">
                        <h3>Reports</h3>
                        <span className="rpt-count">{reports.length} total</span>
                    </div>

                    <div className="rpt-items">
                        {reports.length === 0 ? (
                            <div className="rpt-empty">
                                <FiFileText className="rpt-empty-icon" />
                                <h3>No reports created yet</h3>
                                <p>Create your first automated monitoring report to get insights delivered to your inbox regularly</p>
                                <button className="rpt-btn-primary" onClick={handleCreateReport}>
                                    <FiPlus /> Create Your First Report
                                </button>
                            </div>
                        ) : (
                            reports.map(report => (
                                <div
                                    key={report._id}
                                    className={`rpt-item ${selectedReport?._id === report._id ? 'active' : ''}`}
                                    onClick={() => setSelectedReport(report)}
                                >
                                    <div className="rpt-item-head">
                                        <h4>{report.name}</h4>
                                        {getStatusBadge(report.isActive)}
                                    </div>
                                    <div className="rpt-meta">
                                        <div className="rpt-meta-item">
                                            <FiClock />
                                            <span>{getFrequencyLabel(report.schedule.frequency)}</span>
                                        </div>
                                        <div className="rpt-meta-item">
                                            <FiMail />
                                            <span>{report.recipients.length} recipient{report.recipients.length !== 1 ? 's' : ''}</span>
                                        </div>
                                        <div className="rpt-meta-item">
                                            <FiBarChart />
                                            <span>{report.type}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Details Panel */}
                <div className="rpt-details">
                    {selectedReport ? (
                        <div className="rpt-detail-content">
                            <div className="rpt-detail-head">
                                <div className="rpt-detail-info">
                                    <h2>{selectedReport.name}</h2>
                                    {getStatusBadge(selectedReport.isActive)}
                                </div>
                                <div className="rpt-detail-actions">
                                    <button className="rpt-btn-secondary" onClick={() => handleGenerateReport(selectedReport._id)} title="Generate Now">
                                        <FiDownload /> Generate
                                    </button>
                                    <button className="rpt-btn-secondary" onClick={() => handleEditReport(selectedReport)}>
                                        <FiEdit /> Edit
                                    </button>
                                    <button className="rpt-btn-secondary delete" onClick={() => handleDeleteReport(selectedReport._id)}>
                                        <FiTrash2 /> Delete
                                    </button>
                                </div>
                            </div>

                            <div className="rpt-detail-body">
                                <div className="rpt-section">
                                    <h3>Details</h3>
                                    <div className="rpt-info-grid">
                                        <div className="rpt-info-item">
                                            <label>Report Type</label>
                                            <span>{selectedReport.type}</span>
                                        </div>
                                        <div className="rpt-info-item">
                                            <label>Frequency</label>
                                            <span>{getFrequencyLabel(selectedReport.schedule.frequency)} at {selectedReport.schedule.time}</span>
                                        </div>
                                        <div className="rpt-info-item">
                                            <label>Recipients</label>
                                            <span>{selectedReport.recipients.length} recipient{selectedReport.recipients.length !== 1 ? 's' : ''}</span>
                                        </div>
                                        <div className="rpt-info-item">
                                            <label>Last Generated</label>
                                            <span>
                                                {selectedReport.lastGenerated
                                                    ? new Date(selectedReport.lastGenerated).toLocaleDateString()
                                                    : 'Never generated'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {selectedReport.nextScheduled && (
                                    <div className="rpt-section">
                                        <h3>Next Run</h3>
                                        <p>{new Date(selectedReport.nextScheduled).toLocaleString()}</p>
                                    </div>
                                )}

                                <div className="rpt-section">
                                    <h3>Recipients</h3>
                                    <div className="rpt-recipients">
                                        {selectedReport.recipients.map((recipient, index) => (
                                            <div key={index} className="rpt-recipient">
                                                <div className="rpt-recipient-info">
                                                    <span className="rpt-recipient-email">{recipient.email}</span>
                                                    <span className="rpt-recipient-format">{recipient.format?.toUpperCase()}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="rpt-section">
                                    <h3>Report Content</h3>
                                    <div className="rpt-content-options">
                                        {CONTENT_OPTIONS.map(opt => selectedReport.template?.[opt.key] && (
                                            <div key={opt.key} className="rpt-content-item enabled">
                                                <FiCheckCircle />
                                                <span>{opt.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="rpt-no-selection">
                            <FiEye className="rpt-empty-icon" />
                            <h3>Select a Report</h3>
                            <p>Choose a report from the list to view details and manage settings</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Create/Edit Report Modal */}
            {showCreateForm && (
                <div className="rpt-overlay">
                    <div className="rpt-modal">
                        <div className="rpt-modal-head">
                            <h2>
                                {editingReport ? 'Edit Report' : 'Create New Report'}
                            </h2>
                            <button className="rpt-modal-close" onClick={() => setShowCreateForm(false)}>
                                <FiX />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="rpt-form">
                            {/* Basic Info */}
                            <div className="rpt-form-section">
                                <h4>Basic Information</h4>
                                <div className="rpt-field">
                                    <label>Report Name *</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                        placeholder="e.g., Weekly Uptime Report"
                                    />
                                </div>

                                <div className="rpt-form-row">
                                    <div className="rpt-field">
                                        <label>Report Type</label>
                                        <AppSelect
                                            value={formData.type}
                                            onChange={(v) => setFormData({ ...formData, type: v })}
                                            options={REPORT_TYPES}
                                        />
                                    </div>
                                    <div className="rpt-field">
                                        <label>Date Range</label>
                                        <AppSelect
                                            value={formData.filters.dateRange}
                                            onChange={(v) => setFormData({
                                                ...formData,
                                                filters: { ...formData.filters, dateRange: v }
                                            })}
                                            options={DATE_RANGES}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Schedule */}
                            <div className="rpt-form-section">
                                <h4>Schedule</h4>
                                <div className="rpt-form-row">
                                    <div className="rpt-field">
                                        <label>Frequency</label>
                                        <AppSelect
                                            value={formData.schedule.frequency}
                                            onChange={(v) => setFormData({
                                                ...formData,
                                                schedule: { ...formData.schedule, frequency: v }
                                            })}
                                            options={FREQUENCIES}
                                        />
                                    </div>

                                    {formData.schedule.frequency === 'weekly' && (
                                        <div className="rpt-field">
                                            <label>Day of Week</label>
                                            <AppSelect
                                                value={formData.schedule.dayOfWeek}
                                                onChange={(v) => setFormData({
                                                    ...formData,
                                                    schedule: { ...formData.schedule, dayOfWeek: v }
                                                })}
                                                options={DAYS_OF_WEEK}
                                            />
                                        </div>
                                    )}

                                    {formData.schedule.frequency === 'monthly' && (
                                        <div className="rpt-field">
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

                                    <div className="rpt-field">
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
                            <div className="rpt-form-section">
                                <h4>Recipients</h4>
                                {formData.recipients.map((recipient, index) => (
                                    <div key={index} className="rpt-recipient-row">
                                        <input
                                            type="email"
                                            placeholder="Email address"
                                            value={recipient.email}
                                            onChange={(e) => updateRecipient(index, 'email', e.target.value)}
                                            required
                                        />
                                        <AppSelect
                                            value={recipient.format}
                                            onChange={(v) => updateRecipient(index, 'format', v)}
                                            options={RECIPIENT_FORMATS}
                                        />
                                        <button
                                            type="button"
                                            className="rpt-remove-btn"
                                            onClick={() => removeRecipient(index)}
                                            title="Remove recipient"
                                        >
                                            <FiTrash2 />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    className="rpt-add-recipient"
                                    onClick={addRecipient}
                                >
                                    <FiPlus /> Add Recipient
                                </button>
                            </div>

                            {/* Template Options */}
                            <div className="rpt-form-section">
                                <h4>Report Content</h4>
                                <div className="rpt-checkbox-group">
                                    {CONTENT_OPTIONS.map(opt => (
                                        <label key={opt.key} className="rpt-checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={formData.template[opt.key]}
                                                onChange={(e) => setFormData({
                                                    ...formData,
                                                    template: { ...formData.template, [opt.key]: e.target.checked }
                                                })}
                                            />
                                            {opt.label}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="rpt-form-actions">
                                <button type="button" className="rpt-btn-secondary" onClick={() => setShowCreateForm(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="rpt-btn-primary">
                                    <FiSave /> {editingReport ? 'Update Report' : 'Create Report'}
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