// client/src/components/shared/ConditionBuilder.js
import React, { useState } from 'react';
import { FiPlus, FiTrash2, FiChevronDown } from 'react-icons/fi';
import './ConditionBuilder.css';

/**
 * Reusable condition builder component for creating conditional logic
 * Used in Mock Scenarios, Request Filters, and other conditional features
 */
const ConditionBuilder = ({
    conditions = [],
    onChange,
    fields = [],
    operators = [],
    allowGroups = true,
    disabled = false
}) => {
    const defaultFields = [
        { value: 'header', label: 'Header', type: 'key-value' },
        { value: 'query', label: 'Query Parameter', type: 'key-value' },
        { value: 'body', label: 'Request Body', type: 'path-value' },
        { value: 'method', label: 'HTTP Method', type: 'value' },
        { value: 'path', label: 'Request Path', type: 'value' },
        { value: 'probability', label: 'Probability (%)', type: 'number' },
        { value: 'counter', label: 'Request Counter', type: 'range' }
    ];

    const defaultOperators = [
        { value: 'equals', label: 'equals' },
        { value: 'not_equals', label: 'not equals' },
        { value: 'contains', label: 'contains' },
        { value: 'not_contains', label: 'does not contain' },
        { value: 'starts_with', label: 'starts with' },
        { value: 'ends_with', label: 'ends with' },
        { value: 'matches', label: 'matches regex' },
        { value: 'exists', label: 'exists' },
        { value: 'not_exists', label: 'does not exist' },
        { value: 'greater_than', label: 'greater than' },
        { value: 'less_than', label: 'less than' }
    ];

    const activeFields = fields.length > 0 ? fields : defaultFields;
    const activeOperators = operators.length > 0 ? operators : defaultOperators;

    const addCondition = () => {
        const newCondition = {
            id: Date.now(),
            field: activeFields[0]?.value || 'header',
            key: '',
            operator: 'equals',
            value: '',
            logic: 'AND'
        };
        onChange([...conditions, newCondition]);
    };

    const addGroup = () => {
        const newGroup = {
            id: Date.now(),
            type: 'group',
            logic: 'AND',
            conditions: [
                {
                    id: Date.now() + 1,
                    field: activeFields[0]?.value || 'header',
                    key: '',
                    operator: 'equals',
                    value: '',
                    logic: 'AND'
                }
            ]
        };
        onChange([...conditions, newGroup]);
    };

    const updateCondition = (id, updates) => {
        const updateItem = (items) => {
            return items.map(item => {
                if (item.id === id) {
                    return { ...item, ...updates };
                }
                if (item.type === 'group') {
                    return { ...item, conditions: updateItem(item.conditions) };
                }
                return item;
            });
        };
        onChange(updateItem(conditions));
    };

    const removeCondition = (id) => {
        const removeItem = (items) => {
            return items.filter(item => {
                if (item.id === id) return false;
                if (item.type === 'group') {
                    item.conditions = removeItem(item.conditions);
                    return item.conditions.length > 0;
                }
                return true;
            });
        };
        onChange(removeItem(conditions));
    };

    const getFieldConfig = (fieldValue) => {
        return activeFields.find(f => f.value === fieldValue) || {};
    };

    const renderConditionRow = (condition, index, isNested = false) => {
        const fieldConfig = getFieldConfig(condition.field);
        const showKey = fieldConfig.type === 'key-value' || fieldConfig.type === 'path-value';
        const showValue = !['exists', 'not_exists'].includes(condition.operator);
        const isNumber = fieldConfig.type === 'number' || fieldConfig.type === 'range';

        return (
            <div key={condition.id} className={`condition-row ${isNested ? 'nested' : ''}`}>
                {index > 0 && (
                    <select
                        className="logic-select"
                        value={condition.logic}
                        onChange={(e) => updateCondition(condition.id, { logic: e.target.value })}
                        disabled={disabled}
                    >
                        <option value="AND">AND</option>
                        <option value="OR">OR</option>
                    </select>
                )}

                <select
                    className="field-select"
                    value={condition.field}
                    onChange={(e) => updateCondition(condition.id, { field: e.target.value, key: '', value: '' })}
                    disabled={disabled}
                >
                    {activeFields.map(field => (
                        <option key={field.value} value={field.value}>{field.label}</option>
                    ))}
                </select>

                {showKey && (
                    <input
                        type="text"
                        className="key-input"
                        placeholder={fieldConfig.type === 'path-value' ? 'JSON path (e.g., user.id)' : 'Key'}
                        value={condition.key || ''}
                        onChange={(e) => updateCondition(condition.id, { key: e.target.value })}
                        disabled={disabled}
                    />
                )}

                <select
                    className="operator-select"
                    value={condition.operator}
                    onChange={(e) => updateCondition(condition.id, { operator: e.target.value })}
                    disabled={disabled}
                >
                    {activeOperators.map(op => (
                        <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                </select>

                {showValue && (
                    <input
                        type={isNumber ? 'number' : 'text'}
                        className="value-input"
                        placeholder="Value"
                        value={condition.value || ''}
                        onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                        disabled={disabled}
                        min={isNumber ? 0 : undefined}
                        max={fieldConfig.type === 'number' ? 100 : undefined}
                    />
                )}

                <button
                    type="button"
                    className="remove-btn"
                    onClick={() => removeCondition(condition.id)}
                    disabled={disabled}
                    title="Remove condition"
                >
                    <FiTrash2 size={14} />
                </button>
            </div>
        );
    };

    const renderGroup = (group, index) => {
        return (
            <div key={group.id} className="condition-group">
                {index > 0 && (
                    <select
                        className="group-logic-select"
                        value={group.logic}
                        onChange={(e) => updateCondition(group.id, { logic: e.target.value })}
                        disabled={disabled}
                    >
                        <option value="AND">AND</option>
                        <option value="OR">OR</option>
                    </select>
                )}
                <div className="group-header">
                    <span className="group-label">Group</span>
                    <button
                        type="button"
                        className="remove-btn"
                        onClick={() => removeCondition(group.id)}
                        disabled={disabled}
                    >
                        <FiTrash2 size={14} />
                    </button>
                </div>
                <div className="group-conditions">
                    {group.conditions.map((cond, idx) => renderConditionRow(cond, idx, true))}
                    <button
                        type="button"
                        className="add-nested-btn"
                        onClick={() => {
                            const newCondition = {
                                id: Date.now(),
                                field: activeFields[0]?.value || 'header',
                                key: '',
                                operator: 'equals',
                                value: '',
                                logic: 'AND'
                            };
                            updateCondition(group.id, {
                                conditions: [...group.conditions, newCondition]
                            });
                        }}
                        disabled={disabled}
                    >
                        <FiPlus size={12} /> Add to group
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className={`condition-builder ${disabled ? 'disabled' : ''}`}>
            <div className="conditions-list">
                {conditions.length === 0 ? (
                    <div className="empty-conditions">
                        <p>No conditions defined</p>
                        <span>Add conditions to filter when this should trigger</span>
                    </div>
                ) : (
                    conditions.map((item, index) => 
                        item.type === 'group' 
                            ? renderGroup(item, index)
                            : renderConditionRow(item, index)
                    )
                )}
            </div>

            <div className="condition-actions">
                <button
                    type="button"
                    className="add-condition-btn"
                    onClick={addCondition}
                    disabled={disabled}
                >
                    <FiPlus size={14} />
                    Add Condition
                </button>
                {allowGroups && (
                    <button
                        type="button"
                        className="add-group-btn"
                        onClick={addGroup}
                        disabled={disabled}
                    >
                        <FiPlus size={14} />
                        Add Group
                    </button>
                )}
            </div>
        </div>
    );
};

export default ConditionBuilder;
