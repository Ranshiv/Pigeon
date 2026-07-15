// client/src/components/MonitorForm.js
import React, { useState, useEffect } from 'react';
import { FiX, FiSave, FiLoader, FiGlobe, FiSettings, FiList, FiBell, FiMapPin, FiLink2, FiShield, FiCheckCircle } from 'react-icons/fi';
import './MonitorForm.css';
import AppSelect from './common/AppSelect/AppSelect';

const HTTP_METHODS = [
    { value: 'GET', label: 'GET' },
    { value: 'POST', label: 'POST' },
    { value: 'PUT', label: 'PUT' },
    { value: 'DELETE', label: 'DELETE' },
    { value: 'PATCH', label: 'PATCH' },
    { value: 'HEAD', label: 'HEAD' }
];

const MonitorForm = ({ isOpen, onClose, onSave, editMonitor = null }) => {
    const getInitialFormData = (monitor) => ({
        name: monitor?.name || '',
        url: monitor?.url || '',
        method: monitor?.method || 'GET',
        expectedStatusCode: monitor?.expectedStatusCode || 200,
        expectedResponseTime: monitor?.expectedResponseTime || 5000,
        interval: monitor?.interval || 5,
        isActive: monitor?.isActive !== undefined ? monitor.isActive : true,
        isPublic: monitor?.isPublic !== undefined ? monitor.isPublic : false,
        description: monitor?.description || '',
        tags: monitor?.tags?.join(', ') || '',
        headers: monitor?.headers || [],
        body: monitor?.body || '',
        alertSettings: {
            emailEnabled: monitor?.alertSettings?.emailEnabled !== undefined ? monitor.alertSettings.emailEnabled : true,
            alertOnFailure: monitor?.alertSettings?.alertOnFailure !== undefined ? monitor.alertSettings.alertOnFailure : true,
            alertOnSlowResponse: monitor?.alertSettings?.alertOnSlowResponse !== undefined ? monitor.alertSettings.alertOnSlowResponse : true,
            alertOnRecovery: monitor?.alertSettings?.alertOnRecovery !== undefined ? monitor.alertSettings.alertOnRecovery : true,
            webhookUrl: monitor?.alertSettings?.webhookUrl || '',
            slackWebhook: monitor?.alertSettings?.slackWebhook || ''
        },
        // Enhanced monitoring features
        advancedSettings: {
            sslMonitoring: {
                enabled: monitor?.advancedSettings?.sslMonitoring?.enabled || false,
                alertBeforeExpiry: monitor?.advancedSettings?.sslMonitoring?.alertBeforeExpiry || 30
            },
            contentValidation: {
                enabled: monitor?.advancedSettings?.contentValidation?.enabled || false,
                expectedContent: monitor?.advancedSettings?.contentValidation?.expectedContent || '',
                validationType: monitor?.advancedSettings?.contentValidation?.validationType || 'contains'
            },
            geoMonitoring: {
                enabled: monitor?.advancedSettings?.geoMonitoring?.enabled || false,
                locations: monitor?.advancedSettings?.geoMonitoring?.locations || ['us-east']
            },
            multiStep: {
                enabled: monitor?.advancedSettings?.multiStep?.enabled || false,
                steps: monitor?.advancedSettings?.multiStep?.steps || []
            }
        }
    });

    const [formData, setFormData] = useState(getInitialFormData(editMonitor));

    const [customHeaders, setCustomHeaders] = useState(
        editMonitor?.headers?.length > 0 ? editMonitor.headers : [{ key: '', value: '' }]
    );
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    // Update form data when editMonitor prop changes
    useEffect(() => {
        if (isOpen) {
            setFormData(getInitialFormData(editMonitor));
            setCustomHeaders(editMonitor?.headers?.length > 0 ? editMonitor.headers : [{ key: '', value: '' }]);
            setErrors({});
        }
    }, [editMonitor, isOpen]);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;

        if (name.includes('.')) {
            const parts = name.split('.');

            // Handle deeply nested paths like advancedSettings.sslMonitoring.enabled
            if (parts.length === 3 && parts[0] === 'advancedSettings') {
                const [parent, subParent, child] = parts;
                setFormData(prev => ({
                    ...prev,
                    [parent]: {
                        ...prev[parent],
                        [subParent]: {
                            ...prev[parent][subParent],
                            [child]: type === 'checkbox' ? checked : value
                        }
                    }
                }));
            } else if (parts.length === 2) {
                // Handle two-level nesting like alertSettings.emailEnabled
                const [parent, child] = parts;
                setFormData(prev => ({
                    ...prev,
                    [parent]: {
                        ...prev[parent],
                        [child]: type === 'checkbox' ? checked : value
                    }
                }));
            }
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: type === 'checkbox' ? checked : value
            }));
        }
    };

    const handleHeaderChange = (index, field, value) => {
        const updatedHeaders = [...customHeaders];
        updatedHeaders[index][field] = value;
        setCustomHeaders(updatedHeaders);
    };

    const addHeader = () => {
        setCustomHeaders([...customHeaders, { key: '', value: '' }]);
    }; const removeHeader = (index) => {
        const updatedHeaders = customHeaders.filter((_, i) => i !== index);
        setCustomHeaders(updatedHeaders);
    };

    const addMultiStep = () => {
        setFormData(prev => ({
            ...prev,
            advancedSettings: {
                ...prev.advancedSettings,
                multiStep: {
                    ...prev.advancedSettings.multiStep,
                    steps: [
                        ...prev.advancedSettings.multiStep.steps,
                        {
                            name: '',
                            url: '',
                            method: 'GET',
                            expectedStatusCode: 200,
                            headers: [],
                            body: '',
                            waitTime: 1000
                        }
                    ]
                }
            }
        }));
    };

    const removeMultiStep = (index) => {
        setFormData(prev => ({
            ...prev,
            advancedSettings: {
                ...prev.advancedSettings,
                multiStep: {
                    ...prev.advancedSettings.multiStep,
                    steps: prev.advancedSettings.multiStep.steps.filter((_, i) => i !== index)
                }
            }
        }));
    };

    const handleMultiStepChange = (index, field, value) => {
        setFormData(prev => {
            const newSteps = [...prev.advancedSettings.multiStep.steps];
            newSteps[index] = { ...newSteps[index], [field]: value };

            return {
                ...prev,
                advancedSettings: {
                    ...prev.advancedSettings,
                    multiStep: {
                        ...prev.advancedSettings.multiStep,
                        steps: newSteps
                    }
                }
            };
        });
    };

    const handleGeoLocationChange = (location, checked) => {
        setFormData(prev => {
            const newLocations = checked
                ? [...prev.advancedSettings.geoMonitoring.locations, location]
                : prev.advancedSettings.geoMonitoring.locations.filter(loc => loc !== location);

            return {
                ...prev,
                advancedSettings: {
                    ...prev.advancedSettings,
                    geoMonitoring: {
                        ...prev.advancedSettings.geoMonitoring,
                        locations: newLocations
                    }
                }
            };
        });
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Monitor name is required';
        }

        if (!formData.url.trim()) {
            newErrors.url = 'URL is required';
        } else {
            try {
                new URL(formData.url);
            } catch {
                newErrors.url = 'Please enter a valid URL';
            }
        }

        if (formData.expectedResponseTime < 1000) {
            newErrors.expectedResponseTime = 'Response time should be at least 1000ms';
        }

        if (formData.interval < 1) {
            newErrors.interval = 'Interval should be at least 1 minute';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setLoading(true);

        try {
            const submitData = {
                ...formData,
                tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
                headers: customHeaders.filter(header => header.key && header.value),
                expectedStatusCode: parseInt(formData.expectedStatusCode),
                expectedResponseTime: parseInt(formData.expectedResponseTime),
                interval: parseInt(formData.interval)
            };

            await onSave(submitData);
            onClose();
        } catch (error) {
            console.error('Error saving monitor:', error);
            setErrors({ submit: 'Failed to save monitor. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="mfm-overlay">
            <div className="mfm-modal">
                <div className="mfm-header">
                    <div>
                        <h2>{editMonitor ? 'Edit Monitor' : 'Create New Monitor'}</h2>
                        <p>Configure monitoring for your API endpoints and services</p>
                    </div>
                    <button className="mfm-close-btn" onClick={onClose}>
                        <FiX size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="mfm-form">
                    {/* Basic Information */}
                    <div className="mfm-form-section">
                        <div className="mfm-section-title">
                            <FiGlobe size={20} />
                            <div>
                                <h3>Basic Information</h3>
                                <p className="mfm-section-description">Essential details about your monitor endpoint</p>
                            </div>
                        </div>

                        <div className="mfm-form-row">
                            <div className="mfm-form-group">
                                <label htmlFor="name">Monitor Name *</label>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    placeholder="e.g., Main API Health Check"
                                    className={errors.name ? 'mfm-error' : ''}
                                />
                                {errors.name && <span className="mfm-error-text">{errors.name}</span>}
                            </div>

                            <div className="mfm-form-group">
                                <label htmlFor="url">URL *</label>
                                <input
                                    type="url"
                                    id="url"
                                    name="url"
                                    value={formData.url}
                                    onChange={handleInputChange}
                                    placeholder="https://api.example.com/health"
                                    className={errors.url ? 'mfm-error' : ''}
                                />
                                {errors.url && <span className="mfm-error-text">{errors.url}</span>}
                            </div>
                        </div>

                        <div className="mfm-form-row">
                            <div className="mfm-form-group">
                                <label htmlFor="method">HTTP Method</label>
                                <AppSelect
                                    id="method"
                                    value={formData.method}
                                    onChange={(v) => handleInputChange({ target: { name: 'method', value: v } })}
                                    options={HTTP_METHODS}
                                />
                            </div>

                            <div className="mfm-form-group">
                                <label htmlFor="expectedStatusCode">Expected Status Code</label>
                                <div className="mfm-number-input-container">
                                    <input
                                        type="number"
                                        id="expectedStatusCode"
                                        name="expectedStatusCode"
                                        value={formData.expectedStatusCode}
                                        onChange={handleInputChange}
                                        min="100"
                                        max="599"
                                        placeholder="200"
                                    />
                                </div>
                                <div className="mfm-number-input-range">
                                    <span className="mfm-range-indicator">Min: 100</span>
                                    <span className="mfm-range-indicator">Max: 599</span>
                                </div>
                            </div>
                        </div>

                        <div className="mfm-form-group">
                            <label htmlFor="description">Description</label>
                            <textarea
                                id="description"
                                name="description"
                                value={formData.description}
                                onChange={handleInputChange}
                                placeholder="Optional description for this monitor"
                                rows={3}
                            />
                        </div>

                        <div className="mfm-form-group">
                            <label htmlFor="tags">Tags (comma-separated)</label>
                            <input
                                type="text"
                                id="tags"
                                name="tags"
                                value={formData.tags}
                                onChange={handleInputChange}
                                placeholder="production, critical, api"
                            />
                        </div>
                    </div>

                    {/* Monitoring Configuration */}
                    <div className="mfm-form-section">
                        <div className="mfm-section-title">
                            <FiSettings size={20} />
                            <div>
                                <h3>Monitoring Configuration</h3>
                                <p className="mfm-section-description">Set check intervals and response time thresholds</p>
                            </div>
                        </div>

                        <div className="mfm-form-row">
                            <div className="mfm-form-group">
                                <label htmlFor="interval">Check Interval</label>
                                <div className="mfm-number-input-with-unit">
                                    <input
                                        type="number"
                                        id="interval"
                                        name="interval"
                                        value={formData.interval}
                                        onChange={handleInputChange}
                                        min="1"
                                        max="60"
                                        placeholder="5"
                                        className={errors.interval ? 'mfm-error' : ''}
                                    />
                                    <span className="mfm-input-unit">min</span>
                                </div>
                                <div className="mfm-number-input-range">
                                    <span className="mfm-range-indicator">Min: 1 min</span>
                                    <span className="mfm-range-indicator">Max: 60 min</span>
                                </div>
                                {errors.interval && <span className="mfm-error-text">{errors.interval}</span>}
                            </div>

                            <div className="mfm-form-group">
                                <label htmlFor="expectedResponseTime">Max Response Time</label>
                                <div className="mfm-number-input-with-unit">
                                    <input
                                        type="number"
                                        id="expectedResponseTime"
                                        name="expectedResponseTime"
                                        value={formData.expectedResponseTime}
                                        onChange={handleInputChange}
                                        min="1000"
                                        step="100"
                                        placeholder="5000"
                                        className={errors.expectedResponseTime ? 'mfm-error' : ''}
                                    />
                                    <span className="mfm-input-unit">ms</span>
                                </div>
                                <div className="mfm-number-input-range">
                                    <span className="mfm-range-indicator">Min: 1000ms</span>
                                    <span className="mfm-range-indicator">Step: 100ms</span>
                                </div>
                                {errors.expectedResponseTime && <span className="mfm-error-text">{errors.expectedResponseTime}</span>}
                            </div>
                        </div>

                        <div className="mfm-form-row mfm-checkbox-row">
                            <div className="mfm-toggle-group">
                                <div className="mfm-toggle-label-group">
                                    <label className="mfm-toggle-label">Active (start monitoring immediately)</label>
                                    <p className="mfm-toggle-description">Begin monitoring this endpoint right away</p>
                                </div>
                                <label className="mfm-toggle-switch">
                                    <input
                                        type="checkbox"
                                        name="isActive"
                                        checked={formData.isActive}
                                        onChange={handleInputChange}
                                    />
                                    <span className="mfm-toggle-slider"></span>
                                </label>
                            </div>

                            <div className="mfm-toggle-group">
                                <div className="mfm-toggle-label-group">
                                    <label className="mfm-toggle-label">Show on public status page</label>
                                    <p className="mfm-toggle-description">Display this monitor on your public status page</p>
                                </div>
                                <label className="mfm-toggle-switch">
                                    <input
                                        type="checkbox"
                                        name="isPublic"
                                        checked={formData.isPublic}
                                        onChange={handleInputChange}
                                    />
                                    <span className="mfm-toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Custom Headers */}
                    <div className="mfm-form-section">
                        <div className="mfm-section-header">
                            <div className="mfm-section-title">
                                <FiList size={20} />
                                <div>
                                    <h3>Custom Headers</h3>
                                    <p className="mfm-section-description">Add custom HTTP headers to your requests</p>
                                </div>
                            </div>
                            <button type="button" onClick={addHeader} className="mfm-btn-add">
                                + Add Header
                            </button>
                        </div>

                        {customHeaders.length > 0 && (
                            <div className="mfm-header-labels">
                                <span>Header name</span>
                                <span>Header value</span>
                                <span></span>
                            </div>
                        )}

                        {customHeaders.map((header, index) => (
                            <div key={index} className="mfm-header-row">
                                <input
                                    type="text"
                                    value={header.key}
                                    onChange={(e) => handleHeaderChange(index, 'key', e.target.value)}
                                    placeholder="Header name"
                                />
                                <input
                                    type="text"
                                    value={header.value}
                                    onChange={(e) => handleHeaderChange(index, 'value', e.target.value)}
                                    placeholder="Header value"
                                />
                                <button
                                    type="button"
                                    onClick={() => removeHeader(index)}
                                    className="mfm-remove-header-btn"
                                >
                                    <FiX />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Request Body (for POST/PUT/PATCH) */}
                    {['POST', 'PUT', 'PATCH'].includes(formData.method) && (
                        <div className="mfm-form-section">
                            <h3><FiList size={20} /> Request Body</h3>
                            <div className="mfm-form-group">
                                <label htmlFor="body">Body Content</label>
                                <textarea
                                    id="body"
                                    name="body"
                                    value={formData.body}
                                    onChange={handleInputChange}
                                    placeholder='{"key": "value"}'
                                    rows={4}
                                />
                            </div>
                        </div>
                    )}

                    {/* Alert Settings */}
                    <div className="mfm-form-section">
                        <div className="mfm-section-title">
                            <FiBell size={20} />
                            <div>
                                <h3>Alert Settings</h3>
                                <p className="mfm-section-description">Configure when and how you want to be notified</p>
                            </div>
                        </div>

                        <div className="mfm-alert-checkboxes-grid">
                            <div className="mfm-toggle-group">
                                <div className="mfm-toggle-label-group">
                                    <label className="mfm-toggle-label">Enable email alerts</label>
                                </div>
                                <label className="mfm-toggle-switch">
                                    <input
                                        type="checkbox"
                                        name="alertSettings.emailEnabled"
                                        checked={formData.alertSettings.emailEnabled}
                                        onChange={handleInputChange}
                                    />
                                    <span className="mfm-toggle-slider"></span>
                                </label>
                            </div>

                            <div className="mfm-toggle-group">
                                <div className="mfm-toggle-label-group">
                                    <label className="mfm-toggle-label">Alert on failure</label>
                                </div>
                                <label className="mfm-toggle-switch">
                                    <input
                                        type="checkbox"
                                        name="alertSettings.alertOnFailure"
                                        checked={formData.alertSettings.alertOnFailure}
                                        onChange={handleInputChange}
                                    />
                                    <span className="mfm-toggle-slider"></span>
                                </label>
                            </div>

                            <div className="mfm-toggle-group">
                                <div className="mfm-toggle-label-group">
                                    <label className="mfm-toggle-label">Alert on slow response</label>
                                </div>
                                <label className="mfm-toggle-switch">
                                    <input
                                        type="checkbox"
                                        name="alertSettings.alertOnSlowResponse"
                                        checked={formData.alertSettings.alertOnSlowResponse}
                                        onChange={handleInputChange}
                                    />
                                    <span className="mfm-toggle-slider"></span>
                                </label>
                            </div>

                            <div className="mfm-toggle-group">
                                <div className="mfm-toggle-label-group">
                                    <label className="mfm-toggle-label">Alert on recovery</label>
                                </div>
                                <label className="mfm-toggle-switch">
                                    <input
                                        type="checkbox"
                                        name="alertSettings.alertOnRecovery"
                                        checked={formData.alertSettings.alertOnRecovery}
                                        onChange={handleInputChange}
                                    />
                                    <span className="mfm-toggle-slider"></span>
                                </label>
                            </div>
                        </div>

                        <div className="mfm-form-row">
                            <div className="mfm-form-group">
                                <label htmlFor="webhookUrl">Webhook URL (optional)</label>
                                <input
                                    type="url"
                                    id="webhookUrl"
                                    name="alertSettings.webhookUrl"
                                    value={formData.alertSettings.webhookUrl}
                                    onChange={handleInputChange}
                                    placeholder="https://hooks.example.com/webhook"
                                />
                            </div>

                            <div className="mfm-form-group">
                                <label htmlFor="slackWebhook">Slack Webhook (optional)</label>
                                <input
                                    type="url"
                                    id="slackWebhook"
                                    name="alertSettings.slackWebhook"
                                    value={formData.alertSettings.slackWebhook}
                                    onChange={handleInputChange}
                                    placeholder="https://hooks.slack.com/services/..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Advanced Monitoring Settings */}
                    <div className="mfm-form-section">
                        <div className="mfm-section-title">
                            <FiSettings size={20} />
                            <div>
                                <h3>Advanced Monitoring Settings</h3>
                                <p className="mfm-section-description">Additional monitoring capabilities and validations</p>
                            </div>
                        </div>

                        {/* SSL Monitoring Card */}
                        <div className="mfm-advanced-setting-card">
                            <div className="mfm-advanced-setting-header">
                                <div className="mfm-advanced-setting-title-with-icon">
                                    <FiShield size={16} className="mfm-advanced-setting-icon" />
                                    <div>
                                        <label className="mfm-advanced-setting-label">SSL Monitoring</label>
                                        <p className="mfm-advanced-setting-description">Monitor SSL certificate expiration</p>
                                    </div>
                                </div>
                                <label className="mfm-toggle-switch">
                                    <input
                                        type="checkbox"
                                        name="advancedSettings.sslMonitoring.enabled"
                                        checked={formData.advancedSettings.sslMonitoring.enabled}
                                        onChange={handleInputChange}
                                    />
                                    <span className="mfm-toggle-slider"></span>
                                </label>
                            </div>
                            {formData.advancedSettings.sslMonitoring.enabled && (
                                <div className="mfm-advanced-setting-content">
                                    <div className="mfm-form-group">
                                        <label htmlFor="sslMonitoring.alertBeforeExpiry">Alert Before Expiry (days)</label>
                                        <input
                                            type="number"
                                            id="sslMonitoring.alertBeforeExpiry"
                                            name="advancedSettings.sslMonitoring.alertBeforeExpiry"
                                            value={formData.advancedSettings.sslMonitoring.alertBeforeExpiry}
                                            onChange={handleInputChange}
                                            min="1"
                                            placeholder="30"
                                            className={errors.sslMonitoring?.alertBeforeExpiry ? 'mfm-error' : ''}
                                        />
                                        {errors.sslMonitoring?.alertBeforeExpiry && <span className="mfm-error-text">{errors.sslMonitoring.alertBeforeExpiry}</span>}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Content Validation Card */}
                        <div className="mfm-advanced-setting-card">
                            <div className="mfm-advanced-setting-header">
                                <div className="mfm-advanced-setting-title-with-icon">
                                    <FiCheckCircle size={16} className="mfm-advanced-setting-icon" />
                                    <div>
                                        <label className="mfm-advanced-setting-label">Content Validation</label>
                                        <p className="mfm-advanced-setting-description">Verify response contains expected content</p>
                                    </div>
                                </div>
                                <label className="mfm-toggle-switch">
                                    <input
                                        type="checkbox"
                                        name="advancedSettings.contentValidation.enabled"
                                        checked={formData.advancedSettings.contentValidation.enabled}
                                        onChange={handleInputChange}
                                    />
                                    <span className="mfm-toggle-slider"></span>
                                </label>
                            </div>
                            {formData.advancedSettings.contentValidation.enabled && (
                                <div className="mfm-advanced-setting-content">
                                    <div className="mfm-form-group">
                                        <label htmlFor="contentValidation.expectedContent">Expected Content</label>
                                        <input
                                            type="text"
                                            id="contentValidation.expectedContent"
                                            name="advancedSettings.contentValidation.expectedContent"
                                            value={formData.advancedSettings.contentValidation.expectedContent}
                                            onChange={handleInputChange}
                                            placeholder="e.g., Success"
                                            className={errors.contentValidation?.expectedContent ? 'mfm-error' : ''}
                                        />
                                        {errors.contentValidation?.expectedContent && <span className="mfm-error-text">{errors.contentValidation.expectedContent}</span>}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Geo-location Monitoring Card */}
                        <div className="mfm-advanced-setting-card">
                            <div className="mfm-advanced-setting-header">
                                <div className="mfm-advanced-setting-title-with-icon">
                                    <FiMapPin size={16} className="mfm-advanced-setting-icon" />
                                    <div>
                                        <label className="mfm-advanced-setting-label">Geo-location Monitoring</label>
                                        <p className="mfm-advanced-setting-description">Monitor from multiple geographic locations</p>
                                    </div>
                                </div>
                                <label className="mfm-toggle-switch">
                                    <input
                                        type="checkbox"
                                        name="advancedSettings.geoMonitoring.enabled"
                                        checked={formData.advancedSettings.geoMonitoring.enabled}
                                        onChange={handleInputChange}
                                    />
                                    <span className="mfm-toggle-slider"></span>
                                </label>
                            </div>
                            {formData.advancedSettings.geoMonitoring.enabled && (
                                <div className="mfm-advanced-setting-content">
                                    <div className="mfm-form-group">
                                        <label htmlFor="geoMonitoring.locations">Locations</label>
                                        <div className="mfm-location-chips">
                                            {['US East', 'US West', 'EU Central', 'AP South'].map((location) => {
                                                const value = location.toLowerCase().replace(' ', '-');
                                                const isSelected = formData.advancedSettings.geoMonitoring.locations.includes(value);
                                                return (
                                                    <label key={value} className={`mfm-location-chip ${isSelected ? 'selected' : ''}`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={(e) => handleGeoLocationChange(value, e.target.checked)}
                                                        />
                                                        {location}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Multi-step Monitoring Card */}
                        <div className="mfm-advanced-setting-card">
                            <div className="mfm-advanced-setting-header">
                                <div className="mfm-advanced-setting-title-with-icon">
                                    <FiLink2 size={16} className="mfm-advanced-setting-icon" />
                                    <div>
                                        <label className="mfm-advanced-setting-label">Multi-step Monitoring</label>
                                        <p className="mfm-advanced-setting-description">Chain multiple requests together</p>
                                    </div>
                                </div>
                                <label className="mfm-toggle-switch">
                                    <input
                                        type="checkbox"
                                        name="advancedSettings.multiStep.enabled"
                                        checked={formData.advancedSettings.multiStep.enabled}
                                        onChange={handleInputChange}
                                    />
                                    <span className="mfm-toggle-slider"></span>
                                </label>
                            </div>
                        </div>

                        {formData.advancedSettings.multiStep.enabled && (
                            <div className="mfm-multi-step-settings">
                                <h4>Multi-Step Configuration</h4>

                                {formData.advancedSettings.multiStep.steps.map((step, index) => (
                                    <div key={index} className="mfm-multi-step-row">
                                        <div className="mfm-form-group">
                                            <label htmlFor={`multiStep.steps.${index}.name`}>Step Name</label>                                            <input
                                                type="text"
                                                id={`multiStep.steps.${index}.name`}
                                                value={step.name}
                                                onChange={(e) => handleMultiStepChange(index, 'name', e.target.value)}
                                                placeholder="e.g., Database Check"
                                            />
                                        </div>

                                        <div className="mfm-form-group">
                                            <label htmlFor={`multiStep.steps.${index}.url`}>Request URL</label>                                            <input
                                                type="url"
                                                id={`multiStep.steps.${index}.url`}
                                                value={step.url}
                                                onChange={(e) => handleMultiStepChange(index, 'url', e.target.value)}
                                                placeholder="https://api.example.com/step1"
                                            />
                                        </div>

                                        <div className="mfm-form-group">
                                            <label htmlFor={`multiStep.steps.${index}.method`}>HTTP Method</label>
                                            <AppSelect
                                                id={`multiStep.steps.${index}.method`}
                                                value={step.method}
                                                onChange={(v) => handleMultiStepChange(index, 'method', v)}
                                                options={HTTP_METHODS}
                                            />
                                        </div>

                                        <div className="mfm-form-group">
                                            <label htmlFor={`multiStep.steps.${index}.expectedStatusCode`}>Expected Status Code</label>
                                            <div className="mfm-number-input-container">                                                <input
                                                type="number"
                                                id={`multiStep.steps.${index}.expectedStatusCode`}
                                                value={step.expectedStatusCode}
                                                onChange={(e) => handleMultiStepChange(index, 'expectedStatusCode', parseInt(e.target.value))}
                                                min="100"
                                                max="599"
                                                placeholder="200"
                                            />
                                            </div>
                                        </div>

                                        <div className="mfm-form-group">
                                            <label htmlFor={`multiStep.steps.${index}.expectedResponseTime`}>Max Response Time</label>
                                            <div className="mfm-number-input-with-unit">                                                <input
                                                type="number"
                                                id={`multiStep.steps.${index}.expectedResponseTime`}
                                                value={step.expectedResponseTime}
                                                onChange={(e) => handleMultiStepChange(index, 'expectedResponseTime', parseInt(e.target.value))}
                                                min="1000"
                                                step="100"
                                                placeholder="5000"
                                            />
                                                <span className="mfm-input-unit">ms</span>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => removeMultiStep(index)}
                                            className="mfm-remove-multi-step-btn"
                                        >
                                            <FiX />
                                        </button>
                                    </div>
                                ))}

                                <button type="button" onClick={addMultiStep} className="mfm-btn-secondary small">
                                    Add Another Step
                                </button>
                            </div>
                        )}
                    </div>

                    {errors.submit && (
                        <div className="mfm-error-banner">
                            {errors.submit}
                        </div>
                    )}

                    <div className="mfm-form-actions">
                        <button type="button" onClick={onClose} className="mfm-btn-secondary">
                            Cancel
                        </button>
                        <button type="submit" disabled={loading} className="mfm-btn-primary">
                            {loading ? (
                                <>
                                    <FiLoader className="mfm-spinning" /> Saving...
                                </>
                            ) : (
                                <>
                                    <FiSave /> {editMonitor ? 'Update Monitor' : 'Create Monitor'}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MonitorForm;
