/**
 * Visualization Debugging Service
 * Provides advanced debugging capabilities for visualizations
 * Similar to browser developer tools but for visualizations
 */
export class VisualizationDebugger {
    static debugSessions = new Map();
    static isEnabled = false;
    static debugPanel = null;

    /**
     * Initialize the debugging system
     */
    static initialize() {
        this.isEnabled = true;
        this.createDebugPanel();
        this.setupKeyboardShortcuts();
        console.log('🔍 Visualization Debugger initialized');
    }

    /**
     * Create debug panel UI
     */
    static createDebugPanel() {
        // Create debug panel container
        const panel = document.createElement('div');
        panel.id = 'viz-debug-panel';
        panel.className = 'viz-debug-panel hidden';

        panel.innerHTML = `
            <div class="debug-header">
                <h3>🔍 Visualization Debugger</h3>
                <div class="debug-controls">
                    <button class="debug-btn" id="debug-clear">Clear</button>
                    <button class="debug-btn" id="debug-export">Export</button>
                    <button class="debug-btn close-btn" id="debug-close">×</button>
                </div>
            </div>
            <div class="debug-content">
                <div class="debug-tabs">
                    <button class="debug-tab active" data-tab="console">Console</button>
                    <button class="debug-tab" data-tab="elements">Elements</button>
                    <button class="debug-tab" data-tab="network">Network</button>
                    <button class="debug-tab" data-tab="performance">Performance</button>
                    <button class="debug-tab" data-tab="templates">Templates</button>
                </div>
                <div class="debug-panels">
                    <div class="debug-panel active" id="console-panel">
                        <div class="console-output" id="console-output"></div>
                        <div class="console-input">
                            <input type="text" id="console-input" placeholder="Enter command..." />
                        </div>
                    </div>
                    <div class="debug-panel" id="elements-panel">
                        <div class="elements-tree" id="elements-tree"></div>
                    </div>
                    <div class="debug-panel" id="network-panel">
                        <div class="network-requests" id="network-requests"></div>
                    </div>
                    <div class="debug-panel" id="performance-panel">
                        <div class="performance-metrics" id="performance-metrics"></div>
                    </div>
                    <div class="debug-panel" id="templates-panel">
                        <div class="template-editor" id="template-editor"></div>
                    </div>
                </div>
            </div>
        `;

        // Add styles
        const styles = document.createElement('style');
        styles.textContent = this.getDebugPanelStyles();
        document.head.appendChild(styles);

        document.body.appendChild(panel);
        this.debugPanel = panel;

        // Add event listeners
        this.setupPanelEventListeners();
    }

