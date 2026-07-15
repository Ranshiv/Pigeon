import React, { useState } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import './VariablePreviewTooltip.css';

const VariablePreviewTooltip = ({ variables = [], environmentName, visible, onClose }) => {
    const [showValues, setShowValues] = useState(false);

    if (!visible || !variables || variables.length === 0) {
        return null;
    }

    return (
        <div className="variable-preview-tooltip">
            <div className="tooltip-header">
                <h4>{environmentName} Variables</h4>
                <div className="tooltip-actions">
                    <button
                        className="toggle-values-btn"
                        onClick={() => setShowValues(!showValues)}
                        title={showValues ? 'Hide values' : 'Show values'}
                    >
                        {showValues ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                    </button>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>
            </div>

            <div className="tooltip-content">
                {variables.length === 0 ? (
                    <p className="no-variables">No variables defined</p>
                ) : (
                    <div className="variables-list">
                        {variables.map((variable, index) => (
                            <div key={index} className="variable-item">
                                <span className="variable-key">{variable.key}</span>
                                <span className="variable-separator">=</span>
                                <span className="variable-value">
                                    {showValues ? (variable.value || '""') : '•••••'}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {variables.length > 0 && (
                <div className="tooltip-footer">
                    <small>{variables.length} variable{variables.length !== 1 ? 's' : ''} defined</small>
                </div>
            )}
        </div>
    );
};

export default VariablePreviewTooltip;
