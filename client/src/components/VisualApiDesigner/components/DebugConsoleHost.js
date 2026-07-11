import React, { useEffect } from 'react';
import { VisualizationDebugger } from '../services/VisualizationDebugger';

const DebugConsoleHost = ({ method, url, headers, bodyContent, bodyType, authConfig, setCurrentDebugSession }) => {
    useEffect(() => {
        if (typeof VisualizationDebugger !== 'undefined') {
            VisualizationDebugger.initialize();
            VisualizationDebugger.hidePopupPanel();
            VisualizationDebugger.removePopupPanels();
        }
    }, []);

    const startSession = () => {
        try {
            const debugSessionId = `${method.toLowerCase()}-${encodeURIComponent(url || "no-url")}-${Date.now()}`;
            const sessionData = {
                method,
                url,
                headers: headers.filter(h => h.enabled),
                body: bodyType !== 'none' ? bodyContent : null,
                bodyType,
                authConfig,
                timestamp: Date.now()
            };

            if (typeof VisualizationDebugger !== 'undefined') {
                VisualizationDebugger.showDebugPanel();
                const session = VisualizationDebugger.startSession(
                    debugSessionId,
                    document.getElementById('visualization-debugger-container'),
                    sessionData
                );
                
                if (setCurrentDebugSession) {
                    setCurrentDebugSession(session);
                }

                VisualizationDebugger.addLog(debugSessionId, 'info', `🎯 Debug session active. Click "Send" button to see request logs.`);
                VisualizationDebugger.addLog(debugSessionId, 'info', `💻 Use the filter buttons and search box above to filter logs.`);

                if (url && url !== 'no-url' && url.startsWith('http')) {
                    setTimeout(async () => {
                        const success = await VisualizationDebugger.startBrowserConsoleCapture(url);
                        if (success) {
                            VisualizationDebugger.addLog(debugSessionId, 'success', `🌐 Now capturing real-time console logs from ${url}`);
                            VisualizationDebugger.addLog(debugSessionId, 'info', `💡 Browser console output (console.log, errors, warnings) will appear here in real-time`);
                        } else {
                            VisualizationDebugger.addLog(debugSessionId, 'warn', `⚠️ Could not start browser console capture for ${url}`);
                            VisualizationDebugger.addLog(debugSessionId, 'info', `💡 You can still see Pigeon internal logs and proxy request/response data`);
                        }
                    }, 1000);
                } else {
                    VisualizationDebugger.addLog(debugSessionId, 'info', `💡 Enter a valid HTTP/HTTPS URL to capture external website console logs`);
                }

                setTimeout(() => {
                    console.log("Test console.log - this should appear in debug console");
                    console.warn("Test console.warn - this should appear in debug console");
                    console.error("Test console.error - this should appear in debug console");
                }, 1000);
            }
        } catch (error) {
            console.error('Error starting debug session:', error);
        }
    };

    return (
        <div className="debug-console-section" id="visualization-debugger-container">
            <div className="debug-console-header">
                <div className="debug-title">
                    <div className="debug-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20 4L3 11L10 13.5L12.5 20L20 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <h4>Debug Console</h4>
                    <div className="debug-status">
                        <span className="status-indicator"></span>
                        Ready
                    </div>
                </div>
                <div className="debug-actions">
                    <button
                        type="button"
                        className="debug-btn debug-btn-primary"
                        onClick={startSession}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
                            <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Start Debugging
                    </button>
                    <button
                        type="button"
                        className="debug-btn debug-btn-ghost"
                        onClick={() => {
                            if (typeof VisualizationDebugger !== 'undefined') {
                                VisualizationDebugger.clearConsole();
                            }
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Clear Console
                    </button>
                    <button
                        type="button"
                        className="debug-btn debug-btn-ghost"
                        onClick={() => {
                            if (typeof VisualizationDebugger !== 'undefined') {
                                VisualizationDebugger.startBrowserConsoleCapture();
                                setTimeout(() => {
                                    console.log("✅ Test log message - this should appear in debug console");
                                    console.warn("⚠️ Test warning message");
                                    console.error("❌ Test error message");
                                    console.log("Demo object:", { test: "data", number: 42 });
                                }, 500);
                            }
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                        </svg>
                        Test Console Capture
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DebugConsoleHost;
