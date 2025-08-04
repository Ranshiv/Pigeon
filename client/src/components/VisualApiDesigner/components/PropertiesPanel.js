import React, { useState, useEffect, useCallback } from 'react';
import { FiSettings, FiTrash2, FiCheck, FiX, FiInfo } from 'react-icons/fi';

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
                    {error}
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
        <div className="property-group">
            <h4>Schema Configuration</h4>

            <div className="property-field">
                <label>Name</label>
                <input
                    type="text"
                    value={properties.name || ''}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Schema name"
                    className={errors.name ? 'error' : ''}
                />
                {errors.name && <span className="error-message">{errors.name}</span>}
            </div>

            <div className="property-field">
                <label>Type</label>
                <select
                    value={properties.type || 'object'}
                    onChange={(e) => handleInputChange('type', e.target.value)}
                >
                    <option value="object">Object</option>
                    <option value="array">Array</option>
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="integer">Integer</option>
                    <option value="boolean">Boolean</option>
                </select>
            </div>

            <div className="property-field">
                <label>Description</label>
                <textarea
                    value={properties.description || ''}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Schema description"
                    rows={2}
                />
            </div>

            {properties.type === 'object' && (
                <div className="property-field">
                    <label>Required Fields</label>
                    <input
                        type="text"
                        value={properties.required ? properties.required.join(', ') : ''}
                        onChange={(e) => handleInputChange('required', e.target.value.split(',').map(field => field.trim()))}
                        placeholder="field1, field2, field3"
                    />
                </div>
            )}
        </div>
    );

    const renderParameterProperties = () => (
        <div className="property-group">
            <h4>Parameter Configuration</h4>

            <div className="property-field">
                <label>Name</label>
                <input
                    type="text"
                    value={properties.name || ''}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Parameter name"
                    className={errors.name ? 'error' : ''}
                />
                {errors.name && <span className="error-message">{errors.name}</span>}
            </div>

            <div className="property-field">
                <label>In</label>
                <select
                    value={properties.in || 'query'}
                    onChange={(e) => handleInputChange('in', e.target.value)}
                >
                    <option value="query">Query</option>
                    <option value="path">Path</option>
                    <option value="header">Header</option>
                    <option value="cookie">Cookie</option>
                </select>
            </div>

            <div className="property-field">
                <label>Type</label>
                <select
                    value={properties.type || 'string'}
                    onChange={(e) => handleInputChange('type', e.target.value)}
                >
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="integer">Integer</option>
                    <option value="boolean">Boolean</option>
                    <option value="array">Array</option>
                </select>
            </div>

            <div className="property-field">
                <label>Required</label>
                <input
                    type="checkbox"
                    checked={properties.required || false}
                    onChange={(e) => handleInputChange('required', e.target.checked)}
                />
            </div>

            <div className="property-field">
                <label>Description</label>
                <textarea
                    value={properties.description || ''}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Parameter description"
                    rows={2}
                />
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
                    <div className="property-group">
                        <h4>Generic Properties</h4>
                        <div className="property-field">
                            <label>Name</label>
                            <input
                                type="text"
                                value={properties.name || ''}
                                onChange={(e) => handleInputChange('name', e.target.value)}
                                placeholder="Component name"
                            />
                        </div>
                        <div className="property-field">
                            <label>Description</label>
                            <textarea
                                value={properties.description || ''}
                                onChange={(e) => handleInputChange('description', e.target.value)}
                                placeholder="Component description"
                                rows={2}
                            />
                        </div>
                    </div>
                );
        }
    };

    // Remove the separate no-selection return since it's now handled in the main return

    return (
        <div className="properties-panel">
            <div className="properties-header">
                <h3 className="panel-title">Properties</h3>
                {selectedNode && (
                    <div className="selected-node-badge">
                        <span className="node-type-badge">{selectedNode.type}</span>
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
                                    onClick={() => onDeleteNode(selectedNode.id)}
                                    title="Delete this component"
                                >
                                    <FiTrash2 size={16} />
                                    Delete
                                </button>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="no-selection">
                        <div className="no-selection-content">
                            <FiInfo size={48} className="no-selection-icon" />
                            <h4>Select a component to view its properties</h4>
                            <p>Click on any component in the canvas to configure its settings</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PropertiesPanel;
