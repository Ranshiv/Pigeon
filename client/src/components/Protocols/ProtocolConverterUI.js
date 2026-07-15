/**
 * ProtocolConverterUI.js - Protocol Conversion Interface
 * UI for converting between different protocol formats
 */

import React, { useState, useCallback } from 'react';
import { ProtocolIcon } from './ProtocolSelector';
import './tester-shell.css';
import './ProtocolConverterUI.css';

// Icon Components
const SwapIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="17 1 21 5 17 9" />
        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <polyline points="7 23 3 19 7 15" />
        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
);

const WarningIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
);

const CheckIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const DownloadIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
);

const UploadIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
);

const FileIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
    </svg>
);

const SettingsIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
);

const TrashIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
);

const CopyIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
);

const HistoryIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v5h5" />
        <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
        <path d="M12 7v5l4 2" />
    </svg>
);

const ChartIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
);

const PROTOCOLS = [
    { id: 'http', name: 'HTTP/REST', icon: 'http' },
    { id: 'grpc', name: 'gRPC', icon: 'grpc' },
    { id: 'graphql', name: 'GraphQL', icon: 'graphql' },
    { id: 'soap', name: 'SOAP', icon: 'soap' },
    { id: 'websocket', name: 'WebSocket', icon: 'websocket' }
];

