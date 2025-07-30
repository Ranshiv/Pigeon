/**
 * Visualization Debugging Service
 * Provides advanced debugging capabilities for visualizations
 * Similar to browser developer tools but for visualizations
 */
export class VisualizationDebugger {
    static debugSessions = new Map();
    static isEnabled = false;
    static debugPanel = null;
    static currentSessionId = null;
    static isInitialized = false;

    // DOM operation management to prevent freezing
    static _isUpdatingDOM = false;
    static _pendingLogs = [];

    // Console interception
    static _originalConsole = {};
    static _consoleInterceptionActive = false;

    // Browser console capture for external websites
    static _browserCaptureSession = null;
    static _browserCapturePolling = null;

    // Log filtering
    static _currentFilter = 'all';
    static _filterCallbacks = new Set();

    /**
     * Initialize the debugging system
     */
    static initialize() {
        this.isEnabled = true;

        if (!this.isInitialized) {
            this.setupKeyboardShortcuts();
            this.setupConsoleInterception();
            this.isInitialized = true;
        }

        const requestFormDebugContainer = document.getElementById('visualization-debugger-container');
        if (requestFormDebugContainer) {
            this.hidePopupPanel();
            return;
        }

        if (!this.debugPanel) {
            this.createDebugPanel();
        }
    }

    /**
     * Setup console interception to capture browser console events
     */
    static setupConsoleInterception() {
        if (this._consoleInterceptionActive) {
            return; // Already setup
        }

        // Store original console methods
        this._originalConsole = {
            log: console.log.bind(console),
            error: console.error.bind(console),
            warn: console.warn.bind(console),
            info: console.info.bind(console),
            debug: console.debug.bind(console)
        };

        // Override console methods to intercept and capture logs
        const self = this;

        console.log = function (...args) {
            self._originalConsole.log(...args);
            self._captureConsoleEvent('info', args);
        };

        console.error = function (...args) {
            self._originalConsole.error(...args);
            self._captureConsoleEvent('error', args);
        };

        console.warn = function (...args) {
            self._originalConsole.warn(...args);
            self._captureConsoleEvent('warn', args);
        };

        console.info = function (...args) {
            self._originalConsole.info(...args);
            self._captureConsoleEvent('info', args);
        };

        console.debug = function (...args) {
            self._originalConsole.debug(...args);
            self._captureConsoleEvent('debug', args);
        };

        this._consoleInterceptionActive = true;

        // Log that interception is active
        this.log('🔍 Browser console interception activated', 'success');
    }

    /**
     * Capture console events and display them in debug console
     */
    static _captureConsoleEvent(type, args) {
        if (!this.currentSessionId || !this.debugSessions.has(this.currentSessionId)) {
            return; // No active debug session
        }

        // Skip capturing our own debug logs to avoid infinite loops and clutter
        if (args.length > 0 && typeof args[0] === 'string') {
            const message = args[0];
            if (message.includes('[VisualizationDebugger]') ||
                message.includes('🎯 Setting up console input') ||
                message.includes('📝 Executing command:')) {
                return; // Skip our own debug messages
            }
        }

        // Format the console arguments
        let message = '';
        let data = null;

        if (args.length === 1) {
            if (typeof args[0] === 'string') {
                message = args[0];
            } else {
                message = 'Console Output';
                data = args[0];
            }
        } else if (args.length > 1) {
            message = args[0] || 'Console Output';
            data = args.slice(1);
        }

        // Add icon based on type
        const typeIcon = type === 'error' ? '🔴' : type === 'warn' ? '🟡' : type === 'debug' ? '🔧' : '🔵';

        // Log the captured console event
        this.log(`${typeIcon} Browser Console: ${message}`, type, data);
    }

    /**
     * Restore original console methods
     */
    static restoreConsole() {
        if (!this._consoleInterceptionActive) {
            return;
        }

        console.log = this._originalConsole.log;
        console.error = this._originalConsole.error;
        console.warn = this._originalConsole.warn;
        console.info = this._originalConsole.info;
        console.debug = this._originalConsole.debug;

        this._consoleInterceptionActive = false;

        // Use original console.log to avoid infinite loop
        this._originalConsole.log('🔍 Browser console interception deactivated');
    }

    /**
     * Setup keyboard shortcuts for debug panel
     */
    static setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only use Ctrl+Shift+D for our debug panel to avoid conflicts with browser dev tools
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                e.preventDefault();

                const requestFormDebugContainer = document.getElementById('visualization-debugger-container');
                if (requestFormDebugContainer) {
                    requestFormDebugContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    return;
                }

