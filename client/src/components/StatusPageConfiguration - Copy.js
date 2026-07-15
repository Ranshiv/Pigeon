// client/src/components/StatusPageConfiguration.js
import React, { useState, useEffect } from 'react';
import {
    FiSettings, FiEye, FiSave, FiUpload,
    FiPalette, FiType, FiGlobe
} from 'react-icons/fi';
import './StatusPageConfiguration.css';

const StatusPageConfiguration = ({ workspaceId, onSave }) => {
    const [config, setConfig] = useState({
        branding: {
            companyName: '',
            logoUrl: '',
            primaryColor: '#007bff',
            secondaryColor: '#6c757d',
            backgroundColor: '#ffffff',
            textColor: '#333333',
            customCss: ''
        },
        content: {
            headline: 'System Status',
            description: 'Current status and uptime monitoring for our services',
            footerText: 'Powered by Pigeon Monitoring',
            customDomain: '',
            enableHistory: true,
            showMetrics: true,
            showIncidents: true,
            autoRefresh: true,
            refreshInterval: 30
        },
        notifications: {
            enableSubscriptions: true,
            allowEmailSubscriptions: true,
            allowSmsSubscriptions: false,
            webhookNotifications: []
        }
    });

    const [preview, setPreview] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('branding');

    useEffect(() => {
        const loadConfiguration = async () => {
            try {
                const response = await fetch(`/api/monitoring/status-page-config/${workspaceId}`, {
                    credentials: 'include'
                });

                if (response.ok) {
                    const data = await response.json();
                    setConfig(prev => ({ ...prev, ...data }));
                }
            } catch (error) {
                console.error('Error loading status page configuration:', error);
            } finally {
                setLoading(false);
            }
        };

        loadConfiguration();
    }, [workspaceId]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const response = await fetch(`/api/monitoring/status-page-config/${workspaceId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(config)
            });

            if (response.ok) {
                onSave && onSave(config);
                alert('Status page configuration saved successfully!');
            } else {
                throw new Error('Failed to save configuration');
            }
        } catch (error) {
            console.error('Error saving configuration:', error);
            alert('Error saving configuration. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleColorChange = (field, value) => {
        setConfig(prev => ({
            ...prev,
            branding: {
                ...prev.branding,
                [field]: value
            }
        }));
    };

    const handleContentChange = (field, value) => {
        setConfig(prev => ({
            ...prev,
            content: {
                ...prev.content,
                [field]: value
            }
        }));
    };

    const handleLogoUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('logo', file);

        try {
            const response = await fetch('/api/monitoring/upload-logo', {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                handleColorChange('logoUrl', data.logoUrl);
            }
        } catch (error) {
            console.error('Error uploading logo:', error);
        }
    };

    if (loading) {
        return (
            <div className="status-config-loading">
                <div className="loading-spinner"></div>
                <p>Loading configuration...</p>
            </div>
        );
    }

    return (
        <div className="status-page-configuration">
            <div className="config-header">
                <h2><FiSettings /> Status Page Configuration</h2>
                <div className="header-actions">
                    <button
                        className="btn-secondary"
                        onClick={() => setPreview(!preview)}
                    >
                        <FiEye /> {preview ? 'Hide Preview' : 'Show Preview'}
                    </button>
                    <button
                        className="btn-primary"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        <FiSave /> {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            <div className="config-content">
                <div className="config-tabs">
                    <button
                        className={`tab ${activeTab === 'branding' ? 'active' : ''}`}
                        onClick={() => setActiveTab('branding')}
                    >
                        <FiPalette /> Branding
                    </button>
                    <button
                        className={`tab ${activeTab === 'content' ? 'active' : ''}`}
                        onClick={() => setActiveTab('content')}
                    >
                        <FiType /> Content
                    </button>
                    <button
                        className={`tab ${activeTab === 'notifications' ? 'active' : ''}`}
                        onClick={() => setActiveTab('notifications')}
                    >
                        <FiGlobe /> Notifications
                    </button>
                </div>

                <div className="tab-content">
                    {activeTab === 'branding' && (
                        <div className="branding-config">
                            <div className="form-group">
                                <label>Company Name</label>
                                <input
                                    type="text"
                                    value={config.branding.companyName}
                                    onChange={(e) => handleColorChange('companyName', e.target.value)}
                                    placeholder="Your Company Name"
                                />
                            </div>

                            <div className="form-group">
                                <label>Logo</label>
                                <div className="logo-upload">
                                    {config.branding.logoUrl && (
                                        <img
                                            src={config.branding.logoUrl}
                                            alt="Current logo"
                                            className="current-logo"
                                        />
                                    )}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleLogoUpload}
                                        id="logo-upload"
                                        style={{ display: 'none' }}
                                    />
                                    <label htmlFor="logo-upload" className="upload-btn">
                                        <FiUpload /> Upload Logo
                                    </label>
                                </div>
                            </div>

                            <div className="color-grid">
                                <div className="form-group">
                                    <label>Primary Color</label>
                                    <div className="color-input">
                                        <input
                                            type="color"
                                            value={config.branding.primaryColor}
                                            onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                                        />
                                        <input
                                            type="text"
                                            value={config.branding.primaryColor}
                                            onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Secondary Color</label>
                                    <div className="color-input">
                                        <input
                                            type="color"
                                            value={config.branding.secondaryColor}
                                            onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                                        />
                                        <input
                                            type="text"
                                            value={config.branding.secondaryColor}
                                            onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Background Color</label>
                                    <div className="color-input">
                                        <input
                                            type="color"
                                            value={config.branding.backgroundColor}
                                            onChange={(e) => handleColorChange('backgroundColor', e.target.value)}
                                        />
                                        <input
                                            type="text"
                                            value={config.branding.backgroundColor}
                                            onChange={(e) => handleColorChange('backgroundColor', e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Text Color</label>
                                    <div className="color-input">
                                        <input
                                            type="color"
                                            value={config.branding.textColor}
                                            onChange={(e) => handleColorChange('textColor', e.target.value)}
                                        />
                                        <input
                                            type="text"
                                            value={config.branding.textColor}
                                            onChange={(e) => handleColorChange('textColor', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Custom CSS</label>
                                <textarea
                                    value={config.branding.customCss}
                                    onChange={(e) => handleColorChange('customCss', e.target.value)}
                                    placeholder="/* Custom CSS styles */"
                                    rows={6}
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'content' && (
                        <div className="content-config">
                            <div className="form-group">
                                <label>Page Headline</label>
                                <input
                                    type="text"
                                    value={config.content.headline}
                                    onChange={(e) => handleContentChange('headline', e.target.value)}
                                    placeholder="System Status"
                                />
                            </div>

                            <div className="form-group">
                                <label>Description</label>
                                <textarea
                                    value={config.content.description}
                                    onChange={(e) => handleContentChange('description', e.target.value)}
                                    placeholder="Current status and uptime monitoring for our services"
                                    rows={3}
                                />
                            </div>

                            <div className="form-group">
                                <label>Custom Domain</label>
                                <input
                                    type="text"
                                    value={config.content.customDomain}
                                    onChange={(e) => handleContentChange('customDomain', e.target.value)}
                                    placeholder="status.yourcompany.com"
                                />
                            </div>

                            <div className="form-group">
                                <label>Footer Text</label>
                                <input
                                    type="text"
                                    value={config.content.footerText}
                                    onChange={(e) => handleContentChange('footerText', e.target.value)}
                                    placeholder="Powered by Pigeon Monitoring"
                                />
                            </div>

                            <div className="checkbox-group">
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={config.content.enableHistory}
                                        onChange={(e) => handleContentChange('enableHistory', e.target.checked)}
                                    />
                                    Enable Historical Data
                                </label>

                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={config.content.showMetrics}
                                        onChange={(e) => handleContentChange('showMetrics', e.target.checked)}
                                    />
                                    Show Performance Metrics
                                </label>

                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={config.content.showIncidents}
                                        onChange={(e) => handleContentChange('showIncidents', e.target.checked)}
                                    />
                                    Show Recent Incidents
                                </label>

                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={config.content.autoRefresh}
                                        onChange={(e) => handleContentChange('autoRefresh', e.target.checked)}
                                    />
                                    Auto Refresh
                                </label>
                            </div>

                            {config.content.autoRefresh && (
                                <div className="form-group">
                                    <label>Refresh Interval (seconds)</label>
                                    <input
                                        type="number"
                                        value={config.content.refreshInterval}
                                        onChange={(e) => handleContentChange('refreshInterval', parseInt(e.target.value))}
                                        min={10}
                                        max={300}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'notifications' && (
                        <div className="notifications-config">
                            <div className="checkbox-group">
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={config.notifications.enableSubscriptions}
                                        onChange={(e) => setConfig(prev => ({
                                            ...prev,
                                            notifications: {
                                                ...prev.notifications,
                                                enableSubscriptions: e.target.checked
                                            }
                                        }))}
                                    />
                                    Enable Status Subscriptions
                                </label>

                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={config.notifications.allowEmailSubscriptions}
                                        onChange={(e) => setConfig(prev => ({
                                            ...prev,
                                            notifications: {
                                                ...prev.notifications,
                                                allowEmailSubscriptions: e.target.checked
                                            }
                                        }))}
                                    />
                                    Allow Email Subscriptions
                                </label>

                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={config.notifications.allowSmsSubscriptions}
                                        onChange={(e) => setConfig(prev => ({
                                            ...prev,
                                            notifications: {
                                                ...prev.notifications,
                                                allowSmsSubscriptions: e.target.checked
                                            }
                                        }))}
                                    />
                                    Allow SMS Subscriptions
                                </label>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {preview && (
                <div className="preview-section">
                    <h3>Preview</h3>
                    <div
                        className="status-page-preview"
                        style={{
                            backgroundColor: config.branding.backgroundColor,
                            color: config.branding.textColor,
                            '--primary-color': config.branding.primaryColor,
                            '--secondary-color': config.branding.secondaryColor
                        }}
                    >
                        <div className="preview-header">
                            {config.branding.logoUrl && (
                                <img src={config.branding.logoUrl} alt="Logo" className="preview-logo" />
                            )}
                            <h1>{config.content.headline}</h1>
                            <p>{config.content.description}</p>
                        </div>
                        <div className="preview-status">
                            <div className="status-indicator operational">
                                🟢 All Systems Operational
                            </div>
                        </div>
                        <div className="preview-footer">
                            <p>{config.content.footerText}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StatusPageConfiguration;
