// client/src/components/MockScenarioBuilder.js
import React, { useState, useEffect } from 'react';
import {
    FiX, FiPlus, FiTrash2, FiChevronDown, FiChevronUp, FiPlay,
    FiZap, FiTarget, FiHash, FiPercent, FiCode, FiSave
} from 'react-icons/fi';
import AppSelect from './common/AppSelect/AppSelect';
import './MockScenarioBuilder.css';

const CONDITION_TYPES = [
    { value: 'header', label: 'Header', icon: FiHash },
    { value: 'query', label: 'Query Parameter', icon: FiHash },
    { value: 'body', label: 'Request Body', icon: FiCode },
    { value: 'method', label: 'HTTP Method', icon: FiTarget },
    { value: 'path', label: 'Path', icon: FiTarget },
    { value: 'probability', label: 'Probability', icon: FiPercent },
    { value: 'counter', label: 'Counter Value', icon: FiHash }
];

const OPERATORS = [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not Equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Not Contains' },
    { value: 'starts_with', label: 'Starts With' },
    { value: 'ends_with', label: 'Ends With' },
    { value: 'matches', label: 'Regex Match' },
    { value: 'exists', label: 'Exists' },
    { value: 'not_exists', label: 'Not Exists' },
    { value: 'greater_than', label: 'Greater Than' },
    { value: 'less_than', label: 'Less Than' }
];

