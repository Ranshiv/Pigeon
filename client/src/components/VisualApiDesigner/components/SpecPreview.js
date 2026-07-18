import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import VisualizationTab from './VisualizationTab';
import ErrorBoundary from './ErrorBoundary';
import Editor from '@monaco-editor/react';
import YAML from 'yaml';
import { useTheme } from '../../../context/ThemeContext';
import { registerPigeonThemes, getPigeonMonacoTheme, pigeonEditorOptions } from '../../../themes/monacoThemes';
import '../../Protocols/tester-shell.css';
import './SpecPreviewModern.css';
import {
    FiFileText,
    FiDownload,
    FiAlertTriangle,
    FiLoader,
    FiCode,
    FiCheckCircle,
    FiBarChart2,
    FiSearch,
    FiEdit3,
    FiCopy,
    FiLayout,
    FiInfo
} from 'react-icons/fi';

const SpecPreview = ({
    nodes = [],
    edges = [],
    spec = null,
    validationErrors = [],
    onExport,
    apiResponse = null,
    visualizationContext = null
}) => {
    const [previewMode, setPreviewMode] = useState('json'); // 'json', 'yaml', 'visualization'
    const [generatedSpec, setGeneratedSpec] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState(null);
    const [isExporting, setIsExporting] = useState(false);
    const [exportingFormat, setExportingFormat] = useState(null); // 'json' | 'yaml' | null
    const [exportSuccess, setExportSuccess] = useState(null); // 'json' | 'yaml' | null
    const [showInlineIssues, setShowInlineIssues] = useState(false);
    const [copied, setCopied] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const { theme } = useTheme(); // Use theme from context instead of local state
    const [sideBySide, setSideBySide] = useState(false);
    const [localText, setLocalText] = useState('');
    const [validationList, setValidationList] = useState([]);
    const editorHeight = 820; // Fixed height instead of dynamic resizing

    const editorRef = useRef(null);
    const monacoRef = useRef(null);
    const exportBtnRef = useRef(null);

    // Register custom Monaco themes when component mounts
    useEffect(() => {
        if (monacoRef.current) {
            registerPigeonThemes(monacoRef.current);
        }
    }, []);

    // Get the appropriate Monaco theme name based on app theme
    const monacoTheme = useMemo(() => getPigeonMonacoTheme(theme), [theme]);

    // Apply theme changes when app theme changes
    useEffect(() => {
        if (monacoRef.current && editorRef.current) {
            try {
                registerPigeonThemes(monacoRef.current);
                monacoRef.current.editor.setTheme(monacoTheme);
                console.log(`Applied Monaco theme: ${monacoTheme}`);
            } catch (error) {
                console.error('Error applying Monaco theme:', error);
            }
        }
    }, [monacoTheme]);

    // Enhanced editor options with Pigeon styling
    const editorOptions = useMemo(() => ({
        ...pigeonEditorOptions,
        wordWrap: 'on',
        minimap: { enabled: false },
        lineNumbers: 'on',
        folding: true,
        scrollBeyondLastLine: false,
    }), []);

    // Tab accessibility refs
    const jsonTabRef = useRef(null);
    const yamlTabRef = useRef(null);
    const vizTabRef = useRef(null);

    // Removed automatic tab switching to respect user choice
    // Users can manually switch to visualization tab when needed

    const generateOpenAPISpec = useCallback(async (nodes, edges) => {
        const spec = {
            openapi: '3.0.0',
            info: {
                title: 'Generated API',
                version: '1.0.0',
                description: 'API specification generated from visual designer'
            },
            paths: {},
            components: {
                schemas: {},
                parameters: {},
                securitySchemes: {}
            }
        };

        // Process nodes to build spec
        nodes.forEach(node => {
            switch (node.type) {
                case 'endpoint':
                    const { path, method, summary, description, tags, deprecated } = node.data || {};
                    if (path && method) {
                        if (!spec.paths[path]) {
                            spec.paths[path] = {};
                        }
                        spec.paths[path][method.toLowerCase()] = {
                            summary: summary || '',
                            description: description || '',
                            tags: tags || [],
                            deprecated: deprecated || false,
                            responses: {
                                '200': {
                                    description: 'Successful response',
                                    content: {
                                        'application/json': {
                                            schema: { type: 'object' }
                                        }
                                    }
                                }
                            }
                        };
                    }
                    break;

                case 'schema':
                    const schemaData = node.data || {};
                    if (schemaData.name) {
                        spec.components.schemas[schemaData.name] = {
                            type: schemaData.type || 'object',
                            description: schemaData.description || '',
                            ...(schemaData.required && { required: schemaData.required }),
                            ...(schemaData.properties && { properties: schemaData.properties })
                        };
                    }
                    break;

                case 'parameter':
                    const paramData = node.data || {};
                    if (paramData.name) {
                        spec.components.parameters[paramData.name] = {
                            name: paramData.name,
                            in: paramData.in || 'query',
                            required: paramData.required || false,
                            description: paramData.description || '',
                            schema: {
                                type: paramData.type || 'string'
                            }
                        };
                    }
                    break;

                default:
                    break;
            }
        });

        return spec;
    }, []);

    // Keep generatedSpec in sync with provided spec; fall back to internal generation only if spec is not provided
    useEffect(() => {
        let cancelled = false;
        let timeoutId;

        const run = async () => {
            setError(null);

            // If spec is provided, use it directly (higher priority)
            if (spec) {
                setIsGenerating(false);
                setGeneratedSpec(spec);
                return;
            }

            // Only generate if we have nodes and no spec is provided
            if (nodes && nodes.length > 0) {
                setIsGenerating(true);

                // Add slight delay to prevent rapid successive generations
                timeoutId = setTimeout(async () => {
                    try {
                        const localSpec = await generateOpenAPISpec(nodes, edges);
                        if (!cancelled) {
                            setGeneratedSpec(localSpec);
                        }
                    } catch (err) {
                        if (!cancelled) {
                            setError(err.message);
                        }
                    } finally {
                        if (!cancelled) {
                            setIsGenerating(false);
                        }
                    }
                }, 100);
            } else {
                setGeneratedSpec(null);
                setIsGenerating(false);
            }
        };

        run();

        return () => {
            cancelled = true;
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [spec, nodes, edges, generateOpenAPISpec]);

    const formatJson = (obj) => {
        return JSON.stringify(obj, null, 2);
    };

    const formatYaml = (obj) => {
        try {
            return YAML.stringify(obj);
        } catch (error) {
            console.error('YAML formatting error:', error);
            return `# Error formatting YAML: ${error.message}\n# Falling back to JSON\n${JSON.stringify(obj, null, 2)}`;
        }
    };

    const handleExport = async (format) => {
        if (!generatedSpec) {
            console.error('No generated spec available for export');
            setError('No specification available to export');
            return;
        }

        setIsExporting(true);
        setExportingFormat(format); // Track which format is being exported
        setError(null);

        try {
            let content;
            let filename;
            let mimeType;

            switch (format) {
                case 'json':
                    content = formatJson(generatedSpec);
                    filename = 'api-spec.json';
                    mimeType = 'application/json';
                    break;
                case 'yaml':
                    content = formatYaml(generatedSpec);
                    filename = 'api-spec.yaml';
                    mimeType = 'application/x-yaml';
                    break;
                default:
                    throw new Error(`Unsupported format: ${format}`);
            }

            console.log('Exporting spec:', { format, filename, contentLength: content.length });

            // Create blob and download
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);

            // Create download link
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.style.display = 'none';

            // Add to DOM, click, and remove
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // Clean up
            URL.revokeObjectURL(url);

            console.log('Export completed successfully');

            // Show success state for the specific format
            setExportSuccess(format);

            if (onExport) {
                onExport(generatedSpec, format);
            }
        } catch (err) {
            console.error('Export failed:', err);
            setError(`Export failed: ${err.message}`);
        } finally {
            setIsExporting(false);
            setExportingFormat(null);
        }
    };

    // Debug function to check spec state
    const debugSpecState = () => {
        console.log('=== SpecPreview Debug Info ===');
        console.log('Generated spec:', generatedSpec);
        console.log('Nodes:', nodes);
        console.log('Edges:', edges);
        console.log('Is generating:', isGenerating);
        console.log('Error:', error);
        console.log('Preview mode:', previewMode);
        console.log('=============================');
    };

    // Add debug button in development
    const isDevelopment = process.env.NODE_ENV === 'development';

    // Memoize content string for current spec + mode to avoid repeated heavy stringify
    const memoizedContent = useMemo(() => {
        if (!generatedSpec) return '';
        return previewMode === 'json' ? formatJson(generatedSpec) : formatYaml(generatedSpec);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [generatedSpec, previewMode]);

    // Derived counts and states for better UI decisions
    const counts = useMemo(() => {
        const p = Object.keys(generatedSpec?.paths || {}).length;
        const s = Object.keys(generatedSpec?.components?.schemas || {}).length;
        const pr = Object.keys(generatedSpec?.components?.parameters || {}).length;
        return { paths: p, schemas: s, parameters: pr };
    }, [generatedSpec]);

    const isEmptySpec = !!generatedSpec && counts.paths === 0 && counts.schemas === 0 && counts.parameters === 0;

    // Keep local editor text in sync with mode/spec
    useEffect(() => {
        setLocalText(memoizedContent);
    }, [memoizedContent]);

    // Reset editor state when switching to preview mode to prevent conflicts
    useEffect(() => {
        // Reset editor-specific states to prevent layout issues
        setShowInlineIssues(false);
        setShowExportMenu(false);
        setCopied(false);
    }, []); // Run once on component mount

    // Live validation: syntactic plus simple structural counts
    useEffect(() => {
        if (!localText) return;
        const issues = [];
        try {
            const parsed = previewMode === 'json' ? JSON.parse(localText) : YAML.parse(localText);
            // Minimal checks
            if (!parsed.openapi) issues.push({ message: 'Missing: openapi version', level: 'error' });
            if (!parsed.info?.title) issues.push({ message: 'Missing: info.title', level: 'warning' });
            if (!parsed.paths) issues.push({ message: 'Missing: paths object', level: 'warning' });
        } catch (e) {
            issues.push({ message: `Syntax error: ${e.message}`, level: 'error' });
        }
        setValidationList(issues);
    }, [localText, previewMode]);

    // Push validation markers into Monaco
    useEffect(() => {
        const editor = editorRef.current;
        const monaco = monacoRef.current;
        if (!editor || !monaco) return;
        const model = editor.getModel?.();
        if (!model) return;
        const markers = (validationList || []).map((v) => ({
            severity: v.level === 'warning' ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Error,
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: 1,
            endColumn: 1,
            message: v.message || 'Validation issue'
        }));
        monaco.editor.setModelMarkers(model, 'spec-validation', markers);
    }, [validationList, previewMode]);

    const handleTabKeyDown = (e) => {
        const tabs = [jsonTabRef.current, yamlTabRef.current, vizTabRef.current].filter(Boolean);
        const idx = tabs.findIndex((el) => el === document.activeElement);
        if (idx === -1) return;
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            const next = tabs[(idx + 1) % tabs.length];
            next?.focus();
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
            prev?.focus();
        } else if (e.key === 'Home') {
            e.preventDefault();
            tabs[0]?.focus();
        } else if (e.key === 'End') {
            e.preventDefault();
            tabs[tabs.length - 1]?.focus();
        }
    };

    const renderPreview = () => {
        if (isGenerating) {
            return (
                <div className="preview-loading">
                    <div className="spinner-container">
                        <FiLoader className="spinner" aria-hidden="true" />
                    </div>
                    <p>Generating specification...</p>
                    <span className="loading-subtitle">Analyzing API structure</span>
                </div>
            );
        }

        if (error) {
            return (
                <div className="preview-error">
                    <div className="error-icon-large">
                        <FiAlertTriangle aria-hidden="true" />
                    </div>
                    <h4>Generation Error</h4>
                    <p>{error}</p>
                    <button
                        className="retry-button"
                        onClick={() => {
                            setIsGenerating(true);
                            setError(null);
                            setTimeout(() => {
                                const generateSpecAsync = async () => {
                                    try {
                                        const spec = await generateOpenAPISpec(nodes, edges);
                                        setGeneratedSpec(spec);
                                    } catch (err) {
                                        setError(err.message);
                                        setGeneratedSpec(null);
                                    } finally {
                                        setIsGenerating(false);
                                    }
                                };
                                generateSpecAsync();
                            }, 500);
                        }}
                    >
                        Try Again
                    </button>
                </div>
            );
        }

        if (!generatedSpec) {
            return (
                <div className="preview-empty">
                    <div className="empty-icon">
                        <FiCode aria-hidden="true" />
                    </div>
                    <p className="empty-title">No API Specification Available</p>
                    <p className="empty-description">
                        Add endpoints, schemas, or parameters to the canvas to generate a specification
                    </p>
                </div>
            );
        }

        if (previewMode === 'visualization') {
            return (
                <ErrorBoundary
                    fallbackMessage="Failed to load visualization. This might be due to invalid response data format."
                    onRetry={() => setPreviewMode('json')}
                >
                    <VisualizationTab
                        apiResponse={visualizationContext?.responseData || apiResponse}
                        nodes={nodes}
                        visualizationContext={visualizationContext}
                        onVisualizationUpdate={(viz) => {
                            console.log('Visualization created:', viz);
                            // Could emit events here for parent components
                        }}
                    />
                </ErrorBoundary>
            );
        }

        const content = localText || memoizedContent;

        return (
            <div className={`editor-wrapper ${sideBySide ? 'split' : ''}`}>
                {sideBySide ? (
                    <>
                        <div className="editor-pane" style={{ height: editorHeight }}>
                            <Editor
                                height={editorHeight}
                                defaultLanguage="json"
                                language={previewMode === 'yaml' ? 'yaml' : 'json'}
                                theme={monacoTheme}
                                value={content}
                                onChange={(val) => setLocalText(val ?? '')}
                                onMount={(editor, monaco) => {
                                    editorRef.current = editor;
                                    monacoRef.current = monaco;
                                    // Register themes when Monaco is available
                                    registerPigeonThemes(monaco);
                                    // Apply the theme after registration
                                    setTimeout(() => {
                                        monaco.editor.setTheme(monacoTheme);
                                    }, 100);
                                }}
                                options={editorOptions}
                            />
                        </div>
                        <div className="editor-pane" style={{ height: editorHeight }}>
                            <Editor
                                height={editorHeight}
                                language={previewMode === 'yaml' ? 'json' : 'yaml'}
                                theme={monacoTheme}
                                value={(() => {
                                    try {
                                        const parsed = previewMode === 'json' ? JSON.parse(content) : YAML.parse(content);
                                        return previewMode === 'json' ? YAML.stringify(parsed) : JSON.stringify(parsed, null, 2);
                                    } catch {
                                        return '';
                                    }
                                })()}
                                options={{
                                    ...editorOptions,
                                    readOnly: true
                                }}
                            />
                        </div>
                    </>
                ) : (
                    <Editor
                        height={editorHeight}
                        language={previewMode === 'yaml' ? 'yaml' : 'json'}
                        theme={monacoTheme}
                        value={content}
                        onChange={(val) => setLocalText(val ?? '')}
                        onMount={(editor, monaco) => {
                            editorRef.current = editor;
                            monacoRef.current = monaco;
                            // Register themes when Monaco is available
                            registerPigeonThemes(monaco);
                            // Apply the theme after registration
                            setTimeout(() => {
                                monaco.editor.setTheme(monacoTheme);
                            }, 100);
                        }}
                        options={editorOptions}
                    />
                )}

                <div className="floating-toolbar">
                    {/* Keep only editor utilities here to avoid duplicating header controls */}
                    <button
                        className="toolbar-btn icon-btn"
                        onClick={() => editorRef.current?.trigger('keyboard', 'actions.find')}
                        aria-label="Search"
                    >
                        <FiSearch className="btn-icon" aria-hidden="true" />
                    </button>
                    <button
                        className="toolbar-btn icon-btn"
                        onClick={() => editorRef.current?.trigger('keyboard', 'editor.action.startFindReplaceAction')}
                        aria-label="Replace"
                    >
                        <FiEdit3 className="btn-icon" aria-hidden="true" />
                    </button>
                    <button
                        className="toolbar-btn icon-btn"
                        onClick={async () => {
                            try {
                                await navigator.clipboard.writeText(content);
                                setCopied(true);
                                setTimeout(() => setCopied(false), 2000);
                            } catch (err) {
                                console.error('Copy failed:', err);
                                setError('Copy to clipboard failed');
                            }
                        }}
                        aria-label="Copy"
                    >
                        {copied ? <FiCheckCircle className="btn-icon" aria-hidden="true" /> : <FiCopy className="btn-icon" aria-hidden="true" />}
                    </button>
                </div>
            </div>
        );
    };

    // Handle export success feedback
    useEffect(() => {
        if (exportSuccess) {
            const timer = setTimeout(() => {
                setExportSuccess(null);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [exportSuccess]);

    // Close export menu on outside click or Escape
    useEffect(() => {
        if (!showExportMenu) return;

        let timeoutId;

        const onDocClick = (e) => {
            // Use timeout to prevent conflicts with other click handlers
            timeoutId = setTimeout(() => {
                if (!exportBtnRef.current?.contains(e.target) &&
                    !e.target.closest('.export-menu')) {
                    setShowExportMenu(false);
                }
            }, 0);
        };

        const onKey = (e) => {
            if (e.key === 'Escape') {
                setShowExportMenu(false);
            }
        };

        document.addEventListener('mousedown', onDocClick);
        document.addEventListener('keydown', onKey);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('mousedown', onDocClick);
            document.removeEventListener('keydown', onKey);
        };
    }, [showExportMenu]);

    // Modified export handler with success feedback
    const handleExportWithFeedback = async (format) => {
        await handleExport(format);
    };

    return (
        <div className={`spec-preview modern ${theme === 'vs-dark' ? 'dark' : 'light'}`}>
            <div className="preview-header glass-effect">
                <h3>
                    <FiCode className="header-icon" aria-hidden="true" />
                    Specification Preview
                </h3>

                <div className="preview-controls">
                    <div
                        className="format-toggle"
                        role="tablist"
                        aria-label="Format options"
                        onKeyDown={handleTabKeyDown}
                    >
                        <button
                            className={`format-btn ${previewMode === 'json' ? 'active' : ''}`}
                            id="tab-json"
                            ref={jsonTabRef}
                            onClick={() => {
                                setPreviewMode('json');
                            }}
                            role="tab"
                            aria-selected={previewMode === 'json'}
                            aria-controls="tabpanel-preview"
                            tabIndex={previewMode === 'json' ? 0 : -1}
                            title="View specification in JSON format"
                            aria-label="JSON format"
                        >
                            <FiFileText className="btn-icon" aria-hidden="true" />
                            <span>JSON</span>
                        </button>
                        <button
                            className={`format-btn ${previewMode === 'yaml' ? 'active' : ''}`}
                            id="tab-yaml"
                            ref={yamlTabRef}
                            onClick={() => {
                                setPreviewMode('yaml');
                            }}
                            role="tab"
                            aria-selected={previewMode === 'yaml'}
                            aria-controls="tabpanel-preview"
                            tabIndex={previewMode === 'yaml' ? 0 : -1}
                            title="View specification in YAML format"
                            aria-label="YAML format"
                        >
                            <FiCode className="btn-icon" aria-hidden="true" />
                            <span>YAML</span>
                        </button>
                        <button
                            className={`format-btn ${previewMode === 'visualization' ? 'active' : ''}`}
                            id="tab-visualization"
                            ref={vizTabRef}
                            onClick={() => {
                                setPreviewMode('visualization');
                            }}
                            role="tab"
                            aria-selected={previewMode === 'visualization'}
                            aria-controls="tabpanel-preview"
                            tabIndex={previewMode === 'visualization' ? 0 : -1}
                            title="View interactive data visualizations"
                            aria-label="Visualizations view"
                        >
                            <FiBarChart2 className="btn-icon" aria-hidden="true" />
                            <span>Visualizations</span>
                        </button>
                    </div>

                    <div
                        className="export-buttons"
                        role="group"
                        aria-label="Export options"
                    >
                        {(() => {
                            const combinedIssues = [
                                ...(validationErrors || []).map(v => ({ message: typeof v === 'string' ? v : v.message, level: 'error' })),
                                ...validationList
                            ];
                            const issueCount = combinedIssues.length;
                            const stateClass = issueCount ? 'error' : isEmptySpec ? 'neutral' : 'success';
                            const label = issueCount ? `${issueCount} Issues` : isEmptySpec ? 'Valid (Empty)' : 'Valid';
                            const title = issueCount ? `${issueCount} validation issue${issueCount === 1 ? '' : 's'}` : isEmptySpec ? 'Syntactically valid, but empty spec' : 'No issues';
                            return (
                                <button
                                    className={`debug-btn icon-btn ${stateClass}`}
                                    onClick={() => setShowInlineIssues(!showInlineIssues)}
                                    title={title}
                                    aria-label={`Toggle validation issues: ${label}`}
                                >
                                    {issueCount ? (
                                        <>
                                            <FiAlertTriangle className="btn-icon" aria-hidden="true" />
                                            <span className="badge" aria-hidden="true">{issueCount}</span>
                                        </>
                                    ) : (
                                        <FiCheckCircle className="btn-icon" aria-hidden="true" />
                                    )}
                                </button>
                            );
                        })()}
                        <button
                            className="debug-btn icon-btn"
                            onClick={() => setSideBySide((s) => !s)}
                            title="Toggle editor split view"
                            aria-label="Toggle editor split view"
                        >
                            <FiLayout className="btn-icon" aria-hidden="true" />
                        </button>
                        {isDevelopment && (
                            <button
                                className="debug-btn icon-btn"
                                onClick={debugSpecState}
                                title="Debug specification state"
                                aria-label="Debug specification"
                            >
                                <FiCode className="btn-icon" aria-hidden="true" />
                            </button>
                        )}
                        <div className="export-wrapper">
                            <button
                                ref={exportBtnRef}
                                className={`export-btn icon-btn ${exportSuccess ? 'success' : ''}`}
                                onClick={() => setShowExportMenu((s) => !s)}
                                disabled={isExporting || !generatedSpec}
                                title="Export specification"
                                aria-label="Export specification"
                                aria-expanded={showExportMenu}
                                aria-haspopup="menu"
                            >
                                {isExporting ? (
                                    <FiLoader className="btn-icon spinning" aria-hidden="true" />
                                ) : exportSuccess ? (
                                    <FiCheckCircle className="btn-icon" aria-hidden="true" />
                                ) : (
                                    <FiDownload className="btn-icon" aria-hidden="true" />
                                )}
                            </button>
                            {showExportMenu && (
                                <div className="export-menu" role="menu">
                                    <button
                                        className="menu-item"
                                        role="menuitem"
                                        onClick={async () => { setShowExportMenu(false); await handleExportWithFeedback('json'); }}
                                        disabled={isExporting}
                                        aria-label="Export as JSON"
                                        title="Export as JSON"
                                    >
                                        <FiFileText className="btn-icon" aria-hidden="true" />
                                        <span>JSON</span>
                                        {isExporting && exportingFormat === 'json' && (
                                            <FiLoader className="btn-icon spinning" aria-hidden="true" />
                                        )}
                                    </button>
                                    <button
                                        className="menu-item"
                                        role="menuitem"
                                        onClick={async () => { setShowExportMenu(false); await handleExportWithFeedback('yaml'); }}
                                        disabled={isExporting}
                                        aria-label="Export as YAML"
                                        title="Export as YAML"
                                    >
                                        <FiCode className="btn-icon" aria-hidden="true" />
                                        <span>YAML</span>
                                        {isExporting && exportingFormat === 'yaml' && (
                                            <FiLoader className="btn-icon spinning" aria-hidden="true" />
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="preview-container">
                {isEmptySpec && (
                    <div className="preview-info-banner" role="status" aria-live="polite">
                        <FiInfo className="info-icon" aria-hidden="true" />
                        <span className="info-message">Specification is syntactically valid but empty. Add endpoints, schemas, or parameters to build your API.</span>
                    </div>
                )}

                {error && (
                    <div className="preview-error-banner">
                        <div className="error-icon">
                            <FiAlertTriangle aria-hidden="true" />
                        </div>
                        <span className="error-message">{error}</span>
                        <button
                            className="error-dismiss"
                            onClick={() => setError(null)}
                            title="Dismiss error"
                            aria-label="Dismiss error"
                        >
                            <span aria-hidden="true">Ã—</span>
                        </button>
                    </div>
                )}

                <div
                    className="preview-content"
                    id="tabpanel-preview"
                    role="tabpanel"
                    aria-live="polite"
                    aria-labelledby={
                        previewMode === 'json' ? 'tab-json' : previewMode === 'yaml' ? 'tab-yaml' : 'tab-visualization'
                    }
                    aria-label={`Specification preview in ${previewMode} format`}
                >
                    {renderPreview()}
                </div>

                {generatedSpec && (
                    <div className="preview-stats glass-effect">
                        <div className={`stat-card clickable ${Object.keys(generatedSpec.paths || {}).length ? 'ok' : 'neutral'}`} onClick={() => setPreviewMode('json')} title="Show paths in JSON">
                            <div className="stat-icon">
                                <FiCode aria-hidden="true" />
                            </div>
                            <div className="stat-content">
                                <span className="stat-label">Paths</span>
                                <span className="stat-value">{Object.keys(generatedSpec.paths || {}).length}</span>
                            </div>
                        </div>
                        <div className={`stat-card clickable ${Object.keys(generatedSpec.components?.schemas || {}).length ? 'ok' : 'neutral'}`} onClick={() => setPreviewMode('json')} title="Show schemas in JSON">
                            <div className="stat-icon">
                                <FiFileText aria-hidden="true" />
                            </div>
                            <div className="stat-content">
                                <span className="stat-label">Schemas</span>
                                <span className="stat-value">{Object.keys(generatedSpec.components?.schemas || {}).length}</span>
                            </div>
                        </div>
                        <div className={`stat-card clickable ${Object.keys(generatedSpec.components?.parameters || {}).length ? 'ok' : 'neutral'}`} onClick={() => setPreviewMode('json')} title="Show parameters in JSON">
                            <div className="stat-icon">
                                <FiBarChart2 aria-hidden="true" />
                            </div>
                            <div className="stat-content">
                                <span className="stat-label">Parameters</span>
                                <span className="stat-value">{Object.keys(generatedSpec.components?.parameters || {}).length}</span>
                            </div>
                        </div>
                    </div>
                )}

                {(showInlineIssues && (validationErrors?.length > 0 || validationList.length > 0)) && (
                    <div className="preview-error-banner">
                        <div className="issue-list">
                            {[...(validationErrors || []).map(v => ({ message: typeof v === 'string' ? v : v.message, level: 'error' })), ...validationList]
                                .map((iss, i) => (
                                    <div key={i} className={`issue-row ${iss.level || 'error'}`}>
                                        {iss.message}
                                    </div>
                                ))}
                        </div>
                    </div>
                )}

                {isDevelopment && (
                    <div className="debug-info">
                        <h4>Debug Info</h4>
                        <button
                            className="debug-btn-text"
                            onClick={debugSpecState}
                            title="Debug spec state"
                            aria-label="Debug specification state"
                        >
                            <FiCode className="btn-icon" aria-hidden="true" />
                            <span>Debug Spec State</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// Apply Monaco markers based on validation state
// This hook must be below component definition to access hooks; move inside component if errors occur

export default SpecPreview;
