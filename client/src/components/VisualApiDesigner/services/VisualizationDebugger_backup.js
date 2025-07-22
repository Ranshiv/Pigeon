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
    static isInitialized = false; // Add initialization guard
    
    // DOM operation management to prevent freezing
    static _isUpdatingDOM = false;
    static _pendingLogs = [];

    /**
     * Initialize the debugging system
     */
    static initialize() {
        // Always enable debugging
        this.isEnabled = true;
        
        // Set up keyboard shortcuts (only once)
        if (!this.isInitialized) {
            this.setupKeyboardShortcuts();
            this.isInitialized = true;
        }
        
        // Always check for RequestForm debug container and hide popup if it exists
        const requestFormDebugContainer = document.getElementById('visualization-debugger-container');
        if (requestFormDebugContainer) {
            this.hidePopupPanel();
            // Don't create a popup panel
            return;
        }
        
        // Only create popup panel if no RequestForm debug container exists AND no popup exists yet
        if (!this.debugPanel) {
            this.createDebugPanel();
        }
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
                <h3>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 10px; vertical-align: -3px; color: #6366f1;">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                        <circle cx="12" cy="8" r="2"></circle>
                        <path d="M12 11v4"></path>
                    </svg>
                    API Debug Console
                </h3>
                <div class="debug-controls">
                    <button class="debug-btn" id="debug-clear">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        <span>Clear</span>
                    </button>
                    <button class="debug-btn" id="debug-export">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        <span>Export</span>
                    </button>
                    <button class="debug-btn close-btn" id="debug-close">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="debug-content">
                <div class="debug-tabs">
                    <button class="debug-tab active debug-tab-active" data-tab="console">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
                            <line x1="8" y1="12" x2="16" y2="12"></line>
                            <line x1="8" y1="16" x2="14" y2="16"></line>
                            <line x1="2" y1="8" x2="22" y2="8"></line>
                        </svg>
                        <span>Console</span>
                    </button>
                    <button class="debug-tab" data-tab="elements">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="3" y1="9" x2="21" y2="9"></line>
                            <line x1="9" y1="21" x2="9" y2="9"></line>
                        </svg>
                        <span>Elements</span>
                    </button>
                    <button class="debug-tab" data-tab="network">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M2 12h20"></path>
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                        </svg>
                        <span>Network</span>
                    </button>
                    <button class="debug-tab" data-tab="performance">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 20v-6"></path>
                            <path d="M6 20v-12"></path>
                            <path d="M18 20V8"></path>
                        </svg>
                        <span>Performance</span>
                    </button>
                    <button class="debug-tab" data-tab="templates">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                            <path d="M12 11h4"></path>
                            <path d="M12 16h4"></path>
                            <path d="M8 11h.01"></path>
                            <path d="M8 16h.01"></path>
                        </svg>
                        <span>Templates</span>
                    </button>
                </div>
                <div class="debug-panels">
                    <div class="debug-panel active" id="console-panel">
                        <div class="console-filters">
                            <div class="filter-group">
                                <button class="filter-btn active" data-filter="all">All</button>
                                <button class="filter-btn" data-filter="info">Info</button>
                                <button class="filter-btn" data-filter="warn">Warnings</button>
                                <button class="filter-btn" data-filter="error">Errors</button>
                                <button class="filter-btn" data-filter="debug">Debug</button>
                            </div>
                            <div class="search-box">
                                <input type="text" placeholder="Filter logs..." id="console-search">
                            </div>
                        </div>
                        <div class="console-output" id="console-output"></div>
                        <div class="console-input">
                            <input type="text" id="console-input" placeholder="Enter command (type 'help' for available commands)..." />
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

        // Initially hidden, so set pointer-events to none to prevent blocking clicks
        if (panel.classList.contains('hidden')) {
            panel.style.pointerEvents = 'none';
            panel.style.visibility = 'hidden';
        }

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
                
                // Check if RequestForm debug container exists
                const requestFormDebugContainer = document.getElementById('visualization-debugger-container');
                if (requestFormDebugContainer) {
                    // If RequestForm debug container exists, just focus on it instead of creating popup
                    requestFormDebugContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    return;
                }
                
                // Only create popup if no RequestForm debug container exists
                this.toggleDebugPanel();
            }
        });
    }

    /**
     * Toggle debug panel visibility
     */
    static toggleDebugPanel() {
        // Check if RequestForm debug container exists first
        const requestFormDebugContainer = document.getElementById('visualization-debugger-container');
        if (requestFormDebugContainer) {
            return;
        }

        if (!this.debugPanel) return;

        const isHidden = this.debugPanel.classList.contains('hidden');

        if (isHidden) {
            // Show the panel
            this.debugPanel.style.pointerEvents = 'auto';
            this.debugPanel.style.visibility = 'visible';
            this.debugPanel.classList.remove('hidden');
            this.refreshDebugInfo();
        } else {
            // Hide the panel
            this.debugPanel.classList.add('hidden');
            this.debugPanel.style.pointerEvents = 'none';
        }
    }

    /**
     * Show debug panel
     */
    static showDebugPanel() {
        // Always check for RequestForm's debug console first
        const requestFormDebugContainer = document.getElementById('visualization-debugger-container');
        if (requestFormDebugContainer) {
            // If RequestForm debug container exists, set up the console output area
            
            // Remove any existing popup panels completely
            this.removePopupPanels();
            
            // Create console output area in RequestForm's debug container if it doesn't exist
            const debugContent = requestFormDebugContainer.querySelector('.debug-content');
            if (debugContent) {
                const placeholder = debugContent.querySelector('.modern-debug-placeholder');
                if (placeholder) {
                    // Replace placeholder with actual console output
                    placeholder.innerHTML = `
                        <div class="console-output" id="console-output" style="
                            flex: 1;
                            padding: 16px;
                            overflow-y: auto;
                            background: #0f172a;
                            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
                            scrollbar-width: thin;
                            scrollbar-color: #475569 #0f172a;
                            line-height: 1.6;
                            position: relative;
                            height: 300px;
                            border: 1px solid #1e293b;
                            border-radius: 8px;
                            color: #f8fafc;
                        "></div>
                    `;
                }
            }
            
            return;
        }

        // Only create popup panel if absolutely no RequestForm debug container exists
        if (!this.debugPanel) {
            this.createDebugPanel();
        }

        // Re-enable pointer events when showing panel
        this.debugPanel.style.pointerEvents = 'auto';
        this.debugPanel.style.visibility = 'visible';

        // Make sure all tabs are properly clickable
        const tabs = this.debugPanel.querySelectorAll('.debug-tab');
        tabs.forEach(tab => {
            tab.style.pointerEvents = 'auto';
            tab.style.zIndex = '1000';
            tab.style.cursor = 'pointer';
        });

        this.debugPanel.classList.remove('hidden');
        this.logToConsole('🔍 Debug panel opened', 'info');

        // Re-attach event listeners for tabs - important to make tabs clickable
        this.setupPanelEventListeners();
    }

    /**
     * Hide any existing popup debug panel
     */
    static hidePopupPanel() {
        // Hide the class-level debug panel
        if (this.debugPanel) {
            this.debugPanel.classList.add('hidden');
            this.debugPanel.style.pointerEvents = 'none';
            this.debugPanel.style.visibility = 'hidden';
            this.debugPanel.style.display = 'none';
        }
        
        // Also find and hide any existing popup panels in the DOM
        const existingPanels = document.querySelectorAll('#viz-debug-panel');
        existingPanels.forEach((panel, index) => {
            panel.style.display = 'none';
            panel.style.visibility = 'hidden';
            panel.style.pointerEvents = 'none';
            panel.classList.add('hidden');
        });
        
        // Clear the class reference to prevent it from being shown again
        if (this.debugPanel) {
            this.debugPanel = null;
        }
    }

    /**
     * Completely remove popup panels from DOM
     */
    static removePopupPanels() {
        const existingPanels = document.querySelectorAll('#viz-debug-panel');
        existingPanels.forEach((panel, index) => {
            panel.remove();
        });
        
        // Clear class reference
        this.debugPanel = null;
    }

    /**
     * Hide debug panel
     */
    static hideDebugPanel() {
        this.debugPanel.classList.add('hidden');

        // Ensure click events pass through immediately
        this.debugPanel.style.pointerEvents = 'none';
    }

    /**
     * Switch debug tab
     */
    static switchTab(tabName) {
        // Only look for tabs within the debug panel to avoid conflicts
        const debugPanel = document.getElementById('viz-debug-panel');
        if (!debugPanel) {
            return;
        }

        // Update tab buttons - scope to debug panel
        const tabs = debugPanel.querySelectorAll('.debug-tab');

        if (tabs.length > 0) {
            tabs.forEach(tab => {
                tab.classList.remove('active');
                tab.classList.remove('debug-tab-active'); // Also handle the CSS class from RequestForm.css
            });
        }

        const targetTab = debugPanel.querySelector(`.debug-tab[data-tab="${tabName}"]`);
        if (targetTab) {
            targetTab.classList.add('active');
            targetTab.classList.add('debug-tab-active'); // Also add the CSS class from RequestForm.css
        }

        // Update panels - scope to debug panel
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

        // Load tab content
        this.loadTabContent(tabName);
    }

    /**
     * Load content for specific tab
     */
    static loadTabContent(tabName) {
        switch (tabName) {
            case 'elements':
                // DISABLED: loadElementsTree() was causing performance issues
                break;
            case 'network':
                // DISABLED: loadNetworkRequests() was causing infinite loops and browser freezing
                break;
            case 'performance':
                // DISABLED: loadPerformanceMetrics() was causing excessive DOM operations
                break;
            case 'templates':
                // DISABLED: loadTemplateEditor() was causing memory issues
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
        // Clear any existing session with same ID
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

        // Clean up old sessions to prevent memory leaks (keep only the 3 most recent)
        if (this.debugSessions.size > 3) {
            const sessions = Array.from(this.debugSessions.entries());
            const oldestSessionId = sessions[0][0];
            this.debugSessions.delete(oldestSessionId);
        }

        // Initialize debug panel if not already done
        if (!this.debugPanel) {
            this.createDebugPanel();
        }

        // Log session start with URL-specific information  
        this.log(`🔍 Debug session started for: ${data?.method || 'GET'} ${data?.url || visualizationId} | Session ID: ${visualizationId}`, 'info');

        // Start performance monitoring (disabled to prevent infinite loops)
        // this.startPerformanceMonitoring(visualizationId);

        return session;
    }

    /**
     * Log debug message for specific session
     */
    static log(message, type = 'info', data = null, sessionId = null) {
        const timestamp = new Date().toISOString();

        // Process data to ensure it's serializable
        let processedData = data;
        if (data && typeof data === 'object') {
            try {
                // Create a clean copy of the data to avoid circular references
                processedData = JSON.parse(JSON.stringify(data));
            } catch (e) {
                // If data can't be stringified (e.g., circular references), convert to string
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

        // Store in specific session if provided, otherwise current session
        const targetSessionId = sessionId || this.currentSessionId;
        const session = this.debugSessions.get(targetSessionId);
        
        if (session) {
            session.logs.push(logEntry);
        }

        // Display in debug panel only if it's for the current session
        if (targetSessionId === this.currentSessionId) {
            this.displayLogInPanel(logEntry);
        }

        // Also log to browser console (only for errors and warnings to avoid spam)
        if (type === 'error' || type === 'warn') {
            console.log(`[VizDebug:${type}] ${message}`, data);
        }
    }

    /**
     * Display log entry in debug panel
     */
    static displayLogInPanel(logEntry) {
        // Prevent multiple simultaneous DOM operations
        if (this._isUpdatingDOM) {
            return; // Skip this log entry to prevent DOM overload
        }

        this._isUpdatingDOM = true;

        try {
            // First try to find RequestForm's debug console container
            let consoleOutput = document.getElementById('console-output');
            
            // If RequestForm debug console tab is active, try to use its container
            const requestFormDebugContainer = document.getElementById('visualization-debugger-container');
            if (requestFormDebugContainer && !consoleOutput) {
                // Create a console output area in RequestForm's debug container if it doesn't exist
                const debugContent = requestFormDebugContainer.querySelector('.debug-content');
                if (debugContent) {
                    const placeholder = debugContent.querySelector('.modern-debug-placeholder');
                    
                    if (placeholder) {
                        // Create the console output element directly
                        consoleOutput = document.createElement('div');
                        consoleOutput.className = 'console-output';
                        consoleOutput.id = 'console-output';
                        
                        // Apply minimal essential styles
                        Object.assign(consoleOutput.style, {
                            flex: '1',
                            padding: '16px',
                            overflowY: 'auto',
                            background: '#0f172a',
                            fontFamily: 'monospace',
                            lineHeight: '1.6',
                            minHeight: '200px',
                            border: '1px solid #1e293b',
                            borderRadius: '8px',
                            color: '#f8fafc'
                        });
                        
                        // Replace the placeholder with the console output element
                        placeholder.parentNode.replaceChild(consoleOutput, placeholder);
                    }
                }
            }
            
            if (!consoleOutput) {
                return;
            }

            // Create a simple log element without complex DOM structure
            const logElement = document.createElement('div');
            logElement.className = `console-entry console-entry-${logEntry.type}`;
            
            // Simple log format: [timestamp] LEVEL: message
            const timestamp = new Date(logEntry.timestamp).toLocaleTimeString();
            const simpleMessage = `[${timestamp}] ${logEntry.type.toUpperCase()}: ${logEntry.message}`;
            
            logElement.textContent = simpleMessage;
            
            // Add basic styling based on log type
            const typeColors = {
                error: '#ef4444',
                warn: '#f59e0b', 
                info: '#3b82f6',
                debug: '#8b5cf6',
                success: '#10b981'
            };
            
            logElement.style.color = typeColors[logEntry.type] || '#f8fafc';
            logElement.style.padding = '4px 8px';
            logElement.style.borderLeft = `3px solid ${typeColors[logEntry.type] || '#64748b'}`;
            logElement.style.marginBottom = '2px';

            consoleOutput.appendChild(logElement);
            
            // Auto-scroll to bottom
            consoleOutput.scrollTop = consoleOutput.scrollHeight;

        } finally {
            // Use a minimal timeout to reset the flag
            setTimeout(() => {
                this._isUpdatingDOM = false;
            }, 10);
        }
    }
        topRow.style.display = 'flex';
        topRow.style.width = '100%';
        topRow.style.alignItems = 'center';
        topRow.style.gap = '12px';

        topRow.appendChild(metaContainer);
        topRow.appendChild(messageElement);

        logElement.appendChild(topRow);

        if (logEntry.data) {
            // Create a separate div for data to ensure consistent formatting
            const dataWrapperElement = document.createElement('div');
            dataWrapperElement.className = 'console-data-wrapper';

            const dataElement = document.createElement('div');
            dataElement.className = 'console-data';

            // Add a header to the data section
            const dataHeader = document.createElement('div');
            dataHeader.style.marginBottom = '10px';
            dataHeader.style.color = '#94a3b8';
            dataHeader.style.fontSize = '13px';
            dataHeader.style.fontWeight = '600';
            dataHeader.style.display = 'flex';
            dataHeader.style.alignItems = 'center';
            dataHeader.style.gap = '6px';
            dataHeader.style.textTransform = 'uppercase';
            dataHeader.style.letterSpacing = '0.05em';
            dataHeader.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="3" y1="9" x2="21" y2="9"></line>
                    <line x1="9" y1="21" x2="9" y2="9"></line>
                </svg>
                <span>Request Data</span>
            `;
            dataElement.appendChild(dataHeader);

            // Create a pre element for better formatting
            const preElement = document.createElement('pre');
            preElement.style.margin = '0';
            preElement.style.padding = '10px 0';

            // Format JSON with proper indentation and syntax highlighting
            let formattedData;
            try {
                formattedData = JSON.stringify(logEntry.data, null, 2);

                // Simple syntax highlighting
                formattedData = formattedData
                    .replace(/"([^"]+)":/g, '<span style="color: #7dd3fc;">"$1":</span>') // keys
                    .replace(/"([^"]+)"/g, '<span style="color: #86efac;">"$1"</span>') // strings
                    .replace(/\b(true|false|null)\b/g, '<span style="color: #fb923c;">$1</span>'); // booleans, null
            } catch (e) {
                formattedData = String(logEntry.data);
            }

            preElement.innerHTML = formattedData;
            dataElement.appendChild(preElement);

            dataWrapperElement.appendChild(dataElement);
            logElement.appendChild(dataWrapperElement);

            // Add expand/collapse functionality for data
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'data-toggle-btn';
            toggleBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="18 15 12 9 6 15"></polyline>
                </svg>
            `;
            toggleBtn.style.position = 'absolute';
            toggleBtn.style.right = '12px';
            toggleBtn.style.top = '10px';
            toggleBtn.style.background = '#334155';
            toggleBtn.style.border = 'none';
            toggleBtn.style.borderRadius = '6px';
            toggleBtn.style.color = '#cbd5e1';
            toggleBtn.style.width = '28px';
            toggleBtn.style.height = '28px';
            toggleBtn.style.display = 'flex';
            toggleBtn.style.alignItems = 'center';
            toggleBtn.style.justifyContent = 'center';
            toggleBtn.style.cursor = 'pointer';
            toggleBtn.style.padding = '0';
            toggleBtn.style.transition = 'all 0.2s ease';
            toggleBtn.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.1)';

            toggleBtn.addEventListener('click', () => {
                const isExpanded = dataWrapperElement.style.display !== 'none';
                dataWrapperElement.style.display = isExpanded ? 'none' : 'block';
                toggleBtn.innerHTML = isExpanded ?
                    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>` :
                    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="18 15 12 9 6 15"></polyline>
                    </svg>`;
            });

            toggleBtn.addEventListener('mouseover', () => {
                toggleBtn.style.background = '#475569';
                toggleBtn.style.color = '#f1f5f9';
                toggleBtn.style.transform = 'translateY(-1px)';
                toggleBtn.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
            });

            toggleBtn.addEventListener('mouseout', () => {
                toggleBtn.style.background = '#334155';
                toggleBtn.style.color = '#cbd5e1';
                toggleBtn.style.transform = 'translateY(0)';
                toggleBtn.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.1)';
            });

            topRow.style.position = 'relative';
            topRow.appendChild(toggleBtn);
        }

        // Add entry timestamp as data-attribute for filtering/sorting
        logElement.dataset.timestamp = logEntry.timestamp;
        logElement.dataset.type = logEntry.type;

        // Append the log entry to the console output and scroll to the bottom
        consoleOutput.appendChild(logElement);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;

        // Add a smooth animation for new entries
        logElement.style.opacity = '0';
        logElement.style.transform = 'translateY(-10px)';
        logElement.style.transition = 'opacity 0.3s ease, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';

        // Apply current filter to the new log entry
        const activeFilter = document.querySelector('.filter-btn.active');
        const searchInput = document.querySelector('#console-search');

        if (activeFilter && activeFilter.dataset.filter !== 'all') {
            const filterType = activeFilter.dataset.filter;
            const searchTerm = searchInput ? searchInput.value.trim() : '';

            // Check if this log should be visible based on current filter
            const matchesType = filterType === 'all' || logEntry.type === filterType;
            let matchesSearch = true;

            if (searchTerm) {
                matchesSearch = logEntry.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (logEntry.data && JSON.stringify(logEntry.data).toLowerCase().includes(searchTerm.toLowerCase()));
            }

            if (!(matchesType && matchesSearch)) {
                logElement.style.display = 'none';
            }
        }

        // Trigger animation after a small delay for better visual effect
        setTimeout(() => {
            logElement.style.opacity = '1';
            logElement.style.transform = 'translateY(0)';
        }, 30);

        // Highlight the new entry briefly
        setTimeout(() => {
            logElement.style.backgroundColor = 'rgba(99, 102, 241, 0.08)';
            setTimeout(() => {
                logElement.style.backgroundColor = '';
                logElement.style.transition = 'background-color 0.5s ease';
            }, 800);
        }, 50);

        } finally {
            // Reset DOM update flag - DISABLED pending logs processing to prevent infinite recursion
            this._isUpdatingDOM = false;
            
            // DISABLED: Pending logs processing was causing infinite loops
            // The recursive calls to displayLogInPanel() were overwhelming the browser
            // Simple approach: just drop any pending logs to prevent freezing
            if (this._pendingLogs) {
                this._pendingLogs = []; // Clear but don't process
            }
        }
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
        // DISABLED: Performance monitoring was causing infinite loops and browser freezing
        // The constant setTimeout callbacks and DOM queries were overwhelming the main thread
        // Basic session tracking is sufficient for debugging needs
        
        const session = this.debugSessions.get(visualizationId);
        if (!session) return;

        // Only set basic performance data once, no continuous monitoring
        if (performance.memory) {
            session.performance.memoryUsage = performance.memory.usedJSHeapSize;
        }
        session.performance.renderTime = 0; // Disabled
        session.performance.domNodes = 0;   // Disabled
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
            // First remove any existing event listeners by cloning and replacing the tab
            const newTab = tab.cloneNode(true);

            // Make sure tab has proper pointer events enabled
            newTab.style.pointerEvents = 'auto';
            newTab.style.zIndex = '1000'; // Ensure tab is on top of other elements

            tab.parentNode.replaceChild(newTab, tab);

            // Add new click event listener with a direct approach
            newTab.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                console.log('Debug tab clicked:', this.dataset.tab);
                VisualizationDebugger.switchTab(this.dataset.tab);
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

        // Console filters
        this.debugPanel.querySelectorAll('.filter-btn').forEach(filterBtn => {
            filterBtn.addEventListener('click', () => {
                // Update active state
                this.debugPanel.querySelectorAll('.filter-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                filterBtn.classList.add('active');

                // Apply filter
                const filterType = filterBtn.dataset.filter;
                const searchInput = this.debugPanel.querySelector('#console-search');
                const searchTerm = searchInput ? searchInput.value.trim() : '';

                this.applyFilters(filterType, searchTerm);
            });
        });

        // Console search
        const searchInput = this.debugPanel.querySelector('#console-search');
        if (searchInput) {
            searchInput.addEventListener('input', (event) => {
                const activeFilter = this.debugPanel.querySelector('.filter-btn.active');
                const filterType = activeFilter ? activeFilter.dataset.filter : 'all';

                this.applyFilters(filterType, event.target.value.trim());
            });
        }
    }

    /**
     * Log message to console output
     */
    static logToConsole(message, type = 'info', data = null) {
        // Use the main log method for consistent logging
        this.log(message, type, data, this.currentSessionId);
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
        if (!elementsTree) return;

        const currentSession = this.getCurrentSession();
        if (!currentSession) {
            elementsTree.innerHTML = '<div class="placeholder">No active session</div>';
            return;
        }

        elementsTree.innerHTML = '<div class="loading">Loading elements...</div>';

        // Get elements from current session
        if (currentSession.element) {
            const elements = this.buildElementsTree(currentSession.element);
            elementsTree.innerHTML = elements;
        } else {
            elementsTree.innerHTML = '<div class="placeholder">No elements available for this session</div>';
        }
    }

    /**
     * Build elements tree HTML
     */
    static buildElementsTree(rootElement) {
        const buildNode = (element, level = 0) => {
            const tagName = element.tagName.toLowerCase();
            const className = element.className ? ` class="${element.className}"` : '';
            const id = element.id ? ` id="${element.id}"` : '';

            let html = `<div class="element-node" style="margin-left: ${level * 20}px;">
                <span class="element-tag">&lt;${tagName}${className}${id}&gt;</span>
            </div>`;

            Array.from(element.children).forEach(child => {
                html += buildNode(child, level + 1);
            });

            return html;
        };

        return buildNode(rootElement);
    }

    /**
     * Load network requests
     */
    static loadNetworkRequests() {
        const networkRequests = document.getElementById('network-requests');
        if (!networkRequests) return;

        const currentSession = this.getCurrentSession();
        if (!currentSession) {
            networkRequests.innerHTML = '<div class="placeholder">No active session</div>';
            return;
        }

        networkRequests.innerHTML = '<div class="loading">Loading network requests...</div>';

        // Display network requests from current session
        if (currentSession.networkRequests && currentSession.networkRequests.length > 0) {
            let html = '<div class="network-requests-list">';
            currentSession.networkRequests.forEach(request => {
                html += `
                    <div class="network-request-item">
                        <div class="request-method">${request.method}</div>
                        <div class="request-url">${request.url}</div>
                        <div class="request-status">${request.status || 'pending'}</div>
                        <div class="request-time">${new Date(request.timestamp).toLocaleTimeString()}</div>
                    </div>
                `;
            });
            html += '</div>';
            networkRequests.innerHTML = html;
        } else {
            networkRequests.innerHTML = '<div class="placeholder">No network requests yet</div>';
        }
    }

    /**
     * Load performance metrics
     */
    static loadPerformanceMetrics() {
        const performanceMetrics = document.getElementById('performance-metrics');
        if (!performanceMetrics) return;

        const currentSession = this.getCurrentSession();
        if (!currentSession) {
            performanceMetrics.innerHTML = '<div class="placeholder">No active session</div>';
            return;
        }

        performanceMetrics.innerHTML = '<div class="loading">Loading performance metrics...</div>';

        // Display performance metrics from current session
        this.updatePerformancePanel(currentSession);
    }

    /**
     * Load template editor
     */
    static loadTemplateEditor() {
        const templateEditor = document.getElementById('template-editor');
        if (!templateEditor) return;

        const currentSession = this.getCurrentSession();
        if (!currentSession) {
            templateEditor.innerHTML = '<div class="placeholder">No active session</div>';
            return;
        }

        templateEditor.innerHTML = '<div class="loading">Loading template editor...</div>';

        // Display session data in template editor
        const sessionData = {
            url: currentSession.url,
            method: currentSession.method,
            data: currentSession.data,
            performance: currentSession.performance
        };

        templateEditor.innerHTML = `
            <div class="template-editor-content">
                <h4>Session Data</h4>
                <pre class="session-data">${JSON.stringify(sessionData, null, 2)}</pre>
            </div>
        `;
    }

    /**
     * Clear console
     */
    static clearConsole() {
        // Clear console output in both RequestForm container and popup panel
        const consoleOutput = document.getElementById('console-output');
        if (consoleOutput) {
            consoleOutput.innerHTML = '';
        }
        
        // Also clear in popup panel if it exists
        if (this.debugPanel) {
            const popupConsoleOutput = this.debugPanel.querySelector('#console-output');
            if (popupConsoleOutput && popupConsoleOutput !== consoleOutput) {
                popupConsoleOutput.innerHTML = '';
            }
        }

        // Also clear logs for the current session
        const currentSession = this.getCurrentSession();
        if (currentSession) {
            currentSession.logs = [];
            this.log('🧹 Console cleared', 'info');

            // Re-apply current filter if any
            const activeFilter = document.querySelector('.filter-btn.active');
            const searchInput = document.querySelector('#console-search');

            if (activeFilter && searchInput) {
                this.applyFilters(
                    activeFilter.dataset.filter,
                    searchInput.value.trim()
                );
            }
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
                left: 20px;
                right: 20px;
                height: 420px;
                background: #111827;
                border-top: 2px solid #4f46e5;
                border-left: 1px solid #1f2937;
                border-right: 1px solid #1f2937;
                border-top-left-radius: 12px;
                border-top-right-radius: 12px;
                box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.25);
                z-index: 10000;
                display: flex;
                flex-direction: column;
                font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
                font-size: 14px;
                transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
                max-width: 1400px;
                margin: 0 auto;
                backdrop-filter: blur(12px);
                pointer-events: auto; /* Explicitly enable pointer events for visible panel */
            }
            
            .viz-debug-panel.hidden {
                transform: translateY(100%);
                opacity: 0;
                pointer-events: none; /* Disable interaction when hidden */
                visibility: hidden; /* Ensure it doesn't capture clicks */
            }
            
            .debug-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px 20px;
                background: #0f172a;
                border-bottom: 1px solid #1e293b;
                border-top-left-radius: 12px;
                border-top-right-radius: 12px;
            }
            
            .debug-header h3 {
                margin: 0;
                color: #f8fafc;
                font-size: 16px;
                font-weight: 600;
                letter-spacing: -0.01em;
                display: flex;
                align-items: center;
            }
            
            .debug-header h3 svg {
                margin-right: 12px;
                color: #6366f1;
            }
            
            .debug-controls {
                display: flex;
                gap: 10px;
            }
            
            .debug-btn {
                background: #1e293b;
                border: none;
                color: #f8fafc;
                padding: 8px 14px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 500;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                height: 36px;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
            }
            
            .debug-btn:hover {
                background: #2d3748;
                transform: translateY(-1px);
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            }
            
            .debug-btn:active {
                transform: translateY(0);
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
            }
            
            .debug-btn.close-btn {
                background: #1e293b;
                color: #94a3b8;
                width: 36px;
                height: 36px;
                padding: 0;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .debug-btn.close-btn:hover {
                background: #ef4444;
                color: white;
            }
            
            .debug-content {
                flex: 1;
                display: flex;
                flex-direction: column;
                height: 100%;
            }
            
            .debug-tabs {
                display: flex;
                background: #0f172a;
                border-bottom: 1px solid #1e293b;
                padding: 0 12px;
                overflow-x: auto;
                scrollbar-width: none;
                -ms-overflow-style: none;
            }
            
            .debug-tabs::-webkit-scrollbar {
                display: none;
            }
            
            .debug-tab {
                background: none;
                border: none;
                color: #94a3b8;
                padding: 12px 16px;
                cursor: pointer !important;
                font-size: 14px;
                font-weight: 500;
                border-bottom: 2px solid transparent;
                transition: all 0.2s ease;
                margin: 0 4px;
                position: relative;
                white-space: nowrap;
                display: flex;
                align-items: center;
                gap: 8px;
                pointer-events: auto !important;
                z-index: 1000;
            }
            
            .debug-tab.active {
                color: #6366f1;
                border-bottom-color: #6366f1;
                background-color: transparent;
            }
            
            .debug-tab::after {
                content: '';
                position: absolute;
                bottom: -2px;
                left: 0;
                width: 0;
                height: 2px;
                background-color: rgba(99, 102, 241, 0.5);
                transition: width 0.2s ease;
            }
            
            .debug-tab:hover:not(.active)::after {
                width: 100%;
            }
            
            .debug-tab:hover:not(.active) {
                color: #e2e8f0;
            }
            
            .debug-panels {
                flex: 1;
                position: relative;
                background: #0f172a;
                height: calc(100% - 45px);
            }
            
            .debug-panel {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                display: none;
                flex-direction: column;
                height: 100%;
                transition: opacity 0.2s ease;
                opacity: 0;
            }
            
            .debug-panel.active {
                display: flex !important;
                opacity: 1 !important;
                pointer-events: auto !important; /* Ensure interactions work when panel is visible */
                visibility: visible !important;
                z-index: 100;
            }
            
            .console-filters {
                display: flex;
                justify-content: space-between;
                padding: 12px 16px;
                background: #0f172a;
                border-bottom: 1px solid #1e293b;
                align-items: center;
            }
            
            .filter-group {
                display: flex;
                gap: 8px;
            }
            
            .filter-btn {
                background: #1e293b;
                border: none;
                color: #94a3b8;
                padding: 6px 12px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 500;
                transition: all 0.2s ease;
            }
            
            .filter-btn:hover {
                background: #334155;
                color: #f1f5f9;
            }
            
            .filter-btn.active {
                background: #3b82f6;
                color: #ffffff;
            }
            
            .search-box {
                position: relative;
            }
            
            .search-box input {
                background: #1e293b;
                border: 1px solid #334155;
                color: #f8fafc;
                padding: 6px 12px 6px 32px;
                border-radius: 6px;
                font-size: 13px;
                width: 200px;
                transition: all 0.2s ease;
            }
            
            .search-box input:focus {
                outline: none;
                border-color: #6366f1;
                background: #2d3748;
                width: 250px;
            }
            
            .search-box::before {
                content: "";
                position: absolute;
                left: 10px;
                top: 50%;
                transform: translateY(-50%);
                width: 14px;
                height: 14px;
                background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='8'%3E%3C/circle%3E%3Cline x1='21' y1='21' x2='16.65' y2='16.65'%3E%3C/line%3E%3C/svg%3E");
                background-repeat: no-repeat;
                background-position: center;
            }
            
            .console-output {
                flex: 1;
                padding: 16px;
                overflow-y: auto;
                background: #0f172a;
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
                scrollbar-width: thin;
                scrollbar-color: #475569 #0f172a;
                line-height: 1.6;
                position: relative;
            }
            
            .console-output::-webkit-scrollbar {
                width: 8px;
            }
            
            .console-output::-webkit-scrollbar-track {
                background: #0f172a;
                border-radius: 8px;
            }
            
            .console-output::-webkit-scrollbar-thumb {
                background: #475569;
                border-radius: 8px;
            }
            
            .console-output::-webkit-scrollbar-thumb:hover {
                background: #64748b;
            }
            
            .console-entry {
                margin-bottom: 12px;
                display: flex;
                flex-direction: column;
                align-items: stretch;
                padding: 12px 16px;
                border-radius: 8px;
                transition: all 0.2s ease;
                position: relative;
                border-left: 3px solid transparent;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            }
            
            .console-entry:hover {
                background-color: rgba(30, 41, 59, 0.8);
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            }
            
            .console-entry.console-entry-error,
            .console-entry.error {
                border-left-color: #ef4444;
                background-color: rgba(239, 68, 68, 0.05);
            }
            
            .console-entry.console-entry-warn,
            .console-entry.warn {
                border-left-color: #f59e0b;
                background-color: rgba(245, 158, 11, 0.05);
            }
            
            .console-entry.console-entry-info,
            .console-entry.info {
                border-left-color: #6366f1;
                background-color: rgba(99, 102, 241, 0.05);
            }
            
            .console-entry.console-entry-debug,
            .console-entry.debug {
                border-left-color: #94a3b8;
                background-color: rgba(148, 163, 184, 0.05);
            }
            
            .timestamp, .console-timestamp {
                color: #94a3b8;
                font-size: 12px;
                white-space: nowrap;
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
                letter-spacing: -0.3px;
            }
            
            .log-type, .console-level {
                font-size: 11px;
                font-weight: 600;
                min-width: 70px;
                text-align: center;
                white-space: nowrap;
                padding: 4px 10px;
                border-radius: 6px;
                text-transform: uppercase;
                letter-spacing: 0.3px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .console-entry-error .console-level,
            .error .log-type {
                background: rgba(239, 68, 68, 0.15);
                color: #ef4444;
            }
            
            .console-entry-warn .console-level,
            .warn .log-type {
                background: rgba(245, 158, 11, 0.15);
                color: #f59e0b;
            }
            
            .console-entry-info .console-level,
            .info .log-type {
                background: rgba(99, 102, 241, 0.15);
                color: #818cf8;
            }
            
            .console-entry-debug .console-level,
            .debug .log-type {
                background: rgba(148, 163, 184, 0.15);
                color: #cbd5e1;
            }
            
            .message, .console-message {
                color: #f8fafc;
                flex: 1;
                line-height: 1.6;
                font-size: 14px;
            }
            
            .log-data, .console-data {
                display: block;
                width: 100%;
                margin-top: 12px;
                padding: 14px 18px;
                background: #1e293b;
                border: 1px solid #334155;
                border-radius: 8px;
                font-size: 13px;
                color: #f1f5f9;
                white-space: pre-wrap;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }
            
            .console-data pre {
                margin: 0;
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
                font-size: 13px;
                color: #f1f5f9;
                line-height: 1.6;
                overflow-x: auto;
            }
            
            .console-data-wrapper {
                width: 100%;
                margin-top: 10px;
                box-sizing: border-box;
            }
            
            .data-toggle-btn {
                padding: 6px;
                border-radius: 6px;
                transition: all 0.2s ease;
                background: #334155;
                border: none;
                color: #cbd5e1;
                cursor: pointer;
            }
            
            .data-toggle-btn:hover {
                background-color: #475569;
                color: #f8fafc;
            }
            
            .console-input {
                border-top: 1px solid #1e293b;
                padding: 16px 20px;
                background: #0f172a;
                position: relative;
            }
            
            .console-input::before {
                content: ">";
                position: absolute;
                left: 36px;
                top: 50%;
                transform: translateY(-50%);
                color: #6366f1;
                font-weight: bold;
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
                font-size: 14px;
                z-index: 1;
            }
            
            .console-input input {
                width: 100%;
                background: #1e293b;
                border: 1px solid #334155;
                color: #f8fafc;
                padding: 12px 16px 12px 32px;
                border-radius: 8px;
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
                font-size: 14px;
                transition: all 0.2s ease;
                position: relative;
            }
            
            .console-input input:focus {
                outline: none;
                border-color: #6366f1;
                box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
                background: #2d3748;
            }
            
            .placeholder, .loading {
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100%;
                color: #94a3b8;
                font-style: italic;
            }
            
            /* Add pulsing animation for loading state */
            @keyframes pulse {
                0% { opacity: 0.6; }
                50% { opacity: 1; }
                100% { opacity: 0.6; }
            }
            
            .loading {
                animation: pulse 1.5s infinite ease-in-out;
            }
            
            /* Elements panel styling */
            .elements-tree {
                padding: 16px;
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
                font-size: 13px;
                line-height: 1.6;
                color: #f1f5f9;
                height: 100%;
                overflow: auto;
            }
            
            /* Network panel styling */
            .network-requests {
                padding: 16px;
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
                font-size: 13px;
                height: 100%;
                overflow: auto;
            }
            
            /* Performance panel styling */
            .performance-metrics {
                padding: 16px;
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
                font-size: 13px;
                height: 100%;
                overflow: auto;
            }
            
            /* Template editor styling */
            .template-editor {
                padding: 16px;
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
                font-size: 13px;
                height: 100%;
                overflow: auto;
            }
            
            /* Selection styling */
            ::selection {
                background: rgba(99, 102, 241, 0.3);
                color: #ffffff;
            }
            
            /* Element highlight styling */
            .element-highlight {
                outline: 2px solid #6366f1;
                outline-offset: 2px;
                position: relative;
            }
            
            /* Make the scrollbar consistent across panels */
            .elements-tree::-webkit-scrollbar,
            .network-requests::-webkit-scrollbar,
            .performance-metrics::-webkit-scrollbar,
            .template-editor::-webkit-scrollbar {
                width: 8px;
            }
            
            .elements-tree::-webkit-scrollbar-track,
            .network-requests::-webkit-scrollbar-track,
            .performance-metrics::-webkit-scrollbar-track,
            .template-editor::-webkit-scrollbar-track {
                background: #0f172a;
                border-radius: 8px;
            }
            
            .elements-tree::-webkit-scrollbar-thumb,
            .network-requests::-webkit-scrollbar-thumb,
            .performance-metrics::-webkit-scrollbar-thumb,
            .template-editor::-webkit-scrollbar-thumb {
                background: #475569;
                border-radius: 8px;
            }
            
            .elements-tree::-webkit-scrollbar-thumb:hover,
            .network-requests::-webkit-scrollbar-thumb:hover,
            .performance-metrics::-webkit-scrollbar-thumb:hover,
            .template-editor::-webkit-scrollbar-thumb:hover {
                background: #64748b;
            }
        `;
    }

    /**
     * Switch to a different debug session
     */
    static switchSession(sessionId) {
        if (this.debugSessions.has(sessionId)) {
            this.currentSessionId = sessionId;
            this.refreshDebugPanel();

            const session = this.debugSessions.get(sessionId);
            this.log(`✅ Switched to session: ${sessionId}`, 'info');
            this.log(`🌐 Session URL: ${session.url}`, 'info');
            this.log(`📊 Session method: ${session.method}`, 'info');

            // Update all panels with new session data
            this.loadTabContent(this.getCurrentActiveTab());
        } else {
            this.log(`❌ Session not found: ${sessionId}`, 'error');
        }
    }

    /**
     * Get current active tab
     */
    static getCurrentActiveTab() {
        const activeTab = document.querySelector('.debug-tab.active');
        return activeTab ? activeTab.dataset.tab : 'console';
    }

    /**
     * Update session with response data
     */
    static updateSessionResponse(sessionId, responseData) {
        const session = this.debugSessions.get(sessionId);
        if (session) {
            session.responseData = responseData;
            session.performance.requestTime = responseData.duration || 0;
            session.performance.responseSize = responseData.size || 0;
            session.performance.statusCode = responseData.status || null;
            session.performance.networkTime = responseData.networkTime || responseData.duration || 0;

            // Log response details
            this.log(`Response received: ${responseData.status} ${responseData.statusText}`, 'info', {
                status: responseData.status,
                size: responseData.size,
                duration: responseData.duration
            }, sessionId);

            // Update performance panel if this is the current session
            if (sessionId === this.currentSessionId) {
                this.updatePerformancePanel(session);
            }
        }
    }

    /**
     * Update session with network request data
     */
    static updateSessionNetworkRequest(sessionId, requestData) {
        const session = this.debugSessions.get(sessionId);
        if (session) {
            session.networkRequests.push({
                ...requestData,
                timestamp: Date.now()
            });

            this.log(`🌐 Network request: ${requestData.method} ${requestData.url}`, 'info', requestData, sessionId);

            // Update network panel if currently viewing this session
            if (sessionId === this.currentSessionId) {
                this.loadNetworkRequests();
            }
        }
    }

    /**
     * Get current session
     */
    static getCurrentSession() {
        return this.debugSessions.get(this.currentSessionId);
    }

    /**
     * Get session by ID
     */
    static getSession(sessionId) {
        return this.debugSessions.get(sessionId);
    }

    /**
     * Clear debug panel and reload with current session data
     */
    static refreshDebugPanel() {
        const consoleOutput = document.getElementById('console-output');
        if (consoleOutput) {
            consoleOutput.innerHTML = '';

            // Reload logs for current session
            const currentSession = this.getCurrentSession();
            if (currentSession) {
                currentSession.logs.forEach(log => {
                    this.displayLogInPanel(log);
                });
            }
        }
    }

    /**
     * Apply filters to console logs
     * @param {string} filter - The type filter to apply ('all', 'info', 'error', etc.)
     * @param {string} searchTerm - Optional search term to filter logs by content
     */
    static applyFilters(filter = 'all', searchTerm = '') {
        const consoleOutput = document.getElementById('console-output');
        if (!consoleOutput) return;

        // Get all log entries
        const entries = consoleOutput.querySelectorAll('.console-entry');

        entries.forEach(entry => {
            // Check type filter
            let matchesType = filter === 'all';
            if (!matchesType) {
                // Check if entry has class that matches filter
                matchesType = entry.classList.contains(`console-entry-${filter}`);
            }

            // Check search term
            let matchesSearch = true;
            if (searchTerm) {
                const messageContent = entry.textContent.toLowerCase();
                matchesSearch = messageContent.includes(searchTerm.toLowerCase());
            }

            // Show or hide based on both filters
            if (matchesType && matchesSearch) {
                entry.style.display = '';
                // Add a fade-in effect when showing
                entry.style.opacity = '0';
                setTimeout(() => {
                    entry.style.opacity = '1';
                }, 10);
            } else {
                entry.style.display = 'none';
            }
        });

        // Scroll to bottom if needed
        if (filter === 'all' && !searchTerm) {
            consoleOutput.scrollTop = consoleOutput.scrollHeight;
        }
    }

    /**
     * Add log entry to session (alias for log method for compatibility)
     */
    static addLog(sessionId, type, message, data = null) {
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
                
                // Update network panel if currently viewing this session
                if (sessionId === this.currentSessionId) {
                    // Temporarily disabled to prevent freezing
                    // this.loadNetworkRequests();
                }
            }
        }
    }
}

export default VisualizationDebugger;
