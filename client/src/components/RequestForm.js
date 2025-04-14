// client/src/components/RequestForm.js
import React, { useState, useEffect } from 'react';
import './RequestForm.css';
import TestScriptEditor from './TestScriptEditor';
// Import icons
import { FiTag, FiGlobe, FiFileText, FiCode, FiCheck, FiPlus, FiX } from 'react-icons/fi';

const RequestForm = ({ onSubmit, initialValues, onCancel }) => {
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [method, setMethod] = useState('GET');
    const [headers, setHeaders] = useState([{ name: '', value: '' }]);
    const [body, setBody] = useState('');
    const [bodyType, setBodyType] = useState('none');
    // New states for testing features
    const [preRequestScript, setPreRequestScript] = useState('');
    const [testScript, setTestScript] = useState('');
    const [showPreRequestScript, setShowPreRequestScript] = useState(false);
    const [showTestScript, setShowTestScript] = useState(false);

    useEffect(() => {
        if (initialValues) {
            setName(initialValues.name || '');
            setUrl(initialValues.url || '');
            setMethod(initialValues.method || 'GET');
            setHeaders(initialValues.headers && initialValues.headers.length > 0 ? initialValues.headers : [{ name: '', value: '' }]);
            setBody(initialValues.body || '');
            setBodyType(initialValues.bodyType || 'none');
            // Load test scripts if available
            setPreRequestScript(initialValues.preRequestScript || '');
            setTestScript(initialValues.testScript || '');
        }
    }, [initialValues])

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({
            _id: initialValues?._id,
            name,
            url,
            method,
            headers: headers.filter((header) => header.name !== ''), // Remove empty headers
            body,
            bodyType,
            // Include test scripts in the submission
            preRequestScript,
            testScript
        });
    };

    const handleHeaderChange = (index, field, value) => {
        const newHeaders = [...headers];
        newHeaders[index][field] = value;
        setHeaders(newHeaders);
    };

    const addHeader = () => {
        setHeaders([...headers, { name: '', value: '' }]);
    };

    const removeHeader = (index) => {
        const newHeaders = [...headers];
        newHeaders.splice(index, 1);
        setHeaders(newHeaders);
    };

    return (
        <form onSubmit={handleSubmit} className="request-form">
            <div className="form-header">
                {initialValues ? 'Edit Request' : 'Create New Request'}
            </div>

            <div className="form-group">
                <label htmlFor="name">
                    <FiTag className="label-icon" /> Request Name:
                </label>
                <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter a descriptive name"
                    required
                />
                <div className="helper-text">A clear name helps you find this request later</div>
            </div>

            <div className="form-group">
                <label htmlFor="url">
                    <FiGlobe className="label-icon" /> Request URL:
                </label>
                <div className="url-input-container">
                    <select
                        id="method"
                        value={method}
                        onChange={(e) => setMethod(e.target.value)}
                        className="method-select"
                    >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="DELETE">DELETE</option>
                        <option value="PATCH">PATCH</option>
                        <option value="OPTIONS">OPTIONS</option>
                        <option value="HEAD">HEAD</option>
                    </select>
                    <input
                        type="text"
                        id="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://api.example.com/endpoint"
                        className="url-input"
                        required
                    />
                </div>
            </div>

            {/* Pre-Request Script Section */}
            <div className="script-section">
                <div
                    className="script-toggle"
                    onClick={() => setShowPreRequestScript(!showPreRequestScript)}
                >
                    <span><FiCode className="label-icon" /> Pre-request Script</span>
                    <span className="toggle-icon">{showPreRequestScript ? '▲' : '▼'}</span>
                </div>
                <div className={`script-content ${showPreRequestScript ? 'open' : ''}`}>
                    {showPreRequestScript && (
                        <TestScriptEditor
                            script={preRequestScript}
                            onChange={setPreRequestScript}
                            scriptType="pre-request"
                        />
                    )}
                </div>
            </div>

            <div className="form-group">
                <label>
                    <FiFileText className="label-icon" /> Headers:
                </label>
                <div className="header-section">
                    {headers.map((header, index) => (
                        <div key={index} className="header-row">
                            <input
                                type="text"
                                placeholder="Header Name"
                                value={header.name}
                                onChange={(e) => handleHeaderChange(index, 'name', e.target.value)}
                            />
                            <input
                                type="text"
                                placeholder="Header Value"
                                value={header.value}
                                onChange={(e) => handleHeaderChange(index, 'value', e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => removeHeader(index)}
                                className="remove-btn"
                                aria-label="Remove header"
                            >
                                <FiX />
                            </button>
                        </div>
                    ))}
                    <div className="add-header-container">
                        <button
                            type="button"
                            onClick={addHeader}
                            className="add-header-btn"
                            aria-label="Add header"
                        >
                            <FiPlus />
                        </button>
                        <span className="header-label">Add Header</span>
                    </div>
                </div>
            </div>

            <div className="form-group">
                <label className="request-body-label">Request Body:</label>
                <div className="body-type-tabs">
                    <button
                        type="button"
                        className={`body-type-tab ${bodyType === 'none' ? 'active' : ''}`}
                        onClick={() => setBodyType('none')}
                    >
                        None
                    </button>
                    <button
                        type="button"
                        className={`body-type-tab ${bodyType === 'json' ? 'active' : ''}`}
                        onClick={() => setBodyType('json')}
                    >
                        JSON
                    </button>
                    <button
                        type="button"
                        className={`body-type-tab ${bodyType === 'x-www-form-urlencoded' ? 'active' : ''}`}
                        onClick={() => setBodyType('x-www-form-urlencoded')}
                    >
                        Form URL Encoded
                    </button>
                    <button
                        type="button"
                        className={`body-type-tab ${bodyType === 'raw' ? 'active' : ''}`}
                        onClick={() => setBodyType('raw')}
                    >
                        Raw
                    </button>
                </div>

                {bodyType !== 'none' && (
                    <textarea
                        id="body"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows="8"
                        placeholder={bodyType === 'json' ? '{\n  "key": "value"\n}' : bodyType === 'x-www-form-urlencoded' ? 'key1=value1&key2=value2' : ''}
                    />
                )}
            </div>

            {/* Test Script Section */}
            <div className="script-section">
                <div
                    className="script-toggle"
                    onClick={() => setShowTestScript(!showTestScript)}
                >
                    <span><FiCheck className="label-icon" /> Test Script</span>
                    <span className="toggle-icon">{showTestScript ? '▲' : '▼'}</span>
                </div>
                <div className={`script-content ${showTestScript ? 'open' : ''}`}>
                    {showTestScript && (
                        <TestScriptEditor
                            script={testScript}
                            onChange={setTestScript}
                            scriptType="test"
                        />
                    )}
                </div>
            </div>

            <div className="form-actions">
                <button type="button" onClick={onCancel} className="cancel-btn">
                    Cancel
                </button>
                <button type="submit" className="submit-btn">
                    {initialValues ? 'Save Changes' : 'Create Request'}
                </button>
            </div>
        </form>
    );
};

export default RequestForm;