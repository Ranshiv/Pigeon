import React, { useState, useEffect, useCallback } from 'react';
import { FiSettings, FiTrash2, FiCheck, FiX, FiInfo } from 'react-icons/fi';
import './PropertiesPanel.css';

/**
 * PropertiesPanel - Enhanced right sidebar for component configuration
 * Follows Clean Code principles:
 * - SRP: Only handles property editing and validation
 * - Extracted property renderers for each component type
 * - Clear separation of concerns between UI and logic
 */

const PropertiesPanel = ({ selectedNode, onNodeUpdate, onDeleteNode }) => {
    const [properties, setProperties] = useState({});
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (selectedNode) {
            setProperties(selectedNode.data || {});
            setErrors({});
        } else {
            setProperties({});
            setErrors({});
        }
    }, [selectedNode]);

    const handlePropertyChange = useCallback((key, value) => {
        const newProperties = { ...properties, [key]: value };
        setProperties(newProperties);

        if (onNodeUpdate && selectedNode) {
            onNodeUpdate(selectedNode.id, newProperties);
        }
    }, [properties, onNodeUpdate, selectedNode]);

    const validateProperty = useCallback((key, value) => {
        const newErrors = { ...errors };

        switch (key) {
            case 'path':
                if (!value || !value.startsWith('/')) {
                    newErrors[key] = 'Path must start with /';
                } else {
                    delete newErrors[key];
                }
                break;
            case 'method':
                if (!value) {
                    newErrors[key] = 'Method is required';
                } else {
                    delete newErrors[key];
                }
                break;
            case 'name':
                if (!value || value.trim() === '') {
                    newErrors[key] = 'Name is required';
                } else {
                    delete newErrors[key];
                }
                break;
            default:
                delete newErrors[key];
        }

        setErrors(newErrors);
    }, [errors]);

    // Enhanced input change handler with validation
    const handleInputChange = useCallback((key, value) => {
        handlePropertyChange(key, value);
        validateProperty(key, value);
    }, [handlePropertyChange, validateProperty]);

    // Enhanced form field component following SRP
    const FormField = useCallback(({ label, children, error, required = false, helpText }) => (
        <div className={`form-field ${error ? 'has-error' : ''}`}>
            <label className="form-label">
                {label}
                {required && <span className="required-indicator">*</span>}
                {helpText && (
                    <span className="help-icon" title={helpText}>
                        <FiInfo size={14} />
                    </span>
                )}
            </label>
            <div className="form-input-wrapper">
                {children}
            </div>
            {error && (
                <div className="error-message">
                    <FiX size={12} />
                    <span>{error}</span>
                </div>
            )}
        </div>
    ), []);

    // Enhanced input component with validation states
    const FormInput = useCallback(({ type = 'text', value, onChange, placeholder, error, ...props }) => (
        <input
            type={type}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`form-input ${error ? 'error' : ''}`}
            {...props}
        />
    ), []);

    // Enhanced select component
    const FormSelect = useCallback(({ value, onChange, options, error, ...props }) => (
        <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={`form-select ${error ? 'error' : ''}`}
            {...props}
        >
            {options.map(option => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    ), []);

    // Enhanced textarea component
    const FormTextarea = useCallback(({ value, onChange, placeholder, rows = 3, error, ...props }) => (
        <textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={rows}
            className={`form-textarea ${error ? 'error' : ''}`}
            {...props}
        />
    ), []);

    // Enhanced checkbox component
    const FormCheckbox = useCallback(({ checked, onChange, label, ...props }) => (
        <label className="form-checkbox-wrapper">
            <input
                type="checkbox"
                checked={checked || false}
                onChange={(e) => onChange(e.target.checked)}
                className="form-checkbox"
                {...props}
            />
            <span className="checkbox-custom">
                {checked && <FiCheck size={12} />}
            </span>
            <span className="checkbox-label">{label}</span>
        </label>
    ), []);

    const renderEndpointProperties = () => (
        <div className="properties-form">
            <div className="form-section">
                <h4 className="section-title">
                    <FiSettings size={16} />
                    Endpoint Configuration
                </h4>

                <FormField
                    label="Name"
                    required
                    error={errors.name}
                    helpText="Display name for this endpoint"
                >
                    <FormInput
                        value={properties.name}
                        onChange={(value) => handleInputChange('name', value)}
                        placeholder="My Endpoint"
                        error={errors.name}
                    />
                </FormField>

                <FormField
                    label="Description"
                    helpText="Brief description of what this endpoint does"
                >
                    <FormTextarea
                        value={properties.description}
                        onChange={(value) => handleInputChange('description', value)}
                        placeholder="Describe the endpoint functionality..."
                        rows={3}
                    />
                </FormField>
            </div>

            <div className="form-section">
                <h4 className="section-title">HTTP Configuration</h4>

                <div className="form-row">
                    <FormField
                        label="HTTP Method"
                        required
                        error={errors.method}
                    >
                        <FormSelect
                            value={properties.method}
                            onChange={(value) => handleInputChange('method', value)}
                            options={[
                                { value: 'GET', label: 'GET' },
                                { value: 'POST', label: 'POST' },
                                { value: 'PUT', label: 'PUT' },
                                { value: 'DELETE', label: 'DELETE' },
                                { value: 'PATCH', label: 'PATCH' },
                                { value: 'HEAD', label: 'HEAD' },
                                { value: 'OPTIONS', label: 'OPTIONS' }
                            ]}
                            error={errors.method}
                        />
                    </FormField>
                </div>

                <FormField
                    label="Path"
                    required
                    error={errors.path}
                    helpText="API endpoint path (e.g., /api/users/{id})"
                >
                    <FormInput
                        value={properties.path}
                        onChange={(value) => handleInputChange('path', value)}
                        placeholder="/api/endpoint"
                        error={errors.path}
                    />
                </FormField>
            </div>

            <div className="form-section">
                <h4 className="section-title">Options</h4>

                <FormCheckbox
                    checked={properties.deprecated}
                    onChange={(value) => handleInputChange('deprecated', value)}
                    label="Deprecated"
                />
            </div>
        </div>
    );

    const renderSchemaProperties = () => (
        <div className="properties-form">
            <div className="form-section">
                <h4 className="section-title">
                    <FiSettings size={16} />
                    Schema Configuration
                </h4>

                <FormField
                    label="Name"
                    required
                    error={errors.name}
                    helpText="Name of the schema object"
                >
                    <FormInput
                        value={properties.name || ''}
                        onChange={(value) => handleInputChange('name', value)}
                        placeholder="Schema name"
                        error={errors.name}
                    />
                </FormField>

                <FormField
                    label="Type"
                    helpText="Data type for this schema"
                >
                    <FormSelect
                        value={properties.type || 'object'}
                        onChange={(value) => handleInputChange('type', value)}
                        options={[
                            { value: 'object', label: 'Object' },
                            { value: 'array', label: 'Array' },
                            { value: 'string', label: 'String' },
                            { value: 'number', label: 'Number' },
                            { value: 'integer', label: 'Integer' },
                            { value: 'boolean', label: 'Boolean' }
                        ]}
                    />
                </FormField>

                <FormField
                    label="Description"
                    helpText="Describe the purpose of this schema"
                >
                    <FormTextarea
                        value={properties.description || ''}
                        onChange={(value) => handleInputChange('description', value)}
                        placeholder="Define data structure"
                        rows={3}
                    />
                </FormField>

                {properties.type === 'object' && (
                    <FormField
                        label="Required Fields"
                        helpText="Comma-separated list of required fields"
                    >
                        <FormInput
                            value={properties.required ? properties.required.join(', ') : ''}
                            onChange={(value) => handleInputChange('required', value.split(',').map(field => field.trim()))}
                            placeholder="field1, field2, field3"
                        />
                    </FormField>
                )}
            </div>
        </div>
    );

    const renderParameterProperties = () => (
        <div className="properties-form">
            <div className="form-section">
                <h4 className="section-title">
                    <FiSettings size={16} />
                    Parameter Configuration
                </h4>

                <FormField
                    label="Name"
                    required
                    error={errors.name}
                    helpText="Parameter name"
                >
                    <FormInput
                        value={properties.name || ''}
                        onChange={(value) => handleInputChange('name', value)}
                        placeholder="Parameter name"
                        error={errors.name}
                    />
                </FormField>

                <FormField
                    label="In"
                    helpText="Location of the parameter"
                >
                    <FormSelect
                        value={properties.in || 'query'}
                        onChange={(value) => handleInputChange('in', value)}
                        options={[
                            { value: 'query', label: 'Query' },
                            { value: 'path', label: 'Path' },
                            { value: 'header', label: 'Header' },
                            { value: 'cookie', label: 'Cookie' }
                        ]}
                    />
                </FormField>

                <FormField
                    label="Type"
                    helpText="Data type for this parameter"
                >
                    <FormSelect
                        value={properties.type || 'string'}
                        onChange={(value) => handleInputChange('type', value)}
                        options={[
                            { value: 'string', label: 'String' },
                            { value: 'number', label: 'Number' },
                            { value: 'integer', label: 'Integer' },
                            { value: 'boolean', label: 'Boolean' },
                            { value: 'array', label: 'Array' }
                        ]}
                    />
                </FormField>

                <FormField
                    label="Required"
                    helpText="Is this parameter required"
                >
                    <FormCheckbox
                        checked={properties.required || false}
                        onChange={(value) => handleInputChange('required', value)}
                        label="Required parameter"
                    />
                </FormField>

                <FormField
                    label="Description"
                    helpText="Describe the parameter's purpose"
                >
                    <FormTextarea
                        value={properties.description || ''}
                        onChange={(value) => handleInputChange('description', value)}
                        placeholder="Parameter description"
                        rows={2}
                    />
                </FormField>
            </div>
        </div>
    );

    const renderPropertiesByType = () => {
        if (!selectedNode) return null;

        switch (selectedNode.type) {
            case 'endpoint':
                return renderEndpointProperties();
            case 'schema':
                return renderSchemaProperties();
            case 'parameter':
                return renderParameterProperties();
            default:
                return (
                    <div className="properties-form">
                        <div className="form-section">
                            <h4 className="section-title">
                                <FiSettings size={16} />
                                Generic Properties
                            </h4>
                            <FormField
                                label="Name"
                                required
                                error={errors.name}
                                helpText="Name of this element"
                            >
                                <FormInput
                                    value={properties.name || ''}
                                    onChange={(value) => handleInputChange('name', value)}
                                    placeholder="Component name"
                                    error={errors.name}
                                />
                            </FormField>
                            <FormField
                                label="Description"
                                helpText="Describe the purpose of this element"
                            >
                                <FormTextarea
                                    value={properties.description || ''}
                                    onChange={(value) => handleInputChange('description', value)}
                                    placeholder="Component description"
                                    rows={3}
                                />
                            </FormField>
                        </div>
                    </div>
                );
        }
    };

    // Remove the separate no-selection return since it's now handled in the main return

    return (
        <div className="properties-panel">
            <div className="properties-header">
                <h3 className="panel-title">
                    <div className="panel-icon-container">
                        <FiSettings className="icon" />
                    </div>
                    Properties
                </h3>
                {selectedNode && (
                    <div className="selected-node-badge">
                        <span className={`node-type-badge ${selectedNode.type}`}>
                            {selectedNode.type?.toUpperCase()}
                        </span>
                    </div>
                )}
            </div>

            <div className="properties-content">
                {selectedNode ? (
                    <>
                        {renderPropertiesByType()}

                        <div className="properties-actions">
                            {onDeleteNode && (
                                <button
                                    className="delete-button"
                                    onClick={() => {
                                        if (window.confirm("Are you sure you want to delete this component? This action cannot be undone.")) {
                                            onDeleteNode(selectedNode.id);
                                        }
                                    }}
                                    title="Delete this component"
                                >
                                    <FiTrash2 size={18} />
                                    Delete
                                </button>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="no-selection">
                        <div className="no-selection-icon-container">
                            <FiInfo size={40} className="no-selection-icon" />
                        </div>
                        <h4 className="no-selection-title">No Component Selected</h4>
                        <p className="no-selection-desc">
                            Select a component from the canvas to view and edit its properties.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PropertiesPanel;