const ProtocolConverterUI = ({
    onConvert,
    onBatchConvert,
    savedConversions = []
}) => {
    // Source/Target State
    const [sourceProtocol, setSourceProtocol] = useState('http');
    const [targetProtocol, setTargetProtocol] = useState('grpc');

    // Input State
    const [sourceContent, setSourceContent] = useState('');
    const [sourceMetadata, setSourceMetadata] = useState('');

    // Output State
    const [result, setResult] = useState(null);
    const [isConverting, setIsConverting] = useState(false);

    // UI State
    const [error, setError] = useState(null);
    const [showMetadata, setShowMetadata] = useState(false);
    const [outputTab, setOutputTab] = useState('converted');
    const [conversionHistory, setConversionHistory] = useState([]);

    // Get conversion support info
    const getConversionKey = useCallback(() => {
        return `${sourceProtocol}_to_${targetProtocol}`;
    }, [sourceProtocol, targetProtocol]);

    // Check if conversion is supported
    const isConversionSupported = useCallback(() => {
        const supported = [
            'http_to_grpc', 'http_to_graphql', 'http_to_soap',
            'grpc_to_http', 'grpc_to_graphql',
            'graphql_to_http', 'graphql_to_grpc',
            'soap_to_http', 'soap_to_grpc'
        ];
        return supported.includes(getConversionKey());
    }, [getConversionKey]);

    // Swap protocols
    const swapProtocols = useCallback(() => {
        setSourceProtocol(targetProtocol);
        setTargetProtocol(sourceProtocol);
        setResult(null);
    }, [sourceProtocol, targetProtocol]);

    // Convert
    const convert = useCallback(async () => {
        if (!sourceContent.trim()) {
            setError('Please enter source content');
            return;
        }

        if (!isConversionSupported()) {
            setError(`Conversion from ${sourceProtocol.toUpperCase()} to ${targetProtocol.toUpperCase()} is not supported`);
            return;
        }

        setIsConverting(true);
        setError(null);
        setResult(null);

        try {
            // Parse source content
            let request;
            try {
                request = JSON.parse(sourceContent);
            } catch {
                // If not JSON, wrap it as a string
                request = sourceContent;
            }

            // Parse metadata if provided
            let options = {};
            if (sourceMetadata.trim()) {
                try {
                    options = JSON.parse(sourceMetadata);
                } catch {
                    throw new Error('Invalid metadata JSON');
                }
            }

            const payload = {
                sourceProtocol,
                targetProtocol,
                request,
                options
            };

            const res = await fetch('/api/protocols/convert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Conversion failed');
            }

            setResult(data);

            // Add to history
            setConversionHistory(prev => [{
                id: Date.now().toString(),
                from: sourceProtocol,
                to: targetProtocol,
                timestamp: new Date(),
                success: true
            }, ...prev].slice(0, 10));

            if (onConvert) {
                onConvert({
                    source: { protocol: sourceProtocol, content: sourceContent },
                    target: { protocol: targetProtocol, content: data.converted },
                    metadata: data.metadata
                });
            }
        } catch (err) {
            setError(err.message);
            setConversionHistory(prev => [{
                id: Date.now().toString(),
                from: sourceProtocol,
                to: targetProtocol,
                timestamp: new Date(),
                success: false,
                error: err.message
            }, ...prev].slice(0, 10));
        } finally {
            setIsConverting(false);
        }
    }, [sourceContent, sourceMetadata, sourceProtocol, targetProtocol, isConversionSupported, onConvert]);

    // Copy result
    const copyResult = useCallback(() => {
        if (result?.converted) {
            navigator.clipboard.writeText(
                typeof result.converted === 'string'
                    ? result.converted
                    : JSON.stringify(result.converted, null, 2)
            );
        }
    }, [result]);

    // Clear all
    const clearAll = useCallback(() => {
        setSourceContent('');
        setSourceMetadata('');
        setResult(null);
        setError(null);
    }, []);

    // Load sample
    const loadSample = useCallback(() => {
        const samples = {
            http: `{
  "method": "POST",
  "url": "/api/users",
  "headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer token123"
  },
  "body": {
    "name": "John Doe",
    "email": "john@example.com"
  }
}`,
            grpc: `{
  "service": "UserService",
  "method": "CreateUser",
  "message": {
    "name": "John Doe",
    "email": "john@example.com"
  }
}`,
            graphql: `{
  "query": "mutation CreateUser($input: UserInput!) { createUser(input: $input) { id name email } }",
  "variables": {
    "input": {
      "name": "John Doe",
      "email": "john@example.com"
    }
  }
}`,
            soap: `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <CreateUser xmlns="http://example.com/users">
      <name>John Doe</name>
      <email>john@example.com</email>
    </CreateUser>
  </soap:Body>
</soap:Envelope>`
        };
        setSourceContent(samples[sourceProtocol] || samples.http);
    }, [sourceProtocol]);

    // Format time
    const formatTime = (date) => {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    return (
        <div className="converter-ui">
            {/* Error Display */}
            {error && (
                <div className="converter-error">
                    <span><WarningIcon /> {error}</span>
                    <button onClick={() => setError(null)}>×</button>
                </div>
            )}

            {/* Protocol Selection */}
            <div className="converter-panel converter-protocol-panel">
                <h3 className="converter-panel-title"><SwapIcon /> Protocol Conversion</h3>

                <div className="converter-protocol-row">
                    <div className="converter-protocol-select">
                        <label>Source Protocol</label>
                        <div className="converter-protocol-options">
                            {PROTOCOLS.map(p => (
                                <button
                                    key={p.id}
                                    className={`converter-protocol-btn ${sourceProtocol === p.id ? 'active' : ''}`}
                                    onClick={() => { setSourceProtocol(p.id); setResult(null); }}
                                >
                                    <span className="protocol-icon"><ProtocolIcon type={p.icon} size={18} /></span>
                                    <span>{p.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        className="converter-swap-btn"
                        onClick={swapProtocols}
                        title="Swap protocols"
                    >
                        ⇄
                    </button>

                    <div className="converter-protocol-select">
                        <label>Target Protocol</label>
                        <div className="converter-protocol-options">
                            {PROTOCOLS.map(p => (
                                <button
                                    key={p.id}
                                    className={`converter-protocol-btn ${targetProtocol === p.id ? 'active' : ''} ${p.id === sourceProtocol ? 'disabled' : ''}`}
                                    onClick={() => { if (p.id !== sourceProtocol) { setTargetProtocol(p.id); setResult(null); } }}
                                    disabled={p.id === sourceProtocol}
                                >
                                    <span className="protocol-icon"><ProtocolIcon type={p.icon} size={18} /></span>
                                    <span>{p.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Conversion Support Indicator */}
                <div className={`converter-support ${isConversionSupported() ? 'supported' : 'unsupported'}`}>
                    {isConversionSupported() ? (
                        <><CheckIcon size={14} /> Conversion supported</>
                    ) : (
                        <><WarningIcon size={14} /> This conversion path is not currently supported</>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="converter-main">
                {/* Source Panel */}
                <div className="converter-panel converter-source-panel">
                    <div className="converter-source-header">
                        <h3 className="converter-panel-title">
                            <DownloadIcon size={16} /> Source ({PROTOCOLS.find(p => p.id === sourceProtocol)?.name})
                        </h3>
                        <div className="converter-source-actions">
                            <button
                                className="converter-btn converter-btn-small"
                                onClick={loadSample}
                            >
                                <FileIcon size={14} /> Sample
                            </button>
                            <button
                                className={`converter-btn converter-btn-small ${showMetadata ? 'active' : ''}`}
                                onClick={() => setShowMetadata(!showMetadata)}
                            >
                                <SettingsIcon size={14} /> Metadata
                            </button>
                            <button
                                className="converter-btn converter-btn-small"
                                onClick={clearAll}
                            >
                                <TrashIcon size={14} /> Clear
                            </button>
                        </div>
                    </div>

                    <textarea
                        className="converter-input"
                        value={sourceContent}
                        onChange={(e) => setSourceContent(e.target.value)}
                        placeholder={`Enter ${sourceProtocol.toUpperCase()} request/content here...`}
                        spellCheck={false}
                    />

                    {showMetadata && (
                        <div className="converter-metadata">
                            <label>Conversion Metadata (JSON):</label>
                            <textarea
                                value={sourceMetadata}
                                onChange={(e) => setSourceMetadata(e.target.value)}
                                placeholder='{"serviceName": "MyService", "packageName": "com.example"}'
                            />
                        </div>
                    )}

                    <button
                        className="converter-btn converter-btn-convert"
                        onClick={convert}
                        disabled={isConverting || !sourceContent.trim() || !isConversionSupported()}
                    >
                        <SwapIcon size={16} /> {isConverting ? 'Converting...' : 'Convert'}
                    </button>
                </div>

                {/* Result Panel */}
                <div className="converter-panel converter-result-panel">
                    <div className="converter-result-header">
                        <h3 className="converter-panel-title">
                            <UploadIcon size={16} /> Result ({PROTOCOLS.find(p => p.id === targetProtocol)?.name})
                        </h3>
                        {result && (
                            <div className="converter-result-tabs">
                                <button
                                    className={`converter-tab ${outputTab === 'converted' ? 'active' : ''}`}
                                    onClick={() => setOutputTab('converted')}
                                >
                                    Converted
                                </button>
                                <button
                                    className={`converter-tab ${outputTab === 'metadata' ? 'active' : ''}`}
                                    onClick={() => setOutputTab('metadata')}
                                >
                                    Metadata
                                </button>
                                <button
                                    className="converter-btn converter-btn-small"
                                    onClick={copyResult}
                                >
                                    <CopyIcon size={14} /> Copy
                                </button>
                            </div>
                        )}
                    </div>

                    {result ? (
                        <div className="converter-result-content">
                            {outputTab === 'converted' && (
                                <pre className="converter-output">
                                    {typeof result.converted === 'string'
                                        ? result.converted
                                        : JSON.stringify(result.converted, null, 2)}
                                </pre>
                            )}
                            {outputTab === 'metadata' && (
                                <pre className="converter-output">
                                    {JSON.stringify(result.metadata || {}, null, 2)}
                                </pre>
                            )}
                        </div>
                    ) : (
                        <div className="converter-empty">
                            <span className="converter-empty-icon"><SwapIcon size={48} /></span>
                            <p>Conversion result will appear here</p>
                            <span className="converter-empty-hint">
                                Enter source content and click Convert
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Conversion History */}
            {conversionHistory.length > 0 && (
                <div className="converter-panel converter-history-panel">
                    <h3 className="converter-panel-title"><HistoryIcon size={16} /> Recent Conversions</h3>
                    <div className="converter-history-list">
                        {conversionHistory.map(item => (
                            <div
                                key={item.id}
                                className={`converter-history-item ${item.success ? 'success' : 'failed'}`}
                            >
                                <span className="history-from">{item.from.toUpperCase()}</span>
                                <span className="history-arrow">→</span>
                                <span className="history-to">{item.to.toUpperCase()}</span>
                                <span className={`history-status ${item.success ? 'success' : 'failed'}`}>
                                    {item.success ? '✓' : '✗'}
                                </span>
                                <span className="history-time">{formatTime(item.timestamp)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Conversion Matrix */}
            <div className="converter-panel converter-matrix-panel">
                <h3 className="converter-panel-title"><ChartIcon size={16} /> Supported Conversions</h3>
                <div className="converter-matrix">
                    <table>
                        <thead>
                            <tr>
                                <th>From \ To</th>
                                {PROTOCOLS.map(p => (
                                    <th key={p.id}><ProtocolIcon type={p.icon} size={14} /> {p.name}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {PROTOCOLS.map(fromP => (
                                <tr key={fromP.id}>
                                    <td className="matrix-row-header"><ProtocolIcon type={fromP.icon} size={14} /> {fromP.name}</td>
                                    {PROTOCOLS.map(toP => {
                                        const key = `${fromP.id}_to_${toP.id}`;
                                        const supported = [
                                            'http_to_grpc', 'http_to_graphql', 'http_to_soap',
                                            'grpc_to_http', 'grpc_to_graphql',
                                            'graphql_to_http', 'graphql_to_grpc',
                                            'soap_to_http', 'soap_to_grpc'
                                        ].includes(key);

                                        return (
                                            <td
                                                key={key}
                                                className={`matrix-cell ${fromP.id === toP.id ? 'same' : supported ? 'supported' : 'unsupported'}`}
                                            >
                                                {fromP.id === toP.id ? '—' : supported ? '✓' : '—'}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ProtocolConverterUI;
