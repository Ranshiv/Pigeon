// client/src/components/IntegrationsManagement.js
import React, { useState, useEffect } from 'react';
import './IntegrationsManagement.css';
import {
    FiSettings, FiPlus, FiEdit, FiTrash2, FiCheck, FiX,
    FiMail, FiMessageSquare, FiBell, FiTool, FiExternalLink,
    FiKey, FiEye, FiEyeOff, FiRefreshCw, FiPlay,
    FiAlertCircle, FiCheckCircle, FiClock, FiActivity
} from 'react-icons/fi';

const IntegrationsManagement = () => {
    const [integrations, setIntegrations] = useState([]);
    const [selectedIntegration, setSelectedIntegration] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [testStatus, setTestStatus] = useState({});
    const [formData, setFormData] = useState({
        name: '',
        type: 'email',
        enabled: true,
        config: {}
    });

    const integrationTypes = {
        email: {
            name: 'Email',
            icon: <FiMail />,
            description: 'Send alerts via email',
            configFields: [
                { key: 'smtp_host', label: 'SMTP Host', type: 'text', required: true },
                { key: 'smtp_port', label: 'SMTP Port', type: 'number', required: true, default: 587 },
                { key: 'smtp_user', label: 'SMTP Username', type: 'text', required: true },
                { key: 'smtp_password', label: 'SMTP Password', type: 'password', required: true },
                { key: 'from_email', label: 'From Email', type: 'email', required: true },
                { key: 'use_tls', label: 'Use TLS', type: 'checkbox', default: true }
            ]
        },
        slack: {
            name: 'Slack',
            icon: <FiMessageSquare />,
            description: 'Send alerts to Slack channels',
            configFields: [
                { key: 'webhook_url', label: 'Webhook URL', type: 'url', required: true },
                { key: 'channel', label: 'Default Channel', type: 'text', required: false },
                { key: 'username', label: 'Bot Username', type: 'text', default: 'Pigeon Monitor' }
            ]
        },
        discord: {
            name: 'Discord',
            icon: <FiBell />,
            description: 'Send alerts to Discord channels',
            configFields: [
                { key: 'webhook_url', label: 'Webhook URL', type: 'url', required: true },
                { key: 'username', label: 'Bot Username', type: 'text', default: 'Pigeon Monitor' }
            ]
        },
        teams: {
            name: 'Microsoft Teams',
            icon: <FiActivity />,
            description: 'Send alerts to Teams channels',
            configFields: [
                { key: 'webhook_url', label: 'Webhook URL', type: 'url', required: true },
                { key: 'title_prefix', label: 'Message Title Prefix', type: 'text', default: '[ALERT]' }
            ]
        },
        pagerduty: {
            name: 'PagerDuty',
            icon: <FiTool />,
            description: 'Create incidents in PagerDuty',
            configFields: [
                { key: 'integration_key', label: 'Integration Key', type: 'text', required: true },
                { key: 'severity', label: 'Default Severity', type: 'select', options: ['info', 'warning', 'error', 'critical'], default: 'error' }
            ]
        },
        jira: {
            name: 'Jira',
            icon: <FiExternalLink />,
            description: 'Create tickets in Jira',
            configFields: [
                { key: 'base_url', label: 'Jira Base URL', type: 'url', required: true },
                { key: 'username', label: 'Username', type: 'text', required: true },
                { key: 'api_token', label: 'API Token', type: 'password', required: true },
                { key: 'project_key', label: 'Project Key', type: 'text', required: true },
                { key: 'issue_type', label: 'Issue Type', type: 'text', default: 'Bug' }
            ]
        },
        webhook: {
            name: 'Custom Webhook',
            icon: <FiSettings />,
            description: 'Send alerts to custom webhook endpoints',
            configFields: [
                { key: 'url', label: 'Webhook URL', type: 'url', required: true },
                { key: 'method', label: 'HTTP Method', type: 'select', options: ['POST', 'PUT'], default: 'POST' },
                { key: 'headers', label: 'Custom Headers (JSON)', type: 'textarea', placeholder: '{"Authorization": "Bearer token"}' },
                { key: 'timeout', label: 'Timeout (seconds)', type: 'number', default: 30 }
            ]
        }
    };

    useEffect(() => {
        fetchIntegrations();
    }, []);

    const fetchIntegrations = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/integrations', {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                setIntegrations(data);
            } else {
                setError('Failed to fetch integrations');
            }
        } catch (err) {
            setError('Error fetching integrations: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const createIntegration = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/integrations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                await fetchIntegrations();
                setShowCreateModal(false);
                resetForm();
            } else {
                const errorData = await response.json();
                setError(errorData.message || 'Failed to create integration');
            }
        } catch (err) {
            setError('Error creating integration: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const testIntegration = async (integrationId) => {
        setTestStatus({ ...testStatus, [integrationId]: 'testing' });
        try {
            const response = await fetch(`/api/integrations/${integrationId}/test`, {
                method: 'POST',
                credentials: 'include'
            });

            if (response.ok) {
                setTestStatus({ ...testStatus, [integrationId]: 'success' });
                setTimeout(() => {
                    setTestStatus({ ...testStatus, [integrationId]: null });
                }, 3000);
            } else {
                const errorData = await response.json();
                setTestStatus({ ...testStatus, [integrationId]: 'error' });
                setError(errorData.message || 'Test failed');
            }
        } catch (err) {
            setTestStatus({ ...testStatus, [integrationId]: 'error' });
            setError('Error testing integration: ' + err.message);
        }
    };

    const toggleIntegration = async (integrationId, enabled) => {
        try {
            const response = await fetch(`/api/integrations/${integrationId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ enabled })
            });

            if (response.ok) {
                await fetchIntegrations();
            } else {
                const errorData = await response.json();
                setError(errorData.message || 'Failed to update integration');
            }
        } catch (err) {
            setError('Error updating integration: ' + err.message);
        }
    };

    const deleteIntegration = async (integrationId) => {
        if (!window.confirm('Are you sure you want to delete this integration?')) return;

        try {
            const response = await fetch(`/api/integrations/${integrationId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                await fetchIntegrations();
                if (selectedIntegration?._id === integrationId) {
                    setSelectedIntegration(null);
                }
            } else {
                const errorData = await response.json();
                setError(errorData.message || 'Failed to delete integration');
            }
        } catch (err) {
            setError('Error deleting integration: ' + err.message);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            type: 'email',
            enabled: true,
            config: {}
        });
    };

    const updateFormConfig = (key, value) => {
        setFormData({
            ...formData,
            config: {
                ...formData.config,
                [key]: value
            }
        });
    };

    const renderConfigField = (field) => {
        const value = formData.config[field.key] || field.default || '';

        switch (field.type) {
            case 'password':
                return (
                    <div key={field.key} className="form-group">
                        <label>{field.label} {field.required && '*'}</label>
                        <div className="password-input">
                            <input
                                type="password"
                                value={value}
                                onChange={(e) => updateFormConfig(field.key, e.target.value)}
                                placeholder={field.placeholder}
                                required={field.required}
                            />
                        </div>
                    </div>
                );
            case 'checkbox':
                return (
                    <div key={field.key} className="form-group checkbox-group">
                        <label>
                            <input
                                type="checkbox"
                                checked={value}
                                onChange={(e) => updateFormConfig(field.key, e.target.checked)}
                            />
                            {field.label}
                        </label>
                    </div>
                );
            case 'select':
                return (
                    <div key={field.key} className="form-group">
                        <label>{field.label} {field.required && '*'}</label>
                        <select
                            value={value}
                            onChange={(e) => updateFormConfig(field.key, e.target.value)}
                            required={field.required}
                        >
                            {field.options.map(option => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
                    </div>
                );
            case 'textarea':
                return (
                    <div key={field.key} className="form-group">
                        <label>{field.label} {field.required && '*'}</label>
                        <textarea
                            value={value}
                            onChange={(e) => updateFormConfig(field.key, e.target.value)}
                            placeholder={field.placeholder}
                            required={field.required}
                        />
                    </div>
                );
            default:
                return (
                    <div key={field.key} className="form-group">
                        <label>{field.label} {field.required && '*'}</label>
                        <input
                            type={field.type}
                            value={value}
                            onChange={(e) => updateFormConfig(field.key, e.target.value)}
                            placeholder={field.placeholder}
                            required={field.required}
                        />
                    </div>
                );
        }
    };

    const getStatusIcon = (integration) => {
        if (!integration.enabled) return <FiX className="status-icon disabled" />;
        return <FiCheck className="status-icon enabled" />;
    };

    const getTestStatusIcon = (integrationId) => {
        const status = testStatus[integrationId];
        switch (status) {
            case 'testing':
                return <FiRefreshCw className="test-icon testing" />;
            case 'success':
                return <FiCheckCircle className="test-icon success" />;
            case 'error':
                return <FiAlertCircle className="test-icon error" />;
            default:
                return <FiPlay className="test-icon" />;
        }
    };

    if (loading && integrations.length === 0) {
        return (
            <div className="integrations-management">
                <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>Loading integrations...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="integrations-management">
            <div className="integrations-header">
                <div className="header-info">
                    <h1><FiSettings /> Integrations & Alert Channels</h1>
                    <p>Configure external services to receive monitoring alerts and notifications</p>
                </div>
                <button
                    className="btn-primary"
                    onClick={() => setShowCreateModal(true)}
                >
                    <FiPlus /> Add Integration
                </button>
            </div>

            {error && (
                <div className="error-banner">
                    <FiAlertCircle />
                    <span>{error}</span>
                    <button onClick={() => setError(null)}>Dismiss</button>
                </div>
            )}

            <div className="integrations-grid">
                {Object.entries(integrationTypes).map(([type, typeInfo]) => {
                    const userIntegrations = integrations.filter(i => i.type === type);

                    return (
                        <div key={type} className="integration-type-card">
                            <div className="type-header">
                                <div className="type-info">
                                    <div className="type-icon">{typeInfo.icon}</div>
                                    <div>
                                        <h3>{typeInfo.name}</h3>
                                        <p>{typeInfo.description}</p>
                                    </div>
                                </div>
                                <div className="type-badge">
                                    {userIntegrations.length} configured
                                </div>
                            </div>

                            <div className="type-integrations">
                                {userIntegrations.map(integration => (
                                    <div key={integration._id} className="integration-item">
                                        <div className="integration-info">
                                            <div className="integration-status">
                                                {getStatusIcon(integration)}
                                            </div>
                                            <div className="integration-details">
                                                <h4>{integration.name}</h4>
                                                <p className="integration-meta">
                                                    Created {new Date(integration.createdAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="integration-actions">
                                            <button
                                                className="action-btn test"
                                                onClick={() => testIntegration(integration._id)}
                                                title="Test integration"
                                            >
                                                {getTestStatusIcon(integration._id)}
                                            </button>
                                            <button
                                                className={`action-btn toggle ${integration.enabled ? 'enabled' : 'disabled'}`}
                                                onClick={() => toggleIntegration(integration._id, !integration.enabled)}
                                                title={integration.enabled ? 'Disable' : 'Enable'}
                                            >
                                                {integration.enabled ? <FiEye /> : <FiEyeOff />}
                                            </button>
                                            <button
                                                className="action-btn edit"
                                                onClick={() => setSelectedIntegration(integration)}
                                                title="Edit integration"
                                            >
                                                <FiEdit />
                                            </button>
                                            <button
                                                className="action-btn delete"
                                                onClick={() => deleteIntegration(integration._id)}
                                                title="Delete integration"
                                            >
                                                <FiTrash2 />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {userIntegrations.length === 0 && (
                                    <div className="no-integrations">
                                        <p>No {typeInfo.name.toLowerCase()} integrations configured</p>
                                        <button
                                            className="btn-secondary small"
                                            onClick={() => {
                                                setFormData({ ...formData, type });
                                                setShowCreateModal(true);
                                            }}
                                        >
                                            <FiPlus /> Add {typeInfo.name}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Create Integration Modal */}
            {showCreateModal && (
                <div className="modal-overlay">
                    <div className="modal-content large">
                        <div className="modal-header">
                            <h2>Add Integration</h2>
                            <button
                                className="modal-close"
                                onClick={() => {
                                    setShowCreateModal(false);
                                    resetForm();
                                }}
                            >
                                <FiX />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Integration Type</label>
                                <select
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value, config: {} })}
                                >
                                    {Object.entries(integrationTypes).map(([key, type]) => (
                                        <option key={key} value={key}>{type.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Integration Name</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g., Production Alerts"
                                    required
                                />
                            </div>

                            <div className="config-section">
                                <h3>Configuration</h3>
                                {integrationTypes[formData.type]?.configFields.map(renderConfigField)}
                            </div>

                            <div className="form-group checkbox-group">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={formData.enabled}
                                        onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                                    />
                                    Enable this integration
                                </label>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button
                                className="btn-secondary"
                                onClick={() => {
                                    setShowCreateModal(false);
                                    resetForm();
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-primary"
                                onClick={createIntegration}
                                disabled={!formData.name || loading}
                            >
                                <FiCheck /> Create Integration
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IntegrationsManagement;
