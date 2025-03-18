// client/src/components/RequestForm.js
import React, { useState, useEffect } from 'react';
import './RequestForm.css';

const RequestForm = ({ onSubmit, initialValues, onCancel }) => {
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [method, setMethod] = useState('GET');
    const [headers, setHeaders] = useState([{ name: '', value: '' }]);
    const [body, setBody] = useState('');
    const [bodyType, setBodyType] = useState('none');

    useEffect(() => {
        if (initialValues) {
            setName(initialValues.name || '');
            setUrl(initialValues.url || '');
            setMethod(initialValues.method || 'GET');
            setHeaders(initialValues.headers && initialValues.headers.length > 0 ? initialValues.headers : [{ name: '', value: '' }]);
            setBody(initialValues.body || '');
            setBodyType(initialValues.bodyType || 'none')
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
            bodyType
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
            <div className="form-group">
                <label htmlFor="name">Name:</label>
                <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                />
            </div>
            <div className="form-group">
                <label htmlFor="url">URL:</label>
                <input
                    type="text"
                    id="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    required
                />
            </div>
            <div className="form-group">
                <label htmlFor="method">Method:</label>
                <select id="method" value={method} onChange={(e) => setMethod(e.target.value)}>
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                    <option value="PATCH">PATCH</option>
                    <option value="OPTIONS">OPTIONS</option>
                    <option value="HEAD">HEAD</option>
                </select>
            </div>
            <div className="form-group">
                <label>Headers:</label>
                {headers.map((header, index) => (
                    <div key={index} className="header-row">
                        <input
                            type="text"
                            placeholder="Name"
                            value={header.name}
                            onChange={(e) => handleHeaderChange(index, 'name', e.target.value)}
                        />
                        <input
                            type="text"
                            placeholder="Value"
                            value={header.value}
                            onChange={(e) => handleHeaderChange(index, 'value', e.target.value)}
                        />
                        <button type="button" onClick={() => removeHeader(index)}>
                            Remove
                        </button>
                    </div>
                ))}
                <button type="button" onClick={addHeader}>
                    Add Header
                </button>
            </div>
            <div className="form-group">
                <label htmlFor="bodyType">Body Type:</label>
                <select
                    id="bodyType"
                    value={bodyType}
                    onChange={(e) => setBodyType(e.target.value)}
                >
                    <option value="none">None</option>
                    <option value="json">JSON</option>
                    <option value="x-www-form-urlencoded">x-www-form-urlencoded</option>
                    <option value="raw">Raw</option>
                </select>
            </div>
            {bodyType !== 'none' && (
                <div className="form-group">
                    <label htmlFor="body">Body:</label>
                    <textarea
                        id="body"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows="5"
                    />
                </div>
            )}
            <button type="submit">Save</button>
            <button type='button' onClick={onCancel}>Cancel</button>
        </form>
    );
};

export default RequestForm;