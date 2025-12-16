// client/src/components/IntegrationsManagement.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './IntegrationsManagement.css';
import {
    FiSettings, FiPlus, FiEdit, FiTrash2, FiCheck, FiX,
    FiAlertCircle, FiMail, FiMessageSquare, FiBell, FiActivity,
    FiTool, FiExternalLink, FiRefreshCw, FiPlay,
    FiBarChart, FiUsers, FiCheckCircle, FiEye, FiEyeOff
} from 'react-icons/fi';

const IntegrationsManagement = () => {
    // Transform frontend config keys to backend expected format
    const transformConfigForBackend = (type, config) => {
        const transformed = { ...config };

        // Map snake_case to camelCase for webhook integrations
        if (['slack', 'teams', 'discord', 'webhook'].includes(type)) {
            if (transformed.webhook_url) {
                transformed.webhookUrl = transformed.webhook_url;
                delete transformed.webhook_url;
            }
        }

        // Map other config transformations as needed
        if (transformed.smtp_host) {
            transformed.smtpHost = transformed.smtp_host;
            delete transformed.smtp_host;
        }
        if (transformed.smtp_port) {
            transformed.smtpPort = transformed.smtp_port;
            delete transformed.smtp_port;
        } else if (type === 'email') {
            // Set default SMTP port for email integrations
            transformed.smtpPort = 587;
        }
        if (transformed.smtp_user) {
            transformed.smtpUser = transformed.smtp_user;
            delete transformed.smtp_user;
        }
        if (transformed.smtp_pass) {
            transformed.smtpPass = transformed.smtp_pass;
            delete transformed.smtp_pass;
        }
        if (transformed.smtp_password) {
            transformed.smtpPass = transformed.smtp_password;
            delete transformed.smtp_password;
        }
        if (transformed.from_email) {
            transformed.fromEmail = transformed.from_email;
            delete transformed.from_email;
        }
        if (transformed.use_tls) {
            transformed.useTls = transformed.use_tls;
            delete transformed.use_tls;
        } else if (type === 'email') {
            // Set default TLS setting for email integrations
            transformed.useTls = true;
        }
        if (transformed.routing_key) {
            transformed.routingKey = transformed.routing_key;
            delete transformed.routing_key;
        }
        if (transformed.server_url) {
            transformed.serverUrl = transformed.server_url;
            delete transformed.server_url;
        }
        if (transformed.api_token) {
            transformed.apiToken = transformed.api_token;
            delete transformed.api_token;
        }
        if (transformed.project_key) {
            transformed.projectKey = transformed.project_key;
            delete transformed.project_key;
        }

        // Map Jira-specific fields
        if (transformed.base_url) {
            transformed.serverUrl = transformed.base_url;
            delete transformed.base_url;
        }
        if (transformed.issue_type) {
            transformed.issueType = transformed.issue_type;
            delete transformed.issue_type;
        }

        return transformed;
    };

    const navigate = useNavigate();
    const [integrations, setIntegrations] = useState([]);
    const [selectedIntegration, setSelectedIntegration] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [testStatus, setTestStatus] = useState({});
    const [formData, setFormData] = useState({
        name: '',
        type: 'email',
        enabled: true,
        config: {}
    });

    // Add state for current user
    const [currentUser, setCurrentUser] = useState(null);

    // Fetch current user data
    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const response = await fetch('/api/auth/check', {
                    credentials: 'include'
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.isAuthenticated && data.user) {
                        setCurrentUser(data.user);
                    }
                }
            } catch (err) {
                console.error('Error fetching user data:', err);
            }
        };

        fetchUserData();
    }, []);

    // Function to get smart defaults for email integration
    const getEmailDefaults = () => {
        const userEmail = currentUser?.email;

        if (!userEmail) {
            return {
                smtp_host: 'smtp.gmail.com',
                smtp_port: 587,
                smtp_user: '',
                smtp_password: '',
                from_email: '',
                use_tls: true
            };
        }

        // Detect email provider and set appropriate SMTP settings
        let smtpHost = 'smtp.gmail.com';
        let smtpPort = 587;

        if (userEmail.includes('@gmail.com')) {
            smtpHost = 'smtp.gmail.com';
            smtpPort = 587;
        } else if (userEmail.includes('@outlook.com') || userEmail.includes('@hotmail.com') || userEmail.includes('@live.com')) {
            smtpHost = 'smtp-mail.outlook.com';
            smtpPort = 587;
        } else if (userEmail.includes('@yahoo.com')) {
            smtpHost = 'smtp.mail.yahoo.com';
            smtpPort = 587;
        }
        // For other providers, default to Gmail settings as they're most common

        return {
            smtp_host: smtpHost,
            smtp_port: smtpPort,
            smtp_user: userEmail,
            smtp_password: '',
            from_email: userEmail,
            use_tls: true
        };
    };

    // Function to auto-fill integration form with smart defaults
    const createIntegrationWithDefaults = (type) => {
        let defaultConfig = {};

        if (type === 'email' && currentUser?.email) {
            defaultConfig = getEmailDefaults();
        }

        setFormData({
            name: integrationTypes[type]?.name || '',
            type: type,
            enabled: true,
            config: defaultConfig
        });

        setShowCreateModal(true);
    };

    const integrationTypes = {
        email: {
            name: 'Email',
            icon: <FiMail />,
            description: 'Send alerts via email',
            configFields: [
                { key: 'smtp_host', label: 'SMTP Host', type: 'text', required: true, placeholder: 'Auto-detected based on your email provider' },
                { key: 'smtp_port', label: 'SMTP Port', type: 'number', required: true, default: 587, placeholder: '587 (standard for TLS)' },
                { key: 'smtp_user', label: 'SMTP Username', type: 'email', required: true, placeholder: 'Auto-filled from your account email' },
                { key: 'smtp_password', label: 'SMTP Password', type: 'password', required: true, placeholder: 'Enter your email password or App Password' },
                { key: 'from_email', label: 'From Email Address', type: 'email', required: true, placeholder: 'Auto-filled from your account email' },
                { key: 'use_tls', label: 'Use TLS Encryption', type: 'checkbox', default: true }
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
                { key: 'serverUrl', label: 'Jira Base URL', type: 'url', required: true, placeholder: 'https://your-company.atlassian.net' },
                { key: 'username', label: 'Username (Email)', type: 'email', required: true, placeholder: 'your-email@company.com' },
                { key: 'apiToken', label: 'API Token', type: 'password', required: true, placeholder: 'Generate from Atlassian account settings' },
                { key: 'projectKey', label: 'Project Key', type: 'text', required: true, placeholder: 'e.g., PROJ, DEV, BUG' },
                { key: 'issueType', label: 'Issue Type', type: 'text', default: 'Bug', placeholder: 'Bug, Task, Story, etc.' }
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
                body: JSON.stringify({
                    ...formData,
                    configuration: transformConfigForBackend(formData.type, formData.config)
                })
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

    const updateIntegration = async () => {
        if (!selectedIntegration) return;

        setLoading(true);
        try {
            const response = await fetch(`/api/integrations/${selectedIntegration._id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    ...formData,
                    configuration: transformConfigForBackend(formData.type, formData.config)
                })
            });

            if (response.ok) {
                await fetchIntegrations();
                setShowEditModal(false);
                setSelectedIntegration(null);
                resetForm();
            } else {
                const errorData = await response.json();
                setError(errorData.message || 'Failed to update integration');
            }
        } catch (err) {
            setError('Error updating integration: ' + err.message);
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

    const editIntegration = (integration) => {
        console.log('Edit integration clicked:', integration);

        // Transform backend config to frontend format
        const frontendConfig = {};

        if (integration.configuration) {
            Object.entries(integration.configuration).forEach(([key, value]) => {
                // Convert camelCase back to snake_case for frontend
                switch (key) {
                    case 'serverUrl':
                        frontendConfig.serverUrl = value;
                        break;
                    case 'smtpHost':
                        frontendConfig.smtp_host = value;
                        break;
                    case 'smtpPort':
                        frontendConfig.smtp_port = value;
                        break;
                    case 'smtpUser':
                        frontendConfig.smtp_user = value;
                        break;
                    case 'smtpPass':
                        frontendConfig.smtp_password = value;
                        break;
                    case 'fromEmail':
                        frontendConfig.from_email = value;
                        break;
                    case 'useTls':
                        frontendConfig.use_tls = value;
                        break;
                    case 'webhookUrl':
                        frontendConfig.webhook_url = value;
                        break;
                    case 'routingKey':
                        frontendConfig.routing_key = value;
                        break;
                    case 'apiToken':
                        frontendConfig.apiToken = value;
                        break;
                    case 'projectKey':
                        frontendConfig.projectKey = value;
                        break;
                    case 'issueType':
                        frontendConfig.issueType = value;
                        break;
                    default:
                        frontendConfig[key] = value;
                }
            });
        }

        const newFormData = {
            name: integration.name,
            type: integration.type,
            enabled: integration.enabled,
            config: frontendConfig
        };

        console.log('Setting form data:', newFormData);
        console.log('Frontend config:', frontendConfig);

        setFormData(newFormData);
        setSelectedIntegration(integration);
        setShowEditModal(true);
        console.log('Edit modal should be showing now');
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
                    onClick={() => createIntegrationWithDefaults('email')}
                >
                    <FiPlus /> Add Integration
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
                    className="nav-btn"
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
                    className="nav-btn active"
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
                                                onClick={() => editIntegration(integration)}
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
                                            onClick={() => createIntegrationWithDefaults(type)}
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
                                    onChange={(e) => {
                                        const newType = e.target.value;
                                        let defaultConfig = {};

                                        // Auto-fill with smart defaults based on type
                                        if (newType === 'email' && currentUser?.email) {
                                            defaultConfig = getEmailDefaults();
                                        }

                                        setFormData({
                                            ...formData,
                                            type: newType,
                                            config: defaultConfig,
                                            name: integrationTypes[newType]?.name || ''
                                        });
                                    }}
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

                                {/* Show helpful note for email integration */}
                                {formData.type === 'email' && currentUser?.email && (
                                    <div className="config-note" data-integration="email">
                                        <div className="note-icon">💡</div>
                                        <div className="note-content">
                                            <strong>Smart Setup:</strong> We've auto-detected your email settings for {currentUser.email}.
                                            {currentUser.email.includes('@gmail.com') && (
                                                <>You only need to enter your Gmail App Password to complete the setup.</>
                                            )}
                                            {(currentUser.email.includes('@outlook.com') || currentUser.email.includes('@hotmail.com') || currentUser.email.includes('@live.com')) && (
                                                <>You only need to enter your Outlook/Hotmail password to complete the setup.</>
                                            )}
                                            {currentUser.email.includes('@yahoo.com') && (
                                                <>You only need to enter your Yahoo App Password to complete the setup.</>
                                            )}
                                            {!currentUser.email.includes('@gmail.com') && !currentUser.email.includes('@outlook.com') && !currentUser.email.includes('@hotmail.com') && !currentUser.email.includes('@live.com') && !currentUser.email.includes('@yahoo.com') && (
                                                <>Settings have been configured with Gmail defaults. You may need to adjust the SMTP settings for your email provider.</>
                                            )}
                                            <br />
                                            {currentUser.email.includes('@gmail.com') && (
                                                <a
                                                    href="https://support.google.com/accounts/answer/185833"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ color: '#014C75' }}
                                                >
                                                    How to generate Gmail App Password →
                                                </a>
                                            )}
                                            {currentUser.email.includes('@yahoo.com') && (
                                                <a
                                                    href="https://help.yahoo.com/kb/generate-third-party-passwords-sln15241.html"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ color: '#014C75' }}
                                                >
                                                    How to generate Yahoo App Password →
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Teams Integration Smart Setup */}
                                {formData.type === 'teams' && (
                                    <div className="config-note" data-integration="teams">
                                        <div className="note-icon">🚀</div>
                                        <div className="note-content">
                                            <strong>Teams Quick Setup:</strong> Follow these steps to create a webhook URL:
                                            <ol style={{ marginTop: '8px', paddingLeft: '20px' }}>
                                                <li>Open your Teams channel</li>
                                                <li>Click the <strong>three dots (⋯)</strong> next to the channel name</li>
                                                <li>Select <strong>"Connectors"</strong> or <strong>"Workflows"</strong></li>
                                                <li>Search for <strong>"Incoming Webhook"</strong> and configure</li>
                                                <li>Copy the generated webhook URL and paste below</li>
                                            </ol>
                                            <a
                                                href="https://docs.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ color: '#014C75' }}
                                            >
                                                📋 Official Microsoft Teams webhook guide →
                                            </a>
                                        </div>
                                    </div>
                                )}

                                {/* Discord Integration Smart Setup */}
                                {formData.type === 'discord' && (
                                    <div className="config-note" data-integration="discord">
                                        <div className="note-icon">🎮</div>
                                        <div className="note-content">
                                            <strong>Discord Quick Setup:</strong> Get your webhook URL in 3 easy steps:
                                            <ol style={{ marginTop: '8px', paddingLeft: '20px' }}>
                                                <li>Go to your Discord channel settings (gear icon)</li>
                                                <li>Click <strong>"Integrations"</strong> → <strong>"Webhooks"</strong> → <strong>"New Webhook"</strong></li>
                                                <li>Copy the webhook URL and paste below</li>
                                            </ol>
                                            <div style={{ marginTop: '8px', padding: '8px', backgroundColor: 'rgba(88, 101, 242, 0.1)', borderRadius: '4px' }}>
                                                💡 <strong>Tip:</strong> Your webhook URL should look like: <code>https://discord.com/api/webhooks/...</code>
                                            </div>
                                            <a
                                                href="https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ color: '#014C75' }}
                                            >
                                                🔗 Discord webhooks documentation →
                                            </a>
                                        </div>
                                    </div>
                                )}

                                {/* Slack Integration Smart Setup */}
                                {formData.type === 'slack' && (
                                    <div className="config-note" data-integration="slack">
                                        <div className="note-icon">💬</div>
                                        <div className="note-content">
                                            <strong>Slack Quick Setup:</strong> Create an incoming webhook:
                                            <ol style={{ marginTop: '8px', paddingLeft: '20px' }}>
                                                <li>Go to <strong>api.slack.com</strong> → <strong>"Create an app"</strong></li>
                                                <li>Choose <strong>"From scratch"</strong> and select your workspace</li>
                                                <li>Go to <strong>"Incoming Webhooks"</strong> → Enable it</li>
                                                <li>Click <strong>"Add New Webhook to Workspace"</strong></li>
                                                <li>Choose your channel and copy the webhook URL</li>
                                            </ol>
                                            <a
                                                href="https://api.slack.com/messaging/webhooks"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ color: '#014C75' }}
                                            >
                                                📚 Official Slack webhook guide →
                                            </a>
                                        </div>
                                    </div>
                                )}

                                {/* Jira Integration Smart Setup */}
                                {formData.type === 'jira' && (
                                    <div className="config-note" data-integration="jira">
                                        <div className="note-icon">🎫</div>
                                        <div className="note-content">
                                            <strong>Jira Quick Setup:</strong> Configure API access in minutes:
                                            <ol style={{ marginTop: '8px', paddingLeft: '20px' }}>
                                                <li>Go to <strong>id.atlassian.com</strong> → <strong>"Security"</strong> → <strong>"API tokens"</strong></li>
                                                <li>Click <strong>"Create API token"</strong> and copy it</li>
                                                <li>Your server URL is usually: <code>https://yourcompany.atlassian.net</code></li>
                                                <li>Use your email as username and the API token as password</li>
                                            </ol>
                                            <div style={{ marginTop: '8px', padding: '8px', backgroundColor: 'rgba(0, 82, 204, 0.1)', borderRadius: '4px' }}>
                                                ⚠️ <strong>Security:</strong> API tokens are safer than passwords. Keep them secure!
                                            </div>
                                            <a
                                                href="https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ color: '#014C75' }}
                                            >
                                                📖 Official Atlassian API token guide →
                                            </a>
                                        </div>
                                    </div>
                                )}

                                {/* Custom Webhook Smart Setup */}
                                {formData.type === 'webhook' && (
                                    <div className="config-note" data-integration="webhook">
                                        <div className="note-icon">🔗</div>
                                        <div className="note-content">
                                            <strong>Custom Webhook Setup:</strong> Connect to any webhook endpoint:
                                            <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                                                <li>✅ <strong>webhook.site</strong> - Great for testing</li>
                                                <li>✅ <strong>requestbin.com</strong> - Debug webhook calls</li>
                                                <li>✅ <strong>Your own API</strong> - Production endpoints</li>
                                                <li>✅ <strong>Zapier webhooks</strong> - Automation workflows</li>
                                            </ul>
                                            <div style={{ marginTop: '8px', padding: '8px', backgroundColor: 'rgba(76, 175, 80, 0.1)', borderRadius: '4px' }}>
                                                💡 <strong>Test first:</strong> We'll send a test payload to verify your webhook works!
                                            </div>
                                        </div>
                                    </div>
                                )}

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

            {/* Edit Integration Modal */}
            {showEditModal && selectedIntegration && (
                <div className="modal-overlay">
                    <div className="modal-content large">
                        <div className="modal-header">
                            <h2>Edit Integration</h2>
                            <button
                                className="modal-close"
                                onClick={() => {
                                    setShowEditModal(false);
                                    setSelectedIntegration(null);
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
                                    onChange={(e) => {
                                        const newType = e.target.value;
                                        let defaultConfig = {};

                                        // Auto-fill with smart defaults based on type
                                        if (newType === 'email' && currentUser?.email) {
                                            defaultConfig = getEmailDefaults();
                                        }

                                        setFormData({
                                            ...formData,
                                            type: newType,
                                            config: defaultConfig,
                                            name: integrationTypes[newType]?.name || ''
                                        });
                                    }}
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

                                {/* Show helpful note for email integration */}
                                {formData.type === 'email' && currentUser?.email && (
                                    <div className="config-note" data-integration="email">
                                        <div className="note-icon">💡</div>
                                        <div className="note-content">
                                            <strong>Smart Setup:</strong> We've auto-detected your email settings for {currentUser.email}.
                                            {currentUser.email.includes('@gmail.com') && (
                                                <>You only need to enter your Gmail App Password to complete the setup.</>
                                            )}
                                            {(currentUser.email.includes('@outlook.com') || currentUser.email.includes('@hotmail.com') || currentUser.email.includes('@live.com')) && (
                                                <>You only need to enter your Outlook/Hotmail password to complete the setup.</>
                                            )}
                                            {currentUser.email.includes('@yahoo.com') && (
                                                <>You only need to enter your Yahoo App Password to complete the setup.</>
                                            )}
                                            {!currentUser.email.includes('@gmail.com') && !currentUser.email.includes('@outlook.com') && !currentUser.email.includes('@hotmail.com') && !currentUser.email.includes('@live.com') && !currentUser.email.includes('@yahoo.com') && (
                                                <>Settings have been configured with Gmail defaults. You may need to adjust the SMTP settings for your email provider.</>
                                            )}
                                            <br />
                                            {currentUser.email.includes('@gmail.com') && (
                                                <a
                                                    href="https://support.google.com/accounts/answer/185833"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ color: '#014C75' }}
                                                >
                                                    How to generate Gmail App Password →
                                                </a>
                                            )}
                                            {currentUser.email.includes('@yahoo.com') && (
                                                <a
                                                    href="https://help.yahoo.com/kb/generate-third-party-passwords-sln15241.html"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ color: '#014C75' }}
                                                >
                                                    How to generate Yahoo App Password →
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Teams Integration Smart Setup */}
                                {formData.type === 'teams' && (
                                    <div className="config-note" data-integration="teams">
                                        <div className="note-icon">🚀</div>
                                        <div className="note-content">
                                            <strong>Teams Quick Setup:</strong> Follow these steps to create a webhook URL:
                                            <ol style={{ marginTop: '8px', paddingLeft: '20px' }}>
                                                <li>Open your Teams channel</li>
                                                <li>Click the <strong>three dots (⋯)</strong> next to the channel name</li>
                                                <li>Select <strong>"Connectors"</strong> or <strong>"Workflows"</strong></li>
                                                <li>Search for <strong>"Incoming Webhook"</strong> and configure</li>
                                                <li>Copy the generated webhook URL and paste below</li>
                                            </ol>
                                            <a
                                                href="https://docs.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ color: '#014C75' }}
                                            >
                                                📋 Official Microsoft Teams webhook guide →
                                            </a>
                                        </div>
                                    </div>
                                )}

                                {/* Discord Integration Smart Setup */}
                                {formData.type === 'discord' && (
                                    <div className="config-note" data-integration="discord">
                                        <div className="note-icon">🎮</div>
                                        <div className="note-content">
                                            <strong>Discord Quick Setup:</strong> Get your webhook URL in 3 easy steps:
                                            <ol style={{ marginTop: '8px', paddingLeft: '20px' }}>
                                                <li>Go to your Discord channel settings (gear icon)</li>
                                                <li>Click <strong>"Integrations"</strong> → <strong>"Webhooks"</strong> → <strong>"New Webhook"</strong></li>
                                                <li>Copy the webhook URL and paste below</li>
                                            </ol>
                                            <div style={{ marginTop: '8px', padding: '8px', backgroundColor: 'rgba(88, 101, 242, 0.1)', borderRadius: '4px' }}>
                                                💡 <strong>Tip:</strong> Your webhook URL should look like: <code>https://discord.com/api/webhooks/...</code>
                                            </div>
                                            <a
                                                href="https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ color: '#014C75' }}
                                            >
                                                🔗 Discord webhooks documentation →
                                            </a>
                                        </div>
                                    </div>
                                )}

                                {/* Slack Integration Smart Setup */}
                                {formData.type === 'slack' && (
                                    <div className="config-note" data-integration="slack">
                                        <div className="note-icon">💬</div>
                                        <div className="note-content">
                                            <strong>Slack Quick Setup:</strong> Create an incoming webhook:
                                            <ol style={{ marginTop: '8px', paddingLeft: '20px' }}>
                                                <li>Go to <strong>api.slack.com</strong> → <strong>"Create an app"</strong></li>
                                                <li>Choose <strong>"From scratch"</strong> and select your workspace</li>
                                                <li>Go to <strong>"Incoming Webhooks"</strong> → Enable it</li>
                                                <li>Click <strong>"Add New Webhook to Workspace"</strong></li>
                                                <li>Choose your channel and copy the webhook URL</li>
                                            </ol>
                                            <a
                                                href="https://api.slack.com/messaging/webhooks"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ color: '#014C75' }}
                                            >
                                                📚 Official Slack webhook guide →
                                            </a>
                                        </div>
                                    </div>
                                )}

                                {/* Jira Integration Smart Setup */}
                                {formData.type === 'jira' && (
                                    <div className="config-note" data-integration="jira">
                                        <div className="note-icon">🎫</div>
                                        <div className="note-content">
                                            <strong>Jira Quick Setup:</strong> Configure API access in minutes:
                                            <ol style={{ marginTop: '8px', paddingLeft: '20px' }}>
                                                <li>Go to <strong>id.atlassian.com</strong> → <strong>"Security"</strong> → <strong>"API tokens"</strong></li>
                                                <li>Click <strong>"Create API token"</strong> and copy it</li>
                                                <li>Your server URL is usually: <code>https://yourcompany.atlassian.net</code></li>
                                                <li>Use your email as username and the API token as password</li>
                                            </ol>
                                            <div style={{ marginTop: '8px', padding: '8px', backgroundColor: 'rgba(0, 82, 204, 0.1)', borderRadius: '4px' }}>
                                                ⚠️ <strong>Security:</strong> API tokens are safer than passwords. Keep them secure!
                                            </div>
                                            <a
                                                href="https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ color: '#014C75' }}
                                            >
                                                📖 Official Atlassian API token guide →
                                            </a>
                                        </div>
                                    </div>
                                )}

                                {/* Custom Webhook Smart Setup */}
                                {formData.type === 'webhook' && (
                                    <div className="config-note" data-integration="webhook">
                                        <div className="note-icon">🔗</div>
                                        <div className="note-content">
                                            <strong>Custom Webhook Setup:</strong> Connect to any webhook endpoint:
                                            <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                                                <li>✅ <strong>webhook.site</strong> - Great for testing</li>
                                                <li>✅ <strong>requestbin.com</strong> - Debug webhook calls</li>
                                                <li>✅ <strong>Your own API</strong> - Production endpoints</li>
                                                <li>✅ <strong>Zapier webhooks</strong> - Automation workflows</li>
                                            </ul>
                                            <div style={{ marginTop: '8px', padding: '8px', backgroundColor: 'rgba(76, 175, 80, 0.1)', borderRadius: '4px' }}>
                                                💡 <strong>Test first:</strong> We'll send a test payload to verify your webhook works!
                                            </div>
                                        </div>
                                    </div>
                                )}

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
                                    setShowEditModal(false);
                                    setSelectedIntegration(null);
                                    resetForm();
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-primary"
                                onClick={updateIntegration}
                                disabled={!formData.name || loading}
                            >
                                <FiCheck /> Update Integration
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IntegrationsManagement;

