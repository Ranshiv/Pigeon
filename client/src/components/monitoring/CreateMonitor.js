// client/src/components/monitoring/CreateMonitor.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './CreateMonitor.css';

const CreateMonitor = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        url: '',
        method: 'GET',
        interval: 5,
        expectedStatusCode: 200,
        expectedResponseTime: 5000,
        isPublic: false,
        headers: [],
        body: '',
        tags: '',
        alertSettings: {
            emailEnabled: true,
            webhookUrl: '',
            slackWebhook: '',
            alertOnFailure: true,
            alertOnSlowResponse: true,
            alertOnRecovery: true
        }
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;

        if (name.startsWith('alertSettings.')) {
            const field = name.replace('alertSettings.', '');
            setFormData(prev => ({
                ...prev,
                alertSettings: {
                    ...prev.alertSettings,
                    [field]: type === 'checkbox' ? checked : value
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
        const newHeaders = [...formData.headers];
        newHeaders[index] = { ...newHeaders[index], [field]: value };
        setFormData(prev => ({ ...prev, headers: newHeaders }));
    };

    const addHeader = () => {
        setFormData(prev => ({
            ...prev,
            headers: [...prev.headers, { key: '', value: '' }]
        }));
    };

    const removeHeader = (index) => {
        setFormData(prev => ({
            ...prev,
            headers: prev.headers.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Process tags
            const tags = formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag);

            // Remove empty headers
            const headers = formData.headers.filter(header => header.key && header.value);

            const monitorData = {
                ...formData,
                tags,
                headers,
                interval: parseInt(formData.interval),
                expectedStatusCode: parseInt(formData.expectedStatusCode),
                expectedResponseTime: parseInt(formData.expectedResponseTime)
            };

            const response = await fetch('/api/monitoring', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(monitorData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to create monitor');
            }

            const monitor = await response.json();
            navigate('/monitoring');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="create-monitor">
            <div className="form-header">
                <h1>Create API Monitor</h1>
                <button
                    className="btn btn-secondary"
                    onClick={() => navigate('/monitoring')}
                >
                    Back to Dashboard
                </button>
            </div>

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="monitor-form">
                <div className="form-section">
                    <h3>Basic Information</h3>

                    <div className="form-group">
                        <label htmlFor="name">Monitor Name *</label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            required
                            placeholder="e.g., My API Health Check"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="url">URL *</label>
                        <input
                            type="url"
                            id="url"
                            name="url"
                            value={formData.url}
                            onChange={handleInputChange}
                            required
                            placeholder="https://api.example.com/health"
                        />
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
                            <label htmlFor="interval">Check Interval (minutes)</label>
                            <input
                                type="number"
                                id="interval"
                                name="interval"
                                value={formData.interval}
                                onChange={handleInputChange}
                                min="1"
                                required
                            />
                        </div>
                    </div>
                </div>

                <div className="form-section">
                    <h3>Expectations</h3>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="expectedStatusCode">Expected Status Code</label>
                            <input
                                type="number"
                                id="expectedStatusCode"
                                name="expectedStatusCode"
                                value={formData.expectedStatusCode}
                                onChange={handleInputChange}
                                min="100"
                                max="599"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="expectedResponseTime">Max Response Time (ms)</label>
                            <input
                                type="number"
                                id="expectedResponseTime"
                                name="expectedResponseTime"
                                value={formData.expectedResponseTime}
                                onChange={handleInputChange}
                                min="100"
                                required
                            />
                        </div>
                    </div>
                </div>

                <div className="form-section">
                    <h3>Request Configuration</h3>

                    <div className="form-group">
                        <label>Headers</label>
                        {formData.headers.map((header, index) => (
                            <div key={index} className="header-row">
                                <input
                                    type="text"
                                    placeholder="Header name"
                                    value={header.key}
                                    onChange={(e) => handleHeaderChange(index, 'key', e.target.value)}
                                />
                                <input
                                    type="text"
                                    placeholder="Header value"
                                    value={header.value}
                                    onChange={(e) => handleHeaderChange(index, 'value', e.target.value)}
                                />
                                <button
                                    type="button"
                                    className="btn-remove"
                                    onClick={() => removeHeader(index)}
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={addHeader}
                        >
                            Add Header
                        </button>
                    </div>

                    {['POST', 'PUT', 'PATCH'].includes(formData.method) && (
                        <div className="form-group">
                            <label htmlFor="body">Request Body</label>
                            <textarea
                                id="body"
                                name="body"
                                value={formData.body}
                                onChange={handleInputChange}
                                rows="4"
                                placeholder='{"key": "value"}'
                            />
                        </div>
                    )}
                </div>

                <div className="form-section">
                    <h3>Organization</h3>

                    <div className="form-group">
                        <label htmlFor="tags">Tags (comma separated)</label>
                        <input
                            type="text"
                            id="tags"
                            name="tags"
                            value={formData.tags}
                            onChange={handleInputChange}
                            placeholder="production, critical, api"
                        />
                    </div>

                    <div className="form-group">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                name="isPublic"
                                checked={formData.isPublic}
                                onChange={handleInputChange}
                            />
                            Show on public status page
                        </label>
                    </div>
                </div>

                <div className="form-section">
                    <h3>Alert Settings</h3>

                    <div className="form-group">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                name="alertSettings.emailEnabled"
                                checked={formData.alertSettings.emailEnabled}
                                onChange={handleInputChange}
                            />
                            Enable email alerts
                        </label>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    name="alertSettings.alertOnFailure"
                                    checked={formData.alertSettings.alertOnFailure}
                                    onChange={handleInputChange}
                                />
                                Alert on failure
                            </label>
                        </div>

                        <div className="form-group">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    name="alertSettings.alertOnSlowResponse"
                                    checked={formData.alertSettings.alertOnSlowResponse}
                                    onChange={handleInputChange}
                                />
                                Alert on slow response
                            </label>
                        </div>

                        <div className="form-group">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    name="alertSettings.alertOnRecovery"
                                    checked={formData.alertSettings.alertOnRecovery}
                                    onChange={handleInputChange}
                                />
                                Alert on recovery
                            </label>
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="webhookUrl">Webhook URL (optional)</label>
                        <input
                            type="url"
                            id="webhookUrl"
                            name="alertSettings.webhookUrl"
                            value={formData.alertSettings.webhookUrl}
                            onChange={handleInputChange}
                            placeholder="https://hooks.slack.com/services/..."
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="slackWebhook">Slack Webhook URL (optional)</label>
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

                <div className="form-actions">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => navigate('/monitoring')}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading}
                    >
                        {loading ? 'Creating...' : 'Create Monitor'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CreateMonitor;
