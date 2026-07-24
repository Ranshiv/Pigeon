/**
 * ProtocolConverterUI.js - Protocol Conversion Interface
 * 2026 Observability Dark redesign with batch conversion, templates, history, and validation.
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { ProtocolIcon } from './ProtocolSelector';
import { useTheme } from '../../context/ThemeContext';
import './tester-shell.css';
import './ProtocolConverterUI.css';

const PROTOCOLS = [
    { id: 'http', name: 'HTTP/REST', icon: 'http', color: 'var(--protocol-http)', description: 'Standard HTTP requests with REST conventions' },
    { id: 'websocket', name: 'WebSocket', icon: 'websocket', color: 'var(--protocol-ws)', description: 'Full-duplex real-time communication' },
    { id: 'grpc', name: 'gRPC', icon: 'grpc', color: 'var(--protocol-grpc)', description: 'High-performance RPC with Protocol Buffers' },
    { id: 'graphql', name: 'GraphQL', icon: 'graphql', color: 'var(--protocol-graphql)', description: 'Query language for flexible data fetching' },
    { id: 'soap', name: 'SOAP', icon: 'soap', color: 'var(--protocol-soap)', description: 'XML-based enterprise web services' },
    { id: 'mqtt', name: 'MQTT', icon: 'mqtt', color: 'var(--protocol-mqtt)', description: 'Lightweight pub/sub messaging for IoT' },
    { id: 'sse', name: 'SSE', icon: 'sse', color: 'var(--protocol-sse)', description: 'Server-Sent Events for real-time updates' }
];

// --- SVG Icons (kept as local components to avoid a new dependency) ---
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
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l-.06-.06a1.65 1.65 0 0 0 .33-1.82V9a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
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

const PlusIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);

const XIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

const BatchIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6h16" />
        <path d="M4 12h16" />
        <path d="M4 18h16" />
    </svg>
);

const ValidateIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <path d="M9 15l2 2 4-4" />
    </svg>
);

const DownloadFileIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
);

const ReplayIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 4v6h6" />
        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
);

const languageForProtocol = (protocol) => {
    if (protocol === 'soap') return 'xml';
    if (protocol === 'graphql') return 'graphql';
    return 'json';
};

const editorOptions = {
    minimap: { enabled: false },
    fontSize: 14,
    lineHeight: 1.5,
    lineNumbersMinChars: 3,
    lineNumbers: 'on',
    roundedSelection: false,
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    wordWrap: 'on',
    folding: true,
    renderLineHighlight: 'all',
    selectOnLineNumbers: true,
    padding: { top: 8, bottom: 8 },
    lineDecorationsWidth: 10
};

const handleEditorWillMount = (monaco) => {
    monaco.editor.defineTheme('pigeon-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
            'editor.background': '#002234',
            'editor.lineHighlightBackground': '#013B5B',
            'editorLineNumber.foreground': '#5b7c93',
            'editorGutter.background': '#002234',
            'editorWidget.background': '#00111A',
            'editorWidget.border': '#003956'
        }
    });
    monaco.editor.defineTheme('pigeon-omni', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
            'editor.background': '#12100e',
            'editor.foreground': '#fff7ed',
            'editor.lineHighlightBackground': '#26170d',
            'editorLineNumber.foreground': '#a89484',
            'editorLineNumber.activeForeground': '#ff8a1f',
            'editorGutter.background': '#0d0b09',
            'editorWidget.background': '#1b1611',
            'editorWidget.border': '#3a2719',
            'editorWidget.foreground': '#fff7ed',
            'editor.selectionBackground': '#ff8a1f40',
            'editorCursor.foreground': '#ffb35c'
        }
    });
    monaco.editor.defineTheme('pigeon-black', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
            'editor.background': '#000000',
            'editor.foreground': '#ffffff',
            'editor.lineHighlightBackground': '#ffffff12',
            'editorLineNumber.foreground': '#808080',
            'editorLineNumber.activeForeground': '#ffffff',
            'editorGutter.background': '#000000',
            'editorWidget.background': '#000000',
            'editorWidget.border': '#ffffff40',
            'editorWidget.foreground': '#ffffff',
            'editor.selectionBackground': '#ffffff40',
            'editorCursor.foreground': '#ffffff'
        }
    });
};

const DEFAULT_SAMPLES = {
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
  "request": {
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
</soap:Envelope>`,
    websocket: `{
  "type": "request",
  "method": "POST",
  "path": "/api/users",
  "headers": {},
  "body": { "name": "John Doe" }
}`,
    mqtt: `{
  "topic": "users/create",
  "payload": { "name": "John Doe" },
  "qos": 0,
  "retain": false
}`,
    sse: `{
  "event": "message",
  "data": { "name": "John Doe" },
  "id": "1"
}`
};

const validateJsonOrXml = (value, protocol) => {
    if (!value || !value.trim()) return null;
    if (protocol === 'soap') {
        const trimmed = value.trim();
        if (!trimmed.startsWith('<') || !trimmed.endsWith('>')) {
            return 'SOAP envelope must be valid XML starting with < and ending with >';
        }
        return null;
    }
    try {
        JSON.parse(value);
        return null;
    } catch (e) {
        return `Invalid JSON: ${e.message}`;
    }
};

// --- Stable top-level editor sub-components (not recreated each render) ---
const EditorWithTheme = ({ value, language, onChange, readOnly, lineNumbers, placeholder }) => {
    const { theme } = useTheme();
    const editorTheme = {
        light: 'vs-light', dark: 'pigeon-dark', omni: 'pigeon-omni',
        black: 'pigeon-black'
    }[theme] || 'pigeon-dark';
    const options = useMemo(() => ({
        ...editorOptions,
        readOnly: !!readOnly,
        lineNumbers: lineNumbers === 'off' ? 'off' : 'on'
    }), [readOnly, lineNumbers]);

    return (
        <div className="monaco-editor-wrapper">
            <Editor
                height="100%"
                defaultLanguage={language}
                value={value}
                onChange={onChange}
                options={options}
                theme={editorTheme}
                beforeMount={handleEditorWillMount}
                placeholder={placeholder}
            />
        </div>
    );
};

const SingleEditor = ({
    sourceProtocol,
    targetProtocol,
    sourceContent,
    setSourceContent,
    sourceMetadata,
    setSourceMetadata,
    result,
    showMetadata,
    setShowMetadata,
    sourceValidation,
    loadSample,
    clearAll,
    validateConversion,
    convert,
    isConverting,
    isConversionSupported,
    copyResult,
    downloadResult,
    outputTab,
    setOutputTab
}) => (
    <div className="pc-main">
        <div className="pc-panel pc-source-panel">
            <div className="pc-panel-header">
                <h3 className="pc-panel-title"><DownloadIcon size={16} /> Source ({PROTOCOLS.find(p => p.id === sourceProtocol)?.name})</h3>
                <div className="pc-actions">
                    <button className="ts-btn" onClick={loadSample}><FileIcon size={14} /> Sample</button>
                    <button className={`ts-btn ${showMetadata ? 'active' : ''}`} onClick={() => setShowMetadata(!showMetadata)}><SettingsIcon size={14} /> Metadata</button>
                    <button className="ts-btn" onClick={clearAll}><TrashIcon size={14} /> Clear</button>
                </div>
            </div>

            <div className="pc-editor-wrap">
                <EditorWithTheme
                    language={languageForProtocol(sourceProtocol)}
                    value={sourceContent}
                    onChange={(v) => setSourceContent(v || '')}
                />
            </div>
            {sourceValidation && (
                <div className="pc-validation-error"><WarningIcon size={14} /> {sourceValidation}</div>
            )}

            {showMetadata && (
                <div className="pc-metadata">
                    <label>Conversion Metadata (JSON):</label>
                    <div className="pc-editor-wrap pc-metadata-editor">
                        <EditorWithTheme
                            language="json"
                            value={sourceMetadata}
                            onChange={(v) => setSourceMetadata(v || '')}
                            lineNumbers="off"
                        />
                    </div>
                </div>
            )}

            <div className="pc-panel-footer">
                <button className="ts-btn" onClick={validateConversion} disabled={!sourceContent.trim()}><ValidateIcon size={14} /> Validate</button>
                <button
                    className="ts-btn primary"
                    onClick={convert}
                    disabled={isConverting || !sourceContent.trim() || !isConversionSupported(sourceProtocol, targetProtocol) || sourceProtocol === targetProtocol}
                >
                    <SwapIcon size={16} /> {isConverting ? 'Converting...' : 'Convert'}
                </button>
            </div>
        </div>

        <div className="pc-panel pc-result-panel">
            <div className="pc-panel-header">
                <h3 className="pc-panel-title"><UploadIcon size={16} /> Result ({PROTOCOLS.find(p => p.id === targetProtocol)?.name})</h3>
                {result && !result.batch && (
                    <div className="pc-actions">
                        <button className="ts-btn" onClick={copyResult}><CopyIcon size={14} /> Copy</button>
                        <button className="ts-btn" onClick={downloadResult}><DownloadFileIcon size={14} /> Download</button>
                    </div>
                )}
            </div>

            {result ? (
                <div className="pc-result-content">
                    {!result.batch && (
                        <div className="pc-result-tabs">
                            <button className={`pc-tab ${outputTab === 'converted' ? 'active' : ''}`} onClick={() => setOutputTab('converted')}>Converted</button>
                            <button className={`pc-tab ${outputTab === 'metadata' ? 'active' : ''}`} onClick={() => setOutputTab('metadata')}>Metadata</button>
                            {Array.isArray(result.notes) && result.notes.length > 0 && (
                                <button className={`pc-tab ${outputTab === 'notes' ? 'active' : ''}`} onClick={() => setOutputTab('notes')}>Notes</button>
                            )}
                        </div>
                    )}
                    <div className="pc-editor-wrap pc-output-editor">
                        {!result.batch ? (
                            <EditorWithTheme
                                language={languageForProtocol(targetProtocol)}
                                value={
                                    outputTab === 'converted'
                                        ? (typeof result.converted === 'string' ? result.converted : JSON.stringify(result.converted, null, 2))
                                        : outputTab === 'metadata'
                                            ? JSON.stringify(result.metadata || {}, null, 2)
                                            : (result.notes || []).join('\n')
                                }
                                readOnly
                            />
                        ) : (
                            <EditorWithTheme
                                language="json"
                                value={JSON.stringify({ summary: result.summary, results: result.batch }, null, 2)}
                                readOnly
                            />
                        )}
                    </div>
                </div>
            ) : (
                <div className="pc-empty">
                    <SwapIcon size={48} />
                    <p>Conversion result will appear here</p>
                    <span>Enter source content and click Convert</span>
                </div>
            )}
        </div>
    </div>
);

const BatchEditor = ({
    batchItems,
    updateBatchItem,
    removeBatchItem,
    addBatchItem,
    fileInputRef,
    loadBatchFromFile,
    runBatch,
    isConverting,
    result,
    copyResult,
    downloadResult
}) => (
    <div className="pc-main pc-batch">
        <div className="pc-panel pc-batch-panel">
            <div className="pc-panel-header">
                <h3 className="pc-panel-title"><BatchIcon size={16} /> Batch Conversions</h3>
                <div className="pc-actions">
                    <input type="file" ref={fileInputRef} accept=".json" style={{ display: 'none' }} onChange={loadBatchFromFile} />
                    <button className="ts-btn" onClick={() => fileInputRef.current?.click()}><UploadIcon size={14} /> Load JSON</button>
                    <button className="ts-btn" onClick={addBatchItem}><PlusIcon size={14} /> Add Row</button>
                </div>
            </div>

            <div className="pc-batch-list">
                {batchItems.map((item, idx) => (
                    <div key={item.id} className="pc-batch-row">
                        <span className="pc-batch-index">{idx + 1}</span>
                        <select value={item.sourceProtocol} onChange={(e) => updateBatchItem(item.id, 'sourceProtocol', e.target.value)}>
                            {PROTOCOLS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <span className="pc-batch-arrow">→</span>
                        <select value={item.targetProtocol} onChange={(e) => updateBatchItem(item.id, 'targetProtocol', e.target.value)}>
                            {PROTOCOLS.filter(p => p.id !== item.sourceProtocol).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <textarea
                            className="pc-batch-content"
                            value={item.content}
                            onChange={(e) => updateBatchItem(item.id, 'content', e.target.value)}
                            placeholder="Paste request JSON/XML..."
                        />
                        <button className="pc-batch-remove" onClick={() => removeBatchItem(item.id)} title="Remove"><XIcon size={14} /></button>
                    </div>
                ))}
            </div>

            <div className="pc-panel-footer">
                <button className="ts-btn primary" onClick={runBatch} disabled={isConverting}>
                    <BatchIcon size={16} /> {isConverting ? 'Running batch...' : 'Run Batch'}
                </button>
            </div>
        </div>

        <div className="pc-panel pc-result-panel">
            <div className="pc-panel-header">
                <h3 className="pc-panel-title"><UploadIcon size={16} /> Batch Results</h3>
                {result?.batch && (
                    <div className="pc-actions">
                        <button className="ts-btn" onClick={copyResult}><CopyIcon size={14} /> Copy</button>
                        <button className="ts-btn" onClick={downloadResult}><DownloadFileIcon size={14} /> Download</button>
                    </div>
                )}
            </div>
            {result?.batch ? (
                <div className="pc-editor-wrap pc-output-editor">
                    <EditorWithTheme
                        language="json"
                        value={JSON.stringify({ summary: result.summary, results: result.batch }, null, 2)}
                        readOnly
                    />
                </div>
            ) : (
                <div className="pc-empty">
                    <BatchIcon size={48} />
                    <p>Batch results will appear here</p>
                    <span>Add items and run the batch</span>
                </div>
            )}
        </div>
    </div>
);

const ProtocolConverterUI = ({ onConvert }) => {
    useTheme(); // keep component subscribed to theme context
    const [sourceProtocol, setSourceProtocol] = useState('http');
    const [targetProtocol, setTargetProtocol] = useState('grpc');
    const [sourceContent, setSourceContent] = useState('');
    const [sourceMetadata, setSourceMetadata] = useState('');
    const [result, setResult] = useState(null);
    const [isConverting, setIsConverting] = useState(false);
    const [error, setError] = useState(null);
    const [validation, setValidation] = useState(null);
    const [showMetadata, setShowMetadata] = useState(false);
    const [outputTab, setOutputTab] = useState('converted');
    const [conversionHistory, setConversionHistory] = useState([]);
    const [mode, setMode] = useState('single'); // 'single' | 'batch'
    const [batchItems, setBatchItems] = useState([{ id: 1, sourceProtocol: 'http', targetProtocol: 'grpc', content: '', options: '' }]);
    const fileInputRef = useRef(null);

    const sourceValidation = useMemo(
        () => validateJsonOrXml(sourceContent, sourceProtocol),
        [sourceContent, sourceProtocol]
    );

    const isConversionSupported = useCallback((from, to) => {
        if (from === to) return true;
        return ProtocolConverterUI.SUPPORTED_PAIRS.has(`${from}_to_${to}`);
    }, []);

    const swapProtocols = useCallback(() => {
        setSourceProtocol(targetProtocol);
        setTargetProtocol(sourceProtocol);
        setResult(null);
        setValidation(null);
    }, [sourceProtocol, targetProtocol]);

    const resetForSource = useCallback((id) => {
        setSourceProtocol(id);
        setResult(null);
        setValidation(null);
    }, []);

    const resetForTarget = useCallback((id) => {
        setTargetProtocol(id);
        setResult(null);
        setValidation(null);
    }, []);

    const loadSample = useCallback(() => {
        setSourceContent(DEFAULT_SAMPLES[sourceProtocol] || DEFAULT_SAMPLES.http);
        setResult(null);
    }, [sourceProtocol]);

    const clearAll = useCallback(() => {
        setSourceContent('');
        setSourceMetadata('');
        setResult(null);
        setError(null);
        setValidation(null);
    }, []);

    const copyResult = useCallback(() => {
        if (!result?.converted) return;
        const text = typeof result.converted === 'string' ? result.converted : JSON.stringify(result.converted, null, 2);
        navigator.clipboard.writeText(text);
    }, [result]);

    const downloadResult = useCallback(() => {
        if (!result?.converted) return;
        const text = typeof result.converted === 'string' ? result.converted : JSON.stringify(result.converted, null, 2);
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${sourceProtocol}-to-${targetProtocol}.${targetProtocol === 'soap' ? 'xml' : 'json'}`;
        a.click();
        URL.revokeObjectURL(url);
    }, [result, sourceProtocol, targetProtocol]);

    const addToHistory = useCallback((item) => {
        setConversionHistory(prev => [item, ...prev].slice(0, 20));
    }, []);

    const validateConversion = useCallback(async () => {
        setValidation(null);
        try {
            const res = await fetch('/api/protocols/convert/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sourceProtocol, targetProtocol, request: sourceContent })
            });
            const data = await res.json();
            setValidation(data);
        } catch (err) {
            setValidation({ success: false, error: err.message });
        }
    }, [sourceProtocol, targetProtocol, sourceContent]);

    const parsePayload = useCallback((content, protocol) => {
        if (!content.trim()) return null;
        if (protocol === 'soap') return content;
        try {
            return JSON.parse(content);
        } catch {
            return content;
        }
    }, []);

    const convert = useCallback(async () => {
        if (!sourceContent.trim()) {
            setError('Please enter source content');
            return;
        }
        if (sourceProtocol === targetProtocol) {
            setError('Source and target protocols are the same');
            return;
        }
        if (!isConversionSupported(sourceProtocol, targetProtocol)) {
            setError(`Conversion from ${sourceProtocol.toUpperCase()} to ${targetProtocol.toUpperCase()} is not supported`);
            return;
        }
        if (sourceValidation) {
            setError(sourceValidation);
            return;
        }

        setIsConverting(true);
        setError(null);
        setResult(null);
        setValidation(null);

        try {
            const request = parsePayload(sourceContent, sourceProtocol);
            let options = {};
            if (sourceMetadata.trim()) {
                try {
                    options = JSON.parse(sourceMetadata);
                } catch {
                    throw new Error('Invalid metadata JSON');
                }
            }

            const res = await fetch('/api/protocols/convert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sourceProtocol, targetProtocol, request, options })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Conversion failed');

            setResult(data);
            addToHistory({
                id: Date.now().toString(),
                from: sourceProtocol,
                to: targetProtocol,
                timestamp: new Date(),
                success: true,
                snippet: typeof data.converted === 'string'
                    ? data.converted.slice(0, 120)
                    : JSON.stringify(data.converted).slice(0, 120)
            });

            onConvert?.({
                source: { protocol: sourceProtocol, content: sourceContent },
                target: { protocol: targetProtocol, content: data.converted },
                metadata: data.metadata
            });
        } catch (err) {
            setError(err.message);
            addToHistory({
                id: Date.now().toString(),
                from: sourceProtocol,
                to: targetProtocol,
                timestamp: new Date(),
                success: false,
                error: err.message
            });
        } finally {
            setIsConverting(false);
        }
    }, [sourceContent, sourceMetadata, sourceProtocol, targetProtocol, isConversionSupported, sourceValidation, parsePayload, addToHistory, onConvert]);

    const runBatch = useCallback(async () => {
        const validItems = batchItems.filter(b => b.content.trim() && isConversionSupported(b.sourceProtocol, b.targetProtocol));
        if (validItems.length === 0) {
            setError('Add at least one valid batch item with supported source/target pair');
            return;
        }

        setIsConverting(true);
        setError(null);
        setResult(null);

        try {
            const conversions = validItems.map(b => ({
                sourceProtocol: b.sourceProtocol,
                targetProtocol: b.targetProtocol,
                request: parsePayload(b.content, b.sourceProtocol),
                options: b.options ? JSON.parse(b.options) : {}
            }));

            const res = await fetch('/api/protocols/convert/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversions })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Batch conversion failed');

            setResult({ batch: data.results, summary: data.summary });
            addToHistory({
                id: Date.now().toString(),
                from: 'batch',
                to: 'batch',
                timestamp: new Date(),
                success: data.summary.failed === 0,
                summary: data.summary
            });
        } catch (err) {
            setError(err.message);
        } finally {
            setIsConverting(false);
        }
    }, [batchItems, isConversionSupported, parsePayload, addToHistory]);

    const addBatchItem = useCallback(() => {
        setBatchItems(prev => [...prev, { id: Date.now(), sourceProtocol: 'http', targetProtocol: 'grpc', content: '', options: '' }]);
    }, []);

    const removeBatchItem = useCallback((id) => {
        setBatchItems(prev => prev.filter(b => b.id !== id));
    }, []);

    const updateBatchItem = useCallback((id, field, value) => {
        setBatchItems(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
    }, []);

    const loadBatchFromFile = useCallback((event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parsed = JSON.parse(e.target.result);
                if (!Array.isArray(parsed)) throw new Error('File must contain an array');
                setBatchItems(parsed.map((item, idx) => ({
                    id: Date.now() + idx,
                    sourceProtocol: item.sourceProtocol || 'http',
                    targetProtocol: item.targetProtocol || 'grpc',
                    content: typeof item.request === 'string' ? item.request : JSON.stringify(item.request, null, 2),
                    options: item.options ? JSON.stringify(item.options, null, 2) : ''
                })));
            } catch (err) {
                setError(`Failed to load batch file: ${err.message}`);
            }
        };
        reader.readAsText(file);
    }, []);

    const replayHistory = useCallback((item) => {
        if (item.from === 'batch' || item.from === 'saved') return;
        setSourceProtocol(item.from);
        setTargetProtocol(item.to);
        setResult(null);
        setMode('single');
    }, []);

    const formatTime = useCallback((date) => date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), []);

    const formatRelativeTime = useCallback((date) => {
        const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
        if (seconds < 10) return 'just now';
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }, []);

    useEffect(() => {
        // Reset target if it becomes identical to source
        if (sourceProtocol === targetProtocol) {
            const firstOther = PROTOCOLS.find(p => p.id !== sourceProtocol);
            if (firstOther) setTargetProtocol(firstOther.id);
        }
    }, [sourceProtocol, targetProtocol]);

    const matrixData = useMemo(() => {
        const supported = new Set(ProtocolConverterUI.SUPPORTED_PAIRS);
        return PROTOCOLS.map(from => ({
            from,
            cells: PROTOCOLS.map(to => {
                if (from.id === to.id) return { type: 'same', label: '—' };
                if (supported.has(`${from.id}_to_${to.id}`)) return { type: 'supported', label: '✓' };
                return { type: 'unsupported', label: '—' };
            })
        }));
    }, []);

    const renderProtocolSelector = (value, onChange, label, exclude) => (
        <div className="pc-protocol-select">
            <label>{label}</label>
            <div className="pc-protocol-options">
                {PROTOCOLS.map(p => (
                    <button
                        key={p.id}
                        className={`pc-protocol-btn ${value === p.id ? 'active' : ''}`}
                        onClick={() => onChange(p.id)}
                        disabled={p.id === exclude}
                        title={p.name}
                    >
                        <ProtocolIcon type={p.icon} size={18} />
                        <span>{p.name}</span>
                    </button>
                ))}
            </div>
        </div>
    );

    return (
        <div className="pc-shell">
            {error && (
                <div className="pc-toast pc-toast-error">
                    <span><WarningIcon size={16} /> {error}</span>
                    <button onClick={() => setError(null)}><XIcon size={16} /></button>
                </div>
            )}

            <div className="pc-panel pc-protocol-panel">
                <div className="pc-panel-header">
                    <h3 className="pc-panel-title"><SwapIcon size={16} /> Protocol Conversion</h3>
                    <div className="pc-mode-tabs">
                        <button className={`pc-mode-tab ${mode === 'single' ? 'active' : ''}`} onClick={() => setMode('single')}>Single</button>
                        <button className={`pc-mode-tab ${mode === 'batch' ? 'active' : ''}`} onClick={() => setMode('batch')}>Batch</button>
                    </div>
                </div>

                <div className="pc-protocol-row">
                    {renderProtocolSelector(sourceProtocol, resetForSource, 'Source Protocol')}
                    <button className="pc-swap-btn" onClick={swapProtocols} title="Swap protocols">
                        <SwapIcon size={20} />
                    </button>
                    {renderProtocolSelector(targetProtocol, resetForTarget, 'Target Protocol', sourceProtocol)}
                </div>

                <div className={`pc-support ${isConversionSupported(sourceProtocol, targetProtocol) && sourceProtocol !== targetProtocol ? 'supported' : 'unsupported'}`}>
                    {isConversionSupported(sourceProtocol, targetProtocol) && sourceProtocol !== targetProtocol ? (
                        <><CheckIcon size={14} /> Conversion supported</>
                    ) : sourceProtocol === targetProtocol ? (
                        <><WarningIcon size={14} /> Select different source and target protocols</>
                    ) : (
                        <><WarningIcon size={14} /> This conversion path is not currently supported</>
                    )}
                </div>

                {validation && (
                    <div className={`pc-validation-bar ${validation.supported ? 'supported' : 'unsupported'}`}>
                        <ValidateIcon size={14} />
                        {validation.supported ? 'Validated: ' : 'Validation issue: '}
                        {validation.notes || validation.error || validation.guidance?.message || 'Unknown'}
                    </div>
                )}
            </div>

            {mode === 'single' ? (
                <SingleEditor
                    sourceProtocol={sourceProtocol}
                    targetProtocol={targetProtocol}
                    sourceContent={sourceContent}
                    setSourceContent={setSourceContent}
                    sourceMetadata={sourceMetadata}
                    setSourceMetadata={setSourceMetadata}
                    result={result}
                    showMetadata={showMetadata}
                    setShowMetadata={setShowMetadata}
                    sourceValidation={sourceValidation}
                    loadSample={loadSample}
                    clearAll={clearAll}
                    validateConversion={validateConversion}
                    convert={convert}
                    isConverting={isConverting}
                    isConversionSupported={isConversionSupported}
                    copyResult={copyResult}
                    downloadResult={downloadResult}
                    outputTab={outputTab}
                    setOutputTab={setOutputTab}
                />
            ) : (
                <BatchEditor
                    batchItems={batchItems}
                    updateBatchItem={updateBatchItem}
                    removeBatchItem={removeBatchItem}
                    addBatchItem={addBatchItem}
                    fileInputRef={fileInputRef}
                    loadBatchFromFile={loadBatchFromFile}
                    runBatch={runBatch}
                    isConverting={isConverting}
                    result={result}
                    copyResult={copyResult}
                    downloadResult={downloadResult}
                />
            )}

            <div className="pc-panel pc-history-panel">
                <div className="pc-panel-header">
                    <h3 className="pc-panel-title"><HistoryIcon size={16} /> Recent Conversions</h3>
                    {conversionHistory.length > 0 && (
                        <button className="ts-btn" onClick={() => setConversionHistory([])}><TrashIcon size={14} /> Clear</button>
                    )}
                </div>
                <div className="pc-history-list">
                    {conversionHistory.length > 0 ? conversionHistory.map(item => (
                        <div key={item.id} className={`pc-history-item ${item.success ? 'success' : 'failed'}`}>
                            <span className="pc-history-status-dot" />
                            <span className="pc-history-route">{item.from.toUpperCase()} <span className="pc-history-arrow">→</span> {item.to.toUpperCase()}</span>
                            {item.summary && (
                                <span className="pc-history-summary">{item.summary.successful}/{item.summary.total}</span>
                            )}
                            <span className="pc-history-time" title={formatTime(item.timestamp)}>{formatRelativeTime(item.timestamp)}</span>
                            {item.from !== 'batch' && item.from !== 'saved' && (
                                <button className="pc-history-replay" onClick={() => replayHistory(item)} title="Replay conversion"><ReplayIcon size={14} /></button>
                            )}
                        </div>
                    )) : (
                        <div className="pc-history-empty">No recent conversions yet.</div>
                    )}
                </div>
            </div>

            <div className="pc-panel pc-matrix-panel">
                <h3 className="pc-panel-title"><ChartIcon size={16} /> Supported Conversions</h3>
                <div className="pc-matrix">
                    <table>
                        <thead>
                            <tr>
                                <th>From \ To</th>
                                {PROTOCOLS.map(p => (
                                    <th key={p.id}>{p.name}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {matrixData.map(row => (
                                <tr key={row.from.id}>
                                    <td className="pc-matrix-row-header">{row.from.name}</td>
                                    {row.cells.map((cell, idx) => (
                                        <td key={`${row.from.id}-${PROTOCOLS[idx].id}`} className={`pc-matrix-cell ${cell.type}`}>{cell.label}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

ProtocolConverterUI.SUPPORTED_PAIRS = new Set([
    'http_to_grpc', 'http_to_graphql', 'http_to_soap', 'http_to_websocket', 'http_to_mqtt',
    'grpc_to_http', 'grpc_to_graphql',
    'graphql_to_http', 'graphql_to_grpc',
    'soap_to_http', 'soap_to_grpc',
    'websocket_to_http',
    'mqtt_to_websocket'
]);

export default ProtocolConverterUI;
