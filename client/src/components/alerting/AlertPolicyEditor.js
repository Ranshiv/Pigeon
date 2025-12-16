/* global globalThis */
// client/src/components/Alerting/AlertPolicyEditor.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    FiBell, FiActivity, FiBarChart, FiUsers, FiSettings,
    FiTool, FiPlus, FiX, FiSave, FiEdit2, FiTrash2,
    FiCheck, FiAlertTriangle, FiShield
} from 'react-icons/fi';
import './AlertPolicyEditor.css';

const AlertPolicyEditor = () => {
    const navigate = useNavigate();

    const [showEditor, setShowEditor] = useState(false);

    // Data State
    const [policies, setPolicies] = useState([]);
    const [currentPolicy, setCurrentPolicy] = useState(null);
    const [monitors, setMonitors] = useState([]);
    const [loading, setLoading] = useState(false);

    // List UI State
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // all | active | disabled

    // Initial Data Fetch
    useEffect(() => {
        fetchPolicies();
        fetchMonitors();
    }, []);

    const makeKey = () => {
        if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
        return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    };

    const fetchPolicies = async () => {
        setLoading(true);
        try {
            // Updated to separate endpoint for retrieving all policies
            const response = await axios.get('/api/monitoring/alert-policies');
            setPolicies(response.data);
        } catch (error) {
            console.error('Error fetching policies:', error);
            // Fallback for dev/demo if API fails
            // setPolicies([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchMonitors = async () => {
        try {
            const response = await axios.get('/api/monitoring/monitors');
            setMonitors(response.data);
        } catch (error) {
            console.error('Error fetching monitors:', error);
        }
    };

    const CHANNEL_OPTIONS = [
        { type: 'email', label: 'Email' },
        { type: 'slack', label: 'Slack' },
        { type: 'webhook', label: 'Webhook' },
        { type: 'sms', label: 'SMS' },
        { type: 'pagerduty', label: 'PagerDuty' },
        { type: 'msteams', label: 'MS Teams' }
    ];

    const normalizeNotificationChannels = (channels) => {
        if (!Array.isArray(channels)) return [];
        const allowed = new Set(CHANNEL_OPTIONS.map((c) => c.type));

        // Normalize shape and drop unknown channel types
        return channels
            .map((c) => {
                if (!c) return null;
                if (typeof c === 'string') {
                    return allowed.has(c) ? { type: c, enabled: true, config: {} } : null;
                }
                if (typeof c === 'object') {
                    const type = c.type;
                    if (!allowed.has(type)) return null;
                    return {
                        type,
                        enabled: c.enabled !== false,
                        config: c.config && typeof c.config === 'object' ? c.config : {}
                    };
                }
                return null;
            })
            .filter(Boolean);
    };

    const isChannelEnabled = (policy, type) => {
        const channels = normalizeNotificationChannels(policy?.notificationChannels);
        const found = channels.find((c) => c.type === type);
        return !!found && found.enabled !== false;
    };

    const setChannelEnabled = (type, enabled) => {
        setCurrentPolicy((prev) => {
            if (!prev) return prev;
            const next = normalizeNotificationChannels(prev.notificationChannels);
            const idx = next.findIndex((c) => c.type === type);
            if (idx >= 0) {
                next[idx] = { ...next[idx], enabled };
            } else if (enabled) {
                next.push({ type, enabled: true, config: {} });
            }

            // Keep a stable order matching CHANNEL_OPTIONS
            const order = new Map(CHANNEL_OPTIONS.map((c, i) => [c.type, i]));
            next.sort((a, b) => (order.get(a.type) ?? 999) - (order.get(b.type) ?? 999));

            return { ...prev, notificationChannels: next };
        });
    };

    const toIdString = (value) => {
        if (value === null || value === undefined) return null;
        if (typeof value === 'string') return value;
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);

        if (typeof value === 'object') {
            if (value._id) return String(value._id);
            if (value.id) return String(value.id);
        }

        try {
            return String(value);
        } catch {
            return null;
        }
    };

    const normalizePolicyForEditor = (policy) => {
        const normalized = { ...policy };

        const normalizeOperator = (op) => {
            if (!op) return op;
            const mapped = {
                greater: 'gt',
                greaterThan: 'gt',
                gte: 'gte',
                greaterOrEqual: 'gte',
                less: 'lt',
                lessThan: 'lt',
                lte: 'lte',
                lessOrEqual: 'lte',
                equals: 'eq',
                equal: 'eq',
                eq: 'eq',
                notEquals: 'neq',
                notEqual: 'neq',
                neq: 'neq'
            };
            return mapped[op] || op;
        };

        // Backend uses monitorIds; older UI used monitors
        if (!normalized.monitorIds && Array.isArray(normalized.monitors)) {
            normalized.monitorIds = normalized.monitors;
        }

        // When backend populates monitorIds, it becomes an array of Monitor objects.
        // Normalize to an array of id strings for stable checkbox behavior.
        if (Array.isArray(normalized.monitorIds)) {
            normalized.monitorIds = normalized.monitorIds
                .map(toIdString)
                .filter(Boolean);
        }

        // Normalize conditions to expected editor shape
        if (Array.isArray(normalized.conditions)) {
            normalized.conditions = normalized.conditions.map((c) => {
                const next = { ...c };
                if (!next._key) next._key = makeKey();
                next.operator = normalizeOperator(next.operator);
                if (next.threshold === undefined && next.value !== undefined) {
                    next.threshold = next.value;
                }
                // If still missing, keep a sensible default for UI
                if (next.threshold === undefined) next.threshold = 1000;
                return next;
            });
        }

        // Normalize rate limiting naming (backend uses rateLimit, older UI used rateLimiting)
        if (!normalized.rateLimit && normalized.rateLimiting) {
            normalized.rateLimit = normalized.rateLimiting;
        }

        // Normalize notification channels
        normalized.notificationChannels = normalizeNotificationChannels(normalized.notificationChannels);

        return normalized;
    };

    // Prevent exponent / sign characters that browsers allow in <input type="number">
    // This avoids confusing "stops at e" behavior when users type non-numeric text.
    const blockInvalidNumberKey = (e) => {
        if (['e', 'E', '+', '-'].includes(e.key)) {
            e.preventDefault();
        }
    };

    // --- Actions ---

    const handleSubmit = (event) => {
        event.preventDefault();
        handleSave();
    };

    const handleCreateNew = () => {
        setCurrentPolicy({
            name: '',
            description: '',
            enabled: true,
            monitorIds: [],
            notificationChannels: [{ type: 'email', enabled: true, config: {} }],
            conditions: [{
                type: 'threshold',
                metric: 'responseTime',
                operator: 'gt',
                threshold: 1000
            }],
            severity: 'medium',
            actions: {
                createIncident: false,
                notifyTeam: true,
                escalate: false
            },
            rateLimit: {
                enabled: true,
                maxAlerts: 10,
                windowMinutes: 60
            }
        });
        setShowEditor(true);
    };

    const handleEdit = (policy) => {
        setCurrentPolicy(normalizePolicyForEditor(policy));
        setShowEditor(true);
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (!globalThis.confirm('Are you sure you want to delete this policy?')) return;

        try {
            await axios.delete(`/api/monitoring/alert-policies/${id}`);
            setPolicies(policies.filter(p => p._id !== id));
        } catch (error) {
            console.error('Error deleting policy:', error);
            alert('Failed to delete policy');
        }
    };

    const handleSave = async () => {
        if (!currentPolicy.name) {
            alert('Policy name is required');
            return;
        }

        setLoading(true);
        try {
            if (currentPolicy._id) {
                await axios.put(`/api/monitoring/alert-policies/${currentPolicy._id}`, currentPolicy);
            } else {
                await axios.post('/api/monitoring/alert-policies', currentPolicy);
            }
            await fetchPolicies();
            setShowEditor(false);
        } catch (error) {
            console.error('Error saving policy:', error);
            alert('Failed to save policy');
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        setCurrentPolicy(null);
        setShowEditor(false);
    };

    // --- Editor Field Updates ---

    const updatePolicy = (field, value) => {
        setCurrentPolicy(prev => ({ ...prev, [field]: value }));
    };

    const updateCondition = (idx, patch) => {
        setCurrentPolicy((prev) => {
            if (!prev) return prev;
            const nextConditions = [...(prev.conditions || [])];
            nextConditions[idx] = { ...nextConditions[idx], ...patch };
            return { ...prev, conditions: nextConditions };
        });
    };

    const removeCondition = (idx) => {
        setCurrentPolicy((prev) => {
            if (!prev) return prev;
            const nextConditions = (prev.conditions || []).filter((_, i) => i !== idx);
            return { ...prev, conditions: nextConditions };
        });
    };

    const toggleMonitorSelection = (monitorId) => {
        if (!monitorId) return;
        setCurrentPolicy((prev) => {
            if (!prev) return prev;
            const next = new Set((prev.monitorIds || []).map(toIdString).filter(Boolean));
            if (next.has(monitorId)) next.delete(monitorId);
            else next.add(monitorId);
            return { ...prev, monitorIds: Array.from(next) };
        });
    };

    // --- Render Helpers ---

    const renderNav = () => (
        <div className="monitoring-nav">
            <button type="button" className="nav-btn" onClick={() => navigate('/workspace/monitoring')}>
                <FiActivity /> Dashboard
            </button>
            <button type="button" className="nav-btn active">
                <FiBell /> Alerts & Policies
            </button>
            <button type="button" className="nav-btn" onClick={() => navigate('/workspace/monitoring/reports')}>
                <FiBarChart /> Reports
            </button>
            <button type="button" className="nav-btn" onClick={() => navigate('/workspace/monitoring/teams')}>
                <FiUsers /> Teams
            </button>
            <button type="button" className="nav-btn" onClick={() => navigate('/workspace/monitoring/integrations')}>
                <FiSettings /> Integrations
            </button>
            <button type="button" className="nav-btn" onClick={() => navigate('/workspace/monitoring/maintenance')}>
                <FiTool /> Maintenance
            </button>
        </div>
    );

    // --- Views ---

    const renderListView = () => {
        const query = searchQuery.trim().toLowerCase();
        const filteredPolicies = policies
            .filter((p) => {
                if (statusFilter === 'active') return !!p.enabled;
                if (statusFilter === 'disabled') return !p.enabled;
                return true;
            })
            .filter((p) => {
                if (!query) return true;
                const name = (p.name || '').toLowerCase();
                const desc = (p.description || '').toLowerCase();
                return name.includes(query) || desc.includes(query);
            });

        let listContent;

        if (loading) {
            listContent = (
                <div className="policyLoading">
                    <div className="policySpinner" aria-hidden="true"></div>
                    <p>Loading policies…</p>
                </div>
            );
        } else if (policies.length === 0) {
            listContent = (
                <div className="policyEmpty">
                    <div className="policyEmptyIcon" aria-hidden="true"><FiShield /></div>
                    <h3>No Alert Policies Defined</h3>
                    <p>Create a policy to start getting notified about monitor incidents.</p>
                    <button type="button" className="policyBtn policyBtnPrimary" onClick={handleCreateNew}>
                        <FiPlus /> Create Your First Policy
                    </button>
                </div>
            );
        } else if (filteredPolicies.length === 0) {
            listContent = (
                <div className="policyEmpty policyEmptyCompact">
                    <h3>No matching policies</h3>
                    <p>Try a different search term or change the status filter.</p>
                    <button
                        type="button"
                        className="policyBtn policyBtnSecondary"
                        onClick={() => {
                            setSearchQuery('');
                            setStatusFilter('all');
                        }}
                    >
                        Clear filters
                    </button>
                </div>
            );
        } else {
            listContent = (
                <ul className="policyGrid">
                    {filteredPolicies.map((policy) => (
                        <li key={policy._id} className="policyCardItem">
                            <button
                                type="button"
                                className="policyCardMain"
                                onClick={() => handleEdit(policy)}
                            >
                                <div className="policyCardTop">
                                    <span className={`policyBadge ${policy.enabled ? 'isActive' : 'isDisabled'}`}>
                                        {policy.enabled ? 'Active' : 'Disabled'}
                                    </span>
                                </div>
                                <div className="policyCardBody">
                                    <h3 className="policyCardTitle">{policy.name}</h3>
                                    <p className="policyCardDesc">{policy.description || 'No description provided.'}</p>
                                </div>
                                <div className="policyCardMeta">
                                    <div className="policyMetaItem">
                                        <FiActivity /> {(policy.monitorIds || policy.monitors)?.length || 0} Monitors
                                    </div>
                                    <div className="policyMetaItem">
                                        <FiAlertTriangle /> {policy.conditions?.length || 0} Conditions
                                    </div>
                                </div>
                            </button>
                            <div className="policyCardFooter">
                                <button
                                    type="button"
                                    className="policyBtn policyBtnGhost"
                                    onClick={() => handleEdit(policy)}
                                >
                                    <FiEdit2 /> Edit
                                </button>
                                <button
                                    type="button"
                                    className="policyBtn policyBtnDangerGhost"
                                    onClick={(e) => handleDelete(policy._id, e)}
                                >
                                    <FiTrash2 /> Delete
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            );
        }

        return (
            <div className="policyListView policyFadeIn">
                <div className="policyHeader">
                    <div className="policyHeaderLeft">
                        <div className="policyHeaderIcon" aria-hidden="true"><FiBell /></div>
                        <div>
                            <h1 className="policyTitle">Alerts & Policies</h1>
                            <p className="policySubtitle">Manage alert rules, notification thresholds, and incident actions.</p>
                        </div>
                    </div>
                    <div className="policyHeaderActions">
                        <button type="button" className="policyBtn policyBtnSecondary" onClick={() => navigate('/alerts')}>
                            <FiActivity /> View Alerts
                        </button>
                        <button type="button" className="policyBtn policyBtnPrimary" onClick={handleCreateNew}>
                            <FiPlus /> New Policy
                        </button>
                    </div>
                </div>

                {renderNav()}

                <div className="policyToolbar">
                    <div className="policyToolbarLeft">
                        <div className="policyField">
                            <label className="policyLabel" htmlFor="policySearch">Search</label>
                            <input
                                id="policySearch"
                                className="policyInput"
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by name or description"
                            />
                        </div>
                        <div className="policyField">
                            <label className="policyLabel" htmlFor="policyStatus">Status</label>
                            <select
                                id="policyStatus"
                                className="policySelect"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="all">All</option>
                                <option value="active">Active</option>
                                <option value="disabled">Disabled</option>
                            </select>
                        </div>
                    </div>
                    <div className="policyToolbarRight">
                        <div className="policyCount" aria-live="polite">
                            {loading ? 'Loading…' : `${filteredPolicies.length} of ${policies.length}`}
                        </div>
                    </div>
                </div>

                {listContent}
            </div>
        );
    };

    const renderEditorView = () => (
        <dialog className="policyModalOverlay" open>
            <form className="policyModal policyFadeIn" onSubmit={handleSubmit}>
                <div className="policyModalHeader">
                    <div className="policyHeaderLeft">
                        <div className="policyHeaderIcon" aria-hidden="true"><FiBell /></div>
                        <div>
                            <h2 className="policyModalTitle">{currentPolicy._id ? 'Edit Alert Policy' : 'Create Alert Policy'}</h2>
                            <p className="policyModalSubtitle">{currentPolicy._id ? 'Update thresholds, notifications, and routing.' : 'Define thresholds, notifications, and incident automation.'}</p>
                        </div>
                    </div>
                    <div className="policyHeaderActions">
                        <button type="button" className="policyBtn policyBtnSecondary" onClick={handleCancel}>
                            <FiX /> Close
                        </button>
                        <button type="submit" className="policyBtn policyBtnPrimary" disabled={loading}>
                            <FiSave /> {loading ? 'Saving…' : 'Save Policy'}
                        </button>
                    </div>
                </div>

                <div className="policyModalBody">
                    {/* 1. Basic Info */}
                    <div className="policySection">
                        <div className="policySectionHead">
                            <h3><FiBell /> Basic Details</h3>
                            <p>Name and describe your alert policy.</p>
                        </div>
                        <div className="policyFormGrid">
                            <div className="policyField">
                                <label className="policyLabel" htmlFor="policyName">Policy Name</label>
                                <input
                                    id="policyName"
                                    type="text"
                                    className="policyInput"
                                    value={currentPolicy.name}
                                    onChange={(e) => updatePolicy('name', e.target.value)}
                                    placeholder="e.g. Production High Latency"
                                />
                            </div>
                            <div className="policyField policyFieldToggle">
                                <label className="policyToggle">
                                    <input
                                        type="checkbox"
                                        className="policyToggleInput"
                                        checked={currentPolicy.enabled}
                                        onChange={(e) => updatePolicy('enabled', e.target.checked)}
                                    />
                                    <span className="policyToggleFill" aria-hidden="true"></span>
                                    <span>Policy Enabled</span>
                                </label>
                            </div>
                            <div className="policyField policyFullWidth">
                                <label className="policyLabel" htmlFor="policyDescription">Description</label>
                                <textarea
                                    id="policyDescription"
                                    className="policyTextarea"
                                    value={currentPolicy.description}
                                    onChange={(e) => updatePolicy('description', e.target.value)}
                                    placeholder="What is this policy monitoring?"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 2. Monitors */}
                    <div className="policySection">
                        <div className="policySectionHead">
                            <h3><FiActivity /> Target Monitors</h3>
                            <p>Select the monitors this policy applies to.</p>
                        </div>
                        {monitors.length === 0 ? (
                            <p className="policyHint">No monitors available. Please create a monitor first.</p>
                        ) : (
                            <div className="policyMonitorsGrid">
                                {monitors.map(monitor => {
                                    const selectedIds = new Set(
                                        (currentPolicy.monitorIds || [])
                                            .map(toIdString)
                                            .filter(Boolean)
                                    );
                                    const monitorId = toIdString(monitor._id);
                                    const isSelected = monitorId ? selectedIds.has(monitorId) : false;
                                    const inputId = monitorId ? `monitor-${monitorId}` : `monitor-${makeKey()}`;
                                    return (
                                        <label
                                            key={monitor._id}
                                            className={`policyMonitorCard ${isSelected ? 'selected' : ''}`}
                                            htmlFor={inputId}
                                        >
                                            <input
                                                id={inputId}
                                                type="checkbox"
                                                checked={isSelected}
                                                disabled={!monitorId}
                                                onChange={() => toggleMonitorSelection(monitorId)}
                                            />
                                            <span className="policyMonitorName">{monitor.name}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* 3. Conditions */}
                    <div className="policySection">
                        <div className="policySectionHead policySectionHeadRow">
                            <div>
                                <h3><FiAlertTriangle /> Conditions</h3>
                                <p>Define the logic that triggers an alert.</p>
                            </div>
                            <button
                                type="button"
                                className="policyBtn policyBtnSecondary"
                                onClick={() => {
                                    updatePolicy('conditions', [
                                        ...currentPolicy.conditions,
                                        { _key: makeKey(), type: 'threshold', metric: 'responseTime', operator: 'gt', threshold: 1000 }
                                    ]);
                                }}
                            >
                                <FiPlus /> Add Condition
                            </button>
                        </div>

                        <div className="policyConditionsList">
                            {currentPolicy.conditions.map((condition, idx) => (
                                <div key={condition._key || idx} className="policyConditionItem">
                                    <div className="policyConditionTop">
                                        <div className="policyConditionTitle">Condition {idx + 1}</div>
                                        <button
                                            type="button"
                                            className="policyIconBtnDanger"
                                            aria-label={`Remove condition ${idx + 1}`}
                                            onClick={() => removeCondition(idx)}
                                        >
                                            <FiX />
                                        </button>
                                    </div>
                                    <div className="policyFormGrid">
                                        <div className="policyField">
                                            <label className="policyLabel" htmlFor={`cond-metric-${condition._key || idx}`}>Metric</label>
                                            <select
                                                id={`cond-metric-${condition._key || idx}`}
                                                className="policySelect"
                                                value={condition.metric}
                                                onChange={(e) => {
                                                    updateCondition(idx, { metric: e.target.value });
                                                }}
                                            >
                                                <option value="responseTime">Response Time</option>
                                                <option value="uptime">Uptime / Success Rate</option>
                                                <option value="statusCode">Status Code</option>
                                            </select>
                                        </div>
                                        <div className="policyField">
                                            <label className="policyLabel" htmlFor={`cond-operator-${condition._key || idx}`}>Operator</label>
                                            <select
                                                id={`cond-operator-${condition._key || idx}`}
                                                className="policySelect"
                                                value={condition.operator}
                                                onChange={(e) => {
                                                    updateCondition(idx, { operator: e.target.value });
                                                }}
                                            >
                                                <option value="gt">Greater Than</option>
                                                <option value="gte">Greater Than or Equal</option>
                                                <option value="lt">Less Than</option>
                                                <option value="lte">Less Than or Equal</option>
                                                <option value="eq">Equals</option>
                                                <option value="neq">Not Equals</option>
                                            </select>
                                        </div>
                                        <div className="policyField">
                                            <label className="policyLabel" htmlFor={`cond-threshold-${condition._key || idx}`}>Threshold Value</label>
                                            <input
                                                id={`cond-threshold-${condition._key || idx}`}
                                                type="number"
                                                className="policyInput"
                                                value={condition.threshold}
                                                onKeyDown={blockInvalidNumberKey}
                                                onChange={(e) => {
                                                    const nextVal = e.target.value;
                                                    updateCondition(idx, { threshold: nextVal === '' ? '' : Number.parseFloat(nextVal) });
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 4. Actions & Rate Limits */}
                    <div className="policySection">
                        <div className="policySectionHead">
                            <h3><FiCheck /> Actions & Settings</h3>
                            <p>Configure what happens when a policy triggers.</p>
                        </div>
                        <div className="policyFormGrid">
                            <div className="policyField">
                                <label className="policyLabel" htmlFor="policySeverity">Default Severity</label>
                                <select
                                    id="policySeverity"
                                    className="policySelect"
                                    value={currentPolicy.severity}
                                    onChange={(e) => updatePolicy('severity', e.target.value)}
                                >
                                    <option value="critical">Critical</option>
                                    <option value="high">High</option>
                                    <option value="medium">Medium</option>
                                    <option value="low">Low</option>
                                </select>
                            </div>

                            <div className="policyField">
                                <div className="policyLabel">Automation</div>
                                <div className="policyCheckboxGroup">
                                    <label className="policyCheckbox">
                                        <input
                                            type="checkbox"
                                            checked={currentPolicy.actions?.createIncident}
                                            onChange={(e) => updatePolicy('actions', { ...currentPolicy.actions, createIncident: e.target.checked })}
                                        />
                                        Create Incident automatically
                                    </label>
                                    <label className="policyCheckbox">
                                        <input
                                            type="checkbox"
                                            checked={currentPolicy.actions?.notifyTeam}
                                            onChange={(e) => updatePolicy('actions', { ...currentPolicy.actions, notifyTeam: e.target.checked })}
                                        />
                                        Send Team Notification
                                    </label>
                                </div>
                            </div>

                            <div className="policyField">
                                <div className="policyLabel">Notification Channels</div>
                                <div className="policyCheckboxGroup policyCheckboxGroupTwoCol">
                                    {CHANNEL_OPTIONS.map((opt) => (
                                        <label key={opt.type} className="policyCheckbox">
                                            <input
                                                type="checkbox"
                                                checked={isChannelEnabled(currentPolicy, opt.type)}
                                                onChange={(e) => setChannelEnabled(opt.type, e.target.checked)}
                                            />
                                            {opt.label}
                                        </label>
                                    ))}
                                </div>
                                <div className="policyHelperText">
                                    Email delivery also depends on server email configuration and/or monitor alert settings.
                                </div>
                            </div>
                        </div>

                        <div className="policyRateLimit">
                            <div className="policyField">
                                <label className="policyToggle">
                                    <input
                                        type="checkbox"
                                        className="policyToggleInput"
                                        checked={currentPolicy.rateLimit.enabled}
                                        onChange={(e) => updatePolicy('rateLimit', { ...currentPolicy.rateLimit, enabled: e.target.checked })}
                                    />
                                    <span className="policyToggleFill" aria-hidden="true"></span>
                                    <span>Rate Limiting (Recommended)</span>
                                </label>
                            </div>

                            {currentPolicy.rateLimit.enabled && (
                                <div className="policyFormGrid">
                                    <div className="policyField">
                                        <label className="policyLabel" htmlFor="policyMaxAlerts">Max Alerts</label>
                                        <input
                                            id="policyMaxAlerts"
                                            type="number"
                                            className="policyInput"
                                            value={currentPolicy.rateLimit.maxAlerts}
                                            onKeyDown={blockInvalidNumberKey}
                                            onChange={(e) => updatePolicy('rateLimit', {
                                                ...currentPolicy.rateLimit,
                                                maxAlerts: e.target.value === '' ? '' : Number.parseInt(e.target.value, 10)
                                            })}
                                        />
                                    </div>
                                    <div className="policyField">
                                        <label className="policyLabel" htmlFor="policyWindowMinutes">Per Time Window (Minutes)</label>
                                        <input
                                            id="policyWindowMinutes"
                                            type="number"
                                            className="policyInput"
                                            value={currentPolicy.rateLimit.windowMinutes}
                                            onKeyDown={blockInvalidNumberKey}
                                            onChange={(e) => updatePolicy('rateLimit', {
                                                ...currentPolicy.rateLimit,
                                                windowMinutes: e.target.value === '' ? '' : Number.parseInt(e.target.value, 10)
                                            })}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                <div className="policyModalFooter">
                    <div className="policyModalFooterActions">
                        <button type="button" className="policyBtn policyBtnSecondary" onClick={handleCancel}><FiX /> Cancel</button>
                        <button type="submit" className="policyBtn policyBtnPrimary" disabled={loading}>
                            <FiSave /> {loading ? 'Saving…' : 'Save Policy'}
                        </button>
                    </div>
                </div>
            </form>
        </dialog>
    );

    return (
        <div className="policy-page">
            <div className="policyLayout">
                {showEditor && currentPolicy ? renderEditorView() : renderListView()}
            </div>
        </div>
    );
};

export default AlertPolicyEditor;
