// client/src/components/GraphQL/GraphQLTester.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useTheme } from '../../context/ThemeContext';
import GraphQLLintingPanel from './GraphQLLintingPanel';
import '../Protocols/tester-shell.css';
import './GraphQLTester.css';

const GraphQLTester = () => {
    const { theme } = useTheme();
    const [url, setUrl] = useState('');
    const [query, setQuery] = useState('# Enter your GraphQL query here\nquery {\n  \n}');
    const [variables, setVariables] = useState('{}');
    const [headers, setHeaders] = useState([{ key: 'Content-Type', value: 'application/json' }]);
    const [activeTab, setActiveTab] = useState('query');
    const [response, setResponse] = useState(null);
    const [loading, setLoading] = useState(false);
    const [introspecting, setIntrospecting] = useState(false);
    // eslint-disable-next-line no-unused-vars
    const [schema, setSchema] = useState(null);
    const [schemaTypes, setSchemaTypes] = useState([]);
    const [complexity, setComplexity] = useState(null);
    const [executionTime, setExecutionTime] = useState(null);
    const [showSchema, setShowSchema] = useState(true); // eslint-disable-line no-unused-vars
    const [showLinting, setShowLinting] = useState(true);
    const [lintResults, setLintResults] = useState(null);
    const editorRef = useRef(null);

    // Register a Monaco theme matching the app's dark-navy palette instead
    // of Monaco's stock vs-dark (flat #1e1e1e), which clashed with the UI.
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
    };
    const editorTheme = theme === 'dark' ? 'pigeon-dark' : 'vs-light';

    // Execute GraphQL query
    const executeQuery = async () => {
        if (!url || !query) {
            alert('Please provide both URL and query');
            return;
        }

        setLoading(true);
        setResponse(null);

        try {
            // Parse variables
            let parsedVariables = {};
            try {
                parsedVariables = variables ? JSON.parse(variables) : {};
            } catch (e) {
                throw new Error('Invalid JSON in variables');
            }

            // Convert headers array to object
            const headersObj = {};
            headers.forEach(h => {
                if (h.key && h.value) {
                    headersObj[h.key] = h.value;
                }
            });

            const res = await fetch('/api/graphql/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url,
                    query,
                    variables: parsedVariables,
                    headers: headersObj
                })
            });

            const data = await res.json();
            setResponse(data);
            setExecutionTime(data.executionTime);

            // Analyze query complexity
            analyzeQuery();
        } catch (error) {
            setResponse({
                success: false,
                errors: [{ message: error.message }]
            });
        } finally {
            setLoading(false);
        }
    };

    // Introspect schema
    const introspectSchema = async () => {
        if (!url) {
            alert('Please provide a URL');
            return;
        }

        setIntrospecting(true);

        try {
            const headersObj = {};
            headers.forEach(h => {
                if (h.key && h.value) {
                    headersObj[h.key] = h.value;
                }
            });

            const res = await fetch('/api/graphql/introspect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url,
                    headers: headersObj
                })
            });

            const data = await res.json();

            if (data.success) {
                setSchema(data.sdl);
                setSchemaTypes(data.types || []);
                alert('Schema introspected successfully!');
            } else {
                alert('Failed to introspect schema: ' + (data.error || data.message));
            }
        } catch (error) {
            alert('Error: ' + error.message);
        } finally {
            setIntrospecting(false);
        }
    };

    // Analyze query complexity
    const analyzeQuery = async () => {
        if (!query) return;

        try {
            const res = await fetch('/api/graphql/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query })
            });

            const data = await res.json();
            if (data.success) {
                setComplexity(data.analysis);
            }
        } catch (error) {
            console.error('Failed to analyze query:', error);
        }
    };

    // Format query
    const formatQuery = async () => {
        if (!query) return;

        try {
            const res = await fetch('/api/graphql/format', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query })
            });

            const data = await res.json();
            if (data.success) {
                setQuery(data.formatted);
            }
        } catch (error) {
            console.error('Failed to format query:', error);
        }
    };

    // Add header
    const addHeader = () => {
        setHeaders([...headers, { key: '', value: '' }]);
    };

    // Update header
    const updateHeader = (index, field, value) => {
        const newHeaders = [...headers];
        newHeaders[index][field] = value;
        setHeaders(newHeaders);
    };

    // Remove header
    const removeHeader = (index) => {
        setHeaders(headers.filter((_, i) => i !== index));
    };

    // Copy response
    const copyResponse = () => {
        if (response) {
            navigator.clipboard.writeText(JSON.stringify(response, null, 2));
            alert('Response copied to clipboard!');
        }
    };

    // Handle lint results
    const handleLintComplete = useCallback((results) => {
        setLintResults(results);
        if (results?.score !== undefined) {
            setComplexity({
                complexity: { complexity: results.summary?.totalIssues || 0 },
                score: results.score
            });
        }
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Ctrl/Cmd + Enter to execute
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                executeQuery();
            }
            // Ctrl/Cmd + Shift + F to format
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
                e.preventDefault();
                formatQuery();
            }
            // Ctrl/Cmd + Shift + L to toggle linting
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
                e.preventDefault();
                setShowLinting(!showLinting);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url, query, variables, headers, showLinting]);

    const getComplexityColor = () => {
        if (!complexity) return '';
        const score = complexity.score;
        if (score >= 80) return 'low';
        if (score >= 50) return 'medium';
        return 'high';
    };

    // Get lint score for display in header
    const getLintScoreDisplay = useCallback(() => {
        if (!lintResults) return null;
        const score = lintResults.score;
        let colorClass = 'good';
        if (score < 60) colorClass = 'poor';
        else if (score < 80) colorClass = 'fair';
        return { score, colorClass };
    }, [lintResults]);

    // Use this in header to show lint score badge
    const lintScoreInfo = getLintScoreDisplay();

    return (
        <div className={`graphql-tester ${showLinting ? 'with-linting' : ''}`}>
            {/* Header */}
            <div className="graphql-header">
                <h2>
                    <svg className="graphql-icon" viewBox="0 0 400 400" fill="currentColor">
                        <path d="M57.468 302.66l-14.376-8.3 160.15-277.38 14.376 8.3z" />
                        <path d="M39.8 272.2h320.3v16.6H39.8z" />
                        <path d="M206.348 374.026l-160.21-92.5 8.3-14.376 160.21 92.5zM345.522 132.947l-160.21-92.5 8.3-14.376 160.21 92.5z" />
                        <path d="M54.482 132.883l-8.3-14.375 160.21-92.5 8.3 14.376z" />
                        <path d="M342.568 302.663l-160.15-277.38 14.376-8.3 160.15 277.38zM52.5 107.5h16.6v185H52.5zM330.9 107.5h16.6v185h-16.6z" />
                        <path d="M203.522 367l-7.25-12.558 139.34-80.45 7.25 12.557z" />
                        <path d="M369.5 297.9c-9.6 16.7-31 22.4-47.7 12.8-16.7-9.6-22.4-31-12.8-47.7 9.6-16.7 31-22.4 47.7-12.8 16.8 9.7 22.5 31 12.8 47.7M90.9 137c-9.6 16.7-31 22.4-47.7 12.8-16.7-9.6-22.4-31-12.8-47.7 9.6-16.7 31-22.4 47.7-12.8 16.7 9.7 22.4 31 12.8 47.7M30.5 297.9c-9.6-16.7-3.9-38 12.8-47.7 16.7-9.6 38-3.9 47.7 12.8 9.6 16.7 3.9 38-12.8 47.7-16.8 9.6-38.1 3.9-47.7-12.8M309.1 137c-9.6-16.7-3.9-38 12.8-47.7 16.7-9.6 38-3.9 47.7 12.8 9.6 16.7 3.9 38-12.8 47.7-16.7 9.6-38.1 3.9-47.7-12.8M200 395.8c-19.3 0-34.9-15.6-34.9-34.9 0-19.3 15.6-34.9 34.9-34.9 19.3 0 34.9 15.6 34.9 34.9 0 19.2-15.6 34.9-34.9 34.9M200 74c-19.3 0-34.9-15.6-34.9-34.9 0-19.3 15.6-34.9 34.9-34.9 19.3 0 34.9 15.6 34.9 34.9 0 19.3-15.6 34.9-34.9 34.9" />
                    </svg>
                    GraphQL Testing
                </h2>
                {lintScoreInfo && (
                    <span className={`lint-score-indicator ${lintScoreInfo.colorClass}`}>
                        Lint Score: {lintScoreInfo.score}/100
                    </span>
                )}
            </div>

            {/* URL Bar */}
            <div className="graphql-url-bar">
                <div className="url-input-wrapper">
                    <input
                        type="text"
                        className="url-input"
                        placeholder="Enter GraphQL endpoint URL (e.g., https://api.example.com/graphql)"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                    />
                </div>
                <button
                    className="introspect-button"
                    onClick={introspectSchema}
                    disabled={introspecting || !url}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                        <line x1="12" y1="22.08" x2="12" y2="12" />
                    </svg>
                    Introspect
                </button>
                <button
                    className={`lint-toggle-button ${showLinting ? 'active' : ''}`}
                    onClick={() => setShowLinting(!showLinting)}
                    title={showLinting ? "Hide Linting Panel" : "Show Linting Panel (Ctrl+Shift+L)"}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <path d="m9 12 2 2 4-4" />
                    </svg>
                    Linting
                    {!showLinting && lintResults && lintResults.summary?.totalIssues > 0 && (
                        <span className="lint-score-badge poor" style={{ padding: '0 4px', fontSize: '10px', marginLeft: '4px' }}>
                            {lintResults.summary.totalIssues}
                        </span>
                    )}
                </button>
                <button
                    className="execute-button"
                    onClick={executeQuery}
                    disabled={loading || !url || !query}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    Execute
                </button>
            </div>

            {/* Main Content */}
            <div className="graphql-content">
                <PanelGroup direction="horizontal" className="graphql-split-panels">
                {/* Editor Panel */}
                <Panel className="graphql-editor-panel" minSize={25} defaultSize={60}>
                    <div className="editor-tabs">
                        <button
                            className={`editor-tab ${activeTab === 'query' ? 'active' : ''}`}
                            onClick={() => setActiveTab('query')}
                        >
                            Query
                        </button>
                        <button
                            className={`editor-tab ${activeTab === 'variables' ? 'active' : ''}`}
                            onClick={() => setActiveTab('variables')}
                        >
                            Variables
                        </button>
                        <button
                            className={`editor-tab ${activeTab === 'headers' ? 'active' : ''}`}
                            onClick={() => setActiveTab('headers')}
                        >
                            Headers
                        </button>
                    </div>

                    <div className="editor-container">
                        {activeTab === 'query' && (
                            <div className="monaco-editor-wrapper">
                                <Editor
                                    height="100%"
                                    defaultLanguage="graphql"
                                    value={query}
                                    onChange={(value) => setQuery(value || '')}
                                    theme={editorTheme}
                                    beforeMount={handleEditorWillMount}
                                    options={{
                                        minimap: { enabled: false },
                                        fontSize: 14,
                                        lineHeight: 1.5,
                                        lineNumbersMinChars: 3,
                                        lineNumbers: 'on',
                                        roundedSelection: false,
                                        scrollBeyondLastLine: false,
                                        automaticLayout: true,
                                        tabSize: 2,
                                        padding: { top: 8, bottom: 8 },
                                        lineDecorationsWidth: 10
                                    }}
                                    onMount={(editor) => {
                                        editorRef.current = editor;
                                    }}
                                />
                            </div>
                        )}

                        {activeTab === 'variables' && (
                            <div className="monaco-editor-wrapper">
                                <Editor
                                    height="100%"
                                    defaultLanguage="json"
                                    value={variables}
                                    onChange={(value) => setVariables(value || '{}')}
                                    theme={editorTheme}
                                    beforeMount={handleEditorWillMount}
                                    options={{
                                        minimap: { enabled: false },
                                        fontSize: 14,
                                        lineHeight: 1.5,
                                        lineNumbersMinChars: 3,
                                        lineNumbers: 'on',
                                        scrollBeyondLastLine: false,
                                        automaticLayout: true,
                                        tabSize: 2,
                                        padding: { top: 8, bottom: 8 },
                                        lineDecorationsWidth: 10
                                    }}
                                />
                            </div>
                        )}

                        {activeTab === 'headers' && (
                            <div className="headers-editor">
                                <div className="headers-card">
                                    <div className="headers-card-head">
                                        <div className="headers-card-title">
                                            <span>Request Headers</span>
                                            <small>Sent with every GraphQL request</small>
                                        </div>
                                        <button className="add-pair-button" onClick={addHeader}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                                <line x1="12" y1="5" x2="12" y2="19" />
                                                <line x1="5" y1="12" x2="19" y2="12" />
                                            </svg>
                                            Add Header
                                        </button>
                                    </div>
                                    <div className="headers-rows">
                                    {headers.length === 0 && (
                                        <div className="headers-empty">
                                            <p>No headers added</p>
                                            <small>Click "Add Header" to include headers with your requests</small>
                                        </div>
                                    )}
                                    {headers.map((header, index) => (
                                        <div key={index} className="key-value-pair">
                                            <input
                                                type="text"
                                                className="key-value-input"
                                                placeholder="Header name"
                                                value={header.key}
                                                onChange={(e) => updateHeader(index, 'key', e.target.value)}
                                            />
                                            <input
                                                type="text"
                                                className="key-value-input"
                                                placeholder="Header value"
                                                value={header.value}
                                                onChange={(e) => updateHeader(index, 'value', e.target.value)}
                                            />
                                            <button
                                                className="icon-button"
                                                onClick={() => removeHeader(index)}
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <line x1="18" y1="6" x2="6" y2="18" />
                                                    <line x1="6" y1="6" x2="18" y2="18" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {complexity && (
                        <div className="complexity-indicator">
                            <span>Complexity: {Math.round(complexity.complexity.complexity)}</span>
                            <div className="complexity-bar">
                                <div
                                    className={`complexity-fill ${getComplexityColor()}`}
                                    style={{ width: `${complexity.score}%` }}
                                />
                            </div>
                            <span>{complexity.score}/100</span>
                        </div>
                    )}
                </Panel>

                <PanelResizeHandle className="graphql-split-handle" />

                {/* Response Panel */}
                <Panel className="graphql-response-panel" minSize={25} defaultSize={50}>
                    <div className="response-header">
                        <div className="response-status">
                            {response && (
                                <>
                                    <span className={`status-badge ${response.success ? 'success' : 'error'}`}>
                                        {response.success ? 'Success' : 'Error'}
                                    </span>
                                    {executionTime && (
                                        <span className="response-time">{executionTime}ms</span>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="response-actions">
                            <button className="icon-button" onClick={copyResponse} title="Copy">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div className="response-content">
                        {!response ? (
                            <div className="empty-response">
                                <svg className="empty-response-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                    <line x1="12" y1="18" x2="12" y2="12" />
                                    <line x1="9" y1="15" x2="15" y2="15" />
                                </svg>
                                <p>Execute a query to see results</p>
                                <small>Ctrl/Cmd + Enter to execute</small>
                            </div>
                        ) : (
                            <>
                                {response.warnings && response.warnings.length > 0 && (
                                    <div className="warning-message">
                                        {response.warnings.map((w, i) => (
                                            <div key={i}>{w.message}</div>
                                        ))}
                                    </div>
                                )}
                                {response.errors && response.errors.length > 0 && (
                                    <div className="error-message">
                                        {response.errors.map((err, i) => (
                                            <div key={i}>{err.message}</div>
                                        ))}
                                    </div>
                                )}
                                <pre className="response-json">
                                    {JSON.stringify(response, null, 2)}
                                </pre>
                            </>
                        )}
                    </div>
                </Panel>

                {showLinting && (
                    <>
                <PanelResizeHandle className="graphql-split-handle" />
                <Panel className="graphql-linting-container" minSize={18} defaultSize={26}>
                        <GraphQLLintingPanel
                            query={query}
                            onLintComplete={handleLintComplete}
                            autoLint={true}
                            debounceMs={800}
                            preset="standard"
                            onToggleCollapse={() => setShowLinting(false)}
                        />
                </Panel>
                    </>
                )}
                </PanelGroup>

                {/* Schema Panel */}
                {showSchema && schemaTypes.length > 0 && (
                    <div className="schema-panel">
                        <div className="schema-header">
                            <h3>Schema Explorer</h3>
                            <input
                                type="text"
                                className="schema-search"
                                placeholder="Search types..."
                            />
                        </div>
                        <div className="schema-content">
                            {schemaTypes.map((type, index) => (
                                <div key={index} className="schema-type">
                                    <div className="schema-type-name">{type.name}</div>
                                    <div className="schema-type-kind">{type.kind}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GraphQLTester;
