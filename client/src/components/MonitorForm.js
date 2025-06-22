// client/src/components/MonitorForm.js
import React, { useState } from 'react';
import { FiX, FiSave, FiLoader, FiGlobe, FiSettings, FiList, FiBell } from 'react-icons/fi';
import './MonitorForm.css';

const MonitorForm = ({ isOpen, onClose, onSave, editMonitor = null }) => {
    const [formData, setFormData] = useState({
        name: editMonitor?.name || '',
        url: editMonitor?.url || '',
        method: editMonitor?.method || 'GET',
        expectedStatusCode: editMonitor?.expectedStatusCode || 200,
        expectedResponseTime: editMonitor?.expectedResponseTime || 5000,
        interval: editMonitor?.interval || 5,
        isActive: editMonitor?.isActive !== undefined ? editMonitor.isActive : true,
        isPublic: editMonitor?.isPublic !== undefined ? editMonitor.isPublic : false,
        description: editMonitor?.description || '',
        tags: editMonitor?.tags?.join(', ') || '',
        headers: editMonitor?.headers || [],
        body: editMonitor?.body || '',
        alertSettings: {
            emailEnabled: editMonitor?.alertSettings?.emailEnabled !== undefined ? editMonitor.alertSettings.emailEnabled : true,
            alertOnFailure: editMonitor?.alertSettings?.alertOnFailure !== undefined ? editMonitor.alertSettings.alertOnFailure : true,
            alertOnSlowResponse: editMonitor?.alertSettings?.alertOnSlowResponse !== undefined ? editMonitor.alertSettings.alertOnSlowResponse : true,
            alertOnRecovery: editMonitor?.alertSettings?.alertOnRecovery !== undefined ? editMonitor.alertSettings.alertOnRecovery : true,
            webhookUrl: editMonitor?.alertSettings?.webhookUrl || '',
            slackWebhook: editMonitor?.alertSettings?.slackWebhook || ''
        }
    });

    const [customHeaders, setCustomHeaders] = useState(
        editMonitor?.headers?.length > 0 ? editMonitor.headers : [{ key: '', value: '' }]
    );
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;

        if (name.includes('.')) {
            const [parent, child] = name.split('.');
            setFormData(prev => ({
                ...prev,
                [parent]: {
                    ...prev[parent],
                    [child]: type === 'checkbox' ? checked : value
                }
            }));
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
    };

    const removeHeader = (index) => {
        const updatedHeaders = customHeaders.filter((_, i) => i !== index);
        setCustomHeaders(updatedHeaders);
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
        <div className="monitor-form-overlay">
            <div className="monitor-form-modal">
                <div className="monitor-form-header">
                    <div>
                        <h2>{editMonitor ? 'Edit Monitor' : 'Create New Monitor'}</h2>
                        <p>Set up monitoring for your API endpoints and services</p>
                    </div>
                    <button className="close-btn" onClick={onClose}>
                        <FiX size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="monitor-form">
                    {/* Basic Information */}
                    <div className="form-section">
                        <h3><FiGlobe size={20} /> Basic Information</h3>

                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="name">Monitor Name *</label>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    placeholder="e.g., Main API Health Check"
                                    className={errors.name ? 'error' : ''}
                                />
                                {errors.name && <span className="error-text">{errors.name}</span>}
                            </div>

                            <div className="form-group">
                                <label htmlFor="url">URL *</label>
                                <input
                                    type="url"
                                    id="url"
                                    name="url"
                                    value={formData.url}
                                    onChange={handleInputChange}
                                    placeholder="https://api.example.com/health"
                                    className={errors.url ? 'error' : ''}
                                />
                                {errors.url && <span className="error-text">{errors.url}</span>}
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="method">HTTP Method</label>
                                <select
                                    id="method"
                                    name="method"
                                    value={formData.method}
                                    onChange={handleInputChange}
                                >
                                    <option value="GET">GET</option>
                                    <option value="POST">POST</option>
                                    <option value="PUT">PUT</option>
                                    <option value="DELETE">DELETE</option>
                                    <option value="PATCH">PATCH</option>
                                    <option value="HEAD">HEAD</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label htmlFor="expectedStatusCode">Expected Status Code</label>
                                <div className="number-input-container">
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
                                <div className="number-input-range">
                                    <span className="range-indicator">Min: 100</span>
                                    <span className="range-indicator">Max: 599</span>
                                </div>
                            </div>
                        </div>

                        <div className="form-group">
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

                        <div className="form-group">
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
                    <div className="form-section">
                        <h3><FiSettings size={20} /> Monitoring Configuration</h3>

                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="interval">Check Interval</label>
                                <div className="number-input-with-unit">
                                    <input
                                        type="number"
                                        id="interval"
                                        name="interval"
                                        value={formData.interval}
                                        onChange={handleInputChange}
                                        min="1"
                                        max="60"
                                        placeholder="5"
                                        className={errors.interval ? 'error' : ''}
                                    />
                                    <span className="input-unit">min</span>
                                </div>
                                <div className="number-input-range">
                                    <span className="range-indicator">Min: 1 min</span>
                                    <span className="range-indicator">Max: 60 min</span>
                                </div>
                                {errors.interval && <span className="error-text">{errors.interval}</span>}
                            </div>

                            <div className="form-group">
                                <label htmlFor="expectedResponseTime">Max Response Time</label>
                                <div className="number-input-with-unit">
                                    <input
                                        type="number"
                                        id="expectedResponseTime"
                                        name="expectedResponseTime"
                                        value={formData.expectedResponseTime}
                                        onChange={handleInputChange}
                                        min="1000"
                                        step="100"
                                        placeholder="5000"
                                        className={errors.expectedResponseTime ? 'error' : ''}
                                    />
                                    <span className="input-unit">ms</span>
                                </div>
                                <div className="number-input-range">
                                    <span className="range-indicator">Min: 1000ms</span>
                                    <span className="range-indicator">Step: 100ms</span>
                                </div>
                                {errors.expectedResponseTime && <span className="error-text">{errors.expectedResponseTime}</span>}
                            </div>
                        </div>

                        <div className="form-row checkbox-row">
                            <div className="checkbox-group">
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        name="isActive"
                                        checked={formData.isActive}
                                        onChange={handleInputChange}
                                    />
                                    <span className="checkmark"></span>
                                    Active (start monitoring immediately)
                                </label>
                            </div>

                            <div className="checkbox-group">
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        name="isPublic"
                                        checked={formData.isPublic}
                                        onChange={handleInputChange}
                                    />
                                    <span className="checkmark"></span>
                                    Show on public status page
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Custom Headers */}
                    <div className="form-section">
                        <div className="section-header">
                            <h3><FiList size={20} /> Custom Headers</h3>
                            <button type="button" onClick={addHeader} className="btn-secondary small">
                                Add Header
                            </button>
                        </div>

                        {customHeaders.map((header, index) => (
                            <div key={index} className="header-row">
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
                                    className="remove-header-btn"
                                >
                                    <FiX />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Request Body (for POST/PUT/PATCH) */}
                    {['POST', 'PUT', 'PATCH'].includes(formData.method) && (
                        <div className="form-section">
                            <h3><FiList size={20} /> Request Body</h3>
                            <div className="form-group">
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
                    <div className="form-section">
                        <h3><FiBell size={20} /> Alert Settings</h3>

                        <div className="alert-checkboxes-grid">
                            <div className="checkbox-group">
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        name="alertSettings.emailEnabled"
                                        checked={formData.alertSettings.emailEnabled}
                                        onChange={handleInputChange}
                                    />
                                    <span className="checkmark"></span>
                                    Enable email alerts
                                </label>
                            </div>

                            <div className="checkbox-group">
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        name="alertSettings.alertOnFailure"
                                        checked={formData.alertSettings.alertOnFailure}
                                        onChange={handleInputChange}
                                    />
                                    <span className="checkmark"></span>
                                    Alert on failure
                                </label>
                            </div>

                            <div className="checkbox-group">
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        name="alertSettings.alertOnSlowResponse"
                                        checked={formData.alertSettings.alertOnSlowResponse}
                                        onChange={handleInputChange}
                                    />
                                    <span className="checkmark"></span>
                                    Alert on slow response
                                </label>
                            </div>

                            <div className="checkbox-group">
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        name="alertSettings.alertOnRecovery"
                                        checked={formData.alertSettings.alertOnRecovery}
                                        onChange={handleInputChange}
                                    />
                                    <span className="checkmark"></span>
                                    Alert on recovery
                                </label>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
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

                            <div className="form-group">
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

                    {errors.submit && (
                        <div className="error-banner">
                            {errors.submit}
                        </div>
                    )}

                    <div className="form-actions">
                        <button type="button" onClick={onClose} className="btn-secondary">
                            Cancel
                        </button>
                        <button type="submit" disabled={loading} className="btn-primary">
                            {loading ? (
                                <>
                                    <FiLoader className="spinning" /> Saving...
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
