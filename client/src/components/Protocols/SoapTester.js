/**
 * SoapTester.js - SOAP/WSDL Testing Component
 * MQTT-style observability layout for WSDL parsing and SOAP invocation.
 */

import React, { useState, useCallback } from 'react';
import AppSelect from '../common/AppSelect/AppSelect';
import './tester-shell.css';
import './SoapTester.css';

const Icon = ({ d, size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
);

const ICONS = {
    file: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M16 13H8', 'M16 17H8'],
    search: ['M11 19A8 8 0 1 1 11 3a8 8 0 0 1 0 16z', 'M21 21l-4.35-4.35'],
    settings: ['M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'],
    zap: ['M13 2L3 14h9l-1 8 10-12h-9l1-8z'],
    send: ['M22 2L11 13', 'M22 2l-7 20-4-9-9-4 20-7z'],
    inbox: ['M22 12h-6l-2 3H10l-2-3H2', 'M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z'],
    save: ['M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z', 'M17 21v-8H7v8', 'M7 3v5h8'],
    edit: ['M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7', 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'],
    globe: ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M2 12h20', 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'],
    package: ['M16.5 9.4L7.5 4.21', 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z', 'M3.27 6.96L12 12.01l8.73-5.05', 'M12 22.08V12'],
    alert: ['M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z', 'M12 9v4', 'M12 17h.01']
};

const SoapTester = ({ initialWsdlUrl = '', onOperationInvoke, onSave, savedOperations = [] }) => {
    const [wsdlUrl, setWsdlUrl] = useState(initialWsdlUrl);
    const [wsdlInfo, setWsdlInfo] = useState(null);
    const [isParsingWsdl, setIsParsingWsdl] = useState(false);
    const [selectedService, setSelectedService] = useState('');
    const [selectedPort, setSelectedPort] = useState('');
    const [selectedOperation, setSelectedOperation] = useState(null);
    const [requestBody, setRequestBody] = useState('');
    const [soapHeaders, setSoapHeaders] = useState('');
    const [soapVersion, setSoapVersion] = useState('1.1');
    const [response, setResponse] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showHeaders, setShowHeaders] = useState(false);
    const [responseTab, setResponseTab] = useState('formatted');

    const safeName = (name) => typeof name === 'string' ? name : JSON.stringify(name);
    const displayName = (name, fallback) => safeName(name) || fallback;

    const parseWsdl = useCallback(async () => {
        if (!wsdlUrl.trim()) { setError('Please enter a WSDL URL'); return; }
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
            if (!res.ok) throw new Error(data.error || 'Failed to parse WSDL');
            setWsdlInfo(data);
            if (data.services?.length) {
                const svc = data.services[0];
                setSelectedService(svc.name);
                setSelectedPort(svc.ports?.[0]?.name || '');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsParsingWsdl(false);
        }
    }, [wsdlUrl]);

    const getAvailableOperations = useCallback(() => {
        if (!wsdlInfo || !selectedService) return [];
        const service = wsdlInfo.services?.find(s => s.name === selectedService);
        if (!service) return [];
        const port = service.ports?.find(p => p.name === selectedPort);
        return port?.operations || [];
    }, [wsdlInfo, selectedService, selectedPort]);

    const generateSampleRequest = (operation) => {
        const namespace = operation.targetNamespace || 'http://example.com/';
        const parts = operation.input?.parts || [];
        let paramsXml = parts.map(part => `      <${part.name}><!-- ${part.type || 'value'} --></${part.name}>\n`).join('');
        if (!paramsXml) paramsXml = '      <!-- Add your parameters here -->\n';
        return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="${soapVersion === '1.2' ? 'http://www.w3.org/2003/05/soap-envelope' : 'http://schemas.xmlsoap.org/soap/envelope/'}" xmlns:ns="${namespace}">
  <soap:Header>
    <!-- Add SOAP headers if needed -->
  </soap:Header>
  <soap:Body>
    <ns:${operation.name}>
${paramsXml}    </ns:${operation.name}>
  </soap:Body>
</soap:Envelope>`;
    };

    const selectOperation = useCallback((operation) => {
        setSelectedOperation(operation);
        setResponse(null);
        setRequestBody(generateSampleRequest(operation));
    }, [soapVersion]);

    const invokeOperation = useCallback(async () => {
        if (!selectedOperation) { setError('Please select an operation'); return; }
        setIsLoading(true);
        setError(null);
        setResponse(null);
        try {
            const service = wsdlInfo.services?.find(s => s.name === selectedService);
            const port = service?.ports?.find(p => p.name === selectedPort);
            const endpoint = port?.address || wsdlUrl.replace(/\?wsdl/i, '');
            const payload = {
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
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'SOAP request failed');
            setResponse({ status: res.status, headers: data.headers || {}, body: data.response, parsedBody: data.parsed, timing: data.timing });
            onOperationInvoke?.({ operation: selectedOperation.name, request: payload, response: data });
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [selectedOperation, wsdlInfo, selectedService, selectedPort, wsdlUrl, requestBody, soapVersion, soapHeaders, onOperationInvoke]);

    const formatXml = (xml) => {
        if (!xml) return '';
        try {
            let formatted = '';
            let indent = 0;
            const tab = '  ';
            xml.split(/>\s*</).forEach((node, i) => {
                if (i > 0) {
                    if (node.match(/^\/\w/)) indent--;
                    formatted += '\n' + tab.repeat(indent) + '<';
                }
                formatted += node;
                if (i < xml.split(/>\s*</).length - 1 && !node.match(/^\//) && !node.match(/\/$/)) indent++;
            });
            return formatted;
        } catch { return xml; }
    };

    const saveOperation = useCallback(() => {
        if (!selectedOperation) return;
        onSave?.({
            id: Date.now().toString(),
            wsdlUrl,
            service: selectedService,
            port: selectedPort,
            operation: selectedOperation.name,
            requestBody,
            soapVersion,
            soapHeaders,
            timestamp: new Date().toISOString()
        });
    }, [selectedOperation, wsdlUrl, selectedService, selectedPort, requestBody, soapVersion, soapHeaders, onSave]);

    const service = wsdlInfo?.services?.find(s => s.name === selectedService);
    const ports = service?.ports || [];
    const operations = getAvailableOperations();

    return (
        <div className="soap-tester">
            {error && (
                <div className="soap-error" role="alert">
                    <span className="soap-error-text"><Icon d={ICONS.alert} size={14} /> {error}</span>
                    <button onClick={() => setError(null)} aria-label="Dismiss error">×</button>
                </div>
            )}

            <div className="soap-panel soap-wsdl-panel">
                <h3 className="soap-panel-title"><Icon d={ICONS.file} size={16} /> WSDL Configuration</h3>

                <div className="soap-wsdl-group">
                    <div className="soap-protocol-badge">WSDL</div>
                    <input
                        type="text"
                        className="soap-url-input"
                        placeholder="https://example.com/service?wsdl"
                        value={wsdlUrl}
                        onChange={(e) => setWsdlUrl(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !isParsingWsdl && wsdlUrl.trim() && parseWsdl()}
                        aria-label="WSDL URL"
                    />
                    <button className="soap-btn soap-btn-parse" onClick={parseWsdl} disabled={isParsingWsdl || !wsdlUrl.trim()}>
                        {isParsingWsdl ? <>Parsing…</> : <><Icon d={ICONS.search} size={14} /> Parse WSDL</>}
                    </button>
                </div>

                <div className="soap-version-group">
                    <label>SOAP Version</label>
                    <div className="soap-version-options" role="radiogroup" aria-label="SOAP version">
                        {['1.1', '1.2'].map(v => (
                            <label key={v} className={`soap-version-option ${soapVersion === v ? 'active' : ''}`}>
                                <input type="radio" value={v} checked={soapVersion === v} onChange={(e) => setSoapVersion(e.target.value)} />
                                SOAP {v}
                            </label>
                        ))}
                    </div>
                </div>

                {wsdlInfo && (
                    <div className="soap-wsdl-info">
                        <span className="soap-info-badge">WSDL parsed</span>
                        <div className="soap-info-details">
                            <span style={{ display: 'inline-flex', alignItems: 'center' }}><Icon d={ICONS.package} size={14} /> {wsdlInfo.services?.length || 0} service(s)</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center' }}><Icon d={ICONS.zap} size={14} /> {operations.length} operation(s)</span>
                        </div>
                    </div>
                )}

                <div className="soap-kpi-strip">
                    <div className="ts-kpi">
                        <div className="ts-kpi-label">Services</div>
                        <div className="ts-kpi-value">{wsdlInfo?.services?.length || 0}</div>
                    </div>
                    <div className="ts-kpi">
                        <div className="ts-kpi-label">Operations</div>
                        <div className="ts-kpi-value">{operations.length}</div>
                    </div>
                    <div className="ts-kpi">
                        <div className="ts-kpi-label">Version</div>
                        <div className="ts-kpi-value" style={{ fontSize: '1rem' }}>{soapVersion}</div>
                    </div>
                    <div className="ts-kpi">
                        <div className="ts-kpi-label">Saved</div>
                        <div className="ts-kpi-value">{savedOperations.length}</div>
                    </div>
                </div>
            </div>

            {wsdlInfo ? (
                <div className="soap-main-content">
                    <div className="soap-left-column">
                        <div className="soap-panel soap-service-panel">
                            <h3 className="soap-panel-title"><Icon d={ICONS.settings} size={16} /> Service & Port</h3>
                            <div className="soap-select-group">
                                <label>Service</label>
                                <AppSelect
                                    value={selectedService}
                                    onChange={(value) => { setSelectedService(value); setSelectedOperation(null); }}
                                    options={wsdlInfo.services?.map(s => ({ value: safeName(s.name), label: displayName(s.name, 'Unnamed Service') })) || []}
                                />
                            </div>
                            <div className="soap-select-group">
                                <label>Port</label>
                                <AppSelect
                                    value={selectedPort}
                                    onChange={(value) => { setSelectedPort(value); setSelectedOperation(null); }}
                                    options={ports.map(p => ({ value: safeName(p.name), label: displayName(p.name, 'Unnamed Port') }))}
                                />
                            </div>
                        </div>

                        <div className="soap-panel soap-operations-panel">
                            <h3 className="soap-panel-title"><Icon d={ICONS.zap} size={16} /> Operations</h3>
                            <div className="soap-operations-list">
                                {operations.length === 0 ? (
                                    <div className="soap-empty soap-empty-compact">No operations found</div>
                                ) : operations.map(op => (
                                    <div
                                        key={safeName(op.name)}
                                        className={`soap-operation ${selectedOperation?.name === op.name ? 'selected' : ''}`}
                                        onClick={() => selectOperation(op)}
                                    >
                                        <span className="soap-operation-name">{displayName(op.name, 'Unnamed Operation')}</span>
                                        {op.documentation && typeof op.documentation === 'string' && (
                                            <span className="soap-operation-doc">{op.documentation}</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {savedOperations.length > 0 && (
                            <div className="soap-panel soap-saved-panel">
                                <h3 className="soap-panel-title"><Icon d={ICONS.save} size={16} /> Saved Operations</h3>
                                <div className="soap-saved-list">
                                    {savedOperations.map(saved => (
                                        <div key={saved.id} className="soap-saved-item">
                                            <span className="soap-saved-name">{saved.operation}</span>
                                            <span className="soap-saved-time">{new Date(saved.timestamp).toLocaleDateString()}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="soap-right-column">
                        <div className="soap-panel soap-request-panel">
                            <div className="soap-request-header">
                                <h3 className="soap-panel-title"><Icon d={ICONS.send} size={16} /> Request</h3>
                                <div className="soap-request-actions">
                                    <button className={`soap-btn-small ${showHeaders ? 'active' : ''}`} onClick={() => setShowHeaders(!showHeaders)}>Headers</button>
                                    <button className="soap-btn-small" onClick={saveOperation} disabled={!selectedOperation}><Icon d={ICONS.save} size={12} /> Save</button>
                                </div>
                            </div>

                            {selectedOperation ? (
                                <>
                                    <div className="soap-operation-info">
                                        <span className="soap-operation-badge">{selectedOperation.name}</span>
                                        {selectedOperation.soapAction && <span className="soap-action-badge">SOAPAction: {selectedOperation.soapAction}</span>}
                                    </div>
                                    {showHeaders && (
                                        <div className="soap-headers-input">
                                            <label>Custom Headers (JSON)</label>
                                            <textarea value={soapHeaders} onChange={(e) => setSoapHeaders(e.target.value)} placeholder='{"SOAPAction": "...", "Authorization": "..."}' />
                                        </div>
                                    )}
                                    <textarea className="soap-body-input" value={requestBody} onChange={(e) => setRequestBody(e.target.value)} placeholder="SOAP request body…" spellCheck={false} />
                                    <button className="soap-btn soap-btn-invoke" onClick={invokeOperation} disabled={isLoading}>
                                        {isLoading ? 'Invoking…' : <><Icon d={ICONS.zap} size={13} /> Invoke Operation</>}
                                    </button>
                                </>
                            ) : (
                                <div className="soap-empty">
                                    <span className="soap-empty-icon"><Icon d={ICONS.edit} size={32} /></span>
                                    <p className="soap-empty-title">Select an operation</p>
                                    <p className="soap-empty-hint">Choose a SOAP operation from the list to build a request</p>
                                </div>
                            )}
                        </div>

                        <div className="soap-panel soap-response-panel">
                            <div className="soap-response-header">
                                <h3 className="soap-panel-title"><Icon d={ICONS.inbox} size={16} /> Response</h3>
                                {response && (
                                    <div className="soap-response-tabs" role="tablist" aria-label="Response view">
                                        {['formatted', 'raw', 'parsed'].map(tab => (
                                            <button key={tab} role="tab" aria-selected={responseTab === tab} className={`soap-tab ${responseTab === tab ? 'active' : ''}`} onClick={() => setResponseTab(tab)}>
                                                {tab[0].toUpperCase() + tab.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {response ? (
                                <div className="soap-response-content">
                                    <div className="soap-response-meta">
                                        <span className="soap-status-badge">Status: {response.status}</span>
                                        {response.timing && <span className="soap-timing">{response.timing}ms</span>}
                                    </div>
                                    <pre className="soap-response-body">
                                        {responseTab === 'formatted' ? formatXml(response.body)
                                            : responseTab === 'parsed' ? JSON.stringify(response.parsedBody, null, 2)
                                                : response.body}
                                    </pre>
                                </div>
                            ) : (
                                <div className="soap-empty">
                                    <span className="soap-empty-icon"><Icon d={ICONS.inbox} size={32} /></span>
                                    <p className="soap-empty-title">Response will appear here</p>
                                    <p className="soap-empty-hint">Invoke an operation to see the response</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="soap-panel soap-info-panel">
                    <h3 className="soap-panel-title"><Icon d={ICONS.globe} size={16} /> SOAP Web Services Tester</h3>
                    <p className="soap-empty-hint" style={{ marginBottom: '14px' }}>Enter a WSDL URL above to discover services, ports, and operations, then build and invoke SOAP requests.</p>
                    <div className="soap-info-grid">
                        <div className="soap-info-feature"><Icon d={ICONS.file} size={14} /> WSDL Parsing</div>
                        <div className="soap-info-feature"><Icon d={ICONS.zap} size={14} /> Operation Discovery</div>
                        <div className="soap-info-feature"><Icon d={ICONS.edit} size={14} /> Request Building</div>
                        <div className="soap-info-feature"><Icon d={ICONS.search} size={14} /> XML Formatting</div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SoapTester;
