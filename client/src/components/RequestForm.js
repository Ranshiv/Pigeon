import React, { useState, useEffect } from 'react';
import './RequestForm.css';

// HTTP Methods
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

const RequestForm = ({ onSendRequest, initialRequest }) => {
    // Form state
    const [method, setMethod] = useState(initialRequest?.method || 'GET');
    const [url, setUrl] = useState(initialRequest?.url || '');
    const [requestName, setRequestName] = useState(initialRequest?.name || 'Get Users');
    const [activeTab, setActiveTab] = useState('params');

    // Tab content states
    const [params, setParams] = useState(initialRequest?.params || [
        { enabled: true, key: 'Key', value: 'Value', description: 'Description' }
    ]);
    const [headers, setHeaders] = useState(initialRequest?.headers || []);
    const [bodyType, setBodyType] = useState(initialRequest?.bodyType || 'none');
    const [bodyContent, setBodyContent] = useState(initialRequest?.body || '');
    const [preRequestScript, setPreRequestScript] = useState(initialRequest?.preRequestScript || '');
    const [tests, setTests] = useState(initialRequest?.tests || '');

    // Handlers for form inputs
    const handleMethodChange = (e) => setMethod(e.target.value);
    const handleUrlChange = (e) => setUrl(e.target.value);
    const handleNameChange = (e) => setRequestName(e.target.value);

    // Tab change handler
    const handleTabChange = (tab) => setActiveTab(tab);

    // Parameter handlers
    const handleParamChange = (index, field, value) => {
        const newParams = [...params];
        newParams[index][field] = value;
        setParams(newParams);
    };

    const handleAddParam = () => {
        setParams([...params, { enabled: true, key: '', value: '', description: '' }]);
    };

    const handleRemoveParam = (index) => {
        const newParams = [...params];
        newParams.splice(index, 1);
        setParams(newParams);
    };

    // Header handlers
    const handleHeaderChange = (index, field, value) => {
        const newHeaders = [...headers];
        newHeaders[index][field] = value;
        setHeaders(newHeaders);
    };

    const handleAddHeader = () => {
        setHeaders([...headers, { enabled: true, key: '', value: '', description: '' }]);
    };

    const handleRemoveHeader = (index) => {
        const newHeaders = [...headers];
        newHeaders.splice(index, 1);
        setHeaders(newHeaders);
    };

    // Form submission handler
    const handleSubmit = (e) => {
        e.preventDefault();

        // Build request object
        const request = {
            name: requestName,
            method,
            url,
            params: params.filter(p => p.enabled && p.key),
            headers: headers.filter(h => h.enabled && h.key),
            bodyType,
            body: bodyContent,
            preRequestScript,
            tests
        };

        // Send request
        onSendRequest(request);
    };

    // Update URL with query parameters
    useEffect(() => {
        const updateUrlWithParams = () => {
            try {
                const urlObj = new URL(url);

                // Clear existing params
                urlObj.search = '';

                // Add enabled params
                params.forEach(param => {
                    if (param.enabled && param.key) {
                        urlObj.searchParams.append(param.key, param.value || '');
                    }
                });

                // Update URL without triggering infinite loop
                const newUrl = urlObj.toString();
                if (newUrl !== url) {
                    setUrl(newUrl);
                }
            } catch (error) {
                // Invalid URL, ignore
            }
        };

        // Only update if URL is valid and we have params
        if (url?.includes('://') && params.some(p => p.enabled && p.key)) {
            updateUrlWithParams();
        }
    }, [params]);

    // Render tab content based on active tab
    const renderTabContent = () => {
        switch (activeTab) {
            case 'params':
                return (
                    <div className="params-section">
                        <table className="params-table">
                            <thead>
                                <tr>
                                    <th width="30"></th>
                                    <th width="30%">Key</th>
                                    <th width="30%">Value</th>
                                    <th width="30%">Description</th>
                                    <th width="40"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {params.map((param, index) => (
                                    <tr key={`param-${index}`}>
                                        <td>
                                            <input
                                                type="checkbox"
                                                checked={param.enabled}
                                                onChange={(e) => handleParamChange(index, 'enabled', e.target.checked)}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="text"
                                                value={param.key}
                                                onChange={(e) => handleParamChange(index, 'key', e.target.value)}
                                                placeholder="Key"
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="text"
                                                value={param.value}
                                                onChange={(e) => handleParamChange(index, 'value', e.target.value)}
                                                placeholder="Value"
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="text"
                                                value={param.description}
                                                onChange={(e) => handleParamChange(index, 'description', e.target.value)}
                                                placeholder="Description"
                                            />
                                        </td>
                                        <td>
                                            <button
                                                className="delete-row-btn"
                                                onClick={() => handleRemoveParam(index)}
                                                aria-label="Delete parameter"
                                            >
                                                ×
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <button className="add-row-btn" onClick={handleAddParam}>
                            + Add
                        </button>
                    </div>
                );

            case 'headers':
                return (
                    <div className="headers-section">
                        <table className="params-table">
                            <thead>
                                <tr>
                                    <th width="30"></th>
                                    <th width="30%">Key</th>
                                    <th width="30%">Value</th>
                                    <th width="30%">Description</th>
                                    <th width="40"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {headers.map((header, index) => (
                                    <tr key={`header-${index}`}>
                                        <td>
                                            <input
                                                type="checkbox"
                                                checked={header.enabled}
                                                onChange={(e) => handleHeaderChange(index, 'enabled', e.target.checked)}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="text"
                                                value={header.key}
                                                onChange={(e) => handleHeaderChange(index, 'key', e.target.value)}
                                                placeholder="Key"
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="text"
                                                value={header.value}
                                                onChange={(e) => handleHeaderChange(index, 'value', e.target.value)}
                                                placeholder="Value"
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="text"
                                                value={header.description}
                                                onChange={(e) => handleHeaderChange(index, 'description', e.target.value)}
                                                placeholder="Description"
                                            />
                                        </td>
                                        <td>
                                            <button
                                                className="delete-row-btn"
                                                onClick={() => handleRemoveHeader(index)}
                                                aria-label="Delete header"
                                            >
                                                ×
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <button className="add-row-btn" onClick={handleAddHeader}>
                            + Add
                        </button>
                    </div>
                );

            case 'body':
                return (
                    <div className="body-section">
                        <div className="body-type-tabs">
                            <div
                                className={`body-type-tab ${bodyType === 'none' ? 'active' : ''}`}
                                onClick={() => setBodyType('none')}
                            >
                                None
                            </div>
                            <div
                                className={`body-type-tab ${bodyType === 'form-data' ? 'active' : ''}`}
                                onClick={() => setBodyType('form-data')}
                            >
                                Form Data
                            </div>
                            <div
                                className={`body-type-tab ${bodyType === 'x-www-form-urlencoded' ? 'active' : ''}`}
                                onClick={() => setBodyType('x-www-form-urlencoded')}
                            >
                                x-www-form-urlencoded
                            </div>
                            <div
                                className={`body-type-tab ${bodyType === 'raw' ? 'active' : ''}`}
                                onClick={() => setBodyType('raw')}
                            >
                                Raw
                            </div>
                            <div
                                className={`body-type-tab ${bodyType === 'binary' ? 'active' : ''}`}
                                onClick={() => setBodyType('binary')}
                            >
                                Binary
                            </div>
                        </div>

                        {bodyType === 'raw' && (
                            <textarea
                                className="body-editor"
                                value={bodyContent}
                                onChange={(e) => setBodyContent(e.target.value)}
                                placeholder="Enter request body"
                                spellCheck="false"
                            />
                        )}

                        {bodyType === 'none' && (
                            <div className="empty-body">
                                This request does not have a body
                            </div>
                        )}

                        {(bodyType === 'form-data' || bodyType === 'x-www-form-urlencoded') && (
                            <div className="form-data-editor">
                                <table className="params-table">
                                    <thead>
                                        <tr>
                                            <th width="30"></th>
                                            <th width="30%">Key</th>
                                            <th width="30%">Value</th>
                                            <th width="30%">Description</th>
                                            <th width="40"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td>
                                                <input type="checkbox" checked={true} />
                                            </td>
                                            <td>
                                                <input type="text" placeholder="Key" />
                                            </td>
                                            <td>
                                                <input type="text" placeholder="Value" />
                                            </td>
                                            <td>
                                                <input type="text" placeholder="Description" />
                                            </td>
                                            <td>
                                                <button className="delete-row-btn">×</button>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                <button className="add-row-btn">
                                    + Add
                                </button>
                            </div>
                        )}

                        {bodyType === 'binary' && (
                            <div className="binary-upload">
                                <input type="file" />
                            </div>
                        )}
                    </div>
                );

            case 'pre-request-script':
                return (
                    <div className="script-section">
                        <textarea
                            className="script-editor"
                            value={preRequestScript}
                            onChange={(e) => setPreRequestScript(e.target.value)}
                            placeholder="// Write pre-request script here (JavaScript)"
                            spellCheck="false"
                        />
                    </div>
                );

            case 'tests':
                return (
                    <div className="script-section">
                        <textarea
                            className="script-editor"
                            value={tests}
                            onChange={(e) => setTests(e.target.value)}
                            placeholder="// Write test script here (JavaScript)"
                            spellCheck="false"
                        />
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="request-workspace">
            <form onSubmit={handleSubmit}>
                {/* Request name input */}
                <div className="request-name-area">
                    <input
                        type="text"
                        className="request-name-input"
                        value={requestName}
                        onChange={handleNameChange}
                        placeholder="Request name"
                    />
                </div>

                {/* URL bar */}
                <div className="request-url-bar">
                    <select
                        className="method-select"
                        data-method={method}
                        value={method}
                        onChange={handleMethodChange}
                    >
                        {HTTP_METHODS.map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>

                    <input
                        type="text"
                        className="url-input"
                        value={url}
                        onChange={handleUrlChange}
                        placeholder="Enter request URL"
                        required
                    />

                    <button type="submit" className="send-btn">
                        Send
                    </button>

                    <button type="button" className="save-btn">
                        Save
                    </button>
                </div>

                {/* Request tabs */}
                <div className="request-tabs">
                    <div
                        className={`request-tab ${activeTab === 'params' ? 'active' : ''}`}
                        onClick={() => handleTabChange('params')}
                    >
                        Params
                    </div>
                    <div
                        className={`request-tab ${activeTab === 'headers' ? 'active' : ''}`}
                        onClick={() => handleTabChange('headers')}
                    >
                        Headers
                    </div>
                    <div
                        className={`request-tab ${activeTab === 'body' ? 'active' : ''}`}
                        onClick={() => handleTabChange('body')}
                    >
                        Body
                    </div>
                    <div
                        className={`request-tab ${activeTab === 'pre-request-script' ? 'active' : ''}`}
                        onClick={() => handleTabChange('pre-request-script')}
                    >
                        Pre-request Script
                    </div>
                    <div
                        className={`request-tab ${activeTab === 'tests' ? 'active' : ''}`}
                        onClick={() => handleTabChange('tests')}
                    >
                        Tests
                    </div>
                </div>

                {/* Request section content */}
                <div className="request-sections">
                    {renderTabContent()}
                </div>
            </form>
        </div>
    );
};

export default RequestForm;