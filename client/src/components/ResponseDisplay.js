// client/src/components/ResponseDisplay.js
import React, { useState, useEffect, useMemo, useRef } from 'react';
import './ResponseDisplay.css';
import TestResultsDisplay from './TestResultsDisplay';
import PageLoader from './common/PageLoader/PageLoader';
import { FiCheckCircle, FiAlertCircle, FiClock, FiFileText } from 'react-icons/fi';

const VOID_HTML_TAGS = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)\b/i;

const formatMarkup = (markup) => {
    let indentation = 0;

    return markup
        .replace(/>\s*</g, '>\n<')
        .split('\n')
        .map((line) => {
            const tag = line.trim();
            if (/^<\//.test(tag)) indentation = Math.max(0, indentation - 1);

            const formatted = `${'  '.repeat(indentation)}${tag}`;
            const isOpeningTag = /^<[a-z][^>]*>$/i.test(tag);
            if (isOpeningTag && !VOID_HTML_TAGS.test(tag) && !/\/>$/.test(tag)) indentation += 1;

            return formatted;
        })
        .join('\n');
};

const ResponseDisplay = ({ requestId, responseData }) => {
    const [response, setResponse] = useState(responseData || null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('body');
    const [bodyView, setBodyView] = useState('pretty');
    const [htmlLoading, setHtmlLoading] = useState(false); // Add state for HTML loading
    const [contentType, setContentType] = useState(null);

    // Store previous response to detect changes
    const prevResponseRef = useRef(null);

    // If direct response data is passed, use it
    useEffect(() => {
        if (responseData) {
            setResponse(responseData);
            setLoading(false);
            setError(null);

            // Store content type
            if (responseData.headers && responseData.headers['content-type']) {
                setContentType(responseData.headers['content-type']);
            }
        }
    }, [responseData]);

    // Handle HTML content loading state
    useEffect(() => {
        // Only trigger HTML loading if we have a new HTML/XML response
        if (response &&
            response !== prevResponseRef.current &&
            contentType &&
            (contentType.includes('text/html') || contentType.includes('application/xml'))) {

            setHtmlLoading(true);

            // Use setTimeout to simulate async loading and give UI time to update
            const timer = setTimeout(() => {
                setHtmlLoading(false);
            }, 500);

            // Store current response as previous
            prevResponseRef.current = response;

            // Clear timeout on cleanup
            return () => clearTimeout(timer);
        }
    }, [response, contentType]);

    // Only fetch response data when requestId changes, a response is expected,
    // and no direct response data is provided
    useEffect(() => {
        if (requestId && !responseData && sessionStorage.getItem(`request_${requestId}_sent`) === 'true') {
            fetchResponse(requestId);
        } else if (!requestId && !responseData) {
            // Clear response if no requestId and no direct response
            setResponse(null);
        }
    }, [requestId, responseData]);

    const fetchResponse = async (id) => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/requests/${id}/response`, {
                credentials: 'include'
            });

            if (!res.ok) {
                throw new Error(`Failed to fetch response: ${res.statusText}`);
            }

            const data = await res.json();
            setResponse(data);
            // Clear the flag after successful fetch
            sessionStorage.removeItem(`request_${id}_sent`);
        } catch (err) {
            console.error('Error fetching response:', err);
            setError(err.message || 'Failed to load response data');
            // Clear the flag after error
            sessionStorage.removeItem(`request_${id}_sent`);
        } finally {
            setLoading(false);
        }
    };

    const formatBytes = (bytes, decimals = 2) => {
        if (!bytes && bytes !== 0) return '';
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        const safeIndex = Math.min(i, sizes.length - 1);
        return parseFloat((bytes / Math.pow(k, safeIndex)).toFixed(dm)) + ' ' + sizes[safeIndex];
    };

    const bodyContent = useMemo(() => {
        if (!response || response.body === undefined || response.body === null || response.body === '') {
            return { value: null, language: 'text', isMarkup: false };
        }

        const responseContentType = response.headers && response.headers['content-type'];
        const rawBody = typeof response.body === 'string'
            ? response.body
            : JSON.stringify(response.body, null, 2);

        if (responseContentType && responseContentType.includes('application/json')) {
            try {
                return {
                    value: JSON.stringify(typeof response.body === 'string' ? JSON.parse(response.body) : response.body, null, 2),
                    language: 'json',
                    isMarkup: false
                };
            } catch (error) {
                console.warn('Failed to parse JSON response body', error);
                return { value: rawBody, language: 'json', isMarkup: false };
            }
        }

        const isMarkup = Boolean(responseContentType && (responseContentType.includes('text/html') || responseContentType.includes('application/xml')));
        if (isMarkup) {
            return {
                value: bodyView === 'pretty' ? formatMarkup(rawBody) : rawBody,
                language: responseContentType.includes('text/html') ? 'html' : 'xml',
                isMarkup: true
            };
        }

        return { value: rawBody, language: 'text', isMarkup: false };
    }, [bodyView, response]);

    // Renders the response body with proper formatting and syntax highlighting
    const renderBody = () => {
        if (!bodyContent.value) {
            return <div className="rd-empty"><span className="rd-empty-text">No response body available</span></div>;
        }
        const ct = response.headers && response.headers['content-type'];

        // Show loading indicator when fetching HTML content
        if (htmlLoading && (ct && (ct.includes('text/html') || ct.includes('application/xml')))) {
            return (
                <div className="rd-panel-inner">
                    <PageLoader size="md" label="Loading HTML content..." />
                </div>
            );
        }

        return (
            <div className="rd-body">
                {bodyContent.isMarkup && (
                    <div className="rd-body-toolbar" role="group" aria-label="Response formatting">
                        <span className="rd-body-language">{bodyContent.language.toUpperCase()}</span>
                        <div className="rd-body-view-toggle">
                            <button type="button" className={bodyView === 'pretty' ? 'rd-body-view--active' : ''} onClick={() => setBodyView('pretty')}>Pretty</button>
                            <button type="button" className={bodyView === 'raw' ? 'rd-body-view--active' : ''} onClick={() => setBodyView('raw')}>Raw</button>
                        </div>
                    </div>
                )}
                <div className={`rd-code language-${bodyContent.language}`}>
                    <pre className="rd-code-pre">{bodyContent.value}</pre>
                </div>
            </div>
        );
    };

    // Renders the response headers in a clear, organized table
    const renderHeaders = () => {
        if (!response || !response.headers || Object.keys(response.headers).length === 0) {
            return <div className="rd-empty"><span className="rd-empty-text">No headers received</span></div>;
        }

        return (
            <div className="rd-headers">
                <table className="rd-headers-table">
                    <thead>
                        <tr>
                            <th>Header</th>
                            <th>Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(response.headers).map(([key, value], index) => (
                            <tr key={index}>
                                <td className="rd-headers-key">{key}</td>
                                <td className="rd-headers-val">{String(value)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    // Renders the test results tab
    const renderTestResults = () => {
        if (!response || !response.testResults ||
            (Array.isArray(response.testResults) && response.testResults.length === 0) ||
            (!Array.isArray(response.testResults) && Object.keys(response.testResults).length === 0)) {
            return <div className="rd-empty"><span className="rd-empty-text">No test results available</span></div>;
        }

        // Ensure testResults is an array
        const testResultsArray = Array.isArray(response.testResults)
            ? response.testResults
            : Object.values(response.testResults);

        return (
            <div className="rd-tests">
                <TestResultsDisplay testResults={testResultsArray} />
            </div>
        );
    };

    if (loading) {
        return (
            <div className="response-display rd-shell rd-shell--loading">
                <div className="rd-panel-inner">
                    <PageLoader size="md" label="Loading response..." />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="response-display rd-shell">
                <div className="rd-header">
                    <div className="rd-status rd-status--error">
                        <span className="rd-status-dot" />
                        <FiAlertCircle className="rd-status-icon" />
                        <span className="rd-status-text">Error</span>
                    </div>
                </div>
                <div className="rd-panel">
                    <div className="rd-error-body">{error}</div>
                </div>
            </div>
        );
    }

    if (!response) {
        return (
            <div className="response-display rd-shell">
                <div className="rd-empty rd-empty--hero">
                    <FiFileText className="rd-empty-icon" />
                    <span className="rd-empty-text">Send a request to see the response</span>
                </div>
            </div>
        );
    }

    // Get status code class (2xx, 4xx, etc)
    const statusClass = response.status ? `rd-status--${Math.floor(response.status / 100)}xx` : '';
    const isSuccess = response.status >= 200 && response.status < 300;

    const passedTests = response.testResults && Array.isArray(response.testResults)
        ? response.testResults.filter(t => t.passed).length
        : (response.testResults ? Object.values(response.testResults).filter(t => t.passed).length : null);
    const totalTests = response.testResults && Array.isArray(response.testResults)
        ? response.testResults.length
        : (response.testResults ? Object.keys(response.testResults).length : null);
    const showTestBadge = response.testResults && totalTests !== null;

    const tabs = [
        { key: 'body', label: 'Body' },
        { key: 'headers', label: 'Headers' },
        { key: 'tests', label: 'Tests', badge: showTestBadge ? `${passedTests}/${totalTests}` : null }
    ];

    return (
        <div className="response-display rd-shell">
            <div className="rd-header">
                <div className={`rd-status ${statusClass}`}>
                    <span className="rd-status-dot" />
                    {isSuccess ? (
                        <FiCheckCircle className="rd-status-icon" />
                    ) : (
                        <FiAlertCircle className="rd-status-icon" />
                    )}
                    <span className="rd-status-code">{response.status}</span>
                    <span className="rd-status-text">{response.statusText}</span>
                </div>
                <div className="rd-meta">
                    {response.duration !== undefined && (
                        <span className="rd-meta-chip">
                            <FiClock className="rd-meta-icon" />
                            {response.duration} ms
                        </span>
                    )}
                    {response.size !== undefined && (
                        <span className="rd-meta-chip">
                            <FiFileText className="rd-meta-icon" />
                            {formatBytes(response.size)}
                        </span>
                    )}
                </div>
            </div>

            <div className="rd-tabs" role="tablist">
                {tabs.map(t => (
                    <div
                        key={t.key}
                        role="tab"
                        aria-selected={activeTab === t.key}
                        tabIndex={0}
                        className={`rd-tab ${activeTab === t.key ? 'rd-tab--active' : ''}`}
                        onClick={() => setActiveTab(t.key)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTab(t.key); } }}
                    >
                        {t.label}
                        {t.badge && <span className="rd-test-badge">{t.badge}</span>}
                    </div>
                ))}
            </div>

            <div className={`rd-panel rd-panel--${activeTab}`}>
                {activeTab === 'body' && renderBody()}
                {activeTab === 'headers' && renderHeaders()}
                {activeTab === 'tests' && renderTestResults()}
            </div>
        </div>
    );
};

export default ResponseDisplay;