const MockScenarioBuilder = ({ mockServer, scenario, onSave, onClose }) => {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        endpointPath: '*',
        endpointMethod: '*',
        priority: 0,
        isActive: true,
        useWeightedResponses: false,
        triggerConditions: [],
        responses: []
    });

    const [expandedCondition, setExpandedCondition] = useState(null);
    const [expandedResponse, setExpandedResponse] = useState(null);
    const [testResult, setTestResult] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (scenario) {
            setFormData({
                name: scenario.name || '',
                description: scenario.description || '',
                endpointPath: scenario.endpointPath || '*',
                endpointMethod: scenario.endpointMethod || '*',
                priority: scenario.priority || 0,
                isActive: scenario.isActive !== false,
                useWeightedResponses: scenario.useWeightedResponses || false,
                triggerConditions: scenario.triggerConditions || [],
                responses: scenario.responses || []
            });
        }
    }, [scenario]);

    // Condition Management
    const addCondition = () => {
        const newCondition = {
            type: 'header',
            key: '',
            operator: 'equals',
            value: '',
            logic: 'AND'
        };
        setFormData({
            ...formData,
            triggerConditions: [...formData.triggerConditions, newCondition]
        });
        setExpandedCondition(formData.triggerConditions.length);
    };

    const updateCondition = (index, updates) => {
        const updated = [...formData.triggerConditions];
        updated[index] = { ...updated[index], ...updates };
        setFormData({ ...formData, triggerConditions: updated });
    };

    const removeCondition = (index) => {
        setFormData({
            ...formData,
            triggerConditions: formData.triggerConditions.filter((_, i) => i !== index)
        });
        if (expandedCondition === index) setExpandedCondition(null);
    };

    // Response Management
    const addResponse = () => {
        const newResponse = {
            name: `Response ${formData.responses.length + 1}`,
            statusCode: 200,
            headers: {},
            body: '{\n  "message": "Response"\n}',
            delay: 0,
            weight: 100
        };
        setFormData({
            ...formData,
            responses: [...formData.responses, newResponse]
        });
        setExpandedResponse(formData.responses.length);
    };

    const updateResponse = (index, updates) => {
        const updated = [...formData.responses];
        updated[index] = { ...updated[index], ...updates };
        setFormData({ ...formData, responses: updated });
    };

    const removeResponse = (index) => {
        setFormData({
            ...formData,
            responses: formData.responses.filter((_, i) => i !== index)
        });
        if (expandedResponse === index) setExpandedResponse(null);
    };

    // Test Scenario
    const testScenario = async () => {
        setTestResult({ loading: true });

        try {
            // Create a test request based on the scenario
            const mockUrl = `/api/mock-servers/${mockServer._id}/simulate${formData.endpointPath === '*' ? '/test' : formData.endpointPath}`;

            const response = await fetch(mockUrl, {
                method: formData.endpointMethod === '*' ? 'GET' : formData.endpointMethod,
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();
            setTestResult({
                success: true,
                status: response.status,
                scenarioMatched: response.headers.get('X-Mock-Scenario'),
                data
            });
        } catch (err) {
            setTestResult({
                success: false,
                error: err.message
            });
        }
    };

    // Save
    const handleSave = async () => {
        if (!formData.name.trim()) {
            alert('Please enter a scenario name');
            return;
        }

        if (formData.responses.length === 0) {
            alert('Please add at least one response');
            return;
        }

        setIsSaving(true);

        // Parse response bodies
        const processedResponses = formData.responses.map(r => {
            let body;
            try {
                body = JSON.parse(r.body);
            } catch {
                body = r.body;
            }
            return { ...r, body };
        });

        try {
            await onSave({
                ...formData,
                responses: processedResponses
            });
        } finally {
            setIsSaving(false);
        }
    };

    const getConditionPreview = (condition) => {
        if (condition.type === 'probability') {
            return `${condition.value}% chance`;
        }
        if (condition.operator === 'exists' || condition.operator === 'not_exists') {
            return `${condition.key} ${condition.operator.replace('_', ' ')}`;
        }
        return `${condition.key} ${condition.operator.replace('_', ' ')} "${condition.value}"`;
    };

    const getStatusClass = (status) => {
        if (status >= 200 && status < 300) return 'status-2xx';
        if (status >= 400 && status < 500) return 'status-4xx';
        return 'status-5xx';
    };

    // Calculate weight percentages
    const totalWeight = formData.responses.reduce((sum, r) => sum + (r.weight || 100), 0);

    return (
        <div className="scenario-builder-overlay" onClick={onClose}>
            <div className="scenario-builder-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="modal-header">
                    <h3>
                        <FiZap size={18} />
                        {scenario ? 'Edit Scenario' : 'Create Scenario'}
                    </h3>
                    <button className="close-btn" onClick={onClose}>
                        <FiX size={18} />
                    </button>
                </div>

                {/* Form */}
                <div className="scenario-form">
                    {/* Basic Info */}
                    <div className="form-section">
                        <h4>Basic Information</h4>
                        <div className="form-row">
                            <div className="form-group flex-grow">
                                <label>Scenario Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g., Error Response for Invalid Token"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Priority</label>
                                <input
                                    type="number"
                                    value={formData.priority}
                                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                                    min="0"
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Description (optional)</label>
                            <textarea
                                placeholder="When should this scenario trigger?"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={2}
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Endpoint Method</label>
                                <AppSelect
                                    id="scenario-endpoint-method"
                                    value={formData.endpointMethod}
                                    onChange={(endpointMethod) => setFormData({ ...formData, endpointMethod })}
                                    options={[
                                        { value: '*', label: 'Any Method' },
                                        { value: 'GET', label: 'GET' },
                                        { value: 'POST', label: 'POST' },
                                        { value: 'PUT', label: 'PUT' },
                                        { value: 'DELETE', label: 'DELETE' },
                                        { value: 'PATCH', label: 'PATCH' }
                                    ]}
                                />
                            </div>
                            <div className="form-group flex-grow">
                                <label>Endpoint Path</label>
                                <input
                                    type="text"
                                    placeholder="* for any path, or /api/users"
                                    value={formData.endpointPath}
                                    onChange={(e) => setFormData({ ...formData, endpointPath: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Trigger Conditions */}
                    <div className="form-section">
                        <div className="section-header">
                            <h4>
                                <FiTarget size={14} />
                                Trigger Conditions
                            </h4>
                            <button className="btn-add" onClick={addCondition}>
                                <FiPlus size={12} />
                                Add Condition
                            </button>
                        </div>

                        {formData.triggerConditions.length > 0 ? (
                            <div className="conditions-list">
                                {formData.triggerConditions.map((condition, index) => (
                                    <div key={index} className="condition-card">
                                        <div
                                            className="condition-header"
                                            onClick={() => setExpandedCondition(
                                                expandedCondition === index ? null : index
                                            )}
                                        >
                                            <div className="condition-title">
                                                {index > 0 && (
                                                    <span className="logic-badge">
                                                        {condition.logic}
                                                    </span>
                                                )}
                                                <span className="condition-type">
                                                    {CONDITION_TYPES.find(t => t.value === condition.type)?.label}
                                                </span>
                                                <span className="condition-preview">
                                                    {getConditionPreview(condition)}
                                                </span>
                                            </div>
                                            <div className="condition-actions">
                                                <button
                                                    className="btn-icon"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeCondition(index);
                                                    }}
                                                >
                                                    <FiTrash2 size={14} />
                                                </button>
                                                {expandedCondition === index
                                                    ? <FiChevronUp size={16} />
                                                    : <FiChevronDown size={16} />
                                                }
                                            </div>
                                        </div>

                                        {expandedCondition === index && (
                                            <div className="condition-body">
                                                {index > 0 && (
                                                    <div className="condition-field-row">
                                                        <label>Logic</label>
                                                        <AppSelect
                                                            id={`scenario-condition-${index}-logic`}
                                                            value={condition.logic}
                                                            onChange={(logic) => updateCondition(index, { logic })}
                                                            options={[{ value: 'AND', label: 'AND' }, { value: 'OR', label: 'OR' }]}
                                                        />
                                                    </div>
                                                )}

                                                <div className="condition-field-row">
                                                    <label>Type</label>
                                                    <AppSelect
                                                        id={`scenario-condition-${index}-type`}
                                                        value={condition.type}
                                                        onChange={(type) => updateCondition(index, { type })}
                                                        options={CONDITION_TYPES.map(({ value, label }) => ({ value, label }))}
                                                    />
                                                </div>

                                                {condition.type !== 'probability' && (
                                                    <div className="condition-field-row">
                                                        <label>
                                                            {condition.type === 'body' ? 'JSON Path' : 'Key'}
                                                        </label>
                                                        <input
                                                            type="text"
                                                            placeholder={condition.type === 'body' ? 'user.role' : 'Authorization'}
                                                            value={condition.key}
                                                            onChange={(e) => updateCondition(index, { key: e.target.value })}
                                                        />
                                                    </div>
                                                )}

                                                <div className="condition-field-row">
                                                    <label>Operator</label>
                                                    <AppSelect
                                                        id={`scenario-condition-${index}-operator`}
                                                        value={condition.operator}
                                                        onChange={(operator) => updateCondition(index, { operator })}
                                                        options={OPERATORS}
                                                    />
                                                </div>

                                                {condition.operator !== 'exists' &&
                                                    condition.operator !== 'not_exists' && (
                                                        <div className="condition-field-row">
                                                            <label>
                                                                {condition.type === 'probability' ? 'Percentage (0-100)' : 'Value'}
                                                            </label>
                                                            <input
                                                                type={condition.type === 'probability' ? 'number' : 'text'}
                                                                placeholder={condition.type === 'probability' ? '50' : 'Expected value'}
                                                                value={condition.value}
                                                                onChange={(e) => updateCondition(index, { value: e.target.value })}
                                                                min={condition.type === 'probability' ? 0 : undefined}
                                                                max={condition.type === 'probability' ? 100 : undefined}
                                                            />
                                                        </div>
                                                    )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="empty-state">
                                <p>No conditions - scenario will always trigger when matching the endpoint</p>
                            </div>
                        )}
                    </div>

                    {/* Responses */}
                    <div className="form-section">
                        <div className="section-header">
                            <h4>
                                <FiCode size={14} />
                                Responses
                            </h4>
                            <div className="section-actions">
                                <label
                                    className={`weighted-toggle ${formData.useWeightedResponses ? 'is-active' : ''}`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={formData.useWeightedResponses}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            useWeightedResponses: e.target.checked
                                        })}
                                    />
                                    <span className="weighted-toggle-switch" aria-hidden="true">
                                        <span className="switch-thumb" />
                                    </span>
                                    <div className="weighted-toggle-copy">
                                        <span className="title">Use weighted selection</span>
                                        <span className="subtitle">Distribute responses by weight</span>
                                    </div>
                                </label>
                                <button className="btn-add" onClick={addResponse}>
                                    <FiPlus size={12} />
                                    Add Response
                                </button>
                            </div>
                        </div>

                        {formData.responses.length > 0 ? (
                            <>
                                <div className="responses-list">
                                    {formData.responses.map((response, index) => (
                                        <div key={index} className="response-card">
                                            <div
                                                className="response-header"
                                                onClick={() => setExpandedResponse(
                                                    expandedResponse === index ? null : index
                                                )}
                                            >
                                                <div className="response-title">
                                                    <span className={`status-badge ${getStatusClass(response.statusCode)}`}>
                                                        {response.statusCode}
                                                    </span>
                                                    <span className="response-name">{response.name}</span>
                                                    {formData.useWeightedResponses && (
                                                        <span className="weight-badge">
                                                            {Math.round((response.weight / totalWeight) * 100)}%
                                                        </span>
                                                    )}
                                                    {response.delay > 0 && (
                                                        <span className="delay-badge">{response.delay}ms</span>
                                                    )}
                                                </div>
                                                <div className="response-actions">
                                                    <button
                                                        className="btn-icon"
                                                        aria-label="Delete response"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            removeResponse(index);
                                                        }}
                                                    >
                                                        <FiTrash2 size={14} />
                                                    </button>
                                                    {expandedResponse === index
                                                        ? <FiChevronUp size={16} />
                                                        : <FiChevronDown size={16} />
                                                    }
                                                </div>
                                            </div>

                                            {expandedResponse === index && (
                                                <div className="response-body">
                                                    <div className="response-row">
                                                        <div className="form-group">
                                                            <label>Response Name</label>
                                                            <input
                                                                type="text"
                                                                value={response.name}
                                                                onChange={(e) => updateResponse(index, { name: e.target.value })}
                                                            />
                                                        </div>
                                                        <div className="form-group">
                                                            <label>Status Code</label>
                                                            <input
                                                                type="number"
                                                                value={response.statusCode}
                                                                onChange={(e) => updateResponse(index, { statusCode: parseInt(e.target.value) })}
                                                                min="100"
                                                                max="599"
                                                            />
                                                        </div>
                                                        <div className="form-group">
                                                            <label>Delay (ms)</label>
                                                            <input
                                                                type="number"
                                                                value={response.delay || 0}
                                                                onChange={(e) => updateResponse(index, { delay: parseInt(e.target.value) || 0 })}
                                                                min="0"
                                                            />
                                                        </div>
                                                    </div>

                                                    {formData.useWeightedResponses && (
                                                        <div className="form-group">
                                                            <label>Weight</label>
                                                            <div className="weight-control">
                                                                <input
                                                                    type="range"
                                                                    min="1"
                                                                    max="100"
                                                                    value={response.weight || 100}
                                                                    onChange={(e) => updateResponse(index, { weight: parseInt(e.target.value) })}
                                                                />
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    value={response.weight || 100}
                                                                    onChange={(e) => updateResponse(index, { weight: parseInt(e.target.value) || 1 })}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="form-group">
                                                        <label>Response Body</label>
                                                        <textarea
                                                            className="response-body-editor"
                                                            value={typeof response.body === 'string'
                                                                ? response.body
                                                                : JSON.stringify(response.body, null, 2)
                                                            }
                                                            onChange={(e) => updateResponse(index, { body: e.target.value })}
                                                            rows={6}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Weight Visualization */}
                                {formData.useWeightedResponses && formData.responses.length > 1 && (
                                    <div className="weight-visualization">
                                        <div className="weight-bar">
                                            {formData.responses.map((response, index) => (
                                                <div
                                                    key={index}
                                                    className={`weight-segment ${getStatusClass(response.statusCode)}`}
                                                    style={{ width: `${(response.weight / totalWeight) * 100}%` }}
                                                    title={`${response.name}: ${Math.round((response.weight / totalWeight) * 100)}%`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="empty-state">
                                <p>Add at least one response for this scenario</p>
                            </div>
                        )}
                    </div>

                    {/* Test Section */}
                    <div className="test-section">
                        <button className="btn-test" onClick={testScenario}>
                            <FiPlay size={14} />
                            Test Scenario
                        </button>

                        {testResult && (
                            <div className={`test-result ${testResult.loading ? 'loading' : ''}`}>
                                {testResult.loading ? (
                                    <p>Testing...</p>
                                ) : testResult.success ? (
                                    <>
                                        <p className="test-message">
                                            Status: {testResult.status}
                                            {testResult.scenarioMatched && ` | Matched: ${testResult.scenarioMatched}`}
                                        </p>
                                        <pre className="test-response">
                                            {JSON.stringify(testResult.data, null, 2)}
                                        </pre>
                                    </>
                                ) : (
                                    <p className="test-error">Error: {testResult.error}</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="form-actions">
                        <button className="btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            className="btn-primary"
                            onClick={handleSave}
                            disabled={isSaving}
                        >
                            <FiSave size={14} />
                            {isSaving ? 'Saving...' : (scenario ? 'Update Scenario' : 'Create Scenario')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MockScenarioBuilder;