                this.toggleDebugPanel();
            }
        });
    }

    /**
     * Create debug panel UI
     */
    static createDebugPanel() {
        const panel = document.createElement('div');
        panel.id = 'viz-debug-panel';
        panel.className = 'viz-debug-panel hidden';
        panel.innerHTML = '<div>Debug Panel - Simplified Version</div>';

        document.body.appendChild(panel);
        this.debugPanel = panel;
    }

    /**
     * Toggle debug panel visibility
     */
    static toggleDebugPanel() {
        const requestFormDebugContainer = document.getElementById('visualization-debugger-container');
        if (requestFormDebugContainer) {
            return;
        }

        if (!this.debugPanel) return;

        const isHidden = this.debugPanel.classList.contains('hidden');

        if (isHidden) {
            this.debugPanel.style.pointerEvents = 'auto';
            this.debugPanel.style.visibility = 'visible';
            this.debugPanel.classList.remove('hidden');
        } else {
            this.debugPanel.classList.add('hidden');
            this.debugPanel.style.pointerEvents = 'none';
        }
    }

    /**
     * Show debug panel
     */
    static showDebugPanel() {
        const requestFormDebugContainer = document.getElementById('visualization-debugger-container');
        if (requestFormDebugContainer) {
            this.removePopupPanels();

            const debugContent = requestFormDebugContainer.querySelector('.debug-content');
            if (debugContent) {
                const placeholder = debugContent.querySelector('.modern-debug-placeholder');
                if (placeholder) {
                    // Add modern debug console styles
                    this.addModernDebugStyles();

                    placeholder.innerHTML = `
                        <div class="debug-console-container">
                            <div id="console-output" class="console-logs-container">
                                <div class="console-welcome-message">
                                    <div class="welcome-icon">🚀</div>
                                    <div class="welcome-content">
                                        <div class="welcome-title">Debug Console Initialized</div>
                                        <div class="welcome-subtitle">Start debugging to see request/response logs, network activity, and system events</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }
            }

            return;
        }

        if (!this.debugPanel) {
            this.createDebugPanel();
        }

        this.debugPanel.style.pointerEvents = 'auto';
        this.debugPanel.style.visibility = 'visible';
        this.debugPanel.classList.remove('hidden');
    }

    /**
     * Hide any existing popup debug panel
     */
    static hidePopupPanel() {
        if (this.debugPanel) {
            this.debugPanel.classList.add('hidden');
            this.debugPanel.style.pointerEvents = 'none';
        }
    }

    /**
     * Completely remove popup panels from DOM
     */
    static removePopupPanels() {
        const existingPanels = document.querySelectorAll('#viz-debug-panel');
        existingPanels.forEach((panel) => {
            panel.remove();
        });

        this.debugPanel = null;
    }

    /**
     * Add modern debug console styles
     */
    static addModernDebugStyles() {
        // Remove any existing styles first to ensure fresh CSS
        const existingStyles = document.querySelectorAll('style[data-debug-modern-styles]');
        existingStyles.forEach(style => style.remove());

        const style = document.createElement('style');
        style.setAttribute('data-debug-modern-styles', 'true');
        style.textContent = `
            /* Modern Debug Console Styles - Clean & Minimal Design */
            .debug-console-container {
                flex: 1;
                display: flex;
                flex-direction: column;
                justify-content: flex-start;
                align-items: stretch;
                overflow: hidden;
                max-height: 400px; /* Ensure container has defined height for scrolling */
                font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Source Code Pro', monospace;
                line-height: 1.6;
                position: relative;
                color: #e6e6e6;
                margin-top: 0px; /* Remove margin to prevent content cutoff */
                height: 100%;
                min-height: 300px;
            }

            /* Console logs container - this holds all the log entries */
            .console-logs-container {
                flex: 1;
                padding: 8px 0 0 0; /* Add top padding and bottom padding for console input */
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                justify-content: flex-start;
                align-items: stretch;
                height: 100%;
                min-height: 0;
            }

            /* Enhanced Scrollbar Design */
            .console-logs-container::-webkit-scrollbar {
                width: 6px;
            }

            .console-logs-container::-webkit-scrollbar-track {
                background: transparent;
                border-radius: 3px;
            }

            .console-logs-container::-webkit-scrollbar-thumb {
                background: #3a4248;
                border-radius: 3px;
                transition: background-color 0.2s ease;
            }

            .console-logs-container::-webkit-scrollbar-thumb:hover {
                background: #4a5258;
            }

            /* Welcome Message - Refined Design */
            .console-welcome-message {
                display: flex;
                align-items: center;
                gap: 16px;
                padding: 16px 24px; /* Reduced top/bottom padding */
                margin: 8px 16px 16px 16px; /* Reduced top margin */
                background: #161b22;
                border: 1px solid #21262d;
                border-radius: 8px;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            }

            .welcome-icon {
                font-size: 20px;
                line-height: 1;
                opacity: 0.9;
                color: #58a6ff;
            }

            .welcome-content {
                flex: 1;
            }

            .welcome-title {
                color: #f0f6fc;
                font-weight: 600;
                font-size: 15px;
                margin-bottom: 6px;
                letter-spacing: -0.01em;
            }

            .welcome-subtitle {
                color: #8b949e;
                font-size: 13px;
                line-height: 1.5;
                font-weight: 400;
            }

            /* Log Entry - Clean Modern Design */
            .log-entry {
                padding: 12px 16px;
                margin-bottom: 1px;
                border-radius: 4px;
                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                position: relative;
                border-left: 3px solid transparent;
                background: transparent;
                opacity: 1;
                display: block;
                transform: translateY(0);
            }

            .log-entry:hover {
                background: #161b22;
                border-left-color: #30363d;
            }

            .log-entry-content {
                display: flex;
                align-items: flex-start;
                gap: 12px;
            }

            /* Improved Timestamp */
            .log-timestamp {
                color: #6e7681;
                font-size: 11px;
                min-width: 65px;
                font-weight: 500;
                letter-spacing: 0.01em;
                opacity: 0.8;
            }

            /* Log Icons - Better Sizing */
            .log-icon {
                min-width: 18px;
                font-size: 13px;
                line-height: 1.2;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            /* Log Message - Better Typography */
            .log-message {
                flex: 1;
                color: #e6e6e6;
                font-size: 13px;
                line-height: 1.5;
                font-weight: 400;
            }

            /* Log Data - Refined Design */
            .log-data {
                margin-top: 8px;
                padding: 12px;
                background: #0d1117;
                border: 1px solid #21262d;
                border-radius: 4px;
                font-size: 12px;
                color: #8b949e;
                white-space: pre-wrap;
                font-family: inherit;
                box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
            }

            /* Log Type Styles - Modern Color Palette */
            .log-info .log-icon { 
                color: #58a6ff; 
            }
            .log-success .log-icon { 
                color: #3fb950; 
            }
            .log-warn .log-icon { 
                color: #d29922; 
            }
            .log-error .log-icon { 
                color: #f85149; 
            }
            .log-debug .log-icon { 
                color: #a5a5f5; 
            }

            /* Clean Border Indicators */
            .log-info { 
                border-left-color: #1f6feb;
            }
            .log-success { 
                border-left-color: #238636;
            }
            .log-warn { 
                border-left-color: #bf8700;
            }
            .log-error { 
                border-left-color: #da3633;
            }
            .log-debug { 
                border-left-color: #6f42c1;
            }

            .log-info:hover { 
                background: rgba(31, 111, 235, 0.05);
                border-left-color: #58a6ff;
            }
            .log-success:hover { 
                background: rgba(35, 134, 54, 0.05);
                border-left-color: #3fb950;
            }
            .log-warn:hover { 
                background: rgba(191, 135, 0, 0.05);
                border-left-color: #d29922;
            }
            .log-error:hover { 
                background: rgba(218, 54, 51, 0.05);
                border-left-color: #f85149;
            }
            .log-debug:hover { 
                background: rgba(111, 66, 193, 0.05);
                border-left-color: #a5a5f5;
            }

            /* Smooth Entry Animation */
            @keyframes slideInFade {
                from {
                    opacity: 0;
                    transform: translateY(-2px) scale(0.98);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }

            .log-entry-new {
                animation: slideInFade 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            }

            /* Enhanced Focus States for Accessibility */
            .debug-console-container:focus-within {
                border-color: #1f6feb;
                box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15), 0 0 0 3px rgba(31, 111, 235, 0.1);
            }

            /* Responsive Design Improvements */
            @media (max-width: 768px) {
                .debug-console-container {
                    height: 280px;
                }
                
                .console-welcome-message {
                    padding: 16px;
                    gap: 12px;
                    margin: 12px;
                }
                
                .log-entry {
                    padding: 10px 12px;
                }
                
                .log-entry-content {
                    gap: 8px;
                }
                
                .log-timestamp {
                    min-width: 55px;
                    font-size: 10px;
                }
            }

            /* Console Input Container - Clean Design */
            .console-input-container {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                background: #0d1117;
                border-top: 1px solid #21262d;
                padding: 12px 16px;
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .console-input-container::before {
                content: '❯';
                color: #58a6ff;
                font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
                font-size: 14px;
                font-weight: 600;
                line-height: 1;
                flex-shrink: 0;
            }

            .console-input-container input {
                flex: 1;
                background: transparent;
                border: none;
                color: #f0f6fc;
                font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
                font-size: 13px;
                padding: 0;
                outline: none;
                line-height: 1.4;
            }

            .console-input-container input::placeholder {
                color: #6e7681;
                font-style: italic;
            }

            .console-input-container input:focus::placeholder {
                color: #484f58;
            }

            /* Print Styles */
            @media print {
                .debug-console-container {
                    background: white !important;
                    color: black !important;
                    border: 1px solid #ccc !important;
                    box-shadow: none !important;
                }
                
                .log-entry {
                    background: white !important;
                    border-left: 2px solid #666 !important;
                }
                
                .log-message, .log-data {
                    color: black !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Start debugging session for a visualization
     */
    static startSession(visualizationId, element, data) {
        if (this.debugSessions.has(visualizationId)) {
            this.debugSessions.delete(visualizationId);
        }

        const session = {
            id: visualizationId,
            element: element,
            data: data,
            url: data?.url || 'unknown',
            method: data?.method || 'GET',
            startTime: Date.now(),
            logs: [],
            performance: {
                renderTime: 0,
                memoryUsage: 0,
                domNodes: 0,
                requestTime: 0,
                responseSize: 0,
                networkTime: 0,
                statusCode: null
            },
            errors: [],
            warnings: [],
            networkRequests: [],
            responseData: null
        };

        this.debugSessions.set(visualizationId, session);
        this.currentSessionId = visualizationId;

        // Clean up old sessions to prevent memory leaks
        if (this.debugSessions.size > 3) {
            const sessions = Array.from(this.debugSessions.entries());
            const oldestSessionId = sessions[0][0];
            this.debugSessions.delete(oldestSessionId);
        }

        if (!this.debugPanel) {
            this.createDebugPanel();
        }

        // Show the debug panel and ensure console output area exists
        this.showDebugPanel();

        // Ensure console interception is active for this session
        if (!this._consoleInterceptionActive) {
            this.setupConsoleInterception();
        }

        // Log session start with less verbose static data
        this.log(`🔍 Debug session started | Session ID: ${visualizationId}`, 'info');
        this.log(`⏰ Ready at: ${new Date().toLocaleTimeString()}`, 'info');
        this.log(`📊 Browser console capture is active - console.log/error/warn events will appear here`, 'success');
        this.log(`🌐 Click "Send" to make requests and see logs`, 'info');

        // Add some sample logs of different types for testing filters
        this.log(`✅ Debug console initialized successfully`, 'success');
        this.log(`⚠️ This is a sample warning message`, 'warn');
        this.log(`❌ This is a sample error message`, 'error');
        this.log(`🔧 This is a sample debug message`, 'debug');

        return session;
    }

    /**
     * Log debug message for specific session
     */
    static log(message, type = 'info', data = null, sessionId = null) {
        const timestamp = new Date().toISOString();

        let processedData = data;
        if (data && typeof data === 'object') {
            try {
                processedData = JSON.parse(JSON.stringify(data));
            } catch (e) {
                processedData = String(data);
            }
        }

        const logEntry = {
            timestamp,
            message,
            type,
            data: processedData,
            sessionId: sessionId || this.currentSessionId,
            stack: new Error().stack
        };

        const targetSessionId = sessionId || this.currentSessionId;
        const session = this.debugSessions.get(targetSessionId);

        if (session) {
            session.logs.push(logEntry);
        }

        // Always display logs for active debugging sessions
        if (targetSessionId && this.debugSessions.has(targetSessionId)) {
            this.displayLogInPanel(logEntry);
        }

        // Also log important messages to browser console
        if (type === 'error' || type === 'warn') {
            console.log(`[VizDebug:${type}] ${message}`, data);
        }
    }

    /**
     * Display log entry in debug panel
     */
    static displayLogInPanel(logEntry) {
        if (this._isUpdatingDOM) {
            this._pendingLogs.push(logEntry);
            return;
        }

        this._isUpdatingDOM = true;

        try {
            let consoleOutput = document.getElementById('console-output');

            if (!consoleOutput) {
                // Try to create the console output area if it doesn't exist
                const debugContainer = document.getElementById('visualization-debugger-container');
                if (debugContainer) {
                    const debugContent = debugContainer.querySelector('.debug-content');
                    if (debugContent) {
                        const placeholder = debugContent.querySelector('.modern-debug-placeholder');
                        if (placeholder) {
                            // Add modern debug console styles
                            this.addModernDebugStyles();

                            placeholder.innerHTML = `
                                <div class="debug-console-container" id="console-output"></div>
                            `;
                            consoleOutput = document.getElementById('console-output');
                        }
                    }
                }
            }

            if (!consoleOutput) {
                return;
            }

            const logElement = document.createElement('div');
            logElement.className = `log-entry log-${logEntry.type}`;

            const timeStr = new Date(logEntry.timestamp).toLocaleTimeString();
            const typeIcon = this.getLogIcon(logEntry.type);

            let dataStr = '';
            if (logEntry.data) {
                try {
                    dataStr = typeof logEntry.data === 'string' ? logEntry.data : JSON.stringify(logEntry.data, null, 2);
                    if (dataStr.length > 200) {
                        dataStr = dataStr.substring(0, 200) + '...';
                    }
                } catch (e) {
                    dataStr = String(logEntry.data);
                }
            }

            logElement.innerHTML = `
                <div class="log-entry-content">
                    <span class="log-timestamp">${timeStr}</span>
                    <span class="log-icon">${typeIcon}</span>
                    <div class="log-message">
                        ${logEntry.message}
                        ${dataStr ? `<div class="log-data">${dataStr}</div>` : ''}
                    </div>
                </div>
            `;

            // Add new entry animation
            logElement.classList.add('log-entry-new');
            setTimeout(() => logElement.classList.remove('log-entry-new'), 200);

            consoleOutput.appendChild(logElement);

            // Auto-scroll to bottom using the scrollable container
            const consoleContainer = document.querySelector('.debug-console-container');
            if (consoleContainer) {
                consoleContainer.scrollTop = consoleContainer.scrollHeight;
            }

        } finally {
            this._isUpdatingDOM = false;

            // Process pending logs (limit to prevent overflow)
            if (this._pendingLogs.length > 0) {
                const pendingLog = this._pendingLogs.shift();
                setTimeout(() => this.displayLogInPanel(pendingLog), 10);
            }
        }
    }

    /**
     * Get color for log type
     */
    static getLogColor(type) {
        switch (type) {
            case 'error': return '#ef4444';
            case 'warn': return '#f59e0b';
            case 'success': return '#22c55e';
            case 'info': return '#3b82f6';
            case 'debug': return '#8b5cf6';
            default: return '#ffffff';
        }
    }

    /**
     * Get icon for log type
     */
    static getLogIcon(type) {
        switch (type) {
            case 'error': return '●';
            case 'warn': return '●';
            case 'success': return '●';
            case 'info': return '●';
            case 'debug': return '●';
            default: return '●';
        }
    }

    /**
     * Clear console
     */
    static clearConsole() {
        const consoleOutput = document.getElementById('console-output');
        if (consoleOutput) {
            consoleOutput.innerHTML = `
    <div style="display: flex; align-items: flex-start; justify-content: flex-start; min-height: 200px; padding: 20px;">
        <div style="text-align: center; background: #161b22; border: 1px solid #21262d; border-radius: 12px; padding: 32px 40px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); max-width: 400px; width: 100%;">
            <div style="font-size: 32px; margin-bottom: 16px; line-height: 1;">🧹</div>
            <div style="color: #f0f6fc; font-weight: 600; font-size: 16px; margin-bottom: 8px; letter-spacing: -0.01em;">Console Cleared</div>
            <div style="color: #8b949e; font-size: 14px; line-height: 1.5; font-weight: 400;">Ready for new logs...</div>
        </div>
    </div>`;
        }

        const currentSession = this.getCurrentSession();
        if (currentSession) {
            currentSession.logs = [];
        }
    }

    /**
     * Get current session
     */
    static getCurrentSession() {
        return this.debugSessions.get(this.currentSessionId);
    }

    /**
     * Add log entry (alias for log method)
     */
    static addLog(sessionId, type, message, data) {
        this.log(message, type, data, sessionId);
    }

    /**
     * Add network request to session
     */
    static addNetworkRequest(sessionId, requestData) {
        const session = this.debugSessions.get(sessionId);
        if (session) {
            session.networkRequests.push({
                ...requestData,
                timestamp: Date.now()
            });

            this.log(`🌐 Network request initiated: ${requestData.method || 'GET'} ${requestData.url || requestData.id}`, 'info', requestData, sessionId);
        }
    }

    /**
     * Update network request with response data
     */
    static updateNetworkRequest(sessionId, requestId, updateData) {
        const session = this.debugSessions.get(sessionId);
        if (session) {
            const request = session.networkRequests.find(req => req.id === requestId);
            if (request) {
                Object.assign(request, updateData);

                if (updateData.status === 'completed') {
                    this.log(`✅ Network request completed: ${updateData.statusCode} ${updateData.statusText} (${updateData.duration}ms)`, 'success', updateData, sessionId);
                } else if (updateData.status === 'failed') {
                    this.log(`❌ Network request failed: ${updateData.error}`, 'error', updateData, sessionId);
                }
            }
        }
    }

    /**
     * Switch debug tab and filter logs
     */
    static switchTab(tabName) {
        const debugPanel = document.getElementById('viz-debug-panel');
        if (!debugPanel) {
            return;
        }

        const tabs = debugPanel.querySelectorAll('.debug-tab');
        if (tabs.length > 0) {
            tabs.forEach(tab => {
                tab.classList.remove('active');
                tab.classList.remove('debug-tab-active');
            });
        }

        const targetTab = debugPanel.querySelector(`.debug-tab[data-tab="${tabName}"]`);
        if (targetTab) {
            targetTab.classList.add('active');
            targetTab.classList.add('debug-tab-active');
        }

        const panels = debugPanel.querySelectorAll('.debug-panel');
        if (panels.length > 0) {
            panels.forEach(panel => {
                panel.classList.remove('active');
            });
        }

        const targetPanel = document.getElementById(`${tabName}-panel`);
        if (targetPanel) {
            targetPanel.classList.add('active');
            targetPanel.style.pointerEvents = 'auto';
            targetPanel.style.display = 'flex';
            targetPanel.style.opacity = '1';
        }

        // Apply log filtering based on tab selection
        this.setLogFilter(tabName.toLowerCase());
    }

    /**
     * Set log filter and update display
     */
    static setLogFilter(filterType) {
        // This is an alias for setFilter to maintain compatibility
        this.setFilter(filterType);
    }

    /**
     * Apply current log filter to console display
     */
    static applyLogFilter() {
        const consoleOutput = document.getElementById('console-output');
        if (!consoleOutput) {
            return;
        }

        const logEntries = consoleOutput.querySelectorAll('.log-entry');

        logEntries.forEach((entry, index) => {
            const shouldShow = this.shouldShowLogEntry(entry);

            if (shouldShow) {
                // Show with fade-in animation
                entry.style.display = 'block';
                setTimeout(() => {
                    entry.style.opacity = '1';
                    entry.style.transform = 'translateY(0)';
                }, index * 10); // Stagger the animations
            } else {
                // Hide with fade-out animation
                entry.style.opacity = '0';
                entry.style.transform = 'translateY(-10px)';
                setTimeout(() => {
                    entry.style.display = 'none';
                }, 250); // Wait for animation to complete
            }
        });

        // Scroll to bottom after filtering
        setTimeout(() => {
            this.scrollToBottom();
        }, 300);
    }

    /**
     * Determine if log entry should be shown based on current filter
     */
    static shouldShowLogEntry(logEntry) {
        if (this._currentFilter === 'all') {
            return true;
        }

        const logClasses = logEntry.className;

        // Map filter types to log classes
        const filterMap = {
            'info': 'log-info',
            'warn': 'log-warn',
            'error': 'log-error',
            'debug': 'log-debug',
            'success': 'log-success'
        };

        const targetClass = filterMap[this._currentFilter];
        if (!targetClass) {
            return true; // Show all if unknown filter
        }

        return logClasses.includes(targetClass);
    }

    /**
     * Scroll console to bottom
     */
    static scrollToBottom() {
        const consoleContainer = document.querySelector('.debug-console-container');
        if (consoleContainer) {
            setTimeout(() => {
                // Ensure scrolling works by setting scrollTop multiple times
                const maxScroll = consoleContainer.scrollHeight - consoleContainer.clientHeight;
                consoleContainer.scrollTop = maxScroll;

                // Force a second scroll attempt in case the first didn't work
                requestAnimationFrame(() => {
                    consoleContainer.scrollTop = consoleContainer.scrollHeight;
                });
            }, 50);
        }
    }

    /**
     * Hide debug panel
     */
    static hideDebugPanel() {
        if (this.debugPanel) {
            this.debugPanel.classList.add('hidden');
            this.debugPanel.style.pointerEvents = 'none';
        }
    }

    /**
     * Clear console and activate interception for demo/testing
     */
    static activateConsoleCapture() {
        if (!this._consoleInterceptionActive) {
            this.setupConsoleInterception();
        }

        // Create a temporary session if none exists
        if (!this.currentSessionId) {
            this.startSession('demo-session', document.body, {
                url: 'console-capture-demo',
                method: 'DEMO'
            });
        }

        this.log('🎯 Console capture activated - try console.log("test") in browser console', 'info');
    }

    /**
     * Start capturing console logs from external website
     */
    static async startBrowserConsoleCapture(url) {
        if (!url || url === 'no-url') {
            this.log('⚠️ Cannot capture console logs - no valid URL provided', 'warn');
            return false;
        }

        try {
            // Stop any existing browser capture
            await this.stopBrowserConsoleCapture();

            const sessionId = `browser-${this.currentSessionId || 'default'}`;

            this.log(`🌐 Starting browser console capture for: ${url}`, 'info');

            const response = await fetch('/api/console-capture/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId,
                    url
                })
            });

            const result = await response.json();

            if (result.success) {
                this._browserCaptureSession = {
                    sessionId,
                    url,
                    lastLogTime: Date.now()
                };

                // Display initial logs if any
                if (result.initialLogs && result.initialLogs.length > 0) {
                    result.initialLogs.forEach(log => {
                        this.displayExternalWebsiteLog(log);
                    });
                }

                // Start polling for new logs
                this.startBrowserCapturePolling();

                this.log(`✅ Browser console capture started successfully`, 'success');
                this.log(`📊 Capturing real-time console logs from ${url}`, 'info');

                return true;
            } else {
                this.log(`❌ Failed to start browser console capture: ${result.error}`, 'error');
                return false;
            }

        } catch (error) {
            this.log(`❌ Error starting browser console capture: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * Stop browser console capture
     */
    static async stopBrowserConsoleCapture() {
        if (!this._browserCaptureSession) {
            return;
        }

        try {
            // Stop polling
            if (this._browserCapturePolling) {
                clearInterval(this._browserCapturePolling);
                this._browserCapturePolling = null;
            }

            // Stop capture session on server
            const response = await fetch(`/api/console-capture/${this._browserCaptureSession.sessionId}/stop`, {
                method: 'POST'
            });

            const result = await response.json();

            if (result.success) {
                this.log(`🛑 Browser console capture stopped (captured ${result.totalLogs} logs)`, 'info');
            } else {
                this.log(`⚠️ Error stopping browser console capture: ${result.error}`, 'warn');
            }

        } catch (error) {
            this.log(`⚠️ Error stopping browser console capture: ${error.message}`, 'warn');
        } finally {
            this._browserCaptureSession = null;
        }
    }

    /**
     * Start polling for new browser console logs
     */
    static startBrowserCapturePolling() {
        if (this._browserCapturePolling) {
            clearInterval(this._browserCapturePolling);
        }

        this._browserCapturePolling = setInterval(async () => {
            if (!this._browserCaptureSession) {
                clearInterval(this._browserCapturePolling);
                this._browserCapturePolling = null;
                return;
            }

            try {
                const response = await fetch(`/api/console-capture/${this._browserCaptureSession.sessionId}/logs?since=${this._browserCaptureSession.lastLogTime}`);
                const result = await response.json();

                if (result.success && result.logs && result.logs.length > 0) {
                    result.logs.forEach(log => {
                        this.displayExternalWebsiteLog(log);
                    });

                    // Update last log time
                    const lastLog = result.logs[result.logs.length - 1];
                    this._browserCaptureSession.lastLogTime = new Date(lastLog.timestamp).getTime();
                }

            } catch (error) {
                console.error('Error polling browser console logs:', error);
            }
        }, 1000); // Poll every second
    }

    /**
     * Display external website console log in debug panel
     */
    static displayExternalWebsiteLog(log) {
        // Skip empty or undefined messages
        const logText = log.text || log.message || '';
        if (!logText || logText === 'undefined' || logText === 'null' || logText.trim() === '') {
            return;
        }

        const typeMapping = {
            'log': 'info',
            'info': 'info',
            'warn': 'warn',
            'warning': 'warn',
            'error': 'error',
            'debug': 'debug'
        };

        const mappedType = typeMapping[log.type] || 'info';
        const websiteIcon = '🌐';
        const typeIcon = this.getLogIcon(mappedType);

        // Format the message with website context
        let message = `${websiteIcon} ${typeIcon} Website Console: ${logText}`;

        // Include location info if available and valid
        if (log.location && log.location.url && log.location.url !== 'undefined') {
            try {
                const urlObj = new URL(log.location.url);
                if (urlObj.hostname) {
                    message += ` (from ${urlObj.hostname})`;
                }
            } catch (e) {
                // If URL parsing fails, include raw URL only if it looks valid
                if (log.location.url && log.location.url.length > 0 && log.location.url !== 'undefined') {
                    message += ` (from ${log.location.url})`;
                }
            }
        }

        // Prepare additional data
        let data = null;
        if (log.args && log.args.length > 0) {
            data = {
                args: log.args,
                location: log.location,
                source: log.source
            };
        }

        // Log the external website console event
        this.log(message, mappedType, data);
    }

    /**
     * Stop all debugging and restore console
     */
    static stopDebugging() {
        // Clear all sessions
        this.debugSessions.clear();
        this.currentSessionId = null;

        // Stop browser console capture
        this.stopBrowserConsoleCapture();

        // Restore original console
        this.restoreConsole();

        // Hide debug panel
        this.hideDebugPanel();

        this.log('🛑 Debug session ended - console restored', 'info');
    }

    /**
     * Set console filter
     */
    static setFilter(filterType) {
        this._currentFilter = filterType;

        // Notify filter callbacks
        this._filterCallbacks.forEach(callback => {
            try {
                callback(filterType);
            } catch (error) {
                console.error('Filter callback error:', error);
            }
        });

        // Apply filter to existing logs immediately
        this.applyLogFilter();
    }

    /**
     * Register filter change callback
     */
    static onFilterChange(callback) {
        this._filterCallbacks.add(callback);
        return () => this._filterCallbacks.delete(callback);
    }

    /**
     * Get current filter
     */
    static getCurrentFilter() {
        return this._currentFilter;
    }

    /**
     * Check if log entry should be shown based on current filter
     */
    static shouldShowLog(logEntry) {
        if (this._currentFilter === 'all') {
            return true;
        }

        // Map log types for filtering
        const logType = logEntry.type;
        if (this._currentFilter === 'warn' && logType === 'warn') {
            return true;
        }
        if (this._currentFilter === 'error' && logType === 'error') {
            return true;
        }
        if (this._currentFilter === 'info' && (logType === 'info' || logType === 'success')) {
            return true;
        }
        if (this._currentFilter === 'debug' && logType === 'debug') {
            return true;
        }

        return false;
    }

    /**
     * Refresh console display with current filter
     */
    static refreshConsoleDisplay() {
        const consoleOutput = document.getElementById('console-output');
        if (!consoleOutput) {
            return;
        }

        // Clear current display
        consoleOutput.innerHTML = '';

        // Get current session logs
        const session = this.getCurrentSession();
        if (session && session.logs) {
            // Temporarily disable DOM update protection to rebuild console
            const originalIsUpdating = this._isUpdatingDOM;
            this._isUpdatingDOM = false;

            // Render ALL logs first, then apply filter
            session.logs.forEach(logEntry => {
                this._renderLogEntry(logEntry);
            });

            this._isUpdatingDOM = originalIsUpdating;

            // Apply current filter after rendering
            setTimeout(() => {
                this.applyLogFilter();
            }, 50);
        }
    }

    /**
     * Render a single log entry (used by refreshConsoleDisplay)
     */
    static _renderLogEntry(logEntry) {
        const consoleOutput = document.getElementById('console-output');
        if (!consoleOutput) {
            return;
        }

        const logElement = document.createElement('div');
        logElement.className = `log-entry log-${logEntry.type}`;
        logElement.style.cssText = `
            padding: 12px;
            border-left: 3px solid ${this.getLogColor(logEntry.type)};
            margin-bottom: 4px;
            background: rgba(255, 255, 255, 0.02);
            border-radius: 4px;
            animation: fadeIn 0.3s ease-in;
        `;

        const timeStr = new Date(logEntry.timestamp).toLocaleTimeString();
        const typeIcon = this.getLogIcon(logEntry.type);

        let dataStr = '';
        if (logEntry.data) {
            try {
                dataStr = typeof logEntry.data === 'string' ? logEntry.data : JSON.stringify(logEntry.data, null, 2);
                if (dataStr.length > 200) {
                    dataStr = dataStr.substring(0, 200) + '...';
                }
            } catch (e) {
                dataStr = String(logEntry.data);
            }
        }

        logElement.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 8px;">
                <span style="color: #64748b; font-size: 11px; min-width: 80px;">[${timeStr}]</span>
                <span style="color: ${this.getLogColor(logEntry.type)}; font-weight: 500; min-width: 20px;">${typeIcon}</span>
                <div style="flex: 1;">
                    <span style="color: #f1f5f9;">${logEntry.message}</span>
                    ${dataStr ? `<div style="color: #94a3b8; font-size: 12px; margin-top: 4px; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 4px; white-space: pre-wrap;">${dataStr}</div>` : ''}
                </div>
            </div>
        `;

        consoleOutput.appendChild(logElement);

        // Apply current filter to the new element
        if (!this.shouldShowLogEntry(logElement)) {
            logElement.style.display = 'none';
            logElement.style.opacity = '0';
        }

        // Auto-scroll to bottom using the scrollable container
        const consoleContainer = document.querySelector('.debug-console-container');
        if (consoleContainer) {
            consoleContainer.scrollTop = consoleContainer.scrollHeight;
        }
    }

    /**
     * Execute debug command from console input
     */
    static executeCommand(command) {
        try {
            if (!command || command.trim() === '') {
                return;
            }

            // Parse command
            const [cmd, ...args] = command.trim().split(' ');

            // Log the command being executed
            this.log(`💻 Executing command: ${command}`, 'info');

            switch (cmd.toLowerCase()) {
                case 'help':
                    this.showHelp();
                    break;
                case 'sessions':
                    this.showSessions();
                    break;
                case 'clear':
                    this.clearConsole();
                    break;
                case 'status':
                    this.showStatus();
                    break;
                case 'filter':
                    if (args[0]) {
                        this.setFilter(args[0]);
                        this.log(`🔍 Filter set to: ${args[0]}`, 'success');
                    } else {
                        this.log(`🔍 Current filter: ${this._currentFilter}`, 'info');
                    }
                    break;
                case 'export':
                    this.exportLogs();
                    break;
                case 'test':
                    this.testCommand();
                    break;
                default:
                    this.log(`❌ Unknown command: ${cmd}. Type 'help' for available commands.`, 'error');
            }
        } catch (error) {
            this.log(`❌ Error executing command: ${error.message}`, 'error');
        }
    }

    /**
     * Show help commands
     */
    static showHelp() {
        const commands = [
            'help - Show this help message',
            'sessions - List all debug sessions',
            'clear - Clear the console output',
            'status - Show debugger status',
            'filter <type> - Set log filter (all, info, warn, error, debug)',
            'export - Export console logs',
            'test - Generate sample logs to test filtering'
        ];

        this.log('📚 Available Commands:', 'info');
        commands.forEach(cmd => {
            this.log(`  • ${cmd}`, 'info');
        });
        this.log('💡 Tip: Try "test" command then use the filter buttons (All, Info, Warnings, Errors, Debug) to test filtering!', 'success');
    }

    /**
     * Show active debug sessions
     */
    static showSessions() {
        if (this.debugSessions.size === 0) {
            this.log('📊 No active debug sessions', 'info');
            return;
        }

        this.log(`📊 Active Debug Sessions (${this.debugSessions.size}):`, 'info');
        this.debugSessions.forEach((session, sessionId) => {
            const logCount = session.logs ? session.logs.length : 0;
            const isActive = sessionId === this.currentSessionId ? ' (ACTIVE)' : '';
            this.log(`  • ${sessionId}: ${logCount} logs${isActive}`, 'info');
        });
    }

    /**
     * Show debugger status
     */
    static showStatus() {
        this.log('🔍 Debugger Status:', 'info');
        this.log(`  • Enabled: ${this.isEnabled}`, 'info');
        this.log(`  • Initialized: ${this.isInitialized}`, 'info');
        this.log(`  • Current Session: ${this.currentSessionId || 'None'}`, 'info');
        this.log(`  • Total Sessions: ${this.debugSessions.size}`, 'info');
        this.log(`  • Current Filter: ${this._currentFilter}`, 'info');
        this.log(`  • Console Interception: ${this._consoleInterceptionActive}`, 'info');
        this.log(`  • Browser Capture: ${this._browserCaptureSession ? 'Active' : 'Inactive'}`, 'info');
    }

    /**
     * Export console logs
     */
    static exportLogs() {
        const session = this.getCurrentSession();
        if (!session || !session.logs || session.logs.length === 0) {
            this.log('📁 No logs to export', 'warn');
            return;
        }

        try {
            const logsData = {
                sessionId: this.currentSessionId,
                exportTime: new Date().toISOString(),
                totalLogs: session.logs.length,
                logs: session.logs
            };

            const dataStr = JSON.stringify(logsData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `debug-logs-${this.currentSessionId}-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.log(`📁 Exported ${session.logs.length} logs to file`, 'success');
        } catch (error) {
            this.log(`❌ Export failed: ${error.message}`, 'error');
        }
    }

    /**
     * Run test commands
     */
    static testCommand() {
        this.log('🧪 Running test commands...', 'info');
        setTimeout(() => {
            this.log('✅ Test info message', 'info');
        }, 500);
        setTimeout(() => {
            this.log('⚠️ Test warning message', 'warn');
        }, 1000);
        setTimeout(() => {
            this.log('❌ Test error message', 'error');
        }, 1500);
        setTimeout(() => {
            this.log('🔧 Test debug message', 'debug');
        }, 2000);
        setTimeout(() => {
            this.log('🎉 Test completed successfully!', 'success');
        }, 2500);
    }

    /**
     * Setup console filter event listeners
     */
    static setupConsoleFilter() {
        const setupWithRetry = (attempts = 0, maxAttempts = 10) => {
            const filterInput = document.getElementById('console-filter-input');
            const clearBtn = document.getElementById('clear-filter-btn');

            if (filterInput && clearBtn) {
                // Remove existing listeners to prevent duplicates
                filterInput.replaceWith(filterInput.cloneNode(true));
                clearBtn.replaceWith(clearBtn.cloneNode(true));

                const newFilterInput = document.getElementById('console-filter-input');
                const newClearBtn = document.getElementById('clear-filter-btn');

                // Handle enter key press for filtering
                newFilterInput.addEventListener('keypress', (event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        const filterText = event.target.value.trim().toLowerCase();
                        this.applyTextFilter(filterText);
                    }
                });

                // Handle input for real-time filtering (debounced)
                let filterTimeout;
                newFilterInput.addEventListener('input', (event) => {
                    clearTimeout(filterTimeout);
                    filterTimeout = setTimeout(() => {
                        const filterText = event.target.value.trim().toLowerCase();
                        this.applyTextFilter(filterText);
                    }, 300);
                });

                // Handle clear button
                newClearBtn.addEventListener('click', (event) => {
                    event.preventDefault();
                    newFilterInput.value = '';
                    this.applyTextFilter('');
                    newFilterInput.focus();
                });

                // Add focus styling
                newFilterInput.addEventListener('focus', () => {
                    const wrapper = newFilterInput.closest('.filter-input-wrapper');
                    if (wrapper) {
                        wrapper.style.borderColor = '#58a6ff';
                        wrapper.style.boxShadow = '0 0 0 2px rgba(88, 166, 255, 0.1)';
                    }
                });

                newFilterInput.addEventListener('blur', () => {
                    const wrapper = newFilterInput.closest('.filter-input-wrapper');
                    if (wrapper) {
                        wrapper.style.borderColor = '#30363d';
                        wrapper.style.boxShadow = 'none';
                    }
                });

                // Log successful setup
                if (this.currentSessionId) {
                    this.log('🎯 Filter input setup complete - type to filter logs, press Enter to apply', 'info');
                }

            } else if (attempts < maxAttempts) {
                setTimeout(() => setupWithRetry(attempts + 1, maxAttempts), 200);
            } else {
                // Try to log to debug console if available
                if (this.currentSessionId) {
                    this.log('⚠️ Filter input setup failed - filtering may not work', 'warn');
                }
            }
        };

        setupWithRetry();
    }

    /**
     * Apply text-based filter to log entries
     */
    static applyTextFilter(filterText) {
        const consoleOutput = document.getElementById('console-output');
        if (!consoleOutput) {
            return;
        }

        const logEntries = consoleOutput.querySelectorAll('.log-entry');
        let visibleCount = 0;

        logEntries.forEach((entry) => {
            const logMessage = entry.querySelector('.log-message');
            if (!logMessage) {
                return;
            }

            const messageText = logMessage.textContent.toLowerCase();
            const shouldShow = !filterText || messageText.includes(filterText);

            if (shouldShow) {
                entry.style.display = 'block';
                entry.style.opacity = '1';
                visibleCount++;
            } else {
                entry.style.display = 'none';
                entry.style.opacity = '0';
            }
        });

        // Show filter result message
        this.showFilterResult(filterText, visibleCount, logEntries.length);

        // Scroll to bottom after filtering
        setTimeout(() => {
            this.scrollToBottom();
        }, 100);
    }

    /**
     * Show filter result message
     */
    static showFilterResult(filterText, visibleCount, totalCount) {
        if (!this.currentSessionId) return;

        if (filterText) {
            if (visibleCount === 0) {
                this.log(`🔍 No logs match filter "${filterText}"`, 'info');
            } else {
                this.log(`🔍 Showing ${visibleCount} of ${totalCount} logs for "${filterText}"`, 'info');
            }
        } else if (visibleCount < totalCount) {
            this.log(`🔍 Filter cleared - showing all ${totalCount} logs`, 'info');
        }
    }

    /**
     * Cleanup method for when debugger is disabled
     */
    static cleanup() {
        this.stopDebugging();
        this.isEnabled = false;
        this.isInitialized = false;
    }
}

// Make VisualizationDebugger globally available for testing
if (typeof window !== 'undefined') {
    window.VisualizationDebugger = VisualizationDebugger;
}

export default VisualizationDebugger;
