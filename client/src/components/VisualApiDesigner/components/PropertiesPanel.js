import React, { useState, useEffect } from 'react';

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

    const handlePropertyChange = (key, value) => {
        const newProperties = { ...properties, [key]: value };
        setProperties(newProperties);

        if (onNodeUpdate && selectedNode) {
            onNodeUpdate(selectedNode.id, newProperties);
        }
    };

    const validateProperty = (key, value) => {
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
    };

    const handleInputChange = (key, value) => {
        handlePropertyChange(key, value);
        validateProperty(key, value);
    };

    const renderEndpointProperties = () => (
        <div className="property-group">
            <h4>Endpoint Configuration</h4>

            <div className="property-field">
                <label>Path</label>
                <input
                    type="text"
                    value={properties.path || ''}
                    onChange={(e) => handleInputChange('path', e.target.value)}
                    placeholder="/api/resource"
                    className={errors.path ? 'error' : ''}
                />
                {errors.path && <span className="error-message">{errors.path}</span>}
            </div>

            <div className="property-field">
                <label>Method</label>
                <select
                    value={properties.method || 'GET'}
                    onChange={(e) => handleInputChange('method', e.target.value)}
                    className={errors.method ? 'error' : ''}
                >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                    <option value="PATCH">PATCH</option>
                    <option value="HEAD">HEAD</option>
                    <option value="OPTIONS">OPTIONS</option>
                </select>
                {errors.method && <span className="error-message">{errors.method}</span>}
            </div>

            <div className="property-field">
                <label>Summary</label>
                <input
                    type="text"
                    value={properties.summary || ''}
                    onChange={(e) => handleInputChange('summary', e.target.value)}
                    placeholder="Brief description"
                />
            </div>

            <div className="property-field">
                <label>Description</label>
                <textarea
                    value={properties.description || ''}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Detailed description"
                    rows={3}
                />
            </div>

            <div className="property-field">
                <label>Tags</label>
                <input
                    type="text"
                    value={properties.tags ? properties.tags.join(', ') : ''}
                    onChange={(e) => handleInputChange('tags', e.target.value.split(',').map(tag => tag.trim()))}
                    placeholder="tag1, tag2, tag3"
                />
            </div>

            <div className="property-field">
                <label>Deprecated</label>
                <input
                    type="checkbox"
                    checked={properties.deprecated || false}
                    onChange={(e) => handleInputChange('deprecated', e.target.checked)}
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

    if (!selectedNode) {
        return (
            <div className="properties-panel">
                <div className="properties-header">
                    <h3>Properties</h3>
                </div>
                <div className="no-selection">
                    <p>Select a component to view its properties</p>
                </div>
            </div>
        );
    }

    return (
        <div className="properties-panel">
            <div className="properties-header">
                <h3>Properties</h3>
                <div className="selected-node-info">
                    <span className="node-type">{selectedNode.type}</span>
                    {selectedNode.data?.name && (
                        <span className="node-name">{selectedNode.data.name}</span>
                    )}
                </div>
            </div>

            <div className="properties-content">
                {renderPropertiesByType()}

                <div className="property-actions">
                    {onDeleteNode && (
                        <button
                            className="delete-button"
                            onClick={() => onDeleteNode(selectedNode.id)}
                        >
                            Delete Component
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PropertiesPanel;