    /**
     * Setup keyboard shortcuts for debug panel
     */
    static setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // F12 or Ctrl+Shift+I to toggle debug panel
            if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
                e.preventDefault();
                this.toggleDebugPanel();
            }
        });
    }

    /**
     * Toggle debug panel visibility
     */
    static toggleDebugPanel() {
        if (!this.debugPanel) return;

        this.debugPanel.classList.toggle('hidden');
        if (!this.debugPanel.classList.contains('hidden')) {
            this.refreshDebugInfo();
        }
    }

    /**
     * Show debug panel
     */
    static showDebugPanel() {
        this.debugPanel.classList.remove('hidden');
        this.logToConsole('🔍 Debug panel opened', 'info');
    }

    /**
     * Hide debug panel
     */
    static hideDebugPanel() {
        this.debugPanel.classList.add('hidden');
    }

    /**
     * Switch debug tab
     */
    static switchTab(tabName) {
        // Update tab buttons
        const tabs = document.querySelectorAll('.debug-tab');
        if (tabs.length > 0) {
            tabs.forEach(tab => {
                tab.classList.remove('active');
            });
        }

        const targetTab = document.querySelector(`[data-tab="${tabName}"]`);
        if (targetTab) {
            targetTab.classList.add('active');
        }

        // Update panels
        const panels = document.querySelectorAll('.debug-panel');
        if (panels.length > 0) {
            panels.forEach(panel => {
                panel.classList.remove('active');
            });
        }

        const targetPanel = document.getElementById(`${tabName}-panel`);
        if (targetPanel) {
            targetPanel.classList.add('active');
        }

        // Load tab content
        this.loadTabContent(tabName);
    }

    /**
     * Load content for specific tab
     */
    static loadTabContent(tabName) {
        switch (tabName) {
            case 'elements':
                this.loadElementsTree();
                break;
            case 'network':
                this.loadNetworkRequests();
                break;
            case 'performance':
                this.loadPerformanceMetrics();
                break;
            case 'templates':
                this.loadTemplateEditor();
                break;
            default:
                // Console tab is default, no action needed
                break;
        }
    }

    /**
     * Start debugging session for a visualization
     */
    static startSession(visualizationId, element, data) {
        const session = {
            id: visualizationId,
            element: element,
            data: data,
            startTime: Date.now(),
            logs: [],
            performance: {
                renderTime: 0,
                memoryUsage: 0,
                domNodes: 0
            },
            errors: [],
            warnings: []
        };

        this.debugSessions.set(visualizationId, session);
        this.log(`🔍 Debug session started for: ${visualizationId}`, 'info');

        // Start performance monitoring
        this.startPerformanceMonitoring(visualizationId);

        return session;
    }

    /**
     * Log debug message
     */
    static log(message, type = 'info', data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            message,
            type,
            data,
            stack: new Error().stack
        };

        // Store in current session if any
        const currentSession = Array.from(this.debugSessions.values())[0];
        if (currentSession) {
            currentSession.logs.push(logEntry);
        }

        // Display in debug panel
        this.displayLogInPanel(logEntry);

        // Also log to browser console
        console.log(`[VizDebug:${type}] ${message}`, data);
    }

    /**
     * Display log entry in debug panel
     */
    static displayLogInPanel(logEntry) {
        const consoleOutput = document.getElementById('console-output');
        if (!consoleOutput) return;

        const logElement = document.createElement('div');
        logElement.className = `console-entry ${logEntry.type}`;

        const timeElement = document.createElement('span');
        timeElement.className = 'console-time';
        timeElement.textContent = new Date(logEntry.timestamp).toLocaleTimeString();

        const messageElement = document.createElement('span');
        messageElement.className = 'console-message';
        messageElement.textContent = logEntry.message;

        logElement.appendChild(timeElement);
        logElement.appendChild(messageElement);

        if (logEntry.data) {
            const dataElement = document.createElement('div');
            dataElement.className = 'console-data';
            dataElement.textContent = JSON.stringify(logEntry.data, null, 2);
            logElement.appendChild(dataElement);
        }

        consoleOutput.appendChild(logElement);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }

    /**
     * Inspect visualization element
     */
    static inspectElement(element) {
        if (!element) return;

        const inspection = {
            tagName: element.tagName,
            className: element.className,
            id: element.id,
            attributes: {},
            styles: {},
            children: element.children.length,
            textContent: element.textContent?.substring(0, 100),
            boundingRect: element.getBoundingClientRect(),
            computedStyles: window.getComputedStyle(element)
        };

        // Get attributes
        Array.from(element.attributes).forEach(attr => {
            inspection.attributes[attr.name] = attr.value;
        });

        // Get relevant styles
        const relevantStyles = [
            'width', 'height', 'display', 'position', 'background-color',
            'color', 'font-size', 'margin', 'padding', 'border'
        ];

        relevantStyles.forEach(prop => {
            inspection.styles[prop] = inspection.computedStyles.getPropertyValue(prop);
        });

        this.displayElementInspection(inspection);
        return inspection;
    }

    /**
     * Display element inspection in debug panel
     */
    static displayElementInspection(inspection) {
        const elementsPanel = document.getElementById('elements-panel');
        if (!elementsPanel) return;

        elementsPanel.innerHTML = `
            <div class="element-inspection">
                <h4>&lt;${inspection.tagName.toLowerCase()}&gt;</h4>
                
                <div class="inspection-section">
                    <h5>Attributes</h5>
                    <div class="attributes-list">
                        ${Object.entries(inspection.attributes).map(([key, value]) => `
                            <div class="attribute-item">
                                <span class="attr-key">${key}:</span>
                                <span class="attr-value">"${value}"</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="inspection-section">
                    <h5>Computed Styles</h5>
                    <div class="styles-list">
                        ${Object.entries(inspection.styles).map(([key, value]) => `
                            <div class="style-item">
                                <span class="style-key">${key}:</span>
                                <span class="style-value">${value}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="inspection-section">
                    <h5>Dimensions</h5>
                    <div class="dimensions-info">
                        <p>Width: ${inspection.boundingRect.width}px</p>
                        <p>Height: ${inspection.boundingRect.height}px</p>
                        <p>Children: ${inspection.children}</p>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Start performance monitoring
     */
    static startPerformanceMonitoring(visualizationId) {
        const session = this.debugSessions.get(visualizationId);
        if (!session) return;

        // Monitor render time
        const renderStart = performance.now();

        // Use MutationObserver to track DOM changes
        const observer = new MutationObserver((mutations) => {
            const renderEnd = performance.now();
            session.performance.renderTime = renderEnd - renderStart;

            // Count DOM nodes
            session.performance.domNodes = session.element?.querySelectorAll('*').length || 0;

            // Update performance panel
            this.updatePerformancePanel(session);
        });

        if (session.element) {
            observer.observe(session.element, {
                childList: true,
                subtree: true,
                attributes: true
            });
        }

        // Monitor memory usage (approximate)
        if (performance.memory) {
            session.performance.memoryUsage = performance.memory.usedJSHeapSize;
        }
    }

    /**
     * Update performance panel
     */
    static updatePerformancePanel(session) {
        const performancePanel = document.getElementById('performance-panel');
        if (!performancePanel) return;

        performancePanel.innerHTML = `
            <div class="performance-metrics">
                <div class="metric-item">
                    <span class="metric-label">Render Time:</span>
                    <span class="metric-value">${session.performance.renderTime.toFixed(2)}ms</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">DOM Nodes:</span>
                    <span class="metric-value">${session.performance.domNodes}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Memory Usage:</span>
                    <span class="metric-value">${(session.performance.memoryUsage / 1024 / 1024).toFixed(2)}MB</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Session Duration:</span>
                    <span class="metric-value">${((Date.now() - session.startTime) / 1000).toFixed(1)}s</span>
                </div>
            </div>
        `;
    }

    /**
     * Monitor network requests for visualization resources
     */
    static monitorNetworkRequests() {
        const originalFetch = window.fetch;
        const originalXHR = window.XMLHttpRequest;

        // Override fetch
        window.fetch = async function (...args) {
            const startTime = performance.now();
            const response = await originalFetch.apply(this, args);
            const endTime = performance.now();

            VisualizationDebugger.logNetworkRequest({
                url: args[0],
                method: args[1]?.method || 'GET',
                status: response.status,
                duration: endTime - startTime,
                type: 'fetch'
            });

            return response;
        };

        // Override XMLHttpRequest
        const originalOpen = originalXHR.prototype.open;
        originalXHR.prototype.open = function (method, url) {
            this._debugInfo = { method, url, startTime: performance.now() };
            return originalOpen.apply(this, arguments);
        };

        const originalSend = originalXHR.prototype.send;
        originalXHR.prototype.send = function () {
            const self = this;
            this.addEventListener('loadend', function () {
                if (self._debugInfo) {
                    VisualizationDebugger.logNetworkRequest({
                        url: self._debugInfo.url,
                        method: self._debugInfo.method,
                        status: self.status,
                        duration: performance.now() - self._debugInfo.startTime,
                        type: 'xhr'
                    });
                }
            });
            return originalSend.apply(this, arguments);
        };
    }

    /**
     * Log network request
     */
    static logNetworkRequest(request) {
        const networkPanel = document.getElementById('network-panel');
        if (!networkPanel) return;

        const requestElement = document.createElement('div');
        requestElement.className = `network-request status-${Math.floor(request.status / 100)}xx`;
        requestElement.innerHTML = `
            <div class="request-info">
                <span class="request-method">${request.method}</span>
                <span class="request-url">${request.url}</span>
                <span class="request-status">${request.status}</span>
                <span class="request-duration">${request.duration.toFixed(2)}ms</span>
            </div>
        `;

        networkPanel.appendChild(requestElement);
    }

    /**
     * Analyze template for issues
     */
    static analyzeTemplate(template, data) {
        const issues = [];

        // Check for undefined variables
        const variablePattern = /\{\{([^}]+)\}\}/g;
        let match;
        while ((match = variablePattern.exec(template)) !== null) {
            const variable = match[1].trim();
            if (!this.hasNestedProperty(data, variable)) {
                issues.push({
                    type: 'warning',
                    message: `Undefined variable: ${variable}`,
                    line: template.substring(0, match.index).split('\n').length
                });
            }
        }

        // Check for potential XSS vulnerabilities
        if (template.includes('<script>')) {
            issues.push({
                type: 'error',
                message: 'Potential XSS vulnerability: script tag detected',
                line: template.split('\n').findIndex(line => line.includes('<script>')) + 1
            });
        }

        // Check for large data objects
        if (JSON.stringify(data).length > 100000) {
            issues.push({
                type: 'warning',
                message: 'Large data object may impact performance',
                line: 0
            });
        }

        return issues;
    }

    /**
     * Check if object has nested property
     */
    static hasNestedProperty(obj, path) {
        return path.split('.').reduce((current, prop) => {
            return current && current[prop];
        }, obj) !== undefined;
    }

    /**
     * Export debug session
     */
    static exportDebugSession(sessionId) {
        const session = this.debugSessions.get(sessionId);
        if (!session) return null;

        const exportData = {
            id: session.id,
            startTime: session.startTime,
            duration: Date.now() - session.startTime,
            logs: session.logs,
            performance: session.performance,
            errors: session.errors,
            warnings: session.warnings,
            exportedAt: new Date().toISOString()
        };

        // Create download link
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `debug-session-${sessionId}-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return exportData;
    }

    /**
     * Clear debug session
     */
    static clearSession(sessionId) {
        if (sessionId) {
            this.debugSessions.delete(sessionId);
        } else {
            this.debugSessions.clear();
        }

        // Clear debug panel
        const consoleOutput = document.getElementById('console-output');
        if (consoleOutput) {
            consoleOutput.innerHTML = '';
        }
    }

    /**
     * Refresh debug info
     */
    static refreshDebugInfo() {
        this.debugSessions.forEach((session, id) => {
            this.updatePerformancePanel(session);
        });
    }

    /**
     * Setup panel event listeners
     */
    static setupPanelEventListeners() {
        if (!this.debugPanel) return;

        // Tab switching - only for tabs within the debug panel
        this.debugPanel.querySelectorAll('.debug-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchTab(tab.dataset.tab);
            });
        });

        // Console input
        const consoleInput = this.debugPanel.querySelector('#console-input');
        if (consoleInput) {
            consoleInput.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') {
                    this.executeCommand(event.target.value);
                    event.target.value = '';
                }
            });
        }

        // Close button
        const closeBtn = this.debugPanel.querySelector('#debug-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hideDebugPanel();
            });
        }

        // Clear button
        const clearBtn = this.debugPanel.querySelector('#debug-clear');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearConsole();
            });
        }

        // Export button
        const exportBtn = this.debugPanel.querySelector('#debug-export');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportDebugData();
            });
        }
    }

    /**
     * Execute debug command
     */
    static executeCommand(command) {
        try {
            // Parse command
            const [cmd, ...args] = command.trim().split(' ');

            switch (cmd) {
                case 'help':
                    this.showHelp();
                    break;
                case 'sessions':
                    this.showSessions();
                    break;
                case 'inspect':
                    this.inspectVisualization(args[0]);
                    break;
                case 'performance':
                    this.showPerformanceData(args[0]);
                    break;
                case 'templates':
                    this.showTemplateData(args[0]);
                    break;
                case 'export':
                    this.exportSession(args[0]);
                    break;
                case 'clear':
                    this.clearConsole();
                    break;
                default:
                    this.logToConsole(`❌ Unknown command: ${cmd}. Type 'help' for available commands.`, 'error');
            }
        } catch (error) {
            this.logToConsole(`❌ Error executing command: ${error.message}`, 'error');
        }
    }

    /**
     * Show help commands
     */
    static showHelp() {
        const commands = [
            'help - Show this help message',
            'sessions - List all debug sessions',
            'inspect <sessionId> - Inspect visualization details',
            'performance <sessionId> - Show performance metrics',
            'templates <sessionId> - Show template information',
            'export <sessionId> - Export session data',
            'clear - Clear console output'
        ];

        this.logToConsole('📚 Available commands:', 'info');
        commands.forEach(cmd => this.logToConsole(`  ${cmd}`, 'info'));
    }

    /**
     * Show active sessions
     */
    static showSessions() {
        const sessions = Array.from(this.debugSessions.entries());
        this.logToConsole(`📋 Active sessions (${sessions.length}):`, 'info');

        sessions.forEach(([id, session]) => {
            const duration = Date.now() - session.startTime;
            this.logToConsole(`  ${id} - ${duration}ms ago`, 'info');
        });
    }

    /**
     * Inspect visualization
     */
    static inspectVisualization(sessionId) {
        const session = this.debugSessions.get(sessionId);
        if (!session) {
            this.logToConsole(`❌ Session not found: ${sessionId}`, 'error');
            return;
        }

        this.logToConsole(`🔍 Inspecting session: ${sessionId}`, 'info', session);
    }

    /**
     * Load elements tree
     */
    static loadElementsTree() {
        const elementsTree = document.getElementById('elements-tree');
        elementsTree.innerHTML = '<div class="loading">Loading elements...</div>';

        // TODO: Implement elements tree visualization
        setTimeout(() => {
            elementsTree.innerHTML = '<div class="placeholder">Elements tree will be implemented here</div>';
        }, 500);
    }

    /**
     * Load network requests
     */
    static loadNetworkRequests() {
        const networkRequests = document.getElementById('network-requests');
        networkRequests.innerHTML = '<div class="loading">Loading network requests...</div>';

        // TODO: Implement network requests tracking
        setTimeout(() => {
            networkRequests.innerHTML = '<div class="placeholder">Network requests will be tracked here</div>';
        }, 500);
    }

    /**
     * Load performance metrics
     */
    static loadPerformanceMetrics() {
        const performanceMetrics = document.getElementById('performance-metrics');
        performanceMetrics.innerHTML = '<div class="loading">Loading performance metrics...</div>';

        // TODO: Implement performance metrics display
        setTimeout(() => {
            performanceMetrics.innerHTML = '<div class="placeholder">Performance metrics will be displayed here</div>';
        }, 500);
    }

    /**
     * Load template editor
     */
    static loadTemplateEditor() {
        const templateEditor = document.getElementById('template-editor');
        templateEditor.innerHTML = '<div class="loading">Loading template editor...</div>';

        // TODO: Implement template editor
        setTimeout(() => {
            templateEditor.innerHTML = '<div class="placeholder">Template editor will be implemented here</div>';
        }, 500);
    }

    /**
     * Clear console
     */
    static clearConsole() {
        const consoleOutput = document.getElementById('console-output');
        if (consoleOutput) {
            consoleOutput.innerHTML = '';
        }
    }

    /**
     * Export debug data
     */
    static exportDebugData() {
        const debugData = {
            sessions: Array.from(this.debugSessions.entries()),
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        };

        const blob = new Blob([JSON.stringify(debugData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `viz-debug-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.logToConsole('📥 Debug data exported', 'info');
    }

    /**
     * Get debug panel styles
     */
    static getDebugPanelStyles() {
        return `
            .viz-debug-panel {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                height: 400px;
                background: #1a1d23;
                border-top: 2px solid #ff6c37;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                font-family: 'Courier New', monospace;
                font-size: 12px;
                transition: transform 0.3s ease;
            }
            
            .viz-debug-panel.hidden {
                transform: translateY(100%);
            }
            
            .debug-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 16px;
                background: #21252b;
                border-bottom: 1px solid #2c3035;
            }
            
            .debug-header h3 {
                margin: 0;
                color: #e1e5e9;
                font-size: 14px;
            }
            
            .debug-controls {
                display: flex;
                gap: 8px;
            }
            
            .debug-btn {
                background: #3a3f47;
                border: none;
                color: #e1e5e9;
                padding: 4px 8px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
            }
            
            .debug-btn:hover {
                background: #ff6c37;
            }
            
            .debug-btn.close-btn {
                background: #dc3545;
                padding: 4px 8px;
                font-weight: bold;
            }
            
            .debug-content {
                flex: 1;
                display: flex;
                flex-direction: column;
            }
            
            .debug-tabs {
                display: flex;
                background: #21252b;
                border-bottom: 1px solid #2c3035;
            }
            
            .debug-tab {
                background: none;
                border: none;
                color: #8b92a5;
                padding: 8px 16px;
                cursor: pointer;
                font-size: 11px;
                border-bottom: 2px solid transparent;
            }
            
            .debug-tab.active {
                color: #ff6c37;
                border-bottom-color: #ff6c37;
            }
            
            .debug-tab:hover {
                background: #2c3035;
            }
            
            .debug-panels {
                flex: 1;
                position: relative;
            }
            
            .debug-panel {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                display: none;
                flex-direction: column;
            }
            
            .debug-panel.active {
                display: flex;
            }
            
            .console-output {
                flex: 1;
                padding: 8px;
                overflow-y: auto;
                background: #1a1d23;
            }
            
            .console-entry {
                margin-bottom: 4px;
                display: flex;
                align-items: flex-start;
                gap: 8px;
            }
            
            .console-entry.error {
                color: #f87171;
            }
            
            .console-entry.warn {
                color: #fbbf24;
            }
            
            .console-entry.info {
                color: #60a5fa;
            }
            
            .timestamp {
                color: #6b7280;
                font-size: 10px;
                white-space: nowrap;
            }
            
            .log-type {
                color: #9ca3af;
                font-size: 10px;
                font-weight: bold;
                white-space: nowrap;
            }
            
            .message {
                color: #e1e5e9;
                flex: 1;
            }
            
            .log-data {
                display: block;
                margin-top: 4px;
                padding: 4px;
                background: #111827;
                border-radius: 2px;
                font-size: 10px;
                color: #d1d5db;
                white-space: pre-wrap;
            }
            
            .console-input {
                border-top: 1px solid #2c3035;
                padding: 8px;
                background: #21252b;
            }
            
            .console-input input {
                width: 100%;
                background: #1a1d23;
                border: 1px solid #2c3035;
                color: #e1e5e9;
                padding: 4px 8px;
                border-radius: 4px;
                font-family: 'Courier New', monospace;
                font-size: 12px;
            }
            
            .console-input input:focus {
                outline: none;
                border-color: #ff6c37;
            }
            
            .placeholder, .loading {
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100%;
                color: #6b7280;
                font-style: italic;
            }
        `;
    }
}

export default VisualizationDebugger;
