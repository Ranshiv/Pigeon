/**
 * SoapTester.js - SOAP/WSDL Testing Component
 * Comprehensive UI for testing SOAP web services with WSDL parsing
 */

import React, { useState, useCallback } from 'react';
import './tester-shell.css';
import './SoapTester.css';

// Icon Components
const ConnectionIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 17l6-6-6-6" />
        <path d="M20 7l-6 6 6 6" />
    </svg>
);

const ZapIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
);

const SendIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
);

const InboxIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
);

const RefreshIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
);

const FileIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
);

const SearchIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
);

const PackageIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
);

const SettingsIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
);

const SaveIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
        <polyline points="17 21 17 13 7 13 7 21" />
        <polyline points="7 3 7 8 15 8" />
    </svg>
);

const EditIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);

const GlobeIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
);

const MailIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
    </svg>
);

const LoaderIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
        <line x1="12" y1="2" x2="12" y2="6" />
        <line x1="12" y1="18" x2="12" y2="22" />
        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
        <line x1="2" y1="12" x2="6" y2="12" />
        <line x1="18" y1="12" x2="22" y2="12" />
        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
        <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
    </svg>
);

const SoapTester = ({
    initialWsdlUrl = '',
    onOperationInvoke,
    onSave,
    savedOperations = []
}) => {
    // WSDL State
    const [wsdlUrl, setWsdlUrl] = useState(initialWsdlUrl);
    const [wsdlInfo, setWsdlInfo] = useState(null);
    const [isParsingWsdl, setIsParsingWsdl] = useState(false);

    // Operation State
    const [selectedService, setSelectedService] = useState('');
    const [selectedPort, setSelectedPort] = useState('');
    const [selectedOperation, setSelectedOperation] = useState(null);
    const [operationDetails, setOperationDetails] = useState(null);

    // Request State
    const [requestBody, setRequestBody] = useState('');
    const [soapHeaders, setSoapHeaders] = useState('');
    const [soapVersion, setSoapVersion] = useState('1.1');

    // Response State
    const [response, setResponse] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // UI State
    const [showHeaders, setShowHeaders] = useState(false);
    const [responseTab, setResponseTab] = useState('formatted');

    // Parse WSDL
    const parseWsdl = useCallback(async () => {
        if (!wsdlUrl.trim()) {
            setError('Please enter a WSDL URL');
            return;
        }

        setIsParsingWsdl(true);
        setError(null);
        setWsdlInfo(null);
        setSelectedOperation(null);

        try {
            const res = await fetch('/api/protocols/soap/parse-wsdl', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wsdlUrl })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to parse WSDL');
            }

            setWsdlInfo(data);

            // Auto-select first service if available
            if (data.services && data.services.length > 0) {
                setSelectedService(data.services[0].name);
                if (data.services[0].ports && data.services[0].ports.length > 0) {
                    setSelectedPort(data.services[0].ports[0].name);
                }
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsParsingWsdl(false);
        }
    }, [wsdlUrl]);

    // Get operations for selected service/port
    const getAvailableOperations = useCallback(() => {
        if (!wsdlInfo || !selectedService) return [];

        const service = wsdlInfo.services?.find(s => s.name === selectedService);
        if (!service) return [];

        const port = service.ports?.find(p => p.name === selectedPort);
        return port?.operations || [];
    }, [wsdlInfo, selectedService, selectedPort]);

    // Select operation
    const selectOperation = useCallback(async (operation) => {
        setSelectedOperation(operation);
        setResponse(null);

        // Generate sample request body
        const sampleBody = generateSampleRequest(operation);
        setRequestBody(sampleBody);

        // Get operation details if available
        if (operation.input) {
            setOperationDetails(operation);
        }
    }, []);

    // Generate sample SOAP request
    const generateSampleRequest = (operation) => {
        const namespace = operation.targetNamespace || 'http://example.com/';
        const inputParams = operation.input?.parts || [];

        let paramsXml = '';
        inputParams.forEach(part => {
            paramsXml += `      <${part.name}><!-- ${part.type || 'value'} --></${part.name}>\n`;
        });

        if (!paramsXml) {
            paramsXml = '      <!-- Add your parameters here -->\n';
        }

        return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope 
    xmlns:soap="${soapVersion === '1.2' ? 'http://www.w3.org/2003/05/soap-envelope' : 'http://schemas.xmlsoap.org/soap/envelope/'}"
    xmlns:ns="${namespace}">
  <soap:Header>
    <!-- Add SOAP headers if needed -->
  </soap:Header>
  <soap:Body>
    <ns:${operation.name}>
${paramsXml}    </ns:${operation.name}>
  </soap:Body>
</soap:Envelope>`;
    };

    // Invoke SOAP operation
    const invokeOperation = useCallback(async () => {
        if (!selectedOperation) {
            setError('Please select an operation');
            return;
        }

        setIsLoading(true);
        setError(null);
        setResponse(null);

        try {
            const service = wsdlInfo.services?.find(s => s.name === selectedService);
            const port = service?.ports?.find(p => p.name === selectedPort);
            const endpoint = port?.address || wsdlUrl.replace('?wsdl', '').replace('?WSDL', '');

            const requestPayload = {
                endpoint,
                operation: selectedOperation.name,
                soapAction: selectedOperation.soapAction,
                requestBody,
                soapVersion,
                headers: soapHeaders ? JSON.parse(soapHeaders) : {}
            };

            const res = await fetch('/api/protocols/soap/invoke', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestPayload)
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'SOAP request failed');
            }

            setResponse({
                status: res.status,
                headers: data.headers || {},
                body: data.response,
                parsedBody: data.parsed,
                timing: data.timing
            });

            if (onOperationInvoke) {
                onOperationInvoke({
                    operation: selectedOperation.name,
                    request: requestPayload,
                    response: data
                });
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [selectedOperation, wsdlInfo, selectedService, selectedPort, wsdlUrl, requestBody, soapVersion, soapHeaders, onOperationInvoke]);

    // Format XML for display
    const formatXml = (xml) => {
        if (!xml) return '';
        try {
            let formatted = '';
            let indent = 0;
            const tab = '  ';

            xml.split(/>\s*</).forEach((node, i) => {
                if (i > 0) {
                    if (node.match(/^\/\w/)) indent--;
                    formatted += '\n' + tab.repeat(indent);
                    formatted += '<';
                }
                formatted += node;
                if (i < xml.split(/>\s*</).length - 1) {
                    if (!node.match(/^\//) && !node.match(/\/$/)) indent++;
                }
            });

            return formatted;
        } catch {
            return xml;
        }
    };

    // Save operation
    const saveOperation = useCallback(() => {
        if (!selectedOperation) return;

        const operationData = {
            id: Date.now().toString(),
            wsdlUrl,
            service: selectedService,
            port: selectedPort,
            operation: selectedOperation.name,
            requestBody,
            soapVersion,
            soapHeaders,
            timestamp: new Date().toISOString()
        };

        if (onSave) {
            onSave(operationData);
        }
    }, [selectedOperation, wsdlUrl, selectedService, selectedPort, requestBody, soapVersion, soapHeaders, onSave]);

    return (
        <div className="soap-tester">
            {/* Error Display */}
            {error && (
                <div className="soap-error">
                    <span>⚠️ {error}</span>
                    <button onClick={() => setError(null)}>×</button>
                </div>
            )}

            {/* WSDL Input Panel */}
            <div className="soap-panel soap-wsdl-panel">
                <h3 className="soap-panel-title"><FileIcon size={16} /> WSDL Configuration</h3>

                <div className="soap-wsdl-input">
                    <span className="soap-protocol-badge">WSDL</span>
                    <input
                        type="text"
                        value={wsdlUrl}
                        onChange={(e) => setWsdlUrl(e.target.value)}
                        placeholder="https://example.com/service?wsdl"
                        className="soap-url-input"
                    />
                    <button
                        className="soap-btn soap-btn-parse"
                        onClick={parseWsdl}
                        disabled={isParsingWsdl || !wsdlUrl.trim()}
                    >
                        {isParsingWsdl ? <><LoaderIcon size={14} /> Parsing...</> : <><SearchIcon size={14} /> Parse WSDL</>}
                    </button>
                </div>

                {/* SOAP Version Selection */}
                <div className="soap-version-group">
                    <label>SOAP Version:</label>
                    <div className="soap-version-options">
                        <label className={`soap-version-option ${soapVersion === '1.1' ? 'active' : ''}`}>
                            <input
                                type="radio"
                                value="1.1"
                                checked={soapVersion === '1.1'}
                                onChange={(e) => setSoapVersion(e.target.value)}
                            />
                            SOAP 1.1
                        </label>
                        <label className={`soap-version-option ${soapVersion === '1.2' ? 'active' : ''}`}>
                            <input
                                type="radio"
                                value="1.2"
                                checked={soapVersion === '1.2'}
                                onChange={(e) => setSoapVersion(e.target.value)}
                            />
                            SOAP 1.2
                        </label>
                    </div>
                </div>

                {/* WSDL Info Display */}
                {wsdlInfo && (
                    <div className="soap-wsdl-info">
                        <div className="soap-info-badge">
                            ✅ WSDL parsed successfully
                        </div>
                        <div className="soap-info-details">
                            <span><PackageIcon size={14} /> {wsdlInfo.services?.length || 0} service(s)</span>
                            <span><ConnectionIcon size={14} /> {getAvailableOperations().length} operation(s)</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Main Content */}
            {wsdlInfo && (
                <div className="soap-main-content">
                    {/* Left Column - Service/Operation Selection */}
                    <div className="soap-left-column">
                        {/* Service Selection */}
                        <div className="soap-panel soap-service-panel">
                            <h3 className="soap-panel-title"><SettingsIcon size={16} /> Service & Port</h3>

                            <div className="soap-select-group">
                                <label>Service:</label>
                                <select
                                    value={selectedService}
                                    onChange={(e) => {
                                        setSelectedService(e.target.value);
                                        setSelectedOperation(null);
                                    }}
                                >
                                    {wsdlInfo.services?.map(service => (
                                        <option key={typeof service.name === 'string' ? service.name : 'service'} value={service.name}>
                                            {typeof service.name === 'string' ? service.name : 'Unnamed Service'}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="soap-select-group">
                                <label>Port:</label>
                                <select
                                    value={selectedPort}
                                    onChange={(e) => {
                                        setSelectedPort(e.target.value);
                                        setSelectedOperation(null);
                                    }}
                                >
                                    {wsdlInfo.services
                                        ?.find(s => s.name === selectedService)
                                        ?.ports?.map(port => (
                                            <option key={typeof port.name === 'string' ? port.name : 'port'} value={port.name}>
                                                {typeof port.name === 'string' ? port.name : 'Unnamed Port'}
                                            </option>
                                        ))}
                                </select>
                            </div>
                        </div>

                        {/* Operation List */}
                        <div className="soap-panel soap-operations-panel">
                            <h3 className="soap-panel-title"><ZapIcon size={16} /> Operations</h3>

                            <div className="soap-operations-list">
                                {getAvailableOperations().map(operation => (
                                    <div
                                        key={typeof operation.name === 'string' ? operation.name : JSON.stringify(operation.name)}
                                        className={`soap-operation ${selectedOperation?.name === operation.name ? 'selected' : ''}`}
                                        onClick={() => selectOperation(operation)}
                                    >
                                        <span className="soap-operation-name">
                                            {typeof operation.name === 'string' ? operation.name : 'Unnamed Operation'}
                                        </span>
                                        {operation.documentation && typeof operation.documentation === 'string' && (
                                            <span className="soap-operation-doc">{operation.documentation}</span>
                                        )}
                                    </div>
                                ))}

                                {getAvailableOperations().length === 0 && (
                                    <div className="soap-empty">
                                        No operations found
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Saved Operations */}
                        {savedOperations.length > 0 && (
                            <div className="soap-panel soap-saved-panel">
                                <h3 className="soap-panel-title"><SaveIcon size={16} /> Saved Operations</h3>
                                <div className="soap-saved-list">
                                    {savedOperations.map(saved => (
                                        <div key={saved.id} className="soap-saved-item">
                                            <span>{saved.operation}</span>
                                            <span className="soap-saved-time">
                                                {new Date(saved.timestamp).toLocaleDateString()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column - Request/Response */}
                    <div className="soap-right-column">
                        {/* Request Panel */}
                        <div className="soap-panel soap-request-panel">
                            <div className="soap-request-header">
                                <h3 className="soap-panel-title"><SendIcon size={16} /> Request</h3>
                                <div className="soap-request-actions">
                                    <button
                                        className={`soap-btn soap-btn-small ${showHeaders ? 'active' : ''}`}
                                        onClick={() => setShowHeaders(!showHeaders)}
                                    >
                                        Headers
                                    </button>
                                    <button
                                        className="soap-btn soap-btn-small"
                                        onClick={saveOperation}
                                        disabled={!selectedOperation}
                                    >
                                        <SaveIcon size={14} /> Save
                                    </button>
                                </div>
                            </div>

                            {selectedOperation ? (
                                <>
                                    <div className="soap-operation-info">
                                        <span className="soap-operation-badge">{selectedOperation.name}</span>
                                        {selectedOperation.soapAction && (
                                            <span className="soap-action-badge">
                                                SOAPAction: {selectedOperation.soapAction}
                                            </span>
                                        )}
                                    </div>

                                    {showHeaders && (
                                        <div className="soap-headers-input">
                                            <label>Custom Headers (JSON):</label>
                                            <textarea
                                                value={soapHeaders}
                                                onChange={(e) => setSoapHeaders(e.target.value)}
                                                placeholder='{"SOAPAction": "...", "Authorization": "..."}'
                                            />
                                        </div>
                                    )}

                                    <textarea
                                        className="soap-body-input"
                                        value={requestBody}
                                        onChange={(e) => setRequestBody(e.target.value)}
                                        placeholder="SOAP request body..."
                                        spellCheck={false}
                                    />

                                    <button
                                        className="soap-btn soap-btn-invoke"
                                        onClick={invokeOperation}
                                        disabled={isLoading}
                                    >
                                        {isLoading ? '⏳ Invoking...' : '▶️ Invoke Operation'}
                                    </button>
                                </>
                            ) : (
                                <div className="soap-empty">
                                    <span className="soap-empty-icon"><EditIcon size={32} /></span>
                                    <p>Select an operation from the list</p>
                                </div>
                            )}
                        </div>

                        {/* Response Panel */}
                        <div className="soap-panel soap-response-panel">
                            <div className="soap-response-header">
                                <h3 className="soap-panel-title"><InboxIcon size={16} /> Response</h3>
                                {response && (
                                    <div className="soap-response-tabs">
                                        <button
                                            className={`soap-tab ${responseTab === 'formatted' ? 'active' : ''}`}
                                            onClick={() => setResponseTab('formatted')}
                                        >
                                            Formatted
                                        </button>
                                        <button
                                            className={`soap-tab ${responseTab === 'raw' ? 'active' : ''}`}
                                            onClick={() => setResponseTab('raw')}
                                        >
                                            Raw
                                        </button>
                                        <button
                                            className={`soap-tab ${responseTab === 'parsed' ? 'active' : ''}`}
                                            onClick={() => setResponseTab('parsed')}
                                        >
                                            Parsed
                                        </button>
                                    </div>
                                )}
                            </div>

                            {response ? (
                                <div className="soap-response-content">
                                    <div className="soap-response-meta">
                                        <span className="soap-status-badge">Status: {response.status}</span>
                                        {response.timing && (
                                            <span className="soap-timing">⏱️ {response.timing}ms</span>
                                        )}
                                    </div>

                                    {responseTab === 'formatted' && (
                                        <pre className="soap-response-body">
                                            {formatXml(response.body)}
                                        </pre>
                                    )}

                                    {responseTab === 'raw' && (
                                        <pre className="soap-response-body">
                                            {response.body}
                                        </pre>
                                    )}

                                    {responseTab === 'parsed' && (
                                        <pre className="soap-response-body">
                                            {JSON.stringify(response.parsedBody, null, 2)}
                                        </pre>
                                    )}
                                </div>
                            ) : (
                                <div className="soap-empty">
                                    <span className="soap-empty-icon"><MailIcon size={32} /></span>
                                    <p>Response will appear here</p>
                                    <span className="soap-empty-hint">
                                        Invoke an operation to see the response
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Initial State */}
            {!wsdlInfo && !isParsingWsdl && (
                <div className="soap-initial-state">
                    <div className="soap-initial-icon"><GlobeIcon size={48} /></div>
                    <h2>SOAP Web Services Tester</h2>
                    <p>Enter a WSDL URL above to discover and test SOAP operations</p>

                    <div className="soap-features">
                        <div className="soap-feature">
                            <span className="soap-feature-icon"><FileIcon size={20} /></span>
                            <span>WSDL Parsing</span>
                        </div>
                        <div className="soap-feature">
                            <span className="soap-feature-icon"><ZapIcon size={20} /></span>
                            <span>Operation Discovery</span>
                        </div>
                        <div className="soap-feature">
                            <span className="soap-feature-icon"><EditIcon size={20} /></span>
                            <span>Request Building</span>
                        </div>
                        <div className="soap-feature">
                            <span className="soap-feature-icon"><RefreshIcon size={20} /></span>
                            <span>XML Formatting</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SoapTester;
